// Creates tables. Usage: npm run db:init   (or: DB=test node scripts/initDb.js)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

(async () => {
  const url = process.env.DB === 'test' ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
  await pool.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
  console.log('Schema applied.');
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
