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
  apiUrl: 'http://192.168.112.210:8000/api', // Updated to current IP

  // Health check endpoint (automatically derived if not specified)
  healthCheckUrl: 'http://192.168.112.210:8000/up', // Updated to current IP

  // External APIs
  orsApiKey: '5b3ce3597851110001cf62485d16190c4e8d4358bf96e7207454806f', // Updated OpenRouteService API key
  mapboxAccessToken: 'pk.eyJ1IjoibGFzZXJleDA3IiwiYSI6ImNtYzVuY21pejBia3IyanFzN29hbHFvamYifQ.GNxvfI8uqs7G398AtzuMtw',

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

