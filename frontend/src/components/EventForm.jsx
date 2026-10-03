import { useState } from 'react';

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function EventForm({ initial, onSubmit, onCancel }) {
  const [f, setF] = useState({
    title: initial?.title || '', description: initial?.description || '',
    category: initial?.category || 'General', venue: initial?.venue || '',
    event_date: toLocalInput(initial?.event_date), capacity: initial?.capacity || 50,
    image_url: initial?.image_url || '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <form className="card form" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...f, event_date: new Date(f.event_date).toISOString() }); }}>
      <h3>{initial ? 'Edit event' : 'New event'}</h3>
      <label>Title<input required value={f.title} onChange={set('title')} /></label>
      <label>Description<textarea rows={3} value={f.description} onChange={set('description')} /></label>
      <label>Category
        <select value={f.category} onChange={set('category')}>
          {['General', 'Workshop', 'Talk', 'Cultural', 'Club', 'Sports'].map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>Venue<input required value={f.venue} onChange={set('venue')} /></label>
      <label>Date & time<input type="datetime-local" required value={f.event_date} onChange={set('event_date')} /></label>
      <label>Seat capacity<input type="number" min="1" required value={f.capacity} onChange={set('capacity')} /></label>
      <label>Image URL (optional)<input type="url" value={f.image_url} onChange={set('image_url')} placeholder="https://example.com/image.jpg" /></label>
      <div className="row"><button className="btn">Save</button><button type="button" className="btn ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}
