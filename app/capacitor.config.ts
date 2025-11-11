import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mjapp.score',
  appName: 'Mahjong Score App',
  webDir: 'dist',
  ios: {
    path: '../ios'
  }
};

export default config;
