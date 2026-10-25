# PaperBridge self-hosted fonts

These are unmodified variable TrueType font binaries downloaded from the official Google Fonts repository. Fonts are served locally; browser rendering does not depend on a third-party font CDN. Both use the SIL Open Font License 1.1; full copyright and license notices are preserved alongside the binaries.

The Google Fonts CSS endpoint returned403 in this environment. Original repository TTF binaries were used instead of installing conversion dependencies or modifying font names/glyphs. Total transfer is approximately966KiB before HTTP compression.

## newsreader-variable.ttf

- Source: https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/Newsreader%5Bopsz,wght%5D.ttf
- License: [Newsreader-OFL.txt](./Newsreader-OFL.txt)
- SHA-256: `8a08d13f8a6c0d51be379a60af84f945f65369a67e509ee3c3bdcc421254d7c1`
- Size: 451,664 bytes
- Binary axes: wght 200–800, opsz 6–72

## ibm-plex-sans-variable.ttf

- Source: https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf
- License: [IBMPlexSans-OFL.txt](./IBMPlexSans-OFL.txt)
- SHA-256: `3b031aa4216174205bd8471f88a49b91f093169e9e87bd5262242bc5967fe2e3`
- Size: 537,244 bytes
- Binary axes: wght 100–700, wdth 75–100

CSS exposes the weights used by the journal restyle: Newsreader400–500 and IBM Plex Sans400–600, normal style, with `font-display: swap`. Newsreader retains its optical-size axis; IBM Plex Sans uses its default normal width. Set `font-optical-sizing: auto` in the design system.
