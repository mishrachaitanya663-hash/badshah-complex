import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <div className="state-box">
        <h1>Page not found</h1>
        <p className="muted">Use the sidebar to navigate the admin panel.</p>
        <Link className="button primary" to="/">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
