import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
};

export default config;
