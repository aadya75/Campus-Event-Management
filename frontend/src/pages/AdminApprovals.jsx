import { useEffect, useState } from 'react';
import { api } from '../api/client';

// Admin approval queue (FR-05). UI is a minimal first version; polish is planned for Increment 3.
export default function AdminApprovals() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const load = () => api('/events/manage/list?status=Pending').then((d) => setEvents(d.events)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const decide = async (id, status) => {
    try { await api(`/events/${id}/status`, { method: 'PATCH', body: { status } }); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <>
      <h2>Pending Approvals</h2>
      {error && <p className="error">{error}</p>}
      {events.length === 0 && <p className="muted">No events waiting for approval.</p>}
      {events.map((ev) => (
        <div className="card row" key={ev.id}>
          <div><h3>{ev.title}</h3><p className="muted">By {ev.organizer_name} · {new Date(ev.event_date).toLocaleString()} · {ev.venue} · capacity {ev.capacity}</p></div>
          <div className="row">
            <button className="btn small" onClick={() => decide(ev.id, 'Approved')}>Approve</button>
            <button className="btn small danger" onClick={() => decide(ev.id, 'Rejected')}>Reject</button>
          </div>
        </div>
      ))}
    </>
  );
}
