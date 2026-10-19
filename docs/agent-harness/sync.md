# 범용 하네스 동기화

이 프로젝트의 하네스는 범용 하네스 저장소(seungness)의 `harness/`와 자동으로 주고받는다. 이 문서는 프로젝트에서 하네스를 고칠 때 지킬 규칙이다. 동기화 도구 사용법과 연결 절차는 seungness `README.md`에 있다.

## 목차

- [파일 소유](#파일-소유)
- [변경 이력](#변경-이력)
- [Harness-Scope 판단 기준](#harness-scope-판단-기준)
- [자동 동기화](#자동-동기화)
- [수동 동기화](#수동-동기화)
- [문제가 생겼을 때](#문제가-생겼을-때)

## 파일 소유

| 구분 | 경로 | 동기화 |
| --- | --- | --- |
| 범용 | `.harness/paths`에 적힌 경로 | 양방향. 받을 때는 3-way 병합이라 프로젝트에서 고친 줄은 남음 |
| 프로젝트 | `docs/agent-rules/project.md`, `.harness/paths`의 `!` 줄, 그 밖의 모든 파일 | 동기화하지 않음 |
| 프로젝트 이력 | `docs/agent-harness/CHANGELOG.md` | 양방향에서 제외. 기존 파일은 그대로 유지 |
| 상태 | `.harness/lock.json` | 마지막으로 받은 seungness 커밋(`synced`), 프로젝트 이름(`name`), 통합 브랜치(`branch`, 선택) |

프로젝트 값이 필요한 범용 규칙은 범용 문서에 `docs/agent-rules/project.md`를 가리키는 문장만 두고, 값은 `project.md`에 적는다. 이렇게 나누면 범용 변경과 프로젝트 변경이 한 줄에 섞이지 않는다.

동기화는 seungness와 프로젝트 양쪽의 대상 규칙에 모두 맞는 파일만 주고받는다. seungness에서 제외한 파일은 프로젝트의 `.harness/paths`가 이전판이어도 주고받지 않는다. 프로젝트의 추가 제외 규칙도 유지된다.

## 변경 이력

- 공용 하네스 이력의 작성 원본은 seungness의 [`harness/docs/agent-harness/CHANGELOG.md`](https://github.com/seungsimdang/seungness/blob/main/harness/docs/agent-harness/CHANGELOG.md) 하나다. seungness에서 직접 수정한 중요 변경도 이 파일에 기록한다.
- 프로젝트의 `generic` 변경이 실제로 반영되면 동기화 도구가 원본 커밋 날짜·제목·본문과 `Harness-Origin: 프로젝트@커밋`을 공용 CHANGELOG에 자동 기록한다. 제어용 `Harness-Scope`·`Harness-Sync`·`Harness-Origin` 줄은 본문에서 제외한다. 설명의 정확성은 원본 커밋 메시지에 달려 있으며 도구가 별도 요약을 생성하지는 않는다.
- 코드와 이력은 같은 seungness 커밋에 들어간다. 자동 반영 커밋이 실패하면 둘 다 복구하고, 재시도나 이미 반영된 커밋으로 항목을 중복 생성하지 않는다. 실제 변경이 없는 커밋은 기록하지 않는다.
- 프로젝트는 자기 CHANGELOG에 프로젝트 이력을 남길 수 있지만 공용 CHANGELOG를 편집하거나 환류하지 않는다. 기존 프로젝트 파일은 덮어쓰거나 삭제하지 않으며, 신규 연결에서는 공용 CHANGELOG를 복사하지 않는다. 최신 공용 이력은 위 중앙 원본에서 확인한다.

## Harness-Scope 판단 기준

`.harness/paths` 대상 파일을 바꾼 커밋에는 커밋 메시지 끝에 `Harness-Scope:` 줄이 필요하다. commit-msg 훅의 `.harness/check-scope.sh`가 검사한다.

| 값 | 기준 | 범용 하네스로 |
| --- | --- | --- |
| `generic` | 다른 프로젝트에 그대로 넣어도 맞는 변경. 에이전트 행동 규칙, 훅 버그 수정, 역할·스킬 절차 개선 | 올라감 |
| `project` | 이 프로젝트의 스택·경로·도메인에만 맞는 변경 | 올라가지 않음 |
| `sync` | 범용 하네스에서 받아온 변경. 자동 동기화가 붙임 | 올라가지 않음 |

- 스택·경로·프로젝트 이름을 지워도 문장이 성립하면 `generic`, 아니면 `project`.
- `generic` 커밋에는 동기화 대상 파일만 담는다. 범용과 프로젝트 변경이 섞이면 `git add -p`로 커밋을 나눈다.

## 자동 동기화

| 시점 | 받기(범용 → 프로젝트) | 올리기(프로젝트 → 범용) |
| --- | --- | --- |
| Claude·Codex 세션 시작(SessionStart `startup`) | 실행 | 실행 |
| 커밋·병합 직후(post-commit·post-merge) | 실행 안 함 | `generic` 커밋이 있으면 백그라운드 실행 |

- 받기: seungness를 최신으로 맞춘 뒤 `synced` 커밋 이후 바뀐 파일을 3-way 병합하고 `Harness-Scope: sync`로 커밋한다. 프로젝트 pre-commit 훅도 그대로 실행된다.
- 올리기: 통합 브랜치(`branch`, 없으면 develop·main·master 순)의 `generic` 커밋만 seungness main에 커밋별로 병합하고 push한다. 사람 검토 없이 반영된다. seungness 커밋에는 `Harness-Origin: {프로젝트}@{커밋}` 줄이 붙어 같은 커밋을 다시 올리지 않는다.
- 건너뛰는 경우: worktree 세션, 스테이징된 변경이 있거나 하네스 파일에 미커밋 변경이 있을 때(받기), seungness가 main이 아니거나 미커밋 변경이 있을 때(올리기). 다음 세션 시작 때 다시 시도한다.
- 결과는 세션 맥락에 한 줄로 남는다. 보류·중단·실패는 세션 시작 화면에도 경고로 뜬다(`systemMessage`). 커밋 직후 실행 기록은 `.git/harness-sync.log`에 남고, 실패한 올리기는 다음 세션 시작 때 다시 시도되어 화면에 뜬다.

## 수동 동기화

```bash
node ../seungness/bin/harness.mjs pull .   # 받기. 충돌 표시를 남기고 커밋은 직접(Harness-Scope: sync)
node ../seungness/bin/harness.mjs push .   # 올리기. seungness 현재 브랜치에 커밋, push는 직접
```

## 문제가 생겼을 때

| 상황 | 할 일 |
| --- | --- |
| 세션 맥락에 "받기 보류: 충돌" | 수동 받기로 충돌 표시를 정리하고 `Harness-Scope: sync`로 커밋 |
| "올리기 중단: … seungness 커밋 실패" | seungness pre-commit(테스트)이 막은 것이다. seungness는 자동으로 원래대로 돌아간다. 메시지의 원인(예: Claude·Codex 짝 불일치)을 프로젝트에서 고쳐 다시 `generic`으로 커밋한다 |
| 세션 맥락에 "올리기 중단: 충돌" | seungness에서 `push`를 수동 실행해 충돌을 정리하고 커밋·push |
| 잘못 `generic`으로 올라간 변경 | seungness에서 해당 커밋을 revert하고 push. 다음 세션에서 각 프로젝트로 퍼짐 |
| 프로젝트에만 두고 싶은 범용 파일 | `.harness/paths` 끝에 `!{경로}` 줄을 추가(`Harness-Scope: project`) |
