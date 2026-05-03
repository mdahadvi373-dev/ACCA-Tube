// ================================================
// HM EARN PRO - API SERVICE
// ================================================

// API helper function
async function apiRequest(endpoint, options = {}) {
    if (DEMO_MODE) {
        return handleDemoMode(endpoint, options);
    }

    try {
        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            ...options
        };

        if (options.body) {
            config.body = JSON.stringify(options.body);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();

        return data;
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, error: error.message };
    }
}

// Demo mode handlers
function handleDemoMode(endpoint, options) {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (options.method === 'POST') {
                if (endpoint === '/api/earn') {
                    resolve({
                        success: true,
                        newBalance: (userData.balance + options.body.amount).toFixed(2),
                        earned: options.body.amount.toFixed(2)
                    });
                } else if (endpoint === '/api/withdraw') {
                    resolve({
                        success: true,
                        message: 'Withdrawal requested successfully'
                    });
                }
            } else {
                resolve({ success: true });
            }
        }, 500);
    });
}

// Get platform settings
async function getSettings() {
    return await apiRequest('/api/settings');
}

// Get user balance
async function getUserBalance(userId) {
    return await apiRequest(`/api/user/${userId}/balance`);
}

// Add earning
async function addEarning(userId, taskType, taskId, amount) {
    return await apiRequest('/api/earn', {
        method: 'POST',
        body: {
            userId,
            taskType,
            taskId,
            amount
        }
    });
}

// Get user history
async function getUserHistory(userId) {
    return await apiRequest(`/api/user/${userId}/history`);
}

// Request withdrawal
async function requestWithdrawal(userId, amount, method, accountNumber) {
    return await apiRequest('/api/withdraw', {
        method: 'POST',
        body: {
            userId,
            amount,
            method,
            accountNumber
        }
    });
}

// Get user withdrawals
async function getUserWithdrawals(userId) {
    return await apiRequest(`/api/user/${userId}/withdrawals`);
}

// Get leaderboard
async function getLeaderboard() {
    return await apiRequest('/api/leaderboard');
}

// Admin: Get all users
async function getAllUsers() {
    return await apiRequest('/api/admin/users');
}

// Admin: Search user
async function searchUser(query) {
    return await apiRequest(`/api/admin/search?query=${encodeURIComponent(query)}`);
}

// Admin: Get pending withdrawals
async function getPendingWithdrawals() {
    return await apiRequest('/api/admin/withdrawals/pending');
}

// Admin: Get all withdrawals
async function getAllWithdrawals(status) {
    return await apiRequest(`/api/admin/withdrawals?status=${status}`);
}

// Admin: Process withdrawal
async function processWithdrawal(withdrawalId, action, adminNote = '') {
    return await apiRequest(`/api/admin/withdrawal/${withdrawalId}`, {
        method: 'POST',
        body: { action, adminNote }
    });
}

// Admin: Block/Unblock user
async function toggleUserBlock(userId, action, reason = '') {
    return await apiRequest(`/api/admin/user/${userId}`, {
        method: 'POST',
        body: { action, reason }
    });
}

// Admin: Get platform stats
async function getPlatformStats() {
    return await apiRequest('/api/admin/stats');
}

// Admin: Get all activities
async function getAllActivities(type = 'all') {
    const query = type !== 'all' ? `?type=${type}` : '';
    return await apiRequest(`/api/admin/activities${query}`);
}

// Refresh user data from server
async function refreshUserData() {
    if (!currentUser) return;

    if (DEMO_MODE) {
        updateDashboard();
        return;
    }

    try {
        const fingerprint = await getFingerprint();

        const response = await fetch(`${API_BASE_URL}/api/auth/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.uid,
                email: currentUser.email,
                name: currentUser.displayName,
                photoURL: currentUser.photoURL,
                deviceId: fingerprint
            })
        });

        const data = await response.json();

        if (data.success) {
            userData = data.user;
            updateDashboard();
        }
    } catch (error) {
        console.error('Refresh error:', error);
    }
}

// Health check
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        return response.ok;
    } catch {
        return false;
    }
}
