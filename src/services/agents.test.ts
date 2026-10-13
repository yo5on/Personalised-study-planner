import { describe, expect, it } from 'vitest';
import type { Session, Subject } from '../data';
import {
  adaptStudyPlan,
  addSubject,
  generateRevisionPlan,
  mentions,
  parseAvailableMinutes,
  prioritizeTopics,
  progressAgent,
  renameSubjectReferences,
  studyStreak,
  topicsToRevisit,
  updateSubjectDetails,
  type StudyRecord,
} from './agents';

const TODAY = '2026-10-13';
const morning = new Date(2026, 9, 13, 8, 0);

const subjects: Subject[] = [
  {
    name: 'Artificial Intelligence',
    short: 'AI',
    mastery: 72,
    color: '#d9d9f5',
    strong: '',
    needsWork: 'Model evaluation',
    exam: 'AI-901',
    examIn: '',
  },
  {
    name: 'Mathematics',
    short: 'MATH',
    mastery: 64,
    color: '#f1dfc7',
    strong: '',
    needsWork: 'Bayesian networks',
    exam: 'Mathematics',
    examIn: '',
  },
  {
    name: 'Database Systems',
    short: 'DBMS',
    mastery: 81,
    color: '#d8e9dd',
    strong: '',
    needsWork: 'SQL joins',
    exam: 'DBMS CIA',
    examIn: '',
  },
  {
    name: 'Computer Networks',
    short: 'CN',
    mastery: 58,
    color: '#e9ddd2',
    strong: '',
    needsWork: 'Subnetting',
    exam: 'CN quiz',
    examIn: '',
  },
];

const session = (overrides: Partial<Session> & Pick<Session, 'id' | 'time' | 'subject' | 'topic'>): Session => ({
  date: TODAY,
  minutes: 30,
  status: 'later',
  priority: 'Medium',
  tint: '#eee',
  objective: 'Study.',
  ...overrides,
});

const plan = (): Session[] => [
  session({ id: 1, time: '09:00', subject: 'Mathematics', topic: 'Eigenvalues', minutes: 45, status: 'now', priority: 'High' }),
  session({ id: 2, time: '11:00', subject: 'Artificial Intelligence', topic: 'Model evaluation', minutes: 35, status: 'next' }),
  session({ id: 3, time: '18:30', subject: 'Database Systems', topic: 'SQL joins', minutes: 40, status: 'later' }),
];

const record = (overrides: Partial<StudyRecord> & Pick<StudyRecord, 'topic' | 'subject'>): StudyRecord => ({
  sessionId: 1,
  plannedMinutes: 30,
  actualMinutes: 30,
  completed: true,
  at: new Date(2026, 9, 13, 10).toISOString(),
  ...overrides,
});

const adapt = (sessions: Session[], request: string, options = {}) =>
  adaptStudyPlan(sessions, request, [], subjects, { todayKey: TODAY, now: morning, ...options });

describe('keyword matching', () => {
  it('matches whole words only', () => {
    expect(mentions('focus on ai today', 'ai')).toBe(true);
    expect(mentions('i have time again, i am available', 'ai')).toBe(false);
    expect(mentions('revise maths', 'math')).toBe(true);
  });

  it('does not prioritise AI sessions for requests that merely contain the letters "ai"', () => {
    const result = prioritizeTopics(plan(), 'explain training again', 'reason', subjects);
    expect(result.find((s) => s.id === 2)?.reason).toBeUndefined();
  });
});

describe('parseAvailableMinutes', () => {
  it.each([
    ['I only have 90 minutes today', 90],
    ['got 1.5 hours left', 90],
    ['I have 2h 30m free', 150],
    ['only half an hour', 30],
    ['90 minutes today', 90],
  ])('%s → %i', (text, minutes) => expect(parseAvailableMinutes(text)).toBe(minutes));

  it('ignores durations that are not about available time', () => {
    expect(parseAvailableMinutes('the lecture was 2 hours long')).toBeUndefined();
    expect(parseAvailableMinutes('focus on maths')).toBeUndefined();
  });
});

describe('prioritizeTopics', () => {
  it('never revives a finished session', () => {
    const sessions = plan().map((s) => (s.id === 2 ? { ...s, status: 'done' as const } : s));
    const result = prioritizeTopics(sessions, 'Artificial Intelligence', 'exam', subjects);
    expect(result.find((s) => s.id === 2)?.status).toBe('done');
  });

  it('gives the prioritised session the earliest slot and leaves exactly one "now"', () => {
    const result = prioritizeTopics(plan(), 'SQL joins', 'reason', subjects);
    const sql = result.find((s) => s.id === 3)!;
    expect(sql.time).toBe('09:00');
    expect(sql.status).toBe('now');
    expect(result.filter((s) => s.status === 'now')).toHaveLength(1);
  });
});

describe('adaptStudyPlan', () => {
  it('fits the remaining sessions into the time limit without counting finished ones', () => {
    const sessions = plan().map((s) => (s.id === 1 ? { ...s, status: 'done' as const } : s));
    const result = adapt(sessions, 'I only have 60 minutes today');
    const pending = result.sessions.filter((s) => s.status !== 'done');
    expect(pending.reduce((total, s) => total + s.minutes, 0)).toBeLessThanOrEqual(60);
    expect(result.sessions.find((s) => s.id === 1)?.minutes).toBe(45);
    expect(result.adjusted).toContain('SQL joins · 40 → 25 min');
  });

  it('only adapts today and keeps other days untouched', () => {
    const other = session({ id: 9, time: '09:00', subject: 'Mathematics', topic: 'Limits', minutes: 120, date: '2026-10-14' });
    const result = adapt([...plan(), other], 'I only have 30 minutes');
    expect(result.sessions.find((s) => s.id === 9)).toEqual(other);
  });

  it('prioritises the subject whose exam is tomorrow', () => {
    const result = adapt(plan(), 'My DBMS exam is tomorrow');
    const first = result.sessions.filter((s) => s.status === 'now');
    expect(first.map((s) => s.subject)).toEqual(['Database Systems']);
    expect(result.explanation).toContain('Database Systems exam is tomorrow');
  });

  it('reschedules the missed session the user picked, into a free slot', () => {
    const result = adapt(plan(), 'missed', { missedSessionId: 2, now: new Date(2026, 9, 13, 12, 10) });
    const moved = result.sessions.find((s) => s.id === 2)!;
    expect(moved.time).toBe('12:30');
    expect(moved.minutes).toBe(30);
    expect(result.sessions.find((s) => s.id === 1)?.time).toBe('09:00');
    expect(result.sessions.filter((s) => s.status === 'now')).toHaveLength(1);
  });

  it('does not double-book the evening when moving a missed session', () => {
    const result = adapt(plan(), 'missed', { missedSessionId: 1, now: new Date(2026, 9, 13, 18, 20) });
    const moved = result.sessions.find((s) => s.id === 1)!;
    expect(moved.time).toBe('19:30');
  });

  it('moves a missed session to tomorrow when today is full', () => {
    const result = adapt(plan(), 'missed', { missedSessionId: 2, now: new Date(2026, 9, 13, 21, 50) });
    expect(result.sessions.find((s) => s.id === 2)?.date).toBe('2026-10-14');
  });

  it('adds a session when asked to focus on a subject with nothing planned', () => {
    const result = adapt(plan(), 'focus on computer networks today.');
    expect(result.added).toHaveLength(1);
    const added = result.sessions.find((s) => s.subject === 'Computer Networks')!;
    expect(added.status).toBe('now');
    expect(new Set(result.sessions.map((s) => s.id)).size).toBe(result.sessions.length);
  });

  it('removes a finished topic even with trailing punctuation', () => {
    const result = adapt(plan(), 'I finished SQL joins already.');
    expect(result.sessions.some((s) => s.id === 3)).toBe(false);
    expect(result.removed).toEqual(['SQL joins · 40 min']);
  });

  it('shortens the current session when tired', () => {
    const result = adapt(plan(), "I'm too tired");
    expect(result.sessions.find((s) => s.id === 1)?.minutes).toBe(20);
  });

  it('says so when it does not understand the request, and leaves the plan untouched', () => {
    // Stale statuses (no "now" session) must not be reported as a change either.
    const stale = plan().map((s) => (s.id === 1 ? { ...s, status: 'done' as const } : s));
    const result = adapt(stale, 'what a nice day');
    expect(result.changed).toBe(false);
    expect(result.sessions).toBe(stale);
    expect(result.explanation).toMatch(/couldn’t find a change/);
  });

  it('does not report a status-only reshuffle as a change', () => {
    const stale = plan().map((s) => (s.id === 1 ? { ...s, status: 'done' as const } : s));
    expect(adapt(stale, 'rebalance today').changed).toBe(false);
  });
});

describe('revision', () => {
  it('drops a topic once a later check-in shows more confidence', () => {
    const records = [
      record({ topic: 'SQL joins', subject: 'Database Systems', confidence: 2 }),
      record({ topic: 'SQL joins', subject: 'Database Systems', confidence: 4 }),
      record({ topic: 'Subnetting', subject: 'Computer Networks', confidence: 1 }),
    ];
    expect(generateRevisionPlan(records)).toEqual(['Subnetting']);
    expect(topicsToRevisit(records, 3).map((r) => r.topic)).toEqual(['Subnetting']);
  });
});

describe('progress', () => {
  it('counts only this week towards weekly minutes', () => {
    const records = [
      record({ topic: 'A', subject: 'Mathematics', actualMinutes: 25 }),
      record({ topic: 'B', subject: 'Mathematics', actualMinutes: 40, at: new Date(2026, 8, 1, 10).toISOString() }),
    ];
    const summary = progressAgent.summary(records, morning);
    expect(summary.weeklyMinutes).toBe(25);
    expect(summary.completed).toBe(2);
    expect(summary.week.find((d) => d.dateKey === TODAY)).toMatchObject({ minutes: 25, completed: 1 });
  });

  it('counts consecutive study days, keeping the streak alive until today ends', () => {
    const on = (day: number) => record({ topic: 'A', subject: 'Mathematics', at: new Date(2026, 9, day, 10).toISOString() });
    expect(studyStreak([on(10), on(11), on(12)], morning)).toBe(3);
    expect(studyStreak([on(10), on(12), on(13)], morning)).toBe(2);
    expect(studyStreak([on(9)], morning)).toBe(0);
  });
});

describe('subjects', () => {
  it('rejects duplicate names and malformed exam dates', () => {
    expect(addSubject(subjects, ' mathematics ').error).toMatch(/already exists/);
    expect(addSubject(subjects, 'Biology', '', '13/10/2026').error).toMatch(/full date/);
    expect(addSubject(subjects, 'Biology', '', '2026-11-01').subject?.examDate).toBe('2026-11-01');
  });

  it('renames a subject everywhere and updates its details', () => {
    const renamed = renameSubjectReferences(subjects, plan(), [], [], 'Mathematics', 'Maths');
    if ('error' in renamed) throw new Error(renamed.error);
    expect(renamed.sessions.find((s) => s.id === 1)?.subject).toBe('Maths');
    const updated = updateSubjectDetails(renamed.subjects, 'Maths', 'Linear algebra', '2026-12-01');
    if ('error' in updated) throw new Error(updated.error);
    expect(updated.find((s) => s.name === 'Maths')).toMatchObject({ description: 'Linear algebra', examDate: '2026-12-01' });
  });
});
