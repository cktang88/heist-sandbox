import { configDefaults, defineConfig } from 'vitest/config'

// Parallel build agents keep working copies under .claude/worktrees. They are not part of this checkout,
// so neither the dev server nor the tests should look at them.
export default defineConfig({
  server: { watch: { ignored: ['**/.claude/**'] } },
  test: {
    exclude: [...configDefaults.exclude, '.claude/**'],
    // Generous, because the big-site tests are slow when the machine is busy.
    testTimeout: 30_000,
  },
})
