// ================================================
// HM EARN PRO - HIGH SECURITY BACKEND SERVER
// ================================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();

// ================================================
// SECURITY MIDDLEWARE
// ================================================

app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { error: 'Too many requests, please try again later.' }
});

const postbackLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30, // Postback endpoints have lower limit
    message: { error: 'Postback rate limit exceeded' }
});

app.use('/api/', apiLimiter);
app.use('/api/postback/', postbackLimiter);

// ================================================
// DATABASE MODELS
// ================================================

// User Schema
const userSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    balance: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    tasksCompleted: { type: Number, default: 0 },
    adsWatched: { type: Number, default: 0 },
    surveysCompleted: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    withdrawals: { type: Number, default: 0 },
    deviceFingerprint: { type: String },
    ipAddresses: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String }
});

// Transaction Schema
const transactionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, enum: ['ad', 'survey', 'game', 'withdrawal', 'bonus'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    source: { type: String }, // Network name (wannaads, cmpgrip, adstera)
    offerId: { type: String },
    ipAddress: { type: String },
    deviceFingerprint: { type: String },
    createdAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false }
});

// Device Block Schema (for fraud prevention)
const blockedDeviceSchema = new mongoose.Schema({
    fingerprint: { type: String, required: true, unique: true },
    reason: { type: String },
    blockedAt: { type: Date, default: Date.now },
    blockedUntil: { type: Date }
});

// Withdrawal Schema
const withdrawalSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    details: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    processedAt: { type: Date }
});

// Models
const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const BlockedDevice = mongoose.model('BlockedDevice', blockedDeviceSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

// ================================================
// POSTBACK VERIFICATION ENDPOINTS
// ================================================

// Wannaads Postback
// URL Format: https://your-backend.onrender.com/api/postback/wannaads
// Expected params: user_id, offer_id, amount, ip, sub_id (user's UID)
app.post('/api/postback/wannaads', async (req, res) => {
    try {
        const { user_id, offer_id, amount, ip, sub_id, event } = req.body;

        // Validate required fields
        if (!user_id || !sub_id) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Only process conversion events
        if (event && event !== 'conversion') {
            return res.status(200).json({ status: 'ignored', reason: 'Not a conversion event' });
        }

        // Verify user exists
        const user = await User.findOne({ uid: sub_id });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if blocked
        if (user.isBlocked) {
            return res.status(403).json({ error: 'User is blocked' });
        }

        // Anti-fraud checks
        const fraudCheck = await performFraudCheck(req, sub_id, ip);
        if (!fraudCheck.allowed) {
            return res.status(403).json({ error: fraudCheck.reason });
        }

        // Calculate earnings (70% user, 30% admin)
        const earnings = calculateEarnings(amount);

        // Create transaction
        const transaction = new Transaction({
            userId: sub_id,
            type: 'ad',
            amount: earnings.userShare,
            source: 'wannaads',
            offerId: offer_id,
            ipAddress: ip,
            deviceFingerprint: getFingerprint(req),
            verified: true
        });
        await transaction.save();

        // Update user balance
        user.balance += earnings.userShare;
        user.totalEarned += earnings.userShare;
        user.tasksCompleted += 1;
        user.lastActive = new Date();
        await user.save();

        console.log(`[WannaAds Postback] User ${sub_id} earned ${earnings.userShare} AED`);

        res.status(200).json({
            status: 'success',
            userShare: earnings.userShare,
            adminShare: earnings.adminShare
        });

    } catch (error) {
        console.error('[WannaAds Postback Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cmpgrip Postback
// URL Format: https://your-backend.onrender.com/api/postback/cmpgrip
// Expected params: user_id, offer_id, payout, ip, click_id (user's UID)
app.post('/api/postback/cmpgrip', async (req, res) => {
    try {
        const { user_id, offer_id, payout, ip, click_id, goal_id } = req.body;

        // Validate required fields
        if (!click_id) {
            return res.status(400).json({ error: 'Missing click_id (user UID)' });
        }

        const userId = click_id;
        const amount = parseFloat(payout) || 0;

        // Verify user exists
        const user = await User.findOne({ uid: userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if blocked
        if (user.isBlocked) {
            return res.status(403).json({ error: 'User is blocked' });
        }

        // Anti-fraud checks
        const fraudCheck = await performFraudCheck(req, userId, ip);
        if (!fraudCheck.allowed) {
            return res.status(403).json({ error: fraudCheck.reason });
        }

        // Calculate earnings (70% user, 30% admin)
        const earnings = calculateEarnings(amount);

        // Create transaction
        const transaction = new Transaction({
            userId: userId,
            type: 'ad',
            amount: earnings.userShare,
            source: 'cmpgrip',
            offerId: offer_id,
            ipAddress: ip,
            deviceFingerprint: getFingerprint(req),
            verified: true
        });
        await transaction.save();

        // Update user balance
        user.balance += earnings.userShare;
        user.totalEarned += earnings.userShare;
        user.tasksCompleted += 1;
        user.lastActive = new Date();
        await user.save();

        console.log(`[Cmpgrip Postback] User ${userId} earned ${earnings.userShare} AED`);

        res.status(200).json({
            status: 'success',
            userShare: earnings.userShare,
            adminShare: earnings.adminShare
        });

    } catch (error) {
        console.error('[Cmpgrip Postback Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Adstera Postback
// URL Format: https://your-backend.onrender.com/api/postback/adstera
// Expected params: user_id, offer_id, payout, ip, click_id (user's UID)
app.post('/api/postback/adstera', async (req, res) => {
    try {
        const { user_id, offer_id, payout, ip, click_id } = req.body;

        // Validate required fields
        if (!click_id) {
            return res.status(400).json({ error: 'Missing click_id (user UID)' });
        }

        const userId = click_id;
        const amount = parseFloat(payout) || 0;

        // Verify user exists
        const user = await User.findOne({ uid: userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if blocked
        if (user.isBlocked) {
            return res.status(403).json({ error: 'User is blocked' });
        }

        // Anti-fraud checks
        const fraudCheck = await performFraudCheck(req, userId, ip);
        if (!fraudCheck.allowed) {
            return res.status(403).json({ error: fraudCheck.reason });
        }

        // Calculate earnings (70% user, 30% admin)
        const earnings = calculateEarnings(amount);

        // Create transaction
        const transaction = new Transaction({
            userId: userId,
            type: 'ad',
            amount: earnings.userShare,
            source: 'adstera',
            offerId: offer_id,
            ipAddress: ip,
            deviceFingerprint: getFingerprint(req),
            verified: true
        });
        await transaction.save();

        // Update user balance
        user.balance += earnings.userShare;
        user.totalEarned += earnings.userShare;
        user.tasksCompleted += 1;
        user.lastActive = new Date();
        await user.save();

        console.log(`[Adstera Postback] User ${userId} earned ${earnings.userShare} AED`);

        res.status(200).json({
            status: 'success',
            userShare: earnings.userShare,
            adminShare: earnings.adminShare
        });

    } catch (error) {
        console.error('[Adstera Postback Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// ANTI-FRAUD FUNCTIONS
// ================================================

async function performFraudCheck(req, userId, postbackIp) {
    const fingerprint = getFingerprint(req);
    const clientIp = postbackIp || req.ip || req.connection.remoteAddress;

    // Check if device is blocked
    const blockedDevice = await BlockedDevice.findOne({ fingerprint });
    if (blockedDevice) {
        if (!blockedDevice.blockedUntil || blockedDevice.blockedUntil > new Date()) {
            return { allowed: false, reason: 'Device is blocked' };
        }
    }

    // Check for rapid consecutive conversions (bot detection)
    const recentTransactions = await Transaction.countDocuments({
        userId: userId,
        createdAt: { $gte: new Date(Date.now() - 60000) } // Last 1 minute
    });

    if (recentTransactions > 3) {
        // Block the device for suspicious activity
        await BlockedDevice.findOneAndUpdate(
            { fingerprint },
            {
                fingerprint,
                reason: 'Rapid consecutive conversions detected',
                blockedAt: new Date(),
                blockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            },
            { upsert: true }
        );
        return { allowed: false, reason: 'Suspicious activity detected' };
    }

    // Check if same IP has multiple accounts (same device)
    const recentTransaction = await Transaction.findOne({
        ipAddress: clientIp,
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
    });

    if (recentTransaction && recentTransaction.userId !== userId) {
        return { allowed: false, reason: 'Multiple accounts from same IP detected' };
    }

    return { allowed: true };
}

function getFingerprint(req) {
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const ip = req.ip || req.connection.remoteAddress || '';

    return crypto
        .createHash('sha256')
        .update(`${ip}-${userAgent}-${acceptLanguage}`)
        .digest('hex');
}

function calculateEarnings(networkPayout) {
    // Convert to AED (USD * 3.67)
    const amountInAED = networkPayout * 3.67;

    // 70% to user, 30% to admin
    const userShare = amountInAED * 0.70;
    const adminShare = amountInAED * 0.30;

    return { userShare, adminShare, total: amountInAED };
}

// ================================================
// USER MANAGEMENT ENDPOINTS
// ================================================

// Get or create user
app.post('/api/user', async (req, res) => {
    try {
        const { uid, email, name, deviceFingerprint } = req.body;

        let user = await User.findOne({ uid });

        if (!user) {
            // Check if device is blocked
            const blocked = await BlockedDevice.findOne({ fingerprint: deviceFingerprint });
            if (blocked) {
                return res.status(403).json({ error: 'Device is blocked', reason: blocked.reason });
            }

            user = new User({
                uid,
                email,
                name,
                deviceFingerprint,
                ipAddresses: [req.ip]
            });
            await user.save();
        } else {
            // Update last active
            user.lastActive = new Date();
            if (!user.ipAddresses.includes(req.ip)) {
                user.ipAddresses.push(req.ip);
            }
            await user.save();
        }

        res.json(user);

    } catch (error) {
        console.error('[User API Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user data
app.get('/api/user/:uid', async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.params.uid });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user balance (after task completion)
app.post('/api/task/complete', async (req, res) => {
    try {
        const { uid, taskId, taskType, reward, ipAddress } = req.body;

        const user = await User.findOne({ uid });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.isBlocked) {
            return res.status(403).json({ error: 'User is blocked' });
        }

        // Fraud check
        const fraudCheck = await performFraudCheck(req, uid, ipAddress);
        if (!fraudCheck.allowed) {
            return res.status(403).json({ error: fraudCheck.reason });
        }

        // Create transaction
        const transaction = new Transaction({
            userId: uid,
            type: taskType,
            amount: reward,
            ipAddress: ipAddress,
            deviceFingerprint: getFingerprint(req)
        });
        await transaction.save();

        // Update user
        user.balance += reward;
        user.totalEarned += reward;

        if (taskType === 'ad') user.adsWatched += 1;
        else if (taskType === 'survey') user.surveysCompleted += 1;
        else if (taskType === 'game') user.gamesPlayed += 1;

        user.tasksCompleted += 1;
        user.lastActive = new Date();
        await user.save();

        res.json({
            success: true,
            newBalance: user.balance,
            transactionId: transaction._id
        });

    } catch (error) {
        console.error('[Task Complete Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Request withdrawal
app.post('/api/withdrawal/request', async (req, res) => {
    try {
        const { uid, amount, method, details } = req.body;

        const user = await User.findOne({ uid });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const minWithdrawal = 50; // AED
        if (amount < minWithdrawal) {
            return res.status(400).json({ error: `Minimum withdrawal is ${minWithdrawal} AED` });
        }

        if (user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Create withdrawal request
        const withdrawal = new Withdrawal({
            userId: uid,
            amount,
            method,
            details
        });
        await withdrawal.save();

        // Deduct from balance
        user.balance -= amount;
        user.withdrawals += 1;
        await user.save();

        res.json({
            success: true,
            withdrawalId: withdrawal._id,
            newBalance: user.balance
        });

    } catch (error) {
        console.error('[Withdrawal Request Error]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get withdrawal history
app.get('/api/withdrawals/:uid', async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ userId: req.params.uid })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(withdrawals);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get transaction history
app.get('/api/transactions/:uid', async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.params.uid })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// ADMIN ENDPOINTS
// ================================================

// Admin login (simple token check - use proper auth in production)
app.post('/api/admin/login', (req, res) => {
    const { token } = req.body;
    const adminToken = process.env.ADMIN_TOKEN || 'hmearn_admin_secret_token_2024';

    if (token === adminToken) {
        res.json({ success: true, token: adminToken });
    } else {
        res.status(401).json({ error: 'Invalid admin token' });
    }
});

// Get all users (admin)
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get pending withdrawals (admin)
app.get('/api/admin/withdrawals', async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ status: 'pending' })
            .sort({ createdAt: -1 });
        res.json(withdrawals);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Process withdrawal (admin)
app.post('/api/admin/withdrawal/:id', async (req, res) => {
    try {
        const { action } = req.body; // 'approve' or 'reject'

        const withdrawal = await Withdrawal.findById(req.params.id);
        if (!withdrawal) {
            return res.status(404).json({ error: 'Withdrawal not found' });
        }

        if (action === 'approve') {
            withdrawal.status = 'approved';
            withdrawal.processedAt = new Date();
        } else {
            withdrawal.status = 'rejected';
            withdrawal.processedAt = new Date();

            // Refund balance
            const user = await User.findOne({ uid: withdrawal.userId });
            if (user) {
                user.balance += withdrawal.amount;
                await user.save();
            }
        }

        await withdrawal.save();
        res.json({ success: true, status: withdrawal.status });

    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Block user (admin)
app.post('/api/admin/block/:uid', async (req, res) => {
    try {
        const { reason, duration } = req.body;

        const user = await User.findOne({ uid: req.params.uid });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.isBlocked = true;
        user.blockReason = reason;
        await user.save();

        // Also block device
        await BlockedDevice.findOneAndUpdate(
            { fingerprint: user.deviceFingerprint },
            {
                fingerprint: user.deviceFingerprint,
                reason,
                blockedAt: new Date(),
                blockedUntil: duration ? new Date(Date.now() + duration) : null
            },
            { upsert: true }
        );

        res.json({ success: true });

    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// HEALTH CHECK
// ================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ================================================
// DATABASE CONNECTION & SERVER START
// ================================================

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`🚀 HM Earn Pro Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        // Start server anyway for health checks
        app.listen(PORT, () => {
            console.log(`🚀 HM Earn Pro Server running on port ${PORT} (DB disconnected)`);
        });
    });

module.exports = app;
