"use client";

import { type KeyboardEvent, useId, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/common/Input";
import { geocodeMessages } from "@/utils/cityErrorMessage";
import { cn } from "@/utils/cn";
import { type CountryOption, filterCountries } from "@/utils/countryOptions";

type CountryComboboxProps = {
  id: string;
  selected: CountryOption | null;
  /** 선택하면 항목, 입력을 모두 지우면 null */
  onSelect: (option: CountryOption | null) => void;
  /** 목록이 열리고 닫힐 때 알림, Esc가 모달 닫기로 번지지 않게 부모가 참고 */
  onListOpenChange?: (open: boolean) => void;
  hasError?: boolean;
  errorId?: string;
};

/** 국가명·코드 검색 선택 입력(ARIA combobox), 타이핑은 검색어일 뿐이고 항목 클릭이나 Enter로만 선택 확정 */
export const CountryCombobox = ({
  id,
  selected,
  onSelect,
  onListOpenChange,
  hasError = false,
  errorId,
}: CountryComboboxProps) => {
  const listboxId = useId();
  // null이면 편집 중이 아니므로 선택된 국가명을 표시
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const text = query ?? selected?.name ?? "";
  // 편집 중이 아니면 검색어가 비어 전체 목록
  const options = useMemo(() => filterCountries(query ?? ""), [query]);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    onListOpenChange?.(next);
  };

  const optionId = (index: number) => `${listboxId}-${index}`;

  const moveHighlight = (next: number) => {
    setHighlight(next);
    document.getElementById(optionId(next))?.scrollIntoView?.({ block: "nearest" });
  };

  const choose = (option: CountryOption) => {
    onSelect(option);
    setQuery(null);
    setHighlight(-1);
    changeOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length === 0) return;

      const down = event.key === "ArrowDown";

      if (!open) {
        changeOpen(true);
        moveHighlight(down ? 0 : options.length - 1);
        return;
      }

      moveHighlight(down ? (highlight + 1) % options.length : (highlight <= 0 ? options.length : highlight) - 1);
      return;
    }

    if (event.key === "Enter" && open) {
      // 목록이 열려 있는 동안 Enter는 폼 제출이 아니라 선택
      event.preventDefault();
      const option = options[highlight];
      if (option) choose(option);
      return;
    }

    if (event.key === "Escape" && open) {
      event.stopPropagation();
      changeOpen(false);
      setHighlight(-1);
      return;
    }

    if (event.key === "Tab") {
      changeOpen(false);
      setHighlight(-1);
    }
  };

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && highlight >= 0 ? optionId(highlight) : undefined}
        aria-describedby={errorId}
        autoComplete="off"
        placeholder="국가명 또는 코드로 검색"
        value={text}
        hasError={hasError}
        onFocus={() => changeOpen(true)}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setHighlight(-1);
          changeOpen(true);
          if (next === "") onSelect(null);
        }}
        onBlur={() => {
          // 확정되지 않은 입력 텍스트는 버리고 선택된 국가명으로 되돌림
          setQuery(null);
          setHighlight(-1);
          changeOpen(false);
        }}
        onKeyDown={handleKeyDown}
      />
      <span className="sr-only" aria-live="polite">
        {open ? (options.length > 0 ? geocodeMessages.countryCount(options.length) : geocodeMessages.noCountryMatch) : ""}
      </span>
      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="국가 목록"
          // 항목 클릭 시 입력의 blur가 먼저 일어나 목록이 닫히는 것을 막음
          onMouseDown={(event) => event.preventDefault()}
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">{geocodeMessages.noCountryMatch}</li>
          ) : (
            options.map((option, index) => {
              const isSelected = selected?.code === option.code;

              return (
                <li
                  key={option.code}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(option)}
                  onMouseMove={() => setHighlight(index)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 px-3 py-2",
                    index === highlight && "bg-blue-50",
                  )}
                >
                  <span className={cn("text-sm text-gray-900", isSelected && "font-medium")}>{option.name}</span>
                  <span className="flex items-center gap-2 text-xs text-gray-500">
                    {option.code}
                    {isSelected ? <Check className="h-4 w-4 text-blue-600" aria-hidden="true" /> : null}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
};
