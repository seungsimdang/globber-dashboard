# 버그 작업 계약

각 `<work-id>/`에 `ticket.md`, `localize.md`, `fix.md`, `verification.md`, 필요한 `postmortem.md`, `summary.md`를 기록한다.

티켓은 사용자 설명과 관찰된 재현을 구분한다. 원인 분석은 증거·가설·확인된 원인·수정 범위를 기록한다. 수정 결과는 변경 파일과 원인 연결을 설명하고 검증은 원래 증상·회귀·명령·결과·미검증을 남긴다. postmortem의 개선 항목은 담당·검증 기준과 기능팀 후속 경로를 포함한다.

중복 티켓은 기존 work-id로 이어서 근거를 추가한다. 재실행 문서는 `verification-2.md`처럼 차수를 남기고 summary.md에서 최신 결과를 가리킨다. 기존 티켓이나 포스트모텀을 삭제하지 않는다.
