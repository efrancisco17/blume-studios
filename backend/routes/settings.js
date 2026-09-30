const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll, getSetting, setSetting } = require('../database');

// GET all settings
router.get('/', async (req, res) => {
  try {
    const rows = await dbAll('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(row => { settings[row.key] = row.value; });
    delete settings.gmail_access_token;
    delete settings.gmail_refresh_token;
    delete settings.gmail_token_expiry;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update settings
router.patch('/', async (req, res) => {
  try {
    const allowed = [
      'business_name', 'owner_name', 'location', 'radius_miles', 'style',
      'package_6hr', 'package_8hr', 'mailing_address', 'voice_tone', 'sign_off',
      'scheduler_enabled', 'scheduler_time',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await setSetting(key, req.body[key]);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET action log
router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const logs = await dbAll('SELECT * FROM action_log ORDER BY created_at DESC LIMIT ?', [limit]);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET do-not-contact list
router.get('/do-not-contact', async (req, res) => {
  try {
    const list = await dbAll('SELECT * FROM do_not_contact ORDER BY added_at DESC');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add to DNC
router.post('/do-not-contact', async (req, res) => {
  try {
    const { email, name, reason } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    await dbRun('INSERT OR IGNORE INTO do_not_contact (email, name, reason) VALUES (?, ?, ?)', [email, name || '', reason || 'Manual entry']);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE from DNC
router.delete('/do-not-contact/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM do_not_contact WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET morning summaries
router.get('/morning-summaries', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM morning_summaries ORDER BY created_at DESC LIMIT 10');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
