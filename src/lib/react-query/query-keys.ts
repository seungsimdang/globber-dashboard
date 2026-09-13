export const queryKeys = {
  cities: {
    all: ["cities"] as const,
    list: (keyword: string) => ["cities", "list", keyword] as const,
  },
};
