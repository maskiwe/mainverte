// Service Worker - Main Verte v1.7
const CACHE_NAME = 'main-verte-v1.7';
const urlsToCache = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// =====================================================
// INSTALL
// =====================================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// =====================================================
// ACTIVATE - clean old caches
// =====================================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(names =>
            Promise.all(names.map(name => {
                if (name !== CACHE_NAME && name !== 'webhook-config') return caches.delete(name);
            }))
        ).then(() => self.clients.claim())
    );
});

// =====================================================
// FETCH - Network first for local, skip API/CDN caching
// =====================================================
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.hostname.includes('googleapis.com') ||
        url.hostname.includes('cdn.tailwindcss.com') ||
        url.hostname.includes('unpkg.com') ||
        url.hostname.endsWith('supabase.co') ||
        url.pathname.startsWith('/.netlify/functions/')) {
        return;
    }
    event.respondWith(
        fetch(event.request)
            .then(resp => {
                if (resp && resp.status === 200) {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                }
                return resp;
            })
            .catch(() => caches.match(event.request).then(r => r || new Response('Hors ligne', { status: 503 })))
    );
});

// =====================================================
// IndexedDB access from Service Worker
// (same DB as the app - reads plant data)
// =====================================================
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('PlantMonitorDB', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('plants')) {
                db.createObjectStore('plants', { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function loadPlants() {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('plants', 'readonly');
            const store = tx.objectStore('plants');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    });
}

// =====================================================
// Check which plants need watering and notify
// =====================================================
async function checkAndNotify() {
    try {
        const plants = await loadPlants();
        if (!plants.length) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Filter plants needing water, excluding no-watering prescriptions
        const needWater = plants.filter(p => {
            if (p.prescription && new Date(p.prescription.endDate) > new Date() && p.prescription.noWatering) return false;
            const next = new Date(p.nextWatering + 'T00:00:00');
            return next <= today;
        });

        if (needWater.length === 0) return;

        // Build message
        let title, body;
        if (needWater.length === 1) {
            title = '💧 ' + needWater[0].name + ' a soif !';
            body = 'Il est temps d\'arroser cette plante.';
        } else {
            title = '💧 ' + needWater.length + ' plantes a arroser';
            body = needWater.map(p => p.name).join(', ');
        }

        // Push notification
        try {
            await self.registration.showNotification(title, {
                body: body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: 'watering-reminder',
                renotify: true,
                data: { url: '/' }
            });
        } catch (e) { console.log('SW notification error:', e); }

        // Webhook (Slack / Make.com)
        await sendWebhook(plants, needWater);
    } catch (e) {
        console.error('SW checkAndNotify error:', e);
    }
}

// =====================================================
// Send webhook (reads URL from localStorage via IDB workaround)
// SW can't access localStorage, so we use a simple cache
// =====================================================
async function sendWebhook(allPlants, needWater) {
    try {
        // Try to get webhook URL from a dedicated IDB store or cache
        let webhookUrl = null;

        // Method: read from cache API (we store it there from the main app)
        const cache = await caches.open('webhook-config');
        const resp = await cache.match('/webhook-url');
        if (resp) {
            webhookUrl = await resp.text();
        }

        if (!webhookUrl) return;

        const payload = {
            type: 'reminder',
            app: 'Main Verte',
            date: new Date().toISOString(),
            total_plants: allPlants.length,
            plants_to_water: needWater.length,
            message: needWater.length === 1
                ? '💧 ' + needWater[0].name + ' a soif !'
                : '💧 ' + needWater.length + ' plantes a arroser : ' + needWater.map(p=>p.name).join(', '),
            plants: needWater.map(p => ({
                name: p.name,
                next_watering: p.nextWatering,
                water_amount: p.waterAmount || ''
            }))
        };

        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            mode: 'no-cors' // works for Slack webhooks that block CORS
        });
    } catch (e) {
        console.log('SW webhook error:', e);
    }
}

// =====================================================
// PERIODIC BACKGROUND SYNC
// Chrome wakes up the SW ~once/day for installed PWAs
// =====================================================
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-watering') {
        event.waitUntil(checkAndNotify());
    }
});

// =====================================================
// REGULAR SYNC (fallback - fires when back online)
// =====================================================
self.addEventListener('sync', (event) => {
    if (event.tag === 'check-watering-sync') {
        event.waitUntil(checkAndNotify());
    }
});

// =====================================================
// PUSH (future-proof: if you ever add a push server)
// =====================================================
self.addEventListener('push', (event) => {
    event.waitUntil(checkAndNotify());
});

// =====================================================
// NOTIFICATION CLICK - open the app
// =====================================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            // Focus existing window if open
            for (const client of list) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new window
            return clients.openWindow(event.notification.data?.url || '/');
        })
    );
});
