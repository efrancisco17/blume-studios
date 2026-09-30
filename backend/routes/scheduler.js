const express = require('express');
const router = express.Router();
const { dbRun, dbAll, dbGet, log, getSetting } = require('../database');
const { draftLeadFollowUp, draftSequenceFollowUp, draftMorningSummary } = require('../services/claude');
const { hasRepliedFrom } = require('../services/gmail');

// Run the full daily routine manually
router.post('/run-daily', async (req, res) => {
  const settingsRows = await dbAll('SELECT key, value FROM settings');
  const settings = {};
  settingsRows.forEach(row => { settings[row.key] = row.value; });

  const results = {
    stale_leads_drafted: 0,
    sequences_processed: 0,
    replies_detected: 0,
    errors: [],
  };

  try {
    // 1. Check for replies on outreach sequences
    try {
      const activeSequences = await dbAll(`
        SELECT os.*, p.email, p.name as prospect_name, p.id as prospect_id
        FROM outreach_sequences os
        JOIN prospects p ON os.prospect_id = p.id
        WHERE os.status = 'sent' AND p.email IS NOT NULL
      `);

      for (const seq of activeSequences) {
        try {
          const replied = await hasRepliedFrom(seq.email);
          if (replied) {
            await dbRun("UPDATE outreach_sequences SET status = 'replied' WHERE id = ?", [seq.id]);
            await dbRun("UPDATE prospects SET status = 'Replied' WHERE id = ?", [seq.prospect_id]);
            await dbRun("UPDATE outreach_sequences SET status = 'stopped' WHERE prospect_id = ? AND status = 'scheduled'", [seq.prospect_id]);
            results.replies_detected++;
            log('reply_detected', 'prospect', seq.prospect_id, { name: seq.prospect_name });
          }
        } catch (err) {
          results.errors.push(`Reply check for ${seq.prospect_name}: ${err.message}`);
        }
      }
    } catch (err) {
      results.errors.push(`Reply detection: ${err.message}`);
    }

    // 2. Process due sequence follow-ups
    try {
      const due = await dbAll(`
        SELECT os.*, p.name as prospect_name, p.email, p.type as prospect_type, p.specific_detail, p.do_not_contact
        FROM outreach_sequences os
        JOIN prospects p ON os.prospect_id = p.id
        WHERE os.status = 'scheduled'
        AND os.scheduled_date <= date('now')
        AND p.do_not_contact = 0
      `);

      for (const seq of due) {
        const lastContact = await dbGet(`
          SELECT MAX(sent_date) as last FROM outreach_sequences
          WHERE prospect_id = ? AND sent_date IS NOT NULL
        `, [seq.prospect_id]);

        if (lastContact && lastContact.last) {
          const daysSince = Math.floor((Date.now() - new Date(lastContact.last).getTime()) / 86400000);
          if (daysSince < 7) continue;
        }

        const sentCount = (await dbGet(`
          SELECT COUNT(*) as count FROM outreach_sequences
          WHERE prospect_id = ? AND status IN ('sent', 'scheduled')
        `, [seq.prospect_id])).count;

        if (sentCount > 3) {
          await dbRun("UPDATE outreach_sequences SET status = 'stopped' WHERE id = ?", [seq.id]);
          continue;
        }

        try {
          const draft = await draftSequenceFollowUp({
            prospect: { name: seq.prospect_name, type: seq.prospect_type, specific_detail: seq.specific_detail },
            step: seq.step,
            settings,
          });

          const subject = `Following up – ${settings.business_name} Partnership`;
          await dbRun(`
            INSERT INTO approval_queue (type, recipient_name, recipient_email, subject, body, context, prospect_id, sequence_id, status)
            VALUES ('sequence_followup', ?, ?, ?, ?, ?, ?, ?, 'pending')
          `, [seq.prospect_name, seq.email || '', subject, draft, JSON.stringify({ step: seq.step }), seq.prospect_id, seq.id]);

          results.sequences_processed++;
          log('sequence_followup_drafted', 'prospect', seq.prospect_id, { step: seq.step });
        } catch (err) {
          results.errors.push(`Sequence for ${seq.prospect_name}: ${err.message}`);
        }
      }
    } catch (err) {
      results.errors.push(`Sequence processing: ${err.message}`);
    }

    // 3. Draft follow-ups for stale leads
    try {
      const stale = await dbAll(`
        SELECT * FROM leads
        WHERE status NOT IN ('Booked', 'Lost')
        AND (last_contact_date IS NULL OR julianday('now') - julianday(last_contact_date) >= 3)
        ORDER BY last_contact_date ASC LIMIT 5
      `);

      for (const lead of stale) {
        const daysSince = lead.last_contact_date
          ? Math.floor((Date.now() - new Date(lead.last_contact_date).getTime()) / 86400000)
          : 999;
        try {
          const draft = await draftLeadFollowUp({ lead, settings, daysSinceContact: daysSince });
          await dbRun(`
            INSERT INTO approval_queue (type, recipient_name, recipient_email, subject, body, context, lead_id, status)
            VALUES ('follow_up', ?, ?, ?, ?, ?, ?, 'pending')
          `, [lead.couple_name, lead.email || '', `Following up – ${lead.couple_name}`, draft, JSON.stringify({ days_since: daysSince }), lead.id]);
          results.stale_leads_drafted++;
        } catch (err) {
          results.errors.push(`Follow-up for ${lead.couple_name}: ${err.message}`);
        }
      }
    } catch (err) {
      results.errors.push(`Stale leads: ${err.message}`);
    }

    // 4. Generate morning summary
    try {
      const staleCount = (await dbGet(`
        SELECT COUNT(*) as c FROM leads
        WHERE status NOT IN ('Booked','Lost')
        AND (last_contact_date IS NULL OR julianday('now')-julianday(last_contact_date) >= 3)
      `)).c;
      const seqDueCount = (await dbGet("SELECT COUNT(*) as c FROM outreach_sequences WHERE status = 'scheduled' AND scheduled_date <= date('now')")).c;
      const newProspectsCount = (await dbGet("SELECT COUNT(*) as c FROM prospects WHERE status = 'New' AND date(created_at) = date('now')")).c;

      const summary = await draftMorningSummary({
        staleLeads: staleCount,
        sequenceDue: seqDueCount,
        newProspectsFound: newProspectsCount,
        settings,
      });

      await dbRun('INSERT INTO morning_summaries (summary, actions_taken, drafts_created) VALUES (?, ?, ?)', [
        summary,
        results.replies_detected + results.sequences_processed,
        results.stale_leads_drafted + results.sequences_processed
      ]);
    } catch (err) {
      results.errors.push(`Morning summary: ${err.message}`);
    }

    log('daily_run_complete', 'system', null, results);
    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET scheduler status
router.get('/status', async (req, res) => {
  try {
    const lastRun = await dbGet('SELECT * FROM morning_summaries ORDER BY created_at DESC LIMIT 1');
    res.json({
      enabled: (await getSetting('scheduler_enabled')) === 'true',
      time: (await getSetting('scheduler_time')) || '08:00',
      last_run: lastRun?.created_at || null,
      last_summary: lastRun?.summary || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
