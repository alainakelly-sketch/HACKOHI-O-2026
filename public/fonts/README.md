# PaperBridge self-hosted fonts

The active website font is Playfair Display (regular 400 and bold 700). Manrope is retained as a historical asset. Earlier Newsreader and IBM Plex Sans binaries remain as historical assets; `src/fonts.css` no longer loads them.

These are unmodified variable TrueType font binaries downloaded from the official Google Fonts repository. Fonts are served locally; browser rendering does not depend on a third-party font CDN. All use the SIL Open Font License 1.1; full copyright and license notices are preserved alongside the binaries.

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

## manrope-variable.ttf — historical font

- Source: https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf
- License: [Manrope-OFL.txt](./Manrope-OFL.txt), SIL Open Font License1.1; original copyright notice preserved.
- SHA-256: `3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6`
- Size: 164,700 bytes
- Binary axis: wght200–800 (default200); the variable font provides the requested regular400 and medium/semibold500–600 instances.

This is the unmodified original Google Fonts repository binary, validated with FontTools. This binary was used by an earlier branding update and is retained as a historical asset. It is not loaded by the current font stylesheet.

## playfair-display-variable.ttf — active website font

- Source: https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf
- License: [PlayfairDisplay-OFL.txt](./PlayfairDisplay-OFL.txt), SIL Open Font License 1.1; original copyright preserved.
- SHA-256: `c40f2293766a503bc70cce9e512ef844a4ccb7cbcde792fe2ea31d191917d8d6`
- Unmodified official variable binary, validated with FontTools: family Playfair Display; weight axis 400–900. CSS exposes 400–700; body uses 400 and headings 700.
- Served locally with font-display: swap. Logo lettering remains embedded in the original image. Earlier font sections describe historical assets only.
