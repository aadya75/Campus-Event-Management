// Functional/API tests. Requires a separate test DB (see README): npm test
process.env.NODE_ENV = 'test';
require('dotenv').config();
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

let server, base;
const call = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};
const login = async (email) => (await call('POST', '/api/auth/login', { email, password: 'Password123' })).body.token;
const future = () => new Date(Date.now() + 5 * 864e5).toISOString();
const evBody = (o = {}) => ({ title: 'Test Event', venue: 'Hall A', event_date: future(), capacity: 2, ...o });

const ctx = {};
before(async () => {
  await pool.query('TRUNCATE registrations, events, users RESTART IDENTITY CASCADE');
  const hash = await bcrypt.hash('Password123', 4);
  for (const [n, e, r] of [['Admin', 'admin@t.com', 'admin'], ['Org', 'org@t.com', 'organizer'],
    ['Stu1', 's1@t.com', 'student'], ['Stu2', 's2@t.com', 'student'], ['Stu3', 's3@t.com', 'student']])
    await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)', [n, e, hash, r]);
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
  ctx.admin = await login('admin@t.com');
  ctx.org = await login('org@t.com');
  ctx.s1 = await login('s1@t.com');
  ctx.s2 = await login('s2@t.com');
  ctx.s3 = await login('s3@t.com');
});
after(async () => { server.close(); await pool.end(); });

test('TC-01 login with valid credentials returns token and role', async () => {
  const r = await call('POST', '/api/auth/login', { email: 's1@t.com', password: 'Password123' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, 'student');
  assert.ok(r.body.token);
});

test('TC-02 login with wrong password is rejected', async () => {
  const r = await call('POST', '/api/auth/login', { email: 's1@t.com', password: 'wrongpass' });
  assert.equal(r.status, 401);
});

test('TC-03 signup creates a student; duplicate email is rejected', async () => {
  const p = { name: 'New', email: 'new@t.com', password: 'Password123' };
  assert.equal((await call('POST', '/api/auth/signup', p)).status, 201);
  assert.equal((await call('POST', '/api/auth/signup', p)).status, 409);
});

test('TC-04 signup rejects short password and admin role', async () => {
  assert.equal((await call('POST', '/api/auth/signup', { name: 'x', email: 'a@b.com', password: '123' })).status, 400);
  assert.equal((await call('POST', '/api/auth/signup', { name: 'x', email: 'a@b.com', password: 'Password123', role: 'admin' })).status, 400);
});

test('TC-05 organizer creates event; blank title is rejected', async () => {
  const ok = await call('POST', '/api/events', evBody(), ctx.org);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.event.status, 'Pending');
  assert.equal(ok.body.event.seats_available, 2);
  ctx.eventId = ok.body.event.id;
  assert.equal((await call('POST', '/api/events', evBody({ title: '   ' }), ctx.org)).status, 400);
});

test('TC-06 student cannot create events (RBAC enforced server-side)', async () => {
  assert.equal((await call('POST', '/api/events', evBody(), ctx.s1)).status, 403);
  assert.equal((await call('POST', '/api/events', evBody())).status, 401);
});

test('TC-07 pending event is hidden from catalog and cannot be registered for', async () => {
  const list = await call('GET', '/api/events');
  assert.equal(list.body.events.length, 0);
  assert.equal((await call('POST', `/api/events/${ctx.eventId}/register`, null, ctx.s1)).status, 404);
});

test('TC-08 only admin can approve; approved event appears in catalog', async () => {
  const path = `/api/events/${ctx.eventId}/status`;
  assert.equal((await call('PATCH', path, { status: 'Approved' }, ctx.org)).status, 403);
  assert.equal((await call('PATCH', path, { status: 'Approved' }, ctx.admin)).status, 200);
  const list = await call('GET', '/api/events?q=test');
  assert.equal(list.body.events.length, 1);
});

test('TC-09 student registers: seat count decrements', async () => {
  const r = await call('POST', `/api/events/${ctx.eventId}/register`, null, ctx.s1);
  assert.equal(r.status, 201);
  assert.equal(r.body.seats_available, 1);
});

test('TC-10 duplicate registration is blocked', async () => {
  assert.equal((await call('POST', `/api/events/${ctx.eventId}/register`, null, ctx.s1)).status, 409);
});

test('TC-11 full event blocks registration ("Event full")', async () => {
  assert.equal((await call('POST', `/api/events/${ctx.eventId}/register`, null, ctx.s2)).status, 201);
  const r = await call('POST', `/api/events/${ctx.eventId}/register`, null, ctx.s3);
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'Event full');
});

test('TC-12 concurrent registrations never over-book the last seat', async () => {
  const e = await call('POST', '/api/events', evBody({ capacity: 1 }), ctx.org);
  await call('PATCH', `/api/events/${e.body.event.id}/status`, { status: 'Approved' }, ctx.admin);
  const results = await Promise.all([ctx.s1, ctx.s2, ctx.s3].map((t) =>
    call('POST', `/api/events/${e.body.event.id}/register`, null, t)));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  const { rows } = await pool.query('SELECT seats_available FROM events WHERE id=$1', [e.body.event.id]);
  assert.equal(rows[0].seats_available, 0);
});

test('TC-13 cancel registration frees the seat; can re-register', async () => {
  assert.equal((await call('DELETE', `/api/events/${ctx.eventId}/register`, null, ctx.s1)).status, 200);
  const ev = await call('GET', `/api/events/${ctx.eventId}`);
  assert.equal(ev.body.event.seats_available, 1);
  assert.equal((await call('POST', `/api/events/${ctx.eventId}/register`, null, ctx.s1)).status, 201);
});

test('TC-14 organizer can list registrants; capacity cannot drop below registrations', async () => {
  const reg = await call('GET', `/api/events/${ctx.eventId}/registrants`, null, ctx.org);
  assert.equal(reg.body.registrants.length, 2);
  const put = await call('PUT', `/api/events/${ctx.eventId}`, evBody({ capacity: 1 }), ctx.org);
  assert.equal(put.status, 400);
  const ok = await call('PUT', `/api/events/${ctx.eventId}`, evBody({ title: 'Renamed', capacity: 5 }), ctx.org);
  assert.equal(ok.body.event.seats_available, 3);
});

test('TC-15 organizer deletes own event', async () => {
  assert.equal((await call('DELETE', `/api/events/${ctx.eventId}`, null, ctx.org)).status, 204);
  assert.equal((await call('GET', `/api/events/${ctx.eventId}`)).status, 404);
});
