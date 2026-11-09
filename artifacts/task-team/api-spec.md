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

호스트: dev 서버 `http://54.180.101.234:8080` (평문 HTTP. `https://dev.globber.world/api/dev/test-login`은 HTML을 돌려줘 쓰지 못한다). 경로는 호스트 루트 기준이다(`/api/v1/cities*`, `/dev/test-login`). (2차 주석: 2차 절이 우선한다. 개발 서버 주소는 CITY_API_DEV_BASE_URL이고 운영 서버가 추가된다.)

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
- `CITY_API_BASE_URL` 누락: 모든 도시 엔드포인트가 500 `서버 설정 오류: 도시 API 주소가 설정되지 않았습니다.` (2차 주석: CITY_API_BASE_URL은 제거되고 서버별 변수로 대체된다. 2차 절 2-B 참조.)
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

모든 응답은 상류와 같은 래퍼를 쓴다: 성공 `ApiSuccess<T>`, 실패 `ApiFail`. 모든 응답에 `Cache-Control: no-store`. 모든 핸들러는 `withSession`으로 감싼다. 요청 body는 JSON. (2차 주석: 모든 요청에 server 쿼리 파라미터가 필수이고 운영 쓰기는 403이다. 2차 절 2-A, 2-C 참조.)

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
- 발급 호출: `POST {CITY_API_BASE_URL}/dev/test-login?email={encodeURIComponent(CITY_API_TEST_EMAIL)}`, 본문 없음. 응답 `ApiSuccess<JwtTokenResponse>`에서 `data.accessToken`만 쓴다. `refreshToken`은 저장하지 않는다(재발급은 test-login 재호출로 한다. `POST /reissue`는 쿠키가 필요해 쓰지 않는다). (2차 주석: 발급 URL은 CITY_API_DEV_BASE_URL 기준이며 개발 서버 전용이다. 2차 절 2-D 참조.)
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

도메인 타입만 반환한다(`react-query.md` 1번). 시그니처는 현재와 같고 `searchCities`만 제거한다. (2차 주석: 시그니처 첫 인자에 server가 추가된다. 2차 절 2-E 참조.)

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
- `src/hooks/useCities.ts`: `citiesQueryOptions()`를 인자 없이 `getCities`로 구성하고 `queryKeys.cities.list`도 keyword 인자를 없앤다(`["cities","list"]`). `useCities(keyword)`는 `select`에서 필터링한다. 같은 목록 캐시를 검색어마다 재사용하므로 타이핑 중 요청이 없고, 이전 응답이 늦게 도착해 덮어쓰는 문제가 생기지 않는다. (2차 주석: queryKeys.cities.list는 서버별 키 함수가 된다. 2차 절 2-E 참조.)
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
- `.env.example`: `CITY_API_BASE_URL`, `CITY_API_TEST_EMAIL` 추가(가짜 값) (2차 주석: 변수가 CITY_API_PROD_BASE_URL, CITY_API_DEV_BASE_URL, CITY_API_TEST_EMAIL로 바뀐다. 2차 절 2-B 참조.)
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
7. 상류가 평문 HTTP라 Next 서버와 상류 사이에서 토큰이 암호화되지 않는다. dev 서버 한정이며 운영 연동은 범위 밖(`test-login`이 운영에서 404). (2차 주석: 운영 조회는 2차에서 범위 안이 됐고 운영 쓰기는 403으로 거부한다. 2차 절 2-C 참조.)
8. `src/lib/server/` 위치, 클라이언트 필터가 도시명만 보는 것(국가명 포함 여부), 중복 비교의 대소문자 무시 기준: 제안이며 승인 필요.
9. Next.js 16 Route Handler 문법(`params` Promise 등): 이 worktree에 `node_modules`가 없어 공식 문서로 확인하지 못했다.

---

# 2차: 운영·개발 서버 분리

입력: `requirements.md`의 "2차" 절(2-9 확정 결정). 이 절은 1차 본문과 충돌하면 우선한다. 표기는 1차와 같다("확인됨", "코드 확인", "제안", "확인 필요"). 이 절은 명세만 정하며 코드는 아직 바뀌지 않았다. 실제 주소·이메일 값은 적지 않는다.

사용자 승인 (2026-11-09): 이 절의 기본안(`server` 쿼리 방식, 400·403 상태 코드, 서버 이름이 들어간 500 문구, URL 형식 검증, `src/lib/server/cityServer.ts` 신규)을 그대로 승인.

## 2-A. 대상 서버 지정

- 방식(제안): 모든 `/api/cities*` 요청에 쿼리 파라미터 `server`를 필수로 붙인다. 허용 값은 소문자 `prod`, `dev` 두 개뿐이다(대소문자 구분, 허용 목록 비교). 예: `GET /api/cities?server=prod`, `PUT /api/cities/12?server=dev`.
- 임의 URL·호스트는 받지 않는다. 클라이언트가 보낸 값은 허용 목록 비교에만 쓰고 주소 조립에 쓰지 않는다(SSRF 방지). 주소는 서버 환경 변수에서만 읽는다.
- `server` 누락, 빈 값, 중복 지정(`server=prod&server=dev`), 허용 목록 밖 값: 400 `대상 서버를 확인할 수 없습니다.` 기본값(개발 등)으로 대체하지 않으며 상류 호출·토큰 발급이 0회다.
- 타입(제안): `src/types/city.ts`에 `export type CityServer = "prod" | "dev"`를 두고 서버·클라이언트가 함께 쓴다. 파라미터 파싱은 `src/lib/server/` 안 한 곳(예: `cityServer.ts`의 `parseCityServer(request): CityServer | null`)에서 하고 세 핸들러가 공유한다.
- 판정 순서(모든 메서드 공통): `withSession`(401) -> `server` 검증(400) -> 운영 쓰기 거부(403, 2-C) -> 기존 검증(`cityId` 400, content-type 415, 본문 400) -> 상류 호출. 앞 단계에서 실패하면 뒤 단계는 실행하지 않는다.

내부 엔드포인트(1차 2.3의 경로에 `server`가 붙는다. 성공 본문과 에러 매핑은 1차 4절 그대로).

| 메서드 경로 | `server=prod` | `server=dev` |
| --- | --- | --- |
| GET `/api/cities` | 운영 상류 조회(토큰 없음) | 개발 상류 조회(토큰 없음) |
| POST `/api/cities` | 403 거부 | 1차와 같음(토큰) |
| PUT `/api/cities/[cityId]` | 403 거부 | 1차와 같음(토큰) |
| DELETE `/api/cities/[cityId]` | 403 거부 | 1차와 같음(토큰) |

## 2-B. 환경 변수

`NEXT_PUBLIC_` 접두사 금지, 요청 시점에 읽는다(모듈 로드 시점에 throw하지 않는다).

| 이름 | 용도 | `.env.example` 예시(가짜 값) |
| --- | --- | --- |
| `CITY_API_PROD_BASE_URL` | 운영 상류 기준 주소. 뒤에 `/api/v1/cities...`를 붙인다. 운영은 값이 `/api`로 끝난다(2-9 확정). 끝 슬래시 없음 | `https://prod.example.com/api` |
| `CITY_API_DEV_BASE_URL` | 개발 상류 기준 주소(호스트 루트). 뒤에 `/api/v1/cities...`와 `/dev/test-login`을 붙인다. 끝 슬래시 없음 | `http://127.0.0.1:8080` |
| `CITY_API_TEST_EMAIL` | 개발 서버 `/dev/test-login`에 넘길 테스트 계정 이메일. 개발 쓰기 전용 | `test@example.com` |

- `CITY_API_BASE_URL`은 제거한다. 코드와 `.env.example`에서 지우고 폴백을 두지 않는다(남기면 서버 구분이 흐려진다). 배포 환경(Vercel 등)은 새 두 변수 설정과 기존 변수 삭제가 필요하다(사용자/배포 담당).
- 상류 경로(`/api/v1/cities/all`, `/api/v1/cities`, `/api/v1/cities/{id}`)는 두 서버 공통 상수이고 서버별 차이는 기준 주소 값에만 둔다. 후행 슬래시는 제거한다(현재 `replace(/\/+$/, "")` 동작 유지). 주소는 문자열 이어붙이기로 조립한다(`new URL(path, base)`는 base의 `/api` 경로를 지울 수 있어 쓰지 않는다).
- 형식 검증(제안): 값이 빈 문자열이거나 `new URL()`로 파싱되지 않거나 프로토콜이 `http:`/`https:`가 아니면 누락과 같은 설정 오류로 처리한다.
- 누락·오류 응답은 모두 500이며 `UpstreamConfigError` 경로를 쓴다(접두사 `서버 설정 오류:` 유지). 변수 이름·주소 값은 메시지에 넣지 않고 서버 이름(운영/개발)만 넣는다.

| 상황 | 영향 | 응답 |
| --- | --- | --- |
| `CITY_API_PROD_BASE_URL` 누락·오류 | 운영 대상 요청만 실패. 개발은 정상 | 500 `서버 설정 오류: 운영 서버 주소가 설정되지 않았습니다.` |
| `CITY_API_DEV_BASE_URL` 누락·오류 | 개발 대상 요청(조회·쓰기·토큰 발급)만 실패. 운영 조회는 정상 | 500 `서버 설정 오류: 개발 서버 주소가 설정되지 않았습니다.` |
| `CITY_API_TEST_EMAIL` 누락 | 개발 쓰기만 실패. 양쪽 조회는 정상 | 500 `서버 설정 오류: 테스트 계정이 설정되지 않았습니다.` (1차 문구 유지) |
| 셋 다 누락 | 모든 도시 요청이 500. 앱 기동은 크래시하지 않음 | 위 문구 |

개발 쓰기의 검사 순서는 주소 검증 -> 이메일 검증 -> 토큰 발급이다. 운영 쓰기는 2-C에서 환경 변수 검사 전에 거부하므로 운영 주소가 없어도 403이다.

## 2-C. 운영 쓰기 거부

- 대상: `server=prod`인 POST `/api/cities`, PUT·DELETE `/api/cities/[cityId]`.
- 응답: 403 `운영 서버는 쓰기 인증 준비 전이라 조회만 할 수 있습니다.` (2-9 확정 문구 그대로, `ApiFail` 래퍼, `Cache-Control: no-store`).
- 위치: `withSession` 통과 직후, `server` 검증 직후이며 본문 읽기·`cityId` 검증·환경 변수 읽기보다 앞이다. 상류 `fetch` 0회, 토큰 발급 `fetch` 0회이고 잘못된 본문도 400/415가 아니라 403이 우선한다. 세션이 없으면 401이 우선한다(1차 유지).
- 운영 쓰기를 허용하는 플래그·환경 변수·우회 경로는 만들지 않는다(범위 밖).
- 구현 지침(제안): `proxyCityApi` 옵션을 `{ server: "prod"; authenticated: false }`와 `{ server: "dev"; authenticated: boolean }`의 판별 유니온으로 두어 운영에 `authenticated: true`를 타입으로 만들 수 없게 한다. 핸들러의 403 가드는 런타임 방어선으로 별도 유지한다.

## 2-D. 토큰은 개발 서버 전용

- `cityApiToken.ts`의 토큰 변수(`accessToken`, `inflight`)는 개발 서버 하나만 가리킨다. 서버 인자를 받지 않고 개발 기준 주소만 읽는다. 발급 URL은 `{CITY_API_DEV_BASE_URL}/dev/test-login?email=...`로만 만든다. 운영 주소로 test-login을 호출하지 않는다.
- 운영 요청(조회 포함): `Authorization` 헤더 없음, 테스트 이메일 읽기 없음, 토큰 모듈 호출 없음.
- `withCityApiToken`(401이면 재발급 후 정확히 1회 재시도, 재시도도 401이면 `UpstreamAuthError` -> 502 `서버 인증에 실패했습니다.`)은 개발 호출에서만 쓴다. 동시 발급 합치기와 토큰 비교 후 비우기는 1차 그대로다.
- 상류 주소를 바꾸고 재시작하면 메모리 토큰이 사라지므로 이전 주소 토큰이 재사용되지 않는다. 실행 중 환경 변수가 바뀌는 경우는 지원하지 않는다(제안).
- 토큰·이메일·주소는 로그·응답·에러 메시지에 노출하지 않는다(1차 유지).

## 2-E. 클라이언트 계층

서비스(`src/services/cityService.ts`)는 첫 인자로 서버를 받는다. 반환 타입은 그대로다.

```ts
getCities(server: CityServer): Promise<City[]>                                      // apiGet(`/api/cities?server=${server}`)
addCity(server: CityServer, params: CityRequest): Promise<City>                     // apiPost
updateCity(server: CityServer, cityId: string, params: CityRequest): Promise<City>  // apiPut(`/api/cities/${encodeURIComponent(cityId)}?server=${server}`)
deleteCity(server: CityServer, cityId: string): Promise<void>                       // apiDelete
```

- 쓰기 함수도 `CityServer` 전체를 받는다(운영 쓰기는 UI가 막고 서버가 403으로 거부한다). 호출 측이 서버를 빼먹지 못하도록 기본값을 두지 않는다.
- `queryKeys`(`src/lib/react-query/query-keys.ts`, 현재 `all`과 상수 `list`):

```ts
cities: {
  all: ["cities"] as const,
  list: (server: CityServer) => ["cities", "list", server] as const,
}
```

- 훅: `citiesQueryOptions(server)`, `useCities(server, keyword)`. 쓰기 훅 `useAddCityMutation(server)`, `useUpdateCityMutation(server)`, `useDeleteCityMutation(server)`는 `queryKeys.cities.list(server)`만 invalidate한다(현재의 `cities.all` 무효화는 운영 캐시까지 건드리므로 쓰지 않는다). 중복 사전 검사의 `getQueryData`도 같은 서버 키를 읽는다.
- 이전 서버의 늦은 응답은 키가 달라 현재 탭 캐시를 덮어쓰지 않는다. 탭 전환 UI·모달 중 전환 차단·검색어 유지·서버 라벨은 frontend-developer 소관이며 이 명세는 서비스·훅의 `server` 인자 계약만 정한다.

## 2-F. 영향받는 기존 테스트 (목록만, 작성 담당 배정 없음)

`tests/` 아래 grep(`cityService`, `queryKeys`, `citiesQueryOptions`, `CITY_API`, 서버 모듈 import) 기준이다.

- `tests/app/api/cities/route.test.ts`, `tests/app/api/cities/cityId/route.test.ts`: `server` 없는 요청과 `CITY_API_BASE_URL` 설정이 깨진다.
- `tests/lib/server/cityApiToken.test.ts`: 단일 `CITY_API_BASE_URL` 기반 단언이 `CITY_API_DEV_BASE_URL`로 바뀐다.
- `tests/lib/server/cityUpstream.test.ts`: `proxyCityApi` 옵션에 `server`가 추가된다.
- `tests/services/cityService.test.ts`: 호출 시그니처(첫 인자 서버)와 요청 URL(`?server=`)이 바뀐다.
- `tests/hooks/useCityMutations.test.tsx`: 서비스 모킹 시그니처, `citiesQueryOptions().queryKey` 사용, invalidate 대상 키.
- `tests/components/CityFormModal.test.tsx`, `tests/components/DeleteConfirmDialog.test.tsx`: `citiesQueryOptions().queryKey` 시딩과 실제 서비스 경로의 fetch URL 단언.
- `tests/test-utils/renderWithProviders.tsx`: `useCities`/`useCityMutations` 사용 컴포넌트용 래퍼라 영향 여부는 실행으로 확인 필요.
- `tests/utils/cityErrorMessage.test.ts`: 403 문구·서버 라벨을 `cityErrorMessage`에 추가하는 경우에만 영향.

## 2-G. 변경 대상 파일 (제안)

`src/lib/server/cityApiToken.ts`(서버별 주소 함수, 토큰은 개발 전용), `src/lib/server/cityUpstream.ts`(`server` 옵션), `src/lib/server/cityServer.ts`(신규, 파싱), 두 Route Handler, `src/types/city.ts`(`CityServer`), `src/services/cityService.ts`, `src/hooks/useCities.ts`, `src/hooks/useCityMutations.ts`, `src/lib/react-query/query-keys.ts`, `.env.example`, `src/docs/city-api-reference.md`, `docs/agent-rules/project.md`(백엔드 항목).

## 2-H. 확인 필요 (사실로 쓰지 않음)

1. 운영 응답 envelope(`{status, data}`)와 필드가 개발과 같은지. 현재 검증(`data`가 배열)이 운영에서 통과하는지는 운영 조회로 확인해야 한다(요구사항 C-5).
2. 운영 조회 경로 `{운영 기준 주소}/api/v1/cities/all`(기준 주소가 `/api`로 끝남)은 2-9 결정을 따른 것이며 이 작업에서 직접 호출로 재확인하지 않았다.
3. 운영·개발 간 도시 id의 동일성(C-2). 서버별 캐시 분리로 가정을 피한다.
4. 운영 서버 호출 허용량(4,204개 전체 조회, C-6)과 `Cache-Control`/ETag 동작.
5. 1차 이월: 개발 서버 쓰기 동작(토큰 만료, `Bearer` 접두사, 역할 검사, 중복·없는 id 응답, C-3).
6. 개발(IP)과 개발(도메인)이 같은 서버인지(C-1). 이 명세의 개발은 IP 서버 하나다.
7. 배포 환경 변수 재설정 절차(C-7).

# 3차: 위치 검색 프록시

입력: `requirements.md`의 "3차" 절(I-05·I-07·I-08, 3-4, 3-7, 3-9의 N-1~N-4 확정). 이 절은 명세만 정하며 구현 코드는 없다. 1·2차 본문과 충돌하면 이 절이 우선한다.
표기: "정책 확인"은 공식 문서를 읽은 내용(2026-11-09, 이 작업의 WebFetch와 orchestrator 확인이 일치), "코드 확인"은 이 저장소 코드를 읽은 사실, "제안"은 이 문서의 설계 결정, "확인 필요"는 미확인이다. Nominatim API는 호출하지 않았다.
이 사이클에도 DB는 없다. 도시 API(`server` 쿼리)와 무관한 별도 엔드포인트다.

## 3-0. Nominatim 정책 확인 (requirements 3-7 Q-1 해소)

- 정책 출처: https://operations.osmfoundation.org/policies/nominatim/
- API 출처: https://nominatim.org/release-docs/latest/api/Search/

| 항목 | 정책 확인 내용 | 이 설계의 대응 |
| --- | --- | --- |
| 호출 빈도 | 절대 상한 초당 1회. 웹사이트/앱 단위이며 모든 사용자 트래픽의 합이 한도를 넘으면 안 된다 | 3-F 최소 호출 간격 |
| 식별 | 앱을 식별하는 유효한 HTTP Referer 또는 User-Agent 필수. 라이브러리 기본값은 불가 | 3-C User-Agent |
| 자동완성 | 클라이언트 측 자동완성 구현 금지 | 버튼 클릭 때만 호출(frontend 소관). 서버는 키 입력 단위 호출을 만들지 않는다 |
| 캐시 | 앱은 프록시를 두고 요청 캐시를 켜야 한다. 같은 질의를 반복하면 차단될 수 있다 | 3-F 인스턴스 메모리 캐시 도입(필수) |
| 출처 표기 | 매체에 맞게 표기 의무. 데이터는 ODbL | 3-D: 응답 필드는 불필요, UI 정적 문구로 표기 |
| 대량 조회 | 비권장. 주기적 앱 요청은 대량 조회로 간주, 체계적 조회·수집 금지 | 일괄 조회 기능을 만들지 않는다 |
| 중단 요구 | 앱은 OSMF 요청 시 소프트웨어 업데이트 없이 끌 수 있어야 한다 | 3-G `NOMINATIM_DISABLED`(제안) |
| 개인 정보 | 개인·기밀 데이터를 보내지 않는다 | 도시명·국가코드만 전달 |
| 보장 | 접근 철회·정책 변경이 예고 없이 가능. 명시적 보증 조항은 확인되지 않음 | 실패 시 수동 입력 흐름 유지(I-07) |

Search API 확인: `countrycodes`는 alpha-2 쉼표 목록의 하드 필터. `limit` 기본 10·상한 40. `format`은 명시해야 한다(생략 시 공용 서버가 웹 UI로 보냄). `addressdetails=1`이면 `address.country_code`가 온다. `q`와 구조화 파라미터(`city` 등)는 함께 쓰지 않는다. `email`은 대량 호출 시 권장되는 선택 파라미터. jsonv2 필드: `place_id`, `osm_type`, `osm_id`, `lat`, `lon`, `display_name`, `name`, `addresstype`, `category`, `type`, `importance`, `address`.

확인되지 않은 것: "내부 어드민 도구 허용 여부"를 따로 정한 조항은 찾지 못했다(앱 단위 규칙이 적용된다고 읽을 뿐 허용 보증이 아님). 한국어 이름 품질과 `address.country_code` 누락 가능성(Q-4), 배포 IP 제한(Q-2)은 여전히 확인 필요다.

## 3-A. 엔드포인트

| 항목 | 값 |
| --- | --- |
| 경로(제안) | `GET /api/geocode` (`src/app/api/geocode/route.ts`) |
| 메서드 | GET만. 다른 메서드는 Next 기본 405 |
| 인증 | `withSession` 필수. 세션 없음 -> 401 `{status:"fail", data:"로그인이 필요합니다."}`, 상류 미호출 |
| `server` 쿼리 | 받지 않는다. 알 수 없는 쿼리는 무시하고 상류에 전달하지 않는다 |
| 쿼리 | `city`(도시명), `country`(alpha-3) |
| 성공 응답 | `200 {status:"success", data: GeocodeCandidate[]}` (0건이면 빈 배열, 200) |
| 실패 응답 | 기존 `ApiFail`(`failResponse`) 형식 + `code` 필드(3-E) |

경로 근거: 도시 리소스가 아니므로 `/api/cities*`에 두지 않는다(`[cityId]` 동적 경로와 충돌 방지, 제안). Route Handler는 기본 캐시되지 않으므로(1차에서 확인한 `15-route-handlers.md`) 응답 캐시는 3-F 서버 내부 캐시로만 하고, 브라우저 응답에는 `Cache-Control: no-store`를 둔다(제안).

## 3-B. 입력 검증과 400 규칙

Route Handler가 권위 있게 검증하며 상류 호출 전에 모두 통과해야 한다.

| 입력 | 규칙 | 위반 시 |
| --- | --- | --- |
| `city` | 없음/중복 지정/제어 문자 제거 후 trim 빈 문자열 -> 거부. 길이 상한 100자(제안) | 400 `INVALID_INPUT` "도시명을 입력해 주세요." |
| `country` | `^[A-Z]{3}$`(대문자만, 도시 API 검증과 같은 규칙, 서버가 정규화하지 않음) | 400 `INVALID_INPUT` "국가 코드가 올바르지 않습니다." |
| alpha-3 -> alpha-2 | `countryFlagMapping.ts`의 표로 변환. 표에 없는 코드(`HKR`, `ZYC` 포함)는 상류 미호출 | 400 `INVALID_INPUT` "지원하지 않는 국가 코드입니다." |

- 상류 URL은 `URLSearchParams`로 만든다. 문자열 이어붙이기 금지.
- 코드 확인: 해당 표는 `src/utils/countryFlagMapping.ts` 안에 있으나 `getCountryFlag`만 export된다. 서버에서 쓰려면 표 또는 조회 함수를 export해야 한다(구현 몫, 순수 데이터라 양쪽 import 가능). 표를 복제하지 않는다.

## 3-C. 상류 호출

- 호스트·경로는 서버 코드 상수로 고정한다: Nominatim 공용 서버의 `/search`. 클라이언트 입력·환경 변수로 호스트·경로를 바꿀 수 없다(SSRF 방지). 구현은 `src/lib/server/nominatim.ts`(신규, 서버 전용).
- 파라미터(모두 서버가 만든다):

| 파라미터 | 값 | 이유 |
| --- | --- | --- |
| `city` | 검증된 도시명 | 요구사항 3-1에서 `city=서울` 1회 호출 확인. 구조화 검색이라 `q`와 섞지 않는다 |
| `countrycodes` | 소문자 alpha-2 1개 | 하드 필터(N-3) |
| `format` | `jsonv2` | 생략 시 웹 UI로 감 |
| `limit` | `5` | 후보 상한과 같게 해 호출 부하를 최소화 |
| `accept-language` | `ko` | 한국어 후보명 우선 |
| `addressdetails` | `1` | 국가 일치 검증과 구분 정보 |

- `email` 파라미터는 쓰지 않는다. 식별은 User-Agent로 한다.
- User-Agent(제안): 고정 앱 이름 상수(`globber-dashboard/1.0` 형태)를 기본으로 하고, 선택 환경 변수 `NOMINATIM_USER_AGENT`가 있으면 덮어쓴다. 이유: 정책은 라이브러리 기본값이 아닌 앱 식별을 요구하므로 기본 상수만으로 충족한다. OSMF가 연락처를 요구하면 재배포 없이 환경 변수 변경으로 대응할 수 있다. 필수 환경 변수로 만들면 미설정 환경에서 기능이 막히므로 선택으로 둔다. 실제 이메일은 코드·문서에 쓰지 않는다.
- 헤더: `User-Agent`, `Accept: application/json`, `Accept-Language: ko`. 쿠키·세션·도시 API 토큰은 보내지 않는다.
- 타임아웃(제안): `AbortSignal.timeout(5000)`. 기존 도시 API 호출이 `AbortSignal.timeout(CITY_API_TIMEOUT_MS)` 패턴을 쓴다(코드 확인 `cityUpstream.ts` 103행). 상수로 두고 환경 변수화하지 않는다.
- 리다이렉트는 따르지 않는다(`redirect: "error"`, 제안): 고정 호스트 보장.

## 3-D. 응답 스키마

`src/types/city.ts`에 추가할 타입 초안:

```ts
/** 위치 검색 후보 한 건. Nominatim 응답을 그대로 노출하지 않고 이 필드만 반환한다 */
export type GeocodeCandidate = {
  /** Nominatim place_id를 문자열로 바꾼 값(목록 key 용도) */
  id: string;
  /** 표시명(accept-language=ko). 같은 표시명이 여러 건일 수 있다 */
  displayName: string;
  /** 위도 -90~90 */
  lat: number;
  /** 경도 -180~180 */
  lng: number;
  /** 행정구역 구분용 보조 텍스트(addressdetails의 state/county 등 조합). 없으면 null */
  region: string | null;
  /** jsonv2 type 값(예: city, administrative). 없으면 null */
  placeType: string | null;
};

export type GeocodeResponse = ApiSuccess<GeocodeCandidate[]>;

/** 실패 코드. 사유 문자열이 아니라 이 literal로 구분한다 */
export type GeocodeFailCode =
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "DISABLED"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_BAD_RESPONSE";

/** code가 없는 ApiFail(401 등)도 올 수 있으므로 소비자는 code를 optional로 읽는다 */
export type GeocodeFail = ApiFail & { code?: GeocodeFailCode };
```

- 필드 정제: 위 필드만 만든다. `licence`, `osm_id`, `boundingbox`, `importance`, `address` 전체는 응답에 넣지 않는다. 기존 `ApiFail`은 바꾸지 않고 `code`는 위치 검색 전용 확장이다.
- 출처 표기 필드(판단): 응답에 두지 않는다. 표기 문구는 모든 후보에 같은 정적 문구("© OpenStreetMap contributors")라 서버가 매 응답에 실을 이유가 없고, 0건·실패 응답에도 표시 여부는 UI가 정한다. 정적 문구와 위치는 frontend/designer 소관이며, 정책상 후보 목록 근처에 표기가 있어야 한다는 점만 이 명세가 전한다.
- 후보 버림 규칙:
  1. `lat`/`lon`은 `Number()`로 변환해 유한하고 범위 안이어야 한다. 아니면 그 후보만 버린다.
  2. `display_name`이 비어 있거나 문자열이 아니면 버린다.
  3. 국가 일치(N-3): `address.country_code`가 요청 alpha-2(소문자 비교)와 다르거나 없으면 버린다. 없는 후보를 버리는 것은 조용히 틀린 국가 좌표가 들어가는 것을 막는 제안이다.
  4. 같은 `place_id`는 한 번만 둔다. 같은 `displayName`은 합치지 않는다(실제로 다른 장소일 수 있음, 3-9 관찰). 구분은 `region`, `lat`, `lng`.
- 후보 상한 `MAX_GEOCODE_CANDIDATES = 5`. 요청 `limit`도 5이고 정제 후 5개 이하다. 클라이언트가 전체 집합 기준 판정을 하지 않으므로 별도 판정용 필드는 필요 없다.
- 0건: 상류 빈 배열, 또는 국가 불일치만으로 모두 버려진 경우는 `200` 빈 배열. 상류가 비어 있지 않은데 형식 오류로 모두 버려지면 `UPSTREAM_BAD_RESPONSE`(3-4).
- `region`은 `address`의 `state`, `county` 등 있는 값을 쉼표로 조합한 짧은 문자열(최대 2개, 제안). 사용할 키는 실제 응답 형태로 구현 단계에서 확정한다(확인 필요, Q-4).

## 3-E. 오류 매핑

모든 오류 응답은 `{status:"fail", data:"<한국어 메시지>", code}`다. 상류 원문·URL·헤더는 응답과 로그에 노출하지 않는다. 최종 사용자 문구는 프론트가 `cityErrorMessage.ts`에서 통일하고, 서버 `data`는 기본 문구다.

| 상황 | 내부 상태 | code | `data` 기본 문구 |
| --- | --- | --- | --- |
| 세션 없음 | 401 | (없음, `withSession`) | 로그인이 필요합니다. |
| 입력 검증 실패 | 400 | `INVALID_INPUT` | 3-B 문구 |
| 서버 최소 호출 간격 위반 | 429 | `RATE_LIMITED` | 잠시 후 다시 시도해 주세요. |
| 비활성 스위치 | 503 | `DISABLED` | 위치 검색을 사용할 수 없습니다. |
| 상류 429 | 502 | `UPSTREAM_RATE_LIMITED` | 위치를 찾지 못했습니다. 잠시 후 다시 시도해 주세요. |
| 상류 4xx(429 제외)·5xx·네트워크 오류 | 502 | `UPSTREAM_ERROR` | 같은 문구 |
| 타임아웃 | 504 | `UPSTREAM_TIMEOUT` | 같은 문구 |
| JSON 파싱 실패·최상위가 배열 아님·모든 후보 형식 오류 | 502 | `UPSTREAM_BAD_RESPONSE` | 같은 문구 |
| 0건 | 200 | (성공) | 빈 배열 |

- 상류 429를 502로 감싸는 이유: 우리 쪽 `RATE_LIMITED`와 구분하고 상류 상태를 드러내지 않기 위해서다(제안). 기존 `proxyCityApi`도 상류 5xx를 502로 감싼다(코드 확인).
- I-07은 원인별 사용자 문구를 구분하지 않으므로 `code`는 로깅·테스트·후속 UX용이다. `RATE_LIMITED`만 "잠시 후" 안내로 따로 보일 수 있다(프론트 소관).
- 로그에는 상류 상태코드와 code만 남기고 도시명은 남기지 않는다(제안).

## 3-F. 호출 빈도·캐시 설계와 다중 인스턴스 한계

정책 근거는 3-0(상한 초당 1회, 같은 질의 반복 시 차단 가능, 캐시 필요).

1. 결과 캐시(도입, 필수): 같은 (도시명 정규화, alpha-3) 질의의 성공 결과(0건 포함, 오류 제외)를 모듈 스코프 `Map`에 둔다. TTL 10분, 최대 100건(제안, 초과 시 가장 오래된 항목부터 제거). 정규화는 trim, 연속 공백 축약, 소문자화. 이유: (1) 정책이 캐시를 요구하고 같은 질의 반복 클라이언트를 차단할 수 있다고 한다. (2) 사용자가 같은 입력으로 다시 누를 때 간격 제한(429)에 걸리지 않는다. (3) 지명 좌표는 자주 바뀌지 않아 10분 재사용의 위험이 작다. 100건은 단일 계정 수동 사용에 충분하고 메모리 증가가 작다. 캐시 적중은 간격 제한보다 먼저 확인한다.
2. 최소 호출 간격(인스턴스 단위): 모듈 스코프에 마지막 상류 호출 시각 1개를 두고, 이전 상류 호출 시작 후 1,100ms(상한 1초에 여유 100ms, 제안)가 지나기 전 도착한 요청은 상류를 호출하지 않고 429 `RATE_LIMITED`로 거절한다. 슬립 후 처리는 실행 시간을 늘리고 요청을 쌓으므로 쓰지 않는다. 캐시 적중·검증 실패는 기록을 갱신하지 않는다. 비교와 갱신은 같은 동기 구간에서 해 동시 요청의 두 번째가 거절되게 한다.
3. 클라이언트 쿨다운 1초(N-4)는 frontend 소관이며 서버 제한을 대체하지 않는다.

다중 인스턴스 한계(N-4로 수용, 문서화 의무):
- 캐시와 간격 기록은 프로세스 메모리에 있어 서버리스/다중 인스턴스에서는 인스턴스마다 따로 동작한다. 전체 합 초당 1회와 캐시 공유를 보장하지 못하고, 인스턴스 재시작 시 사라진다.
- 완화 근거(추정, 미확인): 내부 어드민 단일 계정의 수동 클릭 호출량이 낮다. 같은 배포 IP를 다른 앱과 공유할 때의 429는 Q-2로 남는다.
- 전역 보장은 외부 저장소(새 인프라)가 필요하며 이번 범위 밖이다.
- 이 한계와 캐시·간격 상수는 `src/docs/city-api-reference.md`의 위치 검색 절에 적는다(구현 단계).

## 3-G. 환경 변수

`.env.example`에 선택 항목 2개를 placeholder로 추가한다(실제 값 없음, 주석에 선택임을 표기).

```
# 위치 검색(Nominatim) 요청의 User-Agent (서버 전용, 선택). 비우면 앱 기본 식별자를 쓴다
NOMINATIM_USER_AGENT=

# true이면 위치 검색을 호출 없이 비활성(서버 전용, 선택). 이용 정책상 중단 요청 대응용
NOMINATIM_DISABLED=
```

- 호스트는 환경 변수로 받지 않는다(3-C). `NEXT_PUBLIC_` 접두사를 쓰지 않고 `"use client"` 파일에서 import하지 않는다.
- `docs/agent-rules/project.md` 백엔드 항목은 새 환경 변수 이름을 알려야 할 때만 갱신한다.

## 3-H. 영향받는 기존 테스트 (목록만, 작성 담당 배정 없음)

이 절 작성 중 `tests/`를 grep하지 않았다. 아래는 코드 구조에 근거한 예상이며 실행으로 확인이 필요하다.

- `tests/utils/cityErrorMessage.test.ts`: 건수 줄 문구 변경(I-01)과 위치 검색 문구 추가로 서버 라벨 단언이 깨질 수 있다.
- `tests/components/CityFormModal.test.tsx`: 국가 선택·위치 찾기 도입으로 국가명·국가코드 입력 단언이 바뀐다(frontend 소관 변경).
- `countryFlagMapping` 테스트가 있다면: 표 export 추가 후에도 기존 단언이 유지되는지 확인 필요.
- `withSession` 자체는 바꾸지 않으므로 기존 Route Handler 테스트는 영향 없음 예상.
- 새 Route Handler·`nominatim.ts`·캐시/간격 로직 테스트는 이 명세에서 담당을 배정하지 않는다(qa-engineer 소관, 외부 호출은 fetch 모킹).

## 3-I. 사용자 결정이 필요한 항목

없음. N-1~N-4는 3-9에서 확정됐고 이 절은 그 범위 안에서 설계했다. 사용자 승인 없이 정한 명세 수준 제안(되돌릴 수 있고 요구사항을 바꾸지 않음):

- 결과 캐시를 권장에서 필수로 올림(3-0, 3-F).
- `address.country_code`가 없는 후보는 버림(N-3 안전장치의 해석).
- 경로 `/api/geocode`, 간격 1,100ms, TTL 10분·100건, 타임아웃 5초, 후보 상한 5.
- 출처 표기용 응답 필드는 두지 않음(3-D).

frontend/designer 전달 사항: 후보 목록 근처에 "© OpenStreetMap contributors" 정적 출처 표기가 필요하다(정책 확인).
