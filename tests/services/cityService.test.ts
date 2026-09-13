import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetMockCitiesForTest, getAllMockCities } from "@/mocks/mockCities";
import { addCity, deleteCity, getCities, searchCities, updateCity } from "@/services/cityService";
import type { AddCityRequest, UpdateCityRequest } from "@/types/city";

/**
 * `mockDelay`는 300~800ms 랜덤 지연으로 순수 타이밍 시뮬레이션일 뿐 검증/쓰기 로직과 무관하다
 * (api-spec.md §3.1). 테스트 속도를 위해 즉시 resolve하도록 대체하되, cityService.ts의 실제
 * 검증/저장소 조작 로직(addCity/updateCity/deleteCity 등)은 그대로 사용한다.
 */
vi.mock("@/mocks/mockDelay", () => ({
  mockDelay: () => Promise.resolve(),
}));

const validAddParams: AddCityRequest = {
  cityName: "Busan",
  countryName: "South Korea",
  lat: 35.1796,
  lng: 129.0756,
  countryCode: "KR",
};

beforeEach(() => {
  __resetMockCitiesForTest();
});

describe("getCities (F1)", () => {
  it("등록된 전체 도시 목록을 City 타입으로 변환해 반환한다", async () => {
    const cities = await getCities();

    expect(cities).toHaveLength(15);
    expect(cities[0]).toEqual({
      id: "1",
      name: "Seoul",
      country: "South Korea",
      flag: "🇰🇷",
      lat: 37.5665,
      lng: 126.978,
      countryCode: "KR",
    });
  });

  it("동일 국가에 여러 도시가 존재해도 정상적으로 모두 표시된다 (F1 엣지케이스)", async () => {
    await addCity({ ...validAddParams, cityName: "Incheon", countryName: "South Korea" });

    const cities = await getCities();
    const korean = cities.filter((city) => city.country === "South Korea");

    expect(korean.map((city) => city.name).sort()).toEqual(["Incheon", "Seoul"]);
  });

  it("도시가 0개면 빈 배열을 반환한다 (F1 빈 상태 엣지케이스)", async () => {
    for (const city of getAllMockCities()) {
      await deleteCity(String(city.cityId));
    }

    expect(await getCities()).toEqual([]);
  });

  it("매핑되지 않은 국가코드는 기본(흰) 국기로 대체하고 등록/조회는 막지 않는다", async () => {
    await addCity({ ...validAddParams, cityName: "Nukuʻalofa", countryName: "Tonga", countryCode: "TO" });

    const cities = await getCities();
    const tonga = cities.find((city) => city.name === "Nukuʻalofa");

    expect(tonga?.flag).toBe("🏳️");
  });
});

describe("searchCities (F2)", () => {
  it("도시명 기준 대소문자 무관 부분 문자열로 검색한다", async () => {
    const results = await searchCities("SEO");
    expect(results.map((c) => c.name)).toEqual(["Seoul"]);
  });

  it("공백만 있는 키워드는 trim 후 전체 목록을 반환한다 (F2 엣지케이스)", async () => {
    const results = await searchCities("   ");
    expect(results).toHaveLength(15);
  });

  it("검색 결과가 없으면 빈 배열을 반환한다", async () => {
    const results = await searchCities("존재하지않음-zzz");
    expect(results).toEqual([]);
  });
});

describe("addCity (F3)", () => {
  it("유효한 입력이면 도시를 추가하고 City를 반환한다", async () => {
    const created = await addCity(validAddParams);

    expect(created).toMatchObject({
      name: "Busan",
      country: "South Korea",
      countryCode: "KR",
    });
    expect(await getCities()).toHaveLength(16);
  });

  it.each([
    ["cityName", { ...validAddParams, cityName: "" }],
    ["countryName", { ...validAddParams, countryName: "  " }],
    ["countryCode", { ...validAddParams, countryCode: "" }],
    ["lat", { ...validAddParams, lat: Number.NaN }],
    ["lng", { ...validAddParams, lng: Number.NaN }],
  ])("필수 필드(%s) 누락 시 정확한 에러 메시지로 거부한다 (F3 엣지케이스)", async (_field, params) => {
    await expect(addCity(params as AddCityRequest)).rejects.toThrow("필수 항목을 모두 입력해주세요.");
  });

  it("위도가 90 초과면 거부한다", async () => {
    await expect(addCity({ ...validAddParams, lat: 91 })).rejects.toThrow(
      "위도는 -90에서 90 사이여야 합니다.",
    );
  });

  it("위도가 -90 미만이면 거부한다 (경계값)", async () => {
    await expect(addCity({ ...validAddParams, lat: -90.1 })).rejects.toThrow(
      "위도는 -90에서 90 사이여야 합니다.",
    );
  });

  it("위도 경계값(-90, 90)은 통과한다", async () => {
    await expect(addCity({ ...validAddParams, cityName: "A", lat: -90 })).resolves.toBeDefined();
    await expect(addCity({ ...validAddParams, cityName: "B", lat: 90 })).resolves.toBeDefined();
  });

  it("경도가 180 초과면 거부한다", async () => {
    await expect(addCity({ ...validAddParams, lng: 180.1 })).rejects.toThrow(
      "경도는 -180에서 180 사이여야 합니다.",
    );
  });

  it("경도가 -180 미만이면 거부한다", async () => {
    await expect(addCity({ ...validAddParams, lng: -181 })).rejects.toThrow(
      "경도는 -180에서 180 사이여야 합니다.",
    );
  });

  it("국가코드가 2자리 대문자 형식이 아니면 거부한다", async () => {
    await expect(addCity({ ...validAddParams, countryCode: "kr" })).rejects.toThrow(
      "국가 코드는 2자리 대문자 형식이어야 합니다.",
    );
    await expect(addCity({ ...validAddParams, countryCode: "KOR" })).rejects.toThrow(
      "국가 코드는 2자리 대문자 형식이어야 합니다.",
    );
  });

  it("동일 도시명+국가명 조합이 이미 존재하면 거부한다 (F3 중복 엣지케이스)", async () => {
    await expect(addCity({ ...validAddParams, cityName: "Seoul", countryName: "South Korea" })).rejects.toThrow(
      "이미 등록된 도시입니다.",
    );
  });

  it("도시명이 같아도 국가명이 다르면 중복이 아니다 (동명이인 도시 허용)", async () => {
    await expect(
      addCity({ ...validAddParams, cityName: "Seoul", countryName: "Canada" }),
    ).resolves.toMatchObject({ name: "Seoul", country: "Canada" });
  });

  it("중복 검사는 대소문자를 구분하지 않는다", async () => {
    await expect(
      addCity({ ...validAddParams, cityName: "seoul", countryName: "south korea" }),
    ).rejects.toThrow("이미 등록된 도시입니다.");
  });

  it("도시명/국가명이 100자를 초과하면 거부한다", async () => {
    const longName = "a".repeat(101);
    await expect(addCity({ ...validAddParams, cityName: longName })).rejects.toThrow(
      "도시명과 국가명은 100자 이하여야 합니다.",
    );
  });

  it("경쟁 조건 방지: 동일 요청을 연속(동시)으로 보내면 하나만 성공하고 나머지는 중복 거부된다", async () => {
    // requirements.md §3: 검증 → 쓰기가 mockDelay 이전에 동기적으로 완료되므로, 지연 없이도
    // Promise.allSettled로 "동시에" 던진 두 요청 중 하나만 성공해야 한다.
    const results = await Promise.allSettled([
      addCity({ ...validAddParams, cityName: "RaceCity", countryName: "RaceLand" }),
      addCity({ ...validAddParams, cityName: "RaceCity", countryName: "RaceLand" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0].status === "rejected") {
      expect(rejected[0].reason.message).toBe("이미 등록된 도시입니다.");
    }

    const finalCount = getAllMockCities().filter(
      (c) => c.cityName === "RaceCity" && c.countryName === "RaceLand",
    ).length;
    expect(finalCount).toBe(1);
  });
});

describe("updateCity (F4)", () => {
  it("존재하는 도시를 수정하면 반영된 City를 반환한다", async () => {
    const updated = await updateCity("1", {
      cityName: "Seoul Updated",
      countryName: "South Korea",
      lat: 1,
      lng: 2,
      countryCode: "KR",
    });

    expect(updated).toMatchObject({ id: "1", name: "Seoul Updated" });
  });

  it("존재하지 않는 id 수정 시도 시 '대상을 찾을 수 없습니다.' 오류를 던진다 (F4 엣지케이스)", async () => {
    const params: UpdateCityRequest = {
      cityName: "Ghost",
      countryName: "Nowhere",
      lat: 0,
      lng: 0,
      countryCode: "XX",
    };

    await expect(updateCity("9999", params)).rejects.toThrow("대상을 찾을 수 없습니다.");
  });

  it("존재 확인은 유효성 검사보다 먼저 수행된다 (없는 id + 잘못된 입력이어도 not-found 메시지)", async () => {
    await expect(
      updateCity("9999", { cityName: "", countryName: "", lat: 999, lng: 999, countryCode: "x" } as UpdateCityRequest),
    ).rejects.toThrow("대상을 찾을 수 없습니다.");
  });

  it("필수 필드 누락 시 addCity와 동일한 에러 메시지로 거부한다", async () => {
    await expect(
      updateCity("1", { cityName: "", countryName: "South Korea", lat: 0, lng: 0, countryCode: "KR" }),
    ).rejects.toThrow("필수 항목을 모두 입력해주세요.");
  });

  it("위경도 범위 초과 시 addCity와 동일한 에러 메시지로 거부한다", async () => {
    await expect(
      updateCity("1", { cityName: "Seoul", countryName: "South Korea", lat: 999, lng: 0, countryCode: "KR" }),
    ).rejects.toThrow("위도는 -90에서 90 사이여야 합니다.");
  });

  it("수정 결과가 자기 자신을 제외한 다른 도시와 중복되면 거부한다 (F4 엣지케이스)", async () => {
    // cityId 2 = Tokyo/Japan. Seoul/South Korea로 바꾸려 하면 cityId 1과 중복.
    await expect(
      updateCity("2", { cityName: "Seoul", countryName: "South Korea", lat: 0, lng: 0, countryCode: "KR" }),
    ).rejects.toThrow("이미 등록된 도시입니다.");
  });

  it("자기 자신의 기존 값으로 수정(변경 없음)하는 것은 중복으로 취급하지 않는다", async () => {
    await expect(
      updateCity("1", { cityName: "Seoul", countryName: "South Korea", lat: 37.5665, lng: 126.978, countryCode: "KR" }),
    ).resolves.toMatchObject({ id: "1", name: "Seoul" });
  });

  it("동시 수정/삭제 충돌: 수정 도중 다른 요청이 먼저 삭제하면 수정은 대상 없음 오류로 처리된다 (F4 엣지케이스)", async () => {
    // 검증 → 쓰기가 동기적이므로, "삭제 먼저 완료 후 수정 시도"로 충돌을 재현한다.
    await deleteCity("3");

    await expect(
      updateCity("3", { cityName: "Paris", countryName: "France", lat: 0, lng: 0, countryCode: "FR" }),
    ).rejects.toThrow("대상을 찾을 수 없습니다.");
  });
});

describe("deleteCity (F5)", () => {
  it("존재하는 도시를 삭제하면 이후 목록에서 사라진다", async () => {
    await deleteCity("1");

    const cities = await getCities();
    expect(cities.find((c) => c.id === "1")).toBeUndefined();
    expect(cities).toHaveLength(14);
  });

  it("존재하지 않는 id 삭제 시도 시 '대상을 찾을 수 없습니다.' 오류를 던진다 (F5 엣지케이스)", async () => {
    await expect(deleteCity("9999")).rejects.toThrow("대상을 찾을 수 없습니다.");
  });

  it("중복 삭제 요청(더블 클릭 등): 두 번째 삭제는 오류가 나지만 최종 상태는 목록에서 사라진 채로 일관된다 (F5 idempotency)", async () => {
    await deleteCity("1");

    await expect(deleteCity("1")).rejects.toThrow("대상을 찾을 수 없습니다.");

    const cities = await getCities();
    expect(cities.find((c) => c.id === "1")).toBeUndefined();
  });
});
