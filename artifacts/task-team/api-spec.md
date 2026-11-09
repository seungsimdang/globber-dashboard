# T04 - API 명세: 실제 도시 API 연동

입력: `artifacts/task-team/requirements.md`(T02 게이트 결정 우선), `00-input.md`, `openapi-snapshot.json`.
표기: "확인됨"은 00-input.md가 서버 호출로 확인한 사실 또는 openapi-snapshot.json에 적힌 내용, "코드 확인"은 이 저장소 코드를 읽은 사실, "제안"은 이 문서의 설계 결정, "확인 필요"는 미확인이다.
이 사이클에 DB는 없다. Next 서버는 실제 API의 프록시이고 영속 데이터는 실제 API가 가진다.

Next.js 문서 확인(orchestrator, 메인 체크아웃 `node_modules/next/dist/docs/`): Route Handler의 `params`는 Promise다(`01-app/03-api-reference/03-file-conventions/route.md` 82행, `RouteContext<'/경로'>` 타입 헬퍼 제공). Route Handler는 기본적으로 캐시되지 않는다(`01-app/01-getting-started/15-route-handlers.md` 51행). `src/proxy.ts` matcher가 `api` 경로를 제외하는 것도 확인했다(28행).

## T03/T04 게이트 결정 (2026-11-09, 사용자 승인)

이 표가 본문보다 우선한다.

| 항목 | 결정 |
| --- | --- |
| 검색 필터 (§3.5) | 도시명만 보는 본문 제안 대신 design-spec §2.2를 따른다: 도시명+국가명, 검색어·대상 모두 공백 제거, 대소문자 무시, NFC 정규화, 서버 순서 유지 |
| 전체 건수 | 결과 수 줄(`검색 결과 N개 / 전체 M개`)이 필요하므로 `useCities`는 필터 결과와 전체 건수를 함께 제공한다 |
| 삭제 실패 | 네트워크·5xx·인증·설정 오류는 다이얼로그 유지(재시도 가능), 대상 없음만 닫고 재조회. 클라이언트가 두 경우를 구분할 수 있게 `ApiError`의 status를 그대로 노출한다 |
| 가상 스크롤 | `@tanstack/react-virtual` 의존성 추가 승인. 버전은 설치 시점 기준 배포 2주 이상 지난 정확한 버전으로 고정 |
| 명세 승인 | 나머지 내용(`src/lib/server/` 위치, 중복 비교 기준 포함) 승인 |

## 1. 상류 계약 (실제 API, 확인됨)

호스트: dev 서버 `http://54.180.101.234:8080` (평문 HTTP. `https://dev.globber.world/api/dev/test-login`은 HTML을 돌려줘 쓰지 못한다). 경로는 호스트 루트 기준이다(`/api/v1/cities*`, `/dev/test-login`).

| 용도 | 메서드 경로 | 요청 | 성공 응답 `data` | 토큰 |
| --- | --- | --- | --- | --- |
| 전체 목록 | GET `/api/v1/cities/all` | - | `CityResponse[]` (3,791개, `Cache-Control: max-age=86400, public`, ETag) | 불필요(확인됨) |
| 추가 | POST `/api/v1/cities` | JSON `CityRequest` | `CityResponse` | 필수 |
| 수정 | PUT `/api/v1/cities/{cityId}` | JSON `CityRequest` | `CityResponse` | 필수(스펙은 선택으로 적었으나 실제 401, 확인됨) |
| 삭제 | DELETE `/api/v1/cities/{cityId}` | - | 삭제된 `CityResponse` | 필수(위와 동일) |
| 토큰 발급 | POST `/dev/test-login?email=` | query `email` | `{accessToken, refreshToken}` | - |

사용하지 않음: `GET /api/v1/cities?keyword=`(B-1), `findCity`, `favorites`(범위 밖).

```ts
type CityResponse = { cityId: number; cityName: string; countryName: string; lat: number; lng: number; countryCode: string };
type CityRequest = {            // 필수 5개
  cityName: string; countryName: string;
  lat: number;                  // -90 ~ 90
  lng: number;                  // -180 ~ 180
  countryCode: string;          // ^[A-Z]{3}$ (ISO alpha-3)
};
type ApiSuccess<T> = { status: string; data: T };            // status 값은 "success"가 관측됨, 그 외 값은 확인 필요
type ApiFail = { status: "fail"; data: string };             // HTTP 상태 코드 + 메시지 문자열
type JwtTokenResponse = { accessToken: string; refreshToken: string };
```

관측된 에러(확인됨): 토큰 없음 401 `인증이 필요합니다.`/`로그인이 필요합니다.`, 잘못된 토큰 401 `유효하지 않은 JWT 토큰입니다.`, `test-login` email 누락 400.

## 2. Next 서버 경유 계층

### 2.1 환경 변수 (서버 전용, `NEXT_PUBLIC_` 접두사 금지)

| 이름 | 용도 | 예시(`.env.example`, 가짜 값) |
| --- | --- | --- |
| `CITY_API_BASE_URL` | 상류 호스트 루트. 끝 슬래시 없음 | `http://127.0.0.1:8080` |
| `CITY_API_TEST_EMAIL` | `/dev/test-login`에 넘길 테스트 계정 이메일 | `test@example.com` |

- 실제 호스트·이메일을 `.env.example`, 코드, 문서에 적지 않는다(호스트는 이 명세에 한해 상류 계약 설명용으로만 적었고 코드·`.env.example`에는 넣지 않는다).
- `CITY_API_BASE_URL` 누락: 모든 도시 엔드포인트가 500 `서버 설정 오류: 도시 API 주소가 설정되지 않았습니다.`
- `CITY_API_TEST_EMAIL` 누락: 쓰기 엔드포인트만 500 `서버 설정 오류: 테스트 계정이 설정되지 않았습니다.` 조회는 영향 없다.
- 두 변수 모두 요청 시점에 읽는다(모듈 로드 시점에 throw하지 않는다. 빌드가 깨지지 않도록).
- 테스트 계정 이메일 확보 경로는 사용자 확인 필요(요구사항 6번 메모). 이 값이 없으면 쓰기는 구현돼도 실제 검증이 불가능하다.

### 2.2 서버 전용 모듈 (제안: `src/lib/server/`)

`docs/agent-rules/project.md`·`project-structure.md`에 서버 전용 모듈 위치 규칙이 없다. `src/lib/server/`를 제안하며 `project-structure.md` 디렉터리 표에 한 줄 추가한다(확인 필요: 위치 승인). 이 폴더의 모듈은 `"use client"` 파일에서 import하지 않는다.

| 파일 | 역할 |
| --- | --- |
| `src/lib/server/withSession.ts` | 인증이 필요한 모든 Route Handler의 공용 래퍼. `getSession()`(`src/lib/session.ts`)이 null이면 401 응답. 세션 판정은 이 래퍼 한 곳에만 둔다 |
| `src/lib/server/cityApiToken.ts` | 토큰 발급·보관·재발급 (아래 2.4) |
| `src/lib/server/cityUpstream.ts` | 상류 `fetch` 호출, 에러 매핑, 응답 정규화 (아래 2.5) |

`src/proxy.ts`의 matcher가 `api`로 시작하는 경로를 제외한다(코드 확인). 따라서 `/api/cities*`는 proxy 보호를 받지 못하고 `withSession`이 유일한 방어선이다. 이 matcher는 바꾸지 않는다(로그인 리다이렉트는 API에 부적합).

### 2.3 내부 엔드포인트 (브라우저가 호출)

모든 응답은 상류와 같은 래퍼를 쓴다: 성공 `ApiSuccess<T>`, 실패 `ApiFail`. 모든 응답에 `Cache-Control: no-store`. 모든 핸들러는 `withSession`으로 감싼다. 요청 body는 JSON.

| 메서드 경로 | 요청 | 성공 | 상류 호출 |
| --- | --- | --- | --- |
| GET `/api/cities` | - | 200 `ApiSuccess<CityResponse[]>` | GET `/api/v1/cities/all` (토큰 없음) |
| POST `/api/cities` | `CityRequest` | 200 `ApiSuccess<CityResponse>` | POST `/api/v1/cities` (토큰) |
| PUT `/api/cities/[cityId]` | `CityRequest` | 200 `ApiSuccess<CityResponse>` | PUT `/api/v1/cities/{cityId}` (토큰) |
| DELETE `/api/cities/[cityId]` | - | 200 `ApiSuccess<CityResponse>` | DELETE `/api/v1/cities/{cityId}` (토큰) |

파일: `src/app/api/cities/route.ts`(GET, POST), `src/app/api/cities/[cityId]/route.ts`(PUT, DELETE).

입력 검증(신뢰 경계, 핸들러가 권위 있는 검증을 한다. 실패 시 상류를 호출하지 않는다):
- body가 JSON 객체가 아니면 400 `요청 형식이 올바르지 않습니다.`
- 5개 필드 존재·타입(문자열 3개는 trim 후 비어 있지 않음, `lat`·`lng`는 유한한 number) 위반 400 `필수 항목을 모두 입력해주세요.`
- `lat` -90~90 위반 400 `위도는 -90에서 90 사이여야 합니다.`, `lng` -180~180 위반 400 `경도는 -180에서 180 사이여야 합니다.`
- `countryCode`가 `^[A-Z]{3}$`가 아니면 400 `국가 코드는 영문 대문자 3자여야 합니다.` (핸들러는 trim 후 대문자 변환해 상류로 보낸다)
- `cityId`가 양의 정수(`^[1-9][0-9]*$`)가 아니면 400 `올바르지 않은 도시 ID입니다.` 경로에 그대로 끼워 넣지 않고 검증된 숫자 문자열만 쓴다(경로 조작 방지).
- 이름 길이 상한은 두지 않는다(B-5). 서버 400 메시지를 그대로 전달한다.
- 상류로 보내는 body는 5개 필드만 골라 새 객체로 만든다(추가 필드 전달 금지).

상태 코드·메시지 매핑은 4절.

### 2.4 토큰 모듈 (`cityApiToken.ts`)

- 보관: 모듈 스코프 변수 `accessToken: string | null`과 진행 중 발급 `inflight: Promise<string> | null`. 파일·쿠키·응답·로그에 쓰지 않는다. Next 서버 프로세스 메모리에만 존재(B-8). 서버리스·다중 인스턴스에서는 인스턴스마다 따로 발급되고 재발급이 잦을 수 있다(배포 환경 미확인, 확인 필요).
- 함수: `withCityApiToken(call: (authorization: string) => Promise<Response>): Promise<Response>` 하나만 내보낸다.
  1. 토큰이 없으면 `issue()`로 발급한다.
  2. `call(헤더값)` 실행. 응답이 401이면 사용한 토큰이 아직 현재 토큰일 때만 `accessToken = null`로 비우고 재발급 후 `call`을 정확히 1회 재시도한다. 재시도도 401이면 재발급 루프 없이 `UpstreamAuthError`를 던진다.
  3. 토큰을 비교해서 비우므로, 먼저 도착한 요청이 이미 새 토큰을 받았다면 늦게 401을 받은 요청은 새 토큰으로 재시도만 한다.
- 동시 재발급 합치기: `issue()`는 `inflight`가 있으면 그 Promise를 반환하고, 없으면 새로 만들어 `inflight`에 넣고 `finally`에서 `null`로 되돌린다. 요청 수와 무관하게 동시 발급은 1건이다.
- 발급 호출: `POST {CITY_API_BASE_URL}/dev/test-login?email={encodeURIComponent(CITY_API_TEST_EMAIL)}`, 본문 없음. 응답 `ApiSuccess<JwtTokenResponse>`에서 `data.accessToken`만 쓴다. `refreshToken`은 저장하지 않는다(재발급은 test-login 재호출로 한다. `POST /reissue`는 쿠키가 필요해 쓰지 않는다).
- 발급 실패(네트워크 오류, 비 2xx, 응답에 `accessToken` 없음): `UpstreamAuthError`. 이메일 쿼리 문자열이 담긴 URL, 토큰, 상류 본문을 에러 메시지·로그에 넣지 않는다.
- `Authorization` 헤더 값: `accessToken`이 이미 `Bearer `로 시작하면 그대로, 아니면 `Bearer ${accessToken}`을 쓴다. `Bearer` 접두사 포함 여부와 스킴 자체가 `Bearer`인지는 확인 필요(A-2). 이 분기는 어느 쪽이어도 같은 헤더가 나가게 하는 방어이며, 실제 서버에서 쓰기를 검증하기 전에는 동작을 확정할 수 없다.
- 토큰 만료 시간은 확인 필요(A-2). 만료 시각을 추정하지 않고 401 응답으로만 갱신한다.
- 토큰 노출 금지: `console.*`에 토큰·`Authorization` 값을 넘기지 않고, 핸들러는 에러 객체 전체가 아닌 4절의 고정 메시지만 응답한다.

### 2.5 상류 호출 (`cityUpstream.ts`)

- `fetch`에 `cache: "no-store"`와 `signal: AbortSignal.timeout(10_000)`(제안, 10초)을 건다. 상류 응답의 `max-age=86400`이 Next 서버 캐시에 남아 쓰기 후 목록이 낡아지는 것을 막는다.
- 상류 응답 본문이 JSON이 아니거나 `{status, data}` 형태가 아니면 502로 처리한다.
- 상류 성공 응답의 `data`만 검증 없이 통과시키지 않는다: 목록은 배열인지, 단건은 객체인지 확인하고 아니면 502.
- 상류 오류 본문은 그대로 흘리지 않는다. 상류가 `{status:"fail", data:string}`이면 `data` 문자열만 꺼내 4절 규칙으로 전달한다.

## 3. 클라이언트 계층

### 3.1 `src/lib/apiClient.ts` (신규, 브라우저 전용)

내부 엔드포인트(`/api/cities*`) 호출용 `fetch` 래퍼. 상류 주소를 알지 못한다.

```ts
class ApiError extends Error { status: number }          // status 0 = 네트워크 실패
apiGet<T>(path: string): Promise<T>                      // ApiSuccess<T>를 벗겨 data 반환
apiPost<T>(path: string, body: unknown): Promise<T>
apiPut<T>(path: string, body: unknown): Promise<T>
apiDelete<T>(path: string): Promise<T>
```

- `credentials`는 기본값(same-origin)으로 세션 쿠키가 동봉된다. 요청에 `Content-Type: application/json`.
- 응답이 `ok`가 아니면 body의 `ApiFail.data`를 `ApiError.message`로 쓴다. body 파싱 실패 시 4절 기본 메시지.
- `fetch` 자체가 던지면(네트워크 실패) `ApiError(0, "서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.")`.
- 401은 대시보드 세션 만료를 뜻한다(상류 인증 실패는 502로 매핑하므로 겹치지 않는다). `apiClient`가 `window.location.assign("/login")`로 이동시킨 뒤 `ApiError`를 던진다(요구사항 F-09: 세션 만료는 로그인 화면으로). 이동 방식이 UI 결정이면 frontend-developer가 조정한다.

### 3.2 `src/services/cityService.ts` (재작성)

도메인 타입만 반환한다(`react-query.md` 1번). 시그니처는 현재와 같고 `searchCities`만 제거한다.

```ts
getCities(): Promise<City[]>                                         // apiGet<CityResponse[]>("/api/cities") -> 변환
addCity(params: CityRequest): Promise<City>                          // apiPost
updateCity(cityId: string, params: CityRequest): Promise<City>       // apiPut(`/api/cities/${cityId}`)
deleteCity(cityId: string): Promise<void>                            // apiDelete, 반환 data는 버림
```

- 변환 `transformApiDataToCity`(서비스 파일 안, 현재 코드 유지): `id = String(cityId)`, `name = cityName`, `country = countryName`, `flag = getCountryFlag(countryCode)`, `lat`, `lng`, `countryCode`(alpha-3 그대로).
- 서비스는 입력 정규화(`trim`, `countryCode` 대문자)만 한다. 필수값·범위·형식 검증과 100자 제한은 서비스에서 제거한다(권위 있는 검증은 2.3 핸들러, 즉시 피드백은 `CityFormModal`). 서비스와 핸들러 양쪽에서 같은 규칙을 이중 관리하지 않기 위한 제안이다.
- 타입 `CityRequest`는 `AddCityRequest`·`UpdateCityRequest`를 대체한다(두 타입이 동일 구조).

### 3.3 `src/types/city.ts`

- 유지: `CityApiData`(= 1절 `CityResponse`, 이름 유지로 변경 최소화), `City`.
- 신규: `CityRequest`, `ApiSuccess<T>`, `ApiFail`(1절 형태).
- 삭제(실제 사용처 없음 또는 실제 계약과 불일치): `CityApiResponse`(`cityResponseList`, `/favorites` 기준), `CitySearchResponse`, `AddCityRequest`, `AddCityResponse`, `UpdateCityRequest`, `UpdateCityResponse`, `DeleteCityRequest`, `DeleteCityResponse`. 파일 상단 목업 서술 주석도 실제 연동 기준으로 고친다.

### 3.4 alpha-3 국기 변환 (`src/utils/countryFlagMapping.ts`)

- `getCountryFlag(countryCode: string): string` 시그니처 유지, 입력은 alpha-3.
- 구현 제안: ISO 3166-1 alpha-3 -> alpha-2 표(전체, 249개)를 두고 alpha-2에서 국기 이모지를 계산한다(Regional Indicator 코드포인트 `0x1F1E6 + (문자 - 'A')` 두 개). 이모지 249개를 직접 나열하지 않는다. 표에 없는 코드는 현재 폴백(흰 깃발 `🏳️`)을 유지한다. 실데이터 고유 코드 63개는 전부 표에 있어야 한다(`ATA` 포함, 구현 시 전수 확인 필요. 이 명세에서는 63개 목록을 보지 못했다).
- 변환 위치는 클라이언트(서비스의 `transformApiDataToCity`)다. 서버는 `countryCode`만 전달한다.

### 3.5 검색 = 클라이언트 필터링 (B-1)

- `GET /api/cities?keyword=` 같은 서버 검색 엔드포인트는 만들지 않는다. 서비스에 `searchCities`를 두지 않는다.
- `src/hooks/useCities.ts`: `citiesQueryOptions()`를 인자 없이 `getCities`로 구성하고 `queryKeys.cities.list`도 keyword 인자를 없앤다(`["cities","list"]`). `useCities(keyword)`는 `select`에서 필터링한다. 같은 목록 캐시를 검색어마다 재사용하므로 타이핑 중 요청이 없고, 이전 응답이 늦게 도착해 덮어쓰는 문제가 생기지 않는다.
- 필터 규칙(기존 `searchMockCities`와 동일, 코드 확인): `keyword.trim().toLowerCase()`가 비면 전체, 아니면 `cityName.toLowerCase().includes(keyword)`. 서버 순서를 재정렬하지 않는다. 국가명까지 검색 대상에 넣을지는 제품 결정이라 이 명세는 기존 동작(도시명만)을 따른다. 순수 함수 `filterCities(cities: City[], keyword: string): City[]`를 `src/utils/cityFilter.ts`에 둔다(제안).
- `useCities`는 `select`로 필터링하므로 `data`가 필터된 결과다. 전체 건수가 필요한 UI가 없으면 그대로 쓴다.

### 3.6 중복 사전 검사 (B-6)

- 위치: `useAddCityMutation`·`useUpdateCityMutation`의 `mutationFn` 안(제안). `queryClient.getQueryData(citiesQueryOptions().queryKey)`로 이미 로드된 전체 목록을 읽어 순수 함수 `findDuplicateCity(cities, {cityName, countryName}, excludeId?)`(`src/utils/cityDuplicate.ts`)로 검사한다. 서비스는 `queryClient`를 모르므로 서비스에 두지 않는다.
- 비교: `cityName`·`countryName` 각각 trim + 소문자 변환 후 일치. 수정은 `excludeId`(자기 자신 `City.id`)를 제외한다. 중복이면 `Error("이미 등록된 도시입니다.")`를 던지고 상류를 호출하지 않는다.
- 목록 캐시가 아직 없으면 사전 검사를 건너뛰고 서버에 맡긴다(전체 목록이 없을 때 불완전한 검사를 하지 않는다).
- 사전 검사는 UX용이며 유일성을 보장하지 않는다. 두 탭·두 사용자의 동시 추가는 막지 못한다. 서버가 중복을 거부하는지는 확인 필요(A-5)이고, 이 명세는 서버 쪽 유일성이 있다고 가정하지 않는다. 서버가 거부하면 그 메시지를 그대로 표시한다.
- 비교 기준(소문자 변환 포함)은 제안이다. 대소문자만 다른 영문 도시를 같은 도시로 볼지 제품 확인 필요.

## 4. 에러 매핑

핸들러가 클라이언트에 주는 형태는 항상 `ApiFail` (`{status:"fail", data:<메시지>}`)이다.

| 원인 | 내부 응답 상태 | 메시지(`data`) |
| --- | --- | --- |
| 대시보드 세션 없음/만료 | 401 | `로그인이 필요합니다.` |
| 핸들러 입력 검증 실패 | 400 | 2.3 표의 메시지 |
| 상류 400 | 400 | 상류 `data` 문자열 그대로. 문자열이 아니면 `요청이 올바르지 않습니다.` |
| 상류 404 | 404 | 상류 `data` 문자열이 있으면 그대로, 없으면 `대상을 찾을 수 없습니다.` |
| 상류 기타 4xx(409 등. 중복·없는 id의 실제 코드는 확인 필요) | 상류 상태 그대로 | 상류 `data` 문자열이 있으면 그대로, 없으면 `요청을 처리할 수 없습니다.` |
| 상류 401이고 재발급 후 재시도도 401, 또는 토큰 발급 실패 | 502 | `서버 인증에 실패했습니다.` (대시보드 세션 만료와 구분하려고 401을 쓰지 않는다) |
| 상류 5xx | 502 | `도시 서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.` |
| 상류 네트워크 실패/타임아웃/비 JSON 응답 | 502 (타임아웃은 504) | `도시 서버에 연결할 수 없습니다.` (타임아웃은 `도시 서버 응답이 지연되고 있습니다.`) |
| 서버 환경 변수 누락 | 500 | 2.1의 고정 메시지 |
| 브라우저에서 핸들러까지 도달 불가 | (상태 없음) | `apiClient`가 `ApiError(0, "서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.")` |

- 상류 메시지를 그대로 전달하는 경우에도 문자열만 꺼내고 길이를 500자로 자른다(제안). 상류 본문 전체·스택·헤더는 전달하지 않는다.
- 서비스는 `ApiError`를 그대로 던지고 `ApiError.message`가 UI에 표시되는 문자열이다(현재 `CitiesPageContent`가 `error instanceof Error ? error.message`로 쓰므로 호환, 코드 확인).
- 쓰기 실패 시 모달은 열린 채 입력값을 보존한다(현재 훅·모달 동작 유지).

## 5. 삭제·변경 대상 파일

### 신규
- `src/app/api/cities/route.ts` (GET, POST)
- `src/app/api/cities/[cityId]/route.ts` (PUT, DELETE)
- `src/lib/server/withSession.ts`, `src/lib/server/cityApiToken.ts`, `src/lib/server/cityUpstream.ts`
- `src/lib/apiClient.ts`
- `src/utils/cityFilter.ts`, `src/utils/cityDuplicate.ts`

### 삭제 (B-2)
- `src/mocks/mockCities.ts`, `src/mocks/mockDelay.ts` (`src/mocks/` 폴더 전체)
- `tests/mocks/mockCities.test.ts`

### 변경
- `src/services/cityService.ts` (재작성, 3.2), `src/types/city.ts` (3.3), `src/utils/countryFlagMapping.ts` (3.4)
- `src/hooks/useCities.ts`, `src/hooks/useCityMutations.ts`, `src/lib/react-query/query-keys.ts` (3.5, 3.6, 타입명 변경)
- `src/components/cities/CityFormModal.tsx`: `COUNTRY_CODE_PATTERN`을 `^[A-Za-z]{3}$`로, 오류 문구 예시를 `KOR`로, `NAME_MAX_LENGTH`와 `maxLength` 속성 및 100자 검증 제거(B-5). UI 문구·표시는 frontend-developer 소관.
- `.env.example`: `CITY_API_BASE_URL`, `CITY_API_TEST_EMAIL` 추가(가짜 값)
- `src/docs/city-api-reference.md`: 실제 Swagger 스펙(1절) 기준으로 갱신(B-9)
- `docs/agent-rules/project.md`("백엔드" 항목), `react-query.md`(계층 1행, 5번 목업 지연 항목), `project-structure.md`(서문, 디렉터리 표의 `mocks/`, 핵심 규칙 2~4번), `nextjs.md` 6번(목업 서술): 목업 서술을 실제 연동에 맞게 갱신. `src/lib/server/` 위치 추가
- 소스 주석 중 "목업"을 언급하는 곳(`useCityMutations.ts` 등)은 실제 동작에 맞게 정리

## 6. 영향받는 기존 테스트 (목록만, 작성 담당 배정 없음)

- `tests/mocks/mockCities.test.ts`: 대상 모듈 삭제로 파일 삭제
- `tests/services/cityService.test.ts`: `@/mocks/mockDelay` 모킹과 목업 저장소 기반 전체가 깨짐. 모킹된 `fetch`(또는 `apiClient`) 기준 재작성 대상. 100자·2자리 검증, 중복·없는 id 케이스는 서비스에서 사라지므로 해당 단언의 이동 여부 검토. `searchCities` describe는 대상 함수 제거
- `tests/components/CityFormModal.test.tsx`: alpha-2 단언(`KR`, 오류 문구 77·111행, `JP` 190행), 100자 관련 단언이 있으면 alpha-3로 수정
- `tests/components/CityListTable.test.tsx`, `tests/components/DeleteConfirmDialog.test.tsx`: `countryCode: "KR"` 픽스처(국기 단언이 있으면 alpha-3 기준으로)
- `tests/components/SearchInput.test.tsx`: 서비스·목업 import는 없음(grep 확인). 영향 없을 것으로 보이나 실행으로 확인 필요
- `tests/test-utils/renderWithProviders.tsx`: 영향 여부 미확인
- 신규 모듈(Route Handler, 토큰 모듈, `apiClient`, 필터·중복 유틸)에는 기존 테스트가 없다. 작성은 qa-engineer 담당.

## 7. 확인 필요 (사실로 쓰지 않음)

1. 일반 회원(test-login) 토큰으로 도시 쓰기가 허용되는지(역할 검사 여부). 허용되지 않으면 추가·수정·삭제는 실제 서버에서 성공하지 않는다.
2. `accessToken` 만료 시간. `accessToken` 값의 `Bearer ` 접두사 포함 여부와 스킴.
3. 중복 도시 추가, 없는 id 수정·삭제 시 상류의 상태 코드와 메시지. 4절은 이를 상태 코드 통과 + 메시지 통과로 설계했을 뿐 실제 값이 아니다.
4. 상류 `status` 필드의 성공 값이 `"success"` 외에 있는지(`ApiSuccess.status`를 `string`으로 둔 이유).
5. 쓰기 직후 `GET /api/v1/cities/all`이 상류 쪽 캐시(`max-age=86400, public`)로 낡은 목록을 돌려주는지. 이 서버는 `no-store`로 호출하지만 상류 앞단 캐시가 있으면 영향을 받을 수 있다.
6. 배포 환경(서버리스 여부)과 `CITY_API_BASE_URL`·`CITY_API_TEST_EMAIL` 설정 방법, 테스트 계정 이메일 확보 경로.
7. 상류가 평문 HTTP라 Next 서버와 상류 사이에서 토큰이 암호화되지 않는다. dev 서버 한정이며 운영 연동은 범위 밖(`test-login`이 운영에서 404).
8. `src/lib/server/` 위치, 클라이언트 필터가 도시명만 보는 것(국가명 포함 여부), 중복 비교의 대소문자 무시 기준: 제안이며 승인 필요.
9. Next.js 16 Route Handler 문법(`params` Promise 등): 이 worktree에 `node_modules`가 없어 공식 문서로 확인하지 못했다.
