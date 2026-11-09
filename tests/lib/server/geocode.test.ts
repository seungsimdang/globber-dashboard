// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

const malformedCoordinates = [null, "", false, true, [], [1], {}].map((value) => ({ value }));
const candidate = (overrides: Record<string, unknown> = {}) => ({
  place_id: 1,
  display_name: "서울, 대한민국",
  lat: "37.5",
  lon: "127.0",
  address: { country_code: "kr", state: "서울특별시" },
  type: "city",
  ...overrides,
});

describe("Nominatim 좌표 응답 검증", () => {
  it.each(malformedCoordinates)(
    "위도에 숫자가 아닌 값($value)이 오면 상류 응답 형식 오류로 거부한다",
    async ({ value: lat }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json([
            {
              place_id: 1,
              display_name: "Seoul",
              lat,
              lon: "127.0",
              address: { country_code: "kr" },
            },
          ]),
        ),
      );
      const { searchGeocode } = await import("@/lib/server/geocode");

      const response = await searchGeocode(["Seoul"], "KOR");

      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({ code: "UPSTREAM_BAD_RESPONSE" });
    },
  );

  it.each(malformedCoordinates)(
    "경도에 숫자가 아닌 값($value)이 오면 상류 응답 형식 오류로 거부한다",
    async ({ value: lon }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json([
            {
              place_id: 1,
              display_name: "Seoul",
              lat: "37.5",
              lon,
              address: { country_code: "kr" },
            },
          ]),
        ),
      );
      const { searchGeocode } = await import("@/lib/server/geocode");

      const response = await searchGeocode(["Seoul"], "KOR");

      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({ code: "UPSTREAM_BAD_RESPONSE" });
    },
  );

  it("국가가 다르거나 국가 코드가 없는 후보를 제외한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([
      candidate({ place_id: 1, address: { country_code: "jp" } }),
      candidate({ place_id: 2, address: {} }),
      candidate({ place_id: 3 }),
    ])));
    const { searchGeocode } = await import("@/lib/server/geocode");

    const response = await searchGeocode(["Seoul"], "KOR");

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([
      { id: "3", displayName: "서울, 대한민국", lat: 37.5, lng: 127, region: "서울특별시", placeType: "city" },
    ]);
  });

  it("동일 입력은 10분 캐시를 쓰고 만료 뒤 다시 조회한다", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(100_000);
    const fetchMock = vi.fn(async () => Response.json([candidate()]));
    vi.stubGlobal("fetch", fetchMock);
    const { searchGeocode } = await import("@/lib/server/geocode");

    await searchGeocode([" Seoul "], "KOR");
    await searchGeocode(["seoul"], "KOR");
    now.mockReturnValue(700_001);
    await searchGeocode(["Seoul"], "KOR");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("상류 호출 간격 1100ms 안의 다른 검색은 429로 제한한다", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(100_000);
    const fetchMock = vi.fn(async () => Response.json([candidate()]));
    vi.stubGlobal("fetch", fetchMock);
    const { searchGeocode } = await import("@/lib/server/geocode");

    await searchGeocode(["Seoul"], "KOR");
    const limited = await searchGeocode(["Busan"], "KOR");
    now.mockReturnValue(101_100);
    const allowed = await searchGeocode(["Busan"], "KOR");

    expect(limited.status).toBe(429);
    expect(allowed.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("Nominatim 타임아웃은 504로 매핑하고 원문 오류를 노출하지 않는다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("private detail", "TimeoutError"); }));
    const { searchGeocode } = await import("@/lib/server/geocode");

    const response = await searchGeocode(["Seoul"], "KOR");

    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: "UPSTREAM_TIMEOUT", data: expect.not.stringContaining("private detail") });
  });
});
