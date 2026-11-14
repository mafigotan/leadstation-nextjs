/** Marks every screen of a non-production deployment (staging, previews) so it is never mistaken for the live site. */
export function EnvBadge() {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (!env || env === "production") return null;
  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-[90] rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold tracking-wide text-white shadow">
      STAGING
    </div>
  );
}
