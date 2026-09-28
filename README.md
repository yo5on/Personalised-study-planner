# Daymark — Personalised Study Planner

A personalised study planner that adapts daily study plans around time, priorities, exam proximity, session outcomes, and learner feedback.

**Live:** https://personalised-study-planner.vercel.app  
**Repository:** https://github.com/yo5on/Personalised-study-planner

## Overview

Daymark is designed to feel less like a static timetable and more like a study companion that responds to what actually happens during the day.

Instead of adding generic AI UI, the product expresses intelligence through behaviour: Quick Change requests can reshape a plan, completed sessions feed confidence and outcome data back into planning, and the Insights view surfaces patterns from real study records.

## Features

- **Adaptive Quick Change** — understands requests such as limited study time, upcoming exams, low energy, finished topics, subject focus, and missed sessions.
- **Plan change review** — proposed changes are shown before they are applied, with Accept and Keep Current Plan actions.
- **Plan explanations** — schedule changes include concise reasons such as exam priority, reduced available time, or lower confidence.
- **Study sessions** — focused session mode with objective, timer, progress, pause, and completion flow.
- **Learning feedback loop** — completed sessions capture confidence and optional outcomes such as understood, needed more time, struggled, or didn't finish.
- **Missed-session adaptation** — missed work can be moved, shortened, or reprioritised to keep the day realistic.
- **Personal learning insights** — observations are generated from stored study records rather than hardcoded user-facing claims.
- **Readiness guidance** — upcoming exams are classified as `Needs attention`, `Review recommended`, or `On track` using defined planning signals.
- **Subject management** — add, rename, and remove subjects with references updated across planning data.
- **Local persistence** — profile, subjects, sessions, study records, and plan changes persist in browser localStorage.
- **Responsive interface** — designed for desktop, tablet, and mobile use.

## Product Design

Daymark intentionally keeps a calm editorial interface rather than using conventional AI-dashboard patterns.

- Warm off-white surfaces
- Restrained Apple-inspired blue accents
- Serif editorial headings
- Subtle borders and generous whitespace
- Left-side navigation
- Timeline-based daily planning
- Behaviour-driven personalisation instead of decorative AI elements

## Tech Stack

- React 18
- TypeScript
- Vite
- Recharts
- Lucide React
- Browser localStorage
- Vercel

## Architecture

```text
src/
├── components/       # Reusable UI components
├── services/
│   ├── agents.ts     # Planning, adaptation, readiness and insight logic
│   └── storage.ts    # Persistent Daymark state and migration helpers
├── data.ts            # Initial subjects and study sessions
├── App.tsx            # Application composition and UI state
└── styles.css         # Product styling
```

The agent layer is kept separate from the React UI. Core planning behaviour is exposed through structured TypeScript types and functions including:

- `createStudyPlan()`
- `adaptStudyPlan()`
- `prioritizeTopics()`
- `generateRevisionPlan()`
- `evaluateReadiness()`
- `explainPlanChange()`
- `generateObservations()`

## Getting Started

### Requirements

- Node.js
- npm

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Then open the local Vite URL shown in the terminal.

### Production build

```bash
npm run build
```

## Deployment

Daymark is deployed as a Vite application on Vercel.

```text
Framework: Vite
Build command: npm run build
Output directory: dist
Install command: npm install
```

No environment variables are required for the current local-first implementation.

## Data & Privacy

Daymark currently uses browser localStorage rather than a remote database. Study data and profile information therefore remain in the browser that is using the application and are not shared between users automatically.

This architecture keeps the current prototype simple and avoids requiring an account or backend service.

## Project Status

Daymark is an actively developed personalised study-planning prototype. The current implementation focuses on adaptive planning, feedback-driven sessions, subject management, readiness guidance, and a polished product experience.

## Author

**Yoson**  
CSE student specialising in AI/ML at Christ University, Bangalore.

- GitHub: https://github.com/yo5on
- LinkedIn: https://www.linkedin.com/in/yo5on
