# World Cup Sweepstakes

A private-pool World Cup sweepstakes app built with Next.js, Prisma, SQLite, and Google sign-in.

## Development

Copy `.env.example` to `.env`, fill in local credentials, then run:

```sh
npm ci
npm run db:deploy
npm run db:seed
npm run dev
```

Run the full verification suite with:

```sh
npm run verify
```

## Configuration

Secrets and local database files must stay out of Git. Use `.env` for local configuration and deployment-specific environment variables in the hosting environment.
