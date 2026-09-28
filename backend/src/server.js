const app = require('./app');

if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
  console.error('Missing JWT_SECRET or DATABASE_URL. Copy .env.example to .env first.');
  process.exit(1);
}
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`CEMS API running on http://localhost:${port}`));
