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

function makeGraph(balls, maxHeight, period, allowLess) {
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
                edges.get(state).push([th, toState]);
                if (!done.has(toState)) {
                    todo.push(toState);
                    done.add(toState);
                }
            }
        }
    }
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
    return edges;
}

function stateName(state) {
    return state.toString(2).split("").reverse().join("");
}

