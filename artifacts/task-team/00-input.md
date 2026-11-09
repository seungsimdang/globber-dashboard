# T01 - 입력 정리: 실제 도시 API 연동

## 사용자 요청 원문

> http://54.180.101.234:8080/swagger-ui/index.html 참고하여 아직 못 한 항목들 작업 이어서해

"아직 못 한 항목"은 직전 대화에서 정리한 미완료 목록을 가리킨다.

- 목업 서비스 레이어(`src/services/cityService.ts`)를 실제 API 호출로 교체
- `src/lib/apiClient.ts` 부재 (`docs/agent-rules/nextjs.md` 5번 규칙 미충족)
- 실 API 전환 시 인증 토큰 처리
- 수정 API 계약을 실제 스펙과 대조
- 목업 지연·에러 정책, 목록 UX(페이지네이션·정렬), 반응형 범위는 실제 API 특성에 맞춰 재검토

이전 사이클 산출물은 `artifacts/archive/20261109/`에 있다.

## 사용자 결정 (2026-11-09, 질문 창 답변)

| 항목 | 결정 |
| --- | --- |
| 실행 모드 | 새 실행. 이전 산출물은 archive로 이동 |
| 토큰 획득 | dev 서버 `/dev/test-login`을 Next 서버가 호출. 테스트 이메일은 서버 환경 변수, 토큰은 서버에만 보관, 401이면 재발급. 기존 단일 계정 로그인(`src/lib/session.ts`) 유지 |
| 호출 경로 | 브라우저 → Next 서버(Route Handler 등) → 실제 API. 토큰과 API 주소는 브라우저에 노출하지 않음 |
| 브랜치 | PR #18 병합 후 main에서 `feature/real-city-api` 분기 (develop 브랜치 없음) |
| 테스트 계정 이메일 | 모름. 토큰 만료 시간과 쓰기 권한은 확인 필요로 남김 |
| 관리자 인증 요청 문서 | 요청하지 않음. 별도 문서는 만들지 않는다 |

## 확인된 사실 (orchestrator가 실제 서버에 호출해 확인)

스펙 원본: `http://54.180.101.234:8080/v3/api-docs` (OpenAPI, title "GLOBBER"). servers에는 운영 `https://globber.world/api`, 개발 `https://dev.globber.world/api`, 로컬 `http://localhost:8080`이 적혀 있다.

### 도시 API

| 메서드 | 경로 | 내용 |
| --- | --- | --- |
| GET | `/api/v1/cities/all` | 전체 도시. 페이지네이션 없음. 실제 응답 3,791개. `Cache-Control: max-age=86400, public`, `ETag` 응답, `If-None-Match` 일치 시 304 |
| GET | `/api/v1/cities?keyword=` | 유사도+인기순 최대 20개. 응답 `data.cities[]`. keyword 공백이면 400 `{"status":"fail","data":"검색어를 입력해 주세요."}` |
| GET | `/api/v1/cities/findCity?countryCode=&cityName=` | 국가코드+도시명으로 단건 조회 |
| GET | `/api/v1/cities/favorites?limit=` | 인기 여행지 (기본 20, 최대 500) |
| POST | `/api/v1/cities` | 추가. body `CityRequest`, 응답 `{status, data: CityResponse}` |
| PUT | `/api/v1/cities/{cityId}` | 수정. body `CityRequest`, 응답 `{status, data: CityResponse}` |
| DELETE | `/api/v1/cities/{cityId}` | 삭제. 응답 `{status, data: CityResponse}` |

- `CityResponse`: `cityId`(int64), `cityName`, `countryName`, `lat`, `lng`, `countryCode`
- `CityRequest`: 필수 `cityName`, `countryName`, `lat`(-90~90), `lng`(-180~180), `countryCode`(패턴 `^[A-Z]{3}$`)
- **`countryCode`는 ISO alpha-3다** (실데이터 예: `ARE`). 현재 코드는 alpha-2(`/^[A-Z]{2}$/`, 시드 `KR`)를 쓴다.
- 실데이터 도시명·국가명은 한글이다 (예: `두바이`, `아랍에미리트`).
- 에러 형식: HTTP 상태 코드 + `{"status":"fail","data":"<메시지 문자열>"}`.

### 인증

- 스펙은 PUT·DELETE의 `Authorization`을 required=false로 적었으나, 실제로 토큰 없이 보내면 POST·PUT·DELETE 모두 401 `인증이 필요합니다.`/`로그인이 필요합니다.`. 잘못된 토큰은 401 `유효하지 않은 JWT 토큰입니다.`. 조회·검색은 토큰 없이 200.
- `POST /dev/test-login?email=`: "[dev/local 환경만]". 이 서버에서 활성(email 누락 시 400). 응답 `{status, data: {accessToken, refreshToken}}`.
- `POST /reissue`: `Authorization` 헤더 + `RefreshToken` 쿠키 필요.
- 스펙에 관리자 역할·관리자 로그인·API 키 없음. 로그인 제공자는 `KAKAO`뿐이고 콜백은 `https://dev.globber.world/login/oauth2/code/kakao`로 고정.
- CORS는 `http://localhost:3000`만 허용 확인 (서버 경유 결정으로 영향 없음).

## 확인 필요 (확인하지 못한 것)

1. 일반 회원 토큰으로 도시 쓰기가 허용되는지 (역할 검사 여부)
2. accessToken 만료 시간, `accessToken` 값에 `Bearer ` 접두사 포함 여부(`/auth/token` 설명에는 포함된다고 적혀 있음, test-login은 미확인)
3. 운영 서버에서 쓰기 연동 방법. 확인됨: `https://globber.world/api/dev/test-login`은 404 `요청한 경로를 찾을 수 없습니다.`라 운영에서는 test-login을 쓸 수 없다. `https://dev.globber.world/api/dev/test-login`은 JSON이 아닌 프론트엔드 HTML을 돌려줘 이 경로로는 test-login에 닿지 않는다. 운영 쓰기 방법은 미정
4. 304 응답·ETag를 대시보드가 활용할지
5. 중복 도시 추가, 없는 id 수정·삭제 시 실제 상태 코드와 메시지 (토큰이 없어 미확인)

## 영향 범위 (현재 코드 기준, 판단 없이 나열)

- `src/types/city.ts`, `src/services/cityService.ts`, `src/mocks/*`, `src/hooks/*`, `src/components/cities/*`, `src/utils/countryFlagMapping.ts`(alpha-2 기준 여부 미확인)
- `src/docs/city-api-reference.md` (17th-team1-client 기준 문서)
- `tests/` 아래 서비스·목업·컴포넌트 테스트
- 환경 변수: `.env.example`

## 승인 지점

- T02 완료 후 사용자 확인 게이트 (요구사항 승인 전 T03/T04 시작 금지)
- 실제 서버에 데이터를 바꾸는 요청(POST·PUT·DELETE 성공 경로)은 사용자 승인 없이 보내지 않는다
- 커밋·푸시·PR은 사용자 승인 후

## Bug Team 피드백 반영 필수

없음 (`artifacts/bug-team/`에 postmortem 파일 없음).

---

# T01 (2차) - 입력 정리: 운영·개발 서버 분리 관리

## 사용자 요청 원문

> 이 대시보드는 개발 서버와 아무 관련이 없는데 무슨소리임?

> 운영/개발 둘 다 관리할 수 있도록 별도 메뉴/탭 등으로 분리해

> ip 주소 사용하되, 운영/개발 서버 주소를 환경변수로 동적으로 관리할 수 있도록 해

## 사용자 결정 (2026-11-09, 질문 창 답변)

| 항목 | 결정 |
| --- | --- |
| 작업 위치 | PR #19(`feature/real-city-api`)에 이어서 커밋. 이 문서와 기존 산출물은 이어서 보완 |
| 화면 분리 | 한 화면(`/cities`) 안의 탭으로 운영·개발 전환. 주소는 나누지 않음 |
| 운영 쓰기 | 백엔드가 쓰기용 인증 수단을 주기 전까지 운영 탭의 추가·수정·삭제 버튼은 비활성화하고 안내 문구를 보여 준다 |
| 개발 서버 주소 | IP 주소 서버(`http://54.180.101.234:8080` 계열) 사용. 실제 값은 문서·코드에 적지 않고 환경 변수로만 둔다 |
| 주소 관리 | 운영·개발 서버 주소를 각각 환경 변수로 관리해 코드 수정 없이 바꿀 수 있게 한다 |

## 확인된 사실 (orchestrator가 조회 요청으로 확인, 2026-11-09)

| 상류 기준 주소 | 도시 목록 경로 | 결과 |
| --- | --- | --- |
| 운영 `https://globber.world/api` | `{base}/api/v1/cities/all` | 200, 4,204개 |
| 개발(도메인) `https://dev.globber.world/api` | `{base}/api/v1/cities/all` | 200, 3,791개 |
| 개발(IP) `http://54.180.101.234:8080` | `{base}/api/v1/cities/all` | 200, 3,791개 |

- 1차 사이클 화면의 3,791개는 개발 서버 데이터였다. 운영 데이터는 4,204개다.
- 현재 코드는 `CITY_API_BASE_URL` 하나만 쓰고, 목록 경로를 `{base}/api/v1/cities/all`, 토큰 발급을 `{base}/dev/test-login?email=`로 만든다. 운영 주소는 끝에 `/api`가 붙어야 한다(`https://globber.world/api/v1/cities/all`은 404).
- 토큰 발급(test-login, 이메일 없이 POST):
  - 개발(IP) `/dev/test-login` → 400 `필수 요청 값이 누락되었습니다: email` (도달)
  - 개발(도메인) `/api/dev/test-login` → 404 HTML, `/api/api/dev/test-login` → 404 JSON (도달 불가)
  - 운영 `https://globber.world/api/dev/test-login` → 404 (운영에는 없음)
- 따라서 쓰기는 개발(IP)에서만 가능하다. 운영 쓰기는 백엔드가 별도 인증 수단을 제공해야 한다.

## 확인 필요

1. 개발(IP)과 개발(도메인)이 같은 서버인지 (도시 수만 같음)
2. 1차 사이클에서 이월된 실서버 쓰기 동작(토큰 발급·401 재시도·중복/없는 id 응답·토큰 만료·`Bearer` 접두사)
3. 운영 쓰기용 인증 수단의 형태와 제공 시점 (백엔드 요청 필요)
4. 배포 환경(Vercel)의 환경 변수 이름 변경에 따른 재설정 절차

## 영향 범위 (현재 코드 기준, 판단 없이 나열)

- `src/lib/server/cityApiToken.ts`, `src/lib/server/cityUpstream.ts`, `src/app/api/cities/route.ts`, `src/app/api/cities/[cityId]/route.ts`
- `src/services/cityService.ts`, `src/hooks/useCities.ts`, `src/hooks/useCityMutations.ts`, `src/lib/react-query/query-keys.ts`
- `src/components/cities/*`, `src/app/cities/*`
- `.env.example`, `src/docs/city-api-reference.md`, `docs/agent-rules/project.md`(백엔드 설명이 dev 서버 기준)
- `tests/` 아래 서버 모듈·Route Handler·서비스·훅·컴포넌트 테스트

## 승인 지점

- T02 완료 후 사용자 확인 게이트
- 실제 서버에 데이터를 바꾸는 요청은 사용자 승인 없이 보내지 않는다
- 커밋·푸시는 사용자 승인 후

## Bug Team 피드백 반영 필수

없음 (`artifacts/bug-team/`에 postmortem 파일 없음).

# T01 (3차) - 입력 정리: 도시 입력 보조와 건수 줄 문구

## 사용자 요청 원문

> - 운영 서버 전체 4,204개 -> 무슨 서버인지 명시가 필요하니?
> - 도시 추가 시 도시명/국가명은 알아도 국가코드나 위,경도는 추가하는사람이 모를텐데 어떻게 입력받는것이 좋을까?

## 사용자 결정 (2026-11-09, 질문 창 답변)

| 항목 | 결정 |
| --- | --- |
| 건수 줄 | 서버 이름을 뺀다. "전체 N개", "검색 결과 N개 / 전체 N개" (탭과 중복) |
| 국가 입력 | 국가명을 검색해 고르면 alpha-3 국가코드가 자동 입력되는 선택 방식. 기존 alpha-3 표와 브라우저 `Intl` 사용, 새 라이브러리 없음 |
| 위경도 입력 | "위치 찾기" 버튼. 도시명+국가로 좌표 후보를 검색해 고르면 위도·경도 자동 입력(이후 수정 가능). OpenStreetMap Nominatim을 Next 서버 경유로 호출 |
| 진행 | Task Team 사이클. 2차 작업(미커밋)과 같은 브랜치 `feature/real-city-api` 위에서 진행 |

## 확인된 사실 (orchestrator 조회, 2026-11-09)

- 건수 줄 문구는 `src/utils/cityErrorMessage.ts:88-89`에서 `${label} 서버 ...` 형태로 만든다.
- 모달의 국가코드 입력은 자유 입력(`placeholder="예: KOR"`), 위경도는 숫자 자유 입력이다(`CityFormModal.tsx`). 국가명도 별도 입력칸이 있다.
- `src/utils/countryFlagMapping.ts`에 ISO 3166-1 alpha-3→alpha-2 전체 표가 있다.
- 운영 데이터(조회 GET)의 국가는 93개다. `Intl.DisplayNames(['ko'],{type:'region'})` 이름과 비교하면 80개 일치, 11개 불일치(예: KOR 한국/대한민국, AUS 호주/오스트레일리아, HKG 홍콩/홍콩(중국 특별행정구), BIH 띄어쓰기 차이), 2개(`HKR`, `ZYC`)는 ISO alpha-3 표에 없는 코드다. 따라서 `Intl` 이름만 쓰면 기존 데이터의 국가명 표기와 달라진다.
- Nominatim `search?city=서울&countrycodes=kr&format=jsonv2&accept-language=ko` 1회 호출 → 1건, `37.5666791, 126.9782914`, `addresstype: city`, 표시명 "서울특별시, 대한민국". 무료·키 불필요(일반 지식: 이용 정책상 초당 1회 이하, 식별 가능한 User-Agent 필요, 자동완성 용도 금지).

## 확인 필요

1. 국가 목록의 원천(기존 데이터의 국가코드·국가명 쌍 우선 vs `Intl` 이름)과 비표준 코드 `HKR`·`ZYC` 처리
2. 국가 선택 시 국가명 입력칸을 자동으로 채울지, 국가명 입력칸을 없앨지
3. Nominatim 호출 제한·실패 시 동작, 운영 배포 환경에서의 이용 정책 준수 방식
4. 위치 찾기 결과의 국가가 선택한 국가와 다를 때 처리

## 영향 범위 (현재 코드 기준, 판단 없이 나열)

- `src/utils/cityErrorMessage.ts`, `src/components/cities/CitiesPageContent.tsx`
- `src/components/cities/CityFormModal.tsx`, `src/components/common/`(선택 목록 컴포넌트 유무), `src/utils/countryFlagMapping.ts`
- 새 Route Handler(위치 검색 프록시), `src/lib/server/`, `src/services/`, `src/hooks/`, `src/types/city.ts`
- `.env.example`(필요 시), `src/docs/city-api-reference.md`
- `tests/` 아래 해당 테스트

## 승인 지점

- T02 완료 후 사용자 확인 게이트
- 실제 도시 서버에 데이터를 바꾸는 요청은 사용자 승인 없이 보내지 않는다
- 커밋·푸시는 사용자 승인 후 (2차 구현도 아직 미커밋)

## Bug Team 피드백 반영 필수

없음 (`artifacts/bug-team/`에 postmortem 파일 없음).
