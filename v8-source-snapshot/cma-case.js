(() => {
  "use strict";

  const OPTION_KEYS = Object.freeze(["A", "B", "C", "D"]);
  const ITEM_TYPES = Object.freeze(["single-choice", "multi-select", "numeric", "short-text", "select-list"]);
  const BLUEPRINT = Object.freeze([
    { id: "A", name: "Financial Statement Analysis", weight: 20, count: 20 },
    { id: "B", name: "Corporate Finance", weight: 20, count: 20 },
    { id: "C", name: "Business Decision Analysis", weight: 25, count: 25 },
    { id: "D", name: "Enterprise Risk Management", weight: 10, count: 10 },
    { id: "E", name: "Capital Investment Decisions", weight: 10, count: 10 },
    { id: "F", name: "Professional Ethics", weight: 15, count: 15 }
  ]);

  const DEMO_CASES = Object.freeze([
    {
      version: 1,
      id: "DEMO-CBQ-C-E-001",
      title: "Orion Components — Capacity and Investment Decision",
      sectionIds: ["C", "E"],
      difficulty: "CMA level",
      source: "Included software demonstration",
      scenario: "Orion Components manufactures 40,000 control modules each year and currently has capacity for 46,000 units. Normal selling price is $82 per unit. Variable manufacturing cost is $49 per unit and variable selling cost is $5 per unit. A new overseas customer offers to buy 5,000 units for $58 each. No variable selling cost would be incurred, but a one-time inspection cost of $12,000 would be required.\n\nSeparately, management is evaluating equipment costing $240,000. It would generate after-tax cash savings of $70,000 at each year-end for four years and have an after-tax salvage value of $20,000. Orion's required return is 10%.",
      exhibits: [
        { title: "Present-value factors at 10%", content: "PV of $1 received in year 4: 0.6830\nPV of an ordinary annuity of $1 for 4 years: 3.1699" }
      ],
      items: [
        { id: "C-E-1", type: "numeric", prompt: "Calculate the incremental operating income from accepting the special order, in dollars.", correctAnswer: 33000, tolerance: 1, points: 2, explanation: "Relevant revenue is $290,000. Relevant variable manufacturing cost is $245,000 and inspection cost is $12,000, producing $33,000 incremental income." },
        { id: "C-E-2", type: "single-choice", prompt: "Based only on the quantitative information, what should Orion do with the special order?", options: { A: "Reject because price is below normal selling price", B: "Reject because price is below full cost", C: "Accept because relevant revenue exceeds relevant cost", D: "Accept only if normal sales are displaced" }, correctAnswer: "C", points: 1, explanation: "With idle capacity and no displaced regular sales, the positive incremental income supports acceptance." },
        { id: "C-E-3", type: "numeric", prompt: "Calculate the equipment's net present value, rounded to the nearest dollar.", correctAnswer: -44649, tolerance: 2, points: 2, explanation: "NPV = ($70,000 × 3.1699) + ($20,000 × 0.6830) − $240,000 = −$44,647, with a small rounding allowance." },
        { id: "C-E-4", type: "multi-select", prompt: "Select all items that are normally relevant incremental cash flows in capital budgeting.", options: { A: "Opportunity cost of using owned space", B: "Original purchase price of an asset already owned", C: "Incremental working capital", D: "After-tax salvage value" }, correctAnswers: ["A", "C", "D"], points: 3, explanation: "Opportunity costs, incremental working capital, and after-tax salvage value change with the decision. A historical purchase price is sunk." },
        { id: "C-E-5", type: "select-list", prompt: "Which method directly measures expected value creation in dollars?", options: { A: "Payback period", B: "Accounting rate of return", C: "Net present value", D: "Internal rate of return" }, correctAnswer: "C", points: 1, explanation: "NPV is the discounted dollar value added by the project." }
      ]
    },
    {
      version: 1,
      id: "DEMO-CBQ-A-B-001",
      title: "Meridian Retail — Analysis and Financing",
      sectionIds: ["A", "B"],
      difficulty: "CMA level",
      source: "Included software demonstration",
      scenario: "Meridian Retail reports sales of $5,000,000, net income of $300,000, average total assets of $2,500,000, and average common equity of $1,500,000. Current assets are $1,200,000, including $450,000 of inventory. Current liabilities are $600,000.\n\nMeridian is considering new long-term financing. Its target capital structure is 40% debt and 60% common equity. The after-tax cost of debt is 6%, the risk-free rate is 4%, beta is 1.2, and the expected market return is 9%.",
      exhibits: [{ title: "Analytical reminder", content: "ROA = Net income ÷ Average total assets\nROE = Net income ÷ Average common equity\nCAPM = Risk-free rate + Beta × Market risk premium" }],
      items: [
        { id: "A-B-1", type: "numeric", prompt: "Calculate Meridian's return on assets as a percentage.", correctAnswer: 12, tolerance: 0.01, points: 1, explanation: "$300,000 ÷ $2,500,000 = 12%." },
        { id: "A-B-2", type: "numeric", prompt: "Calculate Meridian's quick ratio.", correctAnswer: 1.25, tolerance: 0.01, points: 1, explanation: "Quick ratio = ($1,200,000 − $450,000) ÷ $600,000 = 1.25." },
        { id: "A-B-3", type: "numeric", prompt: "Using CAPM, calculate the required return on common equity as a percentage.", correctAnswer: 10, tolerance: 0.01, points: 2, explanation: "4% + 1.2 × (9% − 4%) = 10%." },
        { id: "A-B-4", type: "numeric", prompt: "Calculate the weighted-average cost of capital as a percentage.", correctAnswer: 8.4, tolerance: 0.01, points: 2, explanation: "WACC = 40% × 6% + 60% × 10% = 8.4%." },
        { id: "A-B-5", type: "multi-select", prompt: "Select all conditions that can reduce reported earnings quality.", options: { A: "Aggressive revenue recognition", B: "Consistent accounting policies", C: "Large nonrecurring gains", D: "Cash flow persistently below reported income" }, correctAnswers: ["A", "C", "D"], points: 3, explanation: "Aggressive recognition, nonrecurring gains, and weak cash conversion can make earnings less sustainable or less representative." }
      ]
    },
    {
      version: 1,
      id: "DEMO-CBQ-B-D-001",
      title: "Northstar Imports — Currency and Enterprise Risk",
      sectionIds: ["B", "D"],
      difficulty: "CMA level",
      source: "Included software demonstration",
      scenario: "Northstar Imports must pay €400,000 to a supplier in 90 days. The current spot rate is $1.08 per euro. A 90-day forward contract is available at $1.10 per euro. Management is concerned that the euro will appreciate.\n\nNorthstar's risk team identifies a separate cyber event with a 20% annual probability and an estimated loss of $600,000. A control costing $45,000 annually would reduce the probability to 8% while leaving loss severity unchanged.",
      exhibits: [],
      items: [
        { id: "B-D-1", type: "numeric", prompt: "Calculate the dollar amount Northstar would lock in using the forward contract.", correctAnswer: 440000, tolerance: 1, points: 1, explanation: "€400,000 × $1.10 = $440,000." },
        { id: "B-D-2", type: "single-choice", prompt: "What exposure is Northstar primarily hedging?", options: { A: "Translation exposure", B: "Transaction exposure", C: "Economic exposure only", D: "Interest-rate exposure" }, correctAnswer: "B", points: 1, explanation: "A contracted foreign-currency payable creates transaction exposure." },
        { id: "B-D-3", type: "numeric", prompt: "Calculate the expected annual cyber loss before the proposed control.", correctAnswer: 120000, tolerance: 1, points: 1, explanation: "20% × $600,000 = $120,000." },
        { id: "B-D-4", type: "numeric", prompt: "Calculate the expected annual net benefit of the control.", correctAnswer: 27000, tolerance: 1, points: 2, explanation: "Expected loss reduction is (20% − 8%) × $600,000 = $72,000. Less $45,000 cost gives $27,000." },
        { id: "B-D-5", type: "multi-select", prompt: "Select all standard enterprise-risk responses.", options: { A: "Avoid", B: "Accept", C: "Transfer", D: "Ignore without assessment" }, correctAnswers: ["A", "B", "C"], points: 3, explanation: "Avoidance, acceptance, reduction/mitigation, and sharing/transfer are established risk responses. Ignoring risk is not an assessed response." }
      ]
    },
    {
      version: 1,
      id: "DEMO-CBQ-F-001",
      title: "Atlas Services — Ethical Conflict",
      sectionIds: ["F"],
      difficulty: "CMA level",
      source: "Included software demonstration",
      scenario: "Priya, a management accountant at Atlas Services, discovers that her supervisor intentionally delayed recording supplier invoices so the division would meet its quarterly profit target. The supervisor tells Priya that the invoices will be recorded next quarter and asks her not to discuss the matter. Atlas has an established ethics policy and an anonymous reporting channel. Priya is not personally involved in the manipulation, but her internal report would contain the misstated results.",
      exhibits: [{ title: "IMA ethical standards", content: "Competence · Confidentiality · Integrity · Credibility" }],
      items: [
        { id: "F-1", type: "single-choice", prompt: "Which ethical standard is most directly threatened by knowingly issuing a misleading internal report?", options: { A: "Competence", B: "Confidentiality", C: "Credibility", D: "Technical compliance only" }, correctAnswer: "C", points: 1, explanation: "Credibility requires communicating information fairly and objectively and disclosing information that could influence users." },
        { id: "F-2", type: "multi-select", prompt: "Select all appropriate initial actions for Priya.", options: { A: "Follow Atlas's established escalation policy", B: "Consult an objective adviser if needed", C: "Post the allegations publicly", D: "Document the facts and communications" }, correctAnswers: ["A", "B", "D"], points: 3, explanation: "Established policy, objective advice, and careful documentation are appropriate. Public disclosure may breach confidentiality unless legally required." },
        { id: "F-3", type: "select-list", prompt: "If the supervisor is Priya's immediate superior and is involved, whom should she normally approach next under the organization's escalation process?", options: { A: "The next higher managerial level or designated ethics channel", B: "A customer", C: "The supplier", D: "No one" }, correctAnswer: "A", points: 1, explanation: "When the immediate superior is involved, escalation normally moves to the next appropriate level or designated channel." },
        { id: "F-4", type: "short-text", prompt: "Enter the IMA ethical standard associated with keeping information confidential except when disclosure is authorized or legally required.", acceptedAnswers: ["confidentiality"], correctAnswer: "Confidentiality", points: 1, explanation: "The standard is Confidentiality." },
        { id: "F-5", type: "multi-select", prompt: "Which elements are commonly associated with the fraud triangle?", options: { A: "Pressure", B: "Opportunity", C: "Rationalization", D: "Diversification" }, correctAnswers: ["A", "B", "C"], points: 3, explanation: "The fraud triangle consists of pressure/incentive, opportunity, and rationalization." }
      ]
    }
  ]);

  const FORMULAS = Object.freeze([
    { section: "A", title: "Liquidity", formula: "Current ratio = Current assets ÷ Current liabilities\nQuick ratio = (Cash + Marketable securities + A/R) ÷ Current liabilities", note: "Check whether inventory and prepaids belong in the numerator." },
    { section: "A", title: "Profitability", formula: "Gross margin % = Gross profit ÷ Sales\nOperating margin = Operating income ÷ Sales\nROA = Net income ÷ Average total assets", note: "Use average balance-sheet amounts when provided." },
    { section: "A", title: "DuPont ROE", formula: "ROE = Profit margin × Total asset turnover × Equity multiplier", note: "Separates operating performance, asset use, and leverage." },
    { section: "B", title: "CAPM", formula: "Required return = Rf + β(Rm − Rf)", note: "The market risk premium is Rm minus Rf." },
    { section: "B", title: "WACC", formula: "WACC = wd·kd(1−t) + wp·kp + we·ke", note: "Use market-value weights and the after-tax cost of debt." },
    { section: "B", title: "Bond & stock value", formula: "Bond value = PV of coupons + PV of principal\nGordon value = D1 ÷ (k − g)", note: "D1 is next period's dividend, not the dividend just paid." },
    { section: "B", title: "Working capital", formula: "Cash conversion cycle = DSO + Days inventory − Days payables", note: "A shorter cycle generally releases cash." },
    { section: "C", title: "CVP", formula: "CM per unit = Price − Variable cost\nBreak-even units = Fixed costs ÷ CM per unit", note: "For target profit, add target operating income to fixed costs." },
    { section: "C", title: "Multi-product CVP", formula: "Break-even composite units = Fixed costs ÷ Weighted-average CM", note: "Assumes the sales mix remains constant." },
    { section: "C", title: "Relevant cost", formula: "Decision impact = Incremental revenue − Incremental avoidable cost − Opportunity cost", note: "Exclude sunk and unavoidable allocated costs." },
    { section: "C", title: "Price elasticity", formula: "Elasticity = % change in quantity demanded ÷ % change in price", note: "Absolute value above 1 indicates elastic demand." },
    { section: "D", title: "Expected loss", formula: "Expected loss = Probability × Impact", note: "Compare the reduction in expected loss with control cost and risk appetite." },
    { section: "D", title: "Risk responses", formula: "Avoid · Reduce · Share/Transfer · Accept", note: "Assess residual risk after controls, not only inherent risk." },
    { section: "E", title: "Net present value", formula: "NPV = Σ[CFt ÷ (1+r)^t] − Initial investment", note: "Accept an independent project when NPV is positive." },
    { section: "E", title: "IRR & payback", formula: "IRR: discount rate where NPV = 0\nPayback = Years before recovery + Unrecovered amount ÷ Next year's cash flow", note: "Payback ignores later cash flows and usually the time value of money." },
    { section: "E", title: "Incremental cash flow", formula: "Operating CF = After-tax operating savings + Depreciation tax shield", note: "Include working capital, opportunity costs, and after-tax terminal flows." },
    { section: "F", title: "IMA standards", formula: "Competence · Confidentiality · Integrity · Credibility", note: "Know both the standard and how it applies in a scenario." },
    { section: "F", title: "Ethical resolution", formula: "Policy → Appropriate management level → Objective adviser → Consider disassociation", note: "Preserve confidentiality unless disclosure is authorized or legally required." }
  ]);

  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function clean(value) { return typeof value === "string" ? value.trim() : ""; }
  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
  function shuffle(values, random = Math.random) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }
  function normalizeText(value) { return clean(String(value ?? "")).toLowerCase().replace(/[,\s]+/g, " ").trim(); }
  function responseIsEmpty(value) { return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0); }

  function normalizeOptions(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).map(([key, text]) => [clean(key).toUpperCase(), clean(text)]).filter(([key, text]) => OPTION_KEYS.includes(key) && text));
  }

  function normalizeCaseItem(raw, index, caseId) {
    const typeAliases = { single: "single-choice", choice: "single-choice", multiselect: "multi-select", number: "numeric", text: "short-text", select: "select-list" };
    const rawType = clean(raw?.type).toLowerCase();
    const type = ITEM_TYPES.includes(rawType) ? rawType : typeAliases[rawType] || rawType;
    const options = normalizeOptions(raw?.options);
    const correctAnswers = Array.isArray(raw?.correctAnswers) ? raw.correctAnswers.map((value) => clean(value).toUpperCase()).filter((value) => OPTION_KEYS.includes(value)) : [];
    const acceptedAnswers = Array.isArray(raw?.acceptedAnswers) ? raw.acceptedAnswers.map(clean).filter(Boolean) : [];
    return {
      id: clean(raw?.id) || `${caseId}-ITEM-${index + 1}`,
      type,
      prompt: clean(raw?.prompt),
      options,
      correctAnswer: type === "numeric" ? Number(raw?.correctAnswer) : clean(raw?.correctAnswer),
      correctAnswers,
      acceptedAnswers,
      tolerance: Math.max(0, Number(raw?.tolerance) || 0),
      points: Math.max(0.25, Number(raw?.points) || 1),
      explanation: clean(raw?.explanation) || "No explanation was supplied."
    };
  }

  function normalizeCase(raw, index = 0) {
    const id = clean(raw?.id) || `CASE-${String(index + 1).padStart(3, "0")}`;
    return {
      version: 1,
      id,
      title: clean(raw?.title),
      sectionIds: Array.isArray(raw?.sectionIds) ? Array.from(new Set(raw.sectionIds.map((value) => clean(value).toUpperCase()).filter((value) => BLUEPRINT.some((item) => item.id === value)))) : [],
      difficulty: clean(raw?.difficulty) || "CMA level",
      source: clean(raw?.source),
      scenario: clean(raw?.scenario),
      exhibits: Array.isArray(raw?.exhibits) ? raw.exhibits.map((item) => ({ title: clean(item?.title), content: clean(item?.content) })).filter((item) => item.title && item.content) : [],
      items: Array.isArray(raw?.items) ? raw.items.map((item, itemIndex) => normalizeCaseItem(item, itemIndex, id)) : []
    };
  }

  function validateCaseBank(input) {
    const rawCases = Array.isArray(input) ? input : Array.isArray(input?.cases) ? input.cases : null;
    if (!rawCases) return { valid: false, errors: ["Case JSON must be an array or an object with a cases array."], cases: [] };
    const cases = rawCases.map(normalizeCase);
    const errors = [];
    const caseIds = new Set();
    cases.forEach((caseSet, caseIndex) => {
      const label = `Case ${caseIndex + 1}`;
      if (!caseSet.id) errors.push(`${label}: ID is required.`);
      if (caseIds.has(caseSet.id)) errors.push(`${label}: duplicate case ID ${caseSet.id}.`);
      caseIds.add(caseSet.id);
      if (!caseSet.title) errors.push(`${label}: title is required.`);
      if (!caseSet.scenario) errors.push(`${label}: scenario is required.`);
      if (!caseSet.sectionIds.length) errors.push(`${label}: include at least one valid section ID A–F.`);
      if (!caseSet.items.length) errors.push(`${label}: include at least one scored item.`);
      const itemIds = new Set();
      caseSet.items.forEach((item, itemIndex) => {
        const itemLabel = `${label}, item ${itemIndex + 1}`;
        if (itemIds.has(item.id)) errors.push(`${itemLabel}: duplicate item ID ${item.id}.`);
        itemIds.add(item.id);
        if (!ITEM_TYPES.includes(item.type)) errors.push(`${itemLabel}: unsupported type ${item.type || "(missing)"}.`);
        if (!item.prompt) errors.push(`${itemLabel}: prompt is required.`);
        if (["single-choice", "multi-select", "select-list"].includes(item.type) && Object.keys(item.options).length < 2) errors.push(`${itemLabel}: at least two answer options are required.`);
        if (["single-choice", "select-list"].includes(item.type) && !Object.prototype.hasOwnProperty.call(item.options, clean(item.correctAnswer).toUpperCase())) errors.push(`${itemLabel}: correctAnswer must identify an available option.`);
        if (item.type === "multi-select" && (!item.correctAnswers.length || item.correctAnswers.some((key) => !Object.prototype.hasOwnProperty.call(item.options, key)))) errors.push(`${itemLabel}: correctAnswers must identify available options.`);
        if (item.type === "numeric" && !Number.isFinite(item.correctAnswer)) errors.push(`${itemLabel}: numeric correctAnswer is required.`);
        if (item.type === "short-text" && !item.acceptedAnswers.length && !clean(item.correctAnswer)) errors.push(`${itemLabel}: add acceptedAnswers or correctAnswer.`);
      });
    });
    return { valid: errors.length === 0, errors, cases };
  }

  function scoreCaseItem(item, response) {
    const points = Number(item.points) || 1;
    if (responseIsEmpty(response)) return { awardedPoints: 0, maxPoints: points, status: "Unanswered" };
    let ratio = 0;
    if (["single-choice", "select-list"].includes(item.type)) {
      ratio = clean(response).toUpperCase() === clean(item.correctAnswer).toUpperCase() ? 1 : 0;
    } else if (item.type === "numeric") {
      const value = Number(String(response).replace(/[$,%\s]/g, "").replace(/,/g, ""));
      ratio = Number.isFinite(value) && Math.abs(value - Number(item.correctAnswer)) <= Math.max(0, Number(item.tolerance) || 0) ? 1 : 0;
    } else if (item.type === "short-text") {
      const accepted = [...(item.acceptedAnswers || []), item.correctAnswer].map(normalizeText).filter(Boolean);
      ratio = accepted.includes(normalizeText(response)) ? 1 : 0;
    } else if (item.type === "multi-select") {
      const expected = new Set(item.correctAnswers || []);
      const selected = new Set((Array.isArray(response) ? response : [response]).map((value) => clean(value).toUpperCase()).filter(Boolean));
      const correctSelected = Array.from(selected).filter((key) => expected.has(key)).length;
      const wrongSelected = Array.from(selected).filter((key) => !expected.has(key)).length;
      ratio = expected.size ? clamp((correctSelected - wrongSelected) / expected.size, 0, 1) : 0;
    }
    const awardedPoints = Math.round(points * ratio * 100) / 100;
    return { awardedPoints, maxPoints: points, status: ratio === 1 ? "Correct" : ratio > 0 ? "Partial" : "Incorrect" };
  }

  function expectedAnswerText(item) {
    if (item.type === "multi-select") return item.correctAnswers.map((key) => `${key} — ${item.options[key]}`).join("; ");
    if (["single-choice", "select-list"].includes(item.type)) return `${item.correctAnswer} — ${item.options[item.correctAnswer]}`;
    if (item.type === "short-text") return item.correctAnswer || item.acceptedAnswers.join(" / ");
    return String(item.correctAnswer);
  }

  function responseText(item, response) {
    if (responseIsEmpty(response)) return "Not answered";
    if (item.type === "multi-select") return response.map((key) => `${key} — ${item.options[key] || ""}`).join("; ");
    if (["single-choice", "select-list"].includes(item.type)) return `${response} — ${item.options[response] || ""}`;
    return String(response);
  }

  function scoreCaseSet(caseSet, responses = {}) {
    const itemResults = caseSet.items.map((item) => {
      const response = responses[item.id];
      return { id: item.id, prompt: item.prompt, type: item.type, response: clone(response), expectedAnswer: expectedAnswerText(item), explanation: item.explanation, ...scoreCaseItem(item, response) };
    });
    const awardedPoints = itemResults.reduce((sum, item) => sum + item.awardedPoints, 0);
    const maxPoints = itemResults.reduce((sum, item) => sum + item.maxPoints, 0);
    return { caseId: caseSet.id, title: caseSet.title, awardedPoints, maxPoints, percentage: maxPoints ? (awardedPoints / maxPoints) * 100 : 0, itemResults };
  }

  function scoreCases(caseSets, responses = {}) {
    const caseResults = caseSets.map((caseSet) => scoreCaseSet(caseSet, responses[caseSet.id] || {}));
    const awardedPoints = caseResults.reduce((sum, item) => sum + item.awardedPoints, 0);
    const maxPoints = caseResults.reduce((sum, item) => sum + item.maxPoints, 0);
    return { awardedPoints, maxPoints, percentage: maxPoints ? (awardedPoints / maxPoints) * 100 : 0, caseResults };
  }

  function blueprintReadiness(questions = []) {
    const rows = BLUEPRINT.map((blueprint) => {
      const available = questions.filter((question) => clean(question.sectionId || question.section).replace(/^SECTION\s*/i, "").toUpperCase() === blueprint.id).length;
      return { ...blueprint, available, missing: Math.max(0, blueprint.count - available), ready: available >= blueprint.count };
    });
    return { rows, ready: rows.every((row) => row.ready), totalAvailable: rows.reduce((sum, row) => sum + row.available, 0), totalMissing: rows.reduce((sum, row) => sum + row.missing, 0) };
  }

  function selectBlueprintQuestions(questions = [], random = Math.random) {
    const readiness = blueprintReadiness(questions);
    if (!readiness.ready) return { valid: false, errors: readiness.rows.filter((row) => !row.ready).map((row) => `Section ${row.id} needs ${row.missing} more question${row.missing === 1 ? "" : "s"}.`), questions: [], readiness };
    const selected = readiness.rows.flatMap((row) => shuffle(questions.filter((question) => clean(question.sectionId || question.section).replace(/^SECTION\s*/i, "").toUpperCase() === row.id), random).slice(0, row.count));
    return { valid: true, errors: [], questions: shuffle(selected, random), readiness };
  }

  function questionSectionId(question) {
    return clean(question?.sectionId || question?.section).replace(/^SECTION\s*/i, "").toUpperCase();
  }

  function questionUnitKey(question) {
    return clean(question?.unitId) || `${questionSectionId(question)}::${clean(question?.unit)}`;
  }

  function selectCustomQuestions(questions = [], options = {}, random = Math.random) {
    const selectedSections = new Set(Array.from(options.selectedSections || []).map((value) => clean(value).toUpperCase()).filter(Boolean));
    const selectedUnits = new Set(Array.from(options.selectedUnits || []).map(clean).filter(Boolean));
    const count = Math.max(1, Number(options.count) || 100);
    const eligible = questions.filter((question) => selectedSections.has(questionSectionId(question)) && selectedUnits.has(questionUnitKey(question)));
    const errors = [];
    if (!selectedSections.size) errors.push("Select at least one section.");
    if (!selectedUnits.size) errors.push("Select at least one unit.");
    if (eligible.length < count) errors.push(`Selected coverage contains ${eligible.length} questions; ${count} are required.`);
    if (errors.length) return { valid: false, errors, eligible, questions: [] };
    if (options.balanced === false) return { valid: true, errors: [], eligible, questions: shuffle(eligible, random).slice(0, count) };

    let groups = Array.from(new Set(eligible.map(questionUnitKey))).map((unitKey) => ({ unitKey, questions: shuffle(eligible.filter((question) => questionUnitKey(question) === unitKey), random), index: 0 }));
    groups = shuffle(groups, random);
    const selected = [];
    while (selected.length < count) {
      let added = false;
      groups.forEach((group) => {
        if (selected.length >= count || group.index >= group.questions.length) return;
        selected.push(group.questions[group.index]);
        group.index += 1;
        added = true;
      });
      if (!added) break;
    }
    return { valid: selected.length === count, errors: selected.length === count ? [] : ["The selected units could not provide 100 unique questions."], eligible, questions: shuffle(selected, random) };
  }

  function combinedPracticeScore(mcqPercentage, casePercentage) {
    return (Number(mcqPercentage) || 0) * 0.75 + (Number(casePercentage) || 0) * 0.25;
  }

  function phaseSubmissionSummary(session) {
    if (!session || !["mcq", "cbq"].includes(session.phase)) return { answered: 0, unanswered: 0, marked: 0, total: 0 };
    if (session.phase === "mcq") {
      const questions = Array.isArray(session.mcqQuestions) ? session.mcqQuestions : [];
      const answered = questions.filter((question) => !responseIsEmpty(session.mcqAnswers?.[question.id])).length;
      const marked = questions.filter((question) => Boolean(session.mcqMarked?.[question.id])).length;
      return { answered, unanswered: questions.length - answered, marked, total: questions.length };
    }
    const caseSets = Array.isArray(session.caseSets) ? session.caseSets : [];
    const items = caseSets.flatMap((caseSet) => (caseSet.items || []).map((item) => ({ caseId: caseSet.id, itemId: item.id })));
    const answered = items.filter((item) => !responseIsEmpty(session.caseResponses?.[item.caseId]?.[item.itemId])).length;
    return { answered, unanswered: items.length - answered, marked: 0, total: items.length };
  }

  const TOOLS = Object.freeze({
    OPTION_KEYS,
    ITEM_TYPES,
    BLUEPRINT,
    DEMO_CASES,
    FORMULAS,
    normalizeCase,
    validateCaseBank,
    scoreCaseItem,
    scoreCaseSet,
    scoreCases,
    blueprintReadiness,
    selectBlueprintQuestions,
    questionSectionId,
    questionUnitKey,
    selectCustomQuestions,
    combinedPracticeScore,
    phaseSubmissionSummary,
    expectedAnswerText,
    responseText,
    shuffle
  });
  globalThis.CMACaseTools = TOOLS;

  if (globalThis.CMA_SIMULATOR_TEST_MODE || typeof document === "undefined") return;

  const STORAGE = globalThis.CMAStorage || null;
  const APP = globalThis.CMAExamSimulatorTestHooks || null;
  const STORAGE_KEYS = Object.freeze({
    bank: "cma-simulator-case-bank-v1",
    history: "cma-simulator-case-history-v1",
    active: "cma-simulator-active-case-session-v1"
  });
  const state = {
    caseBank: validateCaseBank(DEMO_CASES).cases,
    history: [],
    active: null,
    currentResult: null,
    timerId: null,
    confirmationPauseStartedAt: null,
    isSubmitting: false,
    examCenterTab: "practice",
    customCoverageInitialized: false,
    customSections: new Set(),
    customUnits: new Set()
  };
  const dom = {};

  function cacheDom() { document.querySelectorAll("[id]").forEach((element) => { dom[element.id] = element; }); }
  function createId(prefix) { return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`; }
  function formatDuration(milliseconds) {
    const seconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
    return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unknown date" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date); }
  function appState() { return APP?.getState?.() || { questionBank: [], history: [], analyticsSettings: { removeFastQuestions: true } }; }
  function isFourHourMode(value) { return value?.mode === "full" || value?.mode === "custom-full"; }
  function showScreen(name) {
    APP?.openScreen?.(name);
    document.body.classList.toggle("case-session-active", name === "case-exam");
    if (name !== "case-exam") stopTimer();
  }
  function makeElement(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = String(text); return element; }
  function addText(parent, tag, className, text) { const element = makeElement(tag, className, text); parent.append(element); return element; }
  function caseMessage(text, type = "success") { const box = dom["case-bank-message"]; box.textContent = text; box.className = `message message-${type}`; box.hidden = false; }
  function download(filename, value) { const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }

  async function readData() {
    if (!STORAGE) return;
    try {
      const [bank, history] = await Promise.all([STORAGE.get(STORAGE_KEYS.bank, null), STORAGE.get(STORAGE_KEYS.history, [])]);
      if (bank) {
        const validation = validateCaseBank(bank);
        if (validation.valid) state.caseBank = validation.cases;
      }
      state.history = Array.isArray(history) ? history.filter((item) => item && item.id && item.completedAt && item.caseResult) : [];
      let active = null;
      try { active = JSON.parse(localStorage.getItem(STORAGE_KEYS.active) || "null"); } catch (_error) {}
      if (active && ["full", "custom-full", "case-practice"].includes(active.mode) && ["mcq", "cbq"].includes(active.phase)) {
        active.status = "active";
        active.submitted = false;
        state.active = active;
      }
    } catch (error) { console.warn("CMA case data could not be fully loaded.", error); }
  }
  function saveBank() { STORAGE?.set(STORAGE_KEYS.bank, { version: 1, cases: state.caseBank }); }
  function saveHistory() { STORAGE?.set(STORAGE_KEYS.history, state.history); }
  function saveActive() { if (!state.active) return; try { localStorage.setItem(STORAGE_KEYS.active, JSON.stringify(state.active)); } catch (error) { console.warn("The active CMA simulation could not be saved for resume.", error); } }
  function removeActive() { try { localStorage.removeItem(STORAGE_KEYS.active); } catch (_error) {} }

  function renderHomeStatus() {
    if (!dom["home-case-count"]) return;
    dom["home-case-count"].textContent = state.caseBank.length;
    const readiness = blueprintReadiness(appState().questionBank);
    const text = readiness.ready && state.caseBank.length >= 2
      ? `Four-hour simulation ready · ${state.caseBank.length} case sets available`
      : `Four-hour readiness · ${readiness.totalMissing} blueprint MCQ${readiness.totalMissing === 1 ? "" : "s"} and ${Math.max(0, 2 - state.caseBank.length)} case set${Math.max(0, 2 - state.caseBank.length) === 1 ? "" : "s"} still needed`;
    dom["home-exam-readiness-text"].textContent = text;
  }

  function latestFullResults() { return state.history.filter((item) => isFourHourMode(item) && item.mcqResult); }
  function allCasePercentages() { return state.history.map((item) => Number(item.caseResult?.percentage)).filter(Number.isFinite); }
  function renderScoreCard(container, label, value, detail, primary = false) {
    const card = makeElement("article", `score-card${primary ? " primary" : ""}`);
    addText(card, "span", "", label); addText(card, "strong", "", value); addText(card, "small", "", detail); container.append(card);
  }

  function customCoverageStructure(questions = appState().questionBank) {
    return BLUEPRINT.map((blueprint) => {
      const sectionQuestions = questions.filter((question) => questionSectionId(question) === blueprint.id);
      const unitMap = new Map();
      sectionQuestions.forEach((question) => {
        const key = questionUnitKey(question);
        if (!unitMap.has(key)) unitMap.set(key, { key, sectionId: blueprint.id, unit: clean(question.unit) || key, unitName: clean(question.unitName), count: 0 });
        unitMap.get(key).count += 1;
      });
      const units = Array.from(unitMap.values()).sort((left, right) => (left.unit || left.key).localeCompare(right.unit || right.key, undefined, { numeric: true }));
      return { ...blueprint, available: sectionQuestions.length, units };
    });
  }

  function initializeCustomCoverage() {
    if (state.customCoverageInitialized) return;
    const structure = customCoverageStructure();
    state.customSections = new Set(structure.filter((section) => section.available > 0).map((section) => section.id));
    state.customUnits = new Set(structure.flatMap((section) => section.units.map((unit) => unit.key)));
    state.customCoverageInitialized = true;
  }

  function customCasePool() {
    const matchSelected = dom["custom-match-cases"].checked;
    if (!matchSelected) return state.caseBank.slice();
    return state.caseBank.filter((caseSet) => caseSet.sectionIds.some((sectionId) => state.customSections.has(sectionId)));
  }

  function customEligibility() {
    const questions = appState().questionBank;
    const eligible = questions.filter((question) => state.customSections.has(questionSectionId(question)) && state.customUnits.has(questionUnitKey(question)));
    const casePool = customCasePool();
    const errors = [];
    if (!state.customSections.size) errors.push("Select at least one section.");
    if (!state.customUnits.size) errors.push("Select at least one unit.");
    if (eligible.length < 100) errors.push(`${100 - eligible.length} more MCQ${100 - eligible.length === 1 ? " is" : "s are"} needed inside the selected coverage.`);
    if (casePool.length < 2) errors.push(`${2 - casePool.length} more matching case set${2 - casePool.length === 1 ? " is" : "s are"} needed, or turn off case matching.`);
    return { ready: errors.length === 0, errors, eligible, casePool };
  }

  function renderCustomCoverage() {
    initializeCustomCoverage();
    const structure = customCoverageStructure();
    const sectionContainer = dom["custom-coverage-sections"]; sectionContainer.replaceChildren();
    structure.forEach((section) => {
      const label = makeElement("label", `coverage-choice${section.available ? "" : " is-disabled"}`); const input = makeElement("input"); input.type = "checkbox"; input.dataset.customSection = section.id; input.checked = state.customSections.has(section.id); input.disabled = section.available === 0;
      const copy = makeElement("span"); addText(copy, "strong", "", `Section ${section.id} — ${section.name}`); addText(copy, "small", "", `${section.available} question${section.available === 1 ? "" : "s"}`); label.append(input, copy); sectionContainer.append(label);
    });

    const unitContainer = dom["custom-coverage-units"]; unitContainer.replaceChildren();
    const selectedSections = structure.filter((section) => state.customSections.has(section.id));
    selectedSections.forEach((section) => {
      const group = makeElement("section", "unit-group"); const heading = makeElement("div", "unit-group-heading"); addText(heading, "strong", "", `Section ${section.id} — ${section.name}`); group.append(heading);
      section.units.forEach((unit) => { const label = makeElement("label", "coverage-choice"); const input = makeElement("input"); input.type = "checkbox"; input.dataset.customUnit = unit.key; input.checked = state.customUnits.has(unit.key); const copy = makeElement("span"); addText(copy, "strong", "", unit.unitName ? `${unit.unit} — ${unit.unitName}` : unit.unit); addText(copy, "small", "", `${unit.count} question${unit.count === 1 ? "" : "s"}`); label.append(input, copy); group.append(label); });
      unitContainer.append(group);
    });
    if (!selectedSections.length) addText(unitContainer, "p", "muted-empty", "Select at least one section to choose units.");

    const eligibility = customEligibility();
    const status = dom["custom-full-status"];
    status.textContent = `${eligibility.eligible.length} eligible MCQs · ${eligibility.casePool.length} available case sets${eligibility.ready ? " · Ready to start" : ` · ${eligibility.errors.join(" ")}`}`;
    status.classList.toggle("is-empty", !eligibility.ready);
    const breakdown = dom["custom-full-breakdown"]; breakdown.replaceChildren();
    const selectedBySection = structure.map((section) => ({ ...section, selectedCount: eligibility.eligible.filter((question) => questionSectionId(question) === section.id).length })).filter((section) => state.customSections.has(section.id));
    if (selectedBySection.length) {
      addText(breakdown, "h3", "", "Selected coverage");
      const list = makeElement("ul"); selectedBySection.forEach((section) => addText(list, "li", "", `Section ${section.id} — ${section.selectedCount} eligible MCQs · ${section.units.filter((unit) => state.customUnits.has(unit.key)).length} units`)); breakdown.append(list);
    }
    dom["start-custom-full-exam"].disabled = !eligibility.ready || Boolean(state.active || appState().activeExam);
    return eligibility;
  }

  function renderExamCenter() {
    const questions = appState().questionBank;
    const readiness = blueprintReadiness(questions);
    dom["exam-center-case-count"].textContent = state.caseBank.length;
    const stats = dom["exam-readiness-cards"]; stats.replaceChildren();
    const recentFull = latestFullResults().slice(0, 3);
    const recentMcq = recentFull.length ? recentFull.reduce((sum, item) => sum + item.mcqResult.percentage, 0) / recentFull.length : null;
    const caseScores = allCasePercentages();
    const caseAverage = caseScores.length ? caseScores.reduce((sum, value) => sum + value, 0) / caseScores.length : null;
    renderScoreCard(stats, "Full-test readiness", readiness.ready && state.caseBank.length >= 2 ? "Ready" : "Building", readiness.ready ? "MCQ blueprint complete" : `${readiness.totalMissing} blueprint MCQs still needed`, true);
    renderScoreCard(stats, "Recent MCQ level", recentMcq === null ? "—" : `${recentMcq.toFixed(1)}%`, recentFull.length ? `Average of ${recentFull.length} full simulation${recentFull.length === 1 ? "" : "s"}` : "Complete a full simulation");
    renderScoreCard(stats, "Case performance", caseAverage === null ? "—" : `${caseAverage.toFixed(1)}%`, caseScores.length ? `${caseScores.length} scored session${caseScores.length === 1 ? "" : "s"}` : "Complete an independent case");
    renderScoreCard(stats, "Case bank", state.caseBank.length, state.caseBank.length >= 2 ? "Enough for a full simulation" : "At least two are required");

    const requirements = dom["full-exam-requirements"]; requirements.replaceChildren();
    const requirementRows = [
      { ok: readiness.ready, text: readiness.ready ? "Exact 100-question section blueprint is available." : `${readiness.totalMissing} additional section-matched MCQ${readiness.totalMissing === 1 ? " is" : "s are"} required.` },
      { ok: state.caseBank.length >= 2, text: state.caseBank.length >= 2 ? "At least two valid case sets are available." : `${2 - state.caseBank.length} additional case set${2 - state.caseBank.length === 1 ? " is" : "s are"} required.` },
      { ok: true, text: "Progress is saved locally after every response." }
    ];
    requirementRows.forEach((row) => { const item = makeElement("div", `requirement-item${row.ok ? "" : " missing"}`); addText(item, "i", "", row.ok ? "✓" : "!"); addText(item, "span", "", row.text); requirements.append(item); });
    const anotherExamIsActive = Boolean(state.active || appState().activeExam);
    dom["start-full-cma-exam"].disabled = !readiness.ready || state.caseBank.length < 2 || anotherExamIsActive;
    dom["start-case-practice"].disabled = !state.caseBank.length || anotherExamIsActive;

    const body = dom["blueprint-table-body"]; body.replaceChildren();
    readiness.rows.forEach((row) => { const tr = makeElement("tr", row.ready ? "" : "is-short"); [
      `Section ${row.id} — ${row.name}`, `${row.weight}%`, row.count, row.available
    ].forEach((value) => addText(tr, "td", "", value)); const status = makeElement("td"); addText(status, "span", `badge ${row.ready ? "ready" : "error"}`, row.ready ? "Ready" : `Need ${row.missing}`); tr.append(status); body.append(tr); });
    renderCustomCoverage(); renderCaseBank(); renderCaseHistory(); renderResume(); renderFormulaBoard(); renderHomeStatus(); renderExamCenterTabs();
  }

  function renderCaseBank() {
    const list = dom["case-bank-list"]; list.replaceChildren();
    const select = dom["case-practice-selection"];
    const selected = select.value;
    select.replaceChildren();
    [["random-one", "One random case · 30 minutes"], ["random-two", "Two random cases · 60 minutes"]].forEach(([value, label]) => { const option = makeElement("option", "", label); option.value = value; select.append(option); });
    state.caseBank.forEach((caseSet) => {
      const option = makeElement("option", "", `${caseSet.title} · 30 minutes`); option.value = `case:${caseSet.id}`; select.append(option);
      const card = makeElement("article", "case-bank-card"); const main = makeElement("div"); addText(main, "h3", "", caseSet.title); addText(main, "p", "", caseSet.scenario.length > 180 ? `${caseSet.scenario.slice(0, 180)}…` : caseSet.scenario); const meta = makeElement("div", "case-bank-meta"); addText(meta, "span", "badge ready", caseSet.sectionIds.map((id) => `Section ${id}`).join(" + ")); addText(meta, "span", "badge", `${caseSet.items.length} items`); addText(meta, "span", "badge", `${caseSet.items.reduce((sum, item) => sum + item.points, 0)} points`); main.append(meta); const actions = makeElement("div", "button-row"); const practice = makeElement("button", "button button-secondary", "Practice"); practice.type = "button"; practice.dataset.practiceCase = caseSet.id; const remove = makeElement("button", "button button-danger-quiet", "Delete"); remove.type = "button"; remove.dataset.deleteCase = caseSet.id; actions.append(practice, remove); card.append(main, actions); list.append(card);
    });
    if (!state.caseBank.length) addText(list, "p", "muted-empty", "No case sets are loaded. Restore the demonstrations or import case JSON.");
    select.value = Array.from(select.options).some((option) => option.value === selected) ? selected : "random-one";
  }

  function renderCaseHistory() {
    const list = dom["case-history-list"]; list.replaceChildren();
    state.history.slice(0, 20).forEach((result) => {
      const card = makeElement("article", "case-history-card"); const main = makeElement("div"); addText(main, "h3", "", result.title); const score = isFourHourMode(result) && result.gatewayPassed ? `${result.practicePercentage.toFixed(1)}% estimated combined` : isFourHourMode(result) ? `${result.mcqResult.percentage.toFixed(1)}% MCQ` : `${result.caseResult.percentage.toFixed(1)}% cases`; addText(main, "p", "", `${formatDate(result.completedAt)} · ${score}`); const button = makeElement("button", "button button-secondary", "View result"); button.type = "button"; button.dataset.viewCaseResult = result.id; card.append(main, button); list.append(card);
    });
    if (!state.history.length) addText(list, "p", "muted-empty", "No case or full-test attempts yet.");
    dom["clear-case-history"].disabled = !state.history.length;
  }

  function renderResume() {
    const banner = dom["case-resume-banner"]; banner.hidden = !state.active;
    if (!state.active) return;
    dom["case-resume-title"].textContent = state.active.title;
    dom["case-resume-details"].textContent = `${state.active.phase === "mcq" ? "MCQ section" : "Case-based section"} · ${formatDuration(state.active.phaseEndTime - Date.now())} remaining`;
  }

  function renderFormulaBoard() {
    const query = normalizeText(dom["formula-search"].value);
    const items = FORMULAS.filter((item) => !query || normalizeText(`${item.section} ${item.title} ${item.formula} ${item.note}`).includes(query));
    const board = dom["formula-board"]; board.replaceChildren();
    items.forEach((item) => { const card = makeElement("article", "formula-card"); addText(card, "h3", "", `Section ${item.section} · ${item.title}`); addText(card, "code", "", item.formula); addText(card, "p", "", item.note); board.append(card); });
    if (!items.length) addText(board, "p", "muted-empty", "No formula or decision rule matches that search.");
  }

  function renderExamCenterTabs() {
    const validTabs = new Set(["practice", "simulations", "case-bank", "resources"]);
    if (!validTabs.has(state.examCenterTab)) state.examCenterTab = "practice";
    document.querySelectorAll("[data-exam-center-pane]").forEach((pane) => { pane.hidden = pane.dataset.examCenterPane !== state.examCenterTab; });
    document.querySelectorAll("[data-exam-center-tab]").forEach((button) => {
      const selected = button.dataset.examCenterTab === state.examCenterTab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }

  function openExamCenter(tab = state.examCenterTab) { state.examCenterTab = tab; renderExamCenter(); showScreen("exam-center"); renderExamCenterTabs(); }
  function openHome() { document.body.classList.remove("case-session-active"); APP?.refreshHome?.(); showScreen("home"); renderHomeStatus(); }

  function buildFourHourSession({ idPrefix, title, mode, selectedQuestions, caseSets, coverage = null }) {
    if (selectedQuestions.length !== 100 || caseSets.length < 2) return null;
    const now = Date.now();
    const questions = selectedQuestions.map((question) => ({ ...clone(question), optionOrder: shuffle(OPTION_KEYS) }));
    return {
      version: 1, id: createId(idPrefix), title, mode, coverage: coverage ? clone(coverage) : null, phase: "mcq", status: "active", submitted: false, startedAt: now, phaseStartedAt: now, phaseEndTime: now + 180 * 60 * 1000,
      mcqQuestions: questions, mcqAnswers: {}, mcqMarked: {}, mcqTimesMs: Object.fromEntries(questions.map((question) => [question.id, 0])), mcqCurrentIndex: 0, mcqVisitStartedAt: now,
      caseSets: clone(caseSets.slice(0, 2)), caseResponses: {}, currentCaseIndex: 0, reviewEnabled: true
    };
  }

  function makeFullSession() {
    const selected = selectBlueprintQuestions(appState().questionBank);
    if (!selected.valid || state.caseBank.length < 2) return null;
    return buildFourHourSession({ idPrefix: "full-cma", title: "CMA Part 2 — Full 4-Hour Simulation", mode: "full", selectedQuestions: selected.questions, caseSets: shuffle(state.caseBank).slice(0, 2) });
  }

  function makeCustomFullSession() {
    const eligibility = customEligibility();
    if (!eligibility.ready) return null;
    const selection = selectCustomQuestions(appState().questionBank, { selectedSections: state.customSections, selectedUnits: state.customUnits, count: 100, balanced: dom["custom-balance-units"].checked });
    if (!selection.valid) return null;
    const sections = Array.from(state.customSections).sort();
    return buildFourHourSession({
      idPrefix: "custom-full-cma",
      title: `Custom 4-Hour Simulation — Section${sections.length === 1 ? "" : "s"} ${sections.join(", ")}`,
      mode: "custom-full",
      selectedQuestions: selection.questions,
      caseSets: shuffle(eligibility.casePool).slice(0, 2),
      coverage: { selectedSections: sections, selectedUnits: Array.from(state.customUnits), eligibleQuestionCount: eligibility.eligible.length, balancedUnits: dom["custom-balance-units"].checked, matchedCases: dom["custom-match-cases"].checked }
    });
  }

  function makeCasePractice(caseIds) {
    const caseSets = caseIds.map((id) => state.caseBank.find((item) => item.id === id)).filter(Boolean);
    if (!caseSets.length) return null;
    const now = Date.now();
    return { version: 1, id: createId("case-practice"), title: caseSets.length === 1 ? caseSets[0].title : "CMA Part 2 — Two-Case Practice", mode: "case-practice", phase: "cbq", status: "active", submitted: false, startedAt: now, phaseStartedAt: now, phaseEndTime: now + caseSets.length * 30 * 60 * 1000, mcqQuestions: [], mcqAnswers: {}, mcqMarked: {}, mcqTimesMs: {}, caseSets: clone(caseSets), caseResponses: {}, currentCaseIndex: 0, reviewEnabled: dom["case-practice-review"].checked };
  }

  function beginSession(session) { if (appState().activeExam) { window.alert("Finish or discard the saved MCQ practice exam before starting a case or full simulation."); return; } if (!session) return; state.active = session; saveActive(); enterActiveSession(); }
  function enterActiveSession() { if (!state.active) return openExamCenter(); state.active.status = "active"; state.active.submitted = false; saveActive(); showScreen("case-exam"); renderActivePhase(); startTimer(); }

  function commitMcqTime(now = Date.now()) {
    const session = state.active; if (!session || session.phase !== "mcq") return;
    const question = session.mcqQuestions[session.mcqCurrentIndex]; if (!question || !Number.isFinite(session.mcqVisitStartedAt)) return;
    const capped = Math.min(Math.max(now, session.mcqVisitStartedAt), session.phaseEndTime);
    session.mcqTimesMs[question.id] = Math.max(0, Number(session.mcqTimesMs[question.id]) || 0) + Math.max(0, capped - session.mcqVisitStartedAt);
    session.mcqVisitStartedAt = capped;
  }

  function renderActivePhase() {
    const session = state.active; if (!session) return;
    dom["case-exam-title"].textContent = session.title;
    const mcq = session.phase === "mcq";
    dom["full-mcq-pane"].hidden = !mcq; dom["cbq-pane"].hidden = mcq;
    dom["case-exam-phase"].textContent = mcq ? `Phase 1 · Multiple-choice questions${session.mode === "custom-full" ? " · Custom coverage" : ""}` : isFourHourMode(session) ? "Phase 2 · Case-based questions" : "Independent case practice";
    dom["case-exam-submit"].textContent = mcq ? "Submit MCQ phase" : "Submit case phase";
    if (mcq) renderFullMcq(); else renderCaseSet();
    updatePhaseHeader();
  }

  function renderFullMcq() {
    const session = state.active; const question = session?.mcqQuestions[session.mcqCurrentIndex]; if (!question) return;
    dom["full-mcq-section"].textContent = `Section ${question.section || question.sectionId}`;
    dom["full-mcq-unit"].textContent = `${question.unit || ""}${question.unitName ? ` · ${question.unitName}` : ""}`;
    dom["full-mcq-number"].textContent = `Question ${session.mcqCurrentIndex + 1} of 100`;
    dom["full-mcq-text"].textContent = question.question;
    const list = dom["full-mcq-options"]; list.replaceChildren();
    question.optionOrder.forEach((originalKey, displayIndex) => { const displayKey = OPTION_KEYS[displayIndex]; const label = makeElement("label", "answer-card"); const input = makeElement("input"); input.type = "radio"; input.name = "full-mcq-answer"; input.value = originalKey; input.checked = session.mcqAnswers[question.id] === originalKey; const letter = makeElement("span", "answer-letter", displayKey); const text = makeElement("span", "answer-text", question.options[originalKey]); label.append(input, letter, text); list.append(label); });
    dom["full-mcq-mark"].textContent = session.mcqMarked[question.id] ? "Remove Flag" : "Flag for Review";
    dom["full-mcq-mark"].setAttribute("aria-pressed", String(Boolean(session.mcqMarked[question.id])));
    dom["full-mcq-previous"].disabled = session.mcqCurrentIndex === 0;
    dom["full-mcq-next"].disabled = false;
    dom["full-mcq-next"].textContent = session.mcqCurrentIndex === session.mcqQuestions.length - 1 ? "Review MCQs" : "Next";
    const nav = dom["full-mcq-navigator"]; nav.replaceChildren();
    session.mcqQuestions.forEach((item, index) => { const button = makeElement("button", "", index + 1); button.type = "button"; button.dataset.fullMcqIndex = index; const answered = Boolean(session.mcqAnswers[item.id]); const marked = Boolean(session.mcqMarked[item.id]); button.className = [index === session.mcqCurrentIndex ? "current" : "", answered ? "answered" : "unanswered", marked ? "marked" : ""].filter(Boolean).join(" "); if (index === session.mcqCurrentIndex) button.setAttribute("aria-current", "step"); nav.append(button); });
  }

  function navigateMcq(index) {
    const session = state.active; if (!session || session.phase !== "mcq" || index < 0 || index >= session.mcqQuestions.length || index === session.mcqCurrentIndex) return;
    const now = Date.now(); commitMcqTime(now); session.mcqCurrentIndex = index; session.mcqVisitStartedAt = now; saveActive(); renderFullMcq(); updatePhaseHeader();
  }

  function handleFullMcqNext() {
    const session = state.active;
    if (!session || session.phase !== "mcq") return;
    if (session.mcqCurrentIndex < session.mcqQuestions.length - 1) return navigateMcq(session.mcqCurrentIndex + 1);
    const reviewIndex = session.mcqQuestions.findIndex((question) => session.mcqMarked[question.id] || !session.mcqAnswers[question.id]);
    if (reviewIndex >= 0 && reviewIndex !== session.mcqCurrentIndex) navigateMcq(reviewIndex);
    else {
      dom["full-mcq-navigator"].scrollIntoView({ behavior: "smooth", block: "center" });
      dom["case-exam-submit"].focus({ preventScroll: true });
    }
  }

  function renderCaseSet() {
    const session = state.active; const caseSet = session?.caseSets[session.currentCaseIndex]; if (!caseSet) return;
    dom["cbq-section"].textContent = caseSet.sectionIds.map((id) => `Section ${id}`).join(" + "); dom["cbq-difficulty"].textContent = caseSet.difficulty;
    dom["cbq-number"].textContent = `Case set ${session.currentCaseIndex + 1} of ${session.caseSets.length}`; dom["cbq-title"].textContent = caseSet.title; dom["cbq-scenario"].textContent = caseSet.scenario;
    const exhibits = dom["cbq-exhibits"]; exhibits.replaceChildren();
    caseSet.exhibits.forEach((exhibit) => { const card = makeElement("section", "cbq-exhibit"); addText(card, "h3", "", exhibit.title); addText(card, "p", "", exhibit.content); exhibits.append(card); });
    const items = dom["cbq-items"]; items.replaceChildren();
    caseSet.items.forEach((item, index) => renderCaseItem(items, caseSet, item, index));
    dom["cbq-previous"].disabled = session.currentCaseIndex === 0;
    dom["cbq-next"].disabled = session.currentCaseIndex === session.caseSets.length - 1;
    const nav = dom["cbq-navigator"]; nav.replaceChildren(); session.caseSets.forEach((item, index) => { const button = makeElement("button", "", `Case ${index + 1}`); button.type = "button"; button.dataset.caseIndex = index; if (index === session.currentCaseIndex) button.setAttribute("aria-current", "step"); nav.append(button); });
  }

  function renderCaseItem(container, caseSet, item, index) {
    const wrapper = makeElement("fieldset", "cbq-item"); const legend = makeElement("legend"); addText(legend, "span", "cbq-item-number", index + 1); legend.append(document.createTextNode(`${item.prompt} (${item.points} point${item.points === 1 ? "" : "s"})`)); wrapper.append(legend);
    const current = state.active.caseResponses[caseSet.id]?.[item.id];
    if (["single-choice", "multi-select"].includes(item.type)) {
      const choices = makeElement("div", "cbq-choice-list"); Object.entries(item.options).forEach(([key, text]) => { const label = makeElement("label", "cbq-choice"); const input = makeElement("input"); input.type = item.type === "multi-select" ? "checkbox" : "radio"; input.name = `cbq-${caseSet.id}-${item.id}`; input.value = key; input.dataset.caseId = caseSet.id; input.dataset.itemId = item.id; input.dataset.itemType = item.type; input.checked = item.type === "multi-select" ? Array.isArray(current) && current.includes(key) : current === key; label.append(input, document.createTextNode(`${key}. ${text}`)); choices.append(label); }); wrapper.append(choices);
    } else if (item.type === "select-list") {
      const select = makeElement("select"); select.dataset.caseId = caseSet.id; select.dataset.itemId = item.id; select.dataset.itemType = item.type; const blank = makeElement("option", "", "Choose an answer"); blank.value = ""; select.append(blank); Object.entries(item.options).forEach(([key, text]) => { const option = makeElement("option", "", `${key}. ${text}`); option.value = key; select.append(option); }); select.value = current || ""; wrapper.append(select);
    } else {
      const input = makeElement("input"); input.type = item.type === "numeric" ? "number" : "text"; if (item.type === "numeric") input.step = "any"; input.value = current ?? ""; input.placeholder = item.type === "numeric" ? "Enter the numeric answer" : "Enter the term or short answer"; input.dataset.caseId = caseSet.id; input.dataset.itemId = item.id; input.dataset.itemType = item.type; wrapper.append(input);
    }
    container.append(wrapper);
  }

  function updatePhaseHeader(now = Date.now()) {
    const session = state.active; if (!session) return;
    if (session.phase === "mcq") dom["case-exam-progress"].textContent = `${session.mcqCurrentIndex + 1} of 100 · ${Object.keys(session.mcqAnswers).length} answered`;
    else { const caseSet = session.caseSets[session.currentCaseIndex]; const answered = Object.values(session.caseResponses[caseSet.id] || {}).filter((value) => !responseIsEmpty(value)).length; dom["case-exam-progress"].textContent = `Case ${session.currentCaseIndex + 1} of ${session.caseSets.length} · ${answered}/${caseSet.items.length} answered`; }
    const remaining = Math.max(0, session.phaseEndTime - now); dom["case-overall-timer"].textContent = formatDuration(remaining); dom["case-overall-timer-card"].classList.toggle("warning", remaining <= 300000 && remaining > 60000); dom["case-overall-timer-card"].classList.toggle("critical", remaining <= 60000);
  }

  function startTimer() {
    stopTimer(); const tick = () => { const session = state.active; if (!session) return stopTimer(); const now = Date.now(); updatePhaseHeader(now); if (now >= session.phaseEndTime) { if (session.phase === "mcq") submitMcqPhase(true); else finalizeSession("Case time expired"); } }; state.timerId = setInterval(tick, 250); tick();
  }
  function stopTimer() { if (state.timerId !== null) { clearInterval(state.timerId); state.timerId = null; } }

  function scoreMcqSession(session) {
    const results = session.mcqQuestions.map((question, index) => { const userAnswer = session.mcqAnswers[question.id] || null; const status = !userAnswer ? "Unanswered" : userAnswer === question.correctAnswer ? "Correct" : "Incorrect"; return { number: index + 1, id: question.id, section: question.section || question.sectionId, unit: question.unit, unitName: question.unitName, question: question.question, options: clone(question.options), optionOrder: question.optionOrder.slice(), correctAnswer: question.correctAnswer, userAnswer, explanation: question.explanation || "No explanation was provided.", status, marked: Boolean(session.mcqMarked[question.id]), timeMs: Number(session.mcqTimesMs[question.id]) || 0 }; });
    const correct = results.filter((item) => item.status === "Correct").length; const incorrect = results.filter((item) => item.status === "Incorrect").length; const unanswered = results.length - correct - incorrect;
    return { correct, incorrect, unanswered, totalQuestions: results.length, percentage: results.length ? (correct / results.length) * 100 : 0, perQuestion: results, timeUsedMs: Math.min(180 * 60 * 1000, Math.max(0, (session.mcqSubmittedAt || Date.now()) - session.phaseStartedAt)) };
  }

  function resetCaseSubmissionUi() {
    state.isSubmitting = false;
    state.confirmationPauseStartedAt = null;
    dom["confirm-case-submit"].disabled = false;
    dom["confirm-case-submit"].textContent = "Submit phase";
  }

  function requestPhaseSubmission() {
    const session = state.active;
    if (!session || session.submitted || session.status !== "active" || state.isSubmitting) return;
    const now = Date.now();
    if (now >= session.phaseEndTime) {
      if (session.phase === "mcq") submitMcqPhase(true);
      else finalizeSession("Case time expired", session.phaseEndTime);
      return;
    }
    if (session.phase === "mcq") commitMcqTime(now);
    session.status = "confirming";
    state.confirmationPauseStartedAt = now;
    stopTimer();
    saveActive();
    const summary = phaseSubmissionSummary(session);
    dom["case-submit-eyebrow"].textContent = session.phase === "mcq" ? "MCQ phase review" : "Case phase review";
    dom["case-submit-title"].textContent = session.phase === "mcq" ? "Submit the MCQ phase?" : "Submit the case phase?";
    dom["case-submit-message"].textContent = session.phase === "mcq"
      ? "You cannot return to these questions after submission. The case phase opens only if you reach the 50% gateway."
      : "This completes the attempt. Unanswered items receive no credit.";
    dom["case-submit-answered"].textContent = summary.answered;
    dom["case-submit-unanswered"].textContent = summary.unanswered;
    dom["case-submit-marked"].textContent = summary.marked;
    dom["confirm-case-submit"].disabled = false;
    dom["confirm-case-submit"].textContent = "Submit phase";
    if (typeof dom["case-submit-dialog"].showModal === "function") {
      try {
        if (!dom["case-submit-dialog"].open) dom["case-submit-dialog"].showModal();
        return;
      } catch (error) { console.warn("CMA simulation: the phase review dialog could not open.", error); }
    }
    if (window.confirm(dom["case-submit-message"].textContent)) confirmCaseSubmission();
    else resumeCaseSubmission();
  }

  function resumeCaseSubmission() {
    const session = state.active;
    if (!session || session.submitted || session.status !== "confirming" || state.isSubmitting) return;
    if (dom["case-submit-dialog"].open) dom["case-submit-dialog"].close();
    const now = Date.now();
    const pausedAt = Number.isFinite(state.confirmationPauseStartedAt) ? state.confirmationPauseStartedAt : now;
    session.phaseEndTime += Math.max(0, now - pausedAt);
    session.status = "active";
    if (session.phase === "mcq") session.mcqVisitStartedAt = now;
    resetCaseSubmissionUi();
    saveActive();
    updatePhaseHeader(now);
    startTimer();
  }

  function confirmCaseSubmission() {
    const session = state.active;
    if (!session || session.submitted || session.status !== "confirming" || state.isSubmitting) return;
    state.isSubmitting = true;
    dom["confirm-case-submit"].disabled = true;
    dom["confirm-case-submit"].textContent = "Submitting…";
    const submittedAt = Number.isFinite(state.confirmationPauseStartedAt) ? state.confirmationPauseStartedAt : Date.now();
    if (dom["case-submit-dialog"].open) dom["case-submit-dialog"].close();
    session.status = "active";
    if (session.phase === "mcq") submitMcqPhase(false, submittedAt);
    else finalizeSession("Submitted manually", submittedAt);
  }

  function submitMcqPhase(automatic = false, submittedAt = null) {
    const session = state.active; if (!session || session.phase !== "mcq" || session.submitted) return;
    state.isSubmitting = true;
    const now = automatic ? session.phaseEndTime : Number.isFinite(submittedAt) ? submittedAt : Date.now();
    commitMcqTime(now); session.mcqSubmittedAt = now; session.mcqResult = scoreMcqSession(session);
    const fastRemovalEnabled = appState().analyticsSettings?.removeFastQuestions !== false;
    const fastRemoval = APP?.removeFastQuestionsFromBank?.(session.mcqResult.perQuestion, { enabled: fastRemovalEnabled, thresholdSeconds: 30 }) || { count: 0, ids: [], saved: true };
    session.mcqResult.fastQuestionRemovalEnabled = fastRemovalEnabled;
    session.mcqResult.fastQuestionRemovalThresholdSeconds = 30;
    session.mcqResult.questionsRemovedUnder30Seconds = fastRemoval.count;
    session.mcqResult.removedFastQuestionIds = fastRemoval.ids;
    session.mcqResult.fastQuestionRemovalSaved = fastRemoval.saved;
    session.gatewayPassed = session.mcqResult.percentage >= 50;
    if (!session.gatewayPassed) return finalizeSession("MCQ gateway not reached", now);
    const phaseStartedAt = Date.now();
    session.phase = "cbq"; session.status = "active"; session.phaseStartedAt = phaseStartedAt; session.phaseEndTime = phaseStartedAt + 60 * 60 * 1000; session.currentCaseIndex = 0;
    resetCaseSubmissionUi();
    saveActive(); showScreen("case-exam"); renderActivePhase(); startTimer();
  }

  function finalizeSession(reason = "Submitted manually", completedAt = Date.now()) {
    const session = state.active; if (!session || session.submitted) return;
    if (session.phase === "mcq" && !session.mcqResult) return submitMcqPhase(reason.includes("expired"), completedAt);
    session.submitted = true;
    session.status = "submitted";
    stopTimer(); const caseResult = session.gatewayPassed === false ? { awardedPoints: 0, maxPoints: 0, percentage: 0, caseResults: [] } : scoreCases(session.caseSets, session.caseResponses);
    const result = {
      version: 1, id: session.id, title: session.title, mode: session.mode, coverage: session.coverage ? clone(session.coverage) : null, completedAt: new Date(completedAt).toISOString(), reason, gatewayPassed: isFourHourMode(session) ? Boolean(session.gatewayPassed) : true,
      mcqResult: session.mcqResult || null, caseResult, practicePercentage: isFourHourMode(session) && session.gatewayPassed ? combinedPracticeScore(session.mcqResult.percentage, caseResult.percentage) : session.mode === "case-practice" ? caseResult.percentage : session.mcqResult?.percentage || 0,
      caseSets: clone(session.caseSets), reviewEnabled: session.reviewEnabled !== false
    };
    state.currentResult = result; state.history = [result, ...state.history.filter((item) => item.id !== result.id)]; saveHistory(); state.active = null; removeActive(); document.body.classList.remove("case-session-active"); showScreen("case-results");
    try { renderCaseResult(result); renderHomeStatus(); }
    catch (error) {
      console.error("CMA simulation: the attempt was saved, but part of the result could not render.", error);
      dom["case-results-title"].textContent = result.title;
      dom["case-results-reason"].textContent = reason;
      dom["case-results-subtitle"].textContent = "The completed attempt was saved. Reopen it from Exam Center history to retry the detailed view.";
    } finally { resetCaseSubmissionUi(); }
  }

  function addResultCard(container, label, value, detail, primary = false) { renderScoreCard(container, label, value, detail, primary); }
  function renderCaseResult(result) {
    state.currentResult = result; dom["case-results-title"].textContent = result.title; dom["case-results-reason"].textContent = result.reason; dom["case-results-subtitle"].textContent = `Completed ${formatDate(result.completedAt)} · Practice scoring only`;
    const missedMcqs = result.mcqResult?.perQuestion?.filter((item) => item.status !== "Correct") || [];
    const fourHour = isFourHourMode(result);
    dom["case-results-retest-mcq"].hidden = !fourHour || missedMcqs.length === 0;
    const cards = dom["case-result-score-cards"]; cards.replaceChildren();
    if (fourHour) {
      addResultCard(cards, result.gatewayPassed ? "Estimated combined" : "MCQ accuracy", `${result.practicePercentage.toFixed(1)}%`, result.gatewayPassed ? "75% MCQ + 25% CBQ practice weighting" : "Case section was not unlocked", true);
      addResultCard(cards, "MCQ score", `${result.mcqResult.correct}/100`, `${result.mcqResult.percentage.toFixed(1)}% accuracy`);
      addResultCard(cards, "MCQ gateway", result.gatewayPassed ? "Reached" : "Not reached", "At least 50 correct required in this simulator");
      addResultCard(cards, "Fast questions deleted", Number(result.mcqResult.questionsRemovedUnder30Seconds) || 0, "Answered in under 30 seconds; result snapshots retained");
      if (result.mode === "custom-full") addResultCard(cards, "Coverage", `Sections ${(result.coverage?.selectedSections || []).join(", ")}`, "Custom practice — not the official blueprint");
    } else addResultCard(cards, "Case score", `${result.caseResult.awardedPoints}/${result.caseResult.maxPoints}`, `${result.caseResult.percentage.toFixed(1)}%`, true);
    addResultCard(cards, "Case accuracy", result.gatewayPassed ? `${result.caseResult.percentage.toFixed(1)}%` : "—", result.gatewayPassed ? `${result.caseResult.awardedPoints} of ${result.caseResult.maxPoints} practice points` : "No case attempt");
    addResultCard(cards, "Case sets", result.gatewayPassed ? result.caseResult.caseResults.length : 0, result.gatewayPassed ? "Completed and scored" : "Locked by gateway");

    const gateway = dom["case-gateway-panel"]; gateway.hidden = !fourHour; gateway.className = `panel gateway-panel${result.gatewayPassed ? " gateway-pass" : ""}`; gateway.replaceChildren();
    if (fourHour) { addText(gateway, "h2", "", result.gatewayPassed ? "MCQ gateway reached" : "MCQ gateway not reached"); addText(gateway, "p", "", result.gatewayPassed ? `The two case sets were unlocked.${result.mode === "custom-full" ? " This attempt used your custom sections and units, not the official section blueprint." : ""} The displayed combined percentage is an unofficial study estimate; IMA reports a scaled overall score.` : "The simulated exam ended after the MCQ phase because fewer than 50% of MCQs were correct. Build speed and accuracy before attempting another full simulation."); }

    const breakdown = dom["case-result-breakdown"]; breakdown.replaceChildren();
    const items = fourHour ? [["MCQ correct", `${result.mcqResult.correct}/100`], ["MCQ incorrect", result.mcqResult.incorrect], ["MCQ unanswered", result.mcqResult.unanswered], ["Under-30s deleted", Number(result.mcqResult.questionsRemovedUnder30Seconds) || 0], ["MCQ time", formatDuration(result.mcqResult.timeUsedMs)], ["Case points", result.gatewayPassed ? `${result.caseResult.awardedPoints}/${result.caseResult.maxPoints}` : "Locked"], ["Case score", result.gatewayPassed ? `${result.caseResult.percentage.toFixed(1)}%` : "—"]] : [["Case points", `${result.caseResult.awardedPoints}/${result.caseResult.maxPoints}`], ["Case score", `${result.caseResult.percentage.toFixed(1)}%`], ["Sets completed", result.caseResult.caseResults.length]];
    items.forEach(([label, value]) => { const item = makeElement("div", "analysis-item"); addText(item, "span", "", label); addText(item, "strong", "", value); breakdown.append(item); });
    dom["full-mcq-review-panel"].hidden = !fourHour;
    if (fourHour) renderFullMcqReview();
    renderCaseReview(result);
  }

  function mcqDisplayAnswer(item, originalKey) {
    if (!originalKey) return "Not answered";
    const position = Array.isArray(item.optionOrder) ? item.optionOrder.indexOf(originalKey) : OPTION_KEYS.indexOf(originalKey);
    const displayKey = position >= 0 ? OPTION_KEYS[position] : originalKey;
    return `${displayKey} — ${item.options[originalKey] || ""}`;
  }

  function renderFullMcqReview() {
    const result = state.currentResult; const container = dom["full-mcq-result-review"]; container.replaceChildren();
    if (!result?.mcqResult) return;
    const filter = dom["full-mcq-review-filter"].value;
    let questions = result.mcqResult.perQuestion.slice();
    if (filter === "missed") questions = questions.filter((item) => item.status !== "Correct");
    if (filter === "correct") questions = questions.filter((item) => item.status === "Correct");
    if (filter === "marked") questions = questions.filter((item) => item.marked);
    questions.forEach((item) => {
      const details = makeElement("details", "case-review-set mcq-review-set");
      const summary = makeElement("summary", "", `Question ${item.number} · ${item.status} · Section ${item.section}${item.marked ? " · Marked" : ""}`);
      const content = makeElement("div", "case-review-content"); addText(content, "strong", "", item.question);
      const answer = makeElement("article", `case-review-item ${item.status === "Correct" ? "correct" : "incorrect"}`);
      addText(answer, "p", "", `Your answer: ${mcqDisplayAnswer(item, item.userAnswer)}`);
      addText(answer, "p", "", `Correct answer: ${mcqDisplayAnswer(item, item.correctAnswer)}`);
      addText(answer, "small", "", `Time: ${formatDuration(item.timeMs)}`);
      addText(answer, "p", "", item.explanation);
      content.append(answer); details.append(summary, content); container.append(details);
    });
    if (!questions.length) addText(container, "p", "muted-empty", "No questions match this review filter.");
  }

  function renderCaseReview(result) {
    const review = dom["case-result-review"]; review.replaceChildren();
    if (!result.gatewayPassed) { addText(review, "p", "muted-empty", "No case responses are available because the gateway was not reached."); return; }
    result.caseResult.caseResults.forEach((caseResult) => { const details = makeElement("details", "case-review-set"); details.open = result.caseResult.caseResults.length === 1; const summary = makeElement("summary", "", `${caseResult.title} · ${caseResult.awardedPoints}/${caseResult.maxPoints} points (${caseResult.percentage.toFixed(1)}%)`); const content = makeElement("div", "case-review-content"); const caseSet = result.caseSets.find((item) => item.id === caseResult.caseId); caseResult.itemResults.forEach((itemResult) => { const item = caseSet?.items.find((candidate) => candidate.id === itemResult.id); const card = makeElement("article", `case-review-item ${itemResult.status === "Correct" ? "correct" : "incorrect"}`); addText(card, "strong", "", `${itemResult.status} · ${itemResult.awardedPoints}/${itemResult.maxPoints} points`); addText(card, "p", "", itemResult.prompt); addText(card, "small", "", `Your response: ${responseText(item || { type: "short-text" }, itemResult.response)}`); addText(card, "small", "", `Expected: ${itemResult.expectedAnswer}`); if (result.reviewEnabled) addText(card, "p", "", itemResult.explanation); content.append(card); }); details.append(summary, content); review.append(details); });
  }

  function startCaseByIds(ids) { if (state.active) return; beginSession(makeCasePractice(ids)); }
  function startSelectedCasePractice() {
    const selection = dom["case-practice-selection"].value; let ids;
    if (selection.startsWith("case:")) ids = [selection.slice(5)];
    else ids = shuffle(state.caseBank).slice(0, selection === "random-two" ? 2 : 1).map((item) => item.id);
    startCaseByIds(ids);
  }

  async function importCases(value) {
    const validation = validateCaseBank(value); if (!validation.valid) { caseMessage(validation.errors.slice(0, 12).join(" "), "error"); return false; }
    const incoming = new Map(validation.cases.map((item) => [item.id, item])); const replaced = state.caseBank.filter((item) => incoming.has(item.id)).length;
    state.caseBank = [...state.caseBank.filter((item) => !incoming.has(item.id)), ...validation.cases]; saveBank(); renderExamCenter(); caseMessage(`${validation.cases.length} case set${validation.cases.length === 1 ? "" : "s"} imported; ${replaced} existing ID${replaced === 1 ? " was" : "s were"} replaced.`, "success"); return true;
  }

  async function handleCaseFile(event) { const file = event.target.files?.[0]; if (!file) return; try { await importCases(JSON.parse(await file.text())); } catch (error) { caseMessage(`Cases were not imported: ${error.message}`, "error"); } finally { event.target.value = ""; } }

  function backupSnapshot() { return { version: 1, cases: clone(state.caseBank), history: clone(state.history) }; }
  async function restoreBackup(snapshot) {
    if (!snapshot) return { restored: false };
    const validation = validateCaseBank(snapshot.cases || []); if (!validation.valid) throw new Error(`Case backup: ${validation.errors.join(" ")}`);
    state.caseBank = validation.cases; state.history = Array.isArray(snapshot.history) ? snapshot.history : []; saveBank(); saveHistory(); renderHomeStatus(); return { restored: true };
  }

  function bindEvents() {
    dom["home-exam-center"].addEventListener("click", () => openExamCenter("practice")); dom["home-full-exam"].addEventListener("click", () => openExamCenter("simulations")); dom["home-case-practice"].addEventListener("click", () => openExamCenter("simulations")); dom["exam-center-back"].addEventListener("click", openHome);
    document.querySelectorAll("[data-exam-center-tab]").forEach((button) => button.addEventListener("click", () => { state.examCenterTab = button.dataset.examCenterTab; renderExamCenterTabs(); window.scrollTo(0, 0); }));
    dom["start-full-cma-exam"].addEventListener("click", () => { if (window.confirm("Start the strict four-hour simulation now? The MCQ timer begins immediately and the selected 100 questions cannot be changed.")) beginSession(makeFullSession()); });
    dom["start-custom-full-exam"].addEventListener("click", () => { if (window.confirm("Start this custom four-hour simulation now? It uses your selected sections and units, not the official section blueprint, and the three-hour MCQ timer begins immediately.")) beginSession(makeCustomFullSession()); });
    dom["start-case-practice"].addEventListener("click", startSelectedCasePractice);
    dom["custom-coverage-sections"].addEventListener("change", (event) => {
      const input = event.target.closest("[data-custom-section]"); if (!input) return;
      const section = customCoverageStructure().find((item) => item.id === input.dataset.customSection);
      if (input.checked) { state.customSections.add(input.dataset.customSection); section?.units.forEach((unit) => state.customUnits.add(unit.key)); }
      else { state.customSections.delete(input.dataset.customSection); section?.units.forEach((unit) => state.customUnits.delete(unit.key)); }
      renderCustomCoverage();
    });
    dom["custom-coverage-units"].addEventListener("change", (event) => { const input = event.target.closest("[data-custom-unit]"); if (!input) return; if (input.checked) state.customUnits.add(input.dataset.customUnit); else state.customUnits.delete(input.dataset.customUnit); renderCustomCoverage(); });
    dom["custom-select-all-sections"].addEventListener("click", () => { const structure = customCoverageStructure(); state.customSections = new Set(structure.filter((section) => section.available > 0).map((section) => section.id)); state.customUnits = new Set(structure.flatMap((section) => section.units.map((unit) => unit.key))); renderCustomCoverage(); });
    dom["custom-clear-sections"].addEventListener("click", () => { state.customSections.clear(); state.customUnits.clear(); renderCustomCoverage(); });
    dom["custom-select-all-units"].addEventListener("click", () => { customCoverageStructure().filter((section) => state.customSections.has(section.id)).forEach((section) => section.units.forEach((unit) => state.customUnits.add(unit.key))); renderCustomCoverage(); });
    dom["custom-clear-units"].addEventListener("click", () => { state.customUnits.clear(); renderCustomCoverage(); });
    dom["custom-balance-units"].addEventListener("change", renderCustomCoverage); dom["custom-match-cases"].addEventListener("change", renderCustomCoverage);
    dom["case-resume"].addEventListener("click", enterActiveSession); dom["case-discard"].addEventListener("click", () => { if (!window.confirm("Discard this saved simulation? Its unfinished responses will be removed.")) return; state.active = null; removeActive(); renderExamCenter(); });
    dom["case-bank-file"].addEventListener("change", handleCaseFile); dom["import-case-json"].addEventListener("click", async () => { try { if (await importCases(JSON.parse(dom["case-json-input"].value))) dom["case-json-input"].value = ""; } catch (error) { caseMessage(`Cases were not imported: ${error.message}`, "error"); } });
    dom["export-case-bank"].addEventListener("click", () => download(`cma-case-bank-${new Date().toISOString().slice(0, 10)}.json`, { version: 1, exportedAt: new Date().toISOString(), cases: state.caseBank }));
    dom["restore-demo-cases"].addEventListener("click", () => importCases(DEMO_CASES));
    dom["case-bank-list"].addEventListener("click", (event) => { const practice = event.target.closest("[data-practice-case]"); if (practice) startCaseByIds([practice.dataset.practiceCase]); const remove = event.target.closest("[data-delete-case]"); if (remove && window.confirm("Delete this case set from the local case bank?")) { state.caseBank = state.caseBank.filter((item) => item.id !== remove.dataset.deleteCase); saveBank(); renderExamCenter(); } });
    dom["case-history-list"].addEventListener("click", (event) => { const button = event.target.closest("[data-view-case-result]"); const result = button && state.history.find((item) => item.id === button.dataset.viewCaseResult); if (result) { renderCaseResult(result); showScreen("case-results"); } });
    dom["clear-case-history"].addEventListener("click", () => { if (window.confirm("Clear all case and full-simulation history? Your MCQ practice history is not affected.")) { state.history = []; saveHistory(); renderCaseHistory(); } });
    dom["formula-search"].addEventListener("input", renderFormulaBoard);
    dom["full-mcq-options"].addEventListener("change", (event) => { const input = event.target.closest('input[name="full-mcq-answer"]'); const session = state.active; const question = session?.mcqQuestions[session.mcqCurrentIndex]; if (!input || !question) return; session.mcqAnswers[question.id] = input.value; saveActive(); renderFullMcq(); updatePhaseHeader(); });
    dom["full-mcq-previous"].addEventListener("click", () => navigateMcq(state.active.mcqCurrentIndex - 1)); dom["full-mcq-next"].addEventListener("click", handleFullMcqNext); dom["full-mcq-navigator"].addEventListener("click", (event) => { const button = event.target.closest("[data-full-mcq-index]"); if (button) navigateMcq(Number(button.dataset.fullMcqIndex)); });
    dom["full-mcq-mark"].addEventListener("click", () => { const session = state.active; const question = session?.mcqQuestions[session.mcqCurrentIndex]; if (!question) return; session.mcqMarked[question.id] = !session.mcqMarked[question.id]; saveActive(); renderFullMcq(); });
    dom["full-mcq-clear"].addEventListener("click", () => { const session = state.active; const question = session?.mcqQuestions[session.mcqCurrentIndex]; if (!question) return; delete session.mcqAnswers[question.id]; saveActive(); renderFullMcq(); updatePhaseHeader(); });
    dom["cbq-items"].addEventListener("input", handleCaseResponse); dom["cbq-items"].addEventListener("change", handleCaseResponse);
    dom["cbq-previous"].addEventListener("click", () => navigateCase(state.active.currentCaseIndex - 1)); dom["cbq-next"].addEventListener("click", () => navigateCase(state.active.currentCaseIndex + 1)); dom["cbq-navigator"].addEventListener("click", (event) => { const button = event.target.closest("[data-case-index]"); if (button) navigateCase(Number(button.dataset.caseIndex)); });
    dom["case-exam-submit"].addEventListener("click", requestPhaseSubmission);
    dom["case-return-to-exam"].addEventListener("click", resumeCaseSubmission);
    dom["confirm-case-submit"].addEventListener("click", confirmCaseSubmission);
    dom["case-submit-dialog"].addEventListener("cancel", (event) => { event.preventDefault(); resumeCaseSubmission(); });
    dom["case-results-home"].addEventListener("click", openHome); dom["case-results-center"].addEventListener("click", () => openExamCenter("simulations")); dom["case-results-again"].addEventListener("click", () => openExamCenter("simulations")); dom["case-results-print"].addEventListener("click", () => window.print());
    dom["full-mcq-review-filter"].addEventListener("change", renderFullMcqReview);
    dom["case-results-retest-mcq"].addEventListener("click", () => {
      const missedIds = new Set((state.currentResult?.mcqResult?.perQuestion || []).filter((item) => item.status !== "Correct").map((item) => item.id));
      const questions = appState().questionBank.filter((question) => missedIds.has(question.id));
      APP?.startDirectExam?.(questions, "Full Simulation — Missed MCQs", Math.max(5, Math.ceil(questions.length * 1.5)), { mode: "full-simulation-retest", shuffle: true, randomize: true });
    });
    document.addEventListener("click", (event) => { if (!state.active || dom["case-exam-screen"].hidden || !event.target.closest("#brand-home")) return; event.preventDefault(); event.stopImmediatePropagation(); if (window.confirm("Leave and discard the active simulation?")) { state.active = null; removeActive(); openHome(); } }, true);
    window.addEventListener("beforeunload", () => { if (state.active) { if (state.active.phase === "mcq") commitMcqTime(Date.now()); saveActive(); } });
  }

  function handleCaseResponse(event) {
    const input = event.target.closest("[data-case-id][data-item-id]"); if (!input || !state.active) return;
    const caseId = input.dataset.caseId; const itemId = input.dataset.itemId; state.active.caseResponses[caseId] ||= {};
    if (input.dataset.itemType === "multi-select") { const checked = Array.from(dom["cbq-items"].querySelectorAll("input:checked")).filter((element) => element.dataset.caseId === caseId && element.dataset.itemId === itemId).map((element) => element.value); state.active.caseResponses[caseId][itemId] = checked; }
    else state.active.caseResponses[caseId][itemId] = input.value;
    saveActive(); updatePhaseHeader();
  }
  function navigateCase(index) { if (!state.active || state.active.phase !== "cbq" || index < 0 || index >= state.active.caseSets.length || index === state.active.currentCaseIndex) return; state.active.currentCaseIndex = index; saveActive(); renderCaseSet(); updatePhaseHeader(); window.scrollTo(0, 0); }

  async function initialize() {
    cacheDom(); bindEvents(); await readData(); renderHomeStatus(); renderExamCenter(); showScreen("home");
    if (state.active && Date.now() >= state.active.phaseEndTime) { if (state.active.phase === "mcq") submitMcqPhase(true); else finalizeSession("Case time expired while away"); }
  }

  globalThis.CMACaseSimulator = Object.freeze({
    openExamCenter,
    backupSnapshot,
    restoreBackup,
    getState: () => clone({ caseBank: state.caseBank, history: state.history, active: state.active, currentResult: state.currentResult })
  });

  initialize().catch((error) => {
    console.error("CMA case center could not initialize.", error);
    if (dom["home-exam-readiness-text"]) dom["home-exam-readiness-text"].textContent = "The case-based exam center could not load. Refresh the page or restore a backup from Settings.";
  });
})();
