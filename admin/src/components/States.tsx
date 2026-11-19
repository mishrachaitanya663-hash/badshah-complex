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

export function Notice({ message }: { message: string }) {
  return (
    <div className="state-box success" role="status">
      <Icon name="check" />
      <span>{message}</span>
    </div>
  );
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="toast" role="status">
      <Icon name="check" />
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="dialog-card" role="dialog" aria-modal="true" aria-label={title}>
        <span className="dialog-icon danger">
          <Icon name="trash" />
        </span>
        <h3>{title}</h3>
        <p>{message}</p>
        {children}
        <div className="dialog-actions">
          <button className="button ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="button danger" type="button" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="state-box empty">{children}</div>;
}
