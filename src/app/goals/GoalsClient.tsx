'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { goalColor, GOAL_COLORS } from '@/lib/goals'
import type { Goal } from '@/types'

const CATEGORY_ICONS: Record<string, string> = {
  career: '💼', health: '🏃', education: '📚', impact: '🌍', personal: '✨',
}

function daysLeft(d: string | null) {
  if (!d) return null
  const diff = Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: 'overdue', urgent: true }
  if (diff === 0) return { label: 'today', urgent: true }
  if (diff < 30) return { label: `${diff}d left`, urgent: true }
  return { label: `${Math.round(diff / 30)}mo`, urgent: false }
}

const BLANK_FORM = { title: '', category: 'career', target_date: '', current_phase: '', description: '' }

export default function GoalsClient({ goals: initGoals }: { goals: Goal[] }) {
  const [goals, setGoals] = useState(initGoals)
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)

  async function addGoal() {
    if (!form.title.trim()) return
    setSaving(true)
    const color = GOAL_COLORS[form.category] || '#6b6b8a'
    const icon = CATEGORY_ICONS[form.category] || '🎯'
    const { data, error } = await supabase.from('goals').insert({
      title: form.title.trim(),
      category: form.category,
      color,
      icon,
      target_date: form.target_date || null,
      current_phase: form.current_phase.trim() || null,
      description: form.description.trim() || '',
      status: 'active',
      progress: 0,
      priority: goals.length,
    }).select().single()
    setSaving(false)
    if (!error && data) {
      setGoals(gs => [...gs, data as Goal])
      setForm(BLANK_FORM)
      setShowAdd(false)
    }
  }

  const active = goals.filter(g => g.status === 'active')
  const paused = goals.filter(g => g.status !== 'active')

  async function updateField(goalId: string, field: string, value: string | number) {
    await supabase.from('goals').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', goalId)
    setGoals(gs => gs.map(g => g.id === goalId ? { ...g, [field]: value } : g))
    setEditing(null)
  }

  function isEditing(id: string, field: string) {
    return editing?.id === id && editing?.field === field
  }

  return (
    <div>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p className="section-label">The big picture</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e8e8f8', letterSpacing: '-0.5px' }}>All Goals</h1>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setForm(BLANK_FORM) }}
          style={{
            background: showAdd ? '#1e1e2e' : '#f472b614',
            border: `1px solid ${showAdd ? '#2a2a3e' : '#f472b630'}`,
            borderRadius: 8, color: showAdd ? '#555' : '#f472b6',
            padding: '7px 16px', fontSize: 12, fontWeight: 600,
          }}
        >
          {showAdd ? '✕ cancel' : '+ add goal'}
        </button>
      </div>

      {/* Add Goal Form */}
      {showAdd && (
        <div className="card" style={{ padding: '18px 20px', marginBottom: 20, borderColor: '#f472b620' }}>
          <p className="section-label" style={{ marginBottom: 14 }}>New Goal</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Title */}
            <div>
              <label style={{ fontSize: 10, color: '#404058', display: 'block', marginBottom: 4 }}>TITLE *</label>
              <input
                autoFocus
                placeholder="e.g. Switch to a DS/GenAI role"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addGoal()}
                style={{
                  width: '100%', background: '#0f0f1a', border: '1px solid #1e1e2e',
                  borderRadius: 7, color: '#e0e0f0', padding: '8px 12px',
                  outline: 'none', fontSize: 13,
                }}
              />
            </div>

            {/* Subheading / current phase */}
            <div>
              <label style={{ fontSize: 10, color: '#404058', display: 'block', marginBottom: 4 }}>SUBHEADING (current phase)</label>
              <input
                placeholder="e.g. Building portfolio + applying to roles"
                value={form.current_phase}
                onChange={e => setForm(f => ({ ...f, current_phase: e.target.value }))}
                style={{
                  width: '100%', background: '#0f0f1a', border: '1px solid #1e1e2e',
                  borderRadius: 7, color: '#d4d4e8', padding: '8px 12px',
                  outline: 'none', fontSize: 13,
                }}
              />
            </div>

            {/* Category + Target date row */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: '#404058', display: 'block', marginBottom: 4 }}>CATEGORY</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{
                    width: '100%', background: '#0f0f1a', border: '1px solid #1e1e2e',
                    borderRadius: 7, color: GOAL_COLORS[form.category] || '#888',
                    padding: '8px 12px', outline: 'none', fontSize: 12,
                  }}
                >
                  {Object.keys(GOAL_COLORS).map(c => (
                    <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: '#404058', display: 'block', marginBottom: 4 }}>TARGET DATE</label>
                <input
                  type="date"
                  value={form.target_date}
                  onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
                  style={{
                    width: '100%', background: '#0f0f1a', border: '1px solid #1e1e2e',
                    borderRadius: 7, color: '#888', padding: '8px 12px',
                    outline: 'none', fontSize: 12,
                  }}
                />
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={addGoal}
              disabled={saving || !form.title.trim()}
              style={{
                alignSelf: 'flex-end', background: form.title.trim() ? '#f472b6' : '#1e1e2e',
                color: form.title.trim() ? '#0a0a0f' : '#333',
                border: 'none', borderRadius: 7, padding: '12px 24px',
                fontSize: 13, fontWeight: 700, transition: 'background 0.15s',
                minHeight: 44, minWidth: 110,
              }}
            >
              {saving ? 'saving…' : 'save goal'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {active.length === 0 && !showAdd && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          border: '1px dashed #1e1e2e', borderRadius: 12,
        }}>
          <p style={{ fontSize: 28, marginBottom: 12 }}>🎯</p>
          <p style={{ color: '#555', fontSize: 13, marginBottom: 4 }}>No goals yet.</p>
          <p style={{ color: '#333', fontSize: 11 }}>Hit "+ add goal" to get started.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {active.map(goal => {
          const color = goalColor(goal)
          const dl = daysLeft(goal.target_date)
          const isExpanded = expanded === goal.id

          return (
            <div key={goal.id} className="card" style={{ borderLeft: `3px solid ${color}60` }}>
              {/* Main row */}
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                  background: color, boxShadow: `0 0 10px ${color}50`,
                }} />

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#e0e0f0' }}>{goal.title}</span>
                    {dl && (
                      <span style={{
                        fontSize: 10, color: dl.urgent ? '#fb923c' : '#404058',
                        background: dl.urgent ? '#fb923c12' : 'transparent',
                        padding: dl.urgent ? '1px 7px' : '0', borderRadius: 3,
                      }}>
                        {dl.label}
                      </span>
                    )}
                  </div>

                  {/* Editable phase */}
                  {isEditing(goal.id, 'current_phase') ? (
                    <input
                      autoFocus
                      defaultValue={goal.current_phase}
                      onBlur={e => updateField(goal.id, 'current_phase', e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') updateField(goal.id, 'current_phase', (e.target as HTMLInputElement).value)
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      style={{
                        background: `${color}0d`, border: `1px solid ${color}30`,
                        borderRadius: 5, color: '#bbb', padding: '2px 8px',
                        outline: 'none', fontSize: 11, width: 280,
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => setEditing({ id: goal.id, field: 'current_phase' })}
                      style={{ color: '#404058', fontSize: 11, cursor: 'text' }}
                      title="click to edit phase"
                    >
                      {goal.current_phase || '+ add phase'}
                    </span>
                  )}
                </div>

                {/* Progress */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color, fontSize: 18, fontWeight: 700, display: 'block', lineHeight: 1 }}>{goal.progress}%</span>
                  <button
                    className="icon-btn"
                    onClick={() => setExpanded(isExpanded ? null : goal.id)}
                    style={{ fontSize: 11, color: '#404058', marginTop: 2 }}
                  >
                    {isExpanded ? 'less ▴' : 'more ▾'}
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 2, background: '#1a1a28', marginLeft: 40 }}>
                <div style={{
                  height: '100%', width: `${goal.progress}%`, background: color,
                  transition: 'width 0.5s ease',
                }} />
              </div>

              {/* Expanded editing */}
              {isExpanded && (
                <div style={{ padding: '14px 16px 14px 40px', borderTop: '1px solid #1a1a28' }}>
                  {/* Description */}
                  <div style={{ marginBottom: 14 }}>
                    <p className="section-label" style={{ marginBottom: 6 }}>Description</p>
                    {isEditing(goal.id, 'description') ? (
                      <textarea
                        autoFocus
                        defaultValue={goal.description}
                        rows={2}
                        onBlur={e => updateField(goal.id, 'description', e.target.value)}
                        onKeyDown={e => e.key === 'Escape' && setEditing(null)}
                        style={{
                          width: '100%', background: '#0f0f1a',
                          border: `1px solid ${color}30`, borderRadius: 6,
                          color: '#bbb', padding: '8px 10px', outline: 'none',
                          fontSize: 12, resize: 'none', lineHeight: 1.6,
                        }}
                      />
                    ) : (
                      <p
                        onClick={() => setEditing({ id: goal.id, field: 'description' })}
                        style={{ color: '#555', fontSize: 12, lineHeight: 1.6, cursor: 'text' }}
                        title="click to edit"
                      >
                        {goal.description || '+ add description'}
                      </p>
                    )}
                  </div>

                  {/* Progress slider */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <p className="section-label" style={{ margin: 0 }}>Progress</p>
                      <span style={{ color, fontSize: 12, fontWeight: 600 }}>{goal.progress}%</span>
                    </div>
                    <input
                      type="range" min={0} max={100} value={goal.progress}
                      onChange={e => setGoals(gs => gs.map(g => g.id === goal.id ? { ...g, progress: Number(e.target.value) } : g))}
                      onMouseUp={e => updateField(goal.id, 'progress', Number((e.target as HTMLInputElement).value))}
                      style={{ width: '100%', accentColor: color }}
                    />
                  </div>

                  {/* Target date */}
                  <div style={{ marginTop: 14 }}>
                    <p className="section-label" style={{ marginBottom: 6 }}>Target Date</p>
                    <input
                      type="date"
                      defaultValue={goal.target_date || ''}
                      onBlur={e => updateField(goal.id, 'target_date', e.target.value)}
                      style={{
                        background: '#0f0f1a', border: '1px solid #1e1e2e',
                        borderRadius: 6, color: '#888', padding: '5px 10px',
                        outline: 'none', fontSize: 12,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {paused.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <p className="section-label">Waiting / Paused</p>
          {paused.map(goal => (
            <div key={goal.id} style={{
              background: '#0f0f18', border: '1px solid #1a1a28', borderRadius: 8,
              padding: '10px 16px', marginBottom: 4,
              display: 'flex', justifyContent: 'space-between', opacity: 0.4,
            }}>
              <span style={{ fontSize: 13, color: '#555' }}>{goal.title}</span>
              <span style={{ fontSize: 11, color: '#333' }}>{goal.current_phase}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
