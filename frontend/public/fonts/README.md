# Self-hosted fonts

Loaded via `src/ui/fonts.css` (`font-display: swap`).

| Family        | Weights            | Files                      | Author / source        | License      |
| ------------- | ------------------ | -------------------------- | ---------------------- | ------------ |
| Figtree       | 400, 500, 600, 700 | `Figtree-<weight>.woff2`   | Erik Kennedy (Figtree) | SIL OFL 1.1  |
| IBM Plex Mono | 400, 500           | `IBMPlexMono-<weight>.woff2` | IBM (IBM Plex)       | SIL OFL 1.1  |

## LT Remark

Intentionally **not** bundled: its license could not be verified as OFL (it appears to be
personal-use only). The display role (`--font-display` in `src/ui/tokens.css`) falls back to
Figtree.
