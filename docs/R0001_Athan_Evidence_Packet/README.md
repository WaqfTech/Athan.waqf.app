# R0001 — Delivery and diagnostic evidence

## Publication state

**The work-order was composed. GitHub creation was attempted and refused with HTTP 403, `Resource not accessible by integration`. No issue number or public issue URL was returned.** The subsequent all-state tracker read still contained only the four merged PRs present at intake. No repository source, branch, PR, deployment, label, milestone or assignee was changed.

This packet supplies the authorised manual-posting fallback. `R0001.md` is the standalone proposed issue body; the `R0001` identifier is not a claim that GitHub created an issue. Recheck the destination for overlap and numbering before posting.

## Posting

Destination: `WaqfTech/Athan.waqf.app` on GitHub, Issues → New issue.

Title:

```text
R0001 — Solar-state integrity: polar events, prayer-front correctness and physically based Earth illumination
```

Paste the complete contents of `R0001.md` as the body. It contains its own source links, numerical reproduction instructions, decision gates, implementation cells, tests and closure criteria. It does not require this chat or the packet to explain the proposed work. After posting, read back the complete rendered body, title, state and links; do not assume a submit-button success proves exact publication.

The final manual-delivery text adds evidence-scope clarifications and repeatability wording after the rejected publication attempt. It is a separately hashed delivery, not a claim of byte-identical public readback. Nothing in the text grants execution or release credit. Independent cold specification review and maintainer adoption remain pending.

## Contents

- `R0001.md`: 13 findings, eight baseline witnesses, 12 implementation cells and 30 acceptance criteria, with 36 source references.
- `evidence/source-identity.json`: archive identity and all 94 pinned file hashes/modes; reconstructed Git tree matches the live intake.
- `evidence/reproductions.json`: executed diagnostic values, including the false polar events, mirrored fronts, Isha mismatch, wrong-day event omission, shader algebra and continuity statistic contradiction.
- `evidence/probe-environment.json`: actual Node/TypeScript versions and verification scope.
- `evidence/source-recheck.json`: fresh byte verification and reconstructed tree result.
- `evidence/publication-status.json`: observed refusal, post-attempt tracker census and final delivery identity.
- `evidence/validation.json`: packet-authoring checks and explicit non-claims.
- `probes/`: external read-only diagnostic tools. These are not proposed shipped application utilities. They use no network and install no dependencies.
- `SHA256SUMS.txt`: exact-file digests, excluding that checksum file itself.

No original application source, texture, font, unrelated image, restricted SPA code or installed dependency is redistributed in this packet.

## Reproduce the baseline

Use a disposable checkout of commit `74bd4d593f2eecdd9a0047963144af76cce7a584`, with Git tree `4564106c2b5515727dd29a8e984a91da8bf0d577`. The original supplied ZIP is acceptable after source verification. Python 3.9+ and Node are needed for these optional external probes. Use only already present or maintainer-approved TypeScript dependencies; these scripts do not install them.

From the extracted packet directory, replacing the example checkout path:

```sh
python probes/verify_source.py /path/to/Athan.waqf.app
node probes/compile.cjs /path/to/Athan.waqf.app
node probes/reproduce.cjs /path/to/Athan.waqf.app
```

On Windows the equivalent arguments may be quoted, for example `"C:\Projects\Athan.waqf.app"`; use `py -3` instead of `python` where appropriate. When TypeScript is not installed in the checkout, the compile script accepts an explicit existing module directory as its second argument:

```sh
node probes/compile.cjs /path/to/Athan.waqf.app /path/to/existing/typescript
```

Compilation writes only to the packet's `probes/compiled/` directory, not the checkout. The source verifier checks the listed bytes and reconstructs the tree using the manifest's Git modes; it does not certify all extra/untracked checkout files or Windows/POSIX metadata. The fixture data is decoded with the application's own compact-row parser before the 15,000-settlement calculation.

**Probe assertions intentionally detect the known preimage failures.** A zero exit means those baseline witnesses were reproduced; it does not mean the application is repaired. On a corrected candidate, replace these with tests of the new typed contract and acceptance matrix rather than retaining assertions that demand the old bugs.

The authoring runs used Node 22.16.0 and TypeScript 5.8.3. Two successive diagnostic runs produced byte-identical JSON. The project lock's TypeScript version is 5.9.3: these results are not lock-identical production verification.

## Evidence ceiling

Performed: pinned archive/tree and file checks; source/consumer inspection; isolated transpilation of ten unchanged pure modules; execution and repetition of the bounded diagnostics; Markdown/source-reference/acceptance-population checks; GitHub creation attempt and subsequent read-only census.

Not performed: native Vitest suite, full TypeScript typecheck, Vite production build, browser/GPU image validation, deployment, or independent cold review. Numerical output precision is not a measurement of real atmospheric or local-horizon accuracy. Scanned daily altitude ranges are sampled; the returned false-event altitude is the direct discriminator. Exact conditional-model coverage is not observation of actual mosque calls.
