# Methodology

## Coordinate system

Look from the tail toward the nose. A kickflip is `+1` long-axis turn and a heelflip is `-1`. Frontside is positive on the vertical axis, backside is negative, and nose-forward is positive on the cross axis. This explicit convention removes stance and camera ambiguity.

`data/tricks.json` records the modeled tricks: twelve named tricks plus half-flip and one-and-a-half-flip variants that cannot land wheels down. Its `sources` array links the public definitions used to check each combination. The table restates facts in new words and is released under CC0; it does not copy source prose.

## Flight model

Each task treats the board and rider as a point mass that launches and lands at the same height without drag:

```text
airtime = 2 × launch speed / gravity
peak height = launch speed² / (2 × gravity)
```

These are the standard constant-acceleration projectile equations described in [OpenStax University Physics, Projectile Motion](https://openstax.org/books/university-physics-volume-1/pages/4-3-projectile-motion). The generated values are rounded to three decimal places before grading.

A trick is feasible when its reference airtime reaches the fixed minimum in the glossary. Most one-turn flips use 0.48 seconds: 0.08 seconds to set up, then one turn at 2.5 turns per second. Half shove-its use 0.28 seconds. The late flip reserves 0.25 seconds before the same roll. Minimums scale with the modeled rotation so a share of launches fall short: a seeded draw picks an underpowered speed below what the trick needs on about half the eligible tasks. These are benchmark assumptions, not claims about a particular skater.

## Interpretation

The benchmark isolates consistency under a deliberately simple model. It does not simulate foot contact, deck inertia, body rotation, pop timing, angular acceleration, drag, or landing stability. A high score means the model followed the stated geometry and equations; it does not mean the model can coach or perform a trick.
