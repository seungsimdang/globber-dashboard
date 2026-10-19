# 기능 작업 계약

각 `<work-id>/`에 `00-input.md`, `requirements.md`, 필요한 `design-spec.md`·`api-spec.md`, `implementation.md`, `code-review-N.md`, 필요한 `security-review-N.md`, `qa-report-N.md`, `summary.md`를 기록한다.

요청 범위가 리뷰·QA만이면 해당 입력과 결과만 남긴다. 단계별 담당·입력 경로·상태(pending/in-progress/blocked/done/skipped)와 생략 이유는 summary.md에서 관리한다. 검토자는 명세와 실제 diff를 읽고 QA는 수용 기준과 실제 동작을 비교한다. 단일 실행이면 작성자를 동일하게 기록하고 독립 리뷰로 표현하지 않는다.

재실행은 N을 올리고 기준 커밋·변경 범위·이전 결과의 유효성을 기록한다. finding은 심각도·근거·위치·영향·수정/기각/범위 밖 여부를 남긴다. 기존 기록은 보존한다.
