(() => {
  "use strict";

  const STORAGE = globalThis.CMAStorage || null;
  const STORES = STORAGE?.STRUCTURED_STORES || {};
  const VERSION = 2;
  const MIGRATION_ID = "question-bank-v2-2026-07";
  const CATALOG_MIGRATION_ID = "hock-catalog-2024-2025-v1";
  const DEFAULT_BANKS = Object.freeze([
    { bankId: "bank-hock", bankName: "HOCK Questions", description: "Empty organizational container for questions you personally import.", isDefault: true },
    { bankId: "bank-gleim", bankName: "Gleim Questions", description: "Empty organizational container for questions you personally import.", isDefault: true },
    { bankId: "bank-custom", bankName: "Custom Questions", description: "Your own original or permitted practice questions.", isDefault: true }
  ]);
  const SECTION_NAMES = Object.freeze({
    A: "Financial Statement Analysis",
    B: "Corporate Finance",
    C: "Business Decision Analysis",
    D: "Enterprise Risk Management",
    E: "Capital Investment Decisions",
    F: "Professional Ethics"
  });
  const SECTION_IDS = Object.freeze(Object.keys(SECTION_NAMES));
  const PRESETS = Object.freeze({
    quick: { name: "Quick Drill", total: 15, minutes: 22.5, mode: "practice", repeatMode: "normal" },
    unit: { name: "Unit Mastery Drill", total: 15, minutes: 22.5, mode: "practice", repeatMode: "normal" },
    weak: { name: "Weak-Area Drill", total: 15, minutes: 25, mode: "weak", repeatMode: "normal" },
    incorrect: { name: "Incorrect Questions Review", total: 15, minutes: 25, mode: "remediation", repeatMode: "remediation" },
    official: { name: "Official CMA Part 2 MCQ Mock", total: 100, minutes: 180, mode: "exam", repeatMode: "override-all", sections: { A: 20, B: 20, C: 25, D: 10, E: 10, F: 15 } },
    personal: { name: "Personal Custom 100-Question Mix", total: 100, minutes: 180, mode: "exam", repeatMode: "override-all", sections: { A: 20, B: 20, C: 25, D: 10, E: 15, F: 10 } },
    custom: { name: "Custom Test", total: 20, minutes: 30, mode: "practice", repeatMode: "normal" }
  });

  const state = {
    initialized: false,
    hooks: null,
    catalog: null,
    banks: [],
    questions: [],
    attempts: [],
    aggregates: {},
    cycles: {},
    notes: {},
    batches: [],
    settings: {
      allowPauseExam: true,
      allowNotesExam: true,
      hiddenTabStudyPause: true,
      hiddenTabExamPause: false,
      masteryConsecutiveCorrect: 2,
      masteryRecentAccuracy: 70,
      targetSeconds: 90,
      weaknessAccuracyOnly: false,
      focusPreset: ["Section B weak units", "Section E capital-budgeting mechanics", "Sections A and C foundation practice"]
    },
    importPreview: null,
    currentScreen: "banks",
    lastMigrationReport: null,
    lastCatalogSyncReport: null,
    syncingLegacy: false
  };

  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix = "id") {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function nowIso() { return new Date().toISOString(); }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  }

  function hashText(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function contentHash(question) {
    const options = ["A", "B", "C", "D"].map((key) => normalizeText(question?.options?.[key])).join("|");
    return hashText(`${normalizeText(question?.question)}|${options}|${String(question?.correctAnswer || "").toUpperCase()}`);
  }

  function stableQuestionUid(bankId, sourceQuestionId, question) {
    return `q-${hashText(`${bankId}|${sourceQuestionId}|${contentHash(question)}`)}`;
  }

  function sectionIdOf(question) {
    const raw = String(question?.sectionId || question?.section || "").trim().toUpperCase();
    const match = raw.match(/[A-F]/);
    return match ? match[0] : "";
  }

  function unitIdOf(question) {
    const sectionId = sectionIdOf(question);
    const existing = String(question?.unitId || "").trim();
    if (/^[A-F]-U\d{2,}$/i.test(existing)) return existing.toUpperCase();
    const unitRaw = String(question?.unit || "").trim();
    const match = unitRaw.match(/(\d+)/);
    return sectionId && match ? `${sectionId}-U${String(Number(match[1])).padStart(2, "0")}` : existing || `${sectionId}-UNASSIGNED`;
  }

  function unitNumberOf(question) {
    const match = unitIdOf(question).match(/U(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function catalogUnitName(unitId) {
    const catalog = state.catalog || state.hooks?.getCatalog?.();
    const unit = catalog?.units?.find?.((item) => item.id === unitId);
    if (unit?.unitName) return unit.unitName;
    const q = state.questions.find((item) => item.unitId === unitId && item.unitName);
    return q?.unitName || unitId;
  }

  function normalizeQuestion(raw, bankId, index = 0) {
    const sectionId = sectionIdOf(raw);
    const unitId = unitIdOf(raw);
    const sourceQuestionId = String(raw?.sourceQuestionId || raw?.id || `${unitId}-${String(index + 1).padStart(3, "0")}`).trim();
    const questionUid = String(raw?.questionUid || "").trim() || stableQuestionUid(bankId, sourceQuestionId, raw);
    const createdAt = raw?.createdAt || nowIso();
    return {
      ...clone(raw),
      questionUid,
      sourceQuestionId,
      id: questionUid,
      bankId,
      sectionId,
      unitId,
      section: sectionId,
      sectionName: SECTION_NAMES[sectionId] || raw?.sectionName || "",
      unit: `Unit ${unitNumberOf({ unitId }) || 0}`,
      unitName: catalogUnitName(unitId) || raw?.unitName || unitId,
      question: String(raw?.question || "").trim(),
      options: ["A", "B", "C", "D"].reduce((out, key) => {
        out[key] = String(raw?.options?.[key] || "").trim();
        return out;
      }, {}),
      correctAnswer: String(raw?.correctAnswer || "").trim().toUpperCase(),
      explanation: String(raw?.explanation || "").trim(),
      questionType: ["theory", "calculation", "scenario", "judgment", "mixed"].includes(raw?.questionType) ? raw.questionType : "mixed",
      difficulty: normalizeDifficulty(raw?.difficulty),
      tags: Array.isArray(raw?.tags) ? raw.tags.map(String).map((x) => x.trim()).filter(Boolean) : [],
      losTags: Array.isArray(raw?.losTags) ? raw.losTags.map(String).map((x) => x.trim()).filter(Boolean) : [],
      contentHash: raw?.contentHash || contentHash(raw),
      status: raw?.status || (raw?.isRemoved ? "removed" : raw?.retired ? "archived" : "active"),
      isRemoved: Boolean(raw?.isRemoved || raw?.status === "removed"),
      removedAt: raw?.removedAt || null,
      removedReason: String(raw?.removedReason || ""),
      createdAt,
      updatedAt: raw?.updatedAt || createdAt
    };
  }

  function normalizeDifficulty(value) {
    const v = String(value || "").trim().toLowerCase();
    if (["easy", "basic"].includes(v)) return "basic";
    if (["medium", "intermediate"].includes(v)) return "intermediate";
    if (["hard", "advanced"].includes(v)) return v === "hard" ? "hard" : "advanced";
    if (["very-hard", "very hard"].includes(v)) return "very-hard";
    return "unspecified";
  }

  function defaultAggregate(question) {
    return {
      questionUid: question.questionUid,
      bankId: question.bankId,
      sectionId: question.sectionId,
      unitId: question.unitId,
      lifetimeSolvedCount: 0,
      lifetimeCorrectCount: 0,
      lifetimeIncorrectCount: 0,
      consecutiveCorrectCount: 0,
      lastSolvedAt: null,
      lastResultCorrect: null,
      totalActiveTimeSeconds: 0,
      averageActiveTimeSeconds: null,
      recentAccuracy: null,
      masteryStatus: "not_mastered",
      remediationStatus: "remediation_not_due",
      needsReview: false,
      updatedAt: nowIso()
    };
  }

  function defaultCycle(question) {
    return {
      questionUid: question.questionUid,
      bankId: question.bankId,
      sectionId: question.sectionId,
      unitId: question.unitId,
      currentCycleNumber: 1,
      currentCycleAttempted: false,
      held: false,
      heldAt: null,
      releasedAt: null,
      updatedAt: nowIso()
    };
  }

  function activeBanks() { return state.banks.filter((bank) => bank.status === "active"); }
  function bankById(bankId) { return state.banks.find((bank) => bank.bankId === bankId); }
  function questionByUid(questionUid) { return state.questions.find((question) => question.questionUid === questionUid); }
  function aggregateFor(questionUid) { return state.aggregates[questionUid] || defaultAggregate(questionByUid(questionUid) || { questionUid, bankId: "", sectionId: "", unitId: "" }); }
  function cycleFor(questionUid) { return state.cycles[questionUid] || defaultCycle(questionByUid(questionUid) || { questionUid, bankId: "", sectionId: "", unitId: "" }); }

  async function loadStore(storeName) {
    if (!STORAGE?.storeGetAll || !storeName) return [];
    try { return await STORAGE.storeGetAll(storeName); }
    catch (error) { console.warn(`CMA V2: could not read ${storeName}.`, error); return []; }
  }

  async function saveStore(storeName, values) {
    if (!STORAGE?.replaceStore || !storeName) return;
    await STORAGE.replaceStore(storeName, values);
  }

  async function persistAll() {
    if (!STORAGE?.replaceStore) return;
    await Promise.all([
      saveStore(STORES.questionBanks, state.banks),
      saveStore(STORES.questions, state.questions),
      saveStore(STORES.questionAttempts, state.attempts),
      saveStore(STORES.questionAggregates, Object.values(state.aggregates)),
      saveStore(STORES.questionCycleStatus, Object.values(state.cycles)),
      saveStore(STORES.questionNotes, Object.values(state.notes)),
      saveStore(STORES.testHistory, state.batches),
      saveStore(STORES.settings, [{ key: "v2-settings", value: state.settings, updatedAt: nowIso() }])
    ]);
    if (typeof document !== "undefined") renderV2Dashboard();
  }

  async function initialize({ hooks, catalog } = {}) {
    if (state.initialized) return state.lastMigrationReport;
    state.hooks = hooks || globalThis.CMAExamSimulatorTestHooks || null;
    state.catalog = catalog || state.hooks?.getCatalog?.() || state.hooks?.defaultCatalog?.() || null;

    const [banks, questions, attempts, aggregates, cycles, notes, batches, settingsRows, migrations] = await Promise.all([
      loadStore(STORES.questionBanks), loadStore(STORES.questions), loadStore(STORES.questionAttempts), loadStore(STORES.questionAggregates),
      loadStore(STORES.questionCycleStatus), loadStore(STORES.questionNotes), loadStore(STORES.testHistory), loadStore(STORES.settings), loadStore(STORES.migrations)
    ]);
    state.banks = banks;
    state.questions = questions;
    state.attempts = attempts;
    state.aggregates = Object.fromEntries(aggregates.map((item) => [item.questionUid, item]));
    state.cycles = Object.fromEntries(cycles.map((item) => [item.questionUid, item]));
    state.notes = Object.fromEntries(notes.map((item) => [item.questionUid, item]));
    state.batches = batches;
    const settings = settingsRows.find((item) => item.key === "v2-settings")?.value;
    if (settings && typeof settings === "object") state.settings = { ...state.settings, ...settings };

    const migrationDone = migrations.some((item) => item.migrationId === MIGRATION_ID && item.status === "complete");
    if (!migrationDone || !state.questions.length) await migrateLegacyWorkspace();
    ensureDefaultBanks();
    ensureQuestionRelationships();
    const catalogSyncDone = migrations.some((item) => item.migrationId === CATALOG_MIGRATION_ID && item.status === "complete");
    const exactCatalogAvailable = Boolean(
      state.hooks?.getReferenceCatalog
      || (state.hooks?.advanced?.createDefaultCatalog && globalThis.CMA2025Reference)
    );
    if (!catalogSyncDone && exactCatalogAvailable) {
      state.lastCatalogSyncReport = await syncExactHockCatalog();
      if (STORAGE?.storePut && STORES.migrations) {
        await STORAGE.storePut(STORES.migrations, { migrationId: CATALOG_MIGRATION_ID, status: "complete", completedAt: nowIso(), report: clone(state.lastCatalogSyncReport) });
      }
    }
    await persistAll();
    await syncLegacyQuestionPool();
    if (typeof document !== "undefined") installUi();
    state.initialized = true;
    return clone(state.lastMigrationReport);
  }

  function ensureDefaultBanks() {
    DEFAULT_BANKS.forEach((definition) => {
      if (state.banks.some((bank) => bank.bankId === definition.bankId)) return;
      state.banks.push({ ...definition, status: "active", createdAt: nowIso(), updatedAt: nowIso(), deletedAt: null });
    });
  }

  function ensureQuestionRelationships() {
    state.questions = state.questions.map((question, index) => normalizeQuestion(question, question.bankId || "bank-imported", index));
    state.questions.forEach((question) => {
      if (!state.aggregates[question.questionUid]) state.aggregates[question.questionUid] = defaultAggregate(question);
      if (!state.cycles[question.questionUid]) state.cycles[question.questionUid] = defaultCycle(question);
    });
  }

  async function migrateLegacyWorkspace() {
    const legacy = state.hooks?.getState?.() || {};
    const legacyQuestions = Array.isArray(legacy.questionBank) ? legacy.questionBank : [];
    const legacyHistory = Array.isArray(legacy.history) ? legacy.history : [];
    const snapshotId = uid("recovery");
    if (STORAGE?.storePut && STORES.recoverySnapshots) {
      await STORAGE.storePut(STORES.recoverySnapshots, {
        snapshotId, type: "pre-v2-migration", createdAt: nowIso(),
        data: { questionBank: clone(legacyQuestions), history: clone(legacyHistory), settings: clone(legacy.analyticsSettings || {}) }
      });
    }

    ensureDefaultBanks();
    let importedBank = state.banks.find((bank) => bank.bankId === "bank-imported");
    if (!importedBank && legacyQuestions.length) {
      importedBank = { bankId: "bank-imported", bankName: "Imported Questions", description: "Questions migrated safely from the original combined pool.", status: "active", isDefault: false, createdAt: nowIso(), updatedAt: nowIso(), deletedAt: null };
      state.banks.push(importedBank);
    }

    const existingUids = new Set(state.questions.map((question) => question.questionUid));
    legacyQuestions.forEach((raw, index) => {
      const bankId = raw.bankId && state.banks.some((bank) => bank.bankId === raw.bankId) ? raw.bankId : importedBank?.bankId || "bank-custom";
      const normalized = normalizeQuestion(raw, bankId, index);
      if (!existingUids.has(normalized.questionUid)) {
        state.questions.push(normalized);
        existingUids.add(normalized.questionUid);
      }
    });
    ensureQuestionRelationships();

    let historyAttempts = 0;
    legacyHistory.slice().reverse().forEach((result) => {
      const batchId = result.batchId || `legacy-batch-${result.id}`;
      if (state.batches.some((batch) => batch.batchId === batchId)) return;
      const batch = batchFromResult(result, batchId);
      state.batches.push(batch);
      (result.perQuestion || []).forEach((item) => {
        const sourceId = item.sourceQuestionId || item.id;
        const question = state.questions.find((candidate) => candidate.sourceQuestionId === sourceId || candidate.questionUid === item.questionUid || candidate.questionUid === item.id);
        if (!question || !item.userAnswer) return;
        applyAttempt(question, {
          attemptId: `legacy-attempt-${result.id}-${question.questionUid}`,
          testId: result.id,
          batchId,
          selectedAnswer: item.userAnswer,
          correctAnswerAtAttempt: item.correctAnswer,
          isCorrect: item.status === "Correct",
          wasAnswered: true,
          activeTimeSeconds: Math.max(0, Number(item.timeMs) || 0) / 1000,
          manualPauseSeconds: 0,
          notePauseSeconds: 0,
          hiddenPauseSeconds: 0,
          attemptedAt: result.completedAt || nowIso(),
          questionVersionHash: question.contentHash,
          migrated: true
        }, { updateCycle: true, persist: false });
        historyAttempts += 1;
      });
    });
    releaseCompletedCycles();

    state.lastMigrationReport = {
      version: VERSION,
      questionsMigrated: legacyQuestions.length,
      historyRecordsPreserved: legacyHistory.length,
      attemptsReconstructed: historyAttempts,
      notesPreserved: Object.keys(state.notes).length,
      unfinishedSessionsPreserved: legacy.activeExam ? 1 : 0,
      recoverySnapshotId: snapshotId,
      completedAt: nowIso()
    };
    if (STORAGE?.storePut && STORES.migrations) {
      await STORAGE.storePut(STORES.migrations, { migrationId: MIGRATION_ID, status: "complete", completedAt: nowIso(), report: clone(state.lastMigrationReport) });
    }
  }

  async function syncLegacyQuestionPool() {
    if (!state.hooks?.replaceQuestionBank) return;
    state.syncingLegacy = true;
    try {
      const active = state.questions.filter((question) => question.status === "active" && bankById(question.bankId)?.status === "active").map(toLegacyQuestion);
      await state.hooks.replaceQuestionBank(active, "CMA V2 multi-bank active pool");
    } finally { state.syncingLegacy = false; }
  }

  function toLegacyQuestion(question) {
    return {
      ...clone(question),
      id: question.questionUid,
      questionUid: question.questionUid,
      sourceQuestionId: question.sourceQuestionId,
      bankId: question.bankId,
      section: question.sectionId,
      sectionName: SECTION_NAMES[question.sectionId] || question.sectionName,
      unit: `Unit ${unitNumberOf(question) || 0}`,
      unitName: catalogUnitName(question.unitId),
      retired: question.status === "archived",
      isRemoved: question.status === "removed"
    };
  }

  async function captureLegacyBank(legacyQuestions) {
    if (!state.initialized || state.syncingLegacy || !Array.isArray(legacyQuestions)) return;
    let importedBank = state.banks.find((bank) => bank.bankId === "bank-imported");
    if (!importedBank) {
      importedBank = createBank("Imported Questions", "Questions imported through the original compatibility screen.", "bank-imported");
    }
    let changed = false;
    legacyQuestions.forEach((raw, index) => {
      const knownUid = raw.questionUid || (String(raw.id || "").startsWith("q-") ? raw.id : "");
      const known = knownUid && state.questions.find((question) => question.questionUid === knownUid);
      if (known) {
        Object.assign(known, normalizeQuestion({ ...known, ...raw, questionUid: known.questionUid, sourceQuestionId: known.sourceQuestionId }, known.bankId, index), { updatedAt: nowIso() });
        changed = true;
        return;
      }
      const normalized = normalizeQuestion(raw, raw.bankId || importedBank.bankId, index);
      const conflict = state.questions.some((question) => question.bankId === normalized.bankId && question.sourceQuestionId === normalized.sourceQuestionId);
      if (!conflict) { state.questions.push(normalized); changed = true; }
    });
    if (changed) {
      ensureQuestionRelationships();
      await persistAll();
    }
  }

  function createBank(name, description = "", forcedId = "") {
    const cleanName = String(name || "").trim();
    if (!cleanName) throw new Error("Question-bank name is required.");
    if (state.banks.some((bank) => bank.bankName.toLowerCase() === cleanName.toLowerCase() && bank.status !== "trashed")) throw new Error("A question bank with that name already exists.");
    const bank = { bankId: forcedId || uid("bank"), bankName: cleanName, description: String(description || "").trim(), status: "active", isDefault: false, createdAt: nowIso(), updatedAt: nowIso(), deletedAt: null };
    state.banks.push(bank);
    return bank;
  }

  async function renameBank(bankId, name) {
    const bank = bankById(bankId);
    if (!bank) throw new Error("Question bank was not found.");
    const clean = String(name || "").trim();
    if (!clean) throw new Error("Question-bank name is required.");
    if (state.banks.some((other) => other.bankId !== bankId && other.status !== "trashed" && other.bankName.toLowerCase() === clean.toLowerCase())) throw new Error("A question bank with that name already exists.");
    bank.bankName = clean;
    bank.updatedAt = nowIso();
    await persistAll();
    renderCurrentScreen();
  }

  async function archiveBank(bankId, archived = true) {
    const bank = bankById(bankId);
    if (!bank) return;
    bank.status = archived ? "archived" : "active";
    bank.updatedAt = nowIso();
    await persistAll();
    await syncLegacyQuestionPool();
    renderCurrentScreen();
  }

  async function trashBank(bankId) {
    const bank = bankById(bankId);
    if (!bank) return;
    bank.status = "trashed";
    bank.deletedAt = nowIso();
    bank.updatedAt = nowIso();
    state.questions.filter((q) => q.bankId === bankId && q.status === "active").forEach((q) => { q.status = "removed"; q.isRemoved = true; q.removedAt = nowIso(); q.removedReason = "Question bank moved to Trash"; });
    await persistAll();
    await syncLegacyQuestionPool();
    renderCurrentScreen();
  }

  async function duplicateBank(bankId, newName) {
    const source = bankById(bankId);
    if (!source) throw new Error("Source bank was not found.");
    const target = createBank(newName || `${source.bankName} Copy`, `Duplicated from ${source.bankName}.`);
    const copies = state.questions.filter((q) => q.bankId === bankId).map((q, index) => normalizeQuestion({ ...q, questionUid: "", id: q.sourceQuestionId, bankId: target.bankId, createdAt: nowIso(), updatedAt: nowIso() }, target.bankId, index));
    state.questions.push(...copies);
    ensureQuestionRelationships();
    await persistAll(); await syncLegacyQuestionPool(); renderCurrentScreen();
    return target;
  }

  async function mergeBanks(sourceBankId, targetBankId) {
    if (sourceBankId === targetBankId) throw new Error("Choose two different banks.");
    const source = bankById(sourceBankId), target = bankById(targetBankId);
    if (!source || !target) throw new Error("One of the selected banks was not found.");
    const targetIds = new Set(state.questions.filter((q) => q.bankId === targetBankId).map((q) => q.sourceQuestionId));
    let moved = 0; let renamed = 0;
    state.questions.filter((q) => q.bankId === sourceBankId).forEach((q) => {
      q.bankId = targetBankId;
      if (targetIds.has(q.sourceQuestionId)) { q.sourceQuestionId = `${q.sourceQuestionId}-merged-${hashText(q.questionUid).slice(0, 4)}`; renamed += 1; }
      targetIds.add(q.sourceQuestionId); q.updatedAt = nowIso(); moved += 1;
      const aggregate = state.aggregates[q.questionUid]; if (aggregate) aggregate.bankId = targetBankId;
      const cycle = state.cycles[q.questionUid]; if (cycle) cycle.bankId = targetBankId;
      const note = state.notes[q.questionUid]; if (note) note.bankId = targetBankId;
      state.attempts.filter((a) => a.questionUid === q.questionUid).forEach((a) => { a.bankId = targetBankId; });
    });
    source.status = "trashed"; source.deletedAt = nowIso(); source.updatedAt = nowIso();
    target.updatedAt = nowIso();
    await persistAll(); await syncLegacyQuestionPool(); renderCurrentScreen();
    return { moved, renamedConflicts: renamed };
  }

  async function restoreBank(bankId) {
    const bank = bankById(bankId); if (!bank) throw new Error("Bank not found.");
    bank.status = "active"; bank.deletedAt = null; bank.updatedAt = nowIso();
    state.questions.filter((q) => q.bankId === bankId && q.status === "removed" && q.removedReason === "Question bank moved to Trash").forEach((q) => { q.status = "active"; q.isRemoved = false; q.removedAt = null; q.removedReason = ""; q.updatedAt = nowIso(); });
    await persistAll(); await syncLegacyQuestionPool(); renderCurrentScreen();
  }

  async function permanentlyDeleteBank(bankId) {
    const bank = bankById(bankId); if (!bank || bank.status !== "trashed") throw new Error("Only a bank in Trash can be permanently deleted.");
    const qids = new Set(state.questions.filter((q) => q.bankId === bankId).map((q) => q.questionUid));
    state.questions = state.questions.filter((q) => q.bankId !== bankId);
    qids.forEach((id) => { delete state.aggregates[id]; delete state.cycles[id]; delete state.notes[id]; });
    bank.status = "deleted"; bank.bankNameSnapshot = bank.bankName; bank.description = "Deleted bank tombstone retained for historical attempts."; bank.updatedAt = nowIso();
    await persistAll(); await syncLegacyQuestionPool(); renderCurrentScreen();
  }

  async function moveQuestion(questionUid, targetBankId) {
    const question = questionByUid(questionUid), target = bankById(targetBankId);
    if (!question || !target || target.status !== "active") throw new Error("Question or destination bank was not found.");
    if (question.bankId === targetBankId) return question;
    if (state.questions.some((q) => q.bankId === targetBankId && q.sourceQuestionId === question.sourceQuestionId)) question.sourceQuestionId = `${question.sourceQuestionId}-moved-${hashText(question.questionUid).slice(0, 4)}`;
    question.bankId = targetBankId; question.updatedAt = nowIso();
    const aggregate = state.aggregates[questionUid]; if (aggregate) aggregate.bankId = targetBankId;
    const cycle = state.cycles[questionUid]; if (cycle) { cycle.bankId = targetBankId; cycle.currentCycleAttempted = false; cycle.held = false; }
    const note = state.notes[questionUid]; if (note) note.bankId = targetBankId;
    state.attempts.filter((a) => a.questionUid === questionUid).forEach((a) => { a.bankId = targetBankId; });
    await persistAll(); await syncLegacyQuestionPool(); renderCurrentScreen(); return question;
  }

  function bankStats(bankId) {
    const questions = state.questions.filter((question) => question.bankId === bankId);
    const active = questions.filter((q) => q.status === "active");
    const aggregates = active.map((q) => aggregateFor(q.questionUid));
    const attempted = aggregates.filter((a) => a.lifetimeSolvedCount > 0);
    const correct = aggregates.reduce((sum, a) => sum + a.lifetimeCorrectCount, 0);
    const solved = aggregates.reduce((sum, a) => sum + a.lifetimeSolvedCount, 0);
    const timed = aggregates.filter((a) => Number.isFinite(a.averageActiveTimeSeconds));
    return {
      total: questions.length,
      active: active.length,
      removed: questions.filter((q) => q.status === "removed").length,
      archived: questions.filter((q) => q.status === "archived").length,
      sections: new Set(active.map((q) => q.sectionId)).size,
      units: new Set(active.map((q) => q.unitId)).size,
      attempted: attempted.length,
      unattempted: Math.max(0, active.length - attempted.length),
      solvedOnce: aggregates.filter((a) => a.lifetimeSolvedCount === 1).length,
      solvedTwice: aggregates.filter((a) => a.lifetimeSolvedCount >= 2).length,
      held: active.filter((q) => cycleFor(q.questionUid).held).length,
      remediation: aggregates.filter((a) => a.remediationStatus === "remediation_due").length,
      mastered: aggregates.filter((a) => a.masteryStatus === "mastered").length,
      accuracy: solved ? correct / solved * 100 : null,
      averageTime: timed.length ? timed.reduce((sum, a) => sum + a.averageActiveTimeSeconds, 0) / timed.length : null,
      cycleCompleted: active.length ? active.filter((q) => cycleFor(q.questionUid).currentCycleAttempted).length / active.length * 100 : 0
    };
  }

  function validateImportedQuestion(raw, index) {
    const errors = [];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { errors: [`Record ${index + 1}: must be an object.`], question: null };
    const sectionId = sectionIdOf(raw);
    if (!SECTION_IDS.includes(sectionId)) errors.push(`Record ${index + 1}: section must be A–F.`);
    const unitId = unitIdOf(raw);
    if (!unitId || unitId.endsWith("UNASSIGNED")) errors.push(`Record ${index + 1}: a valid unit is required.`);
    if (!String(raw.question || "").trim()) errors.push(`Record ${index + 1}: question text is empty.`);
    if (!raw.options || typeof raw.options !== "object") errors.push(`Record ${index + 1}: options A–D are required.`);
    ["A", "B", "C", "D"].forEach((key) => { if (!String(raw.options?.[key] || "").trim()) errors.push(`Record ${index + 1}: option ${key} is missing.`); });
    const answer = String(raw.correctAnswer || "").trim().toUpperCase();
    if (!["A", "B", "C", "D"].includes(answer)) errors.push(`Record ${index + 1}: correctAnswer must be A, B, C, or D.`);
    return { errors, question: errors.length ? null : raw };
  }

  function prepareImport(parsed, bankId, fileName = "questions.json") {
    const rawQuestions = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : null;
    if (!rawQuestions) throw new Error("The file must contain an array or an object with a questions array.");
    const valid = [];
    const errors = [];
    rawQuestions.forEach((raw, index) => {
      const result = validateImportedQuestion(raw, index);
      if (result.question) valid.push(normalizeQuestion(result.question, bankId, index));
      errors.push(...result.errors);
    });
    const destination = state.questions.filter((question) => question.bankId === bankId);
    const ids = new Set();
    const duplicateBatchIds = [];
    valid.forEach((q) => { if (ids.has(q.sourceQuestionId)) duplicateBatchIds.push(q.sourceQuestionId); ids.add(q.sourceQuestionId); });
    const duplicateIds = valid.filter((q) => destination.some((existing) => existing.sourceQuestionId === q.sourceQuestionId)).map((q) => q.sourceQuestionId);
    const duplicateText = valid.filter((q) => destination.some((existing) => existing.contentHash === q.contentHash)).map((q) => q.sourceQuestionId);
    const crossBankDuplicates = valid.filter((q) => state.questions.some((existing) => existing.bankId !== bankId && existing.contentHash === q.contentHash)).map((q) => q.sourceQuestionId);
    return {
      fileName,
      sourceTitle: String(parsed?.title || "Untitled question file"),
      bankId,
      total: rawQuestions.length,
      valid,
      validCount: valid.length,
      invalidCount: rawQuestions.length - valid.length,
      errors,
      duplicateBatchIds: Array.from(new Set(duplicateBatchIds)),
      duplicateIds: Array.from(new Set(duplicateIds)),
      duplicateText: Array.from(new Set(duplicateText)),
      crossBankDuplicates: Array.from(new Set(crossBankDuplicates)),
      missingExplanation: valid.filter((q) => !q.explanation).length
    };
  }

  async function commitImport(preview, conflictMode = "skip") {
    if (!preview || !bankById(preview.bankId)) throw new Error("Select a valid destination bank.");
    const existingBySource = new Map(state.questions.filter((q) => q.bankId === preview.bankId).map((q) => [q.sourceQuestionId, q]));
    const existingHashes = new Set(state.questions.filter((q) => q.bankId === preview.bankId).map((q) => q.contentHash));
    let added = 0; let replaced = 0; let skipped = 0;
    preview.valid.forEach((incoming) => {
      const conflict = existingBySource.get(incoming.sourceQuestionId);
      const exact = existingHashes.has(incoming.contentHash);
      if (exact && !conflict) { skipped += 1; return; }
      if (conflict) {
        if (conflictMode === "replace") {
          const preserved = { questionUid: conflict.questionUid, createdAt: conflict.createdAt, status: conflict.status, isRemoved: conflict.isRemoved, removedAt: conflict.removedAt, removedReason: conflict.removedReason };
          Object.assign(conflict, incoming, preserved, { id: preserved.questionUid, updatedAt: nowIso() });
          replaced += 1;
        } else if (conflictMode === "new") {
          incoming.sourceQuestionId = `${incoming.sourceQuestionId}-${uid("copy").slice(-6)}`;
          incoming.questionUid = uid("q"); incoming.id = incoming.questionUid;
          state.questions.push(incoming); added += 1;
        } else skipped += 1;
      } else { state.questions.push(incoming); added += 1; }
    });
    ensureQuestionRelationships();
    const bank = bankById(preview.bankId); bank.updatedAt = nowIso();
    await persistAll();
    await syncLegacyQuestionPool();
    renderCurrentScreen();
    return { added, replaced, skipped, invalid: preview.invalidCount };
  }

  function randomFromSeed(seed) {
    let value = parseInt(hashText(seed), 16) || 1;
    return () => {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffleSeeded(items, seed) {
    const out = items.slice(); const rand = randomFromSeed(seed);
    for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }

  function eligibilityReason(question, config) {
    const bank = bankById(question.bankId);
    if (!bank || bank.status !== "active") return "bank-inactive";
    if (question.status !== "active") return question.status;
    if (config.bankIds?.length && !config.bankIds.includes(question.bankId)) return "bank-filter";
    if (config.sectionIds?.length && !config.sectionIds.includes(question.sectionId)) return "section-filter";
    if (config.unitIds?.length && !config.unitIds.includes(question.unitId)) return "unit-filter";
    const aggregate = aggregateFor(question.questionUid);
    const cycle = cycleFor(question.questionUid);
    if (config.repeatMode === "remediation") return aggregate.remediationStatus === "remediation_due" ? "eligible" : "not-remediation";
    if (config.repeatMode === "held-only") return cycle.held ? "eligible" : "not-held";
    if (config.repeatMode === "override-all") return "eligible";
    if (config.repeatMode === "include-solved-once") return cycle.held ? "held" : "eligible";
    if (config.repeatMode === "include-held") return "eligible";
    if (cycle.held) return "held";
    if (cycle.currentCycleAttempted) return "solved-current-cycle";
    return "eligible";
  }

  function eligibleQuestions(config) {
    return state.questions.filter((question) => eligibilityReason(question, config) === "eligible");
  }

  function equalQuotas(ids, total) {
    const out = {}; if (!ids.length) return out;
    const base = Math.floor(total / ids.length); let rem = total % ids.length;
    ids.forEach((id) => { out[id] = base + (rem > 0 ? 1 : 0); rem -= rem > 0 ? 1 : 0; });
    return out;
  }

  function automaticQuotas(ids, total, availability) {
    const out = Object.fromEntries(ids.map((id) => [id, 0]));
    let remaining = total;
    const order = ids.slice().sort((a, b) => (availability[b] || 0) - (availability[a] || 0));
    while (remaining > 0) {
      let moved = false;
      for (const id of order) {
        if (out[id] < (availability[id] || 0) && remaining > 0) { out[id] += 1; remaining -= 1; moved = true; }
      }
      if (!moved) break;
    }
    return out;
  }

  class MaxFlow {
    constructor(n) { this.g = Array.from({ length: n }, () => []); }
    addEdge(from, to, cap) { const f = { to, rev: this.g[to].length, cap, original: cap }; const r = { to: from, rev: this.g[from].length, cap: 0, original: 0 }; this.g[from].push(f); this.g[to].push(r); }
    run(source, sink) {
      let flow = 0;
      for (;;) {
        const level = Array(this.g.length).fill(-1); level[source] = 0; const q = [source];
        for (let h = 0; h < q.length; h += 1) for (const e of this.g[q[h]]) if (e.cap > 0 && level[e.to] < 0) { level[e.to] = level[q[h]] + 1; q.push(e.to); }
        if (level[sink] < 0) return flow;
        const it = Array(this.g.length).fill(0);
        const dfs = (v, f) => { if (v === sink) return f; for (; it[v] < this.g[v].length; it[v] += 1) { const e = this.g[v][it[v]]; if (e.cap > 0 && level[v] + 1 === level[e.to]) { const d = dfs(e.to, Math.min(f, e.cap)); if (d > 0) { e.cap -= d; this.g[e.to][e.rev].cap += d; return d; } } } return 0; };
        let f; while ((f = dfs(source, Number.MAX_SAFE_INTEGER)) > 0) flow += f;
      }
    }
  }

  function allocateExact(pool, config) {
    const total = Number(config.total) || 0;
    if (total < 1) return { valid: false, errors: ["Choose at least one question."], selected: [] };
    const bankIds = config.bankIds?.length ? config.bankIds.slice() : activeBanks().map((b) => b.bankId);
    const scopeQuotas = { ...(config.unitQuotas && Object.values(config.unitQuotas).some(Number) ? config.unitQuotas : config.sectionQuotas) };
    const scopeType = config.unitQuotas && Object.values(config.unitQuotas).some(Number) ? "unit" : "section";
    const scopeIds = Object.keys(scopeQuotas).filter((id) => Number(scopeQuotas[id]) > 0);
    const errors = [];
    const scopeTotal = scopeIds.reduce((sum, id) => sum + Number(scopeQuotas[id] || 0), 0);
    if (scopeTotal !== total) errors.push(`Section/unit quantities total ${scopeTotal}, but the requested test total is ${total}.`);
    if (!bankIds.length) errors.push("Select at least one question bank.");
    if (!scopeIds.length) errors.push("Request questions from at least one section or unit.");
    if (errors.length) return { valid: false, errors, selected: [] };

    const availabilityByScope = Object.fromEntries(scopeIds.map((scopeId) => [scopeId, pool.filter((q) => (scopeType === "unit" ? q.unitId : q.sectionId) === scopeId).length]));
    scopeIds.forEach((id) => { if (availabilityByScope[id] < scopeQuotas[id]) errors.push(`${id} has only ${availabilityByScope[id]} eligible questions, but ${scopeQuotas[id]} were requested.`); });

    let bankQuotas = null;
    if (config.bankDistribution === "custom") bankQuotas = { ...config.bankQuotas };
    if (config.bankDistribution === "equal") bankQuotas = equalQuotas(bankIds, total);
    if (bankQuotas) {
      const bankTotal = bankIds.reduce((sum, id) => sum + Number(bankQuotas[id] || 0), 0);
      if (bankTotal !== total) errors.push(`Question-bank quantities total ${bankTotal}, but the requested test total is ${total}.`);
    }
    if (errors.length) return { valid: false, errors, selected: [] };

    const seed = config.seed || uid("seed");
    if (!bankQuotas) {
      const selected = [];
      scopeIds.forEach((scopeId) => {
        const candidates = pool.filter((q) => (scopeType === "unit" ? q.unitId : q.sectionId) === scopeId);
        const ordered = config.presetId === "weak" ? candidates.slice().sort((a, b) => weaknessScore(b) - weaknessScore(a)) : shuffleSeeded(candidates, `${seed}:${scopeId}`);
        selected.push(...ordered.slice(0, scopeQuotas[scopeId]));
      });
      return { valid: selected.length === total, errors: selected.length === total ? [] : ["The requested distribution could not be filled."], selected, seed, matrix: null, scopeType };
    }

    const source = 0; const bankStart = 1; const scopeStart = bankStart + bankIds.length; const sink = scopeStart + scopeIds.length;
    const flow = new MaxFlow(sink + 1);
    bankIds.forEach((bankId, i) => flow.addEdge(source, bankStart + i, Number(bankQuotas[bankId] || 0)));
    const edgeRefs = [];
    bankIds.forEach((bankId, i) => scopeIds.forEach((scopeId, j) => {
      const count = pool.filter((q) => q.bankId === bankId && (scopeType === "unit" ? q.unitId : q.sectionId) === scopeId).length;
      const edgeIndex = flow.g[bankStart + i].length;
      flow.addEdge(bankStart + i, scopeStart + j, count);
      edgeRefs.push({ bankId, scopeId, node: bankStart + i, edgeIndex, available: count });
    }));
    scopeIds.forEach((scopeId, j) => flow.addEdge(scopeStart + j, sink, Number(scopeQuotas[scopeId] || 0)));
    const achieved = flow.run(source, sink);
    if (achieved !== total) {
      const matrixErrors = edgeRefs.filter((ref) => ref.available === 0 && Number(bankQuotas[ref.bankId] || 0) && Number(scopeQuotas[ref.scopeId] || 0)).map((ref) => `${bankById(ref.bankId)?.bankName || ref.bankId} has no eligible questions in ${ref.scopeId}.`);
      return { valid: false, errors: ["The requested bank and section/unit quantities cannot be satisfied exactly.", ...matrixErrors.slice(0, 6)], selected: [], seed, scopeType };
    }
    const selected = []; const matrix = {};
    edgeRefs.forEach((ref) => {
      const edge = flow.g[ref.node][ref.edgeIndex]; const count = edge.original - edge.cap;
      matrix[`${ref.bankId}|${ref.scopeId}`] = count;
      if (!count) return;
      const candidates = pool.filter((q) => q.bankId === ref.bankId && (scopeType === "unit" ? q.unitId : q.sectionId) === ref.scopeId);
      const ordered = config.presetId === "weak" ? candidates.slice().sort((a, b) => weaknessScore(b) - weaknessScore(a)) : shuffleSeeded(candidates, `${seed}:${ref.bankId}:${ref.scopeId}`);
      selected.push(...ordered.slice(0, count));
    });
    return { valid: selected.length === total, errors: selected.length === total ? [] : ["Selection count did not match the exact allocation."], selected, seed, matrix, scopeType };
  }

  function buildConfigFromUi() {
    const presetId = document.getElementById("v2-preset")?.value || "custom";
    const total = Number(document.getElementById("v2-total")?.value) || 0;
    const minutes = Number(document.getElementById("v2-minutes")?.value) || Math.max(1, total * 1.5);
    const bankIds = Array.from(document.querySelectorAll("[data-v2-bank]:checked")).map((input) => input.value);
    const sectionQuotas = Object.fromEntries(SECTION_IDS.map((id) => [id, Number(document.getElementById(`v2-section-${id}`)?.value) || 0]));
    const unitQuotas = {};
    document.querySelectorAll("[data-v2-unit-quota]").forEach((input) => { const n = Number(input.value) || 0; if (n > 0) unitQuotas[input.dataset.v2UnitQuota] = n; });
    const bankDistribution = document.querySelector('input[name="v2-bank-distribution"]:checked')?.value || "automatic";
    const bankQuotas = {};
    document.querySelectorAll("[data-v2-bank-quota]").forEach((input) => { bankQuotas[input.dataset.v2BankQuota] = Number(input.value) || 0; });
    return { presetId, total, minutes, bankIds, sectionIds: SECTION_IDS.filter((id) => sectionQuotas[id] > 0), unitIds: Object.keys(unitQuotas), sectionQuotas, unitQuotas, bankDistribution, bankQuotas, repeatMode: document.getElementById("v2-repeat-mode")?.value || PRESETS[presetId]?.repeatMode || "normal", seed: uid("seed"), mode: PRESETS[presetId]?.mode || "practice", shuffle: document.getElementById("v2-shuffle-options")?.checked !== false };
  }

  async function startBuiltTest() {
    const config = buildConfigFromUi();
    const pool = eligibleQuestions(config);
    const allocation = allocateExact(pool, config);
    const box = document.getElementById("v2-builder-message");
    if (!allocation.valid) { showBox(box, allocation.errors.join(" "), "error"); return; }
    const title = PRESETS[config.presetId]?.name || "Custom Test";
    const selected = allocation.selected.map(toLegacyQuestion);
    const metadata = {
      version: VERSION, presetId: config.presetId, selectedBankIds: config.bankIds, bankQuestionQuotas: clone(config.bankQuotas), sectionQuestionQuotas: clone(config.sectionQuotas), unitQuestionQuotas: clone(config.unitQuotas), questionUids: selected.map((q) => q.questionUid), selectionSeed: allocation.seed, repeatProtectionEnabled: config.repeatMode === "normal", repeatOverrideMode: config.repeatMode, remediationMode: config.repeatMode === "remediation" ? "due-only" : "none", bankSectionMatrix: allocation.matrix, createdAt: nowIso()
    };
    if (!state.hooks?.startDirectExam) { showBox(box, "The exam engine is unavailable.", "error"); return; }
    state.hooks.startDirectExam(selected, title, config.minutes, { randomize: true, shuffle: config.shuffle, mode: config.mode, v2Metadata: metadata, removeFastQuestions: false });
  }

  function batchFromResult(result, forcedBatchId = "") {
    const answered = (result.perQuestion || []).filter((q) => q.userAnswer).length;
    const times = (result.perQuestion || []).filter((q) => q.userAnswer && Number.isFinite(q.timeMs)).map((q) => q.timeMs / 1000).sort((a, b) => a - b);
    return {
      batchId: forcedBatchId || uid("batch"),
      testId: result.id,
      completedAt: result.completedAt || nowIso(),
      bankIds: Array.from(new Set((result.perQuestion || []).map((q) => q.bankId).filter(Boolean))),
      sectionIds: Array.from(new Set((result.perQuestion || []).map((q) => q.sectionId || q.section).filter(Boolean))),
      unitIds: Array.from(new Set((result.perQuestion || []).map((q) => q.unitId).filter(Boolean))),
      presetId: result.v2Metadata?.presetId || result.settings?.v2Metadata?.presetId || "legacy",
      mode: result.mode || "practice",
      totalQuestions: result.totalQuestions || (result.perQuestion || []).length,
      answered,
      correct: result.correct || 0,
      incorrect: result.incorrect || 0,
      unanswered: result.unanswered || 0,
      accuracy: answered ? (result.correct || 0) / answered * 100 : null,
      averageActiveTimeSeconds: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
      medianActiveTimeSeconds: times.length ? (times[Math.floor((times.length - 1) / 2)] + times[Math.ceil((times.length - 1) / 2)]) / 2 : null,
      totalActiveSeconds: times.reduce((a, b) => a + b, 0),
      totalPausedSeconds: Math.max(0, Number(result.totalPausedMs) || 0) / 1000,
      notePausedSeconds: Math.max(0, Number(result.notePausedMs) || 0) / 1000,
      selectionSeed: result.v2Metadata?.selectionSeed || result.settings?.v2Metadata?.selectionSeed || null
    };
  }

  function applyAttempt(question, attemptInput, options = {}) {
    const attempt = {
      attemptId: attemptInput.attemptId || uid("attempt"),
      questionUid: question.questionUid,
      sourceQuestionId: question.sourceQuestionId,
      bankId: question.bankId,
      sectionId: question.sectionId,
      unitId: question.unitId,
      testId: attemptInput.testId,
      batchId: attemptInput.batchId,
      selectedAnswer: attemptInput.selectedAnswer,
      correctAnswerAtAttempt: attemptInput.correctAnswerAtAttempt,
      isCorrect: Boolean(attemptInput.isCorrect),
      wasAnswered: Boolean(attemptInput.wasAnswered),
      activeTimeSeconds: Math.max(0, Number(attemptInput.activeTimeSeconds) || 0),
      manualPauseSeconds: Math.max(0, Number(attemptInput.manualPauseSeconds) || 0),
      notePauseSeconds: Math.max(0, Number(attemptInput.notePauseSeconds) || 0),
      hiddenPauseSeconds: Math.max(0, Number(attemptInput.hiddenPauseSeconds) || 0),
      attemptedAt: attemptInput.attemptedAt || nowIso(),
      questionVersionHash: attemptInput.questionVersionHash || question.contentHash,
      migrated: Boolean(attemptInput.migrated)
    };
    if (state.attempts.some((item) => item.attemptId === attempt.attemptId)) return;
    state.attempts.push(attempt);
    if (!attempt.wasAnswered) return;
    const aggregate = state.aggregates[question.questionUid] || defaultAggregate(question);
    aggregate.lifetimeSolvedCount += 1;
    if (attempt.isCorrect) { aggregate.lifetimeCorrectCount += 1; aggregate.consecutiveCorrectCount += 1; }
    else { aggregate.lifetimeIncorrectCount += 1; aggregate.consecutiveCorrectCount = 0; }
    aggregate.lastSolvedAt = attempt.attemptedAt;
    aggregate.lastResultCorrect = attempt.isCorrect;
    aggregate.totalActiveTimeSeconds += attempt.activeTimeSeconds;
    aggregate.averageActiveTimeSeconds = aggregate.totalActiveTimeSeconds / aggregate.lifetimeSolvedCount;
    const recent = state.attempts.filter((item) => item.questionUid === question.questionUid && item.wasAnswered).slice(-5);
    aggregate.recentAccuracy = recent.length ? recent.filter((item) => item.isCorrect).length / recent.length * 100 : null;
    aggregate.remediationStatus = attempt.isCorrect && aggregate.consecutiveCorrectCount >= 1 ? "remediation_completed" : attempt.isCorrect ? aggregate.remediationStatus : "remediation_due";
    const lifetimeAccuracy = aggregate.lifetimeSolvedCount ? aggregate.lifetimeCorrectCount / aggregate.lifetimeSolvedCount * 100 : 0;
    aggregate.masteryStatus = aggregate.consecutiveCorrectCount >= state.settings.masteryConsecutiveCorrect && Math.max(aggregate.recentAccuracy || 0, lifetimeAccuracy) >= state.settings.masteryRecentAccuracy && !aggregate.needsReview ? "mastered" : aggregate.lifetimeSolvedCount ? "developing" : "not_mastered";
    aggregate.updatedAt = nowIso();
    state.aggregates[question.questionUid] = aggregate;
    if (options.updateCycle !== false) {
      const cycle = state.cycles[question.questionUid] || defaultCycle(question);
      cycle.currentCycleAttempted = true;
      if (aggregate.lifetimeSolvedCount >= 2) { cycle.held = true; cycle.heldAt ||= attempt.attemptedAt; }
      cycle.updatedAt = nowIso();
      state.cycles[question.questionUid] = cycle;
    }
  }

  async function recordResult(result) {
    if (!result || !Array.isArray(result.perQuestion)) return;
    const batch = batchFromResult(result);
    if (state.batches.some((item) => item.testId === result.id)) return;
    result.perQuestion.forEach((item) => {
      const questionUid = item.questionUid || item.id;
      const question = questionByUid(questionUid) || state.questions.find((q) => q.sourceQuestionId === item.sourceQuestionId && q.bankId === item.bankId);
      if (!question || !item.userAnswer) return;
      applyAttempt(question, {
        testId: result.id,
        batchId: batch.batchId,
        selectedAnswer: item.userAnswer,
        correctAnswerAtAttempt: item.correctAnswer,
        isCorrect: item.status === "Correct",
        wasAnswered: true,
        activeTimeSeconds: Math.max(0, Number(item.timeMs) || 0) / 1000,
        manualPauseSeconds: Math.max(0, Number(result.manualPausedMs) || 0) / 1000 / Math.max(1, result.totalQuestions),
        notePauseSeconds: Math.max(0, Number(result.notePausedMs) || 0) / 1000 / Math.max(1, result.totalQuestions),
        hiddenPauseSeconds: Math.max(0, Number(result.hiddenPausedMs) || 0) / 1000 / Math.max(1, result.totalQuestions),
        attemptedAt: result.completedAt,
        questionVersionHash: question.contentHash
      });
    });
    state.batches.push(batch);
    releaseCompletedCycles();
    await persistAll();
    renderCurrentScreen();
  }

  function releaseCompletedCycles() {
    const scopes = new Map();
    state.questions.filter((q) => q.status === "active" && bankById(q.bankId)?.status === "active").forEach((q) => {
      const key = `${q.bankId}|${q.unitId}`;
      if (!scopes.has(key)) scopes.set(key, []);
      scopes.get(key).push(q);
    });
    scopes.forEach((questions) => {
      if (!questions.length || !questions.every((q) => cycleFor(q.questionUid).currentCycleAttempted)) return;
      const next = Math.max(...questions.map((q) => cycleFor(q.questionUid).currentCycleNumber || 1)) + 1;
      questions.forEach((q) => {
        const cycle = cycleFor(q.questionUid);
        cycle.currentCycleNumber = next;
        cycle.currentCycleAttempted = false;
        cycle.held = false;
        cycle.releasedAt = nowIso();
        cycle.updatedAt = nowIso();
        state.cycles[q.questionUid] = cycle;
      });
    });
  }

  async function resetCycle(scope, id) {
    const questions = state.questions.filter((q) => q.status === "active" && (scope === "unit" ? q.unitId === id : scope === "section" ? q.sectionId === id : scope === "bank" ? q.bankId === id : true));
    const next = Math.max(1, ...questions.map((q) => cycleFor(q.questionUid).currentCycleNumber || 1)) + 1;
    questions.forEach((q) => { const c = cycleFor(q.questionUid); c.currentCycleNumber = next; c.currentCycleAttempted = false; c.held = false; c.releasedAt = nowIso(); c.updatedAt = nowIso(); state.cycles[q.questionUid] = c; });
    await persistAll(); renderCurrentScreen();
  }

  async function saveNote(questionUid, text, flags = {}) {
    const question = questionByUid(questionUid); if (!question) throw new Error("Question not found.");
    const previous = state.notes[questionUid];
    const note = {
      noteId: previous?.noteId || uid("note"), questionUid, bankId: question.bankId, noteText: String(text || ""),
      isConceptualTrap: Boolean(flags.isConceptualTrap), createdAt: previous?.createdAt || nowIso(), updatedAt: nowIso(),
      revisionHistory: previous ? [...(previous.revisionHistory || []), { noteText: previous.noteText, updatedAt: previous.updatedAt }].slice(-10) : []
    };
    state.notes[questionUid] = note;
    const aggregate = state.aggregates[questionUid] || defaultAggregate(question);
    aggregate.needsReview = note.isConceptualTrap;
    if (note.isConceptualTrap) aggregate.remediationStatus = "remediation_due";
    state.aggregates[questionUid] = aggregate;
    await persistAll();
    return note;
  }

  async function deleteNote(questionUid) {
    delete state.notes[questionUid];
    const aggregate = state.aggregates[questionUid]; if (aggregate) aggregate.needsReview = false;
    await persistAll(); renderCurrentScreen();
  }

  async function removeQuestion(questionUid, reason = "") {
    const q = questionByUid(questionUid); if (!q) return;
    q.status = "removed"; q.isRemoved = true; q.removedAt = nowIso(); q.removedReason = String(reason || ""); q.updatedAt = nowIso();
    await persistAll(); await syncLegacyQuestionPool(); renderCurrentScreen();
  }

  async function permanentlyDeleteQuestion(questionUid) {
    const q = questionByUid(questionUid); if (!q || q.status !== "removed") throw new Error("Only a removed question can be permanently deleted.");
    q.status = "deleted"; q.isRemoved = false; q.question = "[Permanently deleted question]"; q.options = { A: "", B: "", C: "", D: "" }; q.explanation = ""; q.removedReason = "Permanently deleted"; q.updatedAt = nowIso();
    delete state.notes[questionUid];
    await persistAll(); await syncLegacyQuestionPool(); renderCurrentScreen();
  }

  async function restoreQuestion(questionUid) {
    const q = questionByUid(questionUid); if (!q) return;
    q.status = "active"; q.isRemoved = false; q.removedAt = null; q.removedReason = ""; q.updatedAt = nowIso();
    await persistAll(); await syncLegacyQuestionPool(); renderCurrentScreen();
  }

  function weaknessScore(question) {
    const a = aggregateFor(question.questionUid);
    if (!a.lifetimeSolvedCount) return 50;
    const recentError = 100 - (a.recentAccuracy ?? (a.lifetimeCorrectCount / a.lifetimeSolvedCount * 100));
    if (state.settings.weaknessAccuracyOnly) return recentError;
    const timeDelay = Number.isFinite(a.averageActiveTimeSeconds) ? Math.min(100, Math.max(0, (a.averageActiveTimeSeconds / state.settings.targetSeconds - 1) * 100)) : 0;
    const recency = a.lastResultCorrect === false ? 100 : 0;
    const cycleIncomplete = cycleFor(question.questionUid).currentCycleAttempted ? 0 : 100;
    return recentError * 0.45 + timeDelay * 0.25 + recency * 0.20 + cycleIncomplete * 0.10;
  }

  function unitAnalytics() {
    const groups = new Map();
    state.questions.filter((q) => q.status === "active").forEach((q) => {
      const key = `${q.bankId}|${q.unitId}`;
      if (!groups.has(key)) groups.set(key, { bankId: q.bankId, sectionId: q.sectionId, unitId: q.unitId, questions: [], solved: 0, correct: 0, activeSeconds: 0, held: 0, remediation: 0, mastered: 0, cycleDone: 0 });
      const g = groups.get(key); const a = aggregateFor(q.questionUid); const c = cycleFor(q.questionUid);
      g.questions.push(q); g.solved += a.lifetimeSolvedCount; g.correct += a.lifetimeCorrectCount; g.activeSeconds += a.totalActiveTimeSeconds || 0;
      g.held += c.held ? 1 : 0; g.remediation += a.remediationStatus === "remediation_due" ? 1 : 0; g.mastered += a.masteryStatus === "mastered" ? 1 : 0; g.cycleDone += c.currentCycleAttempted ? 1 : 0;
    });
    return Array.from(groups.values()).map((g) => ({ ...g, accuracy: g.solved ? g.correct / g.solved * 100 : null, averageTime: g.solved ? g.activeSeconds / g.solved : null, coverage: g.questions.length ? g.cycleDone / g.questions.length * 100 : 0, weakness: g.questions.length ? g.questions.reduce((sum, q) => sum + weaknessScore(q), 0) / g.questions.length : 0 }));
  }

  async function updateSettings(values = {}) {
    state.settings = { ...state.settings, ...clone(values) };
    state.settings.masteryConsecutiveCorrect = Math.max(1, Number(state.settings.masteryConsecutiveCorrect) || 2);
    state.settings.masteryRecentAccuracy = Math.min(100, Math.max(0, Number(state.settings.masteryRecentAccuracy) || 70));
    state.settings.targetSeconds = Math.max(10, Number(state.settings.targetSeconds) || 90);
    await persistAll();
    renderV2Settings();
    return clone(state.settings);
  }

  function renderV2Settings() {
    if (typeof document === "undefined") return;
    const values = {
      "v2-allow-pause-exam": state.settings.allowPauseExam,
      "v2-allow-notes-exam": state.settings.allowNotesExam,
      "v2-hidden-study-pause": state.settings.hiddenTabStudyPause,
      "v2-hidden-exam-pause": state.settings.hiddenTabExamPause,
      "v2-mastery-correct": state.settings.masteryConsecutiveCorrect,
      "v2-mastery-accuracy": state.settings.masteryRecentAccuracy,
      "v2-focus-preset": (state.settings.focusPreset || []).join("\n")
    };
    Object.entries(values).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (!node) return;
      if (node.type === "checkbox") node.checked = Boolean(value);
      else node.value = value;
    });
  }

  async function saveV2SettingsFromUi() {
    await updateSettings({
      allowPauseExam: document.getElementById("v2-allow-pause-exam")?.checked !== false,
      allowNotesExam: document.getElementById("v2-allow-notes-exam")?.checked !== false,
      hiddenTabStudyPause: document.getElementById("v2-hidden-study-pause")?.checked !== false,
      hiddenTabExamPause: Boolean(document.getElementById("v2-hidden-exam-pause")?.checked),
      masteryConsecutiveCorrect: Number(document.getElementById("v2-mastery-correct")?.value) || 2,
      masteryRecentAccuracy: Number(document.getElementById("v2-mastery-accuracy")?.value) || 70,
      focusPreset: String(document.getElementById("v2-focus-preset")?.value || "").split(/\n+/).map((x) => x.trim()).filter(Boolean)
    });
  }

  function exportData() {
    return {
      type: "cma-simulator-v2-backup", version: VERSION, exportedAt: nowIso(),
      banks: clone(state.banks), questions: clone(state.questions), attempts: clone(state.attempts), aggregates: clone(Object.values(state.aggregates)), cycles: clone(Object.values(state.cycles)), notes: clone(Object.values(state.notes)), batches: clone(state.batches), settings: clone(state.settings), migrationReport: clone(state.lastMigrationReport)
    };
  }

  async function restoreData(data, mode = "replace") {
    if (!data || data.type !== "cma-simulator-v2-backup" || !Array.isArray(data.banks) || !Array.isArray(data.questions)) throw new Error("This is not a valid CMA V2 backup.");
    if (mode === "replace") {
      state.banks = clone(data.banks); state.questions = clone(data.questions); state.attempts = clone(data.attempts || []);
      state.aggregates = Object.fromEntries((data.aggregates || []).map((x) => [x.questionUid, x])); state.cycles = Object.fromEntries((data.cycles || []).map((x) => [x.questionUid, x])); state.notes = Object.fromEntries((data.notes || []).map((x) => [x.questionUid, x])); state.batches = clone(data.batches || []); state.settings = { ...state.settings, ...(data.settings || {}) };
    } else {
      const bankIds = new Set(state.banks.map((b) => b.bankId)); (data.banks || []).forEach((b) => { if (!bankIds.has(b.bankId)) state.banks.push(clone(b)); });
      const qids = new Set(state.questions.map((q) => q.questionUid)); (data.questions || []).forEach((q) => { if (!qids.has(q.questionUid)) state.questions.push(clone(q)); });
      const aids = new Set(state.attempts.map((a) => a.attemptId)); (data.attempts || []).forEach((a) => { if (!aids.has(a.attemptId)) state.attempts.push(clone(a)); });
      (data.aggregates || []).forEach((a) => { if (!state.aggregates[a.questionUid]) state.aggregates[a.questionUid] = clone(a); });
      (data.cycles || []).forEach((c) => { if (!state.cycles[c.questionUid]) state.cycles[c.questionUid] = clone(c); });
      (data.notes || []).forEach((n) => { if (!state.notes[n.questionUid]) state.notes[n.questionUid] = clone(n); });
      const bids = new Set(state.batches.map((b) => b.batchId)); (data.batches || []).forEach((b) => { if (!bids.has(b.batchId)) state.batches.push(clone(b)); });
    }
    ensureDefaultBanks(); ensureQuestionRelationships(); await persistAll(); await syncLegacyQuestionPool(); renderCurrentScreen();
  }

  function downloadJson(filename, data) {
    if (globalThis.AndroidFileBridge?.saveTextFile) { globalThis.AndroidFileBridge.saveTextFile(filename, "application/json", JSON.stringify(data, null, 2)); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function el(tag, className = "", text = "") { const node = document.createElement(tag); if (className) node.className = className; if (text !== "") node.textContent = String(text); return node; }
  function append(parent, tag, className, text) { const node = el(tag, className, text); parent.append(node); return node; }
  function showBox(node, text, type = "info") { if (!node) return; node.hidden = false; node.className = `message message-${type}`; node.textContent = text; }
  function fmt(value, suffix = "") { return Number.isFinite(value) ? `${value.toFixed(1)}${suffix}` : "—"; }

  function installUi() {
    if (document.getElementById("v2-banks-screen")) return;
    injectNavigation();
    injectScreens();
    injectDashboardPanel();
    injectExamTools();
    bindUi();
    renderBanksScreen();
    renderBuilderScreen();
    renderQueuesScreen();
    renderGrowthScreen();
  }

  function injectNavigation() {
    const nav = document.querySelector(".app-nav"); if (!nav) return;
    const bankButton = document.getElementById("nav-bank"); if (bankButton) bankButton.querySelector("span:last-child").textContent = "Question Banks";
    const build = el("button"); build.id = "nav-v2-builder"; build.type = "button"; build.append(el("span", "nav-glyph", "⊞"), el("span", "", "Build Test"));
    const growth = el("button"); growth.id = "nav-v2-growth"; growth.type = "button"; growth.append(el("span", "nav-glyph", "↗"), el("span", "", "Growth"));
    bankButton?.after(build, growth);
  }

  function injectDashboardPanel() {
    if (document.getElementById("v2-home-panel")) return;
    const home = document.getElementById("home-screen");
    const anchor = document.getElementById("resume-banner");
    if (!home) return;
    const panel = el("section", "panel compact-panel"); panel.id = "v2-home-panel";
    panel.innerHTML = `<div class="compact-section-heading"><h2>V2 Study System</h2><button class="text-button" id="v2-home-build" type="button">Build exact test</button></div><div id="v2-home-stats" class="mini-stat-grid"></div><div class="button-row"><button class="button button-primary" id="v2-home-quick" type="button">Quick 15-question drill</button><button class="button button-secondary" id="v2-home-banks" type="button">Question Banks</button><button class="button button-secondary" id="v2-home-remediation" type="button">Needs Remediation</button></div>`;
    if (anchor?.parentNode) anchor.after(panel); else home.prepend(panel);
    renderV2Dashboard();
  }

  function renderV2Dashboard() {
    const grid = document.getElementById("v2-home-stats"); if (!grid) return;
    const active = state.questions.filter((q) => q.status === "active" && bankById(q.bankId)?.status === "active");
    const values = [
      ["Active banks", activeBanks().length],
      ["Unseen this cycle", active.filter((q) => !cycleFor(q.questionUid).currentCycleAttempted).length],
      ["Held", active.filter((q) => cycleFor(q.questionUid).held).length],
      ["Remediation", active.filter((q) => aggregateFor(q.questionUid).remediationStatus === "remediation_due").length],
      ["Mastered", active.filter((q) => aggregateFor(q.questionUid).masteryStatus === "mastered").length]
    ];
    grid.replaceChildren(); values.forEach(([label, value]) => { const d = el("div"); append(d,"span","",label); append(d,"strong","",value); grid.append(d); });
  }

  function injectScreens() {
    const main = document.getElementById("main-content"); if (!main) return;
    const banks = el("section", "screen v2-screen"); banks.id = "v2-banks-screen"; banks.hidden = true; banks.setAttribute("aria-labelledby", "v2-banks-title");
    banks.innerHTML = `<div class="page-heading"><div><button class="back-button" data-v2-home type="button">← Dashboard</button><span class="eyebrow">Multi-bank study library</span><h1 id="v2-banks-title">Question Banks</h1><p>Keep each source independent while using one CMA section and unit catalog.</p></div><div class="button-row"><button class="button button-primary" id="v2-create-bank" type="button">Create bank</button><button class="button button-secondary" id="v2-open-import" type="button">Import questions</button></div></div><div id="v2-migration-report" class="message message-success" hidden></div><div id="v2-bank-summary" class="bank-stat-grid"></div><div id="v2-bank-list" class="v2-bank-grid"></div><section class="panel" id="v2-import-panel" hidden><div class="section-heading"><div><span class="eyebrow">Validated destination import</span><h2>Import JSON questions</h2></div><button class="button button-quiet" id="v2-close-import" type="button">Close</button></div><div class="settings-grid"><label>Destination bank<select id="v2-import-bank"></select></label><label>Question file<input id="v2-import-file" type="file" accept=".json,application/json"></label><label>Same-bank ID conflicts<select id="v2-import-conflict"><option value="skip">Skip incoming</option><option value="replace">Replace content; preserve history</option><option value="new">Import as new ID</option></select></label></div><div id="v2-import-summary" class="message" hidden></div><div class="button-row"><button class="button button-primary" id="v2-commit-import" type="button" disabled>Confirm import</button><button class="button button-secondary" id="v2-create-bank-import" type="button">Create bank here</button></div></section><section class="panel"><div class="section-heading"><div><span class="eyebrow">Queues and recovery</span><h2>Review special question lists</h2></div></div><div class="button-row"><button class="button button-secondary" data-v2-queue="held" type="button">Solved Twice / Held</button><button class="button button-secondary" data-v2-queue="remediation" type="button">Needs Remediation</button><button class="button button-secondary" data-v2-queue="removed" type="button">Removed Questions</button><button class="button button-secondary" data-v2-queue="notes" type="button">Question Notes</button><button class="button button-quiet" id="v2-open-legacy-bank" type="button">Open compatibility bank tools</button></div></section>`;

    const builder = el("section", "screen v2-screen"); builder.id = "v2-builder-screen"; builder.hidden = true;
    builder.innerHTML = `<div class="page-heading"><div><button class="back-button" data-v2-home type="button">← Dashboard</button><span class="eyebrow">Exact test construction</span><h1>Build Test</h1><p>Select banks, sections, units, repeat behavior, and exact quantities.</p></div><div class="availability-chip"><strong id="v2-live-eligible">0</strong> eligible</div></div><div class="v2-builder-layout"><div><section class="panel"><div class="section-heading"><div><span class="eyebrow">Step 1</span><h2>Preset and timing</h2></div></div><div class="settings-grid"><label>Preset<select id="v2-preset"><option value="quick">Quick Drill</option><option value="unit">Unit Mastery Drill</option><option value="weak">Weak-Area Drill</option><option value="incorrect">Incorrect Questions Review</option><option value="official">Official CMA Part 2 MCQ Mock</option><option value="personal">Personal Custom 100-Question Mix</option><option value="custom">Custom Test</option></select></label><label>Total questions<input id="v2-total" type="number" min="1" value="15"></label><label>Minutes<input id="v2-minutes" type="number" min="1" step="0.5" value="22.5"></label><label>Repeat behavior<select id="v2-repeat-mode"><option value="normal">No repeat until coverage</option><option value="include-solved-once">Include solved-once</option><option value="include-held">Include held questions</option><option value="override-all">Include all active questions</option><option value="remediation">Only remediation-due</option><option value="held-only">Only held questions</option></select></label><label class="consent-row"><input id="v2-shuffle-options" type="checkbox" checked> Randomize answer order</label></div></section><section class="panel"><div class="section-heading"><div><span class="eyebrow">Step 2</span><h2>Question-bank source</h2></div></div><div id="v2-builder-banks" class="v2-check-grid"></div><fieldset class="v2-inline-fieldset"><legend>Bank distribution</legend><label><input type="radio" name="v2-bank-distribution" value="automatic" checked> Automatic</label><label><input type="radio" name="v2-bank-distribution" value="equal"> Equal</label><label><input type="radio" name="v2-bank-distribution" value="custom"> Custom</label></fieldset></section><section class="panel"><div class="section-heading"><div><span class="eyebrow">Step 3</span><h2>Section quantities</h2></div></div><div id="v2-section-quotas" class="v2-quota-grid"></div><details><summary>Optional exact unit quantities</summary><p class="demo-note">When any unit quantity is entered, unit totals replace section allocation and must equal the total test size.</p><div id="v2-unit-quotas" class="v2-unit-quota-list"></div></details></section></div><aside><section class="panel sticky-summary"><span class="eyebrow">Feasibility review</span><h2>Test summary</h2><div id="v2-builder-summary"></div><div id="v2-builder-message" class="message" hidden></div><button class="button button-primary button-full" id="v2-start-test" type="button">Start test</button></section></aside></div>`;

    const queues = el("section", "screen v2-screen"); queues.id = "v2-queues-screen"; queues.hidden = true;
    queues.innerHTML = `<div class="page-heading"><div><button class="back-button" id="v2-queues-back" type="button">← Question Banks</button><span class="eyebrow">Review and recovery</span><h1 id="v2-queues-title">Special Questions</h1><p id="v2-queues-description"></p></div></div><div class="filter-controls"><label>Bank<select id="v2-queue-bank"><option value="all">All banks</option></select></label><label>Section<select id="v2-queue-section"><option value="all">All sections</option></select></label><label>Unit<select id="v2-queue-unit"><option value="all">All units</option></select></label></div><div id="v2-queue-list" class="v2-question-list"></div>`;

    const growth = el("section", "screen v2-screen"); growth.id = "v2-growth-screen"; growth.hidden = true;
    growth.innerHTML = `<div class="page-heading"><div><button class="back-button" data-v2-home type="button">← Dashboard</button><span class="eyebrow">Evidence over time</span><h1>Growth and Progress</h1><p>Accuracy, active solving speed, coverage, held questions, and remediation remain visible separately.</p></div></div><section class="panel"><div class="filter-controls"><label>Bank<select id="v2-growth-bank"><option value="all">All banks</option></select></label><label>Section<select id="v2-growth-section"><option value="all">All sections</option></select></label><label>Unit<select id="v2-growth-unit"><option value="all">All units</option></select></label><label>Mode<select id="v2-growth-mode"><option value="all">All modes</option><option value="exam">Exam</option><option value="practice">Practice</option><option value="remediation">Remediation</option></select></label><label>From<input id="v2-growth-start" type="date"></label><label>To<input id="v2-growth-end" type="date"></label><label>Recent batches<select id="v2-growth-limit"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="all">All</option></select></label></div></section><div class="dashboard-two-column"><figure class="panel trend-chart"><figcaption><strong>Accuracy Growth</strong><span>Correct ÷ answered</span></figcaption><div id="v2-accuracy-chart" class="chart-canvas"></div><p id="v2-accuracy-summary"></p></figure><figure class="panel trend-chart"><figcaption><strong>Speed Growth</strong><span>Active seconds per answered question</span></figcaption><div id="v2-speed-chart" class="chart-canvas"></div><p id="v2-speed-summary"></p></figure></div><section class="panel"><div class="section-heading"><div><span class="eyebrow">Actionable scope</span><h2>Unit strength and coverage</h2></div></div><div id="v2-unit-analytics" class="table-scroll"></div></section>`;

    const settings = document.getElementById("settings-screen"); main.insertBefore(banks, settings || null); main.insertBefore(builder, settings || null); main.insertBefore(queues, settings || null); main.insertBefore(growth, settings || null);
  }

  function injectExamTools() {
    const tools = document.querySelector(".exam-control-group.question-tools"); if (!tools || document.getElementById("v2-pause-test")) return;
    const pause = el("button", "button button-secondary", "Pause Test"); pause.id = "v2-pause-test"; pause.type = "button";
    const note = el("button", "button button-quiet", "Note"); note.id = "v2-note-question"; note.type = "button";
    const remove = el("button", "button button-danger-quiet", "Remove Question"); remove.id = "v2-remove-question"; remove.type = "button";
    tools.prepend(pause, note); tools.append(remove);
    const overlay = el("div", "v2-pause-overlay"); overlay.id = "v2-pause-overlay"; overlay.hidden = true; overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.innerHTML = `<div class="panel"><span class="eyebrow">Active session protected</span><h2>Test Paused</h2><p>Your answers and progress are saved. Paused time is excluded from response-time statistics.</p><button class="button button-primary" id="v2-resume-test" type="button">Resume Test</button></div>`; document.body.append(overlay);
    const dialog = el("dialog", "modal"); dialog.id = "v2-note-dialog"; dialog.innerHTML = `<form method="dialog" class="modal-card"><span class="eyebrow">Question note</span><h2>My Note</h2><p>Timer paused while writing your note.</p><textarea id="v2-note-text" rows="8" spellcheck="true"></textarea><label class="consent-row"><input id="v2-note-trap" type="checkbox"> Mark as conceptual trap / needs review</label><div class="button-row modal-actions"><button class="button button-danger-quiet" id="v2-delete-note" type="button">Delete</button><button class="button button-secondary" id="v2-cancel-note" type="button">Cancel</button><button class="button button-primary" id="v2-save-note" type="button">Save note</button></div></form>`; document.body.append(dialog);
  }

  function bindUi() {
    const captureOpen = (id, screen) => document.getElementById(id)?.addEventListener("click", (event) => { event.preventDefault(); event.stopImmediatePropagation(); openV2Screen(screen); }, true);
    captureOpen("nav-bank", "banks"); captureOpen("nav-v2-builder", "builder"); captureOpen("nav-v2-growth", "growth");
    ["home-open-bank", "home-import", "empty-manage-bank", "v2-home-banks"].forEach((id) => captureOpen(id, "banks"));
    captureOpen("v2-home-build", "builder");
    document.getElementById("v2-home-quick")?.addEventListener("click", () => { openV2Screen("builder"); document.getElementById("v2-preset").value = "quick"; applyPresetToBuilder(); });
    document.getElementById("v2-home-remediation")?.addEventListener("click", () => openQueue("remediation"));
    document.querySelectorAll("[data-v2-home]").forEach((button) => button.addEventListener("click", () => state.hooks?.openScreen?.("home")));
    document.getElementById("v2-create-bank")?.addEventListener("click", async () => { const name = prompt("New question-bank name:"); if (!name) return; try { createBank(name); await persistAll(); renderBanksScreen(); } catch (error) { alert(error.message); } });
    document.getElementById("v2-open-import")?.addEventListener("click", () => { document.getElementById("v2-import-panel").hidden = false; renderImportBanks(); });
    document.getElementById("v2-close-import")?.addEventListener("click", () => { document.getElementById("v2-import-panel").hidden = true; });
    document.getElementById("v2-create-bank-import")?.addEventListener("click", async () => { const name = prompt("New destination bank name:"); if (!name) return; try { const bank = createBank(name); await persistAll(); renderImportBanks(); document.getElementById("v2-import-bank").value = bank.bankId; } catch (e) { alert(e.message); } });
    document.getElementById("v2-import-file")?.addEventListener("change", handleImportFile);
    document.getElementById("v2-import-bank")?.addEventListener("change", () => { state.importPreview = null; document.getElementById("v2-import-summary").hidden = true; document.getElementById("v2-commit-import").disabled = true; document.getElementById("v2-import-file").value = ""; });
    document.getElementById("v2-commit-import")?.addEventListener("click", async () => { try { const result = await commitImport(state.importPreview, document.getElementById("v2-import-conflict").value); showBox(document.getElementById("v2-import-summary"), `Import complete: ${result.added} added, ${result.replaced} replaced, ${result.skipped} skipped, ${result.invalid} invalid.`, "success"); document.getElementById("v2-commit-import").disabled = true; } catch (e) { showBox(document.getElementById("v2-import-summary"), e.message, "error"); } });
    document.getElementById("v2-bank-list")?.addEventListener("click", handleBankAction);
    document.querySelectorAll("[data-v2-queue]").forEach((b) => b.addEventListener("click", () => openQueue(b.dataset.v2Queue)));
    document.getElementById("v2-open-legacy-bank")?.addEventListener("click", () => state.hooks?.openScreen?.("bank"));
    document.getElementById("v2-queues-back")?.addEventListener("click", () => openV2Screen("banks"));
    ["v2-queue-bank", "v2-queue-section", "v2-queue-unit"].forEach((id) => document.getElementById(id)?.addEventListener("change", renderQueuesScreen));
    document.getElementById("v2-queue-list")?.addEventListener("click", handleQueueAction);
    document.getElementById("v2-preset")?.addEventListener("change", applyPresetToBuilder);
    document.getElementById("v2-builder-screen")?.addEventListener("input", renderBuilderSummary);
    document.getElementById("v2-builder-screen")?.addEventListener("change", renderBuilderSummary);
    document.getElementById("v2-start-test")?.addEventListener("click", startBuiltTest);
    ["v2-growth-bank", "v2-growth-section", "v2-growth-unit", "v2-growth-mode", "v2-growth-start", "v2-growth-end", "v2-growth-limit"].forEach((id) => document.getElementById(id)?.addEventListener("change", renderGrowthScreen));
    document.getElementById("v2-pause-test")?.addEventListener("click", () => { if (!state.settings.allowPauseExam) return; state.hooks?.pauseActiveExam?.("manualPause"); document.getElementById("v2-pause-overlay").hidden = false; document.getElementById("v2-resume-test")?.focus(); });
    document.getElementById("v2-resume-test")?.addEventListener("click", () => { state.hooks?.resumeActiveExam?.("manualPause"); document.getElementById("v2-pause-overlay").hidden = true; });
    document.getElementById("v2-note-question")?.addEventListener("click", openCurrentNote);
    document.getElementById("v2-save-note")?.addEventListener("click", saveCurrentNote);
    document.getElementById("v2-cancel-note")?.addEventListener("click", closeCurrentNote);
    document.getElementById("v2-delete-note")?.addEventListener("click", async () => { const q = state.hooks?.getCurrentQuestion?.(); if (!q) return; await deleteNote(q.questionUid || q.id); closeCurrentNote(); });
    document.getElementById("v2-remove-question")?.addEventListener("click", removeCurrentQuestion);
    document.getElementById("save-settings")?.addEventListener("click", () => { saveV2SettingsFromUi().catch((error) => console.warn("CMA V2 settings could not be saved.", error)); });
    document.getElementById("nav-settings")?.addEventListener("click", renderV2Settings);
    document.getElementById("header-settings")?.addEventListener("click", renderV2Settings);
    renderV2Settings();
    document.addEventListener("visibilitychange", () => {
      const exam = state.hooks?.getActiveExam?.(); if (!exam || exam.submitted) return;
      const shouldPause = exam.settings?.mode === "exam" ? state.settings.hiddenTabExamPause : state.settings.hiddenTabStudyPause;
      if (!shouldPause) return;
      if (document.hidden) state.hooks?.pauseActiveExam?.("hiddenTab"); else state.hooks?.resumeActiveExam?.("hiddenTab");
    });
  }

  function openV2Screen(screen) {
    state.currentScreen = screen;
    document.querySelectorAll(".screen").forEach((node) => { node.hidden = node.id !== `v2-${screen}-screen`; });
    document.querySelectorAll(".app-nav button").forEach((button) => button.removeAttribute("aria-current"));
    const navId = screen === "banks" ? "nav-bank" : screen === "builder" ? "nav-v2-builder" : screen === "growth" ? "nav-v2-growth" : "nav-bank";
    document.getElementById(navId)?.setAttribute("aria-current", "page");
    renderCurrentScreen(); document.getElementById(`v2-${screen}-screen`)?.focus?.();
  }

  function renderCurrentScreen() {
    if (typeof document === "undefined") return;
    if (state.currentScreen === "banks") renderBanksScreen();
    if (state.currentScreen === "builder") renderBuilderScreen();
    if (state.currentScreen === "queues") renderQueuesScreen();
    if (state.currentScreen === "growth") renderGrowthScreen();
  }

  function renderBanksScreen() {
    const summary = document.getElementById("v2-bank-summary"); const list = document.getElementById("v2-bank-list"); if (!summary || !list) return;
    summary.replaceChildren(); const allActive = state.questions.filter((q) => q.status === "active" && bankById(q.bankId)?.status === "active");
    [["Active banks", activeBanks().length], ["Active questions", allActive.length], ["Current-cycle unseen", allActive.filter((q) => !cycleFor(q.questionUid).currentCycleAttempted).length], ["Held", allActive.filter((q) => cycleFor(q.questionUid).held).length], ["Needs remediation", allActive.filter((q) => aggregateFor(q.questionUid).remediationStatus === "remediation_due").length], ["Mastered", allActive.filter((q) => aggregateFor(q.questionUid).masteryStatus === "mastered").length]].forEach(([label, value]) => { const card = el("article", "bank-stat"); append(card, "span", "", label); append(card, "strong", "", value); summary.append(card); });
    list.replaceChildren(); state.banks.filter((bank) => bank.status !== "deleted").forEach((bank) => {
      const s = bankStats(bank.bankId); const card = el("article", "panel v2-bank-card"); const heading = el("div", "section-heading"); const h = el("div"); append(h, "span", "eyebrow", bank.status); append(h, "h2", "", bank.bankName); append(h, "p", "demo-note", bank.description || "No description"); heading.append(h); const badge = append(heading, "span", "availability-chip", `${s.active} active`); card.append(heading);
      const grid = el("div", "mini-stat-grid"); [["Attempted", s.attempted], ["Unattempted", s.unattempted], ["Held", s.held], ["Remediation", s.remediation], ["Accuracy", fmt(s.accuracy, "%")], ["Avg time", Number.isFinite(s.averageTime) ? `${s.averageTime.toFixed(1)} sec` : "—"], ["Cycle", `${s.cycleCompleted.toFixed(0)}%`], ["Removed", s.removed]].forEach(([label, value]) => { const d = el("div"); append(d, "span", "", label); append(d, "strong", "", value); grid.append(d); }); card.append(grid);
      const actions = el("div", "button-row");
      const actionList = bank.status === "trashed"
        ? [["restore", "Restore bank", "button button-primary"], ["delete-permanent", "Delete permanently", "button button-danger-quiet"]]
        : [["open", "Open questions", "button button-primary"], ["rename", "Rename", "button button-quiet"], ["description", "Description", "button button-quiet"], ["duplicate", "Duplicate", "button button-secondary"], ["merge", "Merge", "button button-secondary"], [bank.status === "archived" ? "unarchive" : "archive", bank.status === "archived" ? "Unarchive" : "Archive", "button button-secondary"], ["export", "Export", "button button-secondary"], ["trash", "Move to Trash", "button button-danger-quiet"]];
      actionList.forEach(([action, label, cls]) => { const b = el("button", cls, label); b.type = "button"; b.dataset.bankAction = action; b.dataset.bankId = bank.bankId; actions.append(b); }); card.append(actions); list.append(card);
    });
    renderImportBanks();
    const report = document.getElementById("v2-migration-report"); if (report && state.lastMigrationReport) { report.hidden = false; report.textContent = `V2 migration preserved ${state.lastMigrationReport.questionsMigrated} questions, ${state.lastMigrationReport.historyRecordsPreserved} history records, and ${state.lastMigrationReport.attemptsReconstructed} submitted attempts. Recovery snapshot created.`; }
  }

  function renderImportBanks() {
    const select = document.getElementById("v2-import-bank"); if (!select) return; const value = select.value; select.replaceChildren(); activeBanks().forEach((bank) => { const o = el("option", "", bank.bankName); o.value = bank.bankId; select.append(o); }); if (activeBanks().some((b) => b.bankId === value)) select.value = value;
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0]; if (!file) return; const box = document.getElementById("v2-import-summary");
    try { const parsed = JSON.parse(await file.text()); const bankId = document.getElementById("v2-import-bank").value; state.importPreview = prepareImport(parsed, bankId, file.name); const p = state.importPreview; showBox(box, `${p.fileName}: ${p.validCount}/${p.total} valid. Invalid: ${p.invalidCount}. Same-bank ID conflicts: ${p.duplicateIds.length}. Same-bank exact text duplicates: ${p.duplicateText.length}. Similar content in other banks: ${p.crossBankDuplicates.length}. Missing explanations: ${p.missingExplanation}.`, p.invalidCount ? "warning" : "success"); document.getElementById("v2-commit-import").disabled = !p.validCount; }
    catch (e) { state.importPreview = null; showBox(box, `Import preview failed: ${e.message}`, "error"); document.getElementById("v2-commit-import").disabled = true; }
  }

  async function handleBankAction(event) {
    const button = event.target.closest("[data-bank-action]"); if (!button) return; const bank = bankById(button.dataset.bankId); if (!bank) return;
    try {
      if (button.dataset.bankAction === "open") { state.queueBankId = bank.bankId; openQueue("bank"); }
      if (button.dataset.bankAction === "rename") { const name = prompt("Rename question bank:", bank.bankName); if (name) await renameBank(bank.bankId, name); }
      if (button.dataset.bankAction === "description") { const description = prompt("Question-bank description:", bank.description || ""); if (description !== null) { bank.description = description.trim(); bank.updatedAt = nowIso(); await persistAll(); renderBanksScreen(); } }
      if (button.dataset.bankAction === "duplicate") { const name = prompt("Name for the duplicated bank:", `${bank.bankName} Copy`); if (name) await duplicateBank(bank.bankId, name); }
      if (button.dataset.bankAction === "merge") { const choices = activeBanks().filter((b) => b.bankId !== bank.bankId).map((b) => `${b.bankId}: ${b.bankName}`).join("\n"); const target = prompt(`Enter destination bankId. Available:\n${choices}`); if (target && confirm(`Merge ${bank.bankName} into ${bankById(target)?.bankName || target}? Source IDs that conflict will receive a safe suffix.`)) await mergeBanks(bank.bankId, target.trim()); }
      if (button.dataset.bankAction === "archive") await archiveBank(bank.bankId, true);
      if (button.dataset.bankAction === "unarchive") await archiveBank(bank.bankId, false);
      if (button.dataset.bankAction === "export") downloadJson(`${bank.bankName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0,10)}.json`, { title: bank.bankName, bank: clone(bank), questions: state.questions.filter((q) => q.bankId === bank.bankId).map((q) => ({ ...q, id: q.sourceQuestionId })) });
      if (button.dataset.bankAction === "trash") { const s = bankStats(bank.bankId); if (confirm(`This bank contains ${s.active} active questions and ${s.attempted} attempted questions. Move it and its active questions to Trash? History will be preserved.`)) await trashBank(bank.bankId); }
      if (button.dataset.bankAction === "restore") await restoreBank(bank.bankId);
      if (button.dataset.bankAction === "delete-permanent") { if (confirm(`Permanent deletion removes the bank's question content while retaining a tombstone for historical attempts. Continue?`) && confirm(`Second confirmation: permanently delete ${bank.bankName}?`)) await permanentlyDeleteBank(bank.bankId); }
    } catch (e) { alert(e.message); }
  }

  function renderBuilderScreen() {
    const banks = document.getElementById("v2-builder-banks"); const sections = document.getElementById("v2-section-quotas"); const units = document.getElementById("v2-unit-quotas"); if (!banks || !sections || !units) return;
    const selected = new Set(Array.from(document.querySelectorAll("[data-v2-bank]:checked")).map((x) => x.value)); banks.replaceChildren(); activeBanks().forEach((bank, i) => { const s = bankStats(bank.bankId); const label = el("label", "check-card"); const input = el("input"); input.type = "checkbox"; input.value = bank.bankId; input.dataset.v2Bank = "1"; input.checked = selected.size ? selected.has(bank.bankId) : i === 0; const span = el("span"); append(span, "strong", "", bank.bankName); append(span, "small", "", `${s.active} active · ${s.unattempted} unattempted`); const quota = el("input"); quota.type = "number"; quota.min = "0"; quota.value = "0"; quota.dataset.v2BankQuota = bank.bankId; quota.setAttribute("aria-label", `${bank.bankName} custom question quantity`); label.append(input, span, quota); banks.append(label); });
    sections.replaceChildren(); SECTION_IDS.forEach((id) => { const row = el("label", "v2-quota-row"); append(row, "span", "", `${id} — ${SECTION_NAMES[id]}`); const available = state.questions.filter((q) => q.sectionId === id && q.status === "active").length; append(row, "small", "", `${available} active`); const input = el("input"); input.id = `v2-section-${id}`; input.type = "number"; input.min = "0"; input.value = "0"; input.inputMode = "numeric"; row.append(input); sections.append(row); });
    units.replaceChildren(); const unitIds = Array.from(new Set(state.questions.filter((q) => q.status === "active").map((q) => q.unitId))).sort(); unitIds.forEach((id) => { const row = el("label", "v2-quota-row"); append(row, "span", "", `${id} — ${catalogUnitName(id)}`); const input = el("input"); input.type = "number"; input.min = "0"; input.value = "0"; input.dataset.v2UnitQuota = id; row.append(input); units.append(row); });
    applyPresetToBuilder();
  }

  function applyPresetToBuilder() {
    const preset = PRESETS[document.getElementById("v2-preset")?.value] || PRESETS.custom;
    document.getElementById("v2-total").value = preset.total; document.getElementById("v2-minutes").value = preset.minutes; document.getElementById("v2-repeat-mode").value = preset.repeatMode;
    SECTION_IDS.forEach((id) => { const input = document.getElementById(`v2-section-${id}`); if (input) input.value = preset.sections?.[id] || 0; });
    if (!preset.sections) { const first = SECTION_IDS.find((id) => state.questions.some((q) => q.sectionId === id && q.status === "active")); if (first) document.getElementById(`v2-section-${first}`).value = preset.total; }
    document.querySelectorAll("[data-v2-unit-quota]").forEach((input) => { input.value = 0; }); renderBuilderSummary();
  }

  function renderBuilderSummary() {
    const summary = document.getElementById("v2-builder-summary"); if (!summary) return; const config = buildConfigFromUi(); const pool = eligibleQuestions(config); const allocation = allocateExact(pool, config); document.getElementById("v2-live-eligible").textContent = pool.length;
    summary.replaceChildren(); const list = el("dl", "summary-list"); const bankNames = config.bankIds.map((id) => bankById(id)?.bankName || id).join(", ") || "None"; [["Banks", bankNames], ["Total", config.total], ["Timer", `${config.minutes} minutes`], ["Repeat", config.repeatMode], ["Eligible pool", pool.length], ["Feasible", allocation.valid ? "Yes" : "No"]].forEach(([k, v]) => { const d = el("div"); append(d, "dt", "", k); append(d, "dd", "", v); list.append(d); }); summary.append(list); const sections = Object.entries(config.sectionQuotas).filter(([, n]) => n > 0).map(([id, n]) => `${id}: ${n}`).join(" · "); append(summary, "p", "demo-note", sections || "No section quantities selected."); const message = document.getElementById("v2-builder-message"); if (allocation.valid) { message.hidden = true; document.getElementById("v2-start-test").disabled = false; } else { showBox(message, allocation.errors.join(" "), "warning"); document.getElementById("v2-start-test").disabled = true; }
  }

  function openQueue(type) { state.queueType = type; openV2Screen("queues"); }

  function renderQueuesScreen() {
    const list = document.getElementById("v2-queue-list"); if (!list) return; const type = state.queueType || "held"; const title = { held: "Solved Twice / Held Questions", remediation: "Needs Remediation", removed: "Removed Questions", notes: "Question Notes", bank: `${bankById(state.queueBankId)?.bankName || "Question Bank"} Questions` }[type]; document.getElementById("v2-queues-title").textContent = title; document.getElementById("v2-queues-description").textContent = type === "bank" ? "Browse this bank, edit notes, move questions to another bank, or remove them safely." : type === "notes" ? "Review every saved question note, including conceptual traps and needs-review markers." : type === "held" ? "Held questions are excluded from normal automatic pools until their bank-unit cycle releases them. Held does not automatically mean mastered." : type === "remediation" ? "Incorrect answers and conceptual traps remain available for targeted relearning even when normal repeat protection would hold them." : "Removed questions remain recoverable with notes and history preserved.";
    renderQueueFilters(); const bank = document.getElementById("v2-queue-bank").value; const section = document.getElementById("v2-queue-section").value; const unit = document.getElementById("v2-queue-unit").value;
    let questions = state.questions.filter((q) => type === "bank" ? q.bankId === state.queueBankId && q.status === "active" : type === "notes" ? q.status !== "deleted" && Boolean(state.notes[q.questionUid]) : type === "held" ? q.status === "active" && cycleFor(q.questionUid).held : type === "remediation" ? q.status === "active" && aggregateFor(q.questionUid).remediationStatus === "remediation_due" : q.status === "removed");
    questions = questions.filter((q) => (bank === "all" || q.bankId === bank) && (section === "all" || q.sectionId === section) && (unit === "all" || q.unitId === unit));
    list.replaceChildren(); if (!questions.length) { append(list, "p", "muted-empty", "No questions match this list and filter."); return; }
    questions.sort((a, b) => `${a.bankId}${a.unitId}${a.sourceQuestionId}`.localeCompare(`${b.bankId}${b.unitId}${b.sourceQuestionId}`, undefined, { numeric: true })).forEach((q) => { const a = aggregateFor(q.questionUid); const c = cycleFor(q.questionUid); const card = el("article", "panel v2-question-card"); const heading = el("div", "section-heading"); const h = el("div"); append(h, "span", "eyebrow", `${bankById(q.bankId)?.bankName || q.bankId} · ${q.unitId}`); append(h, "h2", "", q.sourceQuestionId); heading.append(h); card.append(heading); append(card, "p", "", q.question); const stats = el("div", "mini-stat-grid"); [["Attempts", a.lifetimeSolvedCount], ["Accuracy", a.lifetimeSolvedCount ? `${(a.lifetimeCorrectCount / a.lifetimeSolvedCount * 100).toFixed(1)}%` : "—"], ["Avg time", Number.isFinite(a.averageActiveTimeSeconds) ? `${a.averageActiveTimeSeconds.toFixed(1)} sec` : "—"], ["Mastery", a.masteryStatus], ["Cycle", c.currentCycleNumber], ["Note", state.notes[q.questionUid] ? "Yes" : "No"]].forEach(([k,v]) => { const d=el("div"); append(d,"span","",k); append(d,"strong","",v); stats.append(d); }); card.append(stats); if (state.notes[q.questionUid]) { append(card,"strong","","My Note:"); append(card,"p","demo-note",state.notes[q.questionUid].noteText); } const actions=el("div","button-row"); if(type==="removed"){ const restore=el("button","button button-primary","Restore"); restore.type="button"; restore.dataset.queueAction="restore"; restore.dataset.questionUid=q.questionUid; actions.append(restore); const permanent=el("button","button button-danger-quiet","Delete permanently"); permanent.type="button"; permanent.dataset.queueAction="delete-question"; permanent.dataset.questionUid=q.questionUid; actions.append(permanent); } else { const note=el("button","button button-secondary","Edit Note"); note.type="button"; note.dataset.queueAction="note"; note.dataset.questionUid=q.questionUid; actions.append(note); const move=el("button","button button-secondary","Move bank"); move.type="button"; move.dataset.queueAction="move"; move.dataset.questionUid=q.questionUid; actions.append(move); const remove=el("button","button button-danger-quiet","Remove"); remove.type="button"; remove.dataset.queueAction="remove"; remove.dataset.questionUid=q.questionUid; actions.append(remove); } card.append(actions); list.append(card); });
  }

  function renderQueueFilters() {
    const bankSel=document.getElementById("v2-queue-bank"), sectionSel=document.getElementById("v2-queue-section"), unitSel=document.getElementById("v2-queue-unit"); if(!bankSel)return; const vals=[bankSel.value,sectionSel.value,unitSel.value]; bankSel.replaceChildren(new Option("All banks","all")); state.banks.forEach(b=>bankSel.append(new Option(b.bankName,b.bankId))); sectionSel.replaceChildren(new Option("All sections","all")); SECTION_IDS.forEach(id=>sectionSel.append(new Option(`${id} — ${SECTION_NAMES[id]}`,id))); unitSel.replaceChildren(new Option("All units","all")); Array.from(new Set(state.questions.map(q=>q.unitId))).sort().forEach(id=>unitSel.append(new Option(`${id} — ${catalogUnitName(id)}`,id))); bankSel.value=state.banks.some(b=>b.bankId===vals[0])?vals[0]:"all"; sectionSel.value=SECTION_IDS.includes(vals[1])?vals[1]:"all"; unitSel.value=Array.from(unitSel.options).some(o=>o.value===vals[2])?vals[2]:"all";
  }

  async function handleQueueAction(event){ const button=event.target.closest("[data-queue-action]"); if(!button)return; if(button.dataset.queueAction==="restore") await restoreQuestion(button.dataset.questionUid); if(button.dataset.queueAction==="note") openNoteForQuestion(button.dataset.questionUid); if(button.dataset.queueAction==="move"){const q=questionByUid(button.dataset.questionUid);const choices=activeBanks().filter(b=>b.bankId!==q.bankId).map(b=>`${b.bankId}: ${b.bankName}`).join("\n");const target=prompt(`Enter destination bankId:\n${choices}`);if(target)await moveQuestion(q.questionUid,target.trim());} if(button.dataset.queueAction==="remove"){const reason=prompt("Optional removal reason:","");if(reason!==null&&confirm("Move this question to Removed Questions? Its history and note will remain."))await removeQuestion(button.dataset.questionUid,reason);} if(button.dataset.queueAction==="delete-question"){if(confirm("Permanent deletion removes the current question content. Completed test snapshots remain readable. Continue?")&&confirm("Second confirmation: permanently delete this question?"))await permanentlyDeleteQuestion(button.dataset.questionUid);} }

  function renderGrowthScreen() {
    const bankSel=document.getElementById("v2-growth-bank"); if(!bankSel)return; fillGrowthFilters(); const bank=bankSel.value, section=document.getElementById("v2-growth-section").value, unit=document.getElementById("v2-growth-unit").value, mode=document.getElementById("v2-growth-mode").value, start=document.getElementById("v2-growth-start").value, end=document.getElementById("v2-growth-end").value, limit=document.getElementById("v2-growth-limit").value;
    let batches=state.batches.filter(b=>(bank==="all"||b.bankIds.includes(bank))&&(section==="all"||b.sectionIds.includes(section))&&(unit==="all"||b.unitIds.includes(unit))&&(mode==="all"||b.mode===mode)&&(!start||String(b.completedAt).slice(0,10)>=start)&&(!end||String(b.completedAt).slice(0,10)<=end)).sort((a,b)=>new Date(a.completedAt)-new Date(b.completedAt)); if(limit!=="all")batches=batches.slice(-Number(limit));
    drawLineChart(document.getElementById("v2-accuracy-chart"),batches.map(b=>b.accuracy),"%",100); drawLineChart(document.getElementById("v2-speed-chart"),batches.map(b=>b.averageActiveTimeSeconds)," sec",null);
    document.getElementById("v2-accuracy-summary").textContent=growthSummary(batches,"accuracy"); document.getElementById("v2-speed-summary").textContent=growthSummary(batches,"speed");
    const table=document.getElementById("v2-unit-analytics"); table.replaceChildren(); const rows=unitAnalytics().filter(r=>(bank==="all"||r.bankId===bank)&&(section==="all"||r.sectionId===section)&&(unit==="all"||r.unitId===unit)).sort((a,b)=>b.weakness-a.weakness); const t=el("table","data-table"); const thead=el("thead"); const tr=el("tr"); ["Bank","Unit","Accuracy","Avg sec","Coverage","Held","Remediation","Mastered","Weakness"].forEach(x=>append(tr,"th","",x)); thead.append(tr); t.append(thead); const body=el("tbody"); rows.forEach(r=>{const row=el("tr"); [bankById(r.bankId)?.bankName||r.bankId,`${r.unitId} — ${catalogUnitName(r.unitId)}`,fmt(r.accuracy,"%"),Number.isFinite(r.averageTime)?r.averageTime.toFixed(1):"—",`${r.coverage.toFixed(0)}%`,r.held,r.remediation,r.mastered,r.solved<5?`${r.weakness.toFixed(0)} (limited data)`:r.weakness.toFixed(0)].forEach(x=>append(row,"td","",x));body.append(row);});t.append(body);table.append(t);
  }

  function fillGrowthFilters(){ const configs=[["v2-growth-bank",[["all","All banks"],...state.banks.map(b=>[b.bankId,b.bankName])]], ["v2-growth-section",[["all","All sections"],...SECTION_IDS.map(id=>[id,`${id} — ${SECTION_NAMES[id]}`])]], ["v2-growth-unit",[["all","All units"],...Array.from(new Set(state.questions.map(q=>q.unitId))).sort().map(id=>[id,`${id} — ${catalogUnitName(id)}`])]]]; configs.forEach(([id,opts])=>{const s=document.getElementById(id),v=s.value;s.replaceChildren();opts.forEach(([value,label])=>s.append(new Option(label,value)));s.value=opts.some(o=>o[0]===v)?v:"all";}); }

  function drawLineChart(container,values,suffix,maxFixed){ if(!container)return;container.replaceChildren();if(!values.length){append(container,"p","muted-empty","No completed batches match these filters.");return;}const w=600,h=220,p=34;const valid=values.map(Number).filter(Number.isFinite);if(!valid.length){append(container,"p","muted-empty","No valid values are available.");return;}const min=maxFixed!==null?0:Math.min(...valid)*0.9;const max=maxFixed!==null?maxFixed:Math.max(...valid)*1.1||1;const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox",`0 0 ${w} ${h}`);svg.setAttribute("role","img");svg.setAttribute("aria-label",`Trend chart from ${valid[0].toFixed(1)}${suffix} to ${valid[valid.length-1].toFixed(1)}${suffix}`);const points=values.map((v,i)=>{const x=p+(values.length===1?(w-2*p)/2:i*(w-2*p)/(values.length-1));const y=h-p-((Number(v)-min)/(max-min||1))*(h-2*p);return`${x},${y}`;}).join(" ");const axis=document.createElementNS(svg.namespaceURI,"path");axis.setAttribute("d",`M${p} ${p} V${h-p} H${w-p}`);axis.setAttribute("class","v2-chart-axis");const line=document.createElementNS(svg.namespaceURI,"polyline");line.setAttribute("points",points);line.setAttribute("fill","none");line.setAttribute("class","v2-chart-line");svg.append(axis,line);values.forEach((v,i)=>{const [x,y]=points.split(" ")[i].split(",");const c=document.createElementNS(svg.namespaceURI,"circle");c.setAttribute("cx",x);c.setAttribute("cy",y);c.setAttribute("r","4");c.setAttribute("class","v2-chart-point");const title=document.createElementNS(svg.namespaceURI,"title");title.textContent=`Batch ${i+1}: ${Number(v).toFixed(1)}${suffix}`;c.append(title);svg.append(c);});container.append(svg); }

  function growthSummary(batches,metric){ if(!batches.length)return"No completed batches match these filters.";if(batches.length<2)return"One completed batch is available. At least two batches are needed for a trend.";const first=metric==="accuracy"?batches[0].accuracy:batches[0].averageActiveTimeSeconds,last=metric==="accuracy"?batches.at(-1).accuracy:batches.at(-1).averageActiveTimeSeconds;if(!Number.isFinite(first)||!Number.isFinite(last))return"Not enough valid data.";const change=last-first;return metric==="accuracy"?`Accuracy changed from ${first.toFixed(1)}% to ${last.toFixed(1)}% (${change>=0?"+":""}${change.toFixed(1)} percentage points) across ${batches.length} batches.`:`Average active time changed from ${first.toFixed(1)} to ${last.toFixed(1)} seconds per answered question (${change<0?`${Math.abs(change).toFixed(1)} seconds faster`:`${change.toFixed(1)} seconds slower`}) across ${batches.length} batches.`; }

  async function syncExactHockCatalog() {
    const exactCatalog = state.hooks?.getReferenceCatalog?.()
      || state.hooks?.advanced?.createDefaultCatalog?.(globalThis.CMA2025Reference || {});
    if (!exactCatalog?.sections?.length || !exactCatalog?.units?.length) {
      throw new Error("The bundled HOCK 2024-2025 unit catalog is unavailable.");
    }
    const before = new Map(state.questions.map((question) => [question.questionUid, `${question.sectionName || ""}|${question.unitName || ""}`]));
    state.catalog = clone(exactCatalog);
    state.questions = state.questions.map((question, index) => normalizeQuestion({ ...question, updatedAt: nowIso() }, question.bankId, index));
    const changedQuestions = state.questions.filter((question) => before.get(question.questionUid) !== `${question.sectionName || ""}|${question.unitName || ""}`).length;
    if (state.hooks?.replaceCatalog) await state.hooks.replaceCatalog(exactCatalog, { applyToQuestions: true });
    await persistAll();
    await syncLegacyQuestionPool();
    renderCurrentScreen();
    return {
      sections: exactCatalog.sections.length,
      units: exactCatalog.units.length,
      changedQuestions,
      edition: "HOCK CMA Part 2 2024-2025"
    };
  }

  function parsePlainTextQuestions(text, bankId, fallbackSectionId = "", fallbackUnitId = "") {
    if (!bankById(bankId)) throw new Error("Select a valid destination bank.");
    const parser = state.hooks?.parseQuestionText || state.hooks?.advanced?.parseQuestionText;
    if (typeof parser !== "function") throw new Error("The local question parser is unavailable.");
    const parsed = parser(text, state.catalog);
    const candidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    const questions = candidates.filter((candidate) => !candidate.validationErrors?.length).map((candidate, index) => {
      const sectionId = sectionIdOf({ sectionId: candidate.sectionId || fallbackSectionId });
      const unitId = unitIdOf({ sectionId, unitId: candidate.unitId || fallbackUnitId, unit: candidate.unitText });
      const unitNumber = Number((unitId.match(/U(\d+)/) || [])[1]) || index + 1;
      return {
        id: `${unitId}-${String(candidate.questionNumber || index + 1).padStart(3, "0")}`,
        section: sectionId,
        sectionId,
        unit: `Unit ${unitNumber}`,
        unitId,
        question: candidate.question,
        options: candidate.options,
        correctAnswer: candidate.correctAnswer,
        explanation: candidate.explanation || "",
        questionType: "mixed",
        difficulty: candidate.difficulty || "unspecified",
        tags: candidate.tags || []
      };
    });
    const preview = prepareImport({ title: "Pasted Questions", questions }, bankId, "pasted-questions.txt");
    return { ...parsed, preview, parsedCount: candidates.length, readyCount: questions.length };
  }

  function openCurrentNote(){const q=state.hooks?.getCurrentQuestion?.(),exam=state.hooks?.getActiveExam?.();if(!q)return;if(exam?.settings?.mode==="exam"&&!state.settings.allowNotesExam){alert("Notes during Exam Mode are disabled in Settings.");return;}openNoteForQuestion(q.questionUid||q.id,true);}
  function openNoteForQuestion(questionUid,fromExam=false){const note=state.notes[questionUid];state.editingNoteQuestionUid=questionUid;state.editingNoteFromExam=fromExam;if(fromExam)state.hooks?.pauseActiveExam?.("noteEditor");document.getElementById("v2-note-text").value=note?.noteText||"";document.getElementById("v2-note-trap").checked=Boolean(note?.isConceptualTrap);const d=document.getElementById("v2-note-dialog");if(d?.showModal&&!d.open)d.showModal();}
  async function saveCurrentNote(){if(!state.editingNoteQuestionUid)return;await saveNote(state.editingNoteQuestionUid,document.getElementById("v2-note-text").value,{isConceptualTrap:document.getElementById("v2-note-trap").checked});closeCurrentNote();renderCurrentScreen();}
  function closeCurrentNote(){const d=document.getElementById("v2-note-dialog");if(d?.open)d.close();if(state.editingNoteFromExam)state.hooks?.resumeActiveExam?.("noteEditor");state.editingNoteQuestionUid=null;state.editingNoteFromExam=false;}
  async function removeCurrentQuestion(){const exam=state.hooks?.getActiveExam?.(),q=state.hooks?.getCurrentQuestion?.();if(!exam||!q)return;if(exam.settings?.mode==="exam"){alert("Remove Question is available only in Study Mode.");return;}const action=prompt("Remove this question? Enter 1 for this session only, 2 to move it to Removed Questions, or Cancel.","1");if(action==="1")state.hooks?.removeCurrentQuestionFromSession?.();if(action==="2"){const reason=prompt("Optional removal reason:","")||"";await removeQuestion(q.questionUid||q.id,reason);state.hooks?.removeCurrentQuestionFromSession?.();}}

  const api = {
    VERSION, PRESETS, SECTION_NAMES,
    initialize, captureLegacyBank, recordResult, exportData, restoreData, updateSettings,
    createBank, renameBank, archiveBank, trashBank, restoreBank, permanentlyDeleteBank, duplicateBank, mergeBanks, moveQuestion, bankStats,
    prepareImport, commitImport, normalizeQuestion, validateImportedQuestion, parsePlainTextQuestions, syncExactHockCatalog,
    eligibleQuestions, eligibilityReason, allocateExact, equalQuotas, automaticQuotas,
    applyAttempt, releaseCompletedCycles, resetCycle, saveNote, deleteNote, removeQuestion, restoreQuestion, permanentlyDeleteQuestion,
    weaknessScore, unitAnalytics, contentHash,
    getState: () => clone({ banks: state.banks, questions: state.questions, attempts: state.attempts, aggregates: state.aggregates, cycles: state.cycles, notes: state.notes, batches: state.batches, settings: state.settings, catalog: state.catalog, migrationReport: state.lastMigrationReport, catalogSyncReport: state.lastCatalogSyncReport })
  };
  globalThis.CMAV2 = Object.freeze(api);
})();
