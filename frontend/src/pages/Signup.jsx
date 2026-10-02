import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const home = {
  student: '/events',
  organizer: '/organizer',
  admin: '/admin',
};

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
  });

  const [error, setError] = useState('');

  const set = (key) => (e) => {
    setForm({
      ...form,
      [key]: e.target.value,
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const user = await signup(form);
      nav(home[user.role]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Create Account</h2>

      {error && <p className="error">{error}</p>}

      <label>
        Full Name
        <input
          type="text"
          required
          value={form.name}
          onChange={set('name')}
          placeholder="Enter your full name"
        />
      </label>

      <label>
        Institute Email
        <input
          type="email"
          required
          value={form.email}
          onChange={set('email')}
          placeholder="example@mnnit.ac.in"
        />
      </label>

      <label>
        Password
        <input
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={set('password')}
          placeholder="Minimum 8 characters"
        />
      </label>

      <label>
        I am a
        <select value={form.role} onChange={set('role')}>
          <option value="student">Student</option>
          <option value="organizer">Organizer</option>
          <option value="admin">Admin</option>
        </select>
      </label>

      <button className="btn" type="submit">
        Create Account
      </button>

      <p className="muted">
        Already registered? <Link to="/login">Login</Link>
      </p>
    </form>
  );
}