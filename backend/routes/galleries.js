const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll, log } = require('../database');
const { v4: uuidv4 } = require('uuid');

// POST create new gallery
router.post('/', async (req, res) => {
  try {
    const { name, client_name, client_email } = req.body;
    if (!name || !client_name) return res.status(400).json({ error: 'name and client_name required' });

    const share_token = uuidv4();
    const result = await dbRun(
      'INSERT INTO galleries (name, client_name, client_email, share_token) VALUES (?, ?, ?, ?)',
      [name, client_name, client_email || null, share_token]
    );

    log('gallery_created', 'gallery', result.lastID, { name, client_name });
    res.json({ id: result.lastID, name, client_name, client_email, share_token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all galleries
router.get('/', async (req, res) => {
  try {
    const galleries = await dbAll(`
      SELECT
        g.id, g.name, g.client_name, g.client_email, g.share_token, g.created_at,
        COUNT(gp.id) as photo_count
      FROM galleries g
      LEFT JOIN gallery_photos gp ON g.id = gp.gallery_id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);
    res.json(galleries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET public gallery view (no auth needed) - MUST be before /:id route
router.get('/view/:share_token', async (req, res) => {
  try {
    const { share_token } = req.params;
    const gallery = await dbGet('SELECT * FROM galleries WHERE share_token = ?', [share_token]);
    if (!gallery) return res.status(404).json({ error: 'Gallery not found' });

    const photos = await dbAll(`
      SELECT gp.id, gp.photo_id, wp.filename, gp.photo_order
      FROM gallery_photos gp
      JOIN wedding_photos wp ON gp.photo_id = wp.id
      WHERE gp.gallery_id = ?
      ORDER BY gp.photo_order ASC
    `, [gallery.id]);

    res.json({ ...gallery, photos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single gallery
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const gallery = await dbGet('SELECT * FROM galleries WHERE id = ?', [id]);
    if (!gallery) return res.status(404).json({ error: 'Gallery not found' });

    const photos = await dbAll(`
      SELECT gp.id, gp.photo_id, wp.filename, gp.photo_order
      FROM gallery_photos gp
      JOIN wedding_photos wp ON gp.photo_id = wp.id
      WHERE gp.gallery_id = ?
      ORDER BY gp.photo_order ASC
    `, [id]);

    res.json({ ...gallery, photos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE gallery
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM gallery_photos WHERE gallery_id = ?', [id]);
    await dbRun('DELETE FROM galleries WHERE id = ?', [id]);
    log('gallery_deleted', 'gallery', id, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add photos to gallery
router.post('/:id/photos', async (req, res) => {
  try {
    const { id } = req.params;
    const { photo_ids } = req.body;

    if (!Array.isArray(photo_ids) || photo_ids.length === 0) {
      return res.status(400).json({ error: 'photo_ids array required' });
    }

    // Clear existing photos
    await dbRun('DELETE FROM gallery_photos WHERE gallery_id = ?', [id]);

    // Add new photos in order
    for (let i = 0; i < photo_ids.length; i++) {
      await dbRun(
        'INSERT INTO gallery_photos (gallery_id, photo_id, photo_order) VALUES (?, ?, ?)',
        [id, photo_ids[i], i]
      );
    }

    log('gallery_photos_updated', 'gallery', id, { count: photo_ids.length });
    res.json({ success: true, count: photo_ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE photo from gallery
router.delete('/:id/photos/:photo_id', async (req, res) => {
  try {
    const { id, photo_id } = req.params;
    await dbRun('DELETE FROM gallery_photos WHERE gallery_id = ? AND photo_id = ?', [id, photo_id]);
    log('gallery_photo_removed', 'gallery', id, { photo_id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
