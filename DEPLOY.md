# 배포 방식: staging → production

| 환경 | Git 브랜치 | 주소 | Supabase |
|---|---|---|---|
| Production | `main` | https://leadstation.kr, `*.leadstation.kr` | 운영 프로젝트 |
| Staging | `staging` | https://leadstation-nextjs-git-staging-neomc-017a2f24.vercel.app | staging 프로젝트 (데이터 분리) |

## 평소 작업 순서

1. 모든 수정은 `staging` 브랜치에 먼저 push 한다. Vercel 이 staging 고정 주소에 자동 배포한다.
2. DB 변경(`supabase/migrations/00NN_*.sql`)이 있으면 **staging Supabase** 의 SQL Editor 에서 먼저 실행한다.
3. staging 고정 주소에서 확인한다. 화면 왼쪽 아래에 노란 `STAGING` 표시가 있다.
4. 문제가 없으면 같은 SQL 을 **운영 Supabase** 에서 실행한 뒤, `staging` 을 `main` 에 합친다(fast-forward).
   ```
   git checkout main && git merge --ff-only staging && git push origin main
   ```
5. Vercel 이 leadstation.kr 에 운영 배포한다.

순서 주의: 운영 DB SQL 을 먼저 실행하고 코드를 합친다. (새 코드는 새 표·열이 있어야 동작한다.)

## staging 의 차이

- 사용자 사이트는 서브 도메인 대신 `https://leadstation-nextjs-git-staging-neomc-017a2f24.vercel.app/s/<사이트주소>` 로 열린다 (`NEXT_PUBLIC_ROOT_DOMAIN` 을 비워둠).
- Vercel 크론(예약 발송)은 운영에서만 돈다. staging 에서는 발송 화면에서 직접 보내면 된다.
- 메일은 실제로 발송되니 staging 에서는 내 주소로만 테스트한다.

## 처음 한 번만 하는 설정

### 1. staging Supabase 프로젝트
1. supabase.com 에서 새 프로젝트 생성 (예: `leadstation-staging`, 리전 Seoul).
2. SQL Editor 에서 `supabase/staging_setup.sql` 전체 실행 (0001~0008 을 합친 파일).
3. Authentication → URL Configuration
   - Site URL: `https://leadstation-nextjs-git-staging-neomc-017a2f24.vercel.app`
   - Redirect URLs: `https://leadstation-nextjs-git-staging-neomc-017a2f24.vercel.app/**`
4. Project Settings → API 에서 URL, anon key, service_role key 를 복사해 둔다.
5. staging 에 가입한 뒤 슈퍼 관리자를 지정한다.
   ```
   insert into public.platform_admins (user_id) select id from auth.users where email = '내이메일' on conflict do nothing;
   ```

### 2. Vercel 환경 변수 (Settings → Environment Variables, 환경: **Preview**, 브랜치: `staging`)
| 이름 | 값 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | staging 프로젝트 URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | staging anon key |
| SUPABASE_SERVICE_ROLE_KEY | staging service_role key |
| NEXT_PUBLIC_SITE_URL | https://leadstation-nextjs-git-staging-neomc-017a2f24.vercel.app |
| NEXT_PUBLIC_ROOT_DOMAIN | (비워둠) |
| ANTHROPIC_API_KEY, OPENAI_API_KEY, SENDGRID_API_KEY, MAIL_FROM_ADDRESS, CRON_SECRET | 운영과 같은 값 |

운영 값은 환경을 **Production** 으로만 두어 staging 이 운영 DB 를 쓰지 않게 한다.
"Automatically expose System Environment Variables" 는 켜둔다 (STAGING 표시에 사용).

### 3. 주소
staging 은 Vercel 브랜치 고정 주소를 쓴다 (staging 브랜치의 최신 배포를 항상 보여줌).
배포마다 바뀌는 `leadstation-nextjs-xxxxxxxx-...vercel.app` 주소는 쓰지 않는다.
나중에 staging.leadstation.kr 을 쓰려면 Vercel Domains 에서 추가해 Git Branch `staging` 에 연결하고,
Preview 의 NEXT_PUBLIC_SITE_URL 과 staging Supabase 의 URL 설정을 그 주소로 바꾼다.
