# Diagramble logo

The mark is the "Shared Source" design, drawn by GPT 6.2 Sol on 18 November 2026
(`docs/images/logo-options/logo-2.svg`), with its shapes unchanged. It is recoloured for
the Drafting Paper look in `docs/mockups/STYLES.md`: it uses that look's ink colours, and
the name is set in that look's title typeface.

| File | What it is | Use it on |
| --- | --- | --- |
| `diagramble-mark.svg` | The mark alone, in ink `#1E2A38` | Light backgrounds |
| `diagramble-mark-dark.svg` | The mark alone, in pale ink `#ECE6D8` | Dark backgrounds |
| `diagramble-wordmark.svg` | The mark and the name, in ink `#1E2A38` | Light backgrounds |
| `diagramble-wordmark-dark.svg` | The mark and the name, in pale ink `#ECE6D8` | Dark backgrounds |

The prototype draws the same wordmark in `prototype/src/components/Wordmark.tsx`, in the
current text colour, so it follows the light and dark modes. Its browser-tab icon is
`prototype/public/favicon.svg`, which follows the browser's own light or dark setting.

## What the mark means

One model, the block on the left, feeds three views through one line. The circle is a
process, for the data flow diagram. The square is an entity, for the entity relationship
diagram. The two ruled lines are entries in the data dictionary.

## Using it

- Keep it one colour: ink on light backgrounds, pale ink on dark ones. Don't use the
  selection blue or any colour that has a meaning in the app. Violet in particular
  means "written by AI".
- Leave clear space around it at least as wide as the mark's small square, about a
  quarter of the mark's height.
- Show the wordmark at least 18 pixels tall and the mark alone at least 16 pixels tall.

## The letters

"Diagramble" is set in Source Serif 4 SemiBold and turned into outlines, so the files
look the same on every computer without the font. The capitals are 26 units tall in a
48-unit box, with the letter spacing taken from the font. Source Serif 4 is under the
SIL Open Font License 1.1, which allows this.
