# Pixel-art rules

Each rule is one checkable sentence. Sources: Pixel Logic (Michael Azzi), cure's PixelJoint tutorial, Pedro Medeiros's Pixel Grimoire, Slynyrd's Pixelblog, Pixnote learn pages, Arne's tutorial, Derek Yu, Pixel Parmesan, the Cassette Beasts monster guide, Sandro Maglione, and the Pixel Art Bench / Asset Forge LLM studies. `lint.mjs` checks the ones it can (11, 12, 17, 22, 24, 37, 51 and the frame gates); the rest are for your eyes on the preview.

## Lines and anti-aliasing
1. Every diagonal or curve is a staircase; keep step lengths monotonic (1,1,2,3 or 2,1,2) and never mix a 1-step among 2-steps.
2. A jaggy breaks the step sequence; a double is a 2x2-ish corner on a 1 px line. Remove both unless a corner is intended.
3. Lines are 1 px thick; control apparent weight with colour, not extra pixels.
4. Never anti-alias 45° steps, horizontal or vertical edges, or single-pixel steps.
5. AA run length is about half the step length; more AA pixels near the source colour, fewer at the tail.
6. One AA shade to start, two for smoother, three max; the AA colour must bridge the two values.
7. Horizontal slopes get horizontal AA runs, vertical slopes vertical runs.
8. Convex curves: light AA in the centre, dark at the ends; concave: the reverse.
9. Keep AA inside the sprite; never AA the outer silhouette when the ground varies.
10. Skip AA on sprites of 16 px or less; mid-tone pixels are 1 px, 2 at most.

## Clusters, shapes, cleanup
11. An orphan pixel not touching its own colour is noise unless it is a deliberate AA buffer, an eye, or a highlight.
12. Banding is two runs hugging in parallel (outline hugging fill, fat-pixel stairs, skip-one gaps, 45° parallels); fix by adding or removing 1 or 2 edge pixels.
13. Build texture from a few clusters repeated at varied spacing and leave empty areas.
14. Prune highlights to a few sweet spots; scattered 1 px highlights read as noise.
15. Silhouette test: filled solid black the sprite must still read and differ from every other enemy.
16. Separate touching parts with a 1 px gap or a value step, like letter-spacing.

## Palette and ramps
17. Colour budget by size: 8 px 2 to 4; 16 px 4 to 8; 32 px 8 to 16; 64 px 16 to 32.
18. Each material gets base, shadow, highlight; a whole character uses 6 to 12 colours.
19. Shadows go cooler and less saturated, highlights warmer and more saturated; never a value-only ramp.
20. Saturation peaks mid-ramp and never hits 0 or 100; brightness climbs monotonically.
21. Never combine high saturation with high brightness; large areas low-sat, small accents high-sat.
22. No pure #000 outlines or pure white highlights; tint both ends.
23. Share one dark shadow colour across several material ramps.
24. Value first: in greyscale every adjacent ramp step and sprite-vs-ground must still differ.
25. Ground uses less saturated hues than sprites; in this game the hero is the only saturated colour.
26. Shadow stages by canvas: 16 px 2; 32 px 3; 48 px 3 to 4; 64 px and up 4 to 5.

## Shading and light
27. One light source per scene, consistent across sprites; top-down uses top or top-left; lava and torches are local overrides on the facing side only.
28. Top-facing planes get the light shade, sides and undersides the shadow, the ground contact the darkest.
29. No pillow shading: shadows sit on the far side from the light, never trace the outline uniformly.
30. Flat faces are one colour; only curved surfaces get a ramp, changing along the curve direction.
31. Three-stage pass: big light/shadow split, then smaller blending clusters, then outline for pop.
32. Material contrast: metal high with a 1 to 2 px sharp highlight; skin and cloth soft; wood moderate, no highlight; glow very high with a near-white core.
33. Selective outline: dark on the shadow side and against the ground, a lighter body tone on the lit side; only worth it at 32 px and up.
34. Lighten the upper outline; drop the outline where the shape meets the floor.
35. Emissive in a limited palette: 1 px near-white core, one ring of the saturated hue, one desaturated darker ring, and the same hue as a 1 px rim on adjacent surfaces.
36. Hot light over time: white, saturated warm, dark warm, grey smoke.

## Readability for a top-down horde
37. Sprites on busy grounds need an outline; projectiles and pickups can take a double outline, dark outer and bright inner.
38. Outline colour is a darker version of the body's darkest tone, not #000.
39. Shape language: round is friendly, square is sturdy, triangular is danger; one dominant primitive per enemy class.
40. Big monsters carry more detail; small ones stay under-detailed.
41. At 16 px an eye is 1x2 px, at 32 px 2x2 with a 1 px highlight; on dark-fantasy horde sprites the glowing eye pair is the only high-contrast cluster.
42. No dithering on animated sprites or anything of 16 px or less; dither static tiles only, tapered at the edges.
43. Judge every sprite at 1x on the real ground; one pixel can change what a shape reads as.

## Animation
44. Frame budgets: idle 2 to 4, walk 4 (top-down) to 6, run 6 to 8, attack 4 to 6, effects 3 to 6.
45. Timing: 8-frame cycle about 80 ms per frame, 4-frame about 160 ms; idle 4 to 6 fps, walk 8 to 12, effects 15 to 24.
46. Walk key poses: contact, down, passing (tallest), up; opposite arm to leg.
47. Head bob is a triangle wave: down 1, down 1, up 2 over a 6-frame cycle; 1 px at 16 px, 1 to 2 at 32.
48. Four directions need 3 unique sheets with side flipped; eight need 5 for symmetric bodies.
49. Attacks: 1 anticipation frame at 100 to 250 ms, 2 to 3 smear frames at 50 ms, 1 follow-through 1 px further with no smear, 1 recover.
50. Idle changes only 1 to 2 pixels per frame and holds extremes longer.
51. Diff consecutive frames and keep unchanged regions byte-identical.
52. Sub-pixel motion moves colour, not silhouette: shift AA or shadow pixels one shade; needs 6 or more colours.
53. Hit flash is 2 frames swapping to a red/white ramp over a damage pose.

## VFX and top-down proportions
54. Fire: 6 frames at 100 ms with 50 ms flicker on highlights; an S-shaped tongue that tapers and breaks into smaller S particles.
55. Explosion expands fast then slow; circles thin to rings then organic blobs that rise as smoke; 3-frame vaporise ring for enemy death.
56. Effects start small in frame 1 then jump large in frame 2; 3 to 6 frames total.
57. Sparkles are several 3 to 4 frame mini-animations played with random offset; pulse pickups by 1 px.
58. Fake alpha with a checkerboard only on static large effects; small sprites get a 1 px darker rim instead.
59. Character box is 1 tile wide by 2 tall; head is a third to a half of height; 16 px 2 to 3 heads, 32 px 3 to 4.
60. 3/4 view shows more top-of-head; eyes sit in the lower half of the head; feet about 2 px wide at 16 px.
61. Large monsters: blob the silhouette in 2 to 3 flat colours, silhouette test, then the three-stage shading pass, with one main reference.

## From the LLM evidence
62. Raw grids fail on global consistency: keep every row the same width, count columns explicitly, verify by rendering, and build big sprites from labelled regions first.
63. Always review the rendered PNG alongside the ASCII grid; a judge with both catches coverage and symmetry errors that text alone misses.
