import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["sharp", "@langchain/langgraph", "@langchain/langgraph-checkpoint"],
};
export default config;
