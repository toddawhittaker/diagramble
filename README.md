<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/brand/diagramble-wordmark-dark.svg">
    <img src="docs/images/brand/diagramble-wordmark.svg" alt="Diagramble" height="64">
  </picture>
</p>

<p align="center"><em>See the system. Shape the solution.</em></p>

Diagramble is a web tool for teaching systems analysis and design. It keeps one model
behind every diagram, checks that model against explicit rules, and explains each
problem in plain words. It covers data flow diagrams, entity relationship diagrams and a
data dictionary.

It is built to support one textbook: Dennis, Wixom and Roth, *Systems Analysis and
Design*, 8th edition (Wiley, 2022). Diagramble is not affiliated with or endorsed by the
book's authors or its publisher.

![The prototype's diagram workspace. A child data flow diagram is open, and the
problems panel explains that a flow from the parent diagram does not fully enter
it](docs/images/prototype-workspace.png)

## Status

The only code so far is a clickable prototype. It runs in the browser with a sample
project, "Clinic appointments", and has no server. The model and the rules behave as the
specification says, and the rest is as simple as it could be made. It covers the screens
of the first and second releases. The real application has not been started.

## Running the prototype

You need a current version of [Node.js](https://nodejs.org/).

```
cd prototype
npm install
npm run dev      # serves the app at http://localhost:5173
npm test         # runs the rule tests once
npm run build    # type-checks, then builds into dist/
```

[`prototype/README.md`](prototype/README.md) describes its parts.

## Documents

| Path | What it holds |
| --- | --- |
| [`docs/VISION.md`](docs/VISION.md) | Research and product vision: why the tool exists, what it will and will not do, and the roadmap |
| [`docs/SPEC.md`](docs/SPEC.md) | The core specification: the model, commands, rules and test cases. Where it differs from the vision, the specification wins |
| [`docs/STATUS.md`](docs/STATUS.md) | What each piece of work delivered, and the gaps still open |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | How work is branched, reviewed, checked and merged |
| [`docs/mockups/STYLES.md`](docs/mockups/STYLES.md) | The look, "Drafting Paper", with its colours, typefaces and contrast checks |
| [`docs/images/brand/`](docs/images/brand/) | The logo and wordmark, and how to use them |

## License

Diagramble is source-available under the [Business Source License 1.1](LICENSE). It is
not open source.

- **Free** for public and non-profit schools, colleges and universities hosting it for
  their own students and staff, and for anyone using it for their own learning, teaching
  or projects.
- **A paid license is needed** for use by a for-profit organization, for selling or
  bundling it, and for charging anyone to host, run or support it.
- **Each version becomes open source** under the GNU Affero General Public License
  (AGPL), version 3 or later, four years after it is released.

[`LICENSING.md`](LICENSING.md) gives the full list in plain words. Where it and the
license differ, the license governs.

## Contributing

Outside contributions are not being accepted yet. They will need a contributor license
agreement, so that commercial licenses can still be offered.
