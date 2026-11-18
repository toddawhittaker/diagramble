# Diagramble

Diagramble is an open-source web tool for teaching systems analysis and design. It
keeps one model behind every diagram, checks that model against explicit rules, and
explains each problem in plain words. It covers data flow diagrams, entity
relationship diagrams and a data dictionary, and it is built to support the course
textbook: Dennis, Wixom and Roth, *Systems Analysis and Design*, 8th edition.

## Where things are

| Path | What it holds |
| --- | --- |
| `docs/VISION.md` | Research and product vision: why the tool exists, what it will and will not do, and the roadmap |
| `docs/SPEC.md` | Core specification: the model, commands, rules and test cases. Where it differs from the vision, the specification wins |
| `docs/images/` | Figures used by the documents |
| `sources/` | The course textbook as a PDF, and notes taken from it in `sources/notes/`. Start with `sources/README.md`: it covers copyright, how to read the PDF, and known errors in the book |

## What belongs in this file

Keep this file to process: how to build, test, run and release, with pointers to where
the detail lives. Product decisions, design and rules go in `docs/`, not here.

## Build and test

The only code so far is a throwaway clickable prototype in `prototype/`. It runs in the
browser with sample data and has no backend. It covers the first-release and
second-release screens of the specification. `prototype/README.md` describes its parts.

```
cd prototype
npm install
npm run dev      # serves the app at http://localhost:5173
npm test         # runs the rule tests once
npm run build    # type-checks, then builds into dist/
```

Add the commands for the real application here when it exists.
