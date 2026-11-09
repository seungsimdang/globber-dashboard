# T09 QA 리포트 1: 실제 도시 API 연동

판정: 조건부 통과. 신규 테스트 86개 모두 통과, 실패 0건. 미검증 항목(아래)은 통과로 처리하지 않았다.

## 실행 결과 (이 worktree에서 실제 실행)

| 명령 | 결과 |
| --- | --- |
| `pnpm test` | Test Files 14 passed (14), Tests 131 passed (131). 기존 45 + 신규 86 |
| `pnpm lint` | 오류·경고 0 (첫 실행에서 신규 테스트의 `react/display-name` 1건을 테스트 파일에서 고친 뒤 재실행해 통과) |
| `pnpm type-check` | `Types generated successfully`, tsc 오류 없음 |
| `pnpm build` | 요청 범위 밖이라 실행하지 않음 (미검증) |

환경 메모: worktree에 `node_modules`가 없어 메인 체크아웃의 `node_modules`를 심볼릭 링크로 연결해 실행했고, 끝나기 전에 제거했다. 모든 외부 호출은 `vi.stubGlobal("fetch")` 스텁이며 실제 서버 요청은 없다. 환경 변수는 `vi.stubEnv`(`http://upstream.test`, `test@example.com`), 토큰 모듈 메모리는 `vi.resetModules`로 테스트마다 격리했다.

## 신규 테스트 파일 (모두 소스를 직접 import)

- `tests/lib/server/cityApiToken.test.ts`
- `tests/lib/server/cityUpstream.test.ts`
- `tests/app/api/cities/route.test.ts`
- `tests/app/api/cities/cityId/route.test.ts` (대상: `src/app/api/cities/[cityId]/route.ts`)
- `tests/utils/cityFilter.test.ts`
- `tests/utils/cityDuplicate.test.ts`
- `tests/utils/cityErrorMessage.test.ts`
- `tests/utils/countryFlagMapping.test.ts`
- `tests/hooks/useCityMutations.test.tsx`

## 대상별 결과

| 지시 항목 | 결과 | 비고 |
| --- | --- | --- |
| 1 `parseCityRequest` | 통과 | 필수 5필드 누락, 비객체, NaN/Infinity/문자열 위경도, 위경도 경계(±90/±180)와 초과, alpha-3 위반(KR/KORE/K0R/한국어), 대문자 변환·trim, 추가 필드 제거 |
| 1 `parseCityId` | 통과(간접) | `[cityId]/route.ts` 내부 비공개 함수라 export하지 않고 PUT/DELETE 핸들러로 검증. `abc/0/01/-1/1.5/1/../2/1%2F2/빈값` 모두 400이고 상류 미호출 |
| 1 `proxyCityApi` | 통과 | 2xx 통과, 400 메시지 통과, 404 기본 문구, 401 지속 시 502 인증 실패(토큰 값 미노출), 5xx 502(상류 본문 미노출), 네트워크 실패 502, `TimeoutError` 504, API 주소 없음 500, 이메일 없음 500(상류 미호출), 응답 형태 불일치 502, `Cache-Control: no-store`, 쓰기 시 Bearer와 JSON body |
| 2 토큰 | 통과 | 동시 2건에 발급 1회, 401 후 재발급·정확히 1회 재시도, 재시도도 401이면 `UpstreamAuthError`(call 2회, 발급 2회), 조회는 토큰 미발급·Authorization 없음, 이메일 없을 때 fetch 0회, `Bearer ` 중복 접두사 방지, 발급 응답에 토큰 없음 |
| 3 Route Handler | 통과 | 세션 없으면 GET/POST/PUT/DELETE 401(상류 미호출), POST/PUT Content-Type 없음·text/plain 415, 깨진 JSON·검증 실패 400, `Application/JSON; charset` 허용, Origin 헤더 없는 GET 200(403 아님), DELETE는 검증된 id 경로로 상류 전달. 세션은 `@/lib/session`의 `getSession`을 mock |
| 4 `filterCities` | 통과 | 도시명/국가명, 공백·대소문자 무시, NFD 입력과 NFC 데이터 일치, 서버 순서 유지, 빈 검색어는 원본 배열 그대로 |
| 5 `findDuplicateCity` + 훅 | 통과 | 자기 자신 제외, 공백·대소문자 무시. 훅 경로는 `useAddCityMutation`/`useUpdateCityMutation`을 `renderHook`으로 호출: 추가 중복 거부(서비스 미호출), 캐시 없으면 검사 생략, 수정 시 이름·국가 불변이면 생략(목록에 같은 쌍이 또 있어도), 다른 도시와 겹치면 거부 |
| 6 `getErrorMessage` | 통과 | 서버 리터럴(인증 실패, 설정 오류 2종, 연결 실패, 지연, 상류 5xx)별 분류 결과를 고정 |
| 7 `getCountryFlag` | 통과 | KOR, ARE, USA, 소문자·공백, 미지원/alpha-2/빈 문자열은 🏳️ |
| 8 `providers.tsx` 재시도 규칙 | 미검증 | `retryQuery`가 export되지 않고 `Providers` 내부 `QueryClient` 옵션으로만 쓰인다. 지시대로 소스를 바꾸지 않았다. 복사 테스트도 하지 않았다. export 추가가 허용되면 4xx·500 무재시도, 그 외 최대 2회를 단위로 검증 가능(로직 변경 없이 `export`만 필요) |

## 요구사항 수용 기준과 테스트 대응

| 요구사항 | 테스트 | 판정 |
| --- | --- | --- |
| F-01 세션 없으면 거부, 상류 호출 없음 | route.test.ts, cityId/route.test.ts의 401 케이스 | 통과 |
| F-01 브라우저에 상류 주소·토큰 없음(번들 검사) | 없음 | 미검증 (빌드 산출물 검사 필요, `pnpm build` 미실행) |
| F-02 전체 목록 3,791건·한글 깨짐 | 서버 통과 응답은 검증, 3,791건 실데이터는 실제 서버 호출 금지로 불가 | 미검증 |
| F-03 클라이언트 필터링, 서버 순서 유지 | cityFilter.test.ts | 통과 |
| F-04 동시 발급 1회, 401 재발급 1회 재시도, 재시도 실패 시 실패, 이메일 없으면 쓰기 설정 오류·조회 무영향 | cityApiToken.test.ts, cityUpstream.test.ts | 통과 |
| F-04 `Bearer ` 접두사 유무 모두 올바른 헤더 | cityApiToken.test.ts | 통과(접두사 있음/없음 두 경우). 실제 서버 값 형태는 미확인 |
| F-04 토큰이 응답·에러에 노출되지 않음 | cityUpstream.test.ts(401 지속 케이스) | 통과(응답 기준). 로그 노출은 미검증 |
| F-05/F-06 입력 검증(필수값, 위경도, alpha-3), 서버 400 메시지 전달 | cityUpstream.test.ts, route 테스트 | 통과 |
| F-05/F-06 중복 사전 검사, 수정 시 자기 자신 제외 | cityDuplicate.test.ts, useCityMutations.test.tsx | 통과 |
| F-07 삭제 요청 전달 | cityId/route.test.ts | 통과(모킹 fetch) |
| F-08 alpha-3 국기 | countryFlagMapping.test.ts | 통과 |
| F-08 실데이터 63개 코드 전부 매핑 | 없음 | 미검증 (실서버 목록 필요) |
| F-09 오류 분류·문구 | cityErrorMessage.test.ts | 통과 |
| 완료 기준 1(실데이터 목록·검색) | 해당 없음 | 미검증 (실서버 읽기 미실행) |
| 완료 기준 2 (쓰기가 API 형식으로 요청됨, 모킹) | cityUpstream.test.ts, 기존 cityService.test.ts | 통과 |
| 완료 기준 3 (401 재발급 1회 재시도) | cityApiToken.test.ts | 통과 |
| 완료 기준 4 (alpha-3 폼 검증·국기) | countryFlagMapping.test.ts, 기존 CityFormModal.test.tsx | 통과 |
| 완료 기준 5 (브라우저 노출 검사) | 없음 | 미검증 |
| 완료 기준 6 | lint, type-check, test 통과 | build는 미검증 |

## 구현 기록의 "확인하지 못한 것" 대조

implementation-1.md

| 항목 | 판정 |
| --- | --- |
| 상류 호출 없이 토큰 발급·401 재시도·에러 매핑·타임아웃 실행 검증 못함 | 모킹 fetch 기준으로 실행 검증 완료(통과). 실제 상류와의 통신은 미검증 |
| 일반 회원 토큰의 쓰기 허용, 토큰 만료 시간, 중복·없는 id 시 상류 상태 코드 | 미검증. 실제 서버 쓰기 승인과 테스트 이메일이 필요 |
| `pnpm build` 미실행 | 이번에도 미실행, 미검증 |

implementation-2.md

| 항목 | 판정 |
| --- | --- |
| 가상 스크롤 실제 동작, 3,791행 입력 지연 | 미검증 (브라우저 필요, jsdom으로 불가) |
| 실제 서버와의 통신 | 미검증 (의도적으로 하지 않음. 모든 호출은 fetch 스텁) |
| T06 Route Handler 없어 `/api/cities` 404 | 해소 확인: 이 worktree에는 `src/app/api/cities/route.ts`와 `[cityId]/route.ts`가 있고 핸들러를 직접 호출해 동작을 검증했다. 빌드 라우트 목록은 미확인 |
| 실데이터 63개 국가코드가 alpha-3 표에 모두 있는지 | 미검증 (63개 목록 없음). KOR/ARE/USA 3건과 미지원 코드 폴백만 검증 |
| `ApiSuccess.status`가 success 외인 경우 | 미검증 (이번 지시 범위에 없음. 클라이언트는 HTTP 상태와 `data`만 사용) |
| 스크린리더 검증 | 미검증 |

## 발견 사항 (결함은 아님)

- 실패 0건. 소스는 수정하지 않았다.
- `providers.tsx`의 `retryQuery`가 비공개라 회귀 보호가 없다. 위 8번 참고.
- `cityErrorMessage.ts`는 서버 문구의 접두어/부분 문자열에 의존한다. 테스트가 현재 서버 리터럴을 고정했으므로 서버 문구 변경 시 테스트가 깨진다(의도한 결합 탐지).
- `[cityId]/route.ts`의 `RouteContext` 타입 때문에 테스트에서 context를 `as never`로 캐스팅했다. 런타임 동작에는 영향 없음.

## orchestrator 추가 검증 (병합 후)

QA가 미검증으로 남긴 항목 중 orchestrator가 직접 확인한 것.

| 항목 | 결과 | 방법 |
| --- | --- | --- |
| 병합 후 전체 검증 | 통과 | lint 0건, type-check 통과, 테스트 14파일 131개 통과, build 성공 |
| 클라이언트 번들에 상류 주소·토큰 모듈 없음(F-01, 완료 기준 5) | 통과 | build 후 `.next/static`에서 상류 IP, `CITY_API_`, `test-login`, `cityApiToken` 검색 0건 |
| 실데이터 3,791건 로드 | 통과 | 로컬 서버(3100)에서 세션 쿠키로 `/api/cities` 200, 3,791건, `Cache-Control: no-store`. 세션 없으면 401 |
| 63개 국가코드 매핑 | 61/63 통과 | 실데이터 63종 중 61종이 국기 표에 있음. 빠진 `HKR`·`ZYC`는 도시명·국가명이 `string`인 테스트 데이터 |
| 가상 스크롤 실제 동작 | 통과 | Playwright 1280×800: 3,791건 중 DOM 행 21~31개, 중간 스크롤 정상, 헤더 sticky, 페이지 자체 스크롤 없음 |
| 검색 실제 동작 | 통과 | "파리" 3건, "아랍 에미리트"(공백) 매칭, "jpn" 0건(국가코드 비대상), 검색어 지우면 전체·스크롤 맨 위 |

여전히 미검증: 실서버 쓰기(토큰 발급, 401 재시도, 중복·없는 id 응답, 토큰 만료·접두사), `providers.tsx` 재시도 규칙 단위 테스트(비공개 함수), 한 글자씩 입력 시 지연, 스크린리더.
