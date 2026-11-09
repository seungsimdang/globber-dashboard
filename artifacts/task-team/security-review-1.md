# T08 보안 리뷰 1 - 실제 도시 API 연동

## 판정

배포 승인. Critical 0, High 0, Medium 1, Low 4, Info 2. Medium 1건은 설계 확인 사항이고 코드 결함이 아니다. orchestrator의 9-1 재검토 게이트에서 Medium/Low의 재작업 여부를 별도로 결정한다.

검토 범위: 지시문에 열거된 서버·클라이언트·문서 파일을 읽었다. 정적 코드 리뷰만 했고, 실제 상류 서버 호출·`pnpm build`·`pnpm audit`는 하지 않았다(요청 제약).

## 확인된 사실 (통과 항목)

1. 세션 강제: `src/app/api/cities/route.ts:4,12`(GET, POST)와 `[cityId]/route.ts:12,28`(PUT, DELETE) 4개 핸들러 모두 `withSession`으로 감싸 있다. `withSession.ts:10-11`이 `getSession()`(HMAC 서명 + 7일 만료 검증, `session.ts:23-57`) 실패 시 401을 반환한다. `src/proxy.ts:28` matcher가 `api`를 제외하므로 이 래퍼가 유일한 방어선이며 누락된 export는 없다.
2. 클라이언트 번들 유출 없음: `src/lib/server`를 import하는 파일은 두 route 파일뿐이다(Grep 확인). `"use client"` 파일 중 import하는 것은 없다. `CITY_API_*`는 `src/lib/server/cityApiToken.ts` 외에서 읽지 않고 `NEXT_PUBLIC_` 접두어도 없다. `cityUpstream.ts`가 `@/types/city`에서 가져오는 것은 type import뿐이다.
3. 로그·응답 유출 없음: `src/app`, `src/lib/server` 어디에도 `console` 호출이 없고, 응답 메시지는 고정 문자열이거나 상류 `data` 문자열(500자 절단)뿐이다. 설정 누락 메시지(`cityApiToken.ts:12,22`)는 값이 아니라 항목 이름만 말한다. 토큰·이메일·주소는 응답에 들어가지 않는다.
4. 입력 검증: `cityId`는 `/^[1-9][0-9]*$/`(`[cityId]/route.ts:9`)로 숫자만 통과하며 `../`, `%2e%2e`(디코딩 후 검사), 개행, 쿼리 문자가 모두 걸러진다. body는 `parseCityRequest`(`cityUpstream.ts:28-67`)가 5개 필드를 구조분해해 새 객체로 재구성하므로 추가 필드(mass assignment)는 상류로 가지 않는다. 배열·null·비객체 거부, lat/lng는 `typeof number` + `isFinite` + 범위, countryCode는 trim·대문자 후 `^[A-Z]{3}$`.
5. SSRF·경로 조작 없음: 상류 URL은 `환경변수 base + 고정 경로 문자열 (+ 검증된 숫자 cityId)`(`cityUpstream.ts:93`, route 파일)로만 만들어진다. 사용자 입력이 호스트·스킴·쿼리에 들어가는 경로가 없다. 토큰 발급 URL의 email은 환경변수이며 `encodeURIComponent` 처리(`cityApiToken.ts:33`).
6. 토큰 발급: 동시 요청은 `inflight` Promise로 합쳐진다(`cityApiToken.ts:53-60`). 401 재시도는 정확히 1회이며 재시도도 401이면 `UpstreamAuthError`로 종료(`:76-77`), 루프 없음. 다른 요청이 이미 갱신한 토큰을 비우지 않도록 `accessToken === used` 비교(`:74`)를 한다. 모든 상류 fetch에 10초 타임아웃과 `cache: "no-store"`, 모든 응답에 `Cache-Control: no-store`(`cityUpstream.ts:15`). 토큰은 모듈 변수에만 있고 응답·쿠키·디스크로 나가지 않는다.
7. 시크릿: `.env.example`는 `127.0.0.1:8080`과 `test@example.com`만 포함한다. `.gitignore:34-35`가 `.env*`를 제외하고 `.env.example`만 허용한다. 저장소 전체 이메일 정규식 검색에서 이 사이클 산출물(`src/`, `docs/agent-rules/`, `artifacts/task-team/`)에는 실제 이메일이 없다(`api-spec.md:57`도 `test@example.com`). `src/docs/city-api-reference.md`에는 URL·토큰 값이 없고 `accessToken` 필드명 언급만 있다. `docs/agent-rules/*.md`에서 실제 주소·이메일 검색 결과 없음.

## Findings

### M1 (Medium) 쓰기 토큰이 개발용 `/dev/test-login` 단일 테스트 계정에 의존

- 위치: `src/lib/server/cityApiToken.ts:33`
- 근거: 대시보드의 모든 추가·수정·삭제가 하나의 테스트 계정 신원으로 상류에 기록된다. 상류 감사 로그에서 어떤 관리자가 변경했는지 구분할 수 없고, 상류가 운영 환경에서 `/dev/*`를 닫으면 쓰기가 전부 실패한다. 이메일을 아는 사람이 상류에 직접 로그인할 수 있는 구조이므로 이 계정 이메일은 비밀로 취급해야 한다. 이것은 요구사항·api-spec이 정한 방식이므로 코드 결함이 아니다.
- 수정 방향: 운영 배포 전에 상류 팀에 정식 서비스 계정 발급 방식 확인. 당분간은 `CITY_API_TEST_EMAIL`을 배포 환경 비밀로만 관리하고, 상류 `/dev/test-login`이 운영에서 열려 있는지 확인한다. (확인하지 못함: 상류의 운영 정책)

### L1 (Low) 입력 길이 상한 없음

- 위치: `src/lib/server/cityUpstream.ts:36-45,57-66`, route 파일의 `request.json()`
- 근거: cityName/countryName에 최대 길이가 없고(구현 기록 2에서 클라이언트 100자 제한을 제거), body 크기 제한도 없다. 인증된 관리자만 도달 가능하므로 악용 난이도는 낮다. 상류가 거부하면 상류 메시지가 전달된다.
- 수정 방향: 서버에서 문자열 길이(예: 상류 스펙 기준 최대치)와 `content-length` 상한을 둔다.

### L2 (Low) 상태 변경 요청에 Origin/Content-Type 검사 없음 (CSRF는 SameSite=Lax에 의존)

- 위치: `src/app/api/cities/route.ts:13`, `[cityId]/route.ts:16`, `src/lib/session.ts:64`
- 근거: `request.json()`은 Content-Type을 보지 않는다. 쿠키는 `sameSite: "lax"`라서 교차 사이트 POST/PUT/DELETE에는 전송되지 않으므로 현재는 방어된다. 다만 같은 사이트(형제 서브도메인) 공격이나 브라우저 동작 변화에는 방어선이 하나뿐이다.
- 수정 방향: 쓰기 핸들러에서 `Content-Type: application/json`과 `Origin` 일치를 확인하거나 `sameSite: "strict"` 검토.

### L3 (Low) 상류 응답 통과 범위

- 위치: `src/lib/server/cityUpstream.ts:116,128`
- 근거: 성공 시 상류 `data`를 필드 필터 없이 그대로 전달하고, 4xx 시 상류 `data` 문자열(500자)을 그대로 사용자에게 보여 준다. 상류가 내부 필드나 내부 경로·SQL 조각이 든 메시지를 내려주면 노출된다. 현재 상류 계약은 도시 필드뿐이라 실제 노출은 확인하지 못했다.
- 수정 방향: 성공 데이터는 `cityId, cityName, countryName, countryCode, lat, lng`만 골라 전달. 4xx 메시지는 허용 목록 또는 길이를 더 줄여 사용한다.

### L4 (Low) 상류 fetch의 리다이렉트 추적과 토큰 발급 실패의 반복 호출

- 위치: `cityUpstream.ts:95-104`, `cityApiToken.ts:36-40,69`
- 근거: `redirect` 옵션이 기본값(follow)이다. 상류가 다른 오리진으로 리다이렉트하면 fetch 사양상 Authorization 헤더는 제거되지만, 의도치 않은 호스트로 요청이 나갈 수 있다. 또 토큰 발급 실패는 캐시되지 않아 쓰기 요청마다 최대 10초짜리 발급 시도가 반복된다(로그인한 관리자만 유발 가능).
- 수정 방향: 상류 fetch에 `redirect: "error"`. 발급 실패 후 짧은 쿨다운(수 초) 고려.

### I1 (Info) 이 사이클 범위 밖의 실제 이메일 형태 문자열

- 위치: `.harness/git-guards.test.mjs:31` (`oak20005@naver.com`)
- 근거: 이번 변경이 아닌 기존 하네스 테스트 픽스처다. 개인 이메일일 수 있어 공개 저장소라면 `example.com` 도메인으로 바꾸는 것을 권한다. 이번 사이클 판정에는 영향이 없다.

### I2 (Info) 의존성

- `@tanstack/react-virtual@3.14.23`(고정 버전, 배포 후 14일 경과)이 추가됐다. `pnpm audit`는 실행하지 않아 알려진 취약점 여부는 확인하지 못했다. CI에서 확인하길 권한다.

## 구현 기록 "리뷰 확인 필요" 항목 판정

구현 기록 1 (서버)
- 타입 이름 `CityApiData`/`CityResponse`: 보안 관련 없음.
- 401 외 4xx는 상류 상태 그대로 전달: 타당. 정보 노출은 메시지 본문(L3)이 문제이고 상태 코드 자체는 무해하다.
- GET 401은 재시도 없이 502: 타당. 토큰이 필요 없는 조회에서 재발급 루프를 만들지 않아 오히려 안전하다.
- `Authorization` Bearer 접두사 방어 분기: 타당. 토큰이 헤더 값으로만 쓰이고 사용자 입력이 섞이지 않는다.
- 성공 시 상류 `data` 통과, `status` 고정 success: 부분 타당. 형태 검사는 있으나 필드 필터가 없어 L3로 기록.
- `RouteContext` 사용: 보안 관련 없음. `cityId` 검증은 별도로 확인했다.

구현 기록 2 (프론트엔드)
- 1번 `cityErrorMessage.ts`의 서버 메시지 접두어 분기: 타당. 보안 문제는 없고, 파싱 대상이 서버가 만든 고정 문자열이라 사용자 입력이 분기를 조작하지 못한다. (결합도 문제는 보안 범위 밖)
- 2, 3번(인증·설정 오류 문구): 타당. 클라이언트에는 "관리자에게 문의" 수준 문구만 노출되고 설정 값은 노출되지 않는다.
- 4번 중복 강조 문자열 비교: 보안 관련 없음.
- 5, 7, 8, 9번: 보안 관련 없음.
- 6번 401 시 `new URL("/login", window.location.origin)`: 타당. 목적지가 고정 경로라 오픈 리다이렉트가 없다.

## 최종 판정

배포 승인 (Critical/High 없음). 운영 투입 전 M1(상류 `/dev/test-login` 운영 사용 가능 여부와 계정 비밀 관리)을 사람이 확인하길 권한다. L1~L4는 이후 사이클에서 처리해도 배포를 막지 않는다. 코드는 수정하지 않았다.
