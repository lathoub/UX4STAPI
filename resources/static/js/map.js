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
    series: []
});

// event handler that picks up on Marker clicks
function markerOnClick(event) {

    var thingId = event.layer.feature.id;

    // TODO: iets met Bootstrap cards?
    // https://getbootstrap.com/docs/4.0/components/card/

    var html = '<h1>' + event.layer.feature.name + '</h1>';

    event.layer.feature.datastreams.forEach(function (datastream){
       html +=  '<li>' + datastream.name + '</li>'
    });

    html = '<ul>' + html + '</ul>'

    document.querySelector('#thingy').innerHTML=  html;


    // thingy.innerHTML += success.description;

       // success.Datastreams.forEach(val => {
       //     thingy.innerHTML += val.name;
       //     thingy.innerHTML += val.description; // when clicked, the observations are added to the graph
       // });
    //

    var datastreamId = event.layer.feature.datastreams[0]['@iot.id'];
    // TODO: if datastreamId already on the chart? If so, return

    var observationsUrl = stapiBaseUrl + '/Things(' + thingId + ')/Datastreams(' + datastreamId + ')?$expand=Observations($orderby=resultTime asc)';
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
            name: datastream.unitOfMeasurement.name,
            data: obs
        });

    });

}