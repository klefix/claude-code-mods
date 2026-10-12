import { expect, mock, test } from 'claude-code/testing'

type Fake = { probabilities: Record<string, number>; messages?: any[]; status?: number; dialogAnswer?: string }

function fakeJev(on: any, { probabilities, messages = [], status = 200, dialogAnswer }: Fake) {
  const requests: any[] = []
  const logs: string[] = []
  const entered: any[] = []
  const ran: any[] = []
  const asked: any[] = []
  mock.clock(on)
  on('session.messages', async () => ({ value: messages }))
  on('process.run', async () => ({
    value: { exitCode: 0, stdout: 'test-key\n', stderr: '', isStdoutTruncated: false },
  }))
  on('fs.write', async () => ({ value: undefined }))
  on('ui.log', async (_$: any, e: any) => {
    logs.push(e.text)
    return { value: undefined }
  })
  on('http.fetch', async (_$: any, e: any) => {
    const body = JSON.parse(e.init.body)
    requests.push(body)
    const answers = Object.fromEntries(
      Object.keys(body.questions).map((name) => [name, { type: 'boolean', probability: probabilities[name] ?? 0 }]),
    )
    return { value: { status, ok: status < 300, headers: {}, text: JSON.stringify({ answers }) } }
  })
  on('prompt.submit', async (_$: any, e: any) => {
    entered.push(e)
    return { text: e.text, context: e.context }
  })
  on('tool.call', async (_$: any, e: any) => {
    if (e.tool === 'AskUserQuestion') {
      asked.push(e)
      const question = e.questions[0].question
      return { result: { questions: e.questions, answers: { [question]: dialogAnswer } } }
    }
    ran.push(e)
    return { result: {} }
  })
  return { requests, logs, entered, ran, asked }
}

const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } })

test('passes a clear request through unchanged', async ($: any, on: any) => {
  const jev = fakeJev(on, { probabilities: { vague: 0.1, question: 0.1 } })
  const result = await $.prompt.submit(typed('rename foo to bar in src/a.ts'))
  expect(jev.requests).toHaveLength(1)
  expect(result.text).toBe('rename foo to bar in src/a.ts')
  expect(jev.asked).toHaveLength(0)
})

test('does not open the dialog for a question, even when it is vague', async ($: any, on: any) => {
  const jev = fakeJev(on, { probabilities: { vague: 0.9, question: 0.9 } })
  const result = await $.prompt.submit(typed('what other questions could we ask jev?'))
  expect(result.text).toBe('what other questions could we ask jev?')
  expect(jev.asked).toHaveLength(0)
})

test('adds the clarification typed in the dialog to a vague request', async ($: any, on: any) => {
  const jev = fakeJev(on, { probabilities: { vague: 0.9, question: 0.1 }, dialogAnswer: 'only the login page' })
  const result = await $.prompt.submit(typed('fix the bug'))
  expect(jev.asked).toHaveLength(1)
  expect(result.text).toBe('fix the bug\n\nClarification: only the login page')
})

test('denies an out-of-scope edit and says so in the transcript', async ($: any, on: any) => {
  const messages = [{ role: 'user', text: 'explain the login flow', toolUses: [] }]
  const jev = fakeJev(on, { probabilities: { writes: 1, inScope: 0.1, removes: 0 }, messages })
  const result = await $.tool.call({
    tool: 'Edit',
    file_path: 'a.ts',
    old_string: 'a',
    new_string: 'b',
    replace_all: false,
  })
  expect(result.deny).toContain('in-scope 0.10')
  expect(jev.ran).toHaveLength(0)
  expect(jev.logs.some((line) => line.includes('Edit denied'))).toBe(true)
  expect(jev.requests[0].state.userRequest).toBe('explain the login flow')
})

test('drops the prompt and logs the error when Jev cannot be reached', async ($: any, on: any) => {
  const jev = fakeJev(on, { probabilities: {}, status: 500 })
  const result = await $.prompt.submit(typed('fix the bug'))
  expect(result.drop).toContain('Jev HTTP 500')
  expect(jev.entered).toHaveLength(0)
  expect(jev.logs.some((line) => line.includes('Jev HTTP 500'))).toBe(true)
})
