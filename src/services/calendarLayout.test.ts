import { describe, expect, it } from 'vitest';
import type { Session } from '../data';
import { layoutDay } from './calendarLayout';

const session = (id: number, time: string, minutes: number): Session => ({
  id,
  time,
  minutes,
  subject: 'Maths',
  topic: `Topic ${id}`,
  status: 'later',
  priority: 'Medium',
  tint: '#eee',
  objective: '',
});

describe('layoutDay', () => {
  it('gives sessions that do not overlap the full width', () => {
    const slots = layoutDay([session(1, '09:00', 45), session(2, '11:00', 35)]);
    expect(slots.get(1)).toEqual({ lane: 0, lanes: 1 });
    expect(slots.get(2)).toEqual({ lane: 0, lanes: 1 });
  });

  it('puts overlapping sessions side by side', () => {
    const slots = layoutDay([session(1, '09:00', 45), session(2, '09:15', 30), session(3, '09:20', 20)]);
    expect([1, 2, 3].map((id) => slots.get(id))).toEqual([
      { lane: 0, lanes: 3 },
      { lane: 1, lanes: 3 },
      { lane: 2, lanes: 3 },
    ]);
  });

  it('reuses a lane inside an overlapping group once the earlier session has ended', () => {
    // 09:00–10:00 overlaps both others; 09:50 can take the lane 09:20 has finished with.
    const slots = layoutDay([session(1, '09:00', 60), session(2, '09:20', 30), session(3, '09:50', 30)]);
    expect(slots.get(2)).toEqual({ lane: 1, lanes: 2 });
    expect(slots.get(3)).toEqual({ lane: 1, lanes: 2 });
  });

  it('starts a fresh full-width group after an overlapping group ends', () => {
    const slots = layoutDay([session(1, '09:00', 60), session(2, '09:30', 30), session(3, '10:00', 30)]);
    expect(slots.get(3)).toEqual({ lane: 0, lanes: 1 });
  });

  it('treats short sessions drawn at the minimum height as overlapping', () => {
    const slots = layoutDay([session(1, '09:00', 10), session(2, '09:15', 10)]);
    expect(slots.get(2)).toEqual({ lane: 1, lanes: 2 });
  });
});
