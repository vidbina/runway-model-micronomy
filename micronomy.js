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
    border: 'blue',
    'stroke-width': '1px',
  },
  label: {
    font: '4px sans-serif',
    'pointer-events': 'none',
    'text-anchor': 'middle',
  },
  circle: {
    fill: '#ccc',
    stroke: '#000',
    'stroke-width': '1px',
  },
  rect: {
    width: '4px',
    height: '4px',
    fill: 'rgb(0, 23, 122, 100)',
    stroke: '#000',
    'stroke-width': '1px',
  },
  link: {
    stroke: 'black',
    'stroke-width': '1px',
  },
  canvas: {
    fill: 'gray',
  },
};

// feature calculators
const _nodeColor = n => [255-n.y*255/200, (n.x)*255/200, 255-n.x*255/200];
const _nodeSize= (w, h, n) => _ => 5; //floor(w, h)/(n.length<0?8:n.length*5);
const _nodePositionX = d =>  (d.x || 0)-_nodeWidth(d)/2;
const _nodePositionY = d => (d.y || 0)-_nodeHeight(d)/2;
const _nodeRadius = d => (_nodeWidth(d)+_nodeHeight(d))/2;
const _nodeWidth = _ => (5 || 0);
const _nodeHeight = _ => (5 || 0);

const _edgeLength = _ => 25;

const _msgSize = (w, h, n) => _nodeSize(w, h, n)()*2/3;
const _msgPositionX = link => d => {
  let progress = d.progress ? d.progress : 0;
  let _l = link.data()[d.link];
  let _x = _l.source.x + (_l.target.x - _l.source.x)*progress;
  return(_x || 0);
};
const _msgPositionY = link => d => {
  let progress = d.progress ? d.progress : 0;
  let _l = link.data()[d.link];
  let _y = _l.source.y + (_l.target.y - _l.source.y)*progress;
  // TODO: figure out why source is sometimes Int as otherwise Object
  //console.info(`source`, link.data()[d.link].source);
  if(!_l.source.y) {
    // NOTE: There is a situation where source.y is undefined because it's an
    // Int.
    //console.error(`${_l.source.y} + (${_l.target.y} - ${_l.source.y})*${progress}`);
    //console.error(`${_l.source} + (${_l.target} - ${_l.source})*${progress}`);
    //console.error(_l);
  }
  return(_y || 0);
};

// renderers
const _renderNode = (el, ...a) => {
  let group = el.append('g').attr('class', 'node');

  group.append('circle')
  .attr('r', _nodeRadius)
  .attr('cx', d => _nodeRadius(d)/2)
  .attr('cy', d => _nodeRadius(d)/2)
  .style(style.circle);

  group.append('text')
  .attr('x', d => _nodeRadius(d)*2)
  .attr('y', d => _nodeRadius(d)*2)
  .text(d => d.name)
  .style(style.label);

  return _updateNode(group, ...a);
};
const _renderLink = (el, ...a) => _updateLink(el.append('line'), ...a);
const _renderMessage = (el, ...a) => {
  let [link, width, height, nodes] = a;
  let group = el.append('g').attr('class', 'message');

  group.append('circle')
  .attr('r', _msgSize(width, height, nodes))
  .style(style.message);

  return _updateMessage(group, ...a);
}

// updaters
const _updateNode = (base, width, height, nodes, force) => {
  return base.attr('transform', d => {
    return `translate(${_nodePositionX(d)},${_nodePositionY(d)})`;
  });
};

const _updateLink = (base) => {
  return base
  .attr('x1', d => d.source.x)
  .attr('y1', d => d.source.y)
  .attr('x2', d => d.target.x)
  .attr('y2', d => d.target.y)
  .attr('class', 'edge')
  .style(style.link);
}

const _updateMessage = (base, link, width, height, nodes, force) => {
  return base.attr('transform', d => {
    return `translate(${_msgPositionX(link)(d)},${_msgPositionY(link)(d)})`;
  });
};

let View = function(controller, svg, module) {
  let [width, height] = [200, 200];

  svg = d3.select('svg')
    .attr('preserveAspectRatio', 'xMinYMin meet')
    .attr('width', width)
    .attr('height', height)
    .classed('micronomy', true);

  let rect = svg.append('rect')
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
    viz.append('g').selectAll('.node'),
    viz.selectAll('.message'),
  ];

  let _start = () => {
    // TODO: clean up, side-effect writes to node, link, message beyond scope
    node = node.data(force.nodes());
    _renderNode(node.enter(), width, height, nodes, force).call(force.drag);
    node.exit().remove();

    link = link.data(force.links());
    _renderLink(link.enter());
    link.exit().remove();

    message = message.data(messages);
    _renderMessage(message.enter(), link, width, height, nodes);
    message.exit().remove();;

    force.start();
  };

  force.on('tick', () => {
    let args = [width, height, nodes, force];
    _updateNode(node, ...args);
    _updateLink(link);
    _updateMessage(message, link, ...args);
  });

  force.start();

  // remember to specify the props for each model that need to be transferred
  return({
    wideView: true,
    update: () => {
      _sync(
        _nodeMapGetter,
        model, 'manifest', ['id', 'capital', 'name'],
        _nodeExtractor,
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
    capital: model.capital.value,
    name: model.name.varianttype.name, // TODO: eradicate hack
  };
};

let _linkExtractor = (model, props) => {
  let [parent, child] = [model.conduit.parent, model.conduit.child];
  let output = {
    id: `${parent.value}-${child.value}`,
    source: nodes.findIndex((el, idx, _) => el.id == parent.value),
    target: nodes.findIndex((el, idx, _) => el.id == child.value),
  };
  //if(parent.value) { console.info('>', output.source, output.target); }
  return output;
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
