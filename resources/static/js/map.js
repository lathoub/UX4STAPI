// Leaflet map initial view
let map = L.map('map').setView([0, 0], 12);

//Empty array for selected markers
let selectedMarkers = [];
let selectedSeries = [];
//Base server URL
let stapiBaseUrl = 'https://stapi.snuffeldb.synology.me/FROST-Server/v1.0'

//Leaflet map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Get Location and Datastreams of all Things
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

        // Convert to geoJSON features (and add title (for tooltip) and icon)
        var geoJsonLayerGroup = L.geoJSON(geoJsonFeatures, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng, {
                    title: feature.description + ' ' + feature.name,
                });
            }
        }).addTo(markersClusterGroup);

        // Zoom in the map so that it fits the Things
        map.fitBounds(geoJsonLayerGroup.getBounds());
    })

// Create empty chart. Observation will be added
// to the chart when the user click on the Market and Datastream

let chart = new Highcharts.stockChart("chart", {
    title: { text: "" },
    legend: { enabled: true },
    yAxis: { title: "" },
    xAxis: { type: "datetime" },
    rangeSelector: {
        floating: true,
        y: -65,
        verticalAlign: 'bottom'
    },
    navigator: {
        margin: 60
    },
    series: []
});

// ROBIN: stond eerst beneden, kan hier staan!
chart.renderer.button('Clear chart', 300, 5)
    .attr({
        zIndex: 3
    })
    .on('click', function () {
        for (let i = chart.series.length - 1; i >= 0; i--) {
            chart.series[i].remove(false);
        }
        chart.redraw();
        selectedSeries = []; // ROBIN was je vergeten ;-)
    })
    .add();

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
        + '<button type="button" class="btn btn-primary" id="config' + '">Configure</button>'
        + '<button type="button" class="btn btn-primary" id="location' + '">Location</button>'
        + '<button type="button" class="btn btn-danger" id="delete' + '">Delete</button>'

    //Add things to list on marker click if unique
    if (selectedMarkers.includes(thing.name))
        return
    let thingy = document.getElementById("thingy");
    let additionalthing = document.createElement("div");
    additionalthing.setAttribute("id", thing.name);
    additionalthing.innerHTML = html;
    thingy.appendChild(additionalthing);

    selectedMarkers.push(thing.name);

    // Close opened things
    document.getElementById("close" + thing.name).onclick = function () {
        this.parentNode.parentNode.parentNode
            .removeChild(this.parentNode.parentNode);
        selectedMarkers = selectedMarkers.filter(additionalthing => additionalthing !== thing.name);
        chart.get(thing.name).remove(selectedSeries);
        return false;
    }

    //Open chart of selected datastream
    additionalthing.addEventListener("click", function (e) {
        if (e.target && e.target.nodeName === "LI") {

            let datastream = thing.datastreams.find(ds => ds.name == e.target.innerText);
            if (datastream == undefined) {
            } // TODO: error handling

            // ROBIN: ik heb dit naar boven gebracht, stond in event handler als data binnen kwam.
            // dit kan je reeds vroeger, en wordt nu niet telkens uitgevoerd wanneer data binnenkomt
            if (selectedSeries.includes(datastream.name))
                return null;
            selectedSeries.push(datastream.name);

            let observationsUrl = stapiBaseUrl + '/Things(' + thing.id + ')/Datastreams(' + datastream['@iot.id'] + ')'
                + "/Observations?$orderby=phenomenonTime asc&$count=true"

            $.getJSON(observationsUrl, function (observations) {

                // ROBIN: dit is de pagination, kijk naar beide logs
                console.log(observations['@iot.count'])
                console.log(observations['@iot.nextLink'])
                // TODO: volgende query async runnen

                let data = observations.value.map(function (observation) {
                    let timestamp = moment(observation.phenomenonTime).valueOf();
                    return [timestamp, parseFloat(observation.result)];
                });

                // Add observations to the chart
                chart.addSeries({
                    id: thing.name,
                    name: thing.name + '(' + thing.location.name + ')' + ", " + datastream.name,
                    data: data
                });
            });
        }
    });


    // let configButton = document.getElementById('config');
    // configButton.onclick = function () {
    //
    //
    // }

    //Location button to change the location for the Thing
    let locationButton = document.getElementById('location');
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

    //Delete button to delete Thing from server
    let deleteButton = document.getElementById('delete');
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

