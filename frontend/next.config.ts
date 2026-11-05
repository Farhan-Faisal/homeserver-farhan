import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // `npm run build` makes plain files (in out/) for nginx to serve. No Node server in production.
  output: isDev ? undefined : "export",
  images: { unoptimized: true },  // no image server either

  // While developing (`npm run dev`), the page is at server-fbf:3000 with no nginx in front,
  // so Next forwards /api/... to the API itself. Built files don't need this: nginx does it.
  ...(isDev && {
    async rewrites() {
      return [{ source: "/api/:path*", destination: `${process.env.API_URL ?? "http://127.0.0.1:8091"}/api/:path*` }];
    },
  }),

  // Let the dev server answer requests that come in by the server's name, over Tailscale.
  allowedDevOrigins: ["server-fbf", "100.113.90.61"],
};

export default nextConfig;