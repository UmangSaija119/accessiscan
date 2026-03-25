const { URL } = require('url');
const dns = require('dns');
const net = require('net');

// Private/reserved IP ranges that must be blocked
const PRIVATE_RANGES = [
    { start: '10.0.0.0', end: '10.255.255.255' },
    { start: '172.16.0.0', end: '172.31.255.255' },
    { start: '192.168.0.0', end: '192.168.255.255' },
    { start: '127.0.0.0', end: '127.255.255.255' },
    { start: '169.254.0.0', end: '169.254.255.255' }, // Link-local & cloud metadata
    { start: '0.0.0.0', end: '0.255.255.255' }
];

const BLOCKED_HOSTNAMES = [
    'localhost',
    'metadata.google.internal',
    'metadata.azure.com',
    'instance-data.ec2.internal'
];

function ipToLong(ip) {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isPrivateIP(ip) {
    if (net.isIPv6(ip)) {
        // Block IPv6 loopback
        return ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd');
    }

    if (!net.isIPv4(ip)) return true; // Block unknown formats

    const ipLong = ipToLong(ip);
    return PRIVATE_RANGES.some(range => {
        const startLong = ipToLong(range.start);
        const endLong = ipToLong(range.end);
        return ipLong >= startLong && ipLong <= endLong;
    });
}

async function resolveHostname(hostname) {
    return new Promise((resolve, reject) => {
        dns.resolve4(hostname, (err, addresses) => {
            if (err) {
                // Try resolve6
                dns.resolve6(hostname, (err6, addresses6) => {
                    if (err6) reject(new Error(`Cannot resolve hostname: ${hostname}`));
                    else resolve(addresses6);
                });
            } else {
                resolve(addresses);
            }
        });
    });
}

async function validateUrlSafe(urlString) {
    let parsed;
    try {
        parsed = new URL(urlString);
    } catch {
        throw new Error('Invalid URL format');
    }

    // Protocol check
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only HTTP/HTTPS protocols are allowed');
    }

    // Block credentials in URL
    if (parsed.username || parsed.password) {
        throw new Error('URLs with credentials are not allowed');
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block known dangerous hostnames
    if (BLOCKED_HOSTNAMES.some(b => hostname === b || hostname.endsWith('.' + b))) {
        throw new Error('Access to internal hosts is not allowed');
    }

    // If hostname is an IP, check directly
    if (net.isIP(hostname)) {
        if (isPrivateIP(hostname)) {
            throw new Error('Access to private/internal IP addresses is not allowed');
        }
        return parsed.href;
    }

    // DNS resolution check (prevent DNS rebinding)
    try {
        const addresses = await resolveHostname(hostname);
        for (const addr of addresses) {
            if (isPrivateIP(addr)) {
                throw new Error('URL resolves to a private/internal IP address');
            }
        }
    } catch (err) {
        if (err.message.includes('private') || err.message.includes('internal')) {
            throw err;
        }
        throw new Error(`Cannot resolve hostname: ${hostname}`);
    }

    return parsed.href;
}

module.exports = { validateUrlSafe, isPrivateIP };
