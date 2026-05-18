import type { CapacitorConfig } from '@capacitor/cli';

const liveReloadUrl = process.env.CAP_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.algartempo.frota',
  appName: 'AlgarTempo Frota',
  webDir: 'dist',
  server: {
    cleartext: true,
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'app.algartempo.local',
    allowNavigation: [
      'js.api.here.com',
      '*.hereapi.com',
      '*.supabase.co',
      'fleetapi-pt.cartrack.com',
      'algartempo-frota.com'
    ],
    ...(liveReloadUrl ? { url: liveReloadUrl } : {})
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2200,
      launchAutoHide: false,
      backgroundColor: '#0b2239',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0b2239',
      overlaysWebView: false
    }
  }
};

export default config;
