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
- 코드와 이력은 같은 seungness 커밋에 들어간다. 격리 준비가 실패하면 체크아웃을 버리고, 재시도나 이미 반영된 커밋으로 항목을 중복 생성하지 않는다. 실제 변경이 없는 커밋은 기록하지 않는다.
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

- GitHub Actions가 등록된 원격 프로젝트의 통합 브랜치를 별도 체크아웃에서 읽고 3-way 병합한 업데이트 PR을 만든다. 프로젝트·허브의 현재 작업 브랜치는 변경하지 않는다.
- 프로젝트 통합 브랜치에 push된 `Harness-Scope: generic` 커밋은 허브의 별도 PR로 전달한다. `Harness-Origin`으로 중복 반영을 막는다. `project`·`sync` 커밋은 올리지 않는다.
- 자동 병합 대상은 자동화가 만든 `harness/sync/` PR이며, 하네스 경로·프로젝트 제외 규칙·최신 SHA·base를 검사한다. 필수 `하네스 검사`가 성공하고 나머지 검사에 실패·진행 중 항목이 없어야 다음 자동 실행에서 병합한다. PR 검사 누락·진행 중·실패·충돌이면 병합하지 않는다.
- 세션 시작은 읽기 전용이다. 업데이트 PR이 있으면 링크와 검사·병합 대기 안내를, 원격에 이미 반영됐으면 통합 브랜치를 받아야 한다는 안내를 표시한다. 최신이면 출력하지 않으며 조회 실패는 별도 안내한다. 실제 CI 실패 원인은 PR의 Checks에서 확인한다.
- 세션 시작이 프로젝트를 pull하거나 커밋·push하지 않는다. 기존 `sync.sh commit` Git 훅은 동작 없이 종료한다. 로컬에만 있는 generic 커밋은 origin에 push한 뒤 정기 실행이 읽는다.
- 자동화 등록·실행 주기·인증 설정은 허브 README의 서버 자동화 등록을 따른다. 통합 브랜치가 develop이면 자동 병합도 develop까지만 수행한다.

## 수동 동기화

```bash
node ../seungness/bin/harness.mjs pull .   # 받기. 충돌 표시를 남기고 커밋은 직접(Harness-Scope: sync)
node ../seungness/bin/harness.mjs push .   # 올리기. seungness 현재 브랜치에 커밋, push는 직접
```

## 문제가 생겼을 때

| 상황 | 할 일 |
| --- | --- |
| 업데이트 PR의 검사 실패 | PR Checks에서 실패 원인을 고친 뒤 다시 검사. 실패 상태에서는 병합하지 않음 |
| 동기화 Actions의 충돌 오류 | 격리 작업 브랜치에서 수동 받기로 충돌을 정리하고 `Harness-Scope: sync`로 PR 생성 |
| 업데이트 확인 실패 | GitHub 인증·네트워크와 허브 Actions 실행 결과 확인 |
| 원격에 반영됐지만 로컬이 이전 상태 | 작업을 정리한 뒤 해당 통합 브랜치의 변경을 받음 |
| 잘못 병합된 범용 변경 | 허브에서 revert PR로 복구. 다음 업데이트 PR이 각 프로젝트에 전달 |
| 프로젝트에만 둘 범용 파일 | `.harness/paths` 끝에 `!{경로}` 추가(`Harness-Scope: project`) |

## 공용 회귀 검사

`.harness/*.test.mjs`와 함께 쓰는 검사기·Biome 플러그인은 `.harness/` 동기화 대상에 포함된다. 허브 pre-commit과 연결 프로젝트의 `check-scope.sh`는 공용 테스트 전체를 실행한다. 수동 검증은 `node --test .harness/*.test.mjs`로 실행한다(허브: `node --test bin/*.test.mjs harness/.harness/*.test.mjs`).

명세의 필수 절·팀 통신·메타데이터, Claude·Codex 짝 일치, 훅 정상·위반 입력, Codex 어댑터, Git 인덱스 기반 소스·문서 검사기를 검증한다. 모델 선택은 프로젝트마다 다르므로 특정 모델 이름 대신 필수 메타데이터 형식을 검사한다. Stop 판정 CLI는 고정 응답으로 대체하며 실제 LLM 품질은 검증하지 않는다.

한글 테스트 제목의 Biome 플러그인은 `.harness/korean-test-titles.grit`로 배포한다. Biome를 사용하는 프로젝트는 설정의 `plugins`에 `./.harness/korean-test-titles.grit`를 등록한다. 회귀 테스트는 해당 프로젝트의 `node_modules/.bin/biome`로 실행하며 Biome가 없으면 사유를 표시하고 건너뛴다. 공용화 과정에서 프로젝트의 패키지나 린트 설정을 덮어쓰지 않는다.

소스·문서 검사기는 `.harness/check-*.sh`와 `.harness/check-comment-line-breaks.mjs`로 배포한다. 주석 훅은 프로젝트 `scripts/` 검사기를 우선하고, 없으면 공용 검사기를 사용한다. Git 인덱스 검사기의 lint-staged 연결 여부는 프로젝트가 정한다. 작성자 강제·프로젝트 병합 정책·React Doctor·Tailwind·admin 및 UI 컴포넌트 검사는 프로젝트 소유로 유지한다.
