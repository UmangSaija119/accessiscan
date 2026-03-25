const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Changes the cache location for Puppeteer so it downloads Chrome inside the local project folder.
    // This is required for Render deployments, because Render discards the global home directory cache.
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
