const express = require('express');
const { authenticateAdmin } = require('../middleware/admin');
const db = require('../services/db');
const router = express.Router();

router.use(authenticateAdmin);

// Get global system stats
router.get('/stats', async (req, res) => {
    try {
        const { User, Scan } = db.getModels();
        const totalUsers = await User.countDocuments();
        const totalScans = await Scan.countDocuments();
        const completedScans = await Scan.countDocuments({ status: 'completed' });

        // Aggregate average global score
        const aggregate = await Scan.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, avgScore: { $avg: '$overall_score' } } }
        ]);
        const globalAvgScore = aggregate[0] ? Math.round(aggregate[0].avgScore) : 0;

        res.json({
            totalUsers,
            totalScans,
            completedScans,
            globalAvgScore
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await db.getAllUsers();

        // Enhance with scan counts
        const { Scan } = db.getModels();
        const enhancedUsers = await Promise.all(users.map(async (u) => {
            const scanCount = await Scan.countDocuments({ user_id: u.id });
            return { ...u, scanCount };
        }));

        res.json({ users: enhancedUsers });
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
