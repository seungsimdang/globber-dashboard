import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, act } from "@testing-library/react";
import { SearchInput } from "@/components/cities/SearchInput";

describe("SearchInput (F2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("입력 후 debounce(300ms) 뒤에 trim된 키워드로 onSearch를 호출한다", () => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} />);

    fireEvent.change(screen.getByPlaceholderText("도시명으로 검색"), {
      target: { value: "  Seoul  " },
    });

    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledWith("Seoul");
  });

  it("debounce 중 추가 입력이 들어오면 마지막 값으로만 한 번 호출한다", () => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} />);
    const input = screen.getByPlaceholderText("도시명으로 검색");

    fireEvent.change(input, { target: { value: "Se" } });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.change(input, { target: { value: "Seoul" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("Seoul");
  });

  it("클리어 버튼은 값이 있을 때만 노출되고, 클릭 시 입력을 비우고 즉시 onSearch('')를 호출한다", () => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} />);
    const input = screen.getByPlaceholderText("도시명으로 검색") as HTMLInputElement;

    expect(screen.queryByLabelText("검색어 지우기")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Tokyo" } });
    expect(screen.getByLabelText("검색어 지우기")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("검색어 지우기"));

    expect(input.value).toBe("");
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("공백만 입력하면 trim 후 빈 문자열로 onSearch를 호출한다 (F2 엣지케이스)", () => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} />);

    fireEvent.change(screen.getByPlaceholderText("도시명으로 검색"), {
      target: { value: "   " },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledWith("");
  });
});
