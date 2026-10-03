import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  '',
  'General',
  'Workshop',
  'Talk',
  'Cultural',
  'Club',
  'Sports',
];

export default function Events() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [events, setEvents] = useState([]);
  const [mine, setMine] = useState(new Set());
  const [waitlisted, setWaitlisted] = useState(new Set());
  const [imageErrors, setImageErrors] = useState(new Set());

  const [filters, setFilters] = useState({
    q: '',
    category: '',
  });

  const [msg, setMsg] = useState({
    type: '',
    text: '',
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      upcoming: 'true',
    });

    if (filters.q) {
      params.set('q', filters.q);
    }

    if (filters.category) {
      params.set('category', filters.category);
    }

    const d = await api(`/events?${params}`);
    setEvents(d.events);

    if (user?.role === 'student') {
      const r = await api('/registrations/mine');
      const w = await api('/waitlist/mine');

      setMine(
        new Set(
          r.registrations.map((x) => x.event_id)
        )
      );
      setWaitlisted(
        new Set(
          w.waitlist.map((x) => x.event_id)
        )
      );
    }
    setLoading(false);
  }, [filters, user]);

  useEffect(() => {
    load().catch((e) =>
      setMsg({
        type: 'error',
        text: e.message,
      })
    );
  }, [load]);

  const act = async (ev, action) => {
    if (!user) {
      return nav('/login');
    }

    setActionLoading(true);
    try {
      if (action === 'register') {
        await api(`/events/${ev.id}/register`, { method: 'POST' });
        setMsg({ type: 'ok', text: `You're registered for "${ev.title}"` });
      } else if (action === 'cancel') {
        await api(`/events/${ev.id}/register`, { method: 'DELETE' });
        setMsg({ type: 'ok', text: 'Registration cancelled' });
      } else if (action === 'waitlist') {
        await api(`/events/${ev.id}/waitlist`, { method: 'POST' });
        setMsg({ type: 'ok', text: `You're on the waitlist for "${ev.title}"` });
      } else if (action === 'leave-waitlist') {
        await api(`/events/${ev.id}/waitlist`, { method: 'DELETE' });
        setMsg({ type: 'ok', text: 'Left waitlist' });
      }

      await load();
    } catch (e) {
      setMsg({
        type: 'error',
        text: e.message,
      });

      await load();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="events-page">

      {/* HERO */}
      <section className="events-hero">

        <div className="hero-content">
          <div className="eyebrow">
            <span></span>
            CAMPUS EVENT MANAGEMENT SYSTEM
          </div>

          <h1>
            Discover.
            <br />
            Connect.
            <br />
            Experience.
          </h1>

          <p>
            Find workshops, talks, cultural events and
            exciting experiences happening around campus.
          </p>

          <button
            className="hero-button"
            onClick={() =>
              document
                .getElementById('events-list')
                ?.scrollIntoView({
                  behavior: 'smooth',
                })
            }
          >
            Explore Events
            <span>→</span>
          </button>
        </div>

        <div className="hero-visual">
          <div className="visual-orbit orbit-one"></div>
          <div className="visual-orbit orbit-two"></div>

          <div className="visual-card main-visual-card">
            <div className="visual-icon">✦</div>

            <div>
              <span>YOUR CAMPUS</span>
              <strong>YOUR EVENTS</strong>
            </div>
          </div>

          <div className="floating-card floating-one">
            <span>●</span>
            Workshops
          </div>

          <div className="floating-card floating-two">
            <span>✦</span>
            Cultural
          </div>

          <div className="floating-card floating-three">
            <span>→</span>
            Discover
          </div>
        </div>

      </section>

      {/* EVENTS SECTION */}
      <section
        className="events-section"
        id="events-list"
      >

        <div className="section-heading">
          <div>
            <div className="eyebrow">
              <span></span>
              WHAT'S HAPPENING
            </div>

            <h2>Upcoming Events</h2>

            <p>
              Explore what's happening on campus.
            </p>
          </div>

          <div className="event-count">
            {events.length}
            <span>events</span>
          </div>
        </div>

        {/* SEARCH */}
        <div className="search-panel">

          <div className="search-box">
            <span>⌕</span>

            <input
              placeholder="Search events..."
              value={filters.q}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  q: e.target.value,
                })
              }
            />
          </div>

          <select
            value={filters.category}
            onChange={(e) =>
              setFilters({
                ...filters,
                category: e.target.value,
              })
            }
          >
            {CATEGORIES.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category || 'All categories'}
              </option>
            ))}
          </select>

        </div>

        {/* CATEGORY NAV */}
        <div className="category-nav">

          {CATEGORIES.map((category) => (
            <button
              key={category}
              className={
                filters.category === category
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setFilters({
                  ...filters,
                  category,
                })
              }
            >
              {category || 'All Events'}
            </button>
          ))}

        </div>

        {/* MESSAGE */}
        {msg.text && (
          <div
            className={
              msg.type === 'error'
                ? 'message error'
                : 'message success'
            }
          >
            {msg.text}
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading events...</p>
          </div>
        )}

        {/* NO EVENTS */}
        {!loading && events.length === 0 && (
          <div className="empty-state">
            <div>✦</div>
            <h3>No events found</h3>
            <p>
              Try another search or category.
            </p>
          </div>
        )}

        {/* EVENT CARDS */}
        <div className="event-grid">

          {events.map((ev) => {
            const registered = mine.has(ev.id);
            const onWaitlist = waitlisted.has(ev.id);
            const full = ev.seats_available < 1;

            return (
              <article
                className="modern-event-card"
                key={ev.id}
              >

                {/* IMAGE AREA */}
                <div className="event-image">

                  {ev.image_url && !imageErrors.has(ev.id) ? (
                    <img
                      src={ev.image_url}
                      alt={ev.title}
                      className="event-image-img"
                      onError={() => setImageErrors(new Set([...imageErrors, ev.id]))}
                    />
                  ) : (
                    <div className="event-image-pattern"></div>
                  )}

                  <span className="event-category">
                    {ev.category}
                  </span>

                  <span className="event-arrow">
                    ↗
                  </span>

                </div>

                {/* CONTENT */}
                <div className="event-card-content">

                  <h3>{ev.title}</h3>

                  <p className="event-description">
                    {ev.description}
                  </p>

                  <div className="event-details">

                    <div>
                      <span>DATE</span>
                      <strong>
                        {new Date(
                          ev.event_date
                        ).toLocaleDateString(
                          undefined,
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>VENUE</span>
                      <strong>
                        {ev.venue}
                      </strong>
                    </div>

                  </div>

                  <div className="event-footer">

                    <div className="seat-info">
                      <div className="seat-label">
                        SEATS AVAILABLE
                      </div>

                      <strong>
                        {ev.seats_available}
                        <small>
                          {' '}
                          / {ev.capacity}
                        </small>
                      </strong>

                      <div className="seat-line">
                        <span
                          style={{
                            width: `${
                              Math.min(
                                100,
                                (ev.seats_available /
                                  ev.capacity) *
                                  100
                              )
                            }%`,
                          }}
                        ></span>
                      </div>

                      {ev.waitlist_count > 0 && (
                        <div className="waitlist-count">
                          {ev.waitlist_count} on waitlist
                        </div>
                      )}
                    </div>

                    {(!user ||
                      user.role === 'student') && (
                      registered ? (
                        <button
                          className="register-button cancel"
                          disabled={actionLoading}
                          onClick={() =>
                            act(ev, 'cancel')
                          }
                        >
                          {actionLoading ? '...' : 'Cancel'}
                        </button>
                      ) : onWaitlist ? (
                        <button
                          className="register-button cancel"
                          disabled={actionLoading}
                          onClick={() =>
                            act(ev, 'leave-waitlist')
                          }
                        >
                          {actionLoading ? '...' : 'Leave Waitlist'}
                        </button>
                      ) : full ? (
                        <button
                          className="register-button"
                          disabled={actionLoading}
                          onClick={() =>
                            act(ev, 'waitlist')
                          }
                        >
                          {actionLoading ? '...' : 'Join Waitlist'}
                          <span>→</span>
                        </button>
                      ) : (
                        <button
                          className="register-button"
                          disabled={actionLoading}
                          onClick={() =>
                            act(ev, 'register')
                          }
                        >
                          {actionLoading ? '...' : 'Register'}
                          <span>→</span>
                        </button>
                      )
                    )}

                  </div>

                </div>
              </article>
            );
          })}

        </div>

      </section>

    </div>
  );
}