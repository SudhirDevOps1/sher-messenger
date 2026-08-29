import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * node-postgres loads pg-cloudflare conditionally at runtime. Next's output
   * tracer cannot see that dynamic require and OpenNext consequently copied the
   * package manifest without its `dist/` implementation. Include it explicitly
   * so the exact same bundle works in Node and workerd. This does not activate
   * Postgres on Cloudflare — DB_TARGET=turso remains the recommended edge path.
   */
  outputFileTracingIncludes: {
    "/*": ["./node_modules/pg-cloudflare/dist/**/*", "./node_modules/pg-cloudflare/esm/**/*"],
  },

  /** Keep WebCrypto and the route handlers on server runtimes, never browser-polyfilled. */
  serverExternalPackages: ["pg-cloudflare"],

  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
