// Leaflet map initial view
let map = L.map('map').setView([0, 0], 12);

// Base server URL
let stapiBaseUrl = 'https://stapi.snuffeldb.synology.me/FROST-Server/v1.0'

// Leaflet map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

fetch(stapiBaseUrl + "/Things?$expand=Locations,Datastreams($orderby=name asc)")
    .then(response => response.json())
    .then(body => {
        // Layergroups allows for multiple Things to be at the same location
        // and still be able to select them indivisually
        let markersClusterGroup = L.markerClusterGroup().addTo(map);
        markersClusterGroup.on("click", markerOnClick);

        // Convert the Locations into GeoJSON Features
        let geoJsonFeatures = body.value.map(function (thing) {
            return {
                type: 'Feature',
                id: thing['@iot.id'],
                name: thing.name,
                description: thing.description,
                properties: thing.properties,
                location: thing.Locations[0],   // cache location info
                datastreams: thing.Datastreams, // cache Datastreams
                geometry: thing.Locations[0].location,
            };
        });

        var geoJsonLayerGroup = L.geoJSON(geoJsonFeatures, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng, {
                    title: feature.description +' ' + feature.name,
                    icon: (feature.properties.version == 6) ? goldIcon : (feature.properties.version == 7) ? greenIcon : blueIcon
                });
            }
        }).addTo(markersClusterGroup);

        // Zoom in the map so that it fits the Things
        map.fitBounds(geoJsonLayerGroup.getBounds());
    })

// Create empty chart. Observation will be added
// to the chart when the user click on the Market and Datastream

let chart = new Highcharts.Chart("chart", {
    title: { text: "" },
    legend: { enabled: true },
    yAxis: { title: "" },
    xAxis: { type: "datetime" },
    series: []
});

// event handler that picks up on Marker clicks
function markerOnClick(event) {
    let thing = event.layer.feature;

    var chunck = ''
    thing.datastreams.forEach(function (datastream) {
        chunck += '<label class="list-group-item"><input class="form-check-input me-1" type="checkbox" value="">' + datastream.name + '<span class="badge bg-primary rounded-pill">14 minutes ago</span></label>'
    });

    var myCard = $('<div class="card card-outline-info" id="bbb">'
        + '<h5 class="card-header">'
        + '<span>' + thing.description + ", " + thing.name + '</span>'
        + '<button type="button" class="btn-close float-end" aria-label="Close"></button>'
        + '</h5>'
        + '<h5 class="card-title">' + thing.location.name + ", " + thing.location.description + '</h5>'
        + '<h6 class="card-title">DataStreams:</h6>'
        //    + '<div class="row">'
        + chunck
        //    + '</div>'
        + '</div>');
    myCard.appendTo('#contentPanel');

    $('.btn-close').on('click', function (e) {
        e.stopPropagation();
        var $target = $(this).parents('.col-sm-3');
        $target.hide('fast', function () {
            $target.remove();
        });
    });

}