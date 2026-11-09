import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CountryCombobox } from "@/components/cities/CountryCombobox";
import { filterCountries, findCountryByCode } from "@/utils/countryOptions";

describe("국가 검색 선택", () => {
  it("한국어 국가명과 대소문자 무시 alpha-3 일부로 후보를 찾는다", () => {
    expect(filterCountries("일본").some(({ code }) => code === "JPN")).toBe(true);
    expect(filterCountries("jPn").map(({ code }) => code)).toContain("JPN");
    expect(findCountryByCode(" kor ")?.code).toBe("KOR");
  });

  it("임의 검색어는 확정되지 않고 방향키·Enter로 고른 국가만 선택한다", () => {
    const onSelect = vi.fn();
    render(<CountryCombobox id="country" selected={null} onSelect={onSelect} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "jpn" } });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith({ code: "JPN", name: "일본" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Esc는 국가를 확정하지 않고 후보 목록만 닫는다", () => {
    const onSelect = vi.fn();
    render(<CountryCombobox id="country-esc" selected={null} onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "jpn" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
