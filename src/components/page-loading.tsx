/** Placeholder shown in the content area while a dashboard page is loading. */
export function PageLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-400" aria-busy="true">
      <span className="ls-spinner h-8 w-8 rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
      <p className="text-sm">불러오는 중이에요...</p>
    </div>
  );
}
