export const eventTime = (
  date: string | Date,
  timezone = "Asia/Kuala_Lumpur",
) =>
  new Intl.DateTimeFormat("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(date));
export const eventDate = (
  date: string | Date,
  timezone = "Asia/Kuala_Lumpur",
) =>
  new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(date));
export const stamp = (date: string | Date, timezone = "Asia/Kuala_Lumpur") =>
  `${eventDate(date, timezone)}, ${eventTime(date, timezone)} ${timezone}`;
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
export function serialize<T>(value: T): Serialized<T> {
  return JSON.parse(JSON.stringify(value));
}
