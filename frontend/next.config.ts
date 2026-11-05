import type { NextConfig } from "next";
import path from "node:path";

// Optional same-origin proxy. When TRACELEDGER_API_PROXY is set (for example
// https://traceledger-demo-api.onrender.com), the Next.js server forwards
// /api/* to FastAPI and the browser never makes a cross-site request. That
// keeps the HttpOnly session cookie first-party without needing SameSite=None.
//
// A bare hostname is accepted too, so Render's `fromService` property `host`
// can be used directly.
const rawProxy = process.env.TRACELEDGER_API_PROXY?.trim();
const apiProxy = rawProxy
  ? (/^https?:\/\//i.test(rawProxy) ? rawProxy : `https://${rawProxy}`).replace(/\/$/, "")
  : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  // FastAPI owns trailing-slash policy for /api/*. Without this, Next.js
  // answers /api/accounts/ with a 308 to /api/accounts while FastAPI answers
  // /api/accounts with a 307 to /api/accounts/, which ping-pongs forever.
  skipTrailingSlashRedirect: true,
  eslint: {
    // The project keeps lint separate from the production build.
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    if (!apiProxy) return [];
    // The trailing-slash rule comes first because `:path*` drops the trailing
    // slash. FastAPI treats /api/accounts/ as canonical and redirects
    // /api/accounts to it, so both forms must reach the backend unchanged.
    return [
      { source: "/api/:path*/", destination: `${apiProxy}/api/:path*/` },
      { source: "/api/:path*", destination: `${apiProxy}/api/:path*` },
    ];
  },
};

export default nextConfig;
