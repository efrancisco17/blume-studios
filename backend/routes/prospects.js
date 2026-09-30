const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll, log, getSetting } = require('../database');
const { searchWeddingPros, getPlaceDetails, scoreFit } = require('../services/places');
const { draftPartnershipPitch } = require('../services/claude');

// GET all prospects
router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;
    let query = 'SELECT * FROM prospects WHERE 1=1';
    const params = [];
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (type) { query += ' AND type = ?'; params.push(type); }
    query += ' ORDER BY fit_score DESC, created_at DESC';
    const prospects = await dbAll(query, params);
    res.json(prospects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET run prospecting agent (with SSE)
router.get('/search', async (req, res) => {
  const { location, radius_miles, types } = req.query;
  const typeArray = types ? types.split(',') : undefined;

  const searchLocation = location || await getSetting('location') || 'Philadelphia, PA';
  const radius = radius_miles ? parseInt(radius_miles) : parseInt((await getSetting('radius_miles')) || '50');
  const searchTypes = typeArray || ['venue', 'planner', 'coordinator'];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    send({ type: 'status', message: `Starting search near ${searchLocation}...` });

    const allPlaces = [];
    for (const type of searchTypes) {
      send({ type: 'status', message: `Searching for ${type}s...` });
      try {
        const places = await searchWeddingPros(searchLocation, radius, type);
        allPlaces.push(...places.map(p => ({ ...p, prospect_type: type })));
        send({ type: 'status', message: `Found ${places.length} ${type}s` });
      } catch (err) {
        send({ type: 'warning', message: `${type} search failed: ${err.message}` });
      }
    }

    const seen = new Set();
    const unique = allPlaces.filter(p => {
      if (seen.has(p.place_id)) return false;
      seen.add(p.place_id);
      return true;
    });

    send({ type: 'status', message: `Processing ${unique.length} unique places...` });

    const existingPlaceIds = new Set(
      (await dbAll('SELECT place_id FROM prospects WHERE place_id IS NOT NULL')).map(r => r.place_id)
    );
    const dncEmails = new Set((await dbAll('SELECT email FROM do_not_contact')).map(r => r.email));

    const newPlaces = unique.filter(p => !existingPlaceIds.has(p.place_id));
    send({ type: 'status', message: `${newPlaces.length} new prospects to research...` });

    const saved = [];
    for (let i = 0; i < newPlaces.length; i++) {
      const place = newPlaces[i];
      send({ type: 'progress', current: i + 1, total: newPlaces.length, name: place.name });

      try {
        const details = await getPlaceDetails(place.place_id);
        if (!details) continue;

        if (details.email && dncEmails.has(details.email)) continue;

        const fitScore = scoreFit({
          distance: place.distance || 10,
          rating: place.rating || 3.5,
          reviewCount: place.user_ratings_total || 0,
          radiusMiles: radius,
        });

        const result = await dbRun(`
          INSERT INTO prospects (name, type, website, email, phone, address, city, state, distance, style, specific_detail, fit_score, status, place_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?)
        `, [
          details.name, place.prospect_type, details.website || null, null,
          details.phone || null, details.address || null,
          (details.address || '').split(',')[1]?.trim() || null,
          (details.address || '').split(',')[2]?.trim() || null,
          null, null, details.specific_detail || null, fitScore, details.place_id
        ]);

        saved.push({ id: result.lastID, name: details.name, fit_score: fitScore });
        log('prospect_found', 'prospect', result.lastID, { name: details.name, type: place.prospect_type });
      } catch (err) {
        send({ type: 'warning', message: `Skipped ${place.name}: ${err.message}` });
      }
    }

    send({ type: 'complete', saved: saved.length, prospects: saved });
    res.end();
  } catch (err) {
    send({ type: 'error', message: err.message });
    res.end();
  }
});

// GET single prospect
router.get('/:id', async (req, res) => {
  try {
    const p = await dbGet('SELECT * FROM prospects WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Prospect not found' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update prospect
router.patch('/:id', async (req, res) => {
  try {
    const p = await dbGet('SELECT * FROM prospects WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Not found' });

    const fields = ['name', 'type', 'website', 'email', 'phone', 'address', 'city', 'state', 'style', 'specific_detail', 'status', 'do_not_contact', 'fit_score'];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
    }
    if (!updates.length) return res.json(p);
    values.push(req.params.id);
    await dbRun(`UPDATE prospects SET ${updates.join(', ')} WHERE id = ?`, values);
    const updated = await dbGet('SELECT * FROM prospects WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE prospect
router.delete('/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM prospects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add to do-not-contact
router.post('/:id/do-not-contact', async (req, res) => {
  try {
    const p = await dbGet('SELECT * FROM prospects WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Not found' });

    await dbRun('UPDATE prospects SET do_not_contact = 1, status = ? WHERE id = ?', ['Rejected', req.params.id]);
    if (p.email) {
      await dbRun('INSERT OR IGNORE INTO do_not_contact (email, name, reason) VALUES (?, ?, ?)', [p.email, p.name, req.body.reason || 'User request']);
    }
    log('do_not_contact_added', 'prospect', p.id, { name: p.name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST draft pitches for top prospects
router.post('/draft-pitches', async (req, res) => {
  try {
    const { prospect_ids, top_n } = req.body;

    const settingsRows = await dbAll('SELECT key, value FROM settings');
    const settings = {};
    settingsRows.forEach(row => { settings[row.key] = row.value; });

    let prospects;
    if (prospect_ids?.length) {
      prospects = (await Promise.all(prospect_ids.map(id => dbGet('SELECT * FROM prospects WHERE id = ?', [id])))).filter(Boolean);
    } else {
      const n = top_n || 10;
      prospects = await dbAll(`
        SELECT * FROM prospects
        WHERE status = 'New' AND do_not_contact = 0
        ORDER BY fit_score DESC LIMIT ?
      `, [n]);
    }

    const results = [];
    for (const prospect of prospects) {
      try {
        const draft = await draftPartnershipPitch({ prospect, settings });
        const subject = `Partnership Inquiry – ${settings.business_name}`;

        const qItem = await dbRun(`
          INSERT INTO approval_queue (type, recipient_name, recipient_email, subject, body, context, prospect_id, status)
          VALUES ('partnership_pitch', ?, ?, ?, ?, ?, ?, 'pending')
        `, [prospect.name, prospect.email || '', subject, draft, JSON.stringify({ prospect_id: prospect.id }), prospect.id]);

        results.push({ prospect_id: prospect.id, name: prospect.name, queue_id: qItem.lastID });
        log('pitch_drafted', 'prospect', prospect.id, { name: prospect.name });
      } catch (err) {
        results.push({ prospect_id: prospect.id, name: prospect.name, error: err.message });
      }
    }

    res.json({ drafted: results.filter(r => !r.error).length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
