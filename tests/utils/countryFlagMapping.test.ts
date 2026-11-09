import { describe, expect, it } from "vitest";
import { getCountryFlag } from "@/utils/countryFlagMapping";

describe("getCountryFlag", () => {
  it.each([
    ["KOR", "🇰🇷"],
    ["ARE", "🇦🇪"],
    ["USA", "🇺🇸"],
  ])("%s는 %s로 변환한다", (code, flag) => {
    expect(getCountryFlag(code)).toBe(flag);
  });
  it("소문자와 앞뒤 공백도 처리한다", () => {
    expect(getCountryFlag(" kor ")).toBe("🇰🇷");
  });
  it("알 수 없는 코드와 alpha-2, 빈 문자열은 흰 깃발이다", () => {
    expect(getCountryFlag("ZZZ")).toBe("🏳️");
    expect(getCountryFlag("KR")).toBe("🏳️");
    expect(getCountryFlag("")).toBe("🏳️");
  });
});
