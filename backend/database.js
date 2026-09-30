const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'blume_studios.db');

let db = null;
let SQL = null;

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

// Save database to disk
function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Initialize database asynchronously
async function initDb() {
  SQL = await initSqlJs();

  let data;
  if (fs.existsSync(DB_PATH)) {
    // Load existing database
    data = fs.readFileSync(DB_PATH);
  } else {
    // Create new database
    data = null;
  }

  db = new SQL.Database(data);
  await initSchema();
  return db;
}

async function initSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_name TEXT NOT NULL,
      partner1_name TEXT,
      partner2_name TEXT,
      email TEXT,
      phone TEXT,
      wedding_date TEXT,
      venue TEXT,
      source TEXT DEFAULT 'Direct',
      status TEXT DEFAULT 'New',
      contract_value REAL,
      notes TEXT,
      last_contact_date TEXT,
      inquiry_text TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prospects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      website TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      distance REAL,
      style TEXT,
      specific_detail TEXT,
      fit_score INTEGER,
      status TEXT DEFAULT 'New',
      do_not_contact INTEGER DEFAULT 0,
      last_contact_date TEXT,
      place_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS outreach_sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prospect_id INTEGER NOT NULL,
      step INTEGER DEFAULT 1,
      scheduled_date TEXT,
      sent_date TEXT,
      gmail_draft_id TEXT,
      status TEXT DEFAULT 'scheduled',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (prospect_id) REFERENCES prospects(id)
    );

    CREATE TABLE IF NOT EXISTS approval_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      recipient_name TEXT,
      recipient_email TEXT,
      subject TEXT,
      body TEXT NOT NULL,
      context TEXT,
      lead_id INTEGER,
      prospect_id INTEGER,
      sequence_id INTEGER,
      status TEXT DEFAULT 'pending',
      gmail_draft_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS action_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS do_not_contact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      reason TEXT,
      added_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS morning_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary TEXT NOT NULL,
      actions_taken INTEGER DEFAULT 0,
      drafts_created INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wedding_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      filename TEXT NOT NULL,
      file_data BLOB,
      file_size INTEGER,
      mime_type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    CREATE TABLE IF NOT EXISTS galleries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT,
      share_token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gallery_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gallery_id INTEGER NOT NULL,
      photo_id INTEGER NOT NULL,
      photo_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (gallery_id) REFERENCES galleries(id),
      FOREIGN KEY (photo_id) REFERENCES wedding_photos(id)
    );
  `;

  // Execute schema statements one by one
  const statements = schema.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    try {
      db.run(stmt);
    } catch (err) {
      // Table might already exist, that's fine
      if (!err.message.includes('already exists')) {
        console.error('Schema error:', err.message);
      }
    }
  }

  // Seed default settings if none exist
  try {
    const result = db.exec("SELECT COUNT(*) as count FROM settings");
    const count = result.length > 0 ? result[0].values[0][0] : 0;

    if (count === 0) {
      const defaults = {
        business_name: 'Blume Studios LLC',
        owner_name: 'Your Name',
        location: 'Philadelphia, PA',
        radius_miles: '50',
        style: 'All kinds',
        package_6hr: '1100',
        package_8hr: '1400',
        mailing_address: '123 Main St, Philadelphia, PA 19103',
        voice_tone: 'Warm and genuine',
        sign_off: 'Looking forward to capturing your day',
        google_oauth_configured: 'false',
        anthropic_configured: 'false',
        scheduler_enabled: 'false',
        scheduler_time: '08:00',
      };

      for (const [key, value] of Object.entries(defaults)) {
        db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [key, value]);
      }
      saveDb();
    }
  } catch (err) {
    console.error('Settings seed error:', err.message);
  }
}

// Promise-based wrapper functions for consistency
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();

      // Get last insert ID if it's an INSERT statement
      let lastID = 0;
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        const idResult = db.exec("SELECT last_insert_rowid() as id");
        if (idResult.length > 0 && idResult[0].values.length > 0) {
          lastID = idResult[0].values[0][0];
        }
      }

      saveDb(); // Save after write
      resolve({ lastID, changes: 1 });
    } catch (err) {
      reject(err);
    }
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      let result = null;
      if (stmt.step()) {
        const row = stmt.getAsObject();
        result = row;
      }
      stmt.free();
      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      resolve(results);
    } catch (err) {
      reject(err);
    }
  });
}

async function getSetting(key) {
  const row = await dbGet("SELECT value FROM settings WHERE key = ?", [key]);
  return row ? row.value : null;
}

function setSetting(key, value) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
      stmt.bind([key, String(value)]);
      stmt.step();
      stmt.free();
      saveDb();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function log(action, targetType, targetId, details) {
  // Fire-and-forget logging
  try {
    const stmt = db.prepare("INSERT INTO action_log (action, target_type, target_id, details) VALUES (?, ?, ?, ?)");
    stmt.bind([action, targetType || null, targetId || null, typeof details === 'object' ? JSON.stringify(details) : details || null]);
    stmt.step();
    stmt.free();
    saveDb();
  } catch (err) {
    console.error('Logging error:', err);
  }
}

module.exports = { initDb, getDb, log, getSetting, setSetting, dbRun, dbGet, dbAll };
