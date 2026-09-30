const express = require('express');
const router = express.Router();
const { dbAll, dbGet } = require('../database');

// GET dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const totalLeads = (await dbGet("SELECT COUNT(*) as count FROM leads")).count;
    const bookedLeads = (await dbGet("SELECT COUNT(*) as count FROM leads WHERE status = 'Booked'")).count;
    const totalRevenue = (await dbGet("SELECT COALESCE(SUM(contract_value), 0) as total FROM leads WHERE status = 'Booked'")).total;
    const pendingQueue = (await dbGet("SELECT COUNT(*) as count FROM approval_queue WHERE status = 'pending'")).count;
    const totalProspects = (await dbGet("SELECT COUNT(*) as count FROM prospects")).count;
    const staleLeads = (await dbGet(`
      SELECT COUNT(*) as count FROM leads
      WHERE status NOT IN ('Booked', 'Lost')
      AND (last_contact_date IS NULL OR julianday('now') - julianday(last_contact_date) >= 3)
    `)).count;

    const pipelineByStatus = await dbAll(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(contract_value), 0) as value
      FROM leads GROUP BY status
    `);

    const recentLeads = await dbAll(`
      SELECT * FROM leads ORDER BY created_at DESC LIMIT 5
    `);

    const recentActivity = await dbAll(`
      SELECT * FROM action_log ORDER BY created_at DESC LIMIT 10
    `);

    const morningSummary = await dbGet(`
      SELECT * FROM morning_summaries ORDER BY created_at DESC LIMIT 1
    `);

    res.json({
      stats: { totalLeads, bookedLeads, totalRevenue, pendingQueue, totalProspects, staleLeads },
      pipelineByStatus,
      recentLeads,
      recentActivity,
      morningsummary: morningSummary || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET source ROI report
router.get('/roi', async (req, res) => {
  try {
    const bySource = await dbAll(`
      SELECT
        source,
        COUNT(*) as total_leads,
        SUM(CASE WHEN status = 'Booked' THEN 1 ELSE 0 END) as bookings,
        COALESCE(SUM(CASE WHEN status = 'Booked' THEN contract_value ELSE 0 END), 0) as revenue,
        ROUND(100.0 * SUM(CASE WHEN status = 'Booked' THEN 1 ELSE 0 END) / COUNT(*), 1) as conversion_rate
      FROM leads
      GROUP BY source
      ORDER BY revenue DESC
    `);

    const totalRevenue = bySource.reduce((s, r) => s + r.revenue, 0);
    const totalBookings = bySource.reduce((s, r) => s + r.bookings, 0);

    const recommendations = bySource.map(s => {
      if (s.conversion_rate >= 30 && s.revenue > 0) return { source: s.source, action: 'keep', reason: `Strong conversion (${s.conversion_rate}%) and revenue. Double down.` };
      if (s.conversion_rate < 10 && s.total_leads >= 5) return { source: s.source, action: 'cut', reason: `Low conversion (${s.conversion_rate}%) with ${s.total_leads} leads. Review or cut.` };
      return { source: s.source, action: 'watch', reason: `Too early to decide — keep monitoring.` };
    });

    const outreachStats = await dbAll(`
      SELECT status, COUNT(*) as count FROM prospects GROUP BY status
    `);

    const sequenceStats = await dbAll(`
      SELECT step, status, COUNT(*) as count FROM outreach_sequences GROUP BY step, status
    `);

    res.json({ bySource, totalRevenue, totalBookings, recommendations, outreachStats, sequenceStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET booking trend by month
router.get('/trend', async (req, res) => {
  try {
    const trend = await dbAll(`
      SELECT
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as leads,
        SUM(CASE WHEN status = 'Booked' THEN 1 ELSE 0 END) as bookings,
        COALESCE(SUM(CASE WHEN status = 'Booked' THEN contract_value ELSE 0 END), 0) as revenue
      FROM leads
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month ASC
    `);
    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
