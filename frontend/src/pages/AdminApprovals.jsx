
import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AdminApprovals() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    api('/events/manage/list?status=Pending')
      .then((d) => setEvents(d.events))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id, status) => {
    setError('');
    setMessage('');

    try {
      await api(`/events/${id}/status`, {
        method: 'PATCH',
        body: { status },
      });

      setMessage(
        status === 'Approved'
          ? 'Event approved successfully.'
          : 'Event rejected.'
      );

      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Admin Approvals</h2>

          <p className="muted">
            Review events submitted by organizers.
          </p>
        </div>
      </div>

      {message && (
        <p className="success">{message}</p>
      )}

      {error && (
        <p className="error">{error}</p>
      )}

      {events.length === 0 && (
        <div className="card">
          <p className="muted">
            No events waiting for approval.
          </p>
        </div>
      )}

      <div className="grid">
        {events.map((ev) => (
          <div className="card" key={ev.id}>
            <div className="event-top">
              <span className="tag">
                {ev.category}
              </span>

              <span className="badge Pending">
                Pending
              </span>
            </div>

            <h3>{ev.title}</h3>

            <p>{ev.description}</p>

            <p className="muted">
              Organizer: {ev.organizer_name}
            </p>

            <p className="muted">
              📅{' '}
              {new Date(
                ev.event_date
              ).toLocaleString()}
            </p>

            <p className="muted">
              📍 {ev.venue}
            </p>

            <p>
              Maximum seats:{' '}
              <strong>{ev.capacity}</strong>
            </p>

            <div className="row">
              <button
                className="btn"
                onClick={() =>
                  decide(ev.id, 'Approved')
                }
              >
                Approve
              </button>

              <button
                className="btn danger"
                onClick={() =>
                  decide(ev.id, 'Rejected')
                }
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}