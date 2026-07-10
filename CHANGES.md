# CHANGELOG

## v3.0.0

- Fix ([magda-io/ts-module-alias-transformer#15](https://github.com/magda-io/ts-module-alias-transformer/issues/15)): `.d.ts` files are now parsed correctly instead of aborting the run.
  - Parse declaration files in `dts` mode (`@babel/plugin-syntax-typescript` `{ dts: true }`), so declaration-only syntax (`export default interface`, ambient `declare`, `readonly` class fields) no longer throws a `SyntaxError`.
  - Ignore any consumer Babel config during parsing (`configFile: false`, `babelrc: false`) so a project-level `babel.config.*` / `.babelrc` can't interfere.
  - Preserve trailing attributes (e.g. `resolution-mode="require"`) on `/// <reference types="..." />` directives when the type path is remapped.
- Fix: fail loudly instead of silently. A parse error on a single file no longer aborts the whole run or exits `0` — every file is still processed, and the command exits with a non-zero code if any file failed. This prevents shipping a partially-rewritten (broken) build output.
- **BREAKING**: minimum supported Node.js version is now `>=22.0.0`.
- Replace the test toolchain (`mocha` + `chai` + `ts-node`) with Node's built-in test runner (`node:test`) run via `tsx`, with coverage via `c8`.
- Bump CI to Node.js 22.
