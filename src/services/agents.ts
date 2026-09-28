import { localDateKey, type Session, type Subject } from '../data';

export type StudyOutcome = 'understood' | 'more-time' | 'struggled' | 'unfinished';
export type StudyRecord = { sessionId: number; topic: string; subject: string; plannedMinutes: number; actualMinutes: number; confidence?: number; outcome?: StudyOutcome; completed: boolean; missed?: boolean; sessionTime?: string; at: string };
export type PlanChange = { sessions: Session[]; explanation: string; removed: string[]; adjusted: string[]; added: string[] };
export type Readiness = 'Needs attention' | 'On track' | 'Review recommended';
export type SubjectChangeData = { subjects: Subject[]; sessions: Session[]; records: StudyRecord[]; planChanges: PlanChange[] };
export type SubjectMutation = { subject?: Subject; error?: string };
const subjectColors = ['#d9d9f5', '#e8f0e7', '#f1dfc7', '#e9ddd2', '#e6eefa'];

export function addSubject(existing: Subject[], name: string, description = '', examDate = ''): SubjectMutation {
  const clean = name.trim();
  if (!clean) return { error: 'Enter a subject name to continue.' };
  if (existing.some(subject => subject.name.trim().toLocaleLowerCase() === clean.toLocaleLowerCase())) return { error: 'A subject with that name already exists.' };
  const short = clean.split(/\s+/).map(part => part[0]).join('').slice(0, 4).toUpperCase();
  return { subject: { name: clean, short, mastery: 0, color: subjectColors[existing.length % subjectColors.length], strong: 'Just getting started', needsWork: 'Core concepts', exam: clean, examIn: examDate ? '' : 'No exam date', description: description.trim() || undefined, examDate: examDate || undefined } };
}

export function createSubjectSession(subject: Subject, sessions: Session[]): Session {
  const date = localDateKey(new Date());
  const occupied = new Set(sessions.filter(s => (s.date || date) === date).map(s => s.time));
  const time = ['14:00', '15:00', '16:00', '17:00'].find(candidate => !occupied.has(candidate)) || '17:00';
  return { id: Math.max(0, ...sessions.map(s => s.id)) + 1, time, date, subject: subject.name, topic: subject.needsWork || 'Core concepts', minutes: 30, status: sessions.some(s => s.status !== 'done' && (s.date || date) === date) ? 'later' : 'now', priority: 'Medium', tint: subject.color, objective: subject.description ? `Study focus: ${subject.description}` : `Build a clear first understanding of ${subject.name} and note any questions for review.` };
}

export function renameSubjectReferences(existing: Subject[], sessions: Session[], records: StudyRecord[], planChanges: PlanChange[], oldName: string, newName: string): SubjectChangeData | { error: string } {
  const clean = newName.trim();
  if (!clean) return { error: 'Enter a subject name to continue.' };
  if (existing.some(subject => subject.name.toLocaleLowerCase() === clean.toLocaleLowerCase() && subject.name !== oldName)) return { error: 'A subject with that name already exists.' };
  const replace = (value: string) => value.split(oldName).join(clean);
  return {
    subjects: existing.map(subject => subject.name === oldName ? { ...subject, name: clean, exam: subject.exam === oldName ? clean : subject.exam } : subject),
    sessions: sessions.map(session => session.subject === oldName ? { ...session, subject: clean } : session),
    records: records.map(record => record.subject === oldName ? { ...record, subject: clean } : record),
    planChanges: planChanges.map(change => ({ ...change, explanation: replace(change.explanation), removed: change.removed.map(replace), adjusted: change.adjusted.map(replace), added: change.added.map(replace), sessions: change.sessions.map(session => session.subject === oldName ? { ...session, subject: clean } : session) }))
  };
}

export function removeSubjectFromPlanning(sessions: Session[], subjectName: string): Session[] {
  return sessions.filter(session => session.subject !== subjectName);
}


export function explainPlanChange(reason: string): string { return reason; }

export function prioritizeTopics(sessions: Session[], request: string, reason = 'Moved up because you asked to focus on this subject.'): Session[] {
  const q = request.toLowerCase();
  const matches = sessions.filter(s => q.includes(s.subject.toLowerCase()) || q.includes(s.topic.toLowerCase()) || (q.includes('math') && s.subject === 'Mathematics') || (q.includes('ai') && s.subject === 'Artificial Intelligence'));
  if (!matches.length) return sessions;
  const ids = new Set(matches.map(s => s.id));
  return [...sessions].sort((a, b) => Number(ids.has(b.id)) - Number(ids.has(a.id))).map((s, i) => {
    if (ids.has(s.id)) return { ...s, status: i === 0 ? 'now' as const : 'next' as const, priority: 'High' as const, reason };
    return s.status === 'now' ? { ...s, status: 'next' as const } : s;
  });
}

export function createStudyPlan(sessions: Session[], history: StudyRecord[] = [], availableSubjects?: Subject[]): Session[] {
  const lastLowConfidence = [...history].reverse().find(r => r.completed && r.confidence !== undefined && r.confidence <= 2);
  const active = sessions.map(s => ({ ...s }));
  const eligible = active.filter(session => !availableSubjects || availableSubjects.some(subject => subject.name === session.subject));
  if (!lastLowConfidence) return eligible;
  return prioritizeTopics(eligible, lastLowConfidence.topic, `Moved up because confidence in ${lastLowConfidence.topic} was ${lastLowConfidence.confidence}/5.`);
}

export function adaptStudyPlan(sessions: Session[], request: string, history: StudyRecord[] = [], availableSubjects?: Subject[]): PlanChange {
  const q = request.toLowerCase(); let list = sessions.filter(session => !availableSubjects || availableSubjects.some(subject => subject.name === session.subject)).map(s => ({ ...s }));
  const removed: string[] = []; const adjusted: string[] = []; const added: string[] = [];
  let explanation = 'Your plan was adjusted around what you told me.';
  const limitMatch = q.match(/(?:only have|have|got)\s+(\d+)\s*(hour|hr|minute|min)/i);
  const limit = limitMatch ? Number(limitMatch[1]) * (/hour|hr/i.test(limitMatch[2]) ? 60 : 1) : undefined;
  const examSubject = availableSubjects?.find(subject => q.includes(subject.name.toLowerCase()) || q.includes(subject.short.toLowerCase()) || q.includes(subject.exam.toLowerCase()))?.name || (q.includes('ai') || q.includes('artificial intelligence') ? 'Artificial Intelligence' : q.includes('math') ? 'Mathematics' : q.includes('database') || q.includes('sql') ? 'Database Systems' : undefined);
  const examTomorrow = q.includes('tomorrow') && /exam|test|quiz/.test(q);

  if (examTomorrow && examSubject) {
    explanation = `Your ${examSubject} exam is tomorrow, so those topics have been prioritised.`;
    list = prioritizeTopics(list, examSubject, `Moved because your ${examSubject} exam is tomorrow.`);
  }

  const focus = q.match(/focus on\s+(.+?)(?: today|$)/)?.[1];
  if (focus) {
    explanation = `${focus} has been prioritised because you asked to focus on it.`;
    list = prioritizeTopics(list, focus, explanation);
    const requestedSubject = availableSubjects?.find(subject => subject.name.toLowerCase().includes(focus) || subject.short.toLowerCase() === focus || focus.includes(subject.name.toLowerCase()));
    if (requestedSubject && !list.some(session => session.subject === requestedSubject.name && session.status !== 'done')) { const created = createSubjectSession(requestedSubject, list); created.status = 'now'; created.priority = 'High'; created.reason = `Added because you asked to focus on ${requestedSubject.name}.`; list.unshift(created); added.push(`${created.topic} · ${created.minutes} min`); }
  }

  const finished = q.match(/finished\s+(.+?)(?: already|$)/)?.[1];
  if (finished) {
    const index = list.findIndex(s => finished.includes(s.topic.toLowerCase()) || s.topic.toLowerCase().includes(finished));
    if (index >= 0) { removed.push(`${list[index].topic} · ${list[index].minutes} min`); list.splice(index, 1); explanation = `${finished} was removed because you have finished it.`; }
  }

  if (/too tired|exhausted|low energy/.test(q)) {
    const session = list.find(s => s.status !== 'done');
    if (session) { const before = session.minutes; session.minutes = Math.min(before, 20); session.reason = 'Shortened because you said you are tired.'; session.objective = `A gentle, shorter session: ${session.objective}`; if (before !== session.minutes) adjusted.push(`${session.topic} · ${before} → ${session.minutes} min`); }
    explanation = 'Sessions are lighter because you said you are tired.';
  }

  if (/missed|miss(ing)? my morning/.test(q)) {
    const session = list.find(s => s.status !== 'done');
    if (session) { const before = session.minutes; session.time = '18:30'; session.minutes = Math.min(before, 30); session.status = 'now'; session.reason = `Moved because your ${session.subject} session was missed; shortened to keep today realistic.`; adjusted.push(before > 30 ? `${session.topic} · ${before} → ${session.minutes} min` : `${session.topic} · moved to 18:30`); explanation = `Your ${session.subject} session was moved to 18:30 and shortened so the rest of today remains realistic.`; }
  }

  if (limit !== undefined) {
    if (examTomorrow && examSubject) list = prioritizeTopics(list, examSubject, `Moved because your ${examSubject} exam is tomorrow.`);
    let remaining = limit;
    list = list.filter(session => {
      if (session.minutes <= remaining) { remaining -= session.minutes; return true; }
      if (remaining >= 15) { const before = session.minutes; session.minutes = remaining; session.reason = 'Shortened because today’s available study time decreased.'; adjusted.push(`${session.topic} · ${before} → ${remaining} min`); remaining = 0; return true; }
      removed.push(`${session.topic} · ${session.minutes} min`); return false;
    });
    explanation = `Your available time changed to ${limit} minutes${examTomorrow && examSubject ? `. ${examSubject} has been prioritised because its exam is tomorrow` : ''}.`;
  } else if (/rebalance|replan|plan/i.test(q)) {
    const record = [...history].reverse().find(r => r.completed && r.confidence !== undefined && r.confidence <= 2);
    const session = record && list.find(s => s.topic.toLowerCase() === record.topic.toLowerCase());
    if (record && session) {
      list = prioritizeTopics(list, record.topic, `Moved up because confidence dropped to ${record.confidence}/5.`);
      const moved = list.find(s => s.id === session.id)!; const before = moved.minutes; moved.minutes = Math.min(before, 20);
      if (before !== moved.minutes) adjusted.push(`${moved.topic} · ${before} → ${moved.minutes} min`);
      explanation = `A shorter ${moved.topic} session is next because confidence was ${record.confidence}/5.`;
    }
  }

  const moved = list.some((session, index) => session.id !== sessions[index]?.id || session.time !== sessions[index]?.time || session.status !== sessions[index]?.status || session.minutes !== sessions[index]?.minutes);
  if (!moved && removed.length === 0 && adjusted.length === 0 && added.length === 0) explanation = 'Your current plan already fits what you have on your plate; no changes are needed.';
  return { sessions: list, explanation: explainPlanChange(explanation), removed, adjusted, added };
}

export function generateRevisionPlan(records: StudyRecord[]): string[] {
  return [...new Set(records.filter(r => r.completed && r.confidence !== undefined && r.confidence <= 2).map(r => r.topic))];
}

export function evaluateReadiness(masteries: number[], records: StudyRecord[], daysUntilExam: number): Readiness {
  const completed = records.filter(r => r.completed);
  const checkedIn = completed.filter(r => r.confidence !== undefined);
  const average = checkedIn.length ? checkedIn.reduce((total, r) => total + (r.confidence || 0), 0) / checkedIn.length : undefined;
  if (daysUntilExam <= 3 && (masteries.some(m => m < 65) || completed.length === 0 || (average !== undefined && average < 3))) return 'Needs attention';
  if (generateRevisionPlan(records).length || (average !== undefined && average < 3)) return 'Review recommended';
  return 'On track';
}

export function generateObservations(records: StudyRecord[]): string[] {
  const observations: string[] = [];
  const missed = new Map<string, number>();
  records.filter(r => r.missed).forEach(r => missed.set(r.topic, (missed.get(r.topic) || 0) + 1));
  missed.forEach((count, topic) => observations.push(`You postponed ${topic} ${count === 1 ? 'once' : `${count} times`}.`));
  const checked = records.filter(r => r.completed && r.confidence !== undefined);
  const latest = checked[checked.length - 1];
  const previous = latest && checked.slice(0, -1).reverse().find(r => r.topic === latest.topic && r.confidence !== latest.confidence);
  if (latest && previous && latest.confidence! > previous.confidence!) observations.push(`Your confidence in ${latest.topic} increased from ${previous.confidence}/5 to ${latest.confidence}/5.`);
  const timed = records.filter(r => r.completed && r.actualMinutes > 0);
  if (timed.length) {
    const delta = Math.round(timed.reduce((total, r) => total + r.plannedMinutes - r.actualMinutes, 0) / timed.length);
    if (delta >= 2) observations.push(`Your average study session is ${delta} minutes shorter than planned.`);
    else if (delta <= -2) observations.push(`Your average study session runs ${Math.abs(delta)} minutes longer than planned.`);
  }
  const early = records.filter(r => r.completed && r.sessionTime && Number(r.sessionTime.slice(0, 2)) < 11 && r.confidence !== undefined && r.confidence >= 4);
  if (early.length >= 2) observations.push('You usually complete confident check-ins on sessions scheduled before 11 AM.');
  return observations;
}

export const plannerAgent = { create: createStudyPlan };
export const progressAgent = { summary: (records: StudyRecord[] = []) => ({ weeklyMinutes: records.filter(r => r.completed).reduce((total, r) => total + r.actualMinutes, 0), consistency: new Set(records.filter(r => r.completed).map(r => r.at.slice(0, 10))).size, completed: records.filter(r => r.completed).length }) };
export const revisionAgent = { priority: (topic: string, confidence: number) => confidence < 3 ? `${topic} · needs a short recall session` : `${topic} · scheduled for spaced review` };
export const evaluationAgent = { insight: (records: StudyRecord[] = []) => generateObservations(records)[0] || 'Keep studying and Daymark will start noticing your patterns.' };
export const adaptationAgent = { replan: (sessions: Session[], request = '90 minutes today', history: StudyRecord[] = [], availableSubjects?: Subject[]) => adaptStudyPlan(sessions, request, history, availableSubjects) };
