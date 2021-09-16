// Leaflet map initial view
let map = L.map('map').setView([0, 0], 12);

// Leaflet map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// endpoint taken from https://inspire.ec.europa.eu/good-practice/ogc-sensorthings-api-inspire-download-service
var serviceEndpoint = prompt("Please enter a SensorThings API endpoint", " https://covidsta.hft-stuttgart.de/server/v1.1");
serviceEndpoints.push({ name: "demo", url: serviceEndpoint })

// var dictEndpoints
serviceEndpoints.forEach(function (endpoint) {

    console.log(endpoint.url)
    var url = endpoint.url + "/Things?$expand=Locations,Datastreams($orderby=name asc)"
    console.log(url)

    fetch(url)
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
                    resource: endpoint.url + "/Things(" + thing['@iot.id'] + ")",
                    name: thing.name,
                    properties: thing.properties,
                    location: thing.Locations[0],   // cache location info
                    datastreams: thing.Datastreams, // cache Datastreams
                    geometry: thing.Locations[0].location,
                };
            });

            // Convert to geoJSON features (and add title (for tooltip))
            var geoJsonLayerGroup = L.geoJSON(geoJsonFeatures, {
                pointToLayer: function (feature, latlng) {

                    var marker = L.marker(latlng, {
                        title: feature.name
                    });
                    return marker
                }
            }).addTo(markersClusterGroup);

            // Zoom in the map so that it fits the Things
            map.fitBounds(geoJsonLayerGroup.getBounds());
        })
})

// Create empty chart. Observation will be added
// to the chart when the user click on the Market and Datastream

Highcharts.setOptions({
    time: {
        useUTC: false // Display time as local time
    }
});

let chart = new Highcharts.Chart("chart", {

    title: { text: "" },
    legend: { enabled: true },
    xAxis: { type: "datetime" },
    series: []
});

// event handler that picks up on Marker clicks
function markerOnClick(event) {
    let thing = event.layer.feature;

    if (dictSelected[thing.name]) return;
    dictSelected[thing.name] = { "thing": thing, "datastreams": [] }

    var datastreamsHtml = ''
    thing.datastreams.forEach(function (datastream) {
        datastreamsHtml += '<label class="list-group-item">'
            + '<input class="form-check-input me-1" type="checkbox" value="">' + datastream.name + '<span class="badge bg-primary rounded-pill"></span></label>'
        var observationsUrl = datastream["@iot.selfLink"]
        observationsUrl += "/Observations"
        observationsUrl += "?$orderby=resultTime desc"
        observationsUrl += "&$top=1"

        observationsUrl = observationsUrl.replace("http://", "https://")
        console.log(observationsUrl)

        fetch(observationsUrl) // get last observation
            .then(response => response.json())
            .then(body => {
                var datastreamItem = getDatastreamItem(thing.name, datastream.name)
                if (body.value.length > 0) {
                    var phenomenonTimeInterval = body.value[0].phenomenonTime.split("/")
                    var toen = moment(phenomenonTimeInterval[phenomenonTimeInterval.length - 1])
                    datastreamItem.className = "list-group-item"
                    datastreamItem.childNodes[2].textContent = toen.fromNow()
                    datastreamItem.childNodes[2].className = "badge bg-primary rounded-pill float-end"
                } else {
                    datastreamItem.className = "list-group-item disabled"
                    datastreamItem.childNodes[2].textContent = "no data"
                    datastreamItem.childNodes[2].className = "badge bg-warning rounded-pill float-end"
                }
            });
    });

    var myCard = $('<div class="card card-outline-info" id="bbb">'
        + '<h5 class="card-header">'
        + '<span>' + thing.name + '</span>'
        + '<button type="button" class="btn-close btn-close-white float-end" aria-label="Close"></button>'
        + '</h5>'
        + '<div id="card-title" class="card-title">' + thing.location.name + ", " + thing.location.description
        + '</div>'
        + '<div class="list-group">'
        + datastreamsHtml
        + '</div>'
        + '</div>');
    myCard.appendTo('#contentPanel');

    $('.btn-close').on('click', function (e) {
        e.stopPropagation();

        const thingName = this.parentNode.childNodes[0].textContent
        const thing = getThing(thingName)
        if (!thing) return // hmm, should already be selected 

        // remove from chart
        for (const datastreamId of dictSelected[thing.name].datastreams)
            chart.get(datastreamId).remove();

        // remove thing from selected things
        delete dictSelected[thing.name]

        var $target = $(this).parents('.card');
        $target.hide('fast', function () {
            $target.remove();
        });

    });

    $('.form-check-input').change(function (e) {
        // from UI
        const datastreamName = this.parentNode.childNodes[1].data
        const thingName = this.parentNode.parentNode.parentNode.childNodes[0].childNodes[0].textContent

        const thing = getThing(thingName)
        if (!thing) return // hmm, should already be selected 

        // get datastream from datastream name
        const datastream = getDatastream(thing, datastreamName)
        if (!datastream) return // hmm, should already be selected 

        if ($(this).prop('checked')) {

            dictSelected[thing.name].datastreams.push(datastream["@iot.id"])

            // request the more optimal dataArray for the results
            let observationsUrl = thing.resource + '/Datastreams(' + datastream['@iot.id'] + ')'
                + "/Observations"
                + "?$count=true"
                + "&$top=1000"
                + "&$resultFormat=dataArray"
                + "&$orderby=resultTime asc"
            fetch(observationsUrl)
                .then(response => response.json())
                .then(observations => {
                    console.log(observations['@iot.count'])
                    console.log(observations['@iot.nextLink'])
                    // TODO: next query async 

                    const components = observations.value[0].components
                    const dataArray = observations.value[0].dataArray
                    const it = components.indexOf("resultTime")
                    const ir = components.indexOf("result")

                    const data = dataArray.map(function (observation) {
                        let timestamp = moment(observation[it]).valueOf();
                        return [timestamp, parseFloat(observation[ir])];
                    });

                    chart.addSeries({
                        id: datastream["@iot.id"],
                        name: thing.name + '(' + thing.location.name + ')' + ", " + datastream.name,
                        data: data
                    });
                })

        } else {
            // remove datastream id
            dictSelected[thing.name].datastreams = dictSelected[thing.name].datastreams.filter(function (value, index, arr) {
                return value != datastream["@iot.id"];
            });
            chart.get(datastream["@iot.id"]).remove();
        }
    })

    return;

}