import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function MyRegistrations() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const load = () => api('/registrations/mine').then((d) => setItems(d.registrations)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    try { await api(`/events/${id}/register`, { method: 'DELETE' }); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <>
      <h2>My Registrations</h2>
      {error && <p className="error">{error}</p>}
      {items.length === 0 && <p className="muted">You have not registered for any events yet.</p>}
      {items.map((r) => (
        <div className="card row" key={r.id}>
          <div><h3>{r.title}</h3><p className="muted">{new Date(r.event_date).toLocaleString()} · {r.venue}</p></div>
          <button className="btn danger" onClick={() => cancel(r.event_id)}>Cancel</button>
        </div>
      ))}
    </>
  );
}
