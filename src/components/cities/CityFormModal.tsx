"use client";

import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/common/Button";
import { Dialog } from "@/components/common/Dialog";
import { Input } from "@/components/common/Input";
import { Label } from "@/components/common/Label";
import { useToast } from "@/components/common/Toast";
import { useAddCityMutation, useUpdateCityMutation } from "@/hooks/useCityMutations";
import type { City } from "@/types/city";

export type CityFormMode = "create" | "edit";

type CityFormModalProps = {
  open: boolean;
  mode: CityFormMode;
  /** mode === 'edit'일 때 수정 대상 도시. 모달이 열리는 시점에만 폼 초기값으로 반영한다. */
  city?: City | null;
  onOpenChange: (open: boolean) => void;
};

type FormValues = {
  cityName: string;
  countryName: string;
  countryCode: string;
  lat: string;
  lng: string;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;

const EMPTY_FORM: FormValues = {
  cityName: "",
  countryName: "",
  countryCode: "",
  lat: "",
  lng: "",
};

const toFormValues = (city: City): FormValues => ({
  cityName: city.name,
  countryName: city.country,
  countryCode: city.countryCode,
  lat: String(city.lat),
  lng: String(city.lng),
});

const COUNTRY_CODE_PATTERN = /^[A-Za-z]{2}$/;
const NOT_FOUND_MESSAGE = "대상을 찾을 수 없습니다.";
const DUPLICATE_MESSAGE = "이미 등록된 도시입니다.";
const NAME_MAX_LENGTH = 100;

/** design-spec.md §4 필드별 유효성 검사 규칙. 제출 시점에 전체 필드를 한 번에 검사한다. */
const validate = (values: FormValues): FieldErrors => {
  const errors: FieldErrors = {};

  if (!values.cityName.trim()) {
    errors.cityName = "도시명을 입력해주세요";
  } else if (values.cityName.trim().length > NAME_MAX_LENGTH) {
    errors.cityName = `도시명은 ${NAME_MAX_LENGTH}자 이하여야 합니다`;
  }

  if (!values.countryName.trim()) {
    errors.countryName = "국가명을 입력해주세요";
  } else if (values.countryName.trim().length > NAME_MAX_LENGTH) {
    errors.countryName = `국가명은 ${NAME_MAX_LENGTH}자 이하여야 합니다`;
  }

  if (!COUNTRY_CODE_PATTERN.test(values.countryCode.trim())) {
    errors.countryCode = "국가코드는 영문 2자(예: KR)로 입력해주세요";
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
 * 필드 검증 실패는 인라인 에러로, 서버(목업) 측 중복 도시명 거부는 폼 상단 배너로 표시한다
 * (design-spec.md §4). 수정 대상이 이미 사라진 경우(대상 없음)는 폼을 닫고 Toast로만
 * 안내한다(design-spec.md §3.5).
 */
export const CityFormModal = ({ open, mode, city, onOpenChange }: CityFormModalProps) => {
  const { showToast } = useToast();
  const addCityMutation = useAddCityMutation();
  const updateCityMutation = useUpdateCityMutation();

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const cityNameInputRef = useRef<HTMLInputElement>(null);

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
    }
  }

  const isSubmitting = addCityMutation.isPending || updateCityMutation.isPending;
  const isDuplicateError = formError === DUPLICATE_MESSAGE;

  const handleChange =
    (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      const nextValues = { ...values, [field]: nextValue };
      setValues(nextValues);
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validate(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setFormError(null);

    const params = {
      cityName: values.cityName.trim(),
      countryName: values.countryName.trim(),
      countryCode: values.countryCode.trim().toUpperCase(),
      lat: Number(values.lat),
      lng: Number(values.lng),
    };

    if (mode === "create") {
      addCityMutation.mutate(params, {
        onSuccess: () => {
          showToast({ title: "도시가 추가되었습니다", variant: "success" });
          onOpenChange(false);
        },
        onError: (error: Error) => {
          setFormError(error.message);
        },
      });
      return;
    }

    if (!city) return;

    updateCityMutation.mutate(
      { cityId: city.id, params },
      {
        onSuccess: () => {
          showToast({ title: "도시가 수정되었습니다", variant: "success" });
          onOpenChange(false);
        },
        onError: (error: Error) => {
          if (error.message === NOT_FOUND_MESSAGE) {
            showToast({ title: error.message, variant: "error" });
            onOpenChange(false);
            return;
          }
          setFormError(error.message);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
      title={mode === "create" ? "도시 추가" : "도시 수정"}
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
            maxLength={NAME_MAX_LENGTH}
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
          <Input
            id="countryName"
            value={values.countryName}
            onChange={handleChange("countryName")}
            onBlur={handleBlur("countryName")}
            maxLength={NAME_MAX_LENGTH}
            hasError={Boolean(errors.countryName) || isDuplicateError}
            aria-describedby={errors.countryName ? "countryName-error" : undefined}
          />
          {errors.countryName ? (
            <p id="countryName-error" className="mt-1 text-sm text-red-600">
              {errors.countryName}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="countryCode" required>
            국가코드
          </Label>
          <Input
            id="countryCode"
            value={values.countryCode}
            onChange={handleChange("countryCode")}
            onBlur={handleBlur("countryCode")}
            maxLength={2}
            hasError={Boolean(errors.countryCode)}
            aria-describedby={errors.countryCode ? "countryCode-error" : undefined}
          />
          {errors.countryCode ? (
            <p id="countryCode-error" className="mt-1 text-sm text-red-600">
              {errors.countryCode}
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
