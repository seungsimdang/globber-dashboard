# T08 보안 리뷰 2 - 사이클 최종 (실제 도시 API 연동)

## 판정

배포 승인. Critical 0, High 0, Medium 0, Low 0, Info 2. 코드는 수정하지 않았고 상류 서버로 요청도 보내지 않았다(정적 리뷰). `pnpm audit --prod` 0건, 로컬 서버 응답(401/400/no-store)은 지시문에서 전달받은 사실이며 이 리뷰에서 재실행하지 않았다.

기각 항목(보안 M1 코드 결함 아님, L1 길이 상한, L3 필드 필터, L4 발급 실패 미캐시)은 새 근거가 없어 다시 제기하지 않는다.

## 1차 finding 해소 확인

- L2 (Content-Type 415): 해소. `src/app/api/cities/route.ts:14-16`(POST), `src/app/api/cities/[cityId]/route.ts:17-19`(PUT)이 `application/json` 시작 여부를 `request.json()` 앞에서 검사해 415를 반환한다. PUT은 cityId 검증(400) 뒤에 둔다. DELETE는 본문을 읽지 않으므로 해당 없다. 한계(Info I-a 참고): Origin 검사는 추가되지 않았고 SameSite=Lax(`session.ts:64`)와 합쳐 방어한다. 교차 사이트 `application/json` 요청은 CORS preflight를 거치며 이 앱은 CORS 허용 헤더를 내지 않아 브라우저가 막는다(일반 지식).
- L4 (redirect): 해소. 상류 호출 `cityUpstream.ts:99`와 토큰 발급 `cityApiToken.ts:40` 모두 `redirect: "error"`. 리다이렉트는 fetch 예외로 떨어져 `cityUpstream.ts:144`의 502 또는 `cityApiToken.ts:47`의 `UpstreamAuthError`(502)로 처리되고 Location 값은 응답에 나가지 않는다.
- I1 (실제 이메일): 해소. `.harness/git-guards.test.mjs:31`은 `test@example.com`이고 해당 파일의 다른 이메일 형태 문자열은 없다. `src/` 전체 이메일 정규식 검색 결과 0건.

## 새 위험 점검

- 의존성: `package.json`의 next와 eslint-config-next가 `16.4.3` 정확 고정이다. 1차 audit에서 지적된 `next@16.3.5` Critical/High의 해소 버전(`>=16.4.1`)을 충족하고 `pnpm audit --prod` 0건이다. `pnpm-workspace.yaml`의 `overrides: source-map-js: 1.2.2`는 정확 버전 고정이며 잠금 파일(`pnpm-lock.yaml:8,3070,6627`)에 1.2.2 하나만 있다. 제3의 레지스트리 지정이나 별칭이 아니라 같은 패키지의 버전 고정이라 공급망 위험을 새로 만들지 않는다. 다만 override가 의존 패키지의 범위를 강제하므로 호환성 문제는 빌드·테스트로 확인할 사항이다(이 리뷰에서 빌드는 실행하지 않았다). `ignoredBuiltDependencies`(sharp, unrs-resolver)는 빌드 스크립트 비실행 설정으로 보수적이다.
- Next 16.4.3의 동작 변경: 이 리뷰에서는 `node_modules/next/dist/docs/`의 변경 내역을 읽지 않았다. 세션 검증이 Route Handler에서 `withSession`으로 직접 이뤄지고 `proxy.ts` matcher가 `api`를 제외하는 구조는 업그레이드 전후 동일하며, 이 구조에 대한 실서버 확인(401)은 전달받은 사실로 갈음한다.
- 세션 강제: 4개 핸들러(GET/POST/PUT/DELETE) 모두 `withSession` 래핑(`route.ts:4,12`, `[cityId]/route.ts:12,32`). `session.ts`는 HMAC-SHA256, `timingSafeEqual`, 7일 만료를 확인한다. 쿠키는 httpOnly, production에서 secure, SameSite=Lax.
- 서버 전용 코드 유출: `src/lib/server`를 import하는 파일은 두 route 파일뿐이고 `window.location`/`console`/`dangerouslySetInnerHTML`/`innerHTML`/`eval` 사용은 `src/`에서 `apiClient.ts:37` 한 곳(`window.location.assign`, 고정 경로 `/login`)뿐이다. 오픈 리다이렉트 없음. 하드코딩 `http(s)://` URL이 `src/`에 없다.
- 입력 검증과 SSRF: cityId는 `^[1-9][0-9]*$`(`[cityId]/route.ts:9`), body는 5개 필드만 새 객체로 재구성(`cityUpstream.ts:57-66`). 상류 URL은 환경변수 base + 고정 경로 + 검증된 숫자로만 구성.
- 정보 노출: 응답 메시지는 고정 문자열 또는 상류 `data` 문자열 500자 절단(`cityUpstream.ts:72`). 설정 오류 메시지는 변수 값이 아니라 항목 이름만 담는다. 모든 응답 `Cache-Control: no-store`.
- 시크릿: `.env.example`는 플레이스홀더(`change-me`, `127.0.0.1`, `test@example.com`)뿐. 토큰은 모듈 변수에만 존재.
- 컴포넌트(`src/components/cities/*.tsx`): 위 패턴 검색에서 위험 API 사용 없음. 이 리뷰에서 개별 파일을 전체 정독하지는 않았고 패턴 검색과 1차 리뷰 결과에 의존한다.

## Info

- I-a: 쓰기 핸들러에 Origin 검사는 없다. 415와 SameSite=Lax로 현재 충분하다고 판단하며 조치는 필요 없다. 로그인 쿠키 정책을 `strict`로 올리면 한 겹 더 늘어난다.
- I-b: 보안 M1(`/dev/test-login` 단일 테스트 계정, 운영 사용 가능 여부)은 triage에서 코드 결함 아님으로 기각됐고 운영 투입 전 사람이 확인할 항목으로 남는다. 상류의 운영 정책은 확인하지 못했다.

## 구현 기록 "리뷰 확인 필요" 항목

1차 판정(security-review-1.md)에서 타당으로 판정한 항목들은 재작업 후 코드(415, `redirect: "error"`, 문구 상수 통일)로 변경되지 않은 부분이 같으며 새 근거가 없어 재판정하지 않는다. 이번 재작업 구현 기록의 신규 항목은 읽지 않았다(지시문 범위 밖).

## 최종 판정

배포 승인. 차단 사유 없음. 운영 투입 전 사람이 확인할 것은 I-b 하나다.
