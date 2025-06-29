export const environment = {
  production: true,

  // API Configuration for production
  // Change this to your production server's URL
  apiUrl: 'http://192.168.112.210:8000/api',

  // Health check endpoint (automatically derived if not specified)
  healthCheckUrl: 'http://192.168.112.210:8000/up',

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