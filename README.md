# State Diagram Visualiser

This is a visualiser for juggling [state transition diagrams](https://en.wikipedia.org/wiki/Siteswap#State_diagrams), it shows the diagram for a given number of balls and maximum height. A live version can be seen [here](https://diagonalrewards.com/juggling/state-diagram-visualiser/visualiser.html).

## Graph generation options
The maximum height and number of balls define the graph which will be shown and provide limits on throws and possible states. The period can also be limitted (either to precisely a certain value or to a max value by 'allowing smaller periods.' Period limitation removes any throws/states which aren't in siteswaps of the given length and is particularly interesting for period 2 & 3, beyond that it doesn't significantly help readability and can become slow to compute.

The graph can be reduced similarly to [here](https://users.mai.liu.se/hanlu09/juggling/siteswap-states.pdf) which uses a smaller set of states and has sequences of throws on the edges instead of individual throws. This is done while still showing all possible siteswaps in the graph (and state with only one throw going into or out of it is removed and that throw is prepended/appended to all other throws connected to the state).

Note that when any of these numbers get too high your computer will crawl to a halt - up to height 11 should be easily fast enough on most computers, the graph is re-computed each time any of these values change. 

## Appearance

By default states are coloured by length (maximum height in the state) and throws are a gradient based on height. These can be disabled using the checkboxes.

### Fading

Hovering over a state will fade any states or throws not connected and clicking a state will select it - all unselected states and throws not between two selected states will be faded.

Individual throw heights can also be faded, e.g. typing '1,2,3,4' into 'Fade throws' will fade heights 1, 2, 3 and 4. Highlight siteswap allows everything not part of a given siteswap to be faded.

### Layout

Auto layout tries its best to lay things out nicely, this typically involves putting the longest prime siteswap around the outside and then positioning remaining states around that. This works well when there is a [complete](https://www.jonglage.net/theorie/notation/siteswap-avancee/refs/Jack%20Boyce%20-%20The%20Longest%20Prime%20Siteswap%20Patterns.pdf) prime siteswap and less well otherwise (e.g. 3 balls max height 6). Once the maximum height gets large enough this reverts back to a simple circular layout.

Other layout options include a customisable version of the prime siteswap variant where any given siteswap can be used instead of the longest prime siteswap ('SS circle') and 'Cose Bilkent' which is particularly useful when looking at only period 3 patterns as it captures the planarity well.
