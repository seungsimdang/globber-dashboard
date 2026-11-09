import { ALPHA3_CODES, toAlpha2 } from "@/utils/countryFlagMapping";

export type CountryOption = {
  /** ISO alpha-3 대문자 */
  code: string;
  /** Intl 한국어 국가명 */
  name: string;
};

let cachedOptions: CountryOption[] | null = null;

/** alpha-3 표와 Intl 한국어 국가명으로 만든 가나다순 목록, Intl이 코드 자체를 돌려주는 항목은 제외 */
export const getCountryOptions = (): CountryOption[] => {
  if (cachedOptions) return cachedOptions;

  const displayNames = new Intl.DisplayNames(["ko"], { type: "region" });
  const options: CountryOption[] = [];

  for (const code of ALPHA3_CODES) {
    const alpha2 = toAlpha2(code);
    const name = alpha2 ? displayNames.of(alpha2) : undefined;

    if (name && name !== alpha2 && name !== code) options.push({ code, name });
  }

  cachedOptions = options.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return cachedOptions;
};

/** alpha-3 코드(대소문자 무관)에 해당하는 목록 항목, 목록에 없으면 undefined */
export const findCountryByCode = (code: string): CountryOption | undefined => {
  const upper = code.trim().toUpperCase();

  return getCountryOptions().find((option) => option.code === upper);
};

/** 국가명(공백 무시) 또는 코드(대소문자 무시) 부분 일치 필터, 빈 검색어는 전체 목록 */
export const filterCountries = (query: string): CountryOption[] => {
  const options = getCountryOptions();
  const keyword = query.replace(/\s/g, "").toLowerCase();

  if (!keyword) return options;

  return options.filter(
    (option) =>
      option.name.replace(/\s/g, "").toLowerCase().includes(keyword) ||
      option.code.toLowerCase().includes(keyword),
  );
};
