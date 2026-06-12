import Link from 'next/link';
import { CalendarDays, GitBranch, LayoutDashboard, Settings, Trophy, User } from 'lucide-react';

import { getCurrentSession } from '@/auth/session';

export async function Nav() {
  const session = await getCurrentSession();
  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/bracket', label: 'Bracket', icon: GitBranch },
    { href: '/schedule', label: 'Schedule', icon: CalendarDays },
    session?.user
      ? { href: '/account', label: 'Account', icon: User }
      : { href: '/login', label: 'Sign in', icon: User },
  ];

  return (
    <header className="app-header">
      <nav className="app-nav" aria-label="Primary navigation">
        <Link className="brand-link" href="/">
          <Trophy aria-hidden="true" size={20} />
          <span>World Cup Sweepstakes</span>
        </Link>

        <div className="nav-links">
          {links.map(({ href, label, icon: Icon }) => (
            <Link className="nav-link" href={href} key={href}>
              <Icon aria-hidden="true" size={16} />
              <span>{label}</span>
            </Link>
          ))}
          {session?.user?.isAdmin ? (
            <Link className="nav-link" href="/admin">
              <Settings aria-hidden="true" size={16} />
              <span>Admin</span>
            </Link>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
