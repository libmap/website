import api from './api/proxy.js';
import tweets from './tweets.js';
import 'zoom-vanilla.js'
import url from './url.js';
import search from './search.js';
import { map, icon, Marker } from 'leaflet';
import 'leaflet-control-geocoder';
import './geoip.js';
import './marker/control.js';
import { layerSets, layers } from './layers/sets.js';
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
    let sidebarElement = document.getElementById('sidebar');
    if (sidebarElement) {
        document.documentElement.scrollTop = 0;
    }
});

document.getElementById('prev-button').addEventListener('click', function () {
    if (sidebar.currentPage > 1) {
        sidebar.currentPage--;
        sidebar.displayTweetsbyIds(null, sidebar.currentPage);
    }
    let sidebarElement = document.getElementById('sidebar');
    if (sidebarElement) {
        document.documentElement.scrollTop = 0;
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
    sidebar.scrollToHeadTweet(lastId)
});


let tweetDataPromise;

let sidebar = {
    currentPage: 1,

    init: function () {
        // let class_bb = document.querySelector('.back-btn');
        // class_bb.classList.add('hidden');

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
    },

    getSidebarTopPosition: function() {
        const sidebarElement = document.getElementById('sidebar');
    
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
            const tweetData = await tweetDataPromise; // Assuming you need data from the promise
            const lastElement = document.getElementById(sidebar.getHeadTweetById(id, tweetData));
    
            if (lastElement) {
                // Get the position of the lastElement relative to the page
                const elementRect = lastElement.getBoundingClientRect();
                const offsetTop = elementRect.top + window.scrollY; // Element's position in the page
                

                // Get the top position of the sidebar relative to the document
                const sidebarElement = document.getElementById('sidebar');
                const sidebarRect = sidebarElement.getBoundingClientRect();
                const sidebarTop = sidebarRect.top + window.scrollY;

                // Determine the scroll behavior
                const scrollBehavior = speed === 'smooth' ? 'smooth' : 'auto';
                
                // Scroll to the calculated position
                window.scrollTo({
                    top: offsetTop - sidebarTop,
                    behavior: scrollBehavior
                });
            } else {
                const sidebarElement = document.getElementById('sidebar'); 
                if (sidebarElement) {
                    // Scroll to the top if the element doesn't exist
                    sidebarElement.scrollTop = 0;
                }
            }
        } catch (error) {
            console.error('Error waiting for tweet data:', error);
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
        const sidebar = document.getElementById('sidebar');
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
            console.log(document.body.clientHeight)
            // Apply scrolling with behavior
            document.documentElement.scrollTo({
                top: scrollTop,
                behavior: speed // 'instant' or 'smooth'
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

            let sidebarElement = document.getElementById('sidebar');
            if (sidebarElement) {
                sidebarElement.scrollTop = 0;
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
            tweets.invisibleMarker();
            let tweetsToDisplay = []

            let markers = []; // Use let to declare the markers array
            // Append new tweets instead of clearing and re-rendering all tweets
            headTweetsToDisplay.forEach(([id, tweet]) => {
                let marker = tweets.data.tweetIdToMarker[id.toString()];
                if (marker) { // Check if the marker exists before pushing
                    markers.push(marker);
                }
                tweetsToDisplay.push(id)
                tweets.visibleMarker(id);
                tweetsContainer.appendChild(sidebar.createTweetElement(id, tweet, true));
                const storyTweets = sidebar.getTweetsOfStory(tweetData, id);
                storyTweets.forEach(([storyId, storyTweet]) => {
                    let marker = tweets.data.tweetIdToMarker[storyId.toString()];
                    if (marker) { // Check if the marker exists before pushing
                        markers.push(marker);
                    }
                    tweetsToDisplay.push(storyId)
                    tweets.visibleMarker(storyId);
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

    accountToIdsDisplay: async function(account, fromInit = false) {
        try {        
            // Call accountToIds asynchronously and await its result
            let ids = await sidebar.accountToIds(account);
            if(fromInit){
                ids = ids.filter(id => base.initVisibleTweetIds.includes(id));
            } else {
                ids = ids.filter(id => base.visibleTweetIds.includes(id));
            }           
            // Once you have the IDs, you can display the tweets
            sidebar.displayTweetsbyIds(ids);
            tweets.data.account = account
            tweets.centerAroundMarkers(ids)
            base.visibleTweetIds = ids
        } catch (error) {
            console.error('Error waiting for tweet data:', error);
        }
    },

    hashtagToIdsDisplay: async function(hashtag, fromInit = false) {
        try {        
            // Call accountToIds asynchronously and await its result
            let ids = await sidebar.hashtagToIds(hashtag);
            if(fromInit)
                ids = ids.filter(id => base.initVisibleTweetIds.includes(id));
            else
                ids = ids.filter(id => base.visibleTweetIds.includes(id));
            // console.log(ids)
            // console.log(filteredIds)
            // Once you have the IDs, you can display the tweets
            sidebar.displayTweetsbyIds(ids);
            tweets.data.hashtag = hashtag
            tweets.centerAroundMarkers(ids)
            base.visibleTweetIds = ids
        } catch (error) {
            console.error('Error waiting for tweet data:', error);
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


        const searchInput = document.getElementById('term-search');
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
    }
}

export default sidebar
