import type { Profile } from "@/lib/supabase/server";

/** 이름, 전화번호, 회사명 inputs shared by the welcome form and My Profile. */
export function ProfileFields({ profile }: { profile?: Partial<Profile> | null }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="full_name">이름</label>
        <input id="full_name" name="full_name" required defaultValue={profile?.full_name ?? ""} maxLength={50} className="input" placeholder="홍길동" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="phone">전화번호</label>
        <input id="phone" name="phone" type="tel" required defaultValue={profile?.phone ?? ""} maxLength={30} className="input" placeholder="010-1234-5678" autoComplete="tel" />
      </div>
      <div>
        <label className="label" htmlFor="company">회사명</label>
        <input id="company" name="company" required defaultValue={profile?.company ?? ""} maxLength={100} className="input" placeholder="예: 네오엠씨" autoComplete="organization" />
      </div>
    </>
  );
}
