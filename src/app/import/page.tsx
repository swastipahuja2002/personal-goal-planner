'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface GeneratedTask {
  title: string
  task_date: string
  goal_hint: string
  reason: string
  status: 'pending' | 'approved' | 'skipped'
  editedTitle?: string
  editedDate?: string
}

interface GoalOption {
  id: string
  title: string
  color: string
  category: string
}

const GOAL_HINT_COLORS: Record<string, string> = {
  career: '#f472b6',
  health: '#34d399',
  learning: '#60a5fa',
  education: '#a78bfa',
  project: '#4ade80',
  personal: '#f9a8d4',
}

function formatDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function ImportPage() {
  const [planText, setPlanText] = useState('')
  const [goals, setGoals] = useState<GoalOption[]>([])
  const [tasks, setTasks] = useState<GeneratedTask[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('goals').select('id,title,color,category').order('priority').then(({ data }) => {
      if (data) setGoals(data as GoalOption[])
    })
  }, [])

  async function generate() {
    if (!planText.trim()) return
    setLoading(true)
    setError('')
    setTasks([])
    setDone(false)

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planText, goals }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to generate tasks')
        return
      }
      setTasks(data.tasks.map((t: Omit<GeneratedTask, 'status'>) => ({ ...t, status: 'pending' })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  function approve(i: number) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'approved' } : t))
  }

  function skip(i: number) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'skipped' } : t))
  }

  function approveAll() {
    setTasks(prev => prev.map(t => t.status === 'pending' ? { ...t, status: 'approved' } : t))
  }

  async function addApproved() {
    const approved = tasks.filter(t => t.status === 'approved')
    if (!approved.length) return
    setAdding(true)

    // Map goal_hint → goal_id
    const hintToId: Record<string, string | null> = {}
    goals.forEach(g => {
      const hint = g.category?.toLowerCase() ?? ''
      if (!hintToId[hint]) hintToId[hint] = g.id
    })
    // Also map by title keywords
    goals.forEach(g => {
      const words = g.title.toLowerCase().split(/\s+/)
      words.forEach(w => { if (w.length > 3 && !hintToId[w]) hintToId[w] = g.id })
    })

    const rows = approved.map(t => ({
      title: t.editedTitle ?? t.title,
      task_date: t.editedDate ?? t.task_date,
      goal_id: hintToId[t.goal_hint] ?? null,
      completed: false,
    }))

    await supabase.from('daily_tasks').insert(rows)
    setTasks(prev => prev.map(t => t.status === 'approved' ? { ...t, status: 'skipped' } : t))
    setAdding(false)
    setDone(true)
  }

  const pending = tasks.filter(t => t.status === 'pending').length
  const approved = tasks.filter(t => t.status === 'approved').length

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f472b6', margin: 0, letterSpacing: '-0.5px' }}>
          ✦ Import Plan
        </h1>
        <p style={{ color: '#505068', fontSize: 13, marginTop: 6 }}>
          Paste your plan (.md or text) — AI will generate a realistic task schedule for you to review.
        </p>
      </div>

      {/* Textarea */}
      <div style={{ marginBottom: 16 }}>
        <textarea
          value={planText}
          onChange={e => setPlanText(e.target.value)}
          placeholder={`Paste your plan here. Examples:\n\n## Certification Prep\nTarget: Pass the exam by July\n- Complete 1 practice test per week\n- Daily study: 30 min\n- Review weak topics 3x/week\n\n## Job Hunt Sprint\nDeadline: Offer by end of June\n- Apply to 5 companies this week\n- Prep interview questions\n- Build project portfolio`}
          style={{
            width: '100%', minHeight: 220, background: '#0f0f1a', border: '1px solid #1e1e30',
            borderRadius: 12, padding: '14px 16px', color: '#e0e0f0', fontSize: 13,
            fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6,
            boxSizing: 'border-box',
          }}
          onFocus={e => (e.target.style.borderColor = '#f472b6')}
          onBlur={e => (e.target.style.borderColor = '#1e1e30')}
        />
      </div>

      <button
        onClick={generate}
        disabled={loading || !planText.trim()}
        style={{
          padding: '10px 24px', background: loading ? '#1a1a2e' : 'linear-gradient(135deg,#f472b6,#a855f7)',
          border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, fontSize: 14,
          cursor: loading || !planText.trim() ? 'not-allowed' : 'pointer',
          opacity: !planText.trim() ? 0.4 : 1, transition: 'all 0.2s',
        }}
      >
        {loading ? '⟳ Thinking...' : '✦ Generate Schedule'}
      </button>

      {error && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#1a0a0a', border: '1px solid #5a1a1a', borderRadius: 10, color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {done && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#0a1a0a', border: '1px solid #1a4a1a', borderRadius: 10, color: '#34d399', fontSize: 13 }}>
          ✓ Tasks added to your calendar!
        </div>
      )}

      {/* Generated tasks */}
      {tasks.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <span style={{ color: '#e0e0f0', fontWeight: 600, fontSize: 15 }}>
                Generated Tasks
              </span>
              <span style={{ color: '#404058', fontSize: 13, marginLeft: 10 }}>
                {pending} pending · {approved} approved
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {pending > 0 && (
                <button onClick={approveAll} style={{
                  padding: '6px 14px', background: 'transparent', border: '1px solid #1e3a1e',
                  borderRadius: 8, color: '#34d399', fontSize: 12, cursor: 'pointer',
                }}>
                  Approve all remaining
                </button>
              )}
              {approved > 0 && (
                <button onClick={addApproved} disabled={adding} style={{
                  padding: '6px 14px', background: 'linear-gradient(135deg,#f472b6,#a855f7)',
                  border: 'none', borderRadius: 8, color: '#fff', fontSize: 12,
                  fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer',
                }}>
                  {adding ? 'Adding...' : `Add ${approved} to Calendar`}
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.map((task, i) => {
              const hintColor = GOAL_HINT_COLORS[task.goal_hint] ?? '#a0a0b8'
              const isEditing = editingIdx === i
              const isApproved = task.status === 'approved'
              const isSkipped = task.status === 'skipped'

              return (
                <div key={i} style={{
                  background: isSkipped ? '#0d0d14' : '#111120',
                  border: `1px solid ${isApproved ? '#1e3a1e' : isSkipped ? '#111' : '#1a1a2a'}`,
                  borderRadius: 12, padding: '14px 16px',
                  opacity: isSkipped ? 0.4 : 1,
                  transition: 'all 0.2s',
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {/* Status indicator */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                      background: isApproved ? '#34d399' : isSkipped ? '#303040' : hintColor,
                      boxShadow: isApproved ? '0 0 8px rgba(52,211,153,0.5)' : 'none',
                    }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title */}
                      {isEditing ? (
                        <input
                          autoFocus
                          defaultValue={task.editedTitle ?? task.title}
                          onBlur={e => {
                            setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, editedTitle: e.target.value } : t))
                            setEditingIdx(null)
                          }}
                          style={{
                            background: '#0a0a15', border: '1px solid #f472b6', borderRadius: 6,
                            padding: '4px 8px', color: '#e0e0f0', fontSize: 14, width: '100%',
                            outline: 'none', marginBottom: 6,
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => !isSkipped && setEditingIdx(i)}
                          style={{
                            color: isSkipped ? '#303040' : '#d0d0e8', fontSize: 14, fontWeight: 500,
                            cursor: isSkipped ? 'default' : 'text', marginBottom: 4,
                            textDecoration: isSkipped ? 'line-through' : 'none',
                          }}
                        >
                          {task.editedTitle ?? task.title}
                        </div>
                      )}

                      {/* Meta row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {/* Date */}
                        <input
                          type="date"
                          value={task.editedDate ?? task.task_date}
                          onChange={e => setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, editedDate: e.target.value } : t))}
                          disabled={isSkipped}
                          style={{
                            background: 'transparent', border: '1px solid #1e1e30', borderRadius: 6,
                            padding: '2px 8px', color: '#8080a0', fontSize: 12, cursor: 'pointer',
                            outline: 'none',
                          }}
                        />

                        {/* Goal hint badge */}
                        <span style={{
                          padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                          background: `${hintColor}15`, color: hintColor, border: `1px solid ${hintColor}30`,
                        }}>
                          {task.goal_hint}
                        </span>

                        {/* Reason */}
                        <span style={{ color: '#404058', fontSize: 12, fontStyle: 'italic' }}>
                          {task.reason}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {!isSkipped && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {isApproved ? (
                          <button onClick={() => skip(i)} style={{
                            padding: '4px 10px', background: 'transparent', border: '1px solid #1e1e30',
                            borderRadius: 6, color: '#404058', fontSize: 12, cursor: 'pointer',
                          }}>
                            undo
                          </button>
                        ) : (
                          <>
                            <button onClick={() => approve(i)} style={{
                              padding: '4px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a',
                              borderRadius: 6, color: '#34d399', fontSize: 12, cursor: 'pointer',
                              fontWeight: 600,
                            }}>
                              ✓
                            </button>
                            <button onClick={() => skip(i)} style={{
                              padding: '4px 10px', background: 'transparent', border: '1px solid #1e1e30',
                              borderRadius: 6, color: '#404058', fontSize: 12, cursor: 'pointer',
                            }}>
                              skip
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom CTA */}
          {approved > 0 && (
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={addApproved} disabled={adding} style={{
                padding: '12px 28px', background: 'linear-gradient(135deg,#f472b6,#a855f7)',
                border: 'none', borderRadius: 12, color: '#fff', fontSize: 14,
                fontWeight: 700, cursor: adding ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 20px rgba(244,114,182,0.3)',
              }}>
                {adding ? 'Adding to Calendar...' : `✦ Add ${approved} Task${approved > 1 ? 's' : ''} to Calendar`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
