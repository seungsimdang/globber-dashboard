// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: () => getSession() }));

beforeEach(() => {
  vi.resetModules();
  getSession.mockResolvedValue({ username: "admin" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const request = (url: string) => new Request(`http://localhost/api/geocode${url}`);

describe("/api/geocode 인증·입력 경계", () => {
  it("세션이 없으면 상류 요청 없이 401을 반환한다", async () => {
    getSession.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/geocode/route");

    expect((await GET(request("?city=Seoul&country=KOR"))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["?country=KOR", "도시 누락"],
    ["?city=%20&country=KOR", "공백 도시"],
    ["?city=Seoul&city=Busan&country=KOR", "중복 도시"],
    ["?city=Seoul&country=KR", "alpha-2 코드"],
    ["?city=Seoul&country=ZZZ", "지원하지 않는 코드"],
  ])("%s 입력(%s)은 외부 요청 없이 거부한다", async (query) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/geocode/route");

    const response = await GET(request(query));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("server 파라미터는 무시하며 검증된 도시·국가만 고정 상류 호출에 전달한다", async () => {
    const fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/geocode/route");

    expect((await GET(request("?city=Seoul&country=KOR&server=prod"))).status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain("nominatim.openstreetmap.org/search?");
    expect(String(url)).not.toContain("server=");
    expect(init.redirect).toBe("error");
    expect(new Headers(init.headers).get("Accept-Language")).toBe("ko");
  });
});
