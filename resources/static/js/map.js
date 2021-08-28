// Leaflet map
var map = L.map('map').setView([0, 0], 12);

var stapiBaseUrl = 'http://stapi.snuffeldb.synology.me/FROST-Server/v1.0'

L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

$.getJSON(stapiBaseUrl + '/Locations', function (success) {

    // Convert the Locations into GeoJSON Features
    var geoJsonFeatures = success.value.map(function (location) {
        return {
            type: 'Feature',
            geometry: location.location,
        };
    });

    //map stats with plotly
    L.stam({
        baseUrl: stapiBaseUrl,
        MarkerStyle: "yellow",
        clusterMin: 20,
        queryObject: {
            count: true,
            skip: 0,
            entityType: 'Things',
            top: 0
        },
        plot: {
            startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
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

var datastreamURI = stapiBaseUrl + "/Things(15)/Datastreams(86)";
$.getJSON(datastreamURI, function (datastream) {
    console.log(datastream);
    var dsName = datastream.name;
    var dsUnitsOfMeasurement = datastream.unitOfMeasurement;
    var observationsNavLink = datastream["Observations@iot.navigationLink"];
    observationsNavLink += "?$orderby=resultTime asc"
    console.log(observationsNavLink)
    $.getJSON(observationsNavLink, function (observations) {
        console.log(observations);

         var obs = $.map(observations.value, function (observation) {
          var timestamp = moment(observation.phenomenonTime).valueOf();
            return [[timestamp, parseFloat(observation.result)]];
        });
         console.log(obs);

        var chart = new Highcharts.StockChart("chart", {
            title: {
                text: dsName
            },
            series: [{
                name: dsUnitsOfMeasurement.name,
                data: obs
            }]
        });
    });

   // chart.hideLoading();
});

