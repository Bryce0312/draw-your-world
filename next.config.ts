import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  // Only deployment flags are bundled. Provider credentials stay in Functions env.
  env: { DYW_NETLIFY_BUILD: process.env.NETLIFY === "true" || process.env.WALL_STORAGE === "netlify" ? "1" : "0" },
  ...(process.env.DYW_TEST_DIST ? { distDir: process.env.DYW_TEST_DIST } : {}),
  serverExternalPackages: ["sharp", "@langchain/langgraph", "@langchain/langgraph-checkpoint"],
};
export default config;
