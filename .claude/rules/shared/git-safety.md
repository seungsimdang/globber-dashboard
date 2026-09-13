## 병렬 작업 시 git 안전 수칙

Task Team의 T05(frontend)/T06(backend), Bug Team의 병렬 T03-fix처럼 여러 에이전트가 같은
저장소를 동시에 다룰 때는 **각자 별도 git worktree에서 작업하는 것을 원칙으로 한다** (아래
"worktree 격리" 참고). worktree는 서로 다른 작업 디렉터리를 갖지만, 같은 저장소를 동시에 여러
에이전트가 다룬다는 사실 자체는 남으므로 아래 수칙은 worktree 사용 여부와 무관하게 항상 지킨다.

### worktree 격리 (주 방어선)

**worktree 진입 여부를 병렬 실행 여부로 판단하지 않는다.** 작업 시작 전 반드시
`git branch -a`와 `git worktree list`로 저장소 상태를 먼저 확인한다. main(또는 원래 작업 브랜치)
외에 다른 feature 브랜치가 존재하거나 이미 다른 worktree가 떠 있으면, 이 저장소는 다른 세션이
동시에 사용 중인 것으로 간주한다 - 자신이 처리할 Task가 하나뿐이거나 이 orchestration 내부에서
병렬 실행을 하지 않더라도 동일하게 적용한다.

**`git branch -a`/`git worktree list`가 깨끗해도 동시 사용 중일 수 있다.** 다른 세션이 별도
브랜치나 worktree 없이 같은 메인 체크아웃을 직접 쓰는 경우, 이 두 명령만으로는 감지되지 않는다.
`git status`에서 자신이 만들지 않은 파일의 미커밋 변경(수정/삭제/신규)이 보이면, 원인을 먼저
확인하지 않고 넘어가지 않는다 - 다른 세션이 동시에 이 체크아웃을 쓰고 있다는 신호로 간주하고,
구현자 subagent를 스폰하기 전에 `ListAgents`로 다른 세션 존재 여부를 확인한다. 다른 세션이
있으면 그 즉시 이후 구현자 스폰에 `isolation: "worktree"`를 적용한다.

- **격리는 orchestrator가 `Agent` 도구 호출 시 `isolation: "worktree"` 파라미터로 지정한다.**
  구현자 subagent(frontend-developer / backend-developer / bug-fixer)는 **`EnterWorktree`를 직접
  호출하지 않는다.** 관리형·child·bridged 세션(예: Orca 등 ADE로 래핑되어 실행되는 세션)에서는
  subagent가 `EnterWorktree`를 직접 호출하면 "disabled for this session"으로 실패한다. `Agent`
  스폰 시점에 Claude Code가 subagent용 worktree를 `.claude/worktrees/<name>/`에 만들고 격리를
  강제하며(메인 체크아웃 파일 수정 차단), subagent가 변경을 남기지 않으면 종료 시 자동 삭제한다.
  worktree 이름은 `Agent`의 `name` 파라미터로 지정한다(예: `task-t05-frontend`,
  `task-t06-backend`, `bug-fix-{id}`). 이 문서와 Task Team/Bug Team Orchestrator SKILL.md의
  지시가 곧 "명시적 worktree 사용 지시"에 해당한다.
  - 커스텀 subagent 정의(`.claude/agents/*.md`)에 `isolation: worktree` frontmatter를 두면 매
    호출마다 격리가 강제되지만, 읽기 전용 역할(code-reviewer / security-reviewer / qa-engineer)에는
    붙이지 않는다 - 이들은 병합된 작업 트리를 그대로 읽어야 한다.
- **orchestrator(메인 세션) 자신은 worktree에 들어가지 않는다.** worktree는 구현자 subagent
  전용이며, orchestrator는 메인 체크아웃(또는 세션을 시작한 디렉터리)에 머물면서 `Agent` 스폰과
  병합만 한다. orchestrator가 worktree에 들어가면 main 병합·로컬 브랜치 pull처럼 메인 체크아웃을
  만져야 하는 순간마다 worktree-isolation sandbox에 막혀 벗어날 수 없게 된다. 이 규칙은
  `.claude/hooks/orchestrator-no-worktree.sh`(PreToolUse EnterWorktree 훅)로도 뒷받침되나, 표준
  경로(`Agent` `isolation` 파라미터)에서는 subagent가 `EnterWorktree`를 호출하지 않으므로 이 훅은
  더 이상 정상 흐름에서 트리거되지 않는 보조 장치다.
- **isolation worktree는 저장소 기본 base(`origin/HEAD`)에서 분기된다 - 로컬 HEAD가 아니다.**
  직전 단계 산출물/커밋이 아직 `origin`에 push되지 않았으면 새 isolation worktree에 반영되지
  않는다(실측 확인). 따라서 병렬 subagent를 스폰하기 전에:
  1. `.claude/settings.json`에 `"worktree": { "baseRef": "head" }`가 설정돼 있는지 확인한다.
     설정돼 있으면 isolation worktree가 로컬 HEAD(미푸시 커밋·feature 브랜치 상태 포함)에서
     분기되므로 별도 조치가 필요 없다.
  2. 설정이 없다면, 그 시점까지의 산출물이 브랜치에 **커밋**되어 있는지 `git status`/`git log`로
     확인하고, 미커밋이면 먼저 커밋한 뒤 `origin`에 push한다.
  읽기 전용 리뷰어(T07/T08)에는 이 항목이 무관하다.
- **worktree는 샌드박스가 아니다.** 격리되는 것은 "git 변경이 어느 디렉터리에 반영되는가" 뿐이며,
  프로세스 권한 자체는 그대로다. 따라서:
  - 작업 중인 worktree 경로 밖(다른 worktree, 메인 체크아웃, 저장소 밖 경로)의 파일을 읽거나
    쓰지 않는다.
  - `git checkout`, `git switch -c` 등 브랜치를 바꾸는 명령은 **의도치 않게 부모 저장소의 HEAD를
    바꿀 수 있다는 알려진 문제**가 있다 (참고: anthropics/claude-code#55708). 자신의 worktree
    경로가 현재 cwd인지 먼저 확인하지 않고 이런 명령을 실행하지 않는다.
- **정리는 orchestrator가 한다.** 구현자 subagent는 커밋하지 않고, 자신이 만든/바꾼 파일 목록만
  보고한다. subagent가 변경을 남긴 isolation worktree는 자동 삭제되지 않으므로, orchestrator가
  그 worktree의 브랜치를 작업 브랜치로 병합·재검증한 뒤 `git worktree remove`로 정리한다(미커밋
  변경이 남아 있으면 병합 여부부터 확인). 변경이 없던 worktree는 Claude Code가 자동 정리한다.

### 파괴적 명령 금지 (보조 방어선)

worktree 격리가 모든 경우를 막지 못하므로 아래 수칙도 함께 지킨다.

`git stash`, `git reset --hard`, `git checkout -- .`(경로 미지정), `git clean`, `git branch -D`
등 저장소 전체 또는 다른 worktree/브랜치에 영향을 줄 수 있는 git 명령을 실행하지 않는다 - 자신이
관여하지 않은 다른 세션의 미커밋 변경사항까지 스태시하거나 삭제하거나, 다른 worktree가 사용 중인
브랜치를 지울 위험이 있다.

(실제 발생 사례: BUG010 fixer가 검증 중 `git stash`를 실행해, 동시에 진행 중이던
BUG008/BUG011 fixer가 `risk-guardian.ts`/`strategy-engine.ts`/`pipeline.ts`에 적용하던
변경사항이 함께 쓸려 들어갔다. BUG011 fixer는 이 여파로 자신이 수정한 파일이 작업 도중
원본으로 되돌아가는 것을 직접 겪었다. worktree 격리가 있었다면 애초에 서로의 작업 트리가
분리되어 이 사고가 나지 않았다.)

- 자신이 수정한 파일만 `git diff <path>`, `git status`처럼 경로를 명시하거나 읽기 전용으로 다룬다.
- 작업 트리 전체를 되돌리거나 정리할 필요가 있다고 판단되면 직접 실행하지 말고 orchestrator에게
  상황을 보고해 사람 승인을 받는다.

### 테스트 러너 오염 주의

재검증 시 에러 스택/경로에 `.claude/worktrees/`가 등장하면, 아직 정리되지 않은 다른 worktree
내부의 중복 파일까지 테스트 러너가 스캔 대상에 포함시켜 오염된 결과(worktree마다 독립된
`node_modules`로 인한 라이브러리 중복 로드, "Invalid hook call"류 오류)를 내고 있는 것은
아닌지부터 확인한다. `vitest.config.ts`의 `test.exclude`에 `.claude/worktrees/**`가 포함되어
있으면 worktree 정리 시점과 무관하게 재검증이 안정적이다 - 정리 순서만으로 해결된다고 가정하지
않는다(근본 해결은 테스트 러너 설정에서 worktree 디렉터리를 제외하는 것이다).
