const express = require('express');
const router = express.Router();
const { dbRun, dbAll, log } = require('../database');
const { draftVenueLandingPage, draftGBPPost } = require('../services/claude');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG files are allowed'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// POST draft venue landing page
router.post('/venue-page', async (req, res) => {
  try {
    const { venue_name } = req.body;
    if (!venue_name) return res.status(400).json({ error: 'venue_name required' });

    const settingsRows = await dbAll('SELECT key, value FROM settings');
    const settings = {};
    settingsRows.forEach(row => { settings[row.key] = row.value; });

    const weddings = await dbAll(`
      SELECT couple_name, wedding_date, venue FROM leads
      WHERE status = 'Booked' AND venue LIKE ?
      ORDER BY wedding_date DESC
    `, [`%${venue_name}%`]);

    const content = await draftVenueLandingPage({ venueName: venue_name, weddings, settings });
    log('venue_page_drafted', 'system', null, { venue: venue_name });
    res.json({ venue_name, weddings_count: weddings.length, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST draft GBP post from a wedding
router.post('/gbp-post', async (req, res) => {
  try {
    const { lead_id } = req.body;

    const settingsRows = await dbAll('SELECT key, value FROM settings');
    const settings = {};
    settingsRows.forEach(row => { settings[row.key] = row.value; });

    let wedding;
    if (lead_id) {
      wedding = await dbAll("SELECT * FROM leads WHERE id = ? AND status = 'Booked'", [lead_id]);
      if (!wedding || !wedding[0]) return res.status(404).json({ error: 'Booked lead not found' });
      wedding = wedding[0];
    } else {
      const weddings = await dbAll("SELECT * FROM leads WHERE status = 'Booked' ORDER BY wedding_date DESC LIMIT 1");
      if (!weddings || !weddings[0]) return res.status(404).json({ error: 'No booked weddings found' });
      wedding = weddings[0];
    }

    const content = await draftGBPPost({ wedding, settings });
    log('gbp_post_drafted', 'lead', wedding.id, null);
    res.json({ couple_name: wedding.couple_name, venue: wedding.venue, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET list of booked weddings
router.get('/weddings', async (req, res) => {
  try {
    const weddings = await dbAll(`
      SELECT id, couple_name, wedding_date, venue FROM leads
      WHERE status = 'Booked' ORDER BY wedding_date DESC
    `);
    res.json(weddings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET unique venues from booked weddings
router.get('/venues', async (req, res) => {
  try {
    const venues = await dbAll(`
      SELECT venue, COUNT(*) as count FROM leads
      WHERE status = 'Booked' AND venue IS NOT NULL AND venue != ''
      GROUP BY venue ORDER BY count DESC
    `);
    res.json(venues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST upload photos (general portfolio)
router.post('/photos/upload', upload.array('photos', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const uploaded = [];
    for (const file of req.files) {
      const result = await dbRun(
        'INSERT INTO wedding_photos (filename, file_data, file_size, mime_type) VALUES (?, ?, ?, ?)',
        [file.originalname, Buffer.from(file.buffer).toString('base64'), file.size, file.mimetype]
      );
      uploaded.push({ id: result.lastID, filename: file.originalname, size: file.size });
      log('photo_uploaded', 'system', null, { filename: file.originalname });
    }

    res.json({ uploaded: uploaded.length, photos: uploaded });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all photos (optionally filtered by wedding)
router.get('/photos', async (req, res) => {
  try {
    const { lead_id } = req.query;
    let query = 'SELECT id, filename, file_size, mime_type, lead_id, created_at FROM wedding_photos';
    const params = [];

    if (lead_id) {
      query += ' WHERE lead_id = ?';
      params.push(lead_id);
    } else {
      query += ' WHERE lead_id IS NULL';
    }

    query += ' ORDER BY created_at DESC';
    const photos = await dbAll(query, params);
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET photos for a specific wedding
router.get('/photos/:lead_id', async (req, res) => {
  try {
    const { lead_id } = req.params;
    const photos = await dbAll('SELECT id, filename, file_size, mime_type, created_at FROM wedding_photos WHERE lead_id = ? ORDER BY created_at DESC', [lead_id]);
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET individual photo by ID only (for galleries)
router.get('/photos/view/:photo_id', async (req, res) => {
  try {
    const { photo_id } = req.params;
    const photo = await dbAll('SELECT file_data, mime_type FROM wedding_photos WHERE id = ?', [photo_id]);
    if (!photo || !photo[0]) return res.status(404).send('Photo not found');

    const { file_data, mime_type } = photo[0];
    const buffer = Buffer.from(file_data, 'base64');
    res.type(mime_type).send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET photo data (serves the image directly)
router.get('/photos/:lead_id/:photo_id', async (req, res) => {
  try {
    const { photo_id } = req.params;
    const photo = await dbAll('SELECT file_data, mime_type FROM wedding_photos WHERE id = ?', [photo_id]);
    if (!photo || !photo[0]) return res.status(404).send('Photo not found');

    const { file_data, mime_type } = photo[0];
    const buffer = Buffer.from(file_data, 'base64');
    res.type(mime_type).send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST associate photo with a wedding
router.post('/photos/:photo_id/associate', async (req, res) => {
  try {
    const { photo_id } = req.params;
    const { lead_id } = req.body;

    if (!lead_id) return res.status(400).json({ error: 'lead_id required' });

    await dbRun('UPDATE wedding_photos SET lead_id = ? WHERE id = ?', [lead_id, photo_id]);
    log('photo_associated', 'lead', lead_id, { photo_id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a photo
router.delete('/photos/:photo_id', async (req, res) => {
  try {
    const { photo_id } = req.params;
    await dbRun('DELETE FROM wedding_photos WHERE id = ?', [photo_id]);
    log('photo_deleted', 'photo', photo_id, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
