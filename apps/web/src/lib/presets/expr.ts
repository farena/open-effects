/**
 * Minimal arithmetic expression evaluator used by preset templates.
 *
 * Templates look like:
 *   "${fromX}px"
 *   "${-amplitude}deg"
 *   "${peak / 2}px"
 *   "${round(amp * 0.6)}deg"
 *
 * Inside ${ ... } we evaluate a small expression grammar:
 *
 *   expr   := term  (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := ('-' | '+') factor
 *           | '(' expr ')'
 *           | NUMBER
 *           | IDENT '(' expr (',' expr)* ')'
 *           | IDENT
 *
 * Supported functions: round, floor, ceil, abs, min, max.
 * Variables resolve against the params record; unknown variables throw.
 */

type Vars = Record<string, number | string>;

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
};

export class PresetExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresetExpressionError";
  }
}

export function evaluateExpression(input: string, vars: Vars): number {
  const tokens = tokenize(input);
  const parser = new Parser(tokens, vars);
  const value = parser.parseExpr();
  parser.expectEof();
  return value;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new PresetExpressionError(`Non-finite numeric result: ${n}`);
  }
  // Round to 6 decimal places to avoid floating-point noise (0.1 + 0.2)
  // while keeping enough precision for typical preset math.
  const rounded = Math.round(n * 1e6) / 1e6;
  return String(rounded);
}

/**
 * Replace every `${expression}` placeholder in `template` with the evaluated
 * numeric result. Literal text outside placeholders is preserved verbatim.
 */
export function evaluateTemplate(template: string, vars: Vars): string {
  let result = "";
  let i = 0;
  while (i < template.length) {
    const start = template.indexOf("${", i);
    if (start < 0) {
      result += template.slice(i);
      break;
    }
    result += template.slice(i, start);
    const end = template.indexOf("}", start + 2);
    if (end < 0) {
      throw new PresetExpressionError(
        `Unterminated \${...} placeholder in template: ${template}`,
      );
    }
    const expr = template.slice(start + 2, end);
    const value = evaluateExpression(expr, vars);
    result += formatNumber(value);
    i = end + 1;
  }
  return result;
}

// ───────────────────────────────────────────────────────────────────────────
// Tokenizer
// ───────────────────────────────────────────────────────────────────────────

type Tok =
  | { kind: "num"; value: number }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: "+" | "-" | "*" | "/" | "(" | ")" | "," };

function tokenize(input: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "(" || ch === ")" || ch === ",") {
      out.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j]!)) j++;
      const slice = input.slice(i, j);
      const n = Number(slice);
      if (!Number.isFinite(n)) {
        throw new PresetExpressionError(`Invalid number literal: ${slice}`);
      }
      out.push({ kind: "num", value: n });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < input.length && /[a-zA-Z0-9_]/.test(input[j]!)) j++;
      out.push({ kind: "ident", value: input.slice(i, j) });
      i = j;
      continue;
    }
    throw new PresetExpressionError(`Unexpected character '${ch}' in expression: ${input}`);
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// Parser (recursive descent)
// ───────────────────────────────────────────────────────────────────────────

class Parser {
  private pos = 0;
  constructor(private tokens: Tok[], private vars: Vars) {}

  parseExpr(): number {
    let left = this.parseTerm();
    while (true) {
      const t = this.peek();
      if (t?.kind === "op" && (t.value === "+" || t.value === "-")) {
        this.pos++;
        const right = this.parseTerm();
        left = t.value === "+" ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseFactor();
    while (true) {
      const t = this.peek();
      if (t?.kind === "op" && (t.value === "*" || t.value === "/")) {
        this.pos++;
        const right = this.parseFactor();
        if (t.value === "*") {
          left = left * right;
        } else {
          if (right === 0) throw new PresetExpressionError("Division by zero");
          left = left / right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  private parseFactor(): number {
    const t = this.peek();
    if (!t) throw new PresetExpressionError("Unexpected end of expression");
    if (t.kind === "op" && t.value === "-") {
      this.pos++;
      return -this.parseFactor();
    }
    if (t.kind === "op" && t.value === "+") {
      this.pos++;
      return this.parseFactor();
    }
    if (t.kind === "op" && t.value === "(") {
      this.pos++;
      const v = this.parseExpr();
      this.expectOp(")");
      return v;
    }
    if (t.kind === "num") {
      this.pos++;
      return t.value;
    }
    if (t.kind === "ident") {
      this.pos++;
      const next = this.peek();
      if (next?.kind === "op" && next.value === "(") {
        // Function call
        this.pos++;
        const args: number[] = [];
        if (!this.peekOp(")")) {
          args.push(this.parseExpr());
          while (this.peekOp(",")) {
            this.pos++;
            args.push(this.parseExpr());
          }
        }
        this.expectOp(")");
        const fn = FUNCTIONS[t.value];
        if (!fn) {
          throw new PresetExpressionError(`Unknown function: ${t.value}`);
        }
        return fn(...args);
      }
      return this.resolveVar(t.value);
    }
    throw new PresetExpressionError(`Unexpected token: ${JSON.stringify(t)}`);
  }

  private resolveVar(name: string): number {
    if (!(name in this.vars)) {
      throw new PresetExpressionError(`Unknown variable: ${name}`);
    }
    const v = this.vars[name];
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) {
      throw new PresetExpressionError(`Variable '${name}' is not a finite number: ${v}`);
    }
    return n;
  }

  private peek(): Tok | undefined {
    return this.tokens[this.pos];
  }

  private peekOp(op: string): boolean {
    const t = this.peek();
    return t?.kind === "op" && t.value === op;
  }

  private expectOp(op: string): void {
    const t = this.peek();
    if (!t || t.kind !== "op" || t.value !== op) {
      throw new PresetExpressionError(`Expected '${op}'`);
    }
    this.pos++;
  }

  expectEof(): void {
    if (this.pos !== this.tokens.length) {
      throw new PresetExpressionError(
        `Unexpected trailing token at position ${this.pos}`,
      );
    }
  }
}
