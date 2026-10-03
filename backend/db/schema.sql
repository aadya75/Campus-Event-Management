-- CEMS database schema (PostgreSQL)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(10)  NOT NULL DEFAULT 'student'
                CHECK (role IN ('student', 'organizer', 'admin')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(150) NOT NULL CHECK (length(trim(title)) > 0),
  description     TEXT         NOT NULL DEFAULT '',
  category        VARCHAR(50)  NOT NULL DEFAULT 'General',
  venue           VARCHAR(150) NOT NULL,
  event_date      TIMESTAMPTZ  NOT NULL,
  capacity        INTEGER      NOT NULL CHECK (capacity > 0),
  seats_available INTEGER      NOT NULL CHECK (seats_available >= 0),
  status          VARCHAR(10)  NOT NULL DEFAULT 'Pending'
                  CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  organizer_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (seats_available <= capacity)
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS registrations (
  id            SERIAL PRIMARY KEY,
  student_id    INTEGER     NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  event_id      INTEGER     NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status        VARCHAR(10) NOT NULL DEFAULT 'registered'
                CHECK (status IN ('registered', 'cancelled')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, event_id)
);

CREATE TABLE IF NOT EXISTS waitlist (
  id            SERIAL PRIMARY KEY,
  student_id    INTEGER     NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  event_id      INTEGER     NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, event_date);
CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_event ON waitlist(event_id, joined_at);
