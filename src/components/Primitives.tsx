import { AlertCircle, BookOpen, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
export function BridgeMark({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? 'bridge-mark small' : 'bridge-mark'}
      width="42"
      height="32"
      viewBox="0 0 48 36"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 30h42M7 29V9m34 20V9M7 12c5 15 11 15 17 15s12 0 17-15M24 27V8M7 9l-4 4m38-4 4 4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Empty({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <BookOpen size={28} />}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? 'error' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      <AlertCircle size={17} />
      <span>{children}</span>
    </div>
  );
}
export function Busy({ children }: { children: ReactNode }) {
  return (
    <span className="busy">
      <LoaderCircle size={16} className="spin" />
      {children}
    </span>
  );
}
