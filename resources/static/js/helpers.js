var dictSelected = {}

var dictScale = {}
dictScale["AirTemperature"] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
dictScale["NO2"] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
dictScale["PM10"] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
dictScale["PM25"] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
dictScale["RelativeHumidity"] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
dictScale["SoundPressure"] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

// database of serice endpoints
serviceEndpoints = [
    {
        name: "Aardvark",
        url: "https://aardvark.myDS.me/FROST-Server/v1.1"
    },
]

function getThingCard(thingName) {
    var contentPanel = document.getElementById("contentPanel")
    for (const thingCard of contentPanel.childNodes) {
        var headerItem = thingCard.childNodes[0]
        var thingItem = headerItem.childNodes[0]
        if (thingItem.textContent == thingName)
            return thingCard
    }
    console.log("getThingCard returned null")
    return null
}

function getDatastreamItem(thingName, datastreamName) {
    var thingCard = getThingCard(thingName)
    if (thingCard) {
        var listGroup = thingCard.childNodes[2]
        for (const datastreamItem of listGroup.childNodes)
            if (datastreamItem.childNodes[1].textContent == datastreamName)
                return datastreamItem
    }
    console.log("getDatastreamItem returned null")
    return null
}

function getThing(name) {
    var thingProxy = dictSelected[name]
    if (!thingProxy) return null
    return thingProxy.thing
}

function getDatastream(thing, name) {
    for (const datastream of thing.datastreams) {
        if (datastream.name == name)
            return datastream
    }
    return null
}

function getDatastreamFromId(thing, id) {
    for (const datastream of thing.datastreams) {
        if (datastream["@iot.id"] == id)
            return datastream
    }
    return null
}
