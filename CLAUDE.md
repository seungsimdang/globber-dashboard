@AGENTS.md

@docs/agent-rules/README.md

@docs/agent-rules/project.md

# 에이전트 하네스

- **프로젝트 전용 규칙**: `docs/agent-rules/project.md` 참조 (스택·디렉터리·검증 명령·스타일, 범용 하네스 동기화 대상 아님)
- **커밋 규칙**: `.claude/skills/git-commit`
- **검사 로직 배치 기준**: `docs/agent-rules/enforcement-placement.md` 참조
- **브랜치 전략**: `docs/agent-rules/branch-strategy.md` 참조 (main/develop/feature 트랙, Task Team 분기 기준)

## Task Team 하네스

새 기능 개발, 요구사항 정의, 설계, 구현, 리뷰, QA의 전체 사이클을 처리합니다.

| 목적 | 위치 |
|------|------|
| 전체 진행표 (Orchestrator) | `.claude/skills/task-team-orchestrator/SKILL.md` |
| 팀원 역할 카드 | `.claude/agents/project-manager.md` |
| 팀원 역할 카드 | `.claude/agents/designer.md` |
| 팀원 역할 카드 | `.claude/agents/frontend-developer.md` |
| 팀원 역할 카드 | `.claude/agents/backend-developer.md` |
| 팀원 역할 카드 | `.claude/agents/code-reviewer.md` |
| 팀원 역할 카드 | `.claude/agents/security-reviewer.md` |
| 팀원 역할 카드 | `.claude/agents/qa-engineer.md` |
| 산출물 | `artifacts/task-team/` |

### 자연어 라우팅 - Task Team

아래 요청이 들어오면 `task-team-orchestrator`를 먼저 사용한다.

- "기능 추가해줘", "요구사항 정의해줘", "이 기능 설계해줘"
- "구현해줘", "코드 리뷰해줘"
- "QA 다시 돌려줘", "보안 검증해줘"
- "이전 결과 기반으로 보완해줘", "특정 단계만 다시 실행해줘"

## Bug Team 하네스

버그 접수, 분류, 결함 위치 탐지, 코드 수정, 포스트모텀, Task Team 피드백 전달을 처리합니다.

| 목적 | 위치 |
|------|------|
| 전체 진행표 (Orchestrator) | `.claude/skills/bug-team-orchestrator/SKILL.md` |
| 팀원 역할 카드 | `.claude/agents/bug-reporter.md` |
| 팀원 역할 카드 | `.claude/agents/bug-localizer.md` |
| 팀원 역할 카드 | `.claude/agents/bug-fixer.md` |
| 팀원 역할 카드 | `.claude/agents/postmortem-agent.md` |
| 산출물 | `artifacts/bug-team/` |

### 자연어 라우팅 - Bug Team

아래 요청이 들어오면 `bug-team-orchestrator`를 먼저 사용한다.

- "버그 있어", "이상한 동작이야", "에러 발생했어"
- "왜 이렇게 돼?", "고쳐줘 (문제 설명 포함)"
- "포스트모텀 해줘", "재발 방지 분석해줘"

## 하네스 설계·점검

하네스 신규 설계, 기존 하네스 점검·개선, drift 확인은 `harness-lab`을 사용한다.

## Claude-Codex 인계

- 모델 또는 세션을 Codex로 넘길 때만 `cross-agent-handoff`를 사용해 `artifacts/work/<work-id>/STATUS.md`와 `HANDOFF.md`를 갱신한다.
- Claude 전용 Agent·Skill·Hook은 `.claude/`를 따른다. 공용 인계 형식 외의 실행 절차는 Codex에 맞추려 하지 않는다.

## 하네스 변경 이력

공용 이력의 중앙 원본과 자동 기록 규칙은 `docs/agent-harness/sync.md`의 "변경 이력"을 참조한다. 프로젝트의 `docs/agent-harness/CHANGELOG.md`는 프로젝트 이력이며 동기화하지 않는다.
