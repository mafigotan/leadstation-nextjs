import Script from "next/script";

/**
 * Google Analytics 4 tag for the public user sites (landing, blog, promotions).
 * Every hit carries the site handle twice:
 *  - event parameter `site_handle` (custom dimension, event scope) for the reports;
 *  - user property `ls_site` (custom dimension, user scope) because the Realtime API only filters on user-scoped dimensions.
 * The dashboard reads both back through the GA4 Data API (src/lib/analytics/ga.ts).
 */
export function SiteAnalytics({ handle }: { handle: string }) {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  if (!id || !/^G-[A-Z0-9]+$/.test(id)) return null;
  const h = handle.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ls-ga" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());` +
          `gtag('set','user_properties',{ls_site:'${h}'});` +
          `gtag('config','${id}',{site_handle:'${h}'});`}
      </Script>
    </>
  );
}
