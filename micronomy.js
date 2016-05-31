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

  let messages = [];

  const _nodeSizeCalculator = (d, i, ..._other) => {
    return floor(width, height)/(nodes.length<0?8:nodes.length*5);
  };

  const _edgeLength = (_e) => {
    return 24;
    //return _nodeSizeCalculator()*3;
  };

  const _messageSize = (_m) => {
    return 10;
  };

  let force = d3.layout.force()
    .size([width/2, height/2])
    .nodes(nodes)
    .links(links)
    .linkDistance(_edgeLength);

  let [link, node] = [svg.selectAll('.link'), svg.selectAll('.node')];

  let _start = () => {
    node = node.data(force.nodes());
    node.enter().append('circle')
      .attr('class', 'node')
      .attr('r', _nodeSizeCalculator)
      .style(style.node)
      .call(force.drag);
    node.exit().remove();

    link = link.data(force.links());
    link.enter().append('line')
      .attr('class', 'edge')
      .style(style.link);
    link.exit().remove();

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
      .attr('r', _nodeSizeCalculator)
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
  });

  force.start();

  return({
    wideView: true,
    update: () => {
      _sync(
        _nodeMapGetter,
        model, 'manifest', ['id', 'capital'],
        _basicExtractor,
        _nodeAdder, _nodeRemover,
        _syncNodes
      );

      _sync(
        _linksMapGetter,
        model, 'network', ['id', 'parent', 'child'],
        _linkExtractor,
        _linkAdder, _linkRemover,
        _syncLinks
      );

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

let [links, linksMap] = [ [], new Map() ];
let [nodes, nodesMap] = [ [], new Map() ];

let _nodeMapGetter = () => nodesMap;
let _linksMapGetter = () => linksMap;

let _isInViz = (idx, getVizMap) => getVizMap().has(idx);

let _basicExtractor = (model, props) => {
  return props.reduce((acc, val, i, arr) => {
    acc[val] = model[val]; return acc;
  }, {});
};

let _linkExtractor = (model, props) => {
  let result = _basicExtractor(model, props);
  result.id = `${model.parent.id}-${model.child.id}`;
  result.source = nodes.findIndex((el, idx, _) => el.id == model.parent.id);
  result.target = nodes.findIndex((el, idx, _) => el.id == model.child.id);
  return result;
};

let _nodeAdder = (props) => nodes.push(props);
let _linkAdder = (props) => links.push(props);

// TODO: Figure out if I can use generators to simplify this
let _nodeRemover = (id) => {
  let removable = nodes.findIndex((el, idx, arr) => el.id == id);
  if(removable > -1) { nodes.splice(removable, 1); }
};
let _linkRemover = (id) => {
  let removable = links.findIndex((el, idx, arr) => (el.id == id));
  if(removable > -1) { nodes.splice(removable, 1); }
};

// TODO: remove `model` from `_addToViz` & `removeFromViz`
let _addToViz = (model, props, extract, add) => add(extract(model, props));
let _removeFromViz = (model, props, extract, remove) => {
  remove(extract(model, props).id.value);
};

// TODO: figure out a computationally less expensive way to sync links + nodes
let _syncNodes = (present) => {
  nodesMap.clear();
  present.forEach((val, key) => {
    //console.log("syncing node", key, "with", val);
    nodesMap.set(key, val);
  });
};

let _syncLinks = (present) => { // syncing the linksMap to the present values
  linksMap.clear();
  present.forEach((val, key) => {
    linksMap.set(key, val);
  });
};

// TODO: return newIdxs and voidIdxs and do housekeeping elsewhere?
const _sync = (past, model, name, props, extract, add, remove, sync) => {
  let current = new Map();
  let [newIdxs, voidIdxs] = [ [], [] ];

  model.vars.get(name).forEach((item, idx) => {
    item.match({
      Empty: undefined,
      Existing: details => {
        current.set(idx, details);
        if(!_isInViz(idx, past)) {
          newIdxs.push(idx);
          return _addToViz(details, props, extract, add);
        }
      },
    });
  });

  [...past()].filter(([idx, details]) => {
    if(current.has(idx)) { return false; }
    voidIdxs.push(idx);
    _removeFromViz(details, props, extract, remove);
    return true;
  });

  // TODO: do whatever else you need with newIdxs and voidIdxs
  sync(current);

  return [newIdxs, voidIdxs];
};

module.exports = View;
