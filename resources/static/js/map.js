// Leaflet map initial view
let map = L.map('map').setView([0, 0], 12);

//Empty array for selected markers
let selectedMarkers = [];

//Base server URL
let stapiBaseUrl = 'https://stapi.snuffeldb.synology.me/FROST-Server/v1.0'

//Leaflet map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Get Location and Datastreams of all Things
$.getJSON(stapiBaseUrl + "/Things?$expand=Locations,Datastreams($orderby=name asc)", function (things) {

    // Layergroups allows for multiple Things to be at the same location
    // and still be able to select them indivisually
    let markersClusterGroup = L.markerClusterGroup().addTo(map);
    markersClusterGroup.on("click", markerOnClick);

    // Convert the Locations into GeoJSON Features
    let geoJsonFeatures = things.value.map(function (thing) {
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
    let geoJsonLayerGroup = L.geoJSON(geoJsonFeatures);
    geoJsonLayerGroup.addTo(markersClusterGroup);

    // Zoom in the map so that it fits the Things
    map.fitBounds(geoJsonLayerGroup.getBounds());
});

// Create empty chart. Observation will be added
// to the chart when the user click on the Market and Datastream

let chart = new Highcharts.Chart("chart", {
    title: {text: ""},
    legend: {enabled: true},
    yAxis: {title: ""},
    xAxis: {type: "datetime"},
    series: []
});


// event handler that picks up on Marker clicks
function markerOnClick(event) {
    let thing = event.layer.feature;
    let html = '';

    //Fill up div with thing information
    html += '<h1>' + thing.name + '</h1>';
    html += '<h2>' + thing.location.name + '</h2>';
    html += '<h3>' + 'Datastreams:' + '</h3>';
    thing.datastreams.forEach(function (datastream) {
        html += '<li>' + datastream.name + '</li>'
    });

    html = '<ul id="datastreamlist">' + '<span id="close' + thing.name + '">x</span>' + html + '</ul>'
        + '<button id="config' + thing.name + '">Configure</button>'
        + '<button id="location' + thing.name + '">Location</button>'
        + '<button id="delete' + thing.name + '">Delete</button>'


    //Add things to list on marker click if unique
    if (selectedMarkers.includes(thing.name)) {
        return alert("Device already selected.");

    }
    let thingy = document.getElementById("thingy");
    let additionalthing = document.createElement("div");
    additionalthing.setAttribute("id", thing.name);
    additionalthing.innerHTML = html;
    thingy.appendChild(additionalthing);

    selectedMarkers.push(thing.name);


    console.log(thingy);
    console.log(thing.name);


    //Close opened things
    document.getElementById("close" + thing.name).onclick = function () {
        this.parentNode.parentNode.parentNode
            .removeChild(this.parentNode.parentNode);
        selectedMarkers = selectedMarkers.filter(additionalthing=> additionalthing!== thing.name);
        return false;
    }


    //Open chart of selected datastream
    additionalthing.addEventListener("click", function (e) {
        if (e.target && e.target.nodeName === "LI") {

            console.log(thing.id)

            let datastream = thing.datastreams.find(ds => ds.name == e.target.innerText);
            if (datastream == undefined) {
            } // TODO: error handling

            let observationsUrl = stapiBaseUrl + '/Things(' + thing.id + ')/Datastreams(' + datastream['@iot.id'] + ')?$expand=Observations($orderby=resultTime asc)';
            $.getJSON(observationsUrl, function (datastream) {

                let obs = datastream.Observations.map(function (observation) {
                    let timestamp = moment(observation.phenomenonTime).valueOf();
                    return [timestamp, parseFloat(observation.result)];
                });

                if (event.originalEvent.shiftKey) {
                    // add to
                } else {
                    // Single replaces
                }

                // Add observations to the chart
                chart.addSeries({
                    id: thing.name,
                    name: "Snuffel " + thing.name + '(' + thing.location.name + ')' + ", " + datastream.name,
                    data: obs
                });

                chart.renderer.button('Clear chart', 300, 5)
                    .attr({
                        zIndex: 3
                    })
                    .on('click', function () {
                        for (let i = chart.series.length - 1; i >= 0; i--) {
                            chart.series[i].remove(false);
                        }
                        chart.redraw();
                    })
                    .add();

            });


        }
    });


    // let configButton = document.getElementById('config');
    // configButton.onclick = function () {
    //
    //
    // }

    let locationButton = document.getElementById('location' + thing.name);
    locationButton.onclick = function () {
        let address = prompt("Enter new address or location name for the device:", "");
        if (address && address !== '') {

            // TODO geocode from address to lat,lng
            var lat = 51
            var lng = 4

            var newLocation = {}
            newLocation.name = address
            newLocation.description = address
            newLocation.encodingType = 'application/vnd.geo+json'
            newLocation.location = {}
            newLocation.location.type = 'point'
            newLocation.location.coordinates = [lat, lng]

            let deviceName = this.parentElement.id;

            $.post(stapiBaseUrl + '/Things(' + deviceName + ')/Locations', newLocation)
                .done(function (data) {
                    console.log(data); // TODO: get device name from parent card
                    // TODO: refresh map
                    // indivisual marker should be relocatable (for admin)
                });
        }
    }

    let deleteButton = document.getElementById('delete' + thing.name);
    deleteButton.onclick = function () {
        let inDeviceName = prompt("Enter the device name to confirm deletion:", "");
        if (inDeviceName) {

            let deviceName = this.parentElement.id;
            if (inDeviceName === deviceName) {
                // $.ajax({
                //     url: stapiBaseUrl + '/Things(' + deviceName + ')',
                //     type: 'DELETE',
                //     success: function (result) {
                //         console.log('delete device success');
                //     }
                // });
            } else
                alert('device name did not match, delete aborted');
        }
    }
}

