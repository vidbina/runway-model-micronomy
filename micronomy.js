'use strict';

let d3 = require('d3');

const style = {
  message: {
    fill: '#5ac8fa',
    opacity: 0.5,
    'pointer-events': 'none', // prevents messages from block clicks on nodes
  },
  node: {
    fill: '#ccc',
    stroke: '#000',
    'stroke-width': '1px'
  },
  link: {
    stroke: 'black',
    'stroke-width': '1px'
  }
};

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

  let model = module.env;
  let nodes = [{}, {}, {}, {}, {}, {}, {}, {}];
  console.log("   nodes", nodes);
  let simnodes = _nodes(model);
  console.log("simnodes", simnodes);
  let links = [
    {source: 0, target: 1},
    {source: 1, target: 2},
    {source: 0, target: 3},
    {source: 0, target: 4},
    {source: 5, target: 4},
    {source: 6, target: 4},
  ];

  let messages = [
    {id: 0, link: 0, progress: 0.5, dir: true, col: 0},
    {id: 1, link: 2, progress: 0, dir: true, col: 0},
    {id: 2, link: 4, progress: 0.5, dir: true, col: 0},
    {id: 3, link: 4, progress: 1, dir: true, col: 0},
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
    .style(style.link);

  let node = svg.selectAll('.node')
    .data(nodes)
    .enter().append('circle')
    .attr('class', 'node')
    .attr('r', node_size)
    .style(style.node)
    .call(force.drag);

  let message = svg.selectAll('.messages')
    .data(messages)
    .enter().append('circle')
    .attr('r', node_size*2/3)
    .style(style.message);

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
      .attr('cy', function(d) { return d.y; })
      .style('fill', function(d) { return d3.rgb(255-d.y*255/200, (d.x)*255/200, 255-d.x*255/200).toString(); });

    link
      .attr('x1', function(d) { return d.source.x; })
      .attr('y1', function(d) { return d.source.y; })
      .attr('x2', function(d) { return d.target.x; })
      .attr('y2', function(d) { return d.target.y; });

    message
      .attr('cx', function(d) {
        if (messages[d.id].dir == true) {
          if(messages[d.id].progress >= 1) { messages[d.id].dir = false }
          messages[d.id].progress = messages[d.id].progress+0.1
        } else {
          if(messages[d.id].progress <= 0) { 
            messages[d.id].dir = true;
            messages[d.id].col = d3.rgb(Math.random()*255, Math.random()*255, Math.random()*255).toString();
          }
          messages[d.id].progress = messages[d.id].progress-0.1
        }
        let _l = link.data()[d.link];
        let _x = _l.source.x + (_l.target.x - _l.source.x)*d.progress
        return(_x);
      })
      .attr('cy', function(d) {
        let _l = link.data()[d.link];
        let _y = _l.source.y + (_l.target.y - _l.source.y)*d.progress;
        return(_y);
      })
      .style('fill', function(d) {
        return d.col;
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

const _nodes = (model) => {
  return model.vars.get('parties').toJSON().map(x => {
    return {}; // id: x[0] };
  });
};

module.exports = View;
