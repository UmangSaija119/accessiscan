const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const { categorizeSeverity } = require('../utils/helpers');

const COLORS = {
    brandGreen: '#00c48c', brandDark: '#0b1221', brandNavy: '#141e30',
    white: '#ffffff', textPrimary: '#1a1d2b', textSecondary: '#5a6478',
    textMuted: '#8892a4', critical: '#ef4444', serious: '#f59e0b',
    moderate: '#eab308', minor: '#22c55e', pass: '#00c48c',
    lightGray: '#f0f2f7', borderGray: '#e2e6ef'
};

function generatePdfReport(scan, pages) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                bufferPages: true,
                info: { Title: `AccessiScan Report - ${scan.url}` }
            });

            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // Register font for bold/regular
            doc.registerFont('Bold', 'Helvetica-Bold');
            doc.registerFont('Regular', 'Helvetica');

            // --- COVER PAGE ---
            doc.rect(0, 0, 595, 120).fill(COLORS.brandDark);
            doc.rect(0, 115, 595, 5).fill(COLORS.brandGreen);

            doc.font('Bold').fontSize(26).fillColor(COLORS.white).text('AccessiScan', 50, 40);
            doc.font('Regular').fontSize(10).fillColor(COLORS.brandGreen).text('BY ASTOUND DIGITAL');
            doc.moveDown(0.2).fontSize(11).fillColor('#94a3b8').text('AI-Powered Accessibility Audit Report');

            doc.x = 50;
            doc.y = 160;

            // Score
            const sColor = scan.overall_score >= 80 ? COLORS.pass : scan.overall_score >= 50 ? COLORS.moderate : COLORS.critical;
            doc.font('Bold').fontSize(64).fillColor(sColor).text(`${scan.overall_score}`, { align: 'center' });
            doc.font('Regular').fontSize(14).fillColor(COLORS.textSecondary).text('Overall Accessibility Score', { align: 'center' });
            doc.moveDown(1.5);

            // Divider
            doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(COLORS.borderGray).lineWidth(1).stroke();
            doc.moveDown(1.5);

            // Meta info
            doc.font('Bold').fontSize(14).fillColor(COLORS.textPrimary).text('Scan Details');
            doc.moveDown(0.5);
            doc.font('Regular').fontSize(10).fillColor(COLORS.textSecondary);
            doc.text(`Target URL: ${scan.url}`);
            doc.text(`WCAG Standard: ${scan.wcag_level.toUpperCase()}`);
            doc.text(`Pages Scanned: ${scan.pages_scanned || 1}`);
            doc.text(`Scan Date: ${new Date(scan.started_at).toLocaleString()}`);
            doc.moveDown(2);

            // Stats
            doc.font('Bold').fontSize(14).fillColor(COLORS.textPrimary).text('Executive Summary');
            doc.moveDown(0.5);
            doc.font('Regular').fontSize(10).fillColor(COLORS.pass).text(`Total Passes: ${scan.total_passes}`);
            doc.fillColor(COLORS.critical).text(`Total Violations: ${scan.total_violations}`);
            doc.fillColor(COLORS.serious).text(`Incomplete / Needs Review: ${scan.total_incomplete}`);

            // --- RESULTS BY PAGE ---
            for (const page of pages) {
                doc.addPage();
                let results = {};
                try { results = JSON.parse(page.results_json || '{}'); } catch { }

                doc.rect(0, 0, 595, 80).fill(COLORS.brandNavy);
                doc.rect(0, 75, 595, 5).fill(COLORS.brandGreen);

                doc.font('Bold').fontSize(14).fillColor(COLORS.white).text(page.title || 'Untitled Page', 50, 30, { width: 440 });
                doc.font('Regular').fontSize(9).fillColor('#94a3b8').text(page.url, { width: 440 });

                doc.x = 50;
                doc.y = 110;

                // Score
                const pScoreColor = page.score >= 80 ? COLORS.pass : page.score >= 50 ? COLORS.moderate : COLORS.critical;
                doc.font('Bold').fontSize(18).fillColor(pScoreColor).text(`Page Score: ${page.score}/100`);
                doc.moveDown(1);

                if (results.violations && results.violations.length > 0) {
                    doc.font('Bold').fontSize(14).fillColor(COLORS.critical).text(`Violations Found (${results.violations.length})`);
                    doc.moveDown(0.5);

                    for (const v of results.violations) {
                        const sev = categorizeSeverity(v.impact);

                        // Background rect for the violation title
                        const currentY = doc.y;
                        doc.rect(50, currentY - 5, 495, 20).fill(COLORS.lightGray);

                        doc.font('Bold').fontSize(10).fillColor(sev.color).text(`[${sev.label.toUpperCase()}] `, 55, currentY, { continued: true });
                        doc.fillColor(COLORS.textPrimary).text(v.help);

                        doc.x = 55;
                        doc.moveDown(0.3);
                        doc.font('Regular').fontSize(9).fillColor(COLORS.textSecondary).text(v.description, { width: 485 });
                        doc.moveDown(0.3);

                        if (v.nodes && v.nodes.length > 0) {
                            const elementsToShow = v.nodes.slice(0, 3);
                            for (const node of elementsToShow) {
                                doc.font('Bold').fontSize(8).fillColor(COLORS.textPrimary).text('Element: ', { continued: true });
                                doc.font('Regular').fillColor(COLORS.critical).text(node.html ? node.html.replace(/\s+/g, ' ').trim() : 'N/A', { continued: false });

                                if (node.failureSummary) {
                                    doc.font('Bold').fillColor(COLORS.textPrimary).text('Fix: ', { continued: true });
                                    doc.font('Regular').fillColor(COLORS.pass).text(node.failureSummary.replace(/\n+/g, ' | '));
                                }
                                doc.moveDown(0.5);
                            }
                            if (v.nodes.length > 3) {
                                doc.fontSize(8).fillColor(COLORS.textMuted).text(`... and ${v.nodes.length - 3} more elements affected.`);
                                doc.moveDown(0.5);
                            }
                        }
                        doc.moveDown(0.5);
                    }
                }

                if (results.passes && results.passes.length > 0) {
                    doc.moveDown(1);
                    doc.font('Bold').fontSize(14).fillColor(COLORS.pass).text(`Passes (${results.passes.length})`);
                    doc.moveDown(0.5);
                    doc.font('Regular').fontSize(9).fillColor(COLORS.textSecondary);

                    const passesToShow = results.passes.slice(0, 15);
                    for (const pass of passesToShow) {
                        doc.text(`✓ ${pass.help}`);
                    }
                    if (results.passes.length > 15) {
                        doc.text(`... and ${results.passes.length - 15} more passes.`);
                    }
                }
            }

            // Add footer
            const totalPages = doc.bufferedPageRange().count;
            for (let i = 0; i < totalPages; i++) {
                doc.switchToPage(i);
                doc.rect(0, 810, 595, 32).fill(COLORS.brandDark);
                doc.font('Regular').fontSize(8).fillColor(COLORS.textMuted);
                doc.text(`AccessiScan by Astound Digital  |  Page ${i + 1} of ${totalPages}  |  Generated ${new Date().toISOString().split('T')[0]}`, 50, 820, { align: 'center', width: 495 });
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

function generateCsvReport(scan, pages) {
    const rows = [];
    for (const page of pages) {
        let results;
        try { results = JSON.parse(page.results_json); } catch { continue; }
        if (results.violations) {
            for (const violation of results.violations) {
                const severity = categorizeSeverity(violation.impact);
                for (const node of (violation.nodes || []).slice(0, 50)) {
                    rows.push({
                        'Page URL': page.url,
                        'Page Title': page.title,
                        'Page Score': page.score,
                        'Rule ID': violation.id,
                        'Severity': severity.label,
                        'Impact': violation.impact,
                        'Description': violation.help,
                        'Element': node.html?.slice(0, 300) || '',
                        'Selector': Array.isArray(node.target) ? node.target.join(' > ') : '',
                        'Fix Suggestion': node.failureSummary?.slice(0, 500) || '',
                        'Help URL': violation.helpUrl || '',
                        'WCAG Tags': (violation.tags || []).filter(t => t.startsWith('wcag')).join(', ')
                    });
                }
            }
        }
    }
    if (rows.length === 0) rows.push({ 'Message': 'No violations found — all checks passed!' });
    const parser = new Parser({ fields: Object.keys(rows[0]) });
    return parser.parse(rows);
}

module.exports = { generatePdfReport, generateCsvReport };
