const { authenticateToken } = require('./auth');
const db = require('../services/db');

async function authenticateAdmin(req, res, next) {
    // Re-use auth middleware
    authenticateToken(req, res, async () => {
        try {
            const user = await db.getUserById(req.user.id);
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied. Administrators only.' });
            }
            req.adminUser = user;
            next();
        } catch (err) {
            console.error('Admin auth error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}

module.exports = { authenticateAdmin };
