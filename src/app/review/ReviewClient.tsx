'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { goalColor } from '@/lib/goals'
import type { DailyTask, DayLog, HabitLog, Habit, Goal } from '@/types'

type GoalMin = Pick<Goal, 'id' | 'title' | 'color' | 'category'>

interface Props {
  tasks: DailyTask[]
  logs: DayLog[]
  habitLogs: HabitLog[]
  habits: Habit[]
  goals: GoalMin[]
  weekDates: string[]
  undoneToday: DailyTask[]
  today: string
  weekStart: string
}

const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const QUICK_PROMPTS = [
  'Be brutal. How am I actually doing?',
  'Where did I waste time this week?',
  'Why am I not making progress on my top goal?',
  'Am I on track to hit my deadlines?',
  'What should I drop from my plate right now?',
]

export default function ReviewClient({ tasks, logs, habitLogs, habits, goals, weekDates, undoneToday, today, weekStart }: Props) {
  const [undone, setUndone] = useState<DailyTask[]>(undoneToday)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [analysis, setAnalysis] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  const goalMap = Object.fromEntries(goals.map(g => [g.id, g]))

  const done = tasks.filter(t => t.completed).length
  const total = tasks.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  async function rollUndone(taskId: string, daysAhead: number) {
    const task = undone.find(t => t.id === taskId)
    if (!task) return
    const newDate = new Date(today)
    newDate.setDate(newDate.getDate() + daysAhead)
    const newDateStr = newDate.toISOString().split('T')[0]
    await supabase.from('daily_tasks').update({
      task_date: newDateStr, roll_count: (task.roll_count || 0) + 1, rolled_from: today,
    }).eq('id', taskId)
    setUndone(ts => ts.filter(t => t.id !== taskId))
  }

  async function dropUndone(taskId: string) {
    await supabase.from('daily_tasks').delete().eq('id', taskId)
    setUndone(ts => ts.filter(t => t.id !== taskId))
  }

  async function getAnalysis() {
    setAnalyzing(true)
    setAnalysis('')
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: `Weekly review for week of ${weekStart}. Look at my task completions, hour logs, and habit data. Give me a harsh, honest assessment. What did I actually do? What did I avoid? What's the pattern? Be specific with numbers. Max 150 words.`,
        }],
      }),
    })
    if (!res.body) { setAnalyzing(false); return }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value)
      setAnalysis(text)
    }
    setAnalyzing(false)
  }

  async function sendChat(text?: string) {
    const content = (text || chatInput).trim()
    if (!content || streaming) return
    setChatInput('')
    const newMessages = [...chatMessages, { role: 'user' as const, content }]
    setChatMessages(newMessages)
    setStreaming(true)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages }),
    })
    if (!res.body) { setStreaming(false); return }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let assistantContent = ''
    setChatMessages(prev => [...prev, { role: 'assistant', content: '' }])
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      assistantContent += decoder.decode(value)
      setChatMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
        return updated
      })
    }
    await supabase.from('chat_messages').insert([
      { role: 'user', content },
      { role: 'assistant', content: assistantContent },
    ])
    setStreaming(false)
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: '#444', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Weekly</p>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#e0e0e0', letterSpacing: '-0.3px' }}>Review</h1>
      </div>

      {/* This week stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 24 }}>
        {[
          { label: 'Tasks done', value: `${done}/${total}`, color: pct >= 70 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#f87171' },
          { label: 'Day logs', value: `${new Set(logs.map(l => l.log_date)).size}/7`, color: '#60a5fa' },
          { label: 'Habits logged', value: `${habitLogs.filter(l => l.completed).length}`, color: '#f472b6' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '12px 14px' }}>
            <p style={{ color: s.color, fontSize: 20, fontWeight: 700, margin: 0 }}>{s.value}</p>
            <p style={{ color: '#333', fontSize: 10, margin: '3px 0 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Habit grid — Loop style compact */}
      <section style={{ marginBottom: 28 }}>
        <p style={{ color: '#333', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, fontWeight: 600 }}>
          This Week
        </p>
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden' }}>
          {/* Day header */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(7,1fr)', padding: '8px 14px', borderBottom: '1px solid #1a1a1a' }}>
            <div />
            {DAY_LABELS.map((d, i) => (
              <div key={d} style={{
                textAlign: 'center', fontSize: 10, color: weekDates[i] === today ? '#f472b6' : '#333',
                fontWeight: weekDates[i] === today ? 600 : 400,
              }}>{d}</div>
            ))}
          </div>
          {habits.map(h => {
            const g = goalMap[h.goal_id]
            const color = g ? goalColor(g) : '#f472b6'
            return (
              <div key={h.id} style={{
                display: 'grid', gridTemplateColumns: '140px repeat(7,1fr)',
                padding: '8px 14px', borderBottom: '1px solid #161616',
              }}>
                <span style={{ fontSize: 11, color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.title}
                </span>
                {weekDates.map(d => {
                  const done = habitLogs.some(l => l.habit_id === h.id && l.completed_date === d && l.completed)
                  const future = d > today
                  return (
                    <div key={d} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: 2,
                        background: done ? color : future ? 'transparent' : '#1a1a1a',
                        border: d === today && !done ? `1px solid ${color}40` : 'none',
                        opacity: future ? 0.2 : 1,
                      }} />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </section>

      {/* Undone tasks triage */}
      {undone.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <p style={{ color: '#fb923c', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, fontWeight: 600 }}>
            Undone Today — decide now
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {undone.map(task => {
              const g = task.goal_id ? goalMap[task.goal_id] : null
              const color = g ? goalColor(g) : '#555'
              return (
                <div key={task.id} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 3, height: 16, background: color, borderRadius: 1 }} />
                    <span style={{ flex: 1, fontSize: 13, color: '#bbb' }}>{task.title}</span>
                    {task.roll_count > 0 && <span style={{ color: '#fb923c', fontSize: 10 }}>rolled {task.roll_count}×</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => rollUndone(task.id, 1)} style={pill('#34d399')}>tomorrow</button>
                    <button onClick={() => rollUndone(task.id, 3)} style={pill('#60a5fa')}>+3 days</button>
                    <button onClick={() => rollUndone(task.id, 7)} style={pill('#a78bfa')}>next week</button>
                    <button onClick={() => dropUndone(task.id)} style={pill('#f87171')}>drop</button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Claude Analysis */}
      <section style={{ marginBottom: 28 }}>
        <p style={{ color: '#333', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, fontWeight: 600 }}>
          Claude's Read
        </p>
        {!analysis && !analyzing && (
          <button
            onClick={getAnalysis}
            style={{
              background: '#111', border: '1px solid #1e1e1e',
              borderRadius: 8, color: '#555', padding: '12px 16px',
              fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'left',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = '#f472b630'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e1e1e'}
          >
            Get weekly analysis → honest, based on your actual data
          </button>
        )}
        {(analysis || analyzing) && (
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '14px 16px' }}>
            <p style={{ color: '#bbb', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
              {analysis || <span style={{ color: '#333' }}>reading your week...</span>}
              {analyzing && <span style={{ color: '#f472b6' }}>▊</span>}
            </p>
          </div>
        )}
      </section>

      {/* Coach Chat */}
      <section>
        <p style={{ color: '#333', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, fontWeight: 600 }}>
          Talk to Coach
        </p>

        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden' }}>
          {chatMessages.length === 0 && (
            <div style={{ padding: '16px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => sendChat(p)} style={{
                  background: '#1a1a1a', border: '1px solid #222',
                  color: '#555', fontSize: 11, padding: '5px 12px',
                  borderRadius: 20, cursor: 'pointer',
                }}>
                  {p}
                </button>
              ))}
            </div>
          )}

          {chatMessages.length > 0 && (
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.role === 'user' ? '#1a1a1a' : '#161616',
                  border: '1px solid #222',
                  borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                  padding: '9px 12px',
                  fontSize: 13, color: m.role === 'user' ? '#bbb' : '#e0e0e0',
                  lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                  {streaming && i === chatMessages.length - 1 && m.role === 'assistant' && (
                    <span style={{ color: '#f472b6' }}>▊</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: '1px solid #1a1a1a', display: 'flex', gap: 8, padding: '10px 12px' }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder="ask your coach..."
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: '#e0e0e0', outline: 'none', fontSize: 13,
              }}
            />
            <button
              onClick={() => sendChat()}
              disabled={!chatInput.trim() || streaming}
              style={{
                background: chatInput.trim() && !streaming ? '#f472b6' : '#1a1a1a',
                border: 'none', borderRadius: 6, color: chatInput.trim() ? '#0d0d0d' : '#333',
                width: 32, height: 32, fontSize: 14, cursor: 'pointer',
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >↑</button>
          </div>
        </div>
      </section>
    </div>
  )
}

function pill(color: string) {
  return {
    background: color + '12',
    border: `1px solid ${color}35`,
    color,
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11,
    cursor: 'pointer' as const,
  }
}
