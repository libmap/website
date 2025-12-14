# Dynamic Open Graph Preview Images for libmap.org

## Overview

Implement dynamic social media preview cards (Open Graph images) that show the actual map state when sharing libmap.org links on Twitter/X and Bluesky. Each shared link will display a unique preview image based on the map location, zoom level, and visible layers encoded in the URL.

## Solution Architecture

### Core Approach: Flask Backend + Tile Stitching

**Key Components:**
1. **Crawler Detection**: Detect social media bots via User-Agent and serve them specialized HTML
2. **Image Generation**: Generate map preview images by stitching raster map tiles (no Puppeteer overhead)
3. **Caching**: Cache generated images to avoid regeneration on every request
4. **Server Routing**: Configure Nginx/Apache to proxy crawler requests to Flask backend

**Why this approach:**
- Leverages existing Python Flask backend at dev.libmap.org
- Fast generation (<500ms) using tile stitching with Pillow
- No browser automation overhead
- Works with current self-hosted deployment
- Deterministic and cacheable

## Technical Implementation

### Phase 1: Backend Image Generation Service

**Location:** Extend Python Flask backend at `/backend-dev-python/`

#### 1.1 Create OG Preview Module

**New file:** `/api/modules/og_preview.py`

**Core functionality:**
- Parse URL parameters (lat, lng, zoom, layers)
- Calculate tile coordinates using Mercator projection math
- Fetch map tiles from base tile URLs (from baseTiles.ts)
- Stitch tiles into 1200x630px OG image
- Add attribution text overlay
- Cache images to disk

**Tile URL mapping** (replicate from frontend):
```python
BASE_TILES = {
    'satellite': 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
    'esri': 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    'streets': 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'dark': 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
    'light': 'https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
    # ... other tiles from baseTiles.ts
}
```

**URL parsing logic** (replicate from useUrlState.ts):
- Parse `/@account/~hashtag` from pathname
- Parse `lat`, `lng`, `z` (zoom), `ls` (layers) from query params
- Default: lat=22.02455, lng=0.08789, z=3, layers=['satellite']

**Image generation:**
1. Convert lat/lng to tile coordinates using Web Mercator projection
2. Fetch 5x3 grid of 256px tiles centered on location
3. Stitch into 1280x768px canvas
4. Crop center to 1200x630px (OG standard)
5. Add "libmap.org" attribution text
6. Save to cache and return

#### 1.2 Create HTML Template with OG Meta Tags

**New file:** `/api/templates/og_preview.html.j2`

**Dynamic meta tags:**
```html
<meta property="og:title" content="{{ title }}">
<meta property="og:description" content="{{ description }}">
<meta property="og:image" content="{{ image_url }}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
```

**Title generation logic:**
- If `@account`: "libmap.org - @{account}'s view"
- If `~hashtag`: "libmap.org - #{hashtag}"
- Default: "libmap.org - Climate Action Map"

**Include redirect:** `<meta http-equiv="refresh" content="1;url={{ url }}">` to redirect humans to SPA after 1 second

#### 1.3 Flask Routes

**Route 1:** `/og-preview/<path:url_path>` - Generates HTML with OG tags
- Parses URL path and query parameters
- Generates dynamic title and description
- Returns og_preview.html.j2 template

**Route 2:** `/og-preview/image/<params>.png` - Generates/serves preview image
- Params format: `{lat}_{lng}_{zoom}_{layers}.png`
- Example: `48.2082_16.3738_10_satellite.png`
- Checks cache first, generates if missing
- Returns PNG image

#### 1.4 Dependencies

**Add to requirements.txt:**
```
Pillow>=10.0.0
requests>=2.31.0
```

### Phase 2: Server Configuration

#### 2.1 Nginx Configuration (on explorer200.abteil.org)

**File:** `/etc/nginx/sites-available/libmap.org`

**Add crawler detection:**
```nginx
map $http_user_agent $is_crawler {
    default 0;
    "~*Twitterbot" 1;
    "~*Bluesky" 1;
    "~*facebookexternalhit" 1;
    "~*LinkedInBot" 1;
    "~*Slackbot" 1;
}

server {
    server_name libmap.org;
    root /var/www/html/libmap.org;

    location / {
        if ($is_crawler = 1) {
            proxy_pass https://dev.libmap.org/og-preview$request_uri;
            break;
        }
        try_files $uri $uri/ /index.html;
    }

    location /og-preview/image/ {
        proxy_pass https://dev.libmap.org;
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800";
    }
}
```

**Alternative if Apache is used:** Add crawler detection via .htaccess with mod_rewrite

#### 2.2 Backend Blueprint Registration

**File:** `/api/__init__.py`

Import and register the new og_preview blueprint:
```python
from .modules import toots, log, og_preview

app.register_blueprint(og_preview.bp)
```

### Phase 3: Caching Strategy

**Two-level caching:**

1. **In-memory cache** (Python @lru_cache decorator)
   - 500 most recent images in memory
   - Instant serving for repeated requests

2. **Disk cache** (`/tmp/og-cache/` or similar)
   - Filenames: MD5 hash of parameters
   - TTL: 7 days
   - Cleanup via cron job: `0 2 * * * find /tmp/og-cache -name "*.png" -mtime +7 -delete`

3. **HTTP cache headers**
   - `Cache-Control: public, max-age=604800` (7 days)
   - Social platforms will cache the image on their side

### Phase 4: Deployment

#### 4.1 Backend Deployment

```bash
cd /backend-dev-python
pip install -r requirements.txt
# Deploy to dev.libmap.org (existing deployment process)
```

#### 4.2 Nginx Configuration

```bash
ssh -p 18422 sweing@explorer200.abteil.org
sudo nano /etc/nginx/sites-available/libmap.org
sudo nginx -t
sudo systemctl reload nginx
```

#### 4.3 Frontend Deployment (unchanged)

Current workflow continues to work:
```bash
npm run build
npm run live  # rsync to production
```

### Phase 5: Testing

#### 5.1 Local Testing

```bash
# Test image generation
curl "http://localhost:5000/og-preview/image/48.2082_16.3738_10_satellite.png" -o test.png

# Test OG HTML (simulate crawler)
curl -H "User-Agent: Twitterbot/1.0" \
  "http://localhost:5000/og-preview/map?lat=48.2082&lng=16.3738&z=10&ls=satellite"
```

#### 5.2 Validation Tools

- **Twitter Card Validator**: https://cards-dev.twitter.com/validator
- **Facebook Debugger**: https://developers.facebook.com/tools/debug/
- **LinkedIn Inspector**: https://www.linkedin.com/post-inspector/

#### 5.3 Test Cases

1. Default map view (no parameters)
2. Map with account filter: `/@greenpeace/map`
3. Map with hashtag: `/~climate/map`
4. Specific location with zoom: `/map?lat=40.7128&lng=-74.0060&z=12&ls=satellite`
5. Different base layers: `?ls=dark`, `?ls=streets`, `?ls=light`

## Critical Files

### Backend (Python Flask)

**New files:**
- `/backend-dev-python/api/modules/og_preview.py` - Main OG generation logic
- `/backend-dev-python/api/templates/og_preview.html.j2` - OG meta tags template

**Modified files:**
- `/backend-dev-python/api/__init__.py` - Register blueprint
- `/backend-dev-python/requirements.txt` - Add Pillow, requests

### Frontend (Reference only - no changes needed)

**Reference files for URL/tile logic:**
- `/website/src/hooks/useUrlState.ts` - URL parsing logic to replicate in Python
- `/website/src/lib/layers/baseTiles.ts` - Tile URL templates to replicate in Python

### Server Configuration

**Modified files:**
- `/etc/nginx/sites-available/libmap.org` - Add crawler detection and proxy rules
- OR `/var/www/html/libmap.org/.htaccess` - If using Apache

## Implementation Steps

1. **Create og_preview.py module** with tile stitching logic
2. **Create og_preview.html.j2 template** with OG meta tags
3. **Register blueprint** in api/__init__.py
4. **Add dependencies** (Pillow, requests) to requirements.txt
5. **Test locally** with curl and crawler User-Agent
6. **Configure Nginx** on production server for crawler detection
7. **Deploy backend** to dev.libmap.org
8. **Test with social media validators** (Twitter, Facebook, LinkedIn)
9. **Set up cache cleanup cron job** to remove old images
10. **Monitor logs** for OG preview requests and errors

## Technical Details

### Tile Coordinate Math (Web Mercator)

```python
def latlon_to_tile(lat, lon, zoom):
    lat_rad = math.radians(lat)
    n = 2.0 ** zoom
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (x, y)
```

### Image Dimensions

- **Tile size**: 256x256px
- **Grid**: 5 tiles wide × 3 tiles tall = 1280x768px
- **Crop to**: 1200x630px (center crop)
- **Format**: PNG with 8-bit color

### Browser User-Agents to Detect

```
Twitterbot/1.0
Bluesky-Cardyb/0.1
facebookexternalhit/1.1
LinkedInBot/1.0
Slackbot-LinkExpanding
```

## Estimated Effort

- **Backend development**: 6-8 hours
- **Server configuration**: 2 hours
- **Testing & validation**: 2-3 hours
- **Total**: ~1-1.5 days

## Success Criteria

1. Sharing a libmap.org link on Twitter shows a map preview image matching the URL state
2. Different URLs (locations, zoom levels) generate different preview images
3. Images load within 2 seconds for first request, instantly for cached requests
4. Preview cards display correctly on Twitter, Bluesky, Facebook, LinkedIn
5. Regular browser users still get the normal SPA experience
6. No impact on page load time for non-crawler requests
