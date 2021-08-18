var map = L.map('map').setView([0, 0], 12);

L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

axios.get('http://stapi.snuffeldb.synology.me/FROST-Server/v1.0/Locations').then(function(success) {

    // Convert the Locations into GeoJSON Features
    var geoJsonFeatures = success.data.value.map(function(location) {
        return {
            type: 'Feature',
            geometry: location.location,
        };
    });

    map.addControl(new L.Control.Fullscreen());
    map.isFullscreen() // Is the map fullscreen?
    map.toggleFullscreen() // Either go fullscreen, or cancel the existing fullscreen.

    map.on('fullscreenchange', function () {
        if (map.isFullscreen()) {
            console.log('entered fullscreen');
        } else {
            console.log('exited fullscreen');
        }
    });
    

    L.stam({
        baseUrl: "https://stapi.snuffeldb.synology.me/FROST-Server/v1.0",
        MarkerStyle: "yellow",
        clusterMin: 20,
        queryObject: {
            count: true,
            skip: 0,
            entityType: 'Things',
            top: 0
        },
        plot: {
            startDate: new Date(Date.now() - 1000*60*60*24*30),
            offset: 0,
            endDate: new Date()
        }
    }).addTo(map);

    // Create a GeoJSON layer, and add it to the map
    var geoJsonLayerGroup = L.geoJSON(geoJsonFeatures);
    geoJsonLayerGroup.addTo(map);

    // Zoom in the map so that it fits the Locations
    map.fitBounds(geoJsonLayerGroup.getBounds());
});
// Trying to add chart in panes

var datastreamURI = "https://stapi.snuffeldb.synology.me/FROST-Server/v1.0/Datastreams(63)/";
$.getJSON(datastreamURI, function(datastream) {
    $.getJSON(datastream["Observations@iot.navigationLink"], function(observations) {
        var data = $.map(observations.value, function(observation) {
            var timestamp = moment(observation.phenomenonTime).valueOf();
            return [[timestamp, parseFloat(observation.result)]];
        });
        data.sort(function(a, b) {
            return a[0] - b[0];
        });
    });
});

var chart = new Highcharts.StockChart("chart", {
    title: { text: "Loading Chart Data..." },
    series: []
});
chart.showLoading();

vchart.setTitle({ text: datastream.description });

var series = chart.addSeries({
    data: data,
    tooltip: {
        valueSuffix: " " + datastream.unitOfMeasurement.symbol
    }
});

series.yAxis.update({
    title: {
        text: datastream.unitOfMeasurement.name + " (" + datastream.unitOfMeasurement.symbol + ")"
    }
});
chart.hideLoading();