import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSiteLive } from "@/lib/site";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; middleware refreshes the session.
          }
        },
      },
    },
  );
}

/** Returns the signed-in user, or redirects to /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return { supabase, user: user! };
}

export type Profile = {
  user_id: string;
  full_name: string;
  phone: string;
  company: string;
  active_site_id: string | null;
  suspended_at?: string | null;
  suspended_reason?: string;
};
export type Site = {
  id: string;
  handle: string;
  name: string;
  status?: string;
  active_from?: string | null;
  active_until?: string | null;
  service_started_on?: string | null;
};
export type SiteRole = "admin" | "member";
export type Membership = { role: SiteRole; site: Site };

/** The signed-in user's profile and the sites they belong to. */
export async function loadAccount() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("user_id, full_name, phone, company, active_site_id, suspended_at, suspended_reason").eq("user_id", user.id).maybeSingle<Profile>(),
    supabase.from("site_members").select("role, sites(id, handle, name, status, active_from, active_until, service_started_on)").eq("user_id", user.id).order("created_at"),
  ]);
  const memberships = ((rows ?? []) as unknown as { role: SiteRole; sites: Site | null }[])
    .filter((r) => r.sites)
    .map((r) => ({ role: r.role, site: r.sites! }));
  return { supabase, user, profile: profile ?? null, memberships };
}

/**
 * Signed-in user, their profile and the site they are working on (with their role there).
 * Redirects to /welcome until the profile is filled in and the user belongs to a site.
 */
export async function requireSite() {
  const { supabase, user, profile, memberships } = await loadAccount();
  const { redirect } = await import("next/navigation");
  if (profile?.suspended_at) redirect("/blocked");
  if (!profile || !profile.full_name || !memberships.length) redirect("/welcome");
  let current = memberships.find((m) => m.site.id === profile!.active_site_id);
  if (!current) {
    current = memberships.find((m) => isSiteLive(m.site)) ?? memberships[0];
    await supabase.from("profiles").update({ active_site_id: current.site.id }).eq("user_id", user.id);
  }
  if (!isSiteLive(current.site)) redirect("/blocked");
  return { supabase, user, profile: profile!, site: current.site, role: current.role, memberships };
}

/** Same as requireSite but only for site admins. */
export async function requireSiteAdmin() {
  const ctx = await requireSite();
  if (ctx.role !== "admin") throw new Error("사이트 관리자만 할 수 있어요.");
  return ctx;
}

/** Whether the signed-in user is a platform operator (super admin). */
export async function isSuperAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.rpc("is_super_admin");
  return data === true;
}

/** Signed-in super admin, or a 404 for everyone else. */
export async function requireSuperAdmin() {
  const { supabase, user } = await requireUser();
  if (!(await isSuperAdmin(supabase))) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return { supabase, user };
}
