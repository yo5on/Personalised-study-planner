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
