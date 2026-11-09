# 구현 기록 4 (2차 프런트엔드: 운영·개발 탭)

## 변경 파일

신규
- `src/components/common/Tabs.tsx`: `radix-ui`의 `Tabs`를 감싼 공용 컴포넌트(`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`). 새 의존성 없음. 밑줄형 스타일, 포커스 링은 기존 버튼과 동일.

수정
- `src/types/city.ts`: 끝에 `export type CityServer = "prod" | "dev";` 한 줄 추가.
- `src/lib/react-query/query-keys.ts`: `cities.list(server)` 함수형 키.
- `src/services/cityService.ts`: 네 함수가 첫 인자로 `server`를 받고 내부 요청에 `?server=` 부착.
- `src/hooks/useCities.ts`: `citiesQueryOptions(server)`, `useCities(server, keyword)`.
- `src/hooks/useCityMutations.ts`: 세 훅이 `server`를 받고 `queryKeys.cities.list(server)`만 무효화. 중복 사전 검사도 같은 서버 키를 읽는다.
- `src/utils/cityErrorMessage.ts`: `SERVER_LABEL`, `PROD_WRITE_NOTICE`, `serverMessages(server)`(로딩·빈 목록·검색 0건·건수·토스트·제목 접두어), `getListErrorMessage(error, server)` 추가.
- `src/components/cities/CitiesPageContent.tsx`: 탭(기본 운영, `useState`만 사용), 운영 안내 줄, 운영 탭의 `도시 추가` 비활성, 서버별 건수 줄. 검색 입력과 건수 줄은 탭 패널 밖에 둬 검색어가 전환 시 유지된다.
- `src/components/cities/CityListTable.tsx`: `server` prop 추가, `onAddCity` prop과 빈 목록 `도시 추가` 버튼 제거, 운영일 때 수정·삭제 버튼 `disabled` + `aria-describedby`, 서버 이름이 붙은 문구. 안내 줄 id는 `PROD_WRITE_NOTICE_ID`로 export.
- `src/components/cities/CityFormModal.tsx`, `DeleteConfirmDialog.tsx`: `server` prop, 제목 `[개발] ` 접두어, 토스트 문구, 삭제 본문 앞에 `개발 서버에서`.
- 테스트(기존 것만 갱신): `tests/services/cityService.test.ts`, `tests/hooks/useCityMutations.test.tsx`, `tests/components/CityFormModal.test.tsx`, `CityListTable.test.tsx`, `DeleteConfirmDialog.test.tsx`. 시그니처·URL(`?server=dev`)·서버 이름 문구에 맞췄고, 빈 목록 버튼 테스트는 "버튼이 없다"로 바꿨다.

## 판단

- 개발 목록 미리 조회: 하지 않는다. 기본 탭이 운영이고 개발 탭을 열지 않는 사용 흐름이 있으며, 미리 조회하면 상류 개발 서버 호출과 토큰 발급이 매 진입마다 늘어난다. 처음 전환할 때 한 번 로딩 문구가 보이는 비용이 더 작다고 봤다.
- 탭 전환 시 스크롤 맨 위: `TabsContent`가 활성 탭만 렌더하므로 표가 다시 마운트되어 따로 코드 없이 맨 위에서 시작한다.
- 모달의 서버: 모달·다이얼로그는 페이지의 현재 `server`를 그대로 받는다. 열린 동안 탭 전환이 불가하므로 연 시점의 탭과 같다. 운영 탭에서는 쓰기 버튼이 비활성이라 열 수 없다.
- 모달 열림 중 탭 전환 차단은 별도 코드 없이 Radix Dialog의 오버레이·포커스 트랩에 의존한다(디자인 명세 2-A).
- 목록 오류: 설정 오류(`서버 설정 오류` 접두)는 서버 전용 문구, 그 외는 `{서버} 서버: ` + 기존 목록 문구.

## 검증 결과

worktree에 `node_modules`가 없어 `pnpm install --offline --frozen-lockfile`을 실행했다(husky prepare 포함).
- `pnpm lint`: 오류·경고 없음
- `pnpm type-check`: 오류 없음
- `pnpm test`(폴더 지정 없음): 14개 파일, 131개 테스트 통과

## 리뷰 확인 필요

- 목록 오류 판별은 기존 `classify`의 접두어(`서버 설정 오류`)에 의존한다. 백엔드가 개발·운영 주소 누락 시 이 접두어로 500을 내는지는 백엔드 구현과 맞춰 확인해야 한다.
- 안내 줄 `-mt-3`, 패널 flex 구성은 명세 허용 범위의 추론이고 브라우저에서 보지 못했다.
- 건수 줄·검색 입력을 탭 패널 밖에 둔 배치(명세 2-C는 패널이 검색 줄 아래 영역)는 검색어 유지를 `SearchInput` 내부 state 변경 없이 구현하려는 선택이다.
- `src/utils/cityErrorMessage.ts`의 새 export가 단위 테스트 없이 컴포넌트 테스트로만 일부 확인된다(새 테스트 작성은 범위 밖).

## 확인하지 못한 것

- 브라우저 실행·시각 확인, 탭 키보드 조작 실동작(Radix 기본 동작에 의존, 테스트 없음).
- 백엔드 병합 후 실제 `?server=` 라우팅과 통합 동작.
- 새 컴포넌트(`Tabs`, 페이지의 탭 전환·운영 비활성)의 자동 테스트는 없다(qa-engineer 담당).
