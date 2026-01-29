import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig(async () => {
  const plugins = await WxtVitest();
  return {
    plugins,
    test: {
      // Test file patterns
      include: ['tests/**/*.test.ts'],
      // Coverage (optional)
      coverage: {
        provider: 'v8' as const,
        reporter: ['text', 'html'],
        include: ['entrypoints/**/*.ts', 'utils/**/*.ts'],
      },
    },
  };
});
