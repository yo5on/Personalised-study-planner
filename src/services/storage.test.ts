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
  it('backs up unreadable saved data and starts a fresh, neutral profile', () => {
    store.set('daymark-state', '{not json');
    const state = loadDaymarkState();
    expect(store.get('daymark-state-unreadable-backup')).toBe('{not json');
    expect(state).toMatchObject({ version: 1, onboarded: false, subjects: [], sessions: [], planChanges: [] });
    expect(state.profile).toEqual({ name: '', course: '', year: '' });
  });

  it('starts a brand-new browser with onboarding and no placeholder data', () => {
    const state = loadDaymarkState();
    expect(state.onboarded).toBe(false);
    expect(state.profile.name).toBe('');
    expect(state.subjects).toEqual([]);
  });

  it('treats saved state from before onboarding existed as an existing user, unchanged', () => {
    const profile = { name: 'Farah Fathima', course: 'Computer Science', year: '2' };
    const subject = { name: 'Maths', short: 'M', color: '#eee', needsWork: 'x', mastery: 50, examDate: '2026-09-29' };
    store.set('daymark-state', JSON.stringify({ profile, subjects: [subject], sessions: [validSession] }));
    const state = loadDaymarkState();
    expect(state.onboarded).toBe(true);
    expect(state.profile).toEqual(profile);
    expect(state.subjects[0].examDate).toBe('2026-09-29');
    expect(state.sessions).toHaveLength(1);
  });

  it('migrates legacy keys with sample subjects dated from today', () => {
    store.set('daymark-sessions', JSON.stringify([validSession]));
    const today = new Date(2026, 9, 13);
    const state = loadDaymarkState(today);
    expect(state.onboarded).toBe(true);
    expect(state.sessions).toHaveLength(1);
    expect(state.subjects.every((subject) => subject.sample && subject.examDate! > '2026-10-13')).toBe(true);
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
