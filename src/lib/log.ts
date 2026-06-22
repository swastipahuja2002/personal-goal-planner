import { supabase } from './supabase'

type ActionType =
  | 'task.add' | 'task.complete' | 'task.uncomplete' | 'task.delete' | 'task.roll'
  | 'habit.log' | 'habit.unlog'
  | 'kr.complete' | 'kr.uncomplete' | 'kr.add' | 'kr.delete'
  | 'goal.phase_update'
  | 'checkin.submit'
  | 'plan.import'

interface LogOptions {
  entityType?: string
  entityId?: string
  entityTitle?: string
  goalId?: string
  metadata?: Record<string, unknown>
}

function getSource(): string {
  if (typeof window === 'undefined') return 'server'
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'web'
}

export async function logAction(action: ActionType, opts: LogOptions = {}) {
  await supabase.from('activity_log').insert({
    action,
    entity_type: opts.entityType,
    entity_id: opts.entityId,
    entity_title: opts.entityTitle,
    goal_id: opts.goalId || null,
    metadata: opts.metadata,
    source: getSource(),
  })
}
