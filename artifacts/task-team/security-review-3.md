# T08 보안 리뷰 3 - 도시 API 2·3차

## 판정

**보안 통과, 재작업 불필요.** Critical/High/Medium/Low 취약점은 확인되지 않았다. 별도로 명세에서 수용한 조건부 Low 위험 1건을 아래에 기록했다. 실제 배포 환경은 확인하지 않았으며 `.env` 값은 읽지 않았다.

정적 코드·명세 리뷰만 수행했다. 실서버 호출, 배포, 테스트 실행 및 의존성 감사는 하지 않았다. 소스 수정도 하지 않았다. 실제 상류 주소와 쿠키 값은 이 기록에 포함하지 않는다.

## 확인 결과

### 인증·인가

- 도시 목록·추가·수정·삭제 및 위치 검색 핸들러 모두 `withSession`으로 감싸져 있다. API 경로는 `src/proxy.ts` matcher에서 제외되므로 Route Handler의 세션 검사가 직접 방어선이다. `withSession`은 서명·만료를 검증하는 `getSession()`이 실패하면 처리기를 실행하지 않고 401을 반환한다 (`src/lib/server/withSession.ts:6-13`, `src/lib/session.ts:23-57`; 쿠키 속성은 `src/lib/session.ts:59-67`).
- `server`는 허용된 `prod`/`dev` 값 하나만 받는다. 누락·중복·미지 값은 400이며, 운영 쓰기는 세션 확인 다음 단계에서 403으로 끝난다. 운영 쓰기 분기는 본문, 도시 ID, 환경 변수, 상류 fetch보다 앞선다 (`src/lib/server/cityServer.ts:7-39`, `src/app/api/cities/route.ts:5-28`, `src/app/api/cities/[cityId]/route.ts:13-49`).
- 운영 호출은 토큰 없는 형태만 타입으로 허용한다. 토큰 발급과 Authorization 헤더 부착은 개발 쓰기 경로에서만 사용된다 (`src/lib/server/cityUpstream.ts:79-88, 95-112`, `src/lib/server/cityApiToken.ts:43-66, 82-95`).

### 입력·출력 경계

- POST/PUT은 본문 파싱 전에 JSON Content-Type을 확인한다. 도시 본문은 객체와 필수 필드의 타입, 유한 좌표 및 범위를 검증하고 허용 필드만 새 객체로 구성한다. 도시 ID는 양의 정수 문자열만 경로에 사용한다 (`src/app/api/cities/route.ts:22-28`, `src/app/api/cities/[cityId]/route.ts:7-27`, `src/lib/server/cityUpstream.ts:24-67`).
- 위치 검색은 도시명이 정확히 한 번 전달됐는지, 제어 문자를 제거한 뒤 빈 값/100자 초과 여부, 대문자 alpha-3 국가 코드와 매핑을 검증한다. 호스트는 서버 코드에 고정되고 URL 파라미터는 `URLSearchParams`로 만들며, 리다이렉트는 거부한다. 응답은 후보 5개 이하로 제한하고 좌표 범위·표시명·ID 타입·국가 일치를 확인한 뒤 필요한 필드만 반환한다 (`src/app/api/geocode/route.ts:4-8`, `src/lib/server/geocode.ts:12-21, 32-84, 98-138, 140-176`).
- 상류 도시 응답은 기대한 배열/객체 형태를 확인한다. 오류 본문 전체·헤더·스택을 응답하지 않으며, 위치 검색 로그에는 상류 상태와 고정 오류 코드만 기록한다. 응답에는 `Cache-Control: no-store`가 적용된다 (`src/lib/server/cityUpstream.ts:12-18, 69-74, 114-148`, `src/lib/server/geocode.ts:153-171`). 도시 API 4xx의 `data` 문자열을 최대 500자까지 전달하는 동작은 API 명세의 기존 계약이며, 이번 범위에서 새 정보 노출 근거는 확인되지 않았다.
- 외부 후보의 표시명과 도시 데이터는 JSX 텍스트로 렌더링된다. 동적 HTML 실행은 확인되지 않았고, 외부 링크는 고정 주소와 `noopener noreferrer`를 사용한다 (`src/components/cities/CityFormModal.tsx:396-421`). SQL 사용 경로는 없다.

### 시크릿·의존성·외부 호출

- 상류 주소·테스트 계정 이메일·토큰은 서버 전용 모듈에서만 읽는다. 토큰은 프로세스 메모리에만 두며, 상류 fetch는 `cache: "no-store"`와 타임아웃을 사용한다. 환경 변수 값이나 토큰을 출력하는 로그는 이 범위에서 확인되지 않았다 (`src/lib/server/cityApiToken.ts:15-66`, `src/lib/server/cityUpstream.ts:95-109`).
- 지오코더는 입력으로 호스트를 바꿀 수 없고, 앱 쿠키·도시 API 토큰을 외부 요청에 전달하지 않는다. 요청 빈도 제한과 결과 캐시는 인스턴스 단위다. 이 다중 인스턴스 한계는 사용자 승인된 3차 명세에 기록되어 있어 별도 인프라 결함으로 확대하지 않았다 (`src/lib/server/geocode.ts:1-2, 24-25, 123-152`, API 명세 §3-F).
- 새 외부 SDK 호출은 없으며 서버 `fetch`와 기존 클라이언트 계층을 사용한다. 이번 리뷰에서 `pnpm audit`은 실행하지 않았다.

## 잔여 위험

### R1 (Low, 명세에서 수용한 조건부 위험) 개발 상류가 HTTP로 설정된 경우 전송 중 토큰 보호 없음

- 근거: 2차 요구사항 §2-1은 개발 상류를 HTTP 기반으로 정한다. `getCityApiBaseUrl`은 `http:`와 `https:`를 모두 허용하고, 토큰 발급 요청은 계정 이메일을 URL 쿼리에 담는다 (`src/lib/server/cityApiToken.ts:15-30, 46-55`). 개발 쓰기 요청은 같은 설정 주소로 Authorization 헤더를 보낸다 (`src/lib/server/cityUpstream.ts:95-109`).
- 영향: 실제 배포 값이 평문 HTTP라면 경로상의 관찰자가 발급 토큰을 획득하거나 개발 데이터 쓰기 요청을 조작할 수 있다. 영향 범위는 개발 서버이며 운영 쓰기는 서버에서 계속 거부된다.
- 한계: 실제 환경 변수 값과 네트워크 경로를 읽거나 시험하지 않았으므로 현재 배포의 전송 방식은 확인할 수 없다. 이 위험은 2차에서 정한 개발 서버 계약에 속하며 이번 코드 변경이 새로 만든 취약점으로 단정하지 않는다.
- 권고: 가능한 경우 개발 상류도 TLS 종단을 제공하고 HTTPS 기준 주소를 설정한다. 그렇지 않으면 해당 경로를 신뢰된 사설 네트워크로 제한한다. 명세상 수용 조건이므로 본 리뷰의 재작업 차단 항목으로 분류하지 않는다.

## 구현 기록의 보안 관련 항목 판정

- `implementation-3.md` — `getCityApiBaseUrl`의 URL 파싱 실패 처리: **타당**. 실패를 고정 설정 오류로 바꾸고 입력 URL 값을 응답하지 않는다 (`src/lib/server/cityApiToken.ts:15-31`). 운영 경로 접두어 중복 가능성은 호출 대상 경로 설정 문제이며 SSRF/권한 우회 근거는 없다. 운영 쓰기·대상 서버 판정 테스트 부재: **타당한 검증 공백**. 코드는 세션 뒤 서버 허용 목록을 확인하고 운영 쓰기를 fetch 이전에 거부하지만, 이 리뷰에서는 실행 검증하지 않았다 (`src/lib/server/withSession.ts:9-13`, `src/lib/server/cityServer.ts:27-39`).
- `implementation-4.md` — 오류 분류가 고정 메시지 접두어에 의존: **보안 관련 없음**. 권한 결정이나 환경 변수·토큰 노출을 제어하지 않는다 (`src/utils/cityErrorMessage.ts:11-23, 117-124`). 브라우저 시각·키보드 확인 미완료도 보안 취약점 근거가 아니다.
- `implementation-5.md` — 지오코더 실제 응답 연동 및 자동 테스트 미확인: **타당한 검증 공백**. 인증, 입력, 고정 호스트 및 후보 검증은 정적으로 확인했지만 상류 연동은 실행하지 않았다 (`src/app/api/geocode/route.ts:5-8`, `src/lib/server/geocode.ts:98-176`). 후보 상태 초기화, 국가명 표시 차이, 팝오버 배치는 보안 관련 없음.
- `implementation-6.md` — Nominatim의 `region` 원천 추정: **보안 관련 없음**. 선택적으로 보여 주는 텍스트이며 JSX 텍스트 렌더링이다 (`src/lib/server/geocode.ts:54-66`, `src/components/cities/CityFormModal.tsx:396-403`). 후보 형식 오류·국가 불일치 처리: **타당**. 좌표 범위와 필수 표시 필드를 검증하고 다른 국가/국가 코드 누락 후보를 제외한다 (`src/lib/server/geocode.ts:36-83`). 로그에 도시명·URL이 없다는 설명도 코드와 일치한다 (`:153-171`). 경로 동작 테스트 부재는 검증 공백으로 남지만, 이 리뷰에서 테스트 실행은 요청 범위 밖이었다. 다중 인스턴스 제한은 사용자 승인된 한계다.

`implementation-3~6.md`에서 위에 적지 않은 UI 배치, 브라우저 실동작, 외부 응답 표본 관련 항목은 권한·정보 노출·입력 검증과 직접 관련된 보안 우려가 없어 별도 보안 판정 대상이 아니다.

## 최종

**배포 승인.** Critical/High 취약점이 없고, 확인한 인증·인가 및 입력 경계에서 우회 경로를 발견하지 못했다. R1은 명세에서 수용된 개발 전송 계층 조건으로 남긴다. 테스트, 실서버, 배포 설정, 실제 환경 변수와 의존성 감사는 확인하지 않았다.
