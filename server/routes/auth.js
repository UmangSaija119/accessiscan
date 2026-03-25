const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth');
const { validateEmail, validatePassword, sanitizeString } = require('../middleware/validator');
const { generateId } = require('../utils/helpers');
const db = require('../services/db');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const passwordCheck = validatePassword(password);
        if (!passwordCheck.valid) {
            return res.status(400).json({ error: passwordCheck.error });
        }

        // Check if email already exists
        const existing = db.getUserByEmail(email.trim().toLowerCase());
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        const id = generateId();
        const passwordHash = await bcrypt.hash(password, 12);
        const sanitizedName = sanitizeString(name || '');

        db.createUser(id, email.trim().toLowerCase(), passwordHash, sanitizedName);

        const user = { id, email: email.trim().toLowerCase() };
        const token = generateToken(user);

        res.status(201).json({
            message: 'Account created successfully',
            token,
            user: { id, email: user.email, name: sanitizedName }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = db.getUserByEmail(email.trim().toLowerCase());
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken({ id: user.id, email: user.email });

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email, name: user.name }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user
router.get('/me', require('../middleware/auth').authenticateToken, (req, res) => {
    try {
        const user = db.getUserById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
