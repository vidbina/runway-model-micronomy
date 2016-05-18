'use strict';

let d3 = require('d3');

let View = function(controller, svg, module) {
  let [width, height] = [200, 200];

  svg = d3.select('svg')
    .attr('preserveAspectRatio', 'xMinYMin meet')
    .attr('width', width)
    .attr('height', height)
    .style({
      'border': '1px solid black',
    })
    .classed('micronomy', true);

  svg.append('g').attr('id', 'experiment');

  let actors = [
    new DummyActor('#experiment'),
    new DummyActor('#experiment'),
  ];

  let nodes = [{}, {}, {}, {}, {}, {}, {}, {}];
  let links = [
    {source: 0, target: 1},
    {source: 1, target: 2},
    {source: 0, target: 3},
    {source: 0, target: 4},
    {source: 5, target: 4},
    {source: 6, target: 4},
  ];

  let messages = [
    {link: 0, progress: 0.5},
  ];

  let node_size = floor(width, height)/(nodes.length*5);
  let edge_size = node_size*3;

  let force = d3.layout.force()
    .size([width/2, height/2])
    .nodes(nodes)
    .links(links)
    .linkDistance(edge_size);

  let link = svg.selectAll('.link')
    .data(links)
    .enter().append('line')
    .attr('class', 'edge')
    .style({
      'stroke': 'black',
      'stroke-width': '1px',
    });

  let node = svg.selectAll('.node')
    .data(nodes)
    .enter().append('circle')
    .attr('class', 'node')
    .attr('r', node_size)
    .style({
      'fill': '#ccc',
      'stroke': '#fff',
      'stroke-width': '1px',
    })
    .call(force.drag);

  let message = svg.selectAll('.messages')
    .data(messages)
    .enter().append('circle')
    .attr('r', node_size*2/3)
    .style({
      'fill': '#5ac8fa',
    });

  /*
  console.log("link", link);
  console.log("data", link.data());
  for(var x in link.data()) { console.log("x", x); };
  console.log("data[0]", link.data());
  console.log("data", link.data());
  console.log("datum", link.datum());
  console.log(messages[0], link, node)
  */

  force.on('tick', () => {
    node
      .attr('cx', function(d) { return d.x; })
      .attr('cy', function(d) { return d.y; });

    link
      .attr('x1', function(d) { return d.source.x; })
      .attr('y1', function(d) { return d.source.y; })
      .attr('x2', function(d) { return d.target.x; })
      .attr('y2', function(d) { return d.target.y; });

    message
      .attr('cx', function(d) {
        let _l = link.data()[d.link];
        let _x = _l.source.x + (_l.target.x - _l.source.x)*d.progress
        return(_x);
      })
      .attr('cy', function(d) {
        let _l = link.data()[d.link];
        let _y = _l.source.y + (_l.target.y - _l.source.y)*d.progress;
        return(_y);
      });
    console.log('.');
  });

  force.start();

  return({
    wideView: true,
    update: () => {
      for(var actor of actors) {
        actor.update();
      }
    }
  });
};

// Actors should append an item to the container identified by `groupID` and
// update this element during the update call.
class Actor {
  constructor(groupID) {
    this._uuid = `uuid${uuid()}`;
  }

  get uuid() {
    return this._uuid;
  }

  get node() {
    return d3.select(`#${this.uuid}`).node();
  }
}

class DummyActor extends Actor {
  constructor(groupID) {
    super(groupID);
    this.r = 1;
    this.expand = true;

    // NOTE: Somehow rect here is inaccurate but a resize call is made right
    // after initialization
    let node = d3.select(groupID)
      .append('circle')
        .attr('id', this.uuid)
        .attr('r', this.r)
  }

  update() {
    if(this.r > 100) { this.expand = false; }
    if(this.r < 10) { this.expand = true; }

    if(this.expand) {
      this.r = this.r + 1;
    } else {
      this.r = this.r - 1;
    }

    let svg = d3.select('svg');
    const rect = svg.node().viewBox.baseVal;

    d3.select('#experiment').select('circle')
      .attr('r', this.r);
      //.attr('cx', rect.width/2)
      //.attr('cy', rect.height/2);
  }
}

// Helpers
const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    function(c) {
      var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;return v.toString(16);
    }
  );
};

const floor = (a, b) => {
  if(a < b) {
    return a;
  }
  return b;
};

module.exports = View;
