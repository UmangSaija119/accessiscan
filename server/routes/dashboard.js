const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../services/db');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, (req, res) => {
    try {
        const stats = db.getDashboardStats(req.user.id);
        const severity = db.getSeverityBreakdown(req.user.id);
        res.json({ stats, severity });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get recent scans
router.get('/recent', authenticateToken, (req, res) => {
    try {
        const scans = db.getUserScans(req.user.id, 10, 0);
        res.json({ scans });
    } catch (err) {
        console.error('Recent scans error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get scan history with pagination
router.get('/history', authenticateToken, (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
        const offset = (page - 1) * limit;

        const scans = db.getUserScans(req.user.id, limit, offset);
        const total = db.getUserScanCount(req.user.id);

        res.json({
            scans,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('History error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
