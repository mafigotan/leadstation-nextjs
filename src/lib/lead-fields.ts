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

/** Fields required unless the user chose otherwise: everything but 기타. */
export const defaultRequired = (fields: LeadField[]) => fields.filter((f) => f !== "message");

/**
 * Fields of a form section and which of them must be filled in.
 * Legacy forms (no list saved) ask for name, email, phone and message. Without a saved required list, all but 기타 are required.
 */
export function formFields(fields: LeadField[] | undefined, required?: LeadField[]): { fields: LeadField[]; required: LeadField[] } {
  const list = fields?.length ? fields : LEGACY_FIELDS;
  if (required) return { fields: list, required: list.filter((f) => required.includes(f)) };
  return { fields: list, required: fields?.length ? defaultRequired(list) : ["name", "email"] };
}
