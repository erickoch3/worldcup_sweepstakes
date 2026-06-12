# World Cup Sweepstakes

A private-pool World Cup sweepstakes app built with Next.js, Prisma, SQLite, and Google sign-in.

## Local Setup

Use Node.js 26 and npm 11. If you use `nvm`, one local setup path is:

```sh
nvm install 26
nvm use 26
```

Install dependencies:

```sh
npm ci
```

Create a local environment file:

```sh
cp .env.example .env
```

For a local SQLite database, keep `DATABASE_URL` as:

```sh
DATABASE_URL="file:./data/worldcup.db"
```

Set `NEXTAUTH_SECRET` to a local secret:

```sh
openssl rand -base64 32
```

Paste that value into `.env`. Keep `NEXTAUTH_URL="http://localhost:3000"` for the default local dev server.

Google sign-in is only needed when testing authenticated flows. For that, create local OAuth credentials in Google Cloud Console with:

```text
Authorized JavaScript origin: http://localhost:3000
Authorized redirect URI: http://localhost:3000/api/auth/callback/google
```

Then set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `ADMIN_EMAILS` in `.env`.

## Database Setup

Apply migrations and seed the base World Cup data:

```sh
npm run db:generate
npm run db:deploy
npm run db:seed
```

The base seed loads teams and known fixtures.

To add local-only demo participants, preference submissions, and assigned teams, run:

```sh
npm run db:seed:demo
```

The demo seed is optional. It only runs against a SQLite `file:` database URL and resets draft assignments before creating deterministic fake data.

## Pull Scores, Fixtures, and Odds

The sync command can pull fixture and score data from the default match source:

```sh
npm run sync:worldcup
```

To test the sync without writing changes:

```sh
npm run sync:worldcup -- --dry-run --allow-missing-keys
```

Odds updates require The Odds API credentials. Add these to `.env` when needed:

```sh
THE_ODDS_API_KEY="..."
THE_ODDS_API_REGIONS="uk"
THE_ODDS_API_SPORT="soccer_fifa_world_cup_winner"
```

Then run:

```sh
npm run sync:worldcup
```

If you want to use API-Football for match data instead of the default match source, set:

```sh
WORLD_CUP_SYNC_MATCH_SOURCE="api-football"
API_FOOTBALL_API_KEY="..."
WORLD_CUP_SYNC_API_FOOTBALL_LEAGUE="1"
WORLD_CUP_SYNC_API_FOOTBALL_SEASON="2026"
```

## Run Locally

Start the app:

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visitors see the login page. To view seeded data in the browser, sign in with a Google account listed in `ADMIN_EMAILS`.

With the base seed, authenticated pages show seeded teams and fixtures. With `npm run db:seed:demo`, that signed-in local user can inspect fake player assignments across the dashboard, schedule, scores, and admin pages.

## Testing

```sh
npm run verify
```

For focused checks during development:

```sh
npm run typecheck
npm run test
npm run build
```

End-to-end tests are available with:

```sh
npm run e2e
```

## Configuration Notes

Secrets and local database files must stay out of Git. Use `.env` for local configuration and deployment-specific environment variables in the hosting environment.
