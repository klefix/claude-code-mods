// Copies of the contracts declared by the tool-calls and git-status mods
declare module 'claude-code' {
  interface PluginState {
    'tool-calls': {
      counts: { tools: Record<string, number>; skills: Record<string, number> }
    }
    'git-status': {
      summary: { isRepo: boolean; changed: number; staged: number; unstaged: number }
    }
  }
}
