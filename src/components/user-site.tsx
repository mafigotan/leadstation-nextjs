// Header, footer and cards shared by the public user site pages.
import Link from "next/link";
import { blogUrl, siteUrl, userUrl } from "@/lib/site";
import { SiteAdminLinks } from "@/components/site-admin-links";
import { PROMO_STATE_LABEL, dotDate, periodText, promoDaysLeft, type PostCard, type PromoCard, type PublicSite } from "@/lib/user-site";

export function siteName(site: PublicSite) {
  return site.name || site.handle;
}

export function SiteHeader({ site, active }: { site: PublicSite; active?: "promotions" | "blog" }) {
  const name = siteName(site);
  const nav = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`px-3 py-3 text-[15px] sm:px-4 ${on ? "border-b-2 border-slate-900 font-bold text-slate-900" : "font-medium text-slate-600 hover:text-slate-900"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-6">
        <Link href={userUrl(site.handle)} className="flex min-w-0 items-center gap-3 py-1">
          {site.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.logo_url} alt={name} className="h-10 w-auto max-w-[180px] object-contain" />
          ) : null}
          {(!site.logo_url || site.name) && <span className="truncate text-lg font-bold text-slate-900">{name}</span>}
        </Link>
        <nav aria-label="사이트 메뉴" className="flex items-center">
          {nav(userUrl(site.handle, "promotions"), "프로모션", active === "promotions")}
          {nav(blogUrl(site.handle), "블로그", active === "blog")}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ site }: { site: PublicSite }) {
  const name = siteName(site);
  const line1 = [
    site.company_name && `상호 ${site.company_name}`,
    site.ceo_name && `대표 ${site.ceo_name}`,
    site.business_no && `사업자등록번호 ${site.business_no}`,
  ].filter(Boolean);
  const line2 = [
    site.address && `주소 ${site.address}`,
    site.contact_phone && `연락처 ${site.contact_phone}`,
    site.contact_email && `이메일 ${site.contact_email}`,
  ].filter(Boolean);
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-1.5 px-4 py-10 text-sm leading-relaxed text-slate-600 sm:px-6">
        <p className="text-base font-bold text-slate-900">{name}</p>
        {line1.length > 0 && <p>{line1.join(" · ")}</p>}
        {line2.length > 0 && <p>{line2.join(" · ")}</p>}
        <div className="flex flex-wrap justify-between gap-2 pt-3 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} {name}. All rights reserved.</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Powered by LEADstation</span>
            <SiteAdminLinks handle={site.handle} mainUrl={siteUrl()} />
          </span>
        </div>
      </div>
    </footer>
  );
}

export function SiteShell({ site, active, children }: { site: PublicSite; active?: "promotions" | "blog"; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader site={site} active={active} />
      <main className="flex-1">{children}</main>
      <SiteFooter site={site} />
    </div>
  );
}

function Thumb({ url, alt, label, dim }: { url?: string; alt?: string; label?: string; dim?: boolean }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt ?? ""} loading="lazy" className={`aspect-[3/2] w-full rounded-xl object-cover ${dim ? "grayscale" : ""}`} />
  ) : (
    <div className="flex aspect-[3/2] w-full items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-xs text-slate-400">{label}</div>
  );
}

const badgeClass: Record<PromoCard["state"], string> = {
  live: "bg-slate-900 text-white",
  upcoming: "bg-indigo-600 text-white",
  ended: "bg-slate-500 text-white",
};

export function PromoBadge({ state }: { state: PromoCard["state"] }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeClass[state]}`}>{PROMO_STATE_LABEL[state]}</span>;
}

export function PromoGridCard({ handle, p }: { handle: string; p: PromoCard }) {
  return (
    <Link href={userUrl(handle, p.slug)} className="group flex flex-col gap-2">
      <div className="relative">
        <Thumb url={p.image} alt={p.headline} dim={p.state === "ended"} />
        <span className="absolute left-3 top-3"><PromoBadge state={p.state} /></span>
      </div>
      <h2 className="mt-1 text-lg font-bold leading-snug group-hover:underline">{p.headline}</h2>
      {p.subheadline && <p className="line-clamp-2 text-sm text-slate-600">{p.subheadline}</p>}
      {periodText(p) && <p className="text-xs text-slate-500">{periodText(p)}</p>}
    </Link>
  );
}

export function FeaturedPromo({ handle, p }: { handle: string; p: PromoCard }) {
  const ended = p.state === "ended";
  const left = ended ? null : promoDaysLeft(p.ends_on);
  return (
    <section className="mx-auto max-w-6xl px-4 pb-4 pt-10 sm:px-6 sm:pt-12">
      <p className="mb-3 text-sm font-bold text-slate-500">{ended ? "최근 프로모션" : "지금 진행 중인 프로모션"}</p>
      <Link
        href={userUrl(handle, p.slug)}
        className={`group grid overflow-hidden rounded-2xl border md:grid-cols-2 ${ended ? "border-slate-200" : "border-slate-300 hover:shadow-md"}`}
      >
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.headline} className={`aspect-[3/2] h-full w-full object-cover md:aspect-auto md:min-h-[340px] ${ended ? "grayscale" : ""}`} />
        ) : (
          <div className="aspect-[3/2] w-full bg-gradient-to-br from-slate-100 to-slate-200 md:aspect-auto md:min-h-[340px]" />
        )}
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <PromoBadge state={p.state} />
            {periodText(p) && <span className="text-sm text-slate-500">{periodText(p)}</span>}
            {left !== null && left >= 0 && <span className="text-sm font-semibold text-slate-700">{left === 0 ? "오늘 마감" : `D-${left}`}</span>}
          </div>
          <h1 className={`text-2xl font-bold leading-snug sm:text-4xl ${ended ? "text-slate-600" : ""}`}>{p.headline}</h1>
          {p.subheadline && <p className="text-base leading-relaxed text-slate-600 sm:text-lg">{p.subheadline}</p>}
          {ended && <p className="text-sm text-slate-500">이 프로모션은 종료되었어요. 다음 프로모션 소식을 기다려 주세요.</p>}
          <span className={`mt-1 self-start rounded-lg px-5 py-3 text-sm font-bold ${ended ? "border border-slate-400 text-slate-700" : "bg-slate-900 text-white"}`}>
            {ended ? "내용 보기 →" : "자세히 보기 →"}
          </span>
        </div>
      </Link>
    </section>
  );
}

export function PostGridCard({ handle, p }: { handle: string; p: PostCard }) {
  return (
    <Link href={blogUrl(handle, p.slug)} className="group flex flex-col gap-2">
      <Thumb url={p.header_image?.url} alt={p.header_image?.alt ?? p.title} />
      <h3 className="mt-1 text-lg font-bold leading-snug group-hover:underline">{p.title}</h3>
      {p.meta_description && <p className="line-clamp-2 text-sm text-slate-600">{p.meta_description}</p>}
      <p className="text-xs text-slate-500">{dotDate(new Date(new Date(p.published_at).getTime() + 9 * 3600 * 1000).toISOString())}</p>
    </Link>
  );
}

export function Pager({ base, page, pages }: { base: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? base : `${base}?page=${n}`);
  const from = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => from + i);
  const cls = "flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm";
  return (
    <nav aria-label="페이지" className="mt-14 flex flex-wrap justify-center gap-2">
      {page > 1 && <Link href={href(page - 1)} className={`${cls} border border-slate-200 hover:bg-slate-50`}>← 이전</Link>}
      {nums.map((n) => (
        <Link key={n} href={href(n)} aria-current={n === page ? "page" : undefined} className={`${cls} ${n === page ? "bg-slate-900 font-bold text-white" : "border border-slate-200 hover:bg-slate-50"}`}>
          {n}
        </Link>
      ))}
      {page < pages && <Link href={href(page + 1)} className={`${cls} border border-slate-200 hover:bg-slate-50`}>다음 →</Link>}
    </nav>
  );
}
