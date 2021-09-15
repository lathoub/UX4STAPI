// Leaflet map initial view
let map = L.map('map').setView([0, 0], 12);

// Leaflet map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

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

            // Convert to geoJSON features (and add title (for tooltip) and icon)
            var geoJsonLayerGroup = L.geoJSON(geoJsonFeatures, {
                pointToLayer: function (feature, latlng) {
                    return L.marker(latlng, {
                        title: feature.name,
                        icon: (feature.properties.version == 6) ? goldIcon : (feature.properties.version == 7) ? greenIcon : blueIcon
                    });
                }
            }).addTo(markersClusterGroup);

            // Zoom in the map so that it fits the Things
            map.fitBounds(geoJsonLayerGroup.getBounds());
        })
})

// Create empty chart. Observation will be added
// to the chart when the user click on the Market and Datastream

// Display time as local time
Highcharts.setOptions({
    time: {
        useUTC: false
    }
});

let chart = new Highcharts.Chart("chart", {

    title: { text: "" },
    legend: { enabled: true },
    yAxis: {
        title: ""
    },
    xAxis: { type: "datetime" },
    series: []
});

// update the charts every minute
setInterval(function () {

    for (var thingName in dictSelected) {
        var thing = getThing(thingName)

        dictSelected[thingName].datastreams.forEach(function (datastreamId) {

            var data = chart.get(datastreamId)
            if (!data) return

            var lastDateTime = moment(data.xData[data.xData.length - 1])

            // request the more optimal dataArray for the results
            let observationsUrl = thing.resource + '/Datastreams(' + datastreamId + ')'
                + "/Observations"
                + "?$count=true"
                + "&$top=1000"
                + "&$resultFormat=dataArray"
                + "&$filter=resultTime%20gt%20" + lastDateTime.toISOString()
                + "&$orderby=resultTime asc"
            console.log(observationsUrl)
            fetch(observationsUrl)
                .then(response => response.json())
                .then(observations => {
                    // ROBIN: dit is de pagination, kijk naar beide logs
                    //console.log(observations['@iot.count'])
                    //console.log(observations['@iot.nextLink'])
                    // TODO: volgende query async runnen

                    var datastream = getDatastreamFromId(thing, datastreamId)
                    var datastreamItem = getDatastreamItem(thingName, datastream.name)

                    if (observations["@iot.count"] > 0) {
                        const components = observations.value[0].components
                        const dataArray = observations.value[0].dataArray
                        const it = components.indexOf("resultTime")
                        const ir = components.indexOf("result")

                        const data = dataArray.map(function (observation) {
                            let timestamp = moment(observation[it]).valueOf();
                            return [timestamp, parseFloat(observation[ir])];
                        });

                        for (var i = 0; i < data.length; i++)
                            chart.get(datastreamId).addPoint(data[i], true, true);

                        // update last update
                        lastDateTime = moment(data[data.length - 1][0])
                    }
                    datastreamItem.childNodes[2].textContent = lastDateTime.fromNow()
                })
        })
    }
}, 60 * 1000);

// event handler that picks up on Marker clicks
function markerOnClick(event) {
    let thing = event.layer.feature;

    if (dictSelected[thing.name]) return;
    dictSelected[thing.name] = { "thing": thing, "datastreams": [] }

    var datastreamsHtml = ''
    thing.datastreams.forEach(function (datastream) {
        datastreamsHtml += '<label class="list-group-item">'
            + '<input class="form-check-input me-1" type="checkbox" value="">' + datastream.name + '<span class="badge bg-primary rounded-pill float-end"></span></label>'

        var observationsUrl = datastream["@iot.selfLink"]
        observationsUrl += "/Observations"
        observationsUrl += "?$orderby=resultTime desc"
        observationsUrl += "&$top=1"
        observationsUrl = observationsUrl.replace("http://", "https://")
        console.log(observationsUrl)

        fetch(observationsUrl) // get last observation
            .then(response => response.json())
            .then(body => {
                // console.log(thing.name, datastream.name)
                var datastreamItem = getDatastreamItem(thing.name, datastream.name)
                // console.log(datastreamItem)
                if (body.value.length > 0) {
                    var phenomenonTimeInterval = body.value[0].phenomenonTime.split("/")
                    var toen = moment(phenomenonTimeInterval[phenomenonTimeInterval.length-1])
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
        + '<h5 class="card-header" class="card-header">'
        + '<span>' + thing.name + '</span>'
        + '<button type="button" class="btn-close btn-close-white float-end ms-2" aria-label="Close"></button>'
        // + '<button type="button" class="btn btn-outline-secondary btn-sm float-end ms-2">'
        // + '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">\n' +
        // '  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>\n' +
        // '  <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>\n' +
        // '</svg>'
        // + '</button>'
        // + '<button type="button" class="btn btn-outline-secondary btn-sm float-end">'
        // + '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-gear" viewBox="0 0 16 16">\n' +
        // '  <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>\n' +
        // '  <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>\n' +
        // '</svg>'
        // + '</button>'
        + '</h5>'
        + '<h6 class="card-title pt-2 pb-1 ms-3">' + thing.location.name + ", " + thing.location.description
        + '<button type="button" class="btn btn-outline-secondary btn-sm float-end me-2">Locate</button>'
        + '</h6>'
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
        const thingName = this.parentNode.parentNode.parentNode.childNodes[0].textContent

        const thing = getThing(thingName)
        if (!thing) return // hmm, should already be selected 

        // get datastream from datastream name
        const datastream = getDatastream(thing, datastreamName)
        if (!datastream) return // hmm, should already be selected 

        if ($(this).prop('checked')) {

            dictSelected[thing.name].datastreams.push(datastream["@iot.id"])

            // get the observation from the past 3 days
            // (3 days of observation is under 1000 observations)
            const startDateTime = moment(Date.now()).subtract(1, 'd')

            // request the more optimal dataArray for the results
            let observationsUrl = thing.resource + '/Datastreams(' + datastream['@iot.id'] + ')'
                + "/Observations"
                + "?$count=true"
                + "&$top=1000"
                + "&$resultFormat=dataArray"
                + "&$filter=resultTime%20ge%20" + startDateTime.toISOString()
                + "&$orderby=resultTime asc"
            fetch(observationsUrl)
                .then(response => response.json())
                .then(observations => {
                    // ROBIN: dit is de pagination, kijk naar beide logs
                    console.log(observations['@iot.count'])
                    console.log(observations['@iot.nextLink'])
                    // TODO: volgende query async runnen

                    const components = observations.value[0].components
                    const dataArray = observations.value[0].dataArray
                    const it = components.indexOf("resultTime")
                    const ir = components.indexOf("result")

                    const data = dataArray.map(function (observation) {
                        let timestamp = moment(observation[it]).valueOf();
                        return [timestamp, parseFloat(observation[ir])];
                    });


                    if (dictScale[datastreamName]) {
                        let scale = dictScale[datastreamName];
                        chart.update({
                            yAxis: {
                                tickPositions: scale
                            }
                        })
                    } else {
                        chart.update({
                            yAxis: {
                                tickPositions: undefined
                            }
                        })
                    }
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