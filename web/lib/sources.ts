export const SOURCE_LABELS: Record<string, string> = {
  apartments_com: "Apartments.com",
  chicago_apartment_finders: "ChicagoApartmentFinders",
  chicago_rentals: "ChicagoRentals",
  craigslist: "Craigslist",
  domu: "Domu",
  seattle_rentals: "SeattleRentals",
  urban_abodes: "UrbanAbodes",
};

export const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  ...Object.entries(SOURCE_LABELS)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label)),
];

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function titleCase(value: string): string {
  return value
    .split(/([\s-]+)/)
    .map((part) =>
      /^[\s-]+$/.test(part)
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join("");
}
