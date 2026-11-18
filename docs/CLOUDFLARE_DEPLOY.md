# LEADstation Cloudflare 이전 절차 (안)

작성일: 2026-11-18 · 코드 준비 작업은 `staging` 브랜치에 반영됨 (wrangler.jsonc, open-next.config.ts, sharp → jpeg-js, APP_ENV)

## 0. 결론 요약

- 방식: **Cloudflare Workers + `@opennextjs/cloudflare` (OpenNext 어댑터)**. Cloudflare 가 공식으로 권장하는 Next.js 배포 방식이고, App Router · Server Actions · 미들웨어 · `after()` 를 지원한다. (예전의 `@cloudflare/next-on-pages` / Pages 방식은 Edge 런타임만 돼서 이 프로젝트엔 맞지 않음.)
- 요금제: **Workers Paid ($5/월) 필요**. 이유는 (1) 번들 크기 한도(무료 3MB, 유료 10MB 압축 기준)에 Anthropic SDK·Supabase·exceljs·nodemailer 가 들어가면 무료 한도를 넘을 가능성이 높고, (2) 요청당 CPU 시간 한도를 늘려야 하기 때문.
- 꼭 고쳐야 할 코드: **`sharp`(이미지 자르기)** 하나. Workers 에서 돌지 않는 네이티브 모듈이라 대체가 필요하다. 나머지는 설정 추가와 `VERCEL_*` 환경 변수 이름 정리 정도.
- 도메인: leadstation.kr 의 **네임서버를 Cloudflare 로 옮겨야** 와일드카드 서브도메인(`*.leadstation.kr`)을 Worker 에 연결할 수 있다.
- 순서: staging 용 Worker 로 먼저 띄워 확인 → 운영 Worker 준비 → DNS 전환(이때 실제 이전) → Vercel 정리.

## 1. 현재 구조 점검 결과

| 항목 | 현재 | Cloudflare(OpenNext)에서 |
|---|---|---|
| Next.js | 15.5.29, App Router, React 19 | 지원됨 |
| 미들웨어 (`src/middleware.ts`) | 서브도메인 → `/s/<handle>` rewrite, Supabase 세션 갱신 | 지원됨. Host 헤더 그대로 들어오므로 로직 변경 불필요 |
| Server Actions / API 라우트 | `api/cron/newsletters`, `api/unsubscribe/[token]`, 다수의 actions | 지원됨 |
| `after()` (`p/[slug]/actions.ts` 리드 알림 메일) | Vercel waitUntil | OpenNext 가 Workers `ctx.waitUntil` 로 연결해줌 |
| `maxDuration` (60~300초, AI 생성 화면) | Vercel 함수 시간 제한 | Workers 는 무시함. 대신 **CPU 시간** 한도가 적용됨. AI 응답을 기다리는 시간(I/O)은 CPU 시간에 안 잡히므로 대부분 문제 없음. `wrangler` 에 `limits.cpu_ms` 를 넉넉히(예: 60000~300000) 설정 |
| `sharp` (`src/lib/images/ai.ts` 의 `cropToRatio`) | AI 이미지 비율 자르기 + JPEG 변환 | **동작 안 함 → 교체 필요** (3장 참고) |
| `nodemailer` (SMTP 발송) | `SMTP_HOST` 가 있을 때만 사용 | 불확실. Workers 의 TCP 소켓 지원으로 동작할 수도 있지만 25번 포트는 막혀 있음. 운영은 SendGrid(HTTP API)를 쓰므로 SMTP 는 쓰지 않는 쪽을 권장 |
| SendGrid / Resend | HTTP API | 문제 없음 |
| `exceljs` (분석 엑셀 내보내기) | Node 라이브러리 | `nodejs_compat` 플래그로 동작 예상. 번들 크기에 영향 → 실제 빌드로 확인 |
| `node:crypto createSign` (GA 서비스 계정 JWT 서명) | Node crypto | `nodejs_compat` 에서 지원됨. 배포 후 GA 화면 확인 |
| `revalidatePath` (admin) | Vercel 캐시 | 페이지가 대부분 동적이라 큰 영향 없음. 필요하면 R2 증분 캐시를 붙임 |
| `next/image` | 사용 안 함 | 이미지 최적화 설정 불필요 |
| 예약 발송 크론 | Supabase `pg_cron` 이 `https://leadstation.kr/api/cron/newsletters` 호출 | 주소가 그대로면 **변경 없음**. (원하면 Workers Cron Trigger 로 옮길 수도 있음) |
| `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF/SHA`, `VERCEL_URL` | STAGING 표시, 오류 메시지, GA 상태 표시 | Cloudflare 에는 없음 → `APP_ENV` / `NEXT_PUBLIC_APP_ENV` 같은 자체 변수로 교체 |

사용 중인 파일: `src/components/env-badge.tsx`, `src/lib/supabase/middleware.ts`, `src/lib/analytics/config.ts`, `src/app/dashboard/pages/actions.ts`, `src/app/dashboard/analytics/page.tsx`.

## 2. 코드·설정 변경 목록 (작업 요청 시 staging 브랜치에서 진행)

1. 패키지 설치
   ```
   npm i @opennextjs/cloudflare@latest
   npm i -D wrangler@latest
   ```
2. `wrangler.jsonc` 추가 (예시)
   ```jsonc
   {
     "name": "leadstation",
     "main": ".open-next/worker.js",
     "compatibility_date": "2026-11-01",
     "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
     "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
     "limits": { "cpu_ms": 300000 },
     "observability": { "enabled": true },
     "env": {
       "staging": { "name": "leadstation-staging" }
     }
   }
   ```
3. `open-next.config.ts` 추가 (`defineCloudflareConfig()` 기본값으로 시작, 캐시가 필요해지면 R2 연결)
4. `next.config.ts` 에 개발용 `initOpenNextCloudflareForDev()` 한 줄 추가
5. `package.json` 스크립트
   ```
   "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
   "deploy":  "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
   "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
   ```
6. `.gitignore` 에 `.open-next`, `.dev.vars` 추가
7. `sharp` 교체 (3장)
8. `VERCEL_*` 변수 → `APP_ENV`, `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_BRANCH` 등으로 교체 (Vercel 에서도 같이 설정해두면 이전 기간에 양쪽 다 동작)
9. 로컬에서 `npm run preview` 로 Workers 런타임 확인 → 번들 크기·오류 체크

## 3. sharp 대체 방안

`cropToRatio` 는 OpenAI 가 준 이미지를 가운데 기준으로 원하는 비율로 자르고 JPEG 로 저장한다. 선택지:

- **적용함: 순수 JS `jpeg-js`** — OpenAI 에 JPEG 으로 받아서 디코드 → 가운데 자르기 → JPEG(품질 86) 인코드. 1536×1024 기준 약 0.25초. 비율이 이미 맞으면 원본을 그대로 씀.
- A. WASM 이미지 라이브러리로 교체: 예) `@jsquash/jpeg` + `@jsquash/png` 로 디코드 → 픽셀 배열에서 직접 자르기 → JPEG 인코드. 서버에서 그대로 처리되고 외부 서비스가 필요 없다. 번들이 조금 커지고 CPU 를 쓰므로 CPU 한도를 넉넉히 둔다.
- **B. Cloudflare Images 바인딩**: `env.IMAGES.input(...).transform({ width, height, fit: "cover" }).output({ format: "image/jpeg" })`. 코드가 가장 간단하지만 Images 유료 사용량이 생긴다.
- **C. 자르지 않고 원본 저장 + 표시할 때 CSS `object-fit: cover`**: 가장 간단하지만 저장되는 이미지 비율이 달라져 뉴스레터 메일(이메일 클라이언트는 CSS 지원이 약함)에서 문제가 생길 수 있어 비권장.

## 4. Cloudflare 계정·도메인 설정

### 4-1. 도메인을 Cloudflare 로 옮기기
1. Cloudflare 대시보드 → **Add a domain** → `leadstation.kr` (Full setup).
2. Cloudflare 가 기존 DNS 레코드를 스캔한다. **메일 관련 레코드(MX, SPF/DKIM TXT, SendGrid 인증 CNAME 등)가 빠짐없이 들어왔는지 반드시 대조**한다. 빠지면 메일 발송 인증이 깨진다.
   - SendGrid 인증용 CNAME 은 **DNS only(회색 구름)** 로 둔다.
   - 이 단계에서는 웹 레코드(`@`, `*`, `www`)를 기존 Vercel 값 그대로, DNS only 로 둔다 → 네임서버를 바꿔도 사이트가 Vercel 에서 계속 동작한다.
3. 도메인 등록 업체(가비아 등)에서 네임서버를 Cloudflare 가 알려준 2개로 변경. 반영까지 수 시간~최대 48시간.
4. SSL/TLS 모드 **Full (strict)**.

### 4-2. Worker 에 도메인 연결 (실제 전환 시점)
- `leadstation.kr` (와 `www`): Worker → Settings → Domains & Routes → **Custom Domain** 으로 추가. DNS 레코드·인증서가 자동 생성된다.
- `*.leadstation.kr` (유저 사이트 서브도메인): Custom Domain 은 와일드카드를 지원하지 않으므로 **Route** 로 연결한다.
  1. DNS 에 `*` 레코드를 **Proxied(주황 구름)** 로 둔다. (값은 아무 주소나 되는 더미 `AAAA 100::` 를 많이 씀. 기존 Vercel CNAME 은 삭제)
  2. Worker 에 Route `*.leadstation.kr/*` 추가.
  3. 와일드카드 인증서: Cloudflare 기본(Universal SSL) 인증서가 `leadstation.kr` + `*.leadstation.kr` 을 포함하므로 1단계 서브도메인은 추가 비용 없이 HTTPS 가 된다.
- `staging.leadstation.kr` 을 쓰려면 staging Worker 에 Custom Domain 으로 따로 연결 (미들웨어가 `staging` 서브도메인은 유저 사이트로 보지 않도록 이미 처리되어 있음). Route 보다 Custom Domain 이 우선하므로 `*` 와 겹쳐도 된다.

## 5. 배포 파이프라인 (staging → production 흐름 유지)

Cloudflare **Workers Builds** (GitHub 연결)를 쓰면 지금처럼 push 만으로 배포된다.

| Worker | 연결 브랜치 | 주소 | Supabase |
|---|---|---|---|
| `leadstation-nextjs-staging` | `staging` | `leadstation-staging.<계정>.workers.dev` 또는 `staging.leadstation.kr` | staging 프로젝트 |
| `leadstation-nextjs` | `main` | `leadstation.kr`, `*.leadstation.kr` | 운영 프로젝트 |

설정 방법 (Workers & Pages → Create → Import a repository → `mafigotan/leadstation-nextjs`):
- Build command: `npx opennextjs-cloudflare build`
- Deploy command: production 은 `npx opennextjs-cloudflare deploy`, staging Worker 는 `npx opennextjs-cloudflare deploy --env staging`
- `APP_ENV` 는 wrangler.jsonc 의 vars 로 자동 설정됨(`keep_vars: true` 라 대시보드에서 넣은 변수는 배포해도 지워지지 않음)
- Production branch: 각각 `main` / `staging`. 다른 브랜치 자동 빌드는 끔.

평소 작업 순서(DEPLOY.md)는 그대로: staging push → 확인 → 운영 DB SQL → `main` fast-forward.

## 6. 환경 변수 이전

중요: `NEXT_PUBLIC_*` 는 **빌드할 때 코드에 박히는 값**이라, Workers Builds 의 **Build variables** 에 넣어야 한다. 나머지 서버 비밀값은 Worker 의 **Variables and Secrets(런타임)** 에 Secret 으로 넣는다. (`NEXT_PUBLIC_*` 는 런타임에도 같이 넣어두면 안전)

| 이름 | 넣는 곳 | 비고 |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY | Build + Runtime | Worker 별로 staging/운영 값 |
| NEXT_PUBLIC_SITE_URL | Build + Runtime | 운영 `https://leadstation.kr`, staging 은 staging 주소 |
| NEXT_PUBLIC_ROOT_DOMAIN | Build + Runtime | 운영 `leadstation.kr`, staging 은 비움 |
| NEXT_PUBLIC_GA_MEASUREMENT_ID | Build + Runtime | |
| NEXT_PUBLIC_APP_ENV (새로 추가) | Build + Runtime | `production` / `staging` (기존 `NEXT_PUBLIC_VERCEL_ENV` 대체) |
| SUPABASE_SERVICE_ROLE_KEY | Runtime Secret | |
| ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENAI_IMAGE_MODEL | Runtime (키는 Secret) | |
| SENDGRID_API_KEY / RESEND_API_KEY / SMTP_* , MAIL_PROVIDER, MAIL_FROM_ADDRESS, ADMIN_NOTIFY_EMAIL | Runtime (키는 Secret) | SMTP 는 비권장 |
| CRON_SECRET | Runtime Secret | Supabase pg_cron 의 값과 동일해야 함 |
| GA_PROPERTY_ID, GA_MEASUREMENT_ID, GOOGLE_SERVICE_ACCOUNT_JSON | Runtime (JSON 은 Secret) | JSON 은 base64 로 넣어도 됨(코드가 지원) |
| APP_ENV (새로 추가) | Runtime | 기존 `VERCEL_ENV` 대체 |

Vercel 값 내보내기: `vercel env pull .env.production --environment=production` 로 받아서 옮기면 빠르다. (이 파일은 커밋하지 말 것)
로컬 테스트용은 `.dev.vars` 파일에 같은 형식으로 둔다.

## 7. 외부 서비스 설정 확인

- **Supabase Auth → URL Configuration**: 운영 도메인은 그대로라 변경 없음. staging 주소가 바뀌면 Site URL / Redirect URLs 를 새 주소로 추가.
- **Supabase pg_cron**: 호출 주소가 `https://leadstation.kr/api/cron/newsletters` 그대로면 변경 없음. staging 을 크론으로 돌리지 않는 정책도 그대로.
- **SendGrid**: 도메인 인증 DNS 레코드가 Cloudflare DNS 로 잘 옮겨졌는지 SendGrid 화면에서 재확인(Verify).
- **GA / Google 서비스 계정**: 변경 없음.

## 8. 전환(컷오버) 순서와 롤백

1. staging Worker 배포 → workers.dev 주소에서 전 기능 점검
   - 로그인/로그아웃, 대시보드, 프로모션 페이지 생성(가장 긴 AI 생성), 글쓰기 AI, 뉴스레터 AI·발송, 이미지 AI 생성(sharp 대체 확인), 엑셀 내보내기, GA 분석 화면, 리드 신청 + 알림 메일(`after()`), 수신 거부 링크, `/s/<handle>` 유저 사이트
2. 운영 Worker 를 같은 코드로 배포 (아직 도메인 연결 안 함, workers.dev 주소로 운영 DB 연결 확인)
3. 네임서버가 Cloudflare 로 옮겨진 상태에서, 트래픽 적은 시간에:
   - `leadstation.kr`, `www` Custom Domain 연결 / `*` 레코드를 Proxied 로 바꾸고 Route 연결
   - 서브도메인 유저 사이트, 로그인 쿠키, 크론 발송(1분 뒤 로그) 확인
4. **롤백**: 문제가 생기면 Worker 의 도메인/Route 를 제거하고 DNS 레코드를 Vercel 값(DNS only)으로 되돌리면 몇 분 안에 Vercel 로 복귀한다. 그래서 **안정될 때까지 Vercel 프로젝트는 지우지 않는다.**
5. 1~2주 안정 후 Vercel 의 도메인 연결 해제, DEPLOY.md 를 Cloudflare 기준으로 갱신.

## 9. 주의할 점

- Workers 는 요청마다 CPU 시간 한도가 있다(유료 최대 5분). AI 응답 대기는 해당 안 되지만, 큰 엑셀·이미지 처리·대량 발송 루프는 CPU 를 쓴다. 대량 발송은 이미 크론에서 나눠 처리하므로 괜찮을 것으로 봄.
- 응답 크기·요청 본문 한도: 유료 기준 요청 본문 100MB. CSV 업로드 등 문제 없음.
- 로그: Workers Logs(observability)를 켜서 Vercel 로그 대신 사용.
- 비용: Workers Paid $5/월 기본 + 요청/CPU 초과분. 현재 트래픽이면 기본 요금 안에 들어올 가능성이 큼.
