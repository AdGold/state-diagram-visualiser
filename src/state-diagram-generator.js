/**
 * state-diagram-generator.js
 * ES module for generating state diagram graphs for juggling siteswaps.
 *
 * A state diagram represents all possible juggling states for a given number
 * of balls and maximum throw height. Nodes are states (represented as base-n
 * numbers where n = maxMultiplex + 1), and edges are throws.
 */

import { VanillaSiteswap } from 'universal-siteswap';

// ==================== Base-n Conversion for State Graph ====================

/**
 * Convert an array of throw heights to siteswap notation.
 * Empty array -> "0", single value -> digit/letter, multiple -> "[...]"
 */
export function arrToSS(n) {
    if (n.length === 0) {
        return '0';
    }
    let s = '';
    for (const t of n) {
        if (t < 10) {
            s += t.toString();
        } else if (t < 36) {
            s += String.fromCharCode(t - 10 + 97);
        } else {
            s += '{' + t.toString() + '}';
        }
    }
    return n.length > 1 ? '[' + s + ']' : s;
}

// ==================== State Calculations ====================

/**
 * Calculate the ground state for a given number of balls and multiplex limit.
 * The ground state is the "default" juggling state with balls in the lowest positions.
 *
 * States are represented as integers in base (maxMultiplex + 1), where each "digit"
 * represents how many balls land at that time.
 */
export function groundState(balls, maxMultiplex) {
    const base = maxMultiplex + 1;
    const slots = Math.ceil(balls / maxMultiplex);
    const remainder = ((-balls % maxMultiplex) + maxMultiplex) % maxMultiplex;
    return Math.pow(base, slots - 1) * (base - remainder) - 1;
}

/**
 * Convert a VanillaState array to the integer representation used by the graph.
 * The state array [1, 1, 1] becomes 7 in base 2 (for maxMultiplex=1).
 */
function stateArrayToInt(stateArr, maxMultiplex) {
    return stateArr.reduceRight((acc, s) => acc * (maxMultiplex + 1) + s, 0);
}

/**
 * Get the state (as an integer) that a siteswap starts/ends in.
 * Uses VanillaSiteswap to compute the state, then converts to integer.
 *
 * @param {number[][]} ss - Parsed siteswap (array of throw arrays)
 * @param {number} maxMultiplex - Maximum multiplex size
 * @returns {number} State as an integer
 */
export function getState(ss, maxMultiplex) {
    const siteswap = new VanillaSiteswap(ss);
    return stateArrayToInt(siteswap.state.state, maxMultiplex);
}

/**
 * Convert a state integer to a human-readable name (reversed base-n string).
 */
export function stateName(state, maxMultiplex) {
    return state.toString(maxMultiplex + 1).split('').reverse().join('');
}

/**
 * Check if a state can be removed during graph reduction.
 * A state is removable if it has no balls landing or if it's beyond the normal range.
 */
export function isRemovableState(state, maxHeight, maxMultiplex) {
    const base = maxMultiplex + 1;
    return (state % base === 0) || (state >= maxMultiplex * Math.pow(base, maxHeight - 1));
}

// ==================== Throw Mechanics ====================

/**
 * Apply a throw to a state and return the resulting state.
 * Returns undefined if the throw is invalid (wrong number of balls or collision).
 *
 * @param {number} state - Current state as an integer
 * @param {number[]} th - Array of throw heights (multiplex)
 * @param {number} maxMultiplex - Maximum multiplex size
 * @returns {number|undefined} - New state or undefined if invalid
 */
export function makeThrow(state, th, maxMultiplex) {
    const base = maxMultiplex + 1;

    // Check if throw size matches available balls
    if (state % base !== th.length) {
        return undefined;
    }

    // Apply each throw in the multiplex
    for (const t of th) {
        const newThrow = Math.pow(base, t);
        // Check if landing site is full
        if (state % (base * newThrow) > maxMultiplex * newThrow) {
            return undefined;
        }
        state += newThrow - 1;
    }

    // Shift state (time advances)
    return Math.floor(state / base);
}

/**
 * Generator that yields all valid throw combinations.
 */
function* throwRange(depth, maxHeight, maxSplit, th, skipThrows) {
    if (depth <= 0) {
        yield th;
    } else {
        const start = th.length === 0 ? 1 : th[0];
        for (let i = start; i <= maxHeight; i++) {
            if (skipThrows && skipThrows.has(i)) {
                continue;
            }
            th.unshift(i);
            yield* throwRange(depth - 1, maxHeight, maxSplit, th);
            th.shift();
        }
    }
}

// ==================== Graph Generation ====================

/**
 * Check if a state has a path of exactly 'length' steps back to 'to'.
 */
function hasPathOfLength(length, state, to, edges, allowLess) {
    if (length === 0) {
        return to === state;
    }
    const stateEdges = edges.get(state);
    if (!stateEdges) return false;

    for (const edge of stateEdges) {
        const edgeTo = edge[1];
        if (allowLess && to === edgeTo) {
            return true;
        }
        if (hasPathOfLength(length - 1, edgeTo, to, edges, allowLess)) {
            return true;
        }
    }
    return false;
}

/**
 * Check if a multiplex throw has a split greater than the allowed maximum.
 */
function throwHasSplitGreater(split, th) {
    for (let i = 1; i < th.length - 2; i++) {
        if (parseInt(th[i]) > parseInt(th[i + 1]) + split) {
            return true;
        }
    }
    return false;
}

/**
 * Get new edges when reducing the graph (collapsing removable states).
 */
function getNewEdges(edges, state, th, to, maxHeight, maxMultiplex) {
    if (isRemovableState(to, maxHeight, maxMultiplex)) {
        const newEdges = [];
        const toEdges = edges.get(to);
        if (toEdges) {
            for (const edge of toEdges) {
                for (const newEdge of getNewEdges(edges, to, edge[0], edge[1], maxHeight, maxMultiplex)) {
                    newEdges.push([th + newEdge[0], newEdge[1]]);
                }
            }
        }
        return newEdges;
    }
    return [[th, to]];
}

/**
 * Generate the complete state diagram graph.
 *
 * @param {number} balls - Number of balls
 * @param {number} maxHeight - Maximum throw height
 * @param {number} maxMultiplex - Maximum multiplex size
 * @param {number} period - Period limit (0 = no limit)
 * @param {number} maxSplit - Maximum multiplex split
 * @param {boolean} allowLess - Allow period less than limit
 * @param {boolean} reduce - Reduce graph by removing simple states
 * @param {Set} skipThrows - Set of throw heights to skip
 * @returns {Map} - Adjacency list (state -> [[throw, toState], ...])
 */
export function makeGraph(balls, maxHeight, maxMultiplex, period, maxSplit, allowLess, reduce, skipThrows) {
    const edges = new Map();
    const todo = [groundState(balls, maxMultiplex)];
    const done = new Set(todo);

    // Build graph via BFS from ground state
    while (todo.length > 0) {
        const state = todo.pop();
        const th = [];
        for (const t of throwRange(state % (maxMultiplex + 1), maxHeight, maxSplit, th, skipThrows)) {
            const toState = makeThrow(state, t, maxMultiplex);
            if (toState !== undefined) {
                if (!edges.has(state)) {
                    edges.set(state, []);
                }
                edges.get(state).push([arrToSS(t), toState]);
                if (!done.has(toState)) {
                    todo.push(toState);
                    done.add(toState);
                }
            }
        }
    }

    // Period limitation: remove states without cycles of the required period
    if (period) {
        const remove = new Set();
        for (const state of edges.keys()) {
            if (!hasPathOfLength(period, state, state, edges, allowLess)) {
                remove.add(state);
            }
        }
        for (const rem of remove) {
            edges.delete(rem);
        }
        for (const state of edges.keys()) {
            edges.set(state, edges.get(state).filter(x => !remove.has(x[1])));
        }
    }

    // Multiplex split reduction
    if (!isNaN(maxSplit)) {
        for (const state of edges.keys()) {
            edges.set(state, edges.get(state).filter(x => !throwHasSplitGreater(maxSplit, x[0])));
        }
        for (const state of edges.keys()) {
            if (edges.get(state).length === 0) {
                edges.delete(state);
            }
        }
    }

    // Reduce graph by collapsing removable states
    if (reduce) {
        const remove = new Set();
        for (const state of edges.keys()) {
            if (isRemovableState(state, maxHeight, maxMultiplex)) {
                remove.add(state);
                continue;
            }
            const extraEdges = [];
            for (const edge of edges.get(state)) {
                if (isRemovableState(edge[1], maxHeight, maxMultiplex)) {
                    extraEdges.push(...getNewEdges(edges, state, edge[0], edge[1], maxHeight, maxMultiplex));
                }
            }
            edges.get(state).push(...extraEdges);
        }
        for (const rem of remove) {
            edges.delete(rem);
        }
        for (const state of edges.keys()) {
            edges.set(state, edges.get(state).filter(x => !remove.has(x[1])));
        }

        // Merge multi-edges (combine parallel edges between same states)
        for (const state of edges.keys()) {
            const merged = new Map();
            for (const edge of edges.get(state)) {
                const [th, to] = edge;
                if (!merged.has(to)) {
                    merged.set(to, th);
                } else {
                    merged.set(to, merged.get(to) + ',' + th);
                }
            }
            edges.set(state, Array.from(merged.entries()).map(([to, th]) => [th, to]));
        }
    }

    return edges;
}

// ==================== Cytoscape Conversion ====================

/**
 * Convert an adjacency list to Cytoscape.js elements format.
 */
export function graphToElements(adjList, maxMultiplex) {
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
            const [th, to] = edge;
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

// ==================== Layout Helpers ====================

/**
 * Pre-computed longest prime siteswaps for each (balls, maxHeight) combination.
 * Used for automatic circular layout.
 */
export const longestPrimeSiteswap = [
    // 0 balls
    [],
    // 1 ball
    ['', '1', '20', '300', '4000', '50000', '600000', '7000000', '80000000', '900000000', 'a000000000'],
    // 2 balls
    ['', '', '2', '330', '4130', '52050400', '620500605000', '730070060007060000', '830070008007000080700000', '94000900080000900800000908000000', 'a400090000a000900000a009000000a090000000', 'b50000b0000a00000b000a000000b00a0000000b0a00000000', 'c50000b00000c0000b000000c000b0000000c00b00000000c0b000000000'],
    // 3 balls
    ['', '', '', '3', '4440', '55150530', '661600640606130', '773007071700706070074007706000', '8818000086080008600800820808007008080700080860000', '99500009091900009080900009700900091900900080800900908000900960000990800000', 'aa300a0000a6000a0a0090000a0a0900000a0a4000a00a090000a00a20a000a00900a000a09000a000a60000aa00900000aa09000000', 'bb1b0000000b70b0000b00a00b0000b0a000b0000b70000b0b00a00000b0b0a000000b0b50000b00b0a00000b00b300b000b00a000b000b0a0000b000b50000bb000a00000bb009000000', 'cc1c00000000c90c000000c0b00c000000c9000c0000c0b0000c0000c20c000c0000b00b000c000c00b0000c000c0b00000c000c9000000c0c0b0000000c0c300c00000c0b000c00000c80000c00c00b00000c00c0b000000c00c7000000cc00a0000000', 'dd20d00000000d900d00000d00c000d00000d0c0000d00000d900000d00d00c000000d00d0c0000000d00d7000000d0d00c0000000d0d0c00000000d0d300d000000d0c000d000000d90000d000d00c00000d000d0c000000d000d300d0000d000c000d0000d00c0000d0000d0c00000d0000d8000000dd000b0000000dd0c000000000'],
    // 4 balls
    ['', '', '', '', '4', '55550', '666160661640', '777170077307707170770607077400', '8881800088508008840088081800880181808800708088070080885000', '9994000909919000909509009908009009950009909190009908090009950090909190090908090090920990090800990096000999080000', 'aaa1a00000aa70a0000aa400a7000aa0a090000aa0a20a000aa0900a000aa6000a0a0a1a000a0a090a000a0a400aa00a09000aa00a20a00aa00900a00aa09000a00aa300a0a00a1a0090a00a0a0900a00a0a6000a0aa090000a0aa700000'],
    // 5 balls
    ['', '', '', '', '', '5', '666660', '777717077717707740', '858880807088807800888308808818088086080888400', '9999300909991900909940909909190909908090909920990909700990991900990970900999190900993099900970099909300999908000'],
    // 6 balls
    ['', '', '', '', '', '', '6', '7777770', '888881808888188088818850', '77799908919099990809099992099099919099099191999099050'],
    // 7 balls
    ['', '', '', '', '', '', '', '7', '88888880', '99999919099999199099991999099950', 'aaaaaa1a00aaaaa1aa00aaaa40aaa0aaa1a0aaa0aa1aa0aaa0a80aa0aaaa1a0aa0aaa60a0aaaaa1a0a0aaaa1aa0a0aaa40aaaa0aa700'],
    // 8 balls
    ['', '', '', '', '', '', '', '', '8', '999999990', 'aaaaaaa1a0aaaaaa1aa0aaaaa1aaa0aaaa1aaa60'],
    // 9 balls
    ['', '', '', '', '', '', '', '', '', '9', 'aaaaaaaaa0', 'bbbbbbbb1b0bbbbbbb1bb0bbbbbb1bbb0bbbbb1bbbb0bbbb60'],
];

/**
 * Pre-computed rotation angles for nicer layout when maxHeight = balls + 2.
 */
export const rotations = [0, 0, 1, 1.5, 2.5, 4.5, 3, 5.5, 3.5];
