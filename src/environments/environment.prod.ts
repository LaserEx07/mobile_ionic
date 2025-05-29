export const environment = {
  production: true,
  // Using local IP address for device testing
  // 🏠 HOME IP (current location)
  apiUrl: 'http://192.168.112.244:8000/api',
  // 🏫 SCHOOL IP: 'http://172.30.11.217:8000/api', // Your computer's IP address
  orsApiKey: '5b3ce3597851110001cf6248d05f92e32cab4d1da9db6036a3a53fe7', // Keep for fallback
  mapboxAccessToken: 'pk.eyJ1IjoianVucmVsMDcwNDA1IiwiYSI6ImNtYjNocGs1YjBxc2cydnB5OG14NmNzYTIifQ.FGsozY9ibdn28Rg91_msIg',

  // Firebase configuration from google-services.json
  firebase: {
    projectId: 'last-5acaf',
    messagingSenderId: '660101685392',
    appId: '1:660101685392:android:c7c81cb0ccca4f30cb7815',
    apiKey: 'AIzaSyA5H6_NGbhDlVZ4l67qEC_JNRmcXPQ-GAo'
  }
};