var forkSvg = '<svg aria-hidden=\'true\' class=\'octicon octicon-repo-forked\' height=\'16\' role=\'img\' version=\'1.1\' viewBox=\'0 0 10 16\' width=\'10\'><path d=\'M8 1c-1.11 0-2 0.89-2 2 0 0.73 0.41 1.38 1 1.72v1.28L5 8 3 6v-1.28c0.59-0.34 1-0.98 1-1.72 0-1.11-0.89-2-2-2S0 1.89 0 3c0 0.73 0.41 1.38 1 1.72v1.78l3 3v1.78c-0.59 0.34-1 0.98-1 1.72 0 1.11 0.89 2 2 2s2-0.89 2-2c0-0.73-0.41-1.38-1-1.72V9.5l3-3V4.72c0.59-0.34 1-0.98 1-1.72 0-1.11-0.89-2-2-2zM2 4.2c-0.66 0-1.2-0.55-1.2-1.2s0.55-1.2 1.2-1.2 1.2 0.55 1.2 1.2-0.55 1.2-1.2 1.2z m3 10c-0.66 0-1.2-0.55-1.2-1.2s0.55-1.2 1.2-1.2 1.2 0.55 1.2 1.2-0.55 1.2-1.2 1.2z m3-10c-0.66 0-1.2-0.55-1.2-1.2s0.55-1.2 1.2-1.2 1.2 0.55 1.2 1.2-0.55 1.2-1.2 1.2z\'></path></svg>'
var starSvg = '<svg aria-hidden=\'true\' class=\'octicon octicon-star\' height=\'16\' role=\'img\' version=\'1.1\' viewBox=\'0 0 14 16\' width=\'14\'><path d=\'M14 6l-4.9-0.64L7 1 4.9 5.36 0 6l3.6 3.26L2.67 14l4.33-2.33 4.33 2.33L10.4 9.26 14 6z\'></path></svg>'

function updateInfoBox(data) {
    if (data) {
        d3.select('#info-box')
            .style('display', 'block')
            .html('<h4><a href=\'http://github.com/' + data.full_name + '\'>' + data.full_name + '</a></h4>' +
                '<p>' + starSvg + '<span>' + data.stars + '</span>' + forkSvg + '<span>' + data.forks + '</span></p>' +
                '<p>' + data.description + '</p>');
    } else {
        d3.select('#info-box')
            .style('display', 'none')
    }
}

var highlighted = '', data, chart;


d3.csv('data/repos-dump.csv', function(githubData) {

    // coerce numbers and add computed properties
    githubData.forEach(function(d) {
        d.stars = Number(d['stars']);
        d.forks = Number(d['forks']);
        d.combination = d.stars + d.forks;
    })
    githubData = githubData.filter(function(d) { return d.stars > 0 && d.forks > 0 && d.language; });

    var groupedByLanguage = d3.nest()
        .key(function(d) { return d.language; })
        .entries(githubData);

    // compute a linear best fit for each language
    var linearFit = groupedByLanguage.map(function(d) {
        var series = d.values.map(function(d) { return [d.stars, d.forks]; });
        var fit = regression('linear', series);
        var line = [fit.points[0], fit.points[fit.points.length - 1]];
        line.language = d.key;
        return line;
    })

    // the data that will be bound to the chart
    data = {
        githubData: githubData,
        line: linearFit,
        diagonal: [[1, 1], [1e6, 1e6]]
    };

    // obtain the unique list of languages and create a colour scale
    var languages = groupedByLanguage.map(function(d) { return d.key; });
    var color = d3.scale.category20()
        .domain(languages);

    // create a scale for sizing the points
    var sizeScale = d3.scale.linear()
        .range([5, 800])
        .domain(fc.util.extent().fields('combination')(githubData));

    // create a legend where the language is highlighted on mouse-over
    var timer;
    var legend = d3.legend.color()
        .scale(color)
        .on('cellover', function(d) {
            clearTimeout(timer); highlighted = d; updateInfoBox(); render();
        })
        .on('cellout', function(d) {
            timer = setTimeout(function(d) { highlighted = ''; render(); }, 50);
        });

    function isGrayed(d) {
        return !((highlighted && d.language === highlighted) || !highlighted)
    }

    // create a point series, where the size is dynamic, creating a bubble series
    var pointSeries = fc.series.point()
        .xValue(function(d) { return d.stars; })
        .yValue(function(d) { return d.forks; })
        .size(function(d) { return sizeScale(d.combination); })
        .decorate(function(sel) {
            sel.style({
                'fill': function(d) { return isGrayed(d) ? '#999' : color(d.language); },
                'opacity': function(d) { return highlighted ? (isGrayed(d) ? 0.1 : 1.0) : 0.8 }
            });
            sel.enter()
                .select('path')
                .on('click', function(d) { updateInfoBox(d); });
        });

    // create a line series
    var lineSeries  = fc.series.line()
        .xValue(function(d) { return d[0]; })
        .yValue(function(d) { return d[1]; })
        .decorate(function(sel) {
            sel.style({
                'stroke': '#444',
                'opacity': function(d) { return highlighted ? (isGrayed(d) ? 0 : 1) : 0; }
            });
        });

    var diagonalSeries  = fc.series.line()
        .xValue(function(d) { return d[0]; })
        .yValue(function(d) { return d[1]; })
        .decorate(function(sel) {
            sel.style('stroke', '#444');
        });

    // use  amulti-series to render a line for each linera fit series and a point series
    var multiSeries = fc.series.multi()
        .series([pointSeries, diagonalSeries].concat(data.line.map(function(d) { return lineSeries; })))
        .mapping(function(series, index) {
            switch(series) {
            case pointSeries: return this.githubData;
            case diagonalSeries: return this.diagonal;
            case lineSeries: return this.line[index - 2];
            }
        });

    chart = fc.chart.cartesian(
                  d3.scale.log(),
                  d3.scale.log())
        .xDomain(fc.util.extent().pad([0,1]).fields("stars")(githubData))
        .xLabel('Stars (Log)')
        .xNice()
        .xTicks(2, d3.format(',d'))
        .yLabel('Forks (Log)')
        .yDomain(fc.util.extent().pad([0,1]).fields("forks")(githubData))
        .yNice()
        .yTicks(2, d3.format(',d'))
        .yOrient("left")
        .margin({left: 60, bottom: 40, right: 40, top: 20})
        .plotArea(multiSeries)
        .decorate(function(selection) {
            // decorate to add the legend
            selection.enter()
                .append('g')
                .classed('legend-container', true)
                .layout({
                    position: 'absolute',
                    right: 70,
                    bottom: 80,
                    width: 90,
                    height: 372
                });
            // compute layout from the parent SVG
            selection.enter().layout();
            // render the legend
            selection.select('g.legend-container').call(legend);
        });

    render();
});

function render() {
    d3.select("#chart")
        .datum(data)
        .call(chart);
}

function highlightOnMouseOver(sel, language) {
    sel.on('mouseenter', function() { highlighted = language; render(); })
       .on('mouseleave', function() { highlighted = ''; render(); })
}
