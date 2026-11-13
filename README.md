# LEADstation

AI Powered Marketing Platform. **Lead Collector**와 **AI 뉴스레터**가 들어 있어요.

- AI(Claude)로 프로모션 랜딩 페이지 문구 생성, 직접 수정, 공개 URL 발행 (`/p/[slug]`)
- 공개 페이지의 신청 폼으로 리드 수집 (개인정보 동의, 마케팅 수신 동의, 스팸 방지)
- 대시보드에서 리드 목록, 페이지별 필터, 검색, CSV 내보내기(엑셀 한글 호환)

### AI 뉴스레터

- 이메일 내용과 명령 프롬프트로 Claude가 블록 단위 뉴스레터 작성, 기존 본문 AI 수정, 이전 본문 되돌리기
- 블록 에디터(대표 이미지, 소제목, 본문, 이미지, 카드, 썸네일 리스트, 버튼, 구분선)와 실시간 미리보기, 이미지 업로드, AI 이미지 생성(사진·일러스트·만화·인포그래픽)
- 템플릿 4종(카드, 모던, 미니멀, 텍스트), 톤 4종, 수신자 이름 자동 인사말
- 수신자·그룹 관리, CSV 가져오기(엑셀 한글 CSV 지원), Lead Collector 리드 가져오기(마케팅 동의자만)
- 테스트 메일, 전체·그룹·직접 입력 발송, 예약 발송, 발송 진행률, 실패 재발송 (SendGrid, SMTP, Resend 지원)
- 수신거부 링크와 원클릭 수신거부 헤더, 발신 정보(보내는 사람, 회신 주소, 푸터, 로고, 강조 색, 브랜드 정보)

## 기술 스택

Next.js 15 (App Router, Server Actions) · Supabase (Auth, Postgres, RLS) · Tailwind CSS 4 · Anthropic SDK · Vercel 배포

## 시작하기

1. [Supabase](https://supabase.com)에서 프로젝트를 만들어요.
2. `supabase/migrations/0001_lead_collector.sql` 파일을 열어 **안의 SQL 전체를 복사**한 뒤, Supabase 대시보드의 **SQL Editor**에 붙여넣고 Run을 눌러요. (파일 경로를 입력하는 게 아니에요.)
3. **Authentication > URL Configuration**에서 Site URL을 앱 주소로, Redirect URLs에 `<앱 주소>/auth/callback`을 추가해요.
4. `.env.example`을 `.env.local`로 복사하고 값을 채워요.
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase > Project Settings > API
   - `ANTHROPIC_API_KEY`: [Anthropic Console](https://console.anthropic.com)
   - `NEXT_PUBLIC_SITE_URL`: 앱 주소 (로컬은 `http://localhost:3000`)
5. 실행:

```bash
npm install
npm run dev
```

## AI 뉴스레터 설정

1. `supabase/migrations/0002_newsletter.sql` 파일 안의 SQL 전체를 Supabase **SQL Editor**에 붙여넣고 Run 해요.
2. 메일 발송 업체를 하나 정해서 Vercel 환경 변수에 넣어요. 보내는 주소 `MAIL_FROM_ADDRESS`(예: `newsletter@leadstation.kr`)는 공통으로 필요하고, 발송 업체에서 인증된 주소여야 해요.
   - **SendGrid**: `SENDGRID_API_KEY` (Sensitive). SendGrid **Settings > Sender Authentication**에서 도메인을 인증해요.
   - **SMTP**: `SMTP_HOST`, `SMTP_PORT`(기본 587, 465면 SSL), `SMTP_USER`, `SMTP_PASS`
   - **Resend**: `RESEND_API_KEY`
   여러 개를 넣었다면 `MAIL_PROVIDER`(`sendgrid`, `smtp`, `resend`)로 고를 수 있어요.
3. 발신 정보 메뉴에서 보내는 사람 이름과 푸터를 입력해요.
4. Redeploy 해요.

### AI 이미지 생성 (선택)

이미지 칸의 **AI로 생성** 버튼은 OpenAI 이미지 API로 이미지를 만들어요. Vercel 환경 변수에 `OPENAI_API_KEY`(Sensitive)를 넣고 Redeploy 하면 돼요. 기본 모델은 `gpt-image-2`이고, 쓸 수 없으면 `gpt-image-1`을 써요. 모델을 바꾸려면 `OPENAI_IMAGE_MODEL`을 지정하세요.

### 예약 발송 (선택)

예약 발송은 1분마다 `/api/cron/newsletters`를 호출해야 동작해요. 지금 발송은 이 설정 없이도 돼요.

1. Vercel 환경 변수 추가 후 Redeploy
   - `CRON_SECRET`: 아무 긴 임의 문자열 (Sensitive)
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase > Project Settings > API Keys 의 service_role(secret) 키 (Sensitive)
2. Supabase **Database > Extensions**에서 `pg_cron`과 `pg_net`을 켜요.
3. SQL Editor에서 실행해요 (`<CRON_SECRET>`을 실제 값으로 바꾸세요):

```sql
select cron.schedule(
  'leadstation-newsletters',
  '* * * * *',
  $$ select net.http_get(
       url := 'https://leadstation.kr/api/cron/newsletters',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
     ) $$
);
```

## Vercel 배포

저장소를 Vercel에 import하고, `.env.example`의 환경 변수를 Project Settings > Environment Variables에 넣으면 돼요. `NEXT_PUBLIC_SITE_URL`은 배포 주소로 바꿔주세요.

### 사용자별 서브 도메인

1. Supabase SQL Editor에서 `supabase/migrations/0003_user_subdomains.sql` 내용을 실행해요.
2. Vercel 환경 변수에 `NEXT_PUBLIC_ROOT_DOMAIN=leadstation.kr`을 추가해요.
3. Vercel Settings > Domains에서 `*.leadstation.kr`을 추가해요 (네임서버가 Vercel이어야 해요).
4. 사용자는 처음 로그인할 때 /welcome에서 주소(handle)를 정하고, 페이지는 `https://handle.leadstation.kr/slug`로 열려요.

## 구조

```
src/app/(auth)/login        로그인, 회원가입
src/app/dashboard/pages     프로모션 페이지 목록, AI 생성, 편집, 공개 설정
src/app/dashboard/leads     리드 목록, 검색, CSV 내보내기
src/app/p/[slug]            공개 프로모션 페이지와 신청 폼
src/app/dashboard/newsletters 뉴스레터 목록, AI 블록 에디터, 발송, 발신 정보
src/app/dashboard/recipients 수신자, 그룹, CSV·리드 가져오기
src/app/u/[token]           수신거부 페이지
src/lib/ai/generate-page.ts Claude 구조화 출력으로 페이지 문구 생성
src/lib/newsletter          뉴스레터 렌더러, AI, 이미지 AI, 발송 대기열, 메일러(SendGrid·SMTP·Resend)
supabase/migrations         DB 스키마와 RLS 정책
```

## 다음 단계

- 요금제와 결제, 유저별 페이지
- Neo AI Writer
- 뉴스레터: 사용량 통계와 월 한도

### Neo AI Writer (AI 글쓰기)

1. Supabase SQL Editor에서 `supabase/migrations/0004_ai_writer.sql` 내용을 실행해요.
2. 대시보드 > AI 글쓰기에서 키워드를 넣고 개요를 만든 뒤 본문을 생성해요. 본문 생성에는 1~3분이 걸려요.
3. 편집기에서 블록(문단, 표, 단계, 장단점 등)을 고치고, 문단은 AI로 다시 쓰고, 이미지는 AI로 만들 수 있어요 (OPENAI_API_KEY 필요).
4. 발행한 글은 `https://handle.leadstation.kr/blog/slug`에 SEO 메타 태그와 구조화 데이터(BlogPosting, FAQPage)와 함께 올라가요.

### 이미지 라이브러리

1. Supabase SQL Editor에서 `supabase/migrations/0005_media_library.sql` 내용을 실행해요.
2. 뉴스레터, AI 글쓰기, 프로모션 페이지의 이미지 칸에서 업로드, 라이브러리, AI 생성(스타일과 비율 선택)을 쓸 수 있어요.
3. AI로 만든 이미지와 올린 이미지는 대시보드 > 이미지에 모여요.
