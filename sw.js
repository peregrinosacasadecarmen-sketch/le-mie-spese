'use strict';
/* Funzionamento senza connessione: i file dell'app vengono tenuti in copia sul dispositivo.
   A ogni rilascio cambiare VERSIONE, così i telefoni scaricano subito tutti i file nuovi insieme. */
const PREFISSO = 'spese-';
const VERSIONE = PREFISSO + 'v2';
const FILE = ['./', 'index.html', 'style.css', 'icone.js', 'app.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

const BASE = new URL('./', self.location).href;
const NOTI = new Set(FILE.map((f) => new URL(f, BASE).href));

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(VERSIONE)
      .then((c) => c.addAll(FILE.map((f) => new Request(new URL(f, BASE).href, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

/* Si eliminano solo le copie vecchie di questa app, non quelle di altri siti sullo stesso indirizzo. */
self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nomi) => Promise.all(nomi.filter((n) => n.startsWith(PREFISSO) && n !== VERSIONE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

/* Solo i file dell'app: prima la copia locale (apertura immediata, anche offline), poi aggiornamento in sottofondo. */
self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  url.search = '';
  url.hash = '';
  const chiave = url.href;
  if (!NOTI.has(chiave)) return;
  ev.respondWith((async () => {
    const cache = await caches.open(VERSIONE);
    const inCopia = await cache.match(chiave);
    const aggiorna = fetch(chiave, { cache: 'no-cache' })
      .then(async (risposta) => {
        if (risposta && risposta.ok && risposta.type === 'basic') await cache.put(chiave, risposta.clone());
        return risposta;
      })
      .catch(() => null);
    if (inCopia) { ev.waitUntil(aggiorna); return inCopia; }
    return (await aggiorna) || Response.error();
  })());
});
