import type { CityServer } from "@/types/city";

export const queryKeys = {
  cities: {
    all: ["cities"] as const,
    list: (server: CityServer) => ["cities", "list", server] as const,
  },
};
