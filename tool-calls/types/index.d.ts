declare module 'claude-code' {
  interface PluginState {
    'tool-calls': {
      counts: { tools: Record<string, number>; skills: Record<string, number> }
    }
  }
}
