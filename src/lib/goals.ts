export const GOAL_COLORS: Record<string, string> = {
  career: '#fb923c',
  health: '#34d399',
  education: '#60a5fa',
  impact: '#f59e0b',
  personal: '#f472b6',
}

export function goalColor(goal: { color?: string; category?: string; title?: string }): string {
  if (goal.color) return goal.color
  if (goal.category) return GOAL_COLORS[goal.category] || '#6b6b8a'
  return '#6b6b8a'
}

// 24 hours — index 0 = midnight, index 12 = noon
export const HOURS_24 = [
  '12am','1am','2am','3am','4am','5am','6am','7am','8am',
  '9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm',
  '6pm','7pm','8pm','9pm','10pm','11pm',
]

export function hourIndex(slot: string): number {
  const i = HOURS_24.indexOf(slot)
  return i >= 0 ? i : -1
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const t = today()
  if (dateStr === t) return 'Today'
  if (dateStr === addDays(t, -1)) return 'Yesterday'
  if (dateStr === addDays(t, 1)) return 'Tomorrow'
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

// recurrence helpers
export const RECURRENCE_OPTIONS = [
  { value: '', label: 'No repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly:1', label: 'Every Monday' },
  { value: 'weekly:2', label: 'Every Tuesday' },
  { value: 'weekly:3', label: 'Every Wednesday' },
  { value: 'weekly:4', label: 'Every Thursday' },
  { value: 'weekly:5', label: 'Every Friday' },
  { value: 'weekly:6', label: 'Every Saturday' },
  { value: 'weekly:0', label: 'Every Sunday' },
  { value: 'monthly', label: 'Same day each month' },
]

export function matchesRecurrence(recurrence: string, dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00')
  if (recurrence === 'daily') return true
  if (recurrence.startsWith('weekly:')) {
    const day = parseInt(recurrence.split(':')[1])
    return d.getDay() === day
  }
  if (recurrence === 'monthly') return true // caller checks day-of-month separately
  return false
}
