import Link from "next/link";
import { activitySubject, activityVerb } from "@/lib/activity";
import type { Site } from "@/lib/supabase/server";
import type { LeadWithPage } from "@/lib/leads";
import { blogUrl, userUrl } from "@/lib/site";
import { answerJoinRequest, markAllNotificationsRead, markNotificationRead } from "./actions";

export type Notification = { id: string; kind: string; title: string; body: string; ref_id: string | null; created_at: string };
export type Activity = { id: number; user_id: string | null; action: string; target_type: string; target_id: string | null; title: string; created_at: string };
export type Member = { user_id: string; email: string; full_name: string; role: "admin" | "member" };

const NL_STATUS: Record<string, string> = { draft: "초안", scheduled: "예약", sending: "발송 중", sent: "발송 완료", failed: "실패" };

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

function itemHref(a: Activity) {
  if (!a.target_id || a.action === "deleted") return null;
  if (a.target_type === "page") return `/dashboard/pages/${a.target_id}`;
  if (a.target_type === "article") return `/dashboard/writer/${a.target_id}`;
  if (a.target_type === "newsletter") return `/dashboard/newsletters/${a.target_id}`;
  if (a.target_type === "media") return "/dashboard/media";
  return null;
}

function Card({ title, href, more = "전체 보기", children }: { title: string; href?: string; more?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">{title}</h2>
        {href && <Link href={href} className="text-sm text-indigo-600 hover:underline">{more}</Link>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-slate-400">{children}</p>;
}

function Badge({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{children}</span>
  );
}

export type DashboardData = {
  name: string;
  site: Site;
  isAdmin: boolean;
  notifications: Notification[];
  open: Set<string>;
  pages: { id: string; title: string; status: string }[];
  articles: { id: string; title: string; keyword: string; status: string }[];
  newsletters: { id: string; title: string; subject: string; status: string }[];
  media: { id: string; url: string; prompt: string }[];
  leads: LeadWithPage[];
  people: (Member & { items: Activity[] })[];
};

export function DashboardView({ name, site, isAdmin, notifications, open, pages, articles, newsletters, media, leads, people }: DashboardData) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{name} 님, 안녕하세요</h1>
          <p className="mt-1 text-sm text-slate-500">
            {site.name || site.handle} ·{" "}
            <a href={userUrl(site.handle)} target="_blank" className="text-indigo-600 hover:underline">
              {userUrl(site.handle).replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>{" "}
            · {isAdmin ? "관리자" : "사용자"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/pages/new" className="btn-secondary">프로모션 페이지 만들기</Link>
          <Link href="/dashboard/writer/new" className="btn-secondary">글 쓰기</Link>
          <Link href="/dashboard/newsletters" className="btn-secondary">뉴스레터</Link>
        </div>
      </div>

      {notifications.length > 0 && (
        <section className="card border-indigo-200 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">
              알림 <span className="ml-1 rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white">{notifications.length}</span>
            </h2>
            <form action={markAllNotificationsRead}>
              <button className="text-sm text-slate-500 hover:text-slate-800">모두 읽음</button>
            </form>
          </div>
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-slate-500">{[n.body, ago(n.created_at)].filter(Boolean).join(" · ")}</p>
                </div>
                {n.kind === "join_request" && n.ref_id && open.has(n.ref_id) && isAdmin ? (
                  <div className="flex gap-2">
                    <form action={answerJoinRequest.bind(null, n.ref_id, true)}>
                      <button className="btn-primary px-3 py-1.5 text-sm">승인</button>
                    </form>
                    <form action={answerJoinRequest.bind(null, n.ref_id, false)}>
                      <button className="btn-secondary px-3 py-1.5 text-sm">거절</button>
                    </form>
                  </div>
                ) : null}
                <form action={markNotificationRead.bind(null, n.id)}>
                  <button className="text-xs text-slate-400 hover:text-slate-700" title="읽음으로 표시하면 목록에서 사라져요">읽음</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="최근 프로모션 페이지" href="/dashboard/pages">
          {pages.length ? (
            <ul className="space-y-2">
              {pages.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Link href={`/dashboard/pages/${p.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">{p.title}</Link>
                  <Badge on={p.status === "published"}>{p.status === "published" ? "게시" : "초안"}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>아직 만든 페이지가 없어요.</Empty>
          )}
        </Card>
        <Card title="최근 AI 글" href="/dashboard/writer">
          {articles.length ? (
            <ul className="space-y-2">
              {articles.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <Link href={`/dashboard/writer/${a.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">{a.title || a.keyword || "제목 없음"}</Link>
                  {a.status === "published" ? (
                    <a href={blogUrl(site.handle)} target="_blank"><Badge on>게시</Badge></a>
                  ) : (
                    <Badge on={false}>초안</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>아직 쓴 글이 없어요.</Empty>
          )}
        </Card>
        <Card title="최근 뉴스레터" href="/dashboard/newsletters">
          {newsletters.length ? (
            <ul className="space-y-2">
              {newsletters.map((n) => (
                <li key={n.id} className="flex items-center gap-2">
                  <Link href={`/dashboard/newsletters/${n.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">{n.subject || n.title}</Link>
                  <Badge on={n.status === "sent"}>{NL_STATUS[n.status] ?? n.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>아직 만든 뉴스레터가 없어요.</Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="최근 리드 10건" href="/dashboard/leads">
            {leads.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">이름</th>
                      <th className="py-2 pr-3 font-medium">연락처</th>
                      <th className="py-2 pr-3 font-medium">페이지</th>
                      <th className="py-2 font-medium">받은 시각</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2 pr-3 font-medium">{l.name}</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {l.email}
                          {l.phone && <span className="block text-xs text-slate-400">{l.phone}</span>}
                        </td>
                        <td className="max-w-[12rem] truncate py-2 pr-3 text-slate-600">{l.pages?.title ?? "-"}</td>
                        <td className="whitespace-nowrap py-2 text-slate-500">{ago(l.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>아직 받은 리드가 없어요.</Empty>
            )}
          </Card>
        </div>
        <Card title="최근 이미지" href="/dashboard/media">
          {media.length ? (
            <div className="grid grid-cols-3 gap-2">
              {media.map((m) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.id} src={m.url} alt={m.prompt || ""} className="aspect-square w-full rounded-md bg-slate-100 object-cover" />
              ))}
            </div>
          ) : (
            <Empty>아직 이미지가 없어요.</Empty>
          )}
        </Card>
      </div>

      <Card title="멤버별 최근 활동" href="/dashboard/profile" more="멤버 관리">
        <div className="grid gap-5 md:grid-cols-2">
          {people.map((p) => (
            <div key={p.user_id}>
              <p className="mb-2 text-sm font-semibold">
                {p.full_name || p.email}
                <span className="ml-1.5 text-xs font-normal text-slate-400">{p.role === "admin" ? "관리자" : "사용자"}</span>
              </p>
              {p.items.length ? (
                <ul className="space-y-1.5 border-l-2 border-slate-100 pl-3">
                  {p.items.map((a) => {
                    const href = itemHref(a);
                    const what = activitySubject(a);
                    return (
                      <li key={a.id} className="text-sm">
                        {href ? <Link href={href} className="hover:underline">{what}</Link> : what}
                        {" "}
                        {activityVerb(a)}
                        <span className="ml-1.5 text-xs text-slate-400">{ago(a.created_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">아직 활동이 없어요.</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
