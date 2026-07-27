(() => {
  "use strict";

  const state = {
    installPrompt: null,
    activeTab: "manual",
    filePreview: null,
    pastedPreview: null,
    textPreview: null,
    initialized: false
  };

  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value ?? "").trim();

  function v2State() {
    return globalThis.CMAV2?.getState?.() || { banks: [], questions: [], catalog: { sections: [], units: [] } };
  }

  function exactReferenceSections() {
    return Object.entries(globalThis.CMA2025Reference || {}).map(([id, data]) => ({
      id,
      name: data.sectionName,
      units: (data.units || []).map((unit, index) => ({
        id: `${id}-U${String(index + 1).padStart(2, "0")}`,
        code: unit.unit,
        outline: unit.outline,
        name: unit.unitName
      }))
    }));
  }

  function showMessage(text, type = "success") {
    const box = $("easy-add-message");
    if (!box) return;
    box.className = `message message-${type}`;
    box.textContent = text;
    box.hidden = !text;
  }

  function clearMessage() { showMessage(""); }

  function setTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll("[data-easy-tab]").forEach((button) => {
      const active = button.dataset.easyTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-easy-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.easyPane !== tab;
    });
    clearMessage();
  }

  function activeBanks() {
    return (v2State().banks || []).filter((bank) => bank.status === "active");
  }

  function fillBanks(preferred = "") {
    const select = $("easy-add-bank");
    if (!select) return;
    const current = preferred || select.value;
    select.replaceChildren();
    activeBanks().forEach((bank) => {
      const option = new Option(bank.bankName, bank.bankId);
      select.append(option);
    });
    if ([...select.options].some((option) => option.value === current)) select.value = current;
    if (!select.value && select.options.length) select.selectedIndex = 0;
  }

  function fillSections(selectId, preferred = "") {
    const select = $(selectId);
    if (!select) return;
    const current = preferred || select.value;
    select.replaceChildren();
    exactReferenceSections().forEach((section) => select.append(new Option(`${section.id} — ${section.name}`, section.id)));
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }

  function fillUnits(sectionSelectId, unitSelectId, preferred = "") {
    const sectionId = $(sectionSelectId)?.value || "A";
    const select = $(unitSelectId);
    if (!select) return;
    const current = preferred || select.value;
    select.replaceChildren();
    const section = exactReferenceSections().find((item) => item.id === sectionId);
    (section?.units || []).forEach((unit) => select.append(new Option(`${unit.code} — ${unit.name}`, unit.id)));
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }

  function refreshSelectors() {
    fillBanks();
    ["easy-manual-section", "easy-text-section"].forEach((id) => fillSections(id));
    fillUnits("easy-manual-section", "easy-manual-unit");
    fillUnits("easy-text-section", "easy-text-unit");
  }

  function renderCatalog() {
    const container = $("easy-catalog-list");
    if (!container) return;
    container.replaceChildren();
    exactReferenceSections().forEach((section) => {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `${section.id} — ${section.name} (${section.units.length} units)`;
      details.append(summary);
      const list = document.createElement("ol");
      section.units.forEach((unit) => {
        const item = document.createElement("li");
        const strong = document.createElement("strong");
        strong.textContent = `${unit.code}. ${unit.name}`;
        const small = document.createElement("small");
        small.textContent = unit.outline ? ` ${unit.outline}` : "";
        item.append(strong, small);
        list.append(item);
      });
      details.append(list);
      container.append(details);
    });
  }

  function openAddDialog(tab = "manual") {
    const dialog = $("easy-add-dialog");
    if (!dialog) return;
    refreshSelectors();
    renderCatalog();
    setTab(tab);
    if (dialog.showModal && !dialog.open) dialog.showModal();
  }

  function closeAddDialog() {
    const dialog = $("easy-add-dialog");
    if (dialog?.open) dialog.close();
  }

  function selectedBankId() {
    const bankId = $("easy-add-bank")?.value;
    if (!bankId) throw new Error("Create or select a destination question bank first.");
    return bankId;
  }

  function selectedConflictMode() {
    return $("easy-add-conflict")?.value || "skip";
  }

  function previewSummary(preview) {
    if (!preview) return "No preview is available.";
    const parts = [
      `${preview.validCount}/${preview.total} valid`,
      `${preview.invalidCount} invalid`,
      `${preview.duplicateIds.length} duplicate IDs in this bank`,
      `${preview.duplicateText.length} exact text duplicates`,
      `${preview.crossBankDuplicates.length} matching questions in other banks`,
      `${preview.missingExplanation} without explanations`
    ];
    if (preview.errors?.length) parts.push(`First error: ${preview.errors[0]}`);
    return parts.join(" · ");
  }

  async function commitPreview(preview, label = "questions") {
    if (!preview?.validCount) throw new Error("No valid questions are ready to import.");
    const result = await globalThis.CMAV2.commitImport(preview, selectedConflictMode());
    fillBanks(preview.bankId);
    showMessage(`Imported ${label}: ${result.added} added, ${result.replaced} replaced, ${result.skipped} skipped, ${result.invalid} invalid.`, result.invalid ? "warning" : "success");
    return result;
  }

  function unitInfo(unitId) {
    for (const section of exactReferenceSections()) {
      const unit = section.units.find((item) => item.id === unitId);
      if (unit) return { section, unit };
    }
    return null;
  }

  function manualQuestion() {
    const sectionId = $("easy-manual-section").value;
    const unitId = $("easy-manual-unit").value;
    const info = unitInfo(unitId);
    const id = clean($("easy-manual-id").value) || `${unitId}-${String(Date.now()).slice(-6)}`;
    return {
      id,
      section: sectionId,
      sectionId,
      sectionName: info?.section.name || "",
      unit: info?.unit.code || "",
      unitId,
      unitName: info?.unit.name || "",
      question: clean($("easy-manual-question").value),
      options: {
        A: clean($("easy-manual-a").value),
        B: clean($("easy-manual-b").value),
        C: clean($("easy-manual-c").value),
        D: clean($("easy-manual-d").value)
      },
      correctAnswer: $("easy-manual-answer").value,
      explanation: clean($("easy-manual-explanation").value)
    };
  }

  function clearManualForm() {
    ["easy-manual-id", "easy-manual-question", "easy-manual-a", "easy-manual-b", "easy-manual-c", "easy-manual-d", "easy-manual-explanation"].forEach((id) => { if ($(id)) $(id).value = ""; });
    $("easy-manual-answer").value = "A";
  }

  async function saveManual() {
    try {
      const bankId = selectedBankId();
      const raw = manualQuestion();
      const preview = globalThis.CMAV2.prepareImport({ title: "Manual Question", questions: [raw] }, bankId, "manual-question.json");
      if (!preview.validCount) throw new Error(preview.errors.join(" "));
      await commitPreview(preview, "question");
      clearManualForm();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function previewFile(file) {
    try {
      if (!file) throw new Error("Choose a JSON file first.");
      const parsed = JSON.parse(await file.text());
      state.filePreview = globalThis.CMAV2.prepareImport(parsed, selectedBankId(), file.name);
      $("easy-import-file").disabled = !state.filePreview.validCount;
      $("easy-json-file-name").textContent = file.name;
      showMessage(previewSummary(state.filePreview), state.filePreview.invalidCount ? "warning" : "success");
    } catch (error) {
      state.filePreview = null;
      $("easy-import-file").disabled = true;
      showMessage(`File validation failed: ${error.message}`, "error");
    }
  }

  function previewPastedJson() {
    try {
      const parsed = JSON.parse($("easy-json-text").value);
      state.pastedPreview = globalThis.CMAV2.prepareImport(parsed, selectedBankId(), "pasted-questions.json");
      $("easy-import-json").disabled = !state.pastedPreview.validCount;
      showMessage(previewSummary(state.pastedPreview), state.pastedPreview.invalidCount ? "warning" : "success");
    } catch (error) {
      state.pastedPreview = null;
      $("easy-import-json").disabled = true;
      showMessage(`JSON validation failed: ${error.message}`, "error");
    }
  }

  function previewPlainText() {
    try {
      const result = globalThis.CMAV2.parsePlainTextQuestions(
        $("easy-plain-text").value,
        selectedBankId(),
        $("easy-text-section").value,
        $("easy-text-unit").value
      );
      state.textPreview = result.preview;
      $("easy-import-text").disabled = !state.textPreview.validCount;
      const parserNotes = [...(result.errors || []), ...(result.warnings || [])];
      const note = parserNotes.length ? ` Parser note: ${parserNotes[0]}` : "";
      showMessage(`${previewSummary(state.textPreview)}.${note}`, state.textPreview.invalidCount || result.errors?.length ? "warning" : "success");
    } catch (error) {
      state.textPreview = null;
      $("easy-import-text").disabled = true;
      showMessage(`Question parsing failed: ${error.message}`, "error");
    }
  }

  async function createBank() {
    try {
      const name = clean($("easy-new-bank-name").value);
      if (!name) throw new Error("Enter a name for the new question bank.");
      const bank = globalThis.CMAV2.createBank(name);
      await globalThis.CMAV2.updateSettings({});
      $("easy-new-bank-name").value = "";
      fillBanks(bank.bankId);
      showMessage(`Created “${bank.bankName}”. It is now selected as the destination bank.`, "success");
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function syncCatalog() {
    try {
      $("easy-sync-catalog").disabled = true;
      const result = await globalThis.CMAV2.syncExactHockCatalog();
      refreshSelectors();
      renderCatalog();
      showMessage(`Exact HOCK names applied: ${result.sections} sections, ${result.units} units, ${result.changedQuestions} question records updated. No attempts, notes, or history were deleted.`, "success");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      $("easy-sync-catalog").disabled = false;
    }
  }

  function standalone() {
    return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  }

  function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent || ""); }

  function updateInstallButton() {
    const button = $("install-app-button");
    if (!button) return;
    if (globalThis.AndroidFileBridge) {
      button.hidden = true;
      return;
    }
    if (standalone()) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    button.textContent = state.installPrompt ? "Install App" : "Add to Home Screen";
  }

  function showInstallHelp() {
    const content = $("install-help-content");
    const dialog = $("install-help-dialog");
    if (!content || !dialog) return;
    content.replaceChildren();
    const intro = document.createElement("p");
    if (location.protocol === "file:") {
      intro.textContent = "Installation is not available from a file:// address. Upload this PWA folder to GitHub Pages or another HTTPS host, then open that link on your phone.";
      content.append(intro);
    } else if (isIos()) {
      intro.textContent = "In Safari, tap the Share button, choose Add to Home Screen, then tap Add.";
      content.append(intro);
    } else {
      intro.textContent = "Open the browser menu and choose Install app or Add to Home screen. On Chrome or Edge, the install icon may also appear in the address bar.";
      content.append(intro);
    }
    const note = document.createElement("p");
    note.textContent = "After the first successful load, the simulator interface works offline. Your question banks and progress stay in this device’s browser storage, so export backups regularly.";
    content.append(note);
    if (dialog.showModal && !dialog.open) dialog.showModal();
  }

  async function installApp() {
    if (state.installPrompt) {
      state.installPrompt.prompt();
      try { await state.installPrompt.userChoice; } catch (_) { /* browser controls the prompt */ }
      state.installPrompt = null;
      updateInstallButton();
      return;
    }
    showInstallHelp();
  }

  async function registerServiceWorker() {
    if (globalThis.AndroidFileBridge) return;
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
    try {
      await navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
    } catch (error) {
      console.warn("PWA offline cache could not be registered.", error);
    }
  }

  function bind() {
    $("quick-add-questions")?.addEventListener("click", () => openAddDialog("manual"));
    $("easy-add-close")?.addEventListener("click", closeAddDialog);
    $("easy-add-dialog")?.addEventListener("cancel", (event) => { event.preventDefault(); closeAddDialog(); });
    document.querySelectorAll("[data-easy-tab]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.easyTab)));
    $("easy-manual-section")?.addEventListener("change", () => fillUnits("easy-manual-section", "easy-manual-unit"));
    $("easy-text-section")?.addEventListener("change", () => fillUnits("easy-text-section", "easy-text-unit"));
    $("easy-create-bank")?.addEventListener("click", createBank);
    $("easy-save-manual")?.addEventListener("click", saveManual);
    $("easy-clear-manual")?.addEventListener("click", clearManualForm);
    $("easy-json-file")?.addEventListener("change", (event) => previewFile(event.target.files?.[0]));
    $("easy-import-file")?.addEventListener("click", async () => { try { await commitPreview(state.filePreview, "file"); state.filePreview = null; $("easy-import-file").disabled = true; $("easy-json-file").value = ""; } catch (error) { showMessage(error.message, "error"); } });
    $("easy-preview-json")?.addEventListener("click", previewPastedJson);
    $("easy-import-json")?.addEventListener("click", async () => { try { await commitPreview(state.pastedPreview, "pasted JSON"); state.pastedPreview = null; $("easy-import-json").disabled = true; } catch (error) { showMessage(error.message, "error"); } });
    $("easy-preview-text")?.addEventListener("click", previewPlainText);
    $("easy-import-text")?.addEventListener("click", async () => { try { await commitPreview(state.textPreview, "pasted questions"); state.textPreview = null; $("easy-import-text").disabled = true; } catch (error) { showMessage(error.message, "error"); } });
    $("easy-sync-catalog")?.addEventListener("click", syncCatalog);
    $("install-app-button")?.addEventListener("click", installApp);
    $("install-help-close")?.addEventListener("click", () => $("install-help-dialog")?.close());

    ["home-import", "empty-manage-bank"].forEach((id) => {
      $(id)?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openAddDialog("file");
      }, true);
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.installPrompt = event;
      updateInstallButton();
    });
    window.addEventListener("appinstalled", () => {
      state.installPrompt = null;
      updateInstallButton();
    });
  }

  function waitForSimulator(attempt = 0) {
    const ready = globalThis.CMAV2?.getState?.().banks?.length;
    if (!ready && attempt < 100) {
      setTimeout(() => waitForSimulator(attempt + 1), 100);
      return;
    }
    refreshSelectors();
    renderCatalog();
    updateInstallButton();
    state.initialized = true;
    const action = new URLSearchParams(location.search).get("action");
    if (action === "add") setTimeout(() => openAddDialog("manual"), 0);
    if (action === "build") setTimeout(() => document.getElementById("nav-v2-builder")?.click(), 0);
  }

  function initialize() {
    bind();
    setTab("manual");
    waitForSimulator();
    registerServiceWorker();
  }

  globalThis.CMAPWA = Object.freeze({
    openAddDialog,
    exactReferenceSections,
    previewSummary,
    standalone,
    refreshSelectors
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
