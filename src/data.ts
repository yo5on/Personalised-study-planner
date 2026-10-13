export type Session = {
  id: number;
  time: string;
  date?: string;
  subject: string;
  topic: string;
  minutes: number;
  status: 'done' | 'now' | 'next' | 'later';
  priority: 'High' | 'Medium' | 'Low';
  tint: string;
  objective: string;
  confidence?: number;
  reason?: string;
  sample?: boolean;
};
export type Subject = {
  name: string;
  short: string;
  mastery: number;
  color: string;
  strong: string;
  needsWork: string;
  exam: string;
  examIn: string;
  description?: string;
  examDate?: string;
  sample?: boolean;
};

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function weekForDate(date: Date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, offset) => {
    const current = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset);
    return {
      day: current.toLocaleDateString('en', { weekday: 'short' }).toUpperCase(),
      date: String(current.getDate()),
      dateKey: localDateKey(current),
      dots: [] as string[],
    };
  });
}

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * Sample subjects for exploring Daymark. Exam dates are relative to `today`, so they're never already expired
 * when someone starts with them. Each one is flagged `sample` so it can be cleared in one step later.
 */
export function sampleSubjects(today: Date = new Date()): Subject[] {
  const examIn = (days: number) => localDateKey(addDays(today, days));
  return [
    {
      name: 'Artificial Intelligence',
      short: 'AI',
      mastery: 72,
      color: '#d9d9f5',
      strong: 'Classification',
      needsWork: 'Model evaluation',
      exam: 'AI-901',
      examIn: '',
      examDate: examIn(1),
      description: 'AI-901 preparation',
      sample: true,
    },
    {
      name: 'Mathematics',
      short: 'MATH',
      mastery: 64,
      color: '#f1dfc7',
      strong: 'Linear algebra',
      needsWork: 'Bayesian networks',
      exam: 'Mathematics',
      examIn: '',
      examDate: examIn(9),
      sample: true,
    },
    {
      name: 'Database Systems',
      short: 'DBMS',
      mastery: 81,
      color: '#d8e9dd',
      strong: 'ER modelling',
      needsWork: 'SQL joins',
      exam: 'DBMS CIA',
      examIn: '',
      examDate: examIn(4),
      sample: true,
    },
    {
      name: 'Computer Networks',
      short: 'CN',
      mastery: 58,
      color: '#e9ddd2',
      strong: 'OSI model',
      needsWork: 'Subnetting',
      exam: 'CN quiz',
      examIn: '',
      examDate: examIn(14),
      sample: true,
    },
  ];
}

export function sampleSessions(today: Date = new Date()): Session[] {
  const date = localDateKey(today);
  return [
    {
      id: 1,
      time: '09:00',
      date,
      subject: 'Mathematics',
      topic: 'Eigenvalues & eigenvectors',
      minutes: 45,
      status: 'now',
      priority: 'High',
      tint: '#f1dfc7',
      objective: 'Find eigenvalues and eigenvectors for a 2×2 matrix, then check your work against the characteristic equation.',
      sample: true,
    },
    {
      id: 2,
      time: '11:00',
      date,
      subject: 'Artificial Intelligence',
      topic: 'Model evaluation',
      minutes: 35,
      status: 'next',
      priority: 'High',
      tint: '#d9d9f5',
      objective: 'Compare precision, recall and F1 score. Work through two confusion matrix examples.',
      sample: true,
    },
    {
      id: 3,
      time: '18:30',
      date,
      subject: 'Database Systems',
      topic: 'SQL joins',
      minutes: 40,
      status: 'later',
      priority: 'Medium',
      tint: '#d8e9dd',
      objective: 'Practise INNER, LEFT and self joins using a small schema.',
      sample: true,
    },
  ];
}
