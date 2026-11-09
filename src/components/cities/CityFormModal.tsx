"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { Info, MapPin } from "lucide-react";
import { CountryCombobox } from "@/components/cities/CountryCombobox";
import { Button } from "@/components/common/Button";
import { Dialog } from "@/components/common/Dialog";
import { Input } from "@/components/common/Input";
import { Label } from "@/components/common/Label";
import { useToast } from "@/components/common/Toast";
import {
  DUPLICATE_CITY_MESSAGE,
  useAddCityMutation,
  useUpdateCityMutation,
} from "@/hooks/useCityMutations";
import { useGeocode } from "@/hooks/useGeocode";
import type { City, CityServer, GeocodeCandidate } from "@/types/city";
import {
  NOT_FOUND_MESSAGE,
  geocodeMessages,
  getErrorMessage,
  isNotFoundError,
  serverMessages,
} from "@/utils/cityErrorMessage";
import { type CountryOption, findCountryByCode } from "@/utils/countryOptions";

export type CityFormMode = "create" | "edit";

type CityFormModalProps = {
  server: CityServer;
  open: boolean;
  mode: CityFormMode;
  /** mode === 'edit'일 때 수정 대상 도시. 모달이 열리는 시점에만 폼 초기값으로 반영한다. */
  city?: City | null;
  onOpenChange: (open: boolean) => void;
};

type FormValues = {
  cityName: string;
  country: CountryOption | null;
  lat: string;
  lng: string;
};

type TextField = "cityName" | "lat" | "lng";

type FieldErrors = Partial<Record<keyof FormValues, string>>;

const EMPTY_FORM: FormValues = {
  cityName: "",
  country: null,
  lat: "",
  lng: "",
};

const toFormValues = (city: City): FormValues => ({
  cityName: city.name,
  country: findCountryByCode(city.countryCode) ?? null,
  lat: String(city.lat),
  lng: String(city.lng),
});

const GEOCODE_COOLDOWN_MS = 1000;
const MAX_CANDIDATES = 5;
const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";

/** 필드별 유효성 검사 규칙. 제출 시점에 전체 필드를 한 번에 검사한다. */
const validate = (values: FormValues): FieldErrors => {
  const errors: FieldErrors = {};

  if (!values.cityName.trim()) {
    errors.cityName = "도시명을 입력해주세요";
  }

  if (!values.country) {
    errors.country = geocodeMessages.countryRequired;
  }

  const lat = Number(values.lat);
  if (values.lat.trim() === "" || Number.isNaN(lat) || lat < -90 || lat > 90) {
    errors.lat = "위도는 -90~90 사이의 숫자여야 합니다";
  }

  const lng = Number(values.lng);
  if (values.lng.trim() === "" || Number.isNaN(lng) || lng < -180 || lng > 180) {
    errors.lng = "경도는 -180~180 사이의 숫자여야 합니다";
  }

  return errors;
};

/**
 * 도시 추가/수정 겸용 모달. `mode`에 따라 제목/제출 버튼 문구와 초기값이 달라진다.
 * 필드 검증 실패는 인라인 에러로, 중복 도시와 서버 오류는 폼 상단 배너로 표시한다.
 * 수정 대상이 이미 사라진 경우(대상 없음)는 폼을 닫고 Toast로만 안내한다.
 */
export const CityFormModal = ({ server, open, mode, city, onOpenChange }: CityFormModalProps) => {
  const { showToast } = useToast();
  const messages = serverMessages(server);
  const addCityMutation = useAddCityMutation(server);
  const updateCityMutation = useUpdateCityMutation(server);

  // 처음부터 open=true로 마운트돼도 edit 모드 초기값을 채움
  const [values, setValues] = useState<FormValues>(() =>
    open && mode === "edit" && city ? toFormValues(city) : EMPTY_FORM,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const cityNameInputRef = useRef<HTMLInputElement>(null);
  const latInputRef = useRef<HTMLInputElement>(null);
  const countryListOpenRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocode = useGeocode();
  const resetGeocode = geocode.reset;
  const [pickedLocation, setPickedLocation] = useState<string | null>(null);
  const [cooling, setCooling] = useState(false);

  // 열림 시점에만 폼 상태를 초기화한다(react-query.md 규칙 7). effect 대신 렌더 중
  // "이전 open 값과 비교해 바뀌었으면 즉시 재계산"하는 React 공식 패턴을 사용해
  // 불필요한 커밋 후 재렌더링을 피한다.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setValues(mode === "edit" && city ? toFormValues(city) : EMPTY_FORM);
      setErrors({});
      setFormError(null);
      setPickedLocation(null);
      setCooling(false);
    }
  }

  // 닫힌 뒤 도착하는 위치 응답은 결과 상태를 비워 무시
  useEffect(() => {
    if (!open) resetGeocode();
  }, [open, resetGeocode]);

  useEffect(
    () => () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    },
    [],
  );

  const isSubmitting = addCityMutation.isPending || updateCityMutation.isPending;
  const isDuplicateError = formError === DUPLICATE_CITY_MESSAGE;

  const clearGeocode = () => {
    resetGeocode();
    setPickedLocation(null);
  };

  const handleChange =
    (field: TextField) => (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      const nextValues = { ...values, [field]: nextValue };
      setValues(nextValues);
      if (field === "cityName") clearGeocode();
      setErrors((current) => {
        if (!current[field]) return current;
        const fieldError = validate(nextValues)[field];
        const next = { ...current };
        if (fieldError) {
          next[field] = fieldError;
        } else {
          delete next[field];
        }
        return next;
      });
    };

  const handleBlur = (field: keyof FormValues) => () => {
    const fieldErrors = validate(values);
    setErrors((current) => ({ ...current, [field]: fieldErrors[field] }));
  };

  const handleCountrySelect = (country: CountryOption | null) => {
    if (country?.code === values.country?.code) return;

    setValues((current) => ({ ...current, country }));
    setErrors((current) => ({ ...current, country: undefined }));
    clearGeocode();
  };

  const handleFindLocation = () => {
    if (!values.country || !values.cityName.trim()) return;

    setPickedLocation(null);
    setCooling(true);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => setCooling(false), GEOCODE_COOLDOWN_MS);
    geocode.mutate({ city: values.cityName.trim(), country: values.country.code });
  };

  const handlePickCandidate = (candidate: GeocodeCandidate) => {
    setValues((current) => ({ ...current, lat: String(candidate.lat), lng: String(candidate.lng) }));
    setErrors((current) => ({ ...current, lat: undefined, lng: undefined }));
    setPickedLocation(candidate.displayName);
    latInputRef.current?.focus();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validate(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const { country } = values;
    if (!country) return;

    setFormError(null);
    clearGeocode();

    const params = {
      cityName: values.cityName.trim(),
      countryName: country.name,
      countryCode: country.code,
      lat: Number(values.lat),
      lng: Number(values.lng),
    };

    if (mode === "create") {
      addCityMutation.mutate(params, {
        onSuccess: () => {
          showToast({ title: messages.added, variant: "success" });
          onOpenChange(false);
        },
        onError: (error: Error) => {
          setFormError(getErrorMessage(error, "write"));
        },
      });
      return;
    }

    if (!city) return;

    updateCityMutation.mutate(
      { cityId: city.id, params },
      {
        onSuccess: () => {
          showToast({ title: messages.updated, variant: "success" });
          onOpenChange(false);
        },
        onError: (error: Error) => {
          if (isNotFoundError(error)) {
            showToast({ title: NOT_FOUND_MESSAGE, variant: "error" });
            onOpenChange(false);
            return;
          }
          setFormError(getErrorMessage(error, "write"));
        },
      },
    );
  };

  const unlistedCode =
    mode === "edit" && city && !values.country && !findCountryByCode(city.countryCode) ? city.countryCode : null;
  const needsCity = !values.cityName.trim();
  const needsCountry = !values.country;
  const findDisabled = needsCity || needsCountry || geocode.isPending || cooling || isSubmitting;
  const candidates = geocode.data?.slice(0, MAX_CANDIDATES) ?? [];
  const findGuide = needsCity
    ? geocodeMessages.needCity
    : needsCountry
      ? geocodeMessages.needCountry
      : geocodeMessages.hint;
  const showAttribution = pickedLocation !== null || (geocode.isSuccess && candidates.length > 0);

  return (
    <Dialog
      open={open}
      className="max-w-lg"
      onOpenChange={(next) => {
        // 국가 목록이 열려 있을 때 Esc는 목록만 닫음
        if (!next && countryListOpenRef.current) return;
        if (!isSubmitting) onOpenChange(next);
      }}
      title={`${messages.titlePrefix}${mode === "create" ? "도시 추가" : "도시 수정"}`}
      initialFocusRef={cityNameInputRef}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {formError}
          </div>
        ) : null}

        <div>
          <Label htmlFor="cityName" required>
            도시명
          </Label>
          <Input
            id="cityName"
            ref={cityNameInputRef}
            value={values.cityName}
            onChange={handleChange("cityName")}
            onBlur={handleBlur("cityName")}
            hasError={Boolean(errors.cityName) || isDuplicateError}
            aria-describedby={errors.cityName ? "cityName-error" : undefined}
          />
          {errors.cityName ? (
            <p id="cityName-error" className="mt-1 text-sm text-red-600">
              {errors.cityName}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="countryName" required>
            국가명
          </Label>
          <CountryCombobox
            id="countryName"
            selected={values.country}
            onSelect={handleCountrySelect}
            onListOpenChange={(listOpen) => {
              countryListOpenRef.current = listOpen;
            }}
            hasError={Boolean(errors.country)}
            errorId={errors.country ? "countryName-error" : undefined}
          />
          {errors.country ? (
            <p id="countryName-error" className="mt-1 text-sm text-red-600">
              {errors.country}
            </p>
          ) : null}
          {values.country ? (
            <p className="mt-1 text-sm text-gray-500">
              국가코드 <span className="font-medium text-gray-900">{values.country.code}</span>
            </p>
          ) : null}
          {unlistedCode ? (
            <p className="mt-1 flex items-center gap-1 text-sm text-amber-800">
              <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
              {geocodeMessages.unlistedCountry(unlistedCode)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={geocode.isPending}
              disabled={findDisabled}
              aria-describedby="geocode-guide"
              onClick={handleFindLocation}
            >
              {geocode.isPending ? null : <MapPin className="h-4 w-4" aria-hidden="true" />}
              {geocode.isPending ? "찾는 중..." : "위치 찾기"}
            </Button>
            <p id="geocode-guide" className="text-sm text-gray-500">
              {findGuide}
            </p>
          </div>

          <div aria-live="polite">
            {geocode.isError ? (
              <p role="alert" className="flex items-center gap-1 text-sm text-red-700">
                <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                {geocodeMessages.failed}
              </p>
            ) : null}
            {geocode.isSuccess && candidates.length === 0 ? (
              <p className="flex items-center gap-1 text-sm text-gray-600">
                <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                {geocodeMessages.empty}
              </p>
            ) : null}
            {pickedLocation !== null ? (
              <p className="text-sm text-gray-700">{geocodeMessages.selected(pickedLocation)}</p>
            ) : null}
            {geocode.isSuccess && candidates.length > 0 && pickedLocation === null ? (
              <ul className="flex flex-col gap-1">
                {candidates.map((candidate, index) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => handlePickCandidate(candidate)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <span className="block truncate text-sm font-medium text-gray-900" title={candidate.displayName}>
                        {index + 1}. {candidate.displayName}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {[candidate.region, `${candidate.lat.toFixed(4)}, ${candidate.lng.toFixed(4)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {showAttribution ? (
            <p className="text-xs text-gray-500">
              {geocodeMessages.attributionPrefix}
              <a
                href={OSM_COPYRIGHT_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={geocodeMessages.attributionLinkLabel}
                className="underline hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {geocodeMessages.attributionLinkText}
              </a>
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="lat" required>
              위도
            </Label>
            <Input
              id="lat"
              ref={latInputRef}
              inputMode="decimal"
              value={values.lat}
              onChange={handleChange("lat")}
              onBlur={handleBlur("lat")}
              hasError={Boolean(errors.lat)}
              aria-describedby={errors.lat ? "lat-error" : undefined}
            />
            {errors.lat ? (
              <p id="lat-error" className="mt-1 text-sm text-red-600">
                {errors.lat}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="lng" required>
              경도
            </Label>
            <Input
              id="lng"
              inputMode="decimal"
              value={values.lng}
              onChange={handleChange("lng")}
              onBlur={handleBlur("lng")}
              hasError={Boolean(errors.lng)}
              aria-describedby={errors.lng ? "lng-error" : undefined}
            />
            {errors.lng ? (
              <p id="lng-error" className="mt-1 text-sm text-red-600">
                {errors.lng}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {mode === "create" ? "추가" : "저장"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
