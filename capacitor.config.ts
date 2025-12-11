import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Alerto',
  webDir: 'www',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: [
      'http://localhost:8100',
      'http://localhost:8000',
      'http://127.0.0.1:8100',
      'http://127.0.0.1:8000',
      'http://192.168.119.177:8000', // Current local API endpoint
      'http://172.30.11.217:8000', // School IP
      'http://192.168.112.191:8000', // Home / local API
      'http://192.168.112.191:8000', // Home / local API (duplicate for coverage)
      'http://172.30.13.185:8000', // Previous IP
      'https://*.ngrok-free.app',
      'http://*.ngrok-free.app',
      'https://*.ngrok.io',
      'http://*.ngrok.io',
      'https://api.openrouteservice.org',
      'https://*.openstreetmap.org',
      'https://tile.openstreetmap.org',
      'https://a.tile.openstreetmap.org',
      'https://b.tile.openstreetmap.org',
      'https://c.tile.openstreetmap.org',
      'https://api.mapbox.com',
      'https://*.mapbox.com',
      'https://*.tile.openstreetmap.fr',
      'https://cartodb-basemaps-*.global.ssl.fastly.net'
    ]
    // Comment out the development server URL for production builds
    // url: 'http://localhost:8100',
    // iosScheme: 'ionic'
  },
  plugins: {
    SplashScreen: {
       launchShowDuration: 0,              // ✅ disables Capacitor splash screen display
  showSplash: false,                  // ✅ prevent splash from rendering
  autoHide: true,
  backgroundColor: "#FFFFFF",         // optional, if you still want white background
  showSpinner: false 
    },
    Geolocation: {
      permissions: {
        android: {
          coarseLocation: true,
          fineLocation: true
        },
        ios: {
          whenInUse: true,
          always: false
        }
      }
    },
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav"
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  ios: {
    contentInset: "always",
    preferredContentMode: "mobile"
  }
  
}




export default config;
