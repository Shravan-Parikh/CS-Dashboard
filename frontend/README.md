# CS Dashboard — Web

Next.js (App Router) + TypeScript + Tailwind frontend for
[CS Dashboard](https://github.com/Shravan-Parikh/cs-dashboard-backend-app), a
workspace for Company Secretaries in India.

Modules: **Latest Filings** (market-wide CS-relevant BSE feed) · **Announcements**
(company/index search with Excel/CSV/ZIP export) · **Compliance Calendar**
(statutory due dates) · **Company 360** (a company's full filing timeline).

## Run locally

The API must be running first (see the backend repo).

```bash
cp .env.local.example .env.local
npm install
npm run dev             # http://localhost:3000
```

## Environment

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_BASE` | Base URL of the API, **including `/api`**. Local: `http://localhost:4000/api`. Production: `https://<cloud-run-url>/api`. |
| `NEXT_PUBLIC_ALLOW_SIGNUP` | `false` during the pilot — hides self-service sign-up, since accounts are provisioned by an admin. |

## Deploy to Vercel

1. Import this repo in Vercel. Framework preset **Next.js**; defaults are fine.
2. Add the two environment variables above (set them for Production *and*
   Preview so preview builds talk to the API too).
3. Deploy.

Then make sure the API's `CORS_ORIGIN` includes this deployment's origin —
`https://*.vercel.app` covers preview URLs, plus any custom domain.

## Auth

Sign-in goes through the API, which uses Firebase Auth. The browser holds a
Firebase ID token plus a refresh token in `localStorage`. ID tokens expire after
an hour, so `lib/api.ts` transparently refreshes on a `401` and replays the
request — concurrent requests share a single refresh.

Accounts are created by an admin (see the backend repo); there is no public
sign-up during the pilot.
