// Leaflet map
var map = L.map('map').setView([0, 0], 12);

var stapiBaseUrl = 'http://stapi.snuffeldb.synology.me/FROST-Server/v1.0'

L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Get Location and Datastreams of all Things
$.getJSON(stapiBaseUrl + "/Things?$expand=Locations,Datastreams", function (things) {

    var markersClusterGroup = L.markerClusterGroup().addTo(map);

    // Convert the Locations into GeoJSON Features
    var geoJsonFeatures = things.value.map(function (thing) {
        return {
            type: 'Feature',
            id: thing['@iot.id'],
            location: thing.Locations[0],   // cache location info
            datastreams: thing.Datastreams, // cache Datastreams
            geometry: thing.Locations[0].location,
        };
    });

    // Add geojson to LayerGroup
    //
    // Layergroups allows for multiple Things to be at the same location
    // and still be able to select them indivisually
    var geoJsonLayerGroup = L.geoJSON(geoJsonFeatures);
    geoJsonLayerGroup.addTo(markersClusterGroup);

    // Zoom in the map so that it fits the Things
    map.fitBounds(geoJsonLayerGroup.getBounds());
});

// Create chart
var datastreamURI = stapiBaseUrl + "/Things(15)/Datastreams(86)?$expand=Observations($orderby=resultTime asc)";
$.getJSON(datastreamURI, function (datastream) {

    var obs = datastream.Observations.map(function (observation) {
        var timestamp = moment(observation.phenomenonTime).valueOf();
        return [timestamp, parseFloat(observation.result)];
    });

    var chart = new Highcharts.StockChart("chart", {
        title: {
            text: datastream.name
        },
        series: [{
            name: datastream.unitOfMeasurement.name,
            data: obs
        }]
    });

});