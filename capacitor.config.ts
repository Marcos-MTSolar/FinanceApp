import type { CapacitorConfig } from '@capacitor/cli';

/**
 * ARQUITETURA DO APK — LEIA ANTES DE ALTERAR
 * ─────────────────────────────────────────────
 * O APK do Capacitor funciona em modo "bundled assets":
 *  - O Vite gera o frontend em /dist (npm run build)
 *  - O `cap sync` copia /dist para android/app/src/main/assets/public/
 *  - O Gradle empacota esses assets dentro do APK
 *
 * Isso significa: CADA ALTERAÇÃO NO CÓDIGO EXIGE UM NOVO APK.
 * A Vercel faz o deploy do frontend na web automaticamente,
 * mas o APK só atualiza quando você rodar: npm run build:android
 * e gerar um novo .apk via Android Studio ou GitHub Actions.
 *
 * Para desenvolvimento com live reload apontando para a Vercel,
 * descomente server.url abaixo (mas NÃO commite isso em produção).
 */
const config: CapacitorConfig = {
  appId: 'com.financeai.app',
  appName: 'FinanceAI',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
    // url: 'https://SEU-PROJETO.vercel.app', // ← USE SOMENTE em dev/live-reload. Remova para produção.
    allowNavigation: ['api.antigravity.dev', '*.antigravity.dev'],
  },
  android: {
    backgroundColor: '#030712', // Corresponde ao bg-gray-950 do Tailwind
    loggingBehavior: 'none',    // Desativa logs verbose em produção
    overScrollMode: 'never',
    allowMixedContent: true,
  },
};

export default config;

