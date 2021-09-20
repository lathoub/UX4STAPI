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

                    var marker = L.marker(latlng, {
                        title: feature.name,
                        //             draggable: true,
                        icon: (feature.properties.version == 6) ? goldIcon : (feature.properties.version == 7) ? greenIcon : blueIcon
                    });

                    marker.on("dragstart", function (e) {
                    });
                    marker.on("dragend", function (e) {
                        console.log(e)
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
        title: "",
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
        + '<button type="button" id="header-button-delete" class="btn btn-danger btn-sm float-end">Delete</button>'
        + '<button type="button" id="header-button-configure" class="btn btn-primary btn-sm float-end admin-buttons">Configure</button>'
        + '</h5>'
        + '<div id="card-title" class="card-title">' + thing.location.name + ", " + thing.location.description
        + '<button type="button" id="title-button-locate" class="btn btn-primary btn-sm float-end admin-buttons">Move</button>'
        + '</div>'
        + '<div class="list-group">'
        + datastreamsHtml
        + '</div>'
        + '</div>');
    myCard.appendTo('#contentPanel');

    $('#header-button-delete').on('click', function (e) {
        //  $('#exampleModal').modal('show'); 
        let deviceName = prompt("Enter the device name to confirm deletion:", "");
        if (deviceName) {
            if (deviceName == $(this)[0].parentNode.childNodes[0].textContent) {
                $.ajax({
                    url: stapiBaseUrl + '/Things(' + deviceName + ')',
                    type: 'DELETE',
                    success: function (result) {
                        console.log('delete device success');
                    }
                });
            }
            else
                alert('device name did not match, delete aborted');
        }
    })

    $('#header-button-configure').on('click', function (e) {
    })

    $('#title-button-locate').on('click', function (e) {

        var parent = $(this)[0].parentNode.parentNode
        var thingName = parent.childNodes[0].childNodes[0].textContent

        if ($(this).text() == "Move") {
            // Start to move the Marker/Thing

            // ADD: 2 text edit

            $("#card-title").append(
                '<input type="text" id="name" class="form-control" placeholder="name" aria-label="Username">'
                + '<input type="text" id="description" class="form-control" placeholder="description" aria-label="Username">'
            )

            map.eachLayer(function (layer) {
                if (layer instanceof L.Marker) {
                    if (layer.feature && layer.feature.name == thingName) {
                        layer.dragging.enable()

                        $("#name").val(layer.feature.location.name)
                        $("#description").val(layer.feature.location.description)
                    }
                }
            });

            $(this).text("Done")

        } else {
            // End move of the Marker/Thing

            // lock the item
            map.eachLayer(function (layer) {
                if (layer instanceof L.Marker) {
                    if (layer.feature) {
                        if (layer.feature.name == thingName) {
                            layer.dragging.disable()

                            layer.feature.location.name = $("#name").val()
                            layer.feature.location.description = $("#description").val()

                            var newLocation = {};
                            newLocation.name = layer.feature.location.name
                            newLocation.description = layer.feature.location.description
                            newLocation.encodingType = 'application/vnd.geo+json'
                            newLocation.location = {}
                            newLocation.location.type = 'Point'
                            newLocation.location.coordinates = [layer._latlng.lng, layer._latlng.lat]

                            fetch(layer.feature.resource + '/Locations', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(newLocation)
                            })
                                .then(response => {
                                    response.json()
                                })
                                .then(data => {
                                    console.log('Success:');
                                })
                                .catch((error) => {
                                    console.error('Error:', error);
                                });

                            // remove inputs
                            $("#card-title").remove('#name')
                            $("#card-title").remove('#description')
                        }
                    }
                }
            });

            $(this).text("Move")
        }
    })

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