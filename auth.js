// ================================================
// HM EARN PRO - AUTHENTICATION
// ================================================

// Initialize auth state listener
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        console.log('User logged in:', user.uid);
        await handleAuthSuccess(user);
    } else {
        currentUser = null;
        userData = null;
        showAuthContainer();
    }
});

// Toggle password visibility
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.querySelector('i').className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        btn.querySelector('i').className = 'fas fa-eye';
    }
}

// Show auth page
function showAuthPage(page) {
    document.getElementById('login-page').classList.toggle('hidden', page !== 'login');
    document.getElementById('signup-page').classList.toggle('hidden', page !== 'signup');
}

// Show auth container
function showAuthContainer() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('dashboard-container').classList.add('hidden');
    document.getElementById('admin-container').classList.add('hidden');
    document.getElementById('loading-screen').classList.add('hidden');
}

// Show main app
function showMainApp() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('dashboard-container').classList.remove('hidden');
    document.getElementById('admin-container').classList.add('hidden');
    initApp();
}

// Show admin panel
function showAdmin() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('dashboard-container').classList.add('hidden');
    document.getElementById('admin-container').classList.remove('hidden');
    loadAdminData();
}

// Handle successful authentication
async function handleAuthSuccess(user) {
    const fingerprint = await getFingerprint();

    // Check for device reuse (demo mode)
    if (DEMO_MODE) {
        // In demo mode, just show the dashboard
        userData = {
            userId: user.uid,
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            photoURL: user.photoURL,
            balance: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
            tasksCompleted: 0,
            surveysCompleted: 0,
            gamesCompleted: 0,
            adsWatched: 0,
            isBlocked: false,
            createdAt: new Date()
        };
        showMainApp();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: user.uid,
                email: user.email,
                name: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL,
                deviceId: fingerprint
            })
        });

        const data = await response.json();

        if (data.success) {
            if (data.code === 'DEVICE_REUSE') {
                showError('Device Blocked', data.error);
                auth.signOut();
                return;
            }

            userData = data.user;
            showMainApp();
        } else {
            if (data.code === 'DEVICE_REUSE') {
                showError('Device Blocked', data.error);
                auth.signOut();
            } else {
                showError('Sync Error', data.error || 'Could not sync with server');
            }
        }
    } catch (error) {
        console.error('Sync error:', error);
        // Fallback to demo mode
        userData = {
            userId: user.uid,
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            balance: 0,
            totalEarned: 0,
            tasksCompleted: 0,
            surveysCompleted: 0,
            gamesCompleted: 0,
            adsWatched: 0,
            isBlocked: false
        };
        showMainApp();
    }
}

// Sign in with email
async function signInWithEmail(email, password) {
    try {
        showToast('Signing in...');

        const result = await auth.signInWithEmailAndPassword(email, password);
        console.log('Signed in:', result.user.uid);

        showToast('Welcome back!', true);
    } catch (error) {
        console.error('Sign in error:', error);
        let message = 'Login failed';

        switch (error.code) {
            case 'auth/user-not-found':
                message = 'No account found with this email';
                break;
            case 'auth/wrong-password':
                message = 'Incorrect password';
                break;
            case 'auth/invalid-email':
                message = 'Invalid email address';
                break;
            case 'auth/too-many-requests':
                message = 'Too many attempts. Please try again later';
                break;
            default:
                message = error.message;
        }

        showError('Login Failed', message);
    }
}

// Sign up with email
async function signUpWithEmail(email, password, name) {
    try {
        showToast('Creating account...');

        const result = await auth.createUserWithEmailAndPassword(email, password);

        // Update profile with name
        await result.user.updateProfile({
            displayName: name
        });

        console.log('Signed up:', result.user.uid);
        showToast('Account created!', true);
    } catch (error) {
        console.error('Sign up error:', error);
        let message = 'Registration failed';

        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'An account with this email already exists';
                break;
            case 'auth/invalid-email':
                message = 'Invalid email address';
                break;
            case 'auth/weak-password':
                message = 'Password should be at least 6 characters';
                break;
            default:
                message = error.message;
        }

        showError('Registration Failed', message);
    }
}

// Sign in with Google
async function signInWithGoogle() {
    try {
        showToast('Connecting to Google...');

        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);

        console.log('Google sign in:', result.user.uid);
        showToast('Welcome!', true);
    } catch (error) {
        console.error('Google sign in error:', error);

        if (error.code === 'auth/popup-closed-by-user') {
            return;
        }

        showError('Google Login Failed', error.message);
    }
}

// Sign out
async function logout() {
    try {
        await auth.signOut();
        showToast('Logged out successfully', true);
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    let feedback = [];

    if (password.length >= 8) {
        strength++;
        feedback.push('Good length');
    } else {
        feedback.push('At least 8 characters');
    }

    if (/[a-z]/.test(password)) {
        strength++;
        feedback.push('Lowercase letter');
    }

    if (/[A-Z]/.test(password)) {
        strength++;
        feedback.push('Uppercase letter');
    }

    if (/[0-9]/.test(password)) {
        strength++;
        feedback.push('Number');
    }

    if (/[^a-zA-Z0-9]/.test(password)) {
        strength++;
        feedback.push('Special character');
    }

    return { strength, feedback };
}

// Initialize password strength checker
document.addEventListener('DOMContentLoaded', () => {
    const signupPassword = document.getElementById('signup-password');
    if (signupPassword) {
        signupPassword.addEventListener('input', (e) => {
            const { strength, feedback } = checkPasswordStrength(e.target.value);
            const fill = document.getElementById('strength-fill');
            const text = document.getElementById('strength-text');

            fill.className = 'strength-fill';

            if (strength === 0) {
                fill.style.width = '0%';
                text.textContent = 'Enter a password';
            } else if (strength <= 2) {
                fill.classList.add('weak');
                text.textContent = 'Weak password';
            } else if (strength === 3) {
                fill.classList.add('fair');
                text.textContent = 'Fair password';
            } else if (strength === 4) {
                fill.classList.add('good');
                text.textContent = 'Good password';
            } else {
                fill.classList.add('strong');
                text.textContent = 'Strong password';
            }
        });
    }

    // Login form handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            await signInWithEmail(email, password);
        });
    }

    // Signup form handler
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirm = document.getElementById('signup-confirm').value;
            const terms = document.getElementById('terms');

            if (password !== confirm) {
                showError('Password Mismatch', 'Passwords do not match');
                return;
            }

            if (password.length < 6) {
                showError('Weak Password', 'Password must be at least 6 characters');
                return;
            }

            await signUpWithEmail(email, password, name);
        });
    }
});
