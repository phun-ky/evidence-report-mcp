# Changelog

## [0.4.1](https://github.com/phun-ky/evidence-report-mcp/compare/0.4.0...0.4.1) (2026-11-20)

### Bug

* 🐛 treat npm workspace links as the project itself ([ae76eb1](https://github.com/phun-ky/evidence-report-mcp/commit/ae76eb19a3f8bb37f7edcfa7ee1018015156c889)), closes [#73](https://github.com/phun-ky/evidence-report-mcp/issues/73)

## [0.4.0](https://github.com/phun-ky/evidence-report-mcp/compare/0.3.0...0.4.0) (2026-11-20)

### Feature

* 🎸 verify a lockfile or an SBOM with the OSV.dev batch API ([27ef08a](https://github.com/phun-ky/evidence-report-mcp/commit/27ef08af09b87f0979380727fbc545c823edc402)), closes [#62](https://github.com/phun-ky/evidence-report-mcp/issues/62)

## [0.3.0](https://github.com/phun-ky/evidence-report-mcp/compare/0.2.0...0.3.0) (2026-11-20)

### Tasks

* 🤖 add VitePress and TypeDoc ([4b3f79a](https://github.com/phun-ky/evidence-report-mcp/commit/4b3f79a575c64b71a0fd182a9ed4f3fdafc5a736))
* 🤖 generate the API docs with TypeDoc and override vite to 6.4.5 under VitePress ([e80daf3](https://github.com/phun-ky/evidence-report-mcp/commit/e80daf3e3eea473d043bec4446e805fc9d198554))
* 🤖 let lint pass before the API docs are generated ([6cf1dcb](https://github.com/phun-ky/evidence-report-mcp/commit/6cf1dcb2b2c5460bbf164b48f55b0b9e6ead415b))
* 🤖 point the npm homepage at the docs site ([56d93a9](https://github.com/phun-ky/evidence-report-mcp/commit/56d93a94a0aa7c778a875fd9e3d9bc4d64e72e43))

### Documentation

* ✏️ add CONTRIBUTING, GOVERNANCE, ROADMAP and a Code of Conduct ([971aa49](https://github.com/phun-ky/evidence-report-mcp/commit/971aa49e127d5b1f2ed4497e18a62c9db02891cd)), closes [#16](https://github.com/phun-ky/evidence-report-mcp/issues/16), references [#16](https://github.com/phun-ky/evidence-report-mcp/issues/16)
* ✏️ add package, build and project badges to the README ([be53d40](https://github.com/phun-ky/evidence-report-mcp/commit/be53d4053aafc9d696525fa0688dadb0e6a4cd67))
* ✏️ add the docs site, and keep only getting started in the README ([40957cb](https://github.com/phun-ky/evidence-report-mcp/commit/40957cb02076934e1f073a19a34ed8394dee7bab))
* ✏️ answer the OpenSSF Best Practices criteria, with an assurance case and badges ([ca3b04b](https://github.com/phun-ky/evidence-report-mcp/commit/ca3b04b6eedf592ce67570c5bd142e7a30ed78d0)), closes [#17](https://github.com/phun-ky/evidence-report-mcp/issues/17), references [#17](https://github.com/phun-ky/evidence-report-mcp/issues/17)
* ✏️ answer the OSPS Baseline, with a VEX document and the badge ([1b9a20c](https://github.com/phun-ky/evidence-report-mcp/commit/1b9a20ca46a727dee963f522a9817eb4144b4cfe)), closes [#58](https://github.com/phun-ky/evidence-report-mcp/issues/58)
* ✏️ bring the roadmap up to date and link its issues ([c609861](https://github.com/phun-ky/evidence-report-mcp/commit/c60986117b67c51c97ac92eaa33f52cabb5df154)), closes [#65](https://github.com/phun-ky/evidence-report-mcp/issues/65)
* ✏️ move the docs site to direction C, the waterline ([00fbe08](https://github.com/phun-ky/evidence-report-mcp/commit/00fbe089f5c8b7146742c77e4b54ea8dc85a457e)), closes [#50](https://github.com/phun-ky/evidence-report-mcp/issues/50)
* ✏️ record the OpenSSF Best Practices passing badge ([8aa3810](https://github.com/phun-ky/evidence-report-mcp/commit/8aa3810d01d0ffc156a1f89f6a8d12e87b9d410a)), references [#17](https://github.com/phun-ky/evidence-report-mcp/issues/17)

### Feature

* 🎸 limit the size of the verify tool's input ([eacd3e1](https://github.com/phun-ky/evidence-report-mcp/commit/eacd3e19ff1a861ca7a6c14b8af3afd0b4e4a595)), closes [#61](https://github.com/phun-ky/evidence-report-mcp/issues/61)

### Bug

* 🐛 fill the home page board at every window height ([5167adc](https://github.com/phun-ky/evidence-report-mcp/commit/5167adc9634e5712dd3080de2824a9e290e28655)), references [#14](https://github.com/phun-ky/evidence-report-mcp/issues/14)
* 🐛 keep the wordmark inside the sidebar's column ([f601c1d](https://github.com/phun-ky/evidence-report-mcp/commit/f601c1d3a7b8c57bd0cf091a1e5cc0d6c685384a)), references [#50](https://github.com/phun-ky/evidence-report-mcp/issues/50)
* 🐛 make the docs site pass WCAG A and AA, and stop the home page scrolling sideways ([8dc1035](https://github.com/phun-ky/evidence-report-mcp/commit/8dc10354933e84de9fc72d22e992426a93fa67d5)), references [#24](https://github.com/phun-ky/evidence-report-mcp/issues/24) [#24](https://github.com/phun-ky/evidence-report-mcp/issues/24)
* 🐛 start headless Chrome without a guessed port, and wait longer for it ([e802545](https://github.com/phun-ky/evidence-report-mcp/commit/e80254547e11b4a7ea6f1d6f8eb3f5ab03dfade5)), references [#46](https://github.com/phun-ky/evidence-report-mcp/issues/46) [#24](https://github.com/phun-ky/evidence-report-mcp/issues/24)

### Refactoring

* 💡 name the target schema TargetSchema and document the exported API ([a9e37f7](https://github.com/phun-ky/evidence-report-mcp/commit/a9e37f76e304a2c2e8ba0e6a0680ca57b7bb8bec))
* 💡 share the headless Chrome launch between scripts ([956fd10](https://github.com/phun-ky/evidence-report-mcp/commit/956fd107e870d2b6924d41b0c05491bd9d14eca4)), references [#24](https://github.com/phun-ky/evidence-report-mcp/issues/24)

## [0.2.0](https://github.com/phun-ky/evidence-report-mcp/compare/0.1.0...0.2.0) (2026-11-19)

### Tasks

* 🤖 leave the generated changelog out of lint and format ([9d34b0e](https://github.com/phun-ky/evidence-report-mcp/commit/9d34b0e4fa596eec3400b993ae8f31e8e653daa1))
* 🤖 render the logo PNGs from the marks with Work Sans ([794b99a](https://github.com/phun-ky/evidence-report-mcp/commit/794b99a2d4cc4d0c033aaeb5f7f3b89d0c9c0f70))

### Documentation

* ✏️ add the design tokens, the logo set, the README banner and the social card ([a15d858](https://github.com/phun-ky/evidence-report-mcp/commit/a15d858e8226cbab4c93da170d408174a987fd2a))
* ✏️ describe the project as it is now and link the talk's slides ([91e5878](https://github.com/phun-ky/evidence-report-mcp/commit/91e5878d458c3046bdd1ee01d61cc24f974999c3))

### Feature

* 🎸 export the report types from the package entry ([04a0034](https://github.com/phun-ky/evidence-report-mcp/commit/04a0034baaeb1faae180287ea1853339d44ad1b2))

## 0.1.0 (2026-11-19)

### Tasks

* 🤖 add release-it, the conventional changelog and the release guard ([8df3acb](https://github.com/phun-ky/evidence-report-mcp/commit/8df3acbb90aa636c976496e9d463ba7785ede2ae))
* 🤖 add the sign-off hook and the AI attribution block ([944dfb8](https://github.com/phun-ky/evidence-report-mcp/commit/944dfb8910eb071eaf919c6edd2bceb695a74b1c)), references [#6](https://github.com/phun-ky/evidence-report-mcp/issues/6)
* 🤖 fit the ESLint rules to a Node package ([6f5c989](https://github.com/phun-ky/evidence-report-mcp/commit/6f5c9892c4114e37a2a5cd608a389ded3037d1e2)), references [#3](https://github.com/phun-ky/evidence-report-mcp/issues/3)
* 🤖 ignore CLAUDE.md ([108c50a](https://github.com/phun-ky/evidence-report-mcp/commit/108c50afc8b049379c6337274ae3dda5f8891ab3)), references [#1](https://github.com/phun-ky/evidence-report-mcp/issues/1)
* 🤖 lint and format with eslint-config-phun-ky ([26fa865](https://github.com/phun-ky/evidence-report-mcp/commit/26fa865506dfb9de33afab9846bac78c31dae645)), references [#3](https://github.com/phun-ky/evidence-report-mcp/issues/3)
* 🤖 set the licence to MIT and read the version from package.json ([5f4f0ba](https://github.com/phun-ky/evidence-report-mcp/commit/5f4f0ba733c2de890b4d961e74e15e05da1c7dd5)), references [#1](https://github.com/phun-ky/evidence-report-mcp/issues/1)
* 🤖 upgrade the MCP SDK, ajv and zod ([2b0750f](https://github.com/phun-ky/evidence-report-mcp/commit/2b0750f8ac6705846427798e234a9476a2ebb67d)), references [#1](https://github.com/phun-ky/evidence-report-mcp/issues/1)
* 🤖 upgrade TypeScript to 6.0.3 ([5603adc](https://github.com/phun-ky/evidence-report-mcp/commit/5603adcdde50fc270b12022cde4be8881763404e)), references [#4](https://github.com/phun-ky/evidence-report-mcp/issues/4)
* **deps-dev:** Bump @types/node ([cae320a](https://github.com/phun-ky/evidence-report-mcp/commit/cae320ab3da285e2c0a84bb78f681c2a42a4b48c))

### Documentation

* ✏️ add the security policy and security insights ([423cf3e](https://github.com/phun-ky/evidence-report-mcp/commit/423cf3ece8c07fb9ab9b9157d6e01c6bf058ea2f))
* ✏️ describe verifying releases and the release secret ([59095ed](https://github.com/phun-ky/evidence-report-mcp/commit/59095edf7a95e1d993f14755befaa2a499f55e19))
* ✏️ document x-unit and c2patool ([de7d026](https://github.com/phun-ky/evidence-report-mcp/commit/de7d026da870f71343b229a89e386c001de5b83f)), references [#1](https://github.com/phun-ky/evidence-report-mcp/issues/1)
* ✏️ say that a breaking change releases a new major version ([15440d5](https://github.com/phun-ky/evidence-report-mcp/commit/15440d562d208c46c3e38ea5cdfe79610521898e))

### Feature

* 🎸 add the verify tool sketch ([3267d0e](https://github.com/phun-ky/evidence-report-mcp/commit/3267d0e55520bf3c820f86cb2ab73069578bc451)), references [#1](https://github.com/phun-ky/evidence-report-mcp/issues/1)
* 🎸 add the x-unit keyword and strict schema checks ([63c926a](https://github.com/phun-ky/evidence-report-mcp/commit/63c926aec91654f99d8acca0e34cd143b351989b)), references [#1](https://github.com/phun-ky/evidence-report-mcp/issues/1)
* 🎸 check C2PA manifests with c2patool ([6715bf2](https://github.com/phun-ky/evidence-report-mcp/commit/6715bf296dcc098b84bc35033133777189868812)), references [#1](https://github.com/phun-ky/evidence-report-mcp/issues/1)
* 🎸 package as evidence-report-mcp ([8c4de1f](https://github.com/phun-ky/evidence-report-mcp/commit/8c4de1fe5c05949516c3ae9730728293df8b7b65))
* 🎸 parse OSV severity from labels and CVSS vectors ([c6ab427](https://github.com/phun-ky/evidence-report-mcp/commit/c6ab427411df5da11a6128d4e4ef02523df54ea0)), references [#1](https://github.com/phun-ky/evidence-report-mcp/issues/1)

### Bug

* 🐛 drop the trailing colon from C2PA findings without an explanation ([66f4b3c](https://github.com/phun-ky/evidence-report-mcp/commit/66f4b3c3886b904a5162d9e5bb26eb91712de3c2))
* 🐛 start the server from a separate bin entry ([e25980b](https://github.com/phun-ky/evidence-report-mcp/commit/e25980b3d804d2b0b7a2500cb9ed0b009a1d4e21)), references [#1](https://github.com/phun-ky/evidence-report-mcp/issues/1)

### Refactoring

* 💡 replace nested ternaries with early returns ([775490d](https://github.com/phun-ky/evidence-report-mcp/commit/775490dc49e486c72fdb90e52604d24d968a4d66))
