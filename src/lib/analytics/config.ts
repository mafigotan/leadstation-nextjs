/** Reads and checks the GA environment variables (no secrets are returned). */

function clean(v: string | undefined): string {
  return (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

/** The GA4 measurement id (G-XXXX), tolerant of stray quotes, spaces and lower case. */
export function measurementId(): string | null {
  const v = clean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.GA_MEASUREMENT_ID).toUpperCase();
  return /^G-[A-Z0-9]{4,}$/.test(v) ? v : null;
}

export function propertyId(): string | null {
  const v = clean(process.env.GA4_PROPERTY_ID).replace(/^properties\//, "");
  return /^\d{5,}$/.test(v) ? v : null;
}

export type ServiceAccount = { client_email: string; private_key: string };

export function serviceAccount(): ServiceAccount | null {
  const raw = clean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!raw) return null;
  try {
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(text) as Partial<ServiceAccount>;
    if (!sa.client_email || !sa.private_key) return null;
    return { client_email: sa.client_email, private_key: sa.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export type CheckState = "ok" | "missing" | "invalid";
export type GaCheck = { name: string; state: CheckState; detail: string };

/** Per-variable status for the setup panel. Shows only non-secret hints. */
export function gaChecks(): GaCheck[] {
  const mRaw = clean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.GA_MEASUREMENT_ID);
  const pRaw = clean(process.env.GA4_PROPERTY_ID);
  const jRaw = clean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const sa = serviceAccount();
  const mid = measurementId();
  return [
    {
      name: "NEXT_PUBLIC_GA_MEASUREMENT_ID",
      state: mid ? "ok" : mRaw ? "invalid" : "missing",
      detail: mid ? mid : mRaw ? `G-로 시작하는 측정 ID가 아니에요 (앞 4글자: ${mRaw.slice(0, 4)}…, 길이 ${mRaw.length})` : "이 배포에서 값이 보이지 않아요",
    },
    {
      name: "GA4_PROPERTY_ID",
      state: propertyId() ? "ok" : pRaw ? "invalid" : "missing",
      detail: propertyId() ? propertyId()! : pRaw ? `숫자 속성 ID가 아니에요 (앞 4글자: ${pRaw.slice(0, 4)}…)` : "이 배포에서 값이 보이지 않아요",
    },
    {
      name: "GOOGLE_SERVICE_ACCOUNT_JSON",
      state: sa ? "ok" : jRaw ? "invalid" : "missing",
      detail: sa ? sa.client_email : jRaw ? "JSON으로 읽히지 않거나 client_email/private_key가 없어요" : "이 배포에서 값이 보이지 않아요",
    },
  ];
}

export function deploymentLabel(): string {
  const env = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || "local";
  const ref = process.env.VERCEL_GIT_COMMIT_REF;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  return [env, ref, sha].filter(Boolean).join(" · ");
}
