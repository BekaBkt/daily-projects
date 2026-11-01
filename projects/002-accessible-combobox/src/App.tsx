import { useEffect, useMemo, useState } from "react";
import { Combobox } from "./Combobox";

interface Zone {
  id: string;
  label: string;
  offset: string;
}

function listZones(): Zone[] {
  const now = new Date();
  return Intl.supportedValuesOf("timeZone").map((id) => {
    const offset =
      new Intl.DateTimeFormat("en", { timeZone: id, timeZoneName: "shortOffset" })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value ?? "";
    return { id, label: id.replaceAll("_", " ").replaceAll("/", " / "), offset };
  });
}

const LANGUAGES: string[] = [
  "TypeScript", "JavaScript", "Rust", "Go", "Python", "Kotlin", "Swift",
  "Elixir", "Haskell", "OCaml", "Zig", "Ruby", "C#", "Java", "Scala", "Dart",
];

// Stable references keep the Combobox's filter memo warm across clock ticks.
const zoneLabel = (z: Zone) => z.label;
const zoneKey = (z: Zone) => z.id;
const identity = (s: string) => s;

function useClock(zone: string | undefined): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return new Intl.DateTimeFormat("en", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).format(now);
}

export function App() {
  const zones = useMemo(listZones, []);
  const [zone, setZone] = useState<Zone | null>(
    () => zones.find((z) => z.id === "Europe/Istanbul") ?? null,
  );
  const [language, setLanguage] = useState<string | null>(null);
  const clock = useClock(zone?.id);

  return (
    <main className="page">
      <header>
        <h1>Accessible Combobox</h1>
        <p className="lede">
          A generic, typed autocomplete following the WAI-ARIA 1.2 combobox
          pattern. Try it with only a keyboard or a screen reader.
        </p>
      </header>

      <section className="card">
        <Combobox
          label="Time zone"
          items={zones}
          value={zone}
          onChange={setZone}
          getLabel={zoneLabel}
          getKey={zoneKey}
          placeholder="Search 400+ zones, e.g. tokyo"
          renderOption={(z, label) => (
            <span className="zone-option">
              <span>{label}</span>
              <span className="zone-offset">{z.offset}</span>
            </span>
          )}
        />
        <p className="readout">
          {zone ? (
            <>
              <strong>{clock}</strong> in {zone.label} ({zone.offset})
            </>
          ) : (
            "No zone selected"
          )}
        </p>
      </section>

      <section className="card">
        <Combobox
          label="Favourite language"
          items={LANGUAGES}
          value={language}
          onChange={setLanguage}
          getLabel={identity}
          placeholder="Start typing…"
          emptyMessage="Nobody's perfect. No match."
        />
        <p className="readout">Selected: {language ?? "nothing yet"}</p>
      </section>

      <section className="card keys" aria-labelledby="keys-title">
        <h2 id="keys-title">Keyboard</h2>
        <dl>
          <dt><kbd>↓</kbd> / <kbd>↑</kbd></dt>
          <dd>Open the list, move through options (wraps)</dd>
          <dt><kbd>Alt</kbd> + <kbd>↓</kbd></dt>
          <dd>Open without moving the highlight</dd>
          <dt><kbd>Enter</kbd></dt>
          <dd>Choose the highlighted option</dd>
          <dt><kbd>Esc</kbd></dt>
          <dd>Close the list, press again to clear</dd>
        </dl>
      </section>
    </main>
  );
}
