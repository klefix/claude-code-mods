declare module 'claude-code' {
  interface PluginState {
    'git-status': {
      summary: { isRepo: boolean; changed: number; staged: number; unstaged: number }
    }
  }
}
