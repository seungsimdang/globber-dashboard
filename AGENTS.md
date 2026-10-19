<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 공용 에이전트 규칙

코드·문서·Git 작업 전 현재 작업과 관련된 `docs/agent-rules/README.md` 및 해당 규칙 문서를 읽는다. 모든 작업에 적용되는 공통 작업 제약도 같은 README에 있다. 프로젝트 전용 규칙(스택·디렉터리·검증 명령)은 `docs/agent-rules/project.md`에 있으며 작업 전 함께 읽는다.

## Claude-Codex 인계 계약

- Claude와 Codex는 각자의 기존 Skill·Agent 흐름으로 작업한다.
- 모델 또는 세션을 실제로 전환할 때만 `artifacts/work/<work-id>/STATUS.md`와 `HANDOFF.md`를 갱신한다. 대화만으로 다음 모델에 필수 정보를 전달하지 않는다.
- `task-team`·`bug-team`의 상세 산출물은 유지한다. `HANDOFF.md`에는 해당 파일 경로와 다음 모델이 알아야 할 핵심 결론만 적는다.
- 인계 문서 작성·검증이 필요하면 `cross-agent-handoff` Skill을 사용한다. 절차는 `docs/agent-contracts/handoff.md`, 경로·필수 항목·보관 규칙은 `artifacts/work/README.md`를 따른다.

## Task Team 하네스

새 기능 개발, 요구사항 정의, 설계, 구현, 리뷰, QA의 전체 사이클을 처리한다. 진행표는 `.agents/skills/task-team-orchestrator/SKILL.md`, 역할 카드는 `.codex/agents/`의 `project-manager`·`designer`·`frontend-developer`·`backend-developer`·`code-reviewer`·`security-reviewer`·`qa-engineer`(`.toml`), 산출물은 `artifacts/task-team/`이다.

아래 요청이 들어오면 `task-team-orchestrator`를 먼저 사용한다.

- "기능 추가해줘", "요구사항 정의해줘", "이 기능 설계해줘"
- "구현해줘", "코드 리뷰해줘"
- "QA 다시 돌려줘", "보안 검증해줘"
- "이전 결과 기반으로 보완해줘", "특정 단계만 다시 실행해줘"

## Bug Team 하네스

버그 접수, 분류, 결함 위치 탐지, 코드 수정, 포스트모텀, Task Team 피드백 전달을 처리한다. 진행표는 `.agents/skills/bug-team-orchestrator/SKILL.md`, 역할 카드는 `.codex/agents/`의 `bug-reporter`·`bug-localizer`·`bug-fixer`·`postmortem-agent`(`.toml`), 산출물은 `artifacts/bug-team/`이다.

아래 요청이 들어오면 `bug-team-orchestrator`를 먼저 사용한다.

- "버그 있어", "이상한 동작이야", "에러 발생했어"
- "왜 이렇게 돼?", "고쳐줘 (문제 설명 포함)"
- "포스트모텀 해줘", "재발 방지 분석해줘"

## 하네스 설계·점검

하네스 신규 설계, 기존 하네스 점검·개선, drift 확인은 `.agents/skills/harness-lab`을 사용한다.

## 하네스 변경 이력

공용 하네스 이력은 seungness에서 관리한다. 중앙 원본 위치와 자동 기록 규칙은 `docs/agent-harness/sync.md`의 "변경 이력"을 참조한다. 프로젝트의 `docs/agent-harness/CHANGELOG.md`는 프로젝트 이력이며 동기화하지 않는다.
