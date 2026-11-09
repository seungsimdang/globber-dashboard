import { searchGeocode } from "@/lib/server/geocode";
import { withSession } from "@/lib/server/withSession";

// server 쿼리와 알 수 없는 쿼리는 무시하며 상류에 전달하지 않음
export const GET = withSession(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  return searchGeocode(searchParams.getAll("city"), searchParams.get("country"));
});
