import { describe, expect, it } from "vitest";
import type { City } from "@/types/city";
import { findDuplicateCity } from "@/utils/cityDuplicate";

const c = (id: string, name: string, country: string): City => ({
  id, name, country, flag: "", lat: 0, lng: 0, countryCode: "KOR",
});
const list = [c("1", "Seoul", "South Korea"), c("2", "Busan", "South Korea")];

describe("findDuplicateCity", () => {
  it("도시명과 국가코드가 같으면 공백과 대소문자를 무시하고 찾는다", () => {
    expect(findDuplicateCity(list, { cityName: " seoul ", countryCode: " kor " })?.id).toBe("1");
  });
  it("도시명만 같고 국가코드가 다르면 중복이 아니다", () => {
    expect(findDuplicateCity(list, { cityName: "Seoul", countryCode: "JPN" })).toBeUndefined();
  });
  it("수정 시 자기 자신은 제외한다", () => {
    expect(findDuplicateCity(list, { cityName: "Seoul", countryCode: "KOR" }, "1")).toBeUndefined();
  });
  it("수정 시 다른 도시와 겹치면 찾는다", () => {
    expect(findDuplicateCity(list, { cityName: "Busan", countryCode: "KOR" }, "1")?.id).toBe("2");
  });
});
