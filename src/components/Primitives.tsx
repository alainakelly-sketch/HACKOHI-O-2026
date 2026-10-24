import { AlertCircle, BookOpen, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
export function BridgeMark({ small = false }: { small?: boolean }) {
  return (
    <img
      className={small ? 'bridge-mark small' : 'bridge-mark'}
      src="/paperbridge-icon.png"
      width={small ? 42 : 72}
      height={small ? 42 : 72}
      alt={small ? '' : 'PaperBridge logo'}
      aria-hidden={small ? true : undefined}
    />
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
