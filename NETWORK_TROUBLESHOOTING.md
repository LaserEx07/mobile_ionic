# 🌐 Network Troubleshooting Guide for Alerto Mobile App

## 🚨 "Cannot connect to server" Error Solutions

### ✅ **Configuration Updated**
Your app is now configured to use:
- **API URL**: `http://192.168.112.8:8000/api`
- **Backend IP**: `192.168.112.8:8000`

### 🔧 **Step-by-Step Troubleshooting**

#### **1. Verify Backend is Running**
```bash
# Check if Laravel backend is accessible
curl http://192.168.112.8:8000/api/evacuation-centers
# OR visit in browser: http://192.168.112.8:8000
```

#### **2. Check Network Connection**
- **Computer and Phone must be on the SAME WiFi network**
- **Disable mobile data** on your phone during testing
- **Check firewall settings** - Windows Firewall might block connections

#### **3. Test API Endpoints**
```bash
# Test registration endpoint
curl -X POST http://192.168.112.8:8000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"password"}'
```

#### **4. Network Configuration Checklist**
- [ ] Both devices on same WiFi network
- [ ] Laravel backend running (`php artisan serve --host=0.0.0.0 --port=8000`)
- [ ] Windows Firewall allows port 8000
- [ ] Mobile data disabled on phone
- [ ] Correct IP address in app configuration

### 🛠️ **Quick Fixes**

#### **Fix 1: Start Laravel Backend Properly**
```bash
cd WebAlerto
php artisan serve --host=0.0.0.0 --port=8000
```

#### **Fix 0: MOST COMMON ISSUE - Check Same WiFi Network**
**CRITICAL**: Both your computer and mobile device MUST be on the same WiFi network!
- Computer WiFi: Check Windows WiFi settings
- Phone WiFi: Go to Settings > WiFi, make sure connected to SAME network
- Turn OFF mobile data on phone during testing

#### **Fix 2: Windows Firewall Rule**
1. Open Windows Defender Firewall
2. Click "Allow an app or feature through Windows Defender Firewall"
3. Click "Change Settings" → "Allow another app"
4. Browse to PHP executable or add port 8000

#### **Fix 3: Update IP Address (if changed)**
If your computer's IP changes:
1. Run `ipconfig` to get new IP
2. Update `mobile_ionic/src/environments/environment.ts`
3. Update `mobile_ionic/capacitor.config.ts`
4. Rebuild: `npm run build && npx cap sync android`

### 📱 **Testing on Device**

#### **Method 1: Android Studio**
1. Connect phone via USB
2. Enable Developer Options & USB Debugging
3. Run app from Android Studio
4. Check logcat for network errors

#### **Method 2: APK Installation**
1. Build APK: `.\build-apk-debug.bat`
2. Install on device
3. Check network connection in app

### 🔍 **Debug Commands**

#### **Check Current IP**
```bash
ipconfig | findstr "IPv4"
```

#### **Test API from Computer**
```bash
# Test evacuation centers endpoint
Invoke-WebRequest -Uri "http://192.168.112.8:8000/api/evacuation-centers"

# Test signup endpoint
Invoke-WebRequest -Uri "http://192.168.112.8:8000/api/signup" -Method POST -ContentType "application/json" -Body '{"name":"Test","email":"test@test.com","password":"password"}'
```

### ⚠️ **Common Issues**

1. **IP Address Changed**: Restart router, computer gets new IP
2. **Firewall Blocking**: Windows blocks port 8000
3. **Different Networks**: Phone on mobile data, computer on WiFi
4. **Backend Not Running**: Laravel server stopped
5. **CORS Issues**: Backend not allowing mobile requests

### 📞 **Still Having Issues?**

1. Run `.\debug-mobile.bat` to check configuration
2. Check Android Studio logcat for detailed errors
3. Verify both devices can ping each other
4. Try using ngrok for external access:
   ```bash
   ngrok http 8000
   # Update apiUrl to ngrok URL
   ```

### 🎯 **Success Indicators**
- ✅ Backend responds to API calls
- ✅ Mobile app shows "Online" status
- ✅ Registration/login works
- ✅ Evacuation centers load on map
