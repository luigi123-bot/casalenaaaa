import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer, dev }) => {
    // Only exclude venv from watch in development mode
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/.venv/**', '**/venv/**', '**/node_modules/**', '**/.git/**', '**/__pycache__/**'],
      };
    }

    return config;
  },

  // Silence Turbopack error when webpack is used
  turbopack: {},

  // Optimize for production
  reactStrictMode: true,

  // Exclude venv from static file serving
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  // Ignore Python files and venv during build trace
  outputFileTracingExcludes: {
    '**/*': [
      '**/.venv/**',
      '**/venv/**',
      '**/__pycache__/**',
      '**/*.py',
      '**/*.pyc',
    ],
  },
};

export default nextConfig;
