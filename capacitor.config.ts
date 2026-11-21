const config = {
  appId: 'in.fitnova.app',
  appName: 'FITNOVA',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Geolocation: {
      enableHighAccuracy: true,
    },
    AdMob: {
      initializeForTesting: false,
    },
  },
};

export default config;
