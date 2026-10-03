const express = require('express');
const { pool, query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { HttpError } = require('../middleware/errorHandler');
const { notify } = require('../services/notification');

const router = express.Router();
router.use(authenticate, authorize('student'));

// FR-04: register. Row lock + transaction prevents double-booking the last seat.
router.post('/events/:id(\\d+)/register', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [
      req.params.id,
    ]);
    const ev = rows[0];
    if (!ev || ev.status !== 'Approved') throw new HttpError(404, 'Event not found or not approved');
    if (new Date(ev.event_date) < new Date()) throw new HttpError(400, 'This event has already taken place');

    const { rows: existing } = await client.query(
      'SELECT * FROM registrations WHERE student_id=$1 AND event_id=$2',
      [req.user.id, ev.id]
    );
    if (existing[0]?.status === 'registered') throw new HttpError(409, 'You are already registered');
    if (ev.seats_available < 1) throw new HttpError(409, 'Event full');

    await client.query('UPDATE events SET seats_available = seats_available - 1 WHERE id = $1', [ev.id]);
    const { rows: reg } = existing[0]
      ? await client.query(
          `UPDATE registrations SET status='registered', registered_at=now()
           WHERE id=$1 RETURNING *`, [existing[0].id])
      : await client.query(
          'INSERT INTO registrations (student_id, event_id) VALUES ($1,$2) RETURNING *',
          [req.user.id, ev.id]);
    await client.query('COMMIT');

    const { rows: u } = await query('SELECT email FROM users WHERE id=$1', [req.user.id]);
    notify(u[0].email, 'Registration confirmed', `You are registered for "${ev.title}".`); // FR-06
    res.status(201).json({ registration: reg[0], seats_available: ev.seats_available - 1 });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// FR-04: cancel (frees the seat and assigns to first waitlisted person)
router.delete('/events/:id(\\d+)/register', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM events WHERE id = $1 FOR UPDATE', [req.params.id]);
    const { rows } = await client.query(
      `UPDATE registrations SET status='cancelled'
       WHERE student_id=$1 AND event_id=$2 AND status='registered' RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!rows[0]) throw new HttpError(404, 'No active registration found');
    await client.query('UPDATE events SET seats_available = seats_available + 1 WHERE id = $1', [
      req.params.id,
    ]);

    // Auto-assign seat to first person on waitlist
    const { rows: waitlisted } = await client.query(
      `SELECT w.student_id, u.email, e.title
       FROM waitlist w
       JOIN users u ON u.id = w.student_id
       JOIN events e ON e.id = w.event_id
       WHERE w.event_id = $1
       ORDER BY w.joined_at ASC
       LIMIT 1`,
      [req.params.id]
    );

    if (waitlisted[0]) {
      await client.query(
        'INSERT INTO registrations (student_id, event_id) VALUES ($1, $2) RETURNING *',
        [waitlisted[0].student_id, req.params.id]
      );
      await client.query('UPDATE events SET seats_available = seats_available - 1 WHERE id = $1', [req.params.id]);
      await client.query('DELETE FROM waitlist WHERE student_id = $1 AND event_id = $2', [waitlisted[0].student_id, req.params.id]);
      notify(waitlisted[0].email, 'Waitlist: You got a seat!', `A seat opened up for "${waitlisted[0].title}". You are now registered.`);
    }

    await client.query('COMMIT');
    res.json({ message: 'Registration cancelled' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.get('/registrations/mine', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT r.id, r.status, r.registered_at, e.id AS event_id, e.title, e.venue, e.event_date
       FROM registrations r JOIN events e ON e.id = r.event_id
       WHERE r.student_id = $1 AND r.status = 'registered' ORDER BY e.event_date`,
      [req.user.id]
    );
    res.json({ registrations: rows });
  } catch (err) {
    next(err);
  }
});

// Join waitlist for an event
router.post('/events/:id(\\d+)/waitlist', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [req.params.id]);
    const ev = rows[0];
    if (!ev || ev.status !== 'Approved') throw new HttpError(404, 'Event not found or not approved');
    if (new Date(ev.event_date) < new Date()) throw new HttpError(400, 'This event has already taken place');

    // Check if already registered or on waitlist
    const { rows: existingReg } = await client.query(
      'SELECT * FROM registrations WHERE student_id=$1 AND event_id=$2 AND status=$3',
      [req.user.id, ev.id, 'registered']
    );
    if (existingReg[0]) throw new HttpError(409, 'You are already registered for this event');

    const { rows: existingWait } = await client.query(
      'SELECT * FROM waitlist WHERE student_id=$1 AND event_id=$2',
      [req.user.id, ev.id]
    );
    if (existingWait[0]) throw new HttpError(409, 'You are already on the waitlist');

    if (ev.seats_available > 0) throw new HttpError(400, 'Seats are available - please register instead');

    await client.query(
      'INSERT INTO waitlist (student_id, event_id) VALUES ($1, $2) RETURNING *',
      [req.user.id, ev.id]
    );
    await client.query('COMMIT');

    const { rows: u } = await query('SELECT email FROM users WHERE id=$1', [req.user.id]);
    notify(u[0].email, 'Joined waitlist', `You've joined the waitlist for "${ev.title}". We'll notify you if a seat opens up.`);
    res.status(201).json({ message: 'Joined waitlist' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Leave waitlist
router.delete('/events/:id(\\d+)/waitlist', async (req, res, next) => {
  try {
    const { rows } = await query(
      'DELETE FROM waitlist WHERE student_id=$1 AND event_id=$2 RETURNING *',
      [req.user.id, req.params.id]
    );
    if (!rows[0]) throw new HttpError(404, 'You are not on the waitlist for this event');
    res.json({ message: 'Left waitlist' });
  } catch (err) {
    next(err);
  }
});

// Get user's waitlist entries
router.get('/waitlist/mine', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT w.id, w.joined_at, e.id AS event_id, e.title, e.venue, e.event_date, e.seats_available
       FROM waitlist w JOIN events e ON e.id = w.event_id
       WHERE w.student_id = $1 ORDER BY w.joined_at ASC`,
      [req.user.id]
    );
    res.json({ waitlist: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
