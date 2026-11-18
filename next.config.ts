import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Branch and commit of this build, shown on the STAGING diagnostics.
  // Vercel and Cloudflare Workers Builds name them differently.
  env: {
    NEXT_PUBLIC_GIT_BRANCH: process.env.VERCEL_GIT_COMMIT_REF || process.env.WORKERS_CI_BRANCH || "",
    NEXT_PUBLIC_GIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || process.env.WORKERS_CI_COMMIT_SHA || "",
  },
};

export default nextConfig;

// Lets `next dev` use Cloudflare bindings locally. No effect on Vercel builds.
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev()).catch(() => {});
}
