import { requireSite } from "@/lib/supabase/server";
import { listMedia } from "./actions";
import { MediaLibrary } from "./library";

export const maxDuration = 120;
export const metadata = { title: "이미지 라이브러리 | LEADstation" };

export default async function MediaPage() {
  const { user } = await requireSite();
  const items = await listMedia(60);
  return <MediaLibrary userId={user.id} initial={items} />;
}
