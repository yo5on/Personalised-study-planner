import { sampleSubjects, localDateKey, type Session, type Subject } from '../data';
import type { PlanChange, StudyRecord } from './agents';

export type DaymarkProfile = { name: string; course: string; year: string };
export type DaymarkState = {
  version: 1;
  profile: DaymarkProfile;
  subjects: Subject[];
  sessions: Session[];
  records: StudyRecord[];
  planChanges: PlanChange[];
  /** False only for a brand-new browser, until the welcome step is finished or skipped. */
  onboarded: boolean;
};

const KEY = 'daymark-state';
const BACKUP_KEY = 'daymark-state-unreadable-backup';
const defaultProfile: DaymarkProfile = { name: '', course: '', year: '' };
const validStatuses = new Set(['done', 'now', 'next', 'later']);
const validOutcomes = new Set(['understood', 'more-time', 'struggled', 'unfinished']);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeRead(key: string): unknown {
  const raw = readRaw(key);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function normaliseSessions(value: unknown): Session[] {
  if (!Array.isArray(value)) return [];
  const sessions = value.filter(
    (item): item is Session =>
      !!item &&
      typeof item === 'object' &&
      Number.isFinite(item.id) &&
      typeof item.topic === 'string' &&
      typeof item.subject === 'string' &&
      typeof item.time === 'string' &&
      timePattern.test(item.time) &&
      typeof item.tint === 'string' &&
      Number.isFinite(item.minutes) &&
      item.minutes > 0 &&
      typeof item.objective === 'string' &&
      ['High', 'Medium', 'Low'].includes(item.priority) &&
      validStatuses.has(item.status),
  );
  const seen = new Set<number>();
  // Duplicate ids would make completing one session mark another as done.
  return sessions
    .filter((session) => !seen.has(session.id) && !!seen.add(session.id))
    .map((session) => ({
      ...session,
      minutes: Math.min(600, Math.round(session.minutes)),
      date: typeof session.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(session.date) ? session.date : localDateKey(new Date()),
    }));
}
function normaliseSubjects(value: unknown): Subject[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(
      (item): item is Subject =>
        !!item &&
        typeof item === 'object' &&
        typeof item.name === 'string' &&
        item.name.trim().length > 0 &&
        typeof item.short === 'string' &&
        typeof item.color === 'string' &&
        typeof item.needsWork === 'string',
    )
    .filter((subject) => {
      const key = subject.name.trim().toLocaleLowerCase();
      return !seen.has(key) && !!seen.add(key);
    })
    .map((subject) => ({
      ...subject,
      mastery: Number.isFinite(subject.mastery) ? Math.min(100, Math.max(0, Math.round(subject.mastery))) : 0,
      strong: typeof subject.strong === 'string' ? subject.strong : 'Just getting started',
      exam: typeof subject.exam === 'string' ? subject.exam : subject.name,
      examIn: typeof subject.examIn === 'string' ? subject.examIn : 'No exam date',
    }));
}
function normaliseRecords(value: unknown): StudyRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (r): r is StudyRecord =>
        !!r &&
        typeof r === 'object' &&
        Number.isFinite(r.sessionId) &&
        typeof r.topic === 'string' &&
        typeof r.subject === 'string' &&
        Number.isFinite(r.plannedMinutes) &&
        Number.isFinite(r.actualMinutes) &&
        typeof r.completed === 'boolean' &&
        typeof r.at === 'string' &&
        !Number.isNaN(Date.parse(r.at)),
    )
    .map((r) => ({
      ...r,
      confidence: typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? Math.min(5, Math.max(1, r.confidence)) : undefined,
      outcome: validOutcomes.has(r.outcome || '') ? r.outcome : undefined,
    }));
}
function normalisePlanChanges(value: unknown): PlanChange[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (change): change is PlanChange =>
      !!change &&
      typeof change === 'object' &&
      typeof change.explanation === 'string' &&
      Array.isArray(change.sessions) &&
      isStringArray(change.removed) &&
      isStringArray(change.adjusted) &&
      isStringArray(change.added),
  );
}
function normaliseProfile(value: unknown): DaymarkProfile {
  if (!value || typeof value !== 'object') return { ...defaultProfile };
  const profile = value as Partial<DaymarkProfile>;
  const text = (field: unknown, max: number) => (typeof field === 'string' ? field.trim().slice(0, max) : '');
  return { name: text(profile.name, 60), course: text(profile.course, 80), year: text(profile.year, 20) };
}

export function loadDaymarkState(today: Date = new Date()): DaymarkState {
  const raw = readRaw(KEY);
  const saved = safeRead(KEY);
  if (saved && typeof saved === 'object') {
    const state = saved as Partial<DaymarkState>;
    return {
      version: 1,
      profile: normaliseProfile(state.profile),
      subjects: normaliseSubjects(state.subjects),
      sessions: normaliseSessions(state.sessions),
      records: normaliseRecords(state.records),
      planChanges: normalisePlanChanges(state.planChanges),
      // Saved state from before onboarding existed belongs to someone already using Daymark.
      onboarded: state.onboarded !== false,
    };
  }
  if (raw) {
    // Keep a copy of data we couldn't read rather than silently overwriting it on the next save.
    try {
      window.localStorage.setItem(BACKUP_KEY, raw);
    } catch {
      /* Storage is unavailable or full; nothing more we can do. */
    }
  }
  // Migrate earlier versions that saved these collections under separate keys. Those versions always used the
  // sample subjects, so their sessions keep a subject to belong to.
  const legacySessions = safeRead('daymark-sessions');
  const legacyRecords = safeRead('daymark-records');
  const legacyProfile = safeRead('daymark-profile');
  if (legacySessions || legacyRecords || legacyProfile)
    return {
      version: 1,
      profile: normaliseProfile(legacyProfile),
      subjects: sampleSubjects(today),
      sessions: normaliseSessions(legacySessions),
      records: normaliseRecords(legacyRecords),
      planChanges: [],
      onboarded: true,
    };
  return { version: 1, profile: { ...defaultProfile }, subjects: [], sessions: [], records: [], planChanges: [], onboarded: false };
}
export function saveDaymarkState(state: DaymarkState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Keep the in-memory app usable when storage is unavailable or full. */
  }
}
export function defaultDaymarkProfile(): DaymarkProfile {
  return { ...defaultProfile };
}
