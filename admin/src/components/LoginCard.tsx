import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../api/AuthContext';
import { ErrorNote } from '../components/States';
import Icon from '../components/Icon';

export default function LoginCard() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <span className="login-mark">BC</span>
        <span><strong>Badshah Complex</strong><small>Admin workspace</small></span>
      </div>
      <form className="login-card" onSubmit={submit}>
        <span className="login-kicker"><Icon name="shield" size={16} /> Secure access</span>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to manage products, categories and inventory.</p>
        {error && <ErrorNote message={error} />}
        <label className="field">
          <span>Username</span>
          <input
            required
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="button primary full" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Login'}
        </button>
        <p className="login-hint">Use the credentials configured for your local admin account.</p>
      </form>
      <a className="login-back" href="/">
        <Icon name="arrow" size={14} /> Back to customer site
      </a>
    </div>
  );
}
