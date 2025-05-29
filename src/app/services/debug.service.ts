import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Platform } from '@ionic/angular';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DebugService {

  constructor(
    private http: HttpClient,
    private platform: Platform
  ) {}

  async runDiagnostics(): Promise<string> {
    const results: string[] = [];

    results.push('🔍 ALERTO LOGIN DIAGNOSTICS');
    results.push('='.repeat(40));
    results.push('');

    // 1. Platform Info
    results.push('📱 PLATFORM INFO:');
    results.push(`- Platform: ${this.platform.is('android') ? 'Android' : this.platform.is('ios') ? 'iOS' : 'Browser'}`);
    results.push(`- Online: ${navigator.onLine}`);
    results.push(`- User Agent: ${navigator.userAgent}`);
    results.push('');

    // 2. Environment Info
    results.push('🌐 ENVIRONMENT INFO:');
    results.push(`- API URL: ${environment.apiUrl}`);
    results.push(`- Production: ${environment.production}`);
    results.push('');

    // 3. Network Tests
    results.push('🧪 NETWORK TESTS:');

    // Test 1: Basic API connectivity
    try {
      const testUrl = environment.apiUrl.replace('/api', '') + '/api/test';
      results.push(`- Testing: ${testUrl}`);

      const startTime = Date.now();
      const response = await this.http.get(testUrl).toPromise();
      const endTime = Date.now();

      results.push(`✅ API Test: SUCCESS (${endTime - startTime}ms)`);
      results.push(`- Response: ${JSON.stringify(response)}`);
    } catch (error: any) {
      results.push(`❌ API Test: FAILED`);
      results.push(`- Error: ${error.message || error}`);
      results.push(`- Status: ${error.status || 'Unknown'}`);
      results.push(`- URL: ${error.url || 'Unknown'}`);
    }

    results.push('');

    // Test 2: Auth endpoint test
    try {
      const authUrl = environment.apiUrl + '/auth/login';
      results.push(`- Testing auth endpoint: ${authUrl}`);

      // Try a POST with invalid data to see if endpoint responds
      const testData = { email: 'test@test.com', password: 'test' };
      const response = await this.http.post(authUrl, testData).toPromise();

      results.push(`✅ Auth Endpoint: ACCESSIBLE`);
    } catch (error: any) {
      if (error.status === 422 || error.status === 401) {
        results.push(`✅ Auth Endpoint: ACCESSIBLE (validation error expected)`);
      } else {
        results.push(`❌ Auth Endpoint: FAILED`);
        results.push(`- Error: ${error.message || error}`);
        results.push(`- Status: ${error.status || 'Unknown'}`);
      }
    }

    results.push('');

    // 4. Storage Test
    results.push('💾 STORAGE TEST:');
    try {
      localStorage.setItem('test', 'value');
      const value = localStorage.getItem('test');
      localStorage.removeItem('test');

      if (value === 'value') {
        results.push('✅ LocalStorage: WORKING');
      } else {
        results.push('❌ LocalStorage: FAILED');
      }
    } catch (error) {
      results.push(`❌ LocalStorage: ERROR - ${error}`);
    }

    results.push('');

    // 5. Recommendations
    results.push('💡 TROUBLESHOOTING STEPS:');

    if (!navigator.onLine) {
      results.push('❌ No internet connection detected');
      results.push('- Check your WiFi/mobile data');
    }

    if (environment.apiUrl.includes('ngrok')) {
      results.push('🔗 Using ngrok tunnel:');
      results.push('- ✅ Reliable for device testing');
      results.push('- 🌐 Works from anywhere');
      results.push('- ⏰ Free URLs expire after 8 hours');
      results.push('');
      results.push('🔧 NGROK TROUBLESHOOTING:');
      results.push('1. Check ngrok dashboard: http://127.0.0.1:4040');
      results.push('2. Verify Laravel backend: php artisan serve --host=0.0.0.0 --port=8000');
      results.push('3. Start ngrok tunnel: ngrok http 8000');
      results.push('4. Update environment.ts with new ngrok URL');
      results.push('5. Rebuild app: ionic build && ionic cap sync');
      results.push('');
      results.push('💡 QUICK COMMANDS:');
      results.push('- Test backend: curl ' + environment.apiUrl.replace('/api', '/up'));
      results.push('- Ngrok status: curl http://127.0.0.1:4040/api/tunnels');
    } else if (environment.apiUrl.includes('192.168') || environment.apiUrl.includes('172.')) {
      results.push('🏠 Using local IP address:');
      results.push('- 📶 Both devices must be on same WiFi');
      results.push('- 🔥 Windows Firewall must allow port 8000');
      results.push('- 🖥️ Backend server must be running');
      results.push('');
      results.push('🔧 LOCAL IP TROUBLESHOOTING:');
      results.push('1. Check WiFi connection on both devices');
      results.push('2. Disable Windows Firewall temporarily');
      results.push('3. Verify IP address: ipconfig');
      results.push('4. Test from browser: ' + environment.apiUrl.replace('/api', ''));
      results.push('');
      results.push('💡 ALTERNATIVE: Switch to ngrok for easier setup');
    }

    results.push('');
    results.push('🔧 NEXT STEPS:');
    results.push('1. Share this diagnostic report');
    results.push('2. Check backend server logs');
    results.push('3. Try alternative connection method');

    return results.join('\n');
  }
}
