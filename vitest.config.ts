import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Parallel build agents keep working copies under .claude/worktrees; their tests are not this checkout's.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
