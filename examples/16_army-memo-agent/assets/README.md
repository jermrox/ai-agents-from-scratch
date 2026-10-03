# Letterhead assets

## `dow-seal.png`

The department seal, applied automatically to every letterhead memorandum.

AR 25-50 para 1-16b(1): *"All official letterhead stationery will bear the DoD
seal."* Para 1-16b(2): *"Do not print any seals, emblems, decorative devices,
distinguishing insignia, slogans, office symbols, names, or mottos on letterhead
stationery except those approved or directed by HQDA."*

The regulation was written when the department was named Defense; the current
seal reads **DEPARTMENT OF WAR / UNITED STATES OF AMERICA**. The requirement is
unchanged - official letterhead bears the department seal - so the citation
stands and the artwork here is the current one.

The seal does not change, which is why it is committed rather than configured.
Nothing needs setting up: render any memorandum and it is there.

`dow-seal-vector.ps` is the vector original, kept for reproduction at sizes the
raster cannot serve. The renderer uses the PNG.

## Placement

Measured from the regulation's own figures rather than assumed. Ten figures
(2-1, 2-3 through 2-7, 2-11 through 2-14) draw the seal on a full 8.5 x 11
page; scaling each seal's bounding box against its page frame gives:

| | measured | sd |
| --- | --- | --- |
| diameter, width | 0.953 in | 0.005 |
| diameter, height | 0.941 in | 0.006 |
| left edge from page edge | 0.523 in | 0.005 |
| top edge from page edge | 0.524 in | 0.006 |

The renderer therefore places it **0.95 inch square, 0.52 inch from the top and
left page edges** — `LETTERHEAD.sealDiameterIn`, `sealTopIn`, `sealLeftIn`.

`verify.js` asserts the placement in English Metric Units (914400 per inch), so
the extent is exactly `868680` square. EMU are integers; a rounding slip cannot
hide in them.

## Overriding it

Resolution order, first match wins:

1. `options.seal` as a Buffer
2. `options.seal` or `options.sealPath` as a path — the `--seal` flag
3. `memo.letterhead.seal` as a path
4. `assets/dow-seal.png` — this file, the default

Setting `letterhead.seal` to `null` renders letterhead with no seal and raises
`seal-missing` as an **error**, since para 1-16b(1) does not allow it.

## What is never done

The seal is never drawn, approximated, or substituted. Para 1-16b(2) forbids any
other device on letterhead, and artwork that merely resembles the seal would
produce a document that looks official and is not. If the file is missing the
letterhead renders without it and the validator says so.
