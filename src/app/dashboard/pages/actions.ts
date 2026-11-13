"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { generatePageContent } from "@/lib/ai/generate-page";
import { makeSlug } from "@/lib/slug";
import { SLUG_RE } from "@/lib/site";
import { sanitizeSections, withSections } from "@/lib/page-sections";
import { BriefSchema, THEMES, type PageContent, type Theme } from "@/lib/types";

export type FormState = { error?: string; saved?: boolean };

export async function createPage(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();

  const parsed = BriefSchema.safeParse({
    product: formData.get("product"),
    description: formData.get("description"),
    audience: formData.get("audience") ?? "",
    offer: formData.get("offer") ?? "",
    tone: formData.get("tone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };

  let content;
  try {
    content = await generatePageContent(parsed.data);
  } catch (e) {
    console.error("generatePageContent failed", e);
    return { error: e instanceof Error && e.message.startsWith("AI") ? e.message : "페이지 생성 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  const { data, error } = await supabase
    .from("pages")
    .insert({
      user_id: user.id,
      title: parsed.data.product,
      slug: makeSlug(),
      brief: parsed.data,
      content,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("insert page failed", error);
    return { error: "페이지를 저장하지 못했어요." };
  }

  revalidatePath("/dashboard/pages");
  redirect(`/dashboard/pages/${data.id}`);
}

export async function setPublished(id: string, published: boolean) {
  const { supabase } = await requireUser();
  await supabase
    .from("pages")
    .update({ status: published ? "published" : "draft" })
    .eq("id", id);
  revalidatePath(`/dashboard/pages/${id}`);
  revalidatePath("/dashboard/pages");
}

export async function deletePage(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("pages").delete().eq("id", id);
  revalidatePath("/dashboard/pages");
  redirect("/dashboard/pages");
}

export async function updateSlug(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return { error: "영문 소문자, 숫자, 하이픈(-)으로 1~50자로 정해주세요." };
  if (slug === "blog") return { error: "blog는 블로그 주소로 쓰여서 사용할 수 없어요." };
  const { data, error } = await supabase.from("pages").update({ slug }).eq("id", id).select("id").single();
  if (error || !data) return { error: error?.code === "23505" ? "이미 다른 페이지에서 쓰고 있는 주소예요." : "주소를 바꾸지 못했어요." };
  revalidatePath(`/dashboard/pages/${id}`);
  revalidatePath("/dashboard/pages");
  return { saved: true };
}

export async function savePageSections(
  id: string,
  input: { title: string; theme: string; sections: unknown },
): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { data: page } = await supabase.from("pages").select("content").eq("id", id).single();
  if (!page) return { error: "페이지를 찾을 수 없어요." };
  const sections = sanitizeSections(input.sections);
  const theme = (THEMES as readonly string[]).includes(input.theme) ? (input.theme as Theme) : "indigo";
  const content = withSections({ ...(page.content as PageContent), theme }, sections);
  const title = String(input.title ?? "").trim().slice(0, 200) || content.headline;
  const { error } = await supabase.from("pages").update({ title, content }).eq("id", id);
  if (error) return { error: "저장하지 못했어요: " + error.message };
  revalidatePath(`/dashboard/pages/${id}`);
  revalidatePath("/dashboard/pages");
  return {};
}
