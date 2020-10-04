State Diagram Visualiser
---

This is a visualiser for juggling state transition diagrams, it shows the diagram for a given number of balls and maximum height (optionally also limitting the period). Note that when any of these numbers get too high your computer will crawl to a halt- up to height 11 should be easily fast enough on most computers. The graph can be reduced similarly to [here](https://users.mai.liu.se/hanlu09/juggling/siteswap-states.pdf) which uses a smaller set of nodes and has sequences of throws on the edges instead.

By default states are coloured by length (maximum throw in the state) and throws are a gradient based on height. These can be disabled using the checkboxes.

Hovering over a state will fade any states or throws not connected and clicking a state will select it - all unselected states and throws not between two selected states will be faded. Individual throw heights can also be faded, e.g. typing '1,2,3,4' into 'Fade throws' will fade heights 1, 2, 3 and 4. Highlight siteswap allows everything not part of a siteswap to be faded.

Auto layout tries its best to lay things out nicely, this typically involves putting the longest prime siteswap around the outside and then positioning remaining states around that. This works well when there is a [complete](https://www.jonglage.net/theorie/notation/siteswap-avancee/refs/Jack%20Boyce%20-%20The%20Longest%20Prime%20Siteswap%20Patterns.pdf) prime siteswap and less well otherwise (e.g. 3 balls max height 6). Other layout options include a customisable version of this where any given siteswap can be used instead of the longest prime siteswap ('SS circle') and 'Cose Bilkent' which is particularly useful when looking at only period 3 patterns.
