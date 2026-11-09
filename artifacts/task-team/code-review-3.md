# code-review-3 (T07, 사이클 전체 최종 리뷰)

범위: `git diff f2ae642..HEAD`(artifacts 제외) 전체. 전체 테스트는 재실행하지 않음. 실서버 요청 없음. triage-1에서 기각된 항목은 새 근거 없이 다시 올리지 않음.

## 판정: 통과 (Critical/High/Medium 코드 결함 없음, Medium 1건은 T09 QA에서 닫을 테스트 공백)

배포 승인 기준으로는 통과다. 단 Medium M1(수용 기준 3·4의 테스트 근거 없음)은 T09에서 닫혀야 사이클 완료 조건이 충족된다. orchestrator 재검토 게이트에서 Low 항목의 재작업 여부를 결정한다.

## 수용 기준 대조 (requirements.md 5절 완료 기준)

| # | 기준 | 판정 | 근거 |
| --- | --- | --- | --- |
| 1 | 목록·검색이 실제 API 데이터로 동작 | 충족 | `route.ts:4-10` GET 프록시(`/api/v1/cities/all`, 토큰 없음), `cityService.ts:27`, `useCities.ts:17-22` 클라이언트 필터. 브라우저 확인(3,791건, 검색, 스크롤 복귀)은 기확인 사실 |
| 2 | 추가·수정·삭제가 서버 경유 계층으로 실제 API 형식 요청 | 충족 | `route.ts:12-27`, `[cityId]/route.ts:12-41`이 `withSession` + 415 + `parseCityRequest` 후 `proxyCityApi`. 서비스 테스트가 fetch 스텁으로 URL·메서드·본문 검증 |
| 3 | 401 시 재발급과 1회 재시도가 테스트로 검증 | 로직은 충족, 테스트 미충족 | 로직 `cityApiToken.ts:68-81`은 맞다. `tests/`에 `withCityApiToken`·`proxyCityApi` import하는 테스트가 없음(grep 결과 0건). M1 |
| 4 | alpha-3 폼 검증과 국기 표시가 테스트로 검증 | 폼 검증은 충족, 국기는 미충족 | 폼 검증은 `CityFormModal.test.tsx:103,137`. `getCountryFlag`를 import하는 테스트 없음(M1) |
| 5 | 브라우저 노출 검사 | 충족 | 클라이언트 번들 경로(`cityService`, `apiClient`, `types`, `utils`)가 `src/lib/server/`를 import하지 않음. 환경 변수는 `src/lib/server/*`에서만 읽음 |
| 6 | lint, type-check, test, build | 기확인 사실로 충족 | 재실행 안 함 |
| 7 | 죽은 코드 없음 | 충족 | `src/mocks/*`·목업 테스트 삭제, `src` 내 잔여 import 없음. `jsonResponse`·`DEFAULT_ERROR_MESSAGE` 등 export는 모두 다른 파일에서 쓰임 |

기능 요구사항 F-01~F-10도 대조했고 충족한다. 세부 확인 사항:

- F-04: 토큰 동시 발급 합류(`issue()`의 `inflight`), 401 후 `accessToken === used`일 때만 비움, 재시도도 401이면 `UpstreamAuthError`로 502. 환경 변수 누락은 `UpstreamConfigError`로 500이며 조회는 `CITY_API_TEST_EMAIL`을 읽지 않아 영향 없음.
- F-05~F-07: 추가는 `onSuccess`, 수정·삭제는 `onSettled`에서 `queryKeys.cities.all` 무효화. 상류 응답은 `cache: "no-store"`, 내부 응답은 `Cache-Control: no-store`라 쓰기 직후 캐시 문제 없음(요구사항 F-02 캐시 항목).
- F-08: `getCountryFlag`가 alpha-3 249개 표에서 계산, 미매핑 `🏳️`. 폼 정규식 `^[A-Za-z]{3}$`, 제출 시 대문자 변환, 서버는 `^[A-Z]{3}$`. 서비스 `normalizeRequest`도 대문자 변환해 3곳이 일관됨.
- F-09: 서버가 보내는 고정 메시지와 `cityErrorMessage.ts`의 접두어·포함어가 현재 일치(`cityApiToken.ts:13,22`, `cityUpstream.ts:76-77,138-144`).

## 구현 기록 "리뷰 확인 필요" 판정 (1차에서 판정한 항목은 변경 없음, 사이클 전체 관점의 보충만)

| 항목 | 판정 | 근거 |
| --- | --- | --- |
| impl-1 상류 401 -> 502 매핑 (조회 포함) | 타당 | `cityUpstream.ts:122`. 조회가 토큰 없이 200이라는 확인에 부합, 클라이언트는 502를 로그인 이동이 아닌 오류 메시지로 처리해 세션 만료와 혼동 없음 |
| impl-1 `Bearer ` 접두사 방어 분기 | 타당 | `cityApiToken.ts:64-65`. 미검증이나 양쪽 모두 올바른 헤더가 됨 |
| impl-2 #5 `useCities` 반환 형태 변경 | 타당 | 사용처가 `CitiesPageContent` 하나뿐(grep 확인) |
| impl-2 #7 `eslint-disable react-hooks/incompatible-library` | 타당 | `CityListTable.tsx:48-49`에 사유 주석 있고 반환 함수를 메모이즈 자식에 넘기지 않음 |
| impl-2 #8 `h-screen` 고정 | 타당 | 임의값 없이 표준 클래스. `tailwind.md` 위반 없음. 브라우저에서 sticky 헤더와 약 31행 렌더링 확인됨 |
| impl-2 #9 서버 오류 단언 일부를 기존 케이스에 흡수 | 부분 타당 | 새 케이스 부재가 M1의 원인. 서버 모듈 테스트는 triage에서 T09로 이월됨 |

## Findings

### Medium

- **M1. 수용 기준 3·4를 직접 검증하는 테스트가 없음.** `tests/`에 `withCityApiToken`, `proxyCityApi`, `parseCityRequest`, `getCountryFlag`, `filterCities`, `findDuplicateCity`, `getErrorMessage`를 import하는 파일이 없다(`grep -rln` 결과 0건, 컴포넌트·서비스 테스트는 이 함수들을 fetch 스텁 너머로 간접 통과할 뿐이다). 이 사이클이 새로 만든 로직(토큰 재시도·동시 발급 합류, 상류 상태 매핑, 서버 검증, NFC·공백 제거 검색, alpha-3 -> 국기, 자기 제외 중복 검사, 서버 메시지 접두어 분류)이 전부 회귀 보호 없이 남는다. triage-1이 M2/L2를 T09로 이월했으므로 새 결함이 아니라 **T09가 반드시 닫아야 할 완료 조건**으로 재확인한다. 수정 방향: 실제 소스를 import하는 `tests/lib/server/cityUpstream.test.ts`(fetch 스텁, 401 재시도 1회, 두 요청 동시 401에서 발급 1회, 재시도도 401이면 502), `tests/utils/*`(국기·필터·중복·에러 분류). 테스트 안에 로직을 복사하지 않는다.

### Low

- **L1. 삭제·수정 등 4xx 상태 통과가 `cityErrorMessage`의 "client" 분류에 의존하는데 상류 403이 오면 로그인 화면과 무관하게 서버 문구가 그대로 표시됨.** 현재 동작은 요구사항(api-spec "기타 4xx")과 일치하므로 결함은 아니다. 단 상류 문구가 영어일 수 있어(미확인) 한국어 UI에 섞일 수 있다. 실서버 쓰기 검증 항목(triage 코드 L3 이월)에 "상류 4xx 메시지 언어 확인"을 추가하는 정도로 충분하다. 수정 불필요.
- **L2. 수정 시 중복 사전 검사가 이름·국가를 바꾸지 않아도 적용됨** (`useCityMutations.ts:48-49`, `cityDuplicate.ts:14-19`). 3,791건 실데이터에 같은 도시명+국가명 쌍이 이미 둘 이상 있으면(미확인, 지역 이름이 겹치는 도시는 흔함) 그중 하나의 위경도만 고치려 해도 "이미 등록된 도시입니다."로 막힌다. 사용자 결정 B-6은 "자기 자신 제외"까지만 정했으므로 규칙 위반은 아니다. 수정 방향(선택): 수정 모드에서 도시명·국가명이 원본과 같으면 검사를 건너뛴다. 실데이터에 중복 쌍이 있는지 먼저 조회로 확인하면 판단이 쉽다.
- **L3. 목록 조회 실패 시 React Query 기본 재시도(3회, 지수 백오프)로 오류 화면이 약 7초 늦게 뜸** (`src/app/providers.tsx:8`이 `new QueryClient()`를 기본값으로 사용, `citiesQueryOptions`에 `retry` 없음). 네트워크 실패·500(설정 오류)에서도 "불러오는 중..."이 길게 이어진다. 401은 시도마다 `window.location.assign`을 반복 호출한다(첫 호출에서 페이지가 이동하므로 실해는 작음). F-09의 "오류와 재시도 표시"는 결국 충족되나 체감이 나쁘다. 수정 방향: 목록 쿼리에 `retry: false`(또는 4xx·설정 오류만 제외하는 함수), 실측은 브라우저에서 확인하지 못함.
- **L4. 영구 규칙 문서가 사이클 산출물을 계약 기준으로 인용함.** `docs/agent-rules/project.md`(백엔드 항목) "`artifacts/task-team/api-spec.md`와 `src/docs/city-api-reference.md`가 기준". 1차 L4는 `src/`와 `src/docs`만 정리했고 `docs/agent-rules/`는 대상에서 빠졌다(이번 사이클에서 이 문장을 새로 쓴 것이므로 사이클 diff 안). `artifacts/`는 `globals.css`에서 소스 스캔 제외 대상이고 사이클마다 아카이브되는 경로(`artifacts/archive/20261109/`가 이미 존재)라 링크가 끊어질 수 있다. 수정 방향: `src/docs/city-api-reference.md`만 기준으로 적고, 필요하면 그 문서에 내부 엔드포인트 계약 절을 둔다.
- **L5. `artifacts/task-team/requirements.md:30-33`의 게이트 표에 `B-9`·`승인` 행이 중복되고 승인 문구가 서로 다름.** CodeRabbit과 자체 확인 일치. 표가 본문보다 우선한다고 적혀 있어 현재 어느 행이 유효한지 모호하다. 수정 방향: 32-33행 삭제(산출물 문서 수정이라 orchestrator/PM 담당).
- **L6. `artifacts/task-team/design-spec.md:38`(1.1절)과 5.3절 본문이 승인된 게이트 결정과 어긋남.** 1.1절은 "필터링된 전체 행을 렌더링"이고 구현은 가상 스크롤, 5.3절 서술 "다이얼로그를 닫고 재조회하는 현재 동작을 유지"는 구현(대상 없음만 닫고 나머지는 유지, 위 표 15행의 요약 표는 이미 갱신됨)과 다르다. 코드는 승인 결정에 맞다. 수정 방향: 두 절을 결정에 맞게 갱신(문서 정합성만 문제).

### Info

- I1. `src/types/city.ts:23` `selected?: boolean`은 f2ae642에도 있던 필드이고 이번 사이클 코드에서 쓰이지 않는다. 사이클 diff 밖의 기존 미사용 필드라 지적만 남긴다(`project-structure.md` 5번).
- I2. 하나의 `Authorization` 토큰이 프로세스 메모리에만 있어 서버리스 배포에서는 인스턴스마다 재발급된다. requirements B-8에서 개발 서버 기준으로 수용한 사항이라 결함 아님.
- I3. `pnpm-workspace.yaml`의 `overrides: source-map-js: 1.2.2`는 Next 16.4.3 업그레이드 뒤에도 필요한지 미확인(code-review-2에서 이월). 제거 가능 시점을 후속으로 확인.

## 사이클 한정 식별자 인용 점검

- `src/` 전체 grep(`F-xx`, `B-x`, `A-x`, `T0x`, `finding`, `design-spec`, `api-spec`, `requirements`, `triage`, `artifacts`, `사이클`, `리뷰`): 일치 1건, `src/app/globals.css:3` `@source not "../../artifacts"`는 Tailwind 스캔 제외 설정이며 인용이 아니다.
- 규칙 문서 인용은 L4.
- 코드 주석의 `react-query.md 규칙 7`(`CityFormModal.tsx` 열림 시점 초기화 주석)은 영구 규칙 문서 참조라 허용.

## 문서-코드 일관성

- `nextjs.md` 5·6번, `project-structure.md` 2~4번, `react-query.md` 1·5번 갱신 내용이 코드와 일치(`withSession` 사용, `src/lib/server/` 격리, `queryKeys.cities.list` 단일 쿼리, `filterCities`).
- `react-query.md` 4번 "mutation 성공 후 invalidate"는 수정·삭제가 `onSettled`로 더 넓게 무효화함. 규칙을 위배하지 않고 `useCityMutations.ts:42,59` 주석에 사유가 있음.
- `react-query.md` 7번(수정 모달은 `id`만 받음)과 달리 `CityFormModal`은 `city` 객체를 받는다. 이번 사이클 이전부터의 구조이며 지금 변경하지 않았으므로 지적하지 않음.
- `.env.example`의 새 변수 2개는 코드가 읽는 이름(`CITY_API_BASE_URL`, `CITY_API_TEST_EMAIL`)과 일치하고 값은 가짜.
- Next 16.4.3 업그레이드: `next`와 `eslint-config-next` 동일 버전. 라우트 핸들러의 `RouteContext` 사용은 typegen 의존이며 type-check 통과 기확인.

## CodeRabbit 교차검토

- 실행: `coderabbit review --agent --committed --base f2ae642` (develop 로컬 브랜치가 없어 사이클 시작 커밋을 base로 사용). 상태: 완료(`review_completed`, 56개 파일, 무료 CLI 할당량 사용).
- CodeRabbit 2건 중 2건 타당(둘 다 `artifacts/` 문서, 코드 결함 없음).
- 타당 판정 항목
  - `artifacts/task-team/requirements.md:32-33` 게이트 표 중복 행: Low, 자체 발견 L5와 동일(직접 읽고 확인).
  - `artifacts/task-team/design-spec.md:38` 및 5.3절이 승인된 결정과 불일치: Low, 자체 발견 L6과 동일(직접 읽고 확인).
- 기각 항목: 없음.

## 확인하지 못한 것

- 실서버 쓰기 동작(중복 거부 문구, 없는 id 상태 코드, 토큰 접두사, 만료 시간). triage의 이월 항목 그대로.
- 브라우저 상호작용 중 입력 지연, 접근성 도구 검증, 실데이터 63개 국가코드 매핑의 ISO 대조.
- L3의 실제 지연 시간(코드 읽기 기반 추정, 브라우저 실측 없음), L2의 실데이터 중복 쌍 존재 여부.
