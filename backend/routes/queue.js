const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll, log } = require('../database');
const gmailService = require('../services/gmail');

// GET all pending items
router.get('/', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const items = await dbAll(`
      SELECT q.*,
        l.couple_name as lead_couple_name, l.wedding_date as lead_wedding_date,
        p.name as prospect_name, p.type as prospect_type, p.fit_score
      FROM approval_queue q
      LEFT JOIN leads l ON q.lead_id = l.id
      LEFT JOIN prospects p ON q.prospect_id = p.id
      WHERE q.status = ?
      ORDER BY q.created_at DESC
    `, [status]);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single item
router.get('/:id', async (req, res) => {
  try {
    const item = await dbGet('SELECT * FROM approval_queue WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH edit body/subject
router.patch('/:id', async (req, res) => {
  try {
    const item = await dbGet('SELECT * FROM approval_queue WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Not found' });

    const { subject, body } = req.body;
    await dbRun('UPDATE approval_queue SET subject = COALESCE(?, subject), body = COALESCE(?, body) WHERE id = ?', [subject || null, body || null, req.params.id]);
    const updated = await dbGet('SELECT * FROM approval_queue WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST approve
router.post('/:id/approve', async (req, res) => {
  try {
    const item = await dbGet('SELECT * FROM approval_queue WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.status !== 'pending') return res.status(400).json({ error: 'Item is not pending' });

    if (!item.recipient_email) {
      return res.status(400).json({ error: 'No recipient email — please add one before approving.' });
    }

    let gmailDraftId = null;
    if (gmailService.isConfigured()) {
      const draft = await gmailService.createDraft(item.recipient_email, item.subject, item.body);
      gmailDraftId = draft.id;
    }

    await dbRun('UPDATE approval_queue SET status = ?, gmail_draft_id = ? WHERE id = ?', ['approved', gmailDraftId, req.params.id]);

    if (item.lead_id) {
      await dbRun("UPDATE leads SET last_contact_date = datetime('now') WHERE id = ?", [item.lead_id]);
    }

    if (item.prospect_id && (item.type === 'partnership_pitch' || item.type === 'sequence_followup')) {
      await dbRun("UPDATE prospects SET status = ?, last_contact_date = datetime('now') WHERE id = ?", ['Contacted', item.prospect_id]);

      if (item.type === 'partnership_pitch') {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 7);
        await dbRun(`
          INSERT INTO outreach_sequences (prospect_id, step, scheduled_date, status)
          VALUES (?, 2, ?, 'scheduled')
        `, [item.prospect_id, scheduledDate.toISOString().split('T')[0]]);
      }
    }

    log('queue_approved', 'approval_queue', item.id, { type: item.type, gmail_draft: !!gmailDraftId });
    res.json({ success: true, gmail_draft_id: gmailDraftId, gmail_configured: gmailService.isConfigured() });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST reject
router.post('/:id/reject', async (req, res) => {
  try {
    const item = await dbGet('SELECT * FROM approval_queue WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Not found' });

    await dbRun("UPDATE approval_queue SET status = 'rejected' WHERE id = ?", [req.params.id]);
    log('queue_rejected', 'approval_queue', item.id, { type: item.type });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST never contact
router.post('/:id/never-contact', async (req, res) => {
  try {
    const item = await dbGet('SELECT * FROM approval_queue WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Not found' });

    await dbRun("UPDATE approval_queue SET status = 'never_contact' WHERE id = ?", [req.params.id]);

    if (item.recipient_email) {
      await dbRun('INSERT OR IGNORE INTO do_not_contact (email, name, reason) VALUES (?, ?, ?)', [
        item.recipient_email, item.recipient_name || '', 'User marked Never Contact'
      ]);
    }
    if (item.prospect_id) {
      await dbRun("UPDATE prospects SET do_not_contact = 1, status = 'Rejected' WHERE id = ?", [item.prospect_id]);
    }

    log('do_not_contact_added', 'approval_queue', item.id, { email: item.recipient_email });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET count of pending items
router.get('/count/pending', async (req, res) => {
  try {
    const count = await dbGet("SELECT COUNT(*) as count FROM approval_queue WHERE status = 'pending'");
    res.json(count);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
