import { createContext, useContext, type ReactNode } from "react";
import type { Demo } from "../lib/demo";
const CatalogContext = createContext<Demo | null>(null);
export function CatalogProvider({
  state,
  children,
}: {
  state: Demo;
  children: ReactNode;
}) {
  return (
    <CatalogContext.Provider value={state}>{children}</CatalogContext.Provider>
  );
}
export function useCatalog() {
  const state = useContext(CatalogContext);
  if (!state) throw Error("CatalogProvider is required");
  const companies = state.companies.filter((c) => c.status === "active");
  const brands = companies.map((c) => c.name);
  return {
    companies,
    allCompanies: state.companies,
    brands,
    brandInfo: Object.fromEntries(state.companies.map((c) => [c.name, c])),
    bikes: state.catalogBikes.filter(
      (b) => !b.archived && brands.includes(b.brand),
    ),
    rewards: state.catalogRewards.filter(
      (r) => !r.archived && brands.includes(r.brand),
    ),
    allBikes: state.catalogBikes,
    allRewards: state.catalogRewards,
  };
}
