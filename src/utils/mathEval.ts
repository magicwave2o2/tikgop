/**
 * Safe inline arithmetic evaluator & MoMo-style smart multiplier suggestions
 * for ultra-fast Vietnamese VND amount input.
 *
 * Examples:
 * - "120+35+45" -> 200 (or if user types "120k+35k" -> 155000)
 * - "120.000+35.000" -> 155000
 * - "50k*3" -> 150000
 * - "200.000-45.000" -> 155000
 */

export interface ExpressionResult {
  hasOperator: boolean;
  valid: boolean;
  value: number;
  /** True when user typed short numbers like 120+35 (< 1000) that probably mean thousands */
  suggestThousands: boolean;
}

function parseTokenNumber(token: string): number | null {
  const clean = token.trim().toLowerCase().replace(/\s+/g, '');
  if (!clean) return null;

  // Support shorthand units: 1.5tr, 1,5tr, 120k
  const trMatch = clean.match(/^(\d+(?:[.,]\d+)?)(?:tr|trieu)$/);
  if (trMatch) {
    return Math.round(parseFloat(trMatch[1].replace(',', '.')) * 1_000_000);
  }
  const kMatch = clean.match(/^(\d+(?:[.,]\d+)?)k$/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1].replace(',', '.')) * 1_000);
  }

  // Vietnamese formatted number with thousand dots (e.g. 120.000)
  const digitsOnly = clean.replace(/[.,]/g, '');
  if (!/^\d+$/.test(digitsOnly)) return null;
  return Number(digitsOnly);
}

/**
 * Evaluates a safe +, -, *, / arithmetic expression without eval().
 */
export function evaluateAmountExpression(raw: string): ExpressionResult {
  const trimmed = raw.trim().replace(/[x×]/gi, '*').replace(/÷/g, '/');
  if (!trimmed) {
    return { hasOperator: false, valid: false, value: 0, suggestThousands: false };
  }

  const hasOperator = /[+\-*/]/.test(trimmed);
  if (!hasOperator) {
    const val = parseTokenNumber(trimmed);
    return {
      hasOperator: false,
      valid: val !== null && val > 0,
      value: val ?? 0,
      suggestThousands: false,
    };
  }

  // Tokenize numbers (with optional k/tr suffix and dots) and operators
  const tokens = trimmed.match(/(\d+(?:[.,]\d+)*(?:tr|trieu|k)?|[+\-*/])/gi);
  if (!tokens || tokens.length === 0) {
    return { hasOperator: true, valid: false, value: 0, suggestThousands: false };
  }

  // Convert into alternating number / operator arrays cleanly
  const values: number[] = [];
  const ops: string[] = [];
  let expectNumber = true;

  for (const tok of tokens) {
    if (expectNumber) {
      const n = parseTokenNumber(tok);
      if (n === null) {
        return { hasOperator: true, valid: false, value: 0, suggestThousands: false };
      }
      values.push(n);
      expectNumber = false;
    } else {
      if (!/^[+\-*/]$/.test(tok)) {
        return { hasOperator: true, valid: false, value: 0, suggestThousands: false };
      }
      ops.push(tok);
      expectNumber = true;
    }
  }

  // Allow trailing operator while user is still typing (evaluate prefix cleanly)
  if (ops.length >= values.length) {
    ops.pop();
  }
  if (values.length === 0) {
    return { hasOperator: true, valid: false, value: 0, suggestThousands: false };
  }

  // Pass 1: handle * and /
  const addVals: number[] = [values[0]];
  const addOps: string[] = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const nextVal = values[i + 1];
    if (op === '*') {
      addVals[addVals.length - 1] = addVals[addVals.length - 1] * nextVal;
    } else if (op === '/') {
      if (nextVal === 0) {
        return { hasOperator: true, valid: false, value: 0, suggestThousands: false };
      }
      addVals[addVals.length - 1] = addVals[addVals.length - 1] / nextVal;
    } else {
      addOps.push(op);
      addVals.push(nextVal);
    }
  }

  // Pass 2: handle + and -
  let acc = addVals[0];
  for (let i = 0; i < addOps.length; i++) {
    if (addOps[i] === '+') acc += addVals[i + 1];
    else acc -= addVals[i + 1];
  }

  const rounded = Math.max(0, Math.round(acc));
  const suggestThousands = rounded > 0 && rounded < 1000 && !/[k]|tr/i.test(trimmed);

  return {
    hasOperator: true,
    valid: rounded > 0,
    value: rounded,
    suggestThousands,
  };
}

/**
 * Generates MoMo/Vietnamese-banking style smart multiplier chips as the user types digits.
 * Example: typing "45" -> [45_000, 450_000, 4_500_000]
 *          typing "125" -> [125_000, 1_250_000]
 */
export function getSmartMultiplierSuggestions(raw: string): number[] {
  if (/[+\-*/]/.test(raw)) return [];
  const digits = raw.replace(/\D/g, '');
  if (!digits) return [];
  const num = Number(digits);
  if (!Number.isFinite(num) || num <= 0) return [];

  // Only suggest multipliers when user has typed a small shorthand prefix (1..9999)
  if (num >= 10_000) return [];

  const suggestions: number[] = [];
  let candidate = num;
  while (candidate < 10_000) {
    candidate *= 10;
  }
  // Ensure at least *1000 when typing e.g. 45 -> 45.000, 450.000, 4.500.000
  if (num < 1_000) {
    candidate = num * 1_000;
  }

  for (let i = 0; i < 3; i++) {
    const val = candidate * Math.pow(10, i);
    if (val >= 10_000 && val <= 500_000_000) {
      suggestions.push(val);
    }
  }

  return suggestions;
}
