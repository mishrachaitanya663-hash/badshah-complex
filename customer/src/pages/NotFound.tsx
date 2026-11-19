import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <div className="state-box">
        <h1>Page not found</h1>
        <p className="muted">That page does not exist in this local build.</p>
        <Link className="button primary" to="/">
          Go home
        </Link>
      </div>
    </div>
  );
}
