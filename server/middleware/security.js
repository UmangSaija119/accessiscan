const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('../config');

function setupSecurity(app) {
    // Helmet for various HTTP security headers
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
                imgSrc: ["'self'", "data:", "blob:"],
                connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"]
            }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'same-origin' }
    }));

    // CORS
    app.use(cors({
        origin: config.allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // General API rate limiter
    const apiLimiter = rateLimit({
        windowMs: config.rateLimitWindow,
        max: config.rateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests. Please try again later.' },
        keyGenerator: (req) => req.ip
    });
    app.use('/api/', apiLimiter);

    // Strict rate limiter for scan endpoints
    const scanLimiter = rateLimit({
        windowMs: 60000, // 1 minute
        max: config.scanRateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many scan requests. Please wait before starting another scan.' },
        keyGenerator: (req) => req.ip
    });
    app.use('/api/scan', scanLimiter);

    // Auth rate limiter (prevent brute force)
    const authLimiter = rateLimit({
        windowMs: 900000, // 15 min
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many authentication attempts. Please try again later.' },
        keyGenerator: (req) => req.ip
    });
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', authLimiter);

    // Body size limit
    app.use(require('express').json({ limit: '10kb' }));
    app.use(require('express').urlencoded({ extended: false, limit: '10kb' }));

    // Remove X-Powered-By
    app.disable('x-powered-by');
}

module.exports = { setupSecurity };
