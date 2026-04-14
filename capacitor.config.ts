import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.casalena.pos',
  appName: 'Casalena POS',
  webDir: 'out',
  server: {
    // IMPORTANTE: Sustituye esta URL por tu dominio real (Vercel/Netlify)
    // Esto es necesario para que tus rutas /api sigan funcionando en Android.
    url: 'https://casalena-pos.netlify.app', 
    cleartext: true
  }
};

export default config;
