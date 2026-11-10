import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Parallel build agents keep working copies under .claude/worktrees; their tests are not this checkout's.
    exclude: [...configDefaults.exclude, '.claude/**'],
    // Generous, because the big-site tests are slow when the machine is busy.
    testTimeout: 30_000,
  },
})
