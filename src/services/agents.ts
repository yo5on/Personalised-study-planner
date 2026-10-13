import { localDateKey, weekForDate, type Session, type Subject } from '../data';

export type StudyOutcome = 'understood' | 'more-time' | 'struggled' | 'unfinished';
export type StudyRecord = {
  sessionId: number;
  topic: string;
  subject: string;
  plannedMinutes: number;
  actualMinutes: number;
  confidence?: number;
  outcome?: StudyOutcome;
  completed: boolean;
  missed?: boolean;
  sessionTime?: string;
  at: string;
};
// `changed` is optional so plan changes saved by earlier versions still load.
export type PlanChange = {
  sessions: Session[];
  explanation: string;
  removed: string[];
  adjusted: string[];
  added: string[];
  changed?: boolean;
};
export type Readiness = 'Needs attention' | 'On track' | 'Review recommended';
export type SubjectChangeData = { subjects: Subject[]; sessions: Session[]; records: StudyRecord[]; planChanges: PlanChange[] };
export type SubjectMutation = { subject?: Subject; error?: string };
export type AdaptOptions = { todayKey?: string; now?: Date; missedSessionId?: number };
type SubjectTerms = Pick<Subject, 'name' | 'short' | 'exam'>;

const subjectColors = ['#d9d9f5', '#e8f0e7', '#f1dfc7', '#e9ddd2', '#e6eefa'];
// Extra words people use for the starter subjects that their name, short code or exam name don't cover.
const subjectAliases: Record<string, string[]> = { 'Database Systems': ['database', 'sql'] };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const LATEST_SLOT_MINUTES = 22 * 60;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toMinutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};
const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const cleanPhrase = (value: string) => value.replace(/[.!?,;:]+$/, '').trim();

/** Whole-word, case-insensitive match, so "ai" no longer matches "again" or "available". A plural "s" is allowed. */
export function mentions(text: string, term: string): boolean {
  const clean = term.trim().toLowerCase();
  if (!clean) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(clean)}s?(?=$|[^a-z0-9])`, 'i').test(text);
}

export function mentionsSubject(text: string, subject: SubjectTerms): boolean {
  return [subject.name, subject.short, subject.exam, ...(subjectAliases[subject.name] || [])].some(
    (term) => term && term.trim().length >= 2 && mentions(text, term),
  );
}

export function sortByTime(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.time.localeCompare(b.time));
}

/** Within each day, the earliest unfinished session is "now", the following one "next" and the rest "later". */
export function normaliseStatuses(sessions: Session[]): Session[] {
  const order = new Map<number, Session['status']>();
  const byDate = new Map<string, Session[]>();
  sessions.filter((s) => s.status !== 'done').forEach((s) => byDate.set(s.date || '', [...(byDate.get(s.date || '') || []), s]));
  byDate.forEach((group) => sortByTime(group).forEach((s, i) => order.set(s.id, i === 0 ? 'now' : i === 1 ? 'next' : 'later')));
  return sessions.map((s) => (order.has(s.id) && order.get(s.id) !== s.status ? { ...s, status: order.get(s.id)! } : s));
}

export function addSubject(existing: Subject[], name: string, description = '', examDate = ''): SubjectMutation {
  const clean = name.trim();
  if (!clean) return { error: 'Enter a subject name to continue.' };
  if (existing.some((subject) => subject.name.trim().toLocaleLowerCase() === clean.toLocaleLowerCase()))
    return { error: 'A subject with that name already exists.' };
  if (examDate && !datePattern.test(examDate)) return { error: 'Enter the exam date as a full date.' };
  const short = clean
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 4)
    .toUpperCase();
  return {
    subject: {
      name: clean,
      short,
      mastery: 0,
      color: subjectColors[existing.length % subjectColors.length],
      strong: 'Just getting started',
      needsWork: 'Core concepts',
      exam: clean,
      examIn: examDate ? '' : 'No exam date',
      description: description.trim() || undefined,
      examDate: examDate || undefined,
    },
  };
}

export function updateSubjectDetails(
  subjects: Subject[],
  name: string,
  description: string,
  examDate: string,
): Subject[] | { error: string } {
  if (examDate && !datePattern.test(examDate)) return { error: 'Enter the exam date as a full date.' };
  return subjects.map((subject) =>
    subject.name === name
      ? {
          ...subject,
          description: description.trim() || undefined,
          examDate: examDate || undefined,
          examIn: examDate ? '' : subject.examDate ? 'No exam date' : subject.examIn,
        }
      : subject,
  );
}

/** Moves estimated mastery a fifth of the way towards the latest confidence check-in (1/5 → 20%, 5/5 → 100%). */
export function updateMastery(mastery: number, confidence: number): number {
  return Math.min(100, Math.max(0, Math.round(mastery * 0.8 + confidence * 20 * 0.2)));
}

export function createSubjectSession(subject: Subject, sessions: Session[], date = localDateKey(new Date())): Session {
  const occupied = new Set(sessions.filter((s) => (s.date || date) === date).map((s) => s.time));
  const time = ['14:00', '15:00', '16:00', '17:00'].find((candidate) => !occupied.has(candidate)) || '17:00';
  return {
    id: Math.max(0, ...sessions.map((s) => s.id)) + 1,
    time,
    date,
    subject: subject.name,
    topic: subject.needsWork || 'Core concepts',
    minutes: 30,
    status: sessions.some((s) => s.status !== 'done' && (s.date || date) === date) ? 'later' : 'now',
    priority: 'Medium',
    tint: subject.color,
    objective: subject.description
      ? `Study focus: ${subject.description}`
      : `Build a clear first understanding of ${subject.name} and note any questions for review.`,
  };
}

export function renameSubjectReferences(
  existing: Subject[],
  sessions: Session[],
  records: StudyRecord[],
  planChanges: PlanChange[],
  oldName: string,
  newName: string,
): SubjectChangeData | { error: string } {
  const clean = newName.trim();
  if (!clean) return { error: 'Enter a subject name to continue.' };
  if (existing.some((subject) => subject.name.toLocaleLowerCase() === clean.toLocaleLowerCase() && subject.name !== oldName))
    return { error: 'A subject with that name already exists.' };
  const replace = (value: string) => value.split(oldName).join(clean);
  return {
    subjects: existing.map((subject) =>
      subject.name === oldName ? { ...subject, name: clean, exam: subject.exam === oldName ? clean : subject.exam } : subject,
    ),
    sessions: sessions.map((session) => (session.subject === oldName ? { ...session, subject: clean } : session)),
    records: records.map((record) => (record.subject === oldName ? { ...record, subject: clean } : record)),
    planChanges: planChanges.map((change) => ({
      ...change,
      explanation: replace(change.explanation),
      removed: change.removed.map(replace),
      adjusted: change.adjusted.map(replace),
      added: change.added.map(replace),
      sessions: change.sessions.map((session) => (session.subject === oldName ? { ...session, subject: clean } : session)),
    })),
  };
}

export function removeSubjectFromPlanning(sessions: Session[], subjectName: string): Session[] {
  return sessions.filter((session) => session.subject !== subjectName);
}

export function explainPlanChange(reason: string): string {
  return reason;
}

/**
 * Moves the unfinished sessions that match the request to the front of their day. Matched sessions take the
 * earliest time slots so the timeline and calendar reflect the new order. Finished sessions are never touched.
 */
export function prioritizeTopics(
  sessions: Session[],
  request: string,
  reason = 'Moved up because you asked to focus on this subject.',
  subjects: SubjectTerms[] = [],
): Session[] {
  const q = request.toLowerCase();
  const isMatch = (s: Session) => {
    const subject = subjects.find((item) => item.name === s.subject) || { name: s.subject, short: '', exam: '' };
    return mentions(q, s.topic) || mentionsSubject(q, subject);
  };
  const result = sessions.map((s) => ({ ...s }));
  const pending = sortByTime(result.filter((s) => s.status !== 'done'));
  const matched = pending.filter(isMatch);
  if (!matched.length) return sessions;
  const ordered = [...matched, ...pending.filter((s) => !isMatch(s))];
  const byDate = new Map<string, Session[]>();
  ordered.forEach((s) => byDate.set(s.date || '', [...(byDate.get(s.date || '') || []), s]));
  byDate.forEach((group) => {
    const times = group.map((s) => s.time).sort();
    group.forEach((s, i) => (s.time = times[i]));
  });
  matched.forEach((s) => {
    s.priority = 'High';
    s.reason = reason;
  });
  return normaliseStatuses(result);
}

export function createStudyPlan(sessions: Session[], history: StudyRecord[] = [], availableSubjects?: Subject[]): Session[] {
  const active = sessions.map((s) => ({ ...s }));
  const eligible = active.filter((session) => !availableSubjects || availableSubjects.some((subject) => subject.name === session.subject));
  const lastLowConfidence = topicsToRevisit(history, 2)[0];
  if (!lastLowConfidence) return eligible;
  return prioritizeTopics(
    eligible,
    lastLowConfidence.topic,
    `Moved up because confidence in ${lastLowConfidence.topic} was ${lastLowConfidence.confidence}/5.`,
  );
}

/** Reads "I only have 90 minutes", "got 1.5 hours left", "2h 30m free", "half an hour" and similar. */
export function parseAvailableMinutes(request: string): number | undefined {
  const q = request.toLowerCase();
  if (!/\b(only|have|got|left|free|available|spare|just)\b/.test(q) && !/^\s*\d/.test(q)) return undefined;
  if (/\bhalf an hour\b/.test(q)) return 30;
  const hours = q.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  const minutes = q.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);
  if (!hours && !minutes) return undefined;
  const total = Math.round((hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0));
  return total <= 24 * 60 ? total : undefined;
}

function overlaps(start: number, minutes: number, others: Session[]): boolean {
  return others.some((s) => {
    const otherStart = toMinutes(s.time);
    return start < otherStart + s.minutes && otherStart < start + minutes;
  });
}

/** The earliest half-hour slot from `now` that doesn't overlap another session today, or undefined if today is full. */
function nextFreeSlot(minutes: number, others: Session[], now: Date): string | undefined {
  const current = now.getHours() * 60 + now.getMinutes();
  for (let start = Math.ceil(current / 30) * 30; start + minutes <= LATEST_SLOT_MINUTES; start += 30) {
    if (!overlaps(start, minutes, others)) return toTime(start);
  }
  return undefined;
}

export function adaptStudyPlan(
  sessions: Session[],
  request: string,
  history: StudyRecord[] = [],
  availableSubjects?: Subject[],
  options: AdaptOptions = {},
): PlanChange {
  const q = request.toLowerCase().trim();
  const now = options.now || new Date();
  const todayKey = options.todayKey || localDateKey(now);
  const subjectTerms: SubjectTerms[] =
    availableSubjects || [...new Set(sessions.map((s) => s.subject))].map((name) => ({ name, short: '', exam: '' }));
  const eligible = sessions.filter(
    (session) => !availableSubjects || availableSubjects.some((subject) => subject.name === session.subject),
  );
  // Only today's sessions are adapted; other days are carried over unchanged.
  const others = eligible.filter((s) => (s.date || todayKey) !== todayKey);
  let list: Session[] = eligible.filter((s) => (s.date || todayKey) === todayKey).map((s) => ({ ...s, date: todayKey }));
  const originals = new Map(list.map((s) => [s.id, s]));
  const removed: string[] = [];
  const adjusted: string[] = [];
  const added: string[] = [];
  let recognised = false;
  let explanation = 'Your plan was adjusted around what you told me.';
  const pending = () => sortByTime(list.filter((s) => s.status !== 'done'));
  const limit = parseAvailableMinutes(q);
  const examSubject = subjectTerms.find((subject) => mentionsSubject(q, subject))?.name;
  const examWhen = /\b(exam|test|quiz)\b/.test(q) ? q.match(/\b(tomorrow|today|tonight)\b/)?.[1] : undefined;
  const examReason = examSubject && examWhen ? `Moved because your ${examSubject} exam is ${examWhen}.` : undefined;

  if (examReason) {
    recognised = true;
    explanation = `Your ${examSubject} exam is ${examWhen}, so those topics have been prioritised.`;
    list = prioritizeTopics(list, examSubject!, examReason, subjectTerms);
  }

  const focus = cleanPhrase(q.match(/focus (?:more )?on\s+(.+?)(?:\s+(?:today|tonight|instead)\b|[.!?,]|$)/)?.[1] || '');
  if (focus) {
    recognised = true;
    explanation = `${focus} has been prioritised because you asked to focus on it.`;
    list = prioritizeTopics(list, focus, explanation, subjectTerms);
    const requestedSubject = availableSubjects?.find(
      (subject) => mentionsSubject(focus, subject) || (focus.length >= 3 && subject.name.toLowerCase().includes(focus)),
    );
    if (requestedSubject && !list.some((session) => session.subject === requestedSubject.name && session.status !== 'done')) {
      const created = createSubjectSession(requestedSubject, [...others, ...list], todayKey);
      created.priority = 'High';
      created.reason = `Added because you asked to focus on ${requestedSubject.name}.`;
      list = prioritizeTopics([...list, created], requestedSubject.name, created.reason, subjectTerms);
      added.push(`${created.topic} · ${created.minutes} min`);
    }
  }

  const finished = cleanPhrase(q.match(/(?:finished|done with|completed)\s+(.+?)(?:\s+already\b|[.!?,]|$)/)?.[1] || '');
  if (finished) {
    recognised = true;
    const match = pending().find((s) => mentions(finished, s.topic) || s.topic.toLowerCase().includes(finished));
    if (match) {
      removed.push(`${match.topic} · ${match.minutes} min`);
      list = list.filter((s) => s.id !== match.id);
      explanation = `${match.topic} was removed because you have finished it.`;
    }
  }

  if (/\b(too tired|tired|exhausted|low energy|drained)\b/.test(q)) {
    recognised = true;
    const session = pending()[0];
    if (session) {
      const before = session.minutes;
      session.minutes = Math.min(before, 20);
      session.reason = 'Shortened because you said you are tired.';
      if (before !== session.minutes) {
        session.objective = `A gentle, shorter session: ${session.objective}`;
        adjusted.push(`${session.topic} · ${before} → ${session.minutes} min`);
      }
    }
    explanation = 'Sessions are lighter because you said you are tired.';
  }

  const missedRequested = options.missedSessionId !== undefined || /\bmissed\b|\bmiss(ing)? my\b/.test(q);
  if (missedRequested) {
    recognised = true;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const session =
      options.missedSessionId !== undefined
        ? list.find((s) => s.id === options.missedSessionId && s.status !== 'done')
        : pending().find((s) => toMinutes(s.time) < currentMinutes) || pending()[0];
    if (session) {
      const beforeMinutes = session.minutes;
      session.minutes = Math.min(beforeMinutes, 30);
      const slot = nextFreeSlot(
        session.minutes,
        list.filter((s) => s.id !== session.id),
        now,
      );
      const shortened = beforeMinutes > session.minutes ? `, ${beforeMinutes} → ${session.minutes} min` : '';
      if (slot) {
        session.time = slot;
        session.reason = `Moved because your ${session.subject} session was missed; shortened to keep today realistic.`;
        adjusted.push(`${session.topic} · moved to ${slot}${shortened}`);
        explanation = `Your ${session.subject} session was moved to ${slot}${shortened ? ' and shortened' : ''} so the rest of today remains realistic.`;
      } else {
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        session.date = localDateKey(tomorrow);
        session.reason = `Moved to tomorrow because your ${session.subject} session was missed and today has no free time left.`;
        adjusted.push(`${session.topic} · moved to tomorrow at ${session.time}${shortened}`);
        explanation = `There's no free time left today, so your ${session.subject} session moves to tomorrow at ${session.time}.`;
      }
    }
  }

  if (limit !== undefined) {
    recognised = true;
    if (examReason) list = prioritizeTopics(list, examSubject!, examReason, subjectTerms);
    let remaining = limit;
    const dropped = new Set<number>();
    // Budget today's remaining sessions in plan order; finished sessions don't use up the time that's left.
    pending()
      .filter((s) => s.date === todayKey)
      .forEach((session) => {
        if (session.minutes <= remaining) {
          remaining -= session.minutes;
        } else if (remaining >= 15) {
          const before = session.minutes;
          session.minutes = remaining;
          session.reason = 'Shortened because today’s available study time decreased.';
          adjusted.push(`${session.topic} · ${before} → ${remaining} min`);
          remaining = 0;
        } else {
          removed.push(`${session.topic} · ${session.minutes} min`);
          dropped.add(session.id);
        }
      });
    list = list.filter((s) => !dropped.has(s.id));
    explanation = `Your available time changed to ${limit} minutes${examReason ? `. ${examSubject} has been prioritised because its exam is ${examWhen}` : ''}.`;
  } else if (/\b(rebalance|replan|plan)\b/.test(q)) {
    recognised = true;
    const record = topicsToRevisit(history, 2).find((r) => pending().some((s) => s.topic.toLowerCase() === r.topic.toLowerCase()));
    const session = record && pending().find((s) => s.topic.toLowerCase() === record.topic.toLowerCase());
    if (record && session) {
      list = prioritizeTopics(list, record.topic, `Moved up because confidence dropped to ${record.confidence}/5.`, subjectTerms);
      const moved = list.find((s) => s.id === session.id)!;
      const before = moved.minutes;
      moved.minutes = Math.min(before, 20);
      if (before !== moved.minutes) adjusted.push(`${moved.topic} · ${before} → ${moved.minutes} min`);
      explanation = `A shorter ${moved.topic} session is next because confidence was ${record.confidence}/5.`;
    }
  }

  if (!recognised)
    return {
      sessions,
      explanation:
        'I couldn’t find a change to make from that. Try “I only have 90 minutes today”, “focus on Mathematics”, “I’m too tired” or “I finished SQL joins”.',
      removed,
      adjusted,
      added,
      changed: false,
    };
  list = normaliseStatuses(list);
  // Statuses alone don't count as a change: they're re-derived from the order of the day.
  const moved = list.some((s) => {
    const original = originals.get(s.id);
    return !original || s.time !== original.time || s.date !== original.date || s.minutes !== original.minutes;
  });
  const changed = moved || removed.length > 0 || adjusted.length > 0 || added.length > 0;
  if (!changed) explanation = 'Your current plan already fits what you have on your plate; no changes are needed.';
  return { sessions: [...others, ...sortByTime(list)], explanation: explainPlanChange(explanation), removed, adjusted, added, changed };
}

/** The most recent confidence check-in for each subject and topic, newest first. */
export function latestCheckIns(records: StudyRecord[]): StudyRecord[] {
  const latest = new Map<string, StudyRecord>();
  records
    .filter((r) => r.completed && r.confidence !== undefined)
    .forEach((r) => {
      const key = `${r.subject}::${r.topic.toLowerCase()}`;
      latest.delete(key);
      latest.set(key, r);
    });
  return [...latest.values()].reverse();
}

/** Topics whose latest check-in is at or below `threshold`, newest first. A later, more confident check-in clears a topic. */
export function topicsToRevisit(records: StudyRecord[], threshold = 2): StudyRecord[] {
  return latestCheckIns(records).filter((r) => r.confidence! <= threshold);
}

export function generateRevisionPlan(records: StudyRecord[]): string[] {
  return [...new Set(topicsToRevisit(records, 2).map((r) => r.topic))];
}

export function evaluateReadiness(masteries: number[], records: StudyRecord[], daysUntilExam: number): Readiness {
  const completed = records.filter((r) => r.completed);
  const checkedIn = completed.filter((r) => r.confidence !== undefined);
  const average = checkedIn.length ? checkedIn.reduce((total, r) => total + (r.confidence || 0), 0) / checkedIn.length : undefined;
  if (daysUntilExam <= 3 && (masteries.some((m) => m < 65) || completed.length === 0 || (average !== undefined && average < 3)))
    return 'Needs attention';
  if (generateRevisionPlan(records).length || (average !== undefined && average < 3)) return 'Review recommended';
  return 'On track';
}

export function generateObservations(records: StudyRecord[]): string[] {
  const observations: string[] = [];
  const missed = new Map<string, number>();
  records.filter((r) => r.missed).forEach((r) => missed.set(r.topic, (missed.get(r.topic) || 0) + 1));
  missed.forEach((count, topic) => observations.push(`You postponed ${topic} ${count === 1 ? 'once' : `${count} times`}.`));
  const checked = records.filter((r) => r.completed && r.confidence !== undefined);
  const latest = checked[checked.length - 1];
  const previous =
    latest &&
    checked
      .slice(0, -1)
      .reverse()
      .find((r) => r.topic === latest.topic && r.confidence !== latest.confidence);
  if (latest && previous && latest.confidence! > previous.confidence!)
    observations.push(`Your confidence in ${latest.topic} increased from ${previous.confidence}/5 to ${latest.confidence}/5.`);
  const timed = records.filter((r) => r.completed && r.actualMinutes > 0);
  if (timed.length) {
    const delta = Math.round(timed.reduce((total, r) => total + r.plannedMinutes - r.actualMinutes, 0) / timed.length);
    if (delta >= 2) observations.push(`Your average study session is ${delta} minutes shorter than planned.`);
    else if (delta <= -2) observations.push(`Your average study session runs ${Math.abs(delta)} minutes longer than planned.`);
  }
  const early = records.filter(
    (r) => r.completed && r.sessionTime && Number(r.sessionTime.slice(0, 2)) < 11 && r.confidence !== undefined && r.confidence >= 4,
  );
  if (early.length >= 2) observations.push('You usually complete confident check-ins on sessions scheduled before 11 AM.');
  return observations;
}

export const recordDateKey = (record: StudyRecord) => localDateKey(new Date(record.at));

/** Completed sessions and minutes studied on each day of the week containing `date`, Monday first. */
export function minutesByDay(records: StudyRecord[], date: Date = new Date()) {
  return weekForDate(date).map((day) => {
    const completed = records.filter((r) => r.completed && recordDateKey(r) === day.dateKey);
    return { ...day, completed: completed.length, minutes: completed.reduce((total, r) => total + r.actualMinutes, 0) };
  });
}

/** Consecutive days with a completed session, ending today (or yesterday, so a streak isn't lost before today's session). */
export function studyStreak(records: StudyRecord[], today: Date = new Date()): number {
  const days = new Set(records.filter((r) => r.completed).map(recordDateKey));
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!days.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export const plannerAgent = { create: createStudyPlan };
export const progressAgent = {
  summary: (records: StudyRecord[] = [], today: Date = new Date()) => {
    const week = minutesByDay(records, today);
    const weekKeys = new Set(week.map((day) => day.dateKey));
    const completed = records.filter((r) => r.completed);
    return {
      weeklyMinutes: week.reduce((total, day) => total + day.minutes, 0),
      weeklyCompleted: completed.filter((r) => weekKeys.has(recordDateKey(r))).length,
      consistency: new Set(completed.map(recordDateKey)).size,
      completed: completed.length,
      streak: studyStreak(records, today),
      week,
    };
  },
};
export const revisionAgent = {
  priority: (topic: string, confidence: number) =>
    confidence < 3 ? `${topic} · needs a short recall session` : `${topic} · scheduled for spaced review`,
};
export const evaluationAgent = {
  insight: (records: StudyRecord[] = []) =>
    generateObservations(records)[0] || 'Keep studying and Daymark will start noticing your patterns.',
};
export const adaptationAgent = {
  replan: (
    sessions: Session[],
    request = '90 minutes today',
    history: StudyRecord[] = [],
    availableSubjects?: Subject[],
    options: AdaptOptions = {},
  ) => adaptStudyPlan(sessions, request, history, availableSubjects, options),
};
