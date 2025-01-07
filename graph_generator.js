function makeThrow(state, th, maxMultiplex) {
    // throws are arrays of integers
    // an empty array is a 0

    // check if the throw size matches the available number of balls
    // also deals with 0s
    if (state % (maxMultiplex + 1) != th.length) {
        return undefined;
    }
    // make each throw in the multiplex in succession
    for (const t of th) {
        const newThrow = (maxMultiplex + 1) ** t;
        //check if landing site is full
        if (state % ((maxMultiplex + 1) * newThrow) > (maxMultiplex) * newThrow) {
            return undefined;
        }
        state += newThrow - 1;
    }
    // only shift the state at the end
    return (state / (maxMultiplex + 1)) | 0;
}

function arrToSS(n) {
    if (n.length == 0) {
        return "0";
    } else {
        let s = ""
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
        // only check from the last throw as multiplexes aren't order sensitive
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

function groundState(balls, maxMultiplex) {
    // starting state of all maxMultiplex, taking off from the end to make the right number of balls
    // since this is always present in the graph, unlike all 1s
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

function isRemovableState(state, maxHeight, maxMultiplex) {
    //if leading 0 or trailing maxMultiplex
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
                // create edges with a sequence of throws
                newEdges.push([th + newEdge[0], newEdge[1]]);
            }
        }
        return newEdges;
    } else {
        return [
            [th, to]
        ];
    }
}

function makeGraph(balls, maxHeight, maxMultiplex, period, maxSplit, allowLess, reduce, skipThrows) {
    // edges are of the form [throw, target state]
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
            // if (!(state & 1) || (state & (1 << (maxHeight-1)))) {
            if (isRemovableState(state, maxHeight, maxMultiplex)) {
                remove.add(state);
                continue;
            }
            const extraEdges = [];
            for (const edge of edges.get(state)) {
                if (isRemovableState(edge[1], maxHeight, maxMultiplex)) {
                    // if (edge[0] == maxHeight || !(edge[1] & 1)) {
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

function stateName(state, maxMultiplex) {
    // states are in base maxMultiplex+1
    return state.toString(maxMultiplex + 1).split("").reverse().join("");
}
