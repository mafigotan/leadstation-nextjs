import Link from "next/link";
import { ContactOpenButton, ContactWidget } from "@/components/marketing/contact";

// Shared pieces of the public service pages (leadstation.kr, /features, /pricing, /guide).

export const COMPANY = {
  name: "(주)네오엠씨",
  bizNo: "108-81-65820",
  address: "서울시 서소문로 89, 순화빌딩 17층",
  phone: "02-2039-8430",
  email: "help@neomc.co.kr",
};

const NAV = [
  { href: "/features", label: "핵심 기능" },
  { href: "/pricing", label: "요금제" },
  { href: "/guide", label: "이용 매뉴얼" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-baseline gap-2 text-slate-900">
      <span className="text-xl font-bold tracking-tight">
        LEAD<span className="text-indigo-600">station</span>
      </span>
      <span className="text-xs text-slate-500">리드스테이션</span>
    </Link>
  );
}

export function MarketingHeader({ active }: { active?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
        <Logo />
        <nav aria-label="주요 메뉴" className="order-3 flex w-full gap-5 overflow-x-auto text-sm font-medium sm:order-none sm:w-auto sm:gap-7">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap ${active === n.href ? "text-indigo-600" : "text-slate-700 hover:text-slate-900"}`}
            >
              {n.label}
            </Link>
          ))}
          <ContactOpenButton className="whitespace-nowrap text-slate-700 hover:text-slate-900">도입 문의</ContactOpenButton>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-secondary hidden sm:inline-flex">로그인</Link>
          <Link href="/login" className="btn-primary">30일 무료로 시작하기</Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-10 px-4 py-12 text-sm text-slate-600">
        <div className="min-w-0 flex-1 basis-80">
          <Logo />
          <p className="mt-3 leading-relaxed">
            {COMPANY.name} · 사업자등록번호 {COMPANY.bizNo}
            <br />
            {COMPANY.address}
            <br />
            대표전화 <a href={`tel:${COMPANY.phone.replaceAll("-", "")}`} className="hover:text-slate-900">{COMPANY.phone}</a> · 이메일{" "}
            <a href={`mailto:${COMPANY.email}`} className="hover:text-slate-900">{COMPANY.email}</a>
          </p>
          <p className="mt-3 text-slate-500">© {new Date().getFullYear()} NEOMC Co., Ltd. All rights reserved.</p>
        </div>
        <nav aria-label="하단 메뉴" className="flex gap-12">
          <div className="flex flex-col gap-2">
            <strong className="text-slate-900">서비스</strong>
            <Link href="/features" className="hover:text-slate-900">핵심 기능</Link>
            <Link href="/pricing" className="hover:text-slate-900">요금제</Link>
            <Link href="/guide" className="hover:text-slate-900">이용 매뉴얼</Link>
          </div>
          <div className="flex flex-col gap-2">
            <strong className="text-slate-900">계정</strong>
            <Link href="/login" className="hover:text-slate-900">로그인</Link>
            <Link href="/login" className="hover:text-slate-900">무료로 시작하기</Link>
          </div>
        </nav>
      </div>
    </footer>
  );
}

export function MarketingShell({ active, children }: { active?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col break-keep bg-white">
      <MarketingHeader active={active} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
      <ContactWidget />
    </div>
  );
}

export function AiBadge({ children = "AI" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
        <path d="M8 0l1.8 5.2L15 7l-5.2 1.8L8 14l-1.8-5.2L1 7l5.2-1.8z" />
      </svg>
      {children}
    </span>
  );
}

export function Prompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
      <AiBadge>요청</AiBadge>
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

export function SectionTitle({ eyebrow, title, desc, center }: { eyebrow?: string; title: React.ReactNode; desc?: React.ReactNode; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow && <p className="text-sm font-semibold text-indigo-600">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl font-bold leading-snug tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {desc && <p className="mt-4 text-lg leading-relaxed text-slate-600">{desc}</p>}
    </div>
  );
}

export function CtaBand({ title, secondary }: { title: React.ReactNode; secondary?: { href: string; label: string } }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="flex flex-wrap items-center justify-between gap-8 rounded-2xl bg-slate-900 px-8 py-12 text-white sm:px-12">
        <div className="min-w-0 flex-1 basis-96">
          <h2 className="text-2xl font-bold leading-snug sm:text-3xl">{title}</h2>
          <p className="mt-3 text-slate-300">
            도입 상담 {COMPANY.phone} · {COMPANY.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className="inline-flex items-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100">
            30일 무료로 시작하기
          </Link>
          <Link
            href={secondary?.href ?? `mailto:${COMPANY.email}`}
            className="inline-flex items-center rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            {secondary?.label ?? "이메일 문의"}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** A small stand-in for a product screenshot: a browser frame with a title and skeleton lines. */
export function MockScreen({ title, rows = 3, className = "" }: { title: string; rows?: number; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`} aria-hidden="true">
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="ml-2 truncate text-xs text-slate-500">{title}</span>
      </div>
      <div className="space-y-2 p-4">
        <div className="h-3 w-2/3 rounded bg-indigo-100" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-2.5 rounded bg-slate-100" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}
