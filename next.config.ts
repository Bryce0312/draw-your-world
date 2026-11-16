import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["sharp", "@langchain/langgraph", "@langchain/langgraph-checkpoint"],
};
export default config;
