# treeDoc

A shared, editable tree editor for bridge bidding systems. Create a document,
build out a tree of bids (expand/collapse, add sibling/child bids), attach a
rich-text explanation to each node, export to PDF or JSON, and invite people
to view or edit as collaborators. Sign-in is via Google; each document has an
owner who controls who else can see or edit it.

Built with Next.js (App Router), Supabase (Postgres + Auth + Realtime), and
Tailwind CSS.

## Running your own deployment

This repo has no shared backend — every deployment is fully independent, with
its own Supabase project, its own Google sign-in, and its own Vercel site. If
you want to run this for your own bridge group, follow the steps below. All
the services used have a free tier that's more than enough for a small group.

### 1. Prerequisites

- A [GitHub](https://github.com) account — fork or clone this repo
- A [Supabase](https://supabase.com) account (free tier)
- A [Vercel](https://vercel.com) account (free tier)
- A [Google Cloud](https://console.cloud.google.com) account, for the OAuth
  sign-in client (free)
- Node.js 22 (see `.nvmrc`) and the [Supabase CLI](https://supabase.com/docs/guides/cli)
  if you want to run it locally before deploying

### 2. Create a Supabase project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
   Note the project's **Reference ID** (in its URL / Settings → General).
2. Settings → **Data API** (or **API**) → note the **Project URL**.
3. Settings → **API Keys** → copy the **`anon` `public`** key (not
   `service_role` — that one must never be exposed to the browser). Use the
   copy-icon button rather than selecting the text manually, so you don't
   accidentally include a stray newline or trailing whitespace — a broken key
   here causes sign-in to silently fail with an "Invalid value" fetch error
   that's painful to debug.

### 3. Create a Google OAuth client

1. [Google Cloud Console](https://console.cloud.google.com) → create a
   project (or reuse one — a single OAuth client works fine across unrelated
   apps).
2. **APIs & Services → OAuth consent screen**: External, add your own email
   (and any friends you want to test with before publishing) as test users.
3. **Credentials → Create Credentials → OAuth client ID**, type **Web
   application**.
4. Authorized redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. Save the **Client ID** and **Client Secret** — you'll need them in the next
   step.

### 4. Configure Google auth + push the schema to Supabase

```bash
npm install
supabase login                                   # opens a browser to authenticate
supabase link --project-ref <your-project-ref>
```

In the Supabase dashboard → **Authentication → Providers → Google**, enable
it and paste in the Client ID and Client Secret from step 3.

Then push the database schema (tables, Row Level Security policies, realtime
config) to your new project:

```bash
supabase db push
```

### 5. Deploy to Vercel

1. [vercel.com/new](https://vercel.com/new) → import your fork of this repo.
2. Add two environment variables (Project Settings → Environment Variables,
   scoped to **Production**):
   - `NEXT_PUBLIC_SUPABASE_URL` — the Project URL from step 2
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon public key from step 2

   Paste both using a clean, single-line paste (not copied out of a PDF, doc,
   or chat window where the text may have been wrapped) — the same
   invisible-newline trap mentioned in step 2 applies here too.
3. Deploy. Vercel will give you a stable production domain like
   `your-app.vercel.app`.
4. Back in Supabase → **Authentication → URL Configuration**, add your
   Vercel domain (both `https://your-app.vercel.app` and
   `https://your-app.vercel.app/**`) to **Redirect URLs**, and set it as the
   **Site URL**.
5. In Vercel → **Settings → Deployment Protection**, make sure it's off (or
   configured to allow the people you want to use the app) — otherwise
   visitors will be blocked by a Vercel login wall before ever reaching your
   sign-in screen.

Sign in once with your own Google account, and you'll automatically become
the owner of any documents you create. From there, use each document's Share
panel to invite other people by email as a `viewer` or `editor` — access
activates the first time they sign in with that email.

### 6. (Optional) Restore data from an export

If you have a `.json` export from another treeDoc deployment (via that app's
Export JSON), sign in and use **Import JSON…** on the home page to recreate
the document, its bidding tree, and its collaborator list on your new
instance.

## Local development

```bash
supabase start        # spins up local Postgres/Auth/Realtime in Docker
npm run dev
```

Local dev reads Supabase connection details from `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `supabase
start` prints these) and Google OAuth credentials from `supabase/.env`
(`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`,
`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, matching the `env(...)` references in
`supabase/config.toml`). Neither file is committed — copy the variable names
above into your own `.env.local` / `supabase/.env` and fill in your local
project's values. For local Google sign-in, add a second OAuth redirect URI
to your Google Cloud client: `http://127.0.0.1:54321/auth/v1/callback`.

Open [http://localhost:3000](http://localhost:3000).
