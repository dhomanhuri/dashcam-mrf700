const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all devices
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM devices ORDER BY last_seen DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET device by id
router.get('/:deviceId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM devices WHERE device_id = $1`,
      [req.params.deviceId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET latest GPS for device
router.get('/:deviceId/gps/latest', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM gps_records WHERE device_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [req.params.deviceId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET GPS history for device
router.get('/:deviceId/gps/history', async (req, res) => {
  try {
    const { from, to, limit = 1000 } = req.query;
    let query = `SELECT * FROM gps_records WHERE device_id = $1`;
    const params = [req.params.deviceId];

    if (from) { params.push(from); query += ` AND recorded_at >= $${params.length}`; }
    if (to)   { params.push(to);   query += ` AND recorded_at <= $${params.length}`; }

    params.push(Math.min(parseInt(limit), 5000));
    query += ` ORDER BY recorded_at DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET events for device
router.get('/:deviceId/events', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const result = await db.query(
      `SELECT * FROM events WHERE device_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
      [req.params.deviceId, parseInt(limit)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
