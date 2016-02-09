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
        line: linearFit
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
    var highlighted = '';
    var timer;
    var legend = d3.legend.color()
        .scale(color)
        .on('cellover', function(d) {
            clearTimeout(timer); highlighted = d; render();
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
                .on('mouseenter', function(d) { console.log(d); })
                .on('mouseleave', function(d) { console.log(d); });
        });

    // create a line series
    var lineSeries  = fc.series.line()
        .xValue(function(d) { return d[0]; })
        .yValue(function(d) { return d[1]; })
        .decorate(function(sel) {
            sel.style({
                'stroke': '#444',
                'opacity': function(d) { return highlighted ? (isGrayed(d) ? 0 : 1) : 0; },
            });
        });

    // use  amulti-series to render a line for each linera fit series and a point series
    var multiSeries = fc.series.multi()
        .series([pointSeries].concat(data.line.map(function(d) { return lineSeries; })))
        .mapping(function(series, index) {
            switch(series) {
            case pointSeries: return this.githubData;
            case lineSeries: return this.line[index - 1];
            }
        });

    var chart = fc.chart.cartesian(
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
        .margin({left: 50, bottom: 50, right: 40})
        .plotArea(multiSeries)
        .decorate(function(selection) {
            // decorate to add the legend
            selection.enter()
                .append('g')
                .classed('legend-container', true)
                .layout({
                    position: 'absolute',
                    right: 50,
                    bottom: 80,
                    width: 90,
                    height: 372
                });
            // compute layout from the parent SVG
            selection.enter().layout();
            // render the legend
            selection.select('g.legend-container').call(legend);
        });

    function render() {
        d3.select("#chart")
            .datum(data)
            .call(chart);
    }
    render();
});
