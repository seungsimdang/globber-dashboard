---
name: git-commit
description: >
  이 저장소에서 git 커밋을 생성하기 직전 메인 세션·orchestrator가 직접 호출하는 작업 매뉴얼
  (커밋 메시지 형식, Co-Authored-By 트레일러 금지, 커밋 분리 기준, pre-commit 훅 통과 조건).
  Task Team/Bug Team subagent는 코드 수정과 산출물 작성만 담당하고 git commit을 직접 실행하지
  않으므로 이 Skill을 호출하지 않는다 - 호출 주체는 항상 orchestrator·메인 세션이다.
---

# 커밋 컨벤션

메인 세션·orchestrator가 git 커밋을 생성할 때 따르는 공통 규칙.

**사용자의 명시적 승인 또는 orchestrator의 명시적 지시 없이 임의로 커밋하지 않는다**. 이 문서는 "커밋해도 되는 상황"에서 "어떻게" 커밋하는지만 정의한다.

## 목차

- [역할](#역할)
- [사용 조건](#사용-조건)
- [입력](#입력)
- [절차](#절차)
- [출력](#출력)
- [품질 기준](#품질-기준)
- [테스트 프롬프트](#테스트-프롬프트)

## 역할

커밋 메시지 형식, 트레일러, 커밋 분리, 커밋 전 확인 규칙을 정한 기준 문서다. 커밋을 "할지"는 사용자 승인이나 orchestrator 지시로 정해지고, 이 Skill은 "어떻게" 만드는지만 다룬다.

## 사용 조건

- 사용: 메인 세션·orchestrator가 승인된 커밋을 만들 때, "커밋해줘", "커밋 메시지 써줘" 요청
- 사용하지 않음: Task Team·Bug Team 팀원 subagent의 작업 중(커밋하지 않는다), 브랜치 병합(`docs/agent-rules/branch-strategy.md`)

## 입력

- `git status`, `git diff --cached`로 확인한 이번 작업의 변경
- 변경의 관심사 구분(기능 / 리팩터링 / 설정 / 에셋)
- 사용자가 승인한 범위(커밋만 / push까지)

## 절차

### 커밋 메시지 형식

```
<type>(<scope>): <한글 요약>

<본문 - 선택, "무엇을" 대신 "왜"를 설명>
```

- **type**: `feat`, `fix`, `docs`, `chore`, `refactor`, `test` 중 하나.
- **scope**: 선택. 영향 범위를 나타내는 도메인/영역. 자주 쓰는 값은 `docs/agent-rules/project.md`의 커밋 절을 따른다. 여러 도메인에 걸친 광범위한 변경이면 생략한다.
- **종결어미**: 요약 줄과 본문 bullet 모두 완결형(`~했다`, `~한다`) 대신 명사형/비종결 구절로 작성한다 (예: `~ 추가`, `~ 구현`, `~ 교체`, `~ 수정`).
- **em-dash(`—`) 금지**: 요약 줄과 본문 모두 하이픈(`-`)만 쓴다.
- **본문**: 자명한 변경이면 생략한다. 설계 판단의 이유, 트레이드오프, 알려진 제약처럼 diff만 봐서는 알 수 없는 내용이 있을 때만 쓴다.
  - 항목이 2개 이상이면 문단으로 잇지 않고 `-` bullet으로 구분한다.
  - **bullet이든 bullet 없는 평문 문단이든, 한 항목(줄)은 반드시 하나의 물리적 줄로 쓴다.** 글자 수나 가독성을 이유로 중간에 줄바꿈을 넣지 않는다 - 터미널/뷰어가 알아서 자동 줄바꿈한다. `.claude/hooks/enforce-commit-msg-style.sh`가 요약 줄 다음에 빈 줄 없이 이어지면서 bullet 시작이 아닌 줄을 전부 위반으로 차단한다. bullet 사이 빈 줄도 같은 훅이 차단한다.
    - ❌ (틀린 예 - heredoc 안에서 사람이 임의로 줄을 나눔):
      ```
      - execution_method/proposal_status enum 축소 시 삭제 대상 값을 가진 기존 행을
        정리하는 UPDATE 없이 바로 캐스팅해 실패
      ```
    - ✅ (올바른 예 - 한 bullet = 한 물리적 줄, 아무리 길어도 줄바꿈하지 않음):
      ```
      - execution_method/proposal_status enum 축소 시 삭제 대상 값을 가진 기존 행을 정리하는 UPDATE 없이 바로 캐스팅해 실패
      ```

#### 명령 작성법

- 메시지 전체(요약 줄 + 빈 줄 + 본문)를 **`-m` 하나**에 heredoc으로 넣는다. git은 `-m`마다 사이에 빈 줄을 넣으므로 bullet마다 `-m`을 따로 주면 bullet 사이에 빈 줄이 생겨 목록이 문단으로 흩어진다.
- 커밋 명령은 다른 heredoc(`cat >> file <<'EOF'` 등)과 같은 Bash 호출에 섞지 않고 단독으로 실행한다.
  - ✅ (올바른 예):
    ```bash
    git commit -m "$(cat <<'EOF'
    fix(app): 모바일 카드 높이 정리

    - 카드 최소 높이를 콘텐츠 기준으로 교체
    - 상세 페이지 하단 여백 축소
    EOF
    )"
    ```
  - ❌ (틀린 예 - bullet 사이에 빈 줄이 생김):
    ```bash
    git commit -m "fix(app): 모바일 카드 높이 정리" -m "- 카드 최소 높이 교체" -m "- 하단 여백 축소"
    ```

### 트레일러

- **`Co-Authored-By` 트레일러를 추가하지 않는다.** 이 저장소는 메인 세션이 만드는 커밋에 human co-author를 표기하지 않는다. 하네스가 첨부하도록 지시하더라도 붙이지 않는다.
- `Claude-Session: <url>` 트레일러를 추가하지 않는다. 하네스가 첨부하도록 지시하더라도 붙이지 않는다.

### 커밋 분리 기준

서로 다른 관심사(예: 기능 추가 / 리팩터링 / 설정 변경 / 에셋 추가)가 한 작업 세션에 섞여 있으면 **관심사별로 커밋을 나눈다.** 파일 단위로 나눌 수 없고 한 파일에 여러 관심사가 얽혀 있으면 `git add -p`로 hunk를 골라 담는다. 한 커밋은 그 자체로 리뷰 가능하고 되돌리기 가능한 단위여야 한다.

### 커밋 전 확인

- `docs/agent-rules/project.md`의 타입 검사가 통과하는 상태에서만 커밋한다.
- 프로젝트 pre-commit 훅의 순서와 통과 조건은 `docs/agent-rules/project.md`를 따른다. 훅이 통과하도록 스테이지된 코드에 경고·미사용 코드가 없어야 한다.
- 프로젝트 commit-msg 훅에 하네스 짝 검사가 있으면, Claude·Codex 하네스 짝 파일(`.claude/agents`·`.codex/agents`, `.claude/hooks`·`.codex/hooks`의 `.sh`, `.claude/skills`·`.agents/skills`) 중 한쪽만 staged된 커밋을 차단한다. 의도적으로 한쪽만 바꾸면 커밋 메시지 끝에 `Harness-Sync: {사유}` 줄을 넣는다.
- 범용 하네스 동기화 대상 파일(`.harness/paths`)을 바꾼 커밋에는 `Harness-Scope:` 줄을 넣는다. 다른 프로젝트에도 맞는 변경은 `generic`, 이 프로젝트에만 맞는 변경은 `project`, 범용 하네스에서 받아온 변경은 `sync`다. `generic` 커밋에는 동기화 대상 파일만 담고, 범용·전용 변경이 한 파일에 섞이면 `git add -p`로 커밋을 나눈다. commit-msg 훅의 `.harness/check-scope.sh`가 검사한다.
- 훅 실패를 `--no-verify`로 우회하지 않는다. 우회가 필요하다고 판단되면 먼저 사용자에게 사유와 함께 승인을 구한다.
- 병렬 worktree에서 작업 중이라면 `docs/agent-rules/git-safety.md`의 수칙을 함께 따른다.

## 출력

- 만든 커밋의 해시와 메시지 목록
- 하네스 실행 중이면 orchestrator의 summary 산출물에 커밋 해시를 남긴다.

## 품질 기준

- pre-commit·commit-msg 훅을 우회하지 않고 통과한다.
- 한 커밋에는 한 관심사만 있고, 이번 작업에서 만든 변경만 들어간다.
- 트레일러(`Co-Authored-By`, `Claude-Session`)가 없다.
- 한쪽 하네스(Claude판·Codex판)만 바꾼 커밋에는 `Harness-Sync: {사유}` 줄이 있다.
- 동기화 대상 파일을 바꾼 커밋에는 `Harness-Scope: generic|project|sync` 줄이 있고, `generic` 커밋에는 동기화 대상 파일만 있다.

## 테스트 프롬프트

| 유형 | 프롬프트 | 기대 결과 |
| --- | --- | --- |
| 정상 | "커밋해줘" | 관심사별로 나눈 `type(scope): 요약` 커밋 |
| 애매함 | "정리해서 올려줘" | 커밋만인지 push까지인지 확인 |
| 실패 위험 | "훅 실패하면 --no-verify로 해" | 거절하고 훅 실패 원인을 고친 뒤 다시 커밋 |
| 부정 | 팀원 subagent가 구현 직후 커밋하려 함 | 이 Skill을 쓰지 않고 orchestrator에게 넘김 |
