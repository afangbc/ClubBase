import type { ReactNode } from "react";

const control =
  "mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25";

function Label({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  /** Rooms already used on campus, offered as autocomplete without limiting input. */
  suggestions?: string[];
}) {
  const listId = suggestions?.length
    ? `${label.replace(/\W+/g, "-").toLowerCase()}-options`
    : undefined;
  return (
    <Label label={label}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        list={listId}
        onChange={(e) => onChange(e.target.value)}
        className={control}
      />
      {listId && (
        <datalist id={listId}>
          {suggestions?.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </Label>
  );
}

const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/**
 * A wall-clock time on a 24-hour "HH:MM" value. Same shape as the club schedule
 * picker: type the hour, pick the rest, so nobody is typing "4pm-ish" into a
 * field the calendar has to parse.
 */
export function ClockField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [rawHour, rawMinute] = value.split(":");
  const hour24 = Number(rawHour);
  const minute = Number(rawMinute);
  const safeHour = Number.isFinite(hour24) ? hour24 : 16;
  const safeMinute = Number.isFinite(minute) ? minute : 0;

  const twelve = safeHour % 12 === 0 ? 12 : safeHour % 12;
  const meridiem = safeHour < 12 ? "AM" : "PM";
  const minuteOptions = MINUTES.includes(safeMinute)
    ? MINUTES
    : [...MINUTES, safeMinute].sort((a, b) => a - b);

  const emit = (hour12: number, m: number, suffix: "AM" | "PM") => {
    const base = Math.min(12, Math.max(1, hour12)) % 12;
    const hour = suffix === "PM" ? base + 12 : base;
    onChange(`${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  return (
    <div className="min-w-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="mt-1 grid min-w-0 grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)] gap-1">
        <input
          type="number"
          min={1}
          max={12}
          aria-label={`${label} hour`}
          value={twelve}
          onChange={(e) => emit(Number(e.target.value), safeMinute, meridiem)}
          className="min-w-0 rounded-md border border-input bg-card px-1 py-2 text-center text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
        />
        <select
          aria-label={`${label} minute`}
          value={safeMinute}
          onChange={(e) => emit(twelve, Number(e.target.value), meridiem)}
          className="min-w-0 rounded-md border border-input bg-card px-1 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
        >
          {minuteOptions.map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, "0")}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} AM or PM`}
          value={meridiem}
          onChange={(e) => emit(twelve, safeMinute, e.target.value as "AM" | "PM")}
          className="min-w-0 rounded-md border border-input bg-card px-1 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <Label label={label}>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={control}
      />
    </Label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <Label label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={control}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Label>
  );
}
