// 오프라인 캐시: 앱 파일·그림·라이브러리. 게임 기록은 Firebase(인터넷)에서.
const VERSION = "fi-655dec1002";
const CORE = [
  "./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
  "src/main.js", "src/state.js", "src/config/gameConfig.js", "src/config/firebaseConfig.js",
  "src/services/fb.js", "src/services/family.js", "src/services/playerStore.js", "src/services/worldStore.js",
  "src/game/world.js", "src/game/sprites.js", "src/game/game.js", "src/game/character.js", "src/game/minimap.js", "src/ui/ui.js", "src/services/emoteStore.js",
  "src/domain/inventory.js", "src/domain/rewards.js", "src/domain/crafting.js", "src/domain/placement.js",
  "src/domain/rounds.js", "src/domain/fishing.js", "src/domain/migrate.js", "src/domain/appearance.js", "src/domain/emotes.js", "src/domain/mapMarkers.js", "src/domain/forage.js",
  "data/items.json", "data/fish.json", "data/furniture.json", "data/recipes.json", "data/rooms.json", "data/island.json", "data/appearance.json", "data/forage.json",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js",
  "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js",
];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.hostname.includes("firebaseio.com") || u.hostname.includes("firebasedatabase.app") || u.hostname.includes("googleapis.com") && !u.pathname.includes("css")) return;
  // 앱 파일: 인터넷 먼저(새 버전), 안 되면 캐시
  e.respondWith(fetch(e.request).then(r => { if (r.ok && (u.origin === location.origin || CORE.includes(e.request.url))) { const c = r.clone(); caches.open(VERSION).then(ca => ca.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
