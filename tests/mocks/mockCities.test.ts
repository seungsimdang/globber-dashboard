import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetMockCitiesForTest,
  addMockCity,
  deleteMockCity,
  findMockCityById,
  getAllMockCities,
  isDuplicateCityName,
  searchMockCities,
  updateMockCity,
} from "@/mocks/mockCities";

/**
 * mockCities.ts는 모듈 스코프의 단일 배열(`cities`)을 공유 상태로 쓴다(requirements.md §3).
 * 각 테스트 전에 `__resetMockCitiesForTest()`로 초기 시드 데이터로 되돌려 테스트 간
 * 격리를 보장한다.
 */
beforeEach(() => {
  __resetMockCitiesForTest();
});

describe("getAllMockCities", () => {
  it("초기 시드 데이터 15개를 반환한다", () => {
    expect(getAllMockCities()).toHaveLength(15);
  });

  it("원본 배열이 아닌 복사본을 반환해 외부 변경이 저장소에 영향을 주지 않는다", () => {
    const cities = getAllMockCities();
    cities.push({ cityId: 999, cityName: "X", countryName: "Y", lat: 0, lng: 0, countryCode: "XX" });

    expect(getAllMockCities()).toHaveLength(15);
  });

  it("반환된 개별 city 객체를 변경해도 저장소 원본에는 영향이 없다", () => {
    const cities = getAllMockCities();
    cities[0].cityName = "Mutated";

    expect(getAllMockCities()[0].cityName).toBe("Seoul");
  });
});

describe("searchMockCities", () => {
  it("도시명 부분 문자열이 대소문자 무관하게 매칭된다", () => {
    const result = searchMockCities("seo");
    expect(result.map((c) => c.cityName)).toEqual(["Seoul"]);
  });

  it("공백만 있는 키워드는 trim 후 전체 목록을 반환한다 (F2 엣지케이스)", () => {
    expect(searchMockCities("   ")).toHaveLength(15);
  });

  it("빈 문자열 키워드는 전체 목록을 반환한다", () => {
    expect(searchMockCities("")).toHaveLength(15);
  });

  it("일치하는 도시가 없으면 빈 배열을 반환한다 (검색 결과 0건)", () => {
    expect(searchMockCities("존재하지않는도시명zzz")).toEqual([]);
  });

  it("검색 결과도 복사본이라 변경해도 원본에 영향 없다", () => {
    const result = searchMockCities("Seoul");
    result[0].cityName = "Mutated";

    expect(findMockCityById(1)?.cityName).toBe("Seoul");
  });
});

describe("findMockCityById", () => {
  it("존재하는 id면 해당 도시를 반환한다", () => {
    expect(findMockCityById(1)?.cityName).toBe("Seoul");
  });

  it("존재하지 않는 id면 undefined를 반환한다", () => {
    expect(findMockCityById(9999)).toBeUndefined();
  });
});

describe("isDuplicateCityName", () => {
  it("동일한 도시명+국가명 조합이면 true (대소문자 무관)", () => {
    expect(isDuplicateCityName("seoul", "south korea")).toBe(true);
    expect(isDuplicateCityName("SEOUL", "SOUTH KOREA")).toBe(true);
  });

  it("도시명은 같아도 국가명이 다르면 false (동명이인 도시 허용, requirements.md F3)", () => {
    // Seoul/South Korea는 존재하지만 Seoul/Canada는 없음
    expect(isDuplicateCityName("Seoul", "Canada")).toBe(false);
  });

  it("도시명/국가명 모두 다르면 false", () => {
    expect(isDuplicateCityName("Nowhere", "Neverland")).toBe(false);
  });

  it("excludeCityId를 지정하면 해당 id는 비교 대상에서 제외한다 (수정 시 자기 자신 제외)", () => {
    // cityId 1 = Seoul/South Korea. 자기 자신을 제외하면 중복이 아니어야 한다.
    expect(isDuplicateCityName("Seoul", "South Korea", 1)).toBe(false);
    // 다른 도시(cityId 2)를 제외해도 Seoul/South Korea 자체(id=1)와는 여전히 중복.
    expect(isDuplicateCityName("Seoul", "South Korea", 2)).toBe(true);
  });
});

describe("addMockCity", () => {
  it("새 도시를 추가하고 발급된 cityId를 포함해 반환한다", () => {
    const created = addMockCity({
      cityName: "Busan",
      countryName: "South Korea",
      lat: 35.1796,
      lng: 129.0756,
      countryCode: "KR",
    });

    expect(created.cityId).toBe(16);
    expect(getAllMockCities()).toHaveLength(16);
    expect(findMockCityById(16)?.cityName).toBe("Busan");
  });

  it("id는 현재 최대 id + 1로 단조 증가한다 (동시 추가 시 충돌 방지)", () => {
    const first = addMockCity({
      cityName: "A",
      countryName: "X",
      lat: 0,
      lng: 0,
      countryCode: "XX",
    });
    const second = addMockCity({
      cityName: "B",
      countryName: "Y",
      lat: 0,
      lng: 0,
      countryCode: "YY",
    });

    expect(second.cityId).toBe(first.cityId + 1);
  });
});

describe("updateMockCity", () => {
  it("존재하는 도시를 전량 교체(full replace)한다", () => {
    const updated = updateMockCity(1, {
      cityName: "Seoul Updated",
      countryName: "South Korea",
      lat: 1,
      lng: 2,
      countryCode: "KR",
    });

    expect(updated).toEqual({
      cityId: 1,
      cityName: "Seoul Updated",
      countryName: "South Korea",
      lat: 1,
      lng: 2,
      countryCode: "KR",
    });
    expect(findMockCityById(1)?.cityName).toBe("Seoul Updated");
  });

  it("존재하지 않는 id면 undefined를 반환하고 저장소를 변경하지 않는다", () => {
    const result = updateMockCity(9999, {
      cityName: "Ghost",
      countryName: "Nowhere",
      lat: 0,
      lng: 0,
      countryCode: "XX",
    });

    expect(result).toBeUndefined();
    expect(getAllMockCities()).toHaveLength(15);
  });

  it("수정해도 배열 내 다른 도시 개수/순서에 영향을 주지 않는다", () => {
    updateMockCity(2, {
      cityName: "Tokyo Updated",
      countryName: "Japan",
      lat: 0,
      lng: 0,
      countryCode: "JP",
    });

    const all = getAllMockCities();
    expect(all).toHaveLength(15);
    expect(all[1].cityName).toBe("Tokyo Updated");
    expect(all[0].cityName).toBe("Seoul");
  });
});

describe("deleteMockCity", () => {
  it("존재하는 도시를 삭제하고 삭제 직전 데이터를 반환한다", () => {
    const deleted = deleteMockCity(1);

    expect(deleted?.cityName).toBe("Seoul");
    expect(getAllMockCities()).toHaveLength(14);
    expect(findMockCityById(1)).toBeUndefined();
  });

  it("존재하지 않는 id면 undefined를 반환하고 저장소를 변경하지 않는다", () => {
    const result = deleteMockCity(9999);

    expect(result).toBeUndefined();
    expect(getAllMockCities()).toHaveLength(15);
  });

  it("동일 id를 두 번 삭제하면 두 번째는 undefined (중복 삭제 idempotency, F5 엣지케이스)", () => {
    const first = deleteMockCity(1);
    const second = deleteMockCity(1);

    expect(first?.cityName).toBe("Seoul");
    expect(second).toBeUndefined();
    expect(getAllMockCities()).toHaveLength(14);
  });
});
