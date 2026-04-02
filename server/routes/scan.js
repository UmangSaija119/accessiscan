const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validateUrl, validateWcagLevel } = require('../middleware/validator');
const { validateUrlSafe } = require('../utils/ssrf-guard');
const { generateId } = require('../utils/helpers');
const db = require('../services/db');
const { runScan, cancelScan } = require('../services/scanner');

const router = express.Router();

// SSE clients for scan progress
const sseClients = new Map();

// Start a new scan
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { url, wcagLevel, maxPages, authConfig, deepScan } = req.body;

        // Validate URL
        const urlCheck = validateUrl(url);
        if (!urlCheck.valid) {
            return res.status(400).json({ error: urlCheck.error });
        }

        // SSRF check
        try {
            await validateUrlSafe(urlCheck.url);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }

        // Validate WCAG level
        const level = wcagLevel || 'wcag2aa';
        if (!validateWcagLevel(level)) {
            return res.status(400).json({ error: 'Invalid WCAG level' });
        }

        const pages = Math.min(Math.max(parseInt(maxPages) || 10, 1), 50);
        const scanId = generateId();

        // Respond immediately, then process in background
        res.status(202).json({ message: 'Scan queued successfully', scanId });

        // Background process
        await db.createScan(scanId, req.user.id, urlCheck.url, level, pages);

        // Start scan asynchronously
        runScan(scanId, urlCheck.url, {
            wcagLevel: level,
            maxPages: pages,
            authConfig: authConfig || null,
            deepScan: !!deepScan
        }, (progress) => {
            // Emit to SSE clients
            const clients = sseClients.get(scanId);
            if (clients) {
                const data = JSON.stringify(progress);
                clients.forEach(client => {
                    try {
                        client.write(`data: ${data}\n\n`);
                    } catch { /* client disconnected */ }
                });

                // Clean up on completion
                if (['completed', 'error', 'cancelled'].includes(progress.phase)) {
                    clients.forEach(client => {
                        try { client.end(); } catch { }
                    });
                    sseClients.delete(scanId);
                }
            }
        }).catch(err => {
            console.error(`Scan ${scanId} failed:`, err.message);
        });
    } catch (err) {
        console.error('Scan start error:', err);
        res.status(500).json({ error: 'Failed to start scan' });
    }
});

// SSE endpoint for scan progress
router.get('/:id/progress', authenticateToken, async (req, res) => {
    const scanId = req.params.id;

    // Verify scan belongs to user
    const scan = await db.getScanById(scanId);
    if (!scan || scan.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Scan not found' });
    }

    // If scan is already completed, send the final state
    if (['completed', 'failed', 'cancelled'].includes(scan.status)) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ phase: scan.status, message: `Scan ${scan.status}`, overallScore: scan.overall_score, totalViolations: scan.total_violations, pagesScanned: scan.pages_scanned })}\n\n`);
        return res.end();
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Register client
    if (!sseClients.has(scanId)) {
        sseClients.set(scanId, new Set());
    }
    sseClients.get(scanId).add(res);

    // Send initial state
    res.write(`data: ${JSON.stringify({ phase: scan.status, message: 'Connected to scan progress...' })}\n\n`);

    // Cleanup on disconnect
    req.on('close', () => {
        const clients = sseClients.get(scanId);
        if (clients) {
            clients.delete(res);
            if (clients.size === 0) sseClients.delete(scanId);
        }
    });
});

// Get scan status
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const scan = await db.getScanById(req.params.id);
        if (!scan || scan.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Scan not found' });
        }
        res.json({ scan });
    } catch (err) {
        console.error('Get scan error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cancel scan
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const scan = await db.getScanById(req.params.id);
        if (!scan || scan.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        if (!['pending', 'crawling', 'scanning'].includes(scan.status)) {
            return res.status(400).json({ error: 'Scan is not in progress' });
        }

        cancelScan(req.params.id);
        res.json({ message: 'Scan cancellation requested' });
    } catch (err) {
        console.error('Cancel scan error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Batch scan
router.post('/batch', authenticateToken, async (req, res) => {
    try {
        const { urls, wcagLevel, maxPages } = req.body;

        if (!Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ error: 'URLs array is required' });
        }

        if (urls.length > 10) {
            return res.status(400).json({ error: 'Maximum 10 URLs per batch' });
        }

        const level = wcagLevel || 'wcag2aa';
        const pages = Math.min(Math.max(parseInt(maxPages) || 5, 1), 20);
        const scanIds = [];

        for (const url of urls) {
            const urlCheck = validateUrl(url);
            if (!urlCheck.valid) continue;

            try {
                await validateUrlSafe(urlCheck.url);
            } catch { continue; }

            const scanId = generateId();
            await db.createScan(scanId, req.user.id, urlCheck.url, level, pages);
            scanIds.push({ scanId, url: urlCheck.url });

            // Start scan (no SSE for batch)
            runScan(scanId, urlCheck.url, { wcagLevel: level, maxPages: pages })
                .catch(err => console.error(`Batch scan ${scanId} failed:`, err.message));
        }

        res.status(202).json({
            message: `Started ${scanIds.length} scans`,
            scans: scanIds
        });
    } catch (err) {
        console.error('Batch scan error:', err);
        res.status(500).json({ error: 'Failed to start batch scan' });
    }
});

module.exports = router;
