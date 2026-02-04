/**
 * state-diagram-generator.js
 * ES module version of state diagram graph generation logic.
 */

export function makeThrow(state, th, maxMultiplex) {
    // throws are arrays of integers
    // an empty array is a 0

    // check if the throw size matches the available number of balls
    if (state % (maxMultiplex + 1) != th.length) {
        return undefined;
    }
    // make each throw in the multiplex in succession
    for (const t of th) {
        const newThrow = (maxMultiplex + 1) ** t;
        // check if landing site is full
        if (state % ((maxMultiplex + 1) * newThrow) > (maxMultiplex) * newThrow) {
            return undefined;
        }
        state += newThrow - 1;
    }
    // only shift the state at the end
    return (state / (maxMultiplex + 1)) | 0;
}

export function arrToSS(n) {
    if (n.length == 0) {
        return "0";
    } else {
        let s = "";
        for (const t of n) {
            if (t < 10) {
                s += t.toString();
            } else if (t < 36) {
                s += String.fromCharCode(t - 10 + 97);
            } else {
                s += ('{' + t.toString() + '}');
            }
        }
        if (n.length > 1) {
            s = "[" + s + "]";
        }
        return s;
    }
}

function* throwRange(depth, maxHeight, maxSplit, th, skipThrows) {
    if (depth <= 0) {
        yield th;
    } else {
        const start = (th.length == 0 ? 1 : th[0]);
        const end = maxHeight;
        for (let i = start; i <= end; i++) {
            if (skipThrows && skipThrows.has(i)) {
                continue;
            }
            th.unshift(i);
            yield* throwRange(depth - 1, maxHeight, maxSplit, th);
            th.shift();
        }
    }
}

export function groundState(balls, maxMultiplex) {
    return (maxMultiplex + 1) ** (Math.ceil(balls / maxMultiplex) - 1) * (maxMultiplex + 1 - ((-balls % maxMultiplex) + maxMultiplex) % maxMultiplex) - 1;
}

function hasPathOfLength(length, state, to, edges, allowLess) {
    if (length == 0) {
        return to == state;
    }
    for (const edge of edges.get(state)) {
        const edgeTo = edge[1];
        if (allowLess && to == edgeTo) {
            return true;
        }
        if (hasPathOfLength(length - 1, edgeTo, to, edges, allowLess)) {
            return true;
        }
    }
    return false;
}

export function isRemovableState(state, maxHeight, maxMultiplex) {
    return (state % (maxMultiplex + 1) == 0) || (state >= maxMultiplex * ((maxMultiplex + 1) ** (maxHeight - 1)));
}

function throwHasSplitGreater(split, th) {
    for (let i = 1; i < th.length - 2; i++) {
        if (parseInt(th[i]) > parseInt(th[i + 1]) + split) {
            return true;
        }
    }
    return false;
}

function getNewEdges(edges, state, th, to, maxHeight, maxMultiplex) {
    if (isRemovableState(to, maxHeight, maxMultiplex)) {
        const newEdges = [];
        for (const edge of edges.get(to)) {
            for (const newEdge of getNewEdges(edges, to, edge[0], edge[1], maxHeight, maxMultiplex)) {
                newEdges.push([th + newEdge[0], newEdge[1]]);
            }
        }
        return newEdges;
    } else {
        return [[th, to]];
    }
}

export function makeGraph(balls, maxHeight, maxMultiplex, period, maxSplit, allowLess, reduce, skipThrows) {
    const edges = new Map();
    const todo = [groundState(balls, maxMultiplex)];
    const done = new Set(todo);

    while (todo.length > 0) {
        const state = todo.pop();
        let th = [];
        for (const t of throwRange(state % (maxMultiplex + 1), maxHeight, maxSplit, th, skipThrows)) {
            const toState = makeThrow(state, t, maxMultiplex);
            if (toState != undefined) {
                if (!edges.get(state)) {
                    edges.set(state, []);
                }
                const thStr = arrToSS(t);
                edges.get(state).push([thStr, toState]);
                if (!done.has(toState)) {
                    todo.push(toState);
                    done.add(toState);
                }
            }
        }
    }

    // Period limitation reduction
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
            if (edges.get(state).length == 0) {
                edges.delete(state);
            }
        }
    }

    // Reduce graph by removing states with indegree or outdegree = 1
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
        // Merge multi-edges
        for (const state of edges.keys()) {
            const m = new Map();
            for (const edge of edges.get(state)) {
                const th = edge[0];
                const to = edge[1];
                if (!m.get(to)) {
                    m.set(to, th);
                } else {
                    m.set(to, m.get(to) + ',' + th);
                }
            }
            edges.set(state, []);
            for (const to of m.keys()) {
                edges.get(state).push([m.get(to), to]);
            }
        }
    }
    return edges;
}

export function stateName(state, maxMultiplex) {
    return state.toString(maxMultiplex + 1).split("").reverse().join("");
}

// Siteswap parsing utilities
export function ssToInt(ss) {
    if ("0" <= ss && ss <= "9") {
        return parseInt(ss);
    } else {
        return ss.charCodeAt() - "a".charCodeAt() + 10;
    }
}

export function ssToArr(ss) {
    if (ss == "0") {
        return [];
    } else if (ss.length == 1) {
        return [ssToInt(ss)];
    } else {
        const th = [];
        for (const t of ss.slice(1, -1)) {
            th.push(ssToInt(t));
        }
        return th;
    }
}

export function parseSS(ss) {
    let multiplex = false;
    let ssArr = [];
    let t = "";
    for (const i of ss) {
        t += i;
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

export function validSS(ss) {
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

export function getState(ss, maxMultiplex) {
    const maxHeight = Math.max(...(ss.map(x => Math.max(...x))));
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

// Convert graph to cytoscape elements
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

// Longest prime siteswaps for auto layout
export const longestPrimeSiteswap = [
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

// Rotations for nicer layout when max height = balls + 2
export const rotations = [0, 0, 1, 1.5, 2.5, 4.5, 3, 5.5, 3.5];
