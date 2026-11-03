import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Release protocol tests use node:test and run separately in the build workflow.
    exclude: [...configDefaults.exclude, "scripts/**"],
    // 默认跑在 node 环境；需要 DOM 的用例在文件顶部写 `// @vitest-environment jsdom`。
    setupFiles: ["./vitest.setup.ts"],
  },
});
