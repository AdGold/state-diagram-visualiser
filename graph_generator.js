function makeThrow(state, th) {
    if ((state & 1) == 0) {
        return th == 0 ? state >> 1 : undefined;
    } else if (th == 0) {
        return undefined;
    } else {
        const s = state >> 1;
        const newThrow = (1 << (th - 1));
        return (s & newThrow) ? undefined : s | newThrow;
    }
}

function groundState(balls) {
    return (1 << balls) - 1;
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
        if (hasPathOfLength(length-1, edgeTo, to, edges, allowLess)) {
            return true;
        }
    }
    return false;
}

function isRemovableState(state, maxHeight) {
    return !(state & 1) || (state & (1 << (maxHeight-1)));
}

function getNewEdges(edges, state, th, to, maxHeight) {
    // if (th == maxHeight || !(to & 1)) {
    if (isRemovableState(to, maxHeight)) {
        const newEdges = [];
        for (const edge of edges.get(to)) {
            for (const newEdge of getNewEdges(edges, to, edge[0], edge[1], maxHeight)) {
                newEdges.push([th + newEdge[0], newEdge[1]]);
            }
        }
        return newEdges;
    } else {
        return [[th, to]];
    }
}

function makeGraph(balls, maxHeight, period, allowLess, reduce) {
    const edges = new Map();
    const todo = [groundState(balls)];
    const done = new Set(todo);

    while (todo.length > 0) {
        const state = todo.pop();
        for (let th = 0; th <= maxHeight; th++) {
            const toState = makeThrow(state, th);
            if (toState != undefined) {
                if (!edges.get(state)) {
                    edges.set(state, []);
                }
                edges.get(state).push([th.toString(), toState]);
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
    // Reduce graph by removing states with indegree or outdegree = 1
    if (reduce) {
        const remove = new Set();
        for (const state of edges.keys()) {
            // if (!(state & 1) || (state & (1 << (maxHeight-1)))) {
            if (isRemovableState(state, maxHeight)) {
                remove.add(state);
                continue;
            }
            const extraEdges = [];
            for (const edge of edges.get(state)) {
                if (isRemovableState(edge[1], maxHeight)) {
                // if (edge[0] == maxHeight || !(edge[1] & 1)) {
                    extraEdges.push(...getNewEdges(edges, state, edge[0], edge[1], maxHeight));
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
                    m.set(to, m.get(to)+','+th);
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

function stateName(state) {
    return state.toString(2).split("").reverse().join("");
}

