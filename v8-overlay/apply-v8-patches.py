#!/usr/bin/env python3
"""Apply the V8 overlay to an extracted CMA simulator web runtime."""
from __future__ import annotations

import pathlib
import re
import shutil
import sys


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f"V8 patch anchor missing: {label}")
    return text.replace(old, new, 1)


def patch_runtime(web_dir: pathlib.Path, overlay_dir: pathlib.Path) -> None:
    for name in ("cma-v8-core.js", "cma-v8.js", "cma-v8.css"):
        source = overlay_dir / name
        if not source.is_file():
            raise RuntimeError(f"Missing overlay file: {source}")
        shutil.copy2(source, web_dir / name)

    index_path = web_dir / "index.html"
    html = index_path.read_text(encoding="utf-8")
    html = replace_once(
        html,
        "</head>",
        '  <link rel="stylesheet" href="cma-v8.css?v=20260727.2">\n</head>',
        "V8 stylesheet",
    )
    html = replace_once(
        html,
        '<script src="cma-v2.js?v=20260724.1"',
        '<script src="cma-v8-core.js?v=20260727.2"></script>\n  <script src="cma-v2.js?v=20260724.1"',
        "V8 core script order",
    )
    html = replace_once(
        html,
        "</body>",
        '  <script src="cma-v8.js?v=20260727.2"></script>\n</body>',
        "V8 UI script",
    )
    index_path.write_text(html, encoding="utf-8")

    v2_path = web_dir / "cma-v2.js"
    v2 = v2_path.read_text(encoding="utf-8")
    old_type = 'questionType: ["theory", "calculation", "scenario", "judgment", "mixed"].includes(raw?.questionType) ? raw.questionType : "mixed",'
    new_type = 'questionType: globalThis.CMAV8Core?.classifyQuestionType(raw) || (["theory", "calculation", "mixed"].includes(raw?.questionType) ? raw.questionType : "mixed"),'
    v2 = replace_once(v2, old_type, new_type, "automatic question-type classification")

    old_eligibility = 'if (config.unitIds?.length && !config.unitIds.includes(question.unitId)) return "unit-filter";'
    new_eligibility = old_eligibility + '\n    if (config.questionTypes?.length && !config.questionTypes.includes(question.questionType)) return "question-type-filter";'
    v2 = replace_once(v2, old_eligibility, new_eligibility, "question-type eligibility filter")

    old_builder_control = '<label class="consent-row"><input id="v2-shuffle-options" type="checkbox" checked> Randomize answer order</label>'
    new_builder_control = '<label>Question type<select id="v2-question-type"><option value="all">All question types</option><option value="theory">Theory only</option><option value="calculation">Calculation only</option><option value="mixed">Mixed / scenario</option></select></label>' + old_builder_control
    v2 = replace_once(v2, old_builder_control, new_builder_control, "builder question-type selector")

    old_build_vars = 'const bankDistribution = document.querySelector(\'input[name="v2-bank-distribution"]:checked\')?.value || "automatic";'
    new_build_vars = old_build_vars + '\n    const selectedQuestionType = document.getElementById("v2-question-type")?.value || "all";\n    const questionTypes = selectedQuestionType === "all" ? [] : [selectedQuestionType];'
    v2 = replace_once(v2, old_build_vars, new_build_vars, "builder type configuration")

    return_pattern = re.compile(r'return \{ presetId, total, minutes, bankIds, sectionIds: SECTION_IDS\.filter\(\(id\) => sectionQuotas\[id\] > 0\), unitIds: Object\.keys\(unitQuotas\), sectionQuotas, unitQuotas, bankDistribution, bankQuotas, repeatMode:')
    if "sectionQuotas, unitQuotas, questionTypes, bankDistribution" not in v2:
        v2, count = return_pattern.subn('return { presetId, total, minutes, bankIds, sectionIds: SECTION_IDS.filter((id) => sectionQuotas[id] > 0), unitIds: Object.keys(unitQuotas), sectionQuotas, unitQuotas, questionTypes, bankDistribution, bankQuotas, repeatMode:', v2, count=1)
        if count != 1:
            raise RuntimeError("V8 patch anchor missing: builder return config")

    old_metadata = 'unitQuestionQuotas: clone(config.unitQuotas), questionUids:'
    new_metadata = 'unitQuestionQuotas: clone(config.unitQuotas), questionTypes: clone(config.questionTypes), questionUids:'
    v2 = replace_once(v2, old_metadata, new_metadata, "test metadata question types")
    v2_path.write_text(v2, encoding="utf-8")

    app_path = web_dir / "app.js"
    app = app_path.read_text(encoding="utf-8")
    old_app_type = 'questionType: typeof rawQuestion.questionType === "string" ? rawQuestion.questionType : "mixed",'
    new_app_type = 'questionType: globalThis.CMAV8Core?.classifyQuestionType(rawQuestion) || (typeof rawQuestion.questionType === "string" ? rawQuestion.questionType : "mixed"),'
    app = replace_once(app, old_app_type, new_app_type, "legacy question-type classification")

    old_identity = '''    const id = typeof rawQuestion.id === "string" ? rawQuestion.id.trim() : "";
    const rawSection = typeof (rawQuestion.sectionId || rawQuestion.section) === "string" ? String(rawQuestion.sectionId || rawQuestion.section).trim() : "";
    const section = normalizeSectionValue(rawSection);
    const legacySection = Boolean(section && rawSection.toUpperCase() !== section);
    const catalogSection = ADVANCED.findSection?.(catalog, section);
    const catalogUnit = ADVANCED.findUnit?.(catalog, section, rawQuestion.unitId || rawQuestion.unit);
    const unit = catalogUnit?.unitCode || (typeof rawQuestion.unit === "string" ? rawQuestion.unit.trim() : "");'''
    new_identity = '''    const id = typeof rawQuestion.id === "string" ? rawQuestion.id.trim() : "";
    const v8Import = globalThis.CMAV8Core?.normalizeImportMetadata?.(rawQuestion) || null;
    const rawSection = v8Import?.section || (typeof (rawQuestion.sectionId || rawQuestion.section) === "string" ? String(rawQuestion.sectionId || rawQuestion.section).trim() : "");
    const section = normalizeSectionValue(rawSection);
    const legacySection = Boolean(section && rawSection.toUpperCase() !== section);
    const catalogSection = ADVANCED.findSection?.(catalog, section);
    const catalogUnit = ADVANCED.findUnit?.(catalog, section, v8Import?.unit || rawQuestion.unitId || rawQuestion.unit);
    const unit = catalogUnit?.unitCode || v8Import?.unit || (typeof rawQuestion.unit === "string" ? rawQuestion.unit.trim() : "");'''
    app = replace_once(app, old_identity, new_identity, "V22 import metadata normalization")

    old_names = '''    const suppliedSectionName = typeof rawQuestion.sectionName === "string" ? rawQuestion.sectionName.trim() : "";
    const suppliedUnitName = typeof rawQuestion.unitName === "string" ? rawQuestion.unitName.trim() : "";'''
    new_names = '''    const suppliedSectionName = v8Import ? v8Import.sectionName : (typeof rawQuestion.sectionName === "string" ? rawQuestion.sectionName.trim() : "");
    const suppliedUnitName = v8Import ? v8Import.unitName : (typeof rawQuestion.unitName === "string" ? rawQuestion.unitName.trim() : "");'''
    app = replace_once(app, old_names, new_names, "nullable section and unit names")

    old_validation = '''    if (!section || !SECTION_KEYS.includes(section)) errors.push(`${label}${idSuffix}: ‘section’ must be A, B, C, D, E, or F.`);
    if (rawQuestion.sectionName !== undefined && typeof rawQuestion.sectionName !== "string") errors.push(`${label}${idSuffix}: ‘sectionName’ must be text when provided.`);
    if (!unit) errors.push(`${label}${idSuffix}: ‘unit’ is required.`);
    if (rawQuestion.unitName !== undefined && typeof rawQuestion.unitName !== "string") errors.push(`${label}${idSuffix}: ‘unitName’ must be text when provided.`);'''
    new_validation = '''    if ((!section || !SECTION_KEYS.includes(section)) && !v8Import?.inactive) errors.push(`${label}${idSuffix}: ‘section’ must be A, B, C, D, E, or F.`);
    if (rawQuestion.sectionName !== undefined && rawQuestion.sectionName !== null && typeof rawQuestion.sectionName !== "string") errors.push(`${label}${idSuffix}: ‘sectionName’ must be text when provided.`);
    if (!unit && !v8Import?.inactive) errors.push(`${label}${idSuffix}: ‘unit’ is required.`);
    if (rawQuestion.unitName !== undefined && rawQuestion.unitName !== null && typeof rawQuestion.unitName !== "string") errors.push(`${label}${idSuffix}: ‘unitName’ must be text when provided.`);'''
    app = replace_once(app, old_validation, new_validation, "nullable and inactive classification validation")

    old_explanation_validation = '''    if (rawQuestion.explanation !== undefined && typeof rawQuestion.explanation !== "string") {
      errors.push(`${label}${idSuffix}: ‘explanation’ must be text when provided.`);
    }'''
    new_explanation_validation = '''    if (rawQuestion.explanation !== undefined && rawQuestion.explanation !== null && typeof rawQuestion.explanation !== "string") {
      errors.push(`${label}${idSuffix}: ‘explanation’ must be text when provided.`);
    }'''
    app = replace_once(app, old_explanation_validation, new_explanation_validation, "nullable explanation validation")

    old_unit_id = 'unitId: catalogUnit?.id || rawQuestion.unitId || (ADVANCED.stableUnitId ? ADVANCED.stableUnitId(section, unit) : `${section}-${unit}`),'
    new_unit_id = 'unitId: catalogUnit?.id || (typeof rawQuestion.unitId === "string" ? rawQuestion.unitId.trim() : "") || (section && unit ? (ADVANCED.stableUnitId ? ADVANCED.stableUnitId(section, unit) : `${section}-${unit}`) : ""),'
    app = replace_once(app, old_unit_id, new_unit_id, "safe unassigned archived unit ID")

    old_explanation_output = 'explanation: typeof rawQuestion.explanation === "string" ? rawQuestion.explanation.trim() : ""'
    new_explanation_output = 'explanation: v8Import ? v8Import.explanation : (typeof rawQuestion.explanation === "string" ? rawQuestion.explanation.trim() : "")'
    app = replace_once(app, old_explanation_output, new_explanation_output, "normalized explanation output")
    app_path.write_text(app, encoding="utf-8")

    sw_path = web_dir / "service-worker.js"
    sw = sw_path.read_text(encoding="utf-8")
    sw = re.sub(r'const CACHE_NAME = "cma-simulator-[^"]+";', 'const CACHE_NAME = "cma-simulator-v8-20260727-hotfix1";', sw, count=1)
    cache_anchor = '  "./cma-v2.js?v=20260724.1",'
    cache_entries = '  "./cma-v8-core.js?v=20260727.2",\n' + cache_anchor + '\n  "./cma-v8.js?v=20260727.2",\n  "./cma-v8.css?v=20260727.2",'
    sw = replace_once(sw, cache_anchor, cache_entries, "service-worker V8 cache")
    sw_path.write_text(sw, encoding="utf-8")

    manifest_path = web_dir / "manifest.webmanifest"
    if manifest_path.is_file():
        manifest = manifest_path.read_text(encoding="utf-8")
        manifest = manifest.replace('"name": "CMA Exam Simulator"', '"name": "CMA Exam Simulator V8"')
        manifest = manifest.replace('"short_name": "CMA Simulator"', '"short_name": "CMA V8"')
        manifest_path.write_text(manifest, encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: apply-v8-patches.py WEB_DIR OVERLAY_DIR")
    patch_runtime(pathlib.Path(sys.argv[1]).resolve(), pathlib.Path(sys.argv[2]).resolve())
