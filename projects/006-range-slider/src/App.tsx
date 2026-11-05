import { useMemo, useState } from "react";
import { RangeSlider, type Range } from "./RangeSlider";

interface Stay {
  id: number;
  name: string;
  price: number;
}

/** Small deterministic PRNG so the demo data is the same on every load. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLACES = ["Loft", "Cabin", "Studio", "Villa", "Flat", "Cottage", "Suite", "Bungalow"];
const AREAS = ["Kadıköy", "Moda", "Cihangir", "Balat", "Bebek", "Karaköy", "Ortaköy", "Fener"];
const PRICE_MIN = 20;
const PRICE_MAX = 500;
const BINS = 24;

const STAYS: Stay[] = (() => {
  const rand = mulberry32(6);
  return Array.from({ length: 160 }, (_, id) => {
    // Skewed toward cheaper stays, like real listings.
    const price = Math.round(PRICE_MIN + (PRICE_MAX - PRICE_MIN) * rand() ** 2.2);
    const name = `${PLACES[id % PLACES.length]} in ${AREAS[Math.floor(rand() * AREAS.length)]}`;
    return { id, name, price };
  });
})();

const HISTOGRAM = (() => {
  const counts = new Array<number>(BINS).fill(0);
  const width = (PRICE_MAX - PRICE_MIN) / BINS;
  for (const { price } of STAYS) {
    counts[Math.min(BINS - 1, Math.floor((price - PRICE_MIN) / width))]++;
  }
  return { counts, width, peak: Math.max(...counts) };
})();

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatPrice = (n: number) => (n >= PRICE_MAX ? `${usd.format(n)}+` : usd.format(n));

const formatTime = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return minutes === 1440 ? "24:00" : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export function App() {
  const [price, setPrice] = useState<Range>([60, 240]);
  const [hours, setHours] = useState<Range>([9 * 60, 17 * 60]);

  const matches = useMemo(
    () => STAYS.filter((s) => s.price >= price[0] && s.price <= price[1]),
    [price],
  );

  const bars = HISTOGRAM.counts.map((count, i) => {
    const binStart = PRICE_MIN + i * HISTOGRAM.width;
    const inRange = binStart + HISTOGRAM.width > price[0] && binStart < price[1];
    return (
      <span
        key={i}
        className="bar"
        data-active={inRange || undefined}
        style={{ height: `${(count / HISTOGRAM.peak) * 100}%` }}
      />
    );
  });

  return (
    <main className="page">
      <header>
        <h1>Dual Range Slider</h1>
        <p className="lead">
          Two thumbs, one track. Drag, click the track, or use the keyboard: arrows, Page Up/Down,
          Home/End.
        </p>
      </header>

      <section className="card" aria-labelledby="stays-heading">
        <h2 id="stays-heading">Nightly price</h2>
        <RangeSlider
          label="Price per night"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={5}
          minGap={20}
          value={price}
          onChange={setPrice}
          formatValue={formatPrice}
          thumbLabels={["Minimum price", "Maximum price"]}
          background={<div className="histogram">{bars}</div>}
        />
        <p className="count" role="status">
          {matches.length} of {STAYS.length} stays
        </p>
        <ul className="stays">
          {matches.slice(0, 6).map((s) => (
            <li key={s.id}>
              <span>{s.name}</span>
              <strong>{usd.format(s.price)}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="hours-heading">
        <h2 id="hours-heading">Quiet hours</h2>
        <RangeSlider
          label="Do not disturb between"
          min={0}
          max={24 * 60}
          step={15}
          largeStep={60}
          minGap={60}
          value={hours}
          onChange={setHours}
          formatValue={formatTime}
          thumbLabels={["Start time", "End time"]}
        />
        <p className="count">
          {((hours[1] - hours[0]) / 60).toLocaleString("en-US", { maximumFractionDigits: 2 })} hours
          of focus. Minimum gap is one hour; Page Up/Down moves by an hour.
        </p>
      </section>

      <section className="card">
        <h2>Disabled</h2>
        <RangeSlider label="Locked range" min={0} max={100} value={[25, 75]} onChange={() => {}} disabled />
      </section>
    </main>
  );
}
