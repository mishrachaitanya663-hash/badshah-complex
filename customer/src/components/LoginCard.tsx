import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Icon from './Icon';
import { ADMIN_URL } from '../config';

type Props = {
  onClose: () => void;
};

export default function LoginCard({ onClose }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await response.json().catch(() => null)) as { token?: string; error?: string } | null;
      if (!response.ok || !data?.token) throw new Error(data?.error || 'Login failed');

      localStorage.setItem('badshah_admin_token', data.token);
      window.location.assign(ADMIN_URL);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Login failed');
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="login-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Admin login">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
        <span className="modal-mark"><Icon name="shield" size={20} /></span>
        <span className="login-kicker"><Icon name="shield" size={14} /> Admin access</span>
        <h2>Welcome back</h2>
        <p className="muted">Sign in to manage the Badshah Complex catalogue.</p>
        {error && <p className="modal-error">{error}</p>}
        <label className="field">
          <span>Username</span>
          <input
            ref={firstField}
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
      </form>
    </div>
  );
}
