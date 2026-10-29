# 브랜치 전략

## 목차

- [트랙](#트랙)
- [병합 흐름](#병합-흐름)
- [Task Team/Bug Team과의 관계](#task-teambug-team과의-관계)

## 트랙

- **`main`**: 프로덕션. 병합은 `develop`에서만 받는다.
- **`develop`**: 통합 브랜치. Task Team `feature/*` 사이클의 병합 대상이다.
- **`feature/*`**: Task Team 한 사이클(요구사항→구현→리뷰→QA)의 작업 브랜치. `develop`에서 분기하고, 사이클 완료 후 사용자 지시에 따라 `develop`에 병합한다.

## 병합 흐름

1. `develop`에서 `feature/{기능명}` 분기, Task Team 사이클 진행.
2. 사이클 완료(T09 QA 통과) 후 사용자가 병합을 지시하면 `develop`에 병합.
3. `develop`이 `docs/agent-rules/project.md`의 배포 게이트를 통과하면(게이트가 비어 있으면 사용자에게 확인) 사용자 지시에 따라 `main`에 병합해 프로덕션 배포.

## Task Team/Bug Team과의 관계

- `task-team-orchestrator`가 새 기능 사이클을 시작할 때 분기 기준은 `develop`이다. worktree `baseRef` 설정과 별개로, 사이클 시작 시점의 기준 브랜치를 `develop`으로 둔다.
- `bug-team-orchestrator`의 병렬 T03-fix worktree도 같은 원칙을 따른다 - 수정 대상 브랜치가 `develop`이면 그 기준으로 분기한다.
- `develop`·`main`에는 `git merge --no-ff`로만 반영한다. fast-forward 반영(`git merge --ff-only`, `git fetch . X:develop` 등)은 하지 않는다. 프로젝트가 pre-push 검사를 두면 `docs/agent-rules/project.md`에 적는다.
- 이 문서가 정한 병합 방향(`feature/* → develop → main`)을 벗어나는 병합(예: `feature/*`를 `main`에 직접 병합)은 사용자가 명시적으로 지시하지 않는 한 하지 않는다.
