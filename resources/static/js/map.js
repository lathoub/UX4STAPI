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

// Create empty chart. Observation will be added
// to the chart when the user click on the Market and Datastream

let chart = new Highcharts.Chart("chart", {
    title: { text: "" },
    legend: { enabled: true },
    yAxis: { title: "" },
    xAxis: { type: "datetime" },
    series: []
});

// update the charts every minute
setInterval(function () {

    return;

    var thingsName = getSelectedThings()
    for (const thingName of thingsName) {
        var thingCard = getThingCard(thingName)

        var listGroup = thingCard.childNodes[2]
        for (const datastreamItem of listGroup.childNodes) {
            if (!datastreamItem.className.includes('disabled')) {
                console.log("sss")
                // TODO: get the last observations
                // missing: thingId
                // add to chart
                // add last obs to this
            }
        }
    }
}, 5 * 1000);

// event handler that picks up on Marker clicks
function markerOnClick(event) {
    let thing = event.layer.feature;

    if (dictSelected[thing.name]) return;
    dictSelected[thing.name] = { "thing": thing, "datastreams": [] }

    var datastreamsHtml = ''
    thing.datastreams.forEach(function (datastream) {
        datastreamsHtml += '<label class="list-group-item">'
            + '<input class="form-check-input me-1" type="checkbox" value="">' + datastream.name + '<span class="badge bg-primary rounded-pill float-end"></span></label>'

        var obsUrl = datastream["@iot.selfLink"]
        obsUrl += "/Observations"
        obsUrl += "?$orderby=resultTime desc"
        obsUrl += "&$top=1"
        fetch(obsUrl) // get last observation
            .then(response => response.json())
            .then(body => {
                var datastreamItem = getDatastreamItem(thing.name, datastream)
                if (body.value.length > 0) {
                    var toen = moment(body.value[0].phenomenonTime)
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
        + '<button type="button" class="btn-close float-end" aria-label="Close"></button>'
        + '</h5>'
        + '<h6 class="card-title">' + thing.location.name + ", " + thing.location.description + '</h6>'
        + '<div class="list-group">'
        + datastreamsHtml
        + '</div>'
        + '</div>');
    myCard.appendTo('#contentPanel');

    $('.btn-close').on('click', function (e) {
        e.stopPropagation();
        var $target = $(this).parents('.col-sm-3'); // TODO
        $target.hide('fast', function () {
            $target.remove();
        });

        const thingName = this.parentNode.childNodes[0].textContent
        const thing = getThing(thingName)
        if (!thing) return // hmm, should already be selected 

        // remove from chart
        for (const datastream of dictSelected[thing.name].datastreams)
            chart.get(datastream["@iot.id"]).remove();

        // remove thing from selected things
        delete dictSelected[thing.name]
    });

    $('.form-check-input').change(function (e) {
        // from UI
        const datastreamName = this.parentNode.childNodes[1].data
        const thingName = this.parentNode.parentNode.parentNode.childNodes[0].textContent

        const thing = getThing(thingName)
        if (!thing) return // hmm, should already be selected 

        // get datastream id from datastream name
        const datastream = getDatastream(thing, datastreamName)
        if (!datastream) return // hmm, should already be selected 

        if ($(this).prop('checked')) {

            dictSelected[thing.name].datastreams.push(datastream["@iot.id"])

            // get the observation from the past 3 days
            // (3 days of observation is under 1000 observations)
            const startDateTime = moment(Date.now()).subtract(1, 'd')

            // request the more optimal dataArray for the results
            let observationsUrl = stapiBaseUrl + '/Things(' + thing.id + ')/Datastreams(' + datastream['@iot.id'] + ')'
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

                    // Add observations to the chart
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