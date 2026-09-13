---
name: task-team-orchestrator
description: >
  Task Team 전체 개발 사이클을 orchestrate한다.
  기능 추가, 요구사항 정의, 설계, 구현, 코드/보안 리뷰, QA가 필요할 때 사용한다.
  "기능 추가해줘", "요구사항 정의해줘", "이 기능 설계해줘", "구현해줘", "코드 리뷰해줘" 같은 요청에 사용한다.
  Bug Team 처리 또는 단순 파일 편집 요청에는 사용하지 않는다.
  초기 실행뿐 아니라 재실행, 일부 단계만 다시 실행, 이전 결과 기반 보완 요청에도 사용한다.
---

# Task Team Orchestrator

## 목적

Project Manager, Designer, Frontend/Backend Developer, DevOps, Code Reviewer,
Security Reviewer, QA Engineer로 구성된 Task Team을 조율하여
요구사항 정의부터 QA까지 전체 개발 사이클을 완료한다.

## 실행 모드 확인

1. `artifacts/bug-team/postmortem-*.md` 파일을 전체 목록화한다. 파일이 있으면 각 포스트모텀의 "Task Team 피드백 초안" 섹션을 읽고, 미반영 항목을 `00-input.md`의 "Bug Team 피드백 반영 필수" 섹션에 포함한다. 검토가 완료된 포스트모텀 파일은 삭제한다.
2. `artifacts/task-team/` 폴더 존재 여부를 확인한다.
3. 폴더가 없거나 비어 있으면 → **초기 실행**으로 진행한다.
4. 폴더가 있고 기존 산출물이 있으면 사용자 요청을 분석한다:
   - "다시 실행", "새 기능", "처음부터" → 기존 산출물을 `artifacts/archive/{YYYYMMDD}/`로 이동 후 새 실행.
   - "특정 단계만 다시" (예: "QA만 다시 돌려줘") → 해당 단계부터 부분 재실행.
   - 의도가 불명확하면 "이어서 보완", "특정 단계 재실행", "새 실행" 중 무엇인지 먼저 확인한다.

## Agent Team 구성

| 팀원 | Agent 파일 | 역할 |
|------|-----------|------|
| project-manager | `.claude/agents/project-manager.md` | 요구사항 정의 |
| designer | `.claude/agents/designer.md` | 디자인 명세 |
| frontend-developer | `.claude/agents/frontend-developer.md` | UI/비즈니스 로직 구현 |
| backend-developer | `.claude/agents/backend-developer.md` | API/DB 구현 |
| code-reviewer | `.claude/agents/code-reviewer.md` | 코드 품질 검토 |
| security-reviewer | `.claude/agents/security-reviewer.md` | 보안 취약점 검토 |
| qa-engineer | `.claude/agents/qa-engineer.md` | 테스트 계획 및 실행 |

## Task 등록 계약

| Task | 담당 | 입력 | 출력 | 의존 | 완료 기준 |
|------|------|------|------|------|-----------|
| T01-input | Orchestrator | 사용자 요청 | `artifacts/task-team/00-input.md` | 없음 | 사용자 요청 원문 구조화, 모호한 항목 목록화, 승인 지점 플래그 (요구사항 분석 없음) |
| T02-requirements | project-manager | `00-input.md` | `artifacts/task-team/requirements.md` | T01 | 기능 분해·수용 기준·우선순위·edge case 포함 |
| T03-design | designer | `requirements.md` | `artifacts/task-team/design-spec.md` | T02 | 컴포넌트 목록·인터랙션 포함 |
| T04-api-spec | backend-developer | `requirements.md` | `artifacts/task-team/api-spec.md` | T02 | 엔드포인트·스키마 포함 |
| T05-frontend | frontend-developer | `design-spec.md`, `api-spec.md` | `src/` 코드 | T03, T04 | 모든 컴포넌트 구현 완료 |
| T06-backend | backend-developer | `requirements.md`, `api-spec.md` | `src/` 코드 | T04 | API 구현·유효성 검사 완료 |
| T07-code-review | code-reviewer | `src/` 코드, `requirements.md` | `artifacts/task-team/code-review-1.md` | T05, T06 | 통과/재작업 판정 포함, **구현 코드 주석에 이번 사이클 한정 식별자(요구사항 항목 ID·리뷰 finding ID·게이트 ID) 인용 여부 확인** |
| T08-security | security-reviewer | `src/` 코드, `api-spec.md` | `artifacts/task-team/security-review-1.md` | T05, T06 | 심각도별 취약점 목록 포함 |
| T09-qa | qa-engineer | `requirements.md`, `src/` 코드 | `artifacts/task-team/qa-report-1.md` | T07, T08 | 통과/실패/미검증 분류 완료, **모든 신규 테스트가 검증 대상을 실제 소스에서 import** (로직 재구현 금지) |

## Agent Team 실행 흐름

1. 사용자 요청을 원문 그대로 구조화하고 모호한 항목과 승인 지점을 플래그하여 `artifacts/task-team/00-input.md`에 저장한다. (분석·해석 없이 intake만)
2. `TeamCreate`로 8명의 팀원을 구성한다.
3. `TaskCreate`로 T01~T09를 의존 관계와 함께 등록한다.
4. 팀원들은 자기 Task 시작 시 `TaskUpdate(status: in_progress)`로 갱신한다.
5. **T02 완료 후 사용자 확인 게이트.** `requirements.md` 저장 직후, orchestrator는 기능 분해·수용 기준·edge case 요약을 사용자에게 보고하고 명시적 승인을 받은 뒤에만 T03/T04로 진행한다. 요구사항은 design-spec·api-spec·구현이 그 위에 쌓이는 기준 산출물이므로 이 지점에서 방향을 확정한다. 사용자가 수정을 요청하면 project-manager에게 반영 지시 후 T02를 재실행하고, 다시 이 게이트를 거친다.
6. T03(디자인)과 T04(API 명세)는 T02 완료 및 위 확인 게이트 통과 후 **병렬**로 진행한다.
7. **T05(프론트엔드)와 T06(백엔드) 병렬 구간 - worktree 격리로 진행한다.** T05는 T03·T04 완료 후, T06은 T04 완료 후 시작하며 두 Task는 병렬이다. 둘 다 같은 `src/`를 동시에 수정하므로:
   - **격리 worktree는 저장소 기본 base(`origin/HEAD`)에서 분기된다 - 로컬 HEAD가 아니다.** 스폰 전에 `.claude/settings.json`에 `"worktree": { "baseRef": "head" }`가 있는지 확인한다. 있으면 그 시점까지의 산출물·커밋이 격리 worktree에 그대로 포함된다. 없으면 산출물(`00-input.md`, `requirements.md`, `design-spec.md`, `api-spec.md`)을 먼저 커밋하고 `origin`에 push한 뒤 스폰한다.
   - **orchestrator가 `Agent` 도구로 두 구현자를 스폰하며 `isolation: "worktree"` 파라미터를 지정한다** - 예: `Agent(subagent_type: "frontend-developer", isolation: "worktree", name: "task-t05-frontend", ...)`, `Agent(subagent_type: "backend-developer", isolation: "worktree", name: "task-t06-backend", ...)`. 구현자 subagent는 **`EnterWorktree`를 직접 호출하지 않는다** (관리형/child 세션에서 실패). Claude Code가 스폰 시점에 `.claude/worktrees/<name>/`에 worktree를 만들고 격리를 강제한다.
   - 스폰 프롬프트에 "커밋하지 마라 - orchestrator가 병합·커밋한다", "지정된 파일 범위 밖은 건드리지 마라"를 명시하고, `.claude/rules/shared/git-safety.md`를 Read로 읽도록 지시한다.
8. **T05·T06 병합 및 재검증.** 두 Task가 모두 완료되면 orchestrator가 각 격리 worktree의 브랜치를 원래 작업 브랜치로 병합한다. (`Agent` 결과가 변경이 있었던 worktree의 경로·브랜치를 반환한다.)
   - 병합은 orchestrator가 직접 수행하거나 사람 승인을 받아 진행한다. 병합 충돌이 나면 임의로 한쪽을 선택하지 않고 충돌 파일과 각 변경 내용을 사람에게 보고한 뒤 지시를 기다린다. (파일 범위를 분리해 스폰했으면 충돌이 없어야 정상이다.)
   - 병합 후 각 담당자의 완료 보고를 그대로 믿지 말고, orchestrator가 직접 `git status`/`git diff`와 `pnpm type-check`, `pnpm exec vitest run`으로 재검증한다.
   - **재검증에서 테스트가 실패하면 "이번 변경과 무관해 보인다"는 인상만으로 넘기지 않는다.** 실제 근본 원인을 확인한 뒤에만 무관하다고 결론 내린다. 특히 에러 스택/경로에 `.claude/worktrees/`가 등장하면, 정리되지 않은 다른 worktree 내부 중복 파일까지 테스트 러너가 스캔해 생긴 오염(worktree별 독립 `node_modules`로 인한 라이브러리 중복 로드 등)은 아닌지부터 확인한다. `vitest.config.ts`의 `test.exclude`에 `.claude/worktrees/**`가 있는지도 함께 확인한다.
   - 재검증이 끝난 worktree는 `git worktree remove`로 정리한다(변경이 없던 worktree는 Claude Code가 자동 정리). 미커밋 변경사항이 남아있으면 먼저 병합했는지 확인 후 정리한다.
9. **T07(코드 리뷰)과 T08(보안)** 은 T05·T06 병합·재검증 후 **병렬**로 진행한다. 둘 다 코드를 수정하지 않고 읽기 위주이므로 별도 worktree 없이 병합된 작업 브랜치에서 진행한다.
9-1. **orchestrator 리뷰 재검토 게이트.** T07/T08이 각각 `code-review-N.md`, `security-review-N.md`를 저장하면, orchestrator는 reviewer의 pass/rework 최종 판정 문구만 보고 넘어가지 않는다. 두 파일에 나열된 **모든 finding을 심각도와 무관하게**(Critical/High뿐 아니라 Medium/Low까지) 직접 읽고 아래 기준으로 재판단한다.
   - **타당성**: 실제 코드를 열어 finding이 사실인지 확인한다(리뷰어의 서술만으로 판단하지 않는다 - CodeRabbit 교차검토 절차와 동일한 원칙).
   - **영향도**: 요구사항(`requirements.md`)이 명시한 수용 기준·핵심 목적에 직접 영향을 주는가, 아니면 스타일/사소한 개선인가.

   타당하다고 판단한 finding은 심각도(Medium/Low 포함)와 무관하게 **즉시 이번 사이클 안에서 재작업 대상**으로 삼는다 - "권고로 남기고 다음 사이클에 검토"로 미루지 않는다. 해당 개발자(frontend-developer/backend-developer)에게 수정 지시 후 T07/T08을 재실행한다(worktree 격리는 아래 11번과 동일하게 적용).
   타당하지 않다고 판단한 finding은 기각 사유를 `code-review-N.md`/`security-review-N.md`에 직접 덧붙이거나 orchestrator가 별도로 `artifacts/task-team/triage-N.md`에 남긴다(CodeRabbit 기각 절차와 동일한 형식: finding 요약 + 기각 사유).

### 9-1 게이트 재작업 수행자 예외

타당하다고 판정한 finding은 원칙적으로 해당 개발자(frontend-developer/backend-developer)에게 재작업을 지시한다. 다만 아래 조건을 **모두** 만족하면 orchestrator가 별도 subagent 위임 없이 직접 수정할 수 있다:

- 사용자가 명시적으로 승인했거나 지시한 경우
- 수정 범위가 단순하고 복잡한 도메인 판단이 필요 없는 경우(예: 조건문 수정, 예외 처리 추가, 주석/문서 갱신)
- 단독 편집이라 다른 세션·subagent와의 동시 편집 충돌 위험이 없는 경우(현재 worktree에 다른 active subagent가 없음 - `.claude/rules/shared/git-safety.md` 원칙과 동일선상)

이 경우에도 수정 후 재검증(`pnpm type-check`/`tsc`, `pnpm exec vitest run`, 필요 시 `biome`/`knip`)과 T07/T08 재리뷰는 위임 여부와 무관하게 그대로 수행한다.
10. Phase 전환마다 `TaskGet`으로 완료 상태를 확인하고 지연이 있으면 `SendMessage`로 원인을 파악한다.
11. 9-1 게이트에서 재작업이 결정된 finding(심각도 무관)은 해당 개발자에게 수정 지시 후 관련 리뷰(T07/T08)를 재실행한다. 재작업도 병렬이거나 다른 세션이 같은 브랜치를 공유 편집 중이라는 신호(`git branch -a`/`git worktree list`)가 보이면 T05/T06처럼 `Agent(... isolation: "worktree" ...)`로 격리해 스폰한 뒤 orchestrator가 병합한다. 단독·소범위 수정이고 동시 편집 위험이 없으면 9-1 게이트 예외 규정에 따라 orchestrator가 메인 체크아웃에서 직접 수정할 수 있다.
12. security-reviewer 자체 차단 기준(Critical 미수정 시 배포 비승인)과 9-1 게이트의 재작업 판단은 별개다 - reviewer는 배포 승인/비승인만 판단하고, orchestrator는 "당장 고칠지 백로그로 미룰지"를 9-1 게이트로 최종 결정한다. Critical이 남아있으면 재작업 없이 다음 단계로 진행하지 않는다.
13. T09 완료 후 `artifacts/task-team/summary.md`에 최종 상태를 정리한다.
14. 실행 완료 후 `artifacts/task-team/improvement-log.md`를 갱신하고 `TeamDelete`로 팀을 정리한다.
15. **사용자가 feature 브랜치를 `main`에 병합하라고 지시하면**, 병합 후 `pnpm type-check`/`pnpm exec vitest run` 재검증까지 마친 뒤, 병합에 사용된 로컬 feature 브랜치와 남아있는 관련 worktree를 다시 묻지 않고 orchestrator가 정리한다(`git branch -d`, 필요 시 `git worktree remove`). **병합 완료가 검증된 브랜치만** 삭제한다 - 병합 전이거나 충돌·재검증 실패가 있었던 브랜치는 제외한다. 이는 "파괴적 명령은 사용자 승인 필요" 원칙의 명시적 예외다(검증된 로컬 브랜치 삭제는 `git reflog`로 복구 가능, 사용자가 병합을 지시한 시점에 후속 정리까지 위임된 것으로 본다). `origin`에 푸시된 원격 브랜치나 미병합 브랜치는 이 예외에 해당하지 않는다.

## 데이터 전달

- Task 진행 상태: `TaskCreate`, `TaskUpdate`, `TaskGet`
- 실시간 발견 공유: `SendMessage`
- 다음 단계가 읽어야 할 산출물: `artifacts/task-team/` 파일

## 실패 처리

- 팀원 1명 실패 시: `TaskGet`으로 상태 확인 → `SendMessage`로 원인 파악 → 1회 재시도 또는 재할당.
- 코드/보안 리뷰 재작업 판정 시(reviewer 자체 판정이든 9-1 게이트에서 orchestrator가 타당하다고 재판단한 Medium/Low든): 수정 후 해당 리뷰 Task만 재실행.
- 과반 작업 실패 시: 현재 상태와 선택지를 사용자에게 보고 후 확인.
- 입력 부족 시: 추측하지 않고 필요한 정보를 사용자에게 질문한다.
- **T05/T06 worktree 병합 충돌 시**: orchestrator가 임의로 어느 한쪽을 선택하지 않고 충돌 파일과 각 변경 내용을 사람에게 보고한 뒤 지시를 받는다.
- **T05/T06 병합 후 재검증(`git status`/`git diff` + `pnpm type-check` + `pnpm exec vitest run`)에서 실패 시**: 각 담당자의 "완료" 보고를 신뢰하지 않고 실패 근본 원인을 확인해 해당 담당자에게 다시 배정한다. 에러 경로에 `.claude/worktrees/`가 보이면 정리 안 된 다른 worktree의 테스트 오염 여부부터 확인한다.

orchestrator도 T05/T06(또는 재작업 수정) 병렬 지시 전 `.claude/rules/shared/git-safety.md`를 Read로 확인하고, 병렬 실행 지시문에 worktree 격리 수칙을 명시적으로 포함한다.

## 산출물 계약

```
artifacts/task-team/
  00-input.md          ← 사용자 요청 정리
  requirements.md      ← project-manager
  design-spec.md       ← designer
  api-spec.md          ← backend-developer
  code-review-{n}.md   ← code-reviewer
  security-review-{n}.md ← security-reviewer
  qa-report-{n}.md     ← qa-engineer
  summary.md           ← orchestrator 통합
  improvement-log.md   ← orchestrator 개선 기록
```
