import api from './api/proxy.js';
import tweets from './tweets.js';
import 'zoom-vanilla.js'
import url from './url.js';
import search from './search.js';
import L, { map, icon, Marker } from 'leaflet'; // Import L
import 'leaflet-control-geocoder';
import './geoip.js';
import './marker/control.js';
import { layerSets } from './layers/sets.js'; // Import layerSets
import base from './base.js';

let tweetData = null;
let visibleTweetIds = [];
let visibleTweets = 10;
let searchTerm = '';
let history = [];
let lastVisibleTweets = 0;

const tweetsPerPage = 20;

document.getElementById('next-button').addEventListener('click', function () {
    sidebar.currentPage++;
    sidebar.displayTweetsbyIds(null, sidebar.currentPage);
    let sidebarElement = document.getElementById('messages-tab'); // Corrected ID
    if (sidebarElement) {
        sidebarElement.scrollTop = 0; // Corrected target and property access
        //document.documentElement.scrollTop = 0;
    }
});

document.getElementById('prev-button').addEventListener('click', function () {
    if (sidebar.currentPage > 1) {
        sidebar.currentPage--;
        sidebar.displayTweetsbyIds(null, sidebar.currentPage);
    }
    let sidebarElement = document.getElementById('messages-tab'); // Corrected ID
    if (sidebarElement) {
        sidebarElement.scrollTop = 0; // Corrected target and property access
        //document.documentElement.scrollTop = 0;
    }
});

document.getElementById('back-button').addEventListener('click', function () {
    tweets.closeSidebar()
    //sidebar.clearSearch();
    base.setState(base.stateBefore);
    base.stateBefore = null
    sidebar.displayTweetsbyIds(null, sidebar.currentPage);
    base.tweetBoxActive = false;
    sidebar.hideID('back-button')
    let lastId = history[history.length - 1]; // Get last id
    sidebar.scrollToHeadTweet(lastId);
});

// Tab switching logic
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        
        // Deactivate all tabs and content
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Activate clicked tab and corresponding content
        button.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});


let tweetDataPromise;

let sidebar = {
    currentPage: 1,

    init: function () {

        tweetDataPromise = new Promise((resolve) => {
            // Set up an event listener for the 'loaded' event
            $(tweets).on("loaded", function () {
                // When the event is triggered, resolve the promise
                console.log("Data loaded via event");
                resolve(tweets.data.tweets);
            });
        });

        
        

        tweetDataPromise.then(function (data) {
            console.log("Data is available now");
            tweetData = data;

            
            base.visibleTweetIds = Object.keys(data);
            base.initVisibleTweetIds = base.visibleTweetIds

            const idFromUrl = tweets.activeTweet;
            base.map.invalidateSize();

            if (!idFromUrl) {
                sidebar.displayTweetsbyIds();
            }
    
        }).catch(function (error) {
            console.error('Error with data loading:', error);
            // Handle the error appropriately
        });

        // REMOVED: Populate layer controls - moved to base.js after initial layers are set
        // this.populateLayerControls(); 
    },

    // --- New function to populate layer controls ---
    populateLayerControls: function() {
        const baseLayersList = document.getElementById('base-layers-list');
        const overlayLayersList = document.getElementById('overlay-layers-list');

        baseLayersList.innerHTML = ''; // Clear existing
        overlayLayersList.innerHTML = ''; // Clear existing

        // --- Base Layers (Radio Buttons) ---
        const baseLayerSet = layerSets.baseTiles;
        console.log(baseLayerSet)
        Object.entries(baseLayerSet.layers).forEach(([key, layer]) => {
            if (key === 'empty') return; // Skip empty layer if present
            if (key === 'satellite_minimap') return;

            const layerId = `layer-base-${key}`;
            const div = document.createElement('div');
            div.className = 'layer-control-item';
            div.innerHTML = `
                <input type="radio" id="${layerId}" name="base-layer-radio" value="${key}" ${base.map.hasLayer(layer) ? 'checked' : ''}>
                <label for="${layerId}">${layer.options.name || key}</label>
            `;
            baseLayersList.appendChild(div);

            // Add event listener
            div.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    // Remove all other base layers
                    Object.values(baseLayerSet.layers).forEach(l => {
                        if (base.map.hasLayer(l)) {
                            base.map.removeLayer(l);
                        }
                    });
                    // Add the selected layer
                    base.map.addLayer(layer);
                    url.pushState();
                    layer.bringToBack(); // Ensure base layer is behind overlays
                }
            });
        });

        // --- Overlay Layers (Tree Structure) ---
        const createLayerCheckbox = (key, layer, layerSetName, isSubItem = false) => {
            const layerId = `layer-overlay-${layerSetName}-${key}`;
            const div = document.createElement('div');
            div.className = `layer-control-item ${isSubItem ? 'sub-item' : ''}`;
            div.innerHTML = `
                <input type="checkbox" id="${layerId}" name="overlay-layer-checkbox" value="${key}" ${base.map.hasLayer(layer) ? 'checked' : ''}>
                <label for="${layerId}">${layer.options.name || key}</label>
            `;
            div.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    base.map.addLayer(layer);
                    url.pushState()
                } else {
                    base.map.removeLayer(layer);
                    url.pushState()
                }
            });
            return div;
        };
        
        const createLayerRadio = (key, layer, groupName, isSubItem = false, isChecked) => {
            const layerId = `layer-overlay-${groupName}-${key}`;
            const div = document.createElement('div');
            div.className = `layer-control-item ${isSubItem ? 'sub-item' : ''}`;
            div.innerHTML = `
                <input type="radio" id="${layerId}" name="${groupName}-layer-radio" value="${key}" ${isChecked ? 'checked' : ''}>
                <label for="${layerId}">${layer.options.name || key}</label>
            `;
            div.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    // Find all layers in this radio group
                    const groupLayers = layerSets[groupName === 'no2' ? 'overlays' : 'baseTiles'].layers; // Adjust based on group name if needed
                    Object.entries(groupLayers).forEach(([k, l]) => {
                        if (k.startsWith(groupName) || (groupName === 'no2' && k === 'empty')) { // Match keys belonging to the group
                             if (k !== key && base.map.hasLayer(l)) {
                                 base.map.removeLayer(l);
                                 url.pushState();
                             }
                        }
                    });
                     // Add the selected layer if not already present and not the 'empty' layer
                    if (key !== 'empty' && !base.map.hasLayer(layer)) {
                        url.pushState()
                        base.map.addLayer(layer);
                        url.pushState()
                    }
                }
            });
            return div;
        };

        const createCollapsibleGroup = (title, contentGenerator) => {
            const details = document.createElement('details');
            details.className = 'layer-group-collapsible';
            const summary = document.createElement('summary');
            summary.textContent = title;
            details.appendChild(summary);
            contentGenerator(details); // Populate content
            return details;
        };

        // Messages Layer (Direct Checkbox)
        const tweetsLayer = layerSets.tweets.layers.tweets;
        if (tweetsLayer && tweetsLayer.options?.name) {
             overlayLayersList.appendChild(createLayerCheckbox('tweets', tweetsLayer, 'tweets'));
        }

        // Points of Interest (Collapsible)
        overlayLayersList.appendChild(createCollapsibleGroup('Points of Interest', (parent) => {
            const poiLayers = layerSets.points.layers;
            // Climate TRACE Sub-group
            parent.appendChild(createCollapsibleGroup('Climate TRACE', (subParent) => {
                 subParent.appendChild(createLayerCheckbox('energy', poiLayers.energy, 'points', true));
                 subParent.appendChild(createLayerCheckbox('manufacturing', poiLayers.manufacturing, 'points', true));
                 subParent.appendChild(createLayerCheckbox('fossil-fuel-operations', poiLayers['fossil-fuel-operations'], 'points', true));
            }));
             // Other Datasets Sub-group
            parent.appendChild(createCollapsibleGroup('Other Datasets', (subParent) => {
                 //subParent.appendChild(createLayerCheckbox('e-prtr', poiLayers['e-prtr'], 'points', true));
                 subParent.appendChild(createLayerCheckbox('eu-ets', poiLayers['eu-ets'], 'points', true));
                 subParent.appendChild(createLayerCheckbox('power-plants', poiLayers['power-plants'], 'points', true));
                 subParent.appendChild(createLayerCheckbox('big-cities', poiLayers['big-cities'], 'points', true));
            }));
        }));
        
        // NO₂ Layers (Collapsible Radio Group)
        overlayLayersList.appendChild(createCollapsibleGroup('NO₂ Pollution', (parent) => {
            const no2Layers = layerSets.overlays.layers;
            const no2Keys = Object.keys(no2Layers).filter(k => k.startsWith('no2_') || k === 'empty');
            let isAnyNo2Active = no2Keys.some(k => k !== 'empty' && base.map.hasLayer(no2Layers[k]));

            // Add 'Disable' option first
             const disableKey = 'empty';
             const disableLayer = no2Layers[disableKey];
             if (disableLayer) {
                 parent.appendChild(createLayerRadio(disableKey, disableLayer, 'no2', true, !isAnyNo2Active));
             }

            // Add actual NO2 layers
            no2Keys.filter(k => k !== 'empty').forEach(key => {
                 const layer = no2Layers[key];
                 parent.appendChild(createLayerRadio(key, layer, 'no2', true, base.map.hasLayer(layer)));
            });
        }));

        // Countries (Collapsible Checkboxes)
        overlayLayersList.appendChild(createCollapsibleGroup('Countries', (parent) => {
             const countryLayers = layerSets.countries.layers;
             Object.entries(countryLayers).forEach(([key, layer]) => {
                 // Key format is likely "countries!XX"
                 const countryCode = key.split('!')[1];
                 if (countryCode && layer.options?.name) {
                     parent.appendChild(createLayerCheckbox(key, layer, 'countries', true));
                 }
             });
        }));

    },
    // --- End of refactored function ---


    getSidebarTopPosition: function() {
        const sidebarElement = document.getElementById('body');
    
        if (sidebarElement) {
            // Get the position of the sidebar relative to the viewport
            const sidebarRect = sidebarElement.getBoundingClientRect();
    
            // Calculate the top position relative to the page by adding the current scroll offset
            const sidebarTop = sidebarRect.top + window.scrollY;
    
            return sidebarTop;
        } else {
            console.error('Sidebar element not found!');
            return null;
        }
    },

    scrollToHeadTweet: async function (id, speed = 'instant', position = 'start') {
        try {
            const tweetData = await tweetDataPromise;
            const headTweetId = sidebar.getHeadTweetById(id, tweetData); // Get the actual head tweet ID first
            const headTweetElement = document.getElementById(headTweetId); // Target the head tweet element
            const sidebarElement = document.getElementById('messages-tab'); // Corrected ID

            if (headTweetElement && sidebarElement) {
                // Calculate the position of the head tweet element relative to the sidebar container
                const elementTopRelativeToSidebar = headTweetElement.offsetTop - sidebarElement.offsetTop;

                // Determine the scroll behavior
                const scrollBehavior = speed === 'smooth' ? 'smooth' : 'auto';

                // Scroll the sidebar container
                sidebarElement.scrollTo({
                    top: elementTopRelativeToSidebar,
                    behavior: scrollBehavior
                });
            } else if (sidebarElement) {
                // Scroll to the top if the element doesn't exist
                sidebarElement.scrollTop = 0;
            }
        } catch (error) {
            console.error('Error scrolling to head tweet:', error);
        }
    },
    
    scrollToTweet: async function (id, speed = 'instant', position = 'start') {
        try {
            sidebar.scrollStartOrCenter(id, speed);
        } catch (error) {
            console.error('Error scrolling to tweet:', error);
        }
    },



    selectTweet: async function (id) {
        // Presumably, 'history' is a custom object or API you're using
        history.push(id);
        
        // let class_bb = document.querySelector('.back-btn');
        // class_bb.classList.remove('hidden');

        sidebar.hideID('prev-button');
        sidebar.hideID('next-button');
        sidebar.showID('back-button')
        //scrollPosition = 0;
        if (lastVisibleTweets == 0) {
            lastVisibleTweets = visibleTweets;
        }

        visibleTweets = 10;
        //searchTerm = id;
        //document.getElementById('tweets').innerHTML = '';

        await this.displayTweetsbyIds(id);

        // Wait for tweet images to load before scrolling
        const images = document.querySelectorAll('.post-image');
        await Promise.all(Array.from(images).map(img => {
            if (img.complete) {
                return Promise.resolve(); // Image is already loaded
            }
            return new Promise(resolve => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true }); // Also resolve on error
            });
        }));

        sidebar.scrollStartOrCenter(id);

    },
    scrollStartOrCenter: function(id, speed = 'instant') {
        const d = document.getElementById(id);
        const sidebar = document.getElementById('messages-tab');
        //const app = document.getElementById('app');
        
        if (d && sidebar) {
            // Get dimensions and positions
            const dRect = d.getBoundingClientRect();
            const sidebarRect = sidebar.getBoundingClientRect();
            
            // Determine the scroll position
            let scrollTop;
            const dHeight = dRect.height;
            const sidebarHeight = sidebarRect.height;
            console.log(dRect.top)
            console.log(sidebarRect.top)
            console.log(sidebar.scrollTop)


            if (dHeight > sidebarHeight) {
                // When the content is taller than the sidebar
                scrollTop = dRect.top - sidebarRect.top + sidebar.scrollTop;
            } else {
                // When the content fits within the sidebar
                scrollTop = dRect.top - sidebarRect.top + sidebar.scrollTop - (sidebarHeight / 2 - dHeight / 2);
            }
            console.log(scrollTop)
            //console.log(document.body.clientHeight)
            // Apply scrolling with behavior
            d.scrollIntoView({
                top: scrollTop,
                behavior: speed // 'instant' or 'smooth'
            });
        }
    },

    scrollStartOrCenter2: function(id, speed = 'instant') {
        const d = document.getElementById(id);
        const sidebarElement = document.getElementById('messages-tab'); // Ensure we have the scroll container

        if (d && sidebarElement) {
            // Use the built-in scrollIntoView method
            d.scrollIntoView({
                behavior: speed, // 'smooth' or 'instant'
                block: 'nearest' // Scrolls the minimum amount to bring the element into view
                // block: 'center' // Alternative: Tries to center the element vertically
            });
        }
    },

    extractHeadTweets: function (tweets) {
        return Object.entries(tweets).filter(([id, tweet]) => !tweet.story || tweet.story === id);
    },

    getTweetsOfStory: function (tweets, storyId) {
        return Object.entries(tweets).filter(([id, tweet]) => tweet.story === storyId && tweet.story !== id);
    },

    extractAllTweets: function (tweets) {
        return Object.entries(tweets);
    },

    createTweetElement: function (id, tweet, isHeadTweet) {

        function formatTweetContent(tweet) {
            // Regular expression to match hashtags
            const hashtagRegex = /#([^\s!"#$%&'()*+,-./:;<=>?@[\\\]^`{|}~]+)/g


            // Regular expression to match URLs
            const urlRegex = /(https?:\/\/[^\s()]+)/g;

            // Regular expression to match user accounts
            const userRegex = /@([^\s!"#$%&'()*+,-./:;<=>?@[\\\]^`{|}~]+)/g

            // Replace hashtags with colored version
            const coloredContent = tweet.content.replace(hashtagRegex, '<span class="hashtag">#$1</span>');

            // Replace URLs with clickable links
            const urlClickableContent = coloredContent.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');

            // Replace user accounts with colored version
            const finalContent = urlClickableContent.replace(userRegex, '<span class="account">@$1</span>');

            // Set the formatted content back to the tweet object
            tweet.formattedContent = finalContent;
        }

        function getMediaHTML(media, galleryId) {
            // Check if media is an array of strings

            if (Array.isArray(media) && media.length > 0 && typeof media[0] === 'string') {
                // Generate HTML for a single string URL
                const mediaHTML = media.map((item, index) => `
                <div id="media-${id}" style="max-width: 100%; padding: 1px;">
                    <img src="${media[index]}" data-action="zoom"  alt="Zoom ${galleryId}" class="post-image" style="max-height: 120px;" onerror="this.onerror=null; this.src='https://libmap.org/static/fallback.jpg';">
                </div>
                `
                ).join('');
                return mediaHTML;
            }
            //style="width: 100%; height: auto; image-rendering: high-quality;"
            // Generate HTML for each media item in the array of objects
            const mediaHTML = media.map((item, index) => `
                    <img src="${item.media_url_https}"  data-action="zoom" alt="Zoom ${galleryId}" style="width=auto;height=auto;" onerror="this.onerror=null; this.src='https://libmap.org/static/fallback.jpg';">
                `
            ).join('');

            return mediaHTML;
        }

        const div = document.createElement('div');
        let isActiveTweet = id === tweets.activeTweet;

        div.className = `tweet-container ${isHeadTweet ? 'story-head' : 'story-indent'} ${isActiveTweet ? 'active' : ''}`;

        if (tweet.content != null & tweet.source != "mastodon.social") {
            formatTweetContent(tweet)
        } else {
            tweet.formattedContent = tweet.content;
        }

        if (tweet.account == "decarbnow") {
            tweet.avatar = "https://files.mastodon.social/accounts/avatars/001/142/650/original/41b9fc47d816394c.png"
        }

        if (tweet.account == "ExposePolluters") {
            tweet.avatar = "https://pbs.twimg.com/profile_images/1727839247653089281/9XVjm12k_200x200.jpg"
        }

        if (tweet.account == "PolluterRod") {
            tweet.avatar = "https://pbs.twimg.com/profile_images/1366487335232299014/nn2P7XYz_200x200.jpg"
        }

        let link; // Declare `link` outside the if-else blocks to have a broader scope

        if (tweet.source == "mastodon.social") {
            link = `https://mastodon.social/@${tweet.account}/${id}`;
        } else if (tweet.source == "𝕏/Twitter") { // Assuming "𝕏" was a placeholder
            link = `https://twitter.com/${tweet.account}/status/${id}`;
        }

        div.innerHTML = `
            <div class="message-container">
                <div id="${id}" class="message ${isActiveTweet ? 'active' : ''}">
                    <div class="tweet-header">
                        <div class="tweet-avatar ${isHeadTweet ? '' : 'story'}">
                            <img src="${tweet.avatar}" id="image-${id}" onerror="this.onerror=null;this.src='https://libmap.org/static/avatar_icon.png';">
                        </div>
                        <div class="tweet-username">
                            <div class="display-name">${tweet.display_name ? `${tweet.display_name}` : 'Anonymous'}</div>
                            <div class="account-name"><a href="/@${tweet.account}">@${tweet.account ? `${tweet.account}` : 'anon'}</a></div>
                        </div>
                    </div>

                    <div class="tweet-content">
                        ${tweet.content ? `${tweet.formattedContent}` : '<p>This is a single message. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin eget risus bibendum, laoreet nisi eget, suscipit massa.</p><p>How do they do it? 🚲</p>'}
                    </div>
                    
                    ${tweet.media && tweet.media.length > 0 ? `
                        <div class="tweet-media">
                            <div id="gallery-${id}" style="display: flex;">
                                ${getMediaHTML(tweet.media, id)}
                            </div>
                        </div>
                    ` : ''}

                    <div class="message-footnote"><a href="${link}"> @${tweet.source}, ${tweet.timestamp ? `${tweet.timestamp}` : '1970-01-01 12:00:00'}</a></div>
                </div>
            </div>
        `;
        if (!isActiveTweet) {
            // Add a click event listener to call manager.show(id) when the container is clicked
            div.addEventListener('click', function () {
                tweets.show(id);
            });
        }

        return div;
    },

    filterTweetsByHashtag: function (tweets, hashtag) {
        const headTweets = sidebar.extractHeadTweets(tweets);
        return headTweets.filter(([id, tweet]) => {
            const storyTweets = sidebar.getTweetsOfStory(tweets, id);
            return (
                tweet.hashtags.map(h => h.toLowerCase()).includes(hashtag.toLowerCase()) ||
                storyTweets.some(([, storyTweet]) => storyTweet.hashtags.map(h => h.toLowerCase()).includes(hashtag.toLowerCase()))
            );
        });
    },

    filterTweetsById: function (tweets, searchId) {
        const headTweets = sidebar.extractHeadTweets(tweets);
        return headTweets.filter(([id, tweet]) => {
            const storyTweets = sidebar.getTweetsOfStory(tweets, id);
            return (
                id.toLowerCase() === searchId.toLowerCase() ||
                storyTweets.some(([storyId, storyTweet]) => storyId.toLowerCase() === searchId.toLowerCase())
            );
        });
    },

    filterTweetsByIds: function (tweets, searchIds) {
        const headTweets = sidebar.extractHeadTweets(tweets);
        return headTweets.filter(([id, tweet]) => {
            const storyTweets = sidebar.getTweetsOfStory(tweets, id);
            return (
                searchIds.includes(id.toLowerCase()) ||
                storyTweets.some(([storyId, storyTweet]) => searchIds.includes(storyId.toLowerCase()))
            );
        });
    },
    

    filterTweetsByAccount: function (tweets, account) {
        const headTweets = sidebar.extractHeadTweets(tweets);
        return headTweets.filter(([id, tweet]) => {
            const storyTweets = sidebar.getTweetsOfStory(tweets, id);
            return (
                tweet.account.toLowerCase() === account.toLowerCase() ||
                storyTweets.some(([, storyTweet]) => storyTweet.account.toLowerCase() === account.toLowerCase())
            );
        });
    },

    filterTweetsByAccountAndHashtag: function (tweets, account, hashtag) {
        const headTweets = sidebar.extractHeadTweets(tweets);
        return headTweets.filter(([id, tweet]) => {
            const storyTweets = sidebar.getTweetsOfStory(tweets, id);
            const hasMatchingAccount = (
                tweet.account.toLowerCase() === account.toLowerCase() ||
                storyTweets.some(([, storyTweet]) => storyTweet.account.toLowerCase() === account.toLowerCase())
            );

            const hasMatchingHashtag = (
                tweet.hashtags.map(h => h.toLowerCase()).includes(hashtag.toLowerCase()) ||
                storyTweets.some(([, storyTweet]) => storyTweet.hashtags.map(h => h.toLowerCase()).includes(hashtag.toLowerCase()))
            );

            return hasMatchingAccount && hasMatchingHashtag;
        });
    },


    getHeadTweetById: function (id, tweets) {
        // Convert the tweets object to an array and iterate over it 
        for (const [tweetId, tweet] of Object.entries(tweets)) {

            // Check if the id is equal to the current tweet id 
            if (id === tweetId) {

                // Check if it's a head tweet
                if (!tweet.story || tweet.story === id) {
                    return id; // return the head tweet
                    // If it's not a head tweet, find the head tweet 
                } else if (tweets[tweet.story]) {
                    return tweet.story; // returns the head of the tweet with the specified ID
                }
            }
        }

        return null; // Return null if no head tweet was found
    },

    showID: function (id) {
        let element = document.getElementById(id);
        element.style.display = "inline";   // Hides the element
    },

    hideID: function (id) {
        let element = document.getElementById(id);
        element.style.display = "none";   // Hides the element
    },


    displayTweetsbyIds: async function (ids, page = 1) {
        try {
            if(!ids){
                ids = base.visibleTweetIds
            }
            const tweetData = await tweetDataPromise;
            let filteredTweets = sidebar.filterTweetsByIds(tweetData, ids);
            const tweetsContainer = document.getElementById('tweets');

            let class_nb = document.querySelectorAll('.navigation-button')
            class_nb.forEach(button => button.classList.remove('hidden'));

            const startIndex = (page - 1) * tweetsPerPage;

            const headTweetsToDisplay = filteredTweets.slice(startIndex, startIndex + tweetsPerPage);

            let sidebarElement = document.getElementById('messages-tab'); // Corrected ID
            if (sidebarElement) {
                sidebarElement.scrollTop = 0; // Scroll the correct element
            }


            if (page === 1) {
                sidebar.hideID('prev-button')
            } else {
                sidebar.showID('prev-button')
            }


            if (headTweetsToDisplay.length < tweetsPerPage) {
                // If there are no more tweets on the next page, hide the "next" button
                sidebar.hideID('next-button')
            } else {
                sidebar.showID('next-button')
            }


            // Clear previous tweets only if it's the first page
            tweetsContainer.innerHTML = '';
            // Clear all markers from the map layer
            base.layerSets.tweets.layers.tweets.clearLayers();
            let tweetsToDisplay = []

            let markers = []; // Use let to declare the markers array
            // Append new tweets instead of clearing and re-rendering all tweets
            headTweetsToDisplay.forEach(([id, tweet]) => {
                let marker = tweets.data.tweetIdToMarker[id.toString()];
                if (marker) { // Check if the marker exists before pushing
                    markers.push(marker);
                }
                tweetsToDisplay.push(id)
                // Add the marker back to the map layer if it exists
                if (marker) {
                    base.layerSets.tweets.layers.tweets.addLayer(marker);
                    url.pushState()
                }
                tweetsContainer.appendChild(sidebar.createTweetElement(id, tweet, true));
                const storyTweets = sidebar.getTweetsOfStory(tweetData, id);
                storyTweets.forEach(([storyId, storyTweet]) => {
                    let marker = tweets.data.tweetIdToMarker[storyId.toString()];
                    if (marker) { // Check if the marker exists before pushing
                        markers.push(marker);
                    }
                    tweetsToDisplay.push(storyId)
                    // Add the story tweet marker back to the map layer if it exists
                    if (marker) {
                        base.layerSets.tweets.layers.tweets.addLayer(marker);
                        url.pushState()
                    }
                    tweetsContainer.appendChild(sidebar.createTweetElement(storyId, storyTweet, false));
                });
            });

            if (markers.length > 0) {
                let group = new L.featureGroup(markers); 
                
                // Get the layers in the group
                let layers = group.getLayers();
                let totalLayers = layers.length;
            
                // Iterate over the layers in reversed order
                layers.forEach(function(layer, index) {
                    // Calculate the zIndexOffset for the current layer
                    let zIndexOffset = (totalLayers - index) * 1000;
                    
                    // Set the zIndexOffset for the layer
                    layer.setZIndexOffset(zIndexOffset);
                });
            }


        } catch (error) {
            console.error('Error waiting for tweet data:', error);
        }
    },

    accountToIdsDisplay: async function(account) {
        try {
            // Get all IDs matching the account
            let accountIds = await sidebar.accountToIds(account);
            let finalIds;

            // Check if a hashtag filter is also active
            if (tweets.data.hashtag) {
                let hashtagIds = await sidebar.hashtagToIds(tweets.data.hashtag);
                // Find the intersection of account IDs and hashtag IDs
                finalIds = accountIds.filter(id => hashtagIds.includes(id));
            } else {
                // No hashtag filter active, use only account IDs
                finalIds = accountIds;
            }

            // Display the tweets matching the final set of IDs
            sidebar.displayTweetsbyIds(finalIds);
            tweets.data.account = account; // Store the active account filter
            tweets.centerAroundMarkers(finalIds); // Center map on results
            base.visibleTweetIds = finalIds; // Update the set of currently visible IDs
        } catch (error) {
            console.error('Error in accountToIdsDisplay:', error);
        }
    },

    hashtagToIdsDisplay: async function(hashtag) {
        try {
            // Get all IDs matching the hashtag
            let hashtagIds = await sidebar.hashtagToIds(hashtag);
            let finalIds;

            // Check if an account filter is also active
            if (tweets.data.account) {
                let accountIds = await sidebar.accountToIds(tweets.data.account);
                // Find the intersection of hashtag IDs and account IDs
                finalIds = hashtagIds.filter(id => accountIds.includes(id));
            } else {
                // No account filter active, use only hashtag IDs
                finalIds = hashtagIds;
            }

            // Display the tweets matching the final set of IDs
            sidebar.displayTweetsbyIds(finalIds);
            tweets.data.hashtag = hashtag; // Store the active hashtag filter
            tweets.centerAroundMarkers(finalIds); // Center map on results
            base.visibleTweetIds = finalIds; // Update the set of currently visible IDs
        } catch (error) {
            console.error('Error in hashtagToIdsDisplay:', error);
        }
    },
    

    accountToIds: async function (account) {
        try {
            const tweetData = await tweetDataPromise;
            const ids = [];
    
            base.initVisibleTweetIds.forEach(id => {
                if (tweetData.hasOwnProperty(id)) {
                    const tweet = tweetData[id];
                    if (tweet.account.toLowerCase() === account.toLowerCase()) {
                        ids.push(id);
                    }
                }
            });
            return ids;
        } catch (error) {
            console.error('Error waiting for tweet data:', error);
            return [];
        }
    },   

    hashtagToIds: async function (hashtag) {
        try {
            const tweetData = await tweetDataPromise;
            const ids = [];
    
            base.initVisibleTweetIds.forEach(id => {
                if (tweetData.hasOwnProperty(id)) {
                    const tweet = tweetData[id];
                    const tweetHashtags = tweet.hashtags || [];
    
                    if (tweetHashtags.map(h => h.toLowerCase()).includes(hashtag.toLowerCase())) {
                        ids.push(id);
                    }
                }
            });
    
            return ids;
        } catch (error) {
            console.error('Error waiting for tweet data:', error);
            return [];
        }
    },
    

    // hashtagToIds: async function (hashtag) {
    //     try {
    //         const tweetData = await tweetDataPromise;
    //         const headTweets = sidebar.extractHeadTweets(tweetData);
    //         const filteredTweetIds = [];
            
    //         headTweets.forEach(([id, tweet]) => {
    //             const tweetHashtags = tweet.hashtags || [];
    //             const storyTweets = sidebar.getTweetsOfStory(tweetData, id) || []; // Check if storyTweets is undefined
    //             if (
    //                 tweetHashtags.map(h => h.toLowerCase()).includes(hashtag.toLowerCase()) ||
    //                 storyTweets.some((storyTweet) => {
    //                     if (!storyTweet) return false; // Handle the case when storyTweet is undefined
    //                     const storyTweetHashtags = storyTweet.hashtags || [];
    //                     return storyTweetHashtags.map(h => h.toLowerCase()).includes(hashtag.toLowerCase());
    //                 })
    //             ) {
    //                 filteredTweetIds.push(id);
    //             }
    //         });
        
    //         return filteredTweetIds;
            
    //     } catch (error) {
    //         console.error('Error waiting for tweet data:', error);
    //     }
    // },
    
    

    // displayTweets: async function (searchTerm = '', page = 1, centerMap = false) {
    //     try {
    //         const tweetData = await tweetDataPromise;
    //         let state = url.getState();

    //         if (state.hashtag && !searchTerm) {
    //             searchTerm = '#' + state.hashtag;
    //         }

    //         if (state.account && !searchTerm) {
    //             searchTerm = '@' + state.account;
    //         }
    //         const tweetsContainer = document.getElementById('tweets');
    //         let filteredTweets;

    //         if (searchTerm.startsWith('#')) {
    //             // Hashtag search
    //             centerMap = true;
    //             tweets.data.hashtag = searchTerm.slice(1);
    //             // Update state with hashtag
    //             // ...

    //             if (state.account) {
    //                 // Both account and hashtag are present, filter by both
    //                 filteredTweets = sidebar.filterTweetsByAccountAndHashtag(tweetData, state.account, searchTerm.slice(1));
    //             } else {
    //                 // Only hashtag is present, filter by hashtag
    //                 filteredTweets = sidebar.filterTweetsByHashtag(tweetData, searchTerm.slice(1));
    //             }
    //         } else if (searchTerm.startsWith('@')) {
    //             // Account search
    //             centerMap = true;
    //             tweets.data.account = searchTerm.slice(1);
    //             // Update state with account
    //             // ...

    //             if (state.hashtag) {
    //                 // Both account and hashtag are present, filter by both
    //                 filteredTweets = sidebar.filterTweetsByAccountAndHashtag(tweetData, searchTerm.slice(1), state.hashtag);
    //             } else {
    //                 // Only account is present, filter by account
    //                 filteredTweets = sidebar.filterTweetsByAccount(tweetData, searchTerm.slice(1));
    //             }
    //         } else if (searchTerm == "postsInView") {
    //             var visibleTweetIds = base.getVisibleTweetIds(base.map);
    //             // var visibleHeadTweets = sidebar.getHeadTweetById(visibleTweetIds, tweetData)

    //             // Filter the tweet data by the visible tweet IDs
    //             filteredTweets = sidebar.filterTweetsByIds(tweetData, visibleTweetIds);

    //             // Remove duplicates from filteredTweets
    //             let filteredTweetsSet = new Set(filteredTweets.map(JSON.stringify));
    //             filteredTweets = Array.from(filteredTweetsSet).map(JSON.parse);
    //         } else if (searchTerm) {
    //             // ID search
    //             centerMap = false;
    //             filteredTweets = sidebar.filterTweetsById(tweetData, searchTerm);
    //         } else {
    //             // No specific search term, show default tweets
    //             filteredTweets = sidebar.extractHeadTweets(tweetData);

    //         }

    //         let class_nb = document.querySelectorAll('.navigation-button')
    //         class_nb.forEach(button => button.classList.remove('hidden'));

    //         const startIndex = (page - 1) * tweetsPerPage;

    //         const headTweetsToDisplay = filteredTweets.slice(startIndex, startIndex + tweetsPerPage);

            

    //         if (page === 1) {
    //             sidebar.hideID('prev-button')
    //         } else {
    //             sidebar.showID('prev-button')
    //         }


    //         if (headTweetsToDisplay.length < tweetsPerPage) {
    //             // If there are no more tweets on the next page, hide the "next" button
    //             sidebar.hideID('next-button')
    //         } else {
    //             sidebar.showID('next-button')
    //         }


    //         // Clear previous tweets only if it's the first page
    //         tweetsContainer.innerHTML = '';
    //         tweets.invisibleMarker();
    //         let tweetsToDisplay = []

    //         let markers = []; // Use let to declare the markers array
    //         // Append new tweets instead of clearing and re-rendering all tweets
    //         headTweetsToDisplay.forEach(([id, tweet]) => {
    //             let marker = tweets.data.tweetIdToMarker[id.toString()];
    //             if (marker) { // Check if the marker exists before pushing
    //                 markers.push(marker);
    //             }
    //             tweetsToDisplay.push(id)
    //             tweets.visibleMarker(id);
    //             tweetsContainer.appendChild(sidebar.createTweetElement(id, tweet, true));
    //             const storyTweets = sidebar.getTweetsOfStory(tweetData, id);
    //             storyTweets.forEach(([storyId, storyTweet]) => {
    //                 let marker = tweets.data.tweetIdToMarker[storyId.toString()];
    //                 if (marker) { // Check if the marker exists before pushing
    //                     markers.push(marker);
    //                 }
    //                 tweetsToDisplay.push(storyId)
    //                 tweets.visibleMarker(storyId);
    //                 tweetsContainer.appendChild(sidebar.createTweetElement(storyId, storyTweet, false));
    //             });
    //         });
    //         if (centerMap) {
    //             tweets.centerAroundMarkers(tweetsToDisplay)
    //         }
            
    //         if (markers.length > 0) {
    //             let group = new L.featureGroup(markers); 
                
    //             // Get the layers in the group
    //             let layers = group.getLayers();
    //             let totalLayers = layers.length;
            
    //             // Iterate over the layers in reversed order
    //             layers.forEach(function(layer, index) {
    //                 // Calculate the zIndexOffset for the current layer
    //                 let zIndexOffset = (totalLayers - index) * 1000;
                    
    //                 // Set the zIndexOffset for the layer
    //                 layer.setZIndexOffset(zIndexOffset);
    //             });
    //         }
            
            
            
    //     } catch (error) {
    //         console.error('Error waiting for tweet data:', error);
    //     }

    // },

    // back: function (goToTweet = true, centerMap = false) {
    //     tweets.closeSidebar();
    //     if (!goToTweet)
    //         sidebar.currentPage = 1

    //     base.tweetBoxActive = false;

    //     visibleTweets = lastVisibleTweets; // Restore visible tweets count

    //     document.getElementById('tweets').innerHTML = ''; // Clear current tweets
    //     //sidebar.displayTweets(searchTerm, sidebar.currentPage, centerMap);

    //     let currentZoom = base.map.getZoom(); // Get current zoom level
    //     if (currentZoom > 7)
    //         base.map.setZoom(currentZoom - 3); // Reduce the zoom level by 2

    //     lastVisibleTweets = 0

    //     //document.getElementById('sidebar').scrollTop = 0;

    //     // if (sidebarElement) {
    //     //     setTimeout(function () {
    //     //         sidebarElement.scrollTop = lastScrollPosition;
    //     //         lastVisibleTweets = 0
    //     //     }, 1000); // Delay might be needed to wait for tweets to load
    //     // }

    //     if (goToTweet) {
    //         let lastId = history[history.length - 1]; // Get last id
    //         sidebar.scrollToHeadTweet(lastId)
    //     } else {
    //         let sidebarElement = document.getElementById('sidebar');
    //         if (sidebarElement) {
    //             sidebarElement.scrollTop = 0;
    //         }
    //     }

    // },

    clearSearch: function () {
        // let state = url.getState();
        // if ('account' in state) {
        //     delete state.account;
        // }

        tweets.data.account = null
        tweets.data.hashtag = null

        const userSearch = document.getElementById('user-search');
        const hashtagSearch = document.getElementById('hashtag-search');
        const termsContainer = document.getElementById('searched-terms-container');
        
        if (userSearch) userSearch.value = '';
        if (hashtagSearch) hashtagSearch.value = '';
        if (termsContainer) termsContainer.innerHTML = '';

        const searchInput = document.getElementById('term-search');
        if (searchInput) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        }
    }
}

export default sidebar;
