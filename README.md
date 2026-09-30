# Blume Studios: Wedding Booking Agent

A full-stack app for wedding photographers to automate inquiry responses, prospect outreach, approval workflows, and ROI tracking.

**Features:**
- ✉ **Inquiry Responder**: Parse raw inquiries, check calendar, draft personalized replies (Phase 1)
- 🤝 **Prospecting Agent**: Find venues/planners nearby via Google Places, score for fit, draft pitches (Phase 2)
- ⏳ **Approval Queue**: Review all drafts before sending. Nothing goes out without approval (Phase 3)
- 📅 **Scheduled Routine**: Daily run checks for stale leads, processes sequences, detects replies (Phase 4)
- 📊 **ROI Reports**: Track revenue and conversion by source (Phase 4)
- ✍ **Content Tools**: Generate venue landing pages and GBP posts from real weddings (Phase 5)

## Tech Stack

- **Frontend**: React + Tailwind + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite (local, zero setup)
- **APIs**: Anthropic (Claude), Google (Gmail/Calendar/Places)
- **Scheduler**: node-cron (runs on computer when backend is on)

## Quick Start

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and add:
- `ANTHROPIC_API_KEY` — get at https://console.anthropic.com
- `GMAIL_ADDRESS` — your Gmail
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — create at Google Cloud Console
- `GOOGLE_PLACES_API_KEY` — same console

**Don't have these yet?** See the Setup Guide below.

### 3. Create database

The backend creates `blume_studios.db` on first run. No setup needed.

### 4. Start backend

```bash
cd backend && npm start
```

Server runs at http://localhost:3001

### 5. Start frontend (new terminal)

```bash
cd frontend && npm run dev
```

App opens at http://localhost:5173

## How Each Phase Works

### Phase 1: Inquiry Responder + Follow-ups

1. Paste a raw inquiry (email, form submission, DM)
2. Claude extracts: couple names, email, phone, wedding date, venue
3. Checks Google Calendar for availability
4. Drafts a personalized reply under 170 words with one clear next step
5. Reply saved to Approval Queue (must be approved before sending)
6. Lead is saved to pipeline

**Stale leads** (no contact in 3+ days) are flagged. Click "Draft Follow-ups" to auto-generate gentle check-ins.

### Phase 2: Prospecting Agent

1. Go to Prospecting → "Research new prospects"
2. Enter location and radius, select types (venues, planners, coordinators)
3. Agent searches Google Places, scrapes basic info, scores for fit
4. You see progress live ("Researching venue 7 of 25…")
5. Select top prospects → "Draft Pitches for Selected"
6. Partnership pitches generated and queued for approval

Only references public information; never cold-contacts couples.

### Phase 3: Approval Queue

Every draft (replies, follow-ups, pitches) goes here first.

**Workflow:**
1. Expand a draft
2. Edit if needed (email, subject, body)
3. Click Approve → creates Gmail draft
4. Go to Gmail and send manually OR
5. If not configured, email is queued for manual sending

**Actions:**
- ✓ Approve → creates Gmail draft
- ✗ Reject → discards draft
- 🚫 Never Contact → adds to do-not-contact list

### Phase 4: Scheduler & ROI

**Scheduled daily run** (if enabled in Settings):
- Checks for replies from prospects
- Processes due sequence follow-ups (7 days apart, max 3 touches)
- Drafts follow-ups for stale leads
- Generates morning summary

**Reports** show:
- Revenue and conversion rate by source (Google, referrals, etc.)
- Cost per booking
- Booking trend by month
- Recommendation: which sources to keep/cut

### Phase 5: Content Tools

Create SEO and social content from real weddings.

**Venue landing pages:**
- Select a venue
- Agent writes page copy using only real weddings shot there
- Copy to your website

**Google Business Profile posts:**
- Select a booked wedding
- Agent writes celebratory post
- Copy to your GBP

## Setup Guide: Google Cloud & APIs

### Get Google Credentials

1. Go to https://console.cloud.google.com/
2. Create a new project (name it "Blume Studios")
3. Enable these APIs:
   - Gmail API
   - Google Calendar API
   - Places API

### Create OAuth 2.0 Credentials

1. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Authorized redirect URIs: `http://localhost:3001/api/auth/callback`
4. Copy **Client ID** and **Client Secret** into `.env`

### Get Places API Key

1. Go to **Credentials** → **Create Credentials** → **API Key**
2. Copy into `.env` as `GOOGLE_PLACES_API_KEY`

### Get Anthropic API Key

1. Go to https://console.anthropic.com/
2. Create API key
3. Copy into `.env` as `ANTHROPIC_API_KEY`

## Testing Each Phase

### Phase 1: Inquiry Responder

1. Go to **Inquiry** tab
2. Paste this sample:

```
Hi! I'm Alex and my fiancé is Jordan. We're getting married on June 14, 2026 at The Estate at Florentine Gardens in Philadelphia. We found your work on Instagram and love your style! We want about 8 hours of coverage. What's your availability and pricing? Thanks!
```

3. Click **Process Inquiry →**
4. See extracted details and draft reply
5. Draft is queued in Approval Queue

### Phase 2: Prospecting Agent

1. Go to **Prospecting** tab
2. Keep defaults (Philadelphia, 50 miles, venues/planners/coordinators)
3. Click **🔍 Start Research**
4. Watch progress ("Researching venue 7 of 25…")
5. Select top 5 prospects
6. Click **Draft Pitches for Selected**
7. Go to **Queue** to review and approve

### Phase 3: Approval Queue

1. Go to **Queue** tab
2. Expand a pending draft
3. Read the subject and body
4. Optional: edit if needed
5. Click **✓ Approve** → creates Gmail draft
6. Approved item moves to "Approved" tab
7. Go to your Gmail and send

### Phase 4: Scheduler & Dashboard

1. Go to **Settings** → **Scheduler**
2. Enable "Enable Daily Routine" and set a time (e.g., 08:00)
3. On **Dashboard**, click **▶ Run Daily Routine** to test manually
4. See stale leads drafted, sequences processed, replies detected
5. Go to **Reports** to see ROI by source

### Phase 5: Content Tools

1. Create a lead and mark it "Booked" with a venue
2. Go to **Content** → **Google Business Posts**
3. Select the wedding
4. Click **✍ Generate Post**
5. Copy the post to your Google Business Profile

## Hard Rules

**Nothing ever sends without approval.** Every email is a Gmail draft only. You review and send from Gmail.

**No scraping.** Only public websites, Google Places/Maps, official APIs, search results.

**Only contact businesses.** Venues, planners, coordinators. Never cold-contact couples.

**Compliance built in:**
- Do-Not-Contact list (never email twice in 7 days, stop after 3 no-replies)
- Real name, business name, mailing address in every outreach
- Plain opt-out line: "Reply STOP to be removed from our list"
- Action log tracks every email draft

**Never invent facts.** No made-up prices, awards, weddings, or details.

## Troubleshooting

### "No recipient email — please add one"
The system couldn't extract an email address. Go to the source record (lead or prospect) and add it.

### Gmail drafts not being created
- Check **Settings** → **Integrations** for connection status
- Click "Connect Gmail" if not connected
- Make sure `.env` has `GMAIL_ADDRESS` set

### Prospecting search fails
- Check API key in Settings → Integrations
- Make sure Google Places API is enabled in Cloud Console
- Try a different location

### Calendar checks show "unknown"
- Go to Settings and connect Gmail
- Grant calendar permission when prompted

### Changes to .env not taking effect
- Restart backend: `npm start` in `backend/` folder
- The app reloads environment on startup

## Project Structure

```
.
├── backend/
│   ├── server.js              (Express entry point)
│   ├── database.js            (SQLite schema + helpers)
│   ├── services/
│   │   ├── claude.js          (Anthropic prompts)
│   │   ├── gmail.js           (Gmail + OAuth)
│   │   ├── calendar.js        (Google Calendar)
│   │   └── places.js          (Google Places search)
│   └── routes/
│       ├── auth.js            (OAuth flow)
│       ├── leads.js           (CRUD + inquiry parsing)
│       ├── prospects.js       (Prospecting agent)
│       ├── queue.js           (Approval workflow)
│       ├── settings.js        (Config + DNC list)
│       ├── reports.js         (ROI + analytics)
│       ├── content.js         (Venue pages, GBP posts)
│       └── scheduler.js       (Daily routine)
│
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   └── Layout.jsx
│   │   └── pages/
│   │       ├── Dashboard.jsx
│   │       ├── LeadBoard.jsx
│   │       ├── InquiryResponder.jsx
│   │       ├── ApprovalQueue.jsx
│   │       ├── Prospecting.jsx
│   │       ├── Reports.jsx
│   │       ├── ContentTools.jsx
│   │       └── Settings.jsx
│   └── package.json, tailwind.config.js, vite.config.js
│
├── blume_studios.db          (Created on first run)
├── .env                       (Your secrets — never commit)
├── .env.example              (Template)
└── README.md (this file)
```

## License

Private use by Blume Studios LLC. Do not distribute.
