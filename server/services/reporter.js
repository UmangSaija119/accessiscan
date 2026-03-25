const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const { categorizeSeverity } = require('../utils/helpers');

// Brand colors
const COLORS = {
    brandGreen: '#00c48c',
    brandDark: '#0b1221',
    brandNavy: '#141e30',
    white: '#ffffff',
    textPrimary: '#1a1d2b',
    textSecondary: '#5a6478',
    textMuted: '#8892a4',
    critical: '#ef4444',
    serious: '#f59e0b',
    moderate: '#eab308',
    minor: '#22c55e',
    pass: '#00c48c',
    lightGray: '#f0f2f7',
    borderGray: '#e2e6ef'
};

function generatePdfReport(scan, pages) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                bufferPages: true,
                info: {
                    Title: `AccessiScan Report - ${scan.url}`,
                    Author: 'AccessiScan by Astound Digital',
                    Subject: 'WCAG Accessibility Audit Report',
                    Creator: 'AccessiScan v1.0'
                }
            });

            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const pageWidth = 495; // A4 width minus margins

            // ==========================================
            // COVER PAGE
            // ==========================================

            // Dark header bar
            doc.rect(0, 0, 595, 160).fill(COLORS.brandDark);
            doc.rect(0, 155, 595, 5).fill(COLORS.brandGreen);

            // Title on dark bg
            doc.fontSize(28).fillColor(COLORS.white).text('AccessiScan', 50, 50);
            doc.fontSize(10).fillColor(COLORS.brandGreen).text('BY ASTOUND DIGITAL', 50, 85);
            doc.fontSize(11).fillColor('#94a3b8').text('AI-Powered Accessibility Audit Report', 50, 110);

            // Score section
            doc.moveDown(4);
            const scoreY = 200;
            const scoreColor = scan.overall_score >= 80 ? COLORS.pass : scan.overall_score >= 50 ? COLORS.moderate : COLORS.critical;

            // Score circle (simulated with large text)
            doc.fontSize(72).fillColor(scoreColor).text(`${scan.overall_score}`, 50, scoreY, { align: 'center', width: pageWidth });
            doc.fontSize(14).fillColor(COLORS.textSecondary).text('Overall Accessibility Score', 50, scoreY + 80, { align: 'center', width: pageWidth });

            // Divider
            doc.moveTo(50, scoreY + 120).lineTo(545, scoreY + 120).strokeColor(COLORS.borderGray).lineWidth(1).stroke();

            // Meta info as structured table
            const metaY = scoreY + 140;
            doc.fontSize(10).fillColor(COLORS.textMuted);

            const metaItems = [
                ['Target URL', scan.url],
                ['WCAG Standard', scan.wcag_level.toUpperCase()],
                ['Pages Scanned', String(scan.pages_scanned || 0)],
                ['Scan Date', new Date(scan.started_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })]
            ];

            let metaOffset = metaY;
            for (const [label, value] of metaItems) {
                doc.fontSize(9).fillColor(COLORS.textMuted).text(label.toUpperCase(), 50, metaOffset, { width: 120 });
                doc.fontSize(10).fillColor(COLORS.textPrimary).text(value, 180, metaOffset, { width: 365 });
                metaOffset += 22;
            }

            // Stats boxes
            const boxY = metaOffset + 20;
            const boxW = (pageWidth - 30) / 4;

            // Box backgrounds
            const statsData = [
                { label: 'Violations', value: scan.total_violations || 0, color: COLORS.critical },
                { label: 'Passes', value: scan.total_passes || 0, color: COLORS.pass },
                { label: 'Incomplete', value: scan.total_incomplete || 0, color: COLORS.serious },
                { label: 'Pages', value: scan.pages_scanned || 0, color: '#6c5ce7' }
            ];

            statsData.forEach((stat, i) => {
                const x = 50 + i * (boxW + 10);
                doc.roundedRect(x, boxY, boxW, 70, 6).fill(COLORS.lightGray);
                doc.fontSize(24).fillColor(stat.color).text(String(stat.value), x, boxY + 12, { width: boxW, align: 'center' });
                doc.fontSize(8).fillColor(COLORS.textMuted).text(stat.label.toUpperCase(), x, boxY + 45, { width: boxW, align: 'center' });
            });

            // Severity breakdown
            const sevY = boxY + 95;
            doc.fontSize(12).fillColor(COLORS.textPrimary).text('Severity Breakdown', 50, sevY);
            doc.moveTo(50, sevY + 18).lineTo(545, sevY + 18).strokeColor(COLORS.borderGray).lineWidth(0.5).stroke();

            let sevOffset = sevY + 25;
            const severity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
            for (const page of pages) {
                try {
                    const results = JSON.parse(page.results_json || '{}');
                    for (const v of (results.violations || [])) {
                        severity[v.impact || 'minor'] = (severity[v.impact || 'minor'] || 0) + (v.nodes?.length || 1);
                    }
                } catch { }
            }

            const sevItems = [
                { label: 'Critical', count: severity.critical, color: COLORS.critical },
                { label: 'Serious', count: severity.serious, color: COLORS.serious },
                { label: 'Moderate', count: severity.moderate, color: COLORS.moderate },
                { label: 'Minor', count: severity.minor, color: COLORS.minor }
            ];

            for (const item of sevItems) {
                const barWidth = Math.min((item.count / Math.max(scan.total_violations, 1)) * 300, 300);
                doc.roundedRect(50, sevOffset, 300, 14, 3).fill(COLORS.lightGray);
                if (barWidth > 0) doc.roundedRect(50, sevOffset, barWidth, 14, 3).fill(item.color);
                doc.fontSize(9).fillColor(COLORS.textPrimary).text(`${item.label}: ${item.count}`, 370, sevOffset + 1);
                sevOffset += 22;
            }

            // ==========================================
            // PER-PAGE RESULTS
            // ==========================================
            for (const page of pages) {
                doc.addPage();
                let results;
                try { results = JSON.parse(page.results_json); } catch { continue; }

                // Dark page header
                doc.rect(0, 0, 595, 80).fill(COLORS.brandDark);
                doc.rect(0, 75, 595, 4).fill(COLORS.brandGreen);

                doc.fontSize(14).fillColor(COLORS.white).text(page.title || 'Untitled Page', 50, 25, { width: pageWidth - 80 });
                doc.fontSize(8).fillColor('#94a3b8').text(page.url, 50, 50, { width: pageWidth - 80 });

                // Page score
                const pScoreColor = page.score >= 80 ? COLORS.pass : page.score >= 50 ? COLORS.moderate : COLORS.critical;
                doc.fontSize(20).fillColor(pScoreColor).text(`${page.score}`, 490, 25, { width: 55, align: 'right' });
                doc.fontSize(7).fillColor('#94a3b8').text('/100', 490, 50, { width: 55, align: 'right' });

                let yPos = 100;

                // Violations
                if (results.violations && results.violations.length > 0) {
                    doc.fontSize(13).fillColor(COLORS.critical).text(`⚠ Violations (${results.violations.length})`, 50, yPos);
                    yPos += 22;

                    for (const violation of results.violations.slice(0, 20)) {
                        if (yPos > 720) { doc.addPage(); yPos = 50; }

                        const sev = categorizeSeverity(violation.impact);

                        // Violation card
                        doc.roundedRect(50, yPos, pageWidth, 2, 1).fill(sev.color);
                        doc.roundedRect(50, yPos + 2, pageWidth, 0.5, 0).fill(COLORS.borderGray);

                        yPos += 8;
                        // Severity badge + title
                        doc.fontSize(9).fillColor(sev.color).text(`[${sev.label.toUpperCase()}]`, 50, yPos, { continued: true });
                        doc.fillColor(COLORS.textPrimary).text(` ${violation.help}`, { continued: false });
                        yPos += 14;

                        doc.fontSize(8).fillColor(COLORS.textSecondary).text(violation.description, 50, yPos, { width: pageWidth });
                        yPos += doc.heightOfString(violation.description, { width: pageWidth, fontSize: 8 }) + 4;

                        // Affected elements
                        if (violation.nodes && violation.nodes.length > 0) {
                            for (const node of violation.nodes.slice(0, 3)) {
                                if (yPos > 720) { doc.addPage(); yPos = 50; }

                                if (node.html) {
                                    doc.roundedRect(55, yPos, pageWidth - 10, 0, 0);
                                    doc.fontSize(7).fillColor('#c73455').text(`Element: ${node.html.slice(0, 200)}`, 60, yPos, { width: pageWidth - 20 });
                                    yPos += doc.heightOfString(`Element: ${node.html.slice(0, 200)}`, { width: pageWidth - 20, fontSize: 7 }) + 2;
                                }
                                if (node.failureSummary) {
                                    doc.fontSize(7).fillColor(COLORS.pass).text(`Fix: ${node.failureSummary.slice(0, 250)}`, 60, yPos, { width: pageWidth - 20 });
                                    yPos += doc.heightOfString(`Fix: ${node.failureSummary.slice(0, 250)}`, { width: pageWidth - 20, fontSize: 7 }) + 2;
                                }
                                if (node.target && node.target.length) {
                                    const selector = Array.isArray(node.target) ? node.target.join(' > ') : String(node.target);
                                    doc.fontSize(6).fillColor(COLORS.textMuted).text(`Selector: ${selector.slice(0, 200)}`, 60, yPos, { width: pageWidth - 20 });
                                    yPos += 10;
                                }
                            }
                            if (violation.nodes.length > 3) {
                                doc.fontSize(7).fillColor(COLORS.textMuted).text(`... and ${violation.nodes.length - 3} more elements`, 60, yPos);
                                yPos += 12;
                            }
                        }

                        // WCAG tags
                        const wcagTags = (violation.tags || []).filter(t => t.startsWith('wcag')).slice(0, 4);
                        if (wcagTags.length > 0) {
                            doc.fontSize(6).fillColor(COLORS.textMuted).text(`WCAG: ${wcagTags.join(', ')}`, 50, yPos);
                            yPos += 10;
                        }

                        yPos += 10;
                    }
                }

                // Passes
                if (results.passes && results.passes.length > 0) {
                    if (yPos > 680) { doc.addPage(); yPos = 50; }
                    doc.fontSize(13).fillColor(COLORS.pass).text(`✓ Passes (${results.passes.length})`, 50, yPos);
                    yPos += 22;

                    doc.fontSize(8).fillColor(COLORS.textSecondary);
                    for (const pass of results.passes.slice(0, 15)) {
                        if (yPos > 730) { doc.addPage(); yPos = 50; }
                        doc.text(`✓  ${pass.help}`, 55, yPos, { width: pageWidth - 10 });
                        yPos += 14;
                    }
                    if (results.passes.length > 15) {
                        doc.fillColor(COLORS.textMuted).text(`... and ${results.passes.length - 15} more passes`, 55, yPos);
                    }
                }
            }

            // ==========================================
            // FOOTER ON EVERY PAGE
            // ==========================================
            const totalPages = doc.bufferedPageRange().count;
            for (let i = 0; i < totalPages; i++) {
                doc.switchToPage(i);
                // Footer bar
                doc.rect(0, 810, 595, 30).fill(COLORS.brandDark);
                doc.fontSize(7).fillColor('#94a3b8');
                doc.text(`AccessiScan by Astound Digital  |  Page ${i + 1} of ${totalPages}  |  Generated ${new Date().toISOString().split('T')[0]}`, 50, 816, { align: 'center', width: pageWidth });
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
