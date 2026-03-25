const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let db = null;

function getDb() {
    if (db) return db;

    const dbDir = path.dirname(path.resolve(config.dbPath));
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(path.resolve(config.dbPath));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    initTables();
    return db;
}

function initTables() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      url TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      wcag_level TEXT DEFAULT 'wcag2aa',
      max_pages INTEGER DEFAULT 20,
      overall_score INTEGER DEFAULT 0,
      total_violations INTEGER DEFAULT 0,
      total_passes INTEGER DEFAULT 0,
      total_incomplete INTEGER DEFAULT 0,
      total_inapplicable INTEGER DEFAULT 0,
      pages_scanned INTEGER DEFAULT 0,
      pages_total INTEGER DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      error_message TEXT,
      config_json TEXT DEFAULT '{}',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scan_pages (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT DEFAULT '',
      score INTEGER DEFAULT 0,
      violations_count INTEGER DEFAULT 0,
      passes_count INTEGER DEFAULT 0,
      incomplete_count INTEGER DEFAULT 0,
      inapplicable_count INTEGER DEFAULT 0,
      screenshot_path TEXT,
      results_json TEXT DEFAULT '{}',
      scanned_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
    CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
    CREATE INDEX IF NOT EXISTS idx_scan_pages_scan_id ON scan_pages(scan_id);
  `);
}

// User operations
function createUser(id, email, passwordHash, name) {
    const stmt = db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)');
    return stmt.run(id, email, passwordHash, name || '');
}

function getUserByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(id) {
    return db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(id);
}

// Scan operations
function createScan(id, userId, url, wcagLevel, maxPages) {
    const stmt = db.prepare(
        'INSERT INTO scans (id, user_id, url, wcag_level, max_pages) VALUES (?, ?, ?, ?, ?)'
    );
    return stmt.run(id, userId, url, wcagLevel || 'wcag2aa', maxPages || 20);
}

function updateScanStatus(scanId, status, extra = {}) {
    const sets = ['status = ?'];
    const params = [status];

    for (const [key, value] of Object.entries(extra)) {
        const colName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        sets.push(`${colName} = ?`);
        params.push(value);
    }

    params.push(scanId);
    const stmt = db.prepare(`UPDATE scans SET ${sets.join(', ')} WHERE id = ?`);
    return stmt.run(...params);
}

function getScanById(scanId) {
    return db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId);
}

function getUserScans(userId, limit = 50, offset = 0) {
    return db.prepare(
        'SELECT * FROM scans WHERE user_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?'
    ).all(userId, limit, offset);
}

function getUserScanCount(userId) {
    return db.prepare('SELECT COUNT(*) as count FROM scans WHERE user_id = ?').get(userId).count;
}

function deleteScan(scanId, userId) {
    return db.prepare('DELETE FROM scans WHERE id = ? AND user_id = ?').run(scanId, userId);
}

// Scan page operations
function createScanPage(id, scanId, url, title, score, results) {
    const stmt = db.prepare(`
    INSERT INTO scan_pages (id, scan_id, url, title, score, violations_count, passes_count, 
    incomplete_count, inapplicable_count, results_json) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    return stmt.run(
        id, scanId, url, title, score,
        results.violations?.length || 0,
        results.passes?.length || 0,
        results.incomplete?.length || 0,
        results.inapplicable?.length || 0,
        JSON.stringify(results)
    );
}

function getScanPages(scanId) {
    return db.prepare('SELECT * FROM scan_pages WHERE scan_id = ? ORDER BY scanned_at').all(scanId);
}

// Dashboard stats
function getDashboardStats(userId) {
    const totalScans = db.prepare('SELECT COUNT(*) as count FROM scans WHERE user_id = ?').get(userId).count;
    const completedScans = db.prepare("SELECT COUNT(*) as count FROM scans WHERE user_id = ? AND status = 'completed'").get(userId).count;
    const avgScore = db.prepare("SELECT AVG(overall_score) as avg FROM scans WHERE user_id = ? AND status = 'completed'").get(userId).avg || 0;
    const recentScans = db.prepare('SELECT * FROM scans WHERE user_id = ? ORDER BY started_at DESC LIMIT 5').all(userId);
    const totalViolations = db.prepare("SELECT SUM(total_violations) as total FROM scans WHERE user_id = ? AND status = 'completed'").get(userId).total || 0;

    return {
        totalScans,
        completedScans,
        avgScore: Math.round(avgScore),
        recentScans,
        totalViolations
    };
}

// Get actual severity breakdown from scan results (no estimates)
function getSeverityBreakdown(userId) {
    const latestScan = db.prepare("SELECT id FROM scans WHERE user_id = ? AND status = 'completed' ORDER BY started_at DESC LIMIT 1").get(userId);
    if (!latestScan) return { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0 };

    const pages = db.prepare('SELECT results_json FROM scan_pages WHERE scan_id = ?').all(latestScan.id);
    const severity = { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0 };

    for (const page of pages) {
        try {
            const results = JSON.parse(page.results_json || '{}');
            if (results.violations) {
                for (const v of results.violations) {
                    const impact = v.impact || 'minor';
                    severity[impact] = (severity[impact] || 0) + (v.nodes?.length || 1);
                }
            }
            if (results.passes) {
                severity.passes += results.passes.length;
            }
        } catch { }
    }
    return severity;
}

function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

module.exports = {
    getDb, createUser, getUserByEmail, getUserById,
    createScan, updateScanStatus, getScanById, getUserScans, getUserScanCount, deleteScan,
    createScanPage, getScanPages,
    getDashboardStats, getSeverityBreakdown, closeDb
};
