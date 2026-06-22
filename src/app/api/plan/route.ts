// Public demo: plan import is stubbed so this app runs WITHOUT any API key.
// It returns a few sample tasks instead of calling an LLM.
// To enable real AI scheduling: add OPENAI_API_KEY to .env.local and restore
// the OpenAI call here (see the personal version for reference).

export async function POST(req: Request) {
  const { planText } = await req.json().catch(() => ({ planText: '' }))

  if (!planText?.trim()) {
    return Response.json({ error: 'No plan text provided' }, { status: 400 })
  }

  const day = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toISOString().split('T')[0]
  }

  const tasks = [
    { title: 'Break your plan into a first concrete step', task_date: day(0), goal_hint: 'career', reason: '(demo) AI import is disabled in the public version' },
    { title: 'Schedule a focused 1-hour block', task_date: day(1), goal_hint: 'learning', reason: '(demo) add OPENAI_API_KEY to enable real AI scheduling' },
    { title: 'Review progress at the end of the week', task_date: day(5), goal_hint: 'personal', reason: '(demo)' },
  ]

  return Response.json({ tasks })
}
