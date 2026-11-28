import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1'],
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
};

export default config;
