"use client";

type Option = { value: string; label: string };

/** A select that applies its form as soon as the choice changes. */
export function AutoSubmitSelect({
  label,
  name,
  defaultValue,
  options,
  form,
  inline = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: readonly Option[];
  form?: string;
  inline?: boolean;
}) {
  return (
    <label
      className={`flex text-[10px] uppercase tracking-widest text-ink-soft ${
        inline ? "items-center gap-2" : "flex-col gap-1"
      }`}
    >
      {label}
      <select
        suppressHydrationWarning
        name={name}
        form={form}
        defaultValue={defaultValue}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="field-control normal-case tracking-normal"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
