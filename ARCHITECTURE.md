# Architecture & Implementation Notes

## Database Schema

### Core Tables

**`leads`** — Wedding couples/clients
```sql
id, couple_name, partner1_name, partner2_name, email, phone, wedding_date, 
venue, source, status, contract_value, notes, inquiry_text, last_contact_date, created_at
```
- Statuses: New, Replied, Consult, Proposal, Booked, Lost
- Sources: Inquiry Form, Google, Instagram, Referral, The Knot, WeddingWire, Direct

**`prospects`** — Venues, planners, coordinators for outreach
```sql
id, name, type, website, email, phone, address, city, state, distance, style, 
specific_detail, fit_score, status, do_not_contact, last_contact_date, place_id, created_at
```
- Statuses: New, Contacted, Replied, Rejected
- `fit_score` (0-100): distance, rating, review count, style match

**`approval_queue`** — All drafts awaiting review
```sql
id, type, recipient_name, recipient_email, subject, body, context, 
lead_id, prospect_id, sequence_id, status, gmail_draft_id, created_at
```
- Types: inquiry_reply, follow_up, partnership_pitch, sequence_followup
- Statuses: pending, approved, rejected, never_contact

**`outreach_sequences`** — Tracking partnership pitch follow-ups
```sql
id, prospect_id, step, scheduled_date, sent_date, gmail_draft_id, status, created_at
```
- Step 1: initial pitch
- Step 2: ~7 days later
- Step 3: ~14 days later
- Compliance: stop after 3 no-replies, never email twice in 7 days

**`action_log`** — Audit trail
```sql
id, action, target_type, target_id, details, created_at
```
- Every significant action is logged (lead created, draft approved, email sent, etc.)

**`do_not_contact`** — Email addresses to never contact
```sql
id, email, name, reason, added_at
```

**`settings`** — Business configuration
```sql
key, value
```
- business_name, owner_name, location, mailing_address, radius_miles
- package_6hr, package_8hr
- voice_tone, sign_off
- google_oauth_configured, anthropic_configured
- scheduler_enabled, scheduler_time

**`morning_summaries`** — Daily routine results
```sql
id, summary, actions_taken, drafts_created, created_at
```

## API Endpoints

### Auth (`/api/auth`)
- `GET /connect` → OAuth URL
- `GET /callback?code=...` → Handles OAuth redirect
- `GET /status` → Config status check

### Leads (`/api/leads`)
- `GET /` → All leads
- `GET /:id` → Single lead
- `POST /` → Create lead
- `PATCH /:id` → Update lead
- `DELETE /:id` → Delete lead
- `POST /parse-inquiry` → Extract data from raw text
- `POST /:id/draft-reply` → Generate inquiry reply
- `POST /full-inquiry` → One-shot: parse → create lead → draft reply
- `GET /stale/list` → Leads with no contact 3+ days
- `POST /stale/draft-followups` → Batch generate follow-ups

### Prospects (`/api/prospects`)
- `GET /` → All prospects (filter by status, type)
- `GET /:id` → Single prospect
- `PATCH /:id` → Update prospect
- `DELETE /:id` → Delete prospect
- `POST /:id/do-not-contact` → Mark as DNC
- `POST /search` → Run prospecting agent (SSE stream)
- `POST /draft-pitches` → Batch generate partnership pitches

### Approval Queue (`/api/queue`)
- `GET /` → Items (filter by status)
- `GET /:id` → Single item
- `PATCH /:id` → Edit subject/body
- `POST /:id/approve` → Approve → create Gmail draft
- `POST /:id/reject` → Reject draft
- `POST /:id/never-contact` → Mark sender as DNC
- `GET /count/pending` → Count of pending items

### Settings (`/api/settings`)
- `GET /` → All settings (no tokens exposed)
- `PATCH /` → Update settings
- `GET /logs` → Action log
- `GET /do-not-contact` → DNC list
- `POST /do-not-contact` → Add to DNC
- `DELETE /do-not-contact/:id` → Remove from DNC
- `GET /morning-summaries` → Past summaries

### Reports (`/api/reports`)
- `GET /dashboard` → Stats, pipeline, recent activity
- `GET /roi` → Revenue by source, conversion rates, recommendations
- `GET /trend` → Bookings and revenue by month

### Content (`/api/content`)
- `POST /venue-page` → Generate venue landing page copy
- `POST /gbp-post` → Generate Google Business Profile post
- `GET /weddings` → List booked weddings
- `GET /venues` → List unique venues

### Scheduler (`/api/scheduler`)
- `POST /run-daily` → Manual trigger for daily routine
- `GET /status` → Scheduler status and last summary

## Claude Prompts (All Under 1024 Tokens)

Each prompt is designed to be:
- Specific (names, context, constraints)
- Actionable (clear next step requested)
- Bounded (length, tone, format requirements)
- Truthful (never invent facts)

### `parseInquiry(text)`
- Extracts: couple names, email, phone, date, venue, guest count
- Returns JSON; handles missing fields gracefully

### `draftInquiryReply(inquiry, lead, settings, calendarAvailable)`
- Personalized reply referencing venue/date/details
- Under 170 words, one clear next step
- Includes calendar availability note
- Signed with owner name and sign-off

### `draftLeadFollowUp(lead, settings, daysSinceContact)`
- Gentle check-in, helpful tip or useful question
- Under 150 words
- Never pushy or templated

### `draftPartnershipPitch(prospect, settings)`
- References something real and specific about the recipient
- Explains value of referral partnership
- Includes full compliance footer (name, address, STOP opt-out)
- Under 200 words

### `draftSequenceFollowUp(prospect, step, originalPitch, settings)`
- Step 2/3 of a sequence, very brief
- References original pitch
- Friendly, no pressure
- Includes STOP opt-out

### `draftVenueLandingPage(venueName, weddings, settings)`
- SEO-friendly page copy for venue
- Uses only real weddings shot there
- Never invents details
- Includes soft CTA

### `draftGBPPost(wedding, settings)`
- Celebratory post for Google Business Profile
- 200 words max
- Genuine, warm tone
- Soft CTA to book

### `draftMorningSummary(staleLeads, sequenceDue, newProspectsFound, settings)`
- Brief morning email to owner
- Actionable summary
- Under 100 words

## Gmail Integration

**OAuth Flow:**
1. User clicks "Connect Gmail" in Settings
2. Redirects to Google OAuth consent screen
3. User approves, redirected to `/api/auth/callback?code=...`
4. Backend exchanges code for tokens
5. Tokens stored in `settings` table (encrypted in production, plaintext here)
6. Auto-refresh on token expiry

**Draft Creation:**
1. User approves draft in Approval Queue
2. Backend constructs email (From, To, Subject, Body)
3. Encodes as RFC 5322, base64-encodes
4. Calls `gmail.users.drafts.create()`
5. Draft appears in Gmail (user can edit and send)

**Reply Detection:**
1. Scheduled job checks `outreach_sequences` with status='sent'
2. For each prospect email, queries Gmail for messages from that address
3. If found, marks sequence as 'replied', stops subsequent scheduled touches
4. Moves prospect to "Replied" status

## Calendar Integration

**Date Availability Check:**
1. Parses incoming inquiry date
2. Queries Google Calendar for events on that date with "wedding", "booked", "shoot", etc.
3. Returns: true (available), false (booked), null (unknown/error)
4. Note in reply: "Calendar shows this date is available" or similar

## Google Places Integration

**Prospect Search:**
1. User enters location and radius
2. For each type (venue, planner, coordinator):
   - Text search for "[type] near [location]"
   - Fetch up to 3 pages (60 results)
3. For each result, fetch detailed info (website, phone, editorial summary)
4. Extract "specific detail" from summary or top review (anonymized)
5. Calculate fit score: distance penalty, rating boost, review count bonus
6. Deduplicate by place_id, filter known prospects and DNC list
7. Insert into `prospects` table

**Fit Score (0-100):**
- Baseline: 50 points
- Distance: -1 point per % of radius (50 miles away = -50)
- Rating: 4.5+ = +25, 4.0+ = +15, 3.5+ = +5
- Reviews: 100+ = +15, 50+ = +10, 20+ = +5
- Clamped to [0, 100]

## Compliance & Security

**Hard Rule: No secrets in code**
- API keys only in `.env` (not committed)
- OAuth tokens stored in database (should be encrypted in production)
- Gmail drafts never auto-sent; manual review required

**7-Day Rule:**
- Query: `SELECT COUNT(*) FROM outreach_sequences WHERE prospect_id = ? AND step > 1 AND sent_date IS NOT NULL AND (datetime('now') - datetime(sent_date)) < 7`
- If > 0, delay scheduled follow-up by 1 day

**3-Touch Max:**
- Query: `SELECT COUNT(*) FROM outreach_sequences WHERE prospect_id = ? AND status IN ('sent', 'scheduled')`
- If >= 3, mark sequence status = 'stopped'

**Do-Not-Contact List:**
- Before creating any draft, check `do_not_contact`
- Before approving, verify email not in DNC

**Audit Trail:**
- Every action logged with timestamp, actor, target, details
- Reports available in Settings → Activity Log

## Frontend Architecture

**State Management:**
- React hooks (useState, useEffect) only
- No Redux, no context API
- Each page manages its own state

**Data Flow:**
- Components fetch from `/api/` routes on mount
- Auto-refresh on interval (5s for queue, etc.)
- Approval Queue polls every 5s for new items

**Mobile-First:**
- Sidebar collapses on mobile, accessible via hamburger
- All cards, tables, grids are responsive
- Tested at 375px (mobile) and 1920px (desktop)

**UI Components:**
- Layout: sidebar, main content, mobile nav
- Cards: white bg, border, rounded, hover state
- Badges: colored status indicators (New=blue, Booked=green, etc.)
- Forms: labeled inputs, validation on submit
- Tables: hover row, fixed header, responsive overflow

## Scheduler (node-cron)

**Daily Routine (if enabled):**
- Parse `scheduler_time` from settings (e.g., "08:00")
- Cron expression: `${minute} ${hour} * * *`
- Job runs on this schedule
- Calls `POST /api/scheduler/run-daily`

**What runs:**
1. Reply detection: check Gmail for replies to sent outreach
2. Sequence processing: draft due follow-ups (step 2 at 7 days, step 3 at 14 days)
3. Stale lead follow-ups: draft check-ins for leads with no contact 3+ days
4. Morning summary: generate and store summary text

**Refresh:**
- Every 5 minutes, check if `scheduler_enabled` or `scheduler_time` changed
- Restart cron job if settings changed

## Testing Strategy

**Phase 1: Inquiry + Follow-ups**
- Paste sample inquiry
- Verify extraction accuracy
- Approve draft
- Check Gmail
- Create stale lead, trigger follow-up draft

**Phase 2: Prospecting**
- Run search for your city/radius
- Verify prospects appear
- Select some, draft pitches
- Approve and check Gmail

**Phase 3: Queue**
- Edit a draft (change subject)
- Approve
- Check it appears in Gmail with edits

**Phase 4: Scheduler**
- Manually run daily routine
- Verify drafts created
- Check morning summary generated
- Look at ROI report

**Phase 5: Content**
- Create booked wedding with venue
- Generate venue page
- Generate GBP post
- Copy text

## Known Limitations

- **Database is local**. For production, migrate to PostgreSQL.
- **Tokens in plaintext**. For production, encrypt using a key management service.
- **No rate limiting**. For production, add rate limiting on API routes.
- **No request signing**. For production, add request authentication between frontend and backend.
- **Calendar checks are read-only**. Cannot create events or block time.
- **Places API subject to rate limits**. For high-volume prospecting, batch or use async job queue.
- **Claude API costs**. Every draft burns tokens. Monitor usage on Anthropic dashboard.

## Future Enhancements

- [ ] Export leads/prospects to CSV
- [ ] Import leads from CSV
- [ ] Zapier/Make integration for inquiry forms
- [ ] SMS notifications for pending approvals
- [ ] A/B testing for inquiry replies
- [ ] Bulk email sending (not recommended, but users ask)
- [ ] Calendar blocking (automatically add events after booking)
- [ ] Multi-user support (account roles, permissions)
- [ ] Dark mode (Tailwind supports it; just add toggle)
