import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDaymarkState, saveDaymarkState } from './storage';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

const validSession = {
  id: 1,
  time: '09:00',
  date: '2026-10-13',
  subject: 'Maths',
  topic: 'Limits',
  minutes: 30,
  status: 'now',
  priority: 'High',
  tint: '#eee',
  objective: 'x',
};

describe('loadDaymarkState', () => {
  it('falls back to defaults when the saved JSON is corrupt', () => {
    store.set('daymark-state', '{not json');
    const state = loadDaymarkState();
    expect(state.version).toBe(1);
    expect(state.sessions.length).toBeGreaterThan(0);
    expect(state.planChanges).toEqual([]);
  });

  it('round-trips saved state', () => {
    const state = loadDaymarkState();
    saveDaymarkState({ ...state, profile: { name: 'Sam', course: 'Physics', year: '1' } });
    expect(loadDaymarkState().profile).toEqual({ name: 'Sam', course: 'Physics', year: '1' });
  });

  it('drops malformed entries and duplicate ids, and clamps out-of-range values', () => {
    store.set(
      'daymark-state',
      JSON.stringify({
        sessions: [validSession, { ...validSession, topic: 'Duplicate id' }, { ...validSession, id: 2, time: '9am' }],
        subjects: [
          { name: 'Maths', short: 'M', color: '#eee', needsWork: 'x', mastery: 140 },
          { name: 'maths', short: 'M', color: '#eee', needsWork: 'x', mastery: 10 },
        ],
        records: [
          { sessionId: 1, topic: 'Limits', subject: 'Maths', plannedMinutes: 30, actualMinutes: 20, completed: true, at: 'not a date' },
        ],
        planChanges: [null, { explanation: 'broken' }, { explanation: 'ok', sessions: [], removed: [], adjusted: [], added: [] }],
      }),
    );
    const state = loadDaymarkState();
    expect(state.sessions.map((s) => s.topic)).toEqual(['Limits']);
    expect(state.subjects).toHaveLength(1);
    expect(state.subjects[0].mastery).toBe(100);
    expect(state.records).toEqual([]);
    expect(state.planChanges.map((c) => c.explanation)).toEqual(['ok']);
  });

  it('keeps working when storage throws', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('full');
        },
      },
    });
    expect(() => saveDaymarkState(loadDaymarkState())).not.toThrow();
  });
});
