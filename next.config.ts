import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
