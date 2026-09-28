const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { HttpError } = require('../middleware/errorHandler');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sign = (u) =>
  jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

// FR-01: signup (admins cannot self-register; they are created by seeding)
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password, role = 'student' } = req.body;
    if (!name?.trim()) throw new HttpError(400, 'Name is required');
    if (!EMAIL_RE.test(email || '')) throw new HttpError(400, 'A valid email is required');
    if (!password || password.length < 8)
      throw new HttpError(400, 'Password must be at least 8 characters');
    if (!['student', 'organizer'].includes(role))
      throw new HttpError(400, 'Role must be student or organizer');

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, lower($2), $3, $4) RETURNING id, name, email, role`,
      [name.trim(), email, hash, role]
    );
    res.status(201).json({ token: sign(rows[0]), user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') return next(new HttpError(409, 'Email already registered'));
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new HttpError(400, 'Email and password are required');
    const { rows } = await query('SELECT * FROM users WHERE email = lower($1)', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      throw new HttpError(401, 'Invalid email or password');
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, name, email, role FROM users WHERE id = $1', [
      req.user.id,
    ]);
    if (!rows[0]) throw new HttpError(401, 'User no longer exists');
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
