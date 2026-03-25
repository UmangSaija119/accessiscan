const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../services/db');
const { generatePdfReport, generateCsvReport } = require('../services/reporter');
const { generateJiraBugReports, generateExecutiveSummary } = require('../services/ai');

const router = express.Router();

// Get full report for a scan
router.get('/:scanId', authenticateToken, async (req, res) => {
    try {
        const scan = db.getScanById(req.params.scanId);
        if (!scan || scan.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const pages = db.getScanPages(req.params.scanId);

        // Parse page results
        const parsedPages = pages.map(page => ({
            ...page,
            results: safeJsonParse(page.results_json)
        }));

        // Build summary by category
        const summary = buildSummary(parsedPages);

        // Generate AI executive summary
        let executiveSummary = null;
        try {
            executiveSummary = await generateExecutiveSummary(scan, pages);
        } catch (err) {
            console.error('AI summary generation failed:', err.message);
        }

        // Generate Jira bug reports for all violations across all pages
        let jiraBugs = [];
        try {
            for (const page of parsedPages) {
                if (page.results?.violations && page.results.violations.length > 0) {
                    const bugs = await generateJiraBugReports(
                        page.results.violations,
                        page.url,
                        page.title,
                        scan.wcag_level,
                        scan.started_at
                    );
                    jiraBugs.push(...bugs);
                }
            }
        } catch (err) {
            console.error('Jira bug generation failed:', err.message);
        }

        res.json({
            scan,
            pages: parsedPages.map(p => ({
                id: p.id,
                url: p.url,
                title: p.title,
                score: p.score,
                violationsCount: p.violations_count,
                passesCount: p.passes_count,
                incompleteCount: p.incomplete_count,
                results: p.results
            })),
            summary,
            executiveSummary,
            jiraBugs
        });
    } catch (err) {
        console.error('Get report error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download PDF report
router.get('/:scanId/pdf', authenticateToken, async (req, res) => {
    try {
        const scan = db.getScanById(req.params.scanId);
        if (!scan || scan.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Report not found' });
        }

        if (scan.status !== 'completed') {
            return res.status(400).json({ error: 'Scan is not yet completed' });
        }

        const pages = db.getScanPages(req.params.scanId);
        const pdfBuffer = await generatePdfReport(scan, pages);

        const filename = `accessiscan-report-${new Date(scan.started_at).toISOString().split('T')[0]}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('PDF generation error:', err);
        res.status(500).json({ error: 'Failed to generate PDF report' });
    }
});

// Download CSV report
router.get('/:scanId/csv', authenticateToken, (req, res) => {
    try {
        const scan = db.getScanById(req.params.scanId);
        if (!scan || scan.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Report not found' });
        }

        if (scan.status !== 'completed') {
            return res.status(400).json({ error: 'Scan is not yet completed' });
        }

        const pages = db.getScanPages(req.params.scanId);
        const csvContent = generateCsvReport(scan, pages);

        const filename = `accessiscan-report-${new Date(scan.started_at).toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);
    } catch (err) {
        console.error('CSV generation error:', err);
        res.status(500).json({ error: 'Failed to generate CSV report' });
    }
});

// Compare two scans
router.get('/:scanId/compare/:otherId', authenticateToken, (req, res) => {
    try {
        const scan1 = db.getScanById(req.params.scanId);
        const scan2 = db.getScanById(req.params.otherId);

        if (!scan1 || scan1.user_id !== req.user.id || !scan2 || scan2.user_id !== req.user.id) {
            return res.status(404).json({ error: 'One or both scans not found' });
        }

        res.json({
            comparison: {
                scan1: { id: scan1.id, url: scan1.url, score: scan1.overall_score, violations: scan1.total_violations, passes: scan1.total_passes, date: scan1.started_at, pagesScanned: scan1.pages_scanned },
                scan2: { id: scan2.id, url: scan2.url, score: scan2.overall_score, violations: scan2.total_violations, passes: scan2.total_passes, date: scan2.started_at, pagesScanned: scan2.pages_scanned },
                scoreDiff: scan2.overall_score - scan1.overall_score,
                violationsDiff: scan2.total_violations - scan1.total_violations,
                improved: scan2.overall_score > scan1.overall_score
            }
        });
    } catch (err) {
        console.error('Compare error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function safeJsonParse(str) {
    try { return JSON.parse(str || '{}'); } catch { return {}; }
}

function buildSummary(pages) {
    const categories = {};
    let totalViolationNodes = 0;

    for (const page of pages) {
        if (!page.results?.violations) continue;
        for (const violation of page.results.violations) {
            const tags = violation.tags || [];
            for (const tag of tags) {
                if (tag.startsWith('wcag')) {
                    if (!categories[tag]) categories[tag] = { count: 0, rules: new Set() };
                    categories[tag].count += (violation.nodes?.length || 1);
                    categories[tag].rules.add(violation.id);
                }
            }
            totalViolationNodes += (violation.nodes?.length || 1);
        }
    }

    for (const key of Object.keys(categories)) {
        categories[key].rules = Array.from(categories[key].rules);
    }

    return { byWcag: categories, totalViolationNodes, bySeverity: buildSeveritySummary(pages) };
}

function buildSeveritySummary(pages) {
    const severity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const page of pages) {
        if (!page.results?.violations) continue;
        for (const violation of page.results.violations) {
            const impact = violation.impact || 'minor';
            severity[impact] = (severity[impact] || 0) + (violation.nodes?.length || 1);
        }
    }
    return severity;
}

module.exports = router;
