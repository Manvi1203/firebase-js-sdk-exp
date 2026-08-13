# Firebase JS SDK: Agent Guidelines & Testing Invariants

This document defines the mandatory architectural invariants, workflows, and verification rules for all AI agents (Jetski, Gemini CLI, Cursor, Claude Code, GitHub Copilot) and human contributors working on the Firebase JavaScript SDK repository.

---

## 1. Core Testing Invariants

### 1.1 Dual-Runner Compatibility Guarantee (CRITICAL)
- **`yarn test:node` must pass with zero regressions**: Existing Node.js tests run via Mocha + `ts-node` under CommonJS.
- **Never import `vitest` or `vi` in test files (`*.test.ts`)**:
  - In CommonJS (`ts-node`), `import { vi } from 'vitest'` transpiles to `require("vitest")`, throwing:
    `Error: Vitest cannot be imported in a CommonJS module using require()`.
  - **Solution**: Use ambient typing via `src/types/vitest-globals.d.ts` and `globals: true` in Vitest configs. Access `globalThis` for runtime objects.

### 1.2 Karma Preservation Policy
- **Do not delete or modify `karma.conf.js` or legacy npm scripts**:
  - Keep `karma.conf.js`, `karma.conf.browser.js`, and `test:browser` completely intact.
  - Vitest is introduced as an additive runner:
    - `"test:vitest:browser"`: `vitest run --config vitest.config.browser.mjs`
    - `"test:vitest:browser:watch"`: `vitest --config vitest.config.browser.mjs`

### 1.3 Mocha Context & Timeout Safety
- **Never chain `.timeout()` on `it()`**:
  - In Vitest, `it()` returns `void`. Calling `it('name', fn).timeout(ms)` throws:
    `TypeError: Cannot read properties of undefined (reading 'timeout')`.
  - **Solution**: Pass timeout as the 3rd argument `it('name', fn, ms)` or use optional chaining on `this`:
    ```typescript
    this?.timeout?.(20_000);
    ```

### 1.4 Mandatory Error Commenting Rule
- Every code modification made to fix a Vitest/Vite error must include a comment citing the exact error:
  ```typescript
  // Fix Vitest error: "TypeError: Cannot redefine property: post"
  ```

---

## 2. Verification Commands

Before creating a commit or PR, agents MUST verify:

```bash
# 1. Run Vitest Browser Tests
yarn --cwd packages/<pkg> test:vitest:browser

# 2. Run Existing Node Tests (Zero Regression Guarantee)
yarn --cwd packages/<pkg> test:node

# 3. Verify Linter
yarn --cwd packages/<pkg> lint

# 4. Clean Temporary Artifacts
rm -rf packages/<pkg>/src/**/__screenshots__ packages/<pkg>/test/**/__screenshots__ packages/<pkg>/.vitest-attachments
```

---

## 3. Standard Configuration Boilerplate

Every migrated package should include:
- `vitest.config.browser.mjs`: Vitest browser configuration with Chromium Playwright provider.
- `test/polyfills.ts`: Standard polyfills for `global`, `process`, and `__karma__`.
- `test/setup.ts`: Chai plugin registrations and global `afterEach` app cleanup.
- `package.json`: `"test:vitest:browser"` and `"test:vitest:browser:watch"` scripts.
