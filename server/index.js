const express = require('express');
const path = require('path');
const config = require('./config');
const { setupSecurity } = require('./middleware/security');
const db = require('./services/db');

const app = express();

// Initialize database
db.getDb();

// Setup security middleware
setupSecurity(app);

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/scan', require('./routes/scan'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║     🔍 AccessiScan v1.0                       ║
  ║     AI-Powered Accessibility Testing           ║
  ║                                               ║
  ║     Server: http://localhost:${PORT}              ║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    db.closeDb();
    process.exit(0);
});

process.on('SIGTERM', () => {
    db.closeDb();
    process.exit(0);
});

module.exports = app;
