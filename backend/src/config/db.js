require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined, // Supabase requires SSL
});

module.exports = { pool, query: (text, params) => pool.query(text, params) };
