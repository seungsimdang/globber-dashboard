/**
 * ISO 3166-1 alpha-2 국가코드 → 국기 이모지 매핑.
 *
 * 원본 저장소(17th-team1-client)의 `COUNTRY_CODE_TO_FLAG` 전체 테이블을 그대로 옮기지 않고,
 * 이 대시보드의 목업 시드 데이터와 자주 쓰이는 주요 국가만 축소해 담는다. 매핑에 없는
 * 국가코드는 기본 아이콘(흰 깃발)으로 대체하며, 이 경우에도 도시 등록/수정 자체는 막지 않는다.
 */
const COUNTRY_CODE_TO_FLAG: Record<string, string> = {
  KR: "🇰🇷",
  US: "🇺🇸",
  JP: "🇯🇵",
  CN: "🇨🇳",
  GB: "🇬🇧",
  FR: "🇫🇷",
  DE: "🇩🇪",
  IT: "🇮🇹",
  ES: "🇪🇸",
  CA: "🇨🇦",
  AU: "🇦🇺",
  BR: "🇧🇷",
  IN: "🇮🇳",
  RU: "🇷🇺",
  MX: "🇲🇽",
  NL: "🇳🇱",
  CH: "🇨🇭",
  SE: "🇸🇪",
  NO: "🇳🇴",
  FI: "🇫🇮",
  DK: "🇩🇰",
  PT: "🇵🇹",
  GR: "🇬🇷",
  TR: "🇹🇷",
  TH: "🇹🇭",
  VN: "🇻🇳",
  SG: "🇸🇬",
  ID: "🇮🇩",
  PH: "🇵🇭",
  AE: "🇦🇪",
};

/** 매핑에 없는 국가코드일 때 사용하는 기본 아이콘(흰 깃발). */
const FALLBACK_FLAG = "🏳️";

/**
 * 국가코드를 국기 이모지로 변환한다. 매핑에 없으면 fallback을 반환한다.
 *
 * @param countryCode - ISO 3166-1 alpha-2 형식의 국가코드(대소문자 무관)
 * @returns 국기 이모지 문자열, 매핑 실패 시 기본 아이콘
 * @example
 * const flag = getCountryFlag("kr"); // "🇰🇷"
 * const unknown = getCountryFlag("ZZ"); // "🏳️" (fallback)
 */
export const getCountryFlag = (countryCode: string): string => {
  const normalized = countryCode.trim().toUpperCase();

  return COUNTRY_CODE_TO_FLAG[normalized] ?? FALLBACK_FLAG;
};
