"use strict";

/*
 * Alpha O - Automate - Workflow execution engine (phase 1: SIMULATION ONLY)
 * Repository path: automate/engine.js
 *
 * What this file does
 *   - Validates a saved workflow draft.
 *   - Simulates its trigger, checks its condition against explicit test input,
 *     and simulates its action.
 *   - Records every run (status, timestamps, messages) and keeps a bounded,
 *     versioned run history in localStorage.
 *
 * What this file does NOT do
 *   - It never sends email, edits Google Sheets, posts messages, reads files,
 *     or contacts any server. There are no network calls and no credentials.
 *   - It cannot run in the background. Browser JavaScript stops when the tab
 *     is closed, so real triggers, schedules and retries need a server-side
 *     engine (see the "Future expansion" notes at the bottom of this file).
 *
 * Storage
 *   - Run history key:  alphaO.automate.runs.v1
 *   - The workflow-draft key (alphaO.automate.workflows.v1) is never touched.
 *
 * Public API: window.AlphaOEngine (see the object at the bottom).
 */

(() => {
  if (window.AlphaOEngine) return; // Guard against the script being loaded twice.

  const ENGINE_VERSION = "0.1.0";
  const RUNS_STORAGE_KEY = "alphaO.automate.runs.v1";
  const RUNS_SCHEMA_VERSION = 1;

  const MAX_STORED_RUNS = 50;
  const MAX_MESSAGES_PER_RUN = 100;
  const MAX_TEST_INPUT_CHARS = 10000;
  const MAX_CONDITION_CHARS = 2000;
  const STEP_DELAY_MS = 180; // Small pause between steps so progress is visible.
  const ACTION_TIMEOUT_MS = 5000;

  // Defaults mirror the builder (automate.js) so older drafts behave the same.
  const DEFAULT_TRIGGER = "manual";
  const DEFAULT_ACTION = "summarize";

  const STATUS = Object.freeze({
    RUNNING: "RUNNING",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    SKIPPED: "SKIPPED",
    UNSUPPORTED: "UNSUPPORTED"
  });

  const VALID_RUN_STATUSES = new Set(Object.values(STATUS));

  const SAMPLE_TEST_INPUT = Object.freeze({
    priority: "urgent",
    subject: "Invoice 1042",
    email: "customer@example.com",
    amount: 250,
    status: "open",
    fileName: "invoice-1042.pdf",
    message: "Invoice 1042 needs review"
  });

  const CONDITION_SYNTAX_HELP =
    "Supported condition format: <field> <operator> <value>, joined with AND / OR " +
    "(AND is evaluated before OR; parentheses are not supported). " +
    "Operators: is, is not, =, !=, >, >=, <, <=, contains, not contains, " +
    "starts with, ends with, is empty, is not empty, exists, does not exist. " +
    "Example: priority is urgent AND amount > 100. " +
    "Free-text sentences cannot be evaluated.";

  /* ------------------------------------------------------------------ */
  /* Small utilities                                                     */
  /* ------------------------------------------------------------------ */

  class EngineError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "EngineError";
      this.code = code;
    }
  }

  class ConditionSyntaxError extends Error {
    constructor(message) {
      super(message);
      this.name = "ConditionSyntaxError";
    }
  }

  const nowISO = () => new Date().toISOString();

  const sleep = ms => new Promise(resolve => window.setTimeout(resolve, ms));

  const clone = value => JSON.parse(JSON.stringify(value));

  const isPlainObject = value =>
    value !== null && typeof value === "object" && !Array.isArray(value);

  function truncate(value, max) {
    const text = String(value);
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function createRunId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `run-${window.crypto.randomUUID()}`;
    }
    return `run-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /* ------------------------------------------------------------------ */
  /* Redaction (nothing sensitive is stored or displayed)                */
  /* ------------------------------------------------------------------ */

  const SENSITIVE_KEY =
    /pass(word|wd)?|secret|token|api[-_]?key|authorization|credential|private[-_]?key/i;

  function safeValue(key, value) {
    if (SENSITIVE_KEY.test(String(key))) return "[REDACTED]";
    if (value === null || value === undefined) return "(empty)";
    if (typeof value === "object") return truncate(JSON.stringify(value), 200);
    return truncate(value, 200);
  }

  function sanitizeForStorage(value, depth = 0) {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") return truncate(value, 500);

    if (Array.isArray(value)) {
      if (depth >= 4) return "[truncated]";
      return value.slice(0, 20).map(item => sanitizeForStorage(item, depth + 1));
    }

    if (typeof value === "object") {
      if (depth >= 4) return "[truncated]";
      const result = {};
      Object.keys(value).slice(0, 40).forEach(key => {
        result[key] = SENSITIVE_KEY.test(key)
          ? "[REDACTED]"
          : sanitizeForStorage(value[key], depth + 1);
      });
      return result;
    }

    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Workflow validation and normalisation                               */
  /* ------------------------------------------------------------------ */

  function normalizeWorkflow(raw) {
    const errors = [];
    const warnings = [];
    const defaultsApplied = [];

    if (!isPlainObject(raw)) {
      errors.push("Workflow data is missing or is not an object.");
      return { workflow: null, errors, warnings, defaultsApplied };
    }

    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!id) errors.push("Workflow has no valid id.");

    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) errors.push("Workflow has no name.");

    if (typeof raw.description !== "string") {
      errors.push("Workflow description is missing or is not text.");
    } else if (!raw.description.trim()) {
      warnings.push("Workflow description is empty.");
    }

    let type = "other";
    if (typeof raw.type === "string" && raw.type.trim()) {
      type = raw.type.trim();
    } else {
      warnings.push('Workflow category is missing; treating it as "other".');
    }

    // Optional fields: older drafts may not have them.
    let trigger = DEFAULT_TRIGGER;
    if (raw.trigger === undefined || raw.trigger === null || raw.trigger === "") {
      defaultsApplied.push(`Trigger missing; using default "${DEFAULT_TRIGGER}".`);
    } else if (typeof raw.trigger !== "string") {
      errors.push("Workflow trigger is not text.");
    } else {
      trigger = raw.trigger.trim() || DEFAULT_TRIGGER;
    }

    let action = DEFAULT_ACTION;
    if (raw.action === undefined || raw.action === null || raw.action === "") {
      defaultsApplied.push(`Action missing; using default "${DEFAULT_ACTION}".`);
    } else if (typeof raw.action !== "string") {
      errors.push("Workflow action is not text.");
    } else {
      action = raw.action.trim() || DEFAULT_ACTION;
    }

    let condition = "";
    if (raw.condition !== undefined && raw.condition !== null) {
      if (typeof raw.condition !== "string") {
        errors.push("Workflow condition is not text.");
      } else if (raw.condition.length > MAX_CONDITION_CHARS) {
        errors.push(`Workflow condition is longer than ${MAX_CONDITION_CHARS} characters.`);
      } else {
        condition = raw.condition.trim();
      }
    }

    const workflow = {
      id,
      name,
      type,
      description: typeof raw.description === "string" ? raw.description : "",
      trigger,
      action,
      condition,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : ""
    };

    return { workflow, errors, warnings, defaultsApplied };
  }

  function validateTestInput(input) {
    if (input === undefined || input === null) return { ok: true, value: {} };

    if (!isPlainObject(input)) {
      return { ok: false, message: "Test input must be a JSON object, for example {\"priority\": \"urgent\"}." };
    }

    let size;
    try {
      size = JSON.stringify(input).length;
    } catch (error) {
      return { ok: false, message: "Test input could not be read as JSON." };
    }

    if (size > MAX_TEST_INPUT_CHARS) {
      return { ok: false, message: `Test input is larger than ${MAX_TEST_INPUT_CHARS} characters.` };
    }

    return { ok: true, value: input };
  }

  /* ------------------------------------------------------------------ */
  /* Condition parsing and evaluation                                    */
  /* ------------------------------------------------------------------ */

  const FIELD_PATTERN = "[A-Za-z_][\\w.\\-]*";

  // Longest operators first so "is not empty" wins over "is not" and "is".
  const WORD_OPERATORS = [
    ["is not empty", "is-not-empty"],
    ["is empty", "is-empty"],
    ["does not exist", "not-exists"],
    ["exists", "exists"],
    ["does not contain", "not-contains"],
    ["not contains", "not-contains"],
    ["contains", "contains"],
    ["starts with", "starts-with"],
    ["ends with", "ends-with"],
    ["is not", "not-equals"],
    ["is", "equals"]
  ];

  const SYMBOL_OPERATORS = {
    "==": "equals",
    "=": "equals",
    "!=": "not-equals",
    ">=": "gte",
    "<=": "lte",
    ">": "gt",
    "<": "lt"
  };

  const VALUELESS_OPERATORS = new Set(["is-empty", "is-not-empty", "exists", "not-exists"]);

  const WORD_CLAUSE_RE = new RegExp(
    `^(${FIELD_PATTERN})\\s+(${WORD_OPERATORS.map(([word]) => escapeRegExp(word)).join("|")})(?=\\s|$)\\s*(.*)$`,
    "i"
  );

  const SYMBOL_CLAUSE_RE = new RegExp(
    `^(${FIELD_PATTERN})\\s*(==|!=|>=|<=|=|>|<)\\s*(.+)$`
  );

  function splitOutsideQuotes(text, keyword) {
    const parts = [];
    const separator = ` ${keyword} `;
    let current = "";
    let quote = null;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (quote) {
        current += character;
        if (character === quote) quote = null;
        continue;
      }

      if (character === '"' || character === "'") {
        quote = character;
        current += character;
        continue;
      }

      if (text.substr(index, separator.length).toUpperCase() === separator) {
        parts.push(current);
        current = "";
        index += separator.length - 1;
        continue;
      }

      current += character;
    }

    if (quote) throw new ConditionSyntaxError("A quotation mark is not closed.");

    parts.push(current);
    return parts;
  }

  function stripQuotes(value) {
    const text = value.trim();
    if (
      text.length >= 2 &&
      (text[0] === '"' || text[0] === "'") &&
      text[text.length - 1] === text[0]
    ) {
      return text.slice(1, -1);
    }
    return text;
  }

  function parseClause(rawClause) {
    const text = rawClause.trim();

    if (!text) {
      throw new ConditionSyntaxError("A condition has an empty part around AND / OR.");
    }

    let field;
    let operator;
    let valueText = "";

    const wordMatch = text.match(WORD_CLAUSE_RE);

    if (wordMatch) {
      field = wordMatch[1];
      const wordOperator = wordMatch[2].toLowerCase();
      operator = WORD_OPERATORS.find(([word]) => word === wordOperator)[1];
      valueText = wordMatch[3];
    } else {
      const symbolMatch = text.match(SYMBOL_CLAUSE_RE);

      if (!symbolMatch) {
        throw new ConditionSyntaxError(`"${truncate(text, 80)}" is not in the supported format.`);
      }

      field = symbolMatch[1];
      operator = SYMBOL_OPERATORS[symbolMatch[2]];
      valueText = symbolMatch[3];
    }

    const expected = stripQuotes(valueText);

    if (VALUELESS_OPERATORS.has(operator)) {
      if (valueText.trim()) {
        throw new ConditionSyntaxError(`"${truncate(text, 80)}" should not have a value after the operator.`);
      }
    } else if (!expected && !/^(['"]).*\1$/.test(valueText.trim())) {
      throw new ConditionSyntaxError(`"${truncate(text, 80)}" needs a value to compare with.`);
    }

    return { raw: text, field, operator, expected };
  }

  function parseCondition(expression) {
    const normalized = expression.replace(/\s+/g, " ").trim();
    const orParts = splitOutsideQuotes(normalized, "OR");

    return orParts.map(orPart =>
      splitOutsideQuotes(orPart, "AND").map(parseClause)
    );
  }

  function getField(input, path) {
    let current = input;

    for (const segment of path.split(".")) {
      if (current === null || typeof current !== "object") return { found: false };

      const key = Object.prototype.hasOwnProperty.call(current, segment)
        ? segment
        : Object.keys(current).find(item => item.toLowerCase() === segment.toLowerCase());

      if (key === undefined) return { found: false };

      current = current[key];
    }

    return { found: true, value: current };
  }

  function isEmptyValue(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  }

  function toNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    if (typeof value === "string" && value.trim() !== "") return Number(value);
    return NaN;
  }

  function evaluateClause(clause, input) {
    const result = {
      raw: clause.raw,
      field: clause.field,
      operator: clause.operator,
      expected: clause.expected,
      actual: null,
      result: null,
      error: null
    };

    const lookup = getField(input, clause.field);

    if (lookup.found) result.actual = safeValue(clause.field, lookup.value);

    try {
      switch (clause.operator) {
        case "exists":
          result.result = lookup.found && lookup.value !== null && lookup.value !== undefined;
          return result;
        case "not-exists":
          result.result = !(lookup.found && lookup.value !== null && lookup.value !== undefined);
          return result;
        case "is-empty":
          result.result = !lookup.found || isEmptyValue(lookup.value);
          return result;
        case "is-not-empty":
          result.result = lookup.found && !isEmptyValue(lookup.value);
          return result;
        default:
          break;
      }

      if (!lookup.found) {
        throw new EngineError("MISSING_TEST_INPUT", `Test input has no field "${clause.field}".`);
      }

      const actual = lookup.value;
      const expected = clause.expected;

      switch (clause.operator) {
        case "equals":
        case "not-equals": {
          if (actual !== null && typeof actual === "object") {
            throw new EngineError("INVALID_COMPARISON", `Field "${clause.field}" is a list or object and cannot be compared with "${clause.operator === "equals" ? "is" : "is not"}".`);
          }

          const actualNumber = toNumber(actual);
          const expectedNumber = toNumber(expected);

          const equal = Number.isFinite(actualNumber) && Number.isFinite(expectedNumber)
            ? actualNumber === expectedNumber
            : String(actual).toLowerCase() === expected.toLowerCase();

          result.result = clause.operator === "equals" ? equal : !equal;
          return result;
        }

        case "gt":
        case "gte":
        case "lt":
        case "lte": {
          const actualNumber = toNumber(actual);
          const expectedNumber = toNumber(expected);

          if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) {
            throw new EngineError("INVALID_COMPARISON", `"${clause.raw}" needs numbers on both sides.`);
          }

          result.result =
            clause.operator === "gt" ? actualNumber > expectedNumber :
            clause.operator === "gte" ? actualNumber >= expectedNumber :
            clause.operator === "lt" ? actualNumber < expectedNumber :
            actualNumber <= expectedNumber;
          return result;
        }

        case "contains":
        case "not-contains": {
          let contains;

          if (Array.isArray(actual)) {
            contains = actual.some(item => String(item).toLowerCase() === expected.toLowerCase());
          } else if (actual !== null && typeof actual === "object") {
            throw new EngineError("INVALID_COMPARISON", `Field "${clause.field}" is an object and cannot be searched.`);
          } else {
            contains = String(actual).toLowerCase().includes(expected.toLowerCase());
          }

          result.result = clause.operator === "contains" ? contains : !contains;
          return result;
        }

        case "starts-with":
        case "ends-with": {
          if (actual !== null && typeof actual === "object") {
            throw new EngineError("INVALID_COMPARISON", `Field "${clause.field}" is a list or object and cannot be compared as text.`);
          }

          const text = String(actual).toLowerCase();
          const needle = expected.toLowerCase();

          result.result = clause.operator === "starts-with" ? text.startsWith(needle) : text.endsWith(needle);
          return result;
        }

        default:
          throw new EngineError("UNSUPPORTED_OPERATOR", `Operator "${clause.operator}" is not supported.`);
      }
    } catch (error) {
      result.result = null;
      result.error = error instanceof EngineError ? error.message : "Could not evaluate this clause.";
      return result;
    }
  }

  /**
   * Evaluates a condition string against explicit test input.
   * outcome: NOT_APPLICABLE | MET | NOT_MET | UNSUPPORTED | ERROR
   */
  function evaluateCondition(expression, input) {
    const text = typeof expression === "string" ? expression.trim() : "";

    if (!text) {
      return {
        status: "NOT_APPLICABLE",
        expression: "",
        clauses: [],
        summary: "This workflow has no condition, so the action is not gated."
      };
    }

    let groups;

    try {
      groups = parseCondition(text);
    } catch (error) {
      if (error instanceof ConditionSyntaxError) {
        return {
          status: "UNSUPPORTED",
          expression: text,
          clauses: [],
          summary: `This condition cannot be evaluated: ${error.message}`,
          help: CONDITION_SYNTAX_HELP
        };
      }
      throw error;
    }

    const evaluatedGroups = groups.map(group => group.map(clause => evaluateClause(clause, input)));
    const clauses = evaluatedGroups.flat();
    const failedClause = clauses.find(clause => clause.error);

    if (failedClause) {
      return {
        status: "ERROR",
        expression: text,
        clauses,
        summary: `The condition could not be evaluated: ${failedClause.error}`
      };
    }

    const met = evaluatedGroups.some(group => group.every(clause => clause.result === true));

    return {
      status: met ? "MET" : "NOT_MET",
      expression: text,
      clauses,
      summary: met
        ? "Condition is met for this test input."
        : "Condition is not met for this test input."
    };
  }

  /* ------------------------------------------------------------------ */
  /* Trigger and action registries (simulation handlers)                 */
  /* ------------------------------------------------------------------ */

  const triggers = new Map();
  const actions = new Map();

  function registerTrigger(key, definition) {
    if (typeof key !== "string" || !key || !definition || typeof definition.simulate !== "function") {
      throw new TypeError("registerTrigger needs a key and a definition with a simulate() function.");
    }
    triggers.set(key, definition);
  }

  function registerAction(key, definition) {
    if (typeof key !== "string" || !key || !definition || typeof definition.simulate !== "function") {
      throw new TypeError("registerAction needs a key and a definition with a simulate() function.");
    }
    actions.set(key, definition);
  }

  function simulatedEvent(label, summary) {
    return {
      label,
      simulate: () => ({
        summary,
        notes: ["The trigger was fired by the test harness, not by a real event."]
      })
    };
  }

  registerTrigger("manual", simulatedEvent(
    "Manually started",
    "Manual start simulated by the Run Test button."
  ));

  registerTrigger("schedule", simulatedEvent(
    "On a schedule",
    "A scheduled tick was simulated. No scheduler exists yet, so this workflow will not run at scheduled times."
  ));

  registerTrigger("new-email", simulatedEvent(
    "A new email arrives",
    "An incoming email event was simulated using the test input. No mailbox is connected."
  ));

  registerTrigger("form-submission", simulatedEvent(
    "A form is submitted",
    "A form submission was simulated using the test input. No form is connected."
  ));

  registerTrigger("file-added", simulatedEvent(
    "A file is added",
    "A file-added event was simulated using the test input. No file storage is connected."
  ));

  registerTrigger("webhook", simulatedEvent(
    "A webhook is received",
    "A webhook call was simulated using the test input. No endpoint exists to receive real webhooks."
  ));

  function pickText(input, keys) {
    for (const key of keys) {
      const found = getField(input, key);
      if (found.found && !isEmptyValue(found.value) && typeof found.value !== "object") {
        return String(found.value);
      }
    }
    return "";
  }

  registerAction("summarize", {
    label: "Summarize information",
    simulate({ input }) {
      const keys = Object.keys(input);

      if (!keys.length) {
        throw new EngineError("MISSING_INPUT", "The test input is empty, so there is nothing to summarize.");
      }

      return {
        summary: `Would summarize ${keys.length} input field${keys.length === 1 ? "" : "s"}.`,
        preview: {
          "Fields considered": keys
            .slice(0, 10)
            .map(key => `${key}: ${safeValue(key, input[key])}`)
            .join("\n")
        },
        notes: ["No summarization model is connected. No summary text was generated."]
      };
    }
  });

  registerAction("draft-email", {
    label: "Draft an email",
    simulate({ workflow, input }) {
      const to = pickText(input, ["to", "email", "from"]);
      const subject = pickText(input, ["subject"]);

      return {
        summary: "Would draft an email.",
        preview: {
          To: to || "(not provided in test input)",
          Subject: subject ? `Re: ${truncate(subject, 120)}` : workflow.name,
          "Body outline": truncate(workflow.description || "(no description)", 300)
        },
        notes: ["No email was created, saved as a draft, or sent."]
      };
    }
  });

  registerAction("create-task", {
    label: "Create or organize a task",
    simulate({ workflow, input }) {
      return {
        summary: "Would create or organize a task.",
        preview: {
          Title: truncate(pickText(input, ["title", "subject"]) || workflow.name, 120),
          Priority: pickText(input, ["priority"]) || "normal (default)",
          Due: pickText(input, ["due", "dueDate"]) || "(not set)"
        },
        notes: ["No task was created in any task system."]
      };
    }
  });

  registerAction("analyze-data", {
    label: "Analyze data and prepare a report",
    simulate({ input }) {
      const numbers = Object.keys(input)
        .filter(key => typeof input[key] === "number" && Number.isFinite(input[key]))
        .map(key => ({ key, value: input[key] }));

      if (!numbers.length) {
        throw new EngineError("MISSING_INPUT", "The test input has no numeric fields to analyze.");
      }

      const values = numbers.map(item => item.value);
      const sum = values.reduce((total, value) => total + value, 0);
      const round = value => String(Math.round(value * 10000) / 10000);

      return {
        summary: `Would analyze ${numbers.length} numeric field${numbers.length === 1 ? "" : "s"}.`,
        preview: {
          "Numeric fields": numbers.map(item => item.key).join(", "),
          Sum: round(sum),
          Average: round(sum / values.length),
          Minimum: round(Math.min(...values)),
          Maximum: round(Math.max(...values))
        },
        notes: ["No report file or spreadsheet was created. These figures come only from the test input."]
      };
    }
  });

  registerAction("notify", {
    label: "Prepare a notification",
    simulate({ workflow, input }) {
      return {
        summary: "Would prepare a notification.",
        preview: {
          Channel: pickText(input, ["channel"]) || "(not provided in test input)",
          Message: truncate(pickText(input, ["message", "subject"]) || `Notification from "${workflow.name}"`, 300)
        },
        notes: ["No notification was sent or posted anywhere."]
      };
    }
  });

  registerAction("process-file", {
    label: "Process a file",
    simulate({ input }) {
      const fileName = pickText(input, ["fileName", "file", "filename"]);

      if (!fileName) {
        throw new EngineError("MISSING_INPUT", 'The test input needs a "fileName" to simulate processing a file.');
      }

      const dot = fileName.lastIndexOf(".");
      const size = getField(input, "fileSize");

      return {
        summary: "Would process a file.",
        preview: {
          "File name": truncate(fileName, 200),
          Extension: dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "(none)",
          Size: size.found && Number.isFinite(toNumber(size.value)) ? `${toNumber(size.value)} bytes` : "(not provided)"
        },
        notes: ["No file was read, uploaded, converted, or modified."]
      };
    }
  });

  /* ------------------------------------------------------------------ */
  /* Run history (separate, versioned, bounded)                          */
  /* ------------------------------------------------------------------ */

  let history = loadHistory();
  const activeRuns = new Map();
  const runningWorkflowKeys = new Set();
  const listeners = new Set();

  function sanitizeStoredStep(step, fallbackStatus) {
    if (!isPlainObject(step)) return { status: fallbackStatus };

    const safe = clone(sanitizeForStorage(step));
    safe.status = typeof safe.status === "string" ? truncate(safe.status, 30) : fallbackStatus;
    return safe;
  }

  function sanitizeStoredRun(item) {
    if (!isPlainObject(item)) return null;
    if (typeof item.id !== "string" || !item.id) return null;
    if (typeof item.startedAt !== "string" || Number.isNaN(Date.parse(item.startedAt))) return null;

    let status = typeof item.status === "string" ? item.status : "";

    const interrupted = status === STATUS.RUNNING;
    if (!VALID_RUN_STATUSES.has(status) || interrupted) status = STATUS.FAILED;

    const messages = Array.isArray(item.messages)
      ? item.messages
          .filter(isPlainObject)
          .slice(0, MAX_MESSAGES_PER_RUN)
          .map(message => ({
            at: typeof message.at === "string" ? message.at : "",
            level: ["info", "warn", "error"].includes(message.level) ? message.level : "info",
            step: typeof message.step === "string" ? truncate(message.step, 30) : "",
            text: truncate(message.text === undefined ? "" : message.text, 500)
          }))
      : [];

    if (interrupted) {
      messages.push({
        at: "",
        level: "error",
        step: "engine",
        text: "This run was stored while still running and was marked FAILED because it was interrupted."
      });
    }

    return {
      id: truncate(item.id, 100),
      engineVersion: typeof item.engineVersion === "string" ? truncate(item.engineVersion, 20) : "",
      mode: "simulation",
      workflowId: typeof item.workflowId === "string" ? truncate(item.workflowId, 100) : "",
      workflowName: typeof item.workflowName === "string" ? truncate(item.workflowName, 100) : "(unknown workflow)",
      status,
      summary: typeof item.summary === "string" ? truncate(item.summary, 500) : "",
      startedAt: item.startedAt,
      finishedAt: typeof item.finishedAt === "string" ? item.finishedAt : null,
      durationMs: Number.isFinite(item.durationMs) ? item.durationMs : null,
      testInput: isPlainObject(item.testInput) ? sanitizeForStorage(item.testInput) : {},
      validation: isPlainObject(item.validation)
        ? {
            ok: Boolean(item.validation.ok),
            errors: Array.isArray(item.validation.errors) ? item.validation.errors.slice(0, 20).map(text => truncate(text, 300)) : [],
            warnings: Array.isArray(item.validation.warnings) ? item.validation.warnings.slice(0, 20).map(text => truncate(text, 300)) : []
          }
        : { ok: false, errors: [], warnings: [] },
      trigger: sanitizeStoredStep(item.trigger, "NOT_RUN"),
      condition: sanitizeStoredStep(item.condition, "NOT_RUN"),
      action: sanitizeStoredStep(item.action, "NOT_RUN"),
      messages,
      error: isPlainObject(item.error)
        ? { code: truncate(item.error.code || "ERROR", 60), message: truncate(item.error.message || "", 500) }
        : null
    };
  }

  function loadHistory() {
    try {
      const stored = window.localStorage.getItem(RUNS_STORAGE_KEY);
      if (!stored) return [];

      const parsed = JSON.parse(stored);

      if (!isPlainObject(parsed) || parsed.version !== RUNS_SCHEMA_VERSION || !Array.isArray(parsed.runs)) {
        console.warn("Alpha-O Engine: Run history has an unknown format and was ignored.");
        return [];
      }

      return parsed.runs
        .map(sanitizeStoredRun)
        .filter(Boolean)
        .slice(0, MAX_STORED_RUNS);
    } catch (error) {
      console.warn("Alpha-O Engine: Run history could not be read and was ignored.", error);
      return [];
    }
  }

  function saveHistory() {
    const attempt = count => {
      window.localStorage.setItem(
        RUNS_STORAGE_KEY,
        JSON.stringify({ version: RUNS_SCHEMA_VERSION, runs: history.slice(0, count) })
      );
    };

    try {
      attempt(MAX_STORED_RUNS);
      return true;
    } catch (firstError) {
      try {
        attempt(Math.floor(MAX_STORED_RUNS / 2));
        history = history.slice(0, Math.floor(MAX_STORED_RUNS / 2));
        return true;
      } catch (secondError) {
        console.warn("Alpha-O Engine: Run history could not be saved.", secondError);
        return false;
      }
    }
  }

  function emit(event) {
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error("Alpha-O Engine: A listener failed.", error);
      }
    });
  }

  function subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("subscribe needs a function.");
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getRuns() {
    return [
      ...Array.from(activeRuns.values()).reverse().map(clone),
      ...history.map(clone)
    ];
  }

  function getRun(runId) {
    const active = activeRuns.get(runId);
    if (active) return clone(active);

    const stored = history.find(run => run.id === runId);
    return stored ? clone(stored) : null;
  }

  function clearHistory() {
    history = [];

    try {
      window.localStorage.removeItem(RUNS_STORAGE_KEY);
    } catch (error) {
      console.warn("Alpha-O Engine: Run history could not be cleared from storage.", error);
    }

    emit({ type: "history-cleared" });
  }

  function isRunning(workflowId) {
    return runningWorkflowKeys.has(String(workflowId));
  }

  /* ------------------------------------------------------------------ */
  /* Execution                                                           */
  /* ------------------------------------------------------------------ */

  function log(run, level, step, text) {
    if (run.messages.length >= MAX_MESSAGES_PER_RUN) return;
    run.messages.push({ at: nowISO(), level, step, text: truncate(text, 500) });
  }

  function withTimeout(promise, ms) {
    let timer;

    const timeout = new Promise((resolve, reject) => {
      timer = window.setTimeout(
        () => reject(new EngineError("TIMEOUT", `The simulated action took longer than ${ms / 1000} seconds.`)),
        ms
      );
    });

    return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
  }

  function summaryFor(status, run) {
    switch (status) {
      case STATUS.SUCCESS:
        return "Simulation completed. Nothing was sent, created, or changed outside this page.";
      case STATUS.SKIPPED:
        return "The condition was not met for this test input, so the action was skipped.";
      case STATUS.UNSUPPORTED:
        return run.error ? `Not run: ${run.error.message}` : "Part of this workflow is not supported by the engine yet.";
      case STATUS.FAILED:
        return run.error ? `Failed: ${run.error.message}` : "The test run failed.";
      default:
        return "";
    }
  }

  async function execute(run, normalized, input) {
    const { workflow } = normalized;

    log(run, "info", "validation", "Validating workflow data.");

    normalized.warnings.forEach(text => log(run, "warn", "validation", text));
    normalized.defaultsApplied.forEach(text => log(run, "warn", "validation", text));

    if (normalized.errors.length) {
      normalized.errors.forEach(text => log(run, "error", "validation", text));
      return {
        status: STATUS.FAILED,
        error: { code: "VALIDATION_FAILED", message: normalized.errors.join(" ") }
      };
    }

    log(run, "info", "validation", "Workflow data is valid.");

    await sleep(STEP_DELAY_MS);

    /* --- Trigger --- */
    const trigger = triggers.get(workflow.trigger);

    if (!trigger) {
      const message = `Trigger "${truncate(workflow.trigger, 60)}" is not supported by this engine version.`;
      run.trigger = { key: workflow.trigger, label: workflow.trigger, status: "UNSUPPORTED", summary: message, notes: [] };
      log(run, "error", "trigger", message);
      return { status: STATUS.UNSUPPORTED, error: { code: "UNSUPPORTED_TRIGGER", message } };
    }

    const triggerResult = trigger.simulate({ workflow, input });

    run.trigger = {
      key: workflow.trigger,
      label: trigger.label,
      status: "SIMULATED",
      summary: triggerResult.summary,
      notes: triggerResult.notes || []
    };

    log(run, "info", "trigger", triggerResult.summary);
    emit({ type: "run-updated", run: clone(run) });

    await sleep(STEP_DELAY_MS);

    /* --- Condition --- */
    const condition = evaluateCondition(workflow.condition, input);
    run.condition = condition;

    log(
      run,
      condition.status === "MET" || condition.status === "NOT_APPLICABLE" ? "info" : "warn",
      "condition",
      condition.summary
    );
    emit({ type: "run-updated", run: clone(run) });

    if (condition.status === "UNSUPPORTED") {
      return {
        status: STATUS.UNSUPPORTED,
        error: { code: "UNSUPPORTED_CONDITION", message: condition.summary }
      };
    }

    if (condition.status === "ERROR") {
      return {
        status: STATUS.FAILED,
        error: { code: "CONDITION_ERROR", message: condition.summary }
      };
    }

    if (condition.status === "NOT_MET") {
      run.action = { key: workflow.action, label: "", status: "NOT_RUN", summary: "Skipped because the condition was not met.", notes: [] };
      log(run, "info", "action", "Action skipped because the condition was not met.");
      return { status: STATUS.SKIPPED, error: null };
    }

    await sleep(STEP_DELAY_MS);

    /* --- Action --- */
    const action = actions.get(workflow.action);

    if (!action) {
      const message = `Action "${truncate(workflow.action, 60)}" is not supported by this engine version.`;
      run.action = { key: workflow.action, label: workflow.action, status: "UNSUPPORTED", summary: message, notes: [] };
      log(run, "error", "action", message);
      return { status: STATUS.UNSUPPORTED, error: { code: "UNSUPPORTED_ACTION", message } };
    }

    try {
      const result = await withTimeout(
        Promise.resolve().then(() => action.simulate({ workflow, input })),
        ACTION_TIMEOUT_MS
      );

      run.action = {
        key: workflow.action,
        label: action.label,
        status: "SIMULATED",
        simulated: true,
        summary: result.summary,
        preview: sanitizeForStorage(result.preview || {}),
        notes: result.notes || []
      };

      log(run, "info", "action", `${result.summary} (simulation only)`);
      return { status: STATUS.SUCCESS, error: null };
    } catch (error) {
      const code = error instanceof EngineError ? error.code : "ACTION_ERROR";
      const message = error instanceof EngineError ? error.message : "The simulated action raised an unexpected error.";

      if (!(error instanceof EngineError)) console.error("Alpha-O Engine: Action error.", error);

      run.action = { key: workflow.action, label: action.label, status: "FAILED", summary: message, notes: [] };
      log(run, "error", "action", message);
      return { status: STATUS.FAILED, error: { code, message } };
    }
  }

  function finishRun(run, outcome) {
    run.status = outcome.status;
    run.error = outcome.error || null;
    run.finishedAt = nowISO();
    run.durationMs = Math.max(0, Date.parse(run.finishedAt) - Date.parse(run.startedAt));
    run.summary = summaryFor(run.status, run);

    ["trigger", "condition", "action"].forEach(step => {
      if (run[step].status === "PENDING") run[step].status = "NOT_RUN";
    });

    log(run, run.status === STATUS.SUCCESS ? "info" : "warn", "engine", `Run finished with status ${run.status}.`);

    activeRuns.delete(run.id);

    history.unshift(clone(run));
    history = history.slice(0, MAX_STORED_RUNS);

    const saved = saveHistory();

    emit({ type: "run-finished", run: clone(run) });

    if (!saved) emit({ type: "storage-error" });
  }

  /**
   * Runs one workflow test.
   *   workflow         A saved workflow draft (a copy is used; it is never modified).
   *   options.testInput  Plain object of explicit test values.
   *   options.onStart    Optional callback receiving the new RUNNING run.
   * Resolves to { accepted: true, run } or { accepted: false, reason, message }.
   * Only one test per workflow may run at a time; other workflows can run in parallel.
   */
  async function runWorkflow(workflow, options = {}) {
    const settings = isPlainObject(options) ? options : {};

    // Work on a private snapshot so edits or deletes during a run cannot affect it.
    let snapshot = workflow;
    try {
      snapshot = isPlainObject(workflow) ? clone(workflow) : workflow;
    } catch (error) {
      snapshot = null;
    }

    const normalized = normalizeWorkflow(snapshot);
    const lockKey = normalized.workflow && normalized.workflow.id ? normalized.workflow.id : null;

    // The lock is taken before any await, so rapid double clicks cannot both pass.
    if (lockKey !== null) {
      if (runningWorkflowKeys.has(lockKey)) {
        return {
          accepted: false,
          reason: "ALREADY_RUNNING",
          message: "A test for this workflow is already running."
        };
      }
      runningWorkflowKeys.add(lockKey);
    }

    const inputCheck = validateTestInput(settings.testInput);
    const input = inputCheck.ok ? inputCheck.value : {};

    const nameSource = normalized.workflow && normalized.workflow.name
      ? normalized.workflow.name
      : isPlainObject(snapshot) && typeof snapshot.name === "string" && snapshot.name.trim()
        ? snapshot.name
        : "(unknown workflow)";

    if (!inputCheck.ok) normalized.errors.push(inputCheck.message);

    const run = {
      id: createRunId(),
      engineVersion: ENGINE_VERSION,
      mode: "simulation",
      workflowId: lockKey || "",
      workflowName: truncate(nameSource, 100),
      status: STATUS.RUNNING,
      summary: "",
      startedAt: nowISO(),
      finishedAt: null,
      durationMs: null,
      testInput: isPlainObject(input) ? sanitizeForStorage(input) : {},
      validation: {
        ok: normalized.errors.length === 0,
        errors: normalized.errors.slice(),
        warnings: normalized.warnings.concat(normalized.defaultsApplied)
      },
      trigger: { status: "PENDING" },
      condition: { status: "PENDING" },
      action: { status: "PENDING" },
      messages: [],
      error: null
    };

    activeRuns.set(run.id, run);

    emit({ type: "run-started", run: clone(run) });

    if (typeof settings.onStart === "function") {
      try {
        settings.onStart(clone(run));
      } catch (error) {
        console.error("Alpha-O Engine: onStart callback failed.", error);
      }
    }

    let outcome;

    try {
      await sleep(STEP_DELAY_MS);
      outcome = await execute(run, normalized, input);
    } catch (error) {
      console.error("Alpha-O Engine: Unexpected error.", error);
      log(run, "error", "engine", "An unexpected engine error stopped this run.");
      outcome = {
        status: STATUS.FAILED,
        error: { code: "ENGINE_ERROR", message: "An unexpected engine error stopped this run." }
      };
    } finally {
      if (lockKey !== null) runningWorkflowKeys.delete(lockKey);
    }

    finishRun(run, outcome);

    return { accepted: true, run: clone(run) };
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  window.AlphaOEngine = Object.freeze({
    version: ENGINE_VERSION,
    mode: "simulation",
    STATUS,
    RUNS_STORAGE_KEY,
    MAX_STORED_RUNS,
    MAX_TEST_INPUT_CHARS,
    CONDITION_SYNTAX_HELP,
    getSampleInput: () => clone(SAMPLE_TEST_INPUT),
    runWorkflow,
    isRunning,
    getRuns,
    getRun,
    clearHistory,
    subscribe,
    registerTrigger,
    registerAction,
    // Exposed for testing and for future tooling:
    normalizeWorkflow,
    evaluateCondition
  });

  /*
   * Future expansion (NOT implemented; nothing below works yet)
   *   - Server-side engine: replace runWorkflow() with a call to an authenticated
   *     backend endpoint and keep this module as the "dry run" / test mode.
   *     registerTrigger / registerAction already separate "what a step is" from
   *     "how it executes", so real handlers can be swapped in per environment.
   *   - Real triggers, schedules, retries and failure recovery require a
   *     background worker. Browser code cannot do this when the tab is closed.
   *   - Gmail and Google Sheets must be connected through server-side OAuth.
   *     Never put API keys, tokens or credentials in browser JavaScript.
   *   - Authentication, authorization and server-side logging are required
   *     before any real action is allowed to run.
   */
})();
