'use strict';

let d3 = require('d3');
console.log(d3);

let View = function(controller, svg, module) {
  svg = d3.select('svg')
    .attr('preserveAspectRatio', 'xMinYMin meet')
    .classed('micronomy', true);

  svg.append('g').attr('id', 'experiment');

  let r = 1;
  let expand = true;

  d3.select('#experiment')
    .append('circle')
      .attr('id', 'firstCircle')
      .attr('r', 1)
      .attr('fill', 'black')
      .attr('cx', 100)
      .attr('cy', 100);

  return({
    wideView: true,
    update: () => {
      if(r > 100) { expand = false; }
      if(r < 10) { expand = true; }

      if(expand) {
        r = r + 1;
      } else {
        r = r - 1;
      }

      const rect = svg.node().viewBox.baseVal;
      d3.select('#experiment').select('circle')
        .attr('r', r)
        .attr('cx', rect.width/2)
        .attr('cy', rect.height/2);

    }
  });
};

module.exports = View;
