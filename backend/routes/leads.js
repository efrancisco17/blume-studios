const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll, log } = require('../database');
const { parseInquiry, draftInquiryReply, draftLeadFollowUp } = require('../services/claude');
const { checkDateAvailability } = require('../services/calendar');

// GET all leads
router.get('/', async (req, res) => {
  try {
    const leads = await dbAll(`
      SELECT * FROM leads ORDER BY
      CASE status
        WHEN 'New' THEN 1 WHEN 'Replied' THEN 2 WHEN 'Consult' THEN 3
        WHEN 'Proposal' THEN 4 WHEN 'Booked' THEN 5 WHEN 'Lost' THEN 6
        ELSE 7 END,
      created_at DESC
    `);
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single lead
router.get('/:id', async (req, res) => {
  try {
    const lead = await dbGet('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create lead
router.post('/', async (req, res) => {
  try {
    const { couple_name, partner1_name, partner2_name, email, phone, wedding_date, venue, source, status, contract_value, notes, inquiry_text } = req.body;
    if (!couple_name) return res.status(400).json({ error: 'couple_name is required' });

    const result = await dbRun(`
      INSERT INTO leads (couple_name, partner1_name, partner2_name, email, phone, wedding_date, venue, source, status, contract_value, notes, inquiry_text, last_contact_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [couple_name, partner1_name || null, partner2_name || null, email || null, phone || null, wedding_date || null, venue || null, source || 'Direct', status || 'New', contract_value || null, notes || null, inquiry_text || null]);

    const lead = await dbGet('SELECT * FROM leads WHERE id = ?', [result.lastID]);
    log('lead_created', 'lead', lead.id, { couple_name, source });
    res.status(201).json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update lead
router.patch('/:id', async (req, res) => {
  try {
    const lead = await dbGet('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const fields = ['couple_name', 'partner1_name', 'partner2_name', 'email', 'phone', 'wedding_date', 'venue', 'source', 'status', 'contract_value', 'notes'];
    const updates = [];
    const values = [];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }

    if (req.body.status && req.body.status !== lead.status) {
      updates.push('last_contact_date = datetime(\'now\')');
    }

    if (updates.length === 0) return res.json(lead);

    values.push(req.params.id);
    await dbRun(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`, values);

    const updated = await dbGet('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    log('lead_updated', 'lead', lead.id, { changes: Object.keys(req.body) });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE lead
router.delete('/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM leads WHERE id = ?', [req.params.id]);
    log('lead_deleted', 'lead', parseInt(req.params.id), null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST parse inquiry + draft reply
router.post('/parse-inquiry', async (req, res) => {
  try {
    const { inquiry_text } = req.body;
    if (!inquiry_text) return res.status(400).json({ error: 'inquiry_text is required' });

    const extracted = await parseInquiry(inquiry_text);
    res.json({ extracted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST draft reply for a lead
router.post('/:id/draft-reply', async (req, res) => {
  try {
    const lead = await dbGet('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const settingsRows = await dbAll('SELECT key, value FROM settings');
    const settings = {};
    settingsRows.forEach(row => { settings[row.key] = row.value; });

    let calendarAvailable = null;
    if (lead.wedding_date) {
      calendarAvailable = await checkDateAvailability(lead.wedding_date).catch(() => null);
    }

    const draft = await draftInquiryReply({ inquiry: lead.inquiry_text || `Inquiry from ${lead.couple_name}`, lead, settings, calendarAvailable });
    const subject = `Re: Wedding Photography Inquiry – ${lead.couple_name}`;

    const queueItem = await dbRun(`
      INSERT INTO approval_queue (type, recipient_name, recipient_email, subject, body, context, lead_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `, ['inquiry_reply', lead.couple_name, lead.email || '', subject, draft, JSON.stringify({ lead_id: lead.id, calendar_available: calendarAvailable }), lead.id]);

    log('draft_created', 'lead', lead.id, { type: 'inquiry_reply' });
    res.json({ queue_id: queueItem.lastID, draft, calendar_available: calendarAvailable });
  } catch (err) {
    console.error('Draft reply error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST full inquiry workflow
router.post('/full-inquiry', async (req, res) => {
  try {
    const { inquiry_text } = req.body;
    if (!inquiry_text) return res.status(400).json({ error: 'inquiry_text is required' });

    const settingsRows = await dbAll('SELECT key, value FROM settings');
    const settings = {};
    settingsRows.forEach(row => { settings[row.key] = row.value; });

    const extracted = await parseInquiry(inquiry_text);
    const couple_name = extracted.couple_name || 'Unknown Couple';

    const leadResult = await dbRun(`
      INSERT INTO leads (couple_name, partner1_name, partner2_name, email, phone, wedding_date, venue, source, status, inquiry_text, last_contact_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Inquiry Form', 'New', ?, datetime('now'))
    `, [couple_name, extracted.partner1_name || null, extracted.partner2_name || null, extracted.email || null, extracted.phone || null, extracted.wedding_date || null, extracted.venue || null, inquiry_text]);

    const lead = await dbGet('SELECT * FROM leads WHERE id = ?', [leadResult.lastID]);

    let calendarAvailable = null;
    if (lead.wedding_date) {
      calendarAvailable = await checkDateAvailability(lead.wedding_date).catch(() => null);
    }

    const draft = await draftInquiryReply({ inquiry: inquiry_text, lead, settings, calendarAvailable });
    const subject = `Re: Wedding Photography Inquiry`;

    const queueResult = await dbRun(`
      INSERT INTO approval_queue (type, recipient_name, recipient_email, subject, body, context, lead_id, status)
      VALUES ('inquiry_reply', ?, ?, ?, ?, ?, ?, 'pending')
    `, [lead.couple_name, lead.email || '', subject, draft, JSON.stringify({ calendar_available: calendarAvailable }), lead.id]);

    log('full_inquiry_processed', 'lead', lead.id, { couple_name });
    res.status(201).json({ lead, queue_id: queueResult.lastID, draft, calendar_available: calendarAvailable });
  } catch (err) {
    console.error('Full inquiry error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET stale leads
router.get('/stale/list', async (req, res) => {
  try {
    const stale = await dbAll(`
      SELECT * FROM leads
      WHERE status NOT IN ('Booked', 'Lost')
      AND (last_contact_date IS NULL OR julianday('now') - julianday(last_contact_date) >= 3)
      ORDER BY last_contact_date ASC
    `);
    res.json(stale);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST draft follow-ups for stale leads
router.post('/stale/draft-followups', async (req, res) => {
  try {
    const settingsRows = await dbAll('SELECT key, value FROM settings');
    const settings = {};
    settingsRows.forEach(row => { settings[row.key] = row.value; });

    const stale = await dbAll(`
      SELECT * FROM leads
      WHERE status NOT IN ('Booked', 'Lost')
      AND (last_contact_date IS NULL OR julianday('now') - julianday(last_contact_date) >= 3)
      ORDER BY last_contact_date ASC
      LIMIT 10
    `);

    const results = [];
    for (const lead of stale) {
      try {
        const daysSince = lead.last_contact_date
          ? Math.floor((Date.now() - new Date(lead.last_contact_date).getTime()) / 86400000)
          : 999;

        const draft = await draftLeadFollowUp({ lead, settings, daysSinceContact: daysSince });
        const subject = `Following up – ${lead.couple_name}`;

        const qItem = await dbRun(`
          INSERT INTO approval_queue (type, recipient_name, recipient_email, subject, body, context, lead_id, status)
          VALUES ('follow_up', ?, ?, ?, ?, ?, ?, 'pending')
        `, [lead.couple_name, lead.email || '', subject, draft, JSON.stringify({ days_since_contact: daysSince }), lead.id]);

        results.push({ lead_id: lead.id, couple_name: lead.couple_name, queue_id: qItem.lastID });
        log('followup_drafted', 'lead', lead.id, { days_since: daysSince });
      } catch (err) {
        results.push({ lead_id: lead.id, couple_name: lead.couple_name, error: err.message });
      }
    }

    res.json({ drafted: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
