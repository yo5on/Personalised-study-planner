type Props = { size?: number; className?: string };

export function DaymarkMark({ size = 26, className }: Props) {
  return <svg className={className} width={size} height={size} viewBox="0 0 28 28" role="img" aria-label="Daymark mark" xmlns="http://www.w3.org/2000/svg">
    <rect width="28" height="28" rx="8" fill="#7070a9" />
    <path d="M6.5 9.2c2.6-.8 5.1-.4 7.5 1.2v10c-2.4-1.5-4.9-1.9-7.5-1.1V9.2Z" fill="none" stroke="#fff" strokeWidth="1.45" strokeLinejoin="round" />
    <path d="M21.5 9.2c-2.6-.8-5.1-.4-7.5 1.2v10c2.4-1.5 4.9-1.9 7.5-1.1V9.2Z" fill="none" stroke="#fff" strokeWidth="1.45" strokeLinejoin="round" />
    <circle cx="14" cy="6.4" r="1.45" fill="#e8d9b9" />
  </svg>;
}
