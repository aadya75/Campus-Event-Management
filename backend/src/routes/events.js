const express = require('express');
const { pool, query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { HttpError } = require('../middleware/errorHandler');
const { notify } = require('../services/notification');

const router = express.Router();

/** Validates and normalises event input (FR-02). */
function parseEvent(body) {
  const title = (body.title || '').trim();
  const venue = (body.venue || '').trim();
  const capacity = Number.parseInt(body.capacity, 10);
  const date = new Date(body.event_date);
  if (!title) throw new HttpError(400, 'Title is required');
  if (!venue) throw new HttpError(400, 'Venue is required');
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'A valid event date is required');
  if (!Number.isInteger(capacity) || capacity < 1)
    throw new HttpError(400, 'Capacity must be a whole number of at least 1');
  return {
    title,
    venue,
    capacity,
    event_date: date.toISOString(),
    description: (body.description || '').trim(),
    category: (body.category || 'General').trim() || 'General',
  };
}

/** Loads an event and checks the caller owns it (or is admin). */
async function getOwnedEvent(id, user, client = pool) {
  const { rows } = await client.query('SELECT * FROM events WHERE id = $1', [id]);
  const ev = rows[0];
  if (!ev) throw new HttpError(404, 'Event not found');
  if (user.role !== 'admin' && ev.organizer_id !== user.id)
    throw new HttpError(403, 'You can only manage your own events');
  return ev;
}

// FR-03: public catalog of APPROVED events, with search + filters
router.get('/', async (req, res, next) => {
  try {
    const { q, category, upcoming } = req.query;
    const where = ["e.status = 'Approved'"];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`);
    }
    if (category) {
      params.push(category);
      where.push(`e.category = $${params.length}`);
    }
    if (upcoming === 'true') where.push('e.event_date >= now()');
    const { rows } = await query(
      `SELECT e.*, u.name AS organizer_name,
       (SELECT COUNT(*) FROM waitlist w WHERE w.event_id = e.id) AS waitlist_count
       FROM events e
       JOIN users u ON u.id = e.organizer_id
       WHERE ${where.join(' AND ')} ORDER BY e.event_date ASC`,
      params
    );
    res.json({ events: rows });
  } catch (err) {
    next(err);
  }
});

// Organizer: all own events (any status). Admin: all events, optional ?status=
router.get('/manage/list', authenticate, authorize('organizer', 'admin'), async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    if (req.user.role === 'organizer') {
      params.push(req.user.id);
      where.push(`e.organizer_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`e.status = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT e.*, u.name AS organizer_name FROM events e
       JOIN users u ON u.id = e.organizer_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY e.event_date ASC`,
      params
    );
    res.json({ events: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id(\\d+)', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.*, u.name AS organizer_name,
       (SELECT COUNT(*) FROM waitlist w WHERE w.event_id = e.id) AS waitlist_count
       FROM events e
       JOIN users u ON u.id = e.organizer_id WHERE e.id = $1 AND e.status = 'Approved'`,
      [req.params.id]
    );
    if (!rows[0]) throw new HttpError(404, 'Event not found');
    res.json({ event: rows[0] });
  } catch (err) {
    next(err);
  }
});

// FR-02: create (starts as Pending until an admin approves it)
router.post('/', authenticate, authorize('organizer', 'admin'), async (req, res, next) => {
  try {
    const e = parseEvent(req.body);
    const { rows } = await query(
      `INSERT INTO events (title, description, category, venue, event_date, capacity,
                           seats_available, organizer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7) RETURNING *`,
      [e.title, e.description, e.category, e.venue, e.event_date, e.capacity, req.user.id]
    );
    res.status(201).json({ event: rows[0] });
  } catch (err) {
    next(err);
  }
});

// FR-02: edit. Capacity can't drop below the number of active registrations.
router.put('/:id(\\d+)', authenticate, authorize('organizer', 'admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const e = parseEvent(req.body);
    await client.query('BEGIN');
    const { rows: locked } = await client.query('SELECT * FROM events WHERE id=$1 FOR UPDATE', [
      req.params.id,
    ]);
    if (!locked[0]) throw new HttpError(404, 'Event not found');
    await getOwnedEvent(req.params.id, req.user, client);
    const taken = locked[0].capacity - locked[0].seats_available;
    if (e.capacity < taken)
      throw new HttpError(400, `Capacity cannot be lower than current registrations (${taken})`);
    const { rows } = await client.query(
      `UPDATE events SET title=$1, description=$2, category=$3, venue=$4, event_date=$5,
              capacity=$6::int, seats_available=$6::int-$7::int WHERE id=$8 RETURNING *`,
      [e.title, e.description, e.category, e.venue, e.event_date, e.capacity, taken, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ event: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/:id(\\d+)', authenticate, authorize('organizer', 'admin'), async (req, res, next) => {
  try {
    await getOwnedEvent(req.params.id, req.user);
    await query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// FR-05 (backend complete, UI in progress): admin approves / rejects
router.patch('/:id(\\d+)/status', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Approved', 'Rejected', 'Pending'].includes(status))
      throw new HttpError(400, 'Status must be Approved, Rejected or Pending');
    const { rows } = await query(
      `UPDATE events SET status=$1 WHERE id=$2 RETURNING *,
         (SELECT email FROM users WHERE id = events.organizer_id) AS organizer_email`,
      [status, req.params.id]
    );
    if (!rows[0]) throw new HttpError(404, 'Event not found');
    notify(rows[0].organizer_email, `Event ${status}`, `Your event "${rows[0].title}" was ${status}.`);
    res.json({ event: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Organizer/admin: list registrants of an event
router.get('/:id(\\d+)/registrants', authenticate, authorize('organizer', 'admin'), async (req, res, next) => {
  try {
    await getOwnedEvent(req.params.id, req.user);
    const { rows } = await query(
      `SELECT r.id, r.status, r.registered_at, u.name, u.email
       FROM registrations r JOIN users u ON u.id = r.student_id
       WHERE r.event_id = $1 AND r.status = 'registered' ORDER BY r.registered_at`,
      [req.params.id]
    );
    res.json({ registrants: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
