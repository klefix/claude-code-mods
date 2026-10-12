import { atom, update } from 'claude-code'

const EMPTY = { tools: {}, skills: {} }
const counts = atom({ plugin: 'tool-calls', key: 'counts' }, EMPTY)

function bump(map, name) {
  return { ...map, [name]: (map[name] ?? 0) + 1 }
}

export function register(on) {
  // session.start does not fire after /clear
  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear') {
      await update($, counts, () => EMPTY)
    }
    return next(e)
  }).catch((_$, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await update($, counts, (c) => ({
      tools: bump(c.tools, e.tool),
      skills: e.tool === 'Skill' && e.skill ? bump(c.skills, e.skill) : c.skills,
    }))
    return next(e)
  }).catch((_$, e, next) => next(e))
}
