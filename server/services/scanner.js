const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { generateId, calculateScore } = require('../utils/helpers');
const { discoverPages } = require('./crawler');
const db = require('./db');

// Track active scans for cancellation
const activeScans = new Map();

async function runScan(scanId, url, options = {}, onProgress = null) {
    const {
        wcagLevel = config.defaultWcagLevel,
        maxPages = config.maxPages
    } = options;

    const axeSource = require('axe-core').source;

    let browser;
    try {
        // Update scan status
        db.updateScanStatus(scanId, 'crawling');
        emitProgress(onProgress, { phase: 'crawling', message: 'Discovering pages...' });

        // Discover pages
        let pages;
        try {
            pages = await discoverPages(url, maxPages);
        } catch {
            pages = [url]; // Fallback to just the provided URL
        }

        db.updateScanStatus(scanId, 'scanning', {
            pages_total: pages.length
        });

        emitProgress(onProgress, {
            phase: 'scanning',
            message: `Found ${pages.length} page(s). Starting scan...`,
            pagesTotal: pages.length,
            pagesScanned: 0
        });

        // Launch browser
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        // Store browser ref for cancellation
        activeScans.set(scanId, { browser, cancelled: false });

        let totalViolations = 0;
        let totalPasses = 0;
        let totalIncomplete = 0;
        let totalInapplicable = 0;
        let pagesScanned = 0;

        // Ensure screenshots directory exists
        const screenshotDir = path.resolve(config.screenshotDir);
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }

        // Scan each page
        for (const pageUrl of pages) {
            // Check if cancelled
            const scanState = activeScans.get(scanId);
            if (scanState?.cancelled) {
                db.updateScanStatus(scanId, 'cancelled');
                emitProgress(onProgress, { phase: 'cancelled', message: 'Scan cancelled' });
                break;
            }

            try {
                const result = await scanPage(browser, pageUrl, axeSource, wcagLevel, scanId, screenshotDir);

                // Save page result to DB
                db.createScanPage(
                    generateId(), scanId, pageUrl, result.title, result.score, result
                );

                totalViolations += result.violations.length;
                totalPasses += result.passes.length;
                totalIncomplete += result.incomplete.length;
                totalInapplicable += result.inapplicable.length;
                pagesScanned++;

                // Update scan progress
                db.updateScanStatus(scanId, 'scanning', {
                    pages_scanned: pagesScanned,
                    total_violations: totalViolations,
                    total_passes: totalPasses,
                    total_incomplete: totalIncomplete,
                    total_inapplicable: totalInapplicable
                });

                emitProgress(onProgress, {
                    phase: 'scanning',
                    message: `Scanned: ${pageUrl}`,
                    pagesTotal: pages.length,
                    pagesScanned,
                    currentPage: pageUrl,
                    pageScore: result.score,
                    violations: result.violations.length
                });

            } catch (err) {
                pagesScanned++;
                emitProgress(onProgress, {
                    phase: 'scanning',
                    message: `Error scanning ${pageUrl}: ${err.message}`,
                    pagesTotal: pages.length,
                    pagesScanned,
                    error: true
                });
            }
        }

        // Calculate overall score
        const overallScore = calculateScore(totalViolations, totalPasses);

        // Finalize
        await db.updateScanStatus(scanId, 'completed', {
            overall_score: overallScore,
            total_violations: totalViolations,
            total_passes: totalPasses,
            total_incomplete: totalIncomplete,
            total_inapplicable: totalInapplicable,
            pages_scanned: pagesScanned,
            completed_at: new Date().toISOString()
        });

        emitProgress(onProgress, {
            phase: 'completed',
            message: 'Scan completed!',
            overallScore,
            totalViolations,
            totalPasses,
            pagesScanned
        });

        return { overallScore, totalViolations, totalPasses, pagesScanned };

    } catch (err) {
        db.updateScanStatus(scanId, 'failed', {
            error_message: err.message
        });
        emitProgress(onProgress, {
            phase: 'error',
            message: `Scan failed: ${err.message}`
        });
        throw err;
    } finally {
        activeScans.delete(scanId);
        if (browser) await browser.close().catch(() => { });
    }
}

async function scanPage(browser, url, axeSource, wcagLevel, scanId, screenshotDir) {
    const page = await browser.newPage();

    try {
        // Set viewport for consistent testing
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('AccessiScan/1.0 Accessibility Testing Bot');

        // Navigate with timeout
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: config.scanTimeout
        });

        // Get page title
        const title = await page.title();

        // Take screenshot
        let screenshotPath = null;
        try {
            const screenshotFile = `${scanId}_${Buffer.from(url).toString('base64url').slice(0, 50)}.png`;
            screenshotPath = path.join(screenshotDir, screenshotFile);
            await page.screenshot({ path: screenshotPath, fullPage: false });
        } catch { /* screenshot failure is non-critical */ }

        // Inject and run axe-core
        await page.evaluate(axeSource);

        const axeConfig = buildAxeConfig(wcagLevel);

        // Wrap axe execution in a strict 45-second timeout.
        // Axe-core can infinitely hang on massive nested shadow DOMs or iframes.
        const axePromise = page.evaluate((cfg) => {
            return new Promise((resolve, reject) => {
                window.axe.run(document, cfg)
                    .then(resolve)
                    .catch(reject);
            });
        }, axeConfig);

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("WCAG Engine execution timed out after 45 seconds")), 45000)
        );

        const results = await Promise.race([axePromise, timeoutPromise]);

        const score = calculateScore(results.violations.length, results.passes.length);

        return {
            url,
            title,
            score,
            screenshotPath,
            violations: results.violations.map(simplifyResult),
            passes: results.passes.map(simplifyResult),
            incomplete: results.incomplete.map(simplifyResult),
            inapplicable: results.inapplicable.map(simplifyResult),
            timestamp: new Date().toISOString()
        };

    } finally {
        await page.close();
    }
}

function buildAxeConfig(wcagLevel) {
    const tagMap = {
        'wcag2a': ['wcag2a', 'best-practice'],
        'wcag2aa': ['wcag2a', 'wcag2aa', 'best-practice'],
        'wcag2aaa': ['wcag2a', 'wcag2aa', 'wcag2aaa', 'best-practice'],
        'wcag21a': ['wcag2a', 'wcag21a', 'best-practice'],
        'wcag21aa': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
        'wcag21aaa': ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa', 'best-practice'],
        'wcag22aa': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']
    };

    return {
        runOnly: {
            type: 'tag',
            values: tagMap[wcagLevel] || tagMap['wcag2aa']
        },
        resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable']
    };
}

function simplifyResult(item) {
    return {
        id: item.id,
        impact: item.impact || null,
        description: item.description,
        help: item.help,
        helpUrl: item.helpUrl,
        tags: item.tags || [],
        nodes: (item.nodes || []).slice(0, 25).map(node => ({
            html: node.html?.slice(0, 500),
            target: node.target,
            failureSummary: node.failureSummary || node.any?.map(a => a.message).join('; ') || '',
            impact: node.impact
        }))
    };
}

function emitProgress(callback, data) {
    if (typeof callback === 'function') {
        try { callback(data); } catch { /* ignore callback errors */ }
    }
}

function cancelScan(scanId) {
    const scanState = activeScans.get(scanId);
    if (scanState) {
        scanState.cancelled = true;
        return true;
    }
    return false;
}

module.exports = { runScan, cancelScan };
