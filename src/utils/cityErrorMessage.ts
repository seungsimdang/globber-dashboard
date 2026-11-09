import { ApiError, DEFAULT_ERROR_MESSAGE } from "@/lib/apiClient";
import type { CityServer } from "@/types/city";

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

/** 서버 표시 이름 */
export const SERVER_LABEL: Record<CityServer, string> = { prod: "운영", dev: "개발" };

/** 운영 서버 쓰기 불가 안내 문구 */
export const PROD_WRITE_NOTICE = "운영 서버는 쓰기 인증 준비 전이라 조회만 할 수 있습니다.";

/** 서버 이름이 붙은 화면 문구 */
export const serverMessages = (server: CityServer) => {
  const label = SERVER_LABEL[server];

  return {
    label,
    loading: `${label} 서버 목록을 불러오는 중...`,
    empty: `${label} 서버에 등록된 도시가 없습니다.`,
    searchEmpty: (keyword: string) => `${label} 서버에서 '${keyword}'에 대한 검색 결과가 없습니다.`,
    count: (shown: number, total: number, filtered: boolean) =>
      filtered
        ? `검색 결과 ${shown.toLocaleString("ko-KR")}개 / 전체 ${total.toLocaleString("ko-KR")}개`
        : `전체 ${total.toLocaleString("ko-KR")}개`,
    listConfigError: `${label} 서버 설정이 올바르지 않아 목록을 불러올 수 없습니다. 관리자에게 문의해주세요.`,
    added: `${label} 서버에 도시가 추가되었습니다`,
    updated: `${label} 서버의 도시가 수정되었습니다`,
    deleted: `${label} 서버에서 도시가 삭제되었습니다`,
    titlePrefix: `[${label}] `,
  };
};

/** 국가 선택과 위치 찾기 화면 문구 */
export const geocodeMessages = {
  empty: "검색 결과가 없습니다. 도시명을 확인하거나 위도·경도를 직접 입력해주세요.",
  // 네트워크·상류 오류·시간 초과·요청 제한은 원인별로 구분하지 않음
  failed: "위치를 찾지 못했습니다. 잠시 후 다시 시도하거나 위도·경도를 직접 입력해주세요.",
  selected: (name: string) => `선택한 위치: ${name}`,
  attributionPrefix: "© ",
  attributionLinkText: "OpenStreetMap 기여자",
  attributionLinkLabel: "OpenStreetMap 기여자 (새 창)",
  needCity: "도시명을 입력하면 위치를 찾을 수 있습니다.",
  needCountry: "국가를 선택하면 위치를 찾을 수 있습니다.",
  hint: "위치 찾기로 좌표를 채우거나 아래에 직접 입력할 수 있습니다.",
  unlistedCountry: (code: string) => `기존 국가코드 ${code}은(는) 목록에 없습니다. 국가를 다시 선택해주세요.`,
  noCountryMatch: "일치하는 국가가 없습니다.",
  countryCount: (count: number) => `${count}개 국가`,
  countryRequired: "국가를 목록에서 선택해주세요",
};

/** 목록 조회 오류 문구, 설정 오류는 서버 전용 문구이고 나머지는 앞에 서버 이름을 붙임 */
export const getListErrorMessage = (error: unknown, server: CityServer): string => {
  if (error instanceof ApiError && classify(error) === "config") {
    return serverMessages(server).listConfigError;
  }

  return `${SERVER_LABEL[server]} 서버: ${getErrorMessage(error, "list")}`;
};
