<div align="center">

<img src="https://raw.githubusercontent.com/yo5on/yo5on/main/hd-projects.svg" width="620" alt="projects"/>

<samp><b>DAYMARK — PERSONALISED STUDY PLANNER</b></samp>

<samp>react · typescript · vite · product design</samp>

</div>

---

<div align="center"><samp>A personalised study planner that adapts daily study plans around time, priorities, exam proximity, session outcomes, and learner feedback.</samp></div>

---

<div align="center">
<samp><b>Project Overview</b></samp>
</div>

<samp>Daymark is designed to feel less like a static timetable and more like a study companion that responds to what actually happens during the day.</samp>

<samp>Instead of adding generic AI UI, the product expresses intelligence through behaviour: Quick Change requests can reshape a plan, completed sessions feed confidence and outcome data back into planning, and the Insights view surfaces patterns from real study records.</samp>

---

<div align="center">
<samp><b>Project Images</b></samp>
</div>

<div align="center">

![Daymark dashboard](https://raw.githubusercontent.com/yo5on/Personalised-study-planner/main/images/dashboard.png)

</div>

<div align="center"><samp><i>Daymark dashboard and personalised planning interface.</i></samp></div>

<div align="center">

![Daymark study session](https://raw.githubusercontent.com/yo5on/Personalised-study-planner/main/images/study-session.png)

</div>

<div align="center"><samp><i>Study session and learner feedback flow.</i></samp></div>

<div align="center">

![Daymark insights](https://raw.githubusercontent.com/yo5on/Personalised-study-planner/main/images/insights.png)

</div>

<div align="center"><samp><i>Personal learning insights.</i></samp></div>

---

<div align="center">
<samp><b>Features</b></samp>
</div>

- <samp><b>Adaptive Quick Change</b> — understands requests such as limited study time, upcoming exams, low energy, finished topics, subject focus, and missed sessions.</samp>
- <samp><b>Plan change review</b> — proposed changes are shown before they are applied, with Accept and Keep Current Plan actions.</samp>
- <samp><b>Plan explanations</b> — schedule changes include concise reasons such as exam priority, reduced available time, or lower confidence.</samp>
- <samp><b>Study sessions</b> — focused session mode with objective, timer, progress, pause, and completion flow.</samp>
- <samp><b>Learning feedback loop</b> — completed sessions capture confidence and optional outcomes such as understood, needed more time, struggled, or didn't finish.</samp>
- <samp><b>Missed-session adaptation</b> — missed work can be moved, shortened, or reprioritised to keep the day realistic.</samp>
- <samp><b>Personal learning insights</b> — observations are generated from stored study records rather than hardcoded user-facing claims.</samp>
- <samp><b>Readiness guidance</b> — upcoming exams are classified as <code>Needs attention</code>, <code>Review recommended</code>, or <code>On track</code> using defined planning signals.</samp>
- <samp><b>Subject management</b> — add, rename, and remove subjects with references updated across planning data.</samp>
- <samp><b>Local persistence</b> — profile, subjects, sessions, study records, and plan changes persist in browser localStorage.</samp>
- <samp><b>Responsive interface</b> — designed for desktop, tablet, and mobile use.</samp>

---

<div align="center">
<samp><b>Product Design</b></samp>
</div>

<samp>Daymark intentionally keeps a calm editorial interface rather than using conventional AI-dashboard patterns.</samp>

- <samp>Warm off-white surfaces</samp>
- <samp>Restrained Apple-inspired blue accents</samp>
- <samp>Serif editorial headings</samp>
- <samp>Subtle borders and generous whitespace</samp>
- <samp>Left-side navigation</samp>
- <samp>Timeline-based daily planning</samp>
- <samp>Behaviour-driven personalisation instead of decorative AI elements</samp>

---

<div align="center">
<samp><b>Tech Stack</b></samp>
</div>

- <samp>React 18</samp>
- <samp>TypeScript</samp>
- <samp>Vite</samp>
- <samp>Recharts</samp>
- <samp>Lucide React</samp>
- <samp>Browser localStorage</samp>
- <samp>Vercel</samp>

---

<div align="center">
<samp><b>Architecture</b></samp>
</div>

```text
src/
├── components/       # Reusable UI components
├── services/
│   ├── agents.ts     # Planning, adaptation, readiness and insight logic
│   └── storage.ts    # Persistent Daymark state and migration helpers
├── data.ts           # Initial subjects and study sessions
├── App.tsx            # Application composition and UI state
└── styles.css         # Product styling
```

<samp>The agent layer is kept separate from the React UI. Core planning behaviour is exposed through structured TypeScript types and functions including:</samp>

- <samp><code>createStudyPlan()</code></samp>
- <samp><code>adaptStudyPlan()</code></samp>
- <samp><code>prioritizeTopics()</code></samp>
- <samp><code>generateRevisionPlan()</code></samp>
- <samp><code>evaluateReadiness()</code></samp>
- <samp><code>explainPlanChange()</code></samp>
- <samp><code>generateObservations()</code></samp>

---

<div align="center">
<samp><b>Getting Started</b></samp>
</div>

<samp><b>Requirements</b></samp>

- <samp>Node.js</samp>
- <samp>npm</samp>

<samp><b>Install</b></samp>

```bash
npm install
```

<samp><b>Run Locally</b></samp>

```bash
npm run dev
```

<samp>Then open the local Vite URL shown in the terminal.</samp>

<samp><b>Production Build</b></samp>

```bash
npm run build
```

---

<div align="center">
<samp><b>Deployment</b></samp>
</div>

<samp>Daymark is deployed as a Vite application on Vercel.</samp>

```text
Framework: Vite
Build command: npm run build
Output directory: dist
Install command: npm install
```

<samp>No environment variables are required for the current local-first implementation.</samp>

---

<div align="center">
<samp><b>Data & Privacy</b></samp>
</div>

<samp>Daymark currently uses browser localStorage rather than a remote database. Study data and profile information therefore remain in the browser that is using the application and are not shared between users automatically.</samp>

<samp>This architecture keeps the current prototype simple and avoids requiring an account or backend service.</samp>

---

<div align="center">
<samp><b>Project Status</b></samp>
</div>

<samp>Daymark is an actively developed personalised study-planning prototype. The current implementation focuses on adaptive planning, feedback-driven sessions, subject management, readiness guidance, and a polished product experience.</samp>

---

<div align="center">
<samp><b>Author</b></samp>
</div>

<div align="center">
<samp><strong>Yoson</strong></samp>

<samp>Computer Science student interested in AI/ML, robotics, embedded systems, and automation.</samp>

<samp>GitHub: https://github.com/yo5on</samp>
</div>
