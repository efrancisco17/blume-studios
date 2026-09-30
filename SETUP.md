# Setup Guide: Blume Studios Wedding Booking Agent

This guide walks you through getting the app running locally with all APIs configured.

## Prerequisites

- Node.js 18+ installed
- A Gmail account
- Google Cloud account (free tier works)
- Anthropic API key (Claude)

**Estimated time:** 15 minutes

## Step 1: Google Cloud Setup (5 min)

### 1.1 Create a new project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click project dropdown → **New Project**
3. Name: `Blume Studios`
4. Click **Create**
5. Wait for project to activate

### 1.2 Enable APIs

1. Go to **APIs & Services** → **Library**
2. Search and enable each:
   - **Gmail API** → Click → **ENABLE**
   - **Google Calendar API** → Click → **ENABLE**
   - **Places API** → Click → **ENABLE**

### 1.3 Create OAuth 2.0 credentials

1. Go to **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth 2.0 Client ID**
3. You'll see "You need to create an OAuth consent screen first" → Click **CONFIGURE CONSENT SCREEN**
4. Choose **External** (for personal use), click **Create**
5. Fill in:
   - App name: `Blume Studios`
   - User support email: your Gmail
   - Developer contact: your Gmail
   - Click **SAVE AND CONTINUE** (skip optional fields)
6. Go back to **Credentials** → **+ CREATE CREDENTIALS** → **OAuth 2.0 Client ID**
7. Application type: **Web application**
8. Under "Authorized redirect URIs," click **+ ADD URI**
9. Enter: `http://localhost:3001/api/auth/callback`
10. Click **CREATE**
11. Copy and save **Client ID** and **Client Secret** (you'll need these)

### 1.4 Get API keys

**For Places API:**
1. Go to **Credentials**
2. Click **+ CREATE CREDENTIALS** → **API Key**
3. Copy the key and save it

**For the app, you now have:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_PLACES_API_KEY`

## Step 2: Anthropic Setup (2 min)

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Click **API Keys** on the left
3. Click **Create Key**
4. Copy your API key and save it as `ANTHROPIC_API_KEY`

## Step 3: Clone & Setup App (5 min)

### 3.1 Install dependencies

```bash
cd backend
npm install
cd ../frontend
npm install
cd ..
```

### 3.2 Create .env file

Copy the template:
```bash
cp .env.example .env
```

Edit `.env` and fill in (use a text editor):

```env
ANTHROPIC_API_KEY=sk-ant-...              # From step 2
GMAIL_ADDRESS=your-gmail@gmail.com        # Your Gmail address

GOOGLE_CLIENT_ID=...                      # From step 1.3
GOOGLE_CLIENT_SECRET=...                  # From step 1.3
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/callback

GOOGLE_PLACES_API_KEY=...                 # From step 1.4

PORT=3001
NODE_ENV=development
```

## Step 4: Run the App (1 min)

**Terminal 1 — Backend:**
```bash
cd backend
npm start
```

You should see:
```
🌸 Blume Studios backend running on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

The app will open at http://localhost:5173

## Step 5: Connect Gmail (1 min)

1. Go to **Settings** → **Integrations**
2. Click **Connect Gmail**
3. A browser window opens → **Sign in with your Gmail**
4. Click **Allow** to grant permissions
5. You're redirected back. The connection is now active.

## Step 6: Test Each Phase

### Quick Test: Inquiry Responder

1. Go to **Inquiry** tab
2. Paste:
```
Hi! I'm Alex, getting married June 14, 2026 at The Estate at Florentine Gardens. Found you on Instagram. We want 8 hours of coverage. Available? Price?
```
3. Click **Process Inquiry →**
4. See extracted data and draft reply
5. Go to **Queue**, expand the draft, click **✓ Approve**
6. Check your Gmail — a draft was created
7. Send it from Gmail (or just verify it's there)

### Test: Prospecting

1. Go to **Prospecting** tab
2. Click **🔍 Start Research**
3. Watch progress, then see a list of venues
4. Select 3-5 prospects
5. Click **Draft Pitches for Selected**
6. Go to **Queue**, review and approve one
7. Gmail draft is created

### Test: Dashboard

1. Go to **Dashboard**
2. Click **▶ Run Daily Routine**
3. See stale leads drafted, sequences processed
4. Go to **Queue** to review new drafts

## Troubleshooting

### "ANTHROPIC_API_KEY not set"
- Make sure `.env` file exists and has the key
- Restart backend after adding it
- Check for typos

### "Google OAuth credentials not configured"
- Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`
- Restart backend

### Gmail drafts not creating
- Go to Settings → Integrations → "Connect Gmail"
- Follow the OAuth flow
- Make sure `GMAIL_ADDRESS` is set in `.env`

### "Cannot read property 'length' of undefined"
- Database is initializing. Restart backend.
- Check that `blume_studios.db` exists in the root folder

### Prospecting search fails
- Make sure `GOOGLE_PLACES_API_KEY` is in `.env`
- Verify Places API is enabled in Google Cloud Console
- Try a different location

## What to Do Next

1. **Customize Settings**: Go to Settings and update your business profile, packages, and voice
2. **Set up scheduler**: Enable daily runs at a specific time (e.g., 8 AM)
3. **Add leads**: Either paste inquiries in the Inquiry tab or add leads manually
4. **Start prospecting**: Research venues in your area
5. **Monitor ROI**: Check Reports to see which sources convert best

## Files & Folders

- **`.env`** — Your secrets (never commit this)
- **`blume_studios.db`** — SQLite database (created on first run)
- **`backend/`** — Node.js API
- **`frontend/`** — React app
- **`README.md`** — Full feature documentation

## Support

If something breaks:

1. Check that all `.env` keys are set
2. Restart backend: `npm start`
3. Restart frontend: `npm run dev`
4. Clear browser cache and reload http://localhost:5173

Good luck! 🌸
