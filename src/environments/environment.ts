// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,

  // ===== CURRENT LOCATION CONFIGURATION =====
  // 🏠 HOME IP: 192.168.112.244 (current location)
  // 🏫 SCHOOL IP: 172.30.11.217 (when at school)
  // For mobile device testing, use your computer's actual IP address
  apiUrl: 'http://192.168.110.9:8000/api', // Current home IP - change this to your computer's IP

  // ===== ALTERNATIVE URLS =====
  // Switch between these based on your location:
  // apiUrl: 'http://172.30.11.217:8000/api', // School IP
  // apiUrl: 'https://2xGdwnDAvorrvfTYkPJwFdH0bl8_7EG3njhPc7viiNrH5QWVN.ngrok-free.app/api', // ngrok URL
  // apiUrl: 'http://localhost:8000/api', // Only works for web development

  // API endpoints for testing
  healthCheckUrl: 'http://192.168.110.9:8000/up',
  testApiUrl: 'http://192.168.110.9:8000/api/test',

  // External APIs
  orsApiKey: '5b3ce3597851110001cf6248d05f92e32cab4d1da9db6036a3a53fe7', // Keep for fallback
  mapboxAccessToken: 'pk.eyJ1IjoianVucmVsMDcwNDA1IiwiYSI6ImNtYjNocGs1YjBxc2cydnB5OG14NmNzYTIifQ.FGsozY9ibdn28Rg91_msIg',

  // Firebase configuration - synchronized with Laravel backend
  firebase: {
    projectId: 'last-5acaf',
    messagingSenderId: '660101685392',
    appId: '1:660101685392:android:c7c81cb0ccca4f30cb7815',
    apiKey: 'AIzaSyA5H6_NGbhDlVZ4l67qEC_JNRmcXPQ-GAo',
    databaseURL: 'https://last-5acaf-default-rtdb.firebaseio.com',
    storageBucket: 'last-5acaf.appspot.com'
  },

  // Communication settings
  communication: {
    retryAttempts: 3,
    timeoutMs: 10000,
    enableOfflineMode: true,
    enableRealTimeUpdates: true
  }
};

