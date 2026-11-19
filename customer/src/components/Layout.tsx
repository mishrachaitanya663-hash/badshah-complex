import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import LoginCard from './LoginCard';

export default function Layout() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const term = search.trim();
    navigate(term ? `/products?q=${encodeURIComponent(term)}` : '/products');
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <div className="announcement">
        <Icon name="sparkle" size={14} />
        Locally stocked essentials · Curated for everyday value
      </div>

      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand-logo">
            <img src="/images/dalmia-bharat-cement.svg" alt="Dalmia Bharat Cement" />
          </span>
          <span>
            <strong>Badshah Complex</strong>
            <small>Customer Store</small>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          <NavLink className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} to="/" end>
            Home
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} to="/products">
            Shop
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} to="/categories">
            Categories
          </NavLink>
        </nav>

        <form className="header-search" onSubmit={submitSearch}>
          <Icon name="search" size={17} />
          <input
            aria-label="Search products"
            placeholder="Search products…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </form>

        <button className="login-button" type="button" onClick={() => setLoginOpen(true)}>
          <Icon name="login" size={16} />
          Login
        </button>

        <button className="menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
      </header>

      {menuOpen && (
        <div className="mobile-nav">
          <form className="mobile-search" onSubmit={submitSearch}>
            <Icon name="search" size={16} />
            <input
              aria-label="Search products"
              placeholder="Search products…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </form>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/products">Shop all</NavLink>
          <NavLink to="/categories">Categories</NavLink>
          <button type="button" onClick={() => { setMenuOpen(false); setLoginOpen(true); }}>Admin login</button>
        </div>
      )}

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer" id="contact">
        <div className="footer-inner">
          <div className="footer-brand">
            <Link className="brand" to="/">
              <span className="brand-logo">
                <img src="/images/dalmia-bharat-cement.svg" alt="Dalmia Bharat Cement" />
              </span>
              <span>
                <strong>Badshah Complex</strong>
                <small>Customer Store</small>
              </span>
            </Link>
            <p>Thoughtfully stocked everyday essentials, brought together in one simple catalogue.</p>
            <div className="footer-contact">
              <span><Icon name="phone" size={15} /> Ask at the counter</span>
              <span><Icon name="mail" size={15} /> Located in your neighbourhood</span>
            </div>
          </div>

          <div className="footer-col">
            <h3>Shop</h3>
            <Link to="/products">All products</Link>
            <Link to="/products?sort=priority">Featured</Link>
            <Link to="/products?inStock=true">In stock</Link>
          </div>

          <div className="footer-col">
            <h3>Browse</h3>
            <Link to="/categories">All categories</Link>
            <Link to="/categories/snacks">Snacks</Link>
            <Link to="/categories/beverages">Beverages</Link>
            <Link to="/categories/personal-care">Personal Care</Link>
          </div>

          <div className="footer-col">
            <h3>Visit us</h3>
            <p>Badshah Complex</p>
            <p>Monday – Saturday<br />9:00 AM – 7:00 PM</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Badshah Complex. All rights reserved.</span>
          <span>Made for everyday essentials.</span>
        </div>
      </footer>

      {loginOpen && <LoginCard onClose={() => setLoginOpen(false)} />}
    </div>
  );
}
