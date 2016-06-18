'use strict';

let d3 = require('d3');

const style = {
  message: {
    fill: '#5ac8fa',
    opacity: 0.5,
    'pointer-events': 'none', // prevents messages from block clicks on nodes
  },
  invisible: {
    fill: 'none',
  },
  node: {
    fill: '#ccc',
    stroke: '#000',
    'stroke-width': '1px'
  },
  link: {
    stroke: 'black',
    'stroke-width': '1px'
  },
  canvas: {
    fill: 'gray',
  },
};

// feature calculators
const _nodeColor = n => [255-n.y*255/200, (n.x)*255/200, 255-n.x*255/200];
const _nodeSize= (w, h, n) => _ => 5; //floor(w, h)/(n.length<0?8:n.length*5);
const _edgeLength = _ => 25;
const _msgSize = (w, h, n) => _nodeSize(w, h, n)()*2/3;

let View = function(controller, svg, module) {
  let [width, height] = [200, 200];

  svg = d3.select('svg')
    .attr('preserveAspectRatio', 'xMinYMin meet')
    .attr('width', width)
    .attr('height', height)
    .classed('micronomy', true);

  let rect  = svg.append('rect')
    .attr('width', 2*width)
    .attr('height', height)
    .style(style.canvas);

  let canvas = svg.append('g');

  canvas.attr('id', 'experiment');

  let viz = canvas.append('g');

  rect.call(d3.behavior.zoom().on('zoom', zoom(canvas)));

  let model = module.env;

  let force = d3.layout.force()
    .size([width/2, height/2])
    .nodes(nodes)
    .links(links)
    .linkDistance(_edgeLength);

  let [link, node, message] = [
    viz.selectAll('.link'),
    viz.selectAll('.node'),
    viz.selectAll('.message'),
  ];

  const posMessageX = d => {
    let progress = d.progress ? d.progress : 0;
    let _l = link.data()[d.link];
    let _x = _l.source.x + (_l.target.x - _l.source.x)*progress;
    return(_x);
  };

  const posMessageY = d => {
    let progress = d.progress ? d.progress : 0;
    let _l = link.data()[d.link];
    let _y = _l.source.y + (_l.target.y - _l.source.y)*progress;
    return(_y);
  };

  let _start = () => {
    // TODO: clean up, side-effect writes to node, link, message beyond scope
    node = node.data(force.nodes());
    node.enter().append('circle')
      .attr('class', 'node')
      .attr('r', _nodeSize(width, height, nodes))
      .style(style.node)
      .call(force.drag);
    node.exit().remove();

    link = link.data(force.links());
    link.enter().append('line')
      .attr('class', 'edge')
      .style(style.link);
    link.exit().remove();

    message = message.data(messages);
    message.enter().append('circle')
      .attr('r', _msgSize(width, height, nodes))
      .style(style.message);
    message.exit().remove();

    force.start();
  };

  force.on('tick', () => {
    node
      .attr('cx', function(d) { return d.x; })
      .attr('cy', function(d) { return d.y; })
      .attr('r', _nodeSize(width, height, nodes))
      .style('fill', d => d3.rgb(..._nodeColor(d)).toString());

    link
      .attr('x1', function(d) { return d.source.x; })
      .attr('y1', function(d) { return d.source.y; })
      .attr('x2', function(d) { return d.target.x; })
      .attr('y2', function(d) { return d.target.y; });

    message
      .attr('cx', posMessageX)
      .attr('cy', posMessageY)
      .attr('r', _msgSize(width, height, nodes))
      .style(style.message)
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
        _nodeAdder, () => {}, _nodeRemover,
        _nodeMatcher,
        _syncNodes
      );

      _sync(
        _linksMapGetter,
        model, 'network', ['id', 'parent', 'child'],
        _linkExtractor,
        _linkAdder, () => {}, _linkRemover,
        _linkMatcher,
        _syncLinks
      );

      messages = [];
      _sync(
        _messagesMapGetter,
        model, 'queue', ['link'],
        _messageExtractor,
        _messageAdder, _messageUpdater, _messageRemover,
        _messageMatcher,
        _syncMessages
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
let [messages, messagesMap] = [ [], new Map() ];

let _nodeMapGetter = () => nodesMap;
let _linksMapGetter = () => linksMap;
let _messagesMapGetter = () => messagesMap;

let _isInViz = (idx, getVizMap) => getVizMap().has(idx);

let _basicExtractor = (model, props) => {
  return props.reduce((acc, val, i, arr) => {
    acc[val] = model[val]; return acc;
  }, {});
};

let _nodeExtractor = (model, props) => {
  return {
    id: model.id.value,
    capital: model.capital.value
  }
};

let _linkExtractor = (model, props) => {
  let [parent, child] = [model.conduit.parent, model.conduit.child];
  return {
    id: `${parent.value}-${child.value}`,
    source: nodes.findIndex((el, idx, _) => el.id == parent.value),
    target: nodes.findIndex((el, idx, _) => el.id == child.value),
  }
};

let _messageExtractor = (model, props) => {
  let conduit = model.conduit.match({
    Empty: undefined,
    Unidirectional: x => x,
  });

  let index = links.findIndex((el, _) => {
    return el.id == `${conduit.parent.value}-${conduit.child.value}`;
  });

  return {
    id: links[index].id,
    dir: true,
    link: index,
    progress: 0.5,
  };
};

// The following helpers simplify the management of data for the D3 viz
//// adders
let _nodeAdder = (props) => nodes.push(props);
let _linkAdder = (props) => links.push(props);
let _messageAdder = (props) => messages.push(props);

//// removers
// TODO: Figure out if I can use generators to simplify this
let _nodeRemover = (id) => {
  let removable = nodes.findIndex((el, idx, arr) => el.id == id.value);
  if(removable > -1) { nodes.splice(removable, 1); }
};
let _linkRemover = (id) => {
  let removable = links.findIndex((el, idx, arr) => (el.id == id));
  if(removable > -1) { links.splice(removable, 1); }
};
let _messageRemover = (id) => {
  let removable = messages.findIndex((el, idx, arr) => (el.id == id));
  //console.log('gotta remove', removable);
  if(removable > -1) { messages.splice(removable, 1); }
};

//// updaters
let _messageUpdater = (id, props) => messages.push(props);

// TODO: remove `model` from `_addToViz` & `removeFromViz`
let _addToViz = (model, props, extract, add) => {
  return add(extract(model, props));
};
let _removeFromViz = (model, props, extract, remove) => {
  return remove(extract(model, props).id);
};
let _updateViz = (idx, model, props, extract, update) => {
  let resource = extract(model, props);
  return update(resource.id, resource);
};

// TODO: figure out a computationally less expensive way to sync links + nodes
let _syncNodes = (present) => {
  nodesMap.clear();
  present.forEach((val, key) => {
    nodesMap.set(key, val);
  });
};

let _syncLinks = (present) => { // syncing the linksMap to the present values
  //console.log('links map', linksMap);
  linksMap.clear();
  present.forEach((val, key) => {
    linksMap.set(key, val);
  });
};

let _syncMessages = (present) => {
  messagesMap.clear();
  present.forEach((val, key) => messagesMap.set(key, val));
};

let _nodeMatcher = (item, idx = undefined, cb) => {
  item.match({
    Nonexisting: undefined,
    Existing: cb,
  });
};

let _linkMatcher = (item, idx = undefined, cb) => {
  item.match({
    Empty: undefined,
    Unidirectional: x => {
      cb({
        id: 100,
        conduit: x
      });
    },
  });
};

let _messageMatcher = (item, idx = undefined, cb) => {
  cb(item);
};

// TODO: return newIdxs and voidIdxs and do housekeeping elsewhere?
const _sync = (past, model, name, props, extract, add, update, remove, match, sync) => {
  let current = new Map();
  let [newIdxs, voidIdxs] = [ [], [] ];

  model.vars.get(name).forEach((item, idx) => {
    match(item, idx, details => {
      current.set(idx, details);
      if(!_isInViz(idx, past)) {
        newIdxs.push(idx);
        return _addToViz(details, props, extract, add);
      } else {
        return _updateViz(idx, details, props, extract, update);
      }
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

const zoom = (zoomable) => {
  return () => {
    let trans = `translate(${d3.event.translate})scale(${d3.event.scale})`;
    zoomable.attr('transform', trans);
  }
};

module.exports = View;
