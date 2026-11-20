import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../api/AuthContext';
import { CUSTOMER_URL } from '../config';
import Icon from '../components/Icon';

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const section = location.pathname.startsWith('/products')
    ? 'Products'
    : location.pathname.startsWith('/subcategories')
      ? 'Subcategories'
      : location.pathname.startsWith('/categories')
        ? 'Categories'
        : 'Dashboard';

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const term = search.trim();
    navigate(term ? `/products?q=${encodeURIComponent(term)}` : '/products');
  }

  async function signOut() {
    await logout().catch(() => undefined);
  }

  return (
    <div className={`admin-shell${menuOpen ? ' menu-open' : ''}`}>
      {menuOpen && (
        <button className="sidebar-scrim" type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
      )}
      <aside className="sidebar">
        <Link className="side-brand" to="/">
          <span className="side-mark">BC</span>
          <span>
            <strong>Badshah Complex</strong>
            <small>Admin workspace</small>
          </span>
        </Link>

        <nav className="side-nav" aria-label="Admin navigation">
          <p className="side-group">Workspace</p>
          <NavLink className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')} to="/" end>
            <Icon name="dashboard" />
            <span>Dashboard</span>
          </NavLink>

          <p className="side-group">Catalogue</p>
          <NavLink className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')} to="/products">
            <Icon name="products" />
            <span>Products</span>
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')} to="/categories">
            <Icon name="categories" />
            <span>Categories</span>
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')} to="/subcategories">
            <Icon name="grid" />
            <span>Subcategories</span>
          </NavLink>

          <p className="side-group">Shortcuts</p>
          <a className="side-link" href={CUSTOMER_URL}>
            <Icon name="external" />
            <span>Customer site</span>
          </a>
        </nav>

        <div className="sidebar-foot">
          <div className="side-user">
            <span className="side-avatar">{admin?.username.slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{admin?.username}</strong>
              <small>{admin?.role}</small>
            </span>
          </div>
          <button className="side-signout" type="button" onClick={() => void signOut()}>
            <Icon name="logout" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button className="icon-button mobile-menu" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <div className="breadcrumbs">
            <span>Admin</span>
            <Icon name="chevron" size={14} />
            <strong>{section}</strong>
          </div>
          <form className="top-search" onSubmit={submitSearch}>
            <Icon name="search" size={16} />
            <input
              aria-label="Search products"
              placeholder="Search products…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </form>
          <div className="topbar-status">
            <span className="status-dot" />
            Live catalog
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
