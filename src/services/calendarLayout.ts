import type { Session } from '../data';

export type CalendarSlot = { lane: number; lanes: number };

const startOf = (session: Session) => {
  const [hour, minute] = session.time.split(':').map(Number);
  return hour * 60 + minute;
};

/**
 * Places a day's sessions side by side when they overlap. Each session gets a lane, and every session in a group of
 * overlapping sessions shares the same lane count, so cards in that group split the column evenly.
 * `minMinutes` is the shortest height a card is drawn at, so short sessions that look overlapping are treated as such.
 */
export function layoutDay(sessions: Session[], minMinutes = 30): Map<number, CalendarSlot> {
  const slots = new Map<number, CalendarSlot>();
  const sorted = [...sessions].sort((a, b) => startOf(a) - startOf(b) || a.id - b.id);
  let group: { id: number; lane: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const closeGroup = () => {
    group.forEach(({ id, lane }) => slots.set(id, { lane, lanes: laneEnds.length }));
    group = [];
    laneEnds = [];
  };
  sorted.forEach((session) => {
    const start = startOf(session);
    const end = start + Math.max(session.minutes, minMinutes);
    if (start >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.push(end) - 1;
    else laneEnds[lane] = end;
    group.push({ id: session.id, lane });
    groupEnd = Math.max(groupEnd, end);
  });
  closeGroup();
  return slots;
}
