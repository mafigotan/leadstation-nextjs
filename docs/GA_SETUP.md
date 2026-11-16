# 방문 통계 (Google Analytics 4) 설정

유저 사이트(랜딩·블로그·프로모션)의 방문을 플랫폼 GA4 속성 하나에 모으고,
대시보드 `방문 통계` 메뉴에서 로그인한 유저의 사이트 데이터만 GA4 Data API로 불러와 보여준다.
환경 변수가 없으면 태그는 심기지 않고 대시보드에는 "방문 통계 준비 중"이 표시된다.

staging과 운영은 **GA4 속성을 따로** 만든다 (테스트 방문이 운영 통계에 섞이지 않게).
아래 1~4를 staging용, 운영용 각각 한 번씩 한다. 서비스 계정은 하나를 같이 써도 된다.

## 1. GA4 속성 만들기
1. https://analytics.google.com → 관리 → 만들기 → 속성
   - 속성 이름: `LEADstation` (staging은 `LEADstation staging`)
   - 보고 시간대: **대한민국**, 통화: 원
2. 데이터 스트림 → 웹 → URL `leadstation.kr` (staging은 staging 주소)
   - 향상된 측정은 켜둔다 (페이지 변경 시 page_view 자동 수집).
3. 스트림의 **측정 ID** (`G-XXXXXXX`)를 복사한다.
4. 관리 → 속성 세부정보에서 **속성 ID** (숫자)를 복사한다.

## 2. 맞춤 측정기준 등록 (관리 → 맞춤 정의 → 맞춤 측정기준 만들기)
| 측정기준 이름 | 범위 | 이벤트 매개변수 / 사용자 속성 |
|---|---|---|
| 사이트 | 이벤트 | `site_handle` |
| 사이트(사용자) | 사용자 | `ls_site` |

두 이름은 자유지만 매개변수 이름은 위와 정확히 같아야 한다. 등록 전 수집된 데이터에는 적용되지 않는다.

## 3. 서비스 계정 만들기 (Google Cloud)
1. https://console.cloud.google.com → 프로젝트 선택(없으면 생성)
2. API 및 서비스 → 라이브러리 → **Google Analytics Data API** 사용 설정
3. IAM 및 관리자 → 서비스 계정 → 만들기 (예: `leadstation-ga`), 역할은 주지 않아도 된다.
4. 만든 계정 → 키 → 키 추가 → JSON → 파일 다운로드
5. GA4 → 관리 → 속성 액세스 관리 → `+` → 서비스 계정 이메일(`...@...iam.gserviceaccount.com`)을 **뷰어**로 추가

## 4. Vercel 환경 변수
| 이름 | 값 |
|---|---|
| NEXT_PUBLIC_GA_MEASUREMENT_ID | `G-XXXXXXX` (1-3) |
| GA4_PROPERTY_ID | 숫자 속성 ID (1-4) |
| GOOGLE_SERVICE_ACCOUNT_JSON | 3-4의 JSON 파일 내용 전체 (한 줄로 붙여넣거나 base64) |

staging은 환경 Preview·브랜치 `staging`, 운영은 Production. 추가 후 재배포해야 적용된다.

## 동작 방식
- 태그: `src/components/site-analytics.tsx` (`/s/[handle]` 레이아웃에서만 로드, 대시보드·관리자 화면엔 없음)
- 조회: `src/lib/analytics/ga.ts` (사이트·기간별 1시간 캐시, 실시간은 1분 캐시)
- 리드·페이지 이름 결합: `src/lib/analytics/report.ts`
- GA 일반 보고서는 24~48시간 늦게 반영된다. "지금 방문 중"은 최근 30분 실시간 값.
- 쿼터: 표준 속성 하루 200,000 / 시간당 40,000 토큰. 캐시 덕분에 유저 수천 명까지 여유 있음. 비용 없음.
- 나중에 유저 본인 GA(OAuth)를 붙일 때는 같은 `SiteStats` 형태를 돌려주는 조회 함수만 추가하면 화면은 그대로 쓴다.
- 개인정보처리방침에 "Google Analytics를 이용한 방문 분석(쿠키)" 문구를 추가해야 한다.
