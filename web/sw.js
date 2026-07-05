const CACHE_NAME = "kids-learn-card-camp-portrait-hi-fi-v16";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./words.js",
  "./math.js",
  "./content/cards.js",
  "./battle.js",
  "./app.js",
  "./styles.css",
  "./assets/ui/card-paper-texture.webp",
  "./assets/ui/battle-lobby-bg.webp",
  "./assets/ui/supply-crate.webp",
  "./assets/ui/hero-commander.webp",
  "./assets/ui/base-bg.svg",
  "./assets/ui/battle-table.svg",
  "./assets/ui/card-back.svg",
  "./assets/ui/commander.svg",
  "./assets/ui/crate.svg",
  "./assets/ui/crest.svg",
  "./assets/ui/front-texture.svg",
  "./assets/ui/learn-english.svg",
  "./assets/ui/learn-math.svg",
  "./assets/ui/support-texture.svg",
  "./assets/ui/faction-steel.svg",
  "./assets/ui/faction-sky.svg",
  "./assets/ui/faction-supply.svg",
  "./assets/ui/faction-guard.svg",
  "./assets/ui/faction-tactic.svg",
  "./assets/ui/faction-vanguard.svg",
  "./audio/apple.wav",
  "./audio/baby.wav",
  "./audio/bag.wav",
  "./audio/banana.wav",
  "./audio/bed.wav",
  "./audio/bird.wav",
  "./audio/black.wav",
  "./audio/blue.wav",
  "./audio/book.wav",
  "./audio/boy.wav",
  "./audio/cat.wav",
  "./audio/chair.wav",
  "./audio/cow.wav",
  "./audio/cup.wav",
  "./audio/dad.wav",
  "./audio/desk.wav",
  "./audio/dog.wav",
  "./audio/duck.wav",
  "./audio/ear.wav",
  "./audio/eraser.wav",
  "./audio/eye.wav",
  "./audio/fish.wav",
  "./audio/foot.wav",
  "./audio/girl.wav",
  "./audio/grape.wav",
  "./audio/green.wav",
  "./audio/hand.wav",
  "./audio/head.wav",
  "./audio/home.wav",
  "./audio/leg.wav",
  "./audio/lemon.wav",
  "./audio/mom.wav",
  "./audio/mouth.wav",
  "./audio/nose.wav",
  "./audio/orange-color.wav",
  "./audio/orange-fruit.wav",
  "./audio/peach.wav",
  "./audio/pear.wav",
  "./audio/pen.wav",
  "./audio/pencil.wav",
  "./audio/pig.wav",
  "./audio/pink.wav",
  "./audio/rabbit.wav",
  "./audio/red.wav",
  "./audio/ruler.wav",
  "./audio/sfx-correct.wav",
  "./audio/sfx-wrong.wav",
  "./audio/watermelon.wav",
  "./audio/white.wav",
  "./audio/yellow.wav"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const clone = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
    return response;
  }).catch(() => caches.match("./index.html"))));
});

