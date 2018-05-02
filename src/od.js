(function (d3, abmviz_utilities) {
  'use strict';
  var exports = {};

  function getMax(data, currentVar) {
    var max = -10000000;
    Object.keys(data).forEach(function(o) {
      Object.keys(data[o]).forEach(function(d) {
        // Fix max of bidirectional flows
        max = Math.max(data[o][d][currentVar] + data[d][o][currentVar], max);
      })
    })
    return max;
  }

  (function createOD() {
    var divID = 'od',
        containerID = 'odMap',
        maxLineWidthPixels = 10;

    // Create initial scales for lines on map (width and opacity)
    var w = d3.scaleLinear().range([0, maxLineWidthPixels]);
    var op = d3.scaleLinear().range([0, 1]);

    d3.queue()
      .defer(d3.csv, '../data/' + abmviz_utilities.GetURLParameter('scenario') + '/Desirelines.csv')
      .defer(d3.json, '../data/SuperDistricts.topojson')
      .defer(d3.json, '../data/SuperDistrictsDesirelines.topojson')
      .await(function(err, csv, geo, desirelines) {
        // If files do not exist, remove this div
        if (err) {
          console.log('Error');
          d3.select('#' + divID).remove();
        }

        // Build object from csv
        var od = {};
        csv.forEach(function(row) {
          var o = +row.ORIG,
              d = +row.DEST;

          if (typeof od[o] === "undefined") {
            od[o] = {};
          }

          // Store if o != d b/c we are only plotting desirelines
          if (o !== d) {
            od[o][d] = {
              WRKSOV: +row.WRKSOV,
              WRKHOV: +row.WRKHOV,
              WRKTRN: +row.WRKTRN,
              NWKSOV: +row.NWKSOV,
              NWKHOV: +row.NWKHOV,
              NWKTRN: +row.NWKTRN,
              ALLSOV: +row.ALLSOV,
              ALLHOV: +row.ALLHOV,
              ALLTRN: +row.ALLTRN,
              WRKALL: +row.WRKALL,
              NWKALL: +row.NWKALL,
              ALLALL: +row.ALLALL
            };
          }
        });  // end csv.forEach()

        // Build superdistrict id to name lookup
        var nameByID = {};
        // Loop through all polygons (note i does not equal id)
        for(var i = 0; i < geo.objects.superdistricts.geometries.length; i += 1) {
            var id = geo.objects.superdistricts.geometries[i].properties.id;
            nameByID[id] = geo.objects.superdistricts.geometries[i].properties.name;
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
          var bounds = path.bounds(topojson.feature(geo, geo.objects.superdistricts)),
              buffer = 250,
              topLeft = [bounds[0][0]-buffer,bounds[0][1]-buffer],
              bottomRight = [bounds[1][0]+buffer,bounds[1][1]+buffer];

          mapsvg.attr('width', bottomRight[0] - topLeft[0])
                .attr('height', bottomRight[1] - topLeft[1])
                .style('left', topLeft[0] + 'px')
                .style('top', topLeft[1] + 'px');

          g.attr('transform', 'translate(' + -topLeft[0] + ',' + -topLeft[1] + ')');

          d3.selectAll('.mappolygons').attr('d', path);
          d3.selectAll('.desirelines').attr('d', path);
        }

        // Create map
        var map = L.map(containerID).setView([33.792902, -84.349885], 9);
        L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 16
        }).addTo(map);
        map.addControl(new L.Control.Fullscreen());

        var mapsvg = d3.select(map.getPanes().overlayPane).append('svg'),
            g = mapsvg.append('g');

        // Create tooltip
        var tooltip = d3.select('#odTooltip');

        // Add slider for max circle size
        var mySlider = $('#odSlider').bootstrapSlider();
        mySlider.on('slideStop', function(ev) {
            w.range([0, mySlider.bootstrapSlider('getValue')]);
            updateDesireLines();
        });

        // Draw background super districts
        g.selectAll('.mappolygons')
          .data(topojson.feature(geo, geo.objects.superdistricts).features)
          .enter().append('path')
            .attr('class', 'mappolygons')
            .attr('stroke', 'lightgray')
            .attr('fill-opacity', 0.5)
            .attr('fill', '#fff')
            .style('pointer-events', 'visibleFill')
            .on('mouseover', function(d) {
              d3.select(this).style('cursor', 'pointer');
              tooltip.transition()
                .duration(200)
                .style('opacity', 1);
              tooltip.html(d.properties.name);
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

        // Draw background counties on top of super districts
        g.selectAll('.mapcounties')
          .data(topojson.feature(geo, geo.objects.counties).features)
          .enter().append('path')
            .attr('fill', 'none')
            .attr('stroke', '#000')
            .attr('class', 'mappolygons mapcounties')
            .attr('d', path);

        // Draw desire lines w/ zero thickness
        g.selectAll('.desirelines')
          .data(topojson.feature(desirelines, desirelines.objects.desirelines).features)
          .enter().append('path')
            .attr('class', 'desirelines')
            .attr('stroke', '#3182bd')
            .attr('stroke-linecap', 'round')
            .style('stroke-width', '0')
            .style('pointer-events', 'visibleStroke')
            .on('mouseover', function(d) {
              d3.select(this).style('cursor', 'pointer');
              tooltip.transition()
                .duration(200)
                .style('opacity', 1);
              tooltip.html(
                nameByID[d.properties.o] + ' → ' + nameByID[d.properties.d] + ' ' +
                  d3.format(',')(od[d.properties.o][d.properties.d][dataColumn]) +
                  '<br/>' +
                nameByID[d.properties.d] + ' → ' + nameByID[d.properties.o] + ' ' +
                  d3.format(',')(od[d.properties.d][d.properties.o][dataColumn])
                );
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

        // Define function for transitioning line thickness to match data inputs
        var dataColumn;
        function updateDesireLines() {
          var tripType = d3.select('#odTripType').property('value'),
              mode = d3.select('#odMode').property('value');
          dataColumn = tripType.concat(mode).toUpperCase();

          // Find max in data and update line width and opacity scales
          var dataMax = getMax(od, dataColumn);
          w.domain([0, dataMax]);
          op.domain([0, dataMax]);

          d3.selectAll('.desirelines')
            .transition().duration(300)
            .style('stroke-width', function(d) {
              // Sum bidirectional
              return w(od[d.properties.o][d.properties.d][dataColumn] +
                       od[d.properties.d][d.properties.o][dataColumn]);
            })
            .style('stroke-opacity', function(d) {
              // Sum bidirectional
              return op(od[d.properties.o][d.properties.d][dataColumn] +
                        od[d.properties.d][d.properties.o][dataColumn]);
            });
        }
        updateDesireLines();

        // Redraw with change to dropdown menus or checkboxes
        d3.selectAll('.odInput').on('change', function() {
          updateDesireLines();
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
    }) // end d3.json()
  }()); // end createOD()

  // Return exports to global namespace (could be empty if nothing is needed
  // in the global namespace)
  return exports;

}(d3v4, abmviz_utilities));
