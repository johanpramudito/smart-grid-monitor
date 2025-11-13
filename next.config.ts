import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Required for Azure App Service (non-serverless)
  // Note: instrumentation.ts is automatically enabled in Next.js 15+
};

export default nextConfig;
