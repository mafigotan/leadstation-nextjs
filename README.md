# LEADstation

AI Powered Marketing Platform. 첫 번째 도구인 **Lead Collector**가 들어 있어요.

- AI(Claude)로 프로모션 랜딩 페이지 문구 생성, 직접 수정, 공개 URL 발행 (`/p/[slug]`)
- 공개 페이지의 신청 폼으로 리드 수집 (개인정보 동의, 마케팅 수신 동의, 스팸 방지)
- 대시보드에서 리드 목록, 페이지별 필터, 검색, CSV 내보내기(엑셀 한글 호환)

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

## Vercel 배포

저장소를 Vercel에 import하고, 위 환경 변수 4개를 Project Settings > Environment Variables에 넣으면 돼요. `NEXT_PUBLIC_SITE_URL`은 배포 주소로 바꿔주세요.

## 구조

```
src/app/(auth)/login        로그인, 회원가입
src/app/dashboard/pages     프로모션 페이지 목록, AI 생성, 편집, 공개 설정
src/app/dashboard/leads     리드 목록, 검색, CSV 내보내기
src/app/p/[slug]            공개 프로모션 페이지와 신청 폼
src/lib/ai/generate-page.ts Claude 구조화 출력으로 페이지 문구 생성
supabase/migrations         DB 스키마와 RLS 정책
```

## 다음 단계

- 요금제와 결제, 유저별 페이지
- Neo AI Writer, Neo AI Newsletter
- 기존 워드프레스 플러그인 기능 반영
