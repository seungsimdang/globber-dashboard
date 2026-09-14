"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/common/Button";
import { LogoutButton } from "@/components/common/LogoutButton";
import { CityFormModal, type CityFormMode } from "@/components/cities/CityFormModal";
import { CityListTable } from "@/components/cities/CityListTable";
import { DeleteConfirmDialog } from "@/components/cities/DeleteConfirmDialog";
import { SearchInput } from "@/components/cities/SearchInput";
import { useCities } from "@/hooks/useCities";
import type { City } from "@/types/city";

type FormModalState = {
  mode: CityFormMode;
  city: City | null;
};

/**
 * 도시 관리 대시보드 메인 화면(design-spec.md §1). 목록/검색/추가/수정/삭제를 한 화면에서
 * 조합한다. SSR prefetch가 없는 내부 도구이므로 페이지 전체를 클라이언트 컴포넌트로 둔다.
 * 라우트 인증 가드는 src/proxy.ts에서 처리한다.
 */
export const CitiesPageContent = () => {
  const [keyword, setKeyword] = useState("");
  const [formModal, setFormModal] = useState<FormModalState | null>(null);
  const [cityToDelete, setCityToDelete] = useState<City | null>(null);

  const { data: cities = [], isLoading, isError, error, refetch } = useCities(keyword);

  const openAddModal = () => setFormModal({ mode: "create", city: null });
  const openEditModal = (city: City) => setFormModal({ mode: "edit", city });
  const closeFormModal = (open: boolean) => {
    if (!open) setFormModal(null);
  };
  const closeDeleteDialog = (open: boolean) => {
    if (!open) setCityToDelete(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">도시 관리</h1>
        <div className="flex items-center gap-2">
          <Button onClick={openAddModal}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            도시 추가
          </Button>
          <LogoutButton />
        </div>
      </header>

      <SearchInput onSearch={setKeyword} />

      <CityListTable
        cities={cities}
        keyword={keyword}
        isLoading={isLoading}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
        onAddCity={openAddModal}
        onEditCity={openEditModal}
        onDeleteCity={setCityToDelete}
      />

      <CityFormModal
        open={formModal !== null}
        mode={formModal?.mode ?? "create"}
        city={formModal?.city}
        onOpenChange={closeFormModal}
      />

      <DeleteConfirmDialog city={cityToDelete} onOpenChange={closeDeleteDialog} />
    </div>
  );
};
