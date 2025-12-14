# Dynamic Open Graph Preview Images for libmap.org
## Screenshot-Based Implementation

## Overview

Implement dynamic social media preview cards (Open Graph images) that show the **actual rendered map** from libmap.org when sharing links on Twitter/X and Bluesky. Each shared link will display a screenshot of the real map view based on the location, zoom level, and visible layers encoded in the URL.

## Solution Architecture

### Core Approach: Preview Route + Puppeteer Screenshots

**Key Components:**
1. **Preview Route** (`/preview`): Frontend route that renders only the map without UI elements
2. **Puppeteer Backend**: Python Flask service that screenshots the preview URL
3. **Crawler Detection**: Detect social media bots and serve specialized OG HTML
4. **Caching**: Cache screenshots to avoid regeneration (~2-3s first request, instant after)

**Why this approach:**
- Shows the **exact map rendering** users will see (not approximated with tile stitching)
- Includes **all overlay layers** (NO₂ pollution, etc.) which are complex to replicate
- Uses existing React map infrastructure - no need to rebuild rendering logic
- More maintainable - any frontend map changes automatically appear in previews

## Architecture Flow

```
Social Media Crawler
    ↓
GET https://libmap.org/@account/map?lat=X&lng=Y&z=Z&ls=layers
    ↓
[Nginx detects crawler User-Agent]
    ↓
Proxy to Flask Backend → /og-preview/@account/map?lat=X&lng=Y&z=Z&ls=layers
    ↓
Flask generates OG HTML with:
  - <meta og:image="https://libmap.org/og-image/{hash}.png">
  - Dynamic title, description
    ↓
Crawler fetches og:image URL → /og-image/{hash}.png
    ↓
Flask (Puppeteer):
  1. Navigate to https://libmap.org/preview?lat=X&lng=Y&z=Z&ls=layers&preview=1
  2. Wait for map to load
  3. Screenshot 1200x630px
  4. Cache to disk
  5. Return PNG
```

## Technical Implementation

### Phase 1: Frontend - Preview Route

**Goal**: Create a `/preview` route that renders only the map without any UI elements.

#### 1.1 Add Preview Mode to Zustand Store

**File**: `/src/store/index.ts`

Add preview flag to UI state:

```typescript
ui: {
  sidebarTab: 'messages' | 'layers'
  bottomSheetHeight: number
  isMobile: boolean
  isPreview: boolean  // ADD THIS
}

// Add action
setIsPreview: (preview: boolean) =>
  set((state) => ({ ui: { ...state.ui, isPreview: preview } }))
```

#### 1.2 Detect Preview Mode from URL

**File**: `/src/hooks/useUrlState.ts`

Modify `parseUrlString()` to detect preview parameter:

```typescript
function parseUrlString(urlString: string): Partial<URLState> {
  // ... existing code ...

  const search = url.searchParams
  const preview = search.get('preview')

  if (preview === '1' || preview === 'true') {
    result.isPreview = true
  }

  return result
}
```

Add to `URLState` type:

```typescript
// In /src/types/index.ts or wherever URLState is defined
interface URLState {
  // ... existing fields ...
  isPreview?: boolean
}
```

#### 1.3 Initialize Preview Mode on App Load

**File**: `/src/App.tsx`

Add preview initialization:

```typescript
useEffect(() => {
  const urlState = useUrlState.getState()
  if (urlState.isPreview) {
    useStore.getState().setIsPreview(true)
  }
}, [])
```

#### 1.4 Conditionally Hide UI Components

**File**: `/src/App.tsx`

Hide sidebar in preview mode:

```typescript
function App() {
  const isPreview = useStore((s) => s.ui.isPreview)

  return (
    <>
      <MapContainer />
      {!isPreview && <Sidebar />}
    </>
  )
}
```

**File**: `/src/components/Map/MapContainer.tsx`

Hide map controls, crosshair, and search button:

```typescript
function MapContainer() {
  const isPreview = useStore((s) => s.ui.isPreview)
  const mapInstance = useStore((s) => s.map.instance)

  // ... existing map setup ...

  return (
    <div className="map-wrapper">
      <div id="map" ref={mapRef} />

      {/* Keep layers - essential for rendering */}
      {mapInstance && <LayerManager />}
      {mapInstance && <TweetMarkers />}

      {/* Hide UI in preview mode */}
      {!isPreview && mapInstance && (
        <>
          <MapControls />
          <SearchInViewButton />
        </>
      )}

      {!isPreview && (
        <img
          className="crosshair"
          src="/crosshair.svg"
          alt="crosshair"
        />
      )}

      {mapInstance && <DrawControls />}
    </div>
  )
}
```

#### 1.5 Add CSS for Clean Preview

**File**: `/src/styles/preview.scss` (new file)

```scss
// Hide any remaining UI elements in preview mode
body.preview-mode {
  // Hide attribution (optional - may need for legal reasons)
  .maplibregl-ctrl-attrib {
    display: none;
  }

  // Ensure full viewport
  #root, #map {
    width: 100vw !important;
    height: 100vh !important;
  }

  // Hide any popups/tooltips
  .maplibregl-popup {
    display: none;
  }
}
```

Apply class in App.tsx:

```typescript
useEffect(() => {
  if (isPreview) {
    document.body.classList.add('preview-mode')
  }
}, [isPreview])
```

---

### Phase 2: Backend - Puppeteer Screenshot Service

**Goal**: Create Flask service that uses Puppeteer to screenshot the preview URL.

#### 2.1 Install Dependencies

**File**: `/backend-dev-python/requirements.txt`

Add:
```
pyppeteer>=1.0.2
asyncio
```

Pyppeteer is a Python port of Puppeteer (headless Chrome automation).

#### 2.2 Create OG Preview Module

**File**: `/backend-dev-python/api/modules/og_preview.py`

```python
from flask import Blueprint, send_file, abort, render_template
from pyppeteer import launch
import asyncio
import os
import io
from hashlib import md5
from pathlib import Path
from functools import lru_cache
from urllib.parse import urlencode, urlparse, parse_qs

bp = Blueprint('og_preview', __name__, url_prefix='/og-preview')

# Configuration
OG_IMAGE_WIDTH = 1200
OG_IMAGE_HEIGHT = 630
CACHE_DIR = '/tmp/libmap-og-cache'
BASE_URL = 'https://libmap.org'

# Ensure cache directory exists
Path(CACHE_DIR).mkdir(exist_ok=True)

def parse_libmap_url(url_path):
    """
    Parse libmap URL to extract account, hashtag, and map params.
    Format: /@account/~hashtag/map?ls=layers&z=zoom&lat=lat&lng=lng
    """
    parsed = urlparse(url_path)
    query = parse_qs(parsed.query)

    # Extract from query params
    lat = query.get('lat', ['22.02455'])[0]
    lng = query.get('lng', ['0.08789'])[0]
    zoom = query.get('z', ['3'])[0]
    layers = query.get('ls', ['satellite'])[0]

    # Extract from path
    path_parts = parsed.path.split('/')[1:]  # Remove leading ''
    account = None
    hashtag = None

    for part in path_parts:
        if part.startswith('@'):
            account = part[1:]
        elif part.startswith('~'):
            hashtag = part[1:]

    return {
        'lat': lat,
        'lng': lng,
        'zoom': zoom,
        'layers': layers,
        'account': account,
        'hashtag': hashtag
    }

def generate_cache_key(params):
    """Generate MD5 hash from parameters for caching."""
    key_string = f"{params['lat']}_{params['lng']}_{params['zoom']}_{params['layers']}"
    return md5(key_string.encode()).hexdigest()

async def capture_screenshot(preview_url, width=OG_IMAGE_WIDTH, height=OG_IMAGE_HEIGHT):
    """
    Use Puppeteer to capture screenshot of preview URL.
    """
    browser = await launch(
        headless=True,
        args=[
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    )

    try:
        page = await browser.newPage()
        await page.setViewport({'width': width, 'height': height})

        # Navigate to preview URL
        await page.goto(preview_url, {
            'waitUntil': 'networkidle0',  # Wait for all network requests
            'timeout': 30000  # 30 second timeout
        })

        # Wait extra time for map tiles to load
        await asyncio.sleep(2)

        # Take screenshot
        screenshot_bytes = await page.screenshot({
            'type': 'png',
            'fullPage': False
        })

        return screenshot_bytes

    finally:
        await browser.close()

@bp.route('/image/<cache_key>.png')
def serve_image(cache_key):
    """
    Serve OG preview image.
    Generates via Puppeteer screenshot if not cached.
    """
    cache_path = os.path.join(CACHE_DIR, f"{cache_key}.png")

    # Serve from cache if exists
    if os.path.exists(cache_path):
        return send_file(cache_path, mimetype='image/png')

    # Otherwise, we need the params to regenerate
    # This shouldn't happen in normal flow, but handle gracefully
    abort(404, description="Image not found. Request via OG preview page first.")

@bp.route('/<path:url_path>')
def preview_page(url_path):
    """
    Generate HTML with OG meta tags for crawlers.
    Also triggers screenshot generation if needed.
    """
    # Parse URL
    params = parse_libmap_url(url_path)
    cache_key = generate_cache_key(params)
    cache_path = os.path.join(CACHE_DIR, f"{cache_key}.png")

    # Generate screenshot if not cached
    if not os.path.exists(cache_path):
        # Build preview URL
        preview_params = {
            'lat': params['lat'],
            'lng': params['lng'],
            'z': params['zoom'],
            'ls': params['layers'],
            'preview': '1'
        }
        preview_url = f"{BASE_URL}/map?{urlencode(preview_params)}"

        # Capture screenshot asynchronously
        try:
            screenshot_bytes = asyncio.run(capture_screenshot(preview_url))

            # Save to cache
            with open(cache_path, 'wb') as f:
                f.write(screenshot_bytes)
        except Exception as e:
            print(f"Screenshot failed: {e}")
            # Return OG tags anyway with fallback image
            pass

    # Generate title and description
    title = "libmap.org - Climate Action Map"
    description = f"Interactive map view at zoom level {params['zoom']}"

    if params['account']:
        title = f"libmap.org - @{params['account']}'s view"
        description = f"Explore climate data shared by @{params['account']}"
    elif params['hashtag']:
        title = f"libmap.org - #{params['hashtag']}"
        description = f"Climate action map tagged with #{params['hashtag']}"

    # Image URL
    image_url = f"https://libmap.org/og-image/{cache_key}.png"

    # Original URL
    full_url = f"https://libmap.org{url_path}"

    return render_template('og_preview.html.j2',
        title=title,
        description=description,
        image_url=image_url,
        url=full_url
    )
```

#### 2.3 Create HTML Template

**File**: `/backend-dev-python/api/templates/og_preview.html.j2`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="{{ url }}">
    <meta property="og:title" content="{{ title }}">
    <meta property="og:description" content="{{ description }}">
    <meta property="og:image" content="{{ image_url }}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ title }}">
    <meta name="twitter:description" content="{{ description }}">
    <meta name="twitter:image" content="{{ image_url }}">

    <title>{{ title }}</title>

    <!-- Redirect to main app after 1 second -->
    <meta http-equiv="refresh" content="1;url={{ url }}">
</head>
<body>
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
    <p>Redirecting to interactive map...</p>
</body>
</html>
```

#### 2.4 Register Blueprint

**File**: `/backend-dev-python/api/__init__.py`

```python
from .modules import toots, log, og_preview

def create_app(test_config=None):
    app = Flask(__name__)
    # ... existing config ...

    app.register_blueprint(toots.bp)
    app.register_blueprint(log.bp)
    app.register_blueprint(og_preview.bp)  # Add this

    return app
```

---

### Phase 3: Server Configuration

#### 3.1 Nginx Configuration

**File**: `/etc/nginx/sites-available/libmap.org` (on explorer200.abteil.org)

```nginx
# Detect social media crawlers
map $http_user_agent $is_crawler {
    default 0;
    "~*Twitterbot" 1;
    "~*Bluesky" 1;
    "~*facebookexternalhit" 1;
    "~*LinkedInBot" 1;
    "~*Slackbot" 1;
}

server {
    listen 80;
    server_name libmap.org www.libmap.org;
    root /var/www/html/libmap.org;
    index index.html;

    # Crawler detection - proxy to Flask for OG preview
    location / {
        if ($is_crawler = 1) {
            proxy_pass https://dev.libmap.org/og-preview$request_uri;
            break;
        }

        # Serve SPA for regular users
        try_files $uri $uri/ /index.html;
    }

    # Serve OG preview images
    location /og-image/ {
        proxy_pass https://dev.libmap.org/og-preview/image/;
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800";
    }
}
```

Reload Nginx after changes:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### Phase 4: System Dependencies

#### 4.1 Install Chromium on Server

Pyppeteer requires Chromium to be installed on the server.

**On dev.libmap.org server (where Flask runs):**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y chromium-browser chromium-chromedriver

# Or use Puppeteer's bundled Chromium
pyppeteer-install
```

---

### Phase 5: Testing

#### 5.1 Test Preview Route Locally

```bash
# Start frontend dev server
npm run dev

# Visit preview URL
http://localhost:3000/map?lat=48.2082&lng=16.3738&z=10&ls=satellite&preview=1
```

**Expected**: Map renders without sidebar, controls, crosshair.

#### 5.2 Test Backend Screenshot

```bash
# Start Flask backend
cd /backend-dev-python
python runApi.py

# Test OG preview page (simulating crawler)
curl -H "User-Agent: Twitterbot/1.0" \
  "http://localhost:5000/og-preview/map?lat=48.2082&lng=16.3738&z=10&ls=satellite"

# Check if screenshot was generated
ls /tmp/libmap-og-cache/
```

#### 5.3 Test Image Endpoint

```bash
# Get the cache key from previous step
curl "http://localhost:5000/og-preview/image/{hash}.png" -o test-og.png
open test-og.png
```

**Expected**: 1200x630px screenshot of the map.

#### 5.4 Validate with Social Media Tools

- **Twitter Card Validator**: https://cards-dev.twitter.com/validator
- **Facebook Debugger**: https://developers.facebook.com/tools/debug/
- **LinkedIn Inspector**: https://www.linkedin.com/post-inspector/

---

### Phase 6: Optimization & Caching

#### 6.1 Cache Cleanup Cron Job

Add to server crontab:

```bash
# Clean up old screenshots every day at 2 AM
0 2 * * * find /tmp/libmap-og-cache -name "*.png" -mtime +7 -delete
```

#### 6.2 Performance Optimization

**Add waiting for map load event:**

In og_preview.py, improve screenshot timing:

```python
# Wait for custom event from frontend
await page.evaluate("""
    new Promise((resolve) => {
        window.addEventListener('maplibre-loaded', () => resolve());
        setTimeout(resolve, 5000); // Fallback timeout
    })
""")
```

In MapContainer.tsx, dispatch event when ready:

```typescript
useEffect(() => {
  if (mapInstance && isPreview) {
    mapInstance.on('idle', () => {
      window.dispatchEvent(new Event('maplibre-loaded'))
    })
  }
}, [mapInstance, isPreview])
```

This ensures tiles are fully loaded before screenshot.

---

## Critical Files

### Frontend (React)

**Modified files:**
- `/src/store/index.ts` - Add isPreview flag to UI state
- `/src/hooks/useUrlState.ts` - Parse preview parameter from URL
- `/src/types/index.ts` - Add isPreview to URLState type
- `/src/App.tsx` - Conditionally hide Sidebar in preview mode
- `/src/components/Map/MapContainer.tsx` - Hide controls, crosshair, search button

**New files:**
- `/src/styles/preview.scss` - Preview-specific CSS

### Backend (Python Flask)

**New files:**
- `/backend-dev-python/api/modules/og_preview.py` - Screenshot generation logic
- `/backend-dev-python/api/templates/og_preview.html.j2` - OG meta tags template

**Modified files:**
- `/backend-dev-python/api/__init__.py` - Register og_preview blueprint
- `/backend-dev-python/requirements.txt` - Add pyppeteer

### Server Configuration

**Modified files:**
- `/etc/nginx/sites-available/libmap.org` - Crawler detection and routing

---

## Implementation Steps

1. **Frontend - Add Preview Mode**
   - Add isPreview to Zustand store
   - Detect preview param in useUrlState
   - Hide UI components conditionally
   - Test locally: `/map?preview=1`

2. **Backend - Screenshot Service**
   - Install pyppeteer dependency
   - Create og_preview.py module
   - Create og_preview.html.j2 template
   - Register blueprint
   - Test screenshot generation locally

3. **System Setup**
   - Install Chromium on Flask server
   - Set up cache directory
   - Test screenshot timing

4. **Server Configuration**
   - Configure Nginx crawler detection
   - Set up image serving endpoint
   - Test with curl + User-Agent

5. **Deploy & Test**
   - Deploy frontend (npm run build && npm run live)
   - Deploy backend to dev.libmap.org
   - Test with social media validators
   - Post test link on Twitter/Bluesky

6. **Optimize**
   - Add map load event detection
   - Set up cache cleanup cron
   - Monitor performance

---

## Technical Details

### Screenshot Timing

Critical to wait for:
1. DOM ready (networkidle0)
2. MapLibre initialized
3. Tiles loaded
4. Layers rendered

Use `maplibregl.Map.on('idle')` event + custom event dispatch for reliability.

### Image Dimensions

- **OG Standard**: 1200x630px (1.91:1 ratio)
- **Twitter**: Same as OG
- **Facebook**: Supports 1200x630px
- **LinkedIn**: Supports 1200x627px (close enough)

### Browser User-Agents

```
Twitterbot/1.0
Bluesky-Cardyb/0.1
facebookexternalhit/1.1
LinkedInBot/1.0
Slackbot-LinkExpanding
```

### Cache Strategy

- **First request**: ~2-3s (Puppeteer screenshot)
- **Cached requests**: ~50ms (serve from disk)
- **TTL**: 7 days
- **Storage**: ~100-200KB per image
- **Cleanup**: Daily cron job

---

## Success Criteria

1. ✅ Sharing libmap.org link on Twitter shows map preview matching URL state
2. ✅ Different URLs generate different screenshots (location, zoom, layers)
3. ✅ Preview shows actual map rendering including overlay layers
4. ✅ First screenshot generation < 5s, cached < 100ms
5. ✅ UI elements (sidebar, controls) hidden in preview
6. ✅ Works on Twitter, Bluesky, Facebook, LinkedIn
7. ✅ Regular users get normal SPA (no impact on UX)

---

## Estimated Effort

- **Frontend preview mode**: 2-3 hours
- **Backend screenshot service**: 4-6 hours
- **Server setup & deployment**: 2-3 hours
- **Testing & optimization**: 2-3 hours
- **Total**: ~10-15 hours (~1.5-2 days)

---

## Alternative: Faster Screenshots with Shared Browser Instance

For better performance, maintain a single Puppeteer browser instance:

```python
# Global browser instance
_browser = None

async def get_browser():
    global _browser
    if _browser is None or not _browser.isConnected():
        _browser = await launch(...)
    return _browser

async def capture_screenshot(url):
    browser = await get_browser()
    page = await browser.newPage()
    # ... screenshot logic ...
    await page.close()  # Close page but keep browser
```

This reduces screenshot time from ~2-3s to ~1-1.5s.
