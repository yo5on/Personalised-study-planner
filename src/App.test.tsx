// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { sampleSessions, sampleSubjects } from './data';
import type { StudyRecord } from './services/agents';
import type { DaymarkState } from './services/storage';

const NOW = new Date(2026, 9, 13, 8, 0);
const KEY = 'daymark-state';

function seed(overrides: Partial<DaymarkState> = {}) {
  const state: DaymarkState = {
    version: 1,
    profile: { name: 'Sam', course: 'Physics', year: '1' },
    subjects: sampleSubjects(NOW),
    sessions: sampleSessions(NOW),
    records: [],
    planChanges: [],
    onboarded: true,
    ...overrides,
  };
  localStorage.setItem(KEY, JSON.stringify(state));
}
const stored = (): DaymarkState => JSON.parse(localStorage.getItem(KEY)!);

function setup() {
  const user = userEvent.setup({ delay: null });
  render(<App />);
  return user;
}
const nav = (name: string) => within(screen.getByRole('navigation')).getByRole('button', { name: new RegExp(`^${name}`) });
const quickChange = () => screen.getByRole('textbox', { name: /tell your planner/i });

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setInterval', 'clearInterval'] });
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('onboarding', () => {
  it('welcomes a new user without a placeholder name and can start from sample subjects', async () => {
    const user = setup();
    const dialog = screen.getByRole('dialog', { name: 'Let’s set up your space.' });
    expect(screen.queryByText('Farah Fathima')).toBeNull();
    await user.type(within(dialog).getByRole('textbox', { name: /your name/i }), 'Alex');
    await user.click(within(dialog).getByRole('button', { name: 'Explore with sample subjects' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText(/exploring sample subjects/i)).toBeTruthy();
    const state = stored();
    expect(state.onboarded).toBe(true);
    // Sample exams are counted from today, so none of them has already passed.
    expect(state.subjects.every((subject) => subject.sample && subject.examDate! > '2026-10-13')).toBe(true);
  });

  it('can start with a blank plan, and the sample data can be added and cleared later', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Start with my own subjects' }));
    expect(screen.getByRole('heading', { name: 'Your next chapter starts here.' })).toBeTruthy();
    expect(screen.getByText('Add your name')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Explore with sample subjects' }));
    expect(stored().subjects).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Clear sample data' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear sample data' }));
    expect(stored().subjects).toEqual([]);
    expect(stored().sessions).toEqual([]);
  });

  it('keeps an existing user’s saved profile and data', () => {
    localStorage.setItem(KEY, JSON.stringify({ profile: { name: 'Farah Fathima', course: 'CS', year: '2' }, subjects: [], sessions: [] }));
    setup();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Farah Fathima')).toBeTruthy();
  });
});

describe('navigation', () => {
  it('offers a skip link as the first stop that jumps past the sidebar', async () => {
    seed();
    const user = setup();
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(document.activeElement).toBe(skip);
    expect(skip.getAttribute('href')).toBe('#main-content');
    expect(screen.getByRole('main').id).toBe('main-content');
  });

  it('moves between pages and marks the current one', async () => {
    seed();
    const user = setup();
    const pages: [string, string][] = [
      ['Plan', 'Your study plan.'],
      ['Subjects', 'What you’re learning.'],
      ['Progress', 'Your progress.'],
      ['Revision', 'Revision, right on time.'],
      ['Insights', 'Noticing the patterns.'],
    ];
    for (const [name, heading] of pages) {
      await user.click(nav(name));
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
      expect(nav(name).getAttribute('aria-current')).toBe('page');
    }
  });

  it('moves the plan between weeks and back to today', async () => {
    seed();
    const user = setup();
    await user.click(nav('Plan'));
    expect(screen.getByText('October 12 – October 18')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByText('October 19 – October 25')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByText('October 12 – October 18')).toBeTruthy();
  });
});

describe('Quick change', () => {
  it('proposes a plan that fits the available time and applies it on accept', async () => {
    seed();
    const user = setup();
    await user.type(quickChange(), 'I only have 60 minutes today{Enter}');
    const dialog = screen.getByRole('dialog', { name: 'Here’s what I’d change.' });
    expect(within(dialog).getByText('SQL joins · 40 min')).toBeTruthy();
    expect(within(dialog).getByText('Model evaluation · 35 → 15 min')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Accept changes' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Your study plan.' })).toBeTruthy();
    expect(stored().sessions.map((s) => s.minutes)).toEqual([45, 15]);
    expect(stored().planChanges).toHaveLength(1);
  });

  it('leaves the plan alone when the change is declined', async () => {
    seed();
    const user = setup();
    await user.type(quickChange(), 'I only have 60 minutes today{Enter}');
    await user.click(screen.getByRole('button', { name: 'Keep current plan' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(stored().sessions).toHaveLength(3);
    expect(stored().planChanges).toEqual([]);
  });

  it('explains when it cannot understand a request and offers nothing to accept', async () => {
    seed();
    const user = setup();
    await user.type(quickChange(), 'what a lovely day{Enter}');
    const dialog = screen.getByRole('dialog', { name: 'Nothing to change yet.' });
    expect(within(dialog).queryByRole('button', { name: 'Accept changes' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('only logs a missed session when the new plan is accepted', async () => {
    seed();
    const user = setup();
    const missed = () => screen.getAllByRole('button', { name: 'Missed' })[1];
    await user.click(missed());
    await user.click(screen.getByRole('button', { name: 'Keep current plan' }));
    expect(stored().records).toEqual([]);

    await user.click(missed());
    await user.click(screen.getByRole('button', { name: 'Accept changes' }));
    expect(stored().records).toMatchObject([{ topic: 'Model evaluation', missed: true }]);
  });
});

describe('dialogs', () => {
  it('close with Escape and return focus to what opened them', async () => {
    seed();
    const user = setup();
    await user.type(quickChange(), 'I only have 60 minutes today{Enter}');
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(quickChange());
  });

  it('keep forms open when the backdrop is tapped, so typed input is not lost', async () => {
    seed();
    const user = setup();
    await user.click(screen.getAllByRole('button', { name: 'Edit profile' })[0]);
    await user.type(screen.getByRole('textbox', { name: /name/i }), ' Lee');
    await user.click(document.querySelector('.modal-backdrop')!);
    expect(screen.getByRole('dialog', { name: 'A little about you.' })).toBeTruthy();
  });

  it('close from the close button', async () => {
    seed();
    const user = setup();
    await user.click(screen.getAllByRole('button', { name: 'Edit profile' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'A little about you.' });
    await user.click(within(dialog).getByRole('button', { name: 'Close profile' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('focus session', () => {
  it('counts down, pauses, resumes and saves a check-in', async () => {
    seed();
    const user = setup();
    await user.click(screen.getByRole('button', { name: /start session/i }));
    const timer = () => screen.getByRole('timer').textContent;
    expect(timer()).toBe('45:00');

    await user.click(screen.getByRole('button', { name: 'Start focus' }));
    act(() => void vi.advanceTimersByTime(3000));
    expect(timer()).toBe('44:57');

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => void vi.advanceTimersByTime(5000));
    expect(timer()).toBe('44:57');

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    act(() => void vi.advanceTimersByTime(45 * 60 * 1000));
    expect(timer()).toBe('00:00');
    expect(screen.getByRole('status').textContent).toMatch(/Time’s up/);

    await user.click(screen.getByRole('button', { name: /mark session complete/i }));
    const checkIn = screen.getByRole('dialog', { name: 'How did that feel?' });
    const save = within(checkIn).getByRole('button', { name: /save check-in/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.click(within(checkIn).getByRole('button', { name: 'Confidence 4 of 5' }));
    await user.click(save);

    expect(screen.getByRole('heading', { level: 1, name: /make today/i })).toBeTruthy();
    const state = stored();
    expect(state.records).toMatchObject([{ sessionId: 1, confidence: 4, actualMinutes: 45, completed: true }]);
    expect(state.sessions.find((s) => s.id === 1)?.status).toBe('done');
    expect(state.sessions.find((s) => s.id === 2)?.status).toBe('now');
  });

  it('asks before leaving a session that has started', async () => {
    seed();
    const user = setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: /start session/i }));
    await user.click(screen.getByRole('button', { name: 'Start focus' }));
    act(() => void vi.advanceTimersByTime(2000));
    await user.click(screen.getByRole('button', { name: 'Exit session' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole('timer')).toBeTruthy();
  });
});

describe('revision check-ins', () => {
  it('saves a review without touching the plan and clears the topic once confident', async () => {
    const lowConfidence: StudyRecord = {
      sessionId: 7,
      topic: 'Subnetting',
      subject: 'Computer Networks',
      plannedMinutes: 30,
      actualMinutes: 30,
      confidence: 1,
      completed: true,
      at: new Date(2026, 9, 12, 10).toISOString(),
    };
    seed({ records: [lowConfidence] });
    const user = setup();
    await user.click(nav('Revision'));
    await user.click(screen.getByRole('button', { name: 'Review Subnetting' }));
    await user.click(screen.getByRole('button', { name: /mark session complete/i }));
    await user.click(screen.getByRole('button', { name: 'Confidence 5 of 5' }));
    await user.click(screen.getByRole('button', { name: /save check-in/i }));

    const state = stored();
    const review = state.records[state.records.length - 1];
    expect(review).toMatchObject({ topic: 'Subnetting', confidence: 5 });
    expect(review.sessionId).toBeLessThan(0);
    expect(state.sessions.map((s) => s.status)).toEqual(['now', 'next', 'later']);
    // With no low-confidence topics left, revision falls back to each subject's "needs work" topic, as an estimate.
    await user.click(nav('Revision'));
    expect(screen.getByText(/No low-confidence check-ins yet/)).toBeTruthy();
  });
});

type Viewport = 'phone' | 'tablet' | 'desktop';
/** jsdom has no matchMedia, so stub the queries the calendar uses for a given device. */
function mockViewport(viewport: Viewport) {
  const width = { phone: 375, tablet: 768, desktop: 1280 }[viewport];
  const touch = viewport !== 'desktop';
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query
      .split(',')
      .some(
        (part) =>
          (part.includes('hover: none') && touch) ||
          (/max-width: (\d+)px/.test(part) && width <= Number(part.match(/max-width: (\d+)px/)![1])),
      ),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}
const overlapping = () => [
  ...sampleSessions(NOW),
  {
    ...sampleSessions(NOW)[0],
    id: 10,
    time: '09:15',
    minutes: 30,
    subject: 'Computer Networks',
    topic: 'Subnetting drills',
    tint: '#e9ddd2',
  },
];
const calendarCard = (topic: string) => screen.getByRole('button', { name: new RegExp(`^[^:]+: ${topic},`) });

describe('calendar on touch screens', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows one day at a time on phones, picked from the day header', async () => {
    mockViewport('phone');
    seed();
    const user = setup();
    await user.click(nav('Plan'));
    const picker = screen.getByRole('group', { name: 'Choose a day' });
    expect(within(picker).getAllByRole('button')).toHaveLength(7);
    expect(within(picker).getByRole('button', { pressed: true }).getAttribute('aria-label')).toBe('Tuesday, October 13, 3 sessions');
    expect(document.querySelectorAll('.calendar-column')).toHaveLength(1);

    await user.click(within(picker).getByRole('button', { name: /Wednesday, October 14/ }));
    expect(screen.getByText('Nothing planned for this day.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Eigenvalues/ })).toBeTruthy(); // still listed in today's agenda below
  });

  it('opens full session details on tap instead of starting the session', async () => {
    mockViewport('phone');
    seed();
    const user = setup();
    await user.click(nav('Plan'));
    const card = calendarCard('Eigenvalues & eigenvectors');
    expect(card.getAttribute('aria-haspopup')).toBe('dialog');
    await user.click(card);

    expect(screen.queryByRole('timer')).toBeNull();
    const details = screen.getByRole('dialog', { name: 'Eigenvalues & eigenvectors' });
    const text = details.textContent!;
    for (const fact of ['Mathematics', 'Tuesday, October 13 · 09:00', '45 min', 'Up next', 'High']) expect(text).toContain(fact);
  });

  it('dismisses details with Escape (returning focus) or a tap outside, and can start from them', async () => {
    mockViewport('phone');
    seed();
    const user = setup();
    await user.click(nav('Plan'));
    await user.click(calendarCard('Model evaluation'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(calendarCard('Model evaluation'));

    await user.click(calendarCard('Model evaluation'));
    await user.click(document.querySelector('.modal-backdrop')!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('timer')).toBeNull();

    await user.click(calendarCard('Model evaluation'));
    await user.click(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Model evaluation' }));
    expect(screen.getByRole('dialog')).toBeTruthy(); // tapping inside keeps it open
    await user.click(screen.getByRole('button', { name: /start session/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Model evaluation' })).toBeTruthy();
    expect(screen.getByRole('timer')).toBeTruthy();
  });

  it('lets finished sessions be inspected but not restarted', async () => {
    mockViewport('tablet');
    seed({ sessions: sampleSessions(NOW).map((s) => (s.id === 1 ? { ...s, status: 'done' as const } : s)) });
    const user = setup();
    await user.click(nav('Plan'));
    expect(document.querySelectorAll('.calendar-column')).toHaveLength(7);
    await user.click(calendarCard('Eigenvalues & eigenvectors'));
    const details = screen.getByRole('dialog', { name: 'Eigenvalues & eigenvectors' });
    expect(details.textContent).toContain('Done');
    expect(within(details).queryByRole('button', { name: /start session/i })).toBeNull();
  });

  it('shows only the lines of text that fit a card, never a line cut in half', async () => {
    mockViewport('desktop');
    const [maths, ai, sql] = sampleSessions(NOW);
    seed({
      sessions: [
        { ...maths, minutes: 45 },
        { ...ai, minutes: 35 },
        { ...sql, minutes: 60 },
      ],
    });
    const user = setup();
    await user.click(nav('Plan'));
    const lines = (topic: string) => calendarCard(topic).children.length;
    expect(lines('Model evaluation')).toBe(1); // 35 min: subject only
    expect(lines('Eigenvalues & eigenvectors')).toBe(2); // 45 min: subject and topic
    expect(lines('SQL joins')).toBe(3); // 60 min: subject, topic and time
  });

  it('keeps click-to-start on desktop and lays overlapping sessions side by side', async () => {
    mockViewport('desktop');
    seed({ sessions: overlapping() });
    const user = setup();
    await user.click(nav('Plan'));
    const first = calendarCard('Eigenvalues & eigenvectors');
    const second = calendarCard('Subnetting drills');
    // Two overlapping sessions each take half the column.
    expect(first.style.width).toContain('0.5');
    expect(first.style.left).not.toBe(second.style.left);
    expect(first.getAttribute('aria-haspopup')).toBeNull();

    await user.click(second);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Subnetting drills' })).toBeTruthy();
  });
});
