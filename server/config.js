require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-me',
  jwtExpiry: '24h',
  dbPath: process.env.DB_PATH || './data/accessiscan.db',
  maxConcurrentScans: parseInt(process.env.MAX_CONCURRENT_SCANS) || 3,
  scanTimeout: parseInt(process.env.SCAN_TIMEOUT) || 30000,
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  scanRateLimitMax: parseInt(process.env.SCAN_RATE_LIMIT_MAX) || 5,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  maxPages: 20,
  defaultWcagLevel: 'wcag2aa',
  screenshotDir: './data/screenshots',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
};
