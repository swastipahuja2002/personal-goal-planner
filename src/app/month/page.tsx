import { supabase } from '@/lib/supabase'
import type { Goal, Milestone, DailyTask } from '@/types'
import MonthClient from './MonthClient'

export const revalidate = 0

export default async function MonthPage() {
  const now = new Date()
  const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month, 1).toISOString().split('T')[0]
  const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0]
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const [goalsRes, milestonesRes, tasksRes] = await Promise.all([
    supabase.from('goals').select('*').eq('status', 'active').order('priority', { ascending: false }),
    supabase.from('milestones').select('*').order('sort_order'),
    supabase.from('daily_tasks').select('task_date,completed').gte('task_date', firstDay).lte('task_date', lastDay),
  ])

  const goals: Goal[] = goalsRes.data || []
  const milestones: Milestone[] = milestonesRes.data || []
  const tasks: Pick<DailyTask, 'task_date' | 'completed'>[] = tasksRes.data || []

  const milestonesByGoal = milestones.reduce<Record<string, Milestone[]>>((acc, m) => {
    if (!acc[m.goal_id]) acc[m.goal_id] = []
    acc[m.goal_id].push(m)
    return acc
  }, {})

  // Build day completion map: date -> { done, total }
  const dayMap: Record<string, { done: number; total: number }> = {}
  for (const t of tasks) {
    if (!dayMap[t.task_date]) dayMap[t.task_date] = { done: 0, total: 0 }
    dayMap[t.task_date].total++
    if (t.completed) dayMap[t.task_date].done++
  }

  return (
    <MonthClient
      goals={goals}
      milestonesByGoal={milestonesByGoal}
      monthName={monthName}
      dayMap={dayMap}
      daysInMonth={daysInMonth}
      firstDayOfWeek={new Date(year, month, 1).getDay()}
      year={year}
      month={month}
    />
  )
}
