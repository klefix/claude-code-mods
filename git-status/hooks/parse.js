// Untracked files ("??") count as unstaged
export function parsePorcelain(stdout) {
  const lines = stdout.split('\n').filter((line) => line.length > 0)
  let staged = 0
  let unstaged = 0
  for (const line of lines) {
    const x = line[0]
    const y = line[1]
    if (x !== ' ' && x !== '?') staged++
    if (y !== ' ') unstaged++
  }
  return { isRepo: true, changed: lines.length, staged, unstaged }
}
