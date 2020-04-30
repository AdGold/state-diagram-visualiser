from collections import defaultdict
import argparse

parser = argparse.ArgumentParser(description='Generate state transition diagrams')
parser.add_argument('--balls', '-b', required=True, type=int, help='Number of balls.')
parser.add_argument('--max-height', '-m', default=-1, type=int, help='Max height, default balls + 2.')
parser.add_argument('--colour-states', '-cs', action='store_true', help='Colour states according to highest throw.')
parser.add_argument('--colour-throws', '-ct', action='store_true', help='Colour throws according to throw height.')
args = parser.parse_args()
if args.max_height == -1:
    args.max_height = args.balls + 2
more_colours = ['darkgreen', 'yellow', 'blue', 'orange', 'red', 'purple', 'gray']

def make_throw(state, throw):
    if state & 1 == 0:
        if throw == 0:
            return state >> 1
        return None
    elif throw == 0:
        return None
    else:
        s = state >> 1
        new_throw = (1 << (throw-1))
        if s & new_throw:
            return None
        else:
            return s | new_throw


def make_graph(balls, max_height):
    edges = defaultdict(list)
    ground_state = (1 << balls) - 1;
    done = {ground_state}
    todo = [ground_state]

    while todo:
        state = todo.pop()
        for th in range(max_height+1):
            to_state = make_throw(state, th)
            if to_state is not None:
                edges[state].append((th, to_state))
                if to_state not in done:
                    todo.append(to_state)
                    done.add(to_state)

    return edges

def state_name(state, max_height):
    return bin(state)[2:][::-1]
    # return bin(state)[2:].zfill(max_height)[::-1]

def excitation(state):
    s = state_name(state, -1)
    balls = s.count('1')
    ex = sum(i * int(x) for i, x in enumerate(s)) - balls * (balls - 1) // 2
    return ex

def get_state_rank(state):
    # return excitation(state)
    return len(state_name(state, -1))

def gradient(val, max_val):
    min_hsv = (240/360, 0.2, 0.8)
    max_hsv = (220/360, 0.9, 0.2)
    diff_hsv = tuple(ma-mi for ma, mi in zip(max_hsv, min_hsv))
    ratio = val / max_val
    h, s, v = [mi + diff * ratio for mi, diff in zip(min_hsv, diff_hsv)]
    return f'{h:.2f},{s:.2f},{v:.2f}'

def make_dot_graph(edges, balls, max_height):
    ground_state = (1 << balls) - 1;
    nodes = {}
    for state in edges.keys():
        name = state_name(state, max_height)
        if args.colour_states:
            fill = more_colours[len(name) - balls]
        else:
            fill = 'gray' if state == ground_state else 'white'
        nodes[state] = f'x{name} [fillcolor="{fill}" style="filled" label="{name}" shape="box"]\n'
    dot_nodes = ''
    rank = defaultdict(list)
    for state in nodes:
        rank[get_state_rank(state)].append(state)
    for r in sorted(rank):
        # dot_nodes += '{rank = same;\n'
        for state in sorted(rank[r], key=excitation):
            dot_nodes += nodes[state]
        # dot_nodes += ' -> '.join('x'+state_name(s, -1) for s in sorted(rank[r])) + '[color=invis]'
        # dot_nodes += '}\n'
    dot_edges = ''
    for state, es in edges.items():
        from_id = 'x' + state_name(state, max_height)
        for throw, to_state in es:
            to_id = 'x' + state_name(to_state, max_height)
            col = gradient(throw, max_height) if args.colour_throws else 'black'
            dot_edges += f'{from_id} -> {to_id} [labelfloat="false" label="{throw}" color="{col}" fontcolor="{col}" weight="0.1"]\n'
    return f'''
digraph {{
{dot_nodes}
{dot_edges}
}}'''

edges = make_graph(args.balls, args.max_height)
dot = make_dot_graph(edges, args.balls, args.max_height)
print(dot)
