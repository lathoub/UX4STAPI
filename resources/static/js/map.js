// Leaflet map
var map = L.map('map').setView([0, 0], 12);

var stapiBaseUrl = 'http://stapi.snuffeldb.synology.me/FROST-Server/v1.0'

L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Get Location and Datastreams of all Things
$.getJSON(stapiBaseUrl + "/Things?$expand=Locations,Datastreams($orderby=name asc)", function (things) {

    // Layergroups allows for multiple Things to be at the same location
    // and still be able to select them indivisually
    var markersClusterGroup = L.markerClusterGroup().addTo(map);
    markersClusterGroup.on("click", markerOnClick);

    // Convert the Locations into GeoJSON Features
    var geoJsonFeatures = things.value.map(function (thing) {
        return {
            type: 'Feature',
            id: thing['@iot.id'],
            name: thing.name,
            description: thing.description,
            location: thing.Locations[0],   // cache location info
            datastreams: thing.Datastreams, // cache Datastreams
            geometry: thing.Locations[0].location,
        };
    });

    // Add geojson to LayerGroup
    var geoJsonLayerGroup = L.geoJSON(geoJsonFeatures);
    geoJsonLayerGroup.addTo(markersClusterGroup);

    // Zoom in the map so that it fits the Things
    map.fitBounds(geoJsonLayerGroup.getBounds());
});

// Create empty chart. Observation will be added
// to the chart when the user click on the Market and Datastream
var chart = new Highcharts.StockChart("chart", {
    title: { text: "" },
    legend: { enabled: true },
    series: []
});


// event handler that picks up on Marker clicks
function markerOnClick(event) {

    var thing = event.layer.feature;

    // TODO: iets met Bootstrap cards?
    // https://getbootstrap.com/docs/4.0/components/card/

    var html = '';
    html += '<h1>' + thing.name + '</h1>';
    html += '<h2>' + thing.location.name + '</h2>';
    html += '<h3>' + 'Datastreams:' + '</h3>';
    thing.datastreams.forEach(function (datastream) {
        html += '<li>' + datastream.name + '</li>'
    });

    html = '<ul id="datastreamlist">' + html + '</ul>'
        + '<button id="config">Configure</button>'
        + '<button id="position">Position</button>'
        + '<button id="delete">Delete</button>'


    document.querySelector('#thingy').innerHTML = html;

    document.getElementById("datastreamlist").addEventListener("click", function (e) {
        if (e.target && e.target.nodeName === "LI") {

            var datastream = thing.datastreams.find(ds => ds.name == e.target.innerText);
            if (datastream == undefined) { } // TODO: error handling

            var observationsUrl = stapiBaseUrl + '/Things(' + thing.id + ')/Datastreams(' + datastream['@iot.id'] + ')?$expand=Observations($orderby=resultTime asc)';
            $.getJSON(observationsUrl, function (datastream) {

                var obs = datastream.Observations.map(function (observation) {
                    var timestamp = moment(observation.phenomenonTime).valueOf();
                    return [timestamp, parseFloat(observation.result)];
                });

                if (event.originalEvent.shiftKey) {
                    // add to
                } else {
                    // Single replaces
                }

                // Add observations to the chart
                chart.addSeries({
                    id: 'dada',
                    name: "Snuffel " + thing.name + '(' + thing.location.name + ')' + ", " + datastream.name,
                    data: obs
                });

            });
        }
    });

}