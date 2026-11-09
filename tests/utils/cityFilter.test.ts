import { describe, expect, it } from "vitest";
import type { City } from "@/types/city";
import { filterCities } from "@/utils/cityFilter";

const c = (id: string, name: string, country: string): City => ({
  id, name, country, flag: "", lat: 0, lng: 0, countryCode: "KOR",
});
const list = [
  c("1", "Seoul", "South Korea"),
  c("2", "두바이", "아랍에미리트"),
  c("3", "Busan", "South Korea"),
  c("4", "New York", "USA"),
];
const ids = (cities: City[]) => cities.map((x) => x.id);

describe("filterCities", () => {
  it("도시명으로 필터링한다", () => {
    expect(ids(filterCities(list, "두바이"))).toEqual(["2"]);
  });
  it("국가명으로 필터링하고 서버 순서를 유지한다", () => {
    expect(ids(filterCities(list, "korea"))).toEqual(["1", "3"]);
  });
  it("대소문자와 공백을 무시한다", () => {
    expect(ids(filterCities(list, "  NEW york "))).toEqual(["4"]);
    expect(ids(filterCities(list, "newyork"))).toEqual(["4"]);
    expect(filterCities(list, "south korea")).toHaveLength(2);
  });
  it("NFD로 입력한 한글도 NFC 데이터와 일치한다", () => {
    expect(ids(filterCities(list, "두바이".normalize("NFD")))).toEqual(["2"]);
  });
  it("빈 검색어나 공백뿐이면 전체 목록 그대로 반환한다", () => {
    expect(filterCities(list, "")).toBe(list);
    expect(filterCities(list, "   ")).toBe(list);
  });
  it("일치가 없으면 빈 배열이다", () => {
    expect(filterCities(list, "zzz")).toEqual([]);
  });
});
