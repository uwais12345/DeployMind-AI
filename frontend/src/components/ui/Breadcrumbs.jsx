import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);
  if (pathnames.length === 0) return null;

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
      <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', textDecoration: 'none' }}
        onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
      >
        <Home size={12} /> Home
      </Link>
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const displayName = isNaN(name)
          ? name.charAt(0).toUpperCase() + name.slice(1)
          : `#${name}`;
        return (
          <React.Fragment key={name}>
            <ChevronRight size={11} style={{ color: 'var(--border)' }} />
            {isLast ? (
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{displayName}</span>
            ) : (
              <Link to={routeTo} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                {displayName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
