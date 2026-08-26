# Deploying TaskFlow Life — Step by Step

There are 3 pieces: a database, a backend API, and the app itself. Do them in this order.

---

## 1. Database — MongoDB Atlas (free tier)

1. Go to https://www.mongodb.com/cloud/atlas and create a free account.
2. Create a free **M0 cluster**.
3. Under **Database Access**, add a user with a password (save it).
4. Under **Network Access**, add `0.0.0.0/0` (allow from anywhere) — simplest for now, tighten later.
5. Click **Connect > Drivers**, copy the connection string. It looks like:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

Keep this — it's your `MONGO_URL`.

---

## 2. Backend — Render (free tier)

1. Push the `backend/` folder to a GitHub repo (or the whole project — Render can be pointed at a subfolder).
2. Go to https://render.com > **New > Web Service**, connect the repo.
3. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT` (already in `Procfile`, Render auto-detects it)
4. Add environment variables (Settings > Environment):
   - `MONGO_URL` = the connection string from step 1
   - `DB_NAME` = `taskflow_life`
   - `EMERGENT_PUSH_KEY` = leave blank for now (push notifications will just no-op)
5. Deploy. Once live, Render gives you a URL like `https://taskflow-life.onrender.com`.
6. Sanity check: open `https://taskflow-life.onrender.com/api/` in a browser — you should get a response, not an error page (add a root health route if there isn't one — see note below).

**Note:** free Render services spin down after ~15 min idle and take ~30s to wake back up on the next request. Fine for testing; for a "real" app later, a paid tier or Railway avoids the cold start.

---

## 3. Frontend — Expo

1. In `frontend/.env`, set:
   ```
   EXPO_PUBLIC_BACKEND_URL=https://taskflow-life.onrender.com
   ```
2. Install deps and run:
   ```
   cd frontend
   yarn install
   npx expo start
   ```
3. **Fastest way to test on your phone**: install the **Expo Go** app, scan the QR code from the terminal. Your phone must be able to reach the Render URL (it can — Render is public internet), so this works over Wi-Fi or mobile data.
4. **On your laptop / web**: press `w` in the Expo terminal, or `npx expo start --web`.
5. Log in with the same account on both — since data lives in MongoDB via the backend, tasks/habits/etc. created on one device show up on the other.

---

## Known risk: authentication

Login currently goes through **Emergent's own OAuth relay** (`auth.emergentagent.com` → `demobackend.emergentagent.com`), not a Google/Auth0 app you own. It's what makes login "just work" right now with zero setup — but it's an external service outside your control, originally meant for apps built and run inside Emergent's platform. It may keep working fine for you, or Emergent could restrict it later. If you want auth you fully own, the next step would be swapping in your own Google OAuth client (or a simple email/password flow) — that's a separate, self-contained piece of work whenever you want it.

---

## What I couldn't verify from here

I don't have live internet access in this sandbox, so I trimmed `requirements.txt` down to only the packages `server.py` and the tests actually import (it had ~120 leftover packages from Emergent's base image — `stripe`, `boto3`, `google-genai`, a private `litellm` wheel, etc. — none of which the app uses), and added a `Procfile`, but **I couldn't actually run `pip install` or hit a real MongoDB/Render instance to confirm it deploys clean end-to-end.** Please run the steps above and paste me any error you hit — that's the fastest way for me to fix it for your exact environment.
