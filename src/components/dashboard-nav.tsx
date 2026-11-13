"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard/pages", label: "프로모션 페이지" },
  { href: "/dashboard/leads", label: "리드 관리" },
  { href: "/dashboard/writer", label: "AI 글쓰기" },
  { href: "/dashboard/newsletters", label: "AI 뉴스레터" },
  { href: "/dashboard/recipients", label: "수신자" },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
