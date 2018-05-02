(function (d3, abmviz_utilities) {
  'use strict';
  var exports = {};

  function getMax(data) {
    var variables = [
      'totbrd', 'totxit',
      'eabrd', 'eaxit',
      'ambrd', 'amxit',
      'mdbrd', 'mdxit',
      'pmbrd', 'pmxit',
      'evbrd', 'evxit',
      'apbrd', 'apxit',
    ]
    var max = -10000000;
    for (var j=0 ; j<variables.length ; j++) {
      for (var i=0 ; i<data.length ; i++) {
        max = Math.max(data[i].properties[variables[j].toUpperCase()], max);
      }
    }
    return max;
  }

  (function createTransit() {
    var divID = 'transit',
        containerID = 'transitMap',
        maxCirclePixels = 25;

    // Create initial scale for circles on map
    var r = d3.scaleSqrt().range([0, maxCirclePixels]);

    d3.queue()
      .defer(d3.json, '../data/' + abmviz_utilities.GetURLParameter('scenario') + '/TransitStops.topojson')
      .defer(d3.json, '../data/Rail.topojson')
      .await(function(err, geo, rail) {
        // If files do not exist, remove this div
        if (err) {
          console.log('Error');
          d3.select('#' + divID).remove();
        }

        // Projection
        function projectPoint(lon, lat) {
            var point = map.latLngToLayerPoint(new L.LatLng(lat, lon))
            this.stream.point(point.x, point.y);
        }
        var transform = d3.geoTransform({point: projectPoint}),
            path = d3.geoPath().projection(transform);

        // Update the path using the current transform
        function updateTransform() {
          var bounds = path.bounds(topojson.feature(geo, geo.objects.transit)),
              buffer = 250,
              topLeft = [bounds[0][0]-buffer,bounds[0][1]-buffer],
              bottomRight = [bounds[1][0]+buffer,bounds[1][1]+buffer];

          mapsvg.attr('width', bottomRight[0] - topLeft[0])
                .attr('height', bottomRight[1] - topLeft[1])
                .style('left', topLeft[0] + 'px')
                .style('top', topLeft[1] + 'px');

          g.attr('transform', 'translate(' + -topLeft[0] + ',' + -topLeft[1] + ')');

          d3.selectAll('.mapCircles').attr('transform', function(d) {
            return 'translate(' + path.centroid(d) + ')';
          });
          d3.selectAll('.mapBase').attr('d', path);
        }

        // Find max in the data and update circle scale
        var dataMax = getMax(geo.objects.transit.geometries);
        r.domain([0, dataMax]);

        // Create map
        var map = L.map(containerID).setView([33.792902, -84.349885], 10);
        L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 16
        }).addTo(map);
        map.addControl(new L.Control.Fullscreen());

        var mapsvg = d3.select(map.getPanes().overlayPane).append('svg'),
            g = mapsvg.append('g');

        // Create tooltip
        var tooltip = d3.select('#transitTooltip');

        // Create control on map to (de)select premium/nonpremium
        var command = L.control({position: 'topright'});
        command.onAdd = function (map) {
          var div = L.DomUtil.create('div', 'command');
          div.innerHTML = '<form><input id="premium" class="transitInput" type="checkbox" checked> Rail/Express Bus</br><input id="nonpremium" class="transitInput" type="checkbox" checked> Local Bus</form>';
          return div;
        };
        command.addTo(map);

        // Add slider for max circle size
        var mySlider = $('#transitSlider').bootstrapSlider();
        mySlider.on('slideStop', function(ev) {
            r.range([0, mySlider.bootstrapSlider('getValue')]);
            updateCircleRadii();
        });

        // Add MARTA rail as background
        g.selectAll('path')
          .data(topojson.feature(rail, rail.objects.transit).features)
          .enter().append('path')
            .attr('class', 'mapBase')
            .attr('d', path)
            .style('fill', 'none')
            .style('stroke', 'lightgray')
            .style('stroke-width', 5)
            .style('stroke-linejoin', 'round')
            .style('stroke-linecap', 'round');

        // Draw initial circles w/ zero radii
        g.selectAll('circle')
          .data(topojson.feature(geo, geo.objects.transit).features)
          .enter().append('circle')
            .attr('class', 'mapCircles')
            .attr('transform', function(d) {
              return 'translate(' + path.centroid(d) + ')';
            })
            .style('fill', function(d) {
              if (d.properties.STAFLAG == 1) {
                return '#3182bd';
              } else {
                return '#000000';
              }
            })
            .style('fill-opacity', 0.5)
            .attr('r', 0)
            .on('mouseover', function(d) {
              d3.select(this).style('cursor', 'pointer');
              tooltip.transition()
                .duration(200)
                .style('opacity', 1);
              var estimate = d3.format(',')(Math.round(d.properties[dataColumn]));
              if (d.properties.STAFLAG == 1) {
                tooltip.html(d.properties.STATION + ' ' + estimate);
              } else {
                tooltip.html(estimate);
              }
            })
            .on('mousemove', function () {
              tooltip.style('top', (d3.event.pageY - 16) + 'px')
                .style('left', (d3.event.pageX) + 'px');
            })
            .on('mouseout', function(d) {
              d3.select(this).style('cursor', 'default');
              tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            });

        // Define function for transitioning radii to match data inputs
        var dataColumn;
        function updateCircleRadii() {
          var timeOfDay = d3.select('#timeOfDay').property('value'),
              boardAlight = d3.select('#boardAlight').property('value');
          dataColumn = timeOfDay.concat(boardAlight).toUpperCase();

          var showPremium = d3.select('#premium').property('checked'),
              showNonpremium = d3.select('#nonpremium').property('checked');

          d3.selectAll('.mapCircles')
            .transition().duration(300)
            .attr('r', function(d) {
              if (d.properties.STAFLAG == 1 && !showPremium) {
                return 0;
              } else if (d.properties.STAFLAG == 0 && !showNonpremium) {
                return 0;
              } else {
                return r(d.properties[dataColumn]);
              }
            });
        }
        updateCircleRadii();

        // Redraw with change to dropdown menus or checkboxes
        d3.selectAll('.transitInput').on('change', function() {
          updateCircleRadii();
        });

        // Hide D3 while moving map
        map.on('viewreset', updateTransform);
        map.on('movestart', function() {
          mapsvg.classed('hidden', true);
        });
        map.on('rotate', function() {
          mapsvg.classed('hidden', true);
        });
        map.on('moveend', function() {
          updateTransform();
          mapsvg.classed('hidden', false);
        });

        updateTransform();
    }) // end d3.json
  }()); // end createTransit()

  // Return exports to global namespace (could be empty if nothing is needed
  // in the global namespace)
  return exports;

}(d3v4, abmviz_utilities));
