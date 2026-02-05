<script>
    /**
     * StateDiagram.svelte
     * Interactive state diagram visualiser for juggling siteswaps.
     *
     * Displays a graph where nodes are juggling states and edges are throws.
     * Supports various layout algorithms, filtering, and highlighting.
     */
    import { onMount, onDestroy } from 'svelte';
    import cytoscape from 'cytoscape';
    import { VanillaSiteswap } from 'universal-siteswap';
    import {
        makeGraph, graphToElements, groundState,
        makeThrow, getState, isRemovableState,
        longestPrimeSiteswap, rotations
    } from './state-diagram-generator.js';

    /**
     * Parse a siteswap string and convert to the format expected by state-diagram-generator.
     * VanillaSiteswap represents "0" as [0], but the generator expects [] (empty array).
     */
    function parseSS(ssString) {
        return VanillaSiteswap.Parse(ssString).throws.map(th =>
            th.length === 1 && th[0] === 0 ? [] : th
        );
    }

    // ==================== Props ====================

    // Initial graph parameters
    export let initialBalls = 3;
    export let initialMaxHeight = 5;

    // Graph coloring - throws (edges)
    export let throwGradientMin = [240, 30, 70];  // HSL for low throws
    export let throwGradientMax = [240, 80, 10];  // HSL for high throws
    export let defaultEdgeColor = 'darkblue';
    export let edgeLabelColor = '#000';
    export let edgeLabelOutlineColor = 'white';

    // Graph coloring - states (nodes)
    export let stateColorPalette = [
        'springgreen', 'skyblue', 'lightcoral', 'yellow',
        '#8db2f7', 'orange', 'lavender', '#2753a3', 'gray'
    ];
    export let defaultNodeColor = 'springgreen';
    export let nodeBorderColor = '#000';
    export let nodeLabelColor = '#000';

    // UI theming (CSS custom properties)
    export let uiBorderColor = '#ccc';
    export let uiBgColor = '#fff';
    export let uiPanelBgColor = 'transparent';
    export let uiTextColor = 'inherit';
    export let uiTextSecondaryColor = '#666';

    // ==================== Internal State ====================

    let balls = initialBalls;
    let maxHeight = initialMaxHeight;
    let maxMultiplex = 1;
    let period = '';
    let maxSplit = '';
    let allowLess = false;
    let reduceGraph = false;
    let skipThrows = '';
    let colorThrows = false;
    let colorStates = false;
    let fadedThrows = '';
    let invertFade = false;
    let highlightSS = '';
    let highlightSSMsg = '';
    let layout = 'prime';
    let layoutSS = '';
    let numNodes = 0;
    let numEdges = 0;

    let container;
    let cy;

    // ==================== Cytoscape Styling ====================

    $: GRAPH_STYLE = [{
        selector: 'node',
        style: {
            'label': 'data(label)',
            'shape': 'round-rectangle',
            'min-width': '30px',
            'min-height': '20px',
            'padding': '8px',
            'text-valign': 'center',
            'border-width': 1,
            'border-color': nodeBorderColor,
            'color': nodeLabelColor,
        }
    }, {
        selector: 'edge',
        style: {
            'source-label': 'data(label)',
            'source-text-offset': 50,
            'curve-style': 'bezier',
            'width': 3,
            'text-valign': 'center',
            'target-arrow-shape': 'triangle',
            'color': edgeLabelColor,
            'text-outline-color': edgeLabelOutlineColor,
            'text-outline-width': 3,
            'min-zoomed-font-size': 6,
        }
    }];

    // ==================== Color Utilities ====================

    function gradient(val, maxVal) {
        const ratio = val / maxVal;
        const h = (1 - ratio) * throwGradientMin[0] + ratio * throwGradientMax[0];
        const s = (1 - ratio) * throwGradientMin[1] + ratio * throwGradientMax[1];
        const l = (1 - ratio) * throwGradientMin[2] + ratio * throwGradientMax[2];
        return `hsl(${h}, ${s}%, ${l}%)`;
    }

    function updateColors() {
        if (!cy) return;

        cy.nodes().forEach(n => {
            const excitedness = n.data().label.length - Math.max(Math.ceil(balls / maxMultiplex), 1);
            const col = colorStates
                ? (stateColorPalette[excitedness] || stateColorPalette[stateColorPalette.length - 1])
                : defaultNodeColor;
            n.style('background-color', col);
        });

        cy.edges().forEach(e => {
            const throwSum = e.data().label.toString().split('')
                .reduce((a, b) => (isNaN(a) ? 0 : parseInt(a)) + (isNaN(b) ? 0 : parseInt(b)), 0);
            const col = (colorThrows && !reduceGraph)
                ? gradient(throwSum, maxHeight * maxMultiplex)
                : defaultEdgeColor;
            e.style('line-color', col);
            e.style('target-arrow-color', col);
        });
    }

    // ==================== Graph Generation ====================

    function getElements() {
        const periodVal = parseInt(period) || 0;
        const maxSplitVal = parseInt(maxSplit);
        const skipSet = new Set(
            skipThrows.split(',')
                .map(x => parseInt(x, 10))
                .filter(x => !isNaN(x))
        );
        const adjList = makeGraph(balls, maxHeight, maxMultiplex, periodVal, maxSplitVal, allowLess, reduceGraph, skipSet);
        return graphToElements(adjList, maxMultiplex);
    }

    // ==================== Layout ====================

    function ssCircleLayout(ss, startAngle = 3/2 * Math.PI, curve = false) {
        // Build order map: state -> position in siteswap cycle
        const order = {};
        let state = getState(ss, maxMultiplex);
        for (let i = 0; i < ss.length; i++) {
            order[String(state)] = i;
            state = makeThrow(state, ss[i], maxMultiplex);
        }

        const mainCircle = cy.nodes().filter(node => order[String(node.data().id)] !== undefined);
        const nodeCount = mainCircle.length;
        const radius = 100 * nodeCount / Math.PI;

        // Position main circle nodes
        mainCircle.forEach(node => {
            const nodeOrder = order[String(node.data().id)];
            const angle = startAngle + (nodeOrder * 2 * Math.PI / nodeCount);
            node.position({
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle)
            });
        });
        mainCircle.layout({ name: 'preset' }).run();

        // Position extra nodes outside the main circle
        const extra = cy.nodes().filter(node => order[String(node.data().id)] === undefined);
        if (extra.length > 0) {
            const connections = {};
            for (const node of extra) {
                let min = nodeCount, max = 0;
                for (const neighbor of node.neighborhood()) {
                    const place = order[String(neighbor.data().id)];
                    if (place !== undefined) {
                        min = Math.min(min, place);
                        max = Math.max(max, place);
                    }
                }
                connections[String(node.data().id)] = { min, max };
            }

            const outerRadius = radius + 100;
            for (const node of extra) {
                const { min, max } = connections[String(node.data().id)];
                let mid = (max + min) / 2;
                if (max - min >= nodeCount / 2) mid -= nodeCount / 2;
                const angle = startAngle + mid * (2 * Math.PI) / nodeCount;
                node.position({ x: outerRadius * Math.cos(angle), y: outerRadius * Math.sin(angle) });
            }
            extra.layout({ name: 'preset' }).run();

            if (curve) {
                extra.connectedEdges().style('curve-style', 'unbundled-bezier');
                extra.connectedEdges().style('control-point-distance', 100);
                extra.filter(edge => edge.connectedEdges().length > 2)
                    .connectedEdges().style('curve-style', 'bezier');
            }
        }

        cy.fit(undefined, 50);
    }

    function applyLayout() {
        if (!cy) return;
        cy.edges().style('curve-style', 'bezier');

        if (layout === 'prime') {
            // Use longest prime siteswap for layout if available
            if (balls < longestPrimeSiteswap.length &&
                maxHeight < longestPrimeSiteswap[balls].length &&
                maxMultiplex === 1 && !period && !reduceGraph) {
                const ss = parseSS(longestPrimeSiteswap[balls][maxHeight]);
                let startAngle = 3/2 * Math.PI;
                if (balls + 2 === maxHeight && balls < rotations.length) {
                    startAngle = rotations[balls] * (2 * Math.PI) / ss.length - Math.PI / 2;
                }
                ssCircleLayout(ss, startAngle, true);
                return;
            }
            cy.layout({ name: 'circle' }).run();
        } else if (layout === 'sscircle') {
            const ss = parseSS(layoutSS);
            if (ss.length > 0) {
                ssCircleLayout(ss);
                return;
            }
        } else if (layout === 'breadthfirst') {
            cy.layout({ name: 'breadthfirst', roots: [groundState(balls, maxMultiplex)] }).run();
        } else if (layout === 'concentric1') {
            cy.layout({ name: 'concentric', minNodeSpacing: 100 }).run();
        } else if (layout === 'concentric2') {
            cy.layout({
                name: 'concentric',
                minNodeSpacing: 100,
                concentric: node => maxHeight - node.data().label.length,
                levelWidth: () => 1
            }).run();
        } else if (layout === 'cose') {
            cy.layout({ name: 'cose', idealEdgeLength: 150 }).run();
        } else {
            cy.layout({ name: layout }).run();
        }
    }

    // ==================== Highlighting & Filtering ====================

    function highlight(eles) {
        if (!cy) return;
        eles.style('opacity', 1);
        cy.elements().subtract(eles).style('opacity', 0.1);
    }

    function updateFaded() {
        if (!cy) return;

        if (cy.highlightSS !== undefined) {
            const eles = cy.elements().filter(el => cy.highlightSS[el.data().id] !== undefined);
            highlight(eles);
        } else {
            const faded = new Set(fadedThrows.split(',').filter(x => x));
            const nodes = (cy.clicked && cy.clicked.length > 0) ? cy.clicked : cy.nodes();
            const eles = nodes.union(
                nodes.edgesWith(nodes).filter(edge => invertFade === faded.has(edge.data().label))
            );
            highlight(eles);
        }
    }

    function updateHighlightSS() {
        if (!cy) return;
        cy.highlightSS = undefined;
        highlightSSMsg = '';

        if (!highlightSS) {
            updateFaded();
            return;
        }

        const parsed = VanillaSiteswap.Parse(highlightSS);
        if (!parsed.isValid) {
            highlightSSMsg = 'Invalid siteswap';
            updateFaded();
            return;
        }

        // Convert [0] to [] for compatibility with state-diagram-generator
        const siteswap = parsed.throws.map(th => th.length === 1 && th[0] === 0 ? [] : th);
        const ssBalls = parsed.numObjects;
        const ssMaxHeight = parsed.maxHeight;
        const ssMaxMultiplex = parsed.maxMultiplex;

        if (ssBalls !== balls) {
            highlightSSMsg = 'Wrong number of balls';
        } else if (ssMaxHeight > maxHeight) {
            highlightSSMsg = 'Max throw too high';
        } else if (ssMaxMultiplex > maxMultiplex) {
            highlightSSMsg = 'Multiplex too large';
        } else {
            // Build set of states and edges to highlight
            const show = {};
            let state = getState(siteswap, maxMultiplex);
            let offset = 0;

            if (reduceGraph) {
                while (offset < siteswap.length && isRemovableState(state, maxHeight, maxMultiplex)) {
                    state = makeThrow(state, siteswap[offset], maxMultiplex);
                    offset++;
                }
            }

            let prev = state;
            for (let i = 0; i < siteswap.length; i++) {
                show[state] = true;
                const next = makeThrow(state, siteswap[(offset + i) % siteswap.length], maxMultiplex);
                show[prev + 'to' + next] = true;
                if (!reduceGraph || !isRemovableState(next, maxHeight, maxMultiplex)) {
                    prev = next;
                }
                state = next;
            }
            cy.highlightSS = show;
        }

        updateFaded();
    }

    function resetClicked() {
        if (!cy) return;
        cy.clicked = cy.collection();
        updateFaded();
    }

    function toggleNode(e) {
        const clickedNode = e.target;
        cy.clicked = cy.clicked.has(clickedNode)
            ? cy.clicked.subtract(clickedNode)
            : cy.clicked.union(clickedNode);
        updateFaded();
    }

    // ==================== Graph Initialization ====================

    function generate() {
        if (!container) return;

        if (cy) cy.destroy();

        cy = cytoscape({
            container,
            elements: getElements(),
            style: GRAPH_STYLE,
        });
        cy.clicked = cy.collection();

        // Hover highlighting
        cy.nodes().on('mouseout', updateFaded);
        cy.nodes().on('mouseover', evt => highlight(evt.target.closedNeighborhood()));

        // Drag handling (workaround for Cytoscape drag event issues)
        let draggedNode = null;
        let dragOffset = { x: 0, y: 0 };
        let hasDragged = false;

        cy.on('mousedown', 'node', (e) => {
            draggedNode = e.target;
            hasDragged = false;
            const pos = draggedNode.position();
            const renderedPos = e.renderedPosition;
            dragOffset.x = renderedPos.x - pos.x * cy.zoom() - cy.pan().x;
            dragOffset.y = renderedPos.y - pos.y * cy.zoom() - cy.pan().y;
        });

        const handleMouseMove = (e) => {
            if (!draggedNode) return;
            hasDragged = true;
            const rect = container.getBoundingClientRect();
            const x = (e.clientX - rect.left - cy.pan().x - dragOffset.x) / cy.zoom();
            const y = (e.clientY - rect.top - cy.pan().y - dragOffset.y) / cy.zoom();
            draggedNode.position({ x, y });
        };

        const handleMouseUp = () => { draggedNode = null; };

        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseup', handleMouseUp);
        container.addEventListener('mouseleave', handleMouseUp);

        cy.nodes().on('tap', (e) => {
            if (!hasDragged) toggleNode(e);
            hasDragged = false;
        });

        applyLayout();
        updateHighlightSS();
        updateColors();
        numNodes = cy.nodes().length;
        numEdges = cy.edges().length;
    }

    // ==================== Lifecycle ====================

    onMount(() => {
        requestAnimationFrame(() => generate());
    });

    onDestroy(() => {
        if (cy) cy.destroy();
    });

    /** Call when the component becomes visible (e.g., tab switch) */
    export function onVisible() {
        if (cy) {
            cy.resize();
            cy.fit();
        }
    }

    // Reactively regenerate when graph parameters change
    $: if (container && (balls || maxHeight || maxMultiplex || period !== undefined ||
         maxSplit !== undefined || allowLess !== undefined || reduceGraph !== undefined ||
         skipThrows !== undefined)) {
        generate();
    }
</script>

<div class="state-diagram-container"
     style="--border-color: {uiBorderColor}; --bg-color: {uiBgColor}; --panel-bg-color: {uiPanelBgColor}; --text-color: {uiTextColor}; --text-secondary: {uiTextSecondaryColor};">

    <div class="state-diagram-controls">
        <fieldset>
            <legend>Graph</legend>
            <div class="control-row">
                <label for="sd-balls">Balls</label>
                <input id="sd-balls" type="number" bind:value={balls} min="1" max="9">
            </div>
            <div class="control-row">
                <label for="sd-max-height">Max height</label>
                <input id="sd-max-height" type="number" bind:value={maxHeight} min="1" max="15">
            </div>
            <div class="control-row">
                <label for="sd-max-multiplex">Max multiplex</label>
                <input id="sd-max-multiplex" type="number" bind:value={maxMultiplex} min="1" max="3">
            </div>
        </fieldset>

        <fieldset>
            <legend>Compression</legend>
            <div class="control-row">
                <label for="sd-period">Period limit</label>
                <input id="sd-period" type="text" bind:value={period} placeholder="none">
            </div>
            <div class="control-row">
                <label for="sd-skip">Skip throws</label>
                <input id="sd-skip" type="text" bind:value={skipThrows} placeholder="e.g. 1,2">
            </div>
            <div class="checkbox-group">
                <label><input type="checkbox" bind:checked={allowLess}> Allow smaller</label>
                <label><input type="checkbox" bind:checked={reduceGraph}> Reduce graph</label>
            </div>
        </fieldset>

        <fieldset>
            <legend>Display</legend>
            <div class="checkbox-group">
                <label><input type="checkbox" bind:checked={colorThrows} on:change={updateColors}> Colour throws</label>
                <label><input type="checkbox" bind:checked={colorStates} on:change={updateColors}> Colour states</label>
            </div>
        </fieldset>

        <fieldset>
            <legend>Highlight</legend>
            <div class="control-row">
                <label for="sd-highlight">Siteswap</label>
                <input id="sd-highlight" type="text" bind:value={highlightSS} on:input={updateHighlightSS} placeholder="e.g. 531">
            </div>
            {#if highlightSSMsg}
                <span class="error">{highlightSSMsg}</span>
            {/if}
            <div class="control-row">
                <label for="sd-fade">Fade throws</label>
                <input id="sd-fade" type="text" bind:value={fadedThrows} on:input={updateFaded} placeholder="e.g. 1,2,3">
            </div>
            <div class="checkbox-group">
                <label><input type="checkbox" bind:checked={invertFade} on:change={updateFaded}> Invert fade</label>
            </div>
            <button on:click={resetClicked}>Clear selection</button>
        </fieldset>

        <fieldset>
            <legend>Layout</legend>
            <select bind:value={layout} on:change={applyLayout}>
                <option value="prime">Auto</option>
                <option value="circle">Circle</option>
                <option value="grid">Grid</option>
                <option value="breadthfirst">Breadth-first</option>
                <option value="concentric1">Concentric</option>
                <option value="concentric2">Concentric (state length)</option>
                <option value="cose">Cose</option>
                <option value="random">Random</option>
                <option value="sscircle">Custom SS Circle</option>
            </select>
            {#if layout === 'sscircle'}
                <input type="text" bind:value={layoutSS} on:input={applyLayout} placeholder="e.g. 531">
            {/if}
        </fieldset>

        <div class="stats">
            {numNodes} states, {numEdges} transitions
        </div>
    </div>

    <div class="state-diagram-graph" bind:this={container}></div>
</div>

<style>
    .state-diagram-container {
        display: flex;
        flex-direction: row;
        height: 100%;
        gap: 1rem;
        font-family: sans-serif;
    }

    .state-diagram-controls {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex-shrink: 0;
        width: 200px;
        overflow-y: auto;
    }

    fieldset {
        margin: 0;
        padding: 8px;
        border: 1px solid var(--border-color, #ccc);
        border-radius: 4px;
        background: var(--panel-bg-color, transparent);
    }

    legend {
        font-weight: bold;
        font-size: 0.9em;
        color: var(--text-color, inherit);
    }

    .control-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
    }

    .control-row:last-child {
        margin-bottom: 0;
    }

    .control-row label {
        font-size: 0.85rem;
        margin: 0;
        color: var(--text-color, inherit);
    }

    .control-row input[type="number"],
    .control-row input[type="text"] {
        width: 60px;
        padding: 4px;
        border: 1px solid var(--border-color, #ccc);
        border-radius: 3px;
        font-size: 0.85rem;
        background: var(--bg-color, #fff);
        color: var(--text-color, inherit);
    }

    .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 6px;
    }

    .checkbox-group:last-child {
        margin-bottom: 0;
    }

    .checkbox-group label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        cursor: pointer;
        margin: 0;
        color: var(--text-color, inherit);
    }

    select {
        width: 100%;
        padding: 6px;
        border: 1px solid var(--border-color, #ccc);
        border-radius: 3px;
        font-size: 0.85rem;
        cursor: pointer;
        background: var(--bg-color, #fff);
        color: var(--text-color, inherit);
    }

    button {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid var(--border-color, #ccc);
        border-radius: 3px;
        background: var(--button-bg-color, #f5f5f5);
        color: var(--text-color, inherit);
        cursor: pointer;
        font-size: 0.85rem;
    }

    button:hover {
        background: var(--button-hover-bg-color, #e5e5e5);
    }

    .error {
        display: block;
        color: var(--error-color, #d00);
        font-size: 0.8rem;
        margin-bottom: 6px;
    }

    .stats {
        font-size: 0.85rem;
        color: var(--text-secondary, #666);
        text-align: center;
        padding: 6px;
    }

    .state-diagram-graph {
        flex: 1;
        min-height: 400px;
        border: 1px solid var(--border-color, #ccc);
        border-radius: 4px;
        background: var(--bg-color, #fff);
    }

    @media (max-width: 768px) {
        .state-diagram-container {
            flex-direction: column;
        }

        .state-diagram-controls {
            flex-direction: row;
            flex-wrap: wrap;
            width: auto;
            overflow-y: visible;
            gap: 6px;
        }

        fieldset {
            flex: 1 1 150px;
            min-width: 150px;
        }

        .state-diagram-graph {
            min-height: 300px;
        }
    }
</style>
