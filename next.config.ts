import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The team keeps its guidance in PLAN.md / docs/, so skip the generated files.
  agentRules: false,
  transpilePackages: ["three", "@google/genai"],
  // The Next.js badge can sit on top of Start on iPhone.
  devIndicators: false,
  // Phone Safari uses the Cloudflare quick-tunnel host, not localhost.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
