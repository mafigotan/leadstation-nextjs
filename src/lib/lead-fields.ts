// Fields a promotion page's lead form can ask for. "message" is shown as 기타 (free text).
export const LEAD_FIELDS = [
  { key: "name", label: "이름" },
  { key: "email", label: "이메일" },
  { key: "phone", label: "전화번호" },
  { key: "address", label: "주소" },
  { key: "gender", label: "성별" },
  { key: "age", label: "나이" },
  { key: "nationality", label: "국적" },
  { key: "message", label: "기타" },
] as const;

export type LeadField = (typeof LEAD_FIELDS)[number]["key"];
export const LEAD_FIELD_KEYS = LEAD_FIELDS.map((f) => f.key) as LeadField[];
export const LEAD_FIELD_LABEL = Object.fromEntries(LEAD_FIELDS.map((f) => [f.key, f.label])) as Record<LeadField, string>;
export const GENDERS = ["남성", "여성"] as const;

/** Forms made before field selection keep their original fields. */
export const LEGACY_FIELDS: LeadField[] = ["name", "email", "phone", "message"];

export function cleanFields(input: unknown): LeadField[] {
  if (!Array.isArray(input)) return [];
  return LEAD_FIELD_KEYS.filter((k) => input.includes(k));
}

/** Fields of a form section: legacy forms (no list saved) ask for name, email, phone and message. */
export function formFields(fields: LeadField[] | undefined): { fields: LeadField[]; required: LeadField[] } {
  if (!fields?.length) return { fields: LEGACY_FIELDS, required: ["name", "email"] };
  return { fields, required: fields.filter((f) => f !== "message") };
}
