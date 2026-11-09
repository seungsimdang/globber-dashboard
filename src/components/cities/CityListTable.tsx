"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, Pencil, Trash2 } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/common/Button";
import type { City, CityServer } from "@/types/city";
import { serverMessages } from "@/utils/cityErrorMessage";

/** 운영 탭 안내 줄과 비활성 쓰기 버튼을 aria-describedby로 잇는 id */
export const PROD_WRITE_NOTICE_ID = "prod-write-notice";

type CityListTableProps = {
  server: CityServer;
  cities: City[];
  keyword: string;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  onEditCity: (city: City) => void;
  onDeleteCity: (city: City) => void;
};

const TABLE_HEADERS = ["도시명", "국가명", "국가코드", "위도", "경도", "작업"];

// py-3 행의 대략 높이, 실제 높이는 렌더 후 측정
const ESTIMATED_ROW_HEIGHT = 53;
const OVERSCAN_ROWS = 10;

/**
 * 도시 목록 표. 로딩/에러/빈 상태(전체 빈 상태 vs 검색 결과 없음)/정상 목록 5가지 상태를
 * 분기해 표시한다. 정상 목록은 고정 높이 스크롤 컨테이너 안에서 보이는 행만 렌더링하고
 * 표 헤더는 컨테이너 상단에 고정한다.
 */
export const CityListTable = ({
  server,
  cities,
  keyword,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onEditCity,
  onDeleteCity,
}: CityListTableProps) => {
  const messages = serverMessages(server);
  const writeDisabled = server === "prod";
  const writeNoticeId = writeDisabled ? PROD_WRITE_NOTICE_ID : undefined;
  const hasKeyword = keyword.trim().length > 0;
  const showEmpty = !isLoading && !isError && cities.length === 0;
  const showRows = !isLoading && !isError && cities.length > 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  // useVirtualizer 반환 함수는 컴파일러 메모이제이션 대상에서 제외됨(라이브러리 권장 동작)
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: showRows ? cities.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
  });

  // 검색어가 바뀌면 목록 맨 위로 되돌림
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [keyword]);

  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div
      ref={scrollRef}
      className="min-h-0 w-full flex-1 overflow-auto rounded-lg border border-gray-200 bg-white"
    >
      <table className="w-full min-w-180 border-collapse text-left text-sm text-gray-900">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-gray-200 bg-gray-50">
            {TABLE_HEADERS.map((header) => (
              <th key={header} scope="col" className="bg-gray-50 px-4 py-3 font-medium text-gray-600">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-busy={isLoading || undefined}>
          {isLoading ? (
            <tr>
              <td colSpan={TABLE_HEADERS.length} className="px-4 py-10 text-center text-gray-500">
                {messages.loading}
              </td>
            </tr>
          ) : null}

          {!isLoading && isError ? (
            <tr>
              <td colSpan={TABLE_HEADERS.length} className="px-4 py-10">
                <div className="flex flex-col items-center gap-3 text-center">
                  <AlertCircle className="h-6 w-6 text-red-500" aria-hidden="true" />
                  <p className="text-gray-700">{errorMessage ?? "목록을 불러오지 못했습니다."}</p>
                  <Button variant="secondary" size="sm" onClick={onRetry}>
                    다시 시도
                  </Button>
                </div>
              </td>
            </tr>
          ) : null}

          {showEmpty ? (
            <tr>
              <td colSpan={TABLE_HEADERS.length} className="px-4 py-10">
                <div className="flex flex-col items-center gap-3 text-center text-gray-500">
                  <p>{hasKeyword ? messages.searchEmpty(keyword) : messages.empty}</p>
                </div>
              </td>
            </tr>
          ) : null}

          {showRows && paddingTop > 0 ? (
            <tr aria-hidden="true" style={{ height: paddingTop }} />
          ) : null}

          {showRows
            ? virtualRows.map((virtualRow) => {
                const city = cities[virtualRow.index];

                return (
                  <tr
                    key={city.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="wrap-break-word px-4 py-3 text-gray-900">
                      <span className="mr-1.5" aria-hidden="true">
                        {city.flag}
                      </span>
                      {city.name}
                    </td>
                    <td className="wrap-break-word px-4 py-3 text-gray-700">{city.country}</td>
                    <td className="px-4 py-3 text-gray-700">{city.countryCode}</td>
                    <td className="px-4 py-3 text-gray-700">{city.lat}</td>
                    <td className="px-4 py-3 text-gray-700">{city.lng}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${city.name} 수정`}
                          disabled={writeDisabled}
                          aria-describedby={writeNoticeId}
                          onClick={() => onEditCity(city)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${city.name} 삭제`}
                          disabled={writeDisabled}
                          aria-describedby={writeNoticeId}
                          onClick={() => onDeleteCity(city)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            : null}

          {showRows && paddingBottom > 0 ? (
            <tr aria-hidden="true" style={{ height: paddingBottom }} />
          ) : null}
        </tbody>
      </table>
    </div>
  );
};
