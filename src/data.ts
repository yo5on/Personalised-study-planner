export type Session = { id: number; time: string; date?: string; subject: string; topic: string; minutes: number; status: 'done' | 'now' | 'next' | 'later'; priority: 'High' | 'Medium' | 'Low'; tint: string; objective: string; confidence?: number; reason?: string };
export type Subject = { name: string; short: string; mastery: number; color: string; strong: string; needsWork: string; exam: string; examIn: string; description?: string; examDate?: string };

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function weekForDate(date: Date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay()+6)%7));
  return Array.from({ length: 7 }, (_, offset) => {
    const current = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()+offset);
    return { day: current.toLocaleDateString('en', { weekday: 'short' }).toUpperCase(), date: String(current.getDate()), dateKey: localDateKey(current), dots: [] as string[] };
  });
}

export const subjects: Subject[] = [
  { name: 'Artificial Intelligence', short: 'AI', mastery: 72, color: '#d9d9f5', strong: 'Classification', needsWork: 'Model evaluation', exam: 'AI-901', examIn: 'Tomorrow', examDate: '2026-09-29', description: 'AI-901 preparation' },
  { name: 'Mathematics', short: 'MATH', mastery: 64, color: '#f1dfc7', strong: 'Linear algebra', needsWork: 'Bayesian networks', exam: 'Mathematics', examIn: '9 days', examDate: '2026-10-07' },
  { name: 'Database Systems', short: 'DBMS', mastery: 81, color: '#d8e9dd', strong: 'ER modelling', needsWork: 'SQL joins', exam: 'DBMS CIA', examIn: '4 days', examDate: '2026-10-02' },
  { name: 'Computer Networks', short: 'CN', mastery: 58, color: '#e9ddd2', strong: 'OSI model', needsWork: 'Subnetting', exam: 'CN quiz', examIn: '2 weeks', examDate: '2026-10-12' },
];
export const initialSessions: Session[] = [
  { id: 1, time: '09:00', date: localDateKey(new Date()), subject: 'Mathematics', topic: 'Eigenvalues & eigenvectors', minutes: 45, status: 'now', priority: 'High', tint: '#e9e8fb', objective: 'Find eigenvalues and eigenvectors for a 2×2 matrix, then check your work against the characteristic equation.' },
  { id: 2, time: '11:00', date: localDateKey(new Date()), subject: 'Artificial Intelligence', topic: 'Model evaluation', minutes: 35, status: 'next', priority: 'High', tint: '#e8f0e7', objective: 'Compare precision, recall and F1 score. Work through two confusion matrix examples.' },
  { id: 3, time: '18:30', date: localDateKey(new Date()), subject: 'Database Systems', topic: 'SQL joins', minutes: 40, status: 'later', priority: 'Medium', tint: '#f8eddf', objective: 'Practise INNER, LEFT and self joins using a small schema.' },
];
export const week = weekForDate();
