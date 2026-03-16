# Deploying Point to Vercel

## Prerequisites

- Vercel account
- MongoDB Atlas cluster (connection string)
- Google Cloud project with OAuth 2.0 credentials (for sign-in)
- OpenAI API key

## Environment variables

Set these in the Vercel project (Settings → Environment Variables). Use the same values for Production, Preview, and Development if you want auth and DB to work in all.

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `MONGODB_URI=mongodb+srv://<db_username>:<db_password>@<your-cluster-url>/<database>?retryWrites=true&w=majority` |
| `OPENAI_API_KEY` | OpenAI API key (server-side only) | `sk-...` |
| `AUTH_SECRET` | Random secret for signing cookies/tokens | Generate with `npx auth secret` |
| `AUTH_GOOGLE_ID` | Google OAuth 2.0 Client ID | From Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | Google OAuth 2.0 Client secret | From same OAuth 2.0 client |
| `AUTH_URL` | Public URL of the app (optional; Vercel sets `VERCEL_URL`) | `https://your-app.vercel.app` |

- **AUTH_SECRET** is required. Run `npx auth secret` and paste the value.
- **AUTH_GOOGLE_ID** and **AUTH_GOOGLE_SECRET**: Create an OAuth 2.0 Client ID (Web application) in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add your app URL to authorized redirect URIs (e.g. `https://your-app.vercel.app/api/auth/callback/google`).
- Do not expose `OPENAI_API_KEY` or `AUTH_GOOGLE_SECRET` to the client; they are only used in API routes and server code.

## Deploy steps

1. Push your repo to GitHub (or connect your Git provider in Vercel).
2. In [Vercel](https://vercel.com), create a new project and import the repo.
3. Add all environment variables above in Project Settings → Environment Variables.
4. Deploy (Vercel will run `next build`).
5. After the first deploy, open your app URL and sign in with Google to confirm auth works.

## Redeploying after env changes

- Changing env vars in the Vercel dashboard does **not** auto-redeploy.
- Trigger a new deployment: either push a commit or use **Deployments → … → Redeploy** for the latest deployment.

## Vercel CLI (optional)

```bash
npm i -g vercel
vercel
# Follow prompts, then add env vars in the dashboard or with:
vercel env add AUTH_SECRET
vercel env add AUTH_GOOGLE_ID
vercel env add AUTH_GOOGLE_SECRET
vercel env add MONGODB_URI
# etc.
```

## Notes

- MongoDB is used for app data and for Auth.js (sessions, users). Use the same `MONGODB_URI` for both.
- All OpenAI usage is server-side only (API routes). Never expose `OPENAI_API_KEY` to the browser.
- Each user's courses, lectures, cards, and review state are scoped by `userId`; only the signed-in user's data is visible.
