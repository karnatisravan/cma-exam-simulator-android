(() => {
  "use strict";

  const CORE = globalThis.CMAV8Core;
  if (!CORE) return;

  const DB_NAME = "cma-v8-learning";
  const DB_VERSION = 1;
  const STORES = Object.freeze({ cards: "flashcards", progress: "flashcardProgress", docs: "revisionDocuments", revision: "revisionProgress" });
  const SECTION_B_MANIFEST = CORE.normalizeRevisionManifest({
    id: "revision-section-b-slides",
    title: "CMA Part 2 — Section B Revision Slides",
    sectionId: "B",
    pageCount: 527,
    expectedFileName: "CMA Part 2 Section B Slides.PDF",
    version: "2026-07",
    outline: [
      { id: "risk-return", title: "Risk and Return", startPage: 4, endPage: 68 },
      { id: "long-term", title: "Long-Term Financial Management", startPage: 69, endPage: 283 },
      { id: "raising-capital", title: "Raising Capital", startPage: 284, endPage: 313 },
      { id: "working-capital", title: "Working Capital Management", startPage: 314, endPage: 394 },
      { id: "restructuring", title: "Corporate Restructuring", startPage: 395, endPage: 455 },
      { id: "international", title: "International Finance", startPage: 456, endPage: 527 }
    ]
  });

  const state = {
    db: null,
    flashPreview: null,
    cards: [],
    cardProgress: new Map(),
    studyQueue: [],
    studyIndex: 0,
    revealed: false,
    revisionDocs: [],
    revisionProgress: new Map(),
    activeDoc: null,
    activePage: 1,
    activePdfUrl: null,
    pendingManifest: null
  };

  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value == null ? "" : value).trim();
  const escapeHtml = (value) => clean(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  const nowIso = () => new Date().toISOString();

  function openDb() {
    if (state.db) return Promise.resolve(state.db);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.cards)) {
          const store = db.createObjectStore(STORES.cards, { keyPath: "id" });
          store.createIndex("deckId", "deckId", { unique: false });
          store.createIndex("sectionId", "sectionId", { unique: false });
          store.createIndex("unitId", "unitId", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.progress)) db.createObjectStore(STORES.progress, { keyPath: "cardId" });
        if (!db.objectStoreNames.contains(STORES.docs)) db.createObjectStore(STORES.docs, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORES.revision)) db.createObjectStore(STORES.revision, { keyPath: "docId" });
      };
      request.onsuccess = () => { state.db = request.result; resolve(state.db); };
      request.onerror = () => reject(request.error || new Error("Learning database could not be opened."));
    });
  }

  async function storeGetAll(name) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(name, "readonly").objectStore(name).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function storePut(name, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(name, "readwrite");
      tx.objectStore(name).put(value);
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function storeDelete(name, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(name, "readwrite");
      tx.objectStore(name).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  function setMessage(id, text, type = "info") {
    const node = $(id);
    if (!node) return;
    node.hidden = false;
    node.className = `message message-${type}`;
    node.textContent = text;
  }

  function showAppScreen(screenId) {
    document.querySelectorAll(".screen").forEach((screen) => { screen.hidden = screen.id !== screenId; });
    document.querySelectorAll(".app-nav button").forEach((button) => button.removeAttribute("aria-current"));
    const navId = screenId === "v8-flashcards-screen" ? "nav-v8-flashcards" : screenId === "v8-revision-screen" ? "nav-v8-revision" : "";
    if (navId) $(navId)?.setAttribute("aria-current", "page");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function goHome() {
    const home = $("nav-home") || $("brand-home");
    if (home) home.click(); else showAppScreen("home-screen");
  }

  function injectNavigation() {
    const nav = document.querySelector(".app-nav");
    if (!nav || $("nav-v8-flashcards")) return;
    const flash = document.createElement("button");
    flash.id = "nav-v8-flashcards";
    flash.type = "button";
    flash.innerHTML = '<span class="nav-glyph">▣</span><span>Flashcards</span>';
    const revision = document.createElement("button");
    revision.id = "nav-v8-revision";
    revision.type = "button";
    revision.innerHTML = '<span class="nav-glyph">▤</span><span>Revision</span>';
    const settings = $("nav-settings");
    if (settings) settings.before(flash, revision); else nav.append(flash, revision);
    flash.addEventListener("click", () => { showAppScreen("v8-flashcards-screen"); refreshFlashcards(); });
    revision.addEventListener("click", () => { showAppScreen("v8-revision-screen"); refreshRevision(); });
  }

  function injectDashboardPanel() {
    if ($("v8-home-panel")) return;
    const home = $("home-screen");
    if (!home) return;
    const panel = document.createElement("section");
    panel.id = "v8-home-panel";
    panel.className = "panel compact-panel v8-home-panel";
    panel.innerHTML = '<div class="compact-section-heading"><div><span class="eyebrow">V8 learning tools</span><h2>Recall and Revision</h2></div></div><div class="button-row"><button class="button button-primary" id="v8-home-flashcards" type="button">Study flashcards</button><button class="button button-secondary" id="v8-home-revision" type="button">Open revision slides</button></div><div id="v8-home-stats" class="mini-stat-grid"></div>';
    const anchor = $("v2-home-panel") || $("resume-banner");
    if (anchor) anchor.after(panel); else home.append(panel);
    $("v8-home-flashcards").addEventListener("click", () => $("nav-v8-flashcards").click());
    $("v8-home-revision").addEventListener("click", () => $("nav-v8-revision").click());
  }

  function injectScreens() {
    const main = $("main-content");
    if (!main || $("v8-flashcards-screen")) return;

    const flash = document.createElement("section");
    flash.id = "v8-flashcards-screen";
    flash.className = "screen v8-screen";
    flash.hidden = true;
    flash.innerHTML = `
      <div class="page-heading"><div><button class="back-button" data-v8-home type="button">← Dashboard</button><span class="eyebrow">Active recall</span><h1>Flashcards</h1><p>Import decks like question banks, study due cards, and track recall strength locally.</p></div><div class="availability-chip"><strong id="v8-flash-due-count">0</strong> due</div></div>
      <div class="v8-learning-layout"><div>
        <section class="panel"><div class="section-heading"><div><span class="eyebrow">Deck library</span><h2>Choose cards</h2></div><button class="button button-secondary" id="v8-toggle-flash-import" type="button">Import flashcards</button></div>
          <div class="filter-controls"><label>Deck<select id="v8-flash-deck"><option value="all">All decks</option></select></label><label>Section<select id="v8-flash-section"><option value="all">All sections</option></select></label><label>Study pool<select id="v8-flash-pool"><option value="due">Due now</option><option value="unseen">Unseen</option><option value="all">All cards</option><option value="mastered">Mastered</option></select></label></div>
          <div id="v8-flash-stats" class="mini-stat-grid"></div><div class="button-row"><button class="button button-primary" id="v8-start-flash-study" type="button">Start study</button><button class="button button-quiet" id="v8-export-flashcards" type="button">Export cards</button></div>
        </section>
        <section class="panel" id="v8-flash-import-panel" hidden><div class="section-heading"><div><span class="eyebrow">Validated import</span><h2>Import JSON flashcards</h2></div><button class="button button-quiet" id="v8-close-flash-import" type="button">Close</button></div>
          <div class="settings-grid"><label>JSON file<input id="v8-flash-file" type="file" accept=".json,application/json"></label><label>ID conflicts<select id="v8-flash-conflict"><option value="skip">Skip incoming</option><option value="replace">Replace existing card</option><option value="new">Import with a new ID</option></select></label></div>
          <div id="v8-flash-import-summary" class="message" hidden></div><div class="button-row"><button class="button button-primary" id="v8-commit-flash-import" type="button" disabled>Confirm import</button><button class="button button-secondary" id="v8-download-flash-template" type="button">Download template</button></div>
        </section>
      </div><aside><section class="panel sticky-summary v8-flash-study-panel"><span class="eyebrow">Study session</span><div id="v8-flash-empty"><h2>Ready for active recall</h2><p>Select a pool and start studying.</p></div><div id="v8-flash-card" hidden><div class="v8-card-meta" id="v8-card-meta"></div><button class="v8-flash-card-face" id="v8-flash-face" type="button"><span id="v8-flash-side-label">Front</span><strong id="v8-flash-front"></strong><span id="v8-flash-hint"></span><div id="v8-flash-back" hidden></div></button><p id="v8-flash-progress-label"></p><div class="button-row" id="v8-flash-rating" hidden><button class="button button-danger-quiet" data-v8-rating="again" type="button">Again</button><button class="button button-secondary" data-v8-rating="hard" type="button">Hard</button><button class="button button-primary" data-v8-rating="good" type="button">Good</button><button class="button button-quiet" data-v8-rating="easy" type="button">Easy</button></div></div></section></aside></div>`;

    const revision = document.createElement("section");
    revision.id = "v8-revision-screen";
    revision.className = "screen v8-screen";
    revision.hidden = true;
    revision.innerHTML = `
      <div class="page-heading"><div><button class="back-button" data-v8-home type="button">← Dashboard</button><span class="eyebrow">Slide-style revision</span><h1>Revision</h1><p>Attach a permitted PDF locally, resume by page, follow topic ranges, bookmark slides, and mark pages revised.</p></div><div class="availability-chip"><strong id="v8-revision-percent">0%</strong> revised</div></div>
      <section class="panel" id="v8-revision-import-panel"><div class="section-heading"><div><span class="eyebrow">Private local import</span><h2>Attach revision slides</h2></div></div><p class="demo-note">The original PDF is never uploaded by the app. It is stored only in this browser profile on this device.</p>
        <div class="settings-grid"><label>PDF slide deck<input id="v8-revision-file" type="file" accept=".pdf,application/pdf"></label><label>Optional companion manifest<input id="v8-revision-manifest-file" type="file" accept=".json,application/json"></label><label>Title<input id="v8-revision-title" type="text" value="CMA Part 2 — Section B Revision Slides"></label><label>Page count<input id="v8-revision-page-count" type="number" min="1" value="527"></label></div>
        <div id="v8-revision-import-message" class="message" hidden></div><button class="button button-primary" id="v8-import-revision" type="button">Import revision deck</button>
      </section>
      <div id="v8-revision-workspace" class="v8-revision-layout" hidden><aside><section class="panel v8-revision-sidebar"><label>Revision deck<select id="v8-revision-doc"></select></label><label>Find topic<input id="v8-revision-search" type="search" placeholder="Search topic titles"></label><div id="v8-revision-outline" class="v8-outline"></div><div class="button-row"><button class="button button-quiet" id="v8-remove-revision" type="button">Remove deck</button></div></section></aside><div><section class="panel v8-slide-panel" id="v8-slide-panel"><div class="v8-slide-toolbar"><button class="button button-secondary" id="v8-revision-prev" type="button">← Previous</button><label>Page <input id="v8-revision-page" type="number" min="1" value="1"> <span id="v8-revision-page-total">/ 1</span></label><button class="button button-secondary" id="v8-revision-next" type="button">Next →</button><button class="button button-quiet" id="v8-revision-bookmark" type="button">☆ Bookmark</button><button class="button button-primary" id="v8-revision-complete" type="button">Mark revised</button><button class="button button-quiet" id="v8-revision-fullscreen" type="button">Full screen</button></div><div class="v8-pdf-frame"><embed id="v8-revision-embed" type="application/pdf"></div><div class="v8-slide-footer"><span id="v8-revision-topic"></span><span id="v8-revision-progress-text"></span></div></section></div></div>`;

    const settings = $("settings-screen");
    main.insertBefore(flash, settings || null);
    main.insertBefore(revision, settings || null);
    document.querySelectorAll("[data-v8-home]").forEach((button) => button.addEventListener("click", goHome));
  }

  async function loadLearningData() {
    state.cards = await storeGetAll(STORES.cards);
    state.cardProgress = new Map((await storeGetAll(STORES.progress)).map((item) => [item.cardId, item]));
    state.revisionDocs = await storeGetAll(STORES.docs);
    state.revisionProgress = new Map((await storeGetAll(STORES.revision)).map((item) => [item.docId, item]));
  }

  function progressFor(cardId) {
    return state.cardProgress.get(cardId) || { cardId, reviews: 0, intervalDays: 0, dueAt: null, mastered: false };
  }

  function cardDue(progress) {
    return !progress.dueAt || new Date(progress.dueAt).getTime() <= Date.now();
  }

  function flashFilteredCards() {
    const deck = $("v8-flash-deck")?.value || "all";
    const section = $("v8-flash-section")?.value || "all";
    const pool = $("v8-flash-pool")?.value || "due";
    return state.cards.filter((card) => {
      const progress = progressFor(card.id);
      if (deck !== "all" && card.deckId !== deck) return false;
      if (section !== "all" && card.sectionId !== section) return false;
      if (pool === "due" && !cardDue(progress)) return false;
      if (pool === "unseen" && progress.reviews > 0) return false;
      if (pool === "mastered" && !progress.mastered) return false;
      return true;
    });
  }

  async function refreshFlashcards() {
    await loadLearningData();
    const deckSelect = $("v8-flash-deck");
    const currentDeck = deckSelect?.value || "all";
    if (deckSelect) {
      const decks = Array.from(new Map(state.cards.map((card) => [card.deckId, card.deckName])).entries()).sort((a, b) => a[1].localeCompare(b[1]));
      deckSelect.innerHTML = '<option value="all">All decks</option>' + decks.map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join("");
      if ([...deckSelect.options].some((option) => option.value === currentDeck)) deckSelect.value = currentDeck;
    }
    const sectionSelect = $("v8-flash-section");
    const currentSection = sectionSelect?.value || "all";
    if (sectionSelect) {
      const sections = Array.from(new Set(state.cards.map((card) => card.sectionId).filter(Boolean))).sort();
      sectionSelect.innerHTML = '<option value="all">All sections</option>' + sections.map((id) => `<option value="${id}">Section ${id}</option>`).join("");
      if ([...sectionSelect.options].some((option) => option.value === currentSection)) sectionSelect.value = currentSection;
    }
    renderFlashStats();
    renderHomeStats();
  }

  function renderFlashStats() {
    const cards = state.cards;
    const due = cards.filter((card) => cardDue(progressFor(card.id))).length;
    const unseen = cards.filter((card) => !progressFor(card.id).reviews).length;
    const mastered = cards.filter((card) => progressFor(card.id).mastered).length;
    $("v8-flash-due-count").textContent = due;
    const grid = $("v8-flash-stats");
    if (grid) grid.innerHTML = [["Cards", cards.length], ["Due", due], ["Unseen", unseen], ["Mastered", mastered]].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  }

  function renderHomeStats() {
    const grid = $("v8-home-stats");
    if (!grid) return;
    const due = state.cards.filter((card) => cardDue(progressFor(card.id))).length;
    const revised = Array.from(state.revisionProgress.values()).reduce((sum, item) => sum + (item.completedPages || []).length, 0);
    grid.innerHTML = `<div><span>Flashcards</span><strong>${state.cards.length}</strong></div><div><span>Due now</span><strong>${due}</strong></div><div><span>Revision decks</span><strong>${state.revisionDocs.length}</strong></div><div><span>Pages revised</span><strong>${revised}</strong></div>`;
  }

  async function previewFlashFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      state.flashPreview = CORE.parseFlashcardImport(parsed);
      const existingIds = new Set(state.cards.map((card) => card.id));
      state.flashPreview.conflicts = state.flashPreview.cards.filter((card) => existingIds.has(card.id)).map((card) => card.id);
      setMessage("v8-flash-import-summary", `${file.name}: ${state.flashPreview.validCount}/${state.flashPreview.total} valid. Invalid: ${state.flashPreview.invalidCount}. Existing IDs: ${state.flashPreview.conflicts.length}.`, state.flashPreview.invalidCount ? "warning" : "success");
      $("v8-commit-flash-import").disabled = !state.flashPreview.validCount;
    } catch (error) {
      state.flashPreview = null;
      $("v8-commit-flash-import").disabled = true;
      setMessage("v8-flash-import-summary", `Import preview failed: ${error.message}`, "error");
    }
  }

  async function commitFlashImport() {
    if (!state.flashPreview) return;
    const mode = $("v8-flash-conflict").value;
    const existingIds = new Set(state.cards.map((card) => card.id));
    let added = 0; let replaced = 0; let skipped = 0;
    for (const original of state.flashPreview.cards) {
      let card = { ...original };
      if (existingIds.has(card.id)) {
        if (mode === "skip") { skipped += 1; continue; }
        if (mode === "new") card.id = `${card.id}-${CORE.hash(`${Date.now()}|${Math.random()}`).slice(0, 6)}`;
        else replaced += 1;
      } else added += 1;
      existingIds.add(card.id);
      await storePut(STORES.cards, card);
    }
    state.flashPreview = null;
    $("v8-commit-flash-import").disabled = true;
    $("v8-flash-file").value = "";
    setMessage("v8-flash-import-summary", `Import complete: ${added} added, ${replaced} replaced, ${skipped} skipped.`, "success");
    await refreshFlashcards();
  }

  function startFlashStudy() {
    state.studyQueue = flashFilteredCards().slice().sort((a, b) => {
      const ad = progressFor(a.id).dueAt || "";
      const bd = progressFor(b.id).dueAt || "";
      return ad.localeCompare(bd) || a.front.localeCompare(b.front);
    });
    state.studyIndex = 0;
    state.revealed = false;
    if (!state.studyQueue.length) { setMessage("v8-flash-import-summary", "No cards match the selected study pool.", "warning"); return; }
    $("v8-flash-empty").hidden = true;
    $("v8-flash-card").hidden = false;
    renderStudyCard();
  }

  function renderStudyCard() {
    const card = state.studyQueue[state.studyIndex];
    if (!card) {
      $("v8-flash-card").hidden = true;
      $("v8-flash-empty").hidden = false;
      $("v8-flash-empty").innerHTML = "<h2>Session complete</h2><p>Your recall ratings were saved locally.</p>";
      refreshFlashcards();
      return;
    }
    state.revealed = false;
    $("v8-card-meta").textContent = [card.deckName, card.sectionId && `Section ${card.sectionId}`, card.unitId].filter(Boolean).join(" · ");
    $("v8-flash-side-label").textContent = "Front — tap to reveal";
    $("v8-flash-front").textContent = card.front;
    $("v8-flash-hint").textContent = card.hint ? `Hint: ${card.hint}` : "";
    $("v8-flash-back").hidden = true;
    $("v8-flash-back").textContent = card.back;
    $("v8-flash-rating").hidden = true;
    $("v8-flash-progress-label").textContent = `Card ${state.studyIndex + 1} of ${state.studyQueue.length}`;
    $("v8-flash-face").classList.remove("is-revealed");
  }

  function revealFlashCard() {
    if (state.revealed) return;
    state.revealed = true;
    $("v8-flash-side-label").textContent = "Answer";
    $("v8-flash-back").hidden = false;
    $("v8-flash-rating").hidden = false;
    $("v8-flash-face").classList.add("is-revealed");
  }

  async function rateFlashCard(rating) {
    const card = state.studyQueue[state.studyIndex];
    if (!card || !state.revealed) return;
    const scheduled = CORE.scheduleReview(progressFor(card.id), rating);
    const record = { ...scheduled, cardId: card.id, deckId: card.deckId, updatedAt: nowIso() };
    await storePut(STORES.progress, record);
    state.cardProgress.set(card.id, record);
    state.studyIndex += 1;
    renderStudyCard();
  }

  function downloadJson(filename, data) {
    const text = JSON.stringify(data, null, 2);
    if (globalThis.AndroidFileBridge?.saveTextFile) { globalThis.AndroidFileBridge.saveTextFile(filename, "application/json", text); return; }
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function refreshRevision() {
    await loadLearningData();
    const select = $("v8-revision-doc");
    if (select) {
      const current = state.activeDoc?.id || select.value;
      select.innerHTML = state.revisionDocs.map((doc) => `<option value="${escapeHtml(doc.id)}">${escapeHtml(doc.manifest.title)}</option>`).join("");
      if (state.revisionDocs.some((doc) => doc.id === current)) select.value = current;
    }
    $("v8-revision-workspace").hidden = !state.revisionDocs.length;
    $("v8-revision-import-panel").hidden = false;
    if (state.revisionDocs.length) await openRevisionDoc(select.value || state.revisionDocs[0].id);
    renderHomeStats();
  }

  async function readManifestFile(event) {
    const file = event.target.files?.[0];
    if (!file) { state.pendingManifest = null; return; }
    try {
      state.pendingManifest = CORE.normalizeRevisionManifest(JSON.parse(await file.text()));
      $("v8-revision-title").value = state.pendingManifest.title;
      $("v8-revision-page-count").value = state.pendingManifest.pageCount;
      setMessage("v8-revision-import-message", `Manifest loaded: ${state.pendingManifest.outline.length} topic ranges.`, "success");
    } catch (error) {
      state.pendingManifest = null;
      setMessage("v8-revision-import-message", `Manifest could not be read: ${error.message}`, "error");
    }
  }

  async function importRevisionDeck() {
    const file = $("v8-revision-file").files?.[0];
    if (!file) { setMessage("v8-revision-import-message", "Choose a PDF slide deck first.", "warning"); return; }
    if (file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) { setMessage("v8-revision-import-message", "The selected file is not a PDF.", "error"); return; }
    let manifest = state.pendingManifest;
    const sectionBMatch = normaliseFileName(file.name).includes("cma part 2 section b slides");
    if (!manifest && sectionBMatch) manifest = SECTION_B_MANIFEST;
    if (!manifest) manifest = CORE.normalizeRevisionManifest({ title: $("v8-revision-title").value, pageCount: $("v8-revision-page-count").value, expectedFileName: file.name });
    const id = manifest.id || `revision-${CORE.hash(`${file.name}|${file.size}`)}`;
    const record = { id, manifest: { ...manifest, id }, file, fileName: file.name, fileSize: file.size, importedAt: nowIso() };
    await storePut(STORES.docs, record);
    if (!state.revisionProgress.has(id)) await storePut(STORES.revision, { docId: id, currentPage: 1, bookmarks: [], completedPages: [], updatedAt: nowIso() });
    state.pendingManifest = null;
    $("v8-revision-file").value = "";
    $("v8-revision-manifest-file").value = "";
    setMessage("v8-revision-import-message", `Imported ${manifest.title}. The PDF remains local to this device.`, "success");
    await refreshRevision();
  }

  function normaliseFileName(value) { return clean(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " "); }

  function revisionProgressFor(docId) {
    return state.revisionProgress.get(docId) || { docId, currentPage: 1, bookmarks: [], completedPages: [], updatedAt: nowIso() };
  }

  async function openRevisionDoc(docId) {
    const doc = state.revisionDocs.find((item) => item.id === docId);
    if (!doc) return;
    state.activeDoc = doc;
    const progress = revisionProgressFor(doc.id);
    state.activePage = Math.min(doc.manifest.pageCount, Math.max(1, Number(progress.currentPage) || 1));
    if (state.activePdfUrl) URL.revokeObjectURL(state.activePdfUrl);
    state.activePdfUrl = URL.createObjectURL(doc.file);
    renderRevisionOutline();
    renderRevisionPage();
  }

  function activeTopic() {
    if (!state.activeDoc) return null;
    return state.activeDoc.manifest.outline.find((topic) => state.activePage >= topic.startPage && state.activePage <= topic.endPage) || null;
  }

  function renderRevisionOutline() {
    const container = $("v8-revision-outline");
    if (!container || !state.activeDoc) return;
    const query = clean($("v8-revision-search")?.value).toLowerCase();
    const progress = revisionProgressFor(state.activeDoc.id);
    const topics = state.activeDoc.manifest.outline.filter((topic) => !query || topic.title.toLowerCase().includes(query));
    container.innerHTML = topics.length ? topics.map((topic) => {
      const completed = progress.completedPages.filter((page) => page >= topic.startPage && page <= topic.endPage).length;
      const total = topic.endPage - topic.startPage + 1;
      return `<button type="button" data-v8-topic-page="${topic.startPage}" class="v8-outline-item"><strong>${escapeHtml(topic.title)}</strong><span>Pages ${topic.startPage}–${topic.endPage} · ${Math.round(completed / total * 100)}%</span></button>`;
    }).join("") : '<p class="muted-empty">No topic titles match.</p>';
  }

  async function saveRevisionProgress(progress) {
    progress.updatedAt = nowIso();
    await storePut(STORES.revision, progress);
    state.revisionProgress.set(progress.docId, progress);
  }

  function renderRevisionPage() {
    if (!state.activeDoc || !state.activePdfUrl) return;
    const total = state.activeDoc.manifest.pageCount;
    state.activePage = Math.min(total, Math.max(1, Number(state.activePage) || 1));
    const progress = revisionProgressFor(state.activeDoc.id);
    progress.currentPage = state.activePage;
    saveRevisionProgress(progress);
    $("v8-revision-page").value = state.activePage;
    $("v8-revision-page").max = total;
    $("v8-revision-page-total").textContent = `/ ${total}`;
    $("v8-revision-prev").disabled = state.activePage <= 1;
    $("v8-revision-next").disabled = state.activePage >= total;
    $("v8-revision-embed").src = `${state.activePdfUrl}#page=${state.activePage}&toolbar=0&navpanes=0&view=FitH`;
    const bookmarked = progress.bookmarks.includes(state.activePage);
    const completed = progress.completedPages.includes(state.activePage);
    $("v8-revision-bookmark").textContent = bookmarked ? "★ Bookmarked" : "☆ Bookmark";
    $("v8-revision-complete").textContent = completed ? "✓ Revised" : "Mark revised";
    const topic = activeTopic();
    $("v8-revision-topic").textContent = topic ? topic.title : `Page ${state.activePage}`;
    const percent = Math.round(progress.completedPages.length / total * 100);
    $("v8-revision-percent").textContent = `${percent}%`;
    $("v8-revision-progress-text").textContent = `${progress.completedPages.length} of ${total} pages revised · ${progress.bookmarks.length} bookmarks`;
    renderRevisionOutline();
  }

  async function toggleRevisionBookmark() {
    if (!state.activeDoc) return;
    const progress = revisionProgressFor(state.activeDoc.id);
    const set = new Set(progress.bookmarks || []);
    if (set.has(state.activePage)) set.delete(state.activePage); else set.add(state.activePage);
    progress.bookmarks = Array.from(set).sort((a, b) => a - b);
    await saveRevisionProgress(progress);
    renderRevisionPage();
  }

  async function toggleRevisionComplete() {
    if (!state.activeDoc) return;
    const progress = revisionProgressFor(state.activeDoc.id);
    const set = new Set(progress.completedPages || []);
    if (set.has(state.activePage)) set.delete(state.activePage); else set.add(state.activePage);
    progress.completedPages = Array.from(set).sort((a, b) => a - b);
    await saveRevisionProgress(progress);
    renderRevisionPage();
    renderHomeStats();
  }

  async function removeRevisionDoc() {
    if (!state.activeDoc || !confirm(`Remove ${state.activeDoc.manifest.title} from this device? Revision progress for this deck will also be removed.`)) return;
    const id = state.activeDoc.id;
    await storeDelete(STORES.docs, id);
    await storeDelete(STORES.revision, id);
    if (state.activePdfUrl) URL.revokeObjectURL(state.activePdfUrl);
    state.activePdfUrl = null; state.activeDoc = null;
    await refreshRevision();
  }

  function bindUi() {
    $("v8-toggle-flash-import")?.addEventListener("click", () => { $("v8-flash-import-panel").hidden = false; });
    $("v8-close-flash-import")?.addEventListener("click", () => { $("v8-flash-import-panel").hidden = true; });
    $("v8-flash-file")?.addEventListener("change", previewFlashFile);
    $("v8-commit-flash-import")?.addEventListener("click", commitFlashImport);
    $("v8-start-flash-study")?.addEventListener("click", startFlashStudy);
    ["v8-flash-deck", "v8-flash-section", "v8-flash-pool"].forEach((id) => $(id)?.addEventListener("change", renderFlashStats));
    $("v8-flash-face")?.addEventListener("click", revealFlashCard);
    $("v8-flash-rating")?.addEventListener("click", (event) => { const button = event.target.closest("[data-v8-rating]"); if (button) rateFlashCard(button.dataset.v8Rating); });
    $("v8-download-flash-template")?.addEventListener("click", () => downloadJson("cma-flashcard-template.json", { title: "My CMA Flashcards", flashcards: [{ id: "B-U02-FC-001", section: "B", unitId: "B-U02", front: "What does beta measure?", back: "A security's systematic risk relative to the market.", hint: "Think CAPM", tags: ["CAPM", "risk"] }] }));
    $("v8-export-flashcards")?.addEventListener("click", () => downloadJson("cma-flashcards-export.json", { title: "CMA Flashcards Export", exportedAt: nowIso(), flashcards: state.cards, progress: Array.from(state.cardProgress.values()) }));

    $("v8-revision-manifest-file")?.addEventListener("change", readManifestFile);
    $("v8-import-revision")?.addEventListener("click", importRevisionDeck);
    $("v8-revision-doc")?.addEventListener("change", (event) => openRevisionDoc(event.target.value));
    $("v8-revision-search")?.addEventListener("input", renderRevisionOutline);
    $("v8-revision-outline")?.addEventListener("click", (event) => { const button = event.target.closest("[data-v8-topic-page]"); if (button) { state.activePage = Number(button.dataset.v8TopicPage); renderRevisionPage(); } });
    $("v8-revision-prev")?.addEventListener("click", () => { state.activePage -= 1; renderRevisionPage(); });
    $("v8-revision-next")?.addEventListener("click", () => { state.activePage += 1; renderRevisionPage(); });
    $("v8-revision-page")?.addEventListener("change", (event) => { state.activePage = Number(event.target.value); renderRevisionPage(); });
    $("v8-revision-bookmark")?.addEventListener("click", toggleRevisionBookmark);
    $("v8-revision-complete")?.addEventListener("click", toggleRevisionComplete);
    $("v8-revision-fullscreen")?.addEventListener("click", () => $("v8-slide-panel")?.requestFullscreen?.());
    $("v8-remove-revision")?.addEventListener("click", removeRevisionDoc);
  }

  async function init() {
    if ($("v8-flashcards-screen") || !$("main-content") || !document.querySelector(".app-nav")) return;
    injectNavigation();
    injectScreens();
    injectDashboardPanel();
    bindUi();
    await loadLearningData();
    await refreshFlashcards();
    await refreshRevision();
    if (!state.revisionDocs.length) $("v8-revision-workspace").hidden = true;
    globalThis.CMAV8 = Object.freeze({ refreshFlashcards, refreshRevision, sectionBManifest: SECTION_B_MANIFEST, databaseName: DB_NAME });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0), { once: true });
  else setTimeout(init, 0);
})();
