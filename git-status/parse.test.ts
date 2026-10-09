import { expect, test } from 'claude-code/testing'
import { parsePorcelain } from './hooks/parse.js'

test('counts staged, unstaged and untracked files', () => {
  const stdout = ['M  staged.js', ' M unstaged.js', 'MM both.js', '?? new.js', 'R  a.js -> b.js', ''].join('\n')
  expect(parsePorcelain(stdout)).toEqual({ isRepo: true, changed: 5, staged: 3, unstaged: 3 })
})

test('clean tree', () => {
  expect(parsePorcelain('')).toEqual({ isRepo: true, changed: 0, staged: 0, unstaged: 0 })
})
