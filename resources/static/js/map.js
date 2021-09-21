// Leaflet map initial view
let map = L.map('map').setView([0, 0], 12);

// Leaflet map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Layergroups allows for multiple Things to be at the same location
// and still be able to select them indivisually
let markersClusterGroup = L.markerClusterGroup().addTo(map);
markersClusterGroup.on("click", markerOnClick);

// var dictEndpoints
serviceEndpoints.forEach(function (endpoint) {

    console.log(endpoint.url)

    if (endpoint.url.includes("WFS")) {
        console.log("WFS")
        var url = endpoint.url + "&request=GetCapabilities"
        console.log(url)

        // TODO: how to import into proj??
        const epsg31370 = "+proj=lcc +lat_1=51.16666723333333 +lat_2=49.8333339 +lat_0=90 +lon_0=4.367486666666666 +x_0=150000.013 +y_0=5400088.438 +ellps=intl +towgs84=-106.8686,52.2978,-103.7239,0.3366,-0.457,1.8422,-1.2747 +units=m +no_defs";

        // O G C   W e b   F e a t u r e   S e r v i c e
        fetch(url)
            .then(response => response.text())
            .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
            .then(body => {
                var datastreams = []
                $(body).find('FeatureTypeList').each(function () {
                    $(this).find('FeatureType').each(function () {
                        var datastream = {}
                        datastream["name"] = $(this).find("Name")[0].textContent
                        datastream["title"] = $(this).find("Title")[0].textContent
                        datastream["description"] = $(this).find("Abstract")[0].textContent
                        datastream["@iot.id"] = datastream["name"]
                        datastream["@iot.selfLink"] = endpoint.url + "&request=GetFeature&typeName=" + datastream["name"] + "&outputFormat=json"
                        datastreams.push(datastream)
                    })
                })
                return datastreams
            })
            .then(datastreams => {
                var url = endpoint.url + "&request=GetFeature&typeName=" + "sos_station" + "&outputFormat=json"
                console.log(url)
                fetch(url)
                    .then(response => response.json())
                    .then(body => {
                        console.log(body)

                        var projectionName = body.crs.type + ":" + body.crs.properties.code

                        // Convert the Locations into GeoJSON Features
                        var geoJsonFeatures = body.features.map(function (feature) {
                            feature.geometry.coordinates = proj4(epsg31370, 'WGS84', feature.geometry.coordinates)
                            return {
                                type: 'Feature',
                                id: feature.id,
                                //       resource: endpoint.url + "/Things(" + thing['@iot.id'] + ")",
                                name: feature.properties.ab_eoi_code,
                                properties: feature.properties,
                                location: { "name": feature.properties.ab_name, description: "" },
                                datastreams: datastreams, // cache Datastreams
                                geometry: feature.geometry,
                            };
                        });

                        // Convert to geoJSON features (and add title (for tooltip) and icon)
                        var geoJsonLayerGroup = L.geoJSON(geoJsonFeatures, {
                            pointToLayer: function (feature, latlng) {

                                var marker = L.marker(latlng, {
                                    title: feature.name,
                                    icon: violetIcon
                                });

                                return marker
                            }
                        }).addTo(markersClusterGroup);

                        if (Object.keys(geoJsonLayerGroup._layers).length)
                            map.fitBounds(geoJsonLayerGroup.getBounds());
                    })
            })
        /*
        */
    } else {
        // O G C   S E N S O R T H I N G S   A P I 

        var url = endpoint.url + "/Things?$expand=Locations,Datastreams($orderby=name asc)"

        fetch(url)
            .then(response => response.json())
            .then(body => {

                // Convert the Locations into GeoJSON Features
                var geoJsonFeatures = body.value.map(function (thing) {
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
                            icon: (feature.properties.version == 6) ? goldIcon : (feature.properties.version == 7) ? greenIcon : blueIcon
                        });

                        return marker
                    }
                }).addTo(markersClusterGroup);

                // Zoom in the map so that it fits the Things
                if (Object.keys(geoJsonLayerGroup._layers).length)
                    map.fitBounds(geoJsonLayerGroup.getBounds());
            })

    }

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

/*
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
*/
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
        if (!observationsUrl.includes("WFS")) observationsUrl += "/Observations?$orderby=resultTime desc&$top=1"
        if (observationsUrl.includes("WFS")) observationsUrl += "&count=1&cql_filter=ab_eoi_code='" + thing.name + "'"

        observationsUrl = observationsUrl.replace("http://", "https://")

        console.log(observationsUrl)

        if (observationsUrl.includes("WFS"))
            fetch(observationsUrl) // get last observation
                .then(response => response.json())
                .then(body => {
                    var datastreamItem = getDatastreamItem(thing.name, datastream.name)
                    if (body.features.length > 0) {
                        var timestamp = body.features[0].properties.timestamp
                        var toen = moment(timestamp)
                        datastreamItem.className = "list-group-item"
                        datastreamItem.childNodes[2].textContent = toen.fromNow()
                        datastreamItem.childNodes[2].className = "badge bg-primary rounded-pill float-end"
                    } else {
                        datastreamItem.className = "list-group-item disabled"
                        datastreamItem.childNodes[2].textContent = "no data"
                        datastreamItem.childNodes[2].className = "badge bg-warning rounded-pill float-end"
                    }
                });
        else
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

            // get the observation from the past 3 days
            // (3 days of observation is under 1000 observations)
            const startDateTime = moment(Date.now()).subtract(3, 'd')

            if (datastream['@iot.selfLink'].includes("WFS")) {
                // request the more optimal dataArray for the results
                let observationsUrl = datastream['@iot.selfLink']
                observationsUrl += "&cql_filter=ab_eoi_code='" + thing.name + "'"
                observationsUrl += "&sortby=timestamp"

                console.log(observationsUrl)

                fetch(observationsUrl)
                    .then(response => response.json())
                    .then(observations => {
                        const data = observations.features.map(function (observation) {
                            let timestamp = moment(observation.properties.timestamp).valueOf();
                            let value = parseFloat(observation.properties.value)
                            return [timestamp, value];
                        });

                        const data2 = data.filter(obs => {
                            return obs[1] > 0
                        })

                        chart.addSeries({
                            id: datastream["@iot.id"],
                            name: thing.name + '(' + thing.location.name + ')' + ", " + datastream.name,
                            data: data2
                        });
                    })
            }
            else {
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
                            let value = parseFloat(observation[ir])
                            return [timestamp, value];
                        });

                        chart.addSeries({
                            id: datastream["@iot.id"],
                            name: thing.name + '(' + thing.location.name + ')' + ", " + datastream.name,
                            data: data
                        });
                    })

            }

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