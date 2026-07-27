(() => {
  "use strict";

  // Versioned keys make future storage migrations possible without colliding
  // with unrelated data saved by other local pages.
  const STORAGE_KEYS = Object.freeze({
    theme: "cma-simulator-theme-v1",
    questionBank: "cma-simulator-question-bank-v1",
    history: "cma-simulator-history-v1",
    activeExam: "cma-simulator-active-exam-v1",
    catalog: "cma-simulator-catalog-v1",
    settings: "cma-simulator-settings-v1",
    importQueue: "cma-simulator-import-queue-v1",
    migrationBackup: "cma-simulator-migration-backup-v1",
    finalMigrationBackup: "cma-simulator-final-migration-backup-v2",
    migrationVersion: "cma-simulator-migration-version-v2",
    uiPreferences: "cma-simulator-ui-preferences-v2",
    studyData: "cma-simulator-study-data-v1"
  });

  // These are stable internal answer IDs. A shuffled answer may be displayed
  // in another position, but its original ID—and therefore correctness—stays intact.
  const OPTION_KEYS = Object.freeze(["A", "B", "C", "D"]);
  const SECTION_KEYS = Object.freeze(["A", "B", "C", "D", "E", "F"]);
  const CMA_2025_REFERENCE = globalThis.CMA2025Reference || Object.freeze({});
  const ADVANCED = globalThis.CMAAdvanced || Object.freeze({});
  const PROGRESS = globalThis.CMAProgress || Object.freeze({});
  const DURABLE_STORAGE = globalThis.CMAStorage || null;
  const BANK_PAGE_SIZE = 50;
  const APP_DATA_VERSION = 2;
  const FAST_QUESTION_REMOVAL_SECONDS = 30;
  const DEFAULT_ANALYTICS_SETTINGS = Object.freeze({
    targetTimeSeconds: 90,
    sufficientAttempts: 5,
    establishedAttempts: 10,
    trendThresholdPoints: 10,
    masteryThreshold: 3,
    aiBatchSize: 15,
    aiTimeoutMs: 45000,
    aiEnabled: true,
    aiModel: "gpt-5.6-sol",
    autoRetireMastered: false,
    removeFastQuestions: true,
    unansweredAsIncorrect: false
  });

  const DEMO_QUESTIONS = Object.freeze([
    {
      id: "DEMO-A-001",
      section: "A",
      sectionName: "Financial Statement Analysis",
      unit: "Unit 1",
      unitName: "Comparative Financial Statement Analysis",
      question: "Under the matching principle, when should an expense generally be recognized?",
      options: { A: "When cash is paid", B: "In the period the related revenue is recognized", C: "When management approves it", D: "Only at year-end" },
      correctAnswer: "B",
      explanation: "The matching principle recognizes expenses in the same period as the revenues they help generate."
    },
    {
      id: "DEMO-A-002",
      section: "A",
      sectionName: "Financial Statement Analysis",
      unit: "Unit 2",
      unitName: "Introduction to Financial Ratio Analysis",
      question: "Which budget is normally prepared first in a master budget?",
      options: { A: "Cash budget", B: "Direct labor budget", C: "Sales budget", D: "Budgeted balance sheet" },
      correctAnswer: "C",
      explanation: "Expected sales drive production, purchasing, staffing, and many other components of the master budget."
    },
    {
      id: "DEMO-A-003",
      section: "A",
      sectionName: "Financial Statement Analysis",
      unit: "Unit 3",
      unitName: "Liquidity Ratios",
      question: "A favorable direct-material price variance occurs when which condition is true?",
      options: { A: "Actual quantity exceeds standard quantity", B: "Actual price is below standard price", C: "Standard price is below actual price", D: "Actual output is below planned output" },
      correctAnswer: "B",
      explanation: "Paying less than the standard price for the actual quantity purchased produces a favorable price variance."
    },
    {
      id: "DEMO-A-004",
      section: "A",
      sectionName: "Financial Statement Analysis",
      unit: "Unit 4",
      unitName: "Leverage and Coverage Ratios",
      question: "Which cost is most likely variable within the relevant range?",
      options: { A: "Factory rent", B: "Straight-line depreciation", C: "Direct materials", D: "Plant manager salary" },
      correctAnswer: "C",
      explanation: "Direct-material cost typically changes in proportion to the number of units produced."
    },
    {
      id: "DEMO-B-001",
      section: "B",
      sectionName: "Corporate Finance",
      unit: "Unit 1",
      unitName: "Financial Risk and Return, Types of Financial Risk",
      question: "Which ratio is designed primarily to measure short-term liquidity?",
      options: { A: "Current ratio", B: "Debt-to-equity ratio", C: "Gross profit margin", D: "Return on assets" },
      correctAnswer: "A",
      explanation: "The current ratio compares current assets with current liabilities and is a common liquidity measure."
    },
    {
      id: "DEMO-B-002",
      section: "B",
      sectionName: "Corporate Finance",
      unit: "Unit 2",
      unitName: "Capital Asset Pricing Model (CAPM)",
      question: "Holding other factors constant, what is the usual effect of an increase in a firm's required rate of return on a project's net present value?",
      options: { A: "NPV increases", B: "NPV is unchanged", C: "NPV decreases", D: "NPV becomes the payback period" },
      correctAnswer: "C",
      explanation: "A higher discount rate reduces the present value of future cash inflows and therefore usually lowers NPV."
    },
    {
      id: "DEMO-B-003",
      section: "B",
      sectionName: "Corporate Finance",
      unit: "Unit 3",
      unitName: "Portfolio Risk and Return",
      question: "Which cost should be excluded from a decision about whether to replace existing equipment?",
      options: { A: "Opportunity cost", B: "Incremental maintenance cost", C: "Sunk cost", D: "Additional working capital" },
      correctAnswer: "C",
      explanation: "A sunk cost has already been incurred and cannot be changed by the current decision."
    },
    {
      id: "DEMO-B-004",
      section: "B",
      sectionName: "Corporate Finance",
      unit: "Unit 4",
      unitName: "Introduction to Long-Term Financial Management",
      question: "Diversification most directly reduces which type of investment risk?",
      options: { A: "Systematic market risk", B: "Company-specific risk", C: "Purchasing-power risk", D: "Interest-rate risk for all securities" },
      correctAnswer: "B",
      explanation: "Holding a variety of investments reduces unsystematic, company-specific risk but not broad market risk."
    },
    {
      id: "DEMO-B-005",
      section: "B",
      sectionName: "Corporate Finance",
      unit: "Unit 5",
      unitName: "Introduction to Cost of Capital",
      question: "A project has a positive net present value. What does this generally indicate?",
      options: { A: "Its return is below the discount rate", B: "It should always be rejected", C: "It is expected to add value at the chosen discount rate", D: "Its accounting income is zero" },
      correctAnswer: "C",
      explanation: "A positive NPV means discounted inflows exceed discounted outflows, indicating expected value creation."
    },
    {
      id: "DEMO-B-006",
      section: "F",
      sectionName: "Professional Ethics",
      unit: "Unit 1",
      unitName: "Business Ethics",
      question: "When a management accountant faces an unresolved ethical conflict, what is an appropriate first step under typical professional guidance?",
      options: { A: "Immediately disclose it publicly", B: "Ignore the issue if it is not material", C: "Follow the organization's established policies and escalation channels", D: "Alter the records to avoid the conflict" },
      correctAnswer: "C",
      explanation: "Established organizational policies and appropriate internal escalation are normally used before broader disclosure, subject to legal obligations."
    },
    {
      id: "B-U18-001",
      section: "B",
      sectionName: "Corporate Finance",
      unit: "Unit 18",
      unitName: "Forward and Future Contracts",
      question: "Which statement correctly describes a futures contract?",
      options: { A: "It is always privately negotiated", B: "It is standardized and exchange-traded", C: "It cannot be used for hedging", D: "It has no daily settlement" },
      correctAnswer: "B",
      explanation: "Futures contracts are standardized and traded on organized exchanges."
    },
    {
      id: "E-U05-001",
      section: "E",
      sectionName: "Capital Investment Decisions",
      unit: "Unit 5",
      unitName: "Capital Investment Analysis Methods: Other Topics",
      question: "Which item is normally excluded from a capital investment analysis?",
      options: { A: "Opportunity cost", B: "Incremental working capital", C: "Sunk cost", D: "After-tax salvage value" },
      correctAnswer: "C",
      explanation: "A sunk cost has already been incurred and is not affected by the current decision."
    }
  ]);

  const state = {
    catalog: ADVANCED.createDefaultCatalog ? ADVANCED.createDefaultCatalog(CMA_2025_REFERENCE) : { version: 1, sections: [], units: [] },
    analyticsSettings: { ...DEFAULT_ANALYTICS_SETTINGS },
    importQueue: [],
    importFilter: "all",
    selectedBankQuestions: new Set(),
    storageBackend: DURABLE_STORAGE ? "IndexedDB" : "localStorage",
    storageUsage: null,
    storageQuota: null,
    storageMigrationCount: 0,
    questionBank: [],
    bankSource: "demonstration",
    bankName: "Included demonstration bank",
    history: [],
    activeExam: null,
    currentResult: null,
    timerId: null,
    screen: "home",
    storageWarning: "",
    resultSort: { key: "number", direction: "asc" },
    confirmationPauseStartedAt: null,
    isSubmitting: false,
    confirmResolver: null,
    setupSections: new Set(),
    setupUnits: new Set(),
    setupMode: "standard",
    setupPreviewSignature: "",
    setupPreviewQuestions: [],
    bulkValidation: null,
    bankFileValidation: null,
    bankSearch: "",
    bankSectionFilter: "all",
    bankUnitFilter: "all",
    bankDifficultyFilter: "all",
    bankClassificationFilter: "all",
    bankMasteryFilter: "all",
    bankStatusFilter: "all",
    bankMistakeFilter: "all",
    bankNoteFilter: "all",
    bankPage: 1,
    bankPane: "browse",
    bankStorageUnsaved: false,
    bankExportSections: new Set(),
    bankExportUnits: new Set(),
    bankExportInitialized: false,
    editingQuestionId: null,
    historyFilters: { section: "all", unit: "all", date: "", minScore: "", maxScore: "", minAccuracy: "", maxAccuracy: "", mode: "all", sort: "date-desc" },
    progressTab: "attempts",
    progressPeriod: "four-weeks",
    progressCustomStart: "",
    progressCustomEnd: "",
    progressGroup: "week",
    progressScopeType: "overall",
    progressScope: "all",
    progressComparisonIds: [],
    progressComparisonMetric: "accuracy",
    studyTab: "summaries",
    studyData: { version: 1, summaries: {}, notes: {}, formulaNotes: "", resolvedMistakes: {}, checklist: [] },
    uiPreferences: { version: APP_DATA_VERSION, lastDestination: "home", progressTab: "attempts", bankTab: "browse", studyTab: "summaries" },
    migrationVersion: 1
  };

  const dom = {};

  function cacheDom() {
    document.querySelectorAll("[id]").forEach((element) => {
      dom[element.id] = element;
    });
    dom.screens = Array.from(document.querySelectorAll(".screen"));
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createId(prefix = "attempt") {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return `${prefix}-${globalThis.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function readStorage(key, fallback) {
    // Every localStorage operation is guarded because storage may be disabled,
    // full, or contain damaged JSON from an earlier browser session.
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      state.storageWarning = "Some saved browser data could not be read and was safely ignored.";
      console.warn("CMA Exam Simulator: ignored unreadable saved data.", error);
      return fallback;
    }
  }

  async function readStorageDurable(key, fallback) {
    if (!DURABLE_STORAGE?.LARGE_KEYS?.has(key)) return readStorage(key, fallback);
    try {
      return await DURABLE_STORAGE.get(key, fallback);
    } catch (error) {
      state.storageWarning = "The large-data store could not be read. A compatible browser-storage copy was used when available.";
      console.warn("CMA Exam Simulator: IndexedDB read failed.", error);
      return readStorage(key, fallback);
    }
  }

  function writeStorage(key, value) {
    if (DURABLE_STORAGE?.LARGE_KEYS?.has(key)) {
      DURABLE_STORAGE.set(key, value).then(() => {
        state.storageBackend = "IndexedDB";
      }).catch((error) => {
        state.storageWarning = "The browser could not save a large-data change. Export a full backup before closing.";
        state.bankStorageUnsaved = key === STORAGE_KEYS.questionBank || state.bankStorageUnsaved;
        console.warn("CMA Exam Simulator: IndexedDB write failed.", error);
        if (dom["global-message"]) setMessage(state.storageWarning, "warning", 0);
      });
      return true;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      state.storageWarning = "The browser could not save this change. Check browser storage settings or available space.";
      console.warn("CMA Exam Simulator: browser storage write failed.", error);
      return false;
    }
  }

  function removeStorage(key) {
    if (DURABLE_STORAGE?.LARGE_KEYS?.has(key)) {
      DURABLE_STORAGE.remove(key).catch((error) => {
        state.storageWarning = "The browser could not remove saved large-data content.";
        console.warn("CMA Exam Simulator: IndexedDB removal failed.", error);
      });
      return true;
    }
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      state.storageWarning = "The browser could not remove saved data.";
      console.warn("CMA Exam Simulator: browser storage removal failed.", error);
      return false;
    }
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function referenceSectionName(section) {
    return CMA_2025_REFERENCE[normalizeSectionValue(section)]?.sectionName || "";
  }

  function referenceUnit(section, unit) {
    const normalizedSection = normalizeSectionValue(section);
    const match = typeof unit === "string" ? unit.trim().match(/^Unit\s+0*(\d+)$/i) : null;
    if (!match) return null;
    return CMA_2025_REFERENCE[normalizedSection]?.units?.[Number(match[1]) - 1] || null;
  }

  function referenceUnitName(section, unit) {
    return referenceUnit(section, unit)?.unitName || "";
  }

  function naturalCompare(left, right) {
    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
  }

  function normalizeSectionValue(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (/^[A-F]$/i.test(trimmed)) return trimmed.toUpperCase();
    const legacyMatch = trimmed.match(/^Section\s+([A-F])(?:\s*[-:—].*)?$/i);
    return legacyMatch ? legacyMatch[1].toUpperCase() : "";
  }

  function unitKey(questionOrSection, unitValue) {
    if (typeof questionOrSection === "object" && isNonEmptyString(questionOrSection.unitId)) return questionOrSection.unitId;
    const section = typeof questionOrSection === "object" ? questionOrSection.section : questionOrSection;
    const unit = typeof questionOrSection === "object" ? questionOrSection.unit : unitValue;
    return `${section}::${unit}`;
  }

  function sectionDisplayName(questionOrSection, sectionName = "") {
    const section = typeof questionOrSection === "object" ? questionOrSection.section : questionOrSection;
    const catalogName = typeof questionOrSection === "object" && questionOrSection.sectionId ? ADVANCED.findSection?.(state.catalog, questionOrSection.sectionId)?.name : "";
    const suppliedName = catalogName || (typeof questionOrSection === "object" ? questionOrSection.sectionName : sectionName);
    const base = `Section ${normalizeSectionValue(section) || section}`;
    const friendlyName = isNonEmptyString(suppliedName) && suppliedName.trim().toLowerCase() !== base.toLowerCase()
      ? suppliedName
      : referenceSectionName(section);
    return isNonEmptyString(friendlyName) && friendlyName.trim().toLowerCase() !== base.toLowerCase()
      ? `${base} — ${friendlyName.trim()}`
      : base;
  }

  function unitDisplayName(questionOrUnit, unitName = "") {
    const unit = typeof questionOrUnit === "object" ? questionOrUnit.unit : questionOrUnit;
    const catalogName = typeof questionOrUnit === "object" && questionOrUnit.unitId ? state.catalog.units.find((item) => item.id === questionOrUnit.unitId)?.unitName : "";
    const friendlyName = catalogName || (typeof questionOrUnit === "object" ? questionOrUnit.unitName : unitName);
    return isNonEmptyString(friendlyName) && friendlyName.trim().toLowerCase() !== String(unit).trim().toLowerCase()
      ? `${unit} — ${friendlyName.trim()}`
      : String(unit || "Unspecified unit");
  }

  function normalizeQuestionRecord(rawQuestion, index = 0, catalog = state.catalog) {
    const label = `Question ${index + 1}`;
    const errors = [];
    if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) {
      return { question: null, errors: [`${label}: must be an object.`], converted: false };
    }

    const id = typeof rawQuestion.id === "string" ? rawQuestion.id.trim() : "";
    const rawSection = typeof (rawQuestion.sectionId || rawQuestion.section) === "string" ? String(rawQuestion.sectionId || rawQuestion.section).trim() : "";
    const section = normalizeSectionValue(rawSection);
    const legacySection = Boolean(section && rawSection.toUpperCase() !== section);
    const catalogSection = ADVANCED.findSection?.(catalog, section);
    const catalogUnit = ADVANCED.findUnit?.(catalog, section, rawQuestion.unitId || rawQuestion.unit);
    const unit = catalogUnit?.unitCode || (typeof rawQuestion.unit === "string" ? rawQuestion.unit.trim() : "");
    const useBundledReferenceName = /^DEMO-[A-F]-\d+$/i.test(id) || ["B-U18-001", "E-U05-001", "F-U01-001"].includes(id);
    const suppliedSectionName = typeof rawQuestion.sectionName === "string" ? rawQuestion.sectionName.trim() : "";
    const suppliedUnitName = typeof rawQuestion.unitName === "string" ? rawQuestion.unitName.trim() : "";
    const sectionName = (useBundledReferenceName && referenceSectionName(section)
      ? referenceSectionName(section)
      : suppliedSectionName
      ? rawQuestion.sectionName.trim()
      : legacySection ? rawSection : catalogSection?.name || referenceSectionName(section));
    const unitName = (useBundledReferenceName && referenceUnitName(section, unit)
      ? referenceUnitName(section, unit)
      : suppliedUnitName
      ? suppliedUnitName
      : catalogUnit?.unitName || referenceUnitName(section, unit));
    const questionText = typeof rawQuestion.question === "string" ? rawQuestion.question.trim() : "";
    const correctAnswer = typeof rawQuestion.correctAnswer === "string" ? rawQuestion.correctAnswer.trim().toUpperCase() : "";
    const options = rawQuestion.options;
    const idSuffix = id ? ` (${id})` : "";

    if (!id) errors.push(`${label}: a non-empty unique ‘id’ is required.`);
    if (!section || !SECTION_KEYS.includes(section)) errors.push(`${label}${idSuffix}: ‘section’ must be A, B, C, D, E, or F.`);
    if (rawQuestion.sectionName !== undefined && typeof rawQuestion.sectionName !== "string") errors.push(`${label}${idSuffix}: ‘sectionName’ must be text when provided.`);
    if (!unit) errors.push(`${label}${idSuffix}: ‘unit’ is required.`);
    if (rawQuestion.unitName !== undefined && typeof rawQuestion.unitName !== "string") errors.push(`${label}${idSuffix}: ‘unitName’ must be text when provided.`);
    if (!questionText) errors.push(`${label}${idSuffix}: question text cannot be empty.`);

    if (!options || typeof options !== "object" || Array.isArray(options)) {
      errors.push(`${label}${idSuffix}: ‘options’ must be an object containing A, B, C, and D.`);
    } else {
      const keys = Object.keys(options);
      if (keys.length !== 4 || !OPTION_KEYS.every((key) => Object.prototype.hasOwnProperty.call(options, key))) {
        errors.push(`${label}${idSuffix}: options must contain exactly A, B, C, and D.`);
      }
      OPTION_KEYS.forEach((key) => {
        if (!isNonEmptyString(options[key])) errors.push(`${label}${idSuffix}: option ${key} cannot be empty.`);
      });
    }

    if (!OPTION_KEYS.includes(correctAnswer)) {
      errors.push(`${label}${idSuffix}: ‘correctAnswer’ must be A, B, C, or D.`);
    } else if (!options || !Object.prototype.hasOwnProperty.call(options, correctAnswer)) {
      errors.push(`${label}${idSuffix}: correct-answer key ${correctAnswer} is missing from options.`);
    }
    if (rawQuestion.explanation !== undefined && typeof rawQuestion.explanation !== "string") {
      errors.push(`${label}${idSuffix}: ‘explanation’ must be text when provided.`);
    }

    const questionUid = typeof rawQuestion.questionUid === "string" && rawQuestion.questionUid.trim()
      ? rawQuestion.questionUid.trim()
      : id;
    const sourceQuestionId = typeof rawQuestion.sourceQuestionId === "string" && rawQuestion.sourceQuestionId.trim()
      ? rawQuestion.sourceQuestionId.trim()
      : id;
    const question = {
      version: 3,
      id: questionUid,
      questionUid,
      sourceQuestionId,
      bankId: typeof rawQuestion.bankId === "string" ? rawQuestion.bankId.trim() : "",
      sectionId: section,
      unitId: catalogUnit?.id || rawQuestion.unitId || (ADVANCED.stableUnitId ? ADVANCED.stableUnitId(section, unit) : `${section}-${unit}`),
      section,
      sectionName,
      unit,
      unitName,
      sectionNameSnapshot: sectionName,
      unitNameSnapshot: unitName,
      topic: typeof rawQuestion.topic === "string" ? rawQuestion.topic.trim() : "",
      tags: Array.isArray(rawQuestion.tags) ? rawQuestion.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
      difficulty: ["Easy", "Medium", "Hard"].includes(rawQuestion.difficulty) ? rawQuestion.difficulty : "Medium",
      source: typeof rawQuestion.source === "string" ? rawQuestion.source.trim() : "",
      retired: Boolean(rawQuestion.retired || rawQuestion.status === "archived"),
      retiredAt: (rawQuestion.retired || rawQuestion.status === "archived") && typeof rawQuestion.retiredAt === "string" ? rawQuestion.retiredAt : "",
      retirementReason: (rawQuestion.retired || rawQuestion.status === "archived") && typeof rawQuestion.retirementReason === "string" ? rawQuestion.retirementReason : "",
      status: typeof rawQuestion.status === "string" ? rawQuestion.status : rawQuestion.isRemoved ? "removed" : rawQuestion.retired ? "archived" : "active",
      isRemoved: Boolean(rawQuestion.isRemoved || rawQuestion.status === "removed"),
      removedAt: typeof rawQuestion.removedAt === "string" ? rawQuestion.removedAt : null,
      removedReason: typeof rawQuestion.removedReason === "string" ? rawQuestion.removedReason : "",
      contentHash: typeof rawQuestion.contentHash === "string" ? rawQuestion.contentHash : "",
      questionType: typeof rawQuestion.questionType === "string" ? rawQuestion.questionType : "mixed",
      classification: rawQuestion.classification && typeof rawQuestion.classification === "object"
        ? deepClone(rawQuestion.classification)
        : { status: catalogUnit ? "confirmed" : "unclassified", method: catalogUnit ? "catalog-match" : "legacy-migration", confidence: catalogUnit ? 1 : 0 },
      question: questionText,
      options: OPTION_KEYS.reduce((result, key) => {
        result[key] = options && typeof options[key] === "string" ? options[key].trim() : "";
        return result;
      }, {}),
      correctAnswer,
      explanation: typeof rawQuestion.explanation === "string" ? rawQuestion.explanation.trim() : ""
    };
    const referenceNameChanged = sectionName !== suppliedSectionName || unitName !== suppliedUnitName;
    return { question, errors, converted: legacySection || referenceNameChanged || !isNonEmptyString(rawQuestion.sectionName) || !isNonEmptyString(rawQuestion.unitName) };
  }

  function validateQuestionBank(input, options = {}) {
    // Validation is all-or-nothing for file replacement, while bulk paste can
    // still preview valid records and correct specific invalid ones.
    const rawQuestions = Array.isArray(input) ? input : input && Array.isArray(input.questions) ? input.questions : null;
    if (!rawQuestions) {
      return { valid: false, questions: [], errors: ["The content must contain a JSON array or an object with a ‘questions’ array."], validCount: 0, invalidCount: 1, duplicateIds: [], convertedCount: 0 };
    }
    if (rawQuestions.length === 0) {
      return { valid: false, questions: [], errors: ["The question bank is empty."], validCount: 0, invalidCount: 0, duplicateIds: [], convertedCount: 0 };
    }

    const errors = [];
    const ids = new Set();
    const existingIds = new Set(options.existingIds || []);
    const duplicateIds = [];
    const questions = [];
    let convertedCount = 0;

    rawQuestions.forEach((rawQuestion, index) => {
      const normalized = normalizeQuestionRecord(rawQuestion, index, options.catalog || state.catalog);
      const recordErrors = normalized.errors.slice();
      const id = normalized.question?.id || "";
      if (id && ids.has(id)) recordErrors.push(`Question ${index + 1} (${id}): duplicate ID in this batch.`);
      if (id) ids.add(id);
      if (id && existingIds.has(id)) duplicateIds.push(id);
      if (recordErrors.length) {
        errors.push(...recordErrors);
      } else {
        questions.push(normalized.question);
        if (normalized.converted) convertedCount += 1;
      }
    });

    return {
      valid: errors.length === 0,
      questions,
      errors,
      validCount: questions.length,
      invalidCount: rawQuestions.length - questions.length,
      duplicateIds: uniqueSorted(duplicateIds),
      convertedCount
    };
  }

  function prepareQuestionImport(input, options = {}) {
    const rawQuestions = Array.isArray(input) ? input : input && Array.isArray(input.questions) ? input.questions : null;
    if (!rawQuestions) return { ...validateQuestionBank(input, options), catalog: state.catalog, upgradedCount: 0, addedCatalogUnits: 0 };
    const previousUnitCount = state.catalog.units.length;
    const candidateCatalog = ADVANCED.augmentCatalogFromQuestions
      ? ADVANCED.augmentCatalogFromQuestions(state.catalog, rawQuestions)
      : state.catalog;
    const validation = validateQuestionBank(rawQuestions, { ...options, catalog: candidateCatalog });
    const upgradedCount = rawQuestions.filter((question) => !question || question.version !== 3 || !isNonEmptyString(question.sectionId) || !isNonEmptyString(question.unitId) || !question.classification || !Array.isArray(question.tags)).length;
    return {
      ...validation,
      catalog: candidateCatalog,
      upgradedCount,
      addedCatalogUnits: Math.max(0, candidateCatalog.units.length - previousUnitCount)
    };
  }

  function isValidHistoryRecord(record) {
    return Boolean(
      record &&
      isNonEmptyString(record.id) &&
      isNonEmptyString(record.title) &&
      isNonEmptyString(record.completedAt) &&
      Number.isFinite(record.totalQuestions) &&
      Number.isFinite(record.correct) &&
      Number.isFinite(record.incorrect) &&
      Number.isFinite(record.unanswered) &&
      record.correct + record.incorrect + record.unanswered === record.totalQuestions &&
      Number.isFinite(record.percentage) &&
      Number.isFinite(record.totalTimeUsedMs) &&
      Number.isFinite(record.averageTimeMs) &&
      record.timeAnalysis && typeof record.timeAnalysis === "object" &&
      Array.isArray(record.sectionPerformance) &&
      Array.isArray(record.topicPerformance) &&
      Array.isArray(record.perQuestion) &&
      record.perQuestion.length === record.totalQuestions &&
      record.perQuestion.every((item) => item && isNonEmptyString(item.id) && ["Correct", "Incorrect", "Unanswered"].includes(item.status) && Array.isArray(item.optionOrder) && item.optionOrder.length === 4)
    );
  }

  function normalizeHistoryRecord(record) {
    const normalized = deepClone(record);
    normalized.perQuestion = normalized.perQuestion.map((item, index) => {
      const converted = normalizeQuestionRecord(item, index, state.catalog).question;
      return {
        ...item,
        version: 3,
        sectionId: converted?.sectionId || normalizeSectionValue(item.sectionId || item.section),
        unitId: converted?.unitId || item.unitId || unitKey(item),
        section: converted?.section || normalizeSectionValue(item.section),
        sectionName: converted?.sectionName || item.sectionName || "",
        unit: converted?.unit || item.unit,
        unitName: converted?.unitName || item.unitName || "",
        sectionNameSnapshot: item.sectionNameSnapshot || converted?.sectionName || item.sectionName || "",
        unitNameSnapshot: item.unitNameSnapshot || converted?.unitName || item.unitName || ""
      };
    });
    normalized.version = 3;
    normalized.selectedSections = Array.isArray(normalized.selectedSections)
      ? normalized.selectedSections.map(normalizeSectionValue).filter(Boolean)
      : uniqueSorted(normalized.perQuestion.map((item) => item.section));
    normalized.selectedUnits = Array.isArray(normalized.selectedUnits) && normalized.selectedUnits.length
      ? normalized.selectedUnits
      : uniqueSorted(normalized.perQuestion.map((item) => unitKey(item)));
    normalized.eligibleQuestionCount = Number(normalized.eligibleQuestionCount) || normalized.totalQuestions;
    normalized.selectedQuestionCount = Number(normalized.selectedQuestionCount) || normalized.totalQuestions;
    normalized.randomizeQuestions = Boolean(normalized.randomizeQuestions);
    normalized.balancedDistribution = Boolean(normalized.balancedDistribution);
    normalized.shuffleOptions = Boolean(normalized.shuffleOptions);
    normalized.questionIds = Array.isArray(normalized.questionIds) ? normalized.questionIds : normalized.perQuestion.map((item) => item.id);
    normalized.questionOrder = Array.isArray(normalized.questionOrder) ? normalized.questionOrder : normalized.questionIds.slice();
    normalized.sectionPerformance = calculateGroupPerformance(normalized.perQuestion, "section");
    normalized.unitPerformance = calculateGroupPerformance(normalized.perQuestion, "unit");
    normalized.sectionUnitPerformance = normalized.unitPerformance;
    normalized.topicPerformance = normalized.unitPerformance;
    return normalized;
  }

  async function loadInitialData() {
    if (DURABLE_STORAGE) {
      try { state.storageMigrationCount = (await DURABLE_STORAGE.migrateLegacy()).length; }
      catch (error) { state.storageWarning = "Existing browser data could not be fully migrated to the large-data store; the app will retry automatically."; console.warn("CMA Exam Simulator: storage migration deferred.", error); }
    }
    const [savedBank, savedCatalog, savedSettings, savedQueue, savedHistory, savedMigrationBackup, savedStudyData, savedUiPreferences, savedMigrationVersion] = await Promise.all([
      readStorageDurable(STORAGE_KEYS.questionBank, null),
      readStorageDurable(STORAGE_KEYS.catalog, null),
      readStorageDurable(STORAGE_KEYS.settings, null),
      readStorageDurable(STORAGE_KEYS.importQueue, []),
      readStorageDurable(STORAGE_KEYS.history, []),
      readStorageDurable(STORAGE_KEYS.migrationBackup, null),
      readStorageDurable(STORAGE_KEYS.studyData, null),
      readStorageDurable(STORAGE_KEYS.uiPreferences, null),
      readStorageDurable(STORAGE_KEYS.migrationVersion, 1)
    ]);
    if (savedCatalog && ADVANCED.normalizeCatalog) {
      const catalogValidation = ADVANCED.normalizeCatalog(savedCatalog, CMA_2025_REFERENCE);
      state.catalog = catalogValidation.valid ? catalogValidation.catalog : ADVANCED.createDefaultCatalog(CMA_2025_REFERENCE);
      if (!catalogValidation.valid) state.storageWarning = "The saved syllabus catalog was invalid, so the bundled catalog was restored safely.";
    }
    if (savedBank?.questions && ADVANCED.augmentCatalogFromQuestions) {
      state.catalog = ADVANCED.augmentCatalogFromQuestions(state.catalog, savedBank.questions);
    }
    state.analyticsSettings = {
      ...DEFAULT_ANALYTICS_SETTINGS,
      ...(savedSettings && typeof savedSettings === "object" ? savedSettings : {})
    };
    state.importQueue = Array.isArray(savedQueue) ? savedQueue : [];
    if (savedStudyData && typeof savedStudyData === "object") {
      state.studyData = {
        version: 1,
        summaries: savedStudyData.summaries && typeof savedStudyData.summaries === "object" ? savedStudyData.summaries : {},
        notes: savedStudyData.notes && typeof savedStudyData.notes === "object" ? savedStudyData.notes : {},
        formulaNotes: typeof savedStudyData.formulaNotes === "string" ? savedStudyData.formulaNotes : "",
        resolvedMistakes: savedStudyData.resolvedMistakes && typeof savedStudyData.resolvedMistakes === "object" ? savedStudyData.resolvedMistakes : {},
        checklist: Array.isArray(savedStudyData.checklist) ? savedStudyData.checklist.filter((item) => item && typeof item.text === "string") : []
      };
    }
    if (savedUiPreferences && typeof savedUiPreferences === "object") state.uiPreferences = { ...state.uiPreferences, ...savedUiPreferences, version: APP_DATA_VERSION };
    state.migrationVersion = Number(savedMigrationVersion) || 1;
    if (savedBank?.questions && !savedMigrationBackup) {
      writeStorage(STORAGE_KEYS.migrationBackup, {
        createdAt: new Date().toISOString(),
        reason: "Automatic backup before v3 question and syllabus migration",
        questionBank: savedBank,
        catalog: savedCatalog,
        history: savedHistory
      });
    }
    if (savedBank && savedBank.cleared === true) {
      state.questionBank = [];
      state.bankSource = "empty";
      state.bankName = "";
    } else if (savedBank && savedBank.questions) {
      const validated = validateQuestionBank(savedBank.questions, { catalog: state.catalog });
      if (validated.valid) {
        state.questionBank = validated.questions;
        state.bankSource = "imported";
        state.bankName = isNonEmptyString(savedBank.name) ? savedBank.name : "Imported question bank";
      } else {
        state.questionBank = validateQuestionBank(DEMO_QUESTIONS, { catalog: state.catalog }).questions;
        state.storageWarning = "A saved question bank was invalid, so the demonstration bank was restored.";
      }
    } else {
      state.questionBank = validateQuestionBank(DEMO_QUESTIONS, { catalog: state.catalog }).questions;
    }

    writeStorage(STORAGE_KEYS.catalog, state.catalog);
    if (state.questionBank.length) persistQuestionBank(state.bankName || "Personal CMA question bank");

    if (Array.isArray(savedHistory)) {
      state.history = savedHistory.filter(isValidHistoryRecord).map(normalizeHistoryRecord);
      if (state.history.length !== savedHistory.length) {
        state.storageWarning = "Some damaged history entries were ignored; valid attempts remain available.";
        writeStorage(STORAGE_KEYS.history, state.history);
      }
    } else {
      state.history = [];
      state.storageWarning = "Saved exam history was not in a usable format and was safely reset.";
    }

    const savedActive = readStorage(STORAGE_KEYS.activeExam, null);
    if (isValidActiveExam(savedActive)) {
      state.activeExam = normalizeActiveExam(savedActive);
    } else if (savedActive !== null) {
      removeStorage(STORAGE_KEYS.activeExam);
      state.storageWarning = "An incomplete saved exam was damaged and could not be resumed.";
    }
  }

  async function runFinalIntegratedMigration() {
    if (state.migrationVersion >= APP_DATA_VERSION) return { migrated: false, version: state.migrationVersion };
    const validCurrentData = Array.isArray(state.questionBank) && Array.isArray(state.history) && Array.isArray(state.catalog?.sections) && Array.isArray(state.catalog?.units) && state.analyticsSettings && typeof state.analyticsSettings === "object";
    if (!validCurrentData) {
      state.storageWarning = "The final interface migration was not applied because current saved data did not pass validation. Existing data remains unchanged.";
      return { migrated: false, version: state.migrationVersion, error: "validation" };
    }
    const backup = {
      version: 1,
      createdAt: new Date().toISOString(),
      reason: "Automatic backup before the unified navigation, progress, and study-data migration",
      sourceMigrationVersion: state.migrationVersion,
      questionBank: deepClone(state.questionBank),
      catalog: deepClone(state.catalog),
      history: deepClone(state.history),
      analyticsSettings: deepClone(state.analyticsSettings),
      importQueue: deepClone(state.importQueue),
      studyData: deepClone(state.studyData)
    };
    let backedUp = false;
    try {
      if (DURABLE_STORAGE?.LARGE_KEYS?.has(STORAGE_KEYS.finalMigrationBackup)) {
        await DURABLE_STORAGE.set(STORAGE_KEYS.finalMigrationBackup, backup);
        backedUp = true;
      } else {
        backedUp = writeStorage(STORAGE_KEYS.finalMigrationBackup, backup);
      }
    } catch (error) {
      console.warn("CMA Exam Simulator: final migration backup failed.", error);
    }
    if (!backedUp) {
      state.storageWarning = "The final interface migration was deferred because its safety backup could not be stored. Existing data remains unchanged.";
      return { migrated: false, version: state.migrationVersion, error: "backup" };
    }
    const routeMap = { setup: "exam-center", import: "bank", syllabus: "bank", weak: "progress", history: "progress" };
    const legacyDestination = cleanDestination(state.uiPreferences.lastDestination);
    state.uiPreferences = { ...state.uiPreferences, version: APP_DATA_VERSION, lastDestination: routeMap[legacyDestination] || legacyDestination || "home" };
    const saved = writeStorage(STORAGE_KEYS.studyData, state.studyData) && writeStorage(STORAGE_KEYS.uiPreferences, state.uiPreferences) && writeStorage(STORAGE_KEYS.migrationVersion, APP_DATA_VERSION);
    if (!saved) {
      state.storageWarning = "The final interface migration could not be committed; the pre-migration backup remains available and existing study data was preserved.";
      return { migrated: false, version: state.migrationVersion, error: "commit" };
    }
    state.migrationVersion = APP_DATA_VERSION;
    return { migrated: true, version: APP_DATA_VERSION };
  }

  function cleanDestination(value) {
    const destination = String(value || "").trim();
    return ["home", "exam-center", "setup", "bank", "import", "syllabus", "weak", "history", "study", "settings"].includes(destination) ? destination : "home";
  }

  function isValidActiveExam(exam) {
    if (!exam || typeof exam !== "object") return false;
    if (!isNonEmptyString(exam.id) || !isNonEmptyString(exam.title)) return false;
    if (!Array.isArray(exam.questions) || exam.questions.length === 0) return false;
    if (!Number.isFinite(exam.startTime) || !Number.isFinite(exam.endTime) || exam.endTime <= exam.startTime) return false;
    if (!Number.isInteger(exam.currentIndex) || exam.currentIndex < 0 || exam.currentIndex >= exam.questions.length) return false;
    const baseValidation = validateQuestionBank(exam.questions, { catalog: state.catalog });
    if (!baseValidation.valid) return false;
    return exam.questions.every((question) => Array.isArray(question.optionOrder) && question.optionOrder.length === 4 && OPTION_KEYS.every((key) => question.optionOrder.includes(key)));
  }

  function normalizeActiveExam(exam) {
    const normalized = deepClone(exam);
    normalized.questions = normalized.questions.map((question, index) => {
      const converted = normalizeQuestionRecord(question, index, state.catalog).question;
      return { ...converted, optionOrder: Array.isArray(question.optionOrder) ? question.optionOrder.slice() : OPTION_KEYS.slice() };
    });
    normalized.status = "active";
    normalized.answers = normalized.answers && typeof normalized.answers === "object" ? normalized.answers : {};
    normalized.marked = normalized.marked && typeof normalized.marked === "object" ? normalized.marked : {};
    normalized.guessed = normalized.guessed && typeof normalized.guessed === "object" ? normalized.guessed : {};
    normalized.timesMs = normalized.timesMs && typeof normalized.timesMs === "object" ? normalized.timesMs : {};
    normalized.questions.forEach((question) => {
      const answer = normalized.answers[question.id];
      if (!OPTION_KEYS.includes(answer)) delete normalized.answers[question.id];
      normalized.marked[question.id] = Boolean(normalized.marked[question.id]);
      normalized.guessed[question.id] = Boolean(normalized.guessed[question.id]);
      const time = Number(normalized.timesMs[question.id]);
      normalized.timesMs[question.id] = Number.isFinite(time) && time >= 0 ? time : 0;
    });
    normalized.visitStartedAt = Number.isFinite(normalized.visitStartedAt) ? normalized.visitStartedAt : Date.now();
    normalized.submitted = false;
    return normalized;
  }

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function appendText(parent, tag, className, text) {
    const child = el(tag, className, text);
    parent.append(child);
    return child;
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values)).sort(naturalCompare);
  }

  function discoverBankStructure(questions = state.questionBank) {
    const sections = SECTION_KEYS.map((section) => {
      const sectionQuestions = questions.filter((question) => question.section === section);
      const sectionName = sectionQuestions.find((question) => isNonEmptyString(question.sectionName))?.sectionName || "";
      const unitGroups = new Map();
      sectionQuestions.forEach((question) => { const key = unitKey(question); if (!unitGroups.has(key)) unitGroups.set(key, []); unitGroups.get(key).push(question); });
      const units = Array.from(unitGroups.entries()).map(([key, unitQuestions]) => {
        const first = unitQuestions[0];
        const unitName = unitQuestions.find((question) => isNonEmptyString(question.unitName))?.unitName || "";
        return { key, section, unit: first.unit, unitId: first.unitId || key, unitName, count: unitQuestions.length };
      }).sort((left, right) => naturalCompare(left.unit, right.unit));
      return { section, sectionName, count: sectionQuestions.length, units };
    });
    return sections;
  }

  function filterQuestionsByCoverage(questions, selectedSections, selectedUnits) {
    const sections = selectedSections instanceof Set ? selectedSections : new Set(selectedSections || []);
    const units = selectedUnits instanceof Set ? selectedUnits : new Set(selectedUnits || []);
    return questions.filter((question) => sections.has(question.section) && units.has(unitKey(question)));
  }

  function selectBalancedQuestions(eligibleQuestions, requestedCount, shouldRandomize = true) {
    const count = Math.max(0, Math.min(Number(requestedCount) || 0, eligibleQuestions.length));
    const groups = new Map();
    eligibleQuestions.forEach((question) => {
      const key = unitKey(question);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(question);
    });
    let queues = Array.from(groups.entries())
      .sort(([left], [right]) => naturalCompare(left, right))
      .map(([key, questions]) => ({ key, questions: shouldRandomize ? fisherYates(questions) : questions.slice(), index: 0 }));
    if (shouldRandomize) queues = fisherYates(queues);

    const selected = [];
    while (selected.length < count) {
      let addedThisRound = false;
      for (const queue of queues) {
        if (selected.length >= count) break;
        if (queue.index < queue.questions.length) {
          selected.push(queue.questions[queue.index]);
          queue.index += 1;
          addedThisRound = true;
        }
      }
      if (!addedThisRound) break;
    }
    return selected;
  }

  function selectQuestionsForExam(eligibleQuestions, requestedCount, options = {}) {
    const count = Math.max(0, Math.min(Number(requestedCount) || 0, eligibleQuestions.length));
    if (!options.randomizeQuestions) return eligibleQuestions.slice(0, count);
    if (options.balancedDistribution) return selectBalancedQuestions(eligibleQuestions, count, true);
    return fisherYates(eligibleQuestions).slice(0, count);
  }

  function parseStructuredPlainText(text) {
    if (typeof text !== "string" || !text.trim()) {
      return { records: [], errors: ["Paste at least one labeled question."], blockCount: 0 };
    }
    const blocks = text.split(/^\s*---\s*$/m).map((block) => block.trim()).filter(Boolean);
    const records = [];
    const errors = [];
    const labelMap = {
      "SECTION": "section",
      "SECTION NAME": "sectionName",
      "UNIT": "unit",
      "UNIT NAME": "unitName",
      "ID": "id",
      "QUESTION": "question",
      "A": "A",
      "B": "B",
      "C": "C",
      "D": "D",
      "ANSWER": "correctAnswer",
      "EXPLANATION": "explanation"
    };

    blocks.forEach((block, blockIndex) => {
      const fields = {};
      let activeField = "";
      block.split(/\r?\n/).forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) return;
        const match = line.match(/^([A-Za-z ]+):\s*(.*)$/);
        if (match && labelMap[match[1].trim().toUpperCase()]) {
          activeField = labelMap[match[1].trim().toUpperCase()];
          fields[activeField] = match[2].trim();
        } else if (activeField && ["question", "explanation"].includes(activeField)) {
          fields[activeField] = `${fields[activeField]} ${line}`.trim();
        } else {
          errors.push(`Question block ${blockIndex + 1}: could not parse line “${line.slice(0, 80)}”.`);
        }
      });
      records.push({
        id: fields.id || "",
        section: fields.section || "",
        sectionName: fields.sectionName || "",
        unit: fields.unit || "",
        unitName: fields.unitName || "",
        question: fields.question || "",
        options: { A: fields.A || "", B: fields.B || "", C: fields.C || "", D: fields.D || "" },
        correctAnswer: fields.correctAnswer || "",
        explanation: fields.explanation || ""
      });
    });
    return { records, errors, blockCount: blocks.length };
  }

  function parseBulkInput(text, mode) {
    if (mode === "text") return parseStructuredPlainText(text);
    try {
      const parsed = JSON.parse(text);
      const records = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.questions) ? parsed.questions : null;
      return records ? { records, errors: [], blockCount: records.length } : { records: [], errors: ["JSON must be an array or an object with a ‘questions’ array."], blockCount: 0 };
    } catch (error) {
      return { records: [], errors: [`Invalid JSON: ${error.message}`], blockCount: 0 };
    }
  }

  function mergeQuestions(currentQuestions, incomingQuestions, strategy = "skip") {
    const incomingById = new Map(incomingQuestions.map((question) => [question.id, question]));
    const currentIds = new Set(currentQuestions.map((question) => question.id));
    const added = incomingQuestions.filter((question) => !currentIds.has(question.id)).length;
    const replaced = strategy === "replace" ? incomingQuestions.length - added : 0;
    const skipped = strategy === "skip" ? incomingQuestions.length - added : 0;
    const retained = strategy === "replace"
      ? currentQuestions.map((question) => incomingById.get(question.id) || question)
      : currentQuestions.slice();
    const newQuestions = incomingQuestions.filter((question) => !currentIds.has(question.id));
    return { questions: [...retained, ...newQuestions], added, replaced, skipped };
  }

  function bankJsonPayload(questions, title = "CMA Question Bank") {
    return { title, exportedAt: new Date().toISOString(), questions: questions.map((question) => deepClone(question)) };
  }

  function persistQuestionBank(name = state.bankName || "Personal CMA question bank") {
    const saved = writeStorage(STORAGE_KEYS.questionBank, { version: 3, name, questions: state.questionBank });
    state.bankStorageUnsaved = !saved;
    if (saved) {
      state.bankSource = "imported";
      state.bankName = name;
      if (globalThis.CMAV2?.captureLegacyBank) {
        Promise.resolve(globalThis.CMAV2.captureLegacyBank(state.questionBank)).catch((error) => console.warn("CMA V2 compatibility sync was deferred.", error));
      }
    }
    return saved;
  }

  function formatDuration(milliseconds, alwaysHours = false) {
    const safeMilliseconds = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
    const totalSeconds = Math.floor(safeMilliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0 || alwaysHours) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function calculateRemainingTime(endTime, now) {
    if (!Number.isFinite(endTime) || !Number.isFinite(now)) return 0;
    return Math.max(0, endTime - now);
  }

  function formatDate(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function average(values) {
    const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
  }

  function fisherYates(values) {
    const shuffled = values.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
  }

  function setMessage(text, type = "success", timeout = 5000) {
    if (!text) {
      dom["global-message"].hidden = true;
      return;
    }
    const message = dom["global-message"];
    message.className = `message message-${type}`;
    message.textContent = text;
    message.hidden = false;
    if (timeout) {
      window.setTimeout(() => {
        if (message.textContent === text) message.hidden = true;
      }, timeout);
    }
  }

  function showScreen(name, options = {}) {
    const id = `${name}-screen`;
    dom.screens = Array.from(document.querySelectorAll(".screen"));
    dom.screens.forEach((screen) => {
      screen.hidden = screen.id !== id;
    });
    state.screen = name;
    document.body.classList.toggle("exam-session-active", name === "exam");
    if (!options.preserveScroll) window.scrollTo(0, 0);
    if (name !== "exam") stopTimerLoop();
    const titleMap = { home: "CMA Exam Simulator", setup: "Configure Exam", "exam-center": "Exam Center", bank: "Question Bank", import: "Question Bank · Import", syllabus: "Question Bank · Sections & Units", history: "Progress", weak: "Progress · Weak Areas", study: "Study", settings: "Settings" };
    document.title = name === "home" ? titleMap.home : `${titleMap[name] || name} | CMA Exam Simulator`;
    const destinationMap = { setup: "exam-center", import: "bank", syllabus: "bank", weak: "progress", history: "progress" };
    if (!["exam", "results", "case-exam", "case-results"].includes(name)) { state.uiPreferences.lastDestination = destinationMap[name] || name; writeStorage(STORAGE_KEYS.uiPreferences, state.uiPreferences); }
    if (name === "exam-center") renderExamModes();
    dom["main-content"].focus({ preventScroll: true });
    updateNavigation();
  }

  function applyTheme(theme) {
    const normalized = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = normalized;
    dom["theme-toggle"].setAttribute("aria-label", `Switch to ${normalized === "dark" ? "light" : "dark"} mode`);
    dom["theme-toggle"].querySelector(".theme-icon").textContent = normalized === "dark" ? "☀" : "☾";
    dom["theme-toggle"].querySelector(".theme-label").textContent = normalized === "dark" ? "Light" : "Dark";
    writeStorage(STORAGE_KEYS.theme, normalized);
  }

  function optionDisplayLabel(question, originalKey) {
    const index = question.optionOrder.indexOf(originalKey);
    return index >= 0 ? OPTION_KEYS[index] : "—";
  }

  function optionDisplayText(question, originalKey) {
    if (!originalKey || !question.options[originalKey]) return "Not answered";
    return `${optionDisplayLabel(question, originalKey)} — ${question.options[originalKey]}`;
  }

  function renderHome() {
    const now = new Date();
    const records = PROGRESS.historyQuestions?.(state.history) || [];
    const lifetime = PROGRESS.metrics?.(records) || { accuracy: null, averageTimeMs: null };
    const comparison = PROGRESS.compare?.(records, { period: "four-weeks", now }) || {};
    const weekly = PROGRESS.weeklySummary?.(state.history, now) || { current: { total: 0, accuracy: null }, comparison: {} };
    const analytics = weakAnalytics();
    const sectionRows = PROGRESS.performanceRows?.(state.history, state.questionBank, "section", { period: "four-weeks", now }) || [];
    const unitRows = PROGRESS.performanceRows?.(state.history, state.questionBank, "unit", { period: "four-weeks", now }) || [];
    const weakest = (analytics.unit || []).filter((item) => item.totalAttempts > 0).sort((a, b) => b.weaknessScore - a.weaknessScore)[0];
    const weakestCatalog = weakest && state.catalog.units.find((unit) => unit.id === weakest.key);
    const due = Object.values(analytics.mastery || {}).filter((item) => item.status !== "Mastered").length;
    const retired = state.questionBank.filter((question) => question.retired).length;
    const unclassified = state.questionBank.filter((question) => ADVANCED.questionClassificationState(question, state.catalog) === "unclassified").length;
    const unexplained = state.questionBank.filter((question) => !isNonEmptyString(question.explanation)).length;

    dom["dashboard-date"].textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(now);
    dom["dashboard-study-week"].textContent = `Week of ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(weekly.weekStart || now))}`;
    dom["dashboard-status-line"].textContent = state.activeExam ? "An active exam is ready to resume." : state.history.length ? "Continue from your latest evidence and review queue." : "Start with a focused test or import your own questions.";
    dom["header-status-line"].textContent = state.activeExam ? "Active exam saved locally" : "Private · Offline · Local";
    dom["home-question-count"].textContent = state.questionBank.length;
    dom["home-bank-active"].textContent = state.questionBank.length - retired;
    dom["home-bank-retired"].textContent = retired;
    dom["home-bank-unclassified"].textContent = unclassified;
    dom["home-bank-unexplained"].textContent = unexplained;
    dom["home-week-time"].textContent = formatStudyTime(weekly.current.timedQuestions ? weekly.current.averageTimeMs * weekly.current.timedQuestions : 0);
    dom["home-week-questions"].textContent = weekly.current.total;
    dom["home-week-accuracy"].textContent = formatMetricPercent(weekly.current.accuracy);
    dom["home-streak"].textContent = `${studyStreakDays(state.history, now)} days`;
    dom["home-weakest-unit"].textContent = weakestCatalog ? `${weakestCatalog.unitCode} — ${weakestCatalog.unitName}` : "Not enough data";
    dom["home-due-count"].textContent = due;
    dom["home-overall-accuracy"].textContent = formatMetricPercent(lifetime.accuracy);
    dom["home-recent-accuracy"].textContent = formatMetricPercent(comparison.recent?.accuracy);
    dom["home-average-time"].textContent = Number.isFinite(lifetime.averageTimeMs) ? `${(lifetime.averageTimeMs / 1000).toFixed(1)} sec` : "—";
    const strongestSection = sectionRows.filter((row) => Number.isFinite(row.lifetime.accuracy)).sort((a, b) => b.lifetime.accuracy - a.lifetime.accuracy)[0];
    dom["home-strongest-section"].textContent = strongestSection ? `Section ${strongestSection.id}` : "—";
    const improvedUnit = unitRows.filter((row) => row.sufficient && Number.isFinite(row.accuracyChangePoints)).sort((a, b) => b.accuracyChangePoints - a.accuracyChangePoints)[0];
    dom["home-improved-unit"].textContent = improvedUnit ? improvedUnit.unitCode || improvedUnit.name : "—";
    dom["home-notes-review"].textContent = Object.values(state.studyData.notes).filter((note) => note?.needsReview).length;
    const mistakes = records.filter((item) => item.status === "Incorrect");
    dom["home-unresolved-mistakes"].textContent = mistakes.filter((item) => !state.studyData.resolvedMistakes[`${item.attemptId}:${item.id}`]).length;
    const staleBefore = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    dom["home-stale-units"].textContent = state.catalog.units.filter((unit) => unit.active && !records.some((item) => item.unitId === unit.id && item.completedMs >= staleBefore)).length;
    dom["no-questions-card"].hidden = state.questionBank.length > 0;
    dom["home-start"].disabled = state.questionBank.length === 0;

    renderMiniSparkline(dom["home-progress-sparkline"], PROGRESS.graphSeries?.(state.history, { groupBy: "week", scopeType: "overall" }) || []);
    const latestContainer = dom["latest-attempt"]; latestContainer.replaceChildren();
    const latest = state.history[0];
    if (!latest) appendText(latestContainer, "p", "muted-empty", "No completed attempts yet.");
    else { appendText(latestContainer, "strong", "", latest.title); appendText(latestContainer, "p", "demo-note", `${formatDate(latest.completedAt)} · ${formatMetricPercent(PROGRESS.metrics(PROGRESS.historyQuestions([latest])).accuracy)} · ${(Number(latest.averageTimeMs || 0) / 1000).toFixed(1)} sec/question`); }
    const recentList = dom["home-recent-attempts"]; recentList.replaceChildren();
    state.history.slice(0, 5).forEach((attempt) => {
      const item = el("div", "recent-attempt-row"); const metric = PROGRESS.metrics(PROGRESS.historyQuestions([attempt])); const change = PROGRESS.attemptComparison(state.history, attempt);
      appendText(item, "span", "", `${formatDate(attempt.completedAt)} · ${attempt.title}`); appendText(item, "strong", "", formatMetricPercent(metric.accuracy)); appendText(item, "small", Number.isFinite(change.accuracyChangePoints) ? `${change.accuracyChangePoints >= 0 ? "+" : ""}${change.accuracyChangePoints.toFixed(1)} points` : "No comparison"); recentList.append(item);
    });
    renderResumeBanner();
  }

  function formatMetricPercent(value) { return Number.isFinite(value) ? `${value.toFixed(1)}%` : "—"; }
  function formatStudyTime(milliseconds) { const minutes = Math.round(Math.max(0, Number(milliseconds) || 0) / 60000); return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`; }
  function studyStreakDays(history, nowValue = new Date()) {
    const days = new Set(history.map((attempt) => dateValueForUi(attempt.completedAt)).filter(Boolean));
    const cursor = new Date(nowValue); cursor.setHours(0, 0, 0, 0);
    if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (days.has(cursor.toISOString().slice(0, 10))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    return streak;
  }
  function dateValueForUi(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10); }

  function renderResumeBanner() {
    const banner = dom["resume-banner"];
    if (!state.activeExam || state.activeExam.submitted) {
      banner.hidden = true;
      if (dom["header-resume"]) dom["header-resume"].hidden = true;
      return;
    }
    banner.hidden = false;
    dom["resume-title"].textContent = state.activeExam.title;
    const answered = Object.values(state.activeExam.answers).filter(Boolean).length;
    const remainingReference = state.activeExam.status === "paused" && Number.isFinite(state.activeExam.pauseStartedAt) ? state.activeExam.pauseStartedAt : Date.now();
    const remaining = calculateRemainingTime(state.activeExam.endTime, remainingReference);
    dom["resume-details"].textContent = `${answered} of ${state.activeExam.questions.length} answered • ${formatDuration(remaining)} remaining`;
    dom["resume-exam"].textContent = remaining > 0 ? "Resume exam" : "Finalize expired exam";
    dom["header-resume"].hidden = false;
    dom["header-resume"].textContent = remaining > 0 ? "Resume exam" : "Finalize exam";
  }

  function modeCandidateQuestions(mode = state.setupMode) {
    const analytics = weakAnalytics();
    const questionMetrics = new Map((analytics.question || []).map((item) => [item.key, item]));
    const unitMetrics = new Map((analytics.unit || []).map((item) => [item.key, item]));
    const mastery = analytics.mastery || {};
    const historyItems = state.history.flatMap((record) => record.perQuestion || []);
    const statusIds = (status) => new Set(historyItems.filter((item) => item.status === status).map((item) => item.id));
    const incorrectIds = statusIds("Incorrect");
    const unansweredIds = statusIds("Unanswered");
    const guessedIds = new Set(historyItems.filter((item) => item.guessed).map((item) => item.id));
    const markedIds = new Set(historyItems.filter((item) => item.marked).map((item) => item.id));
    const includeRetired = mode === "retired" || Boolean(dom["include-retired"]?.checked);
    const includeMastered = mode === "retired" || dom["include-mastered"]?.checked !== false;
    const base = state.questionBank.filter((question) => (includeRetired || !question.retired) && (includeMastered || mastery[question.id]?.status !== "Mastered"));
    if (mode === "standard") return base;
    if (mode === "weak") return base.filter((question) => unitMetrics.get(question.unitId)?.label === "Weak" || unitMetrics.get(question.unitId)?.weaknessScore >= 65);
    if (mode === "strong") return base.filter((question) => unitMetrics.get(question.unitId)?.label === "Strong");
    if (mode === "mixed") {
      const weak = base.filter((question) => unitMetrics.get(question.unitId)?.label === "Weak" || unitMetrics.get(question.unitId)?.weaknessScore >= 65);
      const strong = base.filter((question) => unitMetrics.get(question.unitId)?.label === "Strong");
      return Array.from(new Map([...weak, ...strong].map((question) => [question.id, question])).values());
    }
    if (mode === "incorrect") return base.filter((question) => incorrectIds.has(question.id));
    if (mode === "unanswered") return base.filter((question) => unansweredIds.has(question.id));
    if (mode === "slow") return base.filter((question) => (questionMetrics.get(question.id)?.averageTimeMs || 0) > state.analyticsSettings.targetTimeSeconds * 1000);
    if (mode === "guessed") return base.filter((question) => guessedIds.has(question.id));
    if (mode === "marked") return base.filter((question) => markedIds.has(question.id));
    if (mode === "retired") return state.questionBank.filter((question) => question.retired);
    if (mode === "due") return base.filter((question) => mastery[question.id] && mastery[question.id].status !== "Mastered");
    if (mode === "new") return base.filter((question) => !mastery[question.id]);
    return base;
  }

  function examModeTitle(mode) {
    return ({ standard: "CMA Custom Practice", weak: "Weak Areas Practice", strong: "Strong Areas Test", mixed: "Mixed Strong and Weak", incorrect: "Previously Incorrect Review", unanswered: "Unanswered Questions Review", slow: "Slow Questions Practice", guessed: "Guessed Questions Review", marked: "Flagged Questions Review", retired: "Retired Questions Review", due: "Due Mastery Review", new: "New Questions Practice" })[mode] || "CMA Practice Exam";
  }

  function renderExamModes() {
    document.querySelectorAll("[data-mode-count]").forEach((element) => { element.textContent = modeCandidateQuestions(element.dataset.modeCount).length; });
    document.querySelectorAll("[data-exam-mode]").forEach((button) => { button.disabled = modeCandidateQuestions(button.dataset.examMode).length === 0; });
    if (dom["standard-resume-banner"]) {
      const active = state.activeExam && !state.activeExam.submitted;
      dom["standard-resume-banner"].hidden = !active;
      if (active) {
        dom["standard-resume-title"].textContent = state.activeExam.title;
        const answered = Object.values(state.activeExam.answers || {}).filter(Boolean).length;
        dom["standard-resume-details"].textContent = `${answered} of ${state.activeExam.questions.length} answered · ${formatDuration(calculateRemainingTime(state.activeExam.endTime, state.activeExam.status === "paused" && Number.isFinite(state.activeExam.pauseStartedAt) ? state.activeExam.pauseStartedAt : Date.now()))} remaining`;
      }
    }
  }

  function filteredSetupQuestions() {
    return filterQuestionsByCoverage(modeCandidateQuestions(), state.setupSections, state.setupUnits);
  }

  function discoverSetupStructure() {
    const eligible = modeCandidateQuestions().filter((question) => {
      const section = ADVANCED.findSection?.(state.catalog, question.sectionId || question.section);
      const unit = ADVANCED.findUnit?.(state.catalog, section?.id || "", question.unitId || question.unit);
      return section?.active && unit?.active;
    });
    return discoverBankStructure(eligible);
  }

  function populateSelect(select, values, allLabel, selectedValue = "all") {
    select.replaceChildren();
    const allOption = el("option", "", allLabel);
    allOption.value = "all";
    select.append(allOption);
    values.forEach((value) => {
      const option = el("option", "", value);
      option.value = value;
      select.append(option);
    });
    select.value = values.includes(selectedValue) ? selectedValue : "all";
  }

  function openSetup(mode = "standard") {
    state.setupMode = mode || "standard";
    dom["include-retired"].checked = state.setupMode === "retired";
    dom["include-mastered"].checked = true;
    dom["auto-retire-mastered"].checked = Boolean(state.analyticsSettings.autoRetireMastered);
    dom["remove-fast-questions"].checked = state.analyticsSettings.removeFastQuestions !== false;
    if (modeCandidateQuestions().length === 0) {
      renderBankScreen();
      showScreen("exam-center");
      renderExamModes();
      setMessage("No questions are currently available for that exam mode.", "warning");
      return;
    }
    const structure = discoverSetupStructure();
    state.setupSections = new Set(structure.filter((item) => item.count > 0).map((item) => item.section));
    state.setupUnits = new Set(structure.flatMap((item) => item.units.map((unit) => unit.key)));
    state.setupPreviewSignature = "";
    state.setupPreviewQuestions = [];
    dom["exam-title"].value = examModeTitle(state.setupMode);
    dom["question-count"].value = "all";
    dom["time-limit"].value = "50";
    dom["custom-count-wrap"].hidden = true;
    dom["custom-time-wrap"].hidden = true;
    dom["custom-count"].value = "";
    dom["custom-time"].value = "";
    dom["randomize-questions"].checked = true;
    dom["balanced-distribution"].checked = false;
    dom["balanced-distribution"].disabled = false;
    dom["setup-error"].hidden = true;
    dom["setup-available-count"].textContent = modeCandidateQuestions().length;
    renderCoverageSelector();
    updateSetupSummary();
    showScreen("setup");
  }

  function renderCoverageSelector() {
    const structure = discoverSetupStructure();
    const sectionContainer = dom["coverage-sections"];
    sectionContainer.replaceChildren();
    structure.forEach((item) => {
      const label = el("label", `coverage-choice${item.count ? "" : " is-disabled"}`);
      const input = el("input");
      input.type = "checkbox";
      input.dataset.section = item.section;
      input.checked = state.setupSections.has(item.section);
      input.disabled = item.count === 0;
      const text = el("span");
      appendText(text, "strong", "", sectionDisplayName(item.section, item.sectionName));
      appendText(text, "small", "", `${item.count} question${item.count === 1 ? "" : "s"} • ${input.checked ? "Selected" : "Not selected"}`);
      label.append(input, text);
      sectionContainer.append(label);
    });

    const unitContainer = dom["coverage-units"];
    unitContainer.replaceChildren();
    const selectedStructures = structure.filter((item) => state.setupSections.has(item.section));
    if (!selectedStructures.length) {
      appendText(unitContainer, "p", "muted-empty", "Select at least one section to see its units.");
      return;
    }
    selectedStructures.forEach((sectionItem) => {
      const group = el("section", "unit-group");
      const heading = el("div", "unit-group-heading");
      appendText(heading, "strong", "", sectionDisplayName(sectionItem.section, sectionItem.sectionName));
      const selectButton = el("button", "text-button", "Select all units");
      selectButton.type = "button";
      selectButton.dataset.selectSectionUnits = sectionItem.section;
      heading.append(selectButton);
      group.append(heading);
      sectionItem.units.forEach((unit) => {
        const label = el("label", "coverage-choice");
        const input = el("input");
        input.type = "checkbox";
        input.dataset.unitKey = unit.key;
        input.checked = state.setupUnits.has(unit.key);
        const text = el("span");
        appendText(text, "strong", "", unitDisplayName(unit.unit, unit.unitName));
        appendText(text, "small", "", `${unit.count} question${unit.count === 1 ? "" : "s"} • ${input.checked ? "Selected" : "Not selected"}`);
        label.append(input, text);
        group.append(label);
      });
      unitContainer.append(group);
    });
  }

  function resolveQuestionCount(available) {
    const selected = dom["question-count"].value;
    if (selected === "all") return available;
    if (selected === "custom") return Number(dom["custom-count"].value);
    return Number(selected);
  }

  function resolveTimeMinutes() {
    return dom["time-limit"].value === "custom" ? Number(dom["custom-time"].value) : Number(dom["time-limit"].value);
  }

  function validateSetup() {
    const matching = filteredSetupQuestions();
    const title = dom["exam-title"].value.trim();
    const questionCount = resolveQuestionCount(matching.length);
    const timeMinutes = resolveTimeMinutes();
    const errors = [];

    if (!title) errors.push("Enter an exam title.");
    if (state.setupSections.size === 0) errors.push("Select at least one CMA section.");
    if (state.setupUnits.size === 0) errors.push("Select at least one unit.");
    if (matching.length === 0) errors.push("The selected sections and units contain no questions.");
    if (!Number.isInteger(questionCount) || questionCount <= 0) errors.push("Choose a whole-number question count greater than zero.");
    if (questionCount > matching.length) errors.push(`The question count cannot exceed the ${matching.length} questions matching your filters.`);
    if (!Number.isFinite(timeMinutes) || timeMinutes <= 0) errors.push("Choose a time limit greater than zero.");
    if (timeMinutes > 1440) errors.push("The time limit cannot exceed 1,440 minutes (24 hours).");

    return {
      valid: errors.length === 0,
      errors,
      matching,
      title,
      questionCount,
      timeMinutes,
      selectedSections: Array.from(state.setupSections).sort(naturalCompare),
      selectedUnits: discoverSetupStructure()
        .flatMap((section) => section.units)
        .filter((unit) => state.setupSections.has(unit.section) && state.setupUnits.has(unit.key))
    };
  }

  function rebuildQuestionCountOptions(available) {
    const select = dom["question-count"];
    const previous = select.value || "all";
    select.replaceChildren();
    [10, 25, 50, 75, 100].filter((count) => count <= available).forEach((count) => {
      const option = el("option", "", `${count} questions`);
      option.value = String(count);
      select.append(option);
    });
    const allOption = el("option", "", `All ${available} eligible questions`);
    allOption.value = "all";
    select.append(allOption);
    const customOption = el("option", "", `Custom (up to ${available})`);
    customOption.value = "custom";
    select.append(customOption);
    select.value = Array.from(select.options).some((option) => option.value === previous) ? previous : "all";
    dom["custom-count"].max = String(Math.max(1, available));
    dom["custom-count-wrap"].hidden = select.value !== "custom";
  }

  function getSetupPreviewQuestions(validation, randomizeQuestions, balancedDistribution) {
    const countIsValid = Number.isInteger(validation.questionCount) && validation.questionCount > 0 && validation.questionCount <= validation.matching.length;
    const signature = JSON.stringify({
      eligibleIds: validation.matching.map((question) => question.id),
      questionCount: validation.questionCount,
      randomizeQuestions,
      balancedDistribution
    });
    if (state.setupPreviewSignature !== signature) {
      state.setupPreviewQuestions = countIsValid
        ? selectQuestionsForExam(validation.matching, validation.questionCount, { randomizeQuestions, balancedDistribution })
        : [];
      state.setupPreviewSignature = signature;
    }
    return state.setupPreviewQuestions;
  }

  function updateSetupSummary() {
    const matching = filteredSetupQuestions();
    rebuildQuestionCountOptions(matching.length);
    const validation = validateSetup();
    const questionCount = Number.isFinite(validation.questionCount) && validation.questionCount > 0 ? validation.questionCount : 0;
    const timeMinutes = Number.isFinite(validation.timeMinutes) && validation.timeMinutes > 0 ? validation.timeMinutes : 0;
    const randomized = dom["randomize-questions"].checked;
    dom["balanced-distribution"].disabled = !randomized;
    if (!randomized) dom["balanced-distribution"].checked = false;
    const balanced = randomized && dom["balanced-distribution"].checked;
    const previewQuestions = getSetupPreviewQuestions(validation, randomized, balanced);
    dom["eligible-count-message"].textContent = `${matching.length} question${matching.length === 1 ? " is" : "s are"} available from your selected sections and units.`;
    dom["eligible-count-message"].classList.toggle("is-empty", matching.length === 0);
    dom["setup-start-button"].disabled = matching.length === 0;
    const summary = dom["settings-summary"];
    summary.replaceChildren();
    [
      ["Questions", `${questionCount || "—"} selected from ${matching.length} eligible`],
      ["Time limit", timeMinutes ? `${timeMinutes} minute${timeMinutes === 1 ? "" : "s"}` : "—"],
      ["Sections", validation.selectedSections?.length ? validation.selectedSections.map((section) => `Section ${section}`).join(", ") : "None"],
      ["Units", validation.selectedUnits?.length || 0],
      ["Question order", randomized ? "Randomized" : "Original bank order"],
      ["Unit distribution", balanced ? "Balanced across units" : randomized ? "Random eligible pool" : "Stable bank order"],
      ["Answer choices", dom["shuffle-options"].checked ? "Shuffled" : "Original"],
      ["Fast-question cleanup", dom["remove-fast-questions"].checked ? "Remove answered questions recorded under 30 seconds" : "Off for this exam"]
    ].forEach(([term, description]) => {
      const row = el("div");
      appendText(row, "dt", "", term);
      appendText(row, "dd", "", description);
      summary.append(row);
    });

    const breakdown = dom["settings-breakdown"];
    breakdown.replaceChildren();
    appendText(breakdown, "h3", "", "Planned question mix");
    appendText(
      breakdown,
      "p",
      "summary-note",
      previewQuestions.length
        ? `${previewQuestions.length} question${previewQuestions.length === 1 ? "" : "s"} will be used in the exact section-and-unit mix below.`
        : "Choose a valid question count to preview the section-and-unit mix."
    );
    const structure = discoverBankStructure(previewQuestions);
    structure.filter((section) => section.count > 0).forEach((section) => {
      const details = el("details");
      details.open = structure.filter((item) => item.count > 0).length <= 2;
      const summaryElement = el("summary", "", `${sectionDisplayName(section.section, section.sectionName)} • ${section.count}`);
      const list = el("ul");
      section.units.forEach((unit) => appendText(list, "li", "", `${unitDisplayName(unit.unit, unit.unitName)} — ${unit.count}`));
      details.append(summaryElement, list);
      breakdown.append(details);
    });
  }

  function createActiveExam(validation) {
    const randomizeQuestions = dom["randomize-questions"].checked;
    const balancedDistribution = randomizeQuestions && dom["balanced-distribution"].checked;
    let questions = getSetupPreviewQuestions(validation, randomizeQuestions, balancedDistribution);
    questions = questions.map((question) => ({
      ...deepClone(question),
      // Save this order with the active attempt so revisits and refreshes never
      // reshuffle choices or alter their stable original keys.
      optionOrder: dom["shuffle-options"].checked ? fisherYates(OPTION_KEYS) : OPTION_KEYS.slice()
    }));

    const now = Date.now();
    const durationSeconds = Math.max(1, Math.round(validation.timeMinutes * 60));
    return {
      version: 3,
      id: createId("attempt"),
      title: validation.title,
      durationSeconds,
      settings: {
        selectedSections: validation.selectedSections,
        selectedUnits: validation.selectedUnits.map((unit) => ({ section: unit.section, unit: unit.unit, unitName: unit.unitName })),
        eligibleQuestionCount: validation.matching.length,
        selectedQuestionCount: validation.questionCount,
        randomizeQuestions,
        balancedDistribution,
        questionOrder: randomizeQuestions ? "random" : "original",
        shuffleOptions: dom["shuffle-options"].checked,
        confirmSubmit: dom["confirm-submit"].checked,
        allowReview: dom["allow-review"].checked,
        unansweredWarning: dom["unanswered-warning"].checked,
        mode: state.setupMode,
        includeRetired: dom["include-retired"].checked,
        includeMastered: dom["include-mastered"].checked,
        autoRetireMastered: dom["auto-retire-mastered"].checked,
        removeFastQuestions: dom["remove-fast-questions"].checked,
        fastQuestionRemovalSeconds: FAST_QUESTION_REMOVAL_SECONDS
      },
      questions,
      questionIds: questions.map((question) => question.id),
      answers: {},
      marked: {},
      guessed: {},
      timesMs: questions.reduce((result, question) => {
        result[question.id] = 0;
        return result;
      }, {}),
      currentIndex: 0,
      startTime: now,
      endTime: now + durationSeconds * 1000,
      visitStartedAt: now,
      status: "active",
      submitted: false,
      pauseReasons: { manualPause: false, noteEditor: false, hiddenTab: false, systemDialog: false },
      pauseReasonStartedAt: {},
      pauseStartedAt: null,
      totalPausedMs: 0,
      manualPausedMs: 0,
      notePausedMs: 0,
      hiddenPausedMs: 0
    };
  }

  function startExamFromSetup(event) {
    event.preventDefault();
    const validation = validateSetup();
    if (!validation.valid) {
      dom["setup-error"].textContent = validation.errors.join(" ");
      dom["setup-error"].hidden = false;
      dom["setup-error"].focus?.();
      return;
    }
    dom["setup-error"].hidden = true;
    state.activeExam = createActiveExam(validation);
    saveActiveExam();
    enterExamScreen();
  }

  function saveActiveExam() {
    if (!state.activeExam || state.activeExam.submitted) return;
    writeStorage(STORAGE_KEYS.activeExam, state.activeExam);
  }

  function renderBankScreen() {
    const questions = state.questionBank;
    const structure = discoverBankStructure(questions);
    const populatedSections = structure.filter((section) => section.count > 0);
    const units = structure.flatMap((section) => section.units);
    const duplicateCount = questions.length - new Set(questions.map((question) => question.id)).size;
    const explainedCount = questions.filter((question) => isNonEmptyString(question.explanation)).length;
    dom["bank-question-count"].textContent = questions.length;
    dom["bank-summary-count"].textContent = questions.length;
    dom["bank-active-count"].textContent = questions.filter((question) => !question.retired).length;
    dom["bank-retired-count"].textContent = questions.filter((question) => question.retired).length;
    dom["bank-section-count"].textContent = populatedSections.length;
    dom["bank-explained-count"].textContent = explainedCount;
    dom["bank-missing-explanation-count"].textContent = questions.length - explainedCount;
    dom["bank-duplicate-count"].textContent = duplicateCount;
    dom["bank-invalid-count"].textContent = 0;
    const analytics = weakAnalytics();
    const classifiedCount = questions.filter((question) => ADVANCED.questionClassificationState(question, state.catalog) !== "unclassified").length;
    dom["bank-classified-count"].textContent = classifiedCount;
    dom["bank-unclassified-count"].textContent = questions.length - classifiedCount;
    dom["bank-mastered-count"].textContent = Object.values(analytics.mastery).filter((item) => item.status === "Mastered").length;
    dom["bank-source"].textContent = state.bankStorageUnsaved ? "Unsaved in-memory bank" : state.bankSource === "demonstration" ? "Demonstration bank" : state.bankSource === "imported" ? state.bankName : "No bank loaded";
    dom["bank-sections"].textContent = populatedSections.length ? populatedSections.map((section) => `Section ${section.section}`).join(", ") : "—";
    dom["bank-units"].textContent = units.length || "—";
    const bytes = new Blob([JSON.stringify(questions)]).size;
    dom["bank-storage-size"].textContent = bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    dom["bank-storage-alert"].hidden = !state.bankStorageUnsaved;
    dom["bank-storage-alert"].textContent = state.bankStorageUnsaved
      ? "This bank is available in memory, but browser storage could not save it. Export a complete JSON backup before closing this page."
      : "";
    dom["clear-bank"].disabled = questions.length === 0;
    renderBankStructure(structure);
    renderReferenceStructure();
    renderBankExportCoverage(structure);
    populateBankFilters(structure);
    renderBankQuestionTable();
    setBankPane(state.bankPane);
  }

  function setBankPane(pane) {
    const validPanes = new Set(["browse", "import", "catalog", "export"]);
    state.bankPane = validPanes.has(pane) ? pane : "browse";
    document.querySelectorAll("[data-bank-pane]").forEach((panel) => { panel.hidden = panel.dataset.bankPane !== state.bankPane; });
    const activeButton = { browse: "bank-tab-browse", import: "bank-tab-import", catalog: "bank-tab-syllabus", export: "bank-tab-export" }[state.bankPane];
    document.querySelectorAll(".bank-tabs button").forEach((button) => {
      if (button.id === activeButton) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function renderBankStructure(structure) {
    const container = dom["bank-structure"];
    container.replaceChildren();
    const populated = structure.filter((section) => section.count > 0);
    if (!populated.length) {
      appendText(container, "p", "muted-empty", "No valid sections or units are loaded.");
      return;
    }
    populated.forEach((section) => {
      const details = el("details");
      details.open = populated.length <= 3;
      const summary = el("summary", "", `${sectionDisplayName(section.section, section.sectionName)} — ${section.count} question${section.count === 1 ? "" : "s"}`);
      const list = el("ul");
      section.units.forEach((unit) => appendText(list, "li", "", `${unitDisplayName(unit.unit, unit.unitName)} — ${unit.count} question${unit.count === 1 ? "" : "s"}`));
      details.append(summary, list);
      container.append(details);
    });
  }

  function referenceNameChanges(questions = state.questionBank) {
    return questions.reduce((count, question) => {
      const sectionName = referenceSectionName(question.section);
      const unit = referenceUnit(question.section, question.unit);
      const sectionDiffers = sectionName && question.sectionName !== sectionName;
      const unitDiffers = unit && question.unitName !== unit.unitName;
      return count + (sectionDiffers || unitDiffers ? 1 : 0);
    }, 0);
  }

  function applyReferenceNamesToQuestions(questions) {
    return questions.map((question) => {
      const sectionName = referenceSectionName(question.section);
      const unit = referenceUnit(question.section, question.unit);
      return {
        ...question,
        sectionName: sectionName || question.sectionName,
        unitName: unit?.unitName || question.unitName
      };
    });
  }

  function renderReferenceStructure() {
    const container = dom["reference-structure"];
    container.replaceChildren();
    SECTION_KEYS.forEach((section) => {
      const reference = CMA_2025_REFERENCE[section];
      if (!reference) return;
      const sectionQuestions = state.questionBank.filter((question) => question.section === section);
      const details = el("details");
      details.open = section === "A";
      const summary = el(
        "summary",
        "",
        `${sectionDisplayName(section, reference.sectionName)} — ${reference.units.length} Study Units • ${sectionQuestions.length} question${sectionQuestions.length === 1 ? "" : "s"} loaded`
      );
      const list = el("ol", "reference-unit-list");
      reference.units.forEach((unit) => {
        const count = sectionQuestions.filter((question) => unitKey(question) === unitKey(section, unit.unit)).length;
        const item = el("li");
        appendText(item, "strong", "", `${unit.unit} (${unit.outline})`);
        appendText(item, "span", "", unit.unitName);
        appendText(item, "span", `reference-unit-count${count ? "" : " is-empty"}`, `${count} loaded`);
        list.append(item);
      });
      details.append(summary, list);
      container.append(details);
    });

    const changes = referenceNameChanges();
    const status = dom["reference-name-status"];
    const button = dom["apply-reference-names"];
    status.className = `message ${changes ? "message-warning" : "message-success"}`;
    status.textContent = state.questionBank.length === 0
      ? "The 2025 reference is loaded. Add questions to compare and apply its names."
      : changes
        ? `${changes} question${changes === 1 ? " has" : "s have"} section or unit names that differ from the 2025 reference.`
        : "The current bank already uses the 2025 reference names for every matching standard unit.";
    button.disabled = changes === 0;
    button.textContent = changes ? `Apply 2025 names to ${changes} question${changes === 1 ? "" : "s"}` : "2025 names already applied";
  }

  async function applyReferenceNamesToBank() {
    const changes = referenceNameChanges();
    if (!changes) return;
    const confirmed = await askConfirmation(
      "Apply the 2025 section and unit names?",
      `This will replace friendly section or unit names on ${changes} matching question${changes === 1 ? "" : "s"}. IDs, question text, answers, and explanations will not change.`,
      "Apply 2025 names"
    );
    if (!confirmed) return;
    state.questionBank = applyReferenceNamesToQuestions(state.questionBank);
    const saved = persistQuestionBank(state.bankName || "Personal CMA question bank");
    renderBankScreen();
    renderHome();
    setMessage(
      saved
        ? `Applied the 2025 reference names to ${changes} question${changes === 1 ? "" : "s"}.`
        : "The 2025 names are applied in memory, but browser storage failed. Export a backup before closing.",
      saved ? "success" : "warning",
      7000
    );
  }

  function renderBankExportCoverage(structure) {
    const availableSections = new Set(structure.filter((section) => section.count > 0).map((section) => section.section));
    const availableUnits = new Set(structure.flatMap((section) => section.units.map((unit) => unit.key)));
    state.bankExportSections = new Set(Array.from(state.bankExportSections).filter((section) => availableSections.has(section)));
    state.bankExportUnits = new Set(Array.from(state.bankExportUnits).filter((key) => availableUnits.has(key)));
    if (!state.bankExportInitialized) {
      state.bankExportSections = new Set(availableSections);
      state.bankExportUnits = new Set(availableUnits);
      state.bankExportInitialized = true;
    }

    const sections = dom["bank-export-sections"];
    sections.replaceChildren();
    structure.filter((section) => section.count > 0).forEach((section) => {
      const label = el("label", "coverage-choice");
      const input = el("input");
      input.type = "checkbox";
      input.dataset.exportSection = section.section;
      input.checked = state.bankExportSections.has(section.section);
      const text = el("span");
      appendText(text, "strong", "", `Section ${section.section}`);
      appendText(text, "small", "", `${section.count} questions`);
      label.append(input, text);
      sections.append(label);
    });

    const units = dom["bank-export-units"];
    units.replaceChildren();
    structure.forEach((section) => section.units.forEach((unit) => {
      const label = el("label", "coverage-choice");
      const input = el("input");
      input.type = "checkbox";
      input.dataset.exportUnit = unit.key;
      input.checked = state.bankExportUnits.has(unit.key);
      const text = el("span");
      appendText(text, "strong", "", `${section.section} • ${unit.unit}`);
      appendText(text, "small", "", `${unit.unitName || "No unit name"} • ${unit.count}`);
      label.append(input, text);
      units.append(label);
    }));
  }

  function populateBankFilters(structure = discoverBankStructure()) {
    const sectionSelect = dom["bank-section-filter"];
    const currentSection = state.bankSectionFilter;
    sectionSelect.replaceChildren();
    const allSections = el("option", "", "All sections");
    allSections.value = "all";
    sectionSelect.append(allSections);
    structure.filter((item) => item.count > 0).forEach((item) => {
      const option = el("option", "", sectionDisplayName(item.section, item.sectionName));
      option.value = item.section;
      sectionSelect.append(option);
    });
    sectionSelect.value = Array.from(sectionSelect.options).some((option) => option.value === currentSection) ? currentSection : "all";
    state.bankSectionFilter = sectionSelect.value;

    const unitSelect = dom["bank-unit-filter"];
    const currentUnit = state.bankUnitFilter;
    unitSelect.replaceChildren();
    const allUnits = el("option", "", "All units");
    allUnits.value = "all";
    unitSelect.append(allUnits);
    structure.filter((section) => state.bankSectionFilter === "all" || section.section === state.bankSectionFilter).forEach((section) => {
      section.units.forEach((unit) => {
        const option = el("option", "", `${section.section} • ${unitDisplayName(unit.unit, unit.unitName)}`);
        option.value = unit.key;
        unitSelect.append(option);
      });
    });
    unitSelect.value = Array.from(unitSelect.options).some((option) => option.value === currentUnit) ? currentUnit : "all";
    state.bankUnitFilter = unitSelect.value;
  }

  function getFilteredBankQuestions() {
    const query = state.bankSearch.trim().toLowerCase();
    const mastery = weakAnalytics().mastery;
    const incorrectRecords = (PROGRESS.historyQuestions?.(state.history) || []).filter((item) => item.status === "Incorrect");
    const mistakeIds = new Set(incorrectRecords.map((item) => item.id));
    const unresolvedIds = new Set(incorrectRecords.filter((item) => !state.studyData.resolvedMistakes[`${item.attemptId}:${item.id}`]).map((item) => item.id));
    return state.questionBank.filter((question) => {
      const sectionMatches = state.bankSectionFilter === "all" || question.section === state.bankSectionFilter;
      const unitMatches = state.bankUnitFilter === "all" || unitKey(question) === state.bankUnitFilter;
      const difficultyMatches = state.bankDifficultyFilter === "all" || question.difficulty === state.bankDifficultyFilter;
      const classificationState = ADVANCED.questionClassificationState(question, state.catalog) === "unclassified" ? "unclassified" : "classified";
      const classificationMatches = state.bankClassificationFilter === "all" || classificationState === state.bankClassificationFilter;
      const masteryState = mastery[question.id]?.status || "New";
      const masteryMatches = state.bankMasteryFilter === "all" || masteryState === state.bankMasteryFilter;
      const statusMatches = state.bankStatusFilter === "all" || (state.bankStatusFilter === "retired" ? question.retired : !question.retired);
      const mistakeMatches = state.bankMistakeFilter === "all" || (state.bankMistakeFilter === "has" ? mistakeIds.has(question.id) : unresolvedIds.has(question.id));
      const unitNote = state.studyData.notes[question.unitId || unitKey(question)];
      const noteMatches = state.bankNoteFilter === "all" || (state.bankNoteFilter === "has" ? Boolean(unitNote?.text?.trim()) : Boolean(unitNote?.needsReview));
      const searchText = [question.id, question.question, question.section, question.sectionName, question.unit, question.unitName, question.topic, question.source, ...(question.tags || [])].join(" ").toLowerCase();
      return sectionMatches && unitMatches && difficultyMatches && classificationMatches && masteryMatches && statusMatches && mistakeMatches && noteMatches && (!query || searchText.includes(query));
    });
  }

  function renderBankQuestionTable() {
    const filtered = getFilteredBankQuestions();
    const totalPages = Math.max(1, Math.ceil(filtered.length / BANK_PAGE_SIZE));
    state.bankPage = Math.min(Math.max(1, state.bankPage), totalPages);
    const start = (state.bankPage - 1) * BANK_PAGE_SIZE;
    const pageQuestions = filtered.slice(start, start + BANK_PAGE_SIZE);
    const body = dom["bank-question-list"];
    body.replaceChildren();
    const mastery = weakAnalytics().mastery;
    pageQuestions.forEach((question) => {
      const row = el("tr");
      const selectCell = el("td"); const selection = el("input"); selection.type = "checkbox"; selection.dataset.bankSelect = question.id; selection.checked = state.selectedBankQuestions.has(question.id); selectCell.append(selection); row.append(selectCell);
      appendText(row, "td", "", question.id);
      appendText(row, "td", "", sectionDisplayName(question));
      appendText(row, "td", "", unitDisplayName(question));
      appendText(row, "td", "", question.difficulty || "Medium");
      const classification = ADVANCED.questionClassificationState(question, state.catalog) === "unclassified" ? "Unclassified" : "Classified"; const classificationCell = el("td"); appendText(classificationCell, "span", `badge ${classification.toLowerCase()}`, classification); row.append(classificationCell);
      const masteryState = mastery[question.id]?.status || "New"; const masteryCell = el("td"); appendText(masteryCell, "span", `badge ${masteryState}`, masteryState); row.append(masteryCell);
      appendText(row, "td", "", question.question);
      appendText(row, "td", "", question.explanation ? "Included" : "Missing");
      const actions = el("td");
      const actionRow = el("div", "table-action-row");
      [["view", "View"], ["edit", "Edit"], ["duplicate", "Duplicate"], [question.retired ? "restore" : "retire", question.retired ? "Restore" : "Retire"], ["delete", "Delete"]].forEach(([action, label]) => {
        const button = el("button", `button small-button ${action === "delete" ? "button-danger-quiet" : "button-secondary"}`, label);
        button.type = "button";
        button.dataset.bankAction = action;
        button.dataset.questionId = question.id;
        actionRow.append(button);
      });
      actions.append(actionRow);
      row.append(actions);
      body.append(row);
    });
    if (!pageQuestions.length) {
      const row = el("tr");
      const cell = el("td", "empty-row-message", "No questions match the current search and filters.");
      cell.colSpan = 10;
      row.append(cell);
      body.append(row);
    }
    dom["bank-filter-summary"].textContent = `${filtered.length} of ${state.questionBank.length} questions match. Showing ${pageQuestions.length ? `${start + 1}–${start + pageQuestions.length}` : "0"}.`;
    dom["bank-page-status"].textContent = `Page ${state.bankPage} of ${totalPages}`;
    dom["bank-previous-page"].disabled = state.bankPage <= 1;
    dom["bank-next-page"].disabled = state.bankPage >= totalPages;
    dom["export-section-bank"].disabled = state.bankExportSections.size === 0;
    dom["export-unit-bank"].disabled = state.bankExportUnits.size === 0;
    dom["export-filtered-bank"].disabled = filtered.length === 0;
    dom["export-complete-bank"].disabled = state.questionBank.length === 0;
    dom["bank-selection-count"].textContent = `${state.selectedBankQuestions.size} selected`;
    dom["bank-selected-count"].textContent = state.selectedBankQuestions.size;
  }

  function reviewBankDuplicates() {
    setBankPane("browse");
    const matches = [];
    const exactText = new Map();
    const prefixBuckets = new Map();
    state.questionBank.forEach((question) => {
      const normalized = ADVANCED.normalizeQuestionText(question.question);
      const exact = exactText.get(normalized);
      const prefix = normalized.split(" ").slice(0, 5).join(" ");
      const bucket = prefixBuckets.get(prefix) || [];
      const near = exact ? null : bucket.map((candidate) => ({ id: candidate.id, score: ADVANCED.similarity(question.question, candidate.question) })).filter((item) => item.score >= 0.82).sort((left, right) => right.score - left.score)[0];
      if (exact || near) matches.push({ id: question.id, exact: exact?.id || "", near });
      if (!exact) exactText.set(normalized, question);
      bucket.push(question);
      prefixBuckets.set(prefix, bucket);
    });
    if (!matches.length) setMessage("Duplicate review found no exact-text or near-text matches in the current bank.", "success", 8000);
    else setMessage(`Duplicate review found ${matches.length} possible match${matches.length === 1 ? "" : "es"}. First matches: ${matches.slice(0, 8).map((item) => `${item.id} ↔ ${item.exact || item.near.id}`).join(", ")}. Use search and View/Edit to review them.`, "warning", 12000);
    dom["question-manager-title"].scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderBulkValidation(validation, parseErrors = []) {
    const summary = dom["bulk-validation-summary"];
    summary.replaceChildren();
    [
      ["Parsed", validation.validCount + validation.invalidCount],
      ["Valid", validation.validCount],
      ["Invalid", validation.invalidCount + parseErrors.length],
      ["Existing IDs", validation.duplicateIds.length],
      ["Auto-upgrade", validation.upgradedCount || 0],
      ["New catalog units", validation.addedCatalogUnits || 0]
    ].forEach(([label, value]) => {
      const item = el("div");
      appendText(item, "span", "", label);
      appendText(item, "strong", "", value);
      summary.append(item);
    });
    summary.hidden = false;

    const errors = [...parseErrors, ...validation.errors];
    const errorContainer = dom["bulk-validation-errors"];
    errorContainer.replaceChildren();
    if (errors.length) {
      appendText(errorContainer, "h3", "", `Correct ${errors.length} issue${errors.length === 1 ? "" : "s"} before adding`);
      const list = el("ul");
      errors.forEach((error) => appendText(list, "li", "", error));
      errorContainer.append(list);
      errorContainer.hidden = false;
    } else {
      errorContainer.hidden = true;
    }

    const preview = dom["bulk-preview"];
    preview.replaceChildren();
    if (validation.questions.length) {
      appendText(preview, "h3", "", `Previewing ${Math.min(20, validation.questions.length)} of ${validation.questions.length} valid questions`);
      const list = el("div", "bulk-preview-list");
      validation.questions.slice(0, 20).forEach((question) => {
        const item = el("div", "bulk-preview-item");
        appendText(item, "strong", "", question.question);
        appendText(item, "span", "", `${question.id} • ${sectionDisplayName(question)} • ${unitDisplayName(question)}`);
        list.append(item);
      });
      preview.append(list);
      preview.hidden = false;
    } else {
      preview.hidden = true;
    }
    dom["add-bulk"].disabled = errors.length > 0 || validation.questions.length === 0;
  }

  async function validateBulkQuestions() {
    dom["bulk-processing"].className = "message";
    dom["bulk-processing"].textContent = "Processing and validating pasted questions…";
    dom["bulk-processing"].hidden = false;
    dom["add-bulk"].disabled = true;
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
    const parsed = parseBulkInput(dom["bulk-input"].value, dom["bulk-input-mode"].value);
    const validation = prepareQuestionImport(parsed.records, { existingIds: state.questionBank.map((question) => question.id) });
    state.bulkValidation = { ...validation, parseErrors: parsed.errors };
    renderBulkValidation(validation, parsed.errors);
    dom["bulk-processing"].hidden = true;
  }

  async function addValidatedBulkQuestions() {
    const validation = state.bulkValidation;
    if (!validation || validation.errors.length || validation.parseErrors.length || !validation.questions.length) return;
    const strategy = dom["bulk-duplicate-strategy"].value;
    const merged = mergeQuestions(state.questionBank, validation.questions, strategy);
    state.questionBank = merged.questions;
    state.catalog = validation.catalog;
    state.bankSource = "imported";
    state.bankName = "Personal CMA question bank";
    const saved = persistQuestionBank(state.bankName);
    persistAdvancedState();
    await DURABLE_STORAGE?.flush?.();
    renderBankScreen();
    renderHome();
    dom["bulk-processing"].className = `message ${saved ? "message-success" : "message-warning"}`;
    dom["bulk-processing"].textContent = `Added ${merged.added}, replaced ${merged.replaced}, and skipped ${merged.skipped}. The bank now contains ${state.questionBank.length} questions.${validation.upgradedCount ? ` Automatically upgraded ${validation.upgradedCount} record${validation.upgradedCount === 1 ? "" : "s"} to schema v3.` : ""}${validation.addedCatalogUnits ? ` Added ${validation.addedCatalogUnits} previously unknown unit${validation.addedCatalogUnits === 1 ? "" : "s"} to the catalog.` : ""}${saved ? " Saved to large local storage." : " Export a backup before closing."}`;
    dom["bulk-processing"].hidden = false;
    dom["add-bulk"].disabled = true;
    state.bulkValidation = null;
  }

  async function handleBankFile(event) {
    const file = event.target.files?.[0];
    state.bankFileValidation = null;
    dom["selected-file-name"].textContent = file ? file.name : "No file selected";
    dom["import-status"].hidden = true;
    dom["validation-errors"].hidden = true;
    dom["add-bank-file"].disabled = true;
    dom["replace-bank-file"].disabled = true;
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      showValidationErrors(["Select a file with a .json extension."]);
      return;
    }

    try {
      const status = dom["import-status"];
      status.className = "message";
      status.textContent = "Reading and validating the complete question bank…";
      status.hidden = false;
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        showValidationErrors([`The file is not valid JSON: ${error.message}`]);
        return;
      }
      const validation = prepareQuestionImport(parsed);
      if (!validation.valid) {
        showValidationErrors(validation.errors);
        return;
      }

      state.bankFileValidation = { ...validation, fileName: file.name };
      dom["validation-errors"].hidden = true;
      const sections = uniqueSorted(validation.questions.map((question) => question.section));
      const units = uniqueSorted(validation.questions.map((question) => unitKey(question)));
      const existingIds = new Set(state.questionBank.map((question) => question.id));
      const newCount = validation.questions.filter((question) => !existingIds.has(question.id)).length;
      const duplicateCount = validation.questions.length - newCount;
      status.className = "message message-success";
      status.textContent = `Validated ${validation.questions.length} questions from ${sections.length} section${sections.length === 1 ? "" : "s"} and ${units.length} unit${units.length === 1 ? "" : "s"}. ${newCount} ${newCount === 1 ? "is" : "are"} new and ${duplicateCount} ${duplicateCount === 1 ? "has an ID" : "have IDs"} already in your bank. Choose Add questions to keep the existing bank.`;
      status.hidden = false;
      dom["add-bank-file"].disabled = newCount === 0;
      dom["replace-bank-file"].disabled = false;
    } catch (error) {
      showValidationErrors(["The selected file could not be read. Choose the file again or check its permissions."]);
      console.warn("CMA Exam Simulator: file read failed.", error);
    }
  }

  function clearBankFileSelection() {
    state.bankFileValidation = null;
    dom["bank-file"].value = "";
    dom["selected-file-name"].textContent = "No file selected";
    dom["add-bank-file"].disabled = true;
    dom["replace-bank-file"].disabled = true;
  }

  async function commitBankFileImport(mode) {
    const validation = state.bankFileValidation;
    if (!validation?.valid || !validation.questions.length) return;
    if (mode === "replace") {
      const confirmed = await askConfirmation(
        "Replace the entire question bank?",
        `All ${state.questionBank.length} current questions will be removed and replaced with ${validation.questions.length} questions from ${validation.fileName}. Exam history will remain available.`,
        "Replace entire bank"
      );
      if (!confirmed) return;
    }

    const previousCount = state.questionBank.length;
    const merged = mode === "replace"
      ? { questions: validation.questions, added: validation.questions.length, replaced: previousCount, skipped: 0 }
      : mergeQuestions(state.questionBank, validation.questions, "skip");
    state.questionBank = merged.questions;
    state.catalog = validation.catalog;
    state.bankExportInitialized = false;
    state.bankSource = "imported";
    state.bankName = mode === "replace" ? validation.fileName : "Personal CMA question bank";
    const saved = persistQuestionBank(state.bankName);
    persistAdvancedState();
    await DURABLE_STORAGE?.flush?.();
    renderBankScreen();
    renderHome();

    const status = dom["import-status"];
    status.className = `message ${saved ? "message-success" : "message-warning"}`;
    status.textContent = mode === "replace"
      ? `Replaced the previous ${previousCount}-question bank with ${state.questionBank.length} questions.${saved ? " The new bank is saved and will remain after refresh." : " Storage was unavailable; export a backup before closing."}`
      : `Added ${merged.added} new question${merged.added === 1 ? "" : "s"} and kept all ${previousCount} existing questions. ${merged.skipped} duplicate ID${merged.skipped === 1 ? " was" : "s were"} skipped. The bank now contains ${state.questionBank.length} questions.${saved ? " Saved successfully and ready to survive refresh." : " Storage was unavailable; export a backup before closing."}`;
    status.hidden = false;
    clearBankFileSelection();
  }

  function showValidationErrors(errors) {
    const container = dom["validation-errors"];
    container.replaceChildren();
    appendText(container, "h3", "", `Import rejected — ${errors.length} issue${errors.length === 1 ? "" : "s"}`);
    const list = el("ul");
    errors.forEach((error) => appendText(list, "li", "", error));
    container.append(list);
    container.hidden = false;
    dom["import-status"].hidden = true;
  }

  async function restoreDemoQuestions() {
    const prepared = prepareQuestionImport(DEMO_QUESTIONS);
    state.catalog = prepared.catalog;
    state.questionBank = prepared.questions;
    state.bankExportInitialized = false;
    state.bankSource = "demonstration";
    state.bankName = "Included demonstration bank";
    state.bankStorageUnsaved = false;
    persistQuestionBank(state.bankName);
    persistAdvancedState();
    await DURABLE_STORAGE?.flush?.();
    renderBankScreen();
    renderHome();
    setMessage(`Restored ${state.questionBank.length} demonstration questions.`, "success");
  }

  async function clearImportedBank() {
    if (!state.questionBank.length) return;
    const confirmed = await askConfirmation(
      "Clear the complete question bank?",
      "The bank will be removed from this browser. Your completed exam history will not be affected.",
      "Clear question bank"
    );
    if (!confirmed) return;
    state.questionBank = [];
    state.bankExportInitialized = false;
    state.bankSource = "empty";
    state.bankName = "";
    state.bankStorageUnsaved = false;
    writeStorage(STORAGE_KEYS.questionBank, { cleared: true });
    await DURABLE_STORAGE?.flush?.();
    renderBankScreen();
    renderHome();
    setMessage("The imported question bank was cleared. Restore the demonstration bank or import another file to start an exam.", "warning");
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadTemplate() {
    const template = {
      title: "My CMA Question Bank",
      questions: [
        {
          id: "B-U18-001",
          section: "B",
          sectionName: "Corporate Finance",
          unit: "Unit 18",
          unitName: "Forward and Future Contracts",
          question: "Which statement correctly describes a futures contract?",
          options: { A: "It is always privately negotiated", B: "It is standardized and exchange-traded", C: "It cannot be used for hedging", D: "It has no daily settlement" },
          correctAnswer: "B",
          explanation: "Futures contracts are standardized and traded on organized exchanges."
        },
        {
          id: "E-U05-001",
          section: "E",
          sectionName: "Capital Investment Decisions",
          unit: "Unit 5",
          unitName: "Capital Investment Analysis Methods: Other Topics",
          question: "Which item is normally excluded from a capital investment analysis?",
          options: { A: "Opportunity cost", B: "Incremental working capital", C: "Sunk cost", D: "After-tax salvage value" },
          correctAnswer: "C",
          explanation: "A sunk cost has already been incurred and is not affected by the current decision."
        },
        {
          id: "F-U01-001",
          section: "F",
          sectionName: "Professional Ethics",
          unit: "Unit 1",
          unitName: "Business Ethics",
          question: "What is an appropriate first step when an ethical issue cannot be resolved informally?",
          options: { A: "Ignore the issue", B: "Alter the supporting records", C: "Use established organizational escalation channels", D: "Disclose all information publicly" },
          correctAnswer: "C",
          explanation: "Established policies and appropriate internal escalation channels should normally be followed, subject to legal obligations."
        }
      ]
    };
    downloadFile("question-bank-template.json", `${JSON.stringify(template, null, 2)}\n`, "application/json");
  }

  function downloadBulkPasteTemplate() {
    const template = `SECTION: B
SECTION NAME: Corporate Finance
UNIT: Unit 18
UNIT NAME: Forward and Future Contracts
ID: B-U18-001
QUESTION: Which statement correctly describes a futures contract?
A: It is always privately negotiated
B: It is standardized and exchange-traded
C: It cannot be used for hedging
D: It has no daily settlement
ANSWER: B
EXPLANATION: Futures contracts are standardized and traded on organized exchanges.

---

SECTION: E
SECTION NAME: Capital Investment Decisions
UNIT: Unit 5
UNIT NAME: Capital Investment Analysis Methods: Other Topics
ID: E-U05-001
QUESTION: Which item is normally excluded from a capital investment analysis?
A: Opportunity cost
B: Incremental working capital
C: Sunk cost
D: After-tax salvage value
ANSWER: C
EXPLANATION: A sunk cost has already been incurred and is not affected by the current decision.
`;
    downloadFile("bulk-question-paste-template.txt", template, "text/plain;charset=utf-8");
  }

  function exportQuestionSubset(type) {
    let questions = [];
    let suffix = type;
    if (type === "complete") questions = state.questionBank;
    if (type === "section") questions = state.questionBank.filter((question) => state.bankExportSections.has(question.section));
    if (type === "unit") questions = state.questionBank.filter((question) => state.bankExportUnits.has(unitKey(question)));
    if (type === "filtered") questions = getFilteredBankQuestions();
    if (!questions.length) {
      setMessage("No questions match that export selection.", "warning");
      return;
    }
    const payload = bankJsonPayload(questions, `CMA Question Bank — ${suffix}`);
    downloadFile(`cma-question-bank-${suffix}.json`, `${JSON.stringify(payload, null, 2)}\n`, "application/json");
    setMessage(`Exported ${questions.length} question${questions.length === 1 ? "" : "s"} as directly importable JSON.`, "success");
  }

  function openQuestionView(id) {
    const question = state.questionBank.find((item) => item.id === id);
    if (!question) return;
    dom["question-view-title"].textContent = question.id;
    dom["question-view-meta"].textContent = `${sectionDisplayName(question)} • ${unitDisplayName(question)}`;
    dom["question-view-text"].textContent = question.question;
    dom["question-view-explanation"].textContent = question.explanation || "No explanation was provided.";
    const options = dom["question-view-options"];
    options.replaceChildren();
    OPTION_KEYS.forEach((key) => {
      const item = el("div", `review-option${key === question.correctAnswer ? " correct-option" : ""}`);
      appendText(item, "strong", "", key);
      appendText(item, "span", "", question.options[key]);
      if (key === question.correctAnswer) appendText(item, "span", "review-label correct", "Correct Answer");
      options.append(item);
    });
    dom["question-view-dialog"].showModal();
  }

  function nextCopyId(id) {
    let counter = 1;
    let candidate = `${id}-COPY`;
    const ids = new Set(state.questionBank.map((question) => question.id));
    while (ids.has(candidate)) {
      counter += 1;
      candidate = `${id}-COPY-${counter}`;
    }
    return candidate;
  }

  function openQuestionEditor(id, duplicate = false) {
    const source = state.questionBank.find((item) => item.id === id);
    if (!source) return;
    state.editingQuestionId = duplicate ? null : source.id;
    dom["question-edit-title"].textContent = duplicate ? "Duplicate question" : "Edit question";
    dom["edit-question-id"].value = duplicate ? nextCopyId(source.id) : source.id;
    dom["edit-question-section"].value = source.section;
    dom["edit-question-section-name"].value = source.sectionName || "";
    dom["edit-question-unit"].value = source.unit;
    dom["edit-question-unit-name"].value = source.unitName || "";
    dom["edit-question-text"].value = source.question;
    OPTION_KEYS.forEach((key) => { dom[`edit-option-${key.toLowerCase()}`].value = source.options[key]; });
    dom["edit-question-answer"].value = source.correctAnswer;
    dom["edit-question-explanation"].value = source.explanation || "";
    dom["question-edit-error"].hidden = true;
    dom["question-edit-dialog"].showModal();
  }

  function openNewQuestionEditor() {
    const firstSection = state.catalog.sections.find((section) => section.active)?.id || "A";
    const firstUnit = state.catalog.units.find((unit) => unit.active && unit.sectionId === firstSection);
    state.editingQuestionId = null;
    dom["question-edit-title"].textContent = "Add question";
    dom["edit-question-id"].value = createId("QUESTION");
    dom["edit-question-section"].value = firstSection;
    dom["edit-question-section-name"].value = state.catalog.sections.find((section) => section.id === firstSection)?.name || "";
    dom["edit-question-unit"].value = firstUnit?.unitCode || "Unit 1";
    dom["edit-question-unit-name"].value = firstUnit?.unitName || "";
    dom["edit-question-text"].value = "";
    OPTION_KEYS.forEach((key) => { dom[`edit-option-${key.toLowerCase()}`].value = ""; });
    dom["edit-question-answer"].value = "A";
    dom["edit-question-explanation"].value = "";
    dom["question-edit-error"].hidden = true;
    dom["question-edit-dialog"].showModal();
  }

  function readQuestionEditor() {
    return {
      id: dom["edit-question-id"].value,
      section: dom["edit-question-section"].value,
      sectionName: dom["edit-question-section-name"].value,
      unit: dom["edit-question-unit"].value,
      unitName: dom["edit-question-unit-name"].value,
      question: dom["edit-question-text"].value,
      options: {
        A: dom["edit-option-a"].value,
        B: dom["edit-option-b"].value,
        C: dom["edit-option-c"].value,
        D: dom["edit-option-d"].value
      },
      correctAnswer: dom["edit-question-answer"].value,
      explanation: dom["edit-question-explanation"].value
    };
  }

  function saveQuestionEditor(event) {
    event.preventDefault();
    const validation = validateQuestionBank([readQuestionEditor()]);
    const question = validation.questions[0];
    const duplicateId = question && state.questionBank.some((item) => item.id === question.id && item.id !== state.editingQuestionId);
    const errors = validation.errors.slice();
    if (duplicateId) errors.push(`Question 1 (${question.id}): this ID already exists in the bank.`);
    if (errors.length || !question) {
      dom["question-edit-error"].textContent = errors.join(" ");
      dom["question-edit-error"].hidden = false;
      return;
    }
    if (state.editingQuestionId) {
      state.questionBank = state.questionBank.map((item) => item.id === state.editingQuestionId ? question : item);
    } else {
      state.questionBank = [...state.questionBank, question];
    }
    state.bankSource = "imported";
    state.bankName = "Personal CMA question bank";
    const saved = persistQuestionBank(state.bankName);
    dom["question-edit-dialog"].close();
    state.editingQuestionId = null;
    renderBankScreen();
    renderHome();
    setMessage(saved ? "The question was saved." : "The question is available in memory, but storage failed. Export a backup now.", saved ? "success" : "warning", 7000);
  }

  async function handleBankQuestionAction(event) {
    const button = event.target.closest("button[data-bank-action]");
    if (!button) return;
    const { bankAction, questionId } = button.dataset;
    if (bankAction === "view") openQuestionView(questionId);
    if (bankAction === "edit") openQuestionEditor(questionId, false);
    if (bankAction === "duplicate") openQuestionEditor(questionId, true);
    if (bankAction === "retire" || bankAction === "restore") {
      state.questionBank = state.questionBank.map((question) => question.id === questionId ? { ...question, retired: bankAction === "retire", retiredAt: bankAction === "retire" ? new Date().toISOString() : "", retirementReason: bankAction === "retire" ? "Manual retirement" : "" } : question);
      persistQuestionBank(state.bankName || "Personal CMA question bank"); renderBankScreen(); renderHome(); setMessage(`${questionId} was ${bankAction === "retire" ? "retired" : "restored"}.`, "success");
    }
    if (bankAction === "delete") {
      const confirmed = await askConfirmation("Delete this question?", `${questionId} will be removed from the active bank. Completed exam history remains unchanged.`, "Delete question");
      if (!confirmed) return;
      state.questionBank = state.questionBank.filter((question) => question.id !== questionId);
      persistQuestionBank(state.bankName || "Personal CMA question bank");
      renderBankScreen();
      renderHome();
      setMessage(`${questionId} was deleted.`, "success");
    }
  }

  function handleBankSelection(event) {
    const input = event.target.closest("input[data-bank-select]"); if (!input) return;
    if (input.checked) state.selectedBankQuestions.add(input.dataset.bankSelect); else state.selectedBankQuestions.delete(input.dataset.bankSelect);
    dom["bank-selection-count"].textContent = `${state.selectedBankQuestions.size} selected`;
  }

  function moveSelectedToReview() {
    const selected = state.questionBank.filter((question) => state.selectedBankQuestions.has(question.id));
    if (!selected.length) { setMessage("Select at least one question first.", "warning"); return; }
    const stamp = Date.now();
    state.importQueue = selected.map((question, index) => ({ temporaryId: `bank-${stamp}-${index + 1}`, existingQuestionId: question.id, questionNumber: index + 1, question: question.question, options: deepClone(question.options), correctAnswer: question.correctAnswer, explanation: question.explanation, sectionId: question.sectionId || question.section, unitId: question.unitId, topic: question.topic || "", tags: question.tags || [], difficulty: String(question.difficulty || "Medium").toLowerCase(), source: question.source || "question-bank", classificationStatus: "classified", classificationConfidence: question.classification?.confidence, approved: false, reviewed: false, allowDuplicate: true, validationErrors: [] }));
    state.selectedBankQuestions.clear(); persistAdvancedState(); openNamedScreen("import"); setMessage(`${selected.length} question${selected.length === 1 ? " is" : "s are"} ready for classification review.`, "success");
  }

  async function deleteSelectedBankQuestions() {
    const count = state.selectedBankQuestions.size; if (!count) { setMessage("Select at least one question first.", "warning"); return; }
    const confirmed = await askConfirmation("Delete selected questions?", `${count} question${count === 1 ? "" : "s"} will be removed from the active bank. Historical attempt snapshots remain unchanged.`, "Delete selected");
    if (!confirmed) return; state.questionBank = state.questionBank.filter((question) => !state.selectedBankQuestions.has(question.id)); state.selectedBankQuestions.clear(); persistQuestionBank(state.bankName); renderBankScreen(); renderHome();
  }

  function enterExamScreen() {
    if (!state.activeExam) return;
    showScreen("exam");
    dom["exam-screen-title"].textContent = state.activeExam.title;
    dom["mark-review"].hidden = !state.activeExam.settings.allowReview;
    renderExamQuestion();
    renderQuestionNavigator();
    updateExamHeader();
    if (state.activeExam.status !== "paused" && Date.now() >= state.activeExam.endTime) {
      finalizeActiveExam({ automatic: true, submittedAt: state.activeExam.endTime });
      return;
    }
    state.activeExam.pauseReasons ||= { manualPause: false, noteEditor: false, hiddenTab: false, systemDialog: false };
    if (state.activeExam.status === "paused") {
      stopTimerLoop();
      const overlay = dom["v2-pause-overlay"];
      if (overlay) overlay.hidden = false;
      return;
    }
    state.activeExam.status = "active";
    if (!Number.isFinite(state.activeExam.visitStartedAt)) state.activeExam.visitStartedAt = Date.now();
    saveActiveExam();
    startTimerLoop();
  }

  function currentExamQuestion() {
    return state.activeExam?.questions[state.activeExam.currentIndex] || null;
  }

  function renderExamQuestion() {
    const exam = state.activeExam;
    const question = currentExamQuestion();
    if (!exam || !question) return;

    dom["question-section"].textContent = sectionDisplayName(question);
    dom["question-unit"].textContent = unitDisplayName(question);
    dom["question-number-label"].textContent = `Question ${exam.currentIndex + 1} of ${exam.questions.length}`;
    dom["question-text"].textContent = question.question;

    const answerContainer = dom["answer-options"];
    answerContainer.replaceChildren();
    question.optionOrder.forEach((originalKey, displayedIndex) => {
      const displayKey = OPTION_KEYS[displayedIndex];
      const label = el("label", "answer-card");
      const input = el("input");
      input.type = "radio";
      input.name = "exam-answer";
      input.value = originalKey;
      input.checked = exam.answers[question.id] === originalKey;
      input.setAttribute("aria-label", `${displayKey}. ${question.options[originalKey]}`);
      const letter = el("span", "answer-letter", displayKey);
      letter.setAttribute("aria-hidden", "true");
      label.append(input, letter, el("span", "answer-text", question.options[originalKey]));
      answerContainer.append(label);
    });

    const marked = Boolean(exam.marked[question.id]);
    dom["mark-review"].textContent = marked ? "Remove Flag" : "Flag for Review";
    dom["mark-review"].setAttribute("aria-pressed", String(marked));
    dom["exam-flag-status"].textContent = marked ? "Flagged" : "Not flagged";
    dom["clear-answer"].disabled = !exam.answers[question.id];
    dom["mark-guessed"].checked = Boolean(exam.guessed?.[question.id]);
    dom["previous-question"].disabled = exam.currentIndex === 0;
    dom["next-question"].disabled = false;
    dom["next-question"].textContent = exam.currentIndex === exam.questions.length - 1 ? "Review Exam" : "Next";
    if (dom["v2-remove-question"]) dom["v2-remove-question"].hidden = exam.settings?.mode === "exam";
    if (dom["v2-pause-test"]) dom["v2-pause-test"].disabled = exam.status !== "active";
  }

  function renderQuestionNavigator() {
    const exam = state.activeExam;
    if (!exam) return;
    const navigator = dom["question-navigator"];
    navigator.replaceChildren();
    exam.questions.forEach((question, index) => {
      const answered = Boolean(exam.answers[question.id]);
      const marked = Boolean(exam.marked[question.id]);
      const classes = ["navigator-button"];
      classes.push(answered ? "answered" : "unanswered");
      if (marked) classes.push("marked");
      if (index === exam.currentIndex) classes.push("current");
      const button = el("button", classes.join(" "), index + 1);
      button.type = "button";
      button.dataset.index = String(index);
      button.setAttribute("aria-label", `Question ${index + 1}: ${answered ? "answered" : "unanswered"}${marked ? ", marked for review" : ""}${index === exam.currentIndex ? ", current" : ""}`);
      if (index === exam.currentIndex) button.setAttribute("aria-current", "step");
      navigator.append(button);
    });
  }

  function getLiveQuestionTime(now = Date.now()) {
    const exam = state.activeExam;
    const question = currentExamQuestion();
    if (!exam || !question) return 0;
    const accumulated = Math.max(0, Number(exam.timesMs[question.id]) || 0);
    if (exam.status !== "active" || !Number.isFinite(exam.visitStartedAt)) return accumulated;
    // Timestamp subtraction avoids interval drift and caps the visit at the
    // fixed exam deadline, even when the tab was inactive.
    const cappedNow = Math.min(Math.max(now, exam.visitStartedAt), exam.endTime);
    return accumulated + Math.max(0, cappedNow - exam.visitStartedAt);
  }

  function accumulateVisitTime(accumulated, visitStartedAt, leaveAt, endTime) {
    const safeAccumulated = Number.isFinite(accumulated) ? Math.max(0, accumulated) : 0;
    if (!Number.isFinite(visitStartedAt) || !Number.isFinite(leaveAt) || !Number.isFinite(endTime)) return safeAccumulated;
    const cappedLeaveTime = Math.min(Math.max(leaveAt, visitStartedAt), endTime);
    return safeAccumulated + Math.max(0, cappedLeaveTime - visitStartedAt);
  }

  function commitCurrentQuestionTime(atTime = Date.now()) {
    const exam = state.activeExam;
    const question = currentExamQuestion();
    if (!exam || !question || !Number.isFinite(exam.visitStartedAt)) return;
    const cappedTime = Math.min(Math.max(atTime, exam.visitStartedAt), exam.endTime);
    // Commit before every navigation, submission, refresh, or deliberate exit.
    // A later visit begins from the accumulated value rather than resetting it.
    exam.timesMs[question.id] = accumulateVisitTime(Number(exam.timesMs[question.id]) || 0, exam.visitStartedAt, atTime, exam.endTime);
    exam.visitStartedAt = cappedTime;
  }

  function updateExamHeader(now = Date.now()) {
    const exam = state.activeExam;
    if (!exam) return;
    const answered = exam.questions.filter((question) => Boolean(exam.answers[question.id])).length;
    const marked = exam.questions.filter((question) => Boolean(exam.marked[question.id])).length;
    const remainingMs = calculateRemainingTime(exam.endTime, now);
    dom["exam-position"].textContent = `${exam.currentIndex + 1} of ${exam.questions.length}`;
    dom["exam-answered"].textContent = answered;
    dom["exam-unanswered"].textContent = exam.questions.length - answered;
    dom["exam-marked"].textContent = marked;
    dom["overall-timer"].textContent = formatDuration(remainingMs, remainingMs >= 3600000);
    dom["question-timer"].textContent = formatDuration(getLiveQuestionTime(now));
    dom["overall-timer-card"].classList.toggle("warning", remainingMs <= 300000 && remainingMs > 60000);
    dom["overall-timer-card"].classList.toggle("critical", remainingMs <= 60000);
  }

  function startTimerLoop() {
    stopTimerLoop();
    const tick = () => {
      const exam = state.activeExam;
      if (!exam || exam.submitted || exam.status !== "active") {
        stopTimerLoop();
        return;
      }
      const now = Date.now();
      updateExamHeader(now);
      if (now >= exam.endTime) {
        finalizeActiveExam({ automatic: true, submittedAt: exam.endTime });
      }
    };
    tick();
    // The interval only asks for a repaint; the displayed value always comes
    // from endTime - Date.now(), so throttled background tabs cannot cause drift.
    state.timerId = window.setInterval(tick, 250);
  }

  function stopTimerLoop() {
    if (state.timerId !== null) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function pauseActiveExam(reason = "manualPause") {
    const exam = state.activeExam;
    if (!exam || exam.submitted || !["active", "paused"].includes(exam.status)) return false;
    exam.pauseReasons ||= { manualPause: false, noteEditor: false, hiddenTab: false, systemDialog: false };
    exam.pauseReasonStartedAt ||= {};
    if (exam.pauseReasons[reason]) return true;
    const now = Date.now();
    if (exam.status === "active") {
      commitCurrentQuestionTime(now);
      exam.pauseStartedAt = now;
      exam.visitStartedAt = null;
      exam.status = "paused";
      stopTimerLoop();
    }
    exam.pauseReasons[reason] = true;
    exam.pauseReasonStartedAt[reason] = now;
    saveActiveExam();
    return true;
  }

  function resumeActiveExam(reason = "manualPause") {
    const exam = state.activeExam;
    if (!exam || exam.submitted || !exam.pauseReasons) return false;
    const now = Date.now();
    const reasonStartedAt = Number(exam.pauseReasonStartedAt?.[reason]);
    const reasonDuration = Number.isFinite(reasonStartedAt) ? Math.max(0, now - reasonStartedAt) : 0;
    if (reason === "noteEditor") exam.notePausedMs = Math.max(0, Number(exam.notePausedMs) || 0) + reasonDuration;
    else if (reason === "hiddenTab") exam.hiddenPausedMs = Math.max(0, Number(exam.hiddenPausedMs) || 0) + reasonDuration;
    else exam.manualPausedMs = Math.max(0, Number(exam.manualPausedMs) || 0) + reasonDuration;
    exam.pauseReasons[reason] = false;
    if (exam.pauseReasonStartedAt) delete exam.pauseReasonStartedAt[reason];
    if (Object.values(exam.pauseReasons).some(Boolean)) {
      saveActiveExam();
      return true;
    }
    if (exam.status !== "paused") return true;
    const pausedAt = Number.isFinite(exam.pauseStartedAt) ? exam.pauseStartedAt : now;
    const duration = Math.max(0, now - pausedAt);
    exam.endTime += duration;
    exam.totalPausedMs = Math.max(0, Number(exam.totalPausedMs) || 0) + duration;
    exam.pauseStartedAt = null;
    exam.status = "active";
    exam.visitStartedAt = now;
    saveActiveExam();
    updateExamHeader(now);
    if (state.screen === "exam") startTimerLoop();
    return true;
  }

  function removeCurrentQuestionFromSession() {
    const exam = state.activeExam;
    const question = currentExamQuestion();
    if (!exam || !question || exam.submitted || exam.status !== "active") return false;
    if (exam.settings?.mode === "exam") return false;
    const now = Date.now();
    commitCurrentQuestionTime(now);
    exam.questions.splice(exam.currentIndex, 1);
    exam.questionIds = exam.questions.map((item) => item.id);
    delete exam.answers[question.id];
    delete exam.marked[question.id];
    delete exam.guessed?.[question.id];
    delete exam.timesMs[question.id];
    if (!exam.questions.length) {
      state.activeExam = null;
      removeStorage(STORAGE_KEYS.activeExam);
      showScreen("home");
      renderHome();
      setMessage("The study session ended because no questions remained.", "warning", 7000);
      return true;
    }
    exam.currentIndex = Math.min(exam.currentIndex, exam.questions.length - 1);
    exam.visitStartedAt = now;
    saveActiveExam();
    renderExamQuestion();
    renderQuestionNavigator();
    updateExamHeader(now);
    return true;
  }

  function navigateToQuestion(index) {
    const exam = state.activeExam;
    if (!exam || exam.submitted || exam.status !== "active") return;
    if (!Number.isInteger(index) || index < 0 || index >= exam.questions.length || index === exam.currentIndex) return;
    const now = Date.now();
    if (now >= exam.endTime) {
      finalizeActiveExam({ automatic: true, submittedAt: exam.endTime });
      return;
    }
    commitCurrentQuestionTime(now);
    exam.currentIndex = index;
    exam.visitStartedAt = now;
    renderExamQuestion();
    renderQuestionNavigator();
    updateExamHeader(now);
    saveActiveExam();
    dom["question-text"].focus?.({ preventScroll: true });
  }

  function handleNextQuestion() {
    const exam = state.activeExam;
    if (!exam) return;
    if (exam.currentIndex >= exam.questions.length - 1) { requestManualSubmission(); return; }
    navigateToQuestion(exam.currentIndex + 1);
  }

  function handleAnswerSelection(event) {
    const input = event.target.closest('input[name="exam-answer"]');
    if (!input || !state.activeExam || state.activeExam.status !== "active") return;
    const question = currentExamQuestion();
    if (!question || !OPTION_KEYS.includes(input.value)) return;
    state.activeExam.answers[question.id] = input.value;
    dom["clear-answer"].disabled = false;
    renderQuestionNavigator();
    updateExamHeader();
    saveActiveExam();
  }

  function clearCurrentAnswer() {
    const exam = state.activeExam;
    const question = currentExamQuestion();
    if (!exam || !question || exam.status !== "active") return;
    delete exam.answers[question.id];
    renderExamQuestion();
    renderQuestionNavigator();
    updateExamHeader();
    saveActiveExam();
  }

  function toggleCurrentGuess(event) {
    const exam = state.activeExam;
    const question = currentExamQuestion();
    if (!exam || !question || exam.status !== "active") return;
    exam.guessed ||= {};
    exam.guessed[question.id] = Boolean(event.target.checked);
    saveActiveExam();
  }

  function toggleCurrentMark() {
    const exam = state.activeExam;
    const question = currentExamQuestion();
    if (!exam || !question || !exam.settings.allowReview || exam.status !== "active") return;
    exam.marked[question.id] = !exam.marked[question.id];
    renderExamQuestion();
    renderQuestionNavigator();
    updateExamHeader();
    saveActiveExam();
  }

  function requestManualSubmission() {
    const exam = state.activeExam;
    if (!exam || exam.submitted || exam.status !== "active" || state.isSubmitting) return;
    const now = Date.now();
    if (now >= exam.endTime) {
      finalizeActiveExam({ automatic: true, submittedAt: exam.endTime });
      return;
    }

    commitCurrentQuestionTime(now);
    exam.status = "confirming";
    state.confirmationPauseStartedAt = now;
    stopTimerLoop();
    saveActiveExam();

    const answered = exam.questions.filter((question) => Boolean(exam.answers[question.id])).length;
    const unanswered = exam.questions.length - answered;
    const marked = exam.questions.filter((question) => Boolean(exam.marked[question.id])).length;
    const needsDialog = exam.settings.confirmSubmit || (exam.settings.unansweredWarning && unanswered > 0);

    if (!needsDialog) {
      finalizeActiveExam({ automatic: false, submittedAt: now });
      return;
    }

    dom["submit-answered"].textContent = answered;
    dom["submit-unanswered"].textContent = unanswered;
    dom["submit-marked"].textContent = marked;
    const warning = unanswered > 0 && exam.settings.unansweredWarning
      ? `You still have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Unanswered questions receive no credit.`
      : "Once submitted, answers cannot be changed.";
    dom["submit-dialog-message"].textContent = `${warning} ${marked ? `${marked} question${marked === 1 ? " is" : "s are"} marked for review.` : ""}`.trim();
    dom["confirm-final-submit"].disabled = false;
    dom["confirm-final-submit"].textContent = "Submit exam";
    if (typeof dom["submit-dialog"].showModal === "function") {
      try {
        if (!dom["submit-dialog"].open) dom["submit-dialog"].showModal();
      } catch (error) {
        console.warn("CMA Exam Simulator: the submission review dialog could not open.", error);
        const accepted = window.confirm(dom["submit-dialog-message"].textContent);
        if (accepted) confirmManualSubmission();
        else resumeAfterSubmissionDialog();
      }
    } else {
      const accepted = window.confirm(dom["submit-dialog-message"].textContent);
      if (accepted) confirmManualSubmission();
      else resumeAfterSubmissionDialog();
    }
  }

  function resumeAfterSubmissionDialog() {
    const exam = state.activeExam;
    if (!exam || exam.submitted || exam.status !== "confirming" || state.isSubmitting) return;
    if (dom["submit-dialog"].open) dom["submit-dialog"].close();
    const now = Date.now();
    const pausedAt = Number.isFinite(state.confirmationPauseStartedAt) ? state.confirmationPauseStartedAt : now;
    const pausedDuration = Math.max(0, now - pausedAt);
    // The manual confirmation explicitly stops both timers. Returning to the
    // exam shifts the deadline by the exact pause duration and starts a new visit.
    exam.endTime += pausedDuration;
    exam.totalPausedMs = Math.max(0, Number(exam.totalPausedMs) || 0) + pausedDuration;
    exam.status = "active";
    exam.visitStartedAt = now;
    state.confirmationPauseStartedAt = null;
    dom["confirm-final-submit"].disabled = false;
    dom["confirm-final-submit"].textContent = "Submit exam";
    saveActiveExam();
    updateExamHeader(now);
    startTimerLoop();
  }

  function confirmManualSubmission() {
    const exam = state.activeExam;
    if (!exam || exam.submitted || exam.status !== "confirming" || state.isSubmitting) return;
    state.isSubmitting = true;
    dom["confirm-final-submit"].disabled = true;
    dom["confirm-final-submit"].textContent = "Submitting…";
    const submittedAt = Number.isFinite(state.confirmationPauseStartedAt) ? state.confirmationPauseStartedAt : Date.now();
    if (dom["submit-dialog"].open) dom["submit-dialog"].close();
    finalizeActiveExam({ automatic: false, submittedAt });
  }

  function calculateGroupPerformance(perQuestion, key) {
    const groups = new Map();
    perQuestion.forEach((result) => {
      const groupKey = key === "section" ? result.section : unitKey(result);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          name: key === "section" ? sectionDisplayName(result) : unitDisplayName(result),
          section: result.section,
          sectionName: result.sectionName || "",
          unit: key === "section" ? "" : result.unit,
          unitName: key === "section" ? "" : result.unitName || "",
          total: 0,
          attempted: 0,
          correct: 0,
          incorrect: 0,
          unanswered: 0,
          totalTimeMs: 0,
          times: []
        });
      }
      const group = groups.get(groupKey);
      group.total += 1;
      group.totalTimeMs += result.timeMs;
      group.times.push({ number: result.number, id: result.id, timeMs: result.timeMs });
      if (result.status === "Correct") {
        group.correct += 1;
        group.attempted += 1;
      } else if (result.status === "Incorrect") {
        group.incorrect += 1;
        group.attempted += 1;
      } else {
        group.unanswered += 1;
      }
    });

    return Array.from(groups.values()).map((group) => {
      const ordered = group.times.slice().sort((left, right) => left.timeMs - right.timeMs || left.number - right.number);
      const { times, ...summary } = group;
      return {
        ...summary,
        accuracy: group.total ? (group.correct / group.total) * 100 : 0,
        averageTimeMs: group.total ? group.totalTimeMs / group.total : 0,
        fastest: ordered[0] || null,
        slowest: ordered[ordered.length - 1] || null
      };
    }).sort((left, right) => naturalCompare(`${left.section} ${left.unit}`, `${right.section} ${right.unit}`));
  }

  function calculateResult(exam, automatic, submittedAt) {
    // Score from stable original answer IDs. Display position is intentionally
    // ignored so shuffled choices cannot corrupt the correct-answer mapping.
    const durationMs = exam.durationSeconds * 1000;
    const remainingMs = automatic ? 0 : Math.max(0, Math.min(durationMs, exam.endTime - submittedAt));
    const totalTimeUsedMs = Math.max(0, durationMs - remainingMs);
    const perQuestion = exam.questions.map((question, index) => {
      const userAnswer = OPTION_KEYS.includes(exam.answers[question.id]) ? exam.answers[question.id] : null;
      const status = !userAnswer ? "Unanswered" : userAnswer === question.correctAnswer ? "Correct" : "Incorrect";
      const timeMs = Math.max(0, Math.min(totalTimeUsedMs, Number(exam.timesMs[question.id]) || 0));
      const catalogSection = ADVANCED.findSection?.(state.catalog, question.sectionId || question.section);
      const catalogUnit = ADVANCED.findUnit?.(state.catalog, catalogSection?.id || "", question.unitId || question.unit);
      return {
        number: index + 1,
        version: 3,
        id: question.id,
        questionUid: question.questionUid || question.id,
        sourceQuestionId: question.sourceQuestionId || question.id,
        bankId: question.bankId || "",
        sectionId: question.sectionId || question.section,
        unitId: question.unitId || unitKey(question),
        section: question.section,
        sectionName: catalogSection?.name || question.sectionName || "",
        sectionNameSnapshot: catalogSection?.name || question.sectionNameSnapshot || question.sectionName || "",
        unit: question.unit,
        unitName: catalogUnit?.unitName || question.unitName || "",
        unitNameSnapshot: catalogUnit?.unitName || question.unitNameSnapshot || question.unitName || "",
        topic: question.topic || "",
        tags: Array.isArray(question.tags) ? question.tags.slice() : [],
        difficulty: question.difficulty || "Medium",
        source: question.source || "",
        classification: question.classification ? deepClone(question.classification) : null,
        question: question.question,
        options: deepClone(question.options),
        optionOrder: question.optionOrder.slice(),
        correctAnswer: question.correctAnswer,
        userAnswer,
        explanation: question.explanation || "No explanation was provided.",
        marked: Boolean(exam.marked[question.id]),
        guessed: Boolean(exam.guessed?.[question.id]),
        status,
        timeMs
      };
    });

    const correct = perQuestion.filter((result) => result.status === "Correct").length;
    const incorrect = perQuestion.filter((result) => result.status === "Incorrect").length;
    const unanswered = perQuestion.filter((result) => result.status === "Unanswered").length;
    const totalQuestions = perQuestion.length;
    const percentage = totalQuestions ? (correct / totalQuestions) * 100 : 0;
    const recordedTotalTimeMs = perQuestion.reduce((sum, result) => sum + result.timeMs, 0);
    const orderedByTime = perQuestion.slice().sort((a, b) => a.timeMs - b.timeMs || a.number - b.number);

    const timeAnalysis = {
      allottedMs: durationMs,
      usedMs: totalTimeUsedMs,
      remainingMs,
      recordedTotalMs: recordedTotalTimeMs,
      averageMs: totalQuestions ? recordedTotalTimeMs / totalQuestions : 0,
      fastest: orderedByTime[0] ? { number: orderedByTime[0].number, id: orderedByTime[0].id, timeMs: orderedByTime[0].timeMs } : null,
      slowest: orderedByTime.length ? { number: orderedByTime[orderedByTime.length - 1].number, id: orderedByTime[orderedByTime.length - 1].id, timeMs: orderedByTime[orderedByTime.length - 1].timeMs } : null,
      averageCorrectMs: average(perQuestion.filter((result) => result.status === "Correct").map((result) => result.timeMs)),
      averageIncorrectMs: average(perQuestion.filter((result) => result.status === "Incorrect").map((result) => result.timeMs)),
      averageUnansweredMs: average(perQuestion.filter((result) => result.status === "Unanswered").map((result) => result.timeMs)),
      under30Seconds: fastQuestionRemovalCandidates(perQuestion).length,
      over60Seconds: perQuestion.filter((result) => result.timeMs > 60000).length,
      over90Seconds: perQuestion.filter((result) => result.timeMs > 90000).length
    };

    return {
      version: 3,
      id: exam.id,
      title: exam.title,
      mode: exam.settings?.mode || "standard",
      settings: deepClone(exam.settings || {}),
      v2Metadata: exam.settings?.v2Metadata ? deepClone(exam.settings.v2Metadata) : null,
      totalPausedMs: Math.max(0, Number(exam.totalPausedMs) || 0),
      manualPausedMs: Math.max(0, Number(exam.manualPausedMs) || 0),
      notePausedMs: Math.max(0, Number(exam.notePausedMs) || 0),
      hiddenPausedMs: Math.max(0, Number(exam.hiddenPausedMs) || 0),
      completedAt: new Date(submittedAt).toISOString(),
      submissionReason: automatic ? "Time limit expired" : "Submitted manually",
      durationSeconds: exam.durationSeconds,
      totalQuestions,
      totalTimeUsedMs,
      remainingMs,
      score: `${correct}/${totalQuestions}`,
      percentage,
      correct,
      incorrect,
      unanswered,
      averageTimeMs: timeAnalysis.averageMs,
      timeAnalysis,
      selectedSections: Array.isArray(exam.settings?.selectedSections) ? exam.settings.selectedSections.slice() : uniqueSorted(perQuestion.map((item) => item.section)),
      selectedUnits: Array.isArray(exam.settings?.selectedUnits) ? deepClone(exam.settings.selectedUnits) : uniqueSorted(perQuestion.map((item) => unitKey(item))),
      eligibleQuestionCount: Number(exam.settings?.eligibleQuestionCount) || totalQuestions,
      selectedQuestionCount: totalQuestions,
      randomizeQuestions: Boolean(exam.settings?.randomizeQuestions || exam.settings?.questionOrder === "random"),
      balancedDistribution: Boolean(exam.settings?.balancedDistribution),
      shuffleOptions: Boolean(exam.settings?.shuffleOptions),
      questionIds: perQuestion.map((item) => item.id),
      questionOrder: perQuestion.map((item) => item.id),
      perQuestion,
      sectionPerformance: calculateGroupPerformance(perQuestion, "section"),
      unitPerformance: calculateGroupPerformance(perQuestion, "unit"),
      sectionUnitPerformance: calculateGroupPerformance(perQuestion, "unit"),
      topicPerformance: calculateGroupPerformance(perQuestion, "unit")
    };
  }

  function addUniqueHistoryResult(history, result) {
    const safeHistory = Array.isArray(history) ? history : [];
    if (!result || !isNonEmptyString(result.id) || safeHistory.some((record) => record.id === result.id)) return safeHistory.slice();
    return [result, ...safeHistory];
  }

  function fastQuestionRemovalCandidates(perQuestion, thresholdSeconds = FAST_QUESTION_REMOVAL_SECONDS) {
    const thresholdMs = Math.max(1, Number(thresholdSeconds) || FAST_QUESTION_REMOVAL_SECONDS) * 1000;
    const ids = new Set();
    (Array.isArray(perQuestion) ? perQuestion : []).forEach((item) => {
      const timeMs = Number(item?.timeMs);
      if (item?.userAnswer && Number.isFinite(timeMs) && timeMs > 0 && timeMs < thresholdMs && isNonEmptyString(item.id)) ids.add(item.id);
    });
    return Array.from(ids);
  }

  function removeFastQuestionsFromBank(perQuestion, options = {}) {
    const enabled = options.enabled !== undefined ? Boolean(options.enabled) : state.analyticsSettings.removeFastQuestions !== false;
    const thresholdSeconds = Math.max(1, Number(options.thresholdSeconds) || FAST_QUESTION_REMOVAL_SECONDS);
    if (!enabled) return { count: 0, ids: [], thresholdSeconds, saved: true };
    const candidates = new Set(fastQuestionRemovalCandidates(perQuestion, thresholdSeconds));
    const ids = state.questionBank.filter((question) => candidates.has(question.id)).map((question) => question.id);
    if (!ids.length) return { count: 0, ids: [], thresholdSeconds, saved: true };
    const removalIds = new Set(ids);
    state.questionBank = state.questionBank.filter((question) => !removalIds.has(question.id));
    const saved = persistQuestionBank(state.bankName || "Personal CMA question bank");
    return { count: ids.length, ids, thresholdSeconds, saved };
  }

  function finalizeActiveExam({ automatic, submittedAt }) {
    const exam = state.activeExam;
    // One guard protects scoring, history insertion, and automatic timer calls
    // from double submission.
    if (!exam || exam.submitted) return;
    exam.submitted = true;
    stopTimerLoop();
    if (exam.status === "active") commitCurrentQuestionTime(submittedAt);
    exam.status = "submitted";
    if (dom["submit-dialog"].open) dom["submit-dialog"].close();
    state.confirmationPauseStartedAt = null;

    const result = calculateResult(exam, automatic, submittedAt);
    result.fastQuestionRemovalEnabled = Boolean(exam.settings?.removeFastQuestions);
    result.fastQuestionRemovalThresholdSeconds = Number(exam.settings?.fastQuestionRemovalSeconds) || FAST_QUESTION_REMOVAL_SECONDS;
    state.currentResult = result;
    const updatedHistory = addUniqueHistoryResult(state.history, result);
    if (updatedHistory.length !== state.history.length) {
      state.history = updatedHistory;
      result.questionsRetired = applyAutomaticRetirement(exam);
      const fastRemoval = removeFastQuestionsFromBank(result.perQuestion, {
        enabled: result.fastQuestionRemovalEnabled,
        thresholdSeconds: result.fastQuestionRemovalThresholdSeconds
      });
      result.questionsRemovedUnder30Seconds = fastRemoval.count;
      result.removedFastQuestionIds = fastRemoval.ids;
      result.fastQuestionRemovalSaved = fastRemoval.saved;
      if (!writeStorage(STORAGE_KEYS.history, state.history)) {
        setMessage("Your result is available now, but the browser could not add it to exam history.", "warning", 0);
      }
    }
    removeStorage(STORAGE_KEYS.activeExam);
    state.activeExam = null;
    if (globalThis.CMAV2?.recordResult) {
      Promise.resolve(globalThis.CMAV2.recordResult(result)).catch((error) => console.warn("CMA V2 result analytics were deferred.", error));
    }
    showScreen("results");
    try {
      renderHome();
      renderResults(result);
      if (automatic) setMessage("Time expired. The exam was submitted automatically and saved once.", "warning", 7000);
    } catch (error) {
      console.error("CMA Exam Simulator: the exam was saved, but part of the results view could not render.", error);
      dom["results-reason"].textContent = result.submissionReason || "Exam complete";
      dom["results-title"].textContent = result.title;
      dom["results-subtitle"].textContent = `Your result was scored and saved: ${result.correct}/${result.totalQuestions} correct (${Number(result.percentage).toFixed(1)}%).`;
      setMessage("Your exam was submitted and saved. Some detailed result panels could not be displayed; the attempt remains available in Progress.", "warning", 0);
    } finally {
      state.isSubmitting = false;
      dom["confirm-final-submit"].disabled = false;
      dom["confirm-final-submit"].textContent = "Submit exam";
    }
  }

  function applyAutomaticRetirement(exam) {
    if (!exam?.settings?.autoRetireMastered) return 0;
    const mastery = weakAnalytics().mastery || {};
    const ids = new Set((exam.questions || []).filter((question) => mastery[question.id]?.status === "Mastered").map((question) => question.id));
    let count = 0;
    state.questionBank = state.questionBank.map((question) => {
      if (!ids.has(question.id) || question.retired) return question;
      count += 1;
      return { ...question, retired: true, retiredAt: new Date().toISOString(), retirementReason: `Automatically retired after ${state.analyticsSettings.masteryThreshold} consecutive correct answers` };
    });
    if (count) persistQuestionBank(state.bankName || "Personal CMA question bank");
    return count;
  }

  function performanceLabel(accuracy, attempted) {
    if (!attempted || accuracy < 50) return { text: "Weak", className: "performance-weak" };
    if (accuracy < 75) return { text: "Moderate", className: "performance-moderate" };
    return { text: "Strong", className: "performance-strong" };
  }

  function addScoreCard(container, label, value, detail, primary = false) {
    const card = el("article", `score-card${primary ? " primary" : ""}`);
    appendText(card, "span", "", label);
    appendText(card, "strong", "", value);
    if (detail) appendText(card, "small", "", detail);
    container.append(card);
  }

  function categoryAverageText(value, emptyText) {
    return value === null ? emptyText : formatDuration(value);
  }

  function renderResults(result) {
    if (!result) return;
    state.currentResult = result;
    dom["results-reason"].textContent = result.submissionReason || "Exam complete";
    dom["results-title"].textContent = result.title;
    dom["results-subtitle"].textContent = `Completed ${formatDate(result.completedAt)} • ${result.correct + result.incorrect} attempted of ${result.totalQuestions}`;

    const scoreCards = dom["score-cards"];
    scoreCards.replaceChildren();
    const time = result.timeAnalysis;
    addScoreCard(scoreCards, "Score", result.score, `${Number(result.percentage).toFixed(1)}% accuracy`, true);
    addScoreCard(scoreCards, "Percentage", `${Number(result.percentage).toFixed(1)}%`, "Correct ÷ total");
    addScoreCard(scoreCards, "Correct", result.correct, "Answered correctly");
    addScoreCard(scoreCards, "Incorrect", result.incorrect, result.incorrect ? "Needs review" : "No incorrect questions");
    addScoreCard(scoreCards, "Unanswered", result.unanswered, result.unanswered ? "No credit awarded" : "Every question answered");
    addScoreCard(scoreCards, "Total time used", formatDuration(result.totalTimeUsedMs), `${formatDuration(result.remainingMs)} remaining`);
    addScoreCard(scoreCards, "Average time", formatDuration(time.averageMs), "Recorded per question");
    addScoreCard(scoreCards, "Fastest question", time.fastest ? formatDuration(time.fastest.timeMs) : "—", time.fastest ? `Question ${time.fastest.number}` : "No questions");
    addScoreCard(scoreCards, "Slowest question", time.slowest ? formatDuration(time.slowest.timeMs) : "—", time.slowest ? `Question ${time.slowest.number}` : "No questions");

    renderResultFocusSummary(result);

    const analysisContainer = dom["time-analysis"];
    analysisContainer.replaceChildren();
    [
      ["Total allotted", formatDuration(time.allottedMs, time.allottedMs >= 3600000)],
      ["Total actually used", formatDuration(time.usedMs, time.usedMs >= 3600000)],
      ["Remaining at submission", formatDuration(time.remainingMs, time.remainingMs >= 3600000)],
      ["Recorded question time", formatDuration(time.recordedTotalMs, time.recordedTotalMs >= 3600000)],
      ["Average per question", formatDuration(time.averageMs)],
      ["Average — correct", categoryAverageText(time.averageCorrectMs, "No correct questions")],
      ["Average — incorrect", categoryAverageText(time.averageIncorrectMs, "No incorrect questions")],
      ["Average — unanswered", categoryAverageText(time.averageUnansweredMs, "No unanswered questions")],
      ["Under 30 seconds", `${time.under30Seconds} question${time.under30Seconds === 1 ? "" : "s"}`],
      ["More than 60 seconds", `${time.over60Seconds} question${time.over60Seconds === 1 ? "" : "s"}`],
      ["More than 90 seconds", `${time.over90Seconds} question${time.over90Seconds === 1 ? "" : "s"}`],
      ["Timing consistency", Math.abs(time.recordedTotalMs - time.usedMs) <= 1500 ? "Aligned" : "Check browser pauses"]
    ].forEach(([label, value]) => {
      const item = el("div", "analysis-item");
      appendText(item, "span", "", label);
      appendText(item, "strong", "", value);
      analysisContainer.append(item);
    });

    renderResultPerformanceTable(dom["section-performance-body"], result.sectionPerformance || []);
    renderUnitPerformanceTable(dom["unit-performance-body"], result.unitPerformance || result.topicPerformance || []);
    populateResultFilters(result);
    state.resultSort = { key: "number", direction: "asc" };
    renderDetailedResults();
    renderQuestionReview();
  }

  function renderResultFocusSummary(result) {
    const groups = (result.unitPerformance || result.topicPerformance || []).filter((group) => Number(group.total) > 0);
    const strong = groups.filter((group) => Number(group.accuracy) >= 75).sort((left, right) => right.accuracy - left.accuracy || right.total - left.total).slice(0, 4);
    const weak = groups.filter((group) => Number(group.accuracy) < 75).sort((left, right) => left.accuracy - right.accuracy || right.total - left.total).slice(0, 4);
    const container = dom["results-focus-summary"];
    container.replaceChildren();

    const addTopicList = (title, items, emptyText, tone) => {
      const card = el("article", `focus-summary-card ${tone}`);
      appendText(card, "h3", "", title);
      if (!items.length) appendText(card, "p", "summary-note", emptyText);
      else {
        const list = el("ul", "focus-topic-list");
        items.forEach((group) => {
          const item = el("li");
          appendText(item, "strong", "", group.unitName || group.unit || "Unspecified unit");
          appendText(item, "span", "", `${Number(group.accuracy).toFixed(1)}% • ${group.correct}/${group.total} correct`);
          list.append(item);
        });
        card.append(list);
      }
      container.append(card);
    };

    addTopicList("Strong topics", strong, "No unit reached 75% in this attempt yet.", "is-strong");
    addTopicList("Weak topics", weak, "No unit fell below 75% in this attempt.", "is-weak");

    const enabled = Boolean(result.fastQuestionRemovalEnabled);
    const removed = Math.max(0, Number(result.questionsRemovedUnder30Seconds) || 0);
    const badge = dom["results-fast-removal-badge"];
    badge.textContent = enabled ? `${removed} removed under 30s` : "Fast cleanup was off";
    badge.className = `availability-chip${enabled && removed ? " ready" : ""}`;
    dom["results-fast-removal-note"].textContent = enabled
      ? `${removed} answered question${removed === 1 ? " was" : "s were"} removed from the active bank because recorded answer time was below 30 seconds. Full question snapshots remain in this result and exam history.`
      : "No questions were automatically removed because fast-question cleanup was off for this attempt.";
  }

  function renderResultPerformanceTable(body, groups) {
    body.replaceChildren();
    groups.forEach((group) => {
      const row = el("tr");
      appendText(row, "td", "", group.name);
      appendText(row, "td", "", group.total);
      appendText(row, "td", "", group.correct);
      appendText(row, "td", "", group.incorrect);
      appendText(row, "td", "", group.unanswered);
      const accuracyCell = el("td");
      const performance = performanceLabel(group.accuracy, group.total);
      appendText(accuracyCell, "span", `performance-badge ${performance.className}`, `${performance.text} • ${group.accuracy.toFixed(1)}%`);
      row.append(accuracyCell);
      appendText(row, "td", "", formatDuration(group.averageTimeMs));
      body.append(row);
    });
  }

  function renderUnitPerformanceTable(body, groups) {
    body.replaceChildren();
    groups.forEach((group) => {
      const row = el("tr");
      appendText(row, "td", "", sectionDisplayName(group.section, group.sectionName));
      appendText(row, "td", "", group.unit);
      appendText(row, "td", "", group.unitName || "—");
      appendText(row, "td", "", group.total);
      appendText(row, "td", "", group.correct);
      appendText(row, "td", "", group.incorrect);
      appendText(row, "td", "", group.unanswered);
      const accuracyCell = el("td");
      const performance = performanceLabel(group.accuracy, group.total);
      appendText(accuracyCell, "span", `performance-badge ${performance.className}`, `${performance.text} • ${group.accuracy.toFixed(1)}%`);
      row.append(accuracyCell);
      appendText(row, "td", "", formatDuration(group.averageTimeMs));
      appendText(row, "td", "", group.fastest ? `Q${group.fastest.number} • ${formatDuration(group.fastest.timeMs)}` : "—");
      appendText(row, "td", "", group.slowest ? `Q${group.slowest.number} • ${formatDuration(group.slowest.timeMs)}` : "—");
      body.append(row);
    });
  }

  function populateSectionResultFilter(select, questions, allLabel) {
    select.replaceChildren();
    const all = el("option", "", allLabel);
    all.value = "all";
    select.append(all);
    discoverBankStructure(questions).filter((section) => section.count > 0).forEach((section) => {
      const option = el("option", "", sectionDisplayName(section.section, section.sectionName));
      option.value = section.section;
      select.append(option);
    });
  }

  function populateUnitResultFilter(select, questions, allLabel) {
    select.replaceChildren();
    const all = el("option", "", allLabel);
    all.value = "all";
    select.append(all);
    discoverBankStructure(questions).forEach((section) => {
      section.units.forEach((unit) => {
        const option = el("option", "", `${section.section} • ${unitDisplayName(unit.unit, unit.unitName)}`);
        option.value = unit.key;
        select.append(option);
      });
    });
  }

  function populateResultFilters(result) {
    populateSectionResultFilter(dom["result-section-filter"], result.perQuestion, "All sections");
    populateUnitResultFilter(dom["result-topic-filter"], result.perQuestion, "All units");
    populateSectionResultFilter(dom["review-section-filter"], result.perQuestion, "All sections");
    populateUnitResultFilter(dom["review-unit-filter"], result.perQuestion, "All units");
    dom["result-status-filter"].value = "all";
    dom["review-filter"].value = "all";
  }

  function resultMatchesFilters(result) {
    const status = dom["result-status-filter"].value;
    const section = dom["result-section-filter"].value;
    const selectedUnit = dom["result-topic-filter"].value;
    const statusMatches = status === "all" || (status === "marked" ? result.marked : result.status === status);
    return statusMatches && (section === "all" || result.section === section) && (selectedUnit === "all" || unitKey(result) === selectedUnit);
  }

  function statusClass(status) {
    return status === "Correct" ? "status-correct" : status === "Incorrect" ? "status-incorrect" : "status-unanswered";
  }

  function renderDetailedResults() {
    const result = state.currentResult;
    if (!result) return;
    const filtered = result.perQuestion.filter(resultMatchesFilters);
    const { key, direction } = state.resultSort;
    filtered.sort((a, b) => {
      const comparison = key === "time" ? a.timeMs - b.timeMs : a.number - b.number;
      return direction === "asc" ? comparison : -comparison;
    });

    const body = dom["result-detail-body"];
    body.replaceChildren();
    filtered.forEach((item) => {
      const row = el("tr");
      appendText(row, "td", "", item.number);
      appendText(row, "td", "", item.id);
      appendText(row, "td", "", sectionDisplayName(item));
      appendText(row, "td", "", unitDisplayName(item));
      const statusCell = el("td");
      appendText(statusCell, "span", `status-badge ${statusClass(item.status)}`, item.status);
      row.append(statusCell);
      appendText(row, "td", "answer-cell", optionDisplayText(item, item.userAnswer));
      appendText(row, "td", "answer-cell", optionDisplayText(item, item.correctAnswer));
      appendText(row, "td", "", item.marked ? "Yes" : "No");
      appendText(row, "td", "", formatDuration(item.timeMs));
      body.append(row);
    });
    dom["detail-empty"].hidden = filtered.length > 0;
  }

  function renderQuestionReview() {
    const result = state.currentResult;
    if (!result) return;
    const filter = dom["review-filter"].value;
    const section = dom["review-section-filter"].value;
    const selectedUnit = dom["review-unit-filter"].value;
    const filtered = result.perQuestion.filter((item) => {
      const statusMatches = filter === "all" || (filter === "marked" ? item.marked : item.status === filter);
      return statusMatches && (section === "all" || item.section === section) && (selectedUnit === "all" || unitKey(item) === selectedUnit);
    });
    const container = dom["review-list"];
    container.replaceChildren();

    filtered.forEach((item, itemIndex) => {
      const details = el("details", "review-card");
      if (itemIndex === 0) details.open = true;
      const summary = el("summary");
      appendText(summary, "span", "", `Q${item.number}`);
      const summaryMain = el("span", "review-summary-main");
      appendText(summaryMain, "strong", "", item.question);
      appendText(summaryMain, "span", "", `${item.id} • ${sectionDisplayName(item)} • ${unitDisplayName(item)}`);
      summary.append(summaryMain);
      appendText(summary, "span", `status-badge ${statusClass(item.status)}`, item.status);
      details.append(summary);

      const body = el("div", "review-body");
      appendText(body, "p", "review-question", item.question);
      if (item.status === "Unanswered") appendText(body, "p", "message message-warning", "Unanswered — no answer was selected.");
      const options = el("div", "review-option-list");
      item.optionOrder.forEach((originalKey, displayedIndex) => {
        const isCorrect = originalKey === item.correctAnswer;
        const isUser = originalKey === item.userAnswer;
        const option = el("div", `review-option${isCorrect ? " correct-option" : ""}${isUser && !isCorrect ? " wrong-option" : ""}`);
        appendText(option, "strong", "", OPTION_KEYS[displayedIndex]);
        appendText(option, "span", "", item.options[originalKey]);
        const labels = el("span", "review-option-labels");
        if (isCorrect) appendText(labels, "span", `review-label ${isUser ? "yours-correct" : "correct"}`, isUser ? "Correct Answer • Your Answer" : "Correct Answer");
        if (isUser && !isCorrect) appendText(labels, "span", "review-label yours", "Your Answer");
        option.append(labels);
        options.append(option);
      });
      body.append(options);
      const explanation = el("div", "explanation-box");
      appendText(explanation, "strong", "", "Explanation");
      appendText(explanation, "p", "", item.explanation || "No explanation was provided.");
      body.append(explanation);
      const foot = el("div", "review-foot");
      appendText(foot, "span", "", `Time spent: ${formatDuration(item.timeMs)}`);
      appendText(foot, "span", "", item.marked ? "★ Marked for review" : "Not marked for review");
      body.append(foot);
      details.append(body);
      container.append(details);
    });
    dom["review-empty"].hidden = filtered.length > 0;
  }

  function renderHistory() {
    const list = dom["history-list"];
    list.replaceChildren();
    dom["history-empty"].hidden = state.history.length > 0;
    dom["clear-history"].disabled = state.history.length === 0;
    dom["history-storage-message"].hidden = !state.storageWarning;
    dom["history-storage-message"].textContent = state.storageWarning;

    const historyQuestions = state.history.flatMap((record) => record.perQuestion || []);
    const currentSection = state.historyFilters.section;
    const currentUnit = state.historyFilters.unit;
    populateSectionResultFilter(dom["history-section-filter"], historyQuestions, "All sections");
    populateUnitResultFilter(dom["history-unit-filter"], historyQuestions, "All units");
    dom["history-section-filter"].value = Array.from(dom["history-section-filter"].options).some((option) => option.value === currentSection) ? currentSection : "all";
    dom["history-unit-filter"].value = Array.from(dom["history-unit-filter"].options).some((option) => option.value === currentUnit) ? currentUnit : "all";
    const modeSelect = dom["history-mode-filter"]; const currentMode = state.historyFilters.mode || "all"; modeSelect.replaceChildren(); const allModes = el("option", "", "All modes"); allModes.value = "all"; modeSelect.append(allModes); uniqueSorted(state.history.map((record) => PROGRESS.attemptMode?.(record) || record.mode || "standard")).forEach((mode) => { const option = el("option", "", mode.replace(/-/g, " ")); option.value = mode; modeSelect.append(option); }); modeSelect.value = Array.from(modeSelect.options).some((option) => option.value === currentMode) ? currentMode : "all";
    dom["history-sort"].value = state.historyFilters.sort || "date-desc";
    state.historyFilters.section = dom["history-section-filter"].value;
    state.historyFilters.unit = dom["history-unit-filter"].value;

    const minimum = state.historyFilters.minScore === "" ? null : Number(state.historyFilters.minScore);
    const maximum = state.historyFilters.maxScore === "" ? null : Number(state.historyFilters.maxScore);
    const minimumAccuracy = state.historyFilters.minAccuracy === "" ? null : Number(state.historyFilters.minAccuracy);
    const maximumAccuracy = state.historyFilters.maxAccuracy === "" ? null : Number(state.historyFilters.maxAccuracy);
    let filteredHistory = state.history.filter((record) => {
      const sectionMatches = state.historyFilters.section === "all" || record.perQuestion.some((item) => item.section === state.historyFilters.section);
      const unitMatches = state.historyFilters.unit === "all" || record.perQuestion.some((item) => unitKey(item) === state.historyFilters.unit);
      const dateMatches = !state.historyFilters.date || record.completedAt.slice(0, 10) === state.historyFilters.date;
      const minimumMatches = minimum === null || (!Number.isNaN(minimum) && record.percentage >= minimum);
      const maximumMatches = maximum === null || (!Number.isNaN(maximum) && record.percentage <= maximum);
      const accuracy = PROGRESS.metrics(PROGRESS.historyQuestions([record])).accuracy;
      const minimumAccuracyMatches = minimumAccuracy === null || (Number.isFinite(accuracy) && accuracy >= minimumAccuracy);
      const maximumAccuracyMatches = maximumAccuracy === null || (Number.isFinite(accuracy) && accuracy <= maximumAccuracy);
      const modeMatches = modeSelect.value === "all" || (PROGRESS.attemptMode?.(record) || record.mode || "standard") === modeSelect.value;
      return sectionMatches && unitMatches && dateMatches && minimumMatches && maximumMatches && minimumAccuracyMatches && maximumAccuracyMatches && modeMatches;
    });
    const comparisons = new Map(filteredHistory.map((record) => [record.id, PROGRESS.attemptComparison?.(state.history, record) || {}]));
    const sort = dom["history-sort"].value;
    filteredHistory = filteredHistory.slice().sort((left, right) => {
      const leftMetrics = PROGRESS.metrics(PROGRESS.historyQuestions([left])); const rightMetrics = PROGRESS.metrics(PROGRESS.historyQuestions([right]));
      if (sort === "date-asc") return new Date(left.completedAt) - new Date(right.completedAt);
      if (sort === "accuracy-desc") return (rightMetrics.accuracy ?? -Infinity) - (leftMetrics.accuracy ?? -Infinity);
      if (sort === "time-asc") return (leftMetrics.averageTimeMs ?? Infinity) - (rightMetrics.averageTimeMs ?? Infinity);
      if (sort === "accuracy-change-desc") return (comparisons.get(right.id).accuracyChangePoints ?? -Infinity) - (comparisons.get(left.id).accuracyChangePoints ?? -Infinity);
      if (sort === "speed-change-desc") return (comparisons.get(right.id).speedImprovementPercentage ?? -Infinity) - (comparisons.get(left.id).speedImprovementPercentage ?? -Infinity);
      return new Date(right.completedAt) - new Date(left.completedAt);
    });
    dom["history-filter-summary"].textContent = `${filteredHistory.length} of ${state.history.length} saved attempt${state.history.length === 1 ? "" : "s"} match.`;

    filteredHistory.forEach((record) => {
      const card = el("article", "history-card");
      const main = el("div", "history-main");
      appendText(main, "h2", "", record.title);
      const recordMode = PROGRESS.attemptMode?.(record) || record.mode || "standard"; const metrics = PROGRESS.metrics(PROGRESS.historyQuestions([record])); const comparison = comparisons.get(record.id);
      const unitMetrics = uniqueSorted((record.perQuestion || []).map((item) => PROGRESS.unitId(item))).map((id) => ({ id, label: unitDisplayName((record.perQuestion || []).find((item) => PROGRESS.unitId(item) === id) || { unitName: id }), metrics: PROGRESS.metrics(PROGRESS.historyQuestions([record]).filter((item) => item.unitId === id)) })).filter((item) => Number.isFinite(item.metrics.accuracy)); const weakestUnit = unitMetrics.slice().sort((a, b) => a.metrics.accuracy - b.metrics.accuracy)[0]; const strongestUnit = unitMetrics.slice().sort((a, b) => b.metrics.accuracy - a.metrics.accuracy)[0];
      appendText(main, "p", "", `${formatDate(record.completedAt)} • ${recordMode.replace(/-/g, " ")} • ${record.submissionReason || "Completed"}`);
      const coverage = (record.selectedSections || uniqueSorted(record.perQuestion.map((item) => item.section))).map((section) => `Section ${section}`).join(", ");
      appendText(main, "p", "", `${coverage || "Unspecified coverage"} • ${record.randomizeQuestions ? "Randomized" : "Original order"}${record.balancedDistribution ? " • Balanced" : ""}${record.shuffleOptions ? " • Choices shuffled" : ""}`);
      if (comparison?.comparison) appendText(main, "p", "demo-note", `${comparison.comparison.approximate ? "Approximate comparison" : "Compared"} with ${comparison.comparison.basis}.`);
      card.append(main);
      [
        ["Score", `${record.correct}/${record.totalQuestions}`],
        ["Accuracy", formatMetricPercent(metrics.accuracy)],
        ["Average time", Number.isFinite(metrics.averageTimeMs) ? `${(metrics.averageTimeMs / 1000).toFixed(1)} sec` : "—"],
        ["Accuracy change", Number.isFinite(comparison?.accuracyChangePoints) ? `${comparison.accuracyChangePoints >= 0 ? "+" : ""}${comparison.accuracyChangePoints.toFixed(1)} points` : "—"],
        ["Speed change", Number.isFinite(comparison?.speedImprovementPercentage) ? `${Math.abs(comparison.speedImprovementPercentage).toFixed(1)}% ${comparison.speedImprovementPercentage >= 0 ? "faster" : "slower"}` : "—"],
        ["Retired", Number(record.questionsRetired) || 0],
        ["Weakest unit", weakestUnit?.label || "—"],
        ["Strongest unit", strongestUnit?.label || "—"],
        ["Questions", record.totalQuestions]
      ].forEach(([label, value]) => {
        const stat = el("div", "history-stat");
        appendText(stat, "span", "", label);
        appendText(stat, "strong", "", value);
        card.append(stat);
      });
      const actions = el("div", "history-actions");
      [
        ["open", "Open result", "button-primary"],
        ["json", "Export JSON", "button-secondary"],
        ["csv", "Export CSV", "button-secondary"],
        ["delete", "Delete", "button-danger-quiet"]
      ].forEach(([action, label, className]) => {
        const button = el("button", `button small-button ${className}`, label);
        button.type = "button";
        button.dataset.action = action;
        button.dataset.attemptId = record.id;
        actions.append(button);
      });
      card.append(actions);
      list.append(card);
    });
    if (state.history.length && !filteredHistory.length) {
      const empty = el("div", "empty-state");
      appendText(empty, "p", "", "No saved attempts match the current history filters.");
      list.append(empty);
    }
  }

  function updateHistoryFilters() {
    state.historyFilters = {
      section: dom["history-section-filter"].value,
      unit: dom["history-unit-filter"].value,
      date: dom["history-date-filter"].value,
      minScore: dom["history-min-score"].value,
      maxScore: dom["history-max-score"].value,
      minAccuracy: dom["history-min-accuracy"].value,
      maxAccuracy: dom["history-max-accuracy"].value,
      mode: dom["history-mode-filter"].value,
      sort: dom["history-sort"].value
    };
    renderHistory();
  }

  function clearHistoryFilters() {
    state.historyFilters = { section: "all", unit: "all", date: "", minScore: "", maxScore: "", minAccuracy: "", maxAccuracy: "", mode: "all", sort: "date-desc" };
    dom["history-date-filter"].value = "";
    dom["history-min-score"].value = "";
    dom["history-max-score"].value = "";
    dom["history-min-accuracy"].value = "";
    dom["history-max-accuracy"].value = "";
    dom["history-mode-filter"].value = "all";
    dom["history-sort"].value = "date-desc";
    renderHistory();
  }

  function renderMiniSparkline(container, points) {
    if (!container) return;
    container.replaceChildren(); const values = points.map((point) => point.accuracy).filter(Number.isFinite);
    if (values.length < 2) { appendText(container, "p", "demo-note", "Complete more exams to show a trend."); return; }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 420 70"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `Accuracy trend from ${values[0].toFixed(1)}% to ${values[values.length - 1].toFixed(1)}%`);
    const path = document.createElementNS(svg.namespaceURI, "polyline"); path.setAttribute("class", "chart-line"); path.setAttribute("points", values.map((value, index) => `${10 + index * (400 / (values.length - 1))},${60 - value * .5}`).join(" ")); svg.append(path); container.append(svg);
  }

  function renderTrendChart(container, points, field, label) {
    container.replaceChildren(); const valid = points.filter((point) => Number.isFinite(point[field]));
    if (!valid.length) { appendText(container, "p", "chart-empty", "No valid data is available for this graph."); return; }
    const width = 600; const height = 220; const left = 44; const right = 16; const top = 14; const bottom = 34; const maximum = field === "accuracy" ? 100 : Math.max(10, ...valid.map((point) => point[field])) * 1.1;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `${label}: ${valid.map((point) => `${point.label} ${point[field].toFixed(1)}`).join(", ")}`);
    for (let step = 0; step <= 4; step += 1) { const y = top + (height - top - bottom) * step / 4; const line = document.createElementNS(svg.namespaceURI, "line"); line.setAttribute("class", "chart-grid-line"); line.setAttribute("x1", left); line.setAttribute("x2", width - right); line.setAttribute("y1", y); line.setAttribute("y2", y); svg.append(line); const text = document.createElementNS(svg.namespaceURI, "text"); text.setAttribute("class", "chart-label"); text.setAttribute("x", 2); text.setAttribute("y", y + 4); text.textContent = `${((1 - step / 4) * maximum).toFixed(0)}${field === "accuracy" ? "%" : "s"}`; svg.append(text); }
    const coordinates = valid.map((point, index) => ({ x: left + (valid.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (valid.length - 1)), y: top + (maximum - point[field]) / maximum * (height - top - bottom), point }));
    const area = document.createElementNS(svg.namespaceURI, "path"); area.setAttribute("class", "chart-area"); area.setAttribute("d", `M ${coordinates[0].x} ${height - bottom} L ${coordinates.map((item) => `${item.x} ${item.y}`).join(" L ")} L ${coordinates[coordinates.length - 1].x} ${height - bottom} Z`); svg.append(area);
    const line = document.createElementNS(svg.namespaceURI, "polyline"); line.setAttribute("class", "chart-line"); line.setAttribute("points", coordinates.map((item) => `${item.x},${item.y}`).join(" ")); svg.append(line);
    coordinates.forEach(({ x, y, point }, index) => { const circle = document.createElementNS(svg.namespaceURI, "circle"); circle.setAttribute("class", "chart-dot"); circle.setAttribute("cx", x); circle.setAttribute("cy", y); circle.setAttribute("r", 4); const title = document.createElementNS(svg.namespaceURI, "title"); title.textContent = `${point.label}: ${point[field].toFixed(1)}${field === "accuracy" ? "%" : " seconds"}`; circle.append(title); svg.append(circle); if (index === 0 || index === coordinates.length - 1) { const text = document.createElementNS(svg.namespaceURI, "text"); text.setAttribute("class", "chart-label"); text.setAttribute("x", x); text.setAttribute("y", height - 10); text.setAttribute("text-anchor", index === 0 ? "start" : "end"); text.textContent = point.label.length > 18 ? `${point.label.slice(0, 18)}…` : point.label; svg.append(text); } });
    container.append(svg);
  }

  function renderComparisonChart(container, seriesList, field) {
    container.replaceChildren();
    const usable = seriesList.filter((series) => series.points.some((point) => Number.isFinite(point[field])));
    if (!usable.length) { appendText(container, "p", "chart-empty", "Choose one or more areas with valid history to compare."); return; }
    const width = 760; const height = 250; const left = 48; const right = 18; const top = 18; const bottom = 36; const palette = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#be123c"];
    const values = usable.flatMap((series) => series.points.map((point) => point[field]).filter(Number.isFinite)); const maximum = field === "accuracy" ? 100 : Math.max(10, ...values) * 1.1;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `${field === "accuracy" ? "Accuracy" : "Average time"} comparison for ${usable.map((series) => series.label).join(", ")}`);
    for (let step = 0; step <= 4; step += 1) { const y = top + (height - top - bottom) * step / 4; const grid = document.createElementNS(svg.namespaceURI, "line"); grid.setAttribute("class", "chart-grid-line"); grid.setAttribute("x1", left); grid.setAttribute("x2", width - right); grid.setAttribute("y1", y); grid.setAttribute("y2", y); svg.append(grid); }
    usable.forEach((series, seriesIndex) => { const valid = series.points.filter((point) => Number.isFinite(point[field])); const coordinates = valid.map((point, index) => ({ x: left + (valid.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (valid.length - 1)), y: top + (maximum - point[field]) / maximum * (height - top - bottom), point })); const line = document.createElementNS(svg.namespaceURI, "polyline"); line.setAttribute("fill", "none"); line.setAttribute("stroke", palette[seriesIndex]); line.setAttribute("stroke-width", "3"); line.setAttribute("points", coordinates.map((item) => `${item.x},${item.y}`).join(" ")); svg.append(line); coordinates.forEach(({ x, y, point }) => { const dot = document.createElementNS(svg.namespaceURI, "circle"); dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("r", "3"); dot.setAttribute("fill", palette[seriesIndex]); const title = document.createElementNS(svg.namespaceURI, "title"); title.textContent = `${series.label}, ${point.label}: ${point[field].toFixed(1)}${field === "accuracy" ? "%" : " seconds"}`; dot.append(title); svg.append(dot); }); });
    container.append(svg); const legend = el("div", "chart-legend"); usable.forEach((series, index) => { const item = el("span"); const swatch = el("i"); swatch.style.backgroundColor = palette[index]; item.append(swatch, document.createTextNode(series.label)); legend.append(item); }); container.append(legend);
  }

  function renderVolumeChart(container, points) {
    container.replaceChildren(); const valid = points.filter((point) => Number.isFinite(point.total));
    if (!valid.length) { appendText(container, "p", "chart-empty", "No attempt-volume data is available."); return; }
    const width = 600; const height = 190; const left = 30; const bottom = 30; const maximum = Math.max(1, ...valid.map((point) => point.total)); const barWidth = Math.max(4, (width - left - 18) / valid.length * .65);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `Attempt volume: ${valid.map((point) => `${point.label} ${point.total}`).join(", ")}`);
    valid.forEach((point, index) => { const x = left + index * ((width - left - 18) / valid.length) + barWidth * .2; const barHeight = point.total / maximum * (height - bottom - 16); const rect = document.createElementNS(svg.namespaceURI, "rect"); rect.setAttribute("class", "chart-bar"); rect.setAttribute("x", x); rect.setAttribute("y", height - bottom - barHeight); rect.setAttribute("width", barWidth); rect.setAttribute("height", barHeight); const title = document.createElementNS(svg.namespaceURI, "title"); title.textContent = `${point.label}: ${point.total} attempts`; rect.append(title); svg.append(rect); }); container.append(svg);
  }

  function renderPerformanceTable(container, rows, scope) {
    container.replaceChildren();
    if (!rows.length) { appendText(container, "p", "muted-empty", `No ${scope} performance data is available.`); return; }
    const sectionColumns = ["Section", "Available", "Attempts", "Lifetime accuracy", "Recent accuracy", "Accuracy change", "Lifetime avg.", "Recent avg.", "Speed change", "Weakness", "Strength", "Evidence", "Most improved unit", "Weakest unit", "Strongest unit", "Last practiced"];
    const unitColumns = ["Unit", "Available", "Unique tried", "Attempts", "Lifetime accuracy", "Recent accuracy", "Accuracy change", "Lifetime avg.", "Median", "Fastest", "Slowest", "Recent avg.", "Speed change", "Correct", "Incorrect", "Unanswered", "Guessed", "Flagged", "Retired", "Open mistakes", "Weakness", "Strength", "Evidence", "Trend", "Last practiced", "Actions"];
    const table = el("table"); const head = el("thead"); const header = el("tr"); (scope === "section" ? sectionColumns : unitColumns).forEach((label) => appendText(header, "th", "", label)); head.append(header); const body = el("tbody");
    rows.forEach((row) => {
      const tr = el("tr"); const label = scope === "section" ? `Section ${row.id} — ${row.name}` : `${row.sectionId} · ${row.unitCode || row.id} — ${row.name}`;
      const seconds = (value) => Number.isFinite(value) ? `${(value / 1000).toFixed(1)} sec` : "—";
      const accuracyChange = Number.isFinite(row.accuracyChangePoints) ? `${row.accuracyChangePoints >= 0 ? "+" : ""}${row.accuracyChangePoints.toFixed(1)} points` : "—";
      const speedChange = Number.isFinite(row.speedImprovementPercentage) ? `${Math.abs(row.speedImprovementPercentage).toFixed(1)}% ${row.speedImprovementPercentage >= 0 ? "faster" : "slower"}` : "—";
      if (scope === "section") {
        [label, row.available, row.lifetime.total, formatMetricPercent(row.lifetime.accuracy), formatMetricPercent(row.recent.accuracy), accuracyChange, seconds(row.lifetime.averageTimeMs), seconds(row.recent.averageTimeMs), speedChange, Number.isFinite(row.weaknessScore) ? row.weaknessScore.toFixed(1) : "—", row.strength, row.evidence, row.mostImprovedUnit || "—", row.weakestUnit || "—", row.strongestUnit || "—", row.lifetime.lastPracticedAt ? formatDate(row.lifetime.lastPracticedAt) : "Never"].forEach((value) => appendText(tr, "td", "", value));
      } else {
        [label, row.available, row.uniqueQuestionsAttempted, row.lifetime.total, formatMetricPercent(row.lifetime.accuracy), formatMetricPercent(row.recent.accuracy), accuracyChange, seconds(row.lifetime.averageTimeMs), seconds(row.lifetime.medianTimeMs), seconds(row.lifetime.fastestTimeMs), seconds(row.lifetime.slowestTimeMs), seconds(row.recent.averageTimeMs), speedChange, row.lifetime.correct, row.lifetime.incorrect, row.lifetime.unanswered, row.guessed, row.marked, row.retired, row.unresolvedMistakes, Number.isFinite(row.weaknessScore) ? row.weaknessScore.toFixed(1) : "—", row.strength, row.evidence, row.trend, row.lifetime.lastPracticedAt ? formatDate(row.lifetime.lastPracticedAt) : "Never"].forEach((value) => appendText(tr, "td", "", value));
        const actions = el("td"); const group = el("div", "table-action-row"); [["practice", "Practice"], ["weak", "Weak"], ["strong", "Strong"], ["mistakes", "Mistakes"], ["summary", "Summary"], ["notes", "Notes"]].forEach(([action, text]) => { const button = el("button", "button button-secondary small-button", text); button.type = "button"; button.dataset.progressUnitAction = action; button.dataset.unitId = row.id; group.append(button); }); actions.append(group); tr.append(actions);
      }
      body.append(tr);
    });
    table.append(head, body); container.append(table);
  }

  function handleProgressUnitAction(event) {
    const button = event.target.closest("[data-progress-unit-action]");
    if (!button) return;
    const unitId = button.dataset.unitId; const action = button.dataset.progressUnitAction;
    const unitQuestions = state.questionBank.filter((question) => (question.unitId || unitKey(question)) === unitId && !question.retired);
    const records = PROGRESS.historyQuestions(state.history).filter((item) => item.unitId === unitId);
    const incorrectIds = new Set(records.filter((item) => item.status === "Incorrect").map((item) => item.id));
    const mastery = weakAnalytics().mastery || {};
    if (["summary", "notes"].includes(action)) { state.uiPreferences.studyUnit = unitId; state.studyTab = action === "summary" ? "summaries" : "notes"; openNamedScreen("study"); return; }
    let questions = unitQuestions;
    if (action === "mistakes") questions = unitQuestions.filter((question) => incorrectIds.has(question.id));
    if (action === "weak") questions = unitQuestions.filter((question) => incorrectIds.has(question.id) || ["Learning", "Unstable"].includes(mastery[question.id]?.status));
    if (action === "strong") questions = unitQuestions.filter((question) => mastery[question.id]?.status === "Mastered");
    const title = action === "practice" ? "Unit Practice" : action === "mistakes" ? "Unit Mistake Review" : action === "weak" ? "Weak Questions" : "Strong Questions";
    startDirectExam(questions.slice(0, 100), title, Math.max(5, Math.ceil(questions.slice(0, 100).length * state.analyticsSettings.targetTimeSeconds / 60)), { mode: `unit-${action}`, shuffle: true, randomize: true });
  }

  function renderProgress() {
    renderHistory();
    dom["progress-period"].value = state.progressPeriod;
    dom["progress-custom-start"].value = state.progressCustomStart;
    dom["progress-custom-end"].value = state.progressCustomEnd;
    document.querySelectorAll(".custom-period-field").forEach((field) => { field.hidden = state.progressPeriod !== "custom"; });
    dom["progress-group"].value = state.progressGroup;
    dom["progress-scope-type"].value = state.progressScopeType;
    const scopeSelect = dom["progress-scope"]; const previousScope = state.progressScope; scopeSelect.replaceChildren(); const all = el("option", "", state.progressScopeType === "overall" ? "Overall" : "Choose an area"); all.value = "all"; scopeSelect.append(all);
    if (state.progressScopeType === "section") state.catalog.sections.forEach((section) => { const option = el("option", "", `Section ${section.id} — ${section.name}`); option.value = section.id; scopeSelect.append(option); });
    if (state.progressScopeType === "unit") state.catalog.units.filter((unit) => unit.active).forEach((unit) => { const option = el("option", "", `${unit.sectionId} · ${unit.unitCode} — ${unit.unitName}`); option.value = unit.id; scopeSelect.append(option); });
    scopeSelect.disabled = state.progressScopeType === "overall"; scopeSelect.value = Array.from(scopeSelect.options).some((option) => option.value === previousScope) ? previousScope : "all"; state.progressScope = scopeSelect.value;
    const comparisonPanel = dom["progress-comparison-panel"]; const comparisonSelect = dom["progress-comparison"]; comparisonPanel.hidden = state.progressScopeType === "overall"; comparisonSelect.replaceChildren();
    const comparisonChoices = state.progressScopeType === "section" ? state.catalog.sections.map((section) => ({ id: section.id, label: `Section ${section.id} — ${section.name}` })) : state.progressScopeType === "unit" ? state.catalog.units.filter((unit) => unit.active).map((unit) => ({ id: unit.id, label: `${unit.sectionId} · ${unit.unitCode} — ${unit.unitName}` })) : [];
    const validComparisonIds = new Set(comparisonChoices.map((item) => item.id)); state.progressComparisonIds = state.progressComparisonIds.filter((id) => validComparisonIds.has(id)).slice(0, 5);
    comparisonChoices.forEach((item) => { const option = el("option", "", item.label); option.value = item.id; option.selected = state.progressComparisonIds.includes(item.id); comparisonSelect.append(option); }); dom["progress-comparison-metric"].value = state.progressComparisonMetric;
    const records = PROGRESS.scopeRecords(PROGRESS.historyQuestions(state.history), state.progressScopeType, state.progressScope);
    const progressOptions = { period: state.progressPeriod, minimumAnswered: 5, customStart: state.progressCustomStart, customEnd: state.progressCustomEnd, includeUnansweredAsIncorrect: Boolean(state.analyticsSettings.unansweredAsIncorrect), catalog: state.catalog };
    const comparison = PROGRESS.compare(records, progressOptions);
    const cards = dom["progress-summary-cards"]; cards.replaceChildren(); [["Lifetime accuracy", formatMetricPercent(comparison.lifetime.accuracy)], ["Recent accuracy", formatMetricPercent(comparison.recent.accuracy)], ["Previous accuracy", formatMetricPercent(comparison.previous.accuracy)], ["Accuracy change", Number.isFinite(comparison.accuracyChangePoints) ? `${comparison.accuracyChangePoints >= 0 ? "+" : ""}${comparison.accuracyChangePoints.toFixed(1)} points` : "—"], ["Recent average time", Number.isFinite(comparison.recent.averageTimeMs) ? `${(comparison.recent.averageTimeMs / 1000).toFixed(1)} sec` : "—"], ["Speed change", Number.isFinite(comparison.speedImprovementPercentage) ? `${Math.abs(comparison.speedImprovementPercentage).toFixed(1)}% ${comparison.speedImprovementPercentage >= 0 ? "faster" : "slower"}` : "—"]].forEach(([label, value]) => { const card = el("article"); appendText(card, "span", "", label); appendText(card, "strong", "", value); cards.append(card); });
    const scopeLabel = state.progressScopeType === "overall" || state.progressScope === "all" ? "Overall performance" : scopeSelect.options[scopeSelect.selectedIndex]?.textContent || "Selected area";
    dom["progress-summary-text"].textContent = PROGRESS.summaryText(scopeLabel, comparison);
    const series = PROGRESS.graphSeries(state.history, { ...progressOptions, groupBy: state.progressGroup, scopeType: state.progressScopeType, scopeId: state.progressScope }); renderTrendChart(dom["accuracy-chart"], series, "accuracy", "Accuracy over time"); renderTrendChart(dom["speed-chart"], series, "averageSeconds", "Average seconds per question");
    dom["accuracy-chart-summary"].textContent = series.length ? series.map((point) => `${point.label}: ${formatMetricPercent(point.accuracy)}`).join("; ") : "No accuracy data.";
    dom["speed-chart-summary"].textContent = series.length ? series.map((point) => `${point.label}: ${Number.isFinite(point.averageSeconds) ? `${point.averageSeconds.toFixed(1)} seconds` : "no valid time"}`).join("; ") : "No solving-speed data.";
    const comparisonSeries = state.progressComparisonIds.map((id) => ({ id, label: comparisonChoices.find((item) => item.id === id)?.label || id, points: PROGRESS.graphSeries(state.history, { ...progressOptions, groupBy: state.progressGroup, scopeType: state.progressScopeType, scopeId: id }) })); renderComparisonChart(dom["progress-comparison-chart"], comparisonSeries, state.progressComparisonMetric); dom["progress-comparison-summary"].textContent = comparisonSeries.length ? comparisonSeries.map((item) => `${item.label}: ${item.points.length ? item.points.map((point) => `${point.label} ${Number.isFinite(point[state.progressComparisonMetric]) ? point[state.progressComparisonMetric].toFixed(1) : "no data"}`).join(", ") : "no data"}`).join("; ") : "No comparison areas selected.";
    const weak = weakAnalytics(); const progressRecords = PROGRESS.historyQuestions(state.history);
    const unitRows = PROGRESS.performanceRows(state.history, state.questionBank, "unit", progressOptions).map((row) => { const metric = weak.unit.find((item) => item.key === row.id); const openMistakes = progressRecords.filter((item) => item.unitId === row.id && item.status === "Incorrect" && !state.studyData.resolvedMistakes[`${item.attemptId}:${item.id}`]).length; return { ...row, weaknessScore: metric?.weaknessScore, strength: Number.isFinite(row.lifetime.accuracy) ? row.lifetime.accuracy >= 80 ? "Strong" : row.lifetime.accuracy < 60 ? "Weak" : "Developing" : "Unrated", evidence: metric?.evidence || (row.lifetime.graded >= 10 ? "Established" : row.lifetime.graded >= 5 ? "Sufficient" : "Insufficient"), trend: metric?.trend || "Insufficient data", unresolvedMistakes: openMistakes }; });
    const sectionRows = PROGRESS.performanceRows(state.history, state.questionBank, "section", progressOptions).map((row) => { const metric = weak.section.find((item) => item.key === row.id); const children = unitRows.filter((unit) => unit.sectionId === row.id && Number.isFinite(unit.lifetime.accuracy)); const improved = children.filter((unit) => Number.isFinite(unit.accuracyChangePoints)).sort((a, b) => b.accuracyChangePoints - a.accuracyChangePoints)[0]; const weakest = children.slice().sort((a, b) => a.lifetime.accuracy - b.lifetime.accuracy)[0]; const strongest = children.slice().sort((a, b) => b.lifetime.accuracy - a.lifetime.accuracy)[0]; return { ...row, weaknessScore: metric?.weaknessScore, strength: Number.isFinite(row.lifetime.accuracy) ? row.lifetime.accuracy >= 80 ? "Strong" : row.lifetime.accuracy < 60 ? "Weak" : "Developing" : "Unrated", evidence: metric?.evidence || (row.lifetime.graded >= 10 ? "Established" : row.lifetime.graded >= 5 ? "Sufficient" : "Insufficient"), mostImprovedUnit: improved?.unitCode, weakestUnit: weakest?.unitCode, strongestUnit: strongest?.unitCode }; });
    const selectedUnit = state.progressScopeType === "unit" ? unitRows.find((row) => row.id === state.progressScope) : null; dom["progress-unit-detail"].hidden = !selectedUnit; dom["progress-unit-detail-summary"].replaceChildren(); if (selectedUnit) { const unitMastery = state.questionBank.filter((question) => (question.unitId || unitKey(question)) === selectedUnit.id).reduce((counts, question) => { const status = weak.mastery[question.id]?.status || "New"; counts[status] = (counts[status] || 0) + 1; return counts; }, {}); [["Correct", selectedUnit.lifetime.correct], ["Incorrect", selectedUnit.lifetime.incorrect], ["Unanswered", selectedUnit.lifetime.unanswered], ["Open mistakes", selectedUnit.unresolvedMistakes], ["Guessed", selectedUnit.guessed], ["Flagged", selectedUnit.marked], ["Mastery", Object.entries(unitMastery).map(([status, count]) => `${status} ${count}`).join(" · ") || "No questions"]].forEach(([label, value]) => { const item = el("div", "analysis-item"); appendText(item, "span", "", label); appendText(item, "strong", "", value); dom["progress-unit-detail-summary"].append(item); }); renderVolumeChart(dom["progress-unit-volume-chart"], series); dom["progress-unit-volume-summary"].textContent = series.map((point) => `${point.label}: ${point.total} attempts`).join("; "); }
    renderPerformanceTable(dom["progress-section-table"], sectionRows, "section"); renderPerformanceTable(dom["progress-unit-table"], unitRows, "unit"); renderPerformanceTable(dom["progress-accuracy-table"], sectionRows, "section"); renderPerformanceTable(dom["progress-speed-table"], unitRows, "unit");
    const weekly = PROGRESS.weeklySummary(state.history); dom["progress-weekly-summary"].replaceChildren(); [["Questions this week", weekly.current.total], ["Graded", weekly.current.graded], ["Accuracy", formatMetricPercent(weekly.current.accuracy)], ["Unanswered", weekly.current.unanswered], ["Average time", Number.isFinite(weekly.current.averageTimeMs) ? `${(weekly.current.averageTimeMs / 1000).toFixed(1)} sec` : "—"], ["Change", Number.isFinite(weekly.comparison.accuracyChangePoints) ? `${weekly.comparison.accuracyChangePoints >= 0 ? "+" : ""}${weekly.comparison.accuracyChangePoints.toFixed(1)} points` : "Insufficient data"]].forEach(([label, value]) => { const item = el("div", "analysis-item"); appendText(item, "span", "", label); appendText(item, "strong", "", value); dom["progress-weekly-summary"].append(item); }); dom["progress-weekly-summary"].className = "analysis-grid";
    const mastery = weakAnalytics().mastery; const masteryCounts = { New: state.questionBank.filter((question) => !mastery[question.id]).length, Learning: 0, Unstable: 0, Mastered: 0 }; Object.values(mastery).forEach((item) => { masteryCounts[item.status] = (masteryCounts[item.status] || 0) + 1; }); dom["progress-mastery-summary"].replaceChildren(); Object.entries(masteryCounts).forEach(([label, value]) => { const item = el("div", "analysis-item"); appendText(item, "span", "", label); appendText(item, "strong", "", value); dom["progress-mastery-summary"].append(item); }); dom["progress-mastery-summary"].className = "analysis-grid";
    document.querySelectorAll("[data-progress-tab]").forEach((button) => { const active = button.dataset.progressTab === state.progressTab; button.setAttribute("aria-selected", String(active)); }); document.querySelectorAll("[data-progress-pane]").forEach((pane) => { pane.hidden = pane.dataset.progressPane !== state.progressTab; });
    state.uiPreferences.progressTab = state.progressTab; writeStorage(STORAGE_KEYS.uiPreferences, state.uiPreferences);
  }

  function openHistoryResult(id) {
    const record = state.history.find((item) => item.id === id);
    if (!record) {
      setMessage("That saved result could not be found.", "error");
      return;
    }
    renderResults(record);
    showScreen("results");
  }

  function escapeCsv(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportHistoryJson(record) {
    const safeTitle = record.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "cma-result";
    downloadFile(`${safeTitle}-${record.id.slice(-8)}.json`, `${JSON.stringify(record, null, 2)}\n`, "application/json");
  }

  function exportHistoryCsv(record) {
    const headers = ["Attempt ID", "Exam title", "Completed at", "Questions", "Time limit (seconds)", "Time used (seconds)", "Score", "Percentage", "Correct", "Incorrect", "Unanswered", "Average time (seconds)"];
    const values = [
      record.id,
      record.title,
      record.completedAt,
      record.totalQuestions,
      record.durationSeconds,
      (record.totalTimeUsedMs / 1000).toFixed(2),
      record.score,
      Number(record.percentage).toFixed(1),
      record.correct,
      record.incorrect,
      record.unanswered,
      (record.averageTimeMs / 1000).toFixed(2)
    ];
    const csv = `${headers.map(escapeCsv).join(",")}\r\n${values.map(escapeCsv).join(",")}\r\n`;
    const safeTitle = record.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "cma-summary";
    downloadFile(`${safeTitle}-summary.csv`, csv, "text/csv;charset=utf-8");
  }

  async function handleHistoryAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const record = state.history.find((item) => item.id === button.dataset.attemptId);
    if (!record) return;
    if (button.dataset.action === "open") openHistoryResult(record.id);
    if (button.dataset.action === "json") exportHistoryJson(record);
    if (button.dataset.action === "csv") exportHistoryCsv(record);
    if (button.dataset.action === "delete") {
      const confirmed = await askConfirmation("Delete this saved attempt?", `“${record.title}” from ${formatDate(record.completedAt)} will be removed from this browser.`, "Delete attempt");
      if (!confirmed) return;
      state.history = state.history.filter((item) => item.id !== record.id);
      writeStorage(STORAGE_KEYS.history, state.history);
      renderProgress();
      renderHome();
      setMessage("The saved attempt was deleted.", "success");
    }
  }

  async function clearAllHistory() {
    if (!state.history.length) return;
    const confirmed = await askConfirmation("Clear all exam history?", `This will permanently remove ${state.history.length} saved attempt${state.history.length === 1 ? "" : "s"} from this browser.`, "Clear all history");
    if (!confirmed) return;
    state.history = [];
    writeStorage(STORAGE_KEYS.history, state.history);
    renderProgress();
    renderHome();
    setMessage("All saved exam history was cleared.", "success");
  }

  function completeConfirmation(accepted) {
    const resolver = state.confirmResolver;
    state.confirmResolver = null;
    if (dom["confirm-dialog"].open) dom["confirm-dialog"].close();
    if (resolver) resolver(Boolean(accepted));
  }

  function askConfirmation(title, message, acceptText = "Confirm") {
    if (state.confirmResolver) completeConfirmation(false);
    dom["confirm-dialog-title"].textContent = title;
    dom["confirm-dialog-message"].textContent = message;
    dom["confirm-dialog-accept"].textContent = acceptText;
    if (typeof dom["confirm-dialog"].showModal !== "function") {
      return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    }
    return new Promise((resolve) => {
      state.confirmResolver = resolve;
      dom["confirm-dialog"].showModal();
    });
  }

  async function discardActiveExam() {
    const exam = state.activeExam;
    if (!exam) return;
    const confirmed = await askConfirmation("Discard the unfinished exam?", "Answers and timing for this unfinished attempt will be removed. Completed history will not be affected.", "Discard attempt");
    if (!confirmed) return;
    if (exam.status === "active") commitCurrentQuestionTime();
    stopTimerLoop();
    state.activeExam = null;
    removeStorage(STORAGE_KEYS.activeExam);
    renderHome();
    showScreen("home");
    setMessage("The unfinished attempt was discarded.", "success");
  }

  function createDirectExam(questions, title, minutes, options = {}) {
    const selected = (options.randomize === false ? questions.slice() : fisherYates(questions)).map((question) => ({ ...deepClone(question), optionOrder: options.shuffle === false ? OPTION_KEYS.slice() : fisherYates(OPTION_KEYS) }));
    const now = Date.now(); const durationSeconds = Math.max(60, Math.round((Number(minutes) || 1) * 60));
    return { version: 3, id: createId("attempt"), title, durationSeconds, settings: { selectedSections: uniqueSorted(selected.map((question) => question.sectionId || question.section)), selectedUnits: uniqueSorted(selected.map((question) => question.unitId || unitKey(question))), eligibleQuestionCount: questions.length, selectedQuestionCount: selected.length, randomizeQuestions: options.randomize !== false, balancedDistribution: Boolean(options.balanced), questionOrder: options.randomize === false ? "original" : "random", shuffleOptions: options.shuffle !== false, confirmSubmit: true, allowReview: true, unansweredWarning: true, mode: options.mode || "practice", autoRetireMastered: Boolean(options.autoRetireMastered), removeFastQuestions: options.removeFastQuestions !== undefined ? Boolean(options.removeFastQuestions) : state.analyticsSettings.removeFastQuestions !== false, fastQuestionRemovalSeconds: FAST_QUESTION_REMOVAL_SECONDS, v2Metadata: options.v2Metadata ? deepClone(options.v2Metadata) : null }, questions: selected, questionIds: selected.map((question) => question.id), answers: {}, marked: {}, guessed: {}, timesMs: selected.reduce((map, question) => ({ ...map, [question.id]: 0 }), {}), currentIndex: 0, startTime: now, endTime: now + durationSeconds * 1000, visitStartedAt: now, status: "active", submitted: false, pauseReasons: { manualPause: false, noteEditor: false, hiddenTab: false, systemDialog: false }, pauseReasonStartedAt: {}, pauseStartedAt: null, totalPausedMs: 0, manualPausedMs: 0, notePausedMs: 0, hiddenPausedMs: 0 };
  }

  function startDirectExam(questions, title, minutes, options = {}) {
    if (!questions.length) { setMessage("No eligible questions match this practice selection.", "warning", 8000); return; }
    state.activeExam = createDirectExam(questions, title, minutes, options); saveActiveExam(); enterExamScreen();
  }

  function retestIncorrect() {
    const ids = new Set((state.currentResult?.perQuestion || []).filter((item) => item.status !== "Correct").map((item) => item.id));
    const questions = state.questionBank.filter((question) => ids.has(question.id));
    startDirectExam(questions, "Retest Incorrect Questions", Math.max(5, Math.ceil(questions.length * state.analyticsSettings.targetTimeSeconds / 60)), { mode: "retest-incorrect", shuffle: true, randomize: true });
  }

  function weakAnalytics() { return ADVANCED.calculateWeakAnalytics(state.history, state.analyticsSettings); }

  function renderWeakAreas() {
    const analytics = weakAnalytics(); state.weakAnalytics = analytics;
    if (!(state.weakUnitIds instanceof Set)) state.weakUnitIds = new Set(analytics.unit.filter((item) => item.weaknessScore >= 35).map((item) => item.key));
    const summary = dom["weak-summary-cards"]; summary.replaceChildren();
    const weakUnits = analytics.unit.filter((item) => item.weaknessScore >= 65).length; const improving = analytics.unit.filter((item) => item.trend === "Improving").length; const mastered = Object.values(analytics.mastery).filter((item) => item.status === "Mastered").length;
    [["Recorded answers", analytics.attempts.length, "All completed attempts"], ["Weak units", weakUnits, "Score 65 or higher"], ["Improving units", improving, "Recent accuracy is rising"], ["Mastered questions", mastered, `${state.analyticsSettings.masteryThreshold} consecutive correct`]].forEach(([label, value, detail], index) => addScoreCard(summary, label, value, detail, index === 0));
    const sectionFilter = dom["weak-section-filter"]; const previous = sectionFilter.value || "all"; sectionFilter.replaceChildren(); const all = el("option", "", "All"); all.value = "all"; sectionFilter.append(all); state.catalog.sections.forEach((section) => { const option = el("option", "", `${section.id} — ${section.name}`); option.value = section.id; sectionFilter.append(option); }); sectionFilter.value = Array.from(sectionFilter.options).some((option) => option.value === previous) ? previous : "all";
    let units = analytics.unit.map((metric) => ({ metric, unit: state.catalog.units.find((unit) => unit.id === metric.key) })).filter((item) => item.unit);
    const evidence = dom["weak-evidence-filter"].value; const trend = dom["weak-trend-filter"].value;
    if (sectionFilter.value !== "all") units = units.filter((item) => item.unit.sectionId === sectionFilter.value);
    if (evidence !== "all") units = units.filter((item) => evidence === "Insufficient" ? item.metric.evidence === "Insufficient data" : evidence === "Sufficient" ? item.metric.evidence === "Limited evidence" : item.metric.evidence === "Established evidence");
    if (trend !== "all") units = units.filter((item) => item.metric.trend === trend);
    const sort = dom["weak-sort"].value; units.sort((a, b) => sort === "accuracy" ? a.metric.overallAccuracy - b.metric.overallAccuracy : sort === "attempts" ? b.metric.totalAttempts - a.metric.totalAttempts : b.metric.weaknessScore - a.metric.weaknessScore);
    const body = dom["weak-unit-table"]; body.replaceChildren();
    units.forEach(({ metric, unit }) => { const row = el("tr"); const checkCell = el("td"); const checkbox = el("input"); checkbox.type = "checkbox"; checkbox.dataset.weakUnit = unit.id; checkbox.checked = state.weakUnitIds.has(unit.id); checkCell.append(checkbox); row.append(checkCell); appendText(row, "td", "", `${unit.sectionId} · ${unit.unitCode} — ${unit.unitName}`); appendText(row, "td", "", metric.totalAttempts); appendText(row, "td", "", `${(metric.overallAccuracy * 100).toFixed(1)}%`); appendText(row, "td", "", formatDuration(metric.averageTimeMs)); appendText(row, "td", "", metric.repeatedlyIncorrect); const evidenceCell = el("td"); appendText(evidenceCell, "span", `badge ${metric.evidence.startsWith("Insufficient") ? "unclassified" : "ready"}`, metric.evidence); row.append(evidenceCell); const trendCell = el("td"); appendText(trendCell, "span", `badge ${metric.trend}`, metric.trend); row.append(trendCell); const weaknessCell = el("td", "weakness-meter"); const meter = el("meter"); meter.min = 0; meter.max = 100; meter.low = 35; meter.high = 65; meter.optimum = 0; meter.value = metric.weaknessScore; weaknessCell.append(meter, document.createTextNode(` ${metric.weaknessScore.toFixed(1)}`)); row.append(weaknessCell); body.append(row); });
    dom["weak-empty"].hidden = analytics.attempts.length > 0;
    dom["weakness-formula"].textContent = "Weakness = 100 × (50% overall accuracy deficit + 25% recent accuracy deficit + 15% slow-answer rate + 10% repeated-error rate). Evidence labels and trends are shown separately so small samples are not over-interpreted.";
    const masteryBody = dom["mastery-table"]; masteryBody.replaceChildren();
    state.questionBank.slice().sort((a, b) => naturalCompare(a.id, b.id)).forEach((question) => { const item = analytics.mastery[question.id]; const status = item?.status || "New"; const row = el("tr"); appendText(row, "td", "", question.id); appendText(row, "td", "", unitDisplayName(question)); const cell = el("td"); appendText(cell, "span", `badge ${status.replace(/\s+/g, "-")}`, status); row.append(cell); appendText(row, "td", "", item?.consecutiveCorrect || 0); appendText(row, "td", "", item?.attempts || 0); masteryBody.append(row); });
  }

  function startWeakAreaExam(event) {
    event?.preventDefault(); const analytics = state.weakAnalytics || weakAnalytics();
    const count = Math.max(1, Number(dom["weak-count"].value) || 15); const threshold = Math.max(0, Math.min(1, Number(dom["weak-threshold"].value) || 0)) * 100;
    const selected = ADVANCED.selectWeakQuestions(state.questionBank, analytics, { unitIds: Array.from(state.weakUnitIds || []), minimumAttempts: Number(dom["weak-practice-min-attempts"].value) || 0, weaknessThreshold: threshold, onlyWeakUnits: true, includeNew: dom["weak-include-new"].checked, includeMastered: dom["weak-include-mastered"].checked, prioritizeRecentMistakes: dom["weak-prioritize-recent"].checked, count });
    startDirectExam(selected.map((item) => item.question), "Weak-Area Practice", Number(dom["weak-time"].value) || 25, { mode: "weak-area", balanced: dom["weak-balance"].checked, randomize: dom["weak-random"].checked, shuffle: dom["weak-shuffle"].checked });
  }

  function practiceWeakFromResults() {
    openNamedScreen("weak");
    const resultUnits = new Set((state.currentResult?.perQuestion || []).filter((item) => item.status !== "Correct").map((item) => item.unitId));
    if (resultUnits.size) state.weakUnitIds = resultUnits; renderWeakAreas();
  }

  function persistStudyData(message = "Study data saved locally.") {
    state.studyData.version = 1;
    const saved = writeStorage(STORAGE_KEYS.studyData, state.studyData);
    if (dom["study-save-status"]) dom["study-save-status"].textContent = saved ? message : "Study data is available now, but local storage could not be updated.";
    renderHome();
    return saved;
  }

  function currentStudyUnitId() { return dom["study-unit"]?.value || state.catalog.units.find((unit) => unit.active)?.id || ""; }

  function renderStudy() {
    const select = dom["study-unit"]; const previous = select.value || state.uiPreferences.studyUnit || ""; select.replaceChildren();
    state.catalog.units.filter((unit) => unit.active).forEach((unit) => { const option = el("option", "", `${unit.sectionId} · ${unit.unitCode} — ${unit.unitName}`); option.value = unit.id; select.append(option); });
    select.value = Array.from(select.options).some((option) => option.value === previous) ? previous : select.options[0]?.value || "";
    state.uiPreferences.studyUnit = select.value;
    const unitId = currentStudyUnitId(); const notes = state.studyData.notes[unitId] || { text: "", needsReview: false };
    dom["study-summary"].value = state.studyData.summaries[unitId] || ""; dom["study-notes"].value = notes.text || ""; dom["study-note-needs-review"].checked = Boolean(notes.needsReview); dom["study-formula-notes"].value = state.studyData.formulaNotes || "";
    renderStudyMistakes(unitId); renderStudyChecklist(); renderStudyDue();
    document.querySelectorAll("[data-study-tab]").forEach((button) => { const active = button.dataset.studyTab === state.studyTab; button.setAttribute("aria-selected", String(active)); }); document.querySelectorAll("[data-study-pane]").forEach((pane) => { pane.hidden = pane.dataset.studyPane !== state.studyTab; });
    state.uiPreferences.studyTab = state.studyTab; writeStorage(STORAGE_KEYS.uiPreferences, state.uiPreferences);
  }

  function renderStudyMistakes(unitId) {
    const container = dom["study-mistake-list"]; container.replaceChildren(); const items = PROGRESS.historyQuestions(state.history).filter((item) => item.unitId === unitId && item.status === "Incorrect").sort((a, b) => b.completedMs - a.completedMs);
    items.forEach((item) => { const key = `${item.attemptId}:${item.id}`; const row = el("label", "mistake-item"); const input = el("input"); input.type = "checkbox"; input.dataset.mistakeKey = key; input.checked = Boolean(state.studyData.resolvedMistakes[key]); const copy = el("span"); appendText(copy, "p", "", item.question || item.id); appendText(copy, "small", "", `${formatDate(item.completedAt)} · ${item.id} · ${item.explanation || "No explanation"}`); row.append(input, copy, el("span", `badge ${input.checked ? "ready" : "error"}`, input.checked ? "Resolved" : "Open")); container.append(row); });
    if (!items.length) appendText(container, "p", "muted-empty", "No incorrect responses are recorded for this unit.");
  }

  function renderStudyChecklist() {
    const container = dom["study-checklist"]; container.replaceChildren(); state.studyData.checklist.forEach((item) => { const row = el("div", "checklist-item"); const input = el("input"); input.type = "checkbox"; input.checked = Boolean(item.done); input.dataset.checklistToggle = item.id; appendText(row, "span", "", item.text); const remove = el("button", "button button-quiet small-button", "Remove"); remove.type = "button"; remove.dataset.checklistRemove = item.id; row.prepend(input); row.append(remove); container.append(row); }); if (!state.studyData.checklist.length) appendText(container, "p", "muted-empty", "No revision items yet.");
  }

  function renderStudyDue() {
    const container = dom["study-due-list"]; container.replaceChildren(); const mastery = weakAnalytics().mastery || {}; const due = state.questionBank.filter((question) => !question.retired && mastery[question.id] && mastery[question.id].status !== "Mastered"); due.slice(0, 100).forEach((question) => { const row = el("div", "due-item"); const copy = el("span"); appendText(copy, "p", "", question.question); appendText(copy, "small", "", `${question.id} · ${unitDisplayName(question)} · ${mastery[question.id].status}`); row.append(el("span", `badge ${mastery[question.id].status}`, mastery[question.id].status), copy); container.append(row); }); if (!due.length) appendText(container, "p", "muted-empty", "No attempted learning questions are due right now."); dom["study-start-due"].disabled = !due.length;
  }

  function saveCurrentStudySummary() { const unitId = currentStudyUnitId(); if (!unitId) return; state.studyData.summaries[unitId] = dom["study-summary"].value; persistStudyData("Unit summary saved."); }
  function saveCurrentStudyNotes() { const unitId = currentStudyUnitId(); if (!unitId) return; state.studyData.notes[unitId] = { text: dom["study-notes"].value, needsReview: dom["study-note-needs-review"].checked, updatedAt: new Date().toISOString() }; persistStudyData("Unit notes saved."); }
  function saveFormulaNotes() { state.studyData.formulaNotes = dom["study-formula-notes"].value; persistStudyData("Formula notes saved."); }
  function startDueReview() { const mastery = weakAnalytics().mastery || {}; const due = state.questionBank.filter((question) => !question.retired && mastery[question.id] && mastery[question.id].status !== "Mastered"); startDirectExam(due.slice(0, 50), "Due Mastery Review", Math.max(10, Math.ceil(due.slice(0, 50).length * state.analyticsSettings.targetTimeSeconds / 60)), { mode: "due", shuffle: true, randomize: true }); }

  function queueStatus(item) {
    if (item.validationErrors?.length) return "error";
    if (!item.sectionId || !item.unitId) return "unclassified";
    return "ready";
  }

  function parseQuestionsForReview() {
    const result = ADVANCED.parseQuestionText(dom["text-import-input"].value, state.catalog);
    const duplicates = ADVANCED.detectQuestionDuplicates(result.candidates, state.questionBank);
    const duplicateMap = new Map(duplicates.map((item) => [item.temporaryId, item]));
    const stamp = Date.now();
    state.importQueue = result.candidates.map((candidate, index) => ({
      ...candidate,
      temporaryId: `${candidate.temporaryId}-${stamp}-${index + 1}`,
      originalTemporaryId: candidate.temporaryId,
      approved: false,
      reviewed: false,
      allowDuplicate: false,
      duplicateMatches: duplicateMap.get(candidate.temporaryId) || null
    }));
    persistAdvancedState();
    dom["parse-errors"].hidden = !(result.errors.length || result.warnings.length);
    dom["parse-errors"].textContent = [...result.errors, ...result.warnings].join(" ");
    dom["ai-import-status"].hidden = false; dom["ai-import-status"].className = `message ${result.candidates.length ? "message-success" : "message-error"}`;
    dom["ai-import-status"].textContent = result.candidates.length ? `Parsed ${result.candidates.length} question${result.candidates.length === 1 ? "" : "s"}. Review every item before saving.` : "No questions could be parsed.";
    renderImportQueue();
  }

  function renderImportQueue() {
    dom["import-queue-count"].textContent = state.importQueue.length;
    const container = dom["import-review-list"]; container.replaceChildren();
    const filter = dom["import-filter"]?.value || state.importFilter || "all"; state.importFilter = filter;
    const visible = state.importQueue.filter((item) => filter === "all" || queueStatus(item) === filter);
    if (!visible.length) { appendText(container, "p", "muted-empty", state.importQueue.length ? "No review items match this filter." : "Parse pasted questions to create a review queue."); return; }
    visible.forEach((item) => {
      const status = queueStatus(item); const card = el("article", `import-review-card${status === "error" ? " has-errors" : ""}`); card.dataset.queueId = item.temporaryId;
      const header = el("div", "review-header"); const title = el("div"); appendText(title, "strong", "", `Question ${item.questionNumber || ""}`); appendText(title, "span", `badge ${status}`, status === "ready" ? "Ready for review" : status === "unclassified" ? "Needs classification" : "Fix parser errors");
      const approve = el("label", "consent-row"); const approveInput = el("input"); approveInput.type = "checkbox"; approveInput.dataset.queueField = "approved"; approveInput.checked = Boolean(item.approved); approveInput.disabled = status !== "ready"; approve.append(approveInput, document.createTextNode("Approve")); header.append(title, approve); card.append(header);
      const grid = el("div", "review-edit-grid");
      const addField = (labelText, field, value, type = "input") => { const label = el("label", "", labelText); const control = el(type === "textarea" ? "textarea" : "input"); if (type === "textarea") control.rows = 2; control.value = value || ""; control.dataset.queueField = field; label.append(control); grid.append(label); };
      addField("Question", "question", item.question, "textarea"); OPTION_KEYS.forEach((key) => addField(`Option ${key}`, `option-${key}`, item.options?.[key], "textarea"));
      const answerLabel = el("label", "", "Correct answer"); const answer = el("select"); answer.dataset.queueField = "correctAnswer"; OPTION_KEYS.forEach((key) => { const option = el("option", "", key); option.value = key; answer.append(option); }); answer.value = item.correctAnswer; answerLabel.append(answer); grid.append(answerLabel);
      const sectionLabel = el("label", "", "Section"); const sectionSelect = el("select"); sectionSelect.dataset.queueField = "sectionId"; const blankSection = el("option", "", "Choose section"); blankSection.value = ""; sectionSelect.append(blankSection); state.catalog.sections.forEach((section) => { const option = el("option", "", `${section.id} — ${section.name}`); option.value = section.id; sectionSelect.append(option); }); sectionSelect.value = item.sectionId || ""; sectionLabel.append(sectionSelect); grid.append(sectionLabel);
      const unitLabel = el("label", "", "Unit"); const unitSelect = el("select"); unitSelect.dataset.queueField = "unitId"; const blankUnit = el("option", "", "Choose unit"); blankUnit.value = ""; unitSelect.append(blankUnit); state.catalog.units.filter((unit) => unit.sectionId === item.sectionId).forEach((unit) => { const option = el("option", "", `${unit.unitCode} — ${unit.unitName}`); option.value = unit.id; unitSelect.append(option); }); unitSelect.value = item.unitId || ""; unitLabel.append(unitSelect); grid.append(unitLabel);
      addField("Topic", "topic", item.topic); addField("Tags, comma separated", "tags", (item.tags || []).join(", ")); addField("Explanation", "explanation", item.explanation, "textarea");
      const difficultyLabel = el("label", "", "Difficulty"); const difficulty = el("select"); difficulty.dataset.queueField = "difficulty"; ["unspecified", "easy", "medium", "hard"].forEach((value) => { const option = el("option", "", value); option.value = value; difficulty.append(option); }); difficulty.value = item.difficulty || "unspecified"; difficultyLabel.append(difficulty); grid.append(difficultyLabel);
      card.append(grid);
      const meta = el("p", "demo-note"); meta.textContent = item.classificationConfidence !== undefined ? `AI confidence ${(Number(item.classificationConfidence) * 100).toFixed(0)}% · ${item.briefReason || "No reason supplied"}` : "Local parse only · no data sent"; card.append(meta);
      if (item.duplicateMatches?.exactId || item.duplicateMatches?.exactTextId || item.duplicateMatches?.near?.length || item.possibleDuplicateIds?.length) {
        const duplicate = el("label", "consent-row"); const input = el("input"); input.type = "checkbox"; input.dataset.queueField = "allowDuplicate"; input.checked = Boolean(item.allowDuplicate); duplicate.append(input, document.createTextNode("Possible duplicate detected — allow saving anyway")); card.append(duplicate);
      }
      if (item.validationErrors?.length) appendText(card, "p", "inline-error", item.validationErrors.join("; "));
      container.append(card);
    });
  }

  function handleImportQueueChange(event) {
    const control = event.target.closest("[data-queue-field]"); const card = event.target.closest("[data-queue-id]"); if (!control || !card) return;
    const item = state.importQueue.find((candidate) => candidate.temporaryId === card.dataset.queueId); if (!item) return;
    const field = control.dataset.queueField; const value = control.type === "checkbox" ? control.checked : control.value;
    if (field.startsWith("option-")) item.options[field.slice(-1)] = value;
    else if (field === "tags") item.tags = value.split(",").map((tag) => tag.trim()).filter(Boolean);
    else item[field] = value;
    if (field === "sectionId") { item.unitId = ""; item.approved = false; renderImportQueue(); }
    if (["sectionId", "unitId", "question", "correctAnswer"].includes(field)) item.reviewed = true;
    persistAdvancedState();
  }

  function approveHighConfidence() {
    state.importQueue.forEach((item) => { if (queueStatus(item) === "ready" && Number(item.classificationConfidence) >= 0.85 && !(item.duplicateMatches?.near?.length || item.possibleDuplicateIds?.length)) { item.approved = true; item.reviewed = true; } }); persistAdvancedState(); renderImportQueue();
  }

  function saveApprovedQuestions() {
    const approved = state.importQueue.filter((item) => item.approved && queueStatus(item) === "ready" && (item.allowDuplicate || !(item.duplicateMatches?.exactTextId || item.duplicateMatches?.near?.length || item.possibleDuplicateIds?.length)));
    const raw = approved.map((item, index) => { const unit = ADVANCED.findUnit(state.catalog, item.sectionId, item.unitId); const section = ADVANCED.findSection(state.catalog, item.sectionId); return { id: item.existingQuestionId || `${unit.id}-${Date.now().toString(36)}-${String(index + 1).padStart(3, "0")}`, sectionId: section.id, unitId: unit.id, section: section.id, sectionName: section.name, unit: unit.unitCode, unitName: unit.unitName, question: item.question, options: item.options, correctAnswer: item.correctAnswer, explanation: item.explanation, topic: item.topic, tags: item.tags, difficulty: item.difficulty === "unspecified" ? "Medium" : item.difficulty[0].toUpperCase() + item.difficulty.slice(1), source: item.source || "text-import", classification: { status: "confirmed", method: item.classificationConfidence !== undefined ? "ai-reviewed" : "human-reviewed", confidence: Number(item.classificationConfidence) || 1, reviewed: true, reviewedAt: new Date().toISOString(), briefReason: item.briefReason || "" } }; });
    if (!raw.length) { setMessage("Approve at least one ready item. Possible duplicates also require explicit permission.", "warning", 8000); return; }
    const validation = validateQuestionBank(raw, { catalog: state.catalog, existingIds: state.questionBank.map((question) => question.id) });
    if (!validation.valid) { setMessage(validation.errors.slice(0, 5).join(" "), "error", 9000); return; }
    const merged = mergeQuestions(state.questionBank, validation.questions, "replace"); state.questionBank = merged.questions; state.importQueue = state.importQueue.filter((item) => !approved.includes(item)); state.bankName = "Personal CMA question bank"; persistQuestionBank(state.bankName); persistAdvancedState(); renderImportQueue(); renderHome(); renderBankScreen(); setMessage(`Saved ${validation.questions.length} approved question${validation.questions.length === 1 ? "" : "s"} to the bank.`, "success");
  }

  async function classifyImportQueue() {
    if (!state.analyticsSettings.aiEnabled) { setMessage("AI controls are disabled in Settings.", "warning"); return; }
    if (!dom["ai-consent"].checked) { setMessage("Confirm the one-time consent checkbox before sending question text.", "warning", 8000); return; }
    const candidates = state.importQueue.filter((item) => !item.validationErrors?.length); if (!candidates.length) { setMessage("Parse valid questions before requesting classification.", "warning"); return; }
    state.aiAbortController = new AbortController(); dom["classify-ai"].disabled = true; dom["cancel-ai"].disabled = false; dom["ai-progress"].hidden = false; dom["ai-progress"].value = 0;
    const status = dom["ai-import-status"]; status.hidden = false; status.className = "message";
    try {
      const size = state.analyticsSettings.aiBatchSize; let completed = 0;
      for (let start = 0; start < candidates.length; start += size) {
        const batch = candidates.slice(start, start + size); status.textContent = `Classifying ${start + 1}–${Math.min(start + size, candidates.length)} of ${candidates.length}…`;
        const response = await fetch("/api/ai/classify", { method: "POST", headers: { "Content-Type": "application/json" }, signal: state.aiAbortController.signal, body: JSON.stringify({ candidates: batch, catalog: state.catalog, timeoutMs: state.analyticsSettings.aiTimeoutMs }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "AI classification failed.");
        const validated = ADVANCED.validateClassificationResponse(data, batch, state.catalog); if (!validated.valid) throw new Error(validated.errors.join(" "));
        validated.results.forEach((result) => { const item = state.importQueue.find((candidate) => candidate.temporaryId === result.temporaryId); if (item) Object.assign(item, result, { approved: false, reviewed: false }); });
        completed += batch.length; dom["ai-progress"].value = (completed / candidates.length) * 100; persistAdvancedState(); renderImportQueue();
      }
      status.className = "message message-success"; status.textContent = `Classification returned for ${candidates.length} question${candidates.length === 1 ? "" : "s"}. Human review is still required.`;
    } catch (error) { status.className = "message message-error"; status.textContent = error.name === "AbortError" ? "AI classification was cancelled. Completed batches remain in review." : `AI classification failed safely: ${error.message}`; }
    finally { state.aiAbortController = null; dom["classify-ai"].disabled = false; dom["cancel-ai"].disabled = true; }
  }

  function catalogQuestionCount(unitId) {
    return state.questionBank.filter((question) => question.unitId === unitId).length;
  }

  function renderSyllabus() {
    const stats = dom["syllabus-stats"];
    stats.replaceChildren();
    const classified = state.questionBank.filter((question) => ADVANCED.questionClassificationState(question, state.catalog) !== "unclassified").length;
    [["Sections", state.catalog.sections.length], ["Units", state.catalog.units.length], ["Active units", state.catalog.units.filter((unit) => unit.active).length], ["Classified questions", classified], ["Unclassified questions", state.questionBank.length - classified]].forEach(([label, value]) => {
      const card = el("article", "bank-stat"); appendText(card, "span", "", label); appendText(card, "strong", "", value); stats.append(card);
    });
    const tree = dom["syllabus-tree"]; tree.replaceChildren();
    state.catalog.sections.forEach((section) => {
      const wrapper = el("article", `syllabus-section${section.active ? "" : " inactive"}`);
      const header = el("header");
      const title = el("div"); appendText(title, "strong", "", `Section ${section.id} — ${section.name}`); appendText(title, "small", "", section.description || "No description");
      const actions = el("div", "syllabus-actions");
      [["edit-section", "Edit"], ["toggle-section", section.active ? "Deactivate" : "Activate"], ["delete-section", "Remove"]].forEach(([action, label]) => { const button = el("button", "button button-secondary small-button", label); button.type = "button"; button.dataset.syllabusAction = action; button.dataset.sectionId = section.id; actions.append(button); });
      header.append(title, actions); wrapper.append(header);
      const units = el("div", "syllabus-units");
      state.catalog.units.filter((unit) => unit.sectionId === section.id).sort(ADVANCED.compareUnits).forEach((unit) => {
        const row = el("div", `syllabus-unit${unit.active ? "" : " inactive"}`);
        const code = el("div"); appendText(code, "strong", "", unit.unitCode); appendText(code, "small", "", unit.id);
        const name = el("div"); appendText(name, "strong", "", unit.unitName); appendText(name, "small", "", unit.outline || unit.description || "No description");
        const count = el("span", "badge", `${catalogQuestionCount(unit.id)} question${catalogQuestionCount(unit.id) === 1 ? "" : "s"}`);
        const unitActions = el("div", "syllabus-actions");
        [["edit-unit", "Edit"], ["toggle-unit", unit.active ? "Deactivate" : "Activate"], ["delete-unit", "Merge / remove"]].forEach(([action, label]) => { const button = el("button", "button button-secondary small-button", label); button.type = "button"; button.dataset.syllabusAction = action; button.dataset.unitId = unit.id; unitActions.append(button); });
        row.append(code, name, count, unitActions); units.append(row);
      });
      if (!units.childElementCount) appendText(units, "p", "muted-empty", "No units in this section.");
      wrapper.append(units); tree.append(wrapper);
    });
  }

  function populateCatalogSectionSelect(select, selected = "") {
    select.replaceChildren();
    state.catalog.sections.forEach((section) => { const option = el("option", "", `Section ${section.id} — ${section.name}`); option.value = section.id; select.append(option); });
    if (selected) select.value = selected;
  }

  function openSectionEditor(sectionId = "") {
    const section = state.catalog.sections.find((item) => item.id === sectionId);
    state.editingSectionId = section?.id || "";
    dom["section-dialog-title"].textContent = section ? "Edit section" : "Add section";
    dom["section-id"].value = section?.id || ""; dom["section-id"].disabled = Boolean(section);
    dom["section-name"].value = section?.name || ""; dom["section-description"].value = section?.description || ""; dom["section-active"].checked = section?.active !== false;
    dom["section-error"].hidden = true; dom["section-dialog"].showModal();
  }

  function saveSectionEditor(event) {
    event.preventDefault();
    const id = normalizeSectionValue(dom["section-id"].value);
    const name = dom["section-name"].value.trim();
    const errors = [];
    if (!id) errors.push("Stable ID must be A, B, C, D, E, or F.");
    if (!name) errors.push("Section name is required.");
    if (!state.editingSectionId && state.catalog.sections.some((section) => section.id === id)) errors.push(`Section ${id} already exists.`);
    if (errors.length) { dom["section-error"].textContent = errors.join(" "); dom["section-error"].hidden = false; return; }
    const record = { id, letter: id, name, description: dom["section-description"].value.trim(), active: dom["section-active"].checked };
    if (state.editingSectionId) state.catalog.sections = state.catalog.sections.map((section) => section.id === state.editingSectionId ? record : section);
    else state.catalog.sections.push(record);
    state.catalog.sections.sort((a, b) => naturalCompare(a.id, b.id)); state.catalog.updatedAt = new Date().toISOString();
    persistAdvancedState(); dom["section-dialog"].close(); renderSyllabus(); renderBankScreen();
  }

  function openUnitEditor(unitId = "") {
    const unit = state.catalog.units.find((item) => item.id === unitId);
    state.editingUnitId = unit?.id || ""; populateCatalogSectionSelect(dom["unit-section"], unit?.sectionId || state.catalog.sections[0]?.id);
    dom["unit-dialog-title"].textContent = unit ? "Edit unit" : "Add unit";
    dom["unit-id"].value = unit?.id || ""; dom["unit-id"].disabled = Boolean(unit);
    dom["unit-code"].value = unit?.unitCode || ""; dom["unit-number"].value = unit?.unitNumber ?? ""; dom["unit-name"].value = unit?.unitName || ""; dom["unit-description"].value = unit?.description || "";
    dom["unit-keywords"].value = (unit?.keywords || []).join(", "); dom["unit-aliases"].value = (unit?.aliases || []).join(", "); dom["unit-active"].checked = unit?.active !== false;
    dom["unit-error"].hidden = true; dom["unit-dialog"].showModal();
  }

  function saveUnitEditor(event) {
    event.preventDefault();
    const split = (value) => Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
    const id = dom["unit-id"].value.trim(); const sectionId = dom["unit-section"].value; const unitCode = dom["unit-code"].value.trim(); const unitName = dom["unit-name"].value.trim();
    const errors = [];
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) errors.push("Stable ID is required and may use letters, numbers, hyphens, and underscores.");
    if (!unitCode) errors.push("Unit code is required."); if (!unitName) errors.push("Unit name is required.");
    if (!state.editingUnitId && state.catalog.units.some((unit) => unit.id === id)) errors.push("That stable unit ID already exists.");
    if (errors.length) { dom["unit-error"].textContent = errors.join(" "); dom["unit-error"].hidden = false; return; }
    const numberText = dom["unit-number"].value; const unitNumber = numberText === "" ? ADVANCED.unitNumberFromCode(unitCode) : Number(numberText);
    const record = { id, sectionId, unitCode, unitNumber, unitName, outline: state.catalog.units.find((unit) => unit.id === state.editingUnitId)?.outline || "", description: dom["unit-description"].value.trim(), keywords: split(dom["unit-keywords"].value), aliases: split(dom["unit-aliases"].value), active: dom["unit-active"].checked };
    if (state.editingUnitId) {
      state.catalog.units = state.catalog.units.map((unit) => unit.id === state.editingUnitId ? record : unit);
      state.questionBank = state.questionBank.map((question) => question.unitId === state.editingUnitId ? { ...question, sectionId, section: sectionId, sectionName: ADVANCED.findSection(state.catalog, sectionId)?.name || question.sectionName, sectionNameSnapshot: ADVANCED.findSection(state.catalog, sectionId)?.name || question.sectionNameSnapshot, unit: unitCode, unitName, unitNameSnapshot: unitName } : question);
    } else state.catalog.units.push(record);
    state.catalog.units.sort((a, b) => naturalCompare(a.sectionId, b.sectionId) || ADVANCED.compareUnits(a, b)); state.catalog.updatedAt = new Date().toISOString();
    persistAdvancedState(); persistQuestionBank(state.bankName); dom["unit-dialog"].close(); renderSyllabus(); renderBankScreen();
  }

  function openMergeDialog(unitId) {
    const source = state.catalog.units.find((unit) => unit.id === unitId); if (!source) return;
    dom["merge-source"].value = unitId; dom["merge-impact"].textContent = `${catalogQuestionCount(unitId)} active question(s) use ${source.unitCode} — ${source.unitName}. Historical snapshots will remain unchanged.`;
    dom["merge-destination"].replaceChildren(); state.catalog.units.filter((unit) => unit.id !== unitId).forEach((unit) => { const option = el("option", "", `${unit.sectionId} · ${unit.unitCode} — ${unit.unitName}`); option.value = unit.id; dom["merge-destination"].append(option); });
    dom["merge-error"].hidden = true; dom["merge-dialog"].showModal();
  }

  function mergeAndRemoveUnit(event) {
    event.preventDefault();
    const sourceId = dom["merge-source"].value; const destination = state.catalog.units.find((unit) => unit.id === dom["merge-destination"].value);
    if (!destination) { dom["merge-error"].textContent = "Choose a destination unit."; dom["merge-error"].hidden = false; return; }
    const section = ADVANCED.findSection(state.catalog, destination.sectionId);
    state.questionBank = state.questionBank.map((question) => question.unitId === sourceId ? { ...question, sectionId: destination.sectionId, section: destination.sectionId, sectionName: section.name, sectionNameSnapshot: section.name, unitId: destination.id, unit: destination.unitCode, unitName: destination.unitName, unitNameSnapshot: destination.unitName, classification: { ...(question.classification || {}), status: "confirmed", method: "manual-merge", reviewed: true, reviewedAt: new Date().toISOString() } } : question);
    state.catalog.units = state.catalog.units.filter((unit) => unit.id !== sourceId); persistQuestionBank(state.bankName); persistAdvancedState(); dom["merge-dialog"].close(); renderSyllabus(); renderBankScreen();
  }

  async function handleSyllabusAction(event) {
    const button = event.target.closest("button[data-syllabus-action]"); if (!button) return;
    const action = button.dataset.syllabusAction;
    if (action === "edit-section") return openSectionEditor(button.dataset.sectionId);
    if (action === "edit-unit") return openUnitEditor(button.dataset.unitId);
    if (action === "toggle-section") { const section = ADVANCED.findSection(state.catalog, button.dataset.sectionId); section.active = !section.active; state.catalog.units.filter((unit) => unit.sectionId === section.id).forEach((unit) => { unit.active = section.active; }); persistAdvancedState(); return renderSyllabus(); }
    if (action === "toggle-unit") { const unit = state.catalog.units.find((item) => item.id === button.dataset.unitId); unit.active = !unit.active; persistAdvancedState(); return renderSyllabus(); }
    if (action === "delete-unit") {
      if (catalogQuestionCount(button.dataset.unitId)) return openMergeDialog(button.dataset.unitId);
      const confirmed = await askConfirmation("Remove this empty unit?", "No active questions use it. Historical result snapshots will remain readable.", "Remove unit");
      if (confirmed) { state.catalog.units = state.catalog.units.filter((unit) => unit.id !== button.dataset.unitId); persistAdvancedState(); renderSyllabus(); }
    }
    if (action === "delete-section") {
      const sectionId = button.dataset.sectionId; const units = state.catalog.units.filter((unit) => unit.sectionId === sectionId);
      if (units.length) { setMessage("Remove or reassign every unit in the section before removing the section.", "warning"); return; }
      const confirmed = await askConfirmation("Remove this empty section?", "You can restore it later by importing a catalog backup.", "Remove section");
      if (confirmed) { state.catalog.sections = state.catalog.sections.filter((section) => section.id !== sectionId); persistAdvancedState(); renderSyllabus(); }
    }
  }

  function exportCatalog() { downloadFile(`cma-syllabus-catalog-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state.catalog, null, 2), "application/json"); }
  async function restoreCatalog(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try { const parsed = JSON.parse(await file.text()); const validation = ADVANCED.normalizeCatalog(parsed, CMA_2025_REFERENCE); if (!validation.valid) throw new Error(validation.errors.join(" ")); state.catalog = ADVANCED.augmentCatalogFromQuestions(validation.catalog, state.questionBank); state.questionBank = state.questionBank.map((question) => ADVANCED.enhanceQuestion(question, state.catalog)); persistQuestionBank(state.bankName); persistAdvancedState(); renderSyllabus(); setMessage("Catalog restored and active questions remapped safely.", "success"); } catch (error) { setMessage(`Catalog was not restored: ${error.message}`, "error", 9000); } finally { event.target.value = ""; }
  }

  function persistAdvancedState() {
    writeStorage(STORAGE_KEYS.catalog, state.catalog);
    writeStorage(STORAGE_KEYS.settings, state.analyticsSettings);
    writeStorage(STORAGE_KEYS.importQueue, state.importQueue);
  }

  function updateNavigation() {
    const map = { home: "dashboard", setup: "exam-center", "exam-center": "exam-center", bank: "bank", import: "bank", syllabus: "bank", weak: "progress", history: "progress", study: "study", settings: "settings" };
    document.querySelectorAll(".app-nav button").forEach((button) => {
      const active = button.id === `nav-${map[state.screen] || ""}`;
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function openNamedScreen(name) {
    if (name === "home") renderHome();
    if (name === "bank") renderBankScreen();
    if (name === "history" || name === "progress") renderProgress();
    if (name === "syllabus") renderSyllabus();
    if (name === "import") renderImportQueue();
    if (name === "weak") renderWeakAreas();
    if (name === "study") renderStudy();
    if (name === "settings") renderSettings();
    if (name === "setup") return openSetup();
    if (name === "progress") showScreen("history");
    else showScreen(name);
    updateNavigation();
  }

  function openUnifiedExamCenter() {
    if (globalThis.CMACaseSimulator?.openExamCenter) globalThis.CMACaseSimulator.openExamCenter();
    else { renderExamModes(); showScreen("exam-center"); }
  }

  async function refreshAiStatus() {
    if (!dom["ai-configured"]) return;
    try {
      const response = await fetch("/api/ai/status", { headers: { Accept: "application/json" } });
      const data = await response.json();
      dom["ai-configured"].textContent = data.configured ? `Ready · ${data.model}` : "Not configured";
      dom["ai-configured"].className = `availability-chip ${data.configured ? "status-ready" : ""}`;
      dom["ai-model"].value = data.model || state.analyticsSettings.aiModel;
      return data;
    } catch (_error) {
      dom["ai-configured"].textContent = "Local server not running";
      dom["ai-model"].value = state.analyticsSettings.aiModel;
      return { configured: false, serverAvailable: false };
    }
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "Not reported";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }

  async function renderStorageStatus() {
    let details = { backend: "localStorage", durable: false, usage: null, quota: null };
    if (DURABLE_STORAGE) {
      try { await DURABLE_STORAGE.flush(); details = await DURABLE_STORAGE.estimate(); }
      catch (error) { console.warn("CMA Exam Simulator: storage estimate failed.", error); }
    }
    state.storageBackend = details.backend;
    state.storageUsage = details.usage;
    state.storageQuota = details.quota;
    const localEstimate = new Blob([JSON.stringify({ questionBank: state.questionBank, history: state.history, catalog: state.catalog, importQueue: state.importQueue })]).size;
    const usage = details.usage || localEstimate;
    const percent = details.quota ? Math.min(100, (usage / details.quota) * 100) : 0;
    if (dom["storage-badge"]) {
      dom["storage-badge"].textContent = details.durable ? "Large local storage ready" : "Basic local storage";
      dom["storage-badge"].title = details.durable ? "Questions and history are stored in IndexedDB on this device" : "IndexedDB is unavailable; capacity is limited by localStorage";
    }
    if (!dom["storage-backend"]) return details;
    dom["storage-backend"].textContent = details.backend;
    dom["storage-usage"].textContent = formatBytes(usage);
    dom["storage-quota"].textContent = formatBytes(details.quota);
    dom["storage-question-count"].textContent = state.questionBank.length;
    dom["storage-migration-count"].textContent = state.storageMigrationCount;
    dom["storage-progress"].value = percent;
    dom["storage-description"].textContent = details.durable
      ? `Large banks are stored in IndexedDB. The browser currently reports ${percent.toFixed(2)}% of its available site storage in use. Every imported question is normalized to the latest schema before saving.`
      : "IndexedDB is unavailable in this browser context, so the app is using the smaller compatibility store. Open the simulator through Start CMA Simulator.bat for the most reliable large-bank storage.";
    return details;
  }

  function renderSettings() {
    const values = state.analyticsSettings;
    dom["ai-enabled"].checked = values.aiEnabled !== false;
    dom["ai-model"].value = values.aiModel;
    dom["ai-batch-size"].value = values.aiBatchSize;
    dom["ai-timeout"].value = values.aiTimeoutMs;
    dom["target-time"].value = values.targetTimeSeconds;
    dom["sufficient-attempts"].value = values.sufficientAttempts;
    dom["established-attempts"].value = values.establishedAttempts;
    dom["trend-threshold"].value = values.trendThresholdPoints;
    dom["mastery-threshold"].value = values.masteryThreshold;
    dom["settings-theme"].value = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    dom["default-auto-retire"].checked = Boolean(values.autoRetireMastered);
    dom["default-remove-fast"].checked = values.removeFastQuestions !== false;
    dom["accuracy-unanswered-incorrect"].checked = Boolean(values.unansweredAsIncorrect);
    dom["app-migration-version"].textContent = `Version ${state.migrationVersion}`;
    dom["app-migration-status"].textContent = state.migrationVersion >= APP_DATA_VERSION ? "Unified navigation, Progress, and Study storage are active. A pre-migration safety snapshot was created before the first upgrade." : "Migration is pending; existing data remains on its previous version.";
    refreshAiStatus();
    renderStorageStatus();
  }

  function saveSettings() {
    const sufficientAttempts = Math.max(1, Number(dom["sufficient-attempts"].value) || 5);
    const establishedAttempts = Math.max(sufficientAttempts + 1, Number(dom["established-attempts"].value) || 10);
    state.analyticsSettings = {
      ...state.analyticsSettings,
      aiEnabled: dom["ai-enabled"].checked,
      aiBatchSize: Math.max(1, Math.min(50, Number(dom["ai-batch-size"].value) || 15)),
      aiTimeoutMs: Math.max(5000, Math.min(120000, Number(dom["ai-timeout"].value) || 45000)),
      targetTimeSeconds: Math.max(10, Number(dom["target-time"].value) || 90),
      sufficientAttempts,
      establishedAttempts,
      trendThresholdPoints: Math.max(1, Number(dom["trend-threshold"].value) || 10),
      masteryThreshold: Math.max(1, Number(dom["mastery-threshold"].value) || 3),
      autoRetireMastered: dom["default-auto-retire"].checked,
      removeFastQuestions: dom["default-remove-fast"].checked,
      unansweredAsIncorrect: dom["accuracy-unanswered-incorrect"].checked
    };
    applyTheme(dom["settings-theme"].value);
    persistAdvancedState();
    setMessage("Settings saved locally.", "success");
  }

  function exportFullBackup() {
    const backup = ADVANCED.createFullBackup({ questionBank: state.questionBank, catalog: state.catalog, history: state.history, settings: state.analyticsSettings, importQueue: state.importQueue });
    const caseData = globalThis.CMACaseSimulator?.backupSnapshot?.();
    if (caseData) backup.caseBasedPractice = caseData;
    backup.studyData = deepClone(state.studyData);
    backup.uiPreferences = deepClone(state.uiPreferences);
    backup.migrationVersion = state.migrationVersion;
    if (globalThis.CMAV2?.exportData) backup.cmaV2 = globalThis.CMAV2.exportData();
    downloadFile(`cma-simulator-full-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json");
  }

  async function restoreFullBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const status = dom["backup-status"];
    try {
      const parsed = JSON.parse(await file.text());
      const validation = ADVANCED.validateFullBackup(parsed);
      if (!validation.valid) throw new Error(validation.errors.join(" "));
      if (parsed.caseBasedPractice && globalThis.CMACaseTools?.validateCaseBank) {
        const caseValidation = globalThis.CMACaseTools.validateCaseBank(parsed.caseBasedPractice.cases || []);
        if (!caseValidation.valid) throw new Error(caseValidation.errors.map((error) => `Case backup: ${error}`).join(" "));
      }
      const restoredCatalog = ADVANCED.augmentCatalogFromQuestions(validation.catalog, parsed.questionBank);
      const bankValidation = validateQuestionBank(parsed.questionBank, { catalog: restoredCatalog });
      if (!bankValidation.valid) throw new Error(bankValidation.errors.slice(0, 8).join(" "));
      const confirmed = await askConfirmation("Restore the full backup?", "The current bank, catalog, history, settings, and review queue will be replaced. Export a current backup first if needed.", "Restore backup");
      if (!confirmed) return;
      state.catalog = restoredCatalog;
      state.questionBank = bankValidation.questions;
      state.history = parsed.history.filter(isValidHistoryRecord).map(normalizeHistoryRecord);
      state.analyticsSettings = { ...DEFAULT_ANALYTICS_SETTINGS, ...(parsed.analyticsSettings || {}) };
      state.importQueue = Array.isArray(parsed.importQueue) ? parsed.importQueue : [];
      if (parsed.studyData && typeof parsed.studyData === "object") state.studyData = { ...state.studyData, ...deepClone(parsed.studyData) };
      if (parsed.uiPreferences && typeof parsed.uiPreferences === "object") state.uiPreferences = { ...state.uiPreferences, ...deepClone(parsed.uiPreferences), version: APP_DATA_VERSION };
      if (parsed.caseBasedPractice && globalThis.CMACaseSimulator?.restoreBackup) {
        await globalThis.CMACaseSimulator.restoreBackup(parsed.caseBasedPractice);
      }
      if (parsed.cmaV2 && globalThis.CMAV2?.restoreData) {
        await globalThis.CMAV2.restoreData(parsed.cmaV2, "replace");
      }
      state.bankName = "Restored full backup";
      persistQuestionBank(state.bankName);
      writeStorage(STORAGE_KEYS.history, state.history);
      persistAdvancedState();
      writeStorage(STORAGE_KEYS.studyData, state.studyData); writeStorage(STORAGE_KEYS.uiPreferences, state.uiPreferences); writeStorage(STORAGE_KEYS.migrationVersion, APP_DATA_VERSION); state.migrationVersion = APP_DATA_VERSION;
      await DURABLE_STORAGE?.flush?.();
      renderSettings(); renderHome();
      status.textContent = "Full backup restored successfully."; status.className = "message message-success"; status.hidden = false;
    } catch (error) {
      status.textContent = `Backup was not restored: ${error.message}`; status.className = "message message-error"; status.hidden = false;
    } finally { event.target.value = ""; }
  }

  async function testAiConnection() {
    const status = dom["ai-test-status"];
    status.hidden = false; status.className = "message"; status.textContent = "Testing the local AI connection…";
    try {
      const response = await fetch("/api/ai/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connection test failed.");
      status.className = "message message-success"; status.textContent = `AI connection is ready (${data.model}).`;
    } catch (error) { status.className = "message message-error"; status.textContent = error.message; }
    refreshAiStatus();
  }

  async function navigateHome() {
    if (state.activeExam && !state.activeExam.submitted) {
      await discardActiveExam();
      return;
    }
    renderHome();
    showScreen("home");
  }

  function bindEvents() {
    dom["brand-home"].addEventListener("click", navigateHome);
    dom["theme-toggle"].addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    dom["header-settings"].addEventListener("click", () => openNamedScreen("settings"));
    dom["header-resume"].addEventListener("click", enterExamScreen);
    dom["nav-dashboard"].addEventListener("click", navigateHome);
    dom["nav-exam-center"].addEventListener("click", openUnifiedExamCenter);
    dom["nav-bank"].addEventListener("click", () => openNamedScreen("bank"));
    dom["nav-progress"].addEventListener("click", () => openNamedScreen("progress"));
    dom["nav-study"].addEventListener("click", () => openNamedScreen("study"));
    dom["nav-settings"].addEventListener("click", () => openNamedScreen("settings"));

    dom["home-start"].addEventListener("click", openUnifiedExamCenter);
    dom["home-import"].addEventListener("click", () => openNamedScreen("import"));
    dom["home-weak"].addEventListener("click", () => openSetup("weak"));
    dom["home-mixed"].addEventListener("click", () => openSetup("mixed"));
    dom["home-review-mistakes"].addEventListener("click", () => openSetup("incorrect"));
    dom["home-due-review"].addEventListener("click", () => openSetup("due"));
    dom["home-strong"].addEventListener("click", () => openSetup("strong"));
    dom["home-progress"].addEventListener("click", () => openNamedScreen("progress"));
    dom["home-study"].addEventListener("click", () => openNamedScreen("study"));
    dom["home-open-bank"].addEventListener("click", () => openNamedScreen("bank"));
    dom["home-reference-open"].addEventListener("click", () => openNamedScreen("syllabus"));
    dom["empty-manage-bank"].addEventListener("click", () => { renderBankScreen(); showScreen("bank"); });
    dom["home-history"].addEventListener("click", () => openNamedScreen("progress"));
    dom["resume-exam"].addEventListener("click", () => {
      if (!state.activeExam) return;
      enterExamScreen();
    });
    dom["discard-exam"].addEventListener("click", discardActiveExam);

    dom["setup-back"].addEventListener("click", openUnifiedExamCenter);
    dom["setup-cancel"].addEventListener("click", openUnifiedExamCenter);
    dom["setup-form"].addEventListener("submit", startExamFromSetup);
    dom["setup-form"].addEventListener("input", updateSetupSummary);
    dom["setup-form"].addEventListener("change", (event) => {
      if (event.target === dom["question-count"]) dom["custom-count-wrap"].hidden = event.target.value !== "custom";
      if (event.target === dom["time-limit"]) dom["custom-time-wrap"].hidden = event.target.value !== "custom";
      if ([dom["include-retired"], dom["include-mastered"]].includes(event.target)) { const structure = discoverSetupStructure(); state.setupSections = new Set(structure.filter((section) => section.count > 0).map((section) => section.section)); state.setupUnits = new Set(structure.flatMap((section) => section.units.map((unit) => unit.key))); renderCoverageSelector(); }
      updateSetupSummary();
    });
    dom["coverage-sections"].addEventListener("change", (event) => {
      const input = event.target.closest("input[data-section]");
      if (!input) return;
      const structure = discoverSetupStructure();
      const section = structure.find((item) => item.section === input.dataset.section);
      if (input.checked) {
        state.setupSections.add(input.dataset.section);
        section?.units.forEach((unit) => state.setupUnits.add(unit.key));
      } else {
        state.setupSections.delete(input.dataset.section);
        section?.units.forEach((unit) => state.setupUnits.delete(unit.key));
      }
      renderCoverageSelector();
      updateSetupSummary();
    });
    dom["coverage-units"].addEventListener("change", (event) => {
      const input = event.target.closest("input[data-unit-key]");
      if (!input) return;
      if (input.checked) state.setupUnits.add(input.dataset.unitKey);
      else state.setupUnits.delete(input.dataset.unitKey);
      renderCoverageSelector();
      updateSetupSummary();
    });
    dom["coverage-units"].addEventListener("click", (event) => {
      const button = event.target.closest("button[data-select-section-units]");
      if (!button) return;
      const section = discoverSetupStructure().find((item) => item.section === button.dataset.selectSectionUnits);
      section?.units.forEach((unit) => state.setupUnits.add(unit.key));
      renderCoverageSelector();
      updateSetupSummary();
    });
    dom["select-all-sections"].addEventListener("click", () => {
      const structure = discoverSetupStructure();
      state.setupSections = new Set(structure.filter((section) => section.count > 0).map((section) => section.section));
      state.setupUnits = new Set(structure.flatMap((section) => section.units.map((unit) => unit.key)));
      renderCoverageSelector();
      updateSetupSummary();
    });
    dom["clear-sections"].addEventListener("click", () => {
      state.setupSections.clear();
      state.setupUnits.clear();
      renderCoverageSelector();
      updateSetupSummary();
    });
    dom["select-all-units"].addEventListener("click", () => {
      discoverSetupStructure().filter((section) => state.setupSections.has(section.section)).forEach((section) => section.units.forEach((unit) => state.setupUnits.add(unit.key)));
      renderCoverageSelector();
      updateSetupSummary();
    });
    dom["clear-units"].addEventListener("click", () => {
      state.setupUnits.clear();
      renderCoverageSelector();
      updateSetupSummary();
    });

    dom["answer-options"].addEventListener("change", handleAnswerSelection);
    dom["mark-guessed"].addEventListener("change", toggleCurrentGuess);
    dom["previous-question"].addEventListener("click", () => navigateToQuestion(state.activeExam.currentIndex - 1));
    dom["next-question"].addEventListener("click", handleNextQuestion);
    dom["question-navigator"].addEventListener("click", (event) => {
      const button = event.target.closest("button[data-index]");
      if (button) navigateToQuestion(Number(button.dataset.index));
    });
    dom["mark-review"].addEventListener("click", toggleCurrentMark);
    dom["clear-answer"].addEventListener("click", clearCurrentAnswer);
    dom["submit-exam"].addEventListener("click", requestManualSubmission);
    dom["return-to-exam"].addEventListener("click", resumeAfterSubmissionDialog);
    dom["confirm-final-submit"].addEventListener("click", confirmManualSubmission);
    dom["submit-dialog"].addEventListener("cancel", (event) => {
      event.preventDefault();
      resumeAfterSubmissionDialog();
    });

    dom["results-home"].addEventListener("click", navigateHome);
    dom["results-retest"].addEventListener("click", retestIncorrect);
    dom["results-practice-weak"].addEventListener("click", practiceWeakFromResults);
    dom["results-history"].addEventListener("click", () => openNamedScreen("progress"));
    dom["results-new-exam"].addEventListener("click", openUnifiedExamCenter);
    dom["print-results"].addEventListener("click", () => window.print());
    [dom["result-status-filter"], dom["result-section-filter"], dom["result-topic-filter"]].forEach((select) => select.addEventListener("change", renderDetailedResults));
    [dom["review-filter"], dom["review-section-filter"], dom["review-unit-filter"]].forEach((select) => select.addEventListener("change", renderQuestionReview));
    document.querySelectorAll(".sort-button").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.sort;
        state.resultSort.direction = state.resultSort.key === key && state.resultSort.direction === "asc" ? "desc" : "asc";
        state.resultSort.key = key;
        renderDetailedResults();
      });
    });

    dom["history-back"].addEventListener("click", navigateHome);
    dom["history-start"].addEventListener("click", openUnifiedExamCenter);
    dom["history-list"].addEventListener("click", handleHistoryAction);
    dom["clear-history"].addEventListener("click", clearAllHistory);
    [dom["history-section-filter"], dom["history-unit-filter"], dom["history-date-filter"], dom["history-min-score"], dom["history-max-score"], dom["history-min-accuracy"], dom["history-max-accuracy"], dom["history-mode-filter"], dom["history-sort"]].forEach((control) => control.addEventListener("change", updateHistoryFilters));
    dom["clear-history-filters"].addEventListener("click", clearHistoryFilters);
    document.querySelectorAll("[data-progress-tab]").forEach((button) => button.addEventListener("click", () => { state.progressTab = button.dataset.progressTab; renderProgress(); }));
    dom["progress-period"].addEventListener("change", () => { state.progressPeriod = dom["progress-period"].value; renderProgress(); });
    dom["progress-custom-start"].addEventListener("change", () => { state.progressCustomStart = dom["progress-custom-start"].value; renderProgress(); });
    dom["progress-custom-end"].addEventListener("change", () => { state.progressCustomEnd = dom["progress-custom-end"].value; renderProgress(); });
    dom["progress-group"].addEventListener("change", () => { state.progressGroup = dom["progress-group"].value; renderProgress(); });
    dom["progress-scope-type"].addEventListener("change", () => { state.progressScopeType = dom["progress-scope-type"].value; state.progressScope = "all"; renderProgress(); });
    dom["progress-scope"].addEventListener("change", () => { state.progressScope = dom["progress-scope"].value; renderProgress(); });
    dom["progress-comparison"].addEventListener("change", () => { state.progressComparisonIds = Array.from(dom["progress-comparison"].selectedOptions).map((option) => option.value).slice(0, 5); renderProgress(); });
    dom["progress-comparison-metric"].addEventListener("change", () => { state.progressComparisonMetric = dom["progress-comparison-metric"].value; renderProgress(); });
    dom["progress-unit-table"].addEventListener("click", handleProgressUnitAction);

    dom["bank-back"].addEventListener("click", navigateHome);
    dom["bank-file"].addEventListener("change", handleBankFile);
    dom["add-bank-file"].addEventListener("click", () => commitBankFileImport("add"));
    dom["replace-bank-file"].addEventListener("click", () => commitBankFileImport("replace"));
    dom["apply-reference-names"].addEventListener("click", applyReferenceNamesToBank);
    dom["bulk-input-mode"].addEventListener("change", () => {
      state.bulkValidation = null;
      dom["add-bulk"].disabled = true;
      dom["bulk-input"].placeholder = dom["bulk-input-mode"].value === "json" ? "Paste a JSON array of questions here. Your text is preserved if validation fails." : "Paste labeled questions separated by --- here.";
    });
    dom["bulk-input"].addEventListener("input", () => { state.bulkValidation = null; dom["add-bulk"].disabled = true; });
    dom["validate-bulk"].addEventListener("click", validateBulkQuestions);
    dom["add-bulk"].addEventListener("click", addValidatedBulkQuestions);
    dom["bank-search"].addEventListener("input", () => { state.bankSearch = dom["bank-search"].value; state.bankPage = 1; renderBankQuestionTable(); });
    dom["bank-section-filter"].addEventListener("change", () => { state.bankSectionFilter = dom["bank-section-filter"].value; state.bankUnitFilter = "all"; state.bankPage = 1; populateBankFilters(); renderBankQuestionTable(); });
    dom["bank-unit-filter"].addEventListener("change", () => { state.bankUnitFilter = dom["bank-unit-filter"].value; state.bankPage = 1; renderBankQuestionTable(); });
    dom["bank-previous-page"].addEventListener("click", () => { state.bankPage -= 1; renderBankQuestionTable(); });
    dom["bank-next-page"].addEventListener("click", () => { state.bankPage += 1; renderBankQuestionTable(); });
    dom["bank-question-list"].addEventListener("click", handleBankQuestionAction);
    dom["bank-question-list"].addEventListener("change", handleBankSelection);
    dom["bank-difficulty-filter"].addEventListener("change", () => { state.bankDifficultyFilter = dom["bank-difficulty-filter"].value; state.bankPage = 1; renderBankQuestionTable(); });
    dom["bank-classification-filter"].addEventListener("change", () => { state.bankClassificationFilter = dom["bank-classification-filter"].value; state.bankPage = 1; renderBankQuestionTable(); });
    dom["bank-mastery-filter"].addEventListener("change", () => { state.bankMasteryFilter = dom["bank-mastery-filter"].value; state.bankPage = 1; renderBankQuestionTable(); });
    dom["bank-status-filter"].addEventListener("change", () => { state.bankStatusFilter = dom["bank-status-filter"].value; state.bankPage = 1; renderBankQuestionTable(); });
    dom["bank-mistake-filter"].addEventListener("change", () => { state.bankMistakeFilter = dom["bank-mistake-filter"].value; state.bankPage = 1; renderBankQuestionTable(); });
    dom["bank-note-filter"].addEventListener("change", () => { state.bankNoteFilter = dom["bank-note-filter"].value; state.bankPage = 1; renderBankQuestionTable(); });
    dom["bank-select-filtered"].addEventListener("click", () => { getFilteredBankQuestions().forEach((question) => state.selectedBankQuestions.add(question.id)); renderBankQuestionTable(); });
    dom["bank-clear-selection"].addEventListener("click", () => { state.selectedBankQuestions.clear(); renderBankQuestionTable(); });
    dom["bank-bulk-classify"].addEventListener("click", moveSelectedToReview);
    dom["bank-bulk-delete"].addEventListener("click", deleteSelectedBankQuestions);
    dom["bank-export-sections"].addEventListener("change", (event) => {
      const input = event.target.closest("input[data-export-section]");
      if (!input) return;
      if (input.checked) state.bankExportSections.add(input.dataset.exportSection);
      else state.bankExportSections.delete(input.dataset.exportSection);
      renderBankQuestionTable();
    });
    dom["bank-export-units"].addEventListener("change", (event) => {
      const input = event.target.closest("input[data-export-unit]");
      if (!input) return;
      if (input.checked) state.bankExportUnits.add(input.dataset.exportUnit);
      else state.bankExportUnits.delete(input.dataset.exportUnit);
      renderBankQuestionTable();
    });
    dom["export-complete-bank"].addEventListener("click", () => exportQuestionSubset("complete"));
    dom["export-section-bank"].addEventListener("click", () => exportQuestionSubset("section"));
    dom["export-unit-bank"].addEventListener("click", () => exportQuestionSubset("unit"));
    dom["export-filtered-bank"].addEventListener("click", () => exportQuestionSubset("filtered"));
    dom["download-template"].addEventListener("click", downloadTemplate);
    dom["download-bulk-template"].addEventListener("click", downloadBulkPasteTemplate);
    dom["restore-demo"].addEventListener("click", restoreDemoQuestions);
    dom["clear-bank"].addEventListener("click", clearImportedBank);
    dom["close-question-view"].addEventListener("click", () => dom["question-view-dialog"].close());
    dom["cancel-question-edit"].addEventListener("click", () => { dom["question-edit-dialog"].close(); state.editingQuestionId = null; });
    dom["question-edit-form"].addEventListener("submit", saveQuestionEditor);
    dom["bank-tab-browse"].addEventListener("click", () => setBankPane("browse"));
    dom["bank-tab-import"].addEventListener("click", () => setBankPane("import"));
    dom["bank-tab-add"].addEventListener("click", openNewQuestionEditor);
    dom["bank-tab-syllabus"].addEventListener("click", () => setBankPane("catalog"));
    dom["bank-tab-retired"].addEventListener("click", () => { setBankPane("browse"); state.bankStatusFilter = "retired"; dom["bank-status-filter"].value = "retired"; renderBankQuestionTable(); });
    dom["bank-tab-unclassified"].addEventListener("click", () => { setBankPane("browse"); state.bankClassificationFilter = "unclassified"; dom["bank-classification-filter"].value = "unclassified"; renderBankQuestionTable(); });
    dom["bank-tab-duplicates"].addEventListener("click", reviewBankDuplicates);
    dom["bank-tab-export"].addEventListener("click", () => setBankPane("export"));
    dom["bank-tab-backup"].addEventListener("click", () => setBankPane("export"));
    dom["bank-guided-import"].addEventListener("click", () => openNamedScreen("import"));
    dom["bank-edit-catalog"].addEventListener("click", () => openNamedScreen("syllabus"));

    dom["syllabus-back"].addEventListener("click", () => openNamedScreen("bank"));
    dom["syllabus-add-section"].addEventListener("click", () => openSectionEditor());
    dom["syllabus-add-unit"].addEventListener("click", () => openUnitEditor());
    dom["syllabus-export"].addEventListener("click", exportCatalog);
    dom["syllabus-file"].addEventListener("change", restoreCatalog);
    dom["syllabus-tree"].addEventListener("click", handleSyllabusAction);
    dom["section-form"].addEventListener("submit", saveSectionEditor);
    dom["cancel-section"].addEventListener("click", () => dom["section-dialog"].close());
    dom["unit-form"].addEventListener("submit", saveUnitEditor);
    dom["cancel-unit"].addEventListener("click", () => dom["unit-dialog"].close());
    dom["merge-form"].addEventListener("submit", mergeAndRemoveUnit);
    dom["cancel-merge"].addEventListener("click", () => dom["merge-dialog"].close());

    dom["text-import-back"].addEventListener("click", () => openNamedScreen("bank"));
    dom["parse-text"].addEventListener("click", parseQuestionsForReview);
    dom["classify-ai"].addEventListener("click", classifyImportQueue);
    dom["cancel-ai"].addEventListener("click", () => state.aiAbortController?.abort());
    dom["import-filter"].addEventListener("change", renderImportQueue);
    dom["import-review-list"].addEventListener("change", handleImportQueueChange);
    dom["approve-high"].addEventListener("click", approveHighConfidence);
    dom["save-approved"].addEventListener("click", saveApprovedQuestions);
    dom["clear-import-queue"].addEventListener("click", async () => { if (!state.importQueue.length) return; const confirmed = await askConfirmation("Clear the import review queue?", "Parsed and classified review items will be removed. The active question bank is unchanged.", "Clear queue"); if (confirmed) { state.importQueue = []; persistAdvancedState(); renderImportQueue(); } });

    dom["weak-back"].addEventListener("click", () => openNamedScreen("progress"));
    [dom["weak-section-filter"], dom["weak-evidence-filter"], dom["weak-trend-filter"], dom["weak-sort"]].forEach((control) => control.addEventListener("change", renderWeakAreas));
    dom["weak-unit-table"].addEventListener("change", (event) => { const input = event.target.closest("input[data-weak-unit]"); if (!input) return; if (input.checked) state.weakUnitIds.add(input.dataset.weakUnit); else state.weakUnitIds.delete(input.dataset.weakUnit); });
    dom["weak-form"].addEventListener("submit", startWeakAreaExam);

    dom["study-back"].addEventListener("click", navigateHome);
    document.querySelectorAll("[data-study-tab]").forEach((button) => button.addEventListener("click", () => { state.studyTab = button.dataset.studyTab; renderStudy(); }));
    dom["study-unit"].addEventListener("change", renderStudy);
    dom["save-study-summary"].addEventListener("click", saveCurrentStudySummary);
    dom["save-study-notes"].addEventListener("click", saveCurrentStudyNotes);
    dom["save-formula-notes"].addEventListener("click", saveFormulaNotes);
    dom["study-mistake-list"].addEventListener("change", (event) => { const input = event.target.closest("[data-mistake-key]"); if (!input) return; state.studyData.resolvedMistakes[input.dataset.mistakeKey] = input.checked; persistStudyData("Mistake status updated."); renderStudyMistakes(currentStudyUnitId()); });
    dom["add-study-checklist"].addEventListener("click", () => { const text = dom["study-checklist-new"].value.trim(); if (!text) return; state.studyData.checklist.push({ id: createId("checklist"), text, done: false }); dom["study-checklist-new"].value = ""; persistStudyData("Revision item added."); renderStudyChecklist(); });
    dom["study-checklist"].addEventListener("click", (event) => { const remove = event.target.closest("[data-checklist-remove]"); if (!remove) return; state.studyData.checklist = state.studyData.checklist.filter((item) => item.id !== remove.dataset.checklistRemove); persistStudyData("Revision item removed."); renderStudyChecklist(); });
    dom["study-checklist"].addEventListener("change", (event) => { const input = event.target.closest("[data-checklist-toggle]"); if (!input) return; const item = state.studyData.checklist.find((candidate) => candidate.id === input.dataset.checklistToggle); if (item) item.done = input.checked; persistStudyData("Revision checklist updated."); });
    dom["study-start-due"].addEventListener("click", startDueReview);

    dom["exam-mode-grid"].addEventListener("click", (event) => { const button = event.target.closest("[data-exam-mode]"); if (button && !button.disabled) openSetup(button.dataset.examMode); });
    dom["standard-resume"].addEventListener("click", enterExamScreen);

    dom["settings-back"].addEventListener("click", navigateHome);
    dom["save-settings"].addEventListener("click", saveSettings);
    dom["refresh-storage"].addEventListener("click", renderStorageStatus);
    dom["test-ai"].addEventListener("click", testAiConnection);
    dom["export-full-backup"].addEventListener("click", exportFullBackup);
    dom["backup-file"].addEventListener("change", restoreFullBackup);

    dom["confirm-dialog-cancel"].addEventListener("click", () => completeConfirmation(false));
    dom["confirm-dialog-accept"].addEventListener("click", () => completeConfirmation(true));
    dom["confirm-dialog"].addEventListener("cancel", (event) => {
      event.preventDefault();
      completeConfirmation(false);
    });
    dom["confirm-dialog"].addEventListener("close", () => {
      if (state.confirmResolver) completeConfirmation(false);
    });

    document.addEventListener("keydown", (event) => {
      if (state.screen !== "exam" || !state.activeExam || state.activeExam.status !== "active") return;
      const interactive = event.target.closest("input, select, textarea, button, label");
      if (interactive) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateToQuestion(state.activeExam.currentIndex - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateToQuestion(state.activeExam.currentIndex + 1);
      }
    });

    window.addEventListener("beforeunload", () => {
      if (state.activeExam && !state.activeExam.submitted) {
        if (state.activeExam.status === "active") commitCurrentQuestionTime(Date.now());
        saveActiveExam();
      }
    });
  }

  async function initialize() {
    cacheDom();
    bindEvents();
    await loadInitialData();
    await runFinalIntegratedMigration();
    if (globalThis.CMAV2?.initialize) {
      await globalThis.CMAV2.initialize({ hooks: globalThis.CMAExamSimulatorTestHooks, catalog: state.catalog });
    }
    if (["attempts", "accuracy", "speed", "sections", "units", "weekly", "mastery"].includes(state.uiPreferences.progressTab)) state.progressTab = state.uiPreferences.progressTab;
    if (["summaries", "notes", "mistakes", "formulas", "checklist", "due"].includes(state.uiPreferences.studyTab)) state.studyTab = state.uiPreferences.studyTab;
    const savedTheme = readStorage(STORAGE_KEYS.theme, null);
    const preferredTheme = savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(preferredTheme);
    renderHome();
    renderBankScreen();
    renderStorageStatus();
    showScreen("home");
    if (state.storageWarning) setMessage(state.storageWarning, "warning", 8000);
    if (state.activeExam && state.activeExam.status !== "paused" && Date.now() >= state.activeExam.endTime) {
      finalizeActiveExam({ automatic: true, submittedAt: state.activeExam.endTime });
    }
  }

  window.CMAExamSimulatorTestHooks = Object.freeze({
    validateQuestionBank,
    prepareQuestionImport,
    normalizeQuestionRecord,
    normalizeSectionValue,
    discoverBankStructure,
    filterQuestionsByCoverage,
    parseStructuredPlainText,
    parseBulkInput,
    selectBalancedQuestions,
    selectQuestionsForExam,
    mergeQuestions,
    referenceNameChanges,
    applyReferenceNamesToQuestions,
    naturalCompare,
    unitKey,
    calculateResult,
    fastQuestionRemovalCandidates,
    removeFastQuestionsFromBank,
    accumulateVisitTime,
    calculateRemainingTime,
    addUniqueHistoryResult,
    formatDuration,
    fisherYates,
    createDirectExam,
    formatBytes,
    weakAnalytics,
    progress: PROGRESS,
    modeCandidateQuestions,
    runFinalIntegratedMigration,
    advanced: ADVANCED,
    defaultCatalog: () => deepClone(state.catalog),
    demoQuestions: () => deepClone(DEMO_QUESTIONS),
    getState: () => deepClone({
      questionBank: state.questionBank,
      history: state.history,
      activeExam: state.activeExam,
      currentResult: state.currentResult,
      analyticsSettings: state.analyticsSettings,
      screen: state.screen
    }),
    getCatalog: () => deepClone(state.catalog),
    getReferenceCatalog: () => ADVANCED.createDefaultCatalog(CMA_2025_REFERENCE),
    parseQuestionText: (text) => ADVANCED.parseQuestionText(text, state.catalog),
    replaceCatalog: async (catalog, options = {}) => {
      const validation = ADVANCED.normalizeCatalog(catalog, CMA_2025_REFERENCE);
      if (!validation.valid) throw new Error(validation.errors.slice(0, 5).join(" "));
      state.catalog = validation.catalog;
      if (options.applyToQuestions !== false) {
        state.questionBank = applyReferenceNamesToQuestions(state.questionBank);
      }
      writeStorage(STORAGE_KEYS.catalog, state.catalog);
      if (state.questionBank.length) persistQuestionBank(state.bankName || "Personal CMA question bank");
      renderHome();
      renderBankScreen();
      renderSyllabusScreen();
      return {
        sections: state.catalog.sections.length,
        units: state.catalog.units.length,
        questions: state.questionBank.length
      };
    },
    replaceQuestionBank: async (questions, name = "CMA V2 multi-bank active pool") => {
      const validation = validateQuestionBank({ questions }, { catalog: state.catalog });
      if (!validation.valid) throw new Error(validation.errors.slice(0, 5).join(" "));
      state.questionBank = validation.questions;
      state.bankName = name;
      writeStorage(STORAGE_KEYS.questionBank, { version: 4, name, questions: state.questionBank });
      renderHome();
      renderBankScreen();
      return state.questionBank.length;
    },
    startDirectExam,
    pauseActiveExam,
    resumeActiveExam,
    getCurrentQuestion: () => currentExamQuestion() ? deepClone(currentExamQuestion()) : null,
    getActiveExam: () => state.activeExam ? deepClone(state.activeExam) : null,
    removeCurrentQuestionFromSession,
    openScreen: showScreen,
    refreshHome: renderHome,
    setMessage,
    startDirectExam
  });

  // The test flag lets the same production logic run in deterministic offline
  // checks without requiring a browser DOM. It is never set by the application.
  if (!globalThis.CMA_SIMULATOR_TEST_MODE) {
    initialize().catch((error) => {
      console.error("CMA Exam Simulator could not finish loading.", error);
      const message = document.getElementById("global-message");
      if (message) {
        message.className = "message message-error";
        message.textContent = "The simulator could not finish loading its saved data. Reload the page; if the problem continues, restore a full backup from Settings.";
        message.hidden = false;
      }
    });
  }
})();
