import { supabase } from '@/lib/supabase'
import type { Goal } from '@/types'
import GoalsClient from './GoalsClient'

export const revalidate = 0

export default async function GoalsPage() {
  const { data } = await supabase.from('goals').select('*').order('priority', { ascending: false })
  const goals: Goal[] = data || []
  return <GoalsClient goals={goals} />
}
