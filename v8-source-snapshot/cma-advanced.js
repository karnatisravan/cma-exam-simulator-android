(() => {
  "use strict";

  const SECTION_IDS = Object.freeze(["A", "B", "C", "D", "E", "F"]);
  const OPTION_KEYS = Object.freeze(["A", "B", "C", "D"]);
  const DIFFICULTIES = Object.freeze(["easy", "medium", "hard", "unspecified"]);
  const CLASSIFICATION_STATUSES = Object.freeze(["classified", "uncertain", "unclassified", "invalid"]);
  const STOP_WORDS = new Set(["and", "the", "of", "in", "to", "for", "with", "a", "an", "on", "other", "introduction"]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
  }

  function normalizeSectionId(value) {
    const text = cleanText(value);
    const match = text.match(/^(?:Section\s+)?([A-F])(?:\b|\s*[-:—])/i);
    return match ? match[1].toUpperCase() : "";
  }

  function unitNumberFromCode(value) {
    const match = cleanText(value).match(/(?:Study\s+)?Unit\s+0*(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function naturalCompare(left, right) {
    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
  }

  function compareUnits(left, right) {
    const leftNumber = Number.isFinite(left.unitNumber) ? left.unitNumber : null;
    const rightNumber = Number.isFinite(right.unitNumber) ? right.unitNumber : null;
    if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber || naturalCompare(left.unitName, right.unitName);
    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;
    return naturalCompare(left.unitName || left.unitCode, right.unitName || right.unitCode);
  }

  function keywordsFromName(name) {
    return Array.from(new Set(cleanText(name).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word)))).slice(0, 10);
  }

  function stableUnitId(sectionId, unitCode, existingIds = new Set()) {
    const number = unitNumberFromCode(unitCode);
    let base = number !== null
      ? `${sectionId}-U${String(number).padStart(2, "0")}`
      : `${sectionId}-${cleanText(unitCode).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "UNIT"}`;
    let candidate = base;
    let suffix = 2;
    while (existingIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  function createDefaultCatalog(reference = globalThis.CMA2025Reference || {}) {
    const sections = SECTION_IDS.map((letter) => ({
      id: letter,
      letter,
      name: cleanText(reference[letter]?.sectionName) || `Section ${letter}`,
      description: "",
      active: true
    }));
    const units = SECTION_IDS.flatMap((sectionId) => (reference[sectionId]?.units || []).map((unit) => ({
      id: `${sectionId}-U${String(unitNumberFromCode(unit.unit)).padStart(2, "0")}`,
      sectionId,
      unitCode: unit.unit,
      unitNumber: unitNumberFromCode(unit.unit),
      unitName: unit.unitName,
      outline: cleanText(unit.outline),
      description: "",
      keywords: keywordsFromName(unit.unitName),
      aliases: [],
      active: true
    })));
    return { version: 1, updatedAt: new Date().toISOString(), sections, units };
  }

  function normalizeCatalog(input, fallbackReference = globalThis.CMA2025Reference || {}) {
    const errors = [];
    if (!input || typeof input !== "object" || !Array.isArray(input.sections) || !Array.isArray(input.units)) {
      return { valid: false, errors: ["The syllabus catalog must contain sections and units arrays."], catalog: createDefaultCatalog(fallbackReference) };
    }
    const sectionIds = new Set();
    const sections = [];
    input.sections.forEach((raw, index) => {
      const id = normalizeSectionId(raw?.id || raw?.letter);
      const name = cleanText(raw?.name);
      if (!id) errors.push(`Section ${index + 1}: id must be A, B, C, D, E, or F.`);
      if (id && sectionIds.has(id)) errors.push(`Section ${index + 1}: duplicate section ID ${id}.`);
      if (!name) errors.push(`Section ${index + 1}${id ? ` (${id})` : ""}: name is required.`);
      if (id && !sectionIds.has(id) && name) {
        sectionIds.add(id);
        sections.push({ id, letter: id, name, description: cleanText(raw.description), active: raw.active !== false });
      }
    });
    const unitIds = new Set();
    const units = [];
    input.units.forEach((raw, index) => {
      const id = cleanText(raw?.id);
      const sectionId = normalizeSectionId(raw?.sectionId);
      const unitCode = cleanText(raw?.unitCode);
      const unitName = cleanText(raw?.unitName);
      const unitNumber = raw?.unitNumber === null || raw?.unitNumber === "" || raw?.unitNumber === undefined
        ? unitNumberFromCode(unitCode)
        : Number(raw.unitNumber);
      if (!id) errors.push(`Unit ${index + 1}: stable id is required.`);
      if (id && unitIds.has(id)) errors.push(`Unit ${index + 1}: duplicate unit ID ${id}.`);
      if (!sectionIds.has(sectionId)) errors.push(`Unit ${index + 1}${id ? ` (${id})` : ""}: parent section is invalid.`);
      if (!unitCode) errors.push(`Unit ${index + 1}${id ? ` (${id})` : ""}: unit code is required.`);
      if (!unitName) errors.push(`Unit ${index + 1}${id ? ` (${id})` : ""}: unit name is required.`);
      if (unitNumber !== null && (!Number.isInteger(unitNumber) || unitNumber < 0)) errors.push(`Unit ${index + 1}${id ? ` (${id})` : ""}: unit number must be a non-negative whole number.`);
      if (id && !unitIds.has(id) && sectionIds.has(sectionId) && unitCode && unitName && (unitNumber === null || (Number.isInteger(unitNumber) && unitNumber >= 0))) {
        unitIds.add(id);
        units.push({
          id,
          sectionId,
          unitCode,
          unitNumber,
          unitName,
          outline: cleanText(raw.outline),
          description: cleanText(raw.description),
          keywords: Array.isArray(raw.keywords) ? Array.from(new Set(raw.keywords.map(cleanText).filter(Boolean))) : [],
          aliases: Array.isArray(raw.aliases) ? Array.from(new Set(raw.aliases.map(cleanText).filter(Boolean))) : [],
          active: raw.active !== false
        });
      }
    });
    units.sort((left, right) => naturalCompare(left.sectionId, right.sectionId) || compareUnits(left, right));
    return { valid: errors.length === 0, errors, catalog: { version: 1, updatedAt: new Date().toISOString(), sections, units } };
  }

  function findSection(catalog, value) {
    const id = normalizeSectionId(value);
    return catalog.sections.find((section) => section.id === id) || null;
  }

  function findUnit(catalog, sectionId, value) {
    const text = cleanText(value);
    if (!text) return null;
    const exactId = catalog.units.find((unit) => unit.id === text && (!sectionId || unit.sectionId === sectionId));
    if (exactId) return exactId;
    const number = unitNumberFromCode(text);
    return catalog.units.find((unit) => unit.sectionId === sectionId && (
      cleanText(unit.unitCode).toLowerCase() === text.toLowerCase() ||
      cleanText(unit.unitName).toLowerCase() === text.toLowerCase() ||
      unit.aliases.some((alias) => alias.toLowerCase() === text.toLowerCase()) ||
      (number !== null && unit.unitNumber === number)
    )) || null;
  }

  function augmentCatalogFromQuestions(catalog, questions) {
    const output = clone(catalog);
    const existingIds = new Set(output.units.map((unit) => unit.id));
    (questions || []).forEach((question) => {
      const sectionId = normalizeSectionId(question.sectionId || question.section);
      const unitCode = cleanText(question.unit || question.unitCode);
      if (!sectionId || !unitCode || findUnit(output, sectionId, question.unitId || unitCode)) return;
      const unitName = cleanText(question.unitNameSnapshot || question.unitName) || unitCode;
      const id = cleanText(question.unitId) || stableUnitId(sectionId, unitCode, existingIds);
      if (existingIds.has(id)) return;
      existingIds.add(id);
      output.units.push({
        id,
        sectionId,
        unitCode,
        unitNumber: unitNumberFromCode(unitCode),
        unitName,
        outline: "",
        description: "Migrated from an existing question bank.",
        keywords: keywordsFromName(unitName),
        aliases: [],
        active: true
      });
    });
    output.units.sort((left, right) => naturalCompare(left.sectionId, right.sectionId) || compareUnits(left, right));
    output.updatedAt = new Date().toISOString();
    return output;
  }

  function normalizeDifficulty(value) {
    const difficulty = cleanText(value).toLowerCase();
    return DIFFICULTIES.includes(difficulty) ? difficulty : "unspecified";
  }

  function enhanceQuestion(raw, catalog) {
    const question = clone(raw);
    const sectionId = normalizeSectionId(question.sectionId || question.section);
    const section = findSection(catalog, sectionId);
    const unit = findUnit(catalog, sectionId, question.unitId || question.unit || question.unitCode);
    const reviewed = question.classification?.reviewed === true || question.classification?.method === "manual" || question.source === "manual";
    return {
      ...question,
      sectionId,
      unitId: unit?.id || cleanText(question.unitId),
      sectionNameSnapshot: cleanText(question.sectionNameSnapshot || question.sectionName) || section?.name || `Section ${sectionId}`,
      unitNameSnapshot: cleanText(question.unitNameSnapshot || question.unitName) || unit?.unitName || cleanText(question.unit),
      topic: cleanText(question.topic),
      tags: Array.isArray(question.tags) ? Array.from(new Set(question.tags.map(cleanText).filter(Boolean))) : [],
      difficulty: normalizeDifficulty(question.difficulty),
      source: cleanText(question.source) || "manual",
      classification: {
        method: cleanText(question.classification?.method) || "manual",
        confidence: clamp(question.classification?.confidence ?? (reviewed ? 1 : 0), 0, 1),
        reviewed
      },
      // Compatibility aliases keep the proven exam/results code operational.
      section: sectionId,
      sectionName: cleanText(question.sectionNameSnapshot || question.sectionName) || section?.name || `Section ${sectionId}`,
      unit: unit?.unitCode || cleanText(question.unit || question.unitCode),
      unitName: cleanText(question.unitNameSnapshot || question.unitName) || unit?.unitName || cleanText(question.unit || question.unitCode)
    };
  }

  function questionClassificationState(question, catalog) {
    const section = findSection(catalog, question.sectionId || question.section);
    const unit = findUnit(catalog, section?.id || "", question.unitId || question.unit);
    if (!section || !unit) return "unclassified";
    return question.classification?.reviewed ? "classified" : "awaiting-review";
  }

  function parseHeading(line, catalog, context) {
    const text = cleanText(line);
    const combined = text.match(/^Section\s+([A-F])\s*(?:[-—:]\s*[^\n]*?)?\s*(?:[-—:]\s*)?(?:Study\s+)?Unit\s+([^:—-]+|\d+)(?:\s*[-—:].*)?$/i);
    if (combined) {
      const sectionId = combined[1].toUpperCase();
      const unitText = /^\d+$/.test(cleanText(combined[2])) ? `Unit ${combined[2]}` : cleanText(combined[2]);
      return { sectionId, unitId: findUnit(catalog, sectionId, unitText)?.id || "", unitText };
    }
    const sectionMatch = text.match(/^SECTION(?:\s+ID)?\s*[:\-—]?\s*(?:Section\s+)?([A-F])(?:\b|\s*[-—:].*)/i);
    if (sectionMatch) return { ...context, sectionId: sectionMatch[1].toUpperCase(), unitId: "", unitText: "" };
    const unitMatch = text.match(/^(?:STUDY\s+)?UNIT(?:\s+ID)?\s*[:\-—]?\s*(.+)$/i);
    if (unitMatch) {
      const unitText = cleanText(unitMatch[1]).replace(/\s+[-—]\s+.*$/, "");
      return { ...context, unitId: findUnit(catalog, context.sectionId, unitText)?.id || "", unitText };
    }
    return null;
  }

  function parseQuestionText(input, catalog) {
    const text = typeof input === "string" ? input.replace(/^\uFEFF/, "") : "";
    if (!text.trim()) return { candidates: [], errors: ["Paste at least one question."], warnings: [] };
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    const candidates = [];
    const errors = [];
    const warnings = [];
    const seenNumbers = new Set();
    let context = { sectionId: "", unitId: "", unitText: "" };
    let current = null;
    let activeField = "";

    function startCandidate(number, questionText) {
      if (current) finishCandidate();
      const normalizedNumber = cleanText(number) || String(candidates.length + 1);
      if (seenNumbers.has(normalizedNumber)) warnings.push(`Question number ${normalizedNumber} appears more than once.`);
      seenNumbers.add(normalizedNumber);
      current = {
        temporaryId: `import-${String(candidates.length + 1).padStart(3, "0")}`,
        questionNumber: normalizedNumber,
        question: cleanText(questionText),
        options: {},
        correctAnswer: "",
        explanation: "",
        sectionId: context.sectionId,
        unitId: context.unitId,
        unitText: context.unitText,
        topic: "",
        tags: [],
        difficulty: "unspecified",
        source: "text-import",
        classificationStatus: ""
      };
      activeField = "question";
    }

    function finishCandidate() {
      if (!current) return;
      current.question = cleanText(current.question);
      OPTION_KEYS.forEach((key) => { current.options[key] = cleanText(current.options[key]); });
      current.explanation = cleanText(current.explanation);
      const candidateErrors = [];
      if (!current.question) candidateErrors.push("question text is missing");
      const missingOptions = OPTION_KEYS.filter((key) => !current.options[key]);
      if (missingOptions.length) candidateErrors.push(`missing option${missingOptions.length === 1 ? "" : "s"} ${missingOptions.join(", ")}`);
      if (!OPTION_KEYS.includes(current.correctAnswer)) candidateErrors.push("a valid answer line is missing");
      const unit = findUnit(catalog, current.sectionId, current.unitId || current.unitText);
      if (unit) current.unitId = unit.id;
      current.classificationStatus = candidateErrors.length
        ? "invalid"
        : current.sectionId && current.unitId ? "classified" : "unclassified";
      current.validationErrors = candidateErrors;
      if (candidateErrors.length) errors.push(`Question ${current.questionNumber}: ${candidateErrors.join("; ")}.`);
      candidates.push(current);
      current = null;
      activeField = "";
    }

    lines.forEach((rawLine) => {
      const line = cleanText(rawLine);
      if (!line) return;
      if (/^-{3,}$/.test(line)) {
        finishCandidate();
        return;
      }
      const heading = parseHeading(line, catalog, context);
      if (heading && !/^(?:QUESTION|[A-D]|ANSWER|CORRECT|EXPLANATION)\s*[:.)]/i.test(line)) {
        finishCandidate();
        context = heading;
        return;
      }
      const numbered = line.match(/^(\d+)\s*[.)]\s+(.+)$/);
      const labeledQuestion = line.match(/^QUESTION\s*:\s*(.*)$/i);
      if (numbered) {
        startCandidate(numbered[1], numbered[2]);
        return;
      }
      if (labeledQuestion) {
        startCandidate(String(candidates.length + 1), labeledQuestion[1]);
        return;
      }
      const option = line.match(/^([A-D])\s*[.):]\s*(.*)$/i);
      if (option) {
        if (!current) startCandidate(String(candidates.length + 1), "");
        current.options[option[1].toUpperCase()] = option[2];
        activeField = option[1].toUpperCase();
        return;
      }
      const answer = line.match(/^(?:CORRECT\s+ANSWER|ANSWER|CORRECT)\s*[:\-]\s*([A-D])\b/i);
      if (answer) {
        if (!current) startCandidate(String(candidates.length + 1), "");
        current.correctAnswer = answer[1].toUpperCase();
        activeField = "answer";
        return;
      }
      const explanation = line.match(/^EXPLANATION\s*:\s*(.*)$/i);
      if (explanation) {
        if (!current) startCandidate(String(candidates.length + 1), "");
        current.explanation = explanation[1];
        activeField = "explanation";
        return;
      }
      if (!current) {
        startCandidate(String(candidates.length + 1), line);
      } else if (OPTION_KEYS.includes(activeField)) {
        current.options[activeField] = `${current.options[activeField]} ${line}`.trim();
      } else if (activeField === "explanation") {
        current.explanation = `${current.explanation} ${line}`.trim();
      } else if (activeField !== "answer") {
        current.question = `${current.question} ${line}`.trim();
      }
    });
    finishCandidate();
    return { candidates, errors, warnings };
  }

  function normalizeQuestionText(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/^\d+\s*[.)]\s*/, "")
      .replace(/\b(?:answer|correct answer)\s*[:\-]\s*[a-d]\b/g, "")
      .replace(/[^a-z0-9%+\-*/=<>]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function similarity(left, right) {
    const leftTokens = new Set(normalizeQuestionText(left).split(" ").filter(Boolean));
    const rightTokens = new Set(normalizeQuestionText(right).split(" ").filter(Boolean));
    if (!leftTokens.size || !rightTokens.size) return 0;
    const intersection = Array.from(leftTokens).filter((token) => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return intersection / union;
  }

  function detectQuestionDuplicates(candidates, bank, threshold = 0.82) {
    const bankById = new Map(bank.map((question) => [question.id, question]));
    const bankByText = new Map(bank.map((question) => [normalizeQuestionText(question.question), question]));
    return candidates.map((candidate) => {
      const exactId = candidate.id && bankById.get(candidate.id);
      const exactText = bankByText.get(normalizeQuestionText(candidate.question));
      const near = exactText ? [] : bank
        .map((question) => ({ id: question.id, score: similarity(candidate.question, question.question) }))
        .filter((match) => match.score >= threshold)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3);
      return { temporaryId: candidate.temporaryId, exactId: exactId?.id || "", exactTextId: exactText?.id || "", near };
    });
  }

  function evidenceLevel(totalAttempts, thresholds = {}) {
    const sufficient = Number(thresholds.sufficientAttempts) || 5;
    const established = Number(thresholds.establishedAttempts) || 10;
    if (totalAttempts < sufficient) return "Insufficient data";
    if (totalAttempts < established) return "Limited evidence";
    return "Established evidence";
  }

  function trendForAttempts(attempts, thresholdPoints = 10, minimumAttempts = 10) {
    if (attempts.length < minimumAttempts) return { label: "Insufficient data", recentAccuracy: null, earlierAccuracy: null, changePoints: null };
    const recentSize = Math.min(10, Math.max(5, Math.floor(attempts.length / 2)));
    const recent = attempts.slice(-recentSize);
    const earlier = attempts.slice(0, -recentSize);
    if (!earlier.length) return { label: "Insufficient data", recentAccuracy: null, earlierAccuracy: null, changePoints: null };
    const accuracy = (values) => values.filter((attempt) => attempt.status === "Correct").length / values.length;
    const recentAccuracy = accuracy(recent);
    const earlierAccuracy = accuracy(earlier);
    const changePoints = (recentAccuracy - earlierAccuracy) * 100;
    const label = changePoints >= thresholdPoints ? "Improving" : changePoints <= -thresholdPoints ? "Declining" : "Stable";
    return { label, recentAccuracy, earlierAccuracy, changePoints };
  }

  function weaknessMetrics(attempts, settings = {}) {
    const targetTimeMs = (Number(settings.targetTimeSeconds) || 90) * 1000;
    const totalAttempts = attempts.length;
    const correct = attempts.filter((attempt) => attempt.status === "Correct").length;
    const incorrect = attempts.filter((attempt) => attempt.status === "Incorrect").length;
    const unanswered = attempts.filter((attempt) => attempt.status === "Unanswered").length;
    const overallAccuracy = totalAttempts ? correct / totalAttempts : 0;
    const recentSample = attempts.slice(-10);
    const recentAccuracy = recentSample.length ? recentSample.filter((attempt) => attempt.status === "Correct").length / recentSample.length : 0;
    const slowRate = totalAttempts ? attempts.filter((attempt) => attempt.timeMs > targetTimeMs).length / totalAttempts : 0;
    const byQuestion = new Map();
    attempts.forEach((attempt) => {
      if (!byQuestion.has(attempt.id)) byQuestion.set(attempt.id, []);
      byQuestion.get(attempt.id).push(attempt);
    });
    const repeatedlyIncorrect = Array.from(byQuestion.values()).filter((values) => values.filter((attempt) => attempt.status === "Incorrect").length >= 2).length;
    const uniqueQuestionsAttempted = byQuestion.size;
    const repeatedErrorRate = uniqueQuestionsAttempted ? repeatedlyIncorrect / uniqueQuestionsAttempted : 0;
    // Transparent weakness formula required by the product specification.
    const components = {
      accuracyDeficit: 1 - overallAccuracy,
      recentDeficit: 1 - recentAccuracy,
      slowRate,
      repeatedErrorRate
    };
    const weaknessScore = clamp(100 * (
      0.50 * components.accuracyDeficit +
      0.25 * components.recentDeficit +
      0.15 * components.slowRate +
      0.10 * components.repeatedErrorRate
    ), 0, 100);
    const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const trend = trendForAttempts(attempts, Number(settings.trendThresholdPoints) || 10, Number(settings.establishedAttempts) || 10);
    const evidence = evidenceLevel(totalAttempts, settings);
    const label = evidence === "Insufficient data" ? "Insufficient data" : weaknessScore >= 65 ? "Weak" : weaknessScore >= 35 ? "Developing" : "Strong";
    return {
      totalAttempts,
      uniqueQuestionsAttempted,
      correct,
      incorrect,
      unanswered,
      overallAccuracy,
      recentAccuracy,
      averageTimeMs: average(attempts.map((attempt) => attempt.timeMs)) || 0,
      averageCorrectMs: average(attempts.filter((attempt) => attempt.status === "Correct").map((attempt) => attempt.timeMs)),
      averageIncorrectMs: average(attempts.filter((attempt) => attempt.status === "Incorrect").map((attempt) => attempt.timeMs)),
      markedForReview: attempts.filter((attempt) => attempt.marked).length,
      repeatedlyIncorrect,
      slowRate,
      repeatedErrorRate,
      weaknessScore,
      components,
      evidence,
      trend: trend.label,
      trendDetails: trend,
      label,
      lastAttempted: attempts.length ? attempts[attempts.length - 1].completedAt : null
    };
  }

  function historyAttempts(history) {
    return (history || [])
      .slice()
      .sort((left, right) => new Date(left.completedAt) - new Date(right.completedAt))
      .flatMap((record) => (record.perQuestion || []).map((item) => ({
        ...item,
        completedAt: record.completedAt,
        sectionId: normalizeSectionId(item.sectionId || item.section),
        unitId: cleanText(item.unitId) || `${normalizeSectionId(item.section)}::${cleanText(item.unit)}`,
        topic: cleanText(item.topic) || "Unspecified topic",
        tags: Array.isArray(item.tags) ? item.tags : [],
        difficulty: normalizeDifficulty(item.difficulty),
        timeMs: Math.max(0, Number(item.timeMs) || 0)
      })));
  }

  function groupAnalytics(attempts, keySelector, settings) {
    const groups = new Map();
    attempts.forEach((attempt) => {
      const keys = keySelector(attempt);
      (Array.isArray(keys) ? keys : [keys]).filter(Boolean).forEach((key) => {
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(attempt);
      });
    });
    return Array.from(groups.entries()).map(([key, values]) => ({ key, ...weaknessMetrics(values, settings) }));
  }

  function questionMastery(history, threshold = 3) {
    const attempts = historyAttempts(history);
    const groups = new Map();
    attempts.forEach((attempt) => {
      if (!groups.has(attempt.id)) groups.set(attempt.id, []);
      groups.get(attempt.id).push(attempt);
    });
    const mastery = {};
    groups.forEach((values, id) => {
      let consecutiveCorrect = 0;
      let consecutiveIncorrect = 0;
      for (let index = values.length - 1; index >= 0; index -= 1) {
        if (values[index].status === "Correct" && consecutiveIncorrect === 0) consecutiveCorrect += 1;
        else if (values[index].status === "Incorrect" && consecutiveCorrect === 0) consecutiveIncorrect += 1;
        else break;
      }
      const correct = values.filter((attempt) => attempt.status === "Correct").length;
      const incorrect = values.filter((attempt) => attempt.status === "Incorrect").length;
      const unanswered = values.filter((attempt) => attempt.status === "Unanswered").length;
      const latest = values[values.length - 1];
      const everCorrect = correct > 0;
      const status = latest.status === "Correct" && consecutiveCorrect >= threshold
        ? "Mastered"
        : latest.status !== "Correct" && everCorrect ? "Unstable" : "Learning";
      mastery[id] = {
        id,
        attempts: values.length,
        correct,
        incorrect,
        unanswered,
        consecutiveCorrect,
        consecutiveIncorrect,
        averageTimeMs: values.reduce((sum, attempt) => sum + attempt.timeMs, 0) / values.length,
        lastResult: latest.status,
        lastAttempted: latest.completedAt,
        markedForReview: values.filter((attempt) => attempt.marked).length,
        status
      };
    });
    return mastery;
  }

  function calculateWeakAnalytics(history, settings = {}) {
    const attempts = historyAttempts(history);
    const section = groupAnalytics(attempts, (attempt) => attempt.sectionId, settings);
    const unit = groupAnalytics(attempts, (attempt) => attempt.unitId, settings);
    const topic = groupAnalytics(attempts, (attempt) => attempt.topic, settings);
    const tag = groupAnalytics(attempts, (attempt) => attempt.tags, settings);
    const difficulty = groupAnalytics(attempts, (attempt) => attempt.difficulty, settings);
    const question = groupAnalytics(attempts, (attempt) => attempt.id, settings);
    const mastery = questionMastery(history, Number(settings.masteryThreshold) || 3);
    return { generatedAt: new Date().toISOString(), settings: { ...settings }, attempts, section, unit, topic, tag, difficulty, question, mastery };
  }

  function seededRandom(seed = 1) {
    let value = (Number(seed) || 1) >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function weightedSampleWithoutReplacement(items, count, random = Math.random) {
    const pool = items.map((item) => ({ ...item, weight: Math.max(0.001, Number(item.weight) || 1) }));
    const selected = [];
    while (pool.length && selected.length < count) {
      const total = pool.reduce((sum, item) => sum + item.weight, 0);
      let target = random() * total;
      let index = 0;
      for (; index < pool.length - 1; index += 1) {
        target -= pool[index].weight;
        if (target <= 0) break;
      }
      selected.push(pool.splice(index, 1)[0]);
    }
    return selected;
  }

  function selectWeakQuestions(questions, analytics, options = {}) {
    const unitScores = new Map((analytics.unit || []).map((item) => [item.key, item]));
    const questionScores = new Map((analytics.question || []).map((item) => [item.key, item]));
    const mastery = analytics.mastery || {};
    const selectedUnitIds = new Set(options.unitIds || []);
    const minimumAttempts = Number(options.minimumAttempts) || 0;
    const threshold = Number(options.weaknessThreshold) || 0;
    const includeNew = options.includeNew !== false;
    const includeMastered = options.includeMastered !== false;
    const candidates = questions.filter((question) => {
      const unitMetric = unitScores.get(question.unitId);
      const questionMastery = mastery[question.id];
      if (selectedUnitIds.size && !selectedUnitIds.has(question.unitId)) return false;
      if (!includeNew && !questionMastery) return false;
      if (!includeMastered && questionMastery?.status === "Mastered") return false;
      if (unitMetric && unitMetric.totalAttempts < minimumAttempts) return false;
      if (unitMetric && unitMetric.weaknessScore < threshold && options.onlyWeakUnits) return false;
      return true;
    }).map((question) => {
      const unitMetric = unitScores.get(question.unitId);
      const questionMetric = questionScores.get(question.id);
      const questionMastery = mastery[question.id];
      const reasons = [];
      if (!questionMastery) reasons.push("Never attempted");
      if (questionMetric?.incorrect) reasons.push(`Previously incorrect ${questionMetric.incorrect} time${questionMetric.incorrect === 1 ? "" : "s"}`);
      if (questionMetric?.repeatedlyIncorrect) reasons.push("Repeatedly incorrect");
      if (questionMetric?.slowRate > 0) reasons.push("Average pace needs attention");
      if (unitMetric) reasons.push(`Unit weakness score ${unitMetric.weaknessScore.toFixed(0)}`);
      const mistakeBonus = (questionMetric?.incorrect || 0) * (options.prioritizeRecentMistakes ? 1.2 : 0.7);
      const weight = 1 + (unitMetric?.weaknessScore || 0) / 25 + mistakeBonus + (questionMetric?.slowRate || 0);
      return { question, weight, reasons: reasons.length ? reasons : ["Selected coverage"] };
    });
    const random = options.seed === undefined ? Math.random : seededRandom(options.seed);
    const count = Math.min(Math.max(0, Number(options.count) || candidates.length), candidates.length);
    return weightedSampleWithoutReplacement(candidates, count, random);
  }

  function validateClassificationResponse(input, candidates, catalog) {
    const errors = [];
    const candidateIds = new Set(candidates.map((candidate) => candidate.temporaryId));
    const sectionIds = new Set(catalog.sections.map((section) => section.id));
    const unitById = new Map(catalog.units.map((unit) => [unit.id, unit]));
    const rawResults = Array.isArray(input) ? input : Array.isArray(input?.results) ? input.results : null;
    if (!rawResults) return { valid: false, errors: ["AI response must contain a results array."], results: [] };
    const seen = new Set();
    const results = [];
    rawResults.forEach((raw, index) => {
      const label = `AI result ${index + 1}`;
      const temporaryId = cleanText(raw?.temporaryId);
      const status = cleanText(raw?.classificationStatus).toLowerCase();
      const sectionId = raw?.sectionId === null ? null : normalizeSectionId(raw?.sectionId);
      const unitId = raw?.unitId === null ? null : cleanText(raw?.unitId);
      const confidence = Number(raw?.classificationConfidence);
      const rowErrors = [];
      if (!candidateIds.has(temporaryId)) rowErrors.push("temporary ID is unknown");
      if (seen.has(temporaryId)) rowErrors.push("temporary ID is duplicated");
      if (!CLASSIFICATION_STATUSES.includes(status)) rowErrors.push("classification status is invalid");
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) rowErrors.push("confidence must be between 0 and 1");
      if (["classified", "uncertain"].includes(status)) {
        if (!sectionIds.has(sectionId)) rowErrors.push("section ID is outside the current catalog");
        const unit = unitById.get(unitId);
        if (!unit || unit.sectionId !== sectionId) rowErrors.push("unit ID is outside the selected section or catalog");
      } else if (sectionId !== null || unitId !== null) {
        rowErrors.push("unclassified or invalid results must use null section and unit IDs");
      }
      if (rowErrors.length) errors.push(`${label}${temporaryId ? ` (${temporaryId})` : ""}: ${rowErrors.join("; ")}.`);
      else {
        seen.add(temporaryId);
        results.push({
          temporaryId,
          sectionId,
          unitId,
          topic: cleanText(raw.topic),
          tags: Array.isArray(raw.tags) ? Array.from(new Set(raw.tags.map(cleanText).filter(Boolean))).slice(0, 12) : [],
          difficulty: normalizeDifficulty(raw.difficulty),
          classificationConfidence: confidence,
          classificationStatus: status,
          briefReason: cleanText(raw.briefReason),
          ambiguityFlags: Array.isArray(raw.ambiguityFlags) ? raw.ambiguityFlags.map(cleanText).filter(Boolean) : [],
          possibleDuplicateIds: Array.isArray(raw.possibleDuplicateIds) ? raw.possibleDuplicateIds.map(cleanText).filter(Boolean) : []
        });
      }
    });
    return { valid: errors.length === 0 && results.length === rawResults.length, errors, results };
  }

  function createFullBackup({ questionBank, catalog, history, settings, importQueue }) {
    return {
      type: "cma-exam-simulator-full-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      questionBank: clone(questionBank || []),
      catalog: clone(catalog),
      history: clone(history || []),
      analyticsSettings: clone(settings || {}),
      importQueue: clone(importQueue || [])
    };
  }

  function validateFullBackup(value) {
    const errors = [];
    if (!value || value.type !== "cma-exam-simulator-full-backup" || value.version !== 1) errors.push("This is not a supported full application backup.");
    if (!Array.isArray(value?.questionBank)) errors.push("Question bank is missing.");
    if (!Array.isArray(value?.history)) errors.push("Exam history is missing.");
    const catalogValidation = normalizeCatalog(value?.catalog || {});
    if (!catalogValidation.valid) errors.push(...catalogValidation.errors.map((error) => `Catalog: ${error}`));
    return { valid: errors.length === 0, errors, catalog: catalogValidation.catalog };
  }

  globalThis.CMAAdvanced = Object.freeze({
    SECTION_IDS,
    OPTION_KEYS,
    DIFFICULTIES,
    CLASSIFICATION_STATUSES,
    clone,
    clamp,
    cleanText,
    normalizeSectionId,
    unitNumberFromCode,
    naturalCompare,
    compareUnits,
    stableUnitId,
    createDefaultCatalog,
    normalizeCatalog,
    findSection,
    findUnit,
    augmentCatalogFromQuestions,
    enhanceQuestion,
    questionClassificationState,
    parseQuestionText,
    normalizeQuestionText,
    similarity,
    detectQuestionDuplicates,
    evidenceLevel,
    trendForAttempts,
    weaknessMetrics,
    historyAttempts,
    questionMastery,
    calculateWeakAnalytics,
    seededRandom,
    weightedSampleWithoutReplacement,
    selectWeakQuestions,
    validateClassificationResponse,
    createFullBackup,
    validateFullBackup
  });
})();
