import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.financeai.app',
  appName: 'FinanceAI',
  webDir: 'dist',
  server: {
    url: 'https://aplicativo-financeiro-woad-kappa.vercel.app',
    cleartext: false
  }
};

export default config;
