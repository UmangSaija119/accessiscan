const mongoose = require('mongoose');

// ==========================================
// Mongoose Schemas
// ==========================================

const UserSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // We use custom UUIDs
    email: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    name: { type: String, default: '' },
    role: { type: String, default: 'user' }, // New Admin feature
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const ScanSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    user_id: { type: String, ref: 'User', required: true, index: true },
    url: { type: String, required: true },
    status: { type: String, default: 'pending', index: true },
    wcag_level: { type: String, default: 'wcag2aa' },
    max_pages: { type: Number, default: 20 },
    overall_score: { type: Number, default: 0 },
    total_violations: { type: Number, default: 0 },
    total_passes: { type: Number, default: 0 },
    total_incomplete: { type: Number, default: 0 },
    total_inapplicable: { type: Number, default: 0 },
    pages_scanned: { type: Number, default: 0 },
    pages_total: { type: Number, default: 0 },
    started_at: { type: Date, default: Date.now },
    completed_at: { type: Date },
    error_message: { type: String },
    config_json: { type: String, default: '{}' }
});

const ScanPageSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    scan_id: { type: String, ref: 'Scan', required: true, index: true },
    url: { type: String, required: true },
    title: { type: String, default: '' },
    score: { type: Number, default: 0 },
    violations_count: { type: Number, default: 0 },
    passes_count: { type: Number, default: 0 },
    incomplete_count: { type: Number, default: 0 },
    inapplicable_count: { type: Number, default: 0 },
    screenshot_path: { type: String },
    results_json: { type: String, default: '{}' },
    scanned_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Scan = mongoose.model('Scan', ScanSchema);
const ScanPage = mongoose.model('ScanPage', ScanPageSchema);

// ==========================================
// Connection Logic (Fallback to Memory if no URI)
// ==========================================

async function getDb() {
    if (mongoose.connection.readyState === 1) return mongoose.connection;
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.warn('⚠️ No MONGODB_URI found. You must set this to a MongoDB Atlas URL to use AccessiScan.');
        return null;
    }

    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB Atlas');
        return mongoose.connection;
    } catch (err) {
        console.error('❌ Failed to connect to MongoDB Atlas. Please ensure you whitelisted IP 0.0.0.0/0 in your Network Access settings.', err.message);
    }
}

async function closeDb() {
    await mongoose.connection.close();
}

/** 
 * Map _id to id so legacy code keeps working.
 * Mongoose returns objects with _id. This helper flattens to plain JSON and remaps _id.
 */
function mapDoc(doc) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    obj.id = obj._id;
    delete obj._id;
    delete obj.__v;
    return obj;
}

// ==========================================
// User Operations
// ==========================================

async function createUser(id, email, passwordHash, name) {
    const isFirstUser = (await User.countDocuments()) === 0;
    const user = new User({
        _id: id,
        email,
        password_hash: passwordHash,
        name: name || '',
        role: isFirstUser ? 'admin' : 'user' // First registered user is admin!
    });
    return mapDoc(await user.save());
}

async function getUserByEmail(email) {
    return mapDoc(await User.findOne({ email }));
}

async function getUserById(id) {
    return mapDoc(await User.findOne({ _id: id }));
}

// ==========================================
// Scan Operations
// ==========================================

async function createScan(id, userId, url, wcagLevel, maxPages) {
    const scan = new Scan({
        _id: id,
        user_id: userId,
        url,
        wcag_level: wcagLevel || 'wcag2aa',
        max_pages: maxPages || 20
    });
    return mapDoc(await scan.save());
}

async function updateScanStatus(scanId, status, extra = {}) {
    const update = { status, ...extra };
    return mapDoc(await Scan.findOneAndUpdate({ _id: scanId }, { $set: update }, { new: true }));
}

async function getScanById(scanId) {
    return mapDoc(await Scan.findOne({ _id: scanId }));
}

async function getUserScans(userId, limit = 50, offset = 0) {
    const scans = await Scan.find({ user_id: userId })
        .sort({ started_at: -1 })
        .skip(offset)
        .limit(limit);
    return scans.map(mapDoc);
}

async function getUserScanCount(userId) {
    return await Scan.countDocuments({ user_id: userId });
}

async function deleteScan(scanId, userId) {
    await Scan.findOneAndDelete({ _id: scanId, user_id: userId });
    await ScanPage.deleteMany({ scan_id: scanId });
    return true;
}

// ==========================================
// Scan Page Operations
// ==========================================

async function createScanPage(id, scanId, url, title, score, results) {
    const page = new ScanPage({
        _id: id,
        scan_id: scanId,
        url,
        title,
        score,
        violations_count: results.violations?.length || 0,
        passes_count: results.passes?.length || 0,
        incomplete_count: results.incomplete?.length || 0,
        inapplicable_count: results.inapplicable?.length || 0,
        results_json: JSON.stringify(results)
    });
    return mapDoc(await page.save());
}

async function getScanPages(scanId) {
    const pages = await ScanPage.find({ scan_id: scanId }).sort({ scanned_at: 1 });
    return pages.map(mapDoc);
}

// ==========================================
// Dashboard Stats Operations
// ==========================================

async function getDashboardStats(userId) {
    const totalScans = await Scan.countDocuments({ user_id: userId });
    const completedScans = await Scan.countDocuments({ user_id: userId, status: 'completed' });

    // Aggregate average score and total violations
    const aggregate = await Scan.aggregate([
        { $match: { user_id: userId, status: 'completed' } },
        {
            $group: {
                _id: null,
                avgScore: { $avg: '$overall_score' },
                totalViolations: { $sum: '$total_violations' }
            }
        }
    ]);

    const statsResult = aggregate[0] || { avgScore: 0, totalViolations: 0 };

    const recentScansResult = await Scan.find({ user_id: userId })
        .sort({ started_at: -1 })
        .limit(5);

    return {
        totalScans,
        completedScans,
        avgScore: Math.round(statsResult.avgScore),
        recentScans: recentScansResult.map(mapDoc),
        totalViolations: statsResult.totalViolations
    };
}

async function getSeverityBreakdown(userId) {
    const latestScan = await Scan.findOne({ user_id: userId, status: 'completed' })
        .sort({ started_at: -1 });

    const severity = { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0 };
    if (!latestScan) return severity;

    const pages = await ScanPage.find({ scan_id: latestScan._id });

    for (const page of pages) {
        try {
            const results = JSON.parse(page.results_json || '{}');
            if (results.violations) {
                for (const v of results.violations) {
                    const impact = v.impact || 'minor';
                    severity[impact] = (severity[impact] || 0) + (v.nodes?.length || 1);
                }
            }
            if (results.passes) {
                severity.passes += results.passes.length;
            }
        } catch { }
    }
    return severity;
}

// Admin Operations (New)
async function getAllUsers() {
    const users = await User.find().sort({ created_at: -1 });
    return users.map(u => {
        const doc = mapDoc(u);
        delete doc.password_hash; // Never send hash to admin
        return doc;
    });
}

function getModels() {
    return { User, Scan, ScanPage };
}

module.exports = {
    getDb, closeDb, getModels,
    createUser, getUserByEmail, getUserById,
    createScan, updateScanStatus, getScanById, getUserScans, getUserScanCount, deleteScan,
    createScanPage, getScanPages,
    getDashboardStats, getSeverityBreakdown,
    getAllUsers // For Admin
};
