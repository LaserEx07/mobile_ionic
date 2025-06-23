// WebAlerto Environment Configuration for ngrok Development
// Use this configuration when connecting to Laravel backend via ngrok tunnel

export const environment = {
  production: false,

  // API Configuration for ngrok tunnel
  // Update this URL with your actual ngrok tunnel URL
  // Get the URL by running: get-ngrok-url.bat
  apiUrl: 'https://your-ngrok-url.ngrok-free.app/api',

  // Health check endpoint
  healthCheckUrl: 'https://your-ngrok-url.ngrok-free.app/up',

  // External APIs (unchanged)
  orsApiKey: '5b3ce3597851110001cf6248d05f92e32cab4d1da9db6036a3a53fe7',
  mapboxAccessToken: 'pk.eyJ1IjoianVucmVsMDcwNDA1IiwiYSI6ImNtYjNocGs1YjBxc2cydnB5OG14NmNzYTIifQ.FGsozY9ibdn28Rg91_msIg',

  // Firebase configuration - synchronized with Laravel backend
  firebase: {
    projectId: 'last-5acaf',
    messagingSenderId: '660101685392',
    appId: '1:660101685392:android:c7c81cb0ccca4f30cb7815',
    apiKey: 'AIzaSyA5H6_NGbhDlVZ4l67qEC_JNRmcXPQ-GAo',
    databaseURL: 'https://last-5acaf-default-rtdb.firebaseio.com',
    storageBucket: 'last-5acaf.firebasestorage.app'
  },

  // Communication settings - adjusted for ngrok
  communication: {
    retryAttempts: 3,
    timeoutMs: 15000, // Increased timeout for ngrok latency
    enableOfflineMode: true,
    enableRealTimeUpdates: true
  },

  // Development flags
  development: {
    useNgrok: true,
    enableDebugLogs: true,
    skipCertificateValidation: false // ngrok provides valid certificates
  }
};

// Instructions for updating this file:
// 1. Run get-ngrok-url.bat to get your tunnel URL
// 2. Replace 'https://your-ngrok-url.ngrok-free.app' with your actual ngrok URL
// 3. Save this file
// 4. Rebuild your app: ionic build
