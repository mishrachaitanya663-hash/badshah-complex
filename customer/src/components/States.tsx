import type { ReactNode } from 'react';
import Icon from './Icon';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state-box loading">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="state-box error" role="alert">
      <Icon name="alert" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="state-box empty">
      <Icon name="sparkle" size={22} />
      <span>{children}</span>
    </div>
  );
}

export function LoadingGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="product-grid">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton-media" />
          <div className="skeleton-line short" />
          <div className="skeleton-line" />
          <div className="skeleton-line tiny" />
        </div>
      ))}
    </div>
  );
}
