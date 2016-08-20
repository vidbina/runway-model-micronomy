'use strict';

let d3 = require('d3');
let Menu = require('runway-browser/lib/menu.js');

const style = {
  message: {
    fill: 'yellow',
    height: '100%',
    width: '100%',
    border: 'blue',
    'stroke-width': '1px',
    'vertical-align': 'center',
    opacity: 0.5,
    'pointer-events': 'none', // prevents messages from block clicks on nodes
  },
  messageLink: {
    fill: 'red',
    border: 'blue',
    stroke: '#000',
    'stroke-width': '1px',
    'stroke-dasharray': '2,1,1,1',
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
  tinylabel: {
    font: '2px sans-serif',
    'pointer-events': 'none',
    'text-anchor': 'middle',
  },
  circle: {
    stroke: '#000',
    'stroke-width': '1px',
  },
  circleon: {
    fill: 'black',
  },
  circleoff: {
    fill: 'gray',
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
    fill: 'skyblue',
  },
  chargebar: {
    fill: 'red',
    //stroke: '#000',
    //'stroke-width': '1px',
  },
  bar: {
    fill: 'green',
  }
};

// feature calculators
const _nodeColor = n => [255-n.y*255/200, (n.x)*255/200, 255-n.x*255/200];
const _nodeSize= (w, h, n) => _ => 5; //floor(w, h)/(n.length<0?8:n.length*5);
const _nodePositionX = d =>  (d.x || 0)-_nodeWidth(d)/2;
const _nodePositionY = d => (d.y || 0)-_nodeHeight(d)/2;
const _nodeRadius = d => (_nodeWidth(d)+_nodeHeight(d))/2;
const _nodeWidth = _ => (5 || 0);
const _nodeHeight = _ => (5 || 0);

const _edgeLength = (conduit, i) => { return 10; };

const _msgSize = (w, h, n) => _nodeSize(w, h, n)()*2/3;
const relativePosition = (start, end, p = 0) => (start + (end-start)*p) || 0;
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
  return(_y || 0);
};
const _responsePositionX1 = nodes => d => {
  return nodes && nodes[d.nodes.source] ? nodes[d.nodes.source].x : 0;
};
const _responsePositionY1 = nodes => d => {
  return nodes && nodes[d.nodes.source] ? nodes[d.nodes.source].y : 0;
};

const _responsePositionX2 = nodes => d => {
  return nodes && nodes[d.nodes.target] ? nodes[d.nodes.target].x : 0;
};
const _responsePositionY2 = nodes => d => {
  return nodes && nodes[d.nodes.target] ? nodes[d.nodes.target].y : 0;
};

// renderers
const _renderNode = (el, ...a) => {
  let [width, height, nodes, force, menu] = a;

  let group = el.append('g').attr('class', 'node');

  let node = group.append('g');

  node.append('circle')
  .attr('r', _nodeRadius)
  .attr('cx', d => _nodeRadius(d)/2)
  .attr('cy', d => _nodeRadius(d)/2)
  .style(style.circle);

  let bar = node.append('g').attr('class', 'bar');
  bar.attr('transform', d => {
    return `translate(${_nodeRadius()*3/2},${-_nodeRadius()*3/2})`;
  });

  bar.attr('display', d => d.maximum == 0 ? 'none' : 'block');

  bar.append('rect')
  .attr('width', _nodeRadius()/2)
  .attr('height', _nodeRadius())
  .style(style.bar);

  bar.append('rect')
  .attr('class', 'level')
  .attr('width', _nodeRadius()/2)
  .style(style.chargebar);

  node.append('text')
  .text(d => icons(d))
  .attr('x', d => 2)
  .attr('y', d => 4)
  .style(style.label);

  group.append('text')
  .attr('class', 'label')
  .attr('x', d => _nodeRadius(d)*-1.5)
  .attr('y', d => _nodeRadius(d)*-1)
  .text(d => `${d.name} (${d.id})`)
  .style(style.label);

  group.append('text')
  .attr('class', 'mailbox')
  .attr('x', d => _nodeRadius(d)*-1.5)
  .attr('y', d => _nodeRadius(d)*-0.5)
  .text(d => `${d.inbound} in, ${d.outbound} out`)
  .style(style.tinylabel);

  // TODO: trigger model action on click
  node.on('click', x => {
    menu.open([
      { rule: 'request', args: x.id },
      { rule: 'fillup', args: x.id },
    ]);
  });

  return _updateNode(group, ...a);
};
const _renderLink = (el, ...a) => {
  let group = el.append('g');

  //group.attr('class', 'link');

  group.append('line').attr('class', 'edge').style(style.link);

  group.append('text')
  .text(d => `(${d.token})`)
  .style(style.tinylabel);

  return _updateLink(group, ...a);
};
const _renderMessage = (el, ...a) => {
  let [link, width, height, nodes] = a;
  let group = el.append('g').attr('class', 'message');

  group.append('circle')
  .attr('r', _msgSize(width, height, nodes))
  .style(style.message);

  group.append('text')
  .text('✉️')
  .style(style.label);

  return _updateMessage(group, ...a);
};
const _renderResponse = (el, ...a) => {
  let group = el.append('g').attr('class', 'response');

  group.append('line')
  .attr('class', 'response')
  .style(style.messageLink)
  .attr('x1', 0)
  .attr('x2', 0)
  .attr('y1', 0)
  .attr('y2', 100);

  return _updateResponse(group, ...a);
};

// updaters
const _updateNode = (base, width, height, nodes, force) => {
  base.select('circle')
  .attr('fill', d => (d.active ? 'black' : 'none'));

  base.select('.level')
  .attr('height', d => _nodeRadius()*(1-(d.maximum ? d.amount/d.maximum : 0)));

  base.select('label')
  .text(d => `${d.name} (${d.id})`);

  base.select('.mailbox')
  .text(d => `${d.inbound} in, ${d.outbound} out`)

  base.attr('transform', d => {
    return `translate(${_nodePositionX(d)},${_nodePositionY(d)})`;
  });

  return base;
};

const _updateLink = (base) => {
  base.select('line')
  .attr('x1', d => d.source.x)
  .attr('y1', d => d.source.y)
  .attr('x2', d => d.target.x)
  .attr('y2', d => d.target.y);

  base.select('text')
  .attr('x', d => 2+relativePosition(d.source.x, d.target.x, 0.5))
  .attr('y', d => 2+relativePosition(d.source.y, d.target.y, 0.5));

  return base;
};

let once = false;
const _updateMessage = (base, link, width, height, nodes, force) => {
  base.attr('transform', d => {
    return `translate(${_msgPositionX(link)(d)},${_msgPositionY(link)(d)})`;
  });

  return base;
};

const _updateResponse = (base, link, width, height, nodes, force) => {
  base.select('line')
  .attr('x1', _responsePositionX1(nodes))
  .attr('x2', _responsePositionX2(nodes))
  .attr('y1', _responsePositionY1(nodes))
  .attr('y2', _responsePositionY2(nodes));

  return base;
};

let View = function(controller, svg, module) {
  let [width, height, scale] = [1200, 600, 2];

  svg = d3.select('svg')
    .attr('preserveAspectRatio', 'xMinYMin meet')
    .attr('width', width)
    .attr('height', height)
    .classed('zeta', true);

  let rect = svg.append('rect')
    .attr('width', 1*width)
    .attr('height', 1*height)
    .style(style.canvas);

  let canvas = svg.append('g');

  canvas.attr('id', 'experiment')
    .attr('transform', `translate(${width/2}, ${height/2})scale(${scale})`);

  let viz = canvas.append('g');

  rect.call(
    d3.behavior.zoom().on('zoom', zoom(canvas))
    .translate([width/2, height/2])
    .scale(scale)
  );

  let model = module.env;
  let menu = new Menu('zeta', controller, model);

  let force = d3.layout.force()
    .friction(0.5)
    .nodes(nodes)
    .links(links)
    .charge(-200)
    .linkDistance(_edgeLength);

  let [link, response, node, message] = [
    viz.append('g').attr('id', 'links').selectAll('.link'),
    viz.append('g').attr('id', 'responses').selectAll('.response'),
    viz.append('g').attr('id', 'nodes').selectAll('.node'),
    viz.append('g').attr('id', 'msgs').selectAll('.message'),
  ];

  let _start = () => {
    // TODO: clean up, side-effect writes to node, link, message beyond scope
    node = node.data(force.nodes());
    _renderNode(node.enter(), width, height, nodes, force, menu).call(force.drag);
    node.exit().remove();

    link = link.data(force.links());
    _renderLink(link.enter());
    link.exit().remove();

    message = message.data(messages);
    _renderMessage(message.enter(), link, width, height, nodes);
    message.exit().remove();

    response = response.data(responses);
    _renderResponse(response.enter(), link, width, height, nodes);
    response.exit().remove();

    force.start();
  };

  force.on('tick', () => {
    let args = [width, height, nodes, force, menu];
    _updateNode(node, ...args);
    _updateLink(link);
    _updateMessage(message, link, ...args);
    _updateResponse(response, links, ...args);
  });

  // remember to specify the props for each model that need to be transferred
  return({
    width,
    height,
    customView: true,
    update: () => {
      _sync(
        _nodeMapGetter,
        model, 'manifest', ['id', 'amount', 'maximum', 'minimum', 'name', 'generator', 'active'],
        _nodeExtractor,
        _nodeAdder, _nodeUpdater, _nodeRemover,
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

      _sync(
        _messagesMapGetter,
        model, 'queues', ['link'],
        _messageExtractor,
        _messageAdder, _messageUpdater, _messageRemover,
        _messageMatcher,
        _syncMessages
      );

      _sync(
        _responsesMapGetter,
        model, 'responses', ['source', 'request', 'amount'],
        _responseExtractor,
        _responseAdder, () => {}, _responseRemover,
        _responseMatcher,
        _syncResponses
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
let [responses, responsesMap] = [ [], new Map() ];

let _nodeMapGetter = () => nodesMap;
let _linksMapGetter = () => linksMap;
let _messagesMapGetter = () => messagesMap;
let _responsesMapGetter = () => responsesMap;

let _isInViz = (idx, getVizMap) => getVizMap().has(idx);

let _basicExtractor = (model, props) => {
  return props.reduce((acc, val, i, arr) => {
    acc[val] = model[val]; return acc;
  }, {});
};

let _nodeExtractor = (model, props) => {
  return {
    id: model.id.value,
    amount: model.amount.value,
    maximum: model.maximum.value,
    name: model.name.varianttype.name, // TODO: eradicate hack
    generator: model.generator.match({True: true, False: false}),
    active: model.active.match({True: true, False: false}),
    inbound: model.inbox.used,
    outbound: model.outbox.used,
  };
};

let _linkExtractor = (model, props) => {
  let [parent, child] = [model.conduit.parent, model.conduit.child];
  let output = {
    id: linkIdentifier(model.conduit),
    source: nodes.findIndex((el, idx, _) => el.id == parent.value),
    target: nodes.findIndex((el, idx, _) => el.id == child.value),
    token: model.id,
  };
  return output;
};

let _messageExtractor = (model, props) => {
  let link = linksMap.get(model.id)
  let conduit = link.conduit;

  let index = links.findIndex((el, _) => {
    return el.id == linkIdentifier(conduit);
  });

  return {
    count: model.count,
    id: links[index].id,
    dir: true,
    link: index,
    progress: 0.5,
  };
};

const linkIdentifier = link => `${link.parent.value}-${link.child.value}`;

let _responseExtractor = (model, props) => {
  return {
    source: model.source.value,
    nodes: {
      source: nodes.findIndex((el, _) => el.id == `${model.source.value}`),
      target: nodes.findIndex((el, _) => el.id == `${model.request.source.value}`),
    },
    request: {
      amount: model.request.amount.value,
      source: model.request.source.value,
    },
    amount: model.amount.value,
  };
};

// The following helpers simplify the management of data for the D3 viz
//// adders
let _nodeAdder = (props) => nodes.push(props);
let _linkAdder = (props) => links.push(props);
let _messageAdder = (props) => {
  messages.push(props);
}
let _responseAdder = (props) => {
  responses.push(props);
}

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
  if(removable > -1) { messages.splice(removable, 1); }
};
let _responseRemover = (id) => {
  let removable = responses.findIndex((el, idx, arr) => (el.id == id));
  if(removable > -1) { responses.splice(removable, 1); }
};

//// updaters
let _nodeUpdater = (id, props) => {
  let updatable = nodes.findIndex((el, idx, arr) => (el.id == id));

  if(updatable != -1) {
    if(props != undefined) {
      Object.keys(props).forEach(key => {
        nodes[updatable][key] = props[key];
      });
    }
  }
}

let _messageUpdater = (id, props) => {
  let updatable = messages.findIndex((el, idx, arr) => (el.id == id));

  if(updatable != -1) {
    if(props != undefined) {
      Object.keys(props).forEach(key => {
        messages[updatable][key] = props[key];
      });
    }
  }
}

// TODO: figure out a computationally less expensive way to sync links + nodes
let _syncNodes = (present) => {
  nodesMap.clear();
  present.forEach((val, key) => {
    nodesMap.set(key, val);
  });
};

let _syncLinks = (present) => { // syncing the linksMap to the present values
  linksMap.clear();
  present.forEach((val, key) => {
    linksMap.set(key, val);
  });
};

let _syncMessages = (present) => {
  messagesMap.clear();
  present.forEach((val, key) => {
    messagesMap.set(key, val)
  });
};

let _syncResponses = (present) => {
  responsesMap.clear();
  present.forEach((val, key) => responsesMap.set(key, val));
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
        id: idx,
        conduit: x
      });
    },
  });
};

let _messageMatcher = (item, idx = undefined, cb) => {
  if(item.used) {
    cb({
      id: idx,
      count: item.used,
      item: item
    });
  }
};

// TODO: use match for all matchers in a menner consistent to this func
let _responseMatcher = (item, idx = undefined, cb) => {
  item.match({
    Response: response => {
      cb({
        request: response.request.match({Request: x => x}),
        amount: response.amount,
        source: response.source
      });
    }
  })
};

// TODO: return newIdxs and voidIdxs and do housekeeping elsewhere?
let versions = new Map();
const _sync = (past, model, name, props, extract, add, update, remove, match, sync) => {
  let current = new Map();
  let [newIdxs, voidIdxs] = [ [], [] ];

  let [dirty, version, data] = [
    true,
    model.vars.get(`z_${name}`),
    model.vars.get(`${name}`),
  ];

  if(version != undefined) {
    if(version.value == versions.get(name)) dirty = false;
    versions.set(name, version.value);
  }

  if(dirty == true && version != undefined) {
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

    sync(current);
  } else {
    //sync(past());
  }

  return [newIdxs, voidIdxs];
};

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

const zoom = (zoomable) => {
  return () => {
    let trans = `translate(${d3.event.translate})scale(${d3.event.scale})`;
    zoomable.attr('transform', trans);
  };
};

const icons = item => {
  let name = item.name;
  if(!item.active) { return('🚧'); }
  switch (name) { // or some intermediate node
  case 'EU': return '🇪🇺';
  case 'DE': return '🇩🇪';
  case 'UK': return '🇬🇧';
  case 'PT': return '🇵🇹';
  case 'US': return '🇺🇸';
  case 'FR': return '🇫🇷';
  case 'JP': return '🇯🇵';
  case 'CN': return '🇨🇳';
  case 'AE': return '🇦🇪';
  case 'ES': return '🇪🇸';
  case 'ID': return '🇮🇩';
  case 'NL': return '🇳🇱';
  case 'Co': return '🏢';
  case 'Bank': return '🏦';
  case 'Factory': return '🏭';
  case 'Hotel': return '🏨';
  default: return('');
  }
};

module.exports = View;
