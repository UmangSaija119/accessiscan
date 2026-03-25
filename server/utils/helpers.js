function formatDate(date) {
    return new Date(date).toISOString();
}

function generateId() {
    return require('uuid').v4();
}

function calculateScore(violations, passes) {
    const total = violations + passes;
    if (total === 0) return 100;
    return Math.round((passes / total) * 100);
}

function categorizeSeverity(impact) {
    const map = {
        'critical': { level: 4, label: 'Critical', color: '#ef4444' },
        'serious': { level: 3, label: 'Serious', color: '#f97316' },
        'moderate': { level: 2, label: 'Moderate', color: '#eab308' },
        'minor': { level: 1, label: 'Minor', color: '#22c55e' }
    };
    return map[impact] || map['minor'];
}

function truncate(str, maxLen = 200) {
    if (!str || str.length <= maxLen) return str;
    return str.slice(0, maxLen) + '...';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { formatDate, generateId, calculateScore, categorizeSeverity, truncate, sleep };
