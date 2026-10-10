# Testing, issue tracking, CI, and email verification

## Test process

Run `npm ci` with the Node version recorded in `.nvmrc`, then `npm run check` before opening a pull request. The pipeline separates test layers so failures point to the likely cause:

| Layer | Command | Current coverage |
|---|---|---|
| Unit/domain | `npm run test:unit` | Content normalization, CSV parsing, institutional email rules, exam validation/grading/deadlines/media signatures |
| Component | `npm run test:component` | Shared controls and signup OTP input behavior in jsdom |
| Database integration | `npm run test:integration` | PGlite applies the schema and exercises RLS, answer-key isolation, student boundaries, autosave persistence, and storage denial |
| Static/build | `npm run typecheck` and `npm run build` | TypeScript and production bundle |
| End-to-end smoke | Manual release checklist in `CONTRIBUTING.md` | Real Supabase/Storage/Pages flows; use synthetic accounts only |

GitHub Actions runs the automated layers on pull requests to `main` and on pushes to `main`. The Pages deployment runs only after the checks pass on `main`. Browser end-to-end flows are not automated yet; Supabase email delivery and Cloudflare deployment require external credentials, so the release smoke checklist is a human gate. Do not treat the local SQL simulation as a substitute for a production Supabase staging test.

## GitHub tracking and setup

The repository needs to be published to GitHub for issues and Actions to exist. After publishing, set the default branch to `main` or change `.github/workflows/ci-cd.yml` branch filters to the selected default branch. Configure these repository secrets:

- `CLOUDFLARE_API_TOKEN` with Pages deploy permission
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (publishable/anon key only)

Set repository variable `CLOUDFLARE_PAGES_PROJECT` to the existing Pages project name. The service-role key must never be included in frontend build variables. Enable branch protection so the workflow and a human review are required before merging. Use the Bug report/Feature request issue forms, link PRs using `Closes #<issue>`, and avoid all real student data in public issues.

## Enable six-digit signup codes in Supabase

The application now calls `verifyOtp({ email, token, type: 'signup' })` and supports resending a signup code. Supabase must send the token in the signup confirmation email:

1. In Supabase Dashboard, open **Authentication → Email Templates → Confirm signup**.
2. Edit the message to visibly include `{{ .Token }}`. For example: `<p>Your TUSVA verification code is <strong>{{ .Token }}</strong>.</p>`.
3. Save, then verify the configured Site URL and allowed redirect URLs include the deployed Pages domain and local development URL.
4. Configure a production SMTP provider before inviting the whole institution; default email delivery is not a production mail service.
5. Test signup, wrong code, resend, expired code, and successful verification using a synthetic `@jainuniversity.ac.in` account.

Supabase documents `{{ .Token }}` as its six-digit OTP template variable and `verifyOtp` as the verification call. [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates) · [verifyOtp reference](https://supabase.com/docs/reference/javascript/auth-verifyotp).

The signup trigger leaves the profile inactive before email confirmation. After OTP succeeds, the app calls the `complete-signup` Edge Function, which checks the authenticated user and confirmed email server-side before activating only that user's student profile. No administrator approval is required. An OTP proves access to the university mailbox; it does **not** independently validate the supplied name, USN, branch, or identity. Student signup is therefore self-service for any deliverable address at the allowed domain. The branch code is stored as a request and can be assigned later.

Cloudflare's Pages direct-upload workflow uses Wrangler to deploy the built `dist` directory; see [Cloudflare Pages CI deployment](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).
