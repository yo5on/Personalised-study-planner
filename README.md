<div align="center">

<samp><b>DAYMARK · PERSONALISED STUDY PLANNER</b></samp>

<samp>react · typescript · vite · adaptive planning · local-first</samp>

</div>

---

<div align="center"><samp>Daymark reshapes your study day around what actually happens: less time than expected, an exam tomorrow, a missed session or a topic that didn't stick. It runs in the browser and keeps your data on your device.</samp></div>

<div align="center">

<samp>**[Open Live App](https://personalised-study-planner.vercel.app/)** · [Source Code](https://github.com/yo5on/Personalised-study-planner)</samp>

</div>

<samp>![Daymark dashboard showing the next session, today's agenda, weekly rhythm and the sample-data notice](docs/screenshots/dashboard.png)</samp>

<samp>_All screenshots show the real app running with its built-in sample subjects and a demo profile. No real study data is shown. Dates in the screenshots are from the day they were taken. In the app, sample exam dates are always counted from the day you load the samples._</samp>


---

<div align="center"><samp><b>Why Daymark</b></samp></div>

<samp>Most study timetables are fixed: once a day goes off-plan, the timetable stops being useful. Daymark treats the plan as something that bends. You tell it what changed in plain language, review exactly what it proposes, and accept or decline. Each completed session ends with a short confidence check-in, and those check-ins drive what comes up for revision.</samp>


---

<div align="center"><samp><b>Features</b></samp></div>

- <samp>**Daily and weekly planning.** A dashboard with the next session and today's agenda, plus a weekly calendar with exam countdowns and readiness labels.</samp>
- <samp>**Quick Change.** Plain-language requests such as "I only have 60 minutes today", "my DBMS exam is tomorrow", "focus on Mathematics", "I'm too tired" or "I finished SQL joins". Every change is shown for review before it's applied, and requests Daymark can't act on are reported as such.</samp>
- <samp>**Missed sessions.** Marking a session missed moves it to the next free slot today without overlapping anything, or to tomorrow if today is full.</samp>
- <samp>**Focus timer.** Start, pause, resume and reset, a time's-up notice, and a confirmation before you abandon a session in progress.</samp>
- <samp>**Confidence check-ins.** Each session ends with a 1–5 confidence rating and an outcome. Ratings update the subject's estimated mastery.</samp>
- <samp>**Revision.** Topics whose most recent check-in was low confidence are queued for review. A later confident check-in clears them.</samp>
- <samp>**Progress and insights.** Weekly study time, streak, consistency and a weekly goal, plus observations generated from your saved check-ins.</samp>
- <samp>**Responsive calendar.** Overlapping sessions sit side by side. On phones the calendar shows one day at a time, and tapping a session opens its full details instead of starting it.</samp>
- <samp>**Onboarding and sample data.** New users start from a blank plan or optional sample subjects whose exam dates are counted from today. Sample data can be cleared in one step.</samp>


---

<div align="center"><samp><b>How the planning works</b></samp></div>

<samp>Daymark's planning is **rule-based TypeScript, not a language model**. There is no AI service, API key or network call behind Quick Change. Requests are matched against a defined set of patterns (available time, exams, focus, finished topics, tiredness, missed sessions and rebalancing), and plans are adjusted by pure functions in [`src/services/agents.ts`](src/services/agents.ts). As a result, the behaviour is predictable, works offline and is covered by unit tests. The trade-off is that requests outside those patterns aren't understood, and the app says so rather than guessing.</samp>


---

<div align="center"><samp><b>Screenshots</b></samp></div>

| Quick Change review                                                                                                | Weekly planner                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| ![Quick Change dialog proposing a shorter plan for 60 available minutes](docs/screenshots/quick-change.png)        | ![Weekly planner with exam countdowns and readiness labels](docs/screenshots/planner.png) |
| **Progress**                                                                                                       | **Welcome step**                                                                          |
| ![Progress page with weekly study time, streak, subject mastery and an observation](docs/screenshots/progress.png) | ![Welcome dialog with optional name, course and year](docs/screenshots/onboarding.png)    |

<p align="center">
  <img src="docs/screenshots/mobile-session-details.png" alt="Phone view: single-day calendar with a session's details open in a bottom sheet" width="320">
  <br>
<samp>  <em>On a phone, tapping a calendar session opens its details instead of starting it.</em></samp>
</p>


---

<div align="center"><samp><b>Tech stack</b></samp></div>

- <samp>**React 18** and **TypeScript** (strict mode), built with **Vite 6**</samp>
- <samp>**lucide-react** for icons</samp>
- <samp>**Vitest**, **React Testing Library** and **jsdom** for tests</samp>
- <samp>**ESLint** (typescript-eslint, react-hooks) and **Prettier**</samp>
- <samp>Browser **localStorage** for persistence. There is no backend.</samp>


---

<div align="center"><samp><b>Architecture</b></samp></div>

<samp>The UI and the planning logic are kept apart. React components hold UI state only; every planning decision lives in plain, testable functions.</samp>

```mermaid
flowchart LR
  subgraph UI["React UI"]
    App["App.tsx<br/>pages, dialogs, focus mode"]
    Dialog["components/Dialog.tsx"]
    Hooks["hooks/<br/>useCountdown, useMediaQuery"]
  end
  subgraph Logic["Planning logic (pure TypeScript)"]
    Agents["services/agents.ts<br/>Quick Change, revision,<br/>progress, readiness"]
    Layout["services/calendarLayout.ts<br/>overlap lanes"]
  end
  Storage["services/storage.ts<br/>load, validate, migrate, save"]
  Data["data.ts<br/>types and sample data"]
  LS[("Browser localStorage")]

  App --> Dialog
  App --> Hooks
  App --> Agents
  App --> Layout
  App --> Storage
  App --> Data
  Agents --> Data
  Storage --> Data
  Storage <--> LS
```

<samp>Engineering decisions worth noting:</samp>

- <samp>**Validated persistence.** Saved state is checked field by field on load. Malformed entries, duplicate IDs and bad dates are dropped rather than crashing the app, and unreadable data is backed up before it could be overwritten.</samp>
- <samp>**Deadline-based timer.** The focus timer counts against a fixed end time instead of counting ticks, so it stays accurate when the browser throttles background tabs.</samp>
- <samp>**Non-destructive plan changes.** Quick Change only reshapes the remaining sessions for today. Finished sessions and other days are never altered, and nothing is applied until you accept.</samp>
- <samp>**Accessibility.** Dialogs trap focus, close with Escape and return focus to whatever opened them. There's a skip link and every control has an accessible name. Text colours were tuned to WCAG AA contrast (4.5:1) on the app's light surfaces. On touch screens, controls have targets of at least 44px, except the phone calendar's day picker, where seven days must fit across the screen (40px).</samp>


---

<div align="center"><samp><b>Getting started</b></samp></div>

<div align="center"><samp><b>Requirements</b></samp></div>

- <samp>**Node.js 22.22+ or 24.15+.** The test tooling (Vitest and jsdom) requires one of these. The app itself builds on older versions, but use one of these for the full workflow.</samp>
- <samp>**npm** (bundled with Node.js)</samp>

<samp>The commands are the same in Windows PowerShell, Command Prompt, Git Bash, macOS and Linux terminals.</samp>

```bash
git clone https://github.com/yo5on/Personalised-study-planner.git
cd Personalised-study-planner
npm install
npm run dev
```

<samp>Then open the local URL Vite prints (usually `http://localhost:5173`).</samp>

<div align="center"><samp><b>Environment variables</b></samp></div>

<samp>None. Daymark has no backend, API keys or environment configuration.</samp>

<div align="center"><samp><b>Scripts</b></samp></div>

| Command                | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Start the Vite development server                      |
| `npm run build`        | Typecheck, then build a production bundle into `dist/` |
| `npm run preview`      | Serve the production build locally                     |
| `npm run lint`         | Run ESLint                                             |
| `npm run typecheck`    | Run the TypeScript compiler without emitting files     |
| `npm test`             | Run all tests once with Vitest                         |
| `npm run format`       | Format the project with Prettier                       |
| `npm run format:check` | Check formatting without changing files                |


---

<div align="center"><samp><b>Testing</b></samp></div>

<samp>`npm test` runs 60 tests in 4 files:</samp>

- <samp>**Planning logic** (`src/services/agents.test.ts`): Quick Change parsing and plan adaptation, missed-session rescheduling, revision, streaks and weekly progress.</samp>
- <samp>**Persistence** (`src/services/storage.test.ts`): validation of malformed data, the backup of unreadable data, migration from older versions and existing-user handling.</samp>
- <samp>**Calendar layout** (`src/services/calendarLayout.test.ts`): placing overlapping sessions side by side.</samp>
- <samp>**Components** (`src/App.test.tsx`, React Testing Library): onboarding, navigation, Quick Change accept/decline/unrecognised, dialog dismissal and focus return, the timer (pause, resume, time's up and check-in), revision check-ins, and the phone calendar's tap-for-details behaviour.</samp>

<samp>What the tests don't cover:</samp>

- <samp>There are no end-to-end browser tests in the repository. Responsive layouts were checked by hand in a browser at phone, tablet and desktop widths.</samp>
- <samp>No screen-reader testing (NVDA, VoiceOver, TalkBack) has been done.</samp>

<samp>**Continuous integration:** GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the formatting check, lint, typecheck, tests and production build on Node.js 22 and 24 for every push to `main` and every pull request.</samp>


---

<div align="center"><samp><b>Data and privacy</b></samp></div>

- <samp>All data (profile, subjects, sessions, check-ins and plan changes) is stored in your browser's `localStorage` under the key `daymark-state`. Nothing is sent to a server, and there are no accounts or analytics.</samp>
- <samp>If saved data can't be read, a copy is kept under `daymark-state-unreadable-backup` before the app starts fresh.</samp>
- <samp>Data stays on one browser and device. It doesn't sync, and clearing site data or using a private window removes it.</samp>
- <samp>The page loads its fonts (DM Sans and Newsreader) from Google Fonts, so your browser requests those files from Google.</samp>


---

<div align="center"><samp><b>Known limitations</b></samp></div>

- <samp>Quick Change understands a fixed set of request patterns. It isn't a general language model.</samp>
- <samp>Data is stored only in the browser. There's no export, import or cross-device sync.</samp>
- <samp>Estimated mastery is a simple weighted average of confidence check-ins, not an assessment.</samp>
- <samp>The weekly goal is fixed at 9 hours.</samp>
- <samp>Only English is supported.</samp>


---

<div align="center"><samp><b>Possible next steps</b></samp></div>

- <samp>Export and import of study data as a file</samp>
- <samp>An optional synced backend for use across devices</samp>
- <samp>End-to-end browser tests, run in CI</samp>
- <samp>A configurable weekly goal and study hours</samp>


---

<div align="center"><samp><b>Project structure</b></samp></div>

```text
src/
├── App.tsx                  # Pages, dialogs and focus mode
├── App.test.tsx             # Component tests (React Testing Library)
├── main.tsx                 # Entry point
├── data.ts                  # Types and optional sample data
├── styles.css               # Styling
├── components/
│   ├── DaymarkMark.tsx      # Logo
│   └── Dialog.tsx           # Accessible modal wrapper
├── hooks/
│   ├── useCountdown.ts      # Deadline-based focus timer
│   └── useMediaQuery.ts     # Responsive and touch behaviour
└── services/
    ├── agents.ts            # Rule-based planning, revision and progress logic
    ├── calendarLayout.ts    # Places overlapping calendar sessions
    └── storage.ts           # Loading, validation, migration and saving
docs/screenshots/            # README screenshots of the running app
.github/workflows/ci.yml     # GitHub Actions: format, lint, typecheck, test, build
```


---

<div align="center"><samp><b>Author</b></samp></div>

<div align="center">

---

<samp><strong>Yoson</strong> · software, AI/ML and learning tools</samp>

<samp><a href="https://github.com/yo5on">github.com/yo5on</a> · <a href="https://www.linkedin.com/in/yo5on">LinkedIn</a></samp>

</div>

---

<div align="center"><samp><b>License</b></samp></div>

<samp>This project's original code is licensed under the MIT License. See [LICENSE](LICENSE) for details. Third-party assets and dependencies remain under their respective licenses.</samp>

---

<div align="center"><samp><b>License</b></samp></div>

<samp>This project's original code is licensed under the MIT License. See [LICENSE](LICENSE) for details. Third-party assets and dependencies remain under their respective licenses.</samp>
