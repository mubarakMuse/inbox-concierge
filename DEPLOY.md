# Deploy Inbox Concierge to Railway + Netlify

Backend runs on **Railway**, frontend on **Netlify**. The frontend calls the Railway API URL; cookies work cross-origin (SameSite=None; Secure when FRONTEND_URL is set to your Netlify URL).

---

## Your deployment URLs

Use these exact values for env vars:

| Where | Variable | Value |
|-------|----------|--------|
| **Netlify** | `VITE_API_BASE` | `https://inbox-concierge-production.up.railway.app` |
| **Railway** | `FRONTEND_URL` | `https://inbox-concierge.netlify.app` |
| **Railway** | `OAUTH_REDIRECT_URI` | `https://inbox-concierge-production.up.railway.app/api/auth/callback` |

- **Frontend:** [https://inbox-concierge.netlify.app](https://inbox-concierge.netlify.app)
- **Backend:** [https://inbox-concierge-production.up.railway.app](https://inbox-concierge-production.up.railway.app)  
  Health check: [https://inbox-concierge-production.up.railway.app/api/health](https://inbox-concierge-production.up.railway.app/api/health)

Local dev uses port **5001** for the server (see `server/.env`); on Railway, `PORT` is set by Railway—you don’t need to set it unless you override.

---

## 1. Deploy backend (Railway)

1. **Create a Railway project** at [railway.app](https://railway.app). Connect your repo or push the code.

2. **Set root directory**  
   In the Railway service → **Settings** → **Root Directory**: set to `server` (so `package.json` and `index.js` are at the root of the build).

3. **Variables**  
   In the service → **Variables**, add:

   | Variable | Value |
   |----------|--------|
   | `NODE_ENV` | `production` |
   | `PORT` | (Railway sets this; optional override) |
   | `FRONTEND_URL` | Your Netlify URL, e.g. `https://your-app.netlify.app` (no trailing slash) |
   | `GOOGLE_CLIENT_ID` | From Google Cloud Console |
   | `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
   | `OAUTH_REDIRECT_URI` | `https://YOUR-RAILWAY-URL/api/auth/callback` (replace with your Railway app URL) |
   | `OPENAI_API_KEY` | Your OpenAI key |
   | `SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
   | `COOKIE_SECRET` | Strong random string (e.g. `openssl rand -hex 32`) |

4. **Google OAuth**  
   In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth 2.0 Client:
   - **Authorized redirect URIs:** add `https://YOUR-RAILWAY-URL/api/auth/callback`
   - **Authorized JavaScript origins:** add your Railway URL and your Netlify URL

5. **Deploy**  
   Railway will build and run `npm start` from the `server` folder. Note the public URL (e.g. `https://inbox-concierge-production.up.railway.app`).

---

## 2. Deploy frontend (Netlify)

1. **Create a Netlify site** at [netlify.com](https://netlify.com). Connect the same repo.

2. **Build settings** (Netlify reads `netlify.toml` in the repo):
   - **Base directory:** `client`
   - **Build command:** `npm run build`
   - **Publish directory:** `client/dist`  
   (If you don’t use the toml, set these in the Netlify UI.)

3. **Environment variable**  
   In Site → **Site configuration** → **Environment variables**:
   - **Key:** `VITE_API_BASE`  
   - **Value:** Your Railway API URL, e.g. `https://inbox-concierge-production.up.railway.app` (no trailing slash)

   This makes the frontend call the Railway backend in production.

4. **Deploy**  
   Trigger a deploy. Your app will be at `https://your-site.netlify.app`.

---

## 3. Checklist

- [ ] Railway: root directory = `server`, all env vars set, `OAUTH_REDIRECT_URI` uses Railway URL.
- [ ] Google OAuth: redirect URI and JS origins include Railway and Netlify URLs.
- [ ] Netlify: `VITE_API_BASE` = Railway URL (no trailing slash).
- [ ] Supabase: `server/db/schema.sql` has been run in the SQL Editor.
- [ ] Cookie works: after “Connect Gmail” you’re redirected to Netlify and the app shows you as connected (cross-origin cookie with SameSite=None; Secure).

---

## 4. Optional: custom domains

- **Railway:** Assign a custom domain in the service settings and set `OAUTH_REDIRECT_URI` and Google OAuth to that domain.
- **Netlify:** Assign a custom domain in Domain settings. Update `FRONTEND_URL` on Railway and “Authorized JavaScript origins” in Google to that domain.
