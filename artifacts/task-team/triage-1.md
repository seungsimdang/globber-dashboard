# 9-1 게이트 재검토 (1차 리뷰)

대상: `code-review-1.md`(T07), `security-review-1.md`(T08). orchestrator가 각 finding을 실제 코드와 대조해 판정했다. 1차 리뷰이므로 타당한 finding은 심각도와 무관하게 이번 사이클에 재작업한다.

## 판정

| finding | 판정 | 근거 | 처리 |
| --- | --- | --- | --- |
| 코드 M1 `CityApiData`·`CityResponse` 중복 이름 | 타당 | `src/types/city.ts:14` 별칭이 코드에서 쓰이지 않음(`cityService.ts`는 `CityApiData`만 사용) | 재작업(frontend): 별칭 제거, `CityApiData`로 통일. `city-api-reference.md`의 `CityResponse`는 상류 Swagger 스키마 이름이라 유지 |
| 코드 M2 서버 검증·토큰·상태 매핑 테스트 없음 | 타당 | `tests/`에 `parseCityRequest`·`proxyCityApi`·`cityErrorMessage` 테스트 없음 | T09 QA가 신규 테스트로 작성(신규 테스트는 QA 담당 계약) |
| 코드 L1 `normalizeSearchText`·`ErrorContext` 미사용 export | 타당 | grep 결과 파일 밖 사용처 없음 | 재작업(frontend): export 제거 |
| 코드 L2 클라이언트 문구 분류와 서버 메시지 암묵 결합 | 타당 | `cityErrorMessage.ts`가 서버 문자열 접두어로 분류 | T09 테스트로 서버 메시지와 분류 결과를 고정 |
| 코드 L3 서버 중복 거부 문구 미확인 | 타당(확인 불가) | 실제 쓰기 요청 승인과 테스트 이메일이 없어 상류 응답 확인 불가 | 코드 변경 없음. 실서버 쓰기 검증 항목으로 이월 |
| 코드 L4 코드 주석·문서의 사이클 산출물 경로 인용 | 타당 | `src/types/city.ts:1`, `src/docs/city-api-reference.md:4,7` | 재작업: 주석은 frontend, 문서는 backend. 산출물 경로 대신 Swagger 원본 기준으로 표기 |
| 코드 L5 401 이동 뒤 에러 throw, 긴 줄 | 기각 | 이동 직전 에러 UI가 잠깐 보일 수 있을 뿐 기능 영향 없음. 긴 줄은 lint·prettier 통과 | 없음 |
| 코드 L6 "대상을 찾을 수 없습니다." 3곳 중복 | 타당 | `CityFormModal.tsx:54`, `DeleteConfirmDialog.tsx:10`, `cityUpstream.ts:126`. 규칙(`project-structure.md` 4번)은 사용자 문구를 `cityErrorMessage.ts`로 통일 | 재작업(frontend): 클라이언트 두 곳을 `cityErrorMessage.ts` 상수로 통일. 서버 문자열은 서버 모듈 소유라 유지 |
| 보안 M1 단일 테스트 계정 쓰기, 운영 `/dev/*` 의존 | 기각(코드 결함 아님) | 사용자가 T01에서 정한 방식. 운영 쓰기 방법은 00-input 확인 필요 3번으로 이미 열려 있음 | 배포 전 확인 사항으로 summary에 유지 |
| 보안 L1 서버 문자열 길이·body 크기 상한 없음 | 기각 | 사용자 결정 B-5(100자 제한 제거). 호출자는 세션을 가진 단일 관리자뿐이고 상류가 최종 검증 | 없음 |
| 보안 L2 쓰기 핸들러 Content-Type·Origin 미검사 | 타당 | `request.json()`은 `text/plain` 본문도 파싱함(`route.ts:13`, `[cityId]/route.ts:16`). SameSite=Lax가 막지만 한 줄 방어가 저렴 | 재작업(backend): POST·PUT에서 `application/json`이 아니면 415 |
| 보안 L3 상류 `data` 필드 필터 없이 전달 | 기각 | 상류는 같은 팀 API이고 데이터는 공개 도시 정보. 필터 코드는 위협 대비 이득 없음 | 없음 |
| 보안 L4 상류 fetch `redirect` 기본값 follow | 타당 | `cityUpstream.ts:95`, `cityApiToken.ts:36` | 재작업(backend): 두 fetch에 `redirect: "error"` |
| 보안 L4 토큰 발급 실패 미캐시 | 기각 | 단일 관리자 사용량에서 재발급 반복 비용이 문제되지 않음 | 없음 |
| 보안 I1 하네스 테스트의 실제 이메일 | 사이클 diff 밖 | `.harness/git-guards.test.mjs:31`, 이번 사이클 이전 코드 | 사용자 결정 필요(이번 사이클 / 백로그) |
| 보안 I2 `@tanstack/react-virtual` 취약점 미확인 | 해소 | orchestrator가 `pnpm audit --prod` 실행, 해당 패키지 권고 없음 | 없음 |
| (audit 추가) `next@16.3.5` Critical 3·High 다수 | 사이클 diff 밖 | 권고 해소 버전 `>=16.4.1`. 이번 사이클 이전부터 쓰던 버전 | 사용자 결정 필요. Critical이라 결정 전까지 다음 단계 보류 |

## 재리뷰 범위

Medium(코드 M1)이 포함되므로 재작업 후 T07 재리뷰를 실행한다. 보안 재작업은 Low만이라 11번 규칙에 따라 T08 재리뷰는 생략하고 재검증만 한다.
