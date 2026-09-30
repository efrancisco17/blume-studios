const express = require('express');
const router = express.Router();
const gmailService = require('../services/gmail');
const { log } = require('../database');

// Redirect to Google OAuth
router.get('/connect', (req, res) => {
  try {
    const url = gmailService.getAuthUrl();
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OAuth callback
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.redirect(`http://localhost:5173/settings?oauth_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return res.redirect(`http://localhost:5173/settings?oauth_error=no_code`);
  }
  try {
    await gmailService.handleCallback(code);
    log('oauth_connected', 'system', null, 'Google OAuth connected successfully');
    res.redirect('http://localhost:5173/settings?oauth_success=true');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`http://localhost:5173/settings?oauth_error=${encodeURIComponent(err.message)}`);
  }
});

// Status check
router.get('/status', (req, res) => {
  res.json({
    connected: gmailService.isConfigured(),
    credentials_set: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    anthropic_set: !!process.env.ANTHROPIC_API_KEY,
    places_set: !!(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
  });
});

module.exports = router;
