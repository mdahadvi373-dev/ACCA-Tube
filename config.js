// ================================================
// HM EARN PRO - CONFIGURATION
// ================================================

// Firebase Configuration - User Provided
const firebaseConfig = {
    apiKey: "AIzaSyCvhGuyx6ZSrimCjk2G2Q9pdoihvjb3Hms",
    authDomain: "realearn-app.firebaseapp.com",
    databaseURL: "https://realearn-app-default-rtdb.firebaseio.com",
    projectId: "realearn-app",
    storageBucket: "realearn-app.firebasestorage.app",
    messagingSenderId: "241034846565",
    appId: "1:241034846565:web:26f6da801689f429f9018c",
    measurementId: "G-WPH8TW221C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// API Base URL
// Update this to your Render backend URL after deployment
// For local testing: 'http://localhost:3000'
// For production: 'https://your-backend.onrender.com'
const API_BASE_URL = 'https://your-backend.onrender.com';

// Platform Settings
const PLATFORM = {
    name: 'HM Earn Pro',
    currency: 'AED',
    currencySymbol: 'AED',
    exchangeRate: 3.67, // USD to AED
    userShare: 0.70, // 70% to user
    adminShare: 0.30, // 30% to admin
    minWithdrawal: 50,
    maxTasksPerMinute: 3,
    deviceBlockHours: 24
};

// Ad Network Codes - User Provided
const AD_NETWORKS = {
    adstera: {
        name: 'Adstera (Profitable CPM)',
        code1: 'tbthcya2f?key=ab6ca63f3e3b2d1c2be174a750f82b56',
        code2: 'kxq650wd?key=11d1ec5f3d88b1d9689e0547e8b15dd1',
        url: 'https://www.profitablecpmratenetwork.com/',
        enabled: true
    },
    cmpgrip: {
        name: 'Cmpgrip',
        userId: '2512387',
        key: 'd9ed96cda13d050b4775325364af1b60',
        feedUrl: 'https://www.cpagrip.com/common/offer_feed_rss.php?user_id=2512387&key=d9ed96cda13d050b4775325364af1b60&ip=&tracking_id=',
        baseUrl: 'https://playabledownloads.com/1886869/',
        enabled: true
    },
    wannaads: {
        name: 'Wannaads',
        apiKey: '69cb21e8f1864612079491',
        secret: '8e518cf621',
        apiSecret: '1840fe8271',
        enabled: true
    }
};

// App State
let currentUser = null;
let userData = null;
let deviceFingerprint = null;

// Demo Mode (when backend is not available)
const DEMO_MODE = true;

// Postback URL for ad networks (server will handle this)
const POSTBACK_URL = 'https://your-backend.onrender.com/api/postback';