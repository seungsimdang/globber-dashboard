# 9-1 게이트 재검토 (사이클 최종 리뷰)

대상: `code-review-3.md`(T07 최종), `security-review-2.md`(T08 최종). 2차 이후 기준을 적용해 Medium 이상은 자동 재작업, Low는 사용자 결정을 받았다.

## 판정

| finding | 판정 | 근거 | 처리 |
| --- | --- | --- | --- |
| 코드 M1 신규 로직 테스트 없음 | 타당 | `tests/`에서 서버 모듈·utils import 0건 | T09 QA가 실제 소스를 import하는 신규 테스트로 작성 |
| 코드 L1 기타 4xx 상류 문구 노출 | 기각(수정 불필요) | api-spec "기타 4xx"와 일치 | 실서버 쓰기 검증 때 문구 언어만 확인 |
| 코드 L2 수정 시 이름·국가 그대로여도 중복 검사 | 타당 | 실데이터 중복 쌍 1건(`string/string` 테스트 데이터 2건) 확인, 이 행은 위경도만 고쳐도 막힘 | 사용자 결정으로 이번 사이클 수정: 원본과 같으면 검사 생략(`useCityMutations.ts`) |
| 코드 L3 기본 QueryClient 재시도 3회, 401 이동 반복 | 타당 | `providers.tsx:8` `new QueryClient()` | 사용자 결정으로 이번 사이클 수정: 4xx·500은 재시도 없음, 그 외 최대 2회 |
| 코드 L4 규칙 문서가 `artifacts/` 산출물을 기준으로 인용 | 타당 | `docs/agent-rules/project.md:9` | 사용자 결정으로 수정: `src/docs/city-api-reference.md`만 기준 |
| 코드 L5 requirements 게이트 표 중복 행 | 타당 | `requirements.md:32-33` | 사용자 결정으로 수정: 중복 행 삭제 |
| 코드 L6 design-spec 본문이 승인 결정과 다름 | 타당 | §1.1 전체 행 렌더링, §5.3 닫고 재조회 | 사용자 결정으로 수정: 승인 결정 기준으로 본문 갱신 |
| 코드 I1~I3, 보안 I-a·I-b | 조치 없음 | Info. I-b(운영 쓰기 방법)는 배포 전 확인 사항 | summary에 유지 |

## 재리뷰

이번 재작업은 모두 Low라 오케스트레이터 11번 규칙에 따라 T07/T08 재리뷰를 생략했다. 재검증(lint, type-check, 전체 테스트 45개, build)은 통과했다.
