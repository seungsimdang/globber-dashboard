import type { ApiSuccess } from "@/types/city";

/** HTTP 상태 코드를 가진 API 오류, status 0은 네트워크 실패 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const NETWORK_ERROR_MESSAGE = "서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.";
export const DEFAULT_ERROR_MESSAGE = "요청을 처리하지 못했습니다.";
const LOGIN_PATH = "/login";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    // 401은 대시보드 세션 만료, 상류 인증 실패는 서버가 502로 변환
    if (response.status === 401) window.location.assign(new URL(LOGIN_PATH, window.location.origin).href);

    const message =
      isObject(body) && typeof body.data === "string" && body.data ? body.data : DEFAULT_ERROR_MESSAGE;

    throw new ApiError(response.status, message);
  }

  if (!isObject(body) || !("data" in body)) {
    throw new ApiError(response.status, DEFAULT_ERROR_MESSAGE);
  }

  return (body as ApiSuccess<T>).data;
};

export const apiGet = <T>(path: string) => request<T>(path);

export const apiPost = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const apiPut = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(body) });

export const apiDelete = <T>(path: string) => request<T>(path, { method: "DELETE" });
