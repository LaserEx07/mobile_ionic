// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,

  // API Configuration
  // Change this to your backend server's IP address and port
  // Examples:
  // - Local development: 'http://localhost:8000/api'
  // - Home network: 'http://192.168.1.100:8000/api'
  // - School network: 'http://172.30.11.217:8000/api'
  // - Current network: 'http://192.168.112.210:8000/api' (UPDATED)
  // - ngrok tunnel: 'https://your-ngrok-url.ngrok-free.app/api'

  // TODO: Replace with ngrok URL or production domain for external access
  apiUrl: 'http://192.168.43.188:8000/api', // ⚠️ Only works on local network

  // For external access, use one of these:
  // apiUrl: 'https://your-ngrok-url.ngrok-free.app/api', // ngrok tunnel
  // apiUrl: 'https://yourdomain.com/api', // production domain

  // Health check endpoint (automatically derived if not specified)
  healthCheckUrl: 'http://192.168.43.188:8000/up', // ⚠️ Only works on local network

  // External APIs - Synchronized with WebAlerto backend
  orsApiKey: '5b3ce3597851110001cf62485d16190c4e8d4358bf96e7207454806f', // Updated OpenRouteService API key
  mapboxAccessToken: 'pk.eyJ1IjoiamluY2VudC0xMjM0IiwiYSI6ImNtYzI1bWowNzA0dnYyaXByMHNkZjl5ZTgifQ.bD_y9vt5k4nDV_06PdbUMg', // Synchronized with WebAlerto

  // Firebase configuration - synchronized with WebAlerto backend
  firebase: {
    projectId: 'alerto-ef503',
    messagingSenderId: '660101685392',
    appId: '1:660101685392:android:c7c81cb0ccca4f30cb7815',
    apiKey: 'AIzaSyA5H6_NGbhDlVZ4l67qEC_JNRmcXPQ-GAo',
    databaseURL: 'https://alerto-ef503-default-rtdb.firebaseio.com', // Synchronized with WebAlerto
    storageBucket: 'alerto-ef503.appspot.com' // Synchronized with WebAlerto
  },

  // Communication settings
  communication: {
    retryAttempts: 3,
    timeoutMs: 10000,
    enableOfflineMode: true,
    enableRealTimeUpdates: true
  }
};

