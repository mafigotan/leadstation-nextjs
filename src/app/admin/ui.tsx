// Shared bits for the super admin screens.
import Link from "next/link";
import { siteBlockReason, type SiteStatusFields } from "@/lib/site";

export const METHOD_LABEL: Record<string, string> = { transfer: "계좌이체", card: "카드(오프라인)", cash: "현금", other: "기타" };

export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export function fmtDate(v?: string | null) {
  if (!v) return "-";
  return v.length > 10 ? new Date(v).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : v;
}

export function fmtDateTime(v?: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });
}

export function SiteStatus({ site }: { site: SiteStatusFields }) {
  const r = siteBlockReason(site);
  const [label, cls] =
    r === null
      ? ["활성", "bg-emerald-50 text-emerald-700"]
      : r === "inactive"
        ? ["비활성", "bg-slate-200 text-slate-600"]
        : r === "expired"
          ? ["기간 만료", "bg-red-50 text-red-700"]
          : ["시작 전", "bg-amber-50 text-amber-700"];
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export function UserStatus({ suspended }: { suspended: boolean }) {
  return suspended ? (
    <span className="whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">정지</span>
  ) : (
    <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">정상</span>
  );
}

export function Pager({ page, total, size, href }: { page: number; total: number; size: number; href: (p: number) => string }) {
  const last = Math.max(1, Math.ceil(total / size));
  if (last <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-4 text-sm">
      {page > 1 ? <Link href={href(page - 1)} className="text-indigo-600 hover:underline">이전</Link> : <span className="text-slate-300">이전</span>}
      <span className="text-slate-500">{page} / {last}</span>
      {page < last ? <Link href={href(page + 1)} className="text-indigo-600 hover:underline">다음</Link> : <span className="text-slate-300">다음</span>}
    </div>
  );
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}

export function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
