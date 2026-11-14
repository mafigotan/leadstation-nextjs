"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Shows a progress bar at the top and a "처리 중" badge while any request from the page is running:
 * page moves, saves (server actions), AI generation, uploads. Background prefetches are ignored.
 * Appears only after a short delay so instant responses don't flicker.
 */
export function GlobalLoading() {
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [nav, setNav] = useState(false);
  const pathname = usePathname();

  // A page move is finished once the path changes.
  useEffect(() => setNav(false), [pathname]);
  useEffect(() => {
    if (!nav) return;
    const t = setTimeout(() => setNav(false), 10000);
    return () => clearTimeout(t);
  }, [nav]);

  useEffect(() => {
    const w = window as Window & { __lsFetchPatched?: boolean };
    let count = 0;
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let slowTimer: ReturnType<typeof setTimeout> | undefined;

    const update = () => {
      clearTimeout(showTimer);
      clearTimeout(slowTimer);
      if (count > 0) {
        showTimer = setTimeout(() => setBusy(true), 150);
        slowTimer = setTimeout(() => setSlow(true), 1500);
      } else {
        setBusy(false);
        setSlow(false);
      }
    };
    const start = () => { count++; if (count === 1) update(); };
    const end = () => { count = Math.max(0, count - 1); if (count === 0) update(); };

    const isPrefetch = (init?: RequestInit, input?: RequestInfo | URL) => {
      const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      return h.get("next-router-prefetch") === "1" || h.get("purpose") === "prefetch";
    };

    // Link clicks to another page show the bar right away, until the new path renders.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (url.pathname !== location.pathname) setNav(true);
    };
    document.addEventListener("click", onClick, true);

    const original = window.fetch;
    if (!w.__lsFetchPatched) {
      w.__lsFetchPatched = true;
      window.fetch = async (input, init) => {
        if (isPrefetch(init, input)) return original(input, init);
        window.dispatchEvent(new Event("ls:req-start"));
        try {
          return await original(input, init);
        } finally {
          window.dispatchEvent(new Event("ls:req-end"));
        }
      };
    }
    window.addEventListener("ls:req-start", start);
    window.addEventListener("ls:req-end", end);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("ls:req-start", start);
      window.removeEventListener("ls:req-end", end);
      clearTimeout(showTimer);
      clearTimeout(slowTimer);
    };
  }, []);

  if (!busy && !nav) return null;
  return (
    <>
      <div className="ls-progress fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-indigo-100" role="progressbar" aria-label="처리 중">
        <div className="ls-progress-bar h-full w-1/3 bg-indigo-600" />
      </div>
      {slow && busy && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg" aria-live="polite">
          <span className="ls-spinner h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
          처리 중이에요...
        </div>
      )}
    </>
  );
}
