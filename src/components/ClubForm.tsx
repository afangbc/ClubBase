import { useState } from "react";
import { SelectField, TextArea, TextField } from "@/components/form-fields";
import { ScheduleField } from "@/components/ScheduleField";
import {
  CATEGORIES,
  defaultSchedule,
  type ClubCategory,
  type MeetingSchedule,
  type StaffAccount,
} from "@/lib/campus-data";
import type { ClubInput } from "@/lib/session";

/**
 * One form for both consoles. Admins get a sponsor picker; a teacher is always
 * the sponsor of what they create, so `sponsors` is omitted for them.
 */
export function ClubForm({
  initial,
  sponsors,
  submitLabel,
  onSubmit,
  onCancel,
  rooms,
}: {
  initial?: Partial<ClubInput>;
  sponsors?: StaffAccount[];
  submitLabel: string;
  onSubmit: (input: ClubInput) => Promise<string | null>;
  onCancel?: () => void;
  /** Rooms already in use on campus, offered as autocomplete. */
  rooms?: string[];
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<ClubCategory>(initial?.category ?? "Academic");
  const [visibility, setVisibility] = useState<"public" | "private">(
    initial?.visibility ?? "public",
  );
  const [sponsorId, setSponsorId] = useState(initial?.sponsorId ?? sponsors?.[0]?.id ?? "");
  const [schedule, setSchedule] = useState<MeetingSchedule>(initial?.schedule ?? defaultSchedule);
  const [room, setRoom] = useState(initial?.room ?? "");
  const [blurb, setBlurb] = useState(initial?.blurb ?? "");
  const [logo, setLogo] = useState(initial?.logo ?? "");
  const [logoError, setLogoError] = useState("");
  const [instructions, setInstructions] = useState(initial?.joinInstructions ?? "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setSaved(false);
        const problem = await onSubmit({
          name,
          category,
          visibility,
          room,
          schedule,
          blurb,
          logo,
          joinInstructions: instructions,
          // Teachers never submit this field. Its presence means an admin
          // deliberately used the sponsor picker.
          ...(sponsors ? { sponsorId } : {}),
        });
        setBusy(false);
        setError(problem ?? "");
        if (!problem) setSaved(true);
      }}
    >
      <TextField label="Club name" value={name} onChange={setName} placeholder="Science Olympiad" />
      <SelectField
        label="Category"
        value={category}
        onChange={setCategory}
        options={CATEGORIES.map((c) => ({ value: c, label: c }))}
      />
      {sponsors && (
        <SelectField
          label="Sponsor"
          value={sponsorId}
          onChange={setSponsorId}
          options={sponsors.map((s) => ({ value: s.id, label: `${s.name} · ${s.email}` }))}
        />
      )}
      <SelectField
        label="Who can join"
        value={visibility}
        onChange={setVisibility}
        options={[
          { value: "public" as const, label: "Public — students join instantly" },
          { value: "private" as const, label: "Private — the sponsor approves each member" },
        ]}
      />
      <ScheduleField value={schedule} onChange={setSchedule} />
      <div className="self-start">
        <TextField
          label="Room"
          value={room}
          onChange={setRoom}
          placeholder="C-214"
          {...(rooms?.length ? { suggestions: rooms } : {})}
        />
      </div>
      <div className="md:col-span-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Club logo (optional)
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-3 rounded-md border border-input bg-secondary/40 p-3">
            {logo ? (
              <img src={logo} alt="Club logo preview" className="size-16 rounded-lg bg-card object-contain p-1 shadow-sm" />
            ) : (
              <span className="grid size-16 place-items-center rounded-lg border border-dashed border-input bg-card text-xs text-muted-foreground">
                No logo
              </span>
            )}
            <div className="flex-1">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/x-png,image/jpeg,image/webp,image/gif"
                className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const extension = file.name.split(".").pop()?.toLowerCase();
                  const mimeByExtension: Record<string, string> = {
                    png: "image/png",
                    jpg: "image/jpeg",
                    jpeg: "image/jpeg",
                    webp: "image/webp",
                    gif: "image/gif",
                  };
                  const supportedType = ["image/png", "image/x-png", "image/jpeg", "image/webp", "image/gif"].includes(file.type);
                  const supportedExtension = ["png", "jpg", "jpeg", "webp", "gif"].includes(extension ?? "");
                  if (!supportedType && !supportedExtension) {
                    setLogoError("Choose a PNG, JPEG, WebP, or GIF image.");
                    return;
                  }
                  if (file.size > 330_000) {
                    setLogoError("Choose an image smaller than 330 KB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = typeof reader.result === "string" ? reader.result : "";
                    const mime = file.type === "image/x-png" ? "image/png" : file.type || mimeByExtension[extension ?? ""];
                    setLogo(mime ? result.replace(/^data:[^;]+;/i, `data:${mime};`) : result);
                    setLogoError("");
                  };
                  reader.onerror = () => setLogoError("That image could not be read.");
                  reader.readAsDataURL(file);
                }}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Square images work best. Maximum 330 KB.</p>
              {logo && (
                <button type="button" onClick={() => setLogo("")} className="mt-1 text-xs font-semibold text-destructive hover:underline">
                  Remove logo
                </button>
              )}
            </div>
          </div>
          {logoError && <span className="mt-1 block text-xs text-destructive">{logoError}</span>}
        </label>
      </div>
      <div className="md:col-span-2">
        <TextArea
          label="Description"
          value={blurb}
          onChange={setBlurb}
          placeholder="What the club does and who it's for."
        />
      </div>
      {visibility === "private" && (
        <div className="md:col-span-2">
          <TextArea
            label="How to join"
            value={instructions}
            onChange={setInstructions}
            placeholder="Exactly what a student has to do before a sponsor will approve them."
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 md:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-input px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            Cancel
          </button>
        )}
        {saved && <span className="text-sm text-success">Saved — students see this now.</span>}
      </div>
    </form>
  );
}
