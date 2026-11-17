export const maxDuration = 300;
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSite } from "@/lib/supabase/server";
import { mainDomainUrl, userUrl } from "@/lib/site";
import type { PageRow } from "@/lib/types";
import { deletePage, setPublished } from "../actions";
import { PageEditor } from "./page-editor";
import { CopyButton } from "@/components/copy-button";
import { SlugForm } from "./slug-form";
import { PeriodForm } from "./period-form";
import { listTermOptions } from "@/lib/terms";
import { PUBLIC_SITE_COLUMNS, type PublicSite } from "@/lib/user-site";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user, site } = await requireSite();
  const { data: page } = await supabase
    .from("pages")
    .select("*")
    .eq("id", id)
    .eq("site_id", site.id)
    .single<PageRow>();
  if (!page) notFound();

  const termOptions = await listTermOptions(supabase, site.id);
  const { data: siteInfo } = await supabase.from("sites").select(PUBLIC_SITE_COLUMNS).eq("id", site.id).single<PublicSite>();
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("page_id", id);

  const publicUrl = userUrl(site.handle, page.slug);
  const published = page.status === "published";

  return (
    <div>
      <Link
        href="/dashboard/pages"
        className="text-sm text-slate-500 hover:underline"
      >
        ← 목록으로
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {page.promo_no && <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{page.promo_no}</span>}
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
        >
          {published ? "공개 중" : "초안"}
        </span>
        <a
          href={
            published ? publicUrl : mainDomainUrl(site.handle, page.slug)
          }
          target="_blank"
          className="text-sm text-indigo-600 hover:underline"
        >
          {published ? "페이지 열기" : "미리보기"}
        </a>
      </div>
      <PageEditor
        id={page.id}
        title={page.title}
        content={page.content}
        userId={user.id}
        termOptions={termOptions}
        site={siteInfo ?? ({ ...site, logo_url: "", company_name: "", ceo_name: "", business_no: "", address: "", contact_phone: "", contact_email: "" } as PublicSite)}
        aside={
          <div className="space-y-4">
            <div className="card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">상태</span>
                <span
                  className={`text-sm font-semibold ${published ? "text-emerald-700" : "text-slate-500"}`}
                >
                  {published ? "공개 중" : "초안"}
                </span>
              </div>
              <form action={setPublished.bind(null, page.id, !published)}>
                <button
                  className={
                    published ? "btn-secondary w-full" : "btn-primary w-full"
                  }
                >
                  {published ? "비공개로 전환" : "페이지 공개하기"}
                </button>
              </form>
              <Link
                href={
                  published
                    ? publicUrl
                    : mainDomainUrl(site.handle, page.slug)
                }
                target="_blank"
                className="btn-secondary w-full"
              >
                {published ? "페이지 열기" : "미리보기"}
              </Link>
            </div>

            <PeriodForm id={page.id} startsOn={page.starts_on ?? null} endsOn={page.ends_on ?? null} />

            <div className="card space-y-2 p-5">
              <p className="text-sm font-medium">공개 주소</p>
              <p className="break-all rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                {publicUrl}
              </p>
              <CopyButton text={publicUrl} />
              <SlugForm
                id={page.id}
                slug={page.slug}
                prefix={publicUrl.slice(0, publicUrl.length - page.slug.length)}
              />
              {!published && (
                <p className="text-xs text-slate-500">
                  공개하기 전에는 이 주소로 신청을 받을 수 없어요.
                </p>
              )}
            </div>

            <div className="card space-y-2 p-5">
              <p className="text-sm font-medium">수집된 리드</p>
              <p className="text-3xl font-bold">
                {count ?? 0}
                <span className="ml-1 text-base font-normal text-slate-500">
                  명
                </span>
              </p>
              <Link
                href={`/dashboard/leads?page=${page.id}`}
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                리드 보기 →
              </Link>
            </div>

            <form action={deletePage.bind(null, page.id)}>
              <button className="btn-danger w-full">페이지 삭제</button>
            </form>
          </div>
        }
      />
    </div>
  );
}
