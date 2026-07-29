# Letterhead assets

## `dod-seal.png`

AR 25-50 para 1-16b(1): *"All official letterhead stationery will bear the DoD
seal."* Para 1-16b(2): *"Do not print any seals, emblems, decorative devices,
distinguishing insignia, slogans, office symbols, names, or mottos on letterhead
stationery except those approved or directed by HQDA."*

Those two sentences together are an instruction not to improvise. The renderer
will not draw a substitute seal, so this file is not generated - you supply it
once and every memorandum thereafter uses it. The seal does not change, so this
is a one-time setup.

**Where to get it:** the computer-generated letterhead template on the Army
Publishing Directorate site, which para 1-16b directs you to use:

    https://armypubs.army.mil/tools/pubsresources.aspx

Save the seal image from that template here as `dod-seal.png`.

**Resolution:** it prints at 1 inch square (`LETTERHEAD.sealDiameterIn`), so
300 dpi means roughly 300x300 pixels. Anything smaller will look soft in print.

## How it is picked up

`renderDocx()` resolves the seal in this order, taking the first that exists:

1. `options.seal` as a Buffer
2. `options.seal` or `options.sealPath` as a file path - the `--seal` flag
3. `memo.letterhead.seal` as a file path
4. `examples/16_army-memo-agent/assets/dod-seal.png` - this file

With none of them present the letterhead renders without a seal and the
validator raises `seal-missing`, citing para 1-16b(1). That finding is the
intended behaviour: a memorandum missing its seal should be visibly incomplete
rather than quietly wrong.

## Why this file is not in the repository

Distributing DoD insignia carries use restrictions that have nothing to do with
AR 25-50 formatting, and an approximation drawn to look official would be worse
than none. Fetching it yourself from the APD template also guarantees you have
the current official artwork rather than whatever was correct when this example
was written.
