"use client";

import { AlertCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/common/Button";
import type { City } from "@/types/city";

type CityListTableProps = {
  cities: City[];
  keyword: string;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  onAddCity: () => void;
  onEditCity: (city: City) => void;
  onDeleteCity: (city: City) => void;
};

const TABLE_HEADERS = ["도시명", "국가명", "국가코드", "위도", "경도", "작업"];

/**
 * 도시 목록 표. 로딩/에러/빈 상태(전체 빈 상태 vs 검색 결과 없음)/정상 목록 5가지 상태를
 * 분기해 표시한다(design-spec.md §3.1).
 */
export const CityListTable = ({
  cities,
  keyword,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onAddCity,
  onEditCity,
  onDeleteCity,
}: CityListTableProps) => {
  const hasKeyword = keyword.trim().length > 0;
  const showEmpty = !isLoading && !isError && cities.length === 0;
  const showRows = !isLoading && !isError && cities.length > 0;

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm text-gray-900">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {TABLE_HEADERS.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 font-medium text-gray-600">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-busy={isLoading || undefined}>
          {isLoading ? (
            <tr>
              <td colSpan={TABLE_HEADERS.length} className="px-4 py-10 text-center text-gray-500">
                불러오는 중...
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
                  {hasKeyword ? (
                    <p>&apos;{keyword}&apos;에 대한 검색 결과가 없습니다.</p>
                  ) : (
                    <>
                      <p>등록된 도시가 없습니다.</p>
                      <Button size="sm" onClick={onAddCity}>
                        도시 추가
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ) : null}

          {showRows
            ? cities.map((city) => (
                <tr
                  key={city.id}
                  className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-gray-900">
                    <span className="mr-1.5" aria-hidden="true">
                      {city.flag}
                    </span>
                    {city.name}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{city.country}</td>
                  <td className="px-4 py-3 text-gray-700">{city.countryCode}</td>
                  <td className="px-4 py-3 text-gray-700">{city.lat}</td>
                  <td className="px-4 py-3 text-gray-700">{city.lng}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${city.name} 수정`}
                        onClick={() => onEditCity(city)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${city.name} 삭제`}
                        onClick={() => onDeleteCity(city)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            : null}
        </tbody>
      </table>
    </div>
  );
};
