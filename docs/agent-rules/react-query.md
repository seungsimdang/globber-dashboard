# React Query / 데이터 페칭 핵심 규칙

## 계층

`src/services/cityService.ts`(목업, 실제 API와 동일 시그니처) → `src/hooks/`(useQuery/useMutation) → 컴포넌트

1. **서비스 함수는 순수 데이터만 반환한다** - Response wrapper가 아니라 도메인 타입
   (`City`, `City[]`)을 반환한다. 실제 API 응답 파싱(`cityResponseList` 등)과 동일한
   변환 로직을 목업 안에서도 거치게 하여, 나중에 fetch로 교체해도 반환 타입이 그대로다.
2. **queryKey는 `src/lib/react-query/query-keys.ts`의 `queryKeys` 팩토리에서만** 만든다.
3. **`queryOptions()` 팩토리 사용** - 컴포넌트에서 인라인 `queryKey`/`queryFn` 금지.
4. **mutation 성공 후 반드시 `queryClient.invalidateQueries({ queryKey })`** - 추가/수정/삭제
   후 목록을 갱신한다.
5. **목업 지연/실패는 `src/mocks/mockDelay.ts`로 시뮬레이션** - 로딩/에러 UI가 실제
   네트워크 환경에서도 그대로 동작하는지 검증할 수 있게 한다.
6. **파생 상태 금지** - 쿼리 결과를 `useEffect`로 `useState`에 복사하지 않는다.
7. **폼 모달 내부 상태는 열림 시점에만 초기화** - 수정 모달은 대상 도시 `id`만 부모가
   넘기고 내부에서 해당 데이터를 조회해 초기값을 세팅한다.
