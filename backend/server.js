require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { initDb, getSetting, log } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/prospects', require('./routes/prospects'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/content', require('./routes/content'));
app.use('/api/galleries', require('./routes/galleries'));
app.use('/api/scheduler', require('./routes/scheduler'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Scheduled daily run
let cronJob = null;

async function startCron() {
  if (cronJob) { cronJob.stop(); cronJob = null; }
  const enabled = await getSetting('scheduler_enabled') === 'true';
  if (!enabled) return;

  const time = (await getSetting('scheduler_time')) || '08:00';
  const [hour, minute] = time.split(':');
  const expression = `${minute} ${hour} * * *`;

  cronJob = cron.schedule(expression, async () => {
    console.log(`[cron] Running daily routine at ${new Date().toISOString()}`);
    try {
      const response = await fetch(`http://localhost:${PORT}/api/scheduler/run-daily`, { method: 'POST' });
      const data = await response.json();
      console.log('[cron] Daily run complete:', data);
    } catch (err) {
      console.error('[cron] Daily run failed:', err.message);
    }
  });

  console.log(`[cron] Scheduled daily run at ${time}`);
}

// Refresh cron every 5 minutes in case settings changed
setInterval(() => startCron().catch(err => console.error('[cron] Error:', err)), 5 * 60 * 1000);

// Start server and initialize database
async function start() {
  try {
    await initDb();
    console.log(`🌸 Blume Studios backend initializing...`);
    console.log(`   Database: ${require('path').join(__dirname, '..', 'blume_studios.db')}`);

    app.listen(PORT, () => {
      console.log(`\n✓ Backend running on http://localhost:${PORT}`);
      startCron().catch(err => console.error('[cron] Startup error:', err));
      log('server_started', 'system', null, { port: PORT });
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
