// Inserts demo users + events. Usage: npm run db:seed
// Demo passwords are for LOCAL DEVELOPMENT ONLY.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const days = (n) => new Date(Date.now() + n * 864e5).toISOString();

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
  const users = [
    ['Demo Admin', 'admin@cems.test', 'admin'],
    ['Demo Organizer', 'organizer@cems.test', 'organizer'],
    ['Demo Student', 'student@cems.test', 'student'],
  ];
  const hash = await bcrypt.hash('Password123', 10);
  for (const [name, email, role] of users)
    await pool.query(
      `INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)
       ON CONFLICT (email) DO NOTHING`, [name, email, hash, role]);

  const { rows } = await pool.query("SELECT id FROM users WHERE email='organizer@cems.test'");
  const { rows: cnt } = await pool.query('SELECT count(*)::int AS n FROM events');
  if (cnt[0].n === 0) {
    const evs = [
      ['Intro to Machine Learning Workshop', 'Hands-on beginner session.', 'Workshop', 'Lab 204', days(5), 40, 'Approved'],
      ['Annual Tech Fest Kickoff', 'Opening ceremony and demos.', 'Cultural', 'Main Auditorium', days(12), 200, 'Approved'],
      ['Startup Pitch Night', 'Five teams pitch to alumni.', 'Talk', 'Seminar Hall B', days(8), 2, 'Approved'],
      ['Chess Club Tournament', 'Awaiting admin approval.', 'Club', 'Common Room', days(15), 30, 'Pending'],
    ];
    for (const [t, d, c, v, dt, cap, st] of evs)
      await pool.query(
        `INSERT INTO events (title,description,category,venue,event_date,capacity,seats_available,status,organizer_id)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8)`, [t, d, c, v, dt, cap, st, rows[0].id]);
  }
  console.log('Seeded. Logins (password: Password123): admin@cems.test, organizer@cems.test, student@cems.test');
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
