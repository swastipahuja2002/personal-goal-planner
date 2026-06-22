// Public demo: the AI coach is stubbed so this app runs WITHOUT any API key.
// To enable a real coach: add OPENAI_API_KEY to .env.local and restore an
// OpenAI streaming call here (see the personal version for reference).

export async function POST(req: Request) {
  const { messages } = await req.json().catch(() => ({ messages: [] }))
  const lastUser = [...(messages || [])]
    .reverse()
    .find((m: { role: string }) => m.role === 'user')

  const reply =
    `This is the public demo, so the AI coach is turned off here — it runs with no API key. ` +
    `In the full version a brutally honest coach reads your goals, tasks and time logs and replies for real. ` +
    `To switch it on, add your OPENAI_API_KEY to .env.local and restore the OpenAI call in src/app/api/chat/route.ts.` +
    (lastUser?.content ? `\n\nYou said: "${String(lastUser.content).slice(0, 200)}"` : '')

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (const word of reply.split(' ')) {
        controller.enqueue(encoder.encode(word + ' '))
        await new Promise(r => setTimeout(r, 15))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
