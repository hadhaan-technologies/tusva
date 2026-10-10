# TUSVA

TUSVA is a single-institution online quiz and examination platform for Jain University. It includes student, faculty, and administrator workspaces, rich question content with image-based options, and an examination workflow backed by Supabase.

## Run locally

Requirements: Node.js 22 (see `.nvmrc`) and an active Supabase project.

```sh
npm ci
cp .env.example .env.local
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`, then start the Vite server:

```sh
npm run dev
```

Never put a Supabase service-role or secret key in a `VITE_` variable. It would be exposed to browser clients.

## Checks

```sh
npm run check
```

This runs TypeScript checks, unit/domain tests, component tests, database integration tests, and a production build. See [Testing and Auth Setup](docs/TESTING_AND_AUTH_SETUP.md) and [Contributing](CONTRIBUTING.md) for release steps and issue tracking.

## Supabase setup

Apply the migrations in `supabase/migrations` to the connected Supabase project and deploy the functions in `supabase/functions`. Configure the signup confirmation email to include `{{ .Token }}` and use production SMTP before opening signup to the institution. A verified OTP proves mailbox access; it does not independently confirm a student's name or USN.

## Deployment

GitHub Actions runs checks on pull requests and deploys `dist` to Cloudflare Pages after a passing push to `main`. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID` as repository secrets, and `CLOUDFLARE_PAGES_PROJECT` as a repository variable.
