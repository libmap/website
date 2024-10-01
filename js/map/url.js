import base from "./base.js";
import { encode, decode } from '@alexpavlov/geohash-js';

let url = {
    prefix: '/map',
    keyValueDivider: '=',
    specialKeys: ['@', '~', '#'],
    pathDivider: '/',
    listDivider: ',',
    mainDivider: '?', // Change the main divider to '?'
    secondaryDivider: '&', // Add a secondary divider for subsequent parameters
    geohashSymbol: '#',
    geoHash: false,

    _stateToUrl: function(s) {
        let lng = parseFloat(s.center.lng).toFixed(5),
            lat = parseFloat(s.center.lat).toFixed(5),
            layers = s.layers.filter(e => e !== 'empty');
    
        let vars = {
            ls: layers.join(url.listDivider),
            z: s.zoom,
        };
    
        if (!url.geoHash) {
            vars = {
                ...vars,
                lng: lng,
                lat: lat,
            };
        }
        
    
        if (s.polygons) {
            vars.polygons = s.polygons;
        }
    
        let geoHashPart = url.geoHash ? `#${encode(lat, lng)}` : '';
    
        // Initialize specialKeysParts array
        let specialKeysParts = [];
        
    
        // Add '@account' and '~hashtag' to specialKeysParts if they exist
        if (s.account) {
            specialKeysParts.push(`@${s.account}`);
        }
        if (s.hashtag) {
            specialKeysParts.push(`~${s.hashtag}`);
        }

        
    
        let parts = Object.keys(vars).map(k => {
            return [k, vars[k]].join(url.specialKeys.includes(k) ? '' : url.keyValueDivider);
        });

        let specialKeysFinal = specialKeysParts.length > 0 ? '/' + specialKeysParts.join(url.pathDivider) : '';
        // Join specialKeysParts with url.pathDivider and append the rest of the URL
        return specialKeysFinal + url.prefix + geoHashPart + url.mainDivider + parts.join(url.secondaryDivider);
    },
    
    

    _urlToState: function(path) {

        let firstSplit = path.split(url.pathDivider);


        // Flat map to split each part by url.mainDivider
        let finalSplit = firstSplit.flatMap(part => part.split(url.mainDivider));


        //let pathWithoutPrefix = path.startsWith(url.prefix) ? path.slice(url.prefix.length) : path;
        

        //let parts = pathWithoutPrefix.split(url.divider);
        // Split by url.mainDivider first
        // Split first by url.divider
        // Split by url.secondaryDivider




        
        let rs = {};
        finalSplit.forEach((n) => {
            // Replace "map#" with "#"
            n = n.replace(/^map#/, '#');

            if (url.specialKeys.includes(n.charAt(0))) {
                rs[n.charAt(0)] = n.slice(1);
            } else {
                let u = n.split(url.secondaryDivider);
                u.forEach((n) => {
                    let v = n.split(url.keyValueDivider);
                    rs[v[0]] = v[1];
                });
            }
        });

        
        let s = {};

        if (rs['#']) {
            let t = decode(rs['#']);
            s.center = {
                lat: t.latitude,
                lng: t.longitude,
            };
        }

        if (rs.lat && rs.lng)
            s.center = {
                lat: rs.lat,
                lng: rs.lng,
            };



        if (rs.ls)
            s.layers = rs.ls.split(url.listDivider);

        if (rs.z)
            s.zoom = parseInt(rs.z);

        // if (rs.t)
        //     s.tweet = rs.t;

        if (rs['@']) {
            s.account = rs['@'];
        }

        if (rs['~']) {
            s.hashtag = rs['~'];
        }

        if (rs.polygons)
            s.polygons = rs.polygons;

        return s;
    },

    pushState: function(state = null) {
        if (!state)
            state = base.getState();

        var obj = {
            Title: `Lat: ${state.center.lat}, Lng: ${state.center.lng}`,
            Url: url._stateToUrl(state)
        };

        history.replaceState(obj, obj.Title, obj.Url);
    },

    getState: function() {
        return url._urlToState(url.getPath());
    },

    getPath: function() {
        let domain = window.location.origin;
        let remainingURL = window.location.href.slice(domain.length);
        return(remainingURL)
        //return window.location.pathname;
    },
}

export default url;
