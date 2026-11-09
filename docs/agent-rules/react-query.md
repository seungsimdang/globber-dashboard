# React Query / 데이터 페칭 핵심 규칙

## 계층

`src/services/cityService.ts`(내부 엔드포인트 호출) → `src/hooks/`(useQuery/useMutation) → 컴포넌트

1. **서비스 함수는 순수 데이터만 반환한다** - Response wrapper가 아니라 도메인 타입
   (`City`, `City[]`)을 반환한다. 실제 API 응답 파싱(`cityResponseList` 등)과 동일한
   변환 로직(`transformApiDataToCity`)을 서비스 안에서 거친다.
2. **queryKey는 `src/lib/react-query/query-keys.ts`의 `queryKeys` 팩토리에서만** 만든다.
3. **`queryOptions()` 팩토리 사용** - 컴포넌트에서 인라인 `queryKey`/`queryFn` 금지.
4. **mutation 성공 후 반드시 `queryClient.invalidateQueries({ queryKey })`** - 추가/수정/삭제
   후 목록을 갱신한다.
5. **검색은 클라이언트 필터링** - 목록 쿼리는 전체 목록 하나(`queryKeys.cities.list`)를 1회
   조회하고, 검색어는 `useCities`에서 `filterCities`로 같은 캐시를 필터링한다. 검색어마다
   요청을 보내지 않는다.
6. **파생 상태 금지** - 쿼리 결과를 `useEffect`로 `useState`에 복사하지 않는다.
7. **폼 모달 내부 상태는 열림 시점에만 초기화** - 수정 모달은 대상 도시 `id`만 부모가
   넘기고 내부에서 해당 데이터를 조회해 초기값을 세팅한다.
