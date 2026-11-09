# 구현 기록 3 - 2차 백엔드(운영·개발 서버 분리)

## 바꾼 파일

- 신규 `src/lib/server/cityServer.ts`: `parseCityServer`(소문자 `prod|dev`, 누락·빈 값·중복·미지 값은 null), `resolveCityServer(request, { write })`(400 판정과 운영 쓰기 403을 한 곳에서 처리, `write: true`면 성공 타입이 `"dev"`로 좁혀짐).
- `src/lib/server/cityApiToken.ts`: `getCityApiBaseUrl(server)`가 `CITY_API_PROD_BASE_URL`/`CITY_API_DEV_BASE_URL`을 요청 시점에 읽는다. 빈 값·URL 파싱 실패·http(s) 아닌 프로토콜은 500 `서버 설정 오류: 운영|개발 서버 주소가 설정되지 않았습니다.`. 토큰 발급은 `getCityApiBaseUrl("dev")`만 쓴다. `CITY_API_BASE_URL` 폴백 제거.
- `src/lib/server/cityUpstream.ts`: `ProxyOptions`를 `{server:"prod"; authenticated:false} | {server:"dev"; authenticated:boolean}` 판별 유니온으로 변경.
- `src/app/api/cities/route.ts`, `src/app/api/cities/[cityId]/route.ts`: 판정 순서 withSession(401) -> server(400) -> 운영 쓰기(403) -> 기존 검증 -> 상류. 403은 `cityId`·content-type·본문·환경 변수 읽기 전에 반환한다.
- `src/types/city.ts`: 끝에 `export type CityServer = "prod" | "dev";` 한 줄 추가.
- `.env.example`, `src/docs/city-api-reference.md`, `docs/agent-rules/project.md`: 환경 변수·`server` 쿼리·운영 쓰기 403 설명 갱신(가짜 값만 사용).
- 깨진 기존 테스트 갱신(새 케이스 없음): `tests/lib/server/cityApiToken.test.ts`, `tests/lib/server/cityUpstream.test.ts`, `tests/app/api/cities/route.test.ts`, `tests/app/api/cities/cityId/route.test.ts`. 환경 변수 이름을 `CITY_API_DEV_BASE_URL`로, 요청 URL에 `?server=dev`, `proxyCityApi` 옵션에 `server: "dev"`를 추가했다.

## 판단

- 주소 읽기 함수는 명세의 `cityServer.ts`가 아니라 기존 위치인 `cityApiToken.ts`의 `getCityApiBaseUrl`에 서버 인자를 추가해 두었다. `UpstreamConfigError`가 이 파일에 있고 `cityServer.ts`가 `cityUpstream.ts`를, 그것이 `cityApiToken.ts`를 import하므로 옮기면 순환이 생긴다.
- 403 가드는 두 파일에 각각 두지 않고 `resolveCityServer`로 모았다. 문구는 명세 그대로다.

## 검증 결과

- worktree에 `node_modules`가 없어 `pnpm install --offline --frozen-lockfile --ignore-scripts`를 실행했다.
- `pnpm test`: 14개 파일, 131개 통과. `pnpm lint`: 오류 없음. `pnpm type-check`: 오류 없음. (프런트 파일은 변경하지 않았고 현재 서비스는 `server` 쿼리를 보내지 않는다. 기존 서비스 테스트는 fetch를 모킹해 통과하지만 실제 앱은 프런트 반영 전까지 400을 받는다.)
- 실서버 호출은 하지 않았고 `.env` 값도 출력하지 않았다.

## 리뷰 확인 필요

- `getCityApiBaseUrl`의 `try/catch`가 URL 파싱 실패를 무시하고 설정 오류로 변환한다. 명세의 형식 검증(제안)을 그대로 따른 것이다.
- 명세 2-B는 운영 값이 `/api`로 끝나고 뒤에 `/api/v1/cities...`를 붙인다고 적었다. 그대로 이어붙이므로 운영 상류 경로는 값에 따라 `/api/api/v1/...`가 될 수 있다. 명세 결정을 따랐으며 직접 확인하지 않았다.

## 확인하지 못한 것

- 운영 서버 응답 형식, 운영 조회 경로의 실제 동작(명세 2-H 1, 2번).
- 새 동작(`server` 판정 400, 운영 쓰기 403의 fetch 0회, 운영 주소 설정 오류)을 직접 검증하는 테스트는 없다. 새 테스트 작성은 qa-engineer 담당이다.
