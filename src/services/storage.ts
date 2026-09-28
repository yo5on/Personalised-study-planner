import { initialSessions, subjects as defaultSubjects, localDateKey, type Session, type Subject } from '../data';
import type { PlanChange, StudyRecord } from './agents';

export type DaymarkProfile = { name: string; course: string; year: string };
export type DaymarkState = { version: 1; profile: DaymarkProfile; subjects: Subject[]; sessions: Session[]; records: StudyRecord[]; planChanges: PlanChange[] };

const KEY = 'daymark-state';
const defaultProfile: DaymarkProfile = { name: 'Farah Fathima', course: 'Computer Science', year: '2' };
const validStatuses = new Set(['done', 'now', 'next', 'later']);
const validOutcomes = new Set(['understood', 'more-time', 'struggled', 'unfinished']);

function safeRead(key: string): unknown {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function normaliseSessions(value: unknown): Session[] {
  if (!Array.isArray(value)) return [...initialSessions];
  const sessions = value.filter((item): item is Session => !!item && typeof item === 'object' && Number.isFinite(item.id) && typeof item.topic === 'string' && typeof item.subject === 'string' && typeof item.time === 'string' && typeof item.tint === 'string' && Number.isFinite(item.minutes) && item.minutes > 0 && typeof item.objective === 'string' && ['High','Medium','Low'].includes(item.priority) && validStatuses.has(item.status));
  if (value.length > 0 && sessions.length === 0) return [...initialSessions];
  return sessions.map(session => ({ ...session, date: typeof session.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(session.date) ? session.date : localDateKey(new Date()) }));
}
function normaliseSubjects(value: unknown): Subject[] {
  if (!Array.isArray(value)) return defaultSubjects.map(subject => ({ ...subject }));
  return value.filter((item): item is Subject => !!item && typeof item === 'object' && typeof item.name === 'string' && item.name.trim().length > 0 && typeof item.short === 'string' && typeof item.color === 'string' && typeof item.needsWork === 'string')
    .map(subject => ({ ...subject, mastery: Number.isFinite(subject.mastery) ? subject.mastery : 0, strong: typeof subject.strong === 'string' ? subject.strong : 'Just getting started', exam: typeof subject.exam === 'string' ? subject.exam : subject.name, examIn: typeof subject.examIn === 'string' ? subject.examIn : 'No exam date' }));
}
function normaliseRecords(value: unknown): StudyRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is StudyRecord => !!r && typeof r === 'object' && Number.isFinite(r.sessionId) && typeof r.topic === 'string' && typeof r.subject === 'string' && Number.isFinite(r.plannedMinutes) && Number.isFinite(r.actualMinutes) && typeof r.completed === 'boolean' && typeof r.at === 'string').map(r => ({ ...r, confidence: typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? Math.min(5, Math.max(1, r.confidence)) : undefined, outcome: validOutcomes.has(r.outcome || '') ? r.outcome : undefined }));
}
function normaliseProfile(value: unknown): DaymarkProfile {
  if (!value || typeof value !== 'object') return { ...defaultProfile };
  const profile = value as Partial<DaymarkProfile>;
  return { name: typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : defaultProfile.name, course: typeof profile.course === 'string' && profile.course.trim() ? profile.course.trim() : defaultProfile.course, year: typeof profile.year === 'string' && profile.year.trim() ? profile.year.trim() : defaultProfile.year };
}

export function loadDaymarkState(): DaymarkState {
  const saved = safeRead(KEY);
  if (saved && typeof saved === 'object') {
    const state = saved as Partial<DaymarkState>;
    return { version: 1, profile: normaliseProfile(state.profile), subjects: normaliseSubjects(state.subjects), sessions: normaliseSessions(state.sessions), records: normaliseRecords(state.records), planChanges: Array.isArray(state.planChanges) ? state.planChanges.filter(Boolean) : [] };
  }
  // Migrate earlier versions that saved these collections under separate keys.
  const sessions = normaliseSessions(safeRead('daymark-sessions'));
  const records = normaliseRecords(safeRead('daymark-records'));
  const profile = normaliseProfile(safeRead('daymark-profile'));
  return { version: 1, profile, subjects: defaultSubjects.map(subject => ({ ...subject })), sessions, records, planChanges: [] };
}
export function saveDaymarkState(state: DaymarkState): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* Keep the in-memory app usable when storage is unavailable or full. */ }
}
export function defaultDaymarkProfile(): DaymarkProfile { return { ...defaultProfile }; }

