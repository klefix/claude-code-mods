const PANE = 'tool-count'

// ponytail: module variable, resets on reload; move to $.state if that matters
let counts = {}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tools', description: 'Open the tool count pane', immediate: true })
    // Opened without user action, so it only shows in terminals 144+ columns wide; /tools opens it at any width
    await $.ui.open({ id: PANE, title: 'Tools' })
    return next(e)
  })

  on('command.run', { command: 'tools' }, async ($) => {
    await $.ui.open({ id: PANE, title: 'Tools' })
    return {}
  })

  on('tool.call', async ($, e, next) => {
    counts[e.tool] = (counts[e.tool] ?? 0) + 1
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1])
    if (rows.length === 0) return Text({ dimColor: true, children: ['No tool calls yet'] })
    return Box({
      flexDirection: 'column',
      children: rows.map(([tool, n]) => Text({ children: [tool + ': ' + n + 'x'] })),
    })
  })
}
