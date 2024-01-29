# libmap: A Map-Based Social Media Tagging Tool

## Summary

libmap is a web application designed for open online journalism, enabling users to tag and visualize social media messages based on their location. With libmap, users can easily share messages via Mastodon by embedding location information in the URL. The application extracts these messages, plots them on an interactive map, and allows users to search for messages by username or hashtag. 

The backend is listening to mastodon.social. We add other instances as needed.

### Key Features:
- **Map Integration:** Utilizes Leaflet.js for map rendering and interaction.
- **Social Media API Integration:** Integrates with Mastodon APIs for message collection.
- **URL Parsing:** Parses layers, location, and zoom level from URLs to display and position the map accordingly.
- **Message Collection:** Listens for tagged messages and stores them in a database for display on the map.
- **Search Functionality:** Enables users to search for messages by username or hashtag.

### Usage:
1. Select location and layers on libmap.org.
2. Copy the URL containing layers, location, and zoom level from libmap.
3. Share the URL in a Mastodon message.
4. The libmap backend extracts the message and displays it on the map.
5. Click on a marker to view the message details.

libmap is open to anyone using Mastodon, providing a simple and powerful tool for location-based social media tagging.

## Run Webpage Locally

This webpage can be run locally with:

    npm install
    cp config.template.json config.json # Adjust the config.json file
    npm run map



## Contribution

Any contribution is welcome!
