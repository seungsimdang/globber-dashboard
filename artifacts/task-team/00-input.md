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
