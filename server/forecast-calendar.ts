// Calendar arithmetic is independent of the server timezone and DST.
function calendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0); date.setUTCFullYear(year, month, day); return date;
}
export const parseLocalDate = (date: string) => new Date(`${date}T00:00:00.000Z`);
export const todayLocalISO = (date: Date) => date.toISOString().slice(0, 10);
export const startOfDay = (date: Date) => calendarDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
export const startOfMonth = (date: Date) => calendarDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
export const endOfMonth = (date: Date) => calendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
export function addDays(date: Date, days: number): Date { const result = new Date(date); result.setUTCDate(result.getUTCDate() + days); return result; }
export const subDays = (date: Date, days: number) => addDays(date, -days);
export function addMonths(date: Date, months: number): Date {
  const first = calendarDate(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
  first.setUTCDate(Math.min(date.getUTCDate(), endOfMonth(first).getUTCDate()));
  return first;
}
export const differenceInCalendarDays = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
export const differenceInCalendarMonths = (a: Date, b: Date) => (a.getUTCFullYear() - b.getUTCFullYear()) * 12 + a.getUTCMonth() - b.getUTCMonth();
