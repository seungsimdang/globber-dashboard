# implementation-1 (T06 백엔드)

## 변경 파일

신규
- `src/app/api/cities/route.ts` (GET, POST)
- `src/app/api/cities/[cityId]/route.ts` (PUT, DELETE)
- `src/lib/server/withSession.ts`
- `src/lib/server/cityApiToken.ts`
- `src/lib/server/cityUpstream.ts`

수정
- `.env.example` (`CITY_API_BASE_URL`, `CITY_API_TEST_EMAIL`, 가짜 값)
- `src/docs/city-api-reference.md` (Swagger 기준으로 재작성)

## 구현 요약

- 모든 핸들러를 `withSession`(`getSession()` 재사용)으로 감싼다. 세션이 없으면 401 `로그인이 필요합니다.`
- GET은 토큰 없이, POST/PUT/DELETE만 `withCityApiToken`을 거친다.
- 토큰은 모듈 변수로만 보관한다. 없으면 발급하고, 401이면 사용한 토큰이 현재 토큰일 때만 비운 뒤 재발급해 1회 재시도한다. 재시도도 401이면 `UpstreamAuthError`로 502 `서버 인증에 실패했습니다.` 동시 발급은 `inflight` Promise로 합친다.
- 환경 변수는 요청 시점에 읽는다. 누락 시 500 고정 메시지(주소 누락은 전 엔드포인트, 이메일 누락은 쓰기만).
- 입력 검증은 `parseCityRequest`에서 하고 실패 시 상류를 호출하지 않는다. `cityId`는 `^[1-9][0-9]*$`만 통과한다. 상류로는 5개 필드만 새 객체로 보낸다.
- 상류 응답 매핑은 api-spec 4절을 따른다: 400/404/기타 4xx는 상태 유지 + 상류 `data` 문자열(500자 절단), 401과 발급 실패는 502, 5xx와 비 JSON·형태 불일치는 502, 타임아웃(10초)은 504.
- 모든 응답에 `Cache-Control: no-store`. 상류 `fetch`도 `cache: "no-store"`.
- 토큰·이메일·상류 주소는 `console`에 쓰지 않고 응답에도 넣지 않는다.

## 리뷰 확인 필요

- 타입 이름: api-spec 3.3은 응답 타입을 `CityApiData`로 유지한다고 했으나 지시문에는 `CityResponse`가 있었다. 서버 코드는 응답 타입을 import하지 않고(`data`를 검증 없이 통과) `ApiFail`, `ApiSuccess`, `CityRequest`만 `@/types/city`에서 import한다.
- 4xx 중 401 외 상태(403 등)는 상류 상태를 그대로 전달한다(api-spec 4절 "기타 4xx"). 3xx 등 비정상 비-2xx는 5xx와 같이 502로 처리한다(명세에 없는 추론).
- 조회(GET)에서 상류가 401을 주면 토큰 재시도 없이 502 `서버 인증에 실패했습니다.`로 매핑한다(조회는 토큰이 필요 없다는 확인에 근거한 추론).
- `Authorization` 값은 `Bearer ` 접두사가 이미 있으면 그대로, 없으면 붙인다(명세 2.4의 방어 분기). 실제 서버 쓰기로 검증하지 못했다.
- `proxyCityApi`가 성공 시 상류 `data`를 그대로 통과시킨다(배열/객체 형태만 확인). 내부 응답 `status`는 항상 `"success"`로 고정한다.
- 라우트 가드: Route Handler 래퍼 인자 타입을 위해 전역 `RouteContext` 헬퍼(typegen 생성)를 사용한다.

## 확인하지 못한 것

- 실제 상류 서버 호출은 하지 않았다(읽기·쓰기 모두). 토큰 발급, 401 재시도, 에러 매핑, 타임아웃은 코드 리뷰 수준이며 실행 검증을 하지 못했다.
- 일반 회원 토큰의 쓰기 허용 여부, 토큰 만료 시간, 중복·없는 id 시 상류 상태 코드는 api-spec 7절과 같이 미확인이다.
- `pnpm build`는 실행하지 않았다.

## 영향받는 기존 테스트

이 담당 범위의 변경(신규 서버 모듈, `.env.example`, 문서)으로 깨진 기존 테스트는 없었다. 서비스·목업 관련 테스트 갱신은 T05 범위다.

## 검증 결과

- `pnpm lint`: 오류·경고 없음(출력 없이 종료).
- `pnpm type-check`: 실패, 3건이며 모두 허용된 것이다. T05가 `src/types/city.ts`에 추가할 export가 이 worktree에 없어서 발생한다.
  - `src/lib/server/cityUpstream.ts(3,15): TS2305 '@/types/city' has no exported member 'ApiFail'`
  - `src/lib/server/cityUpstream.ts(3,24): TS2305 ... 'ApiSuccess'`
  - `src/lib/server/cityUpstream.ts(3,36): TS2724 ... 'CityRequest'`
  - 그 외 타입 오류 없음(Route Handler의 `RouteContext` 사용 포함).
- `pnpm test`: Test Files 6 passed (6), Tests 89 passed (89).
