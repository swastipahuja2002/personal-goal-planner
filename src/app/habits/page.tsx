import { supabase } from '@/lib/supabase'
import type { Habit, HabitLog, Goal } from '@/types'
import HabitsClient from './HabitsClient'

export const revalidate = 0

export default async function HabitsPage() {
  // Get last 90 days of data
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const startDate = ninetyDaysAgo.toISOString().split('T')[0]

  const [habitsRes, goalsRes, logsRes] = await Promise.all([
    supabase.from('habits').select('*').order('created_at'),
    supabase.from('goals').select('id,title,color,category').eq('status', 'active'),
    supabase.from('habit_logs').select('*').gte('completed_date', startDate).order('completed_date'),
  ])

  const habits: Habit[] = habitsRes.data || []
  const goals = (goalsRes.data || []) as Pick<Goal, 'id' | 'title' | 'color' | 'category'>[]
  const logs: HabitLog[] = logsRes.data || []

  return <HabitsClient habits={habits} goals={goals} logs={logs} />
}
