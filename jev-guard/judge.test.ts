import { expect, test } from 'claude-code/testing'
import { lastExchange, toolVerdict } from './hooks/judge.js'

const yes = (p: number) => ({ type: 'boolean', probability: p })

test('blocks an out-of-scope edit', () => {
  const reason = toolVerdict('Edit', { writes: yes(1), inScope: yes(0.2), removes: yes(0.1) })
  expect(reason).toContain('in-scope 0.20')
})

test('blocks an edit that removes behavior', () => {
  const reason = toolVerdict('Write', { writes: yes(1), inScope: yes(0.9), removes: yes(0.8) })
  expect(reason).toContain('removes-behavior 0.80')
})

test('allows an in-scope edit', () => {
  expect(toolVerdict('Edit', { writes: yes(1), inScope: yes(0.9), removes: yes(0.1) })).toBeNull()
})

test('allows a read-only Bash command without the scope answers', () => {
  expect(toolVerdict('Bash', { writes: yes(0.1) })).toBeNull()
})

test('throws when Jev leaves out an answer', () => {
  expect(() => toolVerdict('Edit', { writes: yes(1) })).toThrow()
})

test('finds the request, the proposal before it and this turn after it', () => {
  const messages = [
    { role: 'assistant', text: 'Findings 1 and 2', toolUses: [] },
    { role: 'user', text: 'fix 1 and 2', toolUses: [] },
    { role: 'assistant', text: 'I detect implementation intent', toolUses: [] },
    { role: 'user', text: '', toolUses: [] },
  ]
  expect(lastExchange(messages)).toEqual({
    userRequest: 'fix 1 and 2',
    assistantProposal: 'Findings 1 and 2',
    assistantThisTurn: 'I detect implementation intent',
  })
})
