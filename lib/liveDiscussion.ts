export type LiveDiscussion = {
  id: number;
  title: string;
  weekday: number; // PostgreSQL/JS convention: Sunday=0, Thursday=4
  start_time: string;
  timezone: string;
  zoom_url: string;
  active: boolean;
};

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

function offsetAt(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

function localDateTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let target = guess - offsetAt(new Date(guess), timeZone);
  // Re-check around daylight-saving boundaries.
  target = guess - offsetAt(new Date(target), timeZone);
  return new Date(target);
}

export function nextDiscussionDate(discussion: LiveDiscussion, now = new Date()) {
  const p = zonedParts(now, discussion.timezone);
  const [hour, minute] = discussion.start_time.split(':').map(Number);
  const currentLocalDay = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  let days = (discussion.weekday - currentLocalDay + 7) % 7;
  if (days === 0 && (p.hour > hour || (p.hour === hour && p.minute >= minute))) days = 7;
  const localTarget = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return localDateTimeToUtc(
    localTarget.getUTCFullYear(),
    localTarget.getUTCMonth() + 1,
    localTarget.getUTCDate(),
    hour,
    minute,
    discussion.timezone,
  );
}

export function countdownParts(target: Date, now = new Date()) {
  const total = Math.max(0, target.getTime() - now.getTime());
  const seconds = Math.floor(total / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}
