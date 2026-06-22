'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { goalColor, HOURS_24, hourIndex, today, addDays, formatDateLabel, RECURRENCE_OPTIONS } from '@/lib/goals'
import type { DailyTask, DayLog, Goal } from '@/types'

type GoalMin = Pick<Goal, 'id' | 'title' | 'color' | 'category'>

interface Props {
  tasks: DailyTask[]
  goals: GoalMin[]
  logs: DayLog[]
  todayStr: string
  dateLabel: string
}

interface Block { hourIdx: number; spanHours: number; content: string; id?: string }

function logsToBlocks(logs: DayLog[]): Block[] {
  return logs
    .filter(l => l.content?.trim())
    .map(l => ({
      id: l.id,
      hourIdx: hourIndex(l.hour_slot) >= 0 ? hourIndex(l.hour_slot) : parseInt(l.hour_slot) || 0,
      spanHours: l.span_hours || 1,
      content: l.content || '',
    }))
    .sort((a, b) => a.hourIdx - b.hourIdx)
}

function isCoveredByBlock(idx: number, blocks: Block[]): Block | null {
  for (const b of blocks) {
    if (idx > b.hourIdx && idx < b.hourIdx + b.spanHours) return b
  }
  return null
}

function getBlockStarting(idx: number, blocks: Block[]): Block | null {
  return blocks.find(b => b.hourIdx === idx) || null
}

const ROW_H = 34

export default function TodayClient({ tasks: initTasks, goals, logs: initLogs, todayStr, dateLabel }: Props) {
  const [viewDate, setViewDate] = useState(todayStr)
  const [tasks, setTasks] = useState<DailyTask[]>(initTasks)
  const [logs, setLogs] = useState<DayLog[]>(initLogs)
  const [blocks, setBlocks] = useState<Block[]>(() => logsToBlocks(initLogs))
  const [loadingDate, setLoadingDate] = useState(false)

  // task form
  const [newTask, setNewTask] = useState('')
  const [selectedGoal, setSelectedGoal] = useState('')
  const [taskDate, setTaskDate] = useState(todayStr)
  const [recurrence, setRecurrence] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [triaging, setTriaging] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<string | null>(null)

  // drag state for hour log
  const [drag, setDrag] = useState<{ active: boolean; start: number; end: number } | null>(null)
  const [pendingBlock, setPendingBlock] = useState<{ start: number; end: number } | null>(null)
  const [pendingContent, setPendingContent] = useState('')
  const isDragging = useRef(false)

  const [savingTask, setSavingTask] = useState<string | null>(null)
  const [addingTask, setAddingTask] = useState(false)

  const todayNow = today()
  const isToday = viewDate === todayNow
  const goalMap = Object.fromEntries(goals.map(g => [g.id, g]))
  const done = tasks.filter(t => t.completed).length

  // Navigate to a different date
  async function navigateTo(date: string) {
    setViewDate(date)
    setLoadingDate(true)
    const [tasksRes, logsRes] = await Promise.all([
      supabase.from('daily_tasks').select('*').eq('task_date', date).order('created_at'),
      supabase.from('day_logs').select('*').eq('log_date', date),
    ])
    setTasks(tasksRes.data || [])
    const newLogs: DayLog[] = logsRes.data || []
    setLogs(newLogs)
    setBlocks(logsToBlocks(newLogs))
    setTaskDate(date)
    setLoadingDate(false)
  }

  // Task actions
  async function addTask() {
    if (!newTask.trim() || (taskDate === viewDate && tasks.length >= 6)) return
    setAddingTask(true)
    const { data } = await supabase.from('daily_tasks').insert({
      title: newTask.trim(), goal_id: selectedGoal || null,
      task_date: taskDate, recurrence: recurrence || null,
    }).select().single()
    setAddingTask(false)
    if (data && taskDate === viewDate) setTasks(t => [...t, data])
    setNewTask(''); setSelectedGoal(''); setRecurrence(''); setShowAdvanced(false)
    if (taskDate !== viewDate) setTaskDate(viewDate)
  }

  async function toggleTask(task: DailyTask) {
    setSavingTask(task.id)
    const { data } = await supabase.from('daily_tasks')
      .update({ completed: !task.completed }).eq('id', task.id).select().single()
    setSavingTask(null)
    if (data) setTasks(ts => ts.map(t => t.id === task.id ? data : t))
  }

  async function updateTaskTitle(taskId: string, title: string) {
    if (!title.trim()) return
    await supabase.from('daily_tasks').update({ title: title.trim() }).eq('id', taskId)
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, title: title.trim() } : t))
    setEditingTask(null)
  }

  async function deleteTask(taskId: string) {
    await supabase.from('daily_tasks').delete().eq('id', taskId)
    setTasks(ts => ts.filter(t => t.id !== taskId))
    setTriaging(null)
  }

  async function rollTask(taskId: string, daysAhead: number) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const nd = addDays(viewDate, daysAhead)
    await supabase.from('daily_tasks').update({
      task_date: nd, roll_count: (task.roll_count || 0) + 1, rolled_from: viewDate,
    }).eq('id', taskId)
    setTasks(ts => ts.filter(t => t.id !== taskId))
    setTriaging(null)
  }

  const isMobile = useRef(false)
  useEffect(() => {
    isMobile.current = window.matchMedia('(pointer: coarse)').matches
  }, [])

  // Hour log — desktop drag
  function onHourMouseDown(idx: number, e: React.MouseEvent) {
    if (isMobile.current) return
    e.preventDefault()
    isDragging.current = true
    setDrag({ active: true, start: idx, end: idx })
  }

  function onHourMouseEnter(idx: number) {
    if (!isDragging.current) return
    setDrag(d => d ? { ...d, end: idx } : null)
  }

  const finalizeDrag = useCallback(() => {
    if (!isDragging.current || !drag) return
    isDragging.current = false
    const start = Math.min(drag.start, drag.end)
    const end = Math.max(drag.start, drag.end)
    setDrag(null)
    setPendingBlock({ start, end })
    setPendingContent('')
  }, [drag])

  useEffect(() => {
    const up = () => { if (isDragging.current) finalizeDrag() }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [finalizeDrag])

  // Hour log — mobile tap (single hour)
  function onHourTap(idx: number) {
    setPendingBlock({ start: idx, end: idx })
    setPendingContent('')
  }

  async function savePendingBlock() {
    if (!pendingBlock || !pendingContent.trim()) { setPendingBlock(null); return }
    const span = pendingBlock.end - pendingBlock.start + 1
    const hourSlot = HOURS_24[pendingBlock.start]

    // Remove any existing logs in this range
    const covered = logs.filter(l => {
      const li = hourIndex(l.hour_slot) >= 0 ? hourIndex(l.hour_slot) : parseInt(l.hour_slot)
      return li >= pendingBlock.start && li <= pendingBlock.end
    })
    if (covered.length) {
      await supabase.from('day_logs').delete().in('id', covered.map(l => l.id))
    }

    const { data } = await supabase.from('day_logs').insert({
      log_date: viewDate, hour_slot: hourSlot,
      span_hours: span, content: pendingContent.trim(),
    }).select().single()

    if (data) {
      const newLogs = [...logs.filter(l => !covered.find(c => c.id === l.id)), data]
      setLogs(newLogs)
      setBlocks(logsToBlocks(newLogs))
    }
    setPendingBlock(null)
    setPendingContent('')
  }

  async function updateBlock(block: Block, content: string) {
    if (!block.id) return
    if (!content.trim()) {
      await supabase.from('day_logs').delete().eq('id', block.id)
      const newLogs = logs.filter(l => l.id !== block.id)
      setLogs(newLogs); setBlocks(logsToBlocks(newLogs))
      return
    }
    const { data } = await supabase.from('day_logs').update({ content }).eq('id', block.id).select().single()
    if (data) {
      const newLogs = logs.map(l => l.id === block.id ? data : l)
      setLogs(newLogs); setBlocks(logsToBlocks(newLogs))
    }
  }

  async function deleteBlock(block: Block) {
    if (!block.id) return
    await supabase.from('day_logs').delete().eq('id', block.id)
    const newLogs = logs.filter(l => l.id !== block.id)
    setLogs(newLogs); setBlocks(logsToBlocks(newLogs))
  }

  async function saveEmptyHour(hourSlot: string, content: string) {
    if (!content.trim()) return
    const existing = logs.find(l => l.hour_slot === hourSlot)
    if (existing) {
      const { data } = await supabase.from('day_logs').update({ content, span_hours: 1 }).eq('id', existing.id).select().single()
      if (data) { const nl = logs.map(l => l.id === existing.id ? data : l); setLogs(nl); setBlocks(logsToBlocks(nl)) }
    } else {
      const { data } = await supabase.from('day_logs').insert({ log_date: viewDate, hour_slot: hourSlot, content, span_hours: 1 }).select().single()
      if (data) { const nl = [...logs, data]; setLogs(nl); setBlocks(logsToBlocks(nl)) }
    }
  }

  const dragRange = drag ? { start: Math.min(drag.start, drag.end), end: Math.max(drag.start, drag.end) } : null
  const filledHours = blocks.reduce((sum, b) => sum + b.spanHours, 0)
  const wastedWords = ['instagram','netflix','scroll','youtube','reels','twitter','tiktok','phone','nothing','waste']

  return (
    <div>
      {/* Header with date nav */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <button onClick={() => navigateTo(addDays(viewDate, -1))} className="icon-btn" style={{ fontSize: 16 }}>‹</button>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e8e8f8', letterSpacing: '-0.4px', lineHeight: 1 }}>
              {formatDateLabel(viewDate)}
              {!isToday && <span style={{ fontSize: 13, color: '#404058', fontWeight: 400, marginLeft: 10 }}>{viewDate}</span>}
            </h1>
            {isToday && (
              <p style={{ color: '#404058', fontSize: 11, marginTop: 3 }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            )}
          </div>
          <button onClick={() => navigateTo(addDays(viewDate, 1))} className="icon-btn" style={{ fontSize: 16 }}>›</button>
          {!isToday && (
            <button onClick={() => navigateTo(todayNow)} style={{
              background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 6,
              color: '#888', fontSize: 11, padding: '3px 10px', cursor: 'pointer', marginLeft: 4,
            }}>
              → today
            </button>
          )}
          {loadingDate && <span style={{ color: '#404058', fontSize: 11 }}>loading...</span>}
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ color: done === tasks.length && tasks.length > 0 ? '#34d399' : '#404058', fontSize: 12 }}>
            {done}/{tasks.length} tasks done
          </span>
          <span style={{ color: '#2a2a3a' }}>·</span>
          <span style={{ color: filledHours > 0 ? '#60a5fa' : '#2a2a3a', fontSize: 12 }}>
            {filledHours}/24 hours logged
          </span>
        </div>

        {tasks.length > 0 && (
          <div style={{ marginTop: 8, height: 2, background: '#1a1a28', borderRadius: 1, maxWidth: 180 }}>
            <div style={{
              height: '100%', width: `${(done / tasks.length) * 100}%`,
              background: done === tasks.length ? '#34d399' : 'linear-gradient(90deg,#f472b6,#a78bfa)',
              borderRadius: 1, transition: 'width 0.4s',
            }} />
          </div>
        )}
      </div>

      {/* Tasks */}
      <section style={{ marginBottom: 36 }}>
        <p className="section-label">Tasks {viewDate === taskDate ? `· max 6 · ${tasks.length}/6` : `· adding for ${formatDateLabel(taskDate)}`}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {tasks.map(task => {
            const g = task.goal_id ? goalMap[task.goal_id] : null
            const color = g ? goalColor(g) : '#404058'
            const isTriaging = triaging === task.id

            return (
              <div key={task.id}>
                <div className="card" style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderLeft: `3px solid ${task.completed ? '#1e1e2e' : color}`,
                  opacity: task.completed ? 0.45 : 1,
                }}>
                  <button onClick={() => toggleTask(task)} style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${task.completed ? '#2a2a3a' : color}`,
                    background: task.completed ? '#2a2a3a' : `${color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', cursor: 'pointer',
                    opacity: savingTask === task.id ? 0.5 : 1,
                  }}>
                    {savingTask === task.id
                      ? <span style={{ color: '#555', fontSize: 9 }}>…</span>
                      : task.completed
                        ? <span style={{ color: color, fontSize: 11 }}>✓</span>
                        : null}
                  </button>

                  {editingTask === task.id ? (
                    <input autoFocus defaultValue={task.title}
                      onBlur={e => updateTaskTitle(task.id, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') updateTaskTitle(task.id, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingTask(null) }}
                      style={{ flex: 1, background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 5, color: '#e0e0f0', padding: '3px 8px', outline: 'none', fontSize: 13 }}
                    />
                  ) : (
                    <span onClick={() => !task.completed && setEditingTask(task.id)} style={{
                      flex: 1, fontSize: 13, color: task.completed ? '#333' : '#d4d4e8',
                      textDecoration: task.completed ? 'line-through' : 'none', cursor: 'text',
                    }}>
                      {task.title}
                      {task.roll_count > 0 && <span style={{ color: '#fb923c', fontSize: 10, marginLeft: 8 }}>↩{task.roll_count}×</span>}
                      {task.recurrence && <span style={{ color: '#a78bfa', fontSize: 10, marginLeft: 8 }}>↻</span>}
                    </span>
                  )}

                  {g && <span className="tag" style={{ color, background: `${color}12`, border: `1px solid ${color}20`, whiteSpace: 'nowrap' }}>{g.title.split(' ')[0]}</span>}
                  <button className="icon-btn" onClick={() => setTriaging(isTriaging ? null : task.id)}>···</button>
                  <button className="icon-btn danger" onClick={() => deleteTask(task.id)}>✕</button>
                </div>

                {isTriaging && (
                  <div style={{ background: '#0f0f1a', border: '1px solid #1e1e2e', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '8px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ color: '#333', fontSize: 10, marginRight: 2 }}>move →</span>
                    {([['tomorrow', 1, '#34d399'], ['+3d', 3, '#60a5fa'], ['next week', 7, '#a78bfa']] as const).map(([l, d, c]) => (
                      <button key={l} onClick={() => rollTask(task.id, d)} style={{ background: `${c}12`, border: `1px solid ${c}30`, color: c, padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer' }}>{l}</button>
                    ))}
                    <button onClick={() => deleteTask(task.id)} style={{ background: '#f8717112', border: '1px solid #f8717130', color: '#f87171', padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer' }}>drop</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add task form */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder={tasks.length >= 6 && taskDate === viewDate ? 'max 6 — finish one first' : 'add a task...'}
              disabled={tasks.length >= 6 && taskDate === viewDate}
              style={{
                flex: 1, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8,
                color: '#d4d4e8', padding: '10px 14px', outline: 'none', fontSize: 13,
                opacity: tasks.length >= 6 && taskDate === viewDate ? 0.4 : 1,
                minHeight: 42,
              }}
            />
            <button onClick={() => setShowAdvanced(!showAdvanced)} style={{
              background: showAdvanced ? '#1e1e2e' : 'transparent',
              border: '1px solid #1e1e2e', borderRadius: 8,
              color: '#404058', padding: '10px 14px', fontSize: 14, minHeight: 42,
            }}>⚙</button>
            <button onClick={addTask} disabled={!newTask.trim() || addingTask} style={{
              background: newTask.trim() ? '#f472b6' : '#1e1e2e', border: 'none', borderRadius: 8,
              color: newTask.trim() ? '#0a0a0f' : '#333', padding: '9px 18px', fontSize: 13, fontWeight: 600,
              transition: 'all 0.15s', minHeight: 42,
            }}>{addingTask ? '…' : 'Add'}</button>
          </div>

          {showAdvanced && (
            <div className="card" style={{ marginTop: 6, padding: '12px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ color: '#404058', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Goal</label>
                <select value={selectedGoal} onChange={e => setSelectedGoal(e.target.value)}
                  style={{ background: '#0f0f1a', border: '1px solid #1e1e2e', borderRadius: 6, color: '#d4d4e8', padding: '6px 10px', outline: 'none', fontSize: 12 }}>
                  <option value="">No goal</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ color: '#404058', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Date</label>
                <input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)}
                  style={{ background: '#0f0f1a', border: '1px solid #1e1e2e', borderRadius: 6, color: '#d4d4e8', padding: '6px 10px', outline: 'none', fontSize: 12 }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ color: '#404058', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Repeat</label>
                <select value={recurrence} onChange={e => setRecurrence(e.target.value)}
                  style={{ background: '#0f0f1a', border: '1px solid #1e1e2e', borderRadius: 6, color: '#d4d4e8', padding: '6px 10px', outline: 'none', fontSize: 12 }}>
                  {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {taskDate !== viewDate && (
                <div style={{ alignSelf: 'flex-end', padding: '6px 10px', background: '#a78bfa15', border: '1px solid #a78bfa30', borderRadius: 6 }}>
                  <span style={{ color: '#a78bfa', fontSize: 11 }}>📅 adding to {formatDateLabel(taskDate)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 24-Hour Log */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p className="section-label" style={{ margin: 0 }}>24-Hour Log</p>
          <span style={{ color: '#2a2a3a', fontSize: 10 }}>
            {isMobile.current ? 'tap an hour to log it' : 'drag across hours to create a block · click to edit'}
          </span>
        </div>

        {/* Pending block input */}
        {pendingBlock && (
          <div style={{
            background: '#13131f', border: '1px solid #f472b630', borderRadius: 8,
            padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <span style={{ color: '#f472b6', fontSize: 12, whiteSpace: 'nowrap' }}>
              {HOURS_24[pendingBlock.start]}–{HOURS_24[Math.min(pendingBlock.end + 1, 23)]}
            </span>
            <input
              autoFocus
              value={pendingContent}
              onChange={e => setPendingContent(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') savePendingBlock(); if (e.key === 'Escape') setPendingBlock(null) }}
              placeholder="what were you doing?"
              style={{
                flex: 1, background: 'transparent', border: 'none',
                borderBottom: '1px solid #2a2a3a', color: '#e0e0f0',
                padding: '2px 4px', outline: 'none', fontSize: 13, caretColor: '#f472b6',
              }}
            />
            <button onClick={savePendingBlock} style={{ background: '#f472b6', border: 'none', borderRadius: 5, color: '#0a0a0f', padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setPendingBlock(null)} className="icon-btn">✕</button>
          </div>
        )}

        <div className="card" style={{ overflow: 'hidden', padding: 0, userSelect: 'none' }}>
          {HOURS_24.map((h, idx) => {
            const covered = isCoveredByBlock(idx, blocks)
            if (covered) return null // skip hours inside a block

            const block = getBlockStarting(idx, blocks)
            const inDrag = dragRange && idx >= dragRange.start && idx <= dragRange.end
            const inPending = pendingBlock && idx >= pendingBlock.start && idx <= pendingBlock.end
            const isWasted = block && wastedWords.some(w => block.content.toLowerCase().includes(w))
            const blockColor = block ? (isWasted ? '#fb923c' : '#34d399') : '#1e1e2e'
            const height = block ? block.spanHours * ROW_H : ROW_H

            return (
              <div
                key={h}
                onMouseDown={e => !block && onHourMouseDown(idx, e)}
                onMouseEnter={() => onHourMouseEnter(idx)}
                onTouchEnd={e => { if (!block) { e.preventDefault(); onHourTap(idx) } }}
                style={{
                  display: 'flex',
                  height: Math.max(height, isMobile.current ? 44 : ROW_H),
                  borderBottom: idx < 23 ? '1px solid #14141e' : 'none',
                  background: inDrag || inPending ? 'rgba(244,114,182,0.08)' : 'transparent',
                  transition: 'background 0.05s',
                  cursor: block ? 'default' : 'crosshair',
                  position: 'relative',
                }}
              >
                {/* Colored left strip */}
                <div style={{
                  width: 4, alignSelf: 'stretch', flexShrink: 0,
                  background: block ? blockColor : inDrag ? '#f472b6' : '#14141e',
                  opacity: block ? 0.8 : 0.4,
                  transition: 'background 0.1s',
                }} />

                {/* Hour label */}
                <span style={{
                  width: 44, padding: '0 8px',
                  fontSize: 10, color: '#2a2a3a',
                  display: 'flex', alignItems: 'flex-start', paddingTop: 10,
                  flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                }}>
                  {h}
                </span>

                {/* Block content or empty input */}
                {block ? (
                  <BlockRow
                    block={block}
                    isWasted={!!isWasted}
                    onSave={content => updateBlock(block, content)}
                    onDelete={() => deleteBlock(block)}
                  />
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 10px 0 0' }}>
                    {(inDrag || inPending) && (
                      <span style={{ color: '#f472b640', fontSize: 11 }}>drag to extend · release to name</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 8, paddingLeft: 4 }}>
          {[['#34d399', 'productive'], ['#fb923c', 'wasted time'], ['#1e1e2e', 'unlogged']].map(([c, l]) => (
            <span key={l} style={{ fontSize: 10, color: '#2a2a3a' }}>
              <span style={{ color: c }}>■</span> {l}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}

function BlockRow({ block, isWasted, onSave, onDelete }: { block: Block; isWasted: boolean; onSave: (v: string) => void; onDelete: () => void }) {
  const [val, setVal] = useState(block.content)
  const [editing, setEditing] = useState(false)
  const color = isWasted ? '#fb923c' : '#34d399'

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', paddingTop: 9, gap: 8, paddingRight: 10 }}>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => { setEditing(false); onSave(val) }}
        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color, fontSize: 12, fontWeight: 500, caretColor: color,
          borderBottom: editing ? `1px solid ${color}40` : '1px solid transparent',
        }}
      />
      {block.spanHours > 1 && (
        <span style={{ color: '#2a2a3a', fontSize: 10, whiteSpace: 'nowrap', paddingTop: 1 }}>{block.spanHours}h</span>
      )}
      <button className="icon-btn danger" onClick={onDelete} style={{ paddingTop: 1 }}>✕</button>
    </div>
  )
}
