"use client";

import { useActionState, useState } from "react";
import { updateSlug, type FormState } from "../actions";

export function SlugForm({ id, slug, prefix }: { id: string; slug: string; prefix: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateSlug.bind(null, id), {});
  const [value, setValue] = useState(slug);
  return (
    <form action={action} className="space-y-1 pt-2">
      <label className="text-xs font-medium text-slate-600" htmlFor="slug">주소 바꾸기</label>
      <p className="break-all text-[11px] text-slate-400">{prefix}</p>
      <div className="flex gap-2">
        <input
          id="slug"
          name="slug"
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          maxLength={50}
          className="input py-1.5"
          placeholder="winter-sale"
        />
        <button disabled={pending || value === slug} className="btn-secondary shrink-0 px-3 py-1.5">변경</button>
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.saved && <p className="text-xs text-emerald-700">주소를 바꿨어요.</p>}
    </form>
  );
}
