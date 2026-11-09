import { ApiError, DEFAULT_ERROR_MESSAGE } from "@/lib/apiClient";

type ErrorContext = "list" | "write" | "delete";

/** 대상 도시를 찾을 수 없을 때 표시하는 문구 */
export const NOT_FOUND_MESSAGE = "대상을 찾을 수 없습니다.";

type ErrorKind = "network" | "server" | "auth" | "config" | "client";

// 서버 Route Handler가 보내는 고정 메시지의 접두어로 5xx 원인을 구분
const AUTH_PREFIX = "서버 인증에 실패";
const CONFIG_PREFIX = "서버 설정 오류";
const UNREACHABLE_HINTS = ["연결할 수 없습니다", "지연"];

const classify = (error: ApiError): ErrorKind => {
  if (error.status === 0) return "network";
  if (error.status < 500) return "client";
  if (error.message.startsWith(AUTH_PREFIX)) return "auth";
  if (error.message.startsWith(CONFIG_PREFIX)) return "config";
  if (UNREACHABLE_HINTS.some((hint) => error.message.includes(hint))) return "network";

  return "server";
};

const MESSAGES: Record<ErrorContext, Record<Exclude<ErrorKind, "client">, string>> & {
  fallback: Record<ErrorContext, string>;
} = {
  list: {
    network: "서버에 연결할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.",
    server: "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
    auth: "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
    config: "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
  },
  write: {
    network: "서버에 연결할 수 없습니다. 입력한 내용은 유지됩니다. 잠시 후 다시 시도해주세요.",
    server: "서버에 문제가 발생했습니다. 입력한 내용은 유지됩니다. 잠시 후 다시 시도해주세요.",
    auth: "서버 인증에 실패했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해주세요.",
    config: "서버 설정이 올바르지 않아 저장할 수 없습니다. 관리자에게 문의해주세요.",
  },
  delete: {
    network: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
    server: "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
    auth: "서버 인증에 실패했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해주세요.",
    config: "서버 설정이 올바르지 않아 삭제할 수 없습니다. 관리자에게 문의해주세요.",
  },
  fallback: {
    list: "목록을 불러오지 못했습니다.",
    write: "저장하지 못했습니다. 입력 내용을 확인해주세요.",
    delete: "삭제하지 못했습니다.",
  },
};

/** 오류 원인별 사용자 문구, 서버 메시지가 있는 4xx와 사전 검사 오류는 메시지 그대로 반환 */
export const getErrorMessage = (error: unknown, context: ErrorContext): string => {
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message ? error.message : MESSAGES.fallback[context];
  }

  const kind = classify(error);

  if (kind !== "client") return MESSAGES[context][kind];

  return error.message === DEFAULT_ERROR_MESSAGE ? MESSAGES.fallback[context] : error.message;
};

/** 서버가 대상 도시를 찾지 못했음을 알린 오류인지 */
export const isNotFoundError = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 404;
