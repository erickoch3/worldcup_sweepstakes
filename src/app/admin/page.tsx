import Link from 'next/link';

import { requireAdmin } from '@/auth/session';

const adminLinks = [
  {
    href: '/admin/invites',
    title: 'Invites',
    description: 'Create registration links and inspect invite usage.',
  },
  {
    href: '/admin/teams',
    title: 'Teams and win probability',
    description: 'Review active teams, groups, and current win probabilities.',
  },
  {
    href: '/admin/draft',
    title: 'Draft',
    description: 'Process the draw and inspect preference submissions.',
  },
  {
    href: '/admin/matches',
    title: 'Matches',
    description: 'Create fixtures and track scores, winners, and match status.',
  },
  {
    href: '/admin/prizes',
    title: 'Prizes',
    description: 'Review the prize pool from the standard player buy-in.',
  },
];

export default async function AdminPage() {
  await requireAdmin();

  return (
    <main className="page-shell page-stack">
      <section className="panel" aria-labelledby="admin-heading">
        <div className="panel-heading">
          <h2 id="admin-heading">Admin</h2>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Use</th>
              </tr>
            </thead>
            <tbody>
              {adminLinks.map((link) => (
                <tr key={link.href}>
                  <td>
                    <Link className="nav-link" href={link.href}>
                      <span>{link.title}</span>
                    </Link>
                  </td>
                  <td>{link.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
