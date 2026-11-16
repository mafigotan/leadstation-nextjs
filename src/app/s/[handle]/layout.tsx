import { SiteAnalytics } from "@/components/site-analytics";

export default async function UserSiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return (
    <>
      {children}
      <SiteAnalytics handle={handle} />
    </>
  );
}
