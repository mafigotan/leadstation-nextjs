import Link from "next/link";
import { closeLimitRequest } from "./actions";
import { Table, Th, fmtDateTime } from "./ui";

const KIND: Record<string, string> = { newsletter: "뉴스레터 발송", text: "AI 본문 토큰", image: "AI 이미지 토큰" };

export type LimitRequest = {
  id: string; kinds: string[]; message: string; status: string; created_at: string;
  site_id?: string; sites?: { handle: string; name: string } | null;
};

/** Requests from site members to raise their limits. */
export function LimitRequestTable({ requests, showSite }: { requests: LimitRequest[]; showSite?: boolean }) {
  return (
    <Table head={<>{showSite && <Th>사이트</Th>}<Th>요청 항목</Th><Th>메시지</Th><Th>요청 시각</Th><Th>상태</Th></>}>
      {requests.map((r) => (
        <tr key={r.id}>
          {showSite && (
            <td className="px-3 py-2">
              <Link href={`/admin/sites/${r.site_id}`} className="font-medium text-indigo-600 hover:underline">{r.sites?.name || r.sites?.handle}</Link>
            </td>
          )}
          <td className="px-3 py-2">{(r.kinds ?? []).map((k) => KIND[k] ?? k).join(", ")}</td>
          <td className="px-3 py-2 text-slate-600">{r.message || "-"}</td>
          <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDateTime(r.created_at)}</td>
          <td className="px-3 py-2">
            {r.status === "pending" ? (
              <form action={closeLimitRequest.bind(null, r.id)}>
                <button className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">처리 완료</button>
              </form>
            ) : (
              <span className="text-xs text-slate-400">처리됨</span>
            )}
          </td>
        </tr>
      ))}
    </Table>
  );
}
