import type { Args, On, SessionMessage } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

type JevRequest = { state: { userRequest: string }; questions: Record<string, unknown> }

type Fake = {
  probabilities: Record<string, number>
  messages?: SessionMessage[]
  status?: number
  dialogAnswer?: string
}

function fakeJev(on: On, { probabilities, messages = [], status = 200, dialogAnswer }: Fake) {
  const requests: JevRequest[] = []
  const logs: string[] = []
  const entered: Args<'prompt.submit'>[] = []
  const ran: Args<'tool.call'>[] = []
  const asked: Args<'tool.call'>[] = []
  mock.clock(on)
  on('session.messages', async () => ({ value: messages }))
  on('process.run', async () => ({
    value: { exitCode: 0, stdout: 'test-key\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('fs.write', async () => ({ value: undefined }))
  on('ui.log', async (_$, e) => {
    logs.push(e.text)
    return { value: undefined }
  })
  on('http.fetch', async (_$, e) => {
    const body: JevRequest = JSON.parse(e.init?.body ?? '{}')
    requests.push(body)
    const answers = Object.fromEntries(
      Object.keys(body.questions).map((name) => [name, { type: 'boolean', probability: probabilities[name] ?? 0 }]),
    )
    return { value: { status, ok: status < 300, headers: {}, text: JSON.stringify({ answers }) } }
  })
  on('prompt.submit', async (_$, e) => {
    entered.push(e)
    return { text: e.text, context: e.context }
  })
  on('tool.call', async (_$, e) => {
    if (e.tool === 'AskUserQuestion') {
      asked.push(e)
      const question = e.questions[0]?.question ?? ''
      return { result: { questions: e.questions, answers: { [question]: dialogAnswer } } }
    }
    ran.push(e)
    return { result: {} }
  })
  return { requests, logs, entered, ran, asked }
}

const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' as const } })

test('passes a clear request through unchanged', async ($, on) => {
  const jev = fakeJev(on, { probabilities: { vague: 0.1, question: 0.1 } })
  const result = await $.prompt.submit(typed('rename foo to bar in src/a.ts'))
  expect(jev.requests).toHaveLength(1)
  expect(result.text).toBe('rename foo to bar in src/a.ts')
  expect(jev.asked).toHaveLength(0)
})

test('does not open the dialog for a question, even when it is vague', async ($, on) => {
  const jev = fakeJev(on, { probabilities: { vague: 0.9, question: 0.9 } })
  const result = await $.prompt.submit(typed('what other questions could we ask jev?'))
  expect(result.text).toBe('what other questions could we ask jev?')
  expect(jev.asked).toHaveLength(0)
})

test('adds the clarification typed in the dialog to a vague request', async ($, on) => {
  const jev = fakeJev(on, { probabilities: { vague: 0.9, question: 0.1 }, dialogAnswer: 'only the login page' })
  const result = await $.prompt.submit(typed('fix the bug'))
  expect(jev.asked).toHaveLength(1)
  expect(result.text).toBe('fix the bug\n\nClarification: only the login page')
})

test('denies an out-of-scope edit and says so in the transcript', async ($, on) => {
  const messages: SessionMessage[] = [{ role: 'user', text: 'explain the login flow', toolUses: [] }]
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
  expect(jev.requests[0]?.state.userRequest).toBe('explain the login flow')
})

test('drops the prompt and logs the error when Jev cannot be reached', async ($, on) => {
  const jev = fakeJev(on, { probabilities: {}, status: 500 })
  const result = await $.prompt.submit(typed('fix the bug'))
  expect(result.drop).toContain('Jev HTTP 500')
  expect(jev.entered).toHaveLength(0)
  expect(jev.logs.some((line) => line.includes('Jev HTTP 500'))).toBe(true)
})
