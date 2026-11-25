// Checks shared by the 문의하기 modal (as you type) and its server action.

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
// 010-1234-5678, 011-123-4567, 02-123-4567, 031-1234-5678, 070-1234-5678, 1588-1234
const PHONE_RE = /^(01[016789]-\d{3,4}-\d{4}|02-\d{3,4}-\d{4}|0(3[1-3]|4[1-4]|5[1-5]|6[1-4]|70|50\d?)-\d{3,4}-\d{4}|1[5-9]\d{2}-\d{4})$/;

/** Formats digits as a Korean phone number while typing: 01012345678 -> 010-1234-5678. */
export function formatPhone(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 11);
  if (/^1[5-9]/.test(d)) return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4, 8)}`;
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export function emailError(v: string): string | undefined {
  const s = v.trim();
  if (!s) return "이메일을 입력해 주세요.";
  if (s.length > 200 || !EMAIL_RE.test(s)) return "올바른 이메일 주소를 입력해 주세요. 예: name@company.com";
}

export function phoneError(v: string): string | undefined {
  const s = formatPhone(v);
  if (!s) return "전화번호를 입력해 주세요.";
  if (!PHONE_RE.test(s)) return "올바른 전화번호를 입력해 주세요. 예: 010-1234-5678";
}
