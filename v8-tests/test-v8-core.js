"use strict";

const assert = require("assert");
const core = require("../v8-overlay/cma-v8-core.js");

assert.strictEqual(core.classifyQuestionType({ question: "Which statement best describes systematic risk?", options: { A: "Company-specific risk", B: "Risk affecting all investments", C: "Default risk", D: "Liquidity risk" } }), "theory");
assert.strictEqual(core.classifyQuestionType({ question: "A project requires £40,000 and returns £12,000 annually. What is the payback period?", options: { A: "2.3 years", B: "3.3 years", C: "4 years", D: "5 years" } }), "calculation");
assert.strictEqual(core.classifyQuestionType({ question: "A company has a capacity constraint. Product A contributes £15 and uses 1.5 machine hours; Product B contributes £25 and uses 2.5 machine hours. Which product should it prioritise?", options: { A: "Product A", B: "Product B", C: "Both are equally profitable per constrained hour", D: "There is insufficient information" } }), "mixed");
assert.strictEqual(core.classifyQuestionType({ questionType: "theory", question: "Contains £100 but is explicitly classified." }), "theory");

const mappedModernImport = core.normalizeImportMetadata({
  id: "CMA2-Q-MAPPED",
  sectionId: "B",
  unitId: "B-U05",
  sectionName: null,
  unitName: null,
  explanation: null,
  status: "active"
});
assert.deepStrictEqual(mappedModernImport, {
  section: "B",
  unit: "Unit 5",
  sectionName: "",
  unitName: "",
  explanation: "",
  inactive: false,
  reviewRequired: false
});

// Exact structural pattern from CMA2-Q-000052 in the audited V22 bank:
// section is known, unit metadata is pending, and nullable optional fields are valid.
const pendingUnitImport = core.normalizeImportMetadata({
  id: "CMA2-Q-000052",
  section: "B",
  sectionName: "Corporate Finance",
  unitId: null,
  unit: null,
  unitName: null,
  explanation: null,
  unit_mapping_status: "pending",
  classification: { reviewRequired: true }
});
assert.deepStrictEqual(pendingUnitImport, {
  section: "B",
  unit: "",
  sectionName: "Corporate Finance",
  unitName: "",
  explanation: "",
  inactive: true,
  reviewRequired: true
});

const dottedImport = core.normalizeImportMetadata({
  sectionId: "E.2",
  unitId: "E-U03",
  explanation: 0
});
assert.strictEqual(dottedImport.section, "E");
assert.strictEqual(dottedImport.unit, "Unit 3");
assert.strictEqual(dottedImport.explanation, "0");
assert.strictEqual(dottedImport.inactive, false);

// Exact structural pattern from CMA2-Q-000242: no assigned section/unit yet,
// but the record remains preserved as a classification-review item.
const pendingSectionImport = core.normalizeImportMetadata({
  id: "CMA2-Q-000242",
  section: null,
  unit: null,
  sectionName: null,
  unitName: null,
  explanation: null,
  unit_mapping_status: "pending",
  classification: { reviewRequired: true, sectionCandidates: [{ section: "A", score: 0.08469 }] }
});
assert.strictEqual(pendingSectionImport.section, "");
assert.strictEqual(pendingSectionImport.unit, "");
assert.strictEqual(pendingSectionImport.inactive, true);
assert.strictEqual(pendingSectionImport.reviewRequired, true);

const flash = core.parseFlashcardImport({
  title: "Section B",
  flashcards: [
    { id: "FC-1", section: "B", unitId: "B-U02", front: "What is beta?", back: "A measure of systematic risk." },
    { id: "FC-2", question: "Which statement is correct?", options: { A: "One", B: "Two", C: "Three", D: "Four" }, correctAnswer: "B", explanation: "Two is correct." }
  ]
});
assert.strictEqual(flash.validCount, 2);
assert.strictEqual(flash.cards[0].sectionId, "B");
assert.ok(flash.cards[1].back.includes("B) Two"));

const again = core.scheduleReview(null, "again", "2026-07-27T10:00:00Z");
assert.strictEqual(again.intervalDays, 0);
assert.strictEqual(again.lapses, 1);
const good = core.scheduleReview(null, "good", "2026-07-27T10:00:00Z");
assert.ok(good.intervalDays >= 3);
const easy = core.scheduleReview(good, "easy", "2026-07-30T10:00:00Z");
assert.ok(easy.intervalDays > good.intervalDays);

const manifest = core.normalizeRevisionManifest({ title: "Section B", sectionId: "B", pageCount: 527, outline: [{ title: "Risk and Return", startPage: 4, endPage: 68 }] });
assert.strictEqual(manifest.pageCount, 527);
assert.strictEqual(manifest.outline[0].startPage, 4);
assert.strictEqual(manifest.outline[0].endPage, 68);

console.log("V8 core tests passed: classification, exact V22 import patterns, flashcards, scheduling, and revision manifest.");
