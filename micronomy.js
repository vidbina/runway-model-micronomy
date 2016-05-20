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

  let model = module.env;

  let links = [];
  let messages = [];

  const _nodeSize = (_n) => {
    return 12;
    //return floor(width, height)/(nodes.length<0?10:nodes.length*5);
  };

  const _edgeLength = (_e) => {
    console.log(_e);
    return 24;
    //return _nodeSize()*3;
  };

  const _messageSize = (_m) => {
    return 10;
  };

  let force = d3.layout.force()
    .size([width/2, height/2])
    .nodes(nodes)
    .links(links)
    .linkDistance(_edgeLength);

  let link = svg.selectAll('.link')
    .data(links)
    .enter().append('line')
    .attr('class', 'edge')
    .style(style.link);

  let node = svg.selectAll('.node');

  let _start = () => {
    console.log('nodes', force.nodes());
    node = node.data(force.nodes());
    node.enter().append('circle')
      .attr('class', 'node')
      .attr('r', _nodeSize)
      .style(style.node)
      .call(force.drag);
    force.start();
  };

  let message = svg.selectAll('.messages')
    .data(messages)
    .enter().append('circle')
    .attr('r', _messageSize)
    .style(style.message);

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
          if(messages[d.id].progress >= 1) { messages[d.id].dir = false; }
          messages[d.id].progress = messages[d.id].progress+0.1;
        } else {
          if(messages[d.id].progress <= 0) {
            messages[d.id].dir = true;
            messages[d.id].col = d3.rgb(Math.random()*255, Math.random()*255, Math.random()*255).toString();
          }
          messages[d.id].progress = messages[d.id].progress-0.1;
        }
        let _l = link.data()[d.link];
        let _x = _l.source.x + (_l.target.x - _l.source.x)*d.progress;
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
      _syncNodes(model, 'parties', ['id', 'capital']);
      console.log('nodes', nodes);
      _start();
    }
  });
};

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

let nodes = [];
let nodesMap = new Map();
let _isResourceInVizMap = (idx, map) => {
  return map.has(idx);
};

let _basicExtractor = (model, props) => {
  return props.reduce((acc, val, i, arr) => {
    acc[val] = model[val]; return acc;
  }, {});
};

let _basicAdder = (props) => {
  nodes.push(props);
};

let _addModelResourceToViz = (model, props, extract, add) => {
  nodesMap.set(model.id, extract(model, props));
  add(props);
};

const _syncNodes = (model, name, props) => {
  return model.vars.get(name).toJSON().map(item => {
    let [idx, model] = item;
    if(!_isResourceInVizMap(model.id, nodesMap)) {
      _addModelResourceToViz(model, props, _basicExtractor, _basicAdder);
    }
  });
};

module.exports = View;
