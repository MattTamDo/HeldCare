import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The team keeps its guidance in PLAN.md / docs/, so skip the generated files.
  agentRules: false,
};

export default nextConfig;
