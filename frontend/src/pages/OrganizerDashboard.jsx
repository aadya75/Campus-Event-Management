import { useEffect, useState } from 'react';
import { api } from '../api/client';
import EventForm from '../components/EventForm';

export default function OrganizerDashboard() {
  const [events, setEvents] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | event object
  const [registrants, setRegistrants] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/events/manage/list').then((d) => setEvents(d.events)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const save = async (data) => {
    setError('');
    try {
      if (editing === 'new') await api('/events', { method: 'POST', body: data });
      else await api(`/events/${editing.id}`, { method: 'PUT', body: data });
      setEditing(null); load();
    } catch (e) { setError(e.message); }
  };
  const remove = async (ev) => {
    if (!window.confirm(`Delete "${ev.title}"?`)) return;
    try { await api(`/events/${ev.id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e.message); }
  };
  const showRegistrants = async (ev) => {
    try { const d = await api(`/events/${ev.id}/registrants`); setRegistrants({ ev, list: d.registrants }); }
    catch (e) { setError(e.message); }
  };

  if (editing) return <>{error && <p className="error">{error}</p>}<EventForm initial={editing === 'new' ? null : editing} onSubmit={save} onCancel={() => setEditing(null)} /></>;

  return (
    <>
      <div className="row"><h2>My Events</h2><button className="btn" onClick={() => setEditing('new')}>+ New event</button></div>
      <p className="muted">New events are <b>Pending</b> until an admin approves them.</p>
      {error && <p className="error">{error}</p>}
      {events.length === 0 && <p className="muted">You haven't created any events yet.</p>}
      {events.map((ev) => (
        <div className="card row" key={ev.id}>
          <div>
            <h3>{ev.title} <span className={`badge ${ev.status}`}>{ev.status}</span></h3>
            <p className="muted">{new Date(ev.event_date).toLocaleString()} · {ev.venue} · {ev.capacity - ev.seats_available}/{ev.capacity} registered</p>
          </div>
          <div className="row">
            <button className="btn small ghost" onClick={() => showRegistrants(ev)}>Registrants</button>
            <button className="btn small" onClick={() => setEditing(ev)}>Edit</button>
            <button className="btn small danger" onClick={() => remove(ev)}>Delete</button>
          </div>
        </div>
      ))}
      {registrants && (
        <div className="card">
          <div className="row"><h3>Registrants: {registrants.ev.title}</h3><button className="btn small ghost" onClick={() => setRegistrants(null)}>Close</button></div>
          {registrants.list.length === 0 ? <p className="muted">No registrations yet.</p> :
            <ul>{registrants.list.map((r) => <li key={r.id}>{r.name} ({r.email})</li>)}</ul>}
        </div>
      )}
    </>
  );
}
