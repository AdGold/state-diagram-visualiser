<script>
    import { onMount, onDestroy } from 'svelte';
    import cytoscape from 'cytoscape';
    import {
        makeGraph, graphToElements, groundState, stateName,
        makeThrow, parseSS, validSS, getState, isRemovableState,
        longestPrimeSiteswap, rotations
    } from './state-diagram-generator.js';

    // Props
    export let initialBalls = 3;
    export let initialMaxHeight = 5;

    // Color props - can be customized for different themes
    // Throw gradient colors (HSL values: [hue, saturation%, lightness%])
    export let throwGradientMin = [240, 30, 70];  // Light blue for low throws
    export let throwGradientMax = [240, 80, 10];  // Dark blue for high throws
    export let defaultEdgeColor = 'darkblue';     // When coloring is off
    // State colors by "excitedness" (distance from ground state length)
    export let stateColorPalette = [
        'springgreen',  // Ground state
        'skyblue',      // +1
        'lightcoral',   // +2
        'yellow',       // +3
        '#8db2f7',      // +4
        'orange',       // +5
        'lavender',     // +6
        '#2753a3',      // +7
        'gray'          // +8
    ];
    export let defaultNodeColor = 'springgreen';  // When coloring is off

    // Edge label styling props
    export let edgeLabelColor = '#000';
    export let edgeLabelOutlineColor = 'white';

    // State
    let balls = initialBalls;
    let maxHeight = initialMaxHeight;
    let maxMultiplex = 1;
    let period = '';
    let maxSplit = '';
    let allowLess = false;
    let reduceGraph = false;
    let skipThrows = '';
    let colorThrows = true;
    let colorStates = true;
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

    $: GRAPH_STYLE = [{
        selector: 'node',
        style: {
            'label': 'data(label)',
            'shape': 'round-rectangle',
            'min-width': '30px',
            'min-height': '20px',
            'padding': '8px',
            'text-valign': 'center',
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

    function gradient(val, maxVal) {
        const ratio = val / maxVal;
        const HSL = [
            (1 - ratio) * throwGradientMin[0] + ratio * throwGradientMax[0],
            (1 - ratio) * throwGradientMin[1] + ratio * throwGradientMax[1],
            (1 - ratio) * throwGradientMin[2] + ratio * throwGradientMax[2],
        ];
        return `hsl(${HSL[0]}, ${HSL[1]}%, ${HSL[2]}%)`;
    }

    function getElements() {
        const periodVal = parseInt(period) || 0;
        const maxSplitVal = parseInt(maxSplit);
        const skipSet = new Set(skipThrows.split(',').map(x => parseInt(x, 10)).filter(x => !isNaN(x)));
        const adjList = makeGraph(balls, maxHeight, maxMultiplex, periodVal, maxSplitVal, allowLess, reduceGraph, skipSet);
        return graphToElements(adjList, maxMultiplex);
    }

    function ssCircleLayout(ss, startAngle, curve) {
        if (startAngle === undefined) {
            startAngle = 3 / 2 * Math.PI;
        }
        const order = {};
        let state = getState(ss, maxMultiplex);
        for (let i = 0; i < ss.length; i++) {
            order[String(state)] = i;
            state = makeThrow(state, ss[i], maxMultiplex);
        }
        const mainCircle = cy.nodes().filter(node => order[String(node.data().id)] !== undefined);

        // Calculate circle positions explicitly instead of relying on sort
        const numNodes = mainCircle.length;
        const radius = 100 * numNodes / Math.PI; // Scale radius with number of nodes
        const centerX = 0;
        const centerY = 0;

        // Position each node explicitly based on its order
        mainCircle.forEach(node => {
            const nodeOrder = order[String(node.data().id)];
            const angle = startAngle + (nodeOrder * 2 * Math.PI / numNodes);
            node.position({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            });
        });
        mainCircle.layout({ name: "preset" }).run();
        const extra = cy.nodes().filter(node => order[String(node.data().id)] === undefined);
        if (extra.length > 0) {
            const minConnection = {};
            const maxConnection = {};
            for (const node of extra) {
                let min = mainCircle.length;
                let max = 0;
                for (const neighbor of node.neighborhood()) {
                    const place = order[String(neighbor.data().id)];
                    if (place !== undefined) {
                        min = Math.min(min, place);
                        max = Math.max(max, place);
                    }
                }
                minConnection[String(node.data().id)] = min;
                maxConnection[String(node.data().id)] = max;
            }
            // Use the same center as the main circle
            const midX = centerX;
            const midY = centerY;
            const outerRadius = radius + 100;
            for (const node of extra) {
                const min = minConnection[String(node.data().id)];
                const max = maxConnection[String(node.data().id)];
                let mid = (max + min) / 2;
                if (max - min >= mainCircle.length / 2) {
                    mid -= mainCircle.length / 2;
                }
                const angle = startAngle + mid * (2 * Math.PI) / numNodes;
                node.position({ x: midX + outerRadius * Math.cos(angle), y: midY + outerRadius * Math.sin(angle) });
            }
            extra.layout({ name: "preset" }).run();
            if (curve) {
                extra.connectedEdges().style('curve-style', 'unbundled-bezier');
                extra.connectedEdges().style('control-point-distance', 100);
                extra.filter(edge => edge.connectedEdges().length > 2).connectedEdges().style('curve-style', 'bezier');
            }
        }
        cy.fit(undefined, 50); // Add padding around the graph
    }

    function applyLayout() {
        if (!cy) return;
        cy.edges().style('curve-style', 'bezier');
        const layoutSpec = { name: layout };

        if (layout === 'prime') {
            if (balls < longestPrimeSiteswap.length &&
                maxHeight < longestPrimeSiteswap[balls].length &&
                maxMultiplex === 1 && !period && !reduceGraph) {
                const ss = parseSS(longestPrimeSiteswap[balls][maxHeight]);
                let startAngle = 3 / 2 * Math.PI;
                if (balls + 2 === maxHeight && balls < rotations.length) {
                    startAngle = rotations[balls] * (2 * Math.PI) / ss.length - Math.PI / 2;
                }
                ssCircleLayout(ss, startAngle, true);
                return;
            } else {
                layoutSpec.name = 'circle';
            }
        } else if (layout === 'sscircle') {
            const ss = parseSS(layoutSS);
            if (ss.length > 0) {
                ssCircleLayout(ss, undefined, false);
                return;
            }
        } else if (layout === 'breadthfirst') {
            layoutSpec.roots = [groundState(balls, maxMultiplex)];
        } else if (layout === 'concentric1') {
            layoutSpec.name = 'concentric';
            layoutSpec.minNodeSpacing = 100;
        } else if (layout === 'concentric2') {
            layoutSpec.name = 'concentric';
            layoutSpec.minNodeSpacing = 100;
            layoutSpec.concentric = node => maxHeight - node.data().label.length;
            layoutSpec.levelWidth = () => 1;
        } else if (layout === 'cose') {
            layoutSpec.idealEdgeLength = 150;
        }
        cy.layout(layoutSpec).run();
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
            const t = e.data().label.toString().split('').reduce((a, b) => (isNaN(a) ? 0 : parseInt(a)) + (isNaN(b) ? 0 : parseInt(b)), 0);
            const col = (colorThrows && !reduceGraph) ? gradient(t, maxHeight * maxMultiplex) : defaultEdgeColor;
            e.style('line-color', col);
            e.style('target-arrow-color', col);
        });
    }

    function resetClicked() {
        if (!cy) return;
        cy.clicked = cy.collection();
        updateFaded();
    }

    function highlight(eles) {
        if (!cy) return;
        eles.style('opacity', 1);
        cy.elements().subtract(eles).style('opacity', 0.1);
    }

    function updateHighlightSS() {
        if (!cy) return;
        cy.highlightSS = undefined;
        highlightSSMsg = '';

        if (highlightSS) {
            const siteswap = parseSS(highlightSS);
            let sum = 0;
            for (const th of siteswap) {
                sum += th.reduce((a, b) => a + b, 0);
            }
            if (validSS(siteswap)) {
                const ssBalls = sum / siteswap.length;
                const ssMaxHeight = Math.max(...(siteswap.map(x => Math.max(...x))));
                const ssMaxMultiplex = Math.max(...(siteswap.map(x => x.length)));

                if (ssBalls !== balls) {
                    highlightSSMsg = 'Wrong number of balls';
                } else if (ssMaxHeight > maxHeight) {
                    highlightSSMsg = 'Max throw too high';
                } else if (ssMaxMultiplex > maxMultiplex) {
                    highlightSSMsg = 'Multiplex too large';
                } else {
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
            } else {
                highlightSSMsg = 'Invalid siteswap';
            }
        }
        updateFaded();
    }

    function toggleNode(e) {
        const clickedNode = e.target;
        if (cy.clicked.has(clickedNode)) {
            cy.clicked = cy.clicked.subtract(clickedNode);
        } else {
            cy.clicked = cy.clicked.union(clickedNode);
        }
        updateFaded();
    }

    function updateFaded() {
        if (!cy) return;
        if (cy.highlightSS !== undefined) {
            const eles = cy.elements().filter(el => cy.highlightSS[el.data().id] !== undefined);
            highlight(eles);
        } else {
            const faded = new Set(fadedThrows.split(',').filter(x => x));
            const nodes = (cy.clicked && cy.clicked.length > 0) ? cy.clicked : cy.nodes();
            const eles = nodes.union(nodes.edgesWith(nodes).filter(edge => invertFade === faded.has(edge.data().label)));
            highlight(eles);
        }
    }

    function generate() {
        if (!container) return;
        cy = cytoscape({
            container: container,
            elements: getElements(),
            style: GRAPH_STYLE,
        });
        cy.clicked = cy.collection();
        cy.nodes().on('mouseout', updateFaded);
        cy.nodes().on('mouseover', evt => highlight(evt.target.closedNeighborhood()));

        // Manual drag handling workaround (Cytoscape drag events don't fire properly)
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

        container.addEventListener('mousemove', (e) => {
            if (!draggedNode) return;
            hasDragged = true;
            const rect = container.getBoundingClientRect();
            const x = (e.clientX - rect.left - cy.pan().x - dragOffset.x) / cy.zoom();
            const y = (e.clientY - rect.top - cy.pan().y - dragOffset.y) / cy.zoom();
            draggedNode.position({ x, y });
        });

        container.addEventListener('mouseup', () => {
            draggedNode = null;
        });

        container.addEventListener('mouseleave', () => {
            draggedNode = null;
        });

        // Tap handler that prevents selection when dragging
        cy.nodes().on('tap', (e) => {
            if (!hasDragged) {
                toggleNode(e);
            }
            hasDragged = false;
        });

        applyLayout();
        updateHighlightSS();
        updateColors();
        numNodes = cy.nodes().length;
        numEdges = cy.edges().length;
    }

    onMount(() => {
        // Use requestAnimationFrame to ensure container has dimensions after CSS updates
        requestAnimationFrame(() => {
            generate();
        });
    });

    onDestroy(() => {
        if (cy) {
            cy.destroy();
        }
    });

    // Expose onVisible method for parent to call when tab becomes visible
    export function onVisible() {
        if (cy) {
            // Resize cytoscape to fit the now-visible container
            cy.resize();
            cy.fit();
        }
    }

    // Reactively regenerate when parameters change
    $: if (container && (balls || maxHeight || maxMultiplex || period !== undefined || maxSplit !== undefined || allowLess !== undefined || reduceGraph !== undefined || skipThrows !== undefined)) {
        generate();
    }
</script>

<div class="state-diagram-container">
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
        border: 1px solid #ccc;
        border-radius: 4px;
    }

    legend {
        font-weight: bold;
        font-size: 0.9em;
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
    }

    .control-row input[type="number"],
    .control-row input[type="text"] {
        width: 60px;
        padding: 4px;
        border: 1px solid #ccc;
        border-radius: 3px;
        font-size: 0.85rem;
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
    }

    select {
        width: 100%;
        padding: 6px;
        border: 1px solid #ccc;
        border-radius: 3px;
        font-size: 0.85rem;
        cursor: pointer;
    }

    button {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid #ccc;
        border-radius: 3px;
        background: #f5f5f5;
        cursor: pointer;
        font-size: 0.85rem;
    }

    button:hover {
        background: #e5e5e5;
    }

    .error {
        display: block;
        color: #d00;
        font-size: 0.8rem;
        margin-bottom: 6px;
    }

    .stats {
        font-size: 0.85rem;
        color: #666;
        text-align: center;
        padding: 6px;
    }

    .state-diagram-graph {
        flex: 1;
        min-height: 400px;
        border: 1px solid #ccc;
        border-radius: 4px;
    }

    /* Mobile layout - controls on top */
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
