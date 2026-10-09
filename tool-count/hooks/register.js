import { atom, read, update } from 'claude-code'

const PANE = 'tool-count'
const EMPTY = { tools: {}, skills: {} }
const counts = atom({ plugin: 'tool-count', key: 'counts' }, EMPTY)

function bump(map, name) {
  return { ...map, [name]: (map[name] ?? 0) + 1 }
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tools', description: 'Open the tool count pane', immediate: true })
    // Opened without user action, so it only shows in terminals 144+ columns wide; /tools opens it at any width
    await $.ui.open({ id: PANE, title: 'Tools' })
    return next(e)
  })

  // session.start does not fire after /clear
  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear') {
      await update($, counts, () => EMPTY)
      $.ui.invalidate('ui.render')
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'tools' }, async ($) => {
    await $.ui.open({ id: PANE, title: 'Tools' })
    return {}
  })

  on('tool.call', async ($, e, next) => {
    await update($, counts, (c) => ({
      tools: bump(c.tools, e.tool),
      skills: e.tool === 'Skill' && e.skill ? bump(c.skills, e.skill) : c.skills,
    }))
    $.ui.invalidate('ui.render')
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const { tools, skills } = await read($, counts)
    const rows = Object.entries(tools).sort((a, b) => b[1] - a[1])
    if (rows.length === 0) return Text({ dimColor: true, children: ['No tool calls yet'] })
    const lines = []
    for (const [tool, n] of rows) {
      if (tool !== 'Skill') {
        lines.push(Text({ children: [tool + ': ' + n + 'x'] }))
        continue
      }
      lines.push(Text({ children: ['Skill:'] }))
      const skillRows = Object.entries(skills).sort((a, b) => b[1] - a[1])
      skillRows.forEach(([skill, m], i) => {
        const branch = i === skillRows.length - 1 ? '└ ' : '├ '
        lines.push(Text({ children: [branch + skill + ': ' + m + 'x'] }))
      })
    }
    return Box({ flexDirection: 'column', children: lines })
  })
}
