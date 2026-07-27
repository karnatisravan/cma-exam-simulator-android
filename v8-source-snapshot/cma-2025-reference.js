(() => {
  "use strict";

  // Section and Study Unit titles transcribed from the tables of contents in
  // HOCK CMA Part 2 (2025), Volumes 1 and 2. The outline code is reference
  // metadata; question-bank unit IDs remain the stable "Unit N" values.
  const reference = {
    A: {
      sectionName: "Financial Statement Analysis",
      units: [
        ["A.1", "Comparative Financial Statement Analysis"],
        ["A.2", "Introduction to Financial Ratio Analysis"],
        ["A.2", "Liquidity Ratios"],
        ["A.2", "Leverage and Coverage Ratios"],
        ["A.2", "Activity Ratios"],
        ["A.2", "Profitability Ratios I: Profitability Per Share"],
        ["A.2", "Profitability Ratios II: Basic Earnings Per Share"],
        ["A.2", "Profitability Ratios III: Diluted Earnings Per Share"],
        ["A.2", "Profitability Ratios IV: Company Profitability"],
        ["A.3", "Profitability Analysis"],
        ["A.4", "Foreign Currency in Financial Statement Analysis"],
        ["A.4", "Accounting for Foreign Operations"],
        ["A.4", "Inflation and Financial Ratios"],
        ["A.4", "Impact of Accounting Changes on Financial Ratios"],
        ["A.4", "Book/Market Value and Accounting/Economic Profit"],
        ["A.4", "Earnings Quality"]
      ]
    },
    B: {
      sectionName: "Corporate Finance",
      units: [
        ["B.1", "Financial Risk and Return, Types of Financial Risk"],
        ["B.1", "Capital Asset Pricing Model (CAPM)"],
        ["B.1", "Portfolio Risk and Return"],
        ["B.2", "Introduction to Long-Term Financial Management"],
        ["B.2", "Introduction to Cost of Capital"],
        ["B.2", "Debt Financing (Bonds)"],
        ["B.2", "Cost of Capital: Cost of Debt"],
        ["B.2", "Term Structure of Interest Rates"],
        ["B.2", "Bond Duration"],
        ["B.2", "Equity Financing"],
        ["B.3", "Dividend Policy and Treasury Stock"],
        ["B.2", "Stock Rights, Warrants, and ADRs"],
        ["B.2", "Calculation of the Value of a Share"],
        ["B.2", "Cost of Capital: Cost of Preferred Stock"],
        ["B.2", "Cost of Capital: Cost of Common Equity"],
        ["B.2", "Cost of Capital: Capital Structure and WACC"],
        ["B.2", "Introduction to Derivatives"],
        ["B.2", "Forward and Future Contracts"],
        ["B.2", "Interest Rate and Foreign Currency Swaps"],
        ["B.2", "Options"],
        ["B.2", "Hedging Strategies with Puts and Calls"],
        ["B.3", "Raising Capital in Privately Held Companies"],
        ["B.3", "Raising Capital in Publicly Held Companies"],
        ["B.3", "Financial Markets"],
        ["B.4", "Working Capital Introduction"],
        ["B.4", "Cash Management"],
        ["B.4", "Marketable Securities Management"],
        ["B.4", "Accounts Receivable Management"],
        ["B.4", "Inventory Management"],
        ["B.4", "Trade Credit Financing"],
        ["B.4", "Bank Loans"],
        ["B.4", "Factoring Receivables and Short-Term Financing"],
        ["B.5", "Corporate Restructuring, Business Combinations"],
        ["B.5", "Takeover Defenses"],
        ["B.5", "Divestitures"],
        ["B.5", "Discounted Cash Flow Valuation"],
        ["B.6", "International Finance, Foreign Direct Investment"],
        ["B.6", "Foreign Currency Exchange Rates"],
        ["B.6", "Foreign Financing and International Payments"]
      ]
    },
    C: {
      sectionName: "Business Decision Analysis",
      units: [
        ["C.1", "Cost-Volume-Profit (CVP) Analysis"],
        ["C.1", "Profit Point Analysis"],
        ["C.1", "Multiple Product CVP Analysis"],
        ["C.1", "Risk and Uncertainty in CVP Analysis"],
        ["C.1", "Other Decisions in CVP Analysis"],
        ["C.2", "Marginal Analysis and Relevant Information"],
        ["C.2", "Costs Used in Decision Making"],
        ["C.2", "Make or Buy Decisions"],
        ["C.2", "Special Order Decisions"],
        ["C.2", "Sell or Process Further Decisions"],
        ["C.2", "Disinvestment Decisions"],
        ["C.2", "Introducing a New Product or Changing Output Levels"],
        ["C.3", "Demand, Supply, and Pricing"],
        ["C.3", "Pricing by Market Structure"],
        ["C.3", "Pricing Strategy"],
        ["C.3", "New Product and Product Mix Pricing"],
        ["C.3", "Short-Term and Long-Term Pricing"],
        ["C.3", "Product Life Cycle Pricing"],
        ["C.3", "Other Pricing Considerations"]
      ]
    },
    D: {
      sectionName: "Enterprise Risk Management",
      units: [
        ["D.1", "Enterprise Risk Management, Types of Risk"],
        ["D.1", "Risk Management Process"],
        ["D.1", "Enterprise Risk Management (ERM)"],
        ["D.1", "Capital Adequacy"]
      ]
    },
    E: {
      sectionName: "Capital Investment Decisions",
      units: [
        ["E.1", "Capital Investment Analysis and Relevant Cash Flows"],
        ["E.2", "Payback and Discounted Payback Methods"],
        ["E.2", "Net Present Value Method"],
        ["E.2", "Internal Rate of Return"],
        ["E.2", "Capital Investment Analysis Methods: Other Topics"],
        ["E.2", "Risk in Capital Investment Analysis, Capital Constraints"],
        ["E.2", "Real Options in Capital Investment Analysis"]
      ]
    },
    F: {
      sectionName: "Professional Ethics",
      units: [
        ["F.1", "Business Ethics"],
        ["F.1", "Business Fraud"],
        ["F.1", "Values for Ethical Decision-Making"],
        ["F.2", "The IMA Code of Ethics and the Fraud Triangle"],
        ["F.3", "Ethical Considerations for the Organization"],
        ["F.3", "Creating a Values-Based Ethics Culture"],
        ["F.3", "Governmental Influences on Corporate Behavior"],
        ["F.3", "Sustainability and Social Responsibility"],
        ["F.3", "Data Ethics"]
      ]
    }
  };

  Object.entries(reference).forEach(([section, data]) => {
    data.units = Object.freeze(data.units.map(([outline, unitName], index) => Object.freeze({
      unit: `Unit ${index + 1}`,
      outline,
      unitName
    })));
    reference[section] = Object.freeze(data);
  });

  globalThis.CMA2025ReferenceMeta = Object.freeze({
    edition: "2024-2025",
    part: 2,
    volumes: Object.freeze(["Volume 1: Sections A and B", "Volume 2: Sections C-F"]),
    sectionCount: 6,
    unitCount: 94,
    source: "HOCK CMA Part 2 tables of contents supplied by the user"
  });
  globalThis.CMA2025Reference = Object.freeze(reference);
})();
