import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";
import { addCity, deleteCity, getCities, updateCity } from "@/services/cityService";
import type { CityRequest } from "@/types/city";

// 전역 fetch를 대체해 내부 엔드포인트 계약(/api/cities*, { status, data } 래퍼)을 검증
const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const stubFetch = (respond: () => Response | Promise<Response>) => {
  const fetchMock = vi.fn(async () => respond());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const callOf = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls[0] as unknown as [string, RequestInit];

const seoulApiData = {
  cityId: 1,
  cityName: "Seoul",
  countryName: "South Korea",
  lat: 37.5665,
  lng: 126.978,
  countryCode: "KOR",
};

const validParams: CityRequest = {
  cityName: "Busan",
  countryName: "South Korea",
  lat: 35.1796,
  lng: 129.0756,
  countryCode: "KOR",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getCities (F1)", () => {
  it.each(["prod", "dev"] as const)("%s 목록 요청은 같은 서버 식별자를 내부 URL에 유지한다", async (server) => {
    const fetchMock = stubFetch(() => jsonResponse(200, { status: "success", data: [] }));

    await getCities(server);

    expect(callOf(fetchMock)[0]).toBe(`/api/cities?server=${server}`);
  });

  it("GET /api/cities 응답을 City 타입으로 변환해 반환한다", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { status: "success", data: [seoulApiData] }));

    const cities = await getCities("dev");

    expect(callOf(fetchMock)[0]).toBe("/api/cities?server=dev");
    expect(cities).toEqual([
      {
        id: "1",
        name: "Seoul",
        country: "South Korea",
        flag: "🇰🇷",
        lat: 37.5665,
        lng: 126.978,
        countryCode: "KOR",
      },
    ]);
  });

  it("도시가 0개면 빈 배열을 반환한다 (F1 빈 상태 엣지케이스)", async () => {
    stubFetch(() => jsonResponse(200, { status: "success", data: [] }));

    expect(await getCities("dev")).toEqual([]);
  });

  it("매핑되지 않은 국가코드는 기본(흰) 국기로 대체하고 조회는 막지 않는다", async () => {
    stubFetch(() =>
      jsonResponse(200, { status: "success", data: [{ ...seoulApiData, countryCode: "ZZZ" }] }),
    );

    const [city] = await getCities("dev");

    expect(city.flag).toBe("🏳️");
  });

  it("상류 서버 오류(5xx) 응답이면 상태 코드와 메시지를 가진 ApiError로 던진다", async () => {
    stubFetch(() => jsonResponse(502, { status: "fail", data: "도시 서버에 문제가 발생했습니다." }));

    await expect(getCities("dev")).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
      message: "도시 서버에 문제가 발생했습니다.",
    });
  });

  it("fetch 자체가 실패하면 status 0의 ApiError로 던진다", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));

    const error = await getCities("dev").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });
});

describe("addCity (F3)", () => {
  it("POST /api/cities로 정규화한 요청 본문을 보내고 City를 반환한다", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(200, { status: "success", data: { ...seoulApiData, cityId: 7, cityName: "Busan" } }),
    );

    const created = await addCity("dev", {
      ...validParams,
      cityName: "  Busan ",
      countryCode: " kor ",
    });

    const [url, init] = callOf(fetchMock);
    expect(url).toBe("/api/cities?server=dev");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(validParams);
    expect(created).toMatchObject({ id: "7", name: "Busan", countryCode: "KOR" });
  });

  it("서버의 400 메시지를 그대로 담은 ApiError로 던진다", async () => {
    stubFetch(() => jsonResponse(400, { status: "fail", data: "위도는 -90에서 90 사이여야 합니다." }));

    await expect(addCity("dev", { ...validParams, lat: 91 })).rejects.toMatchObject({
      status: 400,
      message: "위도는 -90에서 90 사이여야 합니다.",
    });
  });
});

describe("updateCity (F4)", () => {
  it("PUT /api/cities/{id}로 요청하고 City를 반환한다", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { status: "success", data: seoulApiData }));

    const updated = await updateCity("dev", "1", validParams);

    const [url, init] = callOf(fetchMock);
    expect(url).toBe("/api/cities/1?server=dev");
    expect(init.method).toBe("PUT");
    expect(updated.id).toBe("1");
  });

  it("없는 id면 404 ApiError로 던진다", async () => {
    stubFetch(() => jsonResponse(404, { status: "fail", data: "대상을 찾을 수 없습니다." }));

    await expect(updateCity("dev", "9999", validParams)).rejects.toMatchObject({
      status: 404,
      message: "대상을 찾을 수 없습니다.",
    });
  });
});

describe("deleteCity (F5)", () => {
  it("DELETE /api/cities/{id}로 요청하고 반환값은 없다", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { status: "success", data: seoulApiData }));

    await expect(deleteCity("dev", "1")).resolves.toBeUndefined();

    const [url, init] = callOf(fetchMock);
    expect(url).toBe("/api/cities/1?server=dev");
    expect(init.method).toBe("DELETE");
  });

  it("없는 id면 404 ApiError로 던진다", async () => {
    stubFetch(() => jsonResponse(404, { status: "fail", data: "대상을 찾을 수 없습니다." }));

    await expect(deleteCity("dev", "9999")).rejects.toMatchObject({ status: 404 });
  });
});
