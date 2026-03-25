const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(403).json({ error: 'Invalid token' });
    }
}

function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email },
        config.jwtSecret,
        { expiresIn: config.jwtExpiry }
    );
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
        try {
            req.user = jwt.verify(token, config.jwtSecret);
        } catch (err) {
            // Ignore invalid tokens for optional auth
        }
    }
    next();
}

module.exports = { authenticateToken, generateToken, optionalAuth };
