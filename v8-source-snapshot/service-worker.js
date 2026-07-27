"use strict";

const CACHE_NAME = "cma-simulator-v6-20260724";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260724.2",
  "./cma-2025-reference.js?v=20260722.4",
  "./cma-advanced.js?v=20260722.4",
  "./cma-storage.js?v=20260722.5",
  "./cma-progress.js?v=20260722.1",
  "./cma-v2.js?v=20260724.1",
  "./app.js?v=20260724.1",
  "./cma-case.js?v=20260722.5",
  "./pwa.js?v=20260724.2",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./question-bank-template.json",
  "./large-question-bank-template.json",
  "./case-bank-template.json",
  "./bulk-question-paste-template.txt",
  "./hock-2024-2025-catalog.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("cma-simulator-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then((cached) => cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
        return response;
      }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
