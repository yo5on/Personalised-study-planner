import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  adaptationAgent,
  evaluationAgent,
  progressAgent,
  generateObservations,
  evaluateReadiness,
  addSubject as addSubjectAgent,
  createSubjectSession,
  renameSubjectReferences,
  removeSubjectFromPlanning,
  updateSubjectDetails,
  updateMastery,
  normaliseStatuses,
  sortByTime,
  topicsToRevisit,
  type StudyRecord,
  type StudyOutcome,
  type PlanChange,
} from './services/agents';
import { weekForDate, localDateKey, type Session, type Subject } from './data';
import { DaymarkMark } from './components/DaymarkMark';
import { Dialog } from './components/Dialog';
import { useCountdown } from './hooks/useCountdown';
import { loadDaymarkState, saveDaymarkState, type DaymarkProfile } from './services/storage';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Compass,
  Flame,
  Home,
  Lightbulb,
  Menu,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

type Page = 'Home' | 'Plan' | 'Subjects' | 'Progress' | 'Revision' | 'Insights';
const nav: { name: Page; icon: typeof Home }[] = [
  { name: 'Home', icon: Home },
  { name: 'Plan', icon: CalendarDays },
  { name: 'Subjects', icon: BookOpen },
  { name: 'Progress', icon: Activity },
  { name: 'Revision', icon: RotateCcw },
  { name: 'Insights', icon: Lightbulb },
];
const WEEKLY_GOAL_MINUTES = 540;
// A missed session is only logged once the user accepts the rescheduled plan.
type PendingChange = PlanChange & { missedRecord?: StudyRecord };

function App() {
  const [appState, setAppState] = useState(loadDaymarkState);
  const { sessions, records, profile, subjects: activeSubjects } = appState;
  const today = new Date();
  const todayKey = localDateKey(today);
  const week = weekForDate(today);
  const [page, setPage] = useState<Page>('Home');
  const [replanned, setReplanned] = useState(false);
  const [lastExplanation, setLastExplanation] = useState('');
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [outcome, setOutcome] = useState<StudyOutcome>('understood');
  const [command, setCommand] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const [focus, setFocus] = useState<Session | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [subjectEditor, setSubjectEditor] = useState<{ mode: 'add' | 'rename'; subject?: Subject } | null>(null);
  const [subjectToRemove, setSubjectToRemove] = useState<Subject | null>(null);
  const saveProfile = (next: DaymarkProfile) => setAppState((prev) => ({ ...prev, profile: next }));
  useEffect(() => {
    saveDaymarkState(appState);
  }, [appState]);
  const notify = useCallback((s: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(s);
    toastTimer.current = window.setTimeout(() => setToast(''), 2800);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const timer = useCountdown(useCallback(() => notify('Time’s up. Mark the session complete when you’re ready.'), [notify]));
  const minutes = Math.floor(timer.remaining / 60);
  const seconds = timer.remaining % 60;
  const replan = () => setPending(adaptationAgent.replan(sessions, 'rebalance today', records, activeSubjects));
  const markMissed = (session: Session) => {
    const missedRecord: StudyRecord = {
      sessionId: session.id,
      topic: session.topic,
      subject: session.subject,
      plannedMinutes: session.minutes,
      actualMinutes: 0,
      completed: false,
      missed: true,
      sessionTime: session.time,
      at: new Date().toISOString(),
    };
    setPending({
      ...adaptationAgent.replan(sessions, `missed ${session.topic}`, records, activeSubjects, { missedSessionId: session.id }),
      missedRecord,
    });
  };
  const start = (s: Session) => {
    setFocus(s);
    timer.reset(s.minutes * 60);
    setConfidence(0);
    setOutcome('understood');
    setCheckInOpen(false);
  };
  const closeCheckIn = () => {
    setCheckInOpen(false);
    setConfidence(0);
    setOutcome('understood');
  };
  const complete = () => {
    if (focus && confidence > 0) {
      const elapsedSeconds = focus.minutes * 60 - timer.remaining;
      const actual = Math.max(0, Math.floor(elapsedSeconds / 60));
      const record: StudyRecord = {
        sessionId: focus.id,
        topic: focus.topic,
        subject: focus.subject,
        plannedMinutes: focus.minutes,
        actualMinutes: actual,
        confidence,
        outcome,
        completed: true,
        sessionTime: focus.time,
        at: new Date().toISOString(),
      };
      // Review sessions from the Revision page aren't in the plan, so only the record is saved for them.
      setAppState((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) => (s.name === focus.subject ? { ...s, mastery: updateMastery(s.mastery, confidence) } : s)),
        sessions: normaliseStatuses(prev.sessions.map((s) => (s.id === focus.id ? { ...s, status: 'done' as const, confidence } : s))),
        records: [...prev.records, record],
      }));
      notify('Check-in saved for your next plan.');
    }
    timer.pause();
    setCheckInOpen(false);
    setFocus(null);
  };
  const commandSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    const result = adaptationAgent.replan(sessions, command, records, activeSubjects);
    setPending(result);
  };
  const acceptPending = (change: PendingChange) => {
    const { missedRecord, ...planChange } = change;
    setAppState((prev) => ({
      ...prev,
      sessions: planChange.sessions,
      records: missedRecord ? [...prev.records, missedRecord] : prev.records,
      planChanges: [...prev.planChanges, planChange],
    }));
    setLastExplanation(planChange.explanation);
    setReplanned(true);
    setPending(null);
    setPage('Plan');
    setCommand('');
    notify('Plan changes accepted');
  };
  const summary = progressAgent.summary(records, today);
  const hasObservations = generateObservations(records).length > 0;
  if (focus)
    return (
      <div className="focus-mode">
        <div className="focus-top">
          <button
            className="icon-button"
            onClick={() => {
              const started = timer.remaining < focus.minutes * 60;
              if (started && !window.confirm('Leave this session? Your timer progress won’t be saved.')) return;
              timer.pause();
              setFocus(null);
            }}
            aria-label="Exit session"
          >
            <X size={18} />
          </button>
          <div className="wordmark small-mark">
            <DaymarkMark size={22} /> daymark
          </div>
          <span className="focus-label">FOCUS SESSION</span>
        </div>
        <div className="focus-content">
          <div className="eyebrow">
            {focus.subject.toUpperCase()} <span>·</span> {focus.minutes} MINUTES
          </div>
          <h1>{focus.topic}</h1>
          <p className="focus-objective">{focus.objective}</p>
          <div className="timer" role="timer" aria-label={`${minutes} minutes ${seconds} seconds remaining`}>
            {String(minutes).padStart(2, '0')}
            <i>:</i>
            {String(seconds).padStart(2, '0')}
          </div>
          <div className="timer-caption">A little progress goes a long way.</div>
          <div className="timer-actions">
            <button
              className="button primary"
              onClick={() => (timer.running ? timer.pause() : timer.start())}
              disabled={!timer.running && timer.remaining === 0}
            >
              {timer.running ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
              {timer.running ? 'Pause' : timer.remaining < focus.minutes * 60 && timer.remaining > 0 ? 'Resume' : 'Start focus'}
            </button>
            <button className="button quiet" onClick={() => timer.reset(focus.minutes * 60)}>
              <RotateCcw size={15} /> Reset
            </button>
          </div>
          <div className="session-checklist">
            <div className="section-label">
              A path through this session <span>{focus.minutes} min</span>
            </div>
            {['Recall what you already know', 'Work through one example', 'Check your understanding'].map((x, i) => (
              <label key={x}>
                <input type="checkbox" />
                <span className="fake-check">
                  <Check size={13} />
                </span>
                <span>{x}</span>
                <small>{[5, 12, 8][i]} min</small>
              </label>
            ))}
          </div>
          <button
            className="button complete-button"
            onClick={() => {
              timer.pause();
              setCheckInOpen(true);
            }}
          >
            <Check size={16} /> Mark session complete
          </button>
        </div>
        {checkInOpen && (
          <Dialog onClose={closeCheckIn}>
            <div className="confidence-modal" role="dialog" aria-modal="true" aria-labelledby="check-in-heading">
              <button className="modal-close" onClick={closeCheckIn} aria-label="Close check-in">
                <X size={18} />
              </button>
              <div className="eyebrow">SESSION CHECK-IN</div>
              <h2 id="check-in-heading">How did that feel?</h2>
              <p>Your answer helps us shape the next session.</p>
              <div className="rating" role="group" aria-label="Confidence from 1, still foggy, to 5, feeling good">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    aria-label={`Confidence ${n} of 5`}
                    onClick={() => setConfidence(n)}
                    className={confidence === n ? 'selected' : ''}
                    aria-pressed={confidence === n}
                    key={n}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="rating-ends">
                <span>Still foggy</span>
                <span>Feeling good</span>
              </div>
              <div className="outcome-options">
                <span>What happened?</span>
                {(
                  [
                    ['understood', 'Understood it well'],
                    ['more-time', 'Needed more time'],
                    ['struggled', 'Struggled'],
                    ['unfinished', "Didn't finish"],
                  ] as [StudyOutcome, string][]
                ).map(([v, label]) => (
                  <button
                    type="button"
                    className={outcome === v ? 'chosen' : ''}
                    aria-pressed={outcome === v}
                    onClick={() => setOutcome(v)}
                    key={v}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button className="button primary full" disabled={!confidence} onClick={complete}>
                Save check-in <ArrowRight size={16} />
              </button>
            </div>
          </Dialog>
        )}
      </div>
    );
  return (
    <div className="app-shell">
      {mobileNav && <button className="nav-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`} id="daymark-navigation">
        <div className="brand">
          <DaymarkMark size={27} className="brand-mark" />
          <span>daymark</span>
          <span className="brand-beta">STUDY</span>
        </div>
        <div className="workspace-label">YOUR SPACE</div>
        <nav>
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${page === name ? 'active' : ''}`}
              aria-current={page === name ? 'page' : undefined}
              onClick={() => {
                setPage(name);
                setMobileNav(false);
              }}
            >
              <Icon size={17} strokeWidth={1.8} />
              {name}
              {name === 'Insights' && hasObservations && <span className="nav-dot" aria-label="New observations" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="streak-box"
            onClick={() => {
              setPage('Progress');
              setMobileNav(false);
            }}
          >
            <div className="streak-icon">
              <Flame size={16} />
            </div>
            <div>
              <b>{summary.streak ? `${summary.streak} day streak` : 'Start a streak'}</b>
              <span>
                {summary.streak > 1
                  ? 'You’re finding your rhythm'
                  : summary.streak === 1
                    ? 'A good start. Come back tomorrow'
                    : 'Finish a session to begin'}
              </span>
            </div>
            <ChevronRight size={15} />
          </button>
          <button className="profile" onClick={() => setProfileOpen(true)} aria-label="Edit profile">
            <div className="avatar">{profile.name.trim().charAt(0).toUpperCase()}</div>
            <div className="profile-name">
              <b>{profile.name}</b>
              <span>
                {profile.course} · Year {profile.year}
              </span>
            </div>
            <MoreHorizontal size={18} />
          </button>
          <div className="side-foot">
            <span>Made for the long game.</span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label={mobileNav ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNav}
            aria-controls="daymark-navigation"
          >
            <Menu size={19} />
          </button>
          <div className="breadcrumbs">
            <span>My workspace</span>
            <ChevronRight size={14} />
            <b>{page}</b>
          </div>
          <div className="top-actions">
            <button className="today-button" onClick={() => setPage('Plan')}>
              <CalendarDays size={15} /> {today.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
              <ChevronDown size={14} />
            </button>
            <button
              className="help-button"
              onClick={() => notify('Your study plan is saved on this device.')}
              aria-label="Where is my plan saved?"
            >
              <CircleHelp size={17} />
            </button>
            <button className="top-avatar" onClick={() => setProfileOpen(true)} aria-label="Edit profile">
              {profile.name.trim().charAt(0).toUpperCase()}
            </button>
          </div>
        </header>
        <div className="page-wrap">
          {page === 'Home' ? (
            <HomePage
              explanation={lastExplanation}
              sessions={sessions}
              subjects={activeSubjects}
              records={records}
              week={week}
              todayKey={todayKey}
              today={today}
              onStart={start}
              onReplan={replan}
              command={command}
              setCommand={setCommand}
              submit={commandSubmit}
              replanned={replanned}
              onNavigate={setPage}
              onMissed={markMissed}
            />
          ) : page === 'Plan' ? (
            <PlanPage
              explanation={lastExplanation}
              sessions={sessions}
              subjects={activeSubjects}
              week={week}
              todayKey={todayKey}
              today={today}
              onStart={start}
              onReplan={replan}
              replanned={replanned}
              records={records}
              onNavigate={setPage}
            />
          ) : page === 'Subjects' ? (
            <SubjectsPage
              subjects={activeSubjects}
              records={records}
              onAdd={() => setSubjectEditor({ mode: 'add' })}
              onRename={(subject) => setSubjectEditor({ mode: 'rename', subject })}
              onRemove={(subject) => setSubjectToRemove(subject)}
              onStart={start}
            />
          ) : page === 'Progress' ? (
            <ProgressPage summary={summary} records={records} subjects={activeSubjects} onNavigate={setPage} />
          ) : page === 'Revision' ? (
            <RevisionPage records={records} subjects={activeSubjects} onStart={start} />
          ) : (
            <InsightsPage onReplan={replan} records={records} onNavigate={setPage} />
          )}
        </div>
      </main>
      {subjectEditor && (
        <SubjectEditorModal
          mode={subjectEditor.mode}
          subject={subjectEditor.subject}
          onClose={() => setSubjectEditor(null)}
          onSave={(name, description, examDate) => {
            if (subjectEditor.mode === 'add') {
              const result = addSubjectAgent(activeSubjects, name, description, examDate);
              if (result.error || !result.subject) return result.error || 'Subject could not be added.';
              setAppState((prev) => ({
                ...prev,
                subjects: [...prev.subjects, result.subject!],
                sessions: [...prev.sessions, createSubjectSession(result.subject!, prev.sessions)],
              }));
              notify('Subject added to your plan');
              return null;
            }
            const oldName = subjectEditor.subject!.name;
            const result = renameSubjectReferences(activeSubjects, sessions, records, appState.planChanges, oldName, name);
            if ('error' in result) return result.error;
            const updated = updateSubjectDetails(result.subjects, name.trim(), description, examDate);
            if ('error' in updated) return updated.error;
            setAppState((prev) => ({ ...prev, ...result, subjects: updated }));
            if (oldName !== name.trim()) setLastExplanation((value) => value.split(oldName).join(name.trim()));
            notify(oldName === name.trim() ? 'Subject details saved' : 'Subject name updated everywhere');
            return null;
          }}
        />
      )}
      {subjectToRemove && (
        <RemoveSubjectModal
          subject={subjectToRemove}
          onCancel={() => setSubjectToRemove(null)}
          onConfirm={() => {
            const subject = subjectToRemove;
            setAppState((prev) => ({
              ...prev,
              subjects: prev.subjects.filter((item) => item.name !== subject.name),
              sessions: removeSubjectFromPlanning(prev.sessions, subject.name),
            }));
            setSubjectToRemove(null);
            setPending(null);
            notify('Subject removed from future planning');
          }}
        />
      )}
      {profileOpen && (
        <ProfileModal
          profile={profile}
          onClose={() => setProfileOpen(false)}
          onSave={(next) => {
            saveProfile(next);
            setProfileOpen(false);
            notify('Profile saved');
          }}
        />
      )}
      {pending && (
        <Dialog onClose={() => setPending(null)}>
          <div className="change-modal" role="dialog" aria-modal="true" aria-labelledby="change-heading">
            <button className="modal-close" onClick={() => setPending(null)} aria-label="Close without changing the plan">
              <X size={18} />
            </button>
            <div className="eyebrow">{pending.changed === false ? 'QUICK CHANGE' : 'PLAN ADJUSTED'}</div>
            <h2 id="change-heading">{pending.changed === false ? 'Nothing to change yet.' : 'Here’s what I’d change.'}</h2>
            <p>{pending.explanation}</p>
            {(
              [
                ['Added', pending.added],
                ['Removed', pending.removed],
                ['Adjusted', pending.adjusted],
              ] as const
            ).map(
              ([label, items]) =>
                items.length > 0 && (
                  <div key={label}>
                    <b>{label}</b>
                    {items.map((x, i) => (
                      <span key={`${x}-${i}`}>{x}</span>
                    ))}
                  </div>
                ),
            )}
            {pending.changed !== false && <ProposedDay sessions={pending.sessions.filter((s) => (s.date || todayKey) === todayKey)} />}
            <div className="proposal-actions">
              {pending.changed === false ? (
                <button className="button primary" onClick={() => setPending(null)}>
                  Got it
                </button>
              ) : (
                <>
                  <button className="button primary" onClick={() => acceptPending(pending)}>
                    Accept changes
                  </button>
                  <button className="button outline" onClick={() => setPending(null)}>
                    Keep current plan
                  </button>
                </>
              )}
            </div>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-check">
            <Check size={14} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

function ProposedDay({ sessions }: { sessions: Session[] }) {
  const ordered = sortByTime(sessions);
  return (
    <div className="proposed-sessions">
      <b>Today · {ordered.filter((s) => s.status !== 'done').reduce((n, s) => n + s.minutes, 0)} min still to study</b>
      {ordered.length ? (
        ordered.map((s) => (
          <span key={s.id} className={s.status === 'done' ? 'is-done' : ''}>
            {s.topic} · {s.minutes} min{s.status === 'done' ? ' · done' : ''} <small>{s.time}</small>
          </span>
        ))
      ) : (
        <span>No sessions left today.</span>
      )}
    </div>
  );
}

function ProfileModal({
  profile,
  onClose,
  onSave,
}: {
  profile: DaymarkProfile;
  onClose: () => void;
  onSave: (profile: DaymarkProfile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [course, setCourse] = useState(profile.course);
  const [year, setYear] = useState(profile.year);
  return (
    <Dialog onClose={onClose}>
      <form
        className="confidence-modal profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-heading"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name: name.trim(), course: course.trim(), year: year.trim() });
        }}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close profile">
          <X size={18} />
        </button>
        <div className="eyebrow">YOUR PROFILE</div>
        <h2 id="profile-heading">A little about you.</h2>
        <label>
          Name
          <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Course
          <input required maxLength={80} value={course} onChange={(e) => setCourse(e.target.value)} />
        </label>
        <label>
          Year
          <input required maxLength={20} value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
        <button className="button primary full" type="submit" disabled={!name.trim() || !course.trim() || !year.trim()}>
          Save profile
        </button>
      </form>
    </Dialog>
  );
}

function SubjectEditorModal({
  mode,
  subject,
  onClose,
  onSave,
}: {
  mode: 'add' | 'rename';
  subject?: Subject;
  onClose: () => void;
  onSave: (name: string, description: string, examDate: string) => string | null;
}) {
  const [name, setName] = useState(subject?.name || '');
  const [description, setDescription] = useState(subject?.description || '');
  const [examDate, setExamDate] = useState(subject?.examDate || '');
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const issue = onSave(name, description, examDate);
    if (issue) {
      setError(issue);
      return;
    }
    onClose();
  };
  return (
    <Dialog onClose={onClose}>
      <form
        className="confidence-modal profile-modal subject-editor"
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subject-editor-heading"
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className="eyebrow">{mode === 'add' ? 'YOUR STUDY SPACE' : 'SUBJECT DETAILS'}</div>
        <h2 id="subject-editor-heading">{mode === 'add' ? 'Add a subject.' : 'Edit subject.'}</h2>
        <p>
          {mode === 'add'
            ? 'A subject gives Daymark a place to organise sessions, progress and revision.'
            : 'A new name will be used across your plan and study history.'}
        </p>
        <label>
          Subject name
          <input
            required
            maxLength={80}
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
            placeholder="e.g. Biology"
          />
        </label>
        <label>
          Description or study focus <span className="optional-label">Optional</span>
          <input
            maxLength={120}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="e.g. Cell structure and genetics"
          />
        </label>
        <label>
          Exam date <span className="optional-label">Optional</span>
          <input
            type="date"
            value={examDate}
            onChange={(event) => {
              setExamDate(event.target.value);
              setError('');
            }}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="proposal-actions">
          <button className="button primary" type="submit" disabled={!name.trim()}>
            {mode === 'add' ? 'Add subject' : 'Save changes'}
          </button>
          <button className="button outline" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function RemoveSubjectModal({ subject, onCancel, onConfirm }: { subject: Subject; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog onClose={onCancel}>
      <section className="confidence-modal remove-modal" role="alertdialog" aria-modal="true" aria-labelledby="remove-heading">
        <button className="modal-close" onClick={onCancel} aria-label="Cancel removal">
          <X size={18} />
        </button>
        <div className="eyebrow">REMOVE SUBJECT</div>
        <h2 id="remove-heading">Remove {subject.name}?</h2>
        <p>Its future sessions will leave your plan. Saved check-ins and progress history will stay on this device.</p>
        <div className="proposal-actions">
          <button className="button destructive" onClick={onConfirm}>
            Remove subject
          </button>
          <button className="button outline" onClick={onCancel} autoFocus>
            Keep subject
          </button>
        </div>
      </section>
    </Dialog>
  );
}

function HomePage({
  explanation,
  sessions,
  subjects: activeSubjects,
  records,
  week,
  todayKey,
  today,
  onStart,
  onReplan,
  command,
  setCommand,
  submit,
  replanned,
  onNavigate,
  onMissed,
}: {
  explanation: string;
  sessions: Session[];
  subjects: Subject[];
  records: StudyRecord[];
  week: ReturnType<typeof weekForDate>;
  todayKey: string;
  today: Date;
  onStart: (s: Session) => void;
  onReplan: () => void;
  command: string;
  setCommand: (s: string) => void;
  submit: (e: FormEvent) => void;
  replanned: boolean;
  onNavigate: (p: Page) => void;
  onMissed: (s: Session) => void;
}) {
  const todaySessions = sortByTime(sessions.filter((s) => (s.date || todayKey) === todayKey));
  const active = todaySessions.find((s) => s.status === 'now') || todaySessions.find((s) => s.status !== 'done');
  const completeCount = todaySessions.filter((s) => s.status === 'done').length;
  const plannedMinutes = todaySessions.reduce((sum, s) => sum + s.minutes, 0);
  const { weeklyMinutes, weeklyCompleted } = progressAgent.summary(records, today);
  const revisit = topicsToRevisit(records, 3)
    .filter((r) => activeSubjects.some((s) => s.name === r.subject))
    .slice(0, 3);
  return (
    <>
      <div className="greeting-row">
        <div>
          <div className="eyebrow">
            {today.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}{' '}
            <span className="sun-mark">☀</span>
          </div>
          <h1>
            Make today <em>count.</em>
          </h1>
          <p className="subhead">A clear head starts with a clear next step.</p>
        </div>
        <button className="button outline" onClick={onReplan}>
          <RotateCcw size={15} /> Replan my day
        </button>
      </div>
      <div className="dashboard-grid">
        <section className="today-feature">
          <div className="feature-top">
            <div className="eyebrow">
              YOUR NEXT SESSION <span className="live-dot" />
            </div>
            <button className="feature-more" onClick={() => onNavigate('Plan')} aria-label="Open study plan">
              <MoreHorizontal size={19} />
            </button>
          </div>
          {active ? (
            <>
              <div className="feature-subject">
                <span className="subject-chip" style={{ background: active.tint }}>
                  {active.subject.slice(0, 4).toUpperCase()}
                </span>
                <span>{active.subject}</span>
                <span className="bullet">·</span>
                <span>{active.minutes} min</span>
              </div>
              <h2>{active.topic}</h2>
              <p className="feature-description">{active.objective}</p>
              <div className="focus-progress">
                <div className="progress-track">
                  <span style={{ width: `${todaySessions.length ? (completeCount / todaySessions.length) * 100 : 0}%` }} />
                </div>
                <span>
                  {completeCount}/{todaySessions.length} sessions today
                </span>
              </div>
              <div className="feature-footer">
                <button className="button primary" onClick={() => onStart(active)}>
                  <Play size={15} fill="currentColor" /> Start session <ArrowRight size={15} />
                </button>
                <span>
                  <Clock3 size={14} /> {active.time} · {active.priority} priority
                </span>
              </div>
              <div className="corner-mark">✳</div>
            </>
          ) : todaySessions.length ? (
            <div className="empty-panel">
              <h2>Today’s sessions are done.</h2>
              <p>
                You finished {completeCount} {completeCount === 1 ? 'session' : 'sessions'} today. A short review on the Revision page will
                help it stick.
              </p>
              <button className="button primary" onClick={() => onNavigate('Revision')}>
                <RotateCcw size={15} /> Open revision
              </button>
            </div>
          ) : (
            <div className="empty-panel">
              <h2>A little space to begin.</h2>
              <p>
                {activeSubjects.length
                  ? 'Nothing is planned for today yet. Ask for a quick change, such as “focus on Mathematics”, to add a session.'
                  : 'Add a subject and Daymark will help make a first study plan.'}
              </p>
              <button className="button primary" onClick={() => onNavigate('Subjects')}>
                <Plus size={15} /> {activeSubjects.length ? 'Manage subjects' : 'Add a subject'}
              </button>
            </div>
          )}
        </section>
        <section className="day-summary">
          <div className="section-head">
            <div>
              <div className="eyebrow">YOUR DAY</div>
              <h3>Room to focus</h3>
            </div>
            <button className="text-button" onClick={() => onNavigate('Plan')}>
              Full plan <ArrowRight size={14} />
            </button>
          </div>
          <div className="availability">
            <div className="availability-num">
              {Math.floor(plannedMinutes / 60)}
              <span>h</span> {plannedMinutes % 60}
              <span>m</span>
            </div>
            <span>planned today</span>
          </div>
          <div className="summary-rule" />
          <div className="summary-stats">
            <div>
              <span>{todaySessions.length}</span>
              <small>sessions</small>
            </div>
            <div>
              <span>{new Set(todaySessions.map((s) => s.subject)).size}</span>
              <small>subjects</small>
            </div>
            <div>
              <span>
                {
                  activeSubjects.filter((s) => {
                    const days = s.examDate ? daysUntilDate(s.examDate, today) : -1;
                    return days >= 0 && days <= 7;
                  }).length
                }
              </span>
              <small>exams soon</small>
            </div>
          </div>
          <div className="day-note">
            <span>↗</span> A lighter evening leaves room to recharge.
          </div>
        </section>
        <section className="schedule-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">ON THE AGENDA</div>
              <h3>Today, in order</h3>
            </div>
            <button className="date-link" onClick={() => onNavigate('Plan')}>
              {today.toLocaleDateString('en', { month: 'short', day: 'numeric' })} <ChevronRight size={14} />
            </button>
          </div>
          <div className="timeline">
            {todaySessions.length ? (
              todaySessions.map((s) => (
                <div className={`timeline-row ${s.status === 'done' ? 'is-done' : ''}`} key={s.id}>
                  <div className="time-col">
                    {s.time}
                    <span />
                  </div>
                  <div className="timeline-line">
                    <span className={`timeline-node ${s.status === 'now' ? 'node-now' : ''}`} />
                  </div>
                  <div className="timeline-content">
                    <button className="timeline-main" onClick={() => onStart(s)} disabled={s.status === 'done'}>
                      <div className="timeline-title">
                        <b>{s.topic}</b>
                        {s.status === 'now' && <span className="now-tag">UP NEXT</span>}
                      </div>
                      <div className="timeline-meta">
                        <span className="mini-subject" style={{ background: s.tint }}>
                          {s.subject}
                        </span>
                        <span>·</span>
                        <span>{s.minutes} min</span>
                        <span>·</span>
                        <span>{s.priority} priority</span>
                      </div>
                    </button>
                    {s.status === 'done' ? (
                      <span className="done-icon">
                        <Check size={14} />
                      </span>
                    ) : (
                      <span className="row-actions">
                        <button className="row-play" onClick={() => onStart(s)} aria-label={`Start ${s.topic}`}>
                          <Play size={13} fill="currentColor" />
                        </button>
                        <button className="missed-button" onClick={() => onMissed(s)}>
                          Missed
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-copy">No sessions planned today. Your week still has room for a fresh start.</p>
            )}
          </div>
        </section>
        <section className="right-column">
          <div className="week-card">
            <div className="section-head">
              <div>
                <div className="eyebrow">YOUR RHYTHM</div>
                <h3>This week</h3>
              </div>
              <button className="dots-button" onClick={() => onNavigate('Progress')} aria-label="Open progress">
                <MoreHorizontal size={19} />
              </button>
            </div>
            <div className="week-strip">
              {week.map((d) => (
                <button
                  className={`week-day ${d.dateKey === todayKey ? 'selected' : ''}`}
                  key={d.dateKey}
                  onClick={() => onNavigate('Plan')}
                >
                  <span>{d.day}</span>
                  <b>{d.date}</b>
                  <i>
                    {sessions
                      .filter((s) => (s.date || todayKey) === d.dateKey)
                      .map((s) => (
                        <u key={s.id} style={{ background: s.tint }} />
                      ))}
                  </i>
                </button>
              ))}
            </div>
            <div className="week-bottom">
              <div>
                <span className="week-hours">
                  {Math.floor(weeklyMinutes / 60)}h {weeklyMinutes % 60}m
                </span>
                <span className="week-caption">focused in logged sessions this week</span>
              </div>
              <span className="trend-pill" title="Sessions completed this week">
                <ArrowUpRight size={13} /> {weeklyCompleted}
              </span>
            </div>
            <div className="weekly-bar">
              <i
                style={{
                  width: `${Math.min(100, (weeklyMinutes / WEEKLY_GOAL_MINUTES) * 100)}%`,
                }}
              />
            </div>
            <div className="week-target">
              <span>Weekly goal</span>
              <span>
                9h <b>·</b> {Math.min(100, Math.round((weeklyMinutes / WEEKLY_GOAL_MINUTES) * 100))}%
              </span>
            </div>
          </div>
          <div className="focus-areas">
            <div className="section-head">
              <div>
                <div className="eyebrow">A LITTLE ATTENTION</div>
                <h3>Worth a revisit</h3>
              </div>
              <button className="text-button" onClick={() => onNavigate('Revision')}>
                All topics <ArrowRight size={14} />
              </button>
            </div>
            {revisit.length
              ? revisit.map((record, i) => (
                  <button className="focus-topic" key={`${record.subject}-${record.topic}`} onClick={() => onNavigate('Revision')}>
                    <span className={`topic-symbol ${i === 0 ? 'warm' : 'lilac'}`}>↺</span>
                    <span>
                      <b>{record.topic}</b>
                      <small>
                        {record.subject} · Confidence {record.confidence}/5
                      </small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))
              : activeSubjects.slice(0, 3).map((subject) => (
                  <button className="focus-topic" key={subject.name} onClick={() => onNavigate('Revision')}>
                    <span className={`topic-symbol ${['warm', 'lilac', 'green'][activeSubjects.indexOf(subject)]}`}>↺</span>
                    <span>
                      <b>{subject.needsWork}</b>
                      <small>{subject.name} · A good topic to revisit</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
          </div>
        </section>
        <section className="command-section">
          <div className="command-icon">
            <Command size={17} />
          </div>
          <div className="command-copy">
            <span className="eyebrow">A QUICK CHANGE?</span>
            <b>Tell your planner what’s different.</b>
            <small>It’ll reshuffle the day around you.</small>
          </div>
          <form onSubmit={submit}>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g. I only have 90 minutes today…"
              aria-label="Tell your planner what’s different today"
              maxLength={200}
            />
            <button type="submit" aria-label="Update plan" disabled={!command.trim()}>
              <ArrowRight size={17} />
            </button>
          </form>
        </section>
      </div>
      {replanned && (
        <div className="change-note">
          <span className="change-icon">
            <Sparkles size={15} />
          </span>
          <div>
            <b>Your plan has been reshaped for today.</b>
            <span>
              {explanation}{' '}
              <button onClick={() => onNavigate('Plan')}>
                See what changed <ArrowRight size={13} />
              </button>
            </span>
          </div>
        </div>
      )}
    </>
  );
}

const CALENDAR_TOP = 38;
const HOUR_HEIGHT = 40;
function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}
function daysUntilDate(value: string, today: Date): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 365;
  const [year, month, day] = value.split('-').map(Number);
  return Math.ceil((Date.UTC(year, month - 1, day) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}
function examCountdown(subject: Subject, today: Date) {
  if (!subject.examDate) return subject.examIn || 'No exam date';
  const days = daysUntilDate(subject.examDate, today);
  if (days < 0) return 'Past';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}
function weekRange(week: ReturnType<typeof weekForDate>) {
  const start = new Date(`${week[0].dateKey}T12:00:00`);
  const end = new Date(`${week[6].dateKey}T12:00:00`);
  const a = start.toLocaleDateString('en', { month: 'long', day: 'numeric' }),
    b = end.toLocaleDateString('en', { month: 'long', day: 'numeric' });
  return `${a} – ${b}`;
}
function PlanPage({
  explanation,
  sessions,
  subjects,
  week,
  todayKey,
  today,
  onStart,
  onReplan,
  replanned,
  records,
  onNavigate,
}: {
  explanation: string;
  sessions: Session[];
  subjects: Subject[];
  week: ReturnType<typeof weekForDate>;
  todayKey: string;
  today: Date;
  onStart: (s: Session) => void;
  onReplan: () => void;
  replanned: boolean;
  records: StudyRecord[];
  onNavigate: (p: Page) => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const shownWeek = weekOffset ? weekForDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + weekOffset * 7)) : week;
  const todaySessions = sortByTime(sessions.filter((s) => (s.date || todayKey) === todayKey));
  const weekStart = shownWeek[0].dateKey;
  const weekEnd = shownWeek[6].dateKey;
  const visibleSessions = sessions.filter((s) => (s.date || todayKey) >= weekStart && (s.date || todayKey) <= weekEnd);
  // Show 08:00–18:00 by default and stretch to fit sessions planned earlier or later.
  const startHour = Math.min(8, ...visibleSessions.map((s) => Math.floor(timeToMinutes(s.time) / 60)));
  const endHour = Math.min(24, Math.max(18, ...visibleSessions.map((s) => Math.ceil((timeToMinutes(s.time) + s.minutes) / 60))));
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => `${String(startHour + i).padStart(2, '0')}:00`);
  const legend = subjects.filter((subject) => visibleSessions.some((s) => s.subject === subject.name));
  const examSubjects = subjects
    .filter((s) => s.examDate && daysUntilDate(s.examDate, today) >= 0)
    .sort((a, b) => daysUntilDate(a.examDate!, today) - daysUntilDate(b.examDate!, today))
    .slice(0, 3);
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">A PLAN THAT BENDS WITH YOU</div>
          <h1>Your study plan.</h1>
          <p className="subhead">A steady rhythm, built around the things that matter.</p>
        </div>
        <button className="button primary" onClick={onReplan}>
          <RotateCcw size={15} /> Replan
        </button>
      </div>
      <div className="planner-toolbar">
        <div className="week-navigation">
          <button onClick={() => setWeekOffset((offset) => offset - 1)} aria-label="Previous week">
            <ChevronLeft size={16} />
          </button>
          <b aria-live="polite">{weekRange(shownWeek)}</b>
          <button onClick={() => setWeekOffset((offset) => offset + 1)} aria-label="Next week">
            <ChevronRight size={16} />
          </button>
          <button className="today-pill" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
            Today
          </button>
        </div>
        <button className="button outline add-button" onClick={() => onNavigate('Subjects')}>
          <Plus size={15} /> Manage subjects
        </button>
      </div>
      {replanned && (
        <div className="replan-explanation">
          <span className="change-icon">
            <Sparkles size={16} />
          </span>
          <div>
            <b>A small shift, with a reason.</b>
            <span>{explanation || sessions.find((s) => s.reason)?.reason || 'Your plan reflects the changes you accepted.'}</span>
          </div>
        </div>
      )}
      <div className="planner-layout">
        <div className="week-calendar">
          <div className="calendar-head">
            <div className="time-spacer" />
            {shownWeek.map((d) => (
              <div className={`calendar-day ${d.dateKey === todayKey ? 'today' : ''}`} key={d.dateKey}>
                <span>{d.day}</span>
                <b>{d.date}</b>
              </div>
            ))}
          </div>
          <div className="calendar-body" style={{ height: `${CALENDAR_TOP + (endHour - startHour) * HOUR_HEIGHT + 32}px` }}>
            <div className="time-labels">
              {hours.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            {shownWeek.map((d) => (
              <div className={`calendar-column ${d.dateKey === todayKey ? 'today' : ''}`} key={d.dateKey}>
                {visibleSessions
                  .filter((s) => (s.date || todayKey) === d.dateKey)
                  .map((s) => {
                    const offset = Math.max(0, timeToMinutes(s.time) - startHour * 60);
                    const done = s.status === 'done';
                    return (
                      <button
                        className={`calendar-session ${done ? 'is-done' : ''}`}
                        style={{ top: `${CALENDAR_TOP + (offset / 60) * HOUR_HEIGHT}px`, background: s.tint, borderColor: s.tint }}
                        key={s.id}
                        onClick={() => onStart(s)}
                        disabled={done}
                        aria-label={`${s.subject}: ${s.topic}, ${s.time}, ${s.minutes} minutes${done ? ', done' : ''}`}
                      >
                        <b>{s.subject}</b>
                        <span>{s.topic}</span>
                        <small>
                          {s.time} · {s.minutes} min{done ? ' · done' : ''}
                        </small>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
          <div className="calendar-foot">
            {legend.map((subject) => (
              <span key={subject.name}>
                <i className="legend-dot" style={{ background: subject.color }} /> {subject.short || subject.name}
              </span>
            ))}
            <span>{visibleSessions.length ? 'Click a session to focus' : 'No sessions planned this week'}</span>
          </div>
        </div>
        <aside className="plan-aside">
          <div className="aside-block">
            <div className="eyebrow">COMING UP</div>
            <h3>Exams on the horizon</h3>
            {examSubjects.length ? (
              examSubjects.map((s) => {
                const days = daysUntilDate(s.examDate!, today);
                return (
                  <div className="exam-row" key={s.name}>
                    <span className="exam-color" style={{ background: s.color }}>
                      {s.short.slice(0, 1)}
                    </span>
                    <span>
                      <b>{s.exam}</b>
                      <small>{s.name}</small>
                      <small className="readiness-label">
                        {evaluateReadiness(
                          [s.mastery],
                          records.filter((r) => r.subject === s.name),
                          Math.max(0, days),
                        )}
                      </small>
                    </span>
                    <strong className={days <= 3 ? 'urgent' : ''}>{examCountdown(s, today)}</strong>
                  </div>
                );
              })
            ) : (
              <p className="empty-copy">Add an exam date to see readiness and countdowns here.</p>
            )}
          </div>
          <div className="aside-block intention">
            <span className="intention-icon">
              <Compass size={16} />
            </span>
            <div>
              <b>Keep the week in balance</b>
              <p>Replanning only reshapes what’s left of today. Finished sessions and other days stay as they are.</p>
            </div>
          </div>
          <button className="button outline full" onClick={onReplan}>
            <RotateCcw size={15} /> Rebalance today
          </button>
        </aside>
      </div>
      <div className="agenda-list">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              {today.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
            </div>
            <h3>Today’s sessions</h3>
          </div>
          <span className="agenda-total">{todaySessions.reduce((n, s) => n + s.minutes, 0)} min planned</span>
        </div>
        {todaySessions.length ? (
          todaySessions.map((s) => (
            <button
              className={`agenda-row ${s.status === 'done' ? 'is-done' : ''}`}
              key={s.id}
              onClick={() => onStart(s)}
              disabled={s.status === 'done'}
            >
              <span className="agenda-time">{s.time}</span>
              <span className="agenda-stripe" style={{ background: s.tint }} />
              <span className="agenda-copy">
                <b>{s.topic}</b>
                <small>
                  {s.subject} <span>·</span> {s.objective.slice(0, 70)}
                  {s.objective.length > 70 ? '…' : ''}
                </small>
              </span>
              <span className="priority-tag">{s.status === 'done' ? 'Done' : `${s.priority} priority`}</span>
              <span className="agenda-duration">{s.minutes} min</span>
              <ChevronRight size={16} />
            </button>
          ))
        ) : (
          <p className="empty-copy">
            {subjects.length
              ? 'Your day is clear. Use Quick change on Home, for example “focus on a subject”, to plan a session.'
              : 'Your day is clear. Add a subject to plan your next session.'}
          </p>
        )}
      </div>
    </>
  );
}

function SubjectsPage({
  subjects,
  records,
  onAdd,
  onRename,
  onRemove,
}: {
  subjects: Subject[];
  records: StudyRecord[];
  onAdd: () => void;
  onRename: (subject: Subject) => void;
  onRemove: (subject: Subject) => void;
  onStart: (session: Session) => void;
}) {
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">THE BIG PICTURE</div>
          <h1>What you’re learning.</h1>
          <p className="subhead">Strengths worth keeping. Gaps worth closing.</p>
        </div>
        <button className="button outline" onClick={onAdd}>
          <Plus size={15} /> Add subject
        </button>
      </div>
      {subjects.length ? (
        <>
          <div className="subject-grid">
            {subjects.map((s) => {
              const latest = [...records].reverse().find((r) => r.subject === s.name && r.confidence !== undefined);
              return (
                <article className="subject-card" key={s.name}>
                  <div className="subject-card-top">
                    <span className="subject-avatar" style={{ background: s.color }}>
                      {s.short}
                    </span>
                    <div className="subject-actions">
                      <button className="dots-button" onClick={() => onRename(s)} aria-label={`Edit ${s.name}`} title="Edit subject">
                        <MoreHorizontal size={18} />
                      </button>
                      <button className="subject-remove" onClick={() => onRemove(s)} aria-label={`Remove ${s.name}`} title="Remove subject">
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="eyebrow">
                    {s.short} <span>·</span> {s.examDate ? `EXAM ${examCountdown(s, new Date()).toUpperCase()}` : 'NO EXAM DATE'}
                  </div>
                  <h2>{s.name}</h2>
                  {s.description && <p className="subject-description">{s.description}</p>}
                  <div className="mastery-row">
                    <span>Estimated mastery</span>
                    <b>{s.mastery}%</b>
                  </div>
                  <div className="mastery-track">
                    <i style={{ width: `${s.mastery}%`, background: s.color }} />
                  </div>
                  <div className="subject-insights">
                    <div>
                      <span className="insight-check">↗</span>
                      <span>
                        <small>Coming along</small>
                        <b>{s.strong}</b>
                      </span>
                    </div>
                    <div>
                      <span className="insight-warn">✳</span>
                      <span>
                        <small>Needs a bit more</small>
                        <b>{s.needsWork}</b>
                      </span>
                    </div>
                  </div>
                  <div className="subject-card-foot">
                    <span>
                      <RotateCcw size={14} /> {latest ? `Last check-in · ${latest.confidence}/5` : 'Ready to begin'}
                    </span>
                    <b>{examCountdown(s, new Date())}</b>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="subject-bottom-note">
            <span className="note-star">✳</span>
            <p>
              <b>Mastery is a moving picture.</b> Each confidence check-in nudges it up or down, so it reflects how sessions actually felt,
              not just what you’ve finished.
            </p>
          </div>
        </>
      ) : (
        <div className="subjects-empty">
          <span className="subjects-empty-icon">
            <BookOpen size={21} />
          </span>
          <h2>Your next chapter starts here.</h2>
          <p>Add a subject to build your first study plan. Daymark will keep its sessions, progress and revision connected as you go.</p>
          <button className="button primary" onClick={onAdd}>
            <Plus size={15} /> Add your first subject
          </button>
        </div>
      )}
    </>
  );
}

function ProgressPage({
  summary,
  records,
  subjects,
  onNavigate,
}: {
  summary: ReturnType<typeof progressAgent.summary>;
  records: StudyRecord[];
  subjects: Subject[];
  onNavigate: (p: Page) => void;
}) {
  const mins = summary.weeklyMinutes;
  const goal = Math.min(100, Math.round((mins / WEEKLY_GOAL_MINUTES) * 100));
  const todayKey = localDateKey(new Date());
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">SMALL STEPS ADD UP</div>
          <h1>Your progress.</h1>
          <p className="subhead">A little perspective on the work you’ve put in.</p>
        </div>
        <span className="today-button">
          <CalendarDays size={15} /> This week
        </span>
      </div>
      <div className="progress-metrics">
        <div className="metric">
          <span>FOCUSED THIS WEEK</span>
          <b>
            {Math.floor(mins / 60)}
            <span>h</span> {mins % 60}
            <span>m</span>
          </b>
          <small>
            {summary.weeklyCompleted} logged {summary.weeklyCompleted === 1 ? 'session' : 'sessions'} this week
          </small>
        </div>
        <div className="metric">
          <span>SESSIONS COMPLETE</span>
          <b>{summary.completed}</b>
          <small>Completed and checked in</small>
        </div>
        <div className="metric">
          <span>STUDY STREAK</span>
          <b>
            {summary.streak}
            <span> {summary.streak === 1 ? 'day' : 'days'}</span>
          </b>
          <small>Built one study day at a time</small>
        </div>
        <div className="metric">
          <span>WEEKLY GOAL</span>
          <b>
            {goal}
            <span>%</span>
          </b>
          <div
            className="metric-track"
            role="progressbar"
            aria-label="Weekly goal"
            aria-valuenow={goal}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${goal}%` }} />
          </div>
        </div>
      </div>
      <div className="progress-panels">
        <section className="panel chart-panel">
          <div className="section-head">
            <div>
              <div className="eyebrow">STUDY TIME</div>
              <h3>Your week, so far</h3>
            </div>
            <span className="chart-legend">
              <i /> This week
            </span>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={`Study time this week: ${summary.week.map((d) => `${d.day} ${d.minutes} minutes`).join(', ')}`}
          >
            {summary.week.map((d) => {
              const hours = Math.round((d.minutes / 60) * 10) / 10;
              return (
                <div className="bar-group" key={d.dateKey}>
                  <span className="bar-value">{d.minutes ? (d.minutes < 60 ? `${d.minutes}m` : `${hours}h`) : ''}</span>
                  <i style={{ height: `${Math.min(100, (d.minutes / 60) * 28)}px` }} />
                  <small>{d.day.charAt(0)}</small>
                </div>
              );
            })}
          </div>
          <div className="chart-foot">
            <span>
              {Math.floor(mins / 60)}h {mins % 60}m logged this week
            </span>
            <span>Goal · {WEEKLY_GOAL_MINUTES / 60} hours</span>
          </div>
        </section>
        <section className="panel mastery-panel">
          <div className="section-head">
            <div>
              <div className="eyebrow">BY SUBJECT</div>
              <h3>Where you stand</h3>
            </div>
            <button className="text-button" onClick={() => onNavigate('Subjects')}>
              Details <ArrowRight size={14} />
            </button>
          </div>
          {subjects.length ? (
            subjects.map((s) => (
              <div className="mastery-line" key={s.name}>
                <span className="mastery-swatch" style={{ background: s.color }} />
                <span className="mastery-name">{s.name}</span>
                <div className="mastery-track">
                  <i style={{ width: `${s.mastery}%`, background: s.color }} />
                </div>
                <b>{s.mastery}%</b>
              </div>
            ))
          ) : (
            <p className="empty-copy">Add a subject to see where you stand.</p>
          )}
        </section>
        <section className="panel consistency-panel">
          <div className="section-head">
            <div>
              <div className="eyebrow">CONSISTENCY</div>
              <h3>Showing up matters.</h3>
            </div>
          </div>
          <div className="consistency-big">
            {summary.consistency} <span>study {summary.consistency === 1 ? 'day' : 'days'} logged</span>
          </div>
          <div className="consistency-dots">
            {summary.week.map((d) => (
              <div
                key={d.dateKey}
                title={`${d.day}: ${d.completed ? `${d.completed} ${d.completed === 1 ? 'session' : 'sessions'}, ${d.minutes} min` : d.dateKey > todayKey ? 'still to come' : 'no sessions'}`}
              >
                <span className={d.completed ? 'filled' : ''}>{d.completed > 0 && <Check size={13} />}</span>
                <small>{d.day.charAt(0)}</small>
              </div>
            ))}
          </div>
          <p className="consistency-copy">
            {records.length
              ? 'Your saved check-ins keep this picture grounded in the work you actually did.'
              : 'Your study rhythm will take shape as you log sessions.'}
          </p>
        </section>
        <section className="panel progress-insight">
          <span className="insight-icon">
            <Lightbulb size={17} />
          </span>
          <div>
            <div className="eyebrow">A PATTERN WE NOTICED</div>
            <h3>{evaluationAgent.insight(records)}</h3>
            <p>Based on saved sessions and check-ins.</p>
          </div>
          <button className="text-button" onClick={() => onNavigate('Insights')}>
            Explore <ArrowRight size={14} />
          </button>
        </section>
      </div>
    </>
  );
}

function RevisionPage({ records, subjects, onStart }: { records: StudyRecord[]; subjects: Subject[]; onStart: (s: Session) => void }) {
  const candidates = topicsToRevisit(records, 2)
    .filter((record) => subjects.some((subject) => subject.name === record.subject))
    .map((record) => ({ topic: record.topic, subject: record.subject, confidence: record.confidence!, estimated: false }));
  const items = candidates.length
    ? candidates
    : subjects.map((subject) => ({
        topic: subject.needsWork,
        subject: subject.name,
        confidence: Math.max(1, Math.round((100 - subject.mastery) / 20)),
        estimated: true,
      }));
  // Negative ids keep review sessions from ever colliding with a session in the plan.
  const sessions: Session[] = items.map((item, i) => ({
    id: -(i + 1),
    time: '14:00',
    date: localDateKey(new Date()),
    subject: item.subject,
    topic: item.topic,
    minutes: 20,
    status: 'now' as const,
    priority: item.confidence <= 2 ? ('High' as const) : ('Medium' as const),
    tint: subjects.find((subject) => subject.name === item.subject)?.color || '#efeff8',
    objective: `Recall the key ideas in ${item.topic}, then check what still needs practice.`,
    confidence: item.estimated ? undefined : item.confidence,
  }));
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">REMEMBER WHAT YOU LEARN</div>
          <h1>Revision, right on time.</h1>
          <p className="subhead">Short, spaced check-ins help knowledge stick.</p>
        </div>
        {sessions[0] && (
          <button className="button primary" onClick={() => onStart(sessions[0])}>
            <Play size={15} fill="currentColor" /> Start a review
          </button>
        )}
      </div>
      <div className="revision-intro">
        <div className="revision-calendar">
          <RotateCcw size={19} />
        </div>
        <div>
          <b>{items.length ? 'A good day for a little recall.' : 'A clear start for spaced practice.'}</b>
          <p>
            {items.length
              ? candidates.length
                ? 'These topics are due for a check-in based on your saved confidence and study history.'
                : 'No low-confidence check-ins yet, so these are the topics each subject lists as needing work.'
              : 'Add a subject and Daymark will suggest useful topics to revisit.'}
          </p>
        </div>
        <span>{items.length} topics ready</span>
      </div>
      {items.length ? (
        <div className="revision-list">
          {items.map((item, i) => (
            <div className="revision-row" key={`${item.subject}-${item.topic}`}>
              <span className={`revision-number ${item.confidence <= 2 ? 'high' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
              <div className="revision-topic">
                <b>{item.topic}</b>
                <small>{item.subject}</small>
              </div>
              <div className="confidence-meter">
                <span>{item.estimated ? 'Estimated confidence' : 'Confidence'}</span>
                <b>{item.confidence} / 5</b>
                <i>
                  <u style={{ width: `${item.confidence * 20}%` }} />
                </i>
              </div>
              <div className="revision-due">
                <span>Next check-in</span>
                <b>Today</b>
              </div>
              <button className="button outline" onClick={() => onStart(sessions[i])} aria-label={`Review ${item.topic}`}>
                <Play size={13} fill="currentColor" /> Review
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="subjects-empty">
          <h2>No subjects to revisit yet.</h2>
          <p>Your revision plan will follow the subjects you add and the check-ins you save.</p>
        </div>
      )}
      <div className="revision-tip">
        <span>✳</span>
        <div>
          <b>Small and spaced beats one long cram.</b>
          <p>Revisiting a topic just before it starts to fade makes the memory easier to find next time.</p>
        </div>
      </div>
    </>
  );
}

const insightStyles = [
  { tone: 'morning', icon: '↗', eyebrow: 'YOUR RHYTHM' },
  { tone: 'topic', icon: '◷', eyebrow: 'ON YOUR PLATE' },
  { tone: 'win', icon: '✳', eyebrow: 'A GOOD SIGN' },
];

function InsightsPage({ onReplan, records, onNavigate }: { onReplan: () => void; records: StudyRecord[]; onNavigate: (p: Page) => void }) {
  const observations = generateObservations(records);
  const insights = observations.length
    ? observations.map((text, i) => ({
        title: i === 0 ? 'A pattern from your sessions' : 'Daymark noticed',
        text,
        hint: 'Use this pattern in your next plan.',
      }))
    : [
        {
          title: 'Your learning patterns are taking shape',
          text: 'Keep studying and Daymark will start noticing your patterns.',
          hint: 'Your check-ins shape future plans.',
        },
      ];
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">A THOUGHTFUL LOOK BACK</div>
          <h1>Noticing the patterns.</h1>
          <p className="subhead">A few useful observations from the way you study.</p>
        </div>
        <span className="insights-period">FROM YOUR SAVED SESSIONS</span>
      </div>
      <div className="insight-list">
        {insights.map((insight, i) => {
          const style = insightStyles[i % insightStyles.length];
          const action = i % 3 === 2 ? 'progress' : 'replan';
          return (
            <article className="insight-card" key={`${i}-${insight.text}`}>
              <span className={`insight-number ${style.tone}`} aria-hidden="true">
                {style.icon}
              </span>
              <div className="insight-body">
                <div className="eyebrow">{style.eyebrow}</div>
                <h2>{insight.title}</h2>
                <p>{insight.text}</p>
                <div className="insight-action">
                  <span>{insight.hint}</span>
                  <button className="text-button" onClick={action === 'progress' ? () => onNavigate('Progress') : onReplan}>
                    {action === 'progress' ? 'View progress' : i % 3 === 0 ? 'Adjust plan' : 'Make it smaller'} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="insight-footer">
        <span className="insight-icon">
          <Lightbulb size={17} />
        </span>
        <p>These patterns come from your sessions and check-ins. They’re here to help you make decisions, not judge your study habits.</p>
      </div>
    </>
  );
}

export default App;
