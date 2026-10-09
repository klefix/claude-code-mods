declare module 'claude-code' {
  interface PluginState {
    'tool-count': {
      counts: { tools: Record<string, number>; skills: Record<string, number> }
    }
  }
}
