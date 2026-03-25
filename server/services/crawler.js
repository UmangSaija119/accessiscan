const { URL } = require('url');
const { validateUrlSafe } = require('../utils/ssrf-guard');

async function discoverPages(baseUrl, maxPages = 20) {
    const puppeteer = require('puppeteer');
    const discovered = new Set();
    const baseUrlObj = new URL(baseUrl);
    const baseDomain = baseUrlObj.hostname;

    discovered.add(baseUrlObj.href);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        // 1. Try sitemap.xml first
        const sitemapUrls = await trySitemap(browser, baseUrlObj.origin);
        for (const url of sitemapUrls) {
            if (discovered.size >= maxPages) break;
            try {
                const parsed = new URL(url);
                if (parsed.hostname === baseDomain) {
                    discovered.add(parsed.origin + parsed.pathname);
                }
            } catch { /* skip invalid */ }
        }

        // 2. If not enough from sitemap, crawl homepage for links
        if (discovered.size < maxPages) {
            const page = await browser.newPage();
            await page.setUserAgent('AccessiScan/1.0 Accessibility Testing Bot');

            try {
                await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

                const links = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('a[href]'))
                        .map(a => a.href)
                        .filter(href => href.startsWith('http'));
                });

                for (const link of links) {
                    if (discovered.size >= maxPages) break;
                    try {
                        const parsed = new URL(link);
                        if (parsed.hostname === baseDomain) {
                            // Skip anchors, query params variations, common non-page paths
                            const cleanUrl = parsed.origin + parsed.pathname;
                            if (!shouldSkipUrl(cleanUrl)) {
                                discovered.add(cleanUrl);
                            }
                        }
                    } catch { /* skip invalid */ }
                }
            } finally {
                await page.close();
            }
        }

        await browser.close();
    } catch (err) {
        if (browser) await browser.close().catch(() => { });
        throw err;
    }

    // Validate all discovered URLs against SSRF
    const safeUrls = [];
    for (const url of discovered) {
        try {
            await validateUrlSafe(url);
            safeUrls.push(url);
        } catch { /* skip unsafe URLs */ }
    }

    // Prioritize important pages
    return prioritizePages(safeUrls);
}

async function trySitemap(browser, origin) {
    const urls = [];
    const page = await browser.newPage();

    try {
        const sitemapUrl = `${origin}/sitemap.xml`;
        const response = await page.goto(sitemapUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

        if (response && response.ok()) {
            const content = await page.content();
            // Extract URLs from sitemap XML
            const matches = content.match(/<loc>([^<]+)<\/loc>/gi);
            if (matches) {
                for (const match of matches) {
                    const url = match.replace(/<\/?loc>/gi, '').trim();
                    if (url.startsWith('http')) urls.push(url);
                }
            }
        }
    } catch {
        // Sitemap not available
    } finally {
        await page.close();
    }

    return urls;
}

function shouldSkipUrl(url) {
    const skipPatterns = [
        /\.(pdf|zip|png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot|mp3|mp4|avi)$/i,
        /\/(wp-admin|wp-content|wp-includes|admin|api|feed|rss)/i,
        /#/,
        /\?/,
        /\/tag\//i,
        /\/category\//i,
        /\/page\/\d+/i,
        /\/author\//i,
        /\/search/i,
        /\/login/i,
        /\/register/i,
        /\/cart/i,
        /\/checkout/i,
        /\/account/i,
        /\/cdn-cgi/i
    ];

    return skipPatterns.some(p => p.test(url));
}

function prioritizePages(urls) {
    const priorityPatterns = [
        { pattern: /^\/$|\/index\.(html|htm|php)$/i, weight: 10 },      // Homepage
        { pattern: /\/(about|about-us)/i, weight: 9 },
        { pattern: /\/(contact|contact-us)/i, weight: 8 },
        { pattern: /\/(services|products|features)/i, weight: 7 },
        { pattern: /\/(pricing|plans)/i, weight: 6 },
        { pattern: /\/(blog|news)$/i, weight: 5 },
        { pattern: /\/(faq|help|support)/i, weight: 4 },
        { pattern: /\/(privacy|terms|legal)/i, weight: 3 }
    ];

    return urls.sort((a, b) => {
        const aPath = new URL(a).pathname;
        const bPath = new URL(b).pathname;
        let aWeight = 0, bWeight = 0;

        for (const { pattern, weight } of priorityPatterns) {
            if (pattern.test(aPath)) aWeight = Math.max(aWeight, weight);
            if (pattern.test(bPath)) bWeight = Math.max(bWeight, weight);
        }

        return bWeight - aWeight;
    });
}

module.exports = { discoverPages };
