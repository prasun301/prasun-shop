/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & INTERACTIVITY (FULL 20-PRODUCT CATALOG)
 * ============================================================================
 */
"use strict";
(() => {
    /* ========================================================================
       CONFIG
       ======================================================================== */
    const API_ENDPOINT = "https://prasun-shop-api.prasun301.workers.dev/api/products";
    const CART_KEY = "prasun_cart";
    const CART_EVENT_NAME = "prasunCartUpdated";
    const API_TIMEOUT = 12000;
    const SEARCH_DELAY = 400;
    const MAX_CART_QUANTITY = 99;
    const MIN_SEARCH_LENGTH = 2;
    const PRODUCT_DETAIL_PAGE = "/product.html";

    /* ========================================================================
       LOCAL FALLBACK CATALOG (ALL 20 PRODUCTS)
       ======================================================================== */
    const LOCAL_CATALOG = [
        {
            id: "001",
            pid: "7F16D3D3-8D71-4231-9F58-C525DF053933",
            sku: "CJSN-SOLAR-SQUARE-01",
            name: "Solar Square Outdoor Lawn & Pathway Light",
            category: "Solar Lighting",
            price: 14.99,
            rating: 4.8,
            image: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/10_57d942b5-c025-425a-a8a4-d87c6a612631.png",
            images: ["https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/10_57d942b5-c025-425a-a8a4-d87c6a612631.png"],
            description: "Eco-friendly solar-powered square lawn light designed for pathways, gardens, and patios.",
            features: ["Solar powered", "IP65 Waterproof", "Automatic dusk-to-dawn sensor"],
            specifications: { "Power": "Solar", "Application": "Garden / Pathway" },
            variants: []
        },
        {
            id: "002",
            pid: "BD6EA7E4-AED6-49F4-8384-070E770A9B45",
            sku: "CJSN-WATCH-DZ09-02",
            name: "Sports DZ09 Smart Watch Phone with SIM Card Slot",
            category: "Smart Tech",
            price: 24.99,
            rating: 4.7,
            image: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/1_d000e27d-654f-42a9-a69e-fa741145c989.jpg",
            images: ["https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/1_d000e27d-654f-42a9-a69e-fa741145c989.jpg"],
            description: "Multifunctional smart watch supporting SIM card calls, fitness tracking, and media playback.",
            features: ["SIM/TF card support", "Fitness tracking", "Bluetooth connectivity"],
            specifications: { "Display": "1.54 inch Touchscreen", "Compatibility": "Android & iOS" },
            variants: []
        },
        {
            id: "003",
            pid: "1453958912725356544",
            sku: "CJSN-CAM-BULB-03",
            name: "1080P E27 Light Bulb WiFi Security Camera with 4X Zoom",
            category: "Security Cameras",
            price: 29.99,
            rating: 4.9,
            image: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/1_6c876bad-b1e0-4d44-9c62-e7c1d9daadb1_trans.jpeg",
            images: ["https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/1_6c876bad-b1e0-4d44-9c62-e7c1d9daadb1_trans.jpeg"],
            description: "E27 socket smart security camera featuring 360-degree rotation, night vision, and motion alarms.",
            features: ["E27 socket easy setup", "1080P HD & 4X Zoom", "Two-way audio"],
            specifications: { "Socket": "E27", "Connectivity": "2.4G/5G WiFi" },
            variants: []
        },
        {
            id: "004",
            pid: "33404F81-103D-47F9-A1F5-25F46F24912E",
            sku: "CJSN-SOLAR-WALL-04",
            name: "Outdoor LED Solar Motion Sensor Wall Light",
            category: "Solar Lighting",
            price: 16.50,
            rating: 4.8,
            image: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800",
            images: ["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800"],
            description: "High-efficiency solar wall lamp featuring PIR motion sensing and durable weatherproofing.",
            features: ["Motion sensor detection", "Solar charging", "Weatherproof housing"],
            specifications: { "Mounting": "Wall Mount", "Sensor Range": "3-5 meters" },
            variants: []
        },
        {
            id: "005",
            pid: "2603200034341621400",
            sku: "CJSN-LAPTOP-156-05",
            name: "15.6-Inch 14th Gen Core Ultra-Thin Portable Laptop",
            category: "Laptops & Computers",
            price: 499.99,
            rating: 4.9,
            image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800",
            images: ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800"],
            description: "High-performance ultra-thin laptop designed for productivity, office tasks, and multimedia.",
            features: ["15.6 inch FHD screen", "Slim lightweight metallic body", "Fast SSD storage"],
            specifications: { "Screen Size": "15.6 Inch", "OS": "Windows 11 Compatible" },
            variants: []
        },
        {
            id: "006",
            pid: "1474642093514297344",
            sku: "CJSN-WIFI-EXTEND-06",
            name: "High-Speed WiFi Signal Booster & Network Range Extender",
            category: "Networking",
            price: 19.99,
            rating: 4.6,
            image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800",
            images: ["https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800"],
            description: "Boost wireless signal coverage and eliminate dead zones across homes and offices.",
            features: ["300Mbps/1200Mbps speeds", "Easy WPS button setup", "Universal compatibility"],
            specifications: { "Coverage": "Up to 1500 sq ft", "Plug Type": "US/EU/UK" },
            variants: []
        },
        {
            id: "007",
            pid: "1371639591588728832",
            sku: "CJSN-SOLAR-CAM-07",
            name: "Wireless Solar Rechargeable Battery Outdoor Security Camera",
            category: "Security Cameras",
            price: 59.99,
            rating: 4.9,
            image: "https://images.unsplash.com/photo-1557324232-b8917d7c3dcb?w=800",
            images: ["https://images.unsplash.com/photo-1557324232-b8917d7c3dcb?w=800"],
            description: "100% wire-free outdoor camera powered continuously by an integrated solar charging panel.",
            features: ["Solar rechargeable battery", "PIR human detection", "HD night vision"],
            specifications: { "Resolution": "1080P HD", "Power": "Solar Panel + Rechargeable Battery" },
            variants: []
        },
        {
            id: "008",
            pid: "2501150354231626700",
            sku: "CJSN-POCKET-CAM-08",
            name: "4K HD Anti-Shake Mini Pocket Sports Action Camera",
            category: "Cameras",
            price: 45.00,
            rating: 4.7,
            image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800",
            images: ["https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800"],
            description: "Compact anti-shake pocket camera ideal for vlogging, travel videos, and sports recording.",
            features: ["4K HD resolution", "Anti-shake stabilization", "Pocket-sized body"],
            specifications: { "Video Resolution": "4K", "Storage": "MicroSD Support" },
            variants: []
        },
        {
            id: "009",
            pid: "53B90868-F0F2-4347-81C5-A0CBAC9E0F91",
            sku: "CJSN-LOWPOWER-CAM-09",
            name: "Low-Power Outdoor Solar Surveillance Camera System",
            category: "Security Cameras",
            price: 64.99,
            rating: 4.8,
            image: "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=800",
            images: ["https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=800"],
            description: "Ultra low-power standby solar security camera with remote app viewing and instant alerts.",
            features: ["Low power consumption mode", "Solar panel operation", "App motion alerts"],
            specifications: { "Connectivity": "WiFi/4G Options", "Waterproof": "IP66" },
            variants: []
        },
        {
            id: "010",
            pid: "1422819066715967488",
            sku: "CJSN-ACTION-CAM-10",
            name: "4K 30FPS Waterproof Outdoor Action Sports & Diving Camera",
            category: "Cameras",
            price: 38.99,
            rating: 4.8,
            image: "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=800",
            images: ["https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=800"],
            description: "Rugged waterproof action camera designed for diving, helmet mounting, and extreme outdoor sports.",
            features: ["4K 30FPS video", "Waterproof up to 30m with case", "Helmet mount accessories"],
            specifications: { "Waterproof Depth": "30 meters", "FPS": "30FPS at 4K" },
            variants: []
        },
        {
            id: "011",
            pid: "5D57D247-A792-46AF-BAC4-7917A79CBAD7",
            sku: "CJSN-STREET-LIGHT-11",
            name: "Commercial Heavy-Duty Solar Street Light",
            category: "Solar Lighting",
            price: 42.50,
            rating: 4.9,
            image: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800",
            images: ["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800"],
            description: "Bright wide-area outdoor solar street light suited for driveways, yards, and rural roads.",
            features: ["High lumen brightness", "Remote control included", "Auto day/night sensor"],
            specifications: { "Illumination Area": "Wide Coverage", "Control": "Remote & Auto" },
            variants: []
        },
        {
            id: "012",
            pid: "1704015456786460672",
            sku: "CJSN-TUNGSTEN-LAMP-12",
            name: "Outdoor Vintage Tungsten Solar Garden Wall Lamp",
            category: "Solar Lighting",
            price: 18.99,
            rating: 4.7,
            image: "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800",
            images: ["https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800"],
            description: "Decorative warm-glow tungsten style solar wall lamp designed for gardens and patio fences.",
            features: ["Warm tungsten bulb effect", "Solar auto charging", "Weatherproof outdoor casing"],
            specifications: { "Light Tone": "Warm White", "Mounting": "Wall Mount" },
            variants: []
        },
        {
            id: "013",
            pid: "715A241F-0D48-462C-99A4-9CAFD48092EA",
            sku: "CJSN-STAIR-LIGHT-13",
            name: "6-LED Solar Stair & Step Outdoor Accent Light",
            category: "Solar Lighting",
            price: 12.99,
            rating: 4.8,
            image: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800",
            images: ["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800"],
            description: "Compact 6-LED solar step light for stairways, outdoor steps, and deck corners.",
            features: ["6 high-brightness LEDs", "Automatic night activation", "Compact flush mount design"],
            specifications: { "LED Count": "6 LEDs", "Application": "Stairs / Decks" },
            variants: []
        },
        {
            id: "014",
            pid: "1394127274957213696",
            sku: "CJSN-GARDEN-SENSOR-14",
            name: "Solar Outdoor Garden Lamp with PIR Sensor",
            category: "Solar Lighting",
            price: 21.99,
            rating: 4.7,
            image: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800",
            images: ["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800"],
            description: "Reliable outdoor garden sensor light offering multiple brightness levels and energy saving modes.",
            features: ["PIR motion detection", "Multi-mode lighting settings", "Durable IP65 body"],
            specifications: { "Sensor Angle": "120 Degrees", "Power Source": "Solar Panel" },
            variants: []
        },
        {
            id: "015",
            pid: "1676481746642153472",
            sku: "CJSN-4IN1-CHARGER-15",
            name: "4-in-1 Magnetic Wireless Fast Charging Station with Atmosphere Light",
            category: "Charging & Power",
            price: 34.99,
            rating: 4.9,
            image: "https://images.unsplash.com/photo-1622445275574-55bc775fcae2?w=800",
            images: ["https://images.unsplash.com/photo-1622445275574-55bc775fcae2?w=800"],
            description: "All-in-one desk charging dock for iPhone, Apple Watch, AirPods, and built-in ambient lighting.",
            features: ["Simultaneous 4-device charging", "Magnetic snap alignment", "Ambient night lamp"],
            specifications: { "Max Output": "15W", "Compatibility": "Qi-enabled devices" },
            variants: []
        },
        {
            id: "016",
            pid: "1888123176069754881",
            sku: "CJSN-15W-MAGSAFE-16",
            name: "15W Magnetic Fast Wireless Charger for iPhone Series",
            category: "Charging & Power",
            price: 19.99,
            rating: 4.9,
            image: "https://images.unsplash.com/photo-1586816879360-004f5b0c51e3?w=800",
            images: ["https://images.unsplash.com/photo-1586816879360-004f5b0c51e3?w=800"],
            description: "Slim magnetic fast charger compatible with iPhone 12 through iPhone 17 series models.",
            features: ["Strong magnetic hold", "15W fast wireless charging", "Ultra-thin aluminum shell"],
            specifications: { "Charging Power": "15W / 10W / 7.5W / 5W", "Connector": "USB-C" },
            variants: []
        },
        {
            id: "017",
            pid: "1398550431994613760",
            sku: "CJSN-EARBUDS-SPORT-17",
            name: "In-Ear Noise-Canceling Sports Wireless Bluetooth Headset",
            category: "Audio",
            price: 27.99,
            rating: 4.8,
            image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800",
            images: ["https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800"],
            description: "Ergonomic sports earbud system featuring noise cancellation, deep bass, and sweat protection.",
            features: ["Active Noise Cancellation", "Sweatproof fit for workouts", "HD microphone for calls"],
            specifications: { "Playtime": "5-7 Hours", "Bluetooth": "V5.3" },
            variants: []
        },
        {
            id: "018",
            pid: "10D0F2B4-5846-4D55-9936-3C90147C1559",
            sku: "CJSN-118LED-SOLAR-18",
            name: "118-LED PIR Motion Sensor Outdoor Solar Light",
            category: "Solar Lighting",
            price: 22.50,
            rating: 4.9,
            image: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800",
            images: ["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800"],
            description: "Ultra-bright 118 LED solar flood lamp providing wide-angle illumination for gardens and patios.",
            features: ["118 high-power LEDs", "Wide 270-degree lighting angle", "3 intelligent modes"],
            specifications: { "LED Count": "118 LEDs", "Angle": "270 Degrees" },
            variants: []
        },
        {
            id: "019",
            pid: "A3188610-A8DA-4F69-919F-EDE95F95F05B",
            sku: "CJSN-FLOOD-LIGHT-19",
            name: "High-Output Outdoor Solar Flood Light System",
            category: "Solar Lighting",
            price: 39.99,
            rating: 4.8,
            image: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800",
            images: ["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800"],
            description: "Zero-electricity-cost solar floodlight built for yard, roof, balcony, and garden security.",
            features: ["Zero electric power consumption", "Remote control included", "Heavy-duty waterproof shell"],
            specifications: { "Mounting": "Wall/Pole Mount", "Battery": "High Capacity Lithium" },
            variants: []
        },
        {
            id: "020",
            pid: "1563803901508464640",
            sku: "CJSN-SOLAR-PANEL-20",
            name: "13W 5V Portable Flexible USB Outdoor Solar Charger",
            category: "Portable Power",
            price: 26.99,
            rating: 4.7,
            image: "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800",
            images: ["https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800"],
            description: "Foldable and flexible USB solar charging board designed for camping, hiking, and phone emergencies.",
            features: ["13W solar panel efficiency", "Direct USB charging output", "Ultra-lightweight flexible design"],
            specifications: { "Output Voltage": "5V USB", "Power": "13W" },
            variants: []
        }
    ];

    /* ========================================================================
       DOM ELEMENTS
       ======================================================================== */
    const productList = document.getElementById("product-list");
    if (!productList) {
        console.error("[PRASUN SHOP] #product-list was not found.");
        return;
    }

    const searchInput = document.getElementById("product-search");
    const sortSelect = document.getElementById("product-sort");
    const categoriesContainer = document.getElementById("products-categories");
    const productsHeading = document.getElementById("products-heading") || document.getElementById("page-heading");
    const productsCount = document.getElementById("results-count");
    const clearSearchButton = document.getElementById("clear-search");
    const ariaLiveRegion = document.getElementById("aria-live-region");
    const cartCount = document.getElementById("cart-count");

    /* ========================================================================
       STATE
       ======================================================================== */
    let masterCatalog = []; 
    let allProducts = [];   
    let filteredProducts = [];
    let activeCategory = "all";
    let currentSearch = "";
    let currentSort = sortSelect?.value || "featured";
    let searchTimer = null;
    let activeSearchController = null;
    let searchRequestSequence = 0;
    let catalogRequestSequence = 0;

    /* ========================================================================
       FALLBACK IMAGE
       ======================================================================== */
    const FALLBACK_IMAGE =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
                <rect width="800" height="800" fill="#f8fafc"/>
                <path d="M220 540 L330 420 L420 500 L500 430 L580 540 Z" fill="#e2e8f0"/>
                <circle cx="330" cy="300" r="55" fill="#cbd5e1"/>
                <text x="400" y="635" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="28">
                    Image unavailable
                </text>
            </svg>
        `);

    /* ========================================================================
       HTML ESCAPING & TEXT HELPERS
       ======================================================================== */
    const ESCAPE_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    function escapeHTML(value) {
        if (value === null || value === undefined) return "";
        return String(value).replace(/[&<>"']/g, character => ESCAPE_MAP[character]);
    }

    function cleanText(value, fallback = "") {
        if (value === null || value === undefined) return fallback;
        const text = String(value).trim();
        return text || fallback;
    }

    /* ========================================================================
       PRICE FORMATTING
       ======================================================================== */
    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    function parsePrice(value) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return Math.max(0, value);
        }
        const parsed = parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    }

    function extractPrice(product) {
        if (!product || typeof product !== "object") return 0;
        const candidates = [
            product.discountPrice,
            product.nowPrice,
            product.sellPrice,
            product.price,
            product.startSellPrice,
            product.salePrice,
            product.productPrice
        ];
        for (const candidate of candidates) {
            const parsed = parsePrice(candidate);
            if (parsed > 0) return parsed;
        }
        return 0;
    }

    function formatPrice(value) {
        return currencyFormatter.format(parsePrice(value));
    }

    /* ========================================================================
       NORMALIZATION UTILS
       ======================================================================== */
    function normalizeImageURL(value) {
        if (!value) return "";
        let image = String(value).trim();
        if (!image) return "";
        if (image.startsWith("//")) return "https:" + image;
        if (/^https?:\/\//i.test(image) || image.startsWith("data:") || image.startsWith("/") || image.startsWith("./")) {
            return image;
        }
        return "https://" + image.replace(/^\/+/, "");
    }

    function extractImages(product) {
        const candidates = [];
        const addCandidate = value => {
            if (Array.isArray(value)) {
                value.forEach(addCandidate);
                return;
            }
            if (value && typeof value === "object") {
                addCandidate(value.url);
                addCandidate(value.imageUrl);
                addCandidate(value.image);
                return;
            }
            const normalized = normalizeImageURL(value);
            if (normalized) candidates.push(normalized);
        };

        addCandidate(product.image);
        addCandidate(product.bigImage);
        addCandidate(product.imageUrl);
        addCandidate(product.productImage);
        addCandidate(product.images);
        return [...new Set(candidates)];
    }

    function normalizeRating(product) {
        const value = product?.rating ?? product?.score ?? null;
        if (value === null || value === undefined || value === "") return null;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? Math.max(0, Math.min(5, numeric)) : null;
    }

    function normalizeProduct(product, index = 0) {
        if (!product || typeof product !== "object") return null;
        const id = product.id ?? product.pid ?? product.productId ?? `product-${index + 1}`;
        const sku = product.sku ?? product.productSku ?? id;
        const name = product.name ?? product.title ?? "CJ Product";
        const category = product.category ?? product.categoryName ?? "General";
        const description = product.description ?? "";

        const price = extractPrice(product);
        const rating = normalizeRating(product);
        const images = extractImages(product);
        const image = images[0] || "";

        return {
            id: cleanText(id, `product-${index + 1}`),
            sku: cleanText(sku, `SKU-${index + 1}`),
            name: cleanText(name, "CJ Product"),
            category: cleanText(category, "General"),
            price,
            rating,
            image,
            images,
            description: cleanText(description, "Quality product from PRASUN SHOP."),
            raw: product
        };
    }

    function extractProducts(data) {
        if (Array.isArray(data)) return data.map(normalizeProduct).filter(Boolean);
        if (!data || typeof data !== "object") return [];
        const candidates = [data.products, data.items, data.list, data.results, data.data?.products, data.data?.items];
        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate.map(normalizeProduct).filter(Boolean);
            }
        }
        return [];
    }

    function getLocalProducts() {
        return LOCAL_CATALOG.map(normalizeProduct).filter(Boolean);
    }

    function productKey(product) {
        if (!product) return "";
        return String(product.sku || product.id || "").trim().toLowerCase();
    }

    function mergeProducts(baseProducts, incomingProducts) {
        const map = new Map();
        for (const product of baseProducts || []) {
            const normalized = normalizeProduct(product);
            if (normalized) map.set(productKey(normalized), normalized);
        }
        for (const product of incomingProducts || []) {
            const normalized = normalizeProduct(product);
            if (normalized) map.set(productKey(normalized), normalized);
        }
        return Array.from(map.values());
    }

    /* ========================================================================
       FETCH JSON
       ======================================================================== */
    async function fetchJSON(url, timeout = API_TIMEOUT) {
        const controller = new AbortController();
        let timedOut = false;
        const timeoutId = window.setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeout);

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: { "Accept": "application/json" },
                cache: "no-store",
                signal: controller.signal
            });
            const text = await response.text();
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return text.trim() ? JSON.parse(text) : null;
        } catch (error) {
            if (timedOut || error?.name === "AbortError") {
                throw new Error(timedOut ? "Request timed out." : "Request cancelled.");
            }
            throw error;
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    async function loadProductsFromAPI(keyword = "", signal = null) {
        const trimmed = String(keyword || "").trim();
        let url = API_ENDPOINT;
        if (trimmed) {
            const params = new URLSearchParams();
            params.set("keyword", trimmed);
            url += `?${params.toString()}`;
        }
        const data = await fetchJSON(url, API_TIMEOUT, signal);
        const products = extractProducts(data);
        if (!products.length) throw new Error("API returned no usable products.");
        return products;
    }

    /* ========================================================================
       UI ANNOUNCEMENTS & CLEAR SEARCH
       ======================================================================== */
    function announce(message) {
        if (ariaLiveRegion) ariaLiveRegion.textContent = message;
    }

    function updateClearSearchButton() {
        if (!clearSearchButton || !searchInput) return;
        clearSearchButton.hidden = !searchInput.value.trim();
    }

    /* ========================================================================
       FILTER & SORT
       ======================================================================== */
    function filterProducts() {
        const search = currentSearch.trim().toLowerCase();
        filteredProducts = allProducts.filter(product => {
            if (activeCategory !== "all") {
                const productCategory = String(product.category || "").trim().toLowerCase();
                if (productCategory !== activeCategory.trim().toLowerCase()) return false;
            }
            if (!search) return true;
            const searchableText = [product.name, product.category, product.sku, product.description].join(" ").toLowerCase();
            return searchableText.includes(search);
        });
        applySort();
    }

    function applySort() {
        switch (currentSort) {
            case "price-low":
                filteredProducts.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
                break;
            case "price-high":
                filteredProducts.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
                break;
            case "rating":
                filteredProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            case "name-az":
                filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
                break;
            default:
                break;
        }
    }

    /* ========================================================================
       CATEGORIES
       ======================================================================== */
    function buildCategories() {
        if (!categoriesContainer) return;
        const categoryMap = new Map();
        allProducts.forEach(product => {
            const category = cleanText(product.category);
            if (category) categoryMap.set(category.toLowerCase(), category);
        });
        const categories = Array.from(categoryMap.values()).sort();

        categoriesContainer.innerHTML = `
            <button type="button" class="category-pill" data-category="all" aria-pressed="false">All</button>
            ${categories.map(cat => `<button type="button" class="category-pill" data-category="${escapeHTML(cat)}" aria-pressed="false">${escapeHTML(cat)}</button>`).join("")}
        `;
        setActiveCategory(activeCategory);
    }

    function setActiveCategory(category) {
        activeCategory = String(category || "all");
        if (!categoriesContainer) return;
        categoriesContainer.querySelectorAll(".category-pill").forEach(button => {
            const active = button.dataset.category.toLowerCase() === activeCategory.toLowerCase();
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        });
    }

    /* ========================================================================
       RENDERERS
       ======================================================================== */
    function renderLoading(message = "Loading catalog...") {
        productList.innerHTML = `
            <div class="product-status-card" role="status">
                <div class="spinner" aria-hidden="true"></div>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
        announce(message);
    }

    function renderEmpty(message = "No products found matching your criteria.") {
        productList.innerHTML = `<div class="product-status-card empty"><p>${escapeHTML(message)}</p></div>`;
        announce(message);
    }

    function renderRating(rating) {
        if (rating === null || rating === undefined || !Number.isFinite(rating)) {
            return '<span class="rating-badge rating-none">No reviews</span>';
        }
        const stars = "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
        return `<span class="rating-badge">${stars} (${rating.toFixed(1)})</span>`;
    }

    function renderProductCard(product) {
        const detailUrl = `${PRODUCT_DETAIL_PAGE}?id=${encodeURIComponent(product.id || product.sku)}`;
        const imageSrc = escapeHTML(product.image || FALLBACK_IMAGE);

        return `
            <article class="product-card" data-id="${escapeHTML(product.id)}" data-sku="${escapeHTML(product.sku)}">
                <a href="${detailUrl}" class="product-card-image-link" tabindex="-1" aria-hidden="true">
                    <img src="${imageSrc}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';" class="product-image"/>
                </a>
                <div class="product-card-body">
                    <div class="product-meta">
                        <span class="product-category">${escapeHTML(product.category)}</span>
                        ${renderRating(product.rating)}
                    </div>
                    <h3 class="product-title">
                        <a href="${detailUrl}">${escapeHTML(product.name)}</a>
                    </h3>
                    <p class="product-description">${escapeHTML(product.description)}</p>
                    <div class="product-card-footer">
                        <span class="product-price">${formatPrice(product.price)}</span>
                        <button type="button" class="btn-add-to-cart" data-id="${escapeHTML(product.id)}" aria-label="Add ${escapeHTML(product.name)} to cart">
                            <span class="cart-button-icon">+</span> Add to Cart
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    function updateProductHeadingAndCount() {
        if (productsCount) productsCount.textContent = `${filteredProducts.length} products`;
        if (productsHeading) {
            if (currentSearch.trim()) productsHeading.textContent = `Search Results for "${currentSearch.trim()}"`;
            else if (activeCategory !== "all") productsHeading.textContent = activeCategory;
            else productsHeading.textContent = "All Products";
        }
    }

    function renderProducts() {
        filterProducts();
        updateProductHeadingAndCount();
        if (!filteredProducts.length) {
            renderEmpty();
            return;
        }
        productList.innerHTML = filteredProducts.map(renderProductCard).join("");
        announce(`Showing ${filteredProducts.length} products`);
    }

    /* ========================================================================
       SHOPPING CART ENGINE
       ======================================================================== */
    function getCart() {
        try {
            const raw = localStorage.getItem(CART_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
            window.dispatchEvent(new CustomEvent(CART_EVENT_NAME, { detail: cart }));
        } catch (e) {
            console.error("[PRASUN SHOP] Failed to save cart", e);
        }
    }

    function updateCartBadge() {
        if (!cartCount) return;
        const cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        cartCount.textContent = String(totalItems);
        cartCount.hidden = totalItems === 0;
    }

    function addToCart(productId) {
        const product = allProducts.find(p => p.id === productId || p.sku === productId) ||
                        masterCatalog.find(p => p.id === productId || p.sku === productId);
        if (!product) return;

        const cart = getCart();
        const existingIndex = cart.findIndex(item => item.id === product.id || item.sku === product.sku);

        if (existingIndex > -1) {
            cart[existingIndex].quantity = Math.min(MAX_CART_QUANTITY, (cart[existingIndex].quantity || 1) + 1);
        } else {
            cart.push({
                id: product.id,
                sku: product.sku,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: 1
            });
        }

        saveCart(cart);
        updateCartBadge();
        announce(`Added ${product.name} to your cart.`);
    }

    /* ========================================================================
       SEARCH EXECUTION
       ======================================================================== */
    async function handleSearchExecution(query) {
        const trimmed = query.trim();
        searchRequestSequence++;
        const currentSeq = searchRequestSequence;

        if (activeSearchController) {
            activeSearchController.abort();
            activeSearchController = null;
        }

        if (trimmed.length >= MIN_SEARCH_LENGTH) {
            renderLoading(`Searching for "${trimmed}"...`);
            activeSearchController = new AbortController();

            try {
                const apiResults = await loadProductsFromAPI(trimmed, activeSearchController.signal);
                if (currentSeq !== searchRequestSequence) return;
                allProducts = mergeProducts(masterCatalog, apiResults);
                buildCategories();
                renderProducts();
            } catch (err) {
                if (err.name === "AbortError" || currentSeq !== searchRequestSequence) return;
                allProducts = [...masterCatalog];
                renderProducts();
            } finally {
                if (currentSeq === searchRequestSequence) activeSearchController = null;
            }
        } else {
            allProducts = [...masterCatalog];
            renderProducts();
        }
    }

    function onSearchInput(e) {
        currentSearch = e.target.value;
        updateClearSearchButton();
        if (searchTimer) window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => handleSearchExecution(currentSearch), SEARCH_DELAY);
    }

    /* ========================================================================
       EVENT LISTENERS
       ======================================================================== */
    function attachEventListeners() {
        searchInput?.addEventListener("input", onSearchInput);
        clearSearchButton?.addEventListener("click", () => {
            if (searchInput) {
                searchInput.value = "";
                currentSearch = "";
                updateClearSearchButton();
                handleSearchExecution("");
                searchInput.focus();
            }
        });

        sortSelect?.addEventListener("change", e => {
            currentSort = e.target.value;
            renderProducts();
        });

        categoriesContainer?.addEventListener("click", e => {
            const button = e.target.closest(".category-pill");
            if (!button) return;
            setActiveCategory(button.dataset.category);
            renderProducts();
        });

        productList.addEventListener("click", e => {
            const btn = e.target.closest(".btn-add-to-cart, .add-to-cart-btn");
            if (!btn) return;
            const id = btn.dataset.id;
            if (id) addToCart(id);
        });

        window.addEventListener(CART_EVENT_NAME, updateCartBadge);
        window.addEventListener("storage", e => {
            if (e.key === CART_KEY) updateCartBadge();
        });
    }

    /* ========================================================================
       INITIALIZATION
       ======================================================================== */
    async function initCatalog() {
        catalogRequestSequence++;
        const currentSeq = catalogRequestSequence;
        renderLoading("Fetching products...");

        try {
            const remoteProducts = await loadProductsFromAPI();
            if (currentSeq !== catalogRequestSequence) return;
            masterCatalog = mergeProducts(getLocalProducts(), remoteProducts);
            allProducts = [...masterCatalog];
        } catch (err) {
            if (currentSeq !== catalogRequestSequence) return;
            masterCatalog = getLocalProducts();
            allProducts = [...masterCatalog];
        }

        buildCategories();
        renderProducts();
        updateCartBadge();
        updateClearSearchButton();
    }

    function init() {
        attachEventListeners();
        initCatalog();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
