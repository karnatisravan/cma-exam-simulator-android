(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CMAV8Core = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TYPES = Object.freeze(["theory", "calculation", "mixed"]);
  const clean = (value) => String(value == null ? "" : value).trim();
  const normal = (value) => clean(value).toLowerCase().replace(/\s+/g, " ");
  const slug = (value, fallback = "item") => normal(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;

  function hash(value) {
    const text = String(value || "");
    let out = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      out ^= text.charCodeAt(i);
      out = Math.imul(out, 16777619);
    }
    return (out >>> 0).toString(16).padStart(8, "0");
  }

  function classifyQuestionType(raw) {
    const explicit = normal(raw && raw.questionType);
    if (explicit === "theory" || explicit === "calculation") return explicit;
    const stem = normal(raw && (raw.question || raw.stem || raw.prompt));
    const optionText = raw && raw.options && typeof raw.options === "object" ? Object.values(raw.options).join(" ") : "";
    const text = `${stem} ${normal(optionText)}`;
    const numericTokens = (text.match(/(?:[$£€₹]?\d[\d,.]*%?|\d+\s*(?:days?|years?|units?|shares?|times?))/g) || []).length;
    const formulaSignals = [
      /calculate|compute|determine the (?:amount|rate|value|number|cost|price)|how much|how many/,
      /net present value|\bnpv\b|internal rate of return|\birr\b|present value|future value/,
      /break[- ]?even|contribution margin|weighted average cost|\bwacc\b|payback period/,
      /earnings per share|\beps\b|return on|turnover|ratio|variance|standard deviation/,
      /exchange rate|bond price|yield|discount rate|interest rate|cash flow/,
      /\+|\-|×|÷|=|\bper unit\b|\bper share\b/
    ];
    const conceptualSignals = [
      /which (?:of the following )?(?:statement|statements|description|characteristic|factor|action|method|term)/,
      /best (?:describes|explains|defines|illustrates)|primary (?:purpose|advantage|disadvantage|objective)/,
      /is (?:true|false|correct|incorrect)|would most likely|should management|according to/,
      /definition|concept|principle|policy|ethical|responsibility|governance|risk appetite/
    ];
    const calculationScore = formulaSignals.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0) + Math.min(3, Math.floor(numericTokens / 3));
    const theoryScore = conceptualSignals.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
    if (calculationScore >= 3 && calculationScore >= theoryScore + 1) return "calculation";
    if (theoryScore >= 1 && numericTokens <= 3 && calculationScore <= 2) return "theory";
    if (!numericTokens && calculationScore === 0) return "theory";
    return "mixed";
  }

  function sectionFromValue(value) {
    const text = clean(value);
    if (!text) return "";
    let match = text.match(/^[A-F]$/i);
    if (match) return match[0].toUpperCase();
    match = text.match(/^Section\s+([A-F])(?:\b|\s*[-:—])/i);
    if (match) return match[1].toUpperCase();
    match = text.match(/^([A-F])(?:[-_.:\s]+)?U0*\d+/i);
    if (match) return match[1].toUpperCase();
    match = text.match(/^([A-F])[-_.:]0*\d+(?:$|[-_.:])/i);
    return match ? match[1].toUpperCase() : "";
  }

  function unitFromValue(value) {
    const text = clean(value);
    if (!text) return "";
    let match = text.match(/^Unit\s+0*(\d+)$/i);
    if (match) return `Unit ${Number(match[1])}`;
    match = text.match(/^0*(\d+)$/);
    if (match) return `Unit ${Number(match[1])}`;
    return text;
  }

  function unitFromIdentifier(value) {
    const text = clean(value);
    if (!text) return "";
    let match = text.match(/(?:^|[-_.:])U0*(\d+)(?:$|[-_.:])/i);
    if (!match) match = text.match(/^U0*(\d+)$/i);
    return match ? `Unit ${Number(match[1])}` : "";
  }

  function normalizeImportMetadata(raw) {
    const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const classification = record.classification && typeof record.classification === "object" && !Array.isArray(record.classification)
      ? record.classification
      : {};
    const status = normal(record.status || (record.retired ? "archived" : record.isRemoved ? "removed" : ""));
    const explicitlyInactive = Boolean(record.retired || record.isRemoved || ["archived", "removed", "retired", "inactive"].includes(status));
    const sectionCandidates = [record.sectionId, record.section, classification.sectionId, classification.section, record.unitId, classification.unitId];
    let section = "";
    for (const value of sectionCandidates) {
      section = sectionFromValue(value);
      if (section) break;
    }
    const directUnitCandidates = [record.unit, record.unitCode, record.unitNumber, classification.unit, classification.unitCode, classification.unitNumber];
    let unit = "";
    for (const value of directUnitCandidates) {
      unit = unitFromValue(value);
      if (unit) break;
    }
    if (!unit) {
      for (const value of [record.unitId, classification.unitId]) {
        unit = unitFromIdentifier(value);
        if (unit) break;
      }
    }
    const reviewRequired = Boolean(
      classification.reviewRequired ||
      normal(record.unit_mapping_status) === "pending" ||
      normal(record.classificationStatus) === "unclassified"
    );
    const inactive = explicitlyInactive || (reviewRequired && (!section || !unit));
    return {
      section,
      unit,
      sectionName: clean(record.sectionName),
      unitName: clean(record.unitName),
      explanation: clean(record.explanation),
      inactive,
      reviewRequired
    };
  }

  function cardBackFromQuestion(item) {
    const answer = clean(item && item.correctAnswer).toUpperCase();
    const option = clean(item && item.options && item.options[answer]);
    const explanation = clean(item && item.explanation);
    return [answer && option ? `${answer}) ${option}` : option, explanation].filter(Boolean).join("\n\n");
  }

  function normalizeFlashcard(item, index, defaults) {
    const deckId = clean(item && item.deckId) || clean(defaults && defaults.deckId) || "deck-imported";
    const front = clean(item && (item.front || item.question || item.term || item.prompt));
    const back = clean(item && (item.back || item.answer || item.definition)) || cardBackFromQuestion(item);
    if (!front) throw new Error(`Flashcard ${index + 1} is missing its front/question.`);
    if (!back) throw new Error(`Flashcard ${index + 1} is missing its back/answer.`);
    const sourceId = clean(item && item.id) || `FC-${hash(`${deckId}|${front}|${back}`)}`;
    return {
      id: sourceId,
      deckId,
      deckName: clean(item && item.deckName) || clean(defaults && defaults.deckName) || "Imported Flashcards",
      front,
      back,
      hint: clean(item && item.hint),
      sectionId: clean(item && (item.sectionId || item.section)).toUpperCase().match(/[A-F]/)?.[0] || "",
      unitId: clean(item && item.unitId).toUpperCase(),
      tags: Array.isArray(item && item.tags) ? item.tags.map(clean).filter(Boolean) : [],
      source: clean(item && item.source) || clean(defaults && defaults.source) || "flashcard-import",
      createdAt: clean(item && item.createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function parseFlashcardImport(input) {
    const data = Array.isArray(input) ? { flashcards: input } : input || {};
    const records = Array.isArray(data.flashcards) ? data.flashcards : Array.isArray(data.cards) ? data.cards : Array.isArray(data.questions) ? data.questions : [];
    if (!records.length) throw new Error("No flashcards were found. Use a flashcards, cards, or questions array.");
    const deckName = clean(data.title || data.deckName) || "Imported Flashcards";
    const deckId = clean(data.deckId) || `deck-${slug(deckName)}-${hash(deckName).slice(0, 4)}`;
    const cards = [];
    const errors = [];
    records.forEach((record, index) => {
      try { cards.push(normalizeFlashcard(record, index, { deckId, deckName, source: data.source })); }
      catch (error) { errors.push({ index, message: error.message }); }
    });
    return { title: deckName, deckId, total: records.length, validCount: cards.length, invalidCount: errors.length, cards, errors };
  }

  function scheduleReview(previous, rating, nowValue) {
    const now = nowValue ? new Date(nowValue) : new Date();
    const old = previous || {};
    const lapses = Number(old.lapses) || 0;
    const reviews = (Number(old.reviews) || 0) + 1;
    const oldInterval = Math.max(0, Number(old.intervalDays) || 0);
    let intervalDays;
    let ease = Math.max(1.3, Number(old.ease) || 2.5);
    if (rating === "again") { intervalDays = 0; ease = Math.max(1.3, ease - 0.2); }
    else if (rating === "hard") { intervalDays = Math.max(1, Math.round(oldInterval * 1.2) || 1); ease = Math.max(1.3, ease - 0.05); }
    else if (rating === "easy") { intervalDays = Math.max(7, Math.round((oldInterval || 3) * ease * 1.35)); ease += 0.1; }
    else { intervalDays = Math.max(3, Math.round((oldInterval || 1) * ease)); }
    const due = new Date(now);
    if (rating === "again") due.setMinutes(due.getMinutes() + 10);
    else due.setDate(due.getDate() + intervalDays);
    return {
      ...old,
      reviews,
      lapses: lapses + (rating === "again" ? 1 : 0),
      intervalDays,
      ease: Number(ease.toFixed(2)),
      lastRating: rating,
      lastReviewedAt: now.toISOString(),
      dueAt: due.toISOString(),
      mastered: intervalDays >= 21
    };
  }

  function normalizeRevisionManifest(input) {
    const data = input || {};
    const pageCount = Math.max(1, Number(data.pageCount) || 1);
    const outline = (Array.isArray(data.outline) ? data.outline : []).map((item, index) => ({
      id: clean(item.id) || `topic-${index + 1}`,
      title: clean(item.title) || `Topic ${index + 1}`,
      startPage: Math.min(pageCount, Math.max(1, Number(item.startPage) || 1)),
      endPage: Math.min(pageCount, Math.max(Number(item.startPage) || 1, Number(item.endPage) || pageCount)),
      sectionId: clean(item.sectionId || data.sectionId).toUpperCase()
    }));
    return {
      id: clean(data.id) || `revision-${hash(`${data.title}|${pageCount}`)}`,
      title: clean(data.title) || "Revision Slides",
      sectionId: clean(data.sectionId).toUpperCase(),
      pageCount,
      outline,
      expectedFileName: clean(data.expectedFileName),
      version: clean(data.version) || "1"
    };
  }

  return Object.freeze({ TYPES, hash, slug, classifyQuestionType, normalizeImportMetadata, normalizeFlashcard, parseFlashcardImport, scheduleReview, normalizeRevisionManifest });
});