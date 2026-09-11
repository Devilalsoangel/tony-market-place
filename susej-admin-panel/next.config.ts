import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 dev servers gate HMR/dev assets to canonical origins. Without
  // this, ws://.../webpack-hmr answers 401 when the app is opened via
  // http://127.0.0.1 - and in React 19.2 the hydration bootstrap waits on
  // that dead socket forever, leaving EVERY button as dead HTML (no error
  // is surfaced). Allow both loopback names so either URL fully hydrates.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Turbopack infers the workspace root from lockfiles and picks the PARENT
  // repo stub (social-commerce/package-lock.json), which makes /api/app/*
  // routes 404 in `next dev`. Pin the root to this project (verified live).
  turbopack: {
    root: __dirname,
  },
  // CORS for the susej mobile app running as a WEB app (expo web). The app
  // origin (http://localhost:8081 - Metro) calls these APIs cross-origin;
  // native fetch ignores CORS so this was invisible on devices until the
  // web showcase path. Preflight OPTIONS must carry the allow headers too,
  // otherwise every x-app-key/Authorization request fails before it fires.
  async headers() {
    return [
      // Public app APIs (mobile app via Metro) — wildcard is intentional: these
      // are authenticated via x-app-key / Bearer, never via cookie, so
      // credentialed CORS is not needed.
      {
        source: "/api/app/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PATCH,PUT,DELETE,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, x-app-key",
          },
        ],
      },
      // Admin data APIs are cookie-authenticated (susej_session) and MUST be
      // same-origin — no wildcard here. Browser blocks '*' with credentials
      // anyway; leaving it off forces same-origin which is the correct policy.
      // CORS for admin is intentionally not set (same-origin only).
    ];
  },
};

export default nextConfig;
