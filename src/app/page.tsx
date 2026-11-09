import Link from "next/link";

const tools = [
  { name: "Lead Collector", desc: "AI가 프로모션 페이지를 만들고, 유입된 고객 정보를 한곳에서 관리해요.", ready: true },
  { name: "Neo AI Writer", desc: "웹사이트 글과 제품 소개 페이지를 AI로 작성해요.", ready: false },
  { name: "Neo AI Newsletter", desc: "뉴스레터 생성부터 발송, 관리까지 AI로 해결해요.", ready: false },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
        <span className="text-xl font-bold">
          LEAD<span className="text-indigo-600">station</span>
        </span>
        <Link href="/login" className="btn-primary">시작하기</Link>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="mb-4 text-sm font-semibold text-indigo-600">AI Powered Marketing Platform</p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          잠재 고객을 모으고,<br />관계를 이어가세요
        </h1>
        <p className="mt-6 text-lg text-slate-600">
          프로모션 페이지 제작, 콘텐츠 작성, 뉴스레터 발송까지 하나의 플랫폼에서.
        </p>
        <Link href="/login" className="btn-primary mt-10 px-6 py-3 text-base">무료로 시작하기</Link>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-24 sm:grid-cols-3">
        {tools.map((t) => (
          <div key={t.name} className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{t.name}</h2>
              {!t.ready && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">준비 중</span>}
            </div>
            <p className="mt-2 text-sm text-slate-600">{t.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
