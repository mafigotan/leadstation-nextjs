"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "요약" },
  { href: "/admin/users", label: "유저" },
  { href: "/admin/sites", label: "사이트" },
  { href: "/admin/payments", label: "결제 내역" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((i) => {
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
