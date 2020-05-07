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

function makeGraph(balls, maxHeight) {
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
    return edges;
}

function stateName(state) {
    return state.toString(2).split("").reverse().join("");
}

