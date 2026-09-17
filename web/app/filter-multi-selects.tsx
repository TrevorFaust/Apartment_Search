"use client";

import type { NeighborhoodOption } from "@/lib/neighborhoods";
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
      options={options}
      selected={selected}
      emptyLabel="Any city"
    />
  );
}
