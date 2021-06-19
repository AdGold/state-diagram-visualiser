const GRAPH_STYLE = [{
    selector: 'node',
    style: {
        'label': 'data(label)',
        'shape': 'round-rectangle',
        'width': 'label',
        'height': 'label',
        'padding': 5,
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
        'text-outline-color': 'white',
        'text-outline-width': 3,
        'min-zoomed-font-size': 6,
    }
}];

// Layouts
// From https://web.archive.org/web/20110317025440/http://www.jugglingdb.com:80/compendium/boyce/prime_list.html#4_8
const longestPrimeSiteswap = [
    // 0 ball
    [],
    // 1 ball
    ["", "1", "20", "300", "4000", "50000", "600000", "7000000", "80000000", "900000000", "a000000000"],
    // 2 ball
    ["", "", "2", "330", "4130", "52050400", "620500605000", "730070060007060000", "830070008007000080700000", "94000900080000900800000908000000", "a400090000a000900000a009000000a090000000", "b50000b0000a00000b000a000000b00a0000000b0a00000000", "c50000b00000c0000b000000c000b0000000c00b00000000c0b000000000"],
    // 3 ball
    ["", "", "", "3", "4440", "55150530", "661600640606130", "773007071700706070074007706000", "8818000086080008600800820808007008080700080860000", "99500009091900009080900009700900091900900080800900908000900960000990800000", "aa300a0000a6000a0a0090000a0a0900000a0a4000a00a090000a00a20a000a00900a000a09000a000a60000aa00900000aa09000000", "bb1b0000000b70b0000b00a00b0000b0a000b0000b70000b0b00a00000b0b0a000000b0b50000b00b0a00000b00b300b000b00a000b000b0a0000b000b50000bb000a00000bb009000000", "cc1c00000000c90c000000c0b00c000000c9000c0000c0b0000c0000c20c000c0000b00b000c000c00b0000c000c0b00000c000c9000000c0c0b0000000c0c300c00000c0b000c00000c80000c00c00b00000c00c0b000000c00c7000000cc00a0000000", "dd20d00000000d900d00000d00c000d00000d0c0000d00000d900000d00d00c000000d00d0c0000000d00d7000000d0d00c0000000d0d0c00000000d0d300d000000d0c000d000000d90000d000d00c00000d000d0c000000d000d300d0000d000c000d0000d00c0000d0000d0c00000d0000d8000000dd000b0000000dd0c000000000"],
    // 4 ball
    ["", "", "", "", "4", "55550", "666160661640", "777170077307707170770607077400", "8881800088508008840088081800880181808800708088070080885000", "9994000909919000909509009908009009950009909190009908090009950090909190090908090090920990090800990096000999080000", "aaa1a00000aa70a0000aa400a7000aa0a090000aa0a20a000aa0900a000aa6000a0a0a1a000a0a090a000a0a400aa00a09000aa00a20a00aa00900a00aa09000a00aa300a0a00a1a0090a00a0a0900a00a0a6000a0aa090000a0aa700000"],
    // 5 ball
    ["", "", "", "", "", "5", "666660", "777717077717707740", "858880807088807800888308808818088086080888400", "9999300909991900909940909909190909908090909920990909700990991900990970900999190900993099900970099909300999908000"],
    // 6 ball
    ["", "", "", "", "", "", "6", "7777770", "888881808888188088818850", "77799908919099990809099992099099919099099191999099050"],
    // 7 ball
    ["", "", "", "", "", "", "", "7", "88888880", "99999919099999199099991999099950", "aaaaaa1a00aaaaa1aa00aaaa40aaa0aaa1a0aaa0aa1aa0aaa0a80aa0aaaa1a0aa0aaa60a0aaaaa1a0a0aaaa1aa0a0aaa40aaaa0aa700"],
    // 8 ball
    ["", "", "", "", "", "", "", "", "8", "999999990", "aaaaaaa1a0aaaaaa1aa0aaaaa1aaa0aaaa1aaa60"],
    // 9 ball
    ["", "", "", "", "", "", "", "", "", "9", "aaaaaaaaa0", "bbbbbbbb1b0bbbbbbb1bb0bbbbbb1bbb0bbbbb1bbbb0bbbb60"],
];

// Hardcode rotations to make the common max height = balls + 2 look nicer
const rotations = [
    0,
    0,
    1,
    1.5,
    2.5,
    4.5,
    3,
    5.5,
    3.5,
];

function ssToInt(ss) {
    if ("0" <= ss && ss <= "9") {
        return parseInt(ss);
    } else {
        return ss.charCodeAt() - "a".charCodeAt() + 10;
    }
}

function ssToArr(ss) {
    if (ss == "0") {
        return [];
    } else if (ss.length == 1) {
        return [ssToInt(ss)];
    } else {
        th = [];
        for (const t of ss.slice(1, -1)) {
            th.push(ssToInt(t));
        }
        return th;
    }
}

function parseSS(ss) {
    let multiplex = false;
    let ssArr = []
    let t = ""
    for (const i of ss) {
        t += i
        if (i == '[') {
            multiplex = true;
        } else if (multiplex && i == ']') {
            multiplex = false;
            ssArr.push(ssToArr(t));
            t = "";
        } else if (!multiplex) {
            ssArr.push(ssToArr(t));
            t = "";
        }
    }
    return ssArr;
}

function validSS(ss) {
    const lands = ss.map(x => x.length);
    let test = ss.map(x => 0);
    for (let i = 0; i < ss.length; i++) {
        for (const t of ss[i]) {
            const land = (t + i) % ss.length;
            if (lands[land] == test[land]) {
                return false;
            }
            test[land]++;
        }
    }
    return true;
}

function getState(ss, maxMultiplex) {
    const maxHeight = Math.max(...(ss.map(x => Math.max(...x))));
    console.log(maxHeight);
    const period = ss.length;
    const repeats = Math.ceil(maxHeight / period);
    const state = Array(maxHeight).fill(0);
    for (let r = 0; r < repeats; r++) {
        for (let i = 0; i < period; i++) {
            for (const t of ss[i]) {
                const lands = r * period + i + t;
                if (lands >= repeats * period) {
                    state[lands - repeats * period]++;
                }
            }
        }
    }
    state.reverse();
    let stateInt = 0;
    for (const s of state) {
        stateInt *= maxMultiplex + 1;
        stateInt = stateInt + s;
    }
    return stateInt;
}

function ssCircleLayout(cy, balls, maxMultiplex, ss, startAngle, curve) {
    if (startAngle === undefined) {
        startAngle = 3 / 2 * Math.PI;
    }
    const order = {};
    let state = getState(ss, maxMultiplex);
    for (let i = 0; i < ss.length; i++) {
        order[state] = i;
        state = makeThrow(state, ss[i], maxMultiplex);
    }
    const mainCircle = cy.nodes().filter(node => order[node.data().id] !== undefined);
    mainCircle.layout({
        name: "circle",
        sort: (a, b) => order[a.data().id] - order[b.data().id],
        startAngle: startAngle,
    }).run();
    const extra = cy.nodes().filter(node => order[node.data().id] === undefined);
    if (extra.length > 0) {
        // Place extra nodes on the midpoint but further out on an outer circle
        const minConnection = {};
        const maxConnection = {};
        for (const node of extra) {
            let min = mainCircle.length;
            let max = 0;
            for (const neighbor of node.neighborhood()) {
                const place = order[neighbor.data().id];
                if (place !== undefined) {
                    min = Math.min(min, place);
                    max = Math.max(max, place);
                }
            }
            minConnection[node.data().id] = min;
            maxConnection[node.data().id] = max;
        }
        let sumX = 0;
        let sumY = 0;
        for (const node of mainCircle) {
            sumX += node.position().x;
            sumY += node.position().y;
        }
        const midX = sumX / mainCircle.length;
        const midY = sumY / mainCircle.length;
        const p = mainCircle[0].position();
        const radius = 100 + Math.sqrt((p.x - midX) * (p.x - midX) + (p.y - midY) * (p.y - midY));
        for (const node of extra) {
            const min = minConnection[node.data().id];
            const max = maxConnection[node.data().id];
            let mid = (max + min) / 2;
            if (max - min >= mainCircle.length / 2) {
                mid -= mainCircle.length / 2;
            }
            const angle = startAngle + mid * (2 * Math.PI) / mainCircle.length;
            const x = midX + radius * Math.cos(angle);
            const y = midY + radius * Math.sin(angle);
            node.position({
                x: x,
                y: y
            });
        }
        extra.layout({
            name: "preset"
        }).run();
        if (curve) {
            // Add curved adges between degree 2 extra nodes and the main circle
            extra.connectedEdges().style('curve-style', 'unbundled-bezier');
            extra.connectedEdges().style('control-point-distance', 100);
            extra.filter(edge => edge.connectedEdges().length > 2).connectedEdges().style('curve-style', 'bezier');
        }
        cy.fit();
    }
}

function applyLayout() {
    const balls = parseInt(document.getElementById('balls').value);
    const maxHeight = parseInt(document.getElementById('maxHeight').value);
    const maxMultiplex = parseInt(document.getElementById('maxMultiplex').value);
    const period = document.getElementById('period').value;
    const reduce = document.getElementById('reduceGraph').checked;
    const layout = document.getElementById('layout').value;
    document.getElementById('layoutss').style.visibility = layout == 'sscircle' ? 'visible' : 'hidden';
    const layoutSpec = {
        name: layout
    };
    // Reset edges to bezier
    cy.edges().style('curve-style', 'bezier');
    if (layout == "prime") {
        if (balls < longestPrimeSiteswap.length &&
            maxHeight < longestPrimeSiteswap[balls].length &&
            maxMultiplex == 1 &&
            !period && !reduce) {
            // Make a circle of the longest prime siteswap.
            const ss = parseSS(longestPrimeSiteswap[balls][maxHeight]);
            let startAngle = 3 / 2 * Math.PI;
            if (balls + 2 == maxHeight && balls < rotations.length) {
                startAngle = rotations[balls] * (2 * Math.PI) / ss.length - Math.PI / 2;
            }
            ssCircleLayout(cy, balls, maxMultiplex, ss, startAngle, true);
            return;
        } else {
            // Default to circle
            layoutSpec.name = "circle";
        }
    } else if (layout == "sscircle") {
        const ss = parseSS(document.getElementById('layoutss').value);
        ssCircleLayout(cy, balls, maxMultiplex, ss, false);
        return;
    } else if (layout == "breadthfirst") {
        layoutSpec.roots = [groundState(balls, maxMultiplex)];
    } else if (layout == "concentric1") {
        layoutSpec.name = "concentric";
        layoutSpec.minNodeSpacing = 100;
    } else if (layout == "concentric2") {
        layoutSpec.name = "concentric";
        layoutSpec.minNodeSpacing = 100;
        layoutSpec.concentric = node => maxHeight - node.data().label.length;
        layoutSpec.levelWidth = node => 1;
    } else if (layout == "cose") {
        layoutSpec.idealEdgeLength = 150;
    } else if (layout == "cose-bilkent") {
        layoutSpec.idealEdgeLength = 150;
    }
    cy.layout(layoutSpec).run();
}

var cy;

function generate() {
    cy = cytoscape({
        container: document.getElementById('cy'),
        elements: getElements(),
        style: GRAPH_STYLE,
    });
    cy.nodes().on('mouseout', updateFaded);
    cy.nodes().on('mouseover', evt => highlight(evt.target.closedNeighborhood()));
    cy.nodes().on('tap', toggleNode);
    applyLayout();
    resetClicked();
    updateHighlightSS();
    updateColors();
    document.getElementById('numNodes').innerText = cy.nodes().length;
    document.getElementById('numEdges').innerText = cy.edges().length;
};

// Colouring
const BLUE_MIN = [240, 30, 70];
const BLUE_MAX = [240, 80, 10];

function gradient(val, maxVal) {
    const ratio = val / maxVal;
    const HSL = [
        (1 - ratio) * BLUE_MIN[0] + ratio * BLUE_MAX[0],
        (1 - ratio) * BLUE_MIN[1] + ratio * BLUE_MAX[1],
        (1 - ratio) * BLUE_MIN[2] + ratio * BLUE_MAX[2],
    ];
    return `hsl(${HSL[0]}, ${HSL[1]}%, ${HSL[2]}%)`;
}

//const stateColors = ["#d19fa0","#c74a4c","#8db2f7","#98d4ab","#2753a3","#9bd1ac","#e6e6e6","#374e78","#a2f5bc","#c5d0e3"];

const stateColors = ['springgreen', 'skyblue', 'lightcoral', 'yellow', "#8db2f7", 'orange', 'lavender', "#2753a3", 'gray'];

function updateColors() {
    const balls = parseInt(document.getElementById('balls').value);
    const maxHeight = parseInt(document.getElementById('maxHeight').value);
    const maxMultiplex = parseInt(document.getElementById('maxMultiplex').value);
    const colorStates = document.getElementById('colorStates').checked;
    const reduce = document.getElementById('reduceGraph').checked;
    // Never colour throws when graph is reduced.
    const colorThrows = document.getElementById('colorThrows').checked && !reduce;
    cy.nodes().forEach(n => {
        const col = colorStates ? stateColors[n.data().label.length - Math.max(Math.ceil(balls / maxMultiplex), 1)] : 'springgreen';
        n.style('background-color', col);
    });
    cy.edges().forEach(e => {
        const t = e.data().label.toString().split('').reduce((a, b) => (isNaN(a) ? 0 : parseInt(a)) + (isNaN(b) ? 0 : parseInt(b)), 0);
        const col = colorThrows ? gradient(t, maxHeight * maxMultiplex) : 'darkblue';
        e.style('line-color', col);
        e.style('target-arrow-color', col);
    });
}

// Opacity filtering
function resetClicked() {
    cy.clicked = cy.collection();
    updateFaded();
}

function updateHighlightSS() {
    const ssEl = document.getElementById('highlightSS');
    const ss = ssEl.value;
    const ssMsg = document.getElementById('highlightSSMsg');
    cy.highlightSS = undefined;
    if (ss) {
        const show = {};
        const siteswap = [];
        let sum = 0;
        for (const th of parseSS(ss)) {
            siteswap.push(th);
            sum += th.reduce((a, b) => a + b, 0);
        }
        if (validSS(siteswap)) {
            const balls = sum / siteswap.length;
            const maxHeight = Math.max(...(siteswap.map(x => Math.max(...x))));
            const maxMultiplex = Math.max(...(siteswap.map(x => x.length)));
            const graphBalls = parseInt(document.getElementById('balls').value)
            const graphMaxHeight = parseInt(document.getElementById('maxHeight').value)
            const graphMaxMultiplex = parseInt(document.getElementById('maxMultiplex').value)
            const reduced = document.getElementById('reduceGraph').checked;
            if (balls != graphBalls) {
                ssMsg.innerHTML = 'Siteswap has the wrong number of balls';
            } else if (maxHeight > graphMaxHeight) {
                ssMsg.innerHTML = 'Siteswap has too high a max throw';
            } else if (maxMultiplex > graphMaxMultiplex) {
                ssMsg.innerHTML = 'Siteswap has too large a multiplex';
            } else {
                ssMsg.innerHTML = '';
                let state = getState(siteswap, graphMaxMultiplex);
                // If we're on the reduced graph, find a starting state that exists
                let offset = 0;
                if (reduced) {
                    while (offset < siteswap.length && isRemovableState(state, graphMaxHeight, graphMaxMultiplex)) {
                        state = makeThrow(state, siteswap[offset], graphMaxMultiplex);
                        offset++;
                    }
                }
                // prev tracks the previous state of the pattern which is in the (possibly reduced) graph.
                let prev = state;
                for (let i = 0; i < siteswap.length; i++) {
                    show[state] = true;
                    const next = makeThrow(state, siteswap[(offset + i) % siteswap.length], graphMaxMultiplex);
                    show[prev + 'to' + next] = true;
                    if (!reduced || !isRemovableState(next, graphMaxHeight, graphMaxMultiplex)) {
                        prev = next;
                    }
                    state = next;
                }
                cy.highlightSS = show;
            }
        } else {
            ssMsg.innerHTML = 'Invalid siteswap';
        }
    } else {
        ssMsg.innerHTML = '';
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
    if (cy.highlightSS !== undefined) {
        const eles = cy.elements().filter(el => cy.highlightSS[el.data().id] !== undefined);
        highlight(eles);
    } else {
        const faded = new Set();
        for (const fade of document.getElementById('faded').value.split(',')) {
            faded.add(fade);
        }
        const nodes = (cy.clicked.length == 0) ? cy.nodes() : cy.clicked;
        const invert = document.getElementById('invertFade').checked;
        const eles = nodes.union(nodes.edgesWith(nodes).filter(edge => invert == faded.has(edge.data().label)));
        highlight(eles);
    }
}

function highlight(eles) {
    eles.style('opacity', 1);
    cy.elements().subtract(eles).style('opacity', 0.1);
}

function getElements() {
    const balls = parseInt(document.getElementById('balls').value);
    const maxHeight = parseInt(document.getElementById('maxHeight').value);
    const maxMultiplex = parseInt(document.getElementById('maxMultiplex').value);
    const period = parseInt(document.getElementById('period').value);
    const maxSplit = parseInt(document.getElementById('maxSplit').value);
    const allowLess = document.getElementById('allowLess').checked;
    const reduce = document.getElementById('reduceGraph').checked;
    const adjList = makeGraph(balls, maxHeight, maxMultiplex, period, maxSplit, allowLess, reduce);
    const nodes = [];
    for (const state of adjList.keys()) {
        nodes.push({
            data: {
                id: state,
                label: stateName(state, maxMultiplex),
            }
        });
    }
    const edges = [];
    for (const from of adjList.keys()) {
        for (const edge of adjList.get(from)) {
            const th = edge[0];
            const to = edge[1];
            edges.push({
                data: {
                    id: from + 'to' + to,
                    label: th,
                    source: from,
                    target: to,
                }
            });
        }
    }
    return nodes.concat(edges);
}

window.onload = generate;

function pageRank() {
    const rank = cy.elements().pageRank().rank;
    const nodes = cy.nodes().map(n => [n.data().label, rank(n)]);
    nodes.sort((a, b) => b[1] - a[1]);
    nodes.forEach(n => console.log(n[0], n[1]));
}
