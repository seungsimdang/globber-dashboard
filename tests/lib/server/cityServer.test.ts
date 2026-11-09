// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseCityServer, resolveCityServer } from "@/lib/server/cityServer";

const request = (query: string) => new Request(`http://localhost/api/cities${query}`);

describe("도시 API 대상 서버 판정", () => {
  it.each([
    ["", null],
    ["?server=", null],
    ["?server=staging", null],
    ["?server=dev&server=prod", null],
    ["?server=prod", "prod"],
    ["?server=dev", "dev"],
  ] as const)("%s 파라미터를 %s로 판정한다", (query, expected) => {
    expect(parseCityServer(request(query))).toBe(expected);
  });

  it("서버 누락·중복·오류는 400이고 허용된 서버만 반환한다", async () => {
    for (const query of ["", "?server=dev&server=dev", "?server=invalid"]) {
      const result = resolveCityServer(request(query), { write: false });
      expect("response" in result && result.response.status).toBe(400);
    }
    expect(resolveCityServer(request("?server=prod"), { write: false })).toEqual({ server: "prod" });
    expect(resolveCityServer(request("?server=dev"), { write: false })).toEqual({ server: "dev" });
  });

  it("운영 쓰기는 403, 개발 쓰기는 서버 판정을 통과한다", async () => {
    const prod = resolveCityServer(request("?server=prod"), { write: true });
    expect("response" in prod && prod.response.status).toBe(403);
    expect(resolveCityServer(request("?server=dev"), { write: true })).toEqual({ server: "dev" });
  });
});
