'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { goalColor } from '@/lib/goals'
import type { Habit, HabitLog, Goal } from '@/types'

type GoalMin = Pick<Goal, 'id' | 'title' | 'color' | 'category'>

interface Props { habits: Habit[]; goals: GoalMin[]; logs: HabitLog[] }

function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().split('T')[0]
  })
}

function groupIntoWeeks(days: string[]): string[][] {
  const weeks: string[][] = []; let week: string[] = []
  days.forEach((d, i) => {
    week.push(d)
    if (week.length === 7 || i === days.length - 1) { weeks.push(week); week = [] }
  })
  return weeks
}

function getCurrentStreak(dates: Set<string>, allDays: string[], today: string): number {
  let streak = 0
  for (let i = allDays.length - 1; i >= 0; i--) {
    if (allDays[i] > today) continue
    if (dates.has(allDays[i])) streak++
    else break
  }
  return streak
}

function getBestStreak(dates: Set<string>, allDays: string[]): number {
  let best = 0, cur = 0
  for (const d of allDays) { if (dates.has(d)) { cur++; best = Math.max(best, cur) } else cur = 0 }
  return best
}

export default function HabitsClient({ habits: initHabits, goals, logs: initLogs }: Props) {
  const [habits, setHabits] = useState(initHabits)
  const [logs, setLogs] = useState(initLogs)
  const [selected, setSelected] = useState<string | null>(null)
  const [editingHabit, setEditingHabit] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newHabit, setNewHabit] = useState({ title: '', goal_id: '', frequency: 'daily' })

  const allDays = getLastNDays(84)
  const today = new Date().toISOString().split('T')[0]
  const goalMap = Object.fromEntries(goals.map(g => [g.id, g]))
  const weeks = groupIntoWeeks(allDays)

  const monthLabels = (() => {
    const labels: { label: string; col: number }[] = []; let last = ''
    weeks.forEach((week, wi) => {
      const m = new Date(week[0] + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })
      if (m !== last) { labels.push({ label: m, col: wi }); last = m }
    })
    return labels
  })()

  function loggedDates(habitId: string) {
    return new Set(logs.filter(l => l.habit_id === habitId && l.completed).map(l => l.completed_date))
  }

  async function toggleDay(habitId: string, date: string) {
    if (date > today) return
    const done = loggedDates(habitId).has(date)
    if (done) {
      await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('completed_date', date)
      setLogs(ls => ls.filter(l => !(l.habit_id === habitId && l.completed_date === date)))
    } else {
      const { data } = await supabase.from('habit_logs')
        .upsert({ habit_id: habitId, completed_date: date, completed: true }, { onConflict: 'habit_id,completed_date' })
        .select().single()
      if (data) setLogs(ls => [...ls.filter(l => !(l.habit_id === habitId && l.completed_date === date)), data])
    }
  }

  async function updateHabitTitle(habitId: string, title: string) {
    if (!title.trim()) return
    await supabase.from('habits').update({ title: title.trim() }).eq('id', habitId)
    setHabits(hs => hs.map(h => h.id === habitId ? { ...h, title: title.trim() } : h))
    setEditingHabit(null)
  }

  async function deleteHabit(habitId: string) {
    if (!confirm('Delete this habit and all its logs?')) return
    await supabase.from('habits').delete().eq('id', habitId)
    setHabits(hs => hs.filter(h => h.id !== habitId))
    setLogs(ls => ls.filter(l => l.habit_id !== habitId))
  }

  async function addHabit() {
    if (!newHabit.title.trim()) return
    const { data } = await supabase.from('habits').insert({
      title: newHabit.title.trim(),
      goal_id: newHabit.goal_id || null,
      frequency: newHabit.frequency,
    }).select().single()
    if (data) setHabits(hs => [...hs, data])
    setNewHabit({ title: '', goal_id: '', frequency: 'daily' })
    setShowAdd(false)
  }

  const inputStyle = {
    background: '#111118', border: '1px solid #1e1e2e', borderRadius: 7,
    color: '#d4d4e8', padding: '7px 12px', outline: 'none', fontSize: 12,
  }

  return (
    <div>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="section-label">Loop-style tracker</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e8e8f8', letterSpacing: '-0.5px' }}>Habits</h1>
          <p style={{ color: '#404058', fontSize: 12, marginTop: 4 }}>last 12 weeks · click circle to log today · expand for full calendar</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          background: showAdd ? '#1e1e2e' : 'rgba(244,114,182,0.1)',
          border: `1px solid ${showAdd ? '#2a2a3e' : 'rgba(244,114,182,0.25)'}`,
          color: '#f472b6', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 500,
        }}>
          {showAdd ? '✕ cancel' : '+ add habit'}
        </button>
      </div>

      {/* Add habit form */}
      {showAdd && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            autoFocus
            value={newHabit.title}
            onChange={e => setNewHabit(p => ({ ...p, title: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addHabit()}
            placeholder="habit name..."
            style={{ ...inputStyle, flex: 1, minWidth: 180 }}
          />
          <select
            value={newHabit.goal_id}
            onChange={e => setNewHabit(p => ({ ...p, goal_id: e.target.value }))}
            style={{ ...inputStyle }}
          >
            <option value="">no goal</option>
            {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <select
            value={newHabit.frequency}
            onChange={e => setNewHabit(p => ({ ...p, frequency: e.target.value }))}
            style={{ ...inputStyle }}
          >
            <option value="daily">daily</option>
            <option value="weekdays">weekdays</option>
            <option value="weekends">weekends</option>
          </select>
          <button onClick={addHabit} style={{
            background: '#f472b6', border: 'none', borderRadius: 7,
            color: '#0a0a0f', padding: '7px 16px', fontSize: 12, fontWeight: 600,
          }}>Add</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {habits.map(habit => {
          const g = goalMap[habit.goal_id]
          const color = g ? goalColor(g) : '#f472b6'
          const dates = loggedDates(habit.id)
          const streak = getCurrentStreak(dates, allDays, today)
          const best = getBestStreak(dates, allDays)
          const total = dates.size
          const isOpen = selected === habit.id
          const isEditingTitle = editingHabit === habit.id

          return (
            <div key={habit.id} className="card" style={{
              overflow: 'hidden',
              borderLeft: `3px solid ${isOpen ? color : color + '30'}`,
              transition: 'border-color 0.2s',
            }}>
              {/* Habit row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                {/* Today toggle */}
                <button
                  onClick={() => toggleDay(habit.id, today)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${dates.has(today) ? color : '#2a2a3a'}`,
                    background: dates.has(today) ? color : `${color}12`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', cursor: 'pointer',
                    boxShadow: dates.has(today) ? `0 0 8px ${color}50` : 'none',
                  }}
                >
                  {dates.has(today) && <span style={{ color: '#0a0a0f', fontSize: 10, fontWeight: 700 }}>✓</span>}
                </button>

                {/* Title */}
                {isEditingTitle ? (
                  <input
                    autoFocus
                    defaultValue={habit.title}
                    onBlur={e => updateHabitTitle(habit.id, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') updateHabitTitle(habit.id, (e.target as HTMLInputElement).value)
                      if (e.key === 'Escape') setEditingHabit(null)
                    }}
                    style={{
                      flex: 1, background: `${color}08`, border: `1px solid ${color}25`,
                      borderRadius: 6, color: '#e0e0f0', padding: '3px 8px',
                      outline: 'none', fontSize: 13,
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    onClick={() => setSelected(isOpen ? null : habit.id)}
                    style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#d4d4e8', cursor: 'pointer' }}
                  >
                    {habit.title}
                  </span>
                )}

                {g && <span className="tag" style={{ color, background: `${color}12`, border: `1px solid ${color}20` }}>{g.title.split(' ')[0]}</span>}

                {/* Mini sparkline — last 7 days */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {allDays.slice(-7).map(d => (
                    <div key={d} style={{
                      width: 8, height: 8, borderRadius: 2,
                      background: dates.has(d) ? color : '#1e1e2e',
                      boxShadow: dates.has(d) ? `0 0 4px ${color}50` : 'none',
                    }} />
                  ))}
                </div>

                {streak > 0 && (
                  <span style={{ color: '#fb923c', fontSize: 12, fontWeight: 600 }}>🔥{streak}</span>
                )}

                <button className="icon-btn" onClick={() => setEditingHabit(habit.id)} title="edit">✎</button>
                <button className="icon-btn danger" onClick={() => deleteHabit(habit.id)} title="delete">✕</button>
                <button className="icon-btn" onClick={() => setSelected(isOpen ? null : habit.id)}>
                  {isOpen ? '▴' : '▾'}
                </button>
              </div>

              {/* Expanded calendar */}
              {isOpen && (
                <div style={{ borderTop: '1px solid #1a1a28', padding: '16px' }}>
                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 24, marginBottom: 18 }}>
                    {[
                      { label: 'streak', value: `${streak}d` },
                      { label: 'best', value: `${best}d` },
                      { label: '12wk total', value: `${total}` },
                      { label: 'this week', value: `${allDays.slice(-7).filter(d => dates.has(d)).length}/7` },
                    ].map(s => (
                      <div key={s.label}>
                        <p style={{ color, fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1 }}>{s.value}</p>
                        <p style={{ color: '#333', fontSize: 10, margin: '3px 0 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid — Loop style */}
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ display: 'flex', marginBottom: 5, paddingLeft: 24 }}>
                      {weeks.map((_, wi) => {
                        const ml = monthLabels.find(m => m.col === wi)
                        return (
                          <div key={wi} style={{ width: 18, marginRight: 3, fontSize: 9, color: '#333', flexShrink: 0 }}>
                            {ml?.label || ''}
                          </div>
                        )
                      })}
                    </div>

                    {['M','T','W','T','F','S','S'].map((dayLabel, dayIdx) => (
                      <div key={dayIdx} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ width: 20, fontSize: 9, color: '#2a2a3a', flexShrink: 0 }}>{dayLabel}</span>
                        {weeks.map((week, wi) => {
                          const d = week[dayIdx]
                          if (!d) return <div key={wi} style={{ width: 18, marginRight: 3 }} />
                          const done = dates.has(d)
                          const future = d > today
                          const isToday = d === today
                          return (
                            <div
                              key={wi}
                              onClick={() => !future && toggleDay(habit.id, d)}
                              title={d}
                              style={{
                                width: 18, height: 18, borderRadius: 3, marginRight: 3,
                                background: done ? color : '#151520',
                                border: isToday ? `1px solid ${color}80` : '1px solid transparent',
                                cursor: future ? 'default' : 'pointer',
                                opacity: future ? 0.15 : 1,
                                boxShadow: done && isToday ? `0 0 6px ${color}60` : 'none',
                                transition: 'background 0.1s',
                                flexShrink: 0,
                              }}
                            />
                          )
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Frequency dots — Loop style */}
                  <div style={{ marginTop: 16 }}>
                    <p className="section-label" style={{ marginBottom: 8 }}>Weekly frequency</p>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end' }}>
                      {weeks.map((week, wi) => {
                        const cnt = week.filter(d => dates.has(d)).length
                        const size = 6 + cnt * 3
                        return (
                          <div key={wi} title={`${cnt}/7`} style={{
                            width: size, height: size, borderRadius: '50%',
                            background: cnt > 0 ? color : '#1e1e2e',
                            opacity: 0.3 + cnt * 0.12,
                            boxShadow: cnt >= 5 ? `0 0 6px ${color}50` : 'none',
                            transition: 'all 0.2s',
                          }} />
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {habits.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#333' }}>
            <p style={{ fontSize: 14 }}>No habits yet.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Click "+ add habit" to start.</p>
          </div>
        )}
      </div>
    </div>
  )
}
