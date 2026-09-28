import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await signup(form);
      nav(user.role === 'organizer' ? '/organizer' : '/events');
    } catch (err) { setError(err.message); }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Create account</h2>
      {error && <p className="error">{error}</p>}
      <label>Full name<input required value={form.name} onChange={set('name')} /></label>
      <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
      <label>Password (min 8 characters)<input type="password" required minLength={8} value={form.password} onChange={set('password')} /></label>
      <label>I am a
        <select value={form.role} onChange={set('role')}>
          <option value="student">Student</option>
          <option value="organizer">Organizer</option>
        </select>
      </label>
      <button className="btn">Sign up</button>
      <p className="muted">Already registered? <Link to="/login">Login</Link></p>
    </form>
  );
}
