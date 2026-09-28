import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['', 'General', 'Workshop', 'Talk', 'Cultural', 'Club', 'Sports'];

export default function Events() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [events, setEvents] = useState([]);
  const [mine, setMine] = useState(new Set());
  const [filters, setFilters] = useState({ q: '', category: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    const params = new URLSearchParams({ upcoming: 'true' });
    if (filters.q) params.set('q', filters.q);
    if (filters.category) params.set('category', filters.category);
    const d = await api(`/events?${params}`);
    setEvents(d.events);
    if (user?.role === 'student') {
      const r = await api('/registrations/mine');
      setMine(new Set(r.registrations.map((x) => x.event_id)));
    }
  }, [filters, user]);

  useEffect(() => { load().catch((e) => setMsg({ type: 'error', text: e.message })); }, [load]);

  const act = async (ev, register) => {
    if (!user) return nav('/login');
    try {
      await api(`/events/${ev.id}/register`, { method: register ? 'POST' : 'DELETE' });
      setMsg({ type: 'ok', text: register ? `Registered for "${ev.title}"` : 'Registration cancelled' });
      await load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); await load(); }
  };

  return (
    <>
      <h2>Upcoming Events</h2>
      <div className="filters">
        <input placeholder="Search events..." value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c || 'All categories'}</option>)}
        </select>
      </div>
      {msg.text && <p className={msg.type === 'error' ? 'error' : 'success'}>{msg.text}</p>}
      {events.length === 0 && <p className="muted">No events found.</p>}
      <div className="grid">
        {events.map((ev) => {
          const registered = mine.has(ev.id);
          const full = ev.seats_available < 1;
          return (
            <article className="card" key={ev.id}>
              <span className="tag">{ev.category}</span>
              <h3>{ev.title}</h3>
              <p>{ev.description}</p>
              <p className="muted">{new Date(ev.event_date).toLocaleString()} · {ev.venue}</p>
              <p><strong>{ev.seats_available}</strong> / {ev.capacity} seats left</p>
              {(!user || user.role === 'student') && (
                registered
                  ? <button className="btn danger" onClick={() => act(ev, false)}>Cancel registration</button>
                  : <button className="btn" disabled={full} onClick={() => act(ev, true)}>{full ? 'Event full' : 'Register'}</button>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
