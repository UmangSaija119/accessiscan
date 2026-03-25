function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/[<>]/g, '');
}

function validateUrl(url) {
    if (typeof url !== 'string') return { valid: false, error: 'URL must be a string' };

    url = url.trim();

    if (!url) return { valid: false, error: 'URL is required' };
    if (url.length > 2048) return { valid: false, error: 'URL too long' };

    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
        }
        if (parsed.username || parsed.password) {
            return { valid: false, error: 'URLs with credentials are not allowed' };
        }
        return { valid: true, url: parsed.href };
    } catch {
        return { valid: false, error: 'Invalid URL format' };
    }
}

function validateEmail(email) {
    if (typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim()) && email.length <= 254;
}

function validatePassword(password) {
    if (typeof password !== 'string') return { valid: false, error: 'Password is required' };
    if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
    if (password.length > 128) return { valid: false, error: 'Password too long' };
    return { valid: true };
}

function validateWcagLevel(level) {
    const allowed = ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa', 'wcag22aa'];
    return allowed.includes(level);
}

module.exports = { sanitizeString, validateUrl, validateEmail, validatePassword, validateWcagLevel };
