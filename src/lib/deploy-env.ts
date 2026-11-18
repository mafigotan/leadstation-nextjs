// Where this build is running, on Vercel or Cloudflare Workers.
// APP_ENV / NEXT_PUBLIC_APP_ENV are set by hand on Cloudflare ("production" | "staging");
// Vercel's own variables stay as a fallback so the Vercel deployments keep working.

/** "production", "staging", "preview", "development" or "local". */
export function appEnv(): string {
  return (
    process.env.APP_ENV ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.VERCEL_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    "local"
  );
}

export const isProduction = () => appEnv() === "production";

/** Branch and commit baked in at build time (see next.config.ts). */
export const gitBranch = () => process.env.NEXT_PUBLIC_GIT_BRANCH || "";
export const gitSha = () => (process.env.NEXT_PUBLIC_GIT_SHA || "").slice(0, 7);
