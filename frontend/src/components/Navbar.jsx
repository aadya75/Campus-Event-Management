import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="navbar">
      <Link to="/" className="brand">CEMS</Link>
      <nav>
        <Link to="/events">Events</Link>
        {user?.role === 'student' && <Link to="/my-registrations">My Registrations</Link>}
        {user?.role === 'organizer' && <Link to="/organizer">My Events</Link>}
        {user?.role === 'admin' && <Link to="/admin">Approvals</Link>}
        {user ? (
          <>
            <span className="muted">{user.name} ({user.role})</span>
            <button className="btn small" onClick={() => { logout(); nav('/login'); }}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/signup">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  );
}
