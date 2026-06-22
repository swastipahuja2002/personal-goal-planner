'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { goalColor, today, formatDateLabel, RECURRENCE_OPTIONS } from '@/lib/goals'
import { logAction } from '@/lib/log'
import type { Goal, Milestone, DailyTask } from '@/types'

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return mobile
}

interface Props {
  goals: Goal[]
  milestonesByGoal: Record<string, Milestone[]>
  monthName: string
  dayMap: Record<string, { done: number; total: number }>
  daysInMonth: number
  firstDayOfWeek: number
  year: number
  month: number
}

export default function MonthClient({ goals, milestonesByGoal: initMilestones, monthName, dayMap: initDayMap, daysInMonth, firstDayOfWeek, year, month }: Props) {
  const isMobile = useIsMobile()
  const [milestonesByGoal, setMilestonesByGoal] = useState(initMilestones)
  const [dayMap, setDayMap] = useState(initDayMap)
  const [newKR, setNewKR] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [editingKR, setEditingKR] = useState<string | null>(null)
  const [editingGoalPhase, setEditingGoalPhase] = useState<string | null>(null)

  // Day panel state
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [dayTasks, setDayTasks] = useState<DailyTask[]>([])
  const [loadingDay, setLoadingDay] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskGoal, setNewTaskGoal] = useState('')
  const [newTaskRecurrence, setNewTaskRecurrence] = useState('')

  const todayStr = today()
  const allKRs = Object.values(milestonesByGoal).flat()
  const doneKRs = allKRs.filter(m => m.completed).length
  const overallPct = allKRs.length > 0 ? Math.round((doneKRs / allKRs.length) * 100) : 0
  const goalMap = Object.fromEntries(goals.map(g => [g.id, g]))

  function dayStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  useEffect(() => {
    if (!selectedDay) return
    setLoadingDay(true)
    supabase.from('daily_tasks').select('*').eq('task_date', dayStr(selectedDay)).order('created_at')
      .then(({ data }) => { setDayTasks(data || []); setLoadingDay(false) })
  }, [selectedDay])

  // Day panel task actions
  async function addDayTask() {
    if (!newTaskTitle.trim() || !selectedDay) return
    const ds = dayStr(selectedDay)
    const { data } = await supabase.from('daily_tasks').insert({
      title: newTaskTitle.trim(), goal_id: newTaskGoal || null,
      task_date: ds, recurrence: newTaskRecurrence || null,
    }).select().single()
    if (data) {
      setDayTasks(t => [...t, data])
      setDayMap(dm => {
        const prev = dm[ds] || { done: 0, total: 0 }
        return { ...dm, [ds]: { done: prev.done, total: prev.total + 1 } }
      })
      logAction('task.add', { entityType: 'task', entityId: data.id, entityTitle: data.title, goalId: newTaskGoal || undefined })
    }
    setNewTaskTitle(''); setNewTaskGoal(''); setNewTaskRecurrence('')
  }

  async function toggleDayTask(task: DailyTask) {
    const { data } = await supabase.from('daily_tasks')
      .update({ completed: !task.completed }).eq('id', task.id).select().single()
    if (data) {
      setDayTasks(ts => ts.map(t => t.id === task.id ? data : t))
      if (selectedDay) {
        const ds = dayStr(selectedDay)
        setDayMap(dm => {
          const prev = dm[ds] || { done: 0, total: 0 }
          return { ...dm, [ds]: { done: task.completed ? prev.done - 1 : prev.done + 1, total: prev.total } }
        })
      }
      logAction(task.completed ? 'task.uncomplete' : 'task.complete', { entityType: 'task', entityId: task.id, entityTitle: task.title, goalId: task.goal_id || undefined })
    }
  }

  async function deleteDayTask(task: DailyTask) {
    await supabase.from('daily_tasks').delete().eq('id', task.id)
    setDayTasks(ts => ts.filter(t => t.id !== task.id))
    if (selectedDay) {
      const ds = dayStr(selectedDay)
      setDayMap(dm => {
        const prev = dm[ds] || { done: 0, total: 0 }
        return { ...dm, [ds]: { done: task.completed ? prev.done - 1 : prev.done, total: Math.max(0, prev.total - 1) } }
      })
    }
    logAction('task.delete', { entityType: 'task', entityId: task.id, entityTitle: task.title })
  }

  // KR actions
  async function toggleKR(m: Milestone) {
    const { data } = await supabase.from('milestones')
      .update({ completed: !m.completed, completed_at: !m.completed ? new Date().toISOString() : null })
      .eq('id', m.id).select().single()
    if (data) {
      updateMilestoneState(data)
      logAction(m.completed ? 'kr.uncomplete' : 'kr.complete', { entityType: 'milestone', entityId: m.id, entityTitle: m.title, goalId: m.goal_id })
    }
  }

  async function updateKRTitle(m: Milestone, title: string) {
    if (!title.trim()) return
    await supabase.from('milestones').update({ title: title.trim() }).eq('id', m.id)
    updateMilestoneState({ ...m, title: title.trim() })
    setEditingKR(null)
  }

  async function deleteKR(m: Milestone) {
    await supabase.from('milestones').delete().eq('id', m.id)
    setMilestonesByGoal(prev => ({ ...prev, [m.goal_id]: (prev[m.goal_id] || []).filter(x => x.id !== m.id) }))
  }

  async function addKR(goalId: string) {
    const title = newKR[goalId]?.trim()
    if (!title) return
    const { data } = await supabase.from('milestones')
      .insert({ goal_id: goalId, title, sort_order: (milestonesByGoal[goalId] || []).length + 1 })
      .select().single()
    if (data) { setMilestonesByGoal(prev => ({ ...prev, [goalId]: [...(prev[goalId] || []), data] })); setNewKR(p => ({ ...p, [goalId]: '' })) }
  }

  async function updateGoalPhase(goalId: string, phase: string) {
    await supabase.from('goals').update({ current_phase: phase }).eq('id', goalId)
    setEditingGoalPhase(null)
  }

  function updateMilestoneState(data: Milestone) {
    setMilestonesByGoal(prev => ({ ...prev, [data.goal_id]: (prev[data.goal_id] || []).map(x => x.id === data.id ? data : x) }))
  }

  // Calendar grid
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
  const totalCells = Math.ceil((daysInMonth + startOffset) / 7) * 7
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const day = i - startOffset + 1
    return day >= 1 && day <= daysInMonth ? day : null
  })

  function cellColor(day: number): string | null {
    const ds = dayStr(day)
    const d = dayMap[ds]
    if (!d || d.total === 0) return null
    const pct = d.done / d.total
    if (pct === 1) return '#f472b6'
    if (pct >= 0.5) return '#a78bfa'
    return '#2a2a3e'
  }

  const todayDay = new Date().getDate()
  const isCurrentMonth = new Date().getMonth() === month && new Date().getFullYear() === year
  const selectedDateStr = selectedDay ? dayStr(selectedDay) : null
  const doneTasks = dayTasks.filter(t => t.completed).length

  return (
    <div style={{ position: 'relative' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p className="section-label">Monthly OKRs</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e8e8f8', letterSpacing: '-0.5px' }}>{monthName}</h1>
          <span style={{ color: '#404058', fontSize: 13 }}>{doneKRs}/{allKRs.length} key results · {overallPct}%</span>
        </div>
        <div style={{ marginTop: 10, height: 3, background: '#1a1a28', borderRadius: 2, maxWidth: 260 }}>
          <div style={{ height: '100%', width: `${overallPct}%`, background: 'linear-gradient(90deg,#f472b6,#a78bfa)', borderRadius: 2, transition: 'width 0.5s' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Calendar + OKRs (full width on mobile) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Interactive Calendar */}
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p className="section-label" style={{ margin: 0 }}>Daily Tasks · {monthName}</p>
              <span style={{ color: '#2a2a3a', fontSize: 10 }}>click a day to view & edit</span>
            </div>

            {/* Day labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 9, color: '#2a2a3a', textTransform: 'uppercase' }}>{d}</div>
              ))}
            </div>

            {/* Calendar cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const ds = dayStr(day)
                const isToday = isCurrentMonth && day === todayDay
                const isFuture = ds > todayStr
                const isSelected = selectedDay === day
                const color = isFuture ? null : cellColor(day)
                const d = dayMap[ds]

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    title={d ? `${d.done}/${d.total} tasks done` : 'No tasks'}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 6,
                      background: isSelected ? '#f472b6' : color || '#141420',
                      border: isToday && !isSelected ? '1px solid #f472b640' : isSelected ? '1px solid #f472b6' : '1px solid transparent',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      opacity: isFuture ? 0.25 : 1,
                      boxShadow: isSelected ? '0 0 12px rgba(244,114,182,0.4)' : color === '#f472b6' ? '0 0 6px rgba(244,114,182,0.25)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{
                      fontSize: 11, fontWeight: isToday || isSelected ? 700 : 400,
                      color: isSelected ? '#0a0a0f' : (color && color !== '#1a1a28' && color !== '#141420') ? '#fff' : '#404058',
                    }}>
                      {day}
                    </span>
                    {d && d.total > 0 && !isSelected && (
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>{d.done}/{d.total}</span>
                    )}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
              {[['#f472b6','all done'],['#a78bfa','partial'],['#141420','no tasks']].map(([c,l]) => (
                <span key={l} style={{ fontSize: 10, color: '#333', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: c }} />{l}
                </span>
              ))}
            </div>
          </div>

          {/* OKRs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {goals.map(goal => {
              const krs = milestonesByGoal[goal.id] || []
              const doneCnt = krs.filter(m => m.completed).length
              const pct = krs.length > 0 ? Math.round((doneCnt / krs.length) * 100) : 0
              const color = goalColor(goal)
              const isCollapsed = collapsed[goal.id]

              return (
                <div key={goal.id} className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}60` }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#e0e0f0' }}>{goal.title}</span>
                      <div style={{ marginTop: 2 }}>
                        {editingGoalPhase === goal.id ? (
                          <input autoFocus defaultValue={goal.current_phase}
                            onBlur={e => updateGoalPhase(goal.id, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') updateGoalPhase(goal.id, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingGoalPhase(null) }}
                            style={{ background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 5, color: '#bbb', padding: '2px 8px', outline: 'none', fontSize: 11, width: 220 }}
                          />
                        ) : (
                          <span onClick={() => setEditingGoalPhase(goal.id)} style={{ color: '#404058', fontSize: 11, cursor: 'text' }}>
                            {goal.current_phase || '+ set phase'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: i < Math.round(pct / 10) ? color : '#1e1e2e', boxShadow: i < Math.round(pct / 10) ? `0 0 4px ${color}50` : 'none' }} />
                      ))}
                    </div>
                    <span style={{ color, fontSize: 13, fontWeight: 700, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
                    <button className="icon-btn" onClick={() => setCollapsed(p => ({ ...p, [goal.id]: !isCollapsed }))} style={{ fontSize: 14 }}>{isCollapsed ? '▸' : '▾'}</button>
                  </div>

                  {!isCollapsed && (
                    <div style={{ borderTop: '1px solid #1a1a28' }}>
                      {krs.map(kr => (
                        <div key={kr.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 8px 36px', borderBottom: '1px solid #14141e', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#0f0f1a'}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                        >
                          <button onClick={() => toggleKR(kr)} style={{ width: 15, height: 15, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${kr.completed ? color : '#2a2a3a'}`, background: kr.completed ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', cursor: 'pointer' }}>
                            {kr.completed && <span style={{ color: '#0a0a0f', fontSize: 8, fontWeight: 700 }}>✓</span>}
                          </button>
                          {editingKR === kr.id ? (
                            <input autoFocus defaultValue={kr.title}
                              onBlur={e => updateKRTitle(kr, e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') updateKRTitle(kr, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingKR(null) }}
                              style={{ flex: 1, background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 5, color: '#d4d4e8', padding: '2px 8px', outline: 'none', fontSize: 12 }}
                            />
                          ) : (
                            <span onClick={() => setEditingKR(kr.id)} style={{ flex: 1, fontSize: 12, color: kr.completed ? '#2a2a3a' : '#aaa', textDecoration: kr.completed ? 'line-through' : 'none', cursor: 'text' }}>{kr.title}</span>
                          )}
                          {kr.target_date && <span style={{ color: '#333', fontSize: 10 }}>{new Date(kr.target_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                          <button className="icon-btn" onClick={() => setEditingKR(kr.id)}>✎</button>
                          <button className="icon-btn danger" onClick={() => deleteKR(kr)}>✕</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, padding: '8px 16px 10px 36px' }}>
                        <input value={newKR[goal.id] || ''} onChange={e => setNewKR(p => ({ ...p, [goal.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addKR(goal.id)} placeholder="add key result..."
                          style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px dashed #2a2a3a', color: '#555', padding: '3px 0', outline: 'none', fontSize: 12, caretColor: color }}
                          onFocus={e => (e.target as HTMLInputElement).style.borderBottomColor = color}
                          onBlur={e => (e.target as HTMLInputElement).style.borderBottomColor = '#2a2a3a'}
                        />
                        <button onClick={() => addKR(goal.id)} style={{ background: 'none', border: 'none', color: newKR[goal.id]?.trim() ? color : '#2a2a3a', fontSize: 18, cursor: 'pointer', lineHeight: 1, fontWeight: 300 }}>+</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Desktop: Right side panel */}
        {selectedDay && !isMobile && (
          <div style={{
            width: 300, flexShrink: 0,
            background: 'linear-gradient(135deg,#13131f,#111118)',
            border: '1px solid #1e1e2e', borderRadius: 12,
            position: 'sticky', top: 68,
            maxHeight: 'calc(100vh - 90px)', overflowY: 'auto',
          }}>
            <DayPanel
              selectedDateStr={selectedDateStr}
              todayStr={todayStr}
              loadingDay={loadingDay}
              doneTasks={doneTasks}
              dayTasks={dayTasks}
              goalMap={goalMap}
              goals={goals}
              newTaskTitle={newTaskTitle}
              setNewTaskTitle={setNewTaskTitle}
              newTaskGoal={newTaskGoal}
              setNewTaskGoal={setNewTaskGoal}
              newTaskRecurrence={newTaskRecurrence}
              setNewTaskRecurrence={setNewTaskRecurrence}
              onClose={() => setSelectedDay(null)}
              onToggle={toggleDayTask}
              onDelete={deleteDayTask}
              onAdd={addDayTask}
            />
          </div>
        )}
      </div>

      {/* Mobile: Bottom sheet */}
      {selectedDay && isMobile && (
        <>
          <div
            onClick={() => setSelectedDay(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }}
          />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
            background: '#13131f', borderTop: '1px solid #2a2a3e',
            borderRadius: '16px 16px 0 0',
            maxHeight: '75vh', overflowY: 'auto',
          }}>
            <div style={{ width: 36, height: 4, background: '#2a2a3a', borderRadius: 2, margin: '10px auto 0' }} />
            <DayPanel
              selectedDateStr={selectedDateStr}
              todayStr={todayStr}
              loadingDay={loadingDay}
              doneTasks={doneTasks}
              dayTasks={dayTasks}
              goalMap={goalMap}
              goals={goals}
              newTaskTitle={newTaskTitle}
              setNewTaskTitle={setNewTaskTitle}
              newTaskGoal={newTaskGoal}
              setNewTaskGoal={setNewTaskGoal}
              newTaskRecurrence={newTaskRecurrence}
              setNewTaskRecurrence={setNewTaskRecurrence}
              onClose={() => setSelectedDay(null)}
              onToggle={toggleDayTask}
              onDelete={deleteDayTask}
              onAdd={addDayTask}
            />
          </div>
        </>
      )}
    </div>
  )
}

interface DayPanelProps {
  selectedDateStr: string | null
  todayStr: string
  loadingDay: boolean
  doneTasks: number
  dayTasks: DailyTask[]
  goalMap: Record<string, Goal>
  goals: Goal[]
  newTaskTitle: string
  setNewTaskTitle: (v: string) => void
  newTaskGoal: string
  setNewTaskGoal: (v: string) => void
  newTaskRecurrence: string
  setNewTaskRecurrence: (v: string) => void
  onClose: () => void
  onToggle: (t: DailyTask) => void
  onDelete: (t: DailyTask) => void
  onAdd: () => void
}

function DayPanel({ selectedDateStr, todayStr, loadingDay, doneTasks, dayTasks, goalMap, goals, newTaskTitle, setNewTaskTitle, newTaskGoal, setNewTaskGoal, newTaskRecurrence, setNewTaskRecurrence, onClose, onToggle, onDelete, onAdd }: DayPanelProps) {
  return (
    <>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a28', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ color: '#f472b6', fontSize: 11, fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {selectedDateStr === todayStr ? 'Today' : formatDateLabel(selectedDateStr || '')}
          </p>
          <p style={{ color: '#404058', fontSize: 10, margin: '2px 0 0' }}>
            {loadingDay ? 'loading...' : `${doneTasks}/${dayTasks.length} done`}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} style={{ fontSize: 16 }}>✕</button>
      </div>

      <div style={{ padding: '10px 0' }}>
        {!loadingDay && dayTasks.length === 0 && (
          <p style={{ color: '#2a2a3a', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>no tasks · add one below</p>
        )}
        {dayTasks.map(task => {
          const g = task.goal_id ? goalMap[task.goal_id] : null
          const color = g ? goalColor(g as Goal) : '#404058'
          return (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderBottom: '1px solid #14141e',
              opacity: task.completed ? 0.45 : 1,
            }}>
              <button onClick={() => onToggle(task)} style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${task.completed ? '#2a2a3a' : color}`,
                background: task.completed ? '#2a2a3a' : `${color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {task.completed && <span style={{ color: '#555', fontSize: 9 }}>✓</span>}
              </button>
              <span style={{
                flex: 1, fontSize: 13, color: task.completed ? '#333' : '#d4d4e8',
                textDecoration: task.completed ? 'line-through' : 'none',
                wordBreak: 'break-word',
              }}>
                {task.title}
                {task.recurrence && <span style={{ color: '#a78bfa', fontSize: 9, marginLeft: 6 }}>↻</span>}
              </span>
              {g && (
                <span style={{ fontSize: 9, color, background: `${color}15`, border: `1px solid ${color}20`, padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                  {(g as Goal).title.split(' ')[0]}
                </span>
              )}
              <button className="icon-btn danger" onClick={() => onDelete(task)} style={{ fontSize: 12 }}>✕</button>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a28' }}>
        <input
          value={newTaskTitle}
          onChange={e => setNewTaskTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAdd()}
          placeholder="add task for this day..."
          style={{
            width: '100%', background: '#0f0f1a', border: '1px solid #1e1e2e',
            borderRadius: 7, color: '#d4d4e8', padding: '9px 10px',
            outline: 'none', fontSize: 14, marginBottom: 8, boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <select value={newTaskGoal} onChange={e => setNewTaskGoal(e.target.value)}
            style={{ flex: 1, background: '#0f0f1a', border: '1px solid #1e1e2e', borderRadius: 6, color: newTaskGoal ? '#d4d4e8' : '#404058', padding: '7px 8px', outline: 'none', fontSize: 12 }}>
            <option value="">no goal</option>
            {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <select value={newTaskRecurrence} onChange={e => setNewTaskRecurrence(e.target.value)}
            style={{ background: '#0f0f1a', border: '1px solid #1e1e2e', borderRadius: 6, color: newTaskRecurrence ? '#a78bfa' : '#404058', padding: '7px 8px', outline: 'none', fontSize: 12 }}>
            {RECURRENCE_OPTIONS.slice(0, 4).map(o => <option key={o.value} value={o.value}>{o.label.replace('Every ', '↻ ')}</option>)}
          </select>
        </div>
        <button onClick={onAdd} disabled={!newTaskTitle.trim()} style={{
          width: '100%', background: newTaskTitle.trim() ? '#f472b6' : '#1e1e2e',
          border: 'none', borderRadius: 7, color: newTaskTitle.trim() ? '#0a0a0f' : '#333',
          padding: '9px', fontSize: 13, fontWeight: 600, cursor: newTaskTitle.trim() ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
        }}>
          Add to {formatDateLabel(selectedDateStr || '')}
        </button>
      </div>
    </>
  )
}
