# Contributing to TUSVA

## Local quality checks

Use the Node version in `.nvmrc`, then run `npm ci`.

- `npm run test:unit`: pure functions and server-domain logic.
- `npm run test:component`: React components under jsdom.
- `npm run test:integration`: PGlite database/RLS tests and server integration tests.
- `npm test`: all three test suites.
- `npm run typecheck` and `npm run build`: TypeScript and production build.
- `npm run check`: full local gate.

Keep test data synthetic. Never commit credentials, real student details, exam answers, or storage URLs that grant access. Database changes need migration/RLS coverage; question and grading changes need domain tests; critical flows need component or integration coverage. Browser restrictions are deterrents and must not be tested or described as guarantees against cheating.

## Issues and fixes

Use the GitHub Bug report template for reproducible defects and Feature request template for desired behavior. Include steps, expected and actual results, affected role/environment, and safe evidence. Remove student names, emails, USNs, OTPs, credentials, and exam content. Do not report vulnerabilities in public issues; use the repository's private security reporting channel.

Link pull requests to issues with `Closes #123`. PRs must pass the CI checks and include a manual browser check for affected flows. Fixes should add a regression test where practical. Triage labels and acceptance criteria keep work trackable from report through resolution.

## CI and deployment

GitHub Actions runs unit, component, integration, typecheck, and build gates for pull requests and pushes to `main`. A successful push to `main` deploys `dist` to Cloudflare Pages. Configure repository secret `CLOUDFLARE_API_TOKEN` (Pages edit permission), `CLOUDFLARE_ACCOUNT_ID`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`; configure repository variable `CLOUDFLARE_PAGES_PROJECT`. The frontend key is the public anon/publishable key only; never place a service-role key in GitHub build variables or browser code.

Cloudflare Pages also needs the production domain/redirect URLs configured in Supabase Auth. Email signup OTP requires the Supabase Auth **Confirm signup** email template to include `{{ .Token }}`. Configure SMTP for reliable institutional delivery before opening registration.

## Release checklist

1. Review linked issues and PR checks; require review on `main`.
2. Verify Supabase migrations, RLS, Auth redirect URLs, email template, and SMTP in the intended environment.
3. Deploy from `main`, then smoke test sign in, signup OTP and automatic activation, quiz authoring, exam autosave/submission, results permissions, and storage access with synthetic accounts.
4. Watch the deployment and application logs for failures. Roll back by redeploying the prior successful Pages deployment and addressing the issue in a tracked PR.
