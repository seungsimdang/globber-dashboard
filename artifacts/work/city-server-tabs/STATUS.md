# Status: city-server-tabs

- 마지막 갱신: 2026-11-09
- 이전 담당: Claude (task-team-orchestrator 세션)
- 다음 담당: 사용자 지정 (Claude 또는 Codex)
- 현재 단계: 구현 완료, 검토 전
- 상태: 구현 커밋 완료(`3d1ac27`, `54d0fca`, `a542d61`, 미푸시). 리뷰·QA는 3차와 함께 진행 예정, 후속 상태는 `artifacts/work/city-input-assist/STATUS.md`

## 완료된 일

- Task Team 2차 사이클(운영·개발 서버 분리) T01~T06 완료. T07~T09(코드 리뷰·보안 리뷰·QA)는 사용자 지시("구현까지만")로 미실행
- 요구사항·API·디자인 명세 커밋: `a876e65`, `43f22ef` (둘 다 `origin/feature/real-city-api`에 미푸시)
- T05(프런트)·T06(백엔드) 구현을 메인 체크아웃에 병합, 미커밋. 구현 worktree와 임시 브랜치는 제거함
- 병합 후 메인 체크아웃에서 lint·type-check·전체 테스트(131개)·build 통과

## 차단 또는 주의 사항

- 사용자 결정: 커밋·push 하지 않고 그대로 둠. 구현 변경 30개 파일과 이 인계 문서가 메인 체크아웃 `/Users/leeseunghyun/Documents/GitHub/globber-dashboard`(브랜치 `feature/real-city-api`)에 미커밋 상태. 커밋·push는 사용자 승인 필요
- 새 동작(server 400, 운영 쓰기 403·상류 호출 0회, 탭 전환, 운영 비활성 버튼)을 직접 검증하는 테스트 없음. T09 QA 담당
- 실서버 쓰기 요청 금지(사용자 승인 없음). `.env` 값·상류 주소·토큰·테스트 이메일을 출력하거나 문서에 쓰지 않음
- 사용자 dev 서버(포트 3000) 종료 금지
- 배포 환경 변수 교체 필요: `CITY_API_PROD_BASE_URL`, `CITY_API_DEV_BASE_URL` 추가, `CITY_API_BASE_URL` 삭제. 로컬 `.env`에는 두 기준 주소 변수를 추가함(`CITY_API_TEST_EMAIL`은 값이 없어 미설정, 개발 쓰기 시 설정 오류)

## 다음 행동

1. 사용자에게 구현 변경 커밋(관심사별 분리)·push 승인을 받는다
2. task-team-orchestrator로 T07 코드 리뷰·T08 보안 리뷰를 병렬 실행 → 9-1 게이트(2차 사이클의 1차 리뷰이므로 타당한 finding은 심각도 무관 재작업)
3. T09 QA(신규 테스트 작성), summary·improvement-log 갱신
