import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Required for Azure App Service (non-serverless)
};

export default nextConfig;
