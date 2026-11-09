# 사이클 전체 최종 리뷰 5

## 사용자 지적 후 D-2 정정

본문의 D-2를 승인된 제외 계약으로 취급한 판정은 철회한다. 디자인 D-2는 권장안이며 사용자 승인 기록이 확인되지 않았다. 실제 중복 누락은 QA로 재현된 VALID 결함이며 보완/보류 사용자 결정 대기다. 최신 판정은 `triage-4.md`와 `qa-report-2.md`를 따른다.

## 판정

**재작업 필요.** 대상은 `dddfd83` 이후의 2·3차 전체 변경과 현재 미커밋 재작업 diff입니다. 좌표 타입 가드는 명세를 만족합니다. CodeRabbit 교차검토에서 저장소 문서의 실제 개발 서버 주소와 오래된 미커밋 상태 안내가 확인되어 finding으로 남깁니다. 이전 자체 리뷰의 High·Medium 항목은 `triage-4.md`에서 각각 SKIP으로 판정되어 최종 finding에서 제외했습니다.

### 최종 재작업 확인

- `src/lib/server/geocode.ts:38-48`은 `lat`·`lon`이 숫자 또는 문자열이 아니면 `Number()` 호출 전에 후보를 버립니다. 빈 문자열과 공백 문자열도 제외합니다.
- 정상 숫자 `0`은 허용됩니다. 숫자 문자열은 기존 `Number()` 변환을 유지하고, 이후 `Number.isFinite`와 위도·경도 범위 검사도 그대로 적용합니다. 따라서 `null`, 불리언, 배열 등이 숫자로 강제 변환되어 유효 좌표로 통과하던 결함을 막으면서 명세의 정상 값·범위 검증을 보존합니다.
- 구현 기록은 QA가 malformed 좌표 실패를 재현하고 가드를 추가했다고 기록합니다(`implementation-6.md:3-5`). 요청 정보에 따르면 QA가 변경 상태에서 geocode 테스트 14개 통과를 확인했습니다. 이 리뷰에서는 테스트를 실행하거나 QA가 작성 중인 테스트 파일을 열지 않았습니다. 참조된 `qa-report-2.md`는 검토 시점에 `artifacts/task-team/`에서 찾지 못해 QA 결과는 전달받은 상태로 구분합니다.

### 이전 리뷰 finding 재검토

- 운영 URL `/api/api/v1/...` (이전 High): **SKIP 유지.** `triage-4.md`는 `00-input.md` 2차 실측에서 운영 기준 주소에 `/api/v1/cities/all`을 붙인 요청이 200, `/api`를 뺀 요청은 404였다고 기록합니다. `api-spec.md` 2-B도 `/api`가 포함된 기준 주소와 문자열 접미 경로를 명시하므로, 이전 finding은 실제 운영 계약과 반대되는 경로 추정이었습니다. 이번 리뷰는 실서버 요청을 다시 하지 않았습니다.
- 모달 중 탭 전환 허용 (이전 Medium): **SKIP 유지.** `triage-4.md`에서 `Dialog.tsx`가 Radix 기본 modal 동작을 사용하고, 오버레이의 포인터 차단 및 포커스 트랩으로 실제 사용자의 탭 접근이 막힌다고 근거를 확인했습니다. 강제 이벤트 호출만으로 실제 사용자 재현이라고 보지 않습니다. 재작업 finding으로 유지하지 않습니다.
- `Intl` 국가명과 기존 국가명 차이에 따른 중복 검사 누락: **VALID 위험, finding 아님.** `design-spec.md:487`의 D-2가 이번 범위에서 바꾸지 않고 QA에서 영향을 확인하도록 정했습니다.

## CodeRabbit 교차검토

- 실행 명령: `coderabbit review --agent --base-commit dddfd83`. 기본 리뷰는 **추적 파일만** 대상으로 실행했고 완료됐습니다(exit 0, 7건). `--include-untracked`를 붙인 전체 요청은 auto-review가 미추적 산출물까지 전송할 수 있다는 사유로 거부해 재시도하지 않았습니다. 따라서 신규 untracked QA 테스트 파일은 CodeRabbit 범위에 포함되지 않았습니다.
- 인증: sandbox 외부 `coderabbit auth status`에서 인증을 확인했습니다. CodeRabbit 결과는 free CLI allowance로 생성됐습니다.
- 타당 항목 (3/7):
  - `artifacts/task-team/requirements.md:252`, `artifacts/task-team/api-spec.md:23` — 실제 개발 IPv4 주소가 문서에 기록되어 “실제 값은 문서·코드에 적지 않고 환경 변수로 둔다”는 요구와 충돌합니다. 두 finding은 같은 이슈의 별도 위치입니다. **Low**, 자체 리뷰 중복 없음. 주소 값은 이 보고서에 재기재하지 않습니다.
  - `artifacts/work/city-server-tabs/STATUS.md:13`, `:18`; `artifacts/work/city-server-tabs/HANDOFF.md:25` — 커밋 완료 상태와 구현 변경이 미커밋이라고 적힌 안내가 함께 남아 다음 담당자를 혼란스럽게 할 수 있습니다. **Low**, 자체 리뷰 중복 없음.
- 기각 항목 (4건):
  - `src/components/cities/CityFormModal.tsx:63` — 1,000ms 클라이언트 쿨다운과 1,100ms 서버 제한의 차이로 일부 요청이 429가 될 수 있다는 UX 지적은 타당한 가능성입니다. 다만 requirements N-4 및 api-spec 3-F가 이 값을 각각 명시적으로 확정했고 서버 제한은 정책 상한을 보호합니다. 승인된 동작으로 **SKIP**, finding 아님.
  - `artifacts/task-team/design-spec.md:417` — 위치 검색 후 도시명/국가 변경 시 좌표를 그대로 두면 오래된 좌표를 저장할 수 있다는 제안은 해당 디자인 명세의 “후보·상태는 비우되 위도·경도는 변경하지 않는다”와 충돌합니다. 수동 좌표 입력도 유지하도록 확정되어 **SKIP**, finding 아님.
  - `artifacts/work/city-server-tabs/HANDOFF.md:41` — 운영 경로 예시가 `/api/api/v1/...`가 된다는 지적은 triage-4에서 확인한 실제 요청의 200 및 `/api` 제외 경로의 404와 반대이므로 **SKIP** (이전 자체 리뷰 High와 중복).
  - `tests/hooks/useCityMutations.test.tsx:74-84` — 레거시 국가명으로 중복 검사가 통과하는 동작을 바꾸라는 제안은 디자인 D-2(`artifacts/task-team/design-spec.md:487`)에서 이번 범위 밖으로 확정하고 QA에서 기록하도록 한 위험입니다. 테스트는 해당 합의 동작을 명시적으로 검증하므로 **SKIP** (이전 자체 리뷰 위험과 중복).

## generic harness 변경 (13dcb0a)

- 포함 파일: `.codex/agents/bug-localizer.toml`, `.codex/agents/security-reviewer.toml`.
- 두 역할의 `model_reasoning_effort`를 `xhigh`에서 `high`로 조정한 설정 변경입니다. CodeRabbit에서 이 변경에 대한 finding은 없었습니다. 기능 변경과 별도 검토 결과 **추가 finding 없음**.

## 검토 한계

- 테스트는 QA 전달 결과만 참고했으며 직접 실행하지 않았습니다.
- 실서버 요청과 브라우저 재현은 하지 않았습니다.
- CodeRabbit은 추적 파일 리뷰를 완료했습니다. 테스트 파일·실서버 요청·브라우저 동작은 직접 검증하지 않았습니다.
