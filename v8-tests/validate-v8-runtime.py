#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import sys


def require(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise AssertionError(f"Missing {label}: {needle}")


def main(root: pathlib.Path) -> None:
    required = ["index.html", "cma-v2.js", "app.js", "service-worker.js", "cma-v8-core.js", "cma-v8.js", "cma-v8.css"]
    for name in required:
        path = root / name
        if not path.is_file() or path.stat().st_size == 0:
            raise AssertionError(f"Missing or empty runtime file: {name}")

    index = (root / "index.html").read_text(encoding="utf-8")
    v2 = (root / "cma-v2.js").read_text(encoding="utf-8")
    app = (root / "app.js").read_text(encoding="utf-8")
    sw = (root / "service-worker.js").read_text(encoding="utf-8")
    ui = (root / "cma-v8.js").read_text(encoding="utf-8")

    require(index, "cma-v8-core.js", "V8 core script")
    require(index, "cma-v8.js", "V8 UI script")
    require(index, "cma-v8.css", "V8 stylesheet")
    if index.index("cma-v8-core.js") > index.index("cma-v2.js"):
        raise AssertionError("V8 core must load before cma-v2.js")

    require(v2, 'id="v2-question-type"', "question-type selector")
    require(v2, 'return "question-type-filter"', "question-type eligibility rule")
    require(v2, "questionTypes: clone(config.questionTypes)", "question-type test metadata")
    require(v2, "CMAV8Core?.classifyQuestionType", "automatic V2 classification")
    require(app, "CMAV8Core?.classifyQuestionType", "automatic legacy classification")

    for asset in ("cma-v8-core.js", "cma-v8.js", "cma-v8.css"):
        require(sw, asset, f"offline cache entry for {asset}")

    require(ui, "Flashcards", "flashcard screen")
    require(ui, "Revision", "revision screen")
    require(ui, "cma-v8-learning", "V8 IndexedDB")
    require(ui, "The original PDF is never uploaded", "revision privacy notice")
    require(ui, "pageCount: 527", "Section B page count")

    forbidden = list(root.rglob("*.pdf")) + list(root.rglob("*.PDF"))
    if forbidden:
        raise AssertionError(f"Copyrighted PDF must not be in public runtime: {forbidden}")

    print("V8 runtime validation passed.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: validate-v8-runtime.py WEB_DIR")
    main(pathlib.Path(sys.argv[1]).resolve())
