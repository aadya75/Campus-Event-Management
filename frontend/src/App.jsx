import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Events from './pages/Events';
import MyRegistrations from './pages/MyRegistrations';
import OrganizerDashboard from './pages/OrganizerDashboard';
import AdminApprovals from './pages/AdminApprovals';

const home = { student: '/events', organizer: '/organizer', admin: '/admin' };

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="container">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={home[user.role]} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to={user ? home[user.role] : '/events'} replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/events" element={<Events />} />
          <Route path="/my-registrations" element={<Guard roles={['student']}><MyRegistrations /></Guard>} />
          <Route path="/organizer" element={<Guard roles={['organizer']}><OrganizerDashboard /></Guard>} />
          <Route path="/admin" element={<Guard roles={['admin']}><AdminApprovals /></Guard>} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
