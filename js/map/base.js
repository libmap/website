import { map, icon, Marker } from 'leaflet';
import 'leaflet-control-geocoder';
import './geoip.js';
import './marker/control.js';
import { layerSets, layers } from './layers/sets.js';
import tweets from './tweets.js';
import url from './url.js';
import twitter from './twitter.js';
import controls from './controls.js';
import 'leaflet-control-window';
import 'leaflet-draw';
import 'jquery';
import 'leaflet-easybutton';
import './scripts/leaflet.magnifyingglass.js';
import 'leaflet-minimap';
import 'leaflet.locatecontrol';
import sidebar from './sidebar.js';
import api from './api/proxy.js';
import search from './search.js';
import 'protomaps-leaflet';
import { PMTiles, leafletRasterLayer } from 'pmtiles';

let GeoJSON = require('geojson');

// Find better solution soon
const iconRetinaUrl = '../../../static/leaflet/dist/images/marker-icon-2x.png';
const iconUrl = '../../../static/leaflet/dist/images/marker-icon.png';
const shadowUrl = '../../../static/leaflet/dist/images/marker-shadow.png';
const iconDefault = icon({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

Marker.prototype.options.icon = iconDefault;

let defaultState = {
    zoom: 3,
    center: {
        lat: 22,
        lng: 0,
    },
    layers: [
        'streets',
        //'energy',
        //'manufacturing',
        //'fossil-fuel-operations',
        //'power-plants',
        //'no2_2021_test',
        'tweets'
    ]
}

let defaultOptions = {
    zoomControl: false,
    tap: true,
    maxZoom: 19,
    //touchZoom: 'center',
    //drawControl: true
}

let popupoptions = { 
    maxWidth: 700,
    autoPan: false 
}


document.getElementById('toggleSidebar').addEventListener('click', function () {
    setTimeout(() => {
        // Update Leaflet map size
        // if (base.map) {
        //     base.map.invalidateSize();
        // }

        // if (base.minimap && base.minimap._map) {
        //     base.minimap._map.invalidateSize();  // Adjust minimap's size and position
        // }

        // Force a slight scroll to trigger the address bar to show (for mobile devices)
        // window.scrollTo(0, 0);  // Scroll to the top of the page

        // Trigger a resize event if needed
        window.dispatchEvent(new Event('resize'));
    }, 500);
});

L.Circle.include({
    contains: function (latLng) {
        return this.getLatLng().distanceTo(latLng) < this.getRadius();
    }
});

let tweetBoxActive = false;

let radius_zoom = [1, 1, 1, 1, 2.5, 4, 5.5, 7.5, 9.8, 12.5, 15.4, 19, 23, 27.2, 32, 37.2, 40, 40, 40, 40, 40];

let base = {
    map: null,
    slowFlyTo: true,
    layerSets: {},
    layers: {},
    externalJSON: false,
    pushState: false,
    stateArray: [],
    markersOnMap: {},
    visibleTweetIds: [],
    initVisibleTweetIds: [],
    miniMap: null,
    validJsonUrl: false,
    stateBefore: null,
    magnifyingGlass: null,
    country_n: 4,
    editableLayers: new L.FeatureGroup(),

    init: function () {
        // init leaflet map
        
        let state = url.getState();

        if (!state.center && state.center !== 0) {
            state.center = defaultState.center;
            state.zoom = defaultState.zoom;
        }


        base.map = map('map', {
            ...defaultOptions,
        });

        base.map.setView(state.center, state.zoom);

        //base.map.attributionControl.setPrefix('')
        
        
        controls.addControls();
        base.addControls();
        
        api.init();
        tweets.loadMarkers();
        sidebar.init();
        tweets.init();
        
        twitter.init();
        base.addEventHandlers();

        base.layerSets = layerSets;
        base.layers = layers;

        base.setInitialState(state);
    },

    

    setInitialState: function (state) {
        
        let path = url.getPath()

        base.setState({ ...defaultState, ...state });

        let tweet = state.tweet;

        $(tweets).on("loaded", function () {
            if (!state.tweet) {
                if (path in tweets.data.pathToTweetId)
                    tweet = tweets.data.pathToTweetId[path];
            }

            if (tweet)
                tweets.show(tweet);

            //base.checkMarkersWithinBounds();
            
        });

        

        
        

        // var map = L.map('map', {
        //     center: [0, 0],
        //     zoom: 5,
        //     layers: [ "satellite" ]
        // });
        // if(!base.magnifyingGlass){
        //   base.magnifyingGlass = L.magnifyingGlass({
        //       layers: [ layerSets.baseTiles.layers.dark, layerSets.points.layers['power-plants'], layerSets.overlays.layers['no2_2021'] ],
        //       radius: 200,
        //       zoomOffset: 0,
        //       fixedPosition: false,
        //       latLng: state.center
        //   }).addTo(base.map);
        // }

        // L.Control.MagnifyingGlass(magnifyingGlass, {
        //     forceSeparateButton: true
        // }).addTo(base.map);
    },

    getState: function () {
        return {
            center: base.map.getCenter(),
            zoom: base.map.getZoom(),
            layers: base.getVisibleLayers(),
            tweet: tweets.activeTweet,
            account: tweets.data.account,
            hashtag: tweets.data.hashtag,
            polygons: tweets.data.polygons
        }
    },

    radius_zoom: function () {
        return radius_zoom
    },

    disableMapInteraction: function () {
        base.map.dragging.disable();
        base.map.touchZoom.disable();
        base.map.doubleClickZoom.disable();
        base.map.scrollWheelZoom.disable();
        base.map.boxZoom.disable();
        base.map.keyboard.disable();
        if (base.map.tap) base.map.tap.disable(); // Needed for mobile devices
      },

    enableMapInteraction: function () {
        base.map.dragging.enable();
        base.map.touchZoom.enable();
        base.map.doubleClickZoom.enable();
        base.map.scrollWheelZoom.enable();
        base.map.boxZoom.enable();
        base.map.keyboard.enable();
        if (base.map.tap) base.map.tap.enable(); // Needed for mobile devices
    },      

    setState: function (state) {
        base.pushState = false;

        base.flyTo(state);

        $(base.map).one('moveend', function () {

            base.showLayers(state.layers); //needed?
            base.pushState = true;
            url.pushState(); //needed?

            if (state.account) {
                sidebar.accountToIdsDisplay(state.account)                
            }

            if (state.hashtag) {
                sidebar.hashtagToIdsDisplay(state.hashtag);
                
            }

            if (state.polygons) {
                tweets.data.polygons = state.polygons
                base.showPolygons(state)
                base.showLayer("polygons")
            }
            

            base.updateCircleSize();
        })

    },

    flyTo: function (state) {
        //base.disableMapInteraction()
        // Only show tile layer in fly-to animation
        let tileLayers = Object.keys(base.layerSets.baseTiles.layers)
        let layers = state.layers.filter(x => tileLayers.includes(x))

        // Keep tweets layer
        if (state.layers.includes('tweets'))
            layers.push('tweets')

        base.showLayers(layers);

        if (base.slowFlyTo) {
            base.map.flyTo(state.center, state.zoom, { noMoveStart: true, duration: 2 });
        } else {
            base.map.flyTo(state.center, state.zoom, { noMoveStart: true, duration: 1 });
            base.slowFlyTo = true
        }
    },

    setView: function (state) {
        // Only show tile layer in fly-to animation
        let tileLayers = Object.keys(base.layerSets.baseTiles.layers)
        let layers = state.layers.filter(x => tileLayers.includes(x))

        // Keep tweets layer
        if (state.layers.includes('tweets'))
            layers.push('tweets')

        base.showLayers(layers);

        base.map.setView(state.center, state.zoom);

    },

    // getWindowCorrectedCenter: function (center, zoom) {
    //     let sidebarOffset = document.querySelector('.leaflet-sidebar').getBoundingClientRect().width;
    //     return base.map.unproject(base.map.project(center, zoom).add([sidebarOffset / 2, 0]), zoom); //substract when sidebar on the left
    // },

    showSidebar: function (module, content = null) {
        let sbs = [tweets]
        sbs.forEach((m) => {
            if (m != module) {
                m.sidebar.hide();
            }
        });

        module.sidebar.show();
        if (content)
            module.sidebar.setContent(content);

        return module.sidebar;
    },

    showControlwindow: function (module, content = null, title = null) {
        let sbs = [tweets]
        sbs.forEach((m) => {
            if (m != module) {
                m.controlwindow.hide();
            }
        });

        if (content) {
            module.controlwindow.content(content)
        }

        if (title) {
            module.controlwindow.title(title)
        }

        module.controlwindow.show('topRight')


        return module.controlwindow;
    },

    showSidebarContent: function (module, content = null, title = null) {
        let sbs = [tweets];

        sbs.forEach((m) => {
            if (m != module) {
                m.controlwindow.hide();
            }
        });

        const showSidebarElement = document.getElementById('sidebar');

        if (!showSidebarElement) {
            console.error('Element with id "idebar" not found.');
            return null;
        }

        if (content !== null) {
            // Update the content of the specified element
            showSidebarElement.innerHTML = content;
        }
        console.log(showSidebarElement)
        if (title !== null) {
            // Optionally update the title of the specified element
            // document.getElementById('show-sidebar-title').innerHTML = title;
        }

        // Optionally, you might have other logic related to showing/hiding elements

        return module.controlwindow;
    },


    showPopup: function (module, content = null) {
        let sbs = [tweets]
        sbs.forEach((m) => {
            if (m != module) {
                map.closePopup();
            }
        });

        if (content)
            L.popup(popupOptions).setContent(content)


        return module.popup;
    },

    showLayers: function (ids) {
        let visibleLayers = base.getVisibleLayers()
        // Show
        ids.forEach((id) => {
            if (!visibleLayers.includes(id))
                base.showLayer(id);
        });

        // Hide layers visible, but not in ids
        visibleLayers.forEach((id) => {
            if (!ids.includes(id))
                base.hideLayer(id)
        });

        // Default to light tiles
        if (base.layerSets.baseTiles.getVisibleLayers().length == 0)
            base.map.addLayer(base.layerSets.tiles.layers['light'])

        // Default to empty overlays layer
        if (base.layerSets.overlays.getVisibleLayers().length == 0)
            base.map.addLayer(base.layerSets.overlays.layers['empty'])
    },

    showLayer: function (id) {
        if (!base.map.hasLayer(base.layers[id]))
            base.map.addLayer(base.layers[id])

    },

    showPolygons: function (state) {
        base.layers["polygons"].clearLayers();
        let colorIterator = 0
        let color_arr = ["#FFF600", "#ff7800", "#FF0008", "#0088FF"]

        let data = decodeURIComponent(state.polygons);

        function isValidHttpUrl(string) {
            let url;
            try {
                url = new URL(string);
            } catch (_) {
                return false;
            }
            return url.protocol === "http:" || url.protocol === "https:";
        }

        if (isValidHttpUrl(data)) {
            base.layers["polygons"].clearLayers();
            $.getJSON(data, function (json) {
                // add GeoJSON layer to the map once the file is loaded
                let datalayer = L.geoJson(json, {
                    onEachFeature: function (feature, layer) {
                        layer.setStyle({
                            weight: 1.5,
                            color: color_arr[3],
                            opacity: 0.8,
                            interactive: false,
                            //fillColor: "#ff7800",
                            stroke: true,
                            fillOpacity: 0.1,
                            dashArray: ''
                        });

                        base.layers["polygons"].addLayer(layer)

                    }
                })

                //base.map.fitBounds(datalayer.getBounds());
            });
            base.externalJSON = true
        } else {
            L.geoJSON(JSON.parse(data), {
                onEachFeature: function (feature, layer) {
                    if (colorIterator > 3)
                        colorIterator = 0

                    layer.setStyle({
                        weight: 3,
                        color: color_arr[colorIterator],
                        opacity: 0.8,
                        interactive: false,
                        //fillColor: "#ff7800",
                        stroke: true,
                        fillOpacity: 0.1,
                        dashArray: ''
                    });

                    base.layers["polygons"].addLayer(layer)
                    colorIterator = colorIterator + 1
                }
            });
        }


    },

    hidePolygons: function () {

        base.hideLayer("polygons")


    },

    hideLayer: function (id) {
        if (base.map.hasLayer(base.layers[id]))
            base.map.removeLayer(base.layers[id])
    },

    getVisibleLayers: function () {
        return Object.keys(this.layers).filter(k => (base.map.hasLayer(this.layers[k])));

    },

    updateCircleSize: function () {
        function calcRadius(val, zoom) {
            if (val != radius_zoom()[zoom])
                return radius_zoom()[zoom]
            else
                return
        }

        base.map.eachLayer(function (marker) {
            //console.log(marker)
            if (marker._radius != undefined) {
                //console.debug(marker)
                let size = null
                if (marker.feature.properties.rank_world != undefined) {
                    size = Math.max(radius_zoom[base.map.getZoom()], radius_zoom[base.map.getZoom()] * (3 / Math.pow(marker.feature.properties.rank_world, 1 / 4)))
                } else if (marker.feature.properties.population != undefined) {
                    size = Math.max(radius_zoom[base.map.getZoom()], radius_zoom[base.map.getZoom()] * (Math.pow(marker.feature.properties.population, 1 / 4) / 20))
                } else if (marker.feature.properties.rank != undefined) {
                    size = Math.max(radius_zoom[base.map.getZoom()], radius_zoom[base.map.getZoom()] * (3 / Math.pow(marker.feature.properties.rank, 1 / 4)))
                } else {
                    size = radius_zoom[base.map.getZoom()]
                }


                marker.setRadius(size)
            }
        });
    },

    addControls: function () {

        const SearchControl = L.Control.extend({
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        
                // Set the position of the container
                container.style.position = 'absolute'; // Change to absolute positioning
                container.style.top = '0px'; // Adjust the top position if needed
                container.style.zIndex = '1000'; // Ensure it's above other map elements
        
                const button = L.DomUtil.create('button', '', container);
                button.innerHTML = 'Search messages in view';
                button.style.width = '171px'; // Set width of the button
        
                // Define the button click event handler
                button.onclick = function() {
                    let ids = base.getVisibleTweetIds(base.map);
                    ids = ids.filter(id => base.visibleTweetIds.includes(id));
                    // Handle the search functionality here
                    sidebar.displayTweetsbyIds(ids);
                };
        
                // Function to center the button within the #map
                function centerButton() {
                    const mapElement = document.getElementById('map');
                    const mapWidth = mapElement.clientWidth; // Get the width of the map
                    
                    // Calculate the left position to center the button
                    container.style.left = `${(mapWidth) / 2}px`; 
                    container.style.transform = 'translateX(-50%)';
                }
        
                // Initial centering
                centerButton();
        
                // Function to handle removal and re-adding of the button
                const refreshButton = () => {
                    // // Remove the button from the map
                    // map.removeControl(this);
                    // // Add the control back to the map
                    // map.addControl(this);
                    // // Center the button again
                    centerButton();
                };

                // Add event listeners for resizing and orientation changes
                window.addEventListener('resize', refreshButton);
                window.addEventListener('orientationchange', refreshButton);
                                
        
                return container;
            },
            onRemove: function(map) {
                // Remove the resize event listener when the control is removed
                window.addEventListener('orientationchange', centerButton); 
                window.removeEventListener('resize', centerButton);
            }
        });
        
        
        
        // Create an instance of the custom control
        const searchControl = new SearchControl({ position: 'topleft' }); // Set position to topleft

        // Add the control to the map
        searchControl.addTo(base.map);

        let drawOptions = {
            position: 'bottomleft',
            draw: {
                polyline: false,
                polygon: {
                    allowIntersection: false, // Restricts shapes to simple polygons
                    drawError: {
                        color: '#e1e100', // Color the shape will turn when intersects
                        message: '<strong>Oh snap!<strong> you can\'t draw that!' // Message that will show when intersect
                    },
                    shapeOptions: {
                        color: '#bada55'
                    }
                },
                circle: false, // Turns off this drawing tool
                rectangle: false,
                marker: false,
                circlemarker: false,
                polyline: true
            },
            edit: {
                featureGroup: base.editableLayers,//base.layers["polygons"],//base.editableLayers, //REQUIRED!!
                remove: false,
                edit: false
            }
        };

        L.control.scale({
            position: 'bottomright'
        }).addTo(base.map)

        L.control.zoom({
            position: 'topright'
        }).addTo(base.map);

        L.Control.geocoder({
            position: 'topright',
            defaultMarkGeocode: false
        }).on('markgeocode', function (e) {
            var bbox = e.geocode.bbox;
            var location = e.geocode.center;

            // Calculate the zoom level based on the bounding box and map size
            var zoom = base.map.getBoundsZoom(bbox);

            // Set the view to the location with the calculated zoom level
            base.map.setView(location, zoom);
        }).addTo(base.map);

        L.control.locate({
            position: 'topright',
            drawCircle: false,
            drawMarker: false
        }).addTo(base.map);

        let removePolygonsButton = L.easyButton({
            states: [{
                stateName: 'fa-clear-trash',        // name the state
                icon: 'fa-trash',               // and define its properties
                title: 'Clear drawlayer',      // like its title
                onClick: function (btn, map) {       // and its callback
                    if (tweets.data.polygons) {
                        if (confirm('Are you sure you want to remove all your self-created drawings?')) {
                            base.layers["polygons"].clearLayers();
                            tweets.data.polygons = null
                            url.pushState();
                        } else {
                            // Do nothing!
                            return;
                        }
                    } else {
                        return;
                    }



                    //btn.state('fa-cleared-trash');    // change state on click!
                }
            }]
        });

        removePolygonsButton.setPosition('bottomleft').addTo(base.map);

        let drawControl = new L.Control.Draw(drawOptions);
        base.map.addControl(drawControl);

        base.miniMap = new L.Control.MiniMap(layerSets.baseTiles.layers.satellite_minimap, {
            position: "bottomright",
            collapsedWidth: 30,
            collapsedHeight: 30,
            zoomLevelOffset: -6,
            toggleDisplay: true,
            //autoToggleDisplay: true,
            minimized: true,
            width: 230,
            height: 150,
        }).addTo(base.map);

        let shareUrlButton = L.easyButton({
            states: [{
                stateName: 'toggle-tweets',        // name the state
                icon: 'nf nf-fa-share',               // and define its properties
                title: 'Share Link',      // like its title
                onClick: function (btn, map) {       // and its callback
                    let url_path = new URL('https://libmap.org' + url.getPath())
                    let pathSegments = url_path.pathname.split('/').filter(segment => !segment.startsWith('t='));
                    url_path.pathname = pathSegments.join('/');
                    let modifiedUrl = url_path.href;
                    let link = modifiedUrl
                    navigator.clipboard.writeText(link)
                        .then(() => {
                            alert('Map link copied to clipboard. Share this link to pin it to the map.');
                        })
                        .catch(err => {
                            alert('Error in copying URL: ', err);
                        });
                    //url.pushState();
                    //btn.state('fa-cleared-trash');    // change state on click!
                }
            }]
        });

        shareUrlButton.setPosition('bottomright').addTo(base.map);

        let homeButton = L.easyButton({
            states: [{
                stateName: 'go-home',        // name the state
                icon: 'nf nf-fa-home',               // and define its properties
                title: 'Overview',      // like its title
                onClick: function (btn, map) {       // and its callback
                    //base.map.flyTo(base.getState().center, 5.0);
                    //base.map.setView(defaultState.center, defaultState.zoom);
                    tweets.closeSidebar()
                    sidebar.clearSearch();
                    sidebar.currentPage = 1
                    
                    base.setState({ ...defaultState });
                    base.stateBefore = null
                    sidebar.displayTweetsbyIds(base.initVisibleTweetIds, 1);
                    base.tweetBoxActive = false;
                    
                }
            }]
        });

        homeButton.setPosition('bottomright').addTo(base.map);
    },

    getVisibleMarkers: function (map) {
        var markerList = [];
        map.eachLayer(function(layer) {
            if (layer instanceof L.Marker && map.getBounds().contains(layer.getLatLng())) {
                markerList.push(layer);
            }
        });
        return markerList;
    },
    
    getVisibleTweetIds: function (map) {
        var tweetIds = [];
        map.eachLayer(function(layer) {
            if (layer instanceof L.Marker && map.getBounds().contains(layer.getLatLng())) {
                // Retrieve the tweet ID from the marker's options
                var tweetId = layer.options.tweetId;
                // Push the tweet ID to the tweetIds array
                tweetIds.push(tweetId);
            }
        });
        return tweetIds;
    },
    
    

    addEventHandlers: function () {
        base.miniMap.on('restore', function() {
            window.dispatchEvent(new Event('resize'));
        });

        base.map.on(L.Draw.Event.CREATED, function (e) {
            base.showLayer("polygons")
            var type = e.layerType,
                layer = e.layer;

            if (type === 'marker') {
                layer.bindPopup('A popup!', {
                    autoPan: false
                });
            }

            //Remove loaded JSON first
            if (base.externalJSON) {
                base.layers["polygons"].clearLayers();
                tweets.data.polygons = null
                url.pushState();
                base.externalJSON = false
            }

            base.layers["polygons"].addLayer(layer)

            // Extract GeoJson from featureGroup
            let data = layer.toGeoJSON();

            // Stringify the GeoJson
            if (tweets.data.polygons == null) {
                data = encodeURIComponent(JSON.stringify(data));
            } else {
                let data_old = data
                data = {
                    "type": "FeatureCollection",
                    "features": [JSON.parse(decodeURIComponent(tweets.data.polygons)), data]
                }
                data = encodeURIComponent(JSON.stringify(data))

            }
            if (data.length > 3800) {
                alert("Polygon string too long. You cannot add more stuff.");
            } else {
                tweets.data.polygons = data
                tweets.addGeoJson()
            }

        });

        base.map.on("moveend", function () {
            // base.stateArray.forEach((item, i) => {
            //     base.showLayer(item)
            // });
            //$(tweets).trigger('loaded');
            //base.markersOnMap = base.getVisibleTweetIds(base.map)
            //console.log(base.markersOnMap)
            //sidebar.displayTweets();

            if (base.pushState) {
                url.pushState()
            }
        });

        base.map.on("movestart", function () {
            // if(base.layerSets.tweets){
            //   base.stateArray = [].concat(base.layerSets.tweets.getVisibleLayers());
            //
            //   base.stateArray.forEach((item, i) => {
            //       base.hideLayer(item)
            //   });
            // }


        });


        base.map.on("move", function () {

            //console.log(base.magnifyingGlass);
            // base.magnifyingGlass = L.magnifyingGlass({
            //     //layers: [ layerSets.baseTiles.layers.dark, layerSets.points.layers['power-plants'], layerSets.overlays.layers['no2_2021'] ],
            //     //radius: 100,
            //     //zoomOffset: 0,
            //     fixedPosition: true,
            //     latLng: base.map.getCenter()
            // });
            //base.magnifyingGlass.setLatLng = base.map.getCenter()
        });

        // base.map.on("contextmenu", function (e) {
        //     //base.tweetBoxActive = true;
        //     //tweets.closeSidebar();
        //     base.map.flyTo(e.latlng);
        //     //twitter.showTweetBox(e);
        //     //let class_ch = document.querySelector('.crosshair')
        //     //class_ch.classList.add('hidden')
        // });

        base.map.on("zoomend", function () {
            base.updateCircleSize()
            //base.enableMapInteraction()
        });

        base.map.on("click", function (e) {
            //tweets.loadStoryLines()
            base.tweetBoxActive = false;
            //sidebar.back(false,false);
            tweets.closeSidebar()
            sidebar.clearSearch();
            //sidebar.displayTweets('', 1, false);
            //sidebar.currentPage = 1
            //sidebar.displayTweetsbyIds()
            
            //base.slowFlyTo = false;
            twitter.marker.remove();
            twitter.controlwindow.hide();
            search.displayInitialSearchedTerms()
        });

        base.map.on('baselayerchange overlayadd overlayremove', function (e) {
            if (base.pushState)
                url.pushState();
            return true;
        });
    }


}

export default base
