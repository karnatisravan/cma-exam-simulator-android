(() => {
  "use strict";

  const MAX_VALID_TIME_MS = 10 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  function clean(value) { return String(value ?? "").trim(); }
  function dateValue(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
  function sectionId(item) { return clean(item?.sectionId || item?.section).replace(/^SECTION\s*/i, "").toUpperCase(); }
  function unitId(item) { return clean(item?.unitId) || `${sectionId(item)}::${clean(item?.unit)}`; }
  function validTimeMs(value, maximum = MAX_VALID_TIME_MS) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= maximum ? number : null;
  }
  function average(values) { const valid = values.filter(Number.isFinite); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null; }
  function median(values) {
    const valid = values.filter(Number.isFinite).slice().sort((left, right) => left - right);
    if (!valid.length) return null;
    const middle = Math.floor(valid.length / 2);
    return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
  }
  function round(value, digits = 1) { return Number.isFinite(value) ? Number(value.toFixed(digits)) : null; }
  function unique(values) { return Array.from(new Set(values.filter(Boolean))); }

  function attemptMode(attempt) { return clean(attempt?.mode || attempt?.settings?.mode || "standard"); }
  function normalizedUnits(attempt) {
    return unique((attempt?.selectedUnits || attempt?.settings?.selectedUnits || []).map((item) => typeof item === "string" ? item : clean(item?.unitId || item?.id || item?.unit)));
  }
  function normalizedSections(attempt) {
    const stored = attempt?.selectedSections || attempt?.settings?.selectedSections || [];
    return unique(stored.map((item) => typeof item === "string" ? clean(item).toUpperCase() : sectionId(item)));
  }

  function historyQuestions(history = [], options = {}) {
    const maximum = Number(options.maximumTimeMs) || MAX_VALID_TIME_MS;
    return history.flatMap((attempt) => {
      const completed = dateValue(attempt?.completedAt);
      if (!completed || !Array.isArray(attempt?.perQuestion)) return [];
      return attempt.perQuestion.map((item, index) => ({
        ...item,
        attemptId: clean(attempt.id),
        attemptTitle: clean(attempt.title) || "Practice exam",
        attemptMode: attemptMode(attempt),
        completedAt: completed.toISOString(),
        completedMs: completed.getTime(),
        number: Number(item.number) || index + 1,
        sectionId: sectionId(item),
        unitId: unitId(item),
        status: ["Correct", "Incorrect", "Unanswered"].includes(item.status) ? item.status : "Unanswered",
        validTimeMs: validTimeMs(item.timeMs, maximum)
      }));
    });
  }

  function metrics(records = [], options = {}) {
    const correct = records.filter((item) => item.status === "Correct").length;
    const incorrect = records.filter((item) => item.status === "Incorrect").length;
    const unanswered = records.filter((item) => item.status === "Unanswered").length;
    const graded = correct + incorrect;
    const accuracyDenominator = graded + (options.includeUnansweredAsIncorrect ? unanswered : 0);
    const times = records.map((item) => item.validTimeMs).filter(Number.isFinite);
    return {
      total: records.length,
      graded,
      correct,
      incorrect,
      unanswered,
      accuracy: accuracyDenominator ? (correct / accuracyDenominator) * 100 : null,
      averageTimeMs: average(times),
      medianTimeMs: median(times),
      fastestTimeMs: times.length ? Math.min(...times) : null,
      slowestTimeMs: times.length ? Math.max(...times) : null,
      timedQuestions: times.length,
      examCount: unique(records.map((item) => item.attemptId)).length,
      lastPracticedAt: records.length ? records.reduce((latest, item) => item.completedMs > latest.completedMs ? item : latest).completedAt : null
    };
  }

  function periodWindows(period = "four-weeks", nowValue = Date.now(), options = {}) {
    const now = dateValue(nowValue) || new Date();
    const end = now.getTime() + 1;
    if (period === "this-week") {
      const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      return { recentStart: start.getTime(), recentEnd: end, previousStart: start.getTime() - 7 * DAY_MS, previousEnd: start.getTime() };
    }
    if (period === "all-time") return { recentStart: Number.NEGATIVE_INFINITY, recentEnd: end, previousStart: Number.NEGATIVE_INFINITY, previousEnd: Number.NEGATIVE_INFINITY };
    if (period === "custom") {
      const start = dateValue(options.customStart)?.getTime();
      const inclusiveEnd = dateValue(options.customEnd);
      if (Number.isFinite(start) && inclusiveEnd) {
        inclusiveEnd.setHours(23, 59, 59, 999);
        const customEnd = inclusiveEnd.getTime() + 1;
        if (customEnd > start) {
          const duration = customEnd - start;
          return { recentStart: start, recentEnd: customEnd, previousStart: start - duration, previousEnd: start };
        }
      }
    }
    const days = period === "7-days" ? 7 : period === "30-days" ? 30 : period === "90-days" ? 90 : 28;
    return { recentStart: end - days * DAY_MS, recentEnd: end, previousStart: end - days * 2 * DAY_MS, previousEnd: end - days * DAY_MS };
  }

  function compare(records = [], options = {}) {
    const lifetime = metrics(records, options);
    const windows = periodWindows(options.period, options.now, options);
    const recentRecords = records.filter((item) => item.completedMs >= windows.recentStart && item.completedMs < windows.recentEnd);
    const previousRecords = records.filter((item) => item.completedMs >= windows.previousStart && item.completedMs < windows.previousEnd);
    const recent = metrics(recentRecords, options);
    const previous = metrics(previousRecords, options);
    const minimum = Math.max(1, Number(options.minimumAnswered) || 5);
    const sufficient = recent.graded >= minimum && previous.graded >= minimum;
    const accuracyChangePoints = sufficient && Number.isFinite(recent.accuracy) && Number.isFinite(previous.accuracy) ? recent.accuracy - previous.accuracy : null;
    const speedComparable = sufficient && Number.isFinite(recent.averageTimeMs) && Number.isFinite(previous.averageTimeMs) && previous.averageTimeMs > 0;
    const speedImprovementPercentage = speedComparable ? ((previous.averageTimeMs - recent.averageTimeMs) / previous.averageTimeMs) * 100 : null;
    const timeChangeMs = speedComparable ? recent.averageTimeMs - previous.averageTimeMs : null;
    return { lifetime, recent, previous, windows, sufficient, minimum, accuracyChangePoints, speedImprovementPercentage, timeChangeMs };
  }

  function scopeRecords(records, scopeType, scopeId) {
    if (!scopeId || scopeId === "all" || scopeType === "overall") return records.slice();
    return records.filter((item) => scopeType === "section" ? item.sectionId === scopeId : item.unitId === scopeId);
  }

  function performanceRows(history = [], questionBank = [], scope = "section", options = {}) {
    const records = historyQuestions(history, options);
    const catalogItems = scope === "section" ? (options.catalog?.sections || []).map((section) => ({ sectionId: section.id, section: section.id, sectionName: section.name })) : (options.catalog?.units || []).map((unit) => ({ sectionId: unit.sectionId, section: unit.sectionId, unitId: unit.id, unit: unit.unitCode, unitName: unit.unitName }));
    const ids = new Set([
      ...records.map((item) => scope === "section" ? item.sectionId : item.unitId),
      ...questionBank.map((item) => scope === "section" ? sectionId(item) : unitId(item)),
      ...catalogItems.map((item) => scope === "section" ? sectionId(item) : unitId(item))
    ].filter(Boolean));
    return Array.from(ids).map((id) => {
      const scoped = scopeRecords(records, scope, id);
      const first = scoped[0] || questionBank.find((item) => (scope === "section" ? sectionId(item) : unitId(item)) === id) || catalogItems.find((item) => (scope === "section" ? sectionId(item) : unitId(item)) === id) || {};
      const trend = compare(scoped, options);
      const available = questionBank.filter((item) => (scope === "section" ? sectionId(item) : unitId(item)) === id).length;
      const retired = questionBank.filter((item) => item.retired && (scope === "section" ? sectionId(item) : unitId(item)) === id).length;
      return {
        id,
        sectionId: sectionId(first),
        unitId: scope === "unit" ? id : "",
        name: scope === "section" ? clean(first.sectionNameSnapshot || first.sectionName || `Section ${id}`) : clean(first.unitNameSnapshot || first.unitName || first.unit || id),
        unitCode: scope === "unit" ? clean(first.unit) : "",
        available,
        retired,
        uniqueQuestionsAttempted: unique(scoped.map((item) => item.id)).length,
        guessed: scoped.filter((item) => item.guessed).length,
        marked: scoped.filter((item) => item.marked).length,
        ...trend
      };
    }).sort((left, right) => `${left.sectionId} ${left.unitCode || left.id}`.localeCompare(`${right.sectionId} ${right.unitCode || right.id}`, undefined, { numeric: true }));
  }

  function periodKey(date, groupBy) {
    const value = new Date(date);
    if (groupBy === "month") return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
    if (groupBy === "day") return value.toISOString().slice(0, 10);
    if (groupBy === "week") {
      const start = new Date(value); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      return start.toISOString().slice(0, 10);
    }
    return clean(date);
  }

  function graphSeries(history = [], options = {}) {
    const groupBy = options.groupBy || "week";
    const records = scopeRecords(historyQuestions(history, options), options.scopeType || "overall", options.scopeId || "all");
    const groups = new Map();
    records.forEach((item) => {
      const key = groupBy === "exam" ? item.attemptId : periodKey(item.completedAt, groupBy);
      if (!groups.has(key)) groups.set(key, { key, label: groupBy === "exam" ? item.attemptTitle : key, completedMs: item.completedMs, records: [] });
      const group = groups.get(key); group.records.push(item); group.completedMs = Math.max(group.completedMs, item.completedMs);
    });
    return Array.from(groups.values()).sort((left, right) => left.completedMs - right.completedMs).map((group) => {
      const summary = metrics(group.records, options);
      return { key: group.key, label: group.label, completedMs: group.completedMs, accuracy: summary.accuracy, averageSeconds: Number.isFinite(summary.averageTimeMs) ? summary.averageTimeMs / 1000 : null, correct: summary.correct, incorrect: summary.incorrect, unanswered: summary.unanswered, total: summary.total };
    });
  }

  function sameSet(left, right) { const a = unique(left).sort(); const b = unique(right).sort(); return a.length === b.length && a.every((value, index) => value === b[index]); }

  function comparableAttempt(history = [], target) {
    if (!target) return null;
    const targetDate = dateValue(target.completedAt)?.getTime() || Infinity;
    const earlier = history.filter((item) => item?.id !== target.id && (dateValue(item.completedAt)?.getTime() || Infinity) < targetDate).sort((a, b) => (dateValue(b.completedAt)?.getTime() || 0) - (dateValue(a.completedAt)?.getTime() || 0));
    const targetUnits = normalizedUnits(target); const targetSections = normalizedSections(target); const mode = attemptMode(target);
    const exact = earlier.find((item) => attemptMode(item) === mode && targetUnits.length && sameSet(normalizedUnits(item), targetUnits));
    if (exact) return { attempt: exact, basis: "same mode and selected units", approximate: false };
    const units = earlier.find((item) => targetUnits.length && sameSet(normalizedUnits(item), targetUnits));
    if (units) return { attempt: units, basis: "same selected units", approximate: false };
    const section = earlier.find((item) => targetSections.some((id) => normalizedSections(item).includes(id)));
    if (section) return { attempt: section, basis: `shared Section ${targetSections.find((id) => normalizedSections(section).includes(id))}`, approximate: true };
    return earlier[0] ? { attempt: earlier[0], basis: "previous overall attempt", approximate: true } : null;
  }

  function attemptComparison(history = [], target) {
    const comparison = comparableAttempt(history, target);
    if (!comparison) return { comparison: null, accuracyChangePoints: null, speedImprovementPercentage: null };
    const recent = metrics(historyQuestions([target]));
    const previous = metrics(historyQuestions([comparison.attempt]));
    return {
      comparison,
      recent,
      previous,
      accuracyChangePoints: Number.isFinite(recent.accuracy) && Number.isFinite(previous.accuracy) ? recent.accuracy - previous.accuracy : null,
      speedImprovementPercentage: Number.isFinite(recent.averageTimeMs) && Number.isFinite(previous.averageTimeMs) && previous.averageTimeMs > 0 ? ((previous.averageTimeMs - recent.averageTimeMs) / previous.averageTimeMs) * 100 : null
    };
  }

  function summaryText(label, comparison) {
    if (!comparison?.sufficient) return `${label} has insufficient data for a reliable trend.`;
    const accuracy = comparison.accuracyChangePoints;
    const speed = comparison.speedImprovementPercentage;
    const accuracyText = Number.isFinite(accuracy) ? `${label} accuracy ${accuracy >= 0 ? "improved" : "decreased"} from ${round(comparison.previous.accuracy)}% to ${round(comparison.recent.accuracy)}%, ${accuracy >= 0 ? "an increase" : "a decrease"} of ${Math.abs(round(accuracy))} percentage points.` : `${label} accuracy could not be compared.`;
    const speedText = Number.isFinite(speed) ? ` Average solving time changed from ${round(comparison.previous.averageTimeMs / 1000)} to ${round(comparison.recent.averageTimeMs / 1000)} seconds, approximately ${Math.abs(round(speed))}% ${speed >= 0 ? "faster" : "slower"}.` : " Solving speed could not be compared reliably.";
    return accuracyText + speedText;
  }

  function weeklySummary(history = [], nowValue = Date.now()) {
    const records = historyQuestions(history);
    const now = dateValue(nowValue) || new Date();
    const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const current = records.filter((item) => item.completedMs >= weekStart.getTime());
    const previous = records.filter((item) => item.completedMs >= weekStart.getTime() - 7 * DAY_MS && item.completedMs < weekStart.getTime());
    return { weekStart: weekStart.toISOString(), current: metrics(current), previous: metrics(previous), comparison: compare(records, { period: "this-week", now }) };
  }

  const API = Object.freeze({
    MAX_VALID_TIME_MS,
    historyQuestions,
    metrics,
    periodWindows,
    compare,
    scopeRecords,
    performanceRows,
    graphSeries,
    comparableAttempt,
    attemptComparison,
    summaryText,
    weeklySummary,
    sectionId,
    unitId,
    validTimeMs,
    average,
    median,
    normalizedSections,
    normalizedUnits,
    attemptMode,
    round
  });

  globalThis.CMAProgress = API;
})();
