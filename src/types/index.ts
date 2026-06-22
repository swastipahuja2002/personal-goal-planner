export interface Goal {
  id: string
  title: string
  description: string
  category: string
  status: string
  priority: number
  target_date: string | null
  progress: number
  current_phase: string
  icon: string
  color: string
  created_at: string
  updated_at: string
}

export interface Milestone {
  id: string
  goal_id: string
  title: string
  description: string | null
  target_date: string | null
  completed: boolean
  completed_at: string | null
  sort_order: number
  created_at: string
}

export interface Habit {
  id: string
  goal_id: string
  title: string
  frequency: string
  created_at: string
}

export interface HabitLog {
  id: string
  habit_id: string
  completed_date: string
  completed: boolean
  created_at: string
}

export interface DailyTask {
  id: string
  title: string
  goal_id: string | null
  task_date: string
  completed: boolean
  rolled_from: string | null
  roll_count: number
  skip_reason: string | null
  recurrence: string | null
  created_at: string
}

export interface DayLog {
  id: string
  log_date: string
  hour_slot: string
  content: string | null
  span_hours: number
  created_at: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Checkin {
  id: string
  week_start: string
  responses: Record<string, string>
  ai_feedback: string | null
  score: number | null
  created_at: string
}
