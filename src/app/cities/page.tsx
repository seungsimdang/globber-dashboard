import type { Metadata } from "next";
import { CitiesPageContent } from "@/components/cities/CitiesPageContent";

export const metadata: Metadata = {
  title: "도시 관리 | Globber 관리자 대시보드",
};

const CitiesPage = () => {
  return <CitiesPageContent />;
};

export default CitiesPage;
