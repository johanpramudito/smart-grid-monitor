import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Required for Azure App Service (non-serverless)

  // Note: In Next.js 15, instrumentation.ts is automatically enabled when the file exists
  // No experimental flag needed
};

export default nextConfig;
