import { expect, test } from 'claude-code/testing'
import { lastExchange, toolCallState, toolVerdict, withStepText } from './hooks/judge.js'

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

test('adds the text of the response that holds the tool call', () => {
  const exchange = { userRequest: 'go', assistantProposal: 'plan', assistantThisTurn: 'earlier' }
  expect(withStepText(exchange, 'I detect implementation intent').assistantThisTurn).toBe(
    'earlier\nI detect implementation intent',
  )
  expect(withStepText(exchange, 'earlier')).toBe(exchange)
  expect(withStepText(exchange, '  ')).toBe(exchange)
})

test('returns empty fields when there is no user message', () => {
  expect(lastExchange([{ role: 'assistant', text: 'hello', toolUses: [] }])).toEqual({
    userRequest: '',
    assistantProposal: '',
    assistantThisTurn: '',
  })
})

test('truncates a long user request', () => {
  const { userRequest } = lastExchange([{ role: 'user', text: 'x'.repeat(9000), toolUses: [] }])
  expect(userRequest).toHaveLength(8000 + '\n[truncated]'.length)
  expect(userRequest.endsWith('\n[truncated]')).toBe(true)
})

test('builds the tool call state without the reserved fields', () => {
  const exchange = { userRequest: 'go', assistantProposal: '', assistantThisTurn: '' }
  const e = { tool: 'Write', tool_use_id: 'toolu_1', agentId: 'a1', file_path: 'a.ts', content: 'new' }
  expect(toolCallState(exchange, e, 'old')).toEqual({
    ...exchange,
    toolCall: { tool: 'Write', file_path: 'a.ts', content: 'new' },
    currentFileContent: 'old',
  })
  expect(toolCallState(exchange, e, undefined)).not.toHaveProperty('currentFileContent')
})

test('truncates long tool input', () => {
  const exchange = { userRequest: 'go', assistantProposal: '', assistantThisTurn: '' }
  const state = toolCallState(exchange, { tool: 'Edit', tool_use_id: 't', new_string: 'y'.repeat(9000) }, undefined)
  expect(state.toolCall.new_string.endsWith('\n[truncated]')).toBe(true)
})

test('names both failures when an edit is out of scope and removes behavior', () => {
  const reason = toolVerdict('Edit', { writes: yes(1), inScope: yes(0.1), removes: yes(0.9) })
  expect(reason).toContain('in-scope 0.10')
  expect(reason).toContain(' and removes-behavior 0.90')
})

test('checks scope for a Bash command that writes', () => {
  expect(toolVerdict('Bash', { writes: yes(0.9), inScope: yes(0.2), removes: yes(0) })).toContain('in-scope 0.20')
})

test('treats the thresholds as allowed at the minimum and blocked at the maximum', () => {
  expect(toolVerdict('Edit', { writes: yes(1), inScope: yes(0.5), removes: yes(0.69) })).toBeNull()
  expect(toolVerdict('Edit', { writes: yes(1), inScope: yes(0.9), removes: yes(0.7) })).toContain(
    'removes-behavior 0.70',
  )
})
