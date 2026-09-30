"use client";

import type { NeighborhoodOption } from "@/lib/neighborhoods";
import { titleCase } from "@/lib/sources";
import { MultiSelectFilter } from "./multi-select-filter";

export function NeighborhoodMultiSelect({
  options,
  selected,
}: {
  options: NeighborhoodOption[];
  selected: string[];
}) {
  return (
    <MultiSelectFilter
      name="neighborhood"
      label="Neighborhoods"
      options={options}
      selected={selected}
      emptyLabel="Any neighborhood"
      clearSubmits
      searchable
    />
  );
}

export function CityMultiSelect({
  options,
  selected,
}: {
  options: string[];
  selected: string[];
}) {
  return (
    <MultiSelectFilter
      name="city"
      label="City"
      options={options.map((city) => ({ value: city, label: titleCase(city) }))}
      selected={selected}
      emptyLabel="Any city"
      clearSubmits
    />
  );
}
