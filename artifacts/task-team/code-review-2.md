# code-review-2 (T07 재리뷰)

범위: triage-1 "재작업" 항목 해소 여부 + `git diff 05baad4..HEAD` 신규 코드. CodeRabbit은 재작업 재리뷰 지시에 따라 생략. 전체 테스트는 재실행하지 않음.

## 판정: 통과 (신규 finding 없음, Info 1건)

## 1차 finding 해소 여부

| finding | 판정 | 근거 |
| --- | --- | --- |
| 코드 M1 `CityResponse` 별칭 | 해소 | `src/types/city.ts`에서 별칭 삭제. `src` 내 `CityResponse` 참조는 `src/docs/city-api-reference.md`(상류 Swagger 스키마명, triage에서 유지로 결정)뿐 |
| 코드 L1 미사용 export | 해소 | `cityFilter.ts:4` `normalizeSearchText`, `cityErrorMessage.ts:3` `ErrorContext`의 export 제거. 같은 파일 내부에서만 사용 |
| 코드 L4 산출물 경로 인용 | 해소 | `src/types/city.ts:1` 주석, `src/docs/city-api-reference.md:4,7`에서 `artifacts/` 경로 제거. `src` 전체 grep 결과 `artifacts/task-team` 0건 |
| 코드 L6 NOT_FOUND 문구 중복 | 해소 | `cityErrorMessage.ts:6`에 `NOT_FOUND_MESSAGE` export, `CityFormModal.tsx:15,184`, `DeleteConfirmDialog.tsx:8,38`이 import. 서버 문자열(`cityUpstream.ts`)은 triage 결정대로 유지 |
| 보안 L2 Content-Type 415 | 해소 | `api/cities/route.ts:13-16`(POST), `api/cities/[cityId]/route.ts:16-19`(PUT)에서 `request.json()` 이전에 `application/json` 접두어 검사. 클라이언트 `apiClient.ts:27`은 body가 있을 때 `application/json`을 보내 정상 요청은 영향 없음. 415는 `classify`에서 `status < 500`이라 "client"로 분류되어 서버 메시지 그대로 표시됨 |
| 보안 L4 redirect | 해소 | `cityUpstream.ts:99`, `cityApiToken.ts:39`에 `redirect: "error"`. 두 fetch 모두 try 안이라 TypeError가 각각 네트워크 오류 경로, `UpstreamAuthError`로 처리됨 |

## 신규 코드 검토

- 415 처리: 기능 정상. `?.toLowerCase().startsWith(...)`로 헤더 없음도 415. 두 핸들러에 같은 3줄이 중복되나 2곳이라 추상화 불필요.
- 공용 상수: 순환 import 없음(컴포넌트 -> utils).
- Next 16.4.3 업그레이드: `next`, `eslint-config-next`를 같은 버전으로 고정. 빌드 성공은 기확인.
- `pnpm-workspace.yaml` overrides `source-map-js: 1.2.2`: 정확 버전 고정. 근거 커밋 메시지(97de0de)가 이유를 설명함. Next 업그레이드로 필요성이 사라지면 제거 대상(후속 확인용, 현재 결함 아님).
- 하네스 테스트 이메일: `test@example.com`로 교체, 해당 픽스처는 이메일 값에 의존하지 않음(통과 기확인).

## Info

- I1. `src/docs/city-api-reference.md:4,7`이 같은 문구 `/v3/api-docs OpenAPI "GLOBBER"`를 두 번 적는다. 기능 영향 없음, 정리는 선택.

## 확인하지 못한 것

- 실서버 쓰기 동작(triage의 코드 L3 이월 항목)과 `overrides` 제거 가능 시점은 검토하지 않음.
- 신규 테스트 없음(코드 M2/L2는 T09 QA 담당으로 이월).
