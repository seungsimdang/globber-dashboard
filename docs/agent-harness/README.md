# 에이전트 하네스

## 시작점과 명세

Codex는 `AGENTS.md`, Claude는 `CLAUDE.md`에서 시작한다. 역할 11개와 스킬 5종은 절차·설정·책임·금지사항·산출물 계약을 갖춘다. Claude와 Codex 본문을 하나로 축약하지 않는다.

## 원본과 동기화

`.claude/`, `.codex/`, `.agents/`의 실제 파일이 원본이다. 별도 템플릿이나 생성 단계는 두지 않는다. 역할·스킬을 고치면 Claude판과 Codex판을 같은 변경에서 함께 고친다.

이 하네스는 범용 하네스 저장소(seungness)에서 받아온 것이다. 범용 하네스와 주고받는 규칙, `Harness-Scope` 커밋 줄, 프로젝트 소유 파일은 `sync.md`를 따른다.

### 연결 후 동기화

| 시점 | 받기(범용 → 프로젝트) | 올리기(프로젝트 → 범용) |
| --- | --- | --- |
| Claude·Codex 세션 시작 | 실행 | 실행 |
| 커밋·병합 직후 | 실행 안 함 | `generic` 커밋이 있으면 백그라운드 실행 |

- 받기: 범용 하네스에서 바뀐 파일을 3-way 병합하고 `Harness-Scope: sync`로 자동 커밋한다.
- 올리기: 통합 브랜치의 `Harness-Scope: generic` 커밋만 seungness main에 반영하고 push한다. 사람 검토는 거치지 않는다.
- 건너뛰는 경우: 받기는 worktree 세션이거나 스테이징된 변경·하네스 파일의 미커밋 변경이 있을 때, 올리기는 seungness가 main이 아니거나 미커밋 변경이 있을 때. 다음 세션 시작 때 다시 시도한다.
- 충돌·실패 대응과 수동 실행은 `sync.md`를 따른다.

## 스킬

양쪽 도구에서 task-team-orchestrator, bug-team-orchestrator, git-commit, cross-agent-handoff, harness-lab을 관리한다.

## 훅과 검사 배치

검사 배치 기준은 `docs/agent-rules/enforcement-placement.md`를 따른다. Git 훅(pre-commit, commit-msg, pre-push)과 CI는 프로젝트 소유이며 `docs/agent-rules/project.md`에 적는다. 범용 하네스가 요구하는 Git 훅은 commit-msg(`.harness/check-scope.sh`)와 post-commit·post-merge(`.harness/sync.sh commit`)이며 등록 방법은 `docs/agent-rules/project.md`의 Git 훅 절을 따른다.

- SessionStart(`startup`) 훅은 `.harness/sync.sh session`으로 범용 하네스와 양방향 동기화한다. 규칙은 `sync.md`.
- Claude·Codex 런타임 훅은 각 도구의 등록 구조(`.claude/settings.json`, `.codex/hooks.json`)를 유지한다. Codex Edit|Write 훅은 `.codex/hooks/codex-tool-adapter.mjs`를 거쳐 실행한다. Codex에 대응 도구가 없는 AskUserQuestion·EnterWorktree·isolation·fork·Agent 관련 훅은 Claude에만 둔다.
- 미확인 주장·질문 미응답 차단은 도구별로 방식이 다르다. Claude는 Stop의 `.claude/hooks/judge-unverified-claims.sh`가 이번 턴 사용자 메시지·도구 기록과 마지막 응답을 `claude -p`(haiku)로 판정하고, Codex는 `.codex/hooks/block-unverified-claims.sh` 정규식 판정을 유지한다(질문 미응답은 판정하지 않음).
- `block-comment-line-wrap.sh`는 프로젝트의 `scripts/check-comment-line-breaks.mjs`가 있을 때만 검사한다. 없으면 통과한다.
- `block-lint-warnings-on-commit.sh`는 에이전트의 `git commit` 직전에 저장소 루트의 `biome.json(c)`이면 `biome check --error-on-warnings`, `eslint.config.*`이면 `eslint --max-warnings=0`을 HEAD 대비 변경 파일과 추적하지 않는 파일에 실행해 경고·오류가 있으면 차단한다. 다른 linter이거나 `node_modules/.bin`에 실행 파일이 없으면 통과한다. 사람이 직접 하는 커밋은 프로젝트 pre-commit 훅이 맡는다.
- `require-coderabbit-run.sh`는 `artifacts/task-team/code-review-*.md` 저장 시 CodeRabbit 교차검토 섹션을 강제한다. CodeRabbit CLI(`coderabbit`)가 설치되어 있어야 한다.

런타임 훅은 사용자 승인·판단·발언 전체를 보장하지 않는다. 훅 등록과 입력 기반 검증은 실제 Claude·Codex 런타임 실행 검증과 구분한다.

## 인계와 변경 이력

실제 모델·세션 전환에는 `docs/agent-contracts/handoff.md`와 `artifacts/work/README.md`를 따른다. 공용 인계 흐름은 `claude-codex-shared-harness.md`, 공용 이력의 중앙 원본과 자동 기록 규칙은 `sync.md`의 "변경 이력"을 참조한다. 프로젝트의 `CHANGELOG.md`는 프로젝트 이력이며 동기화하지 않는다.
