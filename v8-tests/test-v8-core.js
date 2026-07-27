"use strict";

const assert = require("assert");
const core = require("../v8-overlay/cma-v8-core.js");

assert.strictEqual(core.classifyQuestionType({ question: "Which statement best describes systematic risk?", options: { A: "Company-specific risk", B: "Risk affecting all investments", C: "Default risk", D: "Liquidity risk" } }), "theory");
assert.strictEqual(core.classifyQuestionType({ question: "A project requires £40,000 and returns £12,000 annually. What is the payback period?", options: { A: "2.3 years", B: "3.3 years", C: "4 years", D: "5 years" } }), "calculation");
assert.strictEqual(core.classifyQuestionType({ question: "A company faces a capacity constraint and has the following unit data. Which product should it prioritise?", options: { A: "Product A", B: "Product B", C: "Both", D: "Neither" } }), "mixed");
assert.strictEqual(core.classifyQuestionType({ questionType: "theory", question: "Contains £100 but is explicitly classified." }), "theory");

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

console.log("V8 core tests passed: classification, flashcard import, scheduling, and revision manifest.");
