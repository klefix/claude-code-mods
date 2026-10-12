import type { ElementConstructor, On, PluginState, TextProps } from 'claude-code'

const PANE = 'sidebar'

function gitLines(Text: ElementConstructor<TextProps>, summary: PluginState['git-status']['summary'] | undefined) {
  if (!summary) {
    return [Text({ dimColor: true, children: ['Waiting for git-status'] })]
  }
  if (!summary.isRepo) {
    return [Text({ dimColor: true, children: ['Not a git repository'] })]
  }
  return [
    Text({ children: [`Changed: ${summary.changed}`] }),
    Text({ children: [`Staged: ${summary.staged}`] }),
    Text({ children: [`Unstaged: ${summary.unstaged}`] }),
  ]
}

function toolLines(Text: ElementConstructor<TextProps>, counts: PluginState['tool-calls']['counts'] | undefined) {
  const rows = Object.entries(counts?.tools ?? {}).sort((a, b) => b[1] - a[1])
  if (rows.length === 0) {
    return [Text({ dimColor: true, children: ['No tool calls yet'] })]
  }
  const lines = []
  for (const [tool, n] of rows) {
    if (tool !== 'Skill') {
      lines.push(Text({ children: [`${tool}: ${n}x`] }))
      continue
    }
    lines.push(Text({ children: ['Skill:'] }))
    const skillRows = Object.entries(counts?.skills ?? {}).sort((a, b) => b[1] - a[1])
    skillRows.forEach(([skill, m], i) => {
      const branch = i === skillRows.length - 1 ? '└ ' : '├ '
      lines.push(Text({ children: [`${branch + skill}: ${m}x`] }))
    })
  }
  return lines
}

export function register(on: On) {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sidebar', description: 'Open the sidebar pane', immediate: true })
    // Opened without user action, so it only shows in terminals 144+ columns wide; /sidebar opens it at any width
    await $.ui.open({ id: PANE, title: 'Sidebar' })
    return next(e)
  })

  on('command.run', { command: 'sidebar' }, async ($) => {
    await $.ui.open({ id: PANE, title: 'Sidebar' })
    return {}
  })

  // A $.state.get during ui.render subscribes the pane, so writes by the other mods redraw it
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)
    const { value: summary } = await $.state.get({ plugin: 'git-status', key: 'summary' })
    const { value: counts } = await $.state.get({ plugin: 'tool-calls', key: 'counts' })
    return Box({
      flexDirection: 'column',
      children: [
        Box({
          flexDirection: 'column',
          children: [Text({ bold: true, children: ['Git'] }), ...gitLines(Text, summary)],
        }),
        Text({ dimColor: true, children: ['─'.repeat(e.props?.bodyColumns ?? 20)] }),
        Box({
          flexDirection: 'column',
          children: [Text({ bold: true, children: ['Tools'] }), ...toolLines(Text, counts)],
        }),
      ],
    })
  })
}
