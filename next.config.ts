import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  // Standard Next.js way to exclude files from the build output trace
  outputFileTracingExcludes: {
    '**/*': [
      '**/venv/**',
      '**/.venv/**',
      '**/__pycache__/**',
      '**/*.py',
      '**/*.pyc',
    ],
  },
};

export default nextConfig;
