import { supabase } from '@/lib/supabase'
import { today, addDays, matchesRecurrence } from '@/lib/goals'
import type { DailyTask, DayLog, Goal } from '@/types'
import TodayClient from './components/TodayClient'

export const revalidate = 0

export default async function TodayPage() {
  const todayStr = today()

  // Fetch recurring tasks from past 60 days and generate today's instances if missing
  const sinceDate = addDays(todayStr, -60)
  const { data: recurringTemplates } = await supabase
    .from('daily_tasks')
    .select('*')
    .not('recurrence', 'is', null)
    .gte('task_date', sinceDate)

  if (recurringTemplates?.length) {
    const { data: todayTasks } = await supabase
      .from('daily_tasks').select('title,recurrence').eq('task_date', todayStr)

    const todayTitles = new Set((todayTasks || []).map(t => `${t.title}::${t.recurrence}`))

    // Deduplicate by title+recurrence, keep most recent template per unique task
    const seen = new Map<string, typeof recurringTemplates[0]>()
    for (const t of recurringTemplates) {
      const key = `${t.title}::${t.recurrence}`
      if (!seen.has(key)) seen.set(key, t)
    }

    const toCreate = []
    for (const [key, task] of seen) {
      if (todayTitles.has(key)) continue
      if (!task.recurrence) continue

      let shouldCreate = false
      if (task.recurrence === 'daily') shouldCreate = true
      else if (task.recurrence.startsWith('weekly:')) {
        shouldCreate = matchesRecurrence(task.recurrence, todayStr)
      } else if (task.recurrence === 'monthly') {
        const templateDay = new Date(task.task_date + 'T00:00:00').getDate()
        const todayDay = new Date(todayStr + 'T00:00:00').getDate()
        shouldCreate = templateDay === todayDay
      }

      if (shouldCreate) {
        toCreate.push({
          title: task.title,
          goal_id: task.goal_id,
          task_date: todayStr,
          recurrence: task.recurrence,
        })
      }
    }

    if (toCreate.length) {
      await supabase.from('daily_tasks').insert(toCreate)
    }
  }

  const [tasksRes, goalsRes, logsRes] = await Promise.all([
    supabase.from('daily_tasks').select('*').eq('task_date', todayStr).order('created_at'),
    supabase.from('goals').select('id,title,color,category').eq('status', 'active').order('priority', { ascending: false }),
    supabase.from('day_logs').select('*').eq('log_date', todayStr),
  ])

  const tasks: DailyTask[] = tasksRes.data || []
  const goals = (goalsRes.data || []) as Pick<Goal, 'id' | 'title' | 'color' | 'category'>[]
  const logs: DayLog[] = logsRes.data || []
  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return <TodayClient tasks={tasks} goals={goals} logs={logs} todayStr={todayStr} dateLabel={dateLabel} />
}
