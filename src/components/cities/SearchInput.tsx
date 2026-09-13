"use client";

import { useEffect, useId, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/common/Input";
import { Label } from "@/components/common/Label";

const DEBOUNCE_MS = 300;

type SearchInputProps = {
  onSearch: (keyword: string) => void;
};

/**
 * 도시명 검색 입력. 입력값을 debounce(300ms)한 뒤 trim된 키워드로 `onSearch`를 호출한다.
 * 검색어가 있을 때만 클리어 버튼을 노출한다.
 */
export const SearchInput = ({ onSearch }: SearchInputProps) => {
  const [value, setValue] = useState("");
  const inputId = useId();

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value.trim());
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, onSearch]);

  return (
    <div className="w-full max-w-sm">
      <Label htmlFor={inputId} className="sr-only">
        도시 검색
      </Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          type="text"
          placeholder="도시명으로 검색"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="pl-9 pr-9"
        />
        {value ? (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => setValue("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
};
