// Quick network test for mobile debugging
// Run this on your computer to test if the backend is accessible

const http = require('http');
const os = require('os');

// Get your computer's IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost';
}

const localIP = getLocalIP();
const port = 8000;

console.log('🔍 Testing network connectivity for mobile app...');
console.log(`📍 Computer IP: ${localIP}`);
console.log(`🚪 Port: ${port}`);
console.log(`🌐 Full URL: http://${localIP}:${port}`);

// Test 1: Check if Laravel backend is running
console.log('\n📡 Testing Laravel backend...');

const testBackend = () => {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: localIP,
            port: port,
            path: '/up', // Laravel health check
            method: 'GET',
            timeout: 5000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`✅ Backend accessible: ${res.statusCode}`);
                console.log(`📄 Response: ${data.substring(0, 100)}...`);
                resolve(true);
            });
        });

        req.on('error', (error) => {
            console.log(`❌ Backend not accessible: ${error.message}`);
            reject(error);
        });

        req.on('timeout', () => {
            console.log(`⏰ Backend request timed out`);
            req.destroy();
            reject(new Error('Timeout'));
        });

        req.end();
    });
};

// Test 2: Check API endpoint
const testAPI = () => {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: localIP,
            port: port,
            path: '/api/evacuation-centers',
            method: 'GET',
            timeout: 5000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`✅ API accessible: ${res.statusCode}`);
                try {
                    const json = JSON.parse(data);
                    console.log(`📊 API response: ${Array.isArray(json) ? json.length : 'Invalid'} items`);
                } catch (e) {
                    console.log(`📄 API response: ${data.substring(0, 100)}...`);
                }
                resolve(true);
            });
        });

        req.on('error', (error) => {
            console.log(`❌ API not accessible: ${error.message}`);
            reject(error);
        });

        req.on('timeout', () => {
            console.log(`⏰ API request timed out`);
            req.destroy();
            reject(new Error('Timeout'));
        });

        req.end();
    });
};

// Run tests
async function runTests() {
    try {
        await testBackend();
        console.log('\n📡 Testing API endpoint...');
        await testAPI();
        
        console.log('\n🎉 All tests passed!');
        console.log('\n📱 Mobile app should be able to connect to:');
        console.log(`   http://${localIP}:${port}/api`);
        console.log('\n💡 Make sure your mobile device is on the same WiFi network.');
        
    } catch (error) {
        console.log('\n❌ Tests failed!');
        console.log('\n🔧 Troubleshooting steps:');
        console.log('1. Make sure Laravel backend is running: php artisan serve --host=0.0.0.0 --port=8000');
        console.log('2. Check Windows Firewall settings');
        console.log('3. Verify your mobile device is on the same WiFi network');
        console.log(`4. Try accessing http://${localIP}:${port} in your mobile browser`);
    }
}

runTests();
