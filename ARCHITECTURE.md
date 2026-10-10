# TUSVA architecture and operation

## Implemented architecture

- React, TypeScript, Vite and Tailwind CSS provide the static client. Cloudflare Pages can build `npm run build` and publish `dist`; only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong in frontend build variables.
- Supabase Auth verifies sign-in. The active role comes from `profiles.role`, never user-editable Auth metadata. Account invitations, role updates and CSV provisioning run through the `admin-accounts` Edge Function.
- PostgreSQL is the authority for academic records, question content, assignment, attempts and evaluation. Every public application table has RLS. `private.current_role()` uses the authenticated caller identity, and trusted operations use restricted service credentials only inside Edge Functions.
- `question_banks`, `questions`, `question_options`, and `question_answer_keys` form the reusable question model. Statement, explanation and option content are ordered JSON blocks containing text, LaTeX or stable image asset UUIDs. Option content can be image-only, text-only or mixed. Answer keys are stored separately and student requests never return them.
- The private `question-media` Storage bucket allows authenticated faculty uploads in per-user paths. `register-question-media` validates file bytes, size, UUID path and extension before recording metadata. The exam endpoint checks quiz membership and assignment before returning short-lived signed image URLs.
- The exam Edge Function owns eligibility checks, attempt creation, random order, answer autosaves, violation counts, deadlines, submission and objective grading. `faculty-results` handles authorized review, manual grading, result release and CSV data. Domain rules shared by the server endpoints are covered by unit tests.
- Database RPCs `save_question` and `save_quiz` write multi-row edits atomically. Triggers lock published question content and quiz composition after publication or an attempt. Attempt status, marks, answer keys and audit records are not client-writable.

## Initial setup

### Connected Supabase project status

The configured project is `Tusva` (`vhskvjjswbhopwingqhr`, `ap-south-1`). The initial schema migration is applied; its 18 application tables have RLS enabled with 37 policies, and the private `question-media` bucket is configured for JPEG, PNG and WebP up to 10 MiB. The `exam-attempt`, `register-question-media`, `faculty-results`, and `admin-accounts` Edge Functions are deployed with JWT verification enabled. The local `.env.local` points at this project.

There are currently no Auth users. Create the first administrator identity in the Supabase Dashboard, then add its profile using the SQL shown in step 5 below. After that, use the Administrator portal to invite faculty and students. No dummy login accounts have been created, and this connected project has not had a full sign-in or exam-flow smoke test yet.

The Supabase Security Advisor is clear. The platform's `public.rls_auto_enable()` event trigger remains enabled, but direct RPC execution has been revoked for public and signed-in users. Performance Advisor index and policy notices should be reassessed after the project has real application traffic.

1. Use Node.js 24 (also declared in `.nvmrc` and `package.json`), then run `npm ci`.
2. Create a Supabase project. In **Project Settings → API**, copy its project URL and publishable/anon key into `.env.local` using `.env.example` as a template. Never put a service-role key in a `VITE_` variable.
3. Install/use the Supabase CLI, then link and apply the schema:

   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   The migration assumes a new Supabase project with its standard `auth` and `storage` schemas. Review the pending migration before confirming the push.
4. Deploy the four functions with JWT verification enabled and set their application secrets:

   ```sh
   npx supabase secrets set APP_ORIGIN=https://YOUR_SITE.pages.dev INSTITUTION_EMAIL_DOMAIN=college.edu
   npx supabase functions deploy register-question-media
   npx supabase functions deploy exam-attempt
   npx supabase functions deploy faculty-results
   npx supabase functions deploy admin-accounts
   ```

   Replace the example domain with the college’s email domain. Supabase injects its project URL and server secret into deployed functions; do not copy those secrets into frontend settings.
5. Create the first Auth user in the Supabase Dashboard. Copy that user’s UUID, then create the administrator profile in the SQL Editor:

   ```sql
   insert into public.profiles (id, role, full_name, institutional_email)
   values ('AUTH_USER_UUID', 'admin', 'College Administrator', 'admin@college.edu');
   ```

   Use the same email as the Auth identity. Sign in with that account and invite the remaining faculty and students from **Administrator → Accounts**. For bulk import, use the CSV columns shown in that portal.
6. Students can request accounts from **Create an account**. Registration is student-only, requires a branch code already configured by an administrator, and creates an inactive profile for review. Confirm the email, then an administrator must verify the details and activate the account in **Administrator → Accounts**. Faculty and administrator access remains invitation-only.
7. In **Supabase → Authentication → URL Configuration**, set the Site URL to the deployed site and allow its exact URL as a redirect. Enable email confirmation for institutional accounts. Configure a custom SMTP sender before relying on invitations at production scale. The app only grants a portal to users with an active `profiles` record.
8. Push this project to a GitHub repository, then create a Cloudflare Pages project connected to that repository. Choose **React (Vite)** or set build command `npm run build` and output directory `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as production build variables, then deploy. Cloudflare Pages also produces a public `*.pages.dev` URL; add a custom domain in Pages if desired.
9. Run `npm run typecheck`, `npm test`, and `npm run build` before each release. Keep Supabase Security Advisor and project backups enabled for production.

## Running and using the app

With `.env.local` configured, run:

```sh
npm run dev
```

Open the Vite URL printed in the terminal (usually `http://localhost:5173`). Sign in with an invited institutional account. Students see assigned/upcoming exams, start or resume an attempt, navigate and autosave answers, and view results when released. Faculty create question banks, author rich-content questions, compose and schedule quizzes, review attempts, grade short answers and export results. Administrators invite or import accounts, change roles/access, manage courses/branches, and inspect the audit log.

Choose **Explore the demo** to enter the browser-only sample workspace as a student, faculty member, or administrator. The dashboard includes sample exams, results, account-management screens, academic setup, and reports. **Create a local student** adds a temporary demo profile in this browser. Demo data never signs in to Supabase or creates real accounts; use **Create an account** for an institutional student registration request.

The Pages URL is publicly reachable, but sign-in and active role/profile checks protect the portals. Public hosting does not mean open registration or anonymous exam access.

## Security and operational notes

- Browser fullscreen, visibility checks, blocked selection and clipboard events are deterrents, not a guarantee against cheating. The server deadline and recorded violations remain authoritative.
- Students receive answer keys and marks only through role-checked server responses governed by quiz result visibility. Faculty can view their authorized quiz results regardless of student release timing.
- Image references are stable UUIDs; question content does not contain Base64 file bodies. The 10 MiB type/size check is repeated on the server after upload.
- The migration and RLS regression suite run in PGlite with minimal Auth/Storage schema shims. This validates the SQL and policies, but is not a substitute for a deployment smoke test against a configured Supabase project. Edge Functions also require deployment-time environment variables before end-to-end use.
