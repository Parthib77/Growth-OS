import type { ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';

export function IconWell({
  children,
  tone = 'mint',
}: {
  children: ReactNode;
  tone?: 'mint' | 'blue' | 'red';
}) {
  return (
    <span className={`workspace-icon-well ${tone}`} aria-hidden="true">
      {children}
    </span>
  );
}

export function TodayBadge() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(now);
  const greeting =
    now.getHours() < 12
      ? 'Good morning!'
      : now.getHours() < 18
        ? 'Good afternoon!'
        : 'Good evening!';

  return (
    <div className="workspace-today-badge" aria-label={`Today is ${date}`}>
      <IconWell>
        <CalendarDays size={20} strokeWidth={2} />
      </IconWell>
      <span>
        <strong>{date}</strong>
        <small>{greeting}</small>
      </span>
    </div>
  );
}
