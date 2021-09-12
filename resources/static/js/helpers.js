function getSelectedThings() {
    var thingsName = []
    var contentPanel = document.getElementById("contentPanel")
    for (const thingCard of contentPanel.childNodes)
        thingsName.push(thingCard.childNodes[0].textContent)
    return thingsName
}

function getThingCard(thingName) {
    var contentPanel = document.getElementById("contentPanel")
    for (const thingCard of contentPanel.childNodes)
        if (thingCard.childNodes[0].textContent == thingName)
            return thingCard
    return null
}

function getDatastreamItem(thingName, datastream) {
    var thingCard = getThingCard(thingName)
    if (thingCard) {
        var listGroup = thingCard.childNodes[2]
        for (const datastreamItem of listGroup.childNodes)
            if (datastreamItem.childNodes[1].textContent == datastream.name)
                return datastreamItem
    }
    return null
}