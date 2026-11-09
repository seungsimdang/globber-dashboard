import { describe, expect, it } from "vitest";
import { ApiError, DEFAULT_ERROR_MESSAGE } from "@/lib/apiClient";
import { getErrorMessage, isNotFoundError } from "@/utils/cityErrorMessage";

// 서버(cityUpstream, cityApiToken)가 실제로 내보내는 메시지 리터럴, 서버 문구가 바뀌면 분류 테스트가 깨짐
const SERVER = {
  authFail: "서버 인증에 실패했습니다.",
  connectFail: "도시 서버에 연결할 수 없습니다.",
  timeout: "도시 서버 응답이 지연되고 있습니다.",
  upstream5xx: "도시 서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  configBase: "서버 설정 오류: 도시 API 주소가 설정되지 않았습니다.",
  configEmail: "서버 설정 오류: 테스트 계정이 설정되지 않았습니다.",
};
const GENERIC_LIST = "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";

describe("getErrorMessage 분류", () => {
  it("서버 인증 실패(502)는 쓰기와 삭제 문맥에서 인증 문구다", () => {
    expect(getErrorMessage(new ApiError(502, SERVER.authFail), "write")).toContain("서버 인증에 실패했습니다");
    expect(getErrorMessage(new ApiError(502, SERVER.authFail), "delete")).toContain("서버 인증에 실패했습니다");
  });

  it("서버 설정 오류(500) 두 종류는 문맥별 설정 문구다", () => {
    for (const m of [SERVER.configBase, SERVER.configEmail]) {
      expect(getErrorMessage(new ApiError(500, m), "write")).toContain("저장할 수 없습니다");
      expect(getErrorMessage(new ApiError(500, m), "delete")).toContain("삭제할 수 없습니다");
    }
  });

  it("연결 실패(502)와 지연(504)은 네트워크 문구다", () => {
    expect(getErrorMessage(new ApiError(502, SERVER.connectFail), "list")).toContain("서버에 연결할 수 없습니다");
    expect(getErrorMessage(new ApiError(504, SERVER.timeout), "list")).toContain("서버에 연결할 수 없습니다");
  });

  it("상류 5xx 변환 메시지는 서버 문제 문구다", () => {
    expect(getErrorMessage(new ApiError(502, SERVER.upstream5xx), "list")).toBe(GENERIC_LIST);
  });

  it("목록 문맥에서는 인증과 설정 오류도 일반 서버 문제 문구로 숨긴다", () => {
    expect(getErrorMessage(new ApiError(502, SERVER.authFail), "list")).toBe(GENERIC_LIST);
    expect(getErrorMessage(new ApiError(500, SERVER.configBase), "list")).toBe(GENERIC_LIST);
  });

  it("status 0(네트워크 실패)은 네트워크 문구다", () => {
    expect(getErrorMessage(new ApiError(0, "x"), "write")).toContain("입력한 내용은 유지됩니다");
  });

  it("4xx는 서버 메시지를 그대로, 기본 메시지면 문맥별 폴백을 쓴다", () => {
    expect(getErrorMessage(new ApiError(400, "검색어를 입력해 주세요."), "write")).toBe("검색어를 입력해 주세요.");
    expect(getErrorMessage(new ApiError(400, DEFAULT_ERROR_MESSAGE), "write")).toBe(
      "저장하지 못했습니다. 입력 내용을 확인해주세요.",
    );
    expect(getErrorMessage(new ApiError(404, DEFAULT_ERROR_MESSAGE), "delete")).toBe("삭제하지 못했습니다.");
  });

  it("ApiError가 아닌 오류는 메시지를, 메시지가 없으면 폴백을 쓴다", () => {
    expect(getErrorMessage(new Error("이미 등록된 도시입니다."), "write")).toBe("이미 등록된 도시입니다.");
    expect(getErrorMessage(new Error(""), "list")).toBe("목록을 불러오지 못했습니다.");
    expect(getErrorMessage("x", "list")).toBe("목록을 불러오지 못했습니다.");
  });
});

describe("isNotFoundError", () => {
  it("ApiError 404만 true다", () => {
    expect(isNotFoundError(new ApiError(404, "x"))).toBe(true);
    expect(isNotFoundError(new ApiError(400, "x"))).toBe(false);
    expect(isNotFoundError(new Error("404"))).toBe(false);
  });
});
