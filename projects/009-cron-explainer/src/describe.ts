import { MONTH_NAMES, WEEKDAY_NAMES, type Field, type Part, type Schedule } from "./cron";

const pad = (n: number) => String(n).padStart(2, "0");

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

interface Vocab {
  unit: string;
  name: (value: number) => string;
}

const VOCAB: Record<Field["name"], Vocab> = {
  minute: { unit: "minute", name: String },
  hour: { unit: "hour", name: (h) => `${pad(h)}:00` },
  dayOfMonth: { unit: "day", name: ordinal },
  month: { unit: "month", name: (m) => MONTH_NAMES[m - 1] },
  dayOfWeek: { unit: "day", name: (d) => WEEKDAY_NAMES[d % 7] },
};

function describePart(part: Part, vocab: Vocab): string {
  const { unit, name } = vocab;
  const every = part.step === 1 ? `every ${unit}` : `every ${part.step} ${unit}s`;

  if (part.star) return every;
  if (part.openEnded) return `${every} starting at ${name(part.start)}`;
  if (part.start === part.end) return name(part.start);
  if (part.step === 1) return `${name(part.start)} through ${name(part.end)}`;
  return `${every} from ${name(part.start)} through ${name(part.end)}`;
}

/** Human-readable text for a single field, used in the breakdown table. */
export function describeField(field: Field): string {
  if (field.any && field.parts.every((p) => p.step === 1)) return `every ${VOCAB[field.name].unit}`;
  return joinList(field.parts.map((p) => describePart(p, VOCAB[field.name])));
}

const isPlainValues = (field: Field) =>
  field.parts.every((p) => !p.star && p.start === p.end);

function describeTime({ minute, hour }: Schedule): string {
  // A handful of exact times reads best as a list of clock times.
  if (isPlainValues(minute) && isPlainValues(hour) && minute.values.length * hour.values.length <= 6) {
    const times = hour.values.flatMap((h) => minute.values.map((m) => `${pad(h)}:${pad(m)}`));
    return `At ${joinList(times)}`;
  }

  let text: string;
  if (minute.any) text = "Every minute";
  else if (minute.parts.some((p) => p.star || p.step > 1)) {
    const phrase = describeField(minute);
    text = phrase[0].toUpperCase() + phrase.slice(1);
  } else {
    const label = minute.values.length === 1 ? "minute" : "minutes";
    text = `At ${label} ${describeField(minute)}`;
  }

  if (hour.any) {
    return isPlainValues(minute) ? `${text} past every hour` : text;
  }
  if (isPlainValues(hour)) {
    const label = hour.values.length === 1 ? "hour" : "hours";
    return `${text} past ${label} ${joinList(hour.values.map(String))}`;
  }
  return `${text}, ${joinList(hour.parts.map(describeHourPart))}`;
}

function describeHourPart(part: Part): string {
  if (part.star) return `every ${part.step} hours`;
  if (part.start === part.end) return `during the ${pad(part.start)}:00 hour`;
  const range = `between ${pad(part.start)}:00 and ${pad(part.end)}:59`;
  return part.step === 1 ? range : `every ${part.step} hours ${range}`;
}

function describeDays({ dayOfMonth, dayOfWeek }: Schedule): string {
  const domStar = dayOfMonth.source.startsWith("*");
  const dowStar = dayOfWeek.source.startsWith("*");
  const domSimple = dayOfMonth.parts.every((p) => !p.star && p.step === 1);
  const dom = dayOfMonth.any
    ? ""
    : domSimple
      ? `on the ${describeField(dayOfMonth)} day of the month`
      : `${describeField(dayOfMonth)} of the month`;
  const dow = dayOfWeek.any ? "" : `on ${describeField(dayOfWeek)}`;

  if (dom && dow) return domStar || dowStar ? `${dom}, ${dow}` : `${dom} or ${dow}`;
  return dom || dow;
}

/** One sentence describing when the schedule fires. */
export function describeSchedule(schedule: Schedule): string {
  const pieces = [describeTime(schedule), describeDays(schedule)];
  if (!schedule.month.any) pieces.push(`in ${describeField(schedule.month)}`);
  return `${pieces.filter(Boolean).join(", ")}.`;
}
