const { google } = require('googleapis');
const { getSetting } = require('../database');

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/callback';

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
  }

  return oAuth2Client;
}

// Check if a date is available on Google Calendar
async function checkDateAvailability(dateStr) {
  try {
    const oAuth2Client = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    // Parse date — accept various formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null; // can't parse

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = res.data.items || [];
    const weddingEvents = events.filter(e =>
      e.summary && /wedding|booked|shoot|photography/i.test(e.summary)
    );

    return weddingEvents.length === 0; // true = available
  } catch (err) {
    console.error('Calendar check failed:', err.message);
    return null; // unknown
  }
}

// Get upcoming booked dates
async function getBookedDates(daysAhead = 365) {
  try {
    const oAuth2Client = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + daysAhead);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      q: 'wedding',
    });

    return (res.data.items || []).map(e => ({
      title: e.summary,
      date: e.start?.date || e.start?.dateTime?.split('T')[0],
    }));
  } catch (err) {
    console.error('Calendar fetch failed:', err.message);
    return [];
  }
}

module.exports = { checkDateAvailability, getBookedDates };
