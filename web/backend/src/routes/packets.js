const express = require('express');
const router = express.Router();
const db = require('../db');

// GET raw packets (for debugging)
router.get('/', async (req, res) => {
  try {
    const { device_id, limit = 100 } = req.query;
    let query = `SELECT * FROM raw_packets`;
    const params = [];

    if (device_id) {
      params.push(device_id);
      query += ` WHERE device_id = $1`;
    }

    params.push(Math.min(parseInt(limit), 1000));
    query += ` ORDER BY received_at DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET packet stats
router.get('/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        device_id,
        packet_type,
        COUNT(*) as count,
        MAX(received_at) as last_received
      FROM raw_packets
      GROUP BY device_id, packet_type
      ORDER BY device_id, count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
