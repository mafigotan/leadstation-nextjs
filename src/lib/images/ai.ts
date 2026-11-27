import "server-only";
import jpeg from "jpeg-js";
import { addUsage } from "@/lib/usage";
import { IMAGE_TOKENS } from "@/lib/plans";
import { IMAGE_RATIOS, IMAGE_STYLES, type ImageRatio, type ImageStyle } from "./options";

async function request(model: string, prompt: string, size: string) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, n: 1, size, quality: "medium", output_format: "jpeg" }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { b64_json?: string }[];
    error?: { message?: string; code?: string };
    usage?: { total_tokens?: number };
  };
  // Each successful image counts as a fixed number of AI tokens toward the site's combined AI limit.
  if (res.status === 200) addUsage("image", IMAGE_TOKENS);
  return { status: res.status, json };
}

/**
 * Generates an image with the OpenAI image API at the closest native size,
 * then center-crops it to the exact ratio. Returns JPEG bytes and the final size.
 */
export async function generateImage(description: string, style: ImageStyle | "", ratio: ImageRatio) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI 이미지 설정이 없어요. 환경 변수에 OPENAI_API_KEY를 넣고 다시 배포해 주세요.");
  }
  let prompt = description.trim().slice(0, 3000);
  if (!prompt) throw new Error("이미지 설명을 입력해 주세요.");
  const [, rw, rh] = IMAGE_RATIOS[ratio] ?? IMAGE_RATIOS["1:1"];
  if (style && IMAGE_STYLES[style]) prompt += `\n\n${IMAGE_STYLES[style][1]}`;
  if (rw / rh >= 2) prompt += `\nThe image will be cropped to a wide ${rw}:${rh} banner: keep the main subject in the vertical center with empty space above and below.`;
  prompt += "\nDo not include any text, letters, logos or watermarks in the image. Do not depict real people or trademarks.";

  const size = rw === rh ? "1024x1024" : rw > rh ? "1536x1024" : "1024x1536";
  const preferred = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  let { status, json } = await request(preferred, prompt, size);
  const detail = json.error?.message ?? "";
  if (status !== 200 && preferred !== "gpt-image-1" && (status === 404 || json.error?.code === "model_not_found" || /model/i.test(detail))) {
    ({ status, json } = await request("gpt-image-1", prompt, size));
  }
  return cropToRatio(imageBytes(status, json), rw, rh);
}

/** Turns an OpenAI image response into JPEG bytes, or throws a message the user can act on. */
function imageBytes(status: number, json: ImageResponse) {
  if (status !== 200) {
    const msg = json.error?.message ?? `HTTP ${status}`;
    if (/verif/i.test(msg)) throw new Error("OpenAI 조직 인증이 필요해요. platform.openai.com > Settings > Organization에서 Verify Organization을 마친 뒤 다시 시도해 주세요.");
    if (json.error?.code === "moderation_blocked" || /safety/i.test(msg)) throw new Error("이미지 AI가 안전 정책 때문에 이 이미지를 만들지 않았어요. 설명을 바꿔 다시 시도해 주세요.");
    if (status === 401) throw new Error("OpenAI API 키가 올바르지 않아요.");
    if (status === 429) throw new Error("OpenAI 사용 한도에 도달했어요. 크레딧이나 요청 한도를 확인해 주세요.");
    throw new Error(`이미지 AI 오류: ${msg}`);
  }
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("이미지 AI가 이미지를 돌려주지 않았어요. 다시 시도해 주세요.");
  return Buffer.from(b64, "base64");
}

type ImageResponse = { data?: { b64_json?: string }[]; error?: { message?: string; code?: string } };

async function requestEdit(model: string, image: Blob, prompt: string, size: string, fidelity: boolean) {
  const form = new FormData();
  form.append("model", model);
  form.append("image", image, image.type === "image/png" ? "source.png" : image.type === "image/webp" ? "source.webp" : "source.jpg");
  form.append("prompt", prompt);
  form.append("n", "1");
  form.append("size", size);
  form.append("quality", "medium");
  form.append("output_format", "jpeg");
  if (fidelity) form.append("input_fidelity", "high");
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as ImageResponse;
  if (res.status === 200) addUsage("image", IMAGE_TOKENS);
  return { status: res.status, json };
}

/**
 * Edits an existing image with an instruction (image-to-image, not a new picture):
 * the model gets the source image and is told to change only what the instruction asks.
 * The result is cropped back to the source's shape (width x height when known).
 */
export async function editImage(source: Blob, instruction: string, width: number | null, height: number | null) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI 이미지 설정이 없어요. 환경 변수에 OPENAI_API_KEY를 넣고 다시 배포해 주세요.");
  }
  const ask = instruction.trim().slice(0, 2000);
  if (!ask) throw new Error("어떻게 고칠지 적어 주세요.");
  if (source.size > 20 * 1024 * 1024) throw new Error("20MB 이하 이미지만 수정할 수 있어요.");
  const w = width && width > 0 ? width : 0;
  const h = height && height > 0 ? height : 0;
  const ratio = w && h ? w / h : 1;
  const size = Math.abs(ratio - 1) < 0.15 ? "1024x1024" : ratio > 1 ? "1536x1024" : "1024x1536";
  const prompt = [
    "Edit the provided image. This is a modification of the existing image, not a new picture.",
    "Keep the same composition, framing, subjects, style, colors and lighting, and change only what the instruction below asks for.",
    `Instruction: ${ask}`,
    "Do not add text, letters, logos or watermarks unless the instruction asks for them. Do not depict real people or trademarks.",
  ].join("\n");

  const preferred = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  let model = preferred;
  let fidelity = true;
  let { status, json } = await requestEdit(model, source, prompt, size, fidelity);
  for (let i = 0; i < 2 && status !== 200; i++) {
    const detail = json.error?.message ?? "";
    if (fidelity && /input_fidelity/i.test(detail)) fidelity = false;
    else if (model !== "gpt-image-1" && (status === 404 || json.error?.code === "model_not_found" || /model/i.test(detail))) model = "gpt-image-1";
    else break;
    ({ status, json } = await requestEdit(model, source, prompt, size, fidelity));
  }
  const bytes = imageBytes(status, json);
  if (!w || !h) {
    const img = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 40, maxMemoryUsageInMB: 256 });
    return { bytes, width: img.width, height: img.height };
  }
  return cropToRatio(bytes, w, h);
}

/**
 * Center-crops a JPEG to rw:rh and re-encodes it. Pure JS (jpeg-js) so it also runs
 * on Cloudflare Workers, where native modules like sharp are not available.
 */
export async function cropToRatio(input: Buffer | Uint8Array, rw: number, rh: number) {
  const img = jpeg.decode(input, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 40, maxMemoryUsageInMB: 256 });
  const w = img.width;
  const h = img.height;
  let cw = w;
  let ch = Math.round((w * rh) / rw);
  if (ch > h) {
    ch = h;
    cw = Math.round((h * rw) / rh);
  }
  // Already the right ratio: keep the original bytes (no quality loss, no CPU).
  if (cw === w && ch === h) return { bytes: Buffer.from(input), width: w, height: h };
  const left = Math.floor((w - cw) / 2);
  const top = Math.floor((h - ch) / 2);
  const out = new Uint8Array(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const from = ((top + y) * w + left) * 4;
    out.set(img.data.subarray(from, from + cw * 4), y * cw * 4);
  }
  const bytes = jpeg.encode({ data: out, width: cw, height: ch }, 86).data;
  return { bytes, width: cw, height: ch };
}
