import type { NextConfig } from "next";
import path from "node:path";

// Optional same-origin proxy. When TRACELEDGER_API_PROXY is set (for example
// https://traceledger-api.onrender.com), the Next.js server forwards /api/*
// to FastAPI and the browser never makes a cross-site request. That keeps the
// HttpOnly session cookie first-party without needing SameSite=None.
const apiProxy = process.env.TRACELEDGER_API_PROXY?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  eslint: {
    // The project keeps lint separate from the production build.
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    if (!apiProxy) return [];
    return [{ source: "/api/:path*", destination: `${apiProxy}/api/:path*` }];
  },
};

export default nextConfig;
