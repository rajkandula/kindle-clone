import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle (`node .next/standalone/server.js`, see Dockerfile)
  output: "standalone",
  // Chat streaming + chapter writing can run long on serverless platforms.
  // pdfkit reads its font metrics from node_modules at runtime — don't bundle it
  serverExternalPackages: ["mongoose", "pdfkit"],
  // A stray pnpm-lock.yaml in the home directory makes Turbopack misinfer
  // the workspace root — pin it to this project. (process.cwd(), not
  // __dirname: the compiled config file doesn't live in the project root.)
  turbopack: { root: process.cwd() },
  // The desktop-download page became the install page; old links still land.
  async redirects() {
    return [{ source: "/download", destination: "/install", permanent: true }];
  },
  // OAuth discovery endpoints for the claude.ai connector — dot-folders
  // aren't routable in the app dir, so serve them via rewrites.
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/metadata/as",
      },
      {
        source: "/.well-known/oauth-authorization-server/:path*",
        destination: "/api/oauth/metadata/as",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth/metadata/pr",
      },
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        destination: "/api/oauth/metadata/pr",
      },
    ];
  },
};

export default nextConfig;
