export const environment = {
  production: true,

  // API Configuration for production
  // Change this to your production server's URL
  apiUrl: 'http://192.168.112.27:8000/api',

  // Health check endpoint (automatically derived if not specified)
  healthCheckUrl: 'http://192.168.112.27:8000/up',

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
    storageBucket: 'last-5acaf.firebasestorage.app'
  },

  // Communication settings
  communication: {
    retryAttempts: 3,
    timeoutMs: 10000,
    enableOfflineMode: true,
    enableRealTimeUpdates: true
  }
};