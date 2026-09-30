const { google } = require('googleapis');
const { getSetting, setSetting } = require('../database');

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const accessToken = getSetting('gmail_access_token');
  const refreshToken = getSetting('gmail_refresh_token');
  const tokenExpiry = getSetting('gmail_token_expiry');

  if (accessToken && refreshToken) {
    oAuth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: tokenExpiry ? parseInt(tokenExpiry) : undefined,
    });

    oAuth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) setSetting('gmail_refresh_token', tokens.refresh_token);
      setSetting('gmail_access_token', tokens.access_token);
      if (tokens.expiry_date) setSetting('gmail_token_expiry', String(tokens.expiry_date));
    });
  }

  return oAuth2Client;
}

function getAuthUrl() {
  const oAuth2Client = getOAuthClient();
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
  });
}

async function handleCallback(code) {
  const oAuth2Client = getOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  setSetting('gmail_access_token', tokens.access_token);
  if (tokens.refresh_token) setSetting('gmail_refresh_token', tokens.refresh_token);
  if (tokens.expiry_date) setSetting('gmail_token_expiry', String(tokens.expiry_date));
  setSetting('google_oauth_configured', 'true');
  return tokens;
}

async function createDraft(to, subject, body) {
  const oAuth2Client = getOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  const senderName = getSetting('business_name') || 'Blume Studios LLC';
  const senderEmail = process.env.GMAIL_ADDRESS || '';

  const fromLine = senderEmail ? `${senderName} <${senderEmail}>` : senderName;

  const emailLines = [
    `From: ${fromLine}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ];

  const raw = Buffer.from(emailLines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw } },
  });

  return res.data;
}

async function listRecentMessages(maxResults = 20) {
  const oAuth2Client = getOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: 'in:inbox',
  });

  return res.data.messages || [];
}

// Check if any message in inbox is from a given email (reply detection)
async function hasRepliedFrom(email) {
  const oAuth2Client = getOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 10,
    q: `from:${email}`,
  });

  return (res.data.messages || []).length > 0;
}

function isConfigured() {
  return getSetting('google_oauth_configured') === 'true';
}

module.exports = { getAuthUrl, handleCallback, createDraft, listRecentMessages, hasRepliedFrom, isConfigured };
