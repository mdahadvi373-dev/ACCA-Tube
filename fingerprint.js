// ================================================
// HM EARN PRO - DEVICE FINGERPRINTING
// ================================================

async function getFingerprint() {
    if (deviceFingerprint) return deviceFingerprint;

    try {
        const components = [];

        // User Agent
        components.push(navigator.userAgent);

        // Language
        components.push(navigator.language);

        // Platform
        components.push(navigator.platform);

        // Screen Resolution
        components.push(screen.width);
        components.push(screen.height);
        components.push(screen.colorDepth);

        // Timezone
        components.push(new Date().getTimezoneOffset());

        // Canvas Fingerprint
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 50;
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('HM Earn Pro', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('HM Earn Pro', 4, 17);
            components.push(canvas.toDataURL());
        } catch (e) {
            components.push('canvas-not-available');
        }

        // WebGL Fingerprint
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
                    components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
                }
            }
        } catch (e) {
            components.push('webgl-not-available');
        }

        // Touch Support
        components.push(navigator.maxTouchPoints > 0);
        components.push('ontouchstart' in window);

        // Hardware Concurrency
        components.push(navigator.hardwareConcurrency || 'unknown');

        // Device Memory
        components.push(navigator.deviceMemory || 'unknown');

        // Combine and hash
        const fingerprintString = components.join('|');
        deviceFingerprint = await hashString(fingerprintString);

        return deviceFingerprint;
    } catch (error) {
        console.error('Fingerprint error:', error);
        return 'fallback-' + Date.now();
    }
}

async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getDeviceInfo() {
    const ua = navigator.userAgent;
    let device = 'Desktop';
    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect Device
    if (/mobile/i.test(ua)) device = 'Mobile';
    if (/tablet|ipad/i.test(ua)) device = 'Tablet';

    // Detect Browser
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome/i.test(ua)) browser = 'Chrome';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua)) browser = 'Safari';
    else if (/opera/i.test(ua)) browser = 'Opera';

    // Detect OS
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/ios|iphone|ipad/i.test(ua)) os = 'iOS';

    return {
        type: device,
        browser: browser,
        os: os,
        userAgent: ua.substring(0, 100)
    };
}

async function getIPInfo() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return 'unknown';
    }
}
