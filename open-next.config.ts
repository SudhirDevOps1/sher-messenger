import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext's Cloudflare adapter transforms the same Next.js app used by Vercel,
 * Netlify and Node into a workerd-compatible Worker plus static asset bundle.
 * Provider state stays outside this file: secrets are Worker secrets and the
 * selected Store adapter is controlled entirely by env flags.
 */
export default defineCloudflareConfig();
