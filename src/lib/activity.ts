// How activity log rows read in Korean ("프로모션 페이지 \"겨울 이벤트\" 게시했어요").

export const ACTIONS: Record<string, string> = {
  created: "만들었어요",
  updated: "수정했어요",
  published: "게시했어요",
  unpublished: "비공개로 바꿨어요",
  deleted: "삭제했어요",
  sent: "발송했어요",
  scheduled: "발송을 예약했어요",
  generated: "AI로 만들었어요",
  uploaded: "업로드했어요",
  added: "추가했어요",
  member_added: "님을 멤버로 추가했어요",
  member_removed: "님을 멤버에서 뺐어요",
  role_changed: "",
};
export const TYPES: Record<string, string> = {
  page: "프로모션 페이지",
  article: "글",
  newsletter: "뉴스레터",
  media: "이미지",
  recipients: "",
  member: "",
};

type Row = { action: string; target_type: string; title: string };

export function activitySubject(a: Row) {
  if (a.action === "role_changed") return `권한 변경: ${a.title}`;
  return TYPES[a.target_type] ? `${TYPES[a.target_type]}${a.title ? ` "${a.title}"` : ""}` : a.title;
}

export function activityVerb(a: Row) {
  return ACTIONS[a.action] ?? a.action;
}
