'use strict';

let d3 = require('d3');

let View = function(controller, svg, module) {
  svg = d3.select('svg')
    .attr('preserveAspectRatio', 'xMinYMin meet')
    .classed('micronomy', true);

  svg.append('g').attr('id', 'experiment');

  let actors = [
    new Actor('#experiment'),
  ];

  return({
    wideView: true,
    update: () => {
      for(var actor of actors) {
        actor.update();
      }
    }
  });
};

// Classes
class Actor {
  constructor(groupID) {
    let svg = d3.select('svg');

    this.r = 1;
    this.expand = true;
    this._uuid = `uuid${uuid()}`;

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
      .attr('r', this.r)
      .attr('cx', rect.width/2)
      .attr('cy', rect.height/2);
  }

  get uuid() {
    return this._uuid;
  }

  get node() {
    return d3.select(`#${this.uuid}`).node();
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

module.exports = View;
