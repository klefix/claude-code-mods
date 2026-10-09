import { parsePorcelain } from './parse.js'

const NOT_A_REPO = { isRepo: false, changed: 0, staged: 0, unstaged: 0 }
const CHANGES_FILES = ['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit']

async function refresh($) {
  const { exitCode, stdout } = await $.process.run(['git', 'status', '--porcelain'])
  const summary = exitCode === 0 ? parsePorcelain(stdout) : NOT_A_REPO
  await $.state.set({ plugin: 'git-status', key: 'summary' }, summary)
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await refresh($)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (CHANGES_FILES.includes(e.tool)) await refresh($)
    return result
  }).catch(($, e, next) => next(e))
}
