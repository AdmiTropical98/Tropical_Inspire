import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.algartempo.frota',
  appName: 'AlgarTempo Frota',
  webDir: 'dist',
  server: {
    url: 'https://algartempo-frota.com',
    cleartext: true,
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: [
      'js.api.here.com',
      '*.hereapi.com',
      '*.supabase.co',
      'fleetapi-pt.cartrack.com',
      'algartempo-frota.com'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
      overlaysWebView: false
    }
  }
};

export default config;
