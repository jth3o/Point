# Deploying Cript to Vercel

## Prerequisites

- Vercel account
- MongoDB Atlas cluster (connection string)
- Resend account (for magic-link email)
- OpenAI API key

## Environment variables

Set these in the Vercel project (Settings → Environment Variables). Use the same values for Production, Preview, and Development if you want auth and DB to work in all.

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/cript?retryWrites=true&w=majority` |
| `OPENAI_API_KEY` | OpenAI API key (server-side only) | `sk-...` |
| `AUTH_SECRET` | Random secret for signing cookies/tokens | Generate with `npx auth secret` |
| `AUTH_RESEND_KEY` | Resend API key for sending magic-link emails | `re_...` |
| `AUTH_FROM_EMAIL` | Sender email for sign-in emails (must be verified in Resend) | `noreply@yourdomain.com` |
| `AUTH_URL` | Public URL of the app (optional; Vercel sets `VERCEL_URL`) | `https://your-app.vercel.app` |

- **AUTH_SECRET** is required. Run `npx auth secret` and paste the value.
- **AUTH_FROM_EMAIL** must use a domain you’ve verified in the [Resend dashboard](https://resend.com/domains).
- Do not expose `OPENAI_API_KEY` or `AUTH_RESEND_KEY` to the client; they are only used in API routes and server code.

## Deploy steps

1. Push your repo to GitHub (or connect your Git provider in Vercel).
2. In [Vercel](https://vercel.com), create a new project and import the repo.
3. Add all environment variables above in Project Settings → Environment Variables.
4. Deploy (Vercel will run `next build`).
5. After the first deploy, open your app URL and sign in with your email to confirm auth and email work.

## Redeploying after env changes

- Changing env vars in the Vercel dashboard does **not** auto-redeploy.
- Trigger a new deployment: either push a commit or use **Deployments → … → Redeploy** for the latest deployment.

## Vercel CLI (optional)

```bash
npm i -g vercel
vercel
# Follow prompts, then add env vars in the dashboard or with:
vercel env add AUTH_SECRET
vercel env add MONGODB_URI
# etc.
```

## Notes

- MongoDB is used for app data and for Auth.js (sessions, users, verification tokens). Use the same `MONGODB_URI` for both.
- All OpenAI usage is server-side only (API routes). Never expose `OPENAI_API_KEY` to the browser.
