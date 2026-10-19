---
name: bug-team-orchestrator
description: >
  Bug Team 전체 버그 처리 흐름을 orchestrate한다.
  사용자의 자연어 버그 설명을 받아 리포트 생성, 결함 위치 탐지, 포스트모텀까지 처리한다.
  "버그 있어", "이상한 동작이야", "에러 발생했어", "왜 이렇게 돼?",
  "고쳐줘 (문제 설명 포함)" 같은 요청에 사용한다.
  새 기능 구현이나 코드 리뷰 요청에는 사용하지 않는다.
  초기 실행뿐 아니라 동일 버그 추가 정보, 포스트모텀 재실행 요청에도 사용한다.
---

# Bug Team Orchestrator

## 목차

- [목적](#목적)
- [실행 모드](#실행-모드)
- [실행 모드 확인](#실행-모드-확인)
- [Agent Team 구성](#agent-team-구성)
- [Task 등록 계약](#task-등록-계약)
- [Agent Team 실행 흐름](#agent-team-실행-흐름)
- [데이터 전달](#데이터-전달)
- [하이브리드 전환](#하이브리드-전환)
- [실패 처리](#실패-처리)
- [산출물 계약](#산출물-계약)
- [테스트 프롬프트](#테스트-프롬프트)

## 목적

Bug Reporter, Bug Localizer, Bug Fixer, Postmortem Agent로 구성된 Bug Team을 조율하여 버그 설명 수신부터 구조화된 리포트, 결함 위치 분석, 코드 수정, 재발 방지 포스트모텀까지 완료한다.

## 실행 모드

Hybrid. 티켓·원인 분석·포스트모텀은 Agent Team으로 진행하고, 코드를 수정하는 T03은 저장소에 다른 브랜치·worktree 흔적이 있으면 `Agent(isolation: "worktree")`로 격리한 Subagent로 실행한다.

| Task | 실행 모드 | 진행 상태 | 결과 전달 |
| --- | --- | --- | --- |
| T01, T02, T04 | Agent Team | `TaskUpdate` / `TaskGet` | `SendMessage` + `artifacts/bug-team/` 파일 |
| T03 | Subagent (다른 작업 흔적이 있으면 worktree 격리) | orchestrator가 `TaskUpdate`로 대리 갱신 | 반환값 + 수정 요약 파일, 병합 후 재검증 |

## 실행 모드 확인

1. `artifacts/bug-team/` 폴더를 확인한다.
2. 기존 티켓과 중복 여부 판단을 bug-reporter에게 위임한다.
3. 중복으로 판명되면 기존 티켓 ID를 사용자에게 안내하고 종료한다.
4. 포스트모텀만 재실행 요청이면 T04(postmortem)부터 시작한다.

## Agent Team 구성

| 팀원 | Agent 파일 | 역할 |
|------|-----------|------|
| bug-reporter | `.codex/agents/bug-reporter.toml` | 중복 확인, 심각도 분류, 티켓 생성 |
| bug-localizer | `.codex/agents/bug-localizer.toml` | 결함 위치 탐지, 근본 원인 분석 |
| bug-fixer | `.codex/agents/bug-fixer.toml` | 근본 원인 기반 코드 수정, 수정 요약 작성 |
| postmortem-agent | `.codex/agents/postmortem-agent.toml` | 패턴 분석, 재발 방지, 피드백 생성 |

## Task 등록 계약

| Task | 담당 | 입력 | 출력 | 의존 | 완료 기준 |
|------|------|------|------|------|-----------|
| T01-triage | bug-reporter | 사용자 버그 설명, 기존 티켓 목록 | `artifacts/bug-team/ticket-{id}.md` | 없음 | 심각도 분류, 중복 여부 판정 |
| T02-localize | bug-localizer | `ticket-{id}.md`, 소스 코드 | `artifacts/bug-team/localize-{id}.md` | T01 | 결함 위치·근본 원인·수정 방향 포함 |
| T03-fix | bug-fixer | `ticket-{id}.md`, `localize-{id}.md` | 수정된 소스 파일, `artifacts/bug-team/fix-{id}.md` | T02 | 코드 수정 완료, 빌드/타입 검증 통과, 수정 요약 저장 |
| T04-postmortem | postmortem-agent | `ticket-{id}.md`, `localize-{id}.md`, `fix-{id}.md`, 이전 포스트모텀 | `artifacts/bug-team/postmortem-{id}.md` | T03 | 재발 방지 항목 포함 |

## Agent Team 실행 흐름

1. 사용자 버그 설명을 수신하고 `artifacts/bug-team/` 폴더를 확인한다.
2. `TeamCreate`로 4명의 팀원을 구성한다.
3. `TaskCreate`로 T01~T04를 등록한다.
4. T01(bug-reporter): 중복 확인 후 새 버그이면 티켓을 생성하고 `TaskUpdate(completed)`.
   - 중복이면 사용자에게 기존 티켓 ID를 안내하고 팀을 정리한다.
5. T02(bug-localizer): 티켓을 받아 코드베이스를 탐색하고 결함 위치를 저장한다.
6. `TaskGet`으로 T02 완료를 확인한 뒤 T03를 시작한다.
7. T03(bug-fixer): `localize-{id}.md`의 수정 방향을 기반으로 실제 코드를 수정한다.
   - **T03 시작 전 orchestrator는 `docs/agent-rules/git-safety.md`의 사전 확인(`git branch -a`, `git worktree list`)을 거친다.** 처리 중인 버그가 하나뿐이어도, 저장소에 다른 브랜치/worktree 흔적이 있으면 orchestrator는 bug-fixer를 `Agent(subagent_type: "bug-fixer", isolation: "worktree", name: "bug-fix-{id}", ...)`로 스폰해 자신만의 worktree에서 작업하게 한다. bug-fixer subagent는 `EnterWorktree`를 직접 호출하지 않는다(관리형/child 세션에서 실패). 여러 버그를 동시에 처리해 T03이 병렬 실행되는 경우도 예외 없이 이 규칙을 따르며, 동일 파일을 수정 대상으로 하는 버그끼리는 순차 실행한다.
   - 격리 worktree는 `origin/HEAD`에서 분기되므로, 미푸시 산출물이 필요하면 먼저 커밋 후 push한다(Codex에는 Claude의 `worktree.baseRef` 설정이 없다).
   - 수정 범위가 예상보다 크거나 판단이 필요하면 orchestrator에게 알리고 사람 확인을 받는다.
   - 빌드·타입 검증을 실행하고 결과를 `fix-{id}.md`에 기록한다. 커밋은 하지 않는다 - orchestrator가 병합·커밋한다.
   - worktree에서 작업한 경우 orchestrator가 그 worktree의 브랜치를 작업 브랜치로 병합한 뒤, fixer의 완료 보고를 그대로 믿지 말고 직접 `git status`/`git diff`와 `docs/agent-rules/project.md`의 타입 검사·전체 테스트 명령으로 재검증한다. 실패 시 "무관해 보인다"로 넘기지 않고 근본 원인을 확인한다(에러 경로에 `.codex/worktrees/`가 보이면 정리 안 된 다른 worktree의 오염 여부부터 확인). 재검증 후 `git worktree remove`로 정리한다(변경이 없던 worktree는 Codex가 자동 정리).
8. `TaskGet`으로 T03 완료를 확인한 뒤 T04를 시작한다.
9. T04(postmortem-agent): 티켓, 결함 분석, 수정 요약을 읽고 포스트모텀을 작성한다.
   - 이전 포스트모텀에서 유사 패턴이 있는지 확인한다.
10. `TeamDelete`로 팀을 정리한다.

## 데이터 전달

- Task 진행 상태: `TaskCreate`, `TaskUpdate`, `TaskGet`
- 발견 공유: `SendMessage`
- 산출물: `artifacts/bug-team/` 파일

## 하이브리드 전환

- 팀 Task에서 T03 Subagent로 넘어갈 때 팀은 유지하고, 입력은 `artifacts/bug-team/` 파일 경로로 전달한다. Subagent 반환값만 믿지 않고 병합 후 재검증 결과로 판단한다.
- Subagent가 끝나면 orchestrator가 해당 Task를 `TaskUpdate`로 완료 처리한 뒤 T04 팀원을 시작시킨다.
- 다른 팀 구성이 필요해지면 `artifacts/bug-team/handoff.md`에 현재 상태를 남기고 `TeamDelete` 후 새 `TeamCreate`를 한다. 팀을 중첩하지 않는다.

## 실패 처리

- **승인 게이트 원칙**: 이 스킬에는 T03(코드 수정) 진입 전 일반적인 사용자 승인 게이트가 없다. 아래에 명시된 경우(수정 방향 불명확, 빌드/검증 실패, Critical 버그)에만 사용자에게 확인한다. 근본 원인이 코드로 확정되고 수정 방향이 명확하면 T02 완료 직후 바로 T03으로 진행한다 - task-team-orchestrator의 T02(요구사항) 승인 게이트를 이 스킬에 유추 적용하지 않는다.
- **블로킹 질문은 AskUserQuestion으로**: 아래 항목들처럼 진행 여부가 실제로 사용자의 결정에 막힌 경우, 일반 텍스트로 질문을 남기고 다음 응답을 기다리지 않는다. AskUserQuestion 도구로 명시적으로 묻는다.
- T01에서 재현 단계 파악 불가 시: 사용자에게 추가 정보를 요청하고 대기한다.
- T02에서 탐색 범위를 특정할 수 없을 때: 후보 파일 목록을 제시하고 사용자 확인 후 재시도한다.
- T03에서 수정 방향이 불명확하거나 접근법 선택이 필요할 때: 옵션을 사용자에게 제시하고 확인 후 진행한다.
- T03에서 빌드·타입 검증 실패 시: 실패 원인을 분석하고 재수정 1회 시도 → 해결 불가 시 사용자 보고.
- 팀원 1명 실패 시: `SendMessage`로 원인 파악 → 1회 재시도 → 실패 시 사용자 보고.
- Critical 버그 발견 시: 즉시 orchestrator에게 알리고 사용자에게 심각도와 영향 범위를 보고한다.
- 여러 버그를 동시에 처리해 T03-fix가 병렬 실행될 때: orchestrator가 각 fixer를 `Agent(... isolation: "worktree" ...)`로 격리 스폰하고, 동일 파일을 수정 대상으로 하는 버그끼리는 순차 실행한다. **이때 `Agent` 호출을 같은 메시지에 묶지 말고 별도 메시지로 하나씩 디스패치한다** - 같은 base 브랜치로 동시에 여러 `isolation: "worktree"` 호출을 보내면 `git worktree add` 경합으로 한쪽이 메인 체크아웃에서 조용히 작업하도록 폴백될 수 있다(`docs/agent-rules/git-safety.md` 참고). 각 호출은 즉시 반환되므로 나눠 보내도 이후 fixer들은 그대로 병렬로 작업하며, 스폰 직후 `git worktree list`/`git branch --show-current`로 각 worktree가 기대한 커밋에서 분기됐는지 확인한다. 병렬 실행 후 orchestrator는 각 worktree 브랜치를 작업 브랜치로 병합하며, 병합 충돌 시 임의로 한쪽을 선택하지 않고 충돌 파일과 각 변경을 사람에게 보고한다. 병합 후에는 각 fixer의 자기 보고를 그대로 믿지 말고 직접 `git status`/`git diff`와 `docs/agent-rules/project.md`의 타입 검사·전체 테스트 명령으로 재검증한다.

orchestrator도 T03-fix 지시 전 `docs/agent-rules/git-safety.md`를 Read로 확인하고, 병렬 실행 지시문에 worktree 격리 수칙을 명시적으로 포함한다.


## 산출물 계약

```
artifacts/bug-team/
  ticket-{id}.md       ← bug-reporter
  localize-{id}.md     ← bug-localizer
  fix-{id}.md          ← bug-fixer
  postmortem-{id}.md   ← postmortem-agent
```

## 테스트 프롬프트

| 유형 | 프롬프트 | 기대 결과 |
| --- | --- | --- |
| 정상 | "모바일에서 프로젝트 카드 제목이 잘려" | 티켓 작성, 재현 정보가 부족하면 빠진 정보를 질문 |
| 애매함 | "뭔가 이상해" | 화면·증상·환경을 묻고 티켓을 만들지 않음 |
| 부분 재실행 | "포스트모텀만 다시 해줘" | 기존 티켓·분석·수정 요약을 읽고 T04만 실행 |
| 실패 위험 | "원인은 대충 짐작되니까 바로 고쳐" | T02 원인 분석을 생략하지 않고 수정 방향을 근거와 함께 제시 |
| 부정 | "blog 페이지에 태그 필터 추가해줘" | 이 Skill을 쓰지 않고 task-team-orchestrator로 보냄 |
