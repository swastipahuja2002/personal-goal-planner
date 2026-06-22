import { supabase } from '@/lib/supabase'
import type { DailyTask, DayLog, HabitLog, Habit, Goal } from '@/types'
import ReviewClient from './ReviewClient'

export const revalidate = 0

function getWeekRange() {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(today); mon.setDate(diff)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return {
    start: mon.toISOString().split('T')[0],
    end: sun.toISOString().split('T')[0],
    weekDates: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i)
      return d.toISOString().split('T')[0]
    }),
  }
}

export default async function ReviewPage() {
  const { start, end, weekDates } = getWeekRange()
  const today = new Date().toISOString().split('T')[0]

  const [tasksRes, logsRes, habitLogsRes, habitsRes, goalsRes, undoneTodayRes] = await Promise.all([
    supabase.from('daily_tasks').select('*').gte('task_date', start).lte('task_date', end).order('task_date'),
    supabase.from('day_logs').select('*').gte('log_date', start).lte('log_date', end).not('content', 'is', null),
    supabase.from('habit_logs').select('*').gte('completed_date', start).lte('completed_date', end),
    supabase.from('habits').select('*'),
    supabase.from('goals').select('id,title,color,category').eq('status', 'active'),
    supabase.from('daily_tasks').select('*').eq('task_date', today).eq('completed', false),
  ])

  const tasks: DailyTask[] = tasksRes.data || []
  const logs: DayLog[] = logsRes.data || []
  const habitLogs: HabitLog[] = habitLogsRes.data || []
  const habits: Habit[] = habitsRes.data || []
  const goals = (goalsRes.data || []) as Pick<Goal, 'id' | 'title' | 'color' | 'category'>[]
  const undoneToday: DailyTask[] = undoneTodayRes.data || []

  return (
    <ReviewClient
      tasks={tasks}
      logs={logs}
      habitLogs={habitLogs}
      habits={habits}
      goals={goals}
      weekDates={weekDates}
      undoneToday={undoneToday}
      today={today}
      weekStart={start}
    />
  )
}
