# Diagramble: Three Choices of Look

17 November 2026 · Stage 2 of the mockup work

Three style directions for screen 1 of [BRIEFS.md](BRIEFS.md), the diagram workspace.
The words and the layout are the same in all three, so only the style differs. Each was
drawn once by an image generator, and the pictures are in `styles/`.

In every style, a colour has one meaning. The marks keep the shapes that the briefs give
them, so no meaning rests on colour alone. The primary button is filled with the text
colour in all three, which keeps the selection colour for selected things only.

## Chosen: Drafting Paper, in a light and a dark mode

The project's author chose style A, Drafting Paper, on 17 November 2026, and asked for
a dark mode as well. Styles B and C below were not chosen and are kept as a record.

Both modes use the typefaces, shapes and rules of style A. Only the colours change. The
app follows the computer's own light or dark setting at first, and a switch in the top
bar changes it. A PDF export always uses the light colours, so the page handed in looks
like the textbook.

| Colour | Light | Dark | Its one meaning |
| --- | --- | --- | --- |
| Paper | `#F7F3EA` | `#1A1917` | The background of the top bar, the work area and the canvas |
| Side paper | `#F1ECE1` | `#22201C` | The background of the navigator and the right panel |
| Ink | `#1E2A38` | `#ECE6D8` | Text, diagram lines, the primary button |
| Muted ink | `#6B6558` | `#A39C8C` | Secondary text |
| Hairline | `#C9C1B2` | `#3D3933` | Dividers, borders, the canvas grid |
| Selection blue | `#1F5FA8`, tint `#DCE8F5` | `#7FB2EA`, tint `#1F3044` | The selected item |
| Error red | `#B3261E` | `#F0776C` | An error |
| Warning amber | `#A86F00` | `#E3AC3F` | A warning |
| OK green | `#2F6B3A` | `#7CC08B` | No problems |
| AI violet | `#5A3EA8` | `#AD95F2` | Written by AI |
| Disabled grey | `#A8A294` | `#5E5A51` | A control that cannot be used |
| Chip tints | error `#F5DEDA`, warning `#F3E6C8`, OK `#DCE8DC`, AI `#E5DFF2`, count `#E6E0D3` | error `#3B2220`, warning `#372C16`, OK `#1F3125`, AI `#2A2440`, count `#2F2C27` | The background of a chip, a pale wash of the colour of the mark inside it |

**Chips, added on 18 November 2026.** The author asked for rounded chips like those in
IBM Carbon and GitHub Primer. A mark with a number or a word, and a number standing on
its own (on a tab or in the navigator), sits in a rounded chip filled with the tint of
its mark. The mark keeps its colour. The number and the word are in ink, so they read
at about 11 to 1 on every tint. A number inside a sentence stays a plain monospaced
number, and the marks on the diagram canvas have no chip. On a selected item the chip is
paper-coloured, because the tints would vanish into the selection blue. In Windows
high-contrast mode the chips get an outline and the marks are drawn in the system's
text colour.

**Contrast, checked on 18 November 2026 against WCAG 2.2 level AA.** The light warning
amber was `#B87A00`, which reached only 2.9 to 1 on its tint and on the selected row,
below the 3 to 1 a meaningful graphic needs. It is now `#A86F00`, at least 3.4 to 1 on
paper, side paper, its tint and the selected row. The exclamation mark inside the light
warning mark is now white (4.3 to 1); in dark mode it stays dark. Every other mark is at
least 4.8 to 1 on its tint in both modes.

To make room for the chips, the navigator is 240 pixels wide instead of 216.

Two points differ from the picture of style A:

- **Side paper is new.** In the picture every region has the same paper colour, and the
  regions are hard to tell apart. The navigator and the right panel now have a slightly
  darker paper.
- **The error mark in dark mode** has a dark exclamation mark, in the paper colour,
  because white is hard to read on the lighter red.

The dark mode is a dark sheet with pale ink, not a blueprint. A blueprint blue was the
other option. It was left out because a blue background would sit too close to the
selection colour, which must mean "selected" and nothing else.

## A. Drafting Paper

A carefully ruled page from an engineer's notebook. It suits these users because the
student's diagram looks like the black-line figures in the textbook they are checking it
against.

Picture: `styles/drafting-paper.png`

**Background and panels.** The whole screen is one sheet of warm off-white paper. The
regions are separated by 1-pixel hairlines only. There are no shadows and no filled
blocks, and every corner is square, apart from the process symbols. The canvas has a
faint ruled grid, like graph paper.

**Typefaces.**

| Use | Typeface |
| --- | --- |
| Titles | Source Serif 4, semibold |
| Body text | Source Sans 3 |
| Numbers and rule codes | IBM Plex Mono |

**Palette.**

| Colour | Hex | Its one meaning |
| --- | --- | --- |
| Paper | `#F7F3EA` | Every background |
| Ink | `#1E2A38` | Text, diagram lines, the primary button |
| Muted ink | `#6B6558` | Secondary text |
| Hairline | `#C9C1B2` | Dividers, borders, the canvas grid |
| Selection blue | `#1F5FA8`, tint `#DCE8F5` | The selected item |
| Error red | `#B3261E` | An error |
| Warning amber | `#B87A00` | A warning |
| OK green | `#2F6B3A` | No problems |
| AI violet | `#5A3EA8` | Written by AI |
| Disabled grey | `#A8A294` | A control that cannot be used |

**Buttons, pills and tables.** Buttons are square-cornered with a 1-pixel ink outline
and paper fill. The primary button is solid ink. There are no pills: a count is a plain
monospaced number. Tables have horizontal hairlines only, with small monospaced column
headings.

## B. Quiet Studio

Calm, soft and familiar. It suits these users because it looks like the web apps they
already use, so a student new to modeling has nothing extra to learn.

Picture: `styles/quiet-studio.png`

**Background and panels.** The page is a cool pale grey. The top bar, navigator, work
area and problems panel are separate white cards with 12-pixel gaps between them. Cards
have no borders, 12-pixel rounded corners and a soft, faint shadow. The canvas is white
with a faint dot grid.

**Typefaces.**

| Use | Typeface |
| --- | --- |
| Titles | Inter, semibold |
| Body text | Inter, regular |
| Numbers and rule codes | Roboto Mono |

**Palette.**

| Colour | Hex | Its one meaning |
| --- | --- | --- |
| Page grey | `#F2F4F7` | The page behind the cards |
| White | `#FFFFFF` | Cards and the canvas |
| Near-black | `#101828` | Text, diagram lines, the primary button |
| Muted grey | `#667085` | Secondary text |
| Divider grey | `#E4E7EC` | Dividers, thin borders, the canvas dots |
| Selection blue | `#2563EB`, tint `#EAF1FF` | The selected item |
| Error red | `#D92D20` | An error |
| Warning amber | `#F79009` | A warning |
| OK green | `#079455` | No problems |
| AI violet | `#7A5AF8` | Written by AI |
| Disabled grey | `#98A2B3` | A control that cannot be used |

**Buttons, pills and tables.** Buttons have 8-pixel rounded corners, white fill and a
thin grey border. The primary button is solid near-black. Switches and tabs are fully
rounded pills on a pale grey track, and counts sit in small pale grey pills. Tables have
thin lines between rows and small muted column headings.

## C. Night Console

A dark, focused code editor for long evening sessions. It suits these users because the
app's whole point is checking, and here a problem reads like a compiler message.

Picture: `styles/night-console.png`

**Background and panels.** The page and the canvas are near-black. The top bar and the
sidebars are a slightly lighter dark tone. Regions are told apart by that change of tone
and by thin lines. There are no shadows, and corners are rounded by only 4 pixels. The
canvas has a faint grid, and the symbols are drawn in light outlines.

**Typefaces.**

| Use | Typeface |
| --- | --- |
| Titles, labels, tabs and buttons | JetBrains Mono, medium. Small labels are in capitals |
| Body text | Inter, regular |
| Numbers and rule codes | JetBrains Mono |

**Palette.**

| Colour | Hex | Its one meaning |
| --- | --- | --- |
| Near-black | `#0F1216` | The page and the canvas |
| Panel dark | `#171B21` | The top bar, sidebars, cards, the fill of a symbol |
| Line | `#2A3038` | Dividers, borders, the canvas grid |
| Light | `#E6EAF0` | Text, diagram lines, the primary button |
| Muted | `#8B95A5` | Secondary text |
| Selection cyan | `#4CC2FF`, tint `#12303F` | The selected item |
| Error red | `#FF5C5C` | An error |
| Warning amber | `#FFB020` | A warning |
| OK green | `#3DD68C` | No problems |
| AI violet | `#B79CFF` | Written by AI |
| Disabled grey | `#4A5361` | A control that cannot be used |

**Buttons, pills and tables.** Buttons have 4-pixel corners, a thin line border and no
fill. The primary button is solid light with dark text. There are no pills: a count is a
plain monospaced number. Tables have thin lines between rows and small monospaced column
headings in capitals.
