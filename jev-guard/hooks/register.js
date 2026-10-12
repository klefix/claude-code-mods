import {
  lastExchange,
  PROMPT_QUESTIONS,
  QUESTION_MIN,
  TOOL_QUESTIONS,
  toolCallState,
  toolVerdict,
  VAGUE_MIN,
  withStepText,
} from './judge.js'

const GUARDED = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash']
const USER_ORIGINS = ['composer', 'bridge', 'sdk', 'slack-ping']
const JEV_TIMEOUT_MS = 5000
const PROCEED = 'Proceed as written'
const CANCEL = 'Cancel prompt'

let stepText = ''

function report($, text) {
  $.ui.log(`jev-guard: ${text}`)
}

async function readKey($) {
  const { exitCode, stdout } = await $.process.run(['sh', '-c', 'cat "$HOME/.config/jev-guard/key"'])
  const key = stdout.trim()
  if (exitCode !== 0 || !key) {
    throw new Error('no AI Gateway key in ~/.config/jev-guard/key; run jev-guard/set-key.sh')
  }
  return key
}

async function askJev($, state, questions) {
  const apiKey = await readKey($)
  await $.fs.write(`${$.plugin.root}/.debug/last-request.json`, JSON.stringify({ state, questions }, null, 2))
  const request = $.http.fetch('https://ai-gateway.vercel.sh/v1/evaluate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'typesafe-ai/jev', state, questions }),
  })
  const timeout = $.clock.sleep(JEV_TIMEOUT_MS).then(() => {
    throw new Error(`Jev did not answer within ${JEV_TIMEOUT_MS} ms`)
  })
  const res = await Promise.race([request, timeout])
  if (!res.ok) {
    throw new Error(`Jev HTTP ${res.status}: ${res.text.slice(0, 200)}`)
  }
  const { answers } = JSON.parse(res.text)
  $.ui.log(`jev-guard ${JSON.stringify(answers)}`, { to: 'debug' })
  return answers
}

export function register(on) {
  on('prompt.submit', async ($, e, next) => {
    if (!USER_ORIGINS.includes(e.origin.kind)) {
      return next(e)
    }
    const { assistantProposal } = lastExchange(await $.session.messages())
    const answers = await askJev($, { userRequest: e.text, assistantProposal }, PROMPT_QUESTIONS)
    const vague = answers.vague.probability
    if (vague < VAGUE_MIN || answers.question.probability >= QUESTION_MIN) {
      return next(e)
    }
    let answer
    try {
      answer = await $.ui.ask(
        `Jev: this request may leave a choice open (${vague.toFixed(2)}). Type the choice under Other, or pick:`,
        {
          options: [PROCEED, CANCEL],
          header: 'jev-guard',
        },
      )
    } catch (err) {
      const reason = `jev-guard blocked this prompt (vague ${vague.toFixed(2)}): the clarification dialog failed: ${err?.message ?? String(err)}`
      report($, reason)
      return { drop: reason }
    }
    if (answer === CANCEL) {
      report($, `prompt cancelled at the clarification dialog (vague ${vague.toFixed(2)})`)
      return { drop: 'Cancelled by jev-guard clarification' }
    }
    if (answer === PROCEED) {
      return next(e)
    }
    return next({ ...e, text: `${e.text}\n\nClarification: ${answer}` })
  }).catch(($, e, next) => {
    const error = next.error.message ?? next.error.kind
    if (next.called) {
      report($, `prompt hook failed after passing the prompt on: ${error}`)
      return next(e)
    }
    const reason = `jev-guard blocked this prompt because Jev could not be asked: ${error}`
    report($, reason)
    return { drop: reason }
  })

  on('turn.step', async function* (_$, e, next) {
    if (e.agentId) {
      return yield* next(e)
    }
    stepText = ''
    const stream = next(e)
    let item = await stream.next()
    while (!item.done) {
      if (item.value.kind === 'text') {
        stepText += item.value.text
      }
      yield item.value
      item = await stream.next()
    }
    return item.value
  })

  on('tool.call', async ($, e, next) => {
    if (!GUARDED.includes(e.tool)) {
      return next(e)
    }
    const exchange = withStepText(lastExchange(await $.session.messages()), e.agentId ? '' : stepText)
    let currentFile
    if (e.tool === 'Write') {
      currentFile = await $.fs.read(e.file_path).catch(() => '')
    }
    const answers = await askJev($, toolCallState(exchange, e, currentFile), TOOL_QUESTIONS)
    const reason = toolVerdict(e.tool, answers)
    if (reason) {
      report($, `${e.tool} denied: ${reason}`)
      return { deny: reason }
    }
    return next(e)
  }).catch(($, e, next) => {
    const error = next.error.message ?? next.error.kind
    if (next.called) {
      report($, `${e.tool} hook failed after passing the call on: ${error}`)
      return next(e)
    }
    const reason = `jev-guard blocked this call because Jev could not be asked: ${error}`
    report($, `${e.tool} denied: ${reason}`)
    return { deny: reason }
  })
}
