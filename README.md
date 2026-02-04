# State Diagram Visualiser

Interactive state diagram visualiser for juggling siteswaps, built with Svelte and Cytoscape.js.

A live version of the legacy vanilla JS version can be seen [here](https://diagonalrewards.com/juggling/state-diagram-visualiser/visualiser.html).

## Installation

```bash
npm install @siteswap/state-diagram-visualiser
```

## Usage

### In a Svelte project

```svelte
<script>
    import { StateDiagram } from '@siteswap/state-diagram-visualiser';
</script>

<StateDiagram initialBalls={3} initialMaxHeight={5} />
```

### With custom colors (e.g., for dark themes)

```svelte
<script>
    import { StateDiagram } from '@siteswap/state-diagram-visualiser';

    // Custom color palette for dark theme
    const darkThemeColors = {
        throwGradientMin: [200, 70, 60],
        throwGradientMax: [220, 70, 45],
        defaultEdgeColor: '#007acc',
        stateColorPalette: [
            '#4cd964', '#5ac8fa', '#f08080', '#ffcc00',
            '#ff9500', '#ff6b6b', '#af52de', '#a8a8a8', '#888888'
        ],
        defaultNodeColor: '#4cd964',
        edgeLabelColor: '#fff',
        edgeLabelOutlineColor: '#1a1a1a'
    };
</script>

<StateDiagram
    initialBalls={3}
    initialMaxHeight={5}
    {...darkThemeColors}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialBalls` | number | 3 | Initial number of balls |
| `initialMaxHeight` | number | 5 | Initial maximum throw height |
| `throwGradientMin` | [h, s, l] | [240, 30, 70] | HSL color for low throws |
| `throwGradientMax` | [h, s, l] | [240, 80, 10] | HSL color for high throws |
| `defaultEdgeColor` | string | 'darkblue' | Edge color when coloring is off |
| `stateColorPalette` | string[] | [...] | Colors for states by excitedness |
| `defaultNodeColor` | string | 'springgreen' | Node color when coloring is off |
| `edgeLabelColor` | string | '#000' | Edge label text color |
| `edgeLabelOutlineColor` | string | 'white' | Edge label outline color |

## Methods

The component exposes an `onVisible()` method that should be called when the component becomes visible (e.g., when switching tabs):

```svelte
<script>
    let stateDiagram;

    function onTabVisible() {
        stateDiagram.onVisible();
    }
</script>

<StateDiagram bind:this={stateDiagram} />
```

## Building from source

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run development server (for testing)
npm run dev
```

## Graph generation options

The maximum height and number of balls define the graph which will be shown and provide limits on throws and possible states. Maximum multiplex limits how many balls can be thrown at once. The split of a multiplex (distance between adjacent throws) can be limited to show more practical patterns. The period can also be limited (either to precisely a certain value or to a max value by 'allowing smaller periods.' Period limitation removes any throws/states which aren't in siteswaps of the given length and is particularly interesting for period 2 & 3, beyond that it doesn't significantly help readability and can become slow to compute.

The graph can be reduced similarly to [here](https://users.mai.liu.se/hanlu09/juggling/siteswap-states.pdf) which uses a smaller set of states and has sequences of throws on the edges instead of individual throws. This is done while still showing all possible siteswaps in the graph (and state with only one throw going into or out of it is removed and that throw is prepended/appended to all other throws connected to the state).

Note that when any of these numbers get too high your computer will crawl to a halt - up to height 11 should be easily fast enough on most computers, the graph is re-computed each time any of these values change.

## Appearance

By default states are coloured by length (maximum height in the state) and throws are a gradient based on height. These can be disabled using the checkboxes.

### Fading

Hovering over a state will fade any states or throws not connected and clicking a state will select it - all unselected states and throws not between two selected states will be faded.

Individual throw heights can also be faded, e.g. typing '1,2,3,4' into 'Fade throws' will fade heights 1, 2, 3 and 4. Invert fade allows fading every throw except for specific ones. Highlight siteswap allows everything not part of a given siteswap to be faded.

### Layout

Auto layout tries its best to lay things out nicely, this typically involves putting the longest prime siteswap around the outside and then positioning remaining states around that. This works well when there is a [complete](https://www.jonglage.net/theorie/notation/siteswap-avancee/refs/Jack%20Boyce%20-%20The%20Longest%20Prime%20Siteswap%20Patterns.pdf) prime siteswap and less well otherwise (e.g. 3 balls max height 6). Once the maximum height gets large enough this reverts back to a simple circular layout.

Other layout options include a customisable version of the prime siteswap variant where any given siteswap can be used instead of the longest prime siteswap ('SS circle') and 'Cose Bilkent' which is particularly useful when looking at only period 3 patterns as it captures the planarity well.

## Legacy version

The original vanilla JavaScript version is available on the `main` branch. This Svelte version is on the `svelte` branch.

## License

MIT
