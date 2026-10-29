"use strict";

(() => {
  const STORAGE_KEY = "alphaO.automate.workflows.v1";
  const CLOSE_MESSAGE = { type: "ALPHA_O_AUTOMATE_CLOSE" };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const elements = {
    total: $("#totalWorkflows"),
    drafts: $("#draftWorkflows"),
    active: $("#activeWorkflows"),
    list: $("#workflowList"),
    empty: $("#workflowEmpty"),
    search: $("#workflowSearch"),
    editor: $("#workflowEditor"),
    form: $("#workflowForm"),
    id: $("#workflowId"),
    name: $("#workflowName"),
    type: $("#workflowType"),
    trigger: $("#workflowTrigger"),
    action: $("#workflowAction"),
    condition: $("#workflowCondition"),
    description: $("#workflowDescription"),
    count: $("#descCount"),
    heading: $("#editorHeading"),
    newButton: $("#newWorkflow"),
    cancelButton: $("#cancelWorkflow"),
    cancelBottom: $("#cancelWorkflowBottom"),
    closeButton: $("#closeAutomate"),
    toast: $("#toastRegion")
  };

  // The execution engine (automate/engine.js) is loaded before this file.
  // If it failed to load, the builder keeps working and Run Test explains why.
  const engine = window.AlphaOEngine || null;

  const TYPE_LABELS = {
    business: "Business operations",
    communication: "Communication",
    productivity: "Productivity",
    reporting: "Data and reporting",
    other: "Other",
    data: "Data and reporting",
    custom: "Other"
  };

  const TYPE_ICONS = {
    communication:
      '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
    productivity:
      '<path d="m5 12 4 4L19 6"/>',
    reporting:
      '<path d="M4 19V5m0 14h17"/><rect x="7" y="11" width="3" height="5" rx="1"/><rect x="13" y="7" width="3" height="9" rx="1"/>',
    business:
      '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
    other:
      '<rect x="4" y="4" width="6" height="6" rx="2"/><rect x="14" y="14" width="6" height="6" rx="2"/><path d="M10 7h3a3 3 0 0 1 3 3v4"/>'
  };

  TYPE_ICONS.data = TYPE_ICONS.reporting;
  TYPE_ICONS.custom = TYPE_ICONS.other;

  const TRIGGER_LABELS = {
    manual: "Manually started",
    schedule: "On a schedule",
    "new-email": "A new email arrives",
    "form-submission": "A form is submitted",
    "file-added": "A file is added",
    webhook: "A webhook is received"
  };

  const ACTION_LABELS = {
    summarize: "Summarize information",
    "draft-email": "Draft an email",
    "create-task": "Create or organize a task",
    "analyze-data": "Analyze data and prepare a report",
    notify: "Prepare a notification",
    "process-file": "Process a file"
  };

  const ICON_EDIT =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/></svg>';

  const ICON_TRASH =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';

  const ICON_PLAY =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';

  const ICON_OK =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>';

  const ICON_ERR =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3h.01"/></svg>';

  // Defaults also keep older saved drafts compatible.
  const DEFAULT_TRIGGER = "manual";
  const DEFAULT_ACTION = "summarize";

  const templates = {
    "email-follow-up": {
      name: "Email follow-up",
      type: "communication",
      trigger: "manual",
      action: "draft-email",
      condition: "",
      description:
        "Prepare a follow-up message after a meeting, request, or important conversation."
    },

    "task-management": {
      name: "Task management",
      type: "productivity",
      trigger: "manual",
      action: "create-task",
      condition: "",
      description:
        "Organize tasks by priority, deadline, and status to make the next action clear."
    },

    "data-reporting": {
      name: "Data reporting",
      type: "reporting",
      trigger: "schedule",
      action: "analyze-data",
      condition: "",
      description:
        "Prepare a structured report from collected data, highlighting important changes and results."
    }
  };

  let workflows = loadWorkflows();
  let editingId = null;
  let lastFocus = null;
  let deleteArmed = null;
  let deleteTimer = null;

  // Test-run panel state
  const engineEls = {};
  let selectedRunId = null;
  let clearArmed = false;
  let clearTimer = null;

  /* ---------- Storage ---------- */

  function loadWorkflows() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];

      if (!Array.isArray(parsed)) return [];

      return parsed.filter(item =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.type === "string" &&
        typeof item.description === "string"
      );
    } catch (error) {
      console.error(
        "Alpha-O Automate: Could not load saved drafts.",
        error
      );
      return [];
    }
  }

  function persistWorkflows() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
      return true;
    } catch (error) {
      console.error(
        "Alpha-O Automate: Could not save drafts.",
        error
      );
      showToast(
        "Could not save drafts. Check your browser storage and try again.",
        "error"
      );
      return false;
    }
  }

  function createId() {
    if (window.crypto &&
        typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `workflow-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  /* ---------- Helpers ---------- */

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function formatType(type) {
    return TYPE_LABELS[type] ||
      type.charAt(0).toUpperCase() + type.slice(1);
  }

  function formatTrigger(trigger) {
    return TRIGGER_LABELS[trigger] ||
      TRIGGER_LABELS[DEFAULT_TRIGGER];
  }

  function formatAction(action) {
    return ACTION_LABELS[action] ||
      ACTION_LABELS[DEFAULT_ACTION];
  }

  function timeAgo(iso) {
    const time = Date.parse(iso);

    if (!time) return "";

    const seconds = Math.max(0, (Date.now() - time) / 1000);

    if (seconds < 60) return "Updated just now";

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) return `Updated ${minutes} min ago`;

    const hours = Math.floor(minutes / 60);

    if (hours < 24) return `Updated ${hours} hr ago`;

    const days = Math.floor(hours / 24);

    if (days < 7) {
      return `Updated ${days} day${days > 1 ? "s" : ""} ago`;
    }

    return `Updated ${new Date(time).toLocaleDateString()}`;
  }

  /* ---------- Notifications ---------- */

  function showToast(message, kind = "success") {
    if (!elements.toast) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${kind}`;
    toast.innerHTML =
      `${kind === "error" || kind === "warn" ? ICON_ERR : ICON_OK}<span></span>`;

    $("span", toast).textContent = message;

    while (elements.toast.children.length >= 3) {
      elements.toast.firstElementChild.remove();
    }

    elements.toast.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add("leaving");
      window.setTimeout(() => toast.remove(), 220);
    }, 3200);
  }

  /* ---------- Statistics ---------- */

  function setStat(node, value) {
    if (!node) return;

    const next = String(value);

    if (node.textContent === next) return;

    node.textContent = next;
    node.classList.remove("bump");

    void node.offsetWidth;

    node.classList.add("bump");
  }

  function renderStats() {
    setStat(elements.total, workflows.length);
    setStat(elements.drafts, workflows.length);

    // Drafts are not running automations.
    setStat(elements.active, 0);
  }

  function setEmptyState(title, text) {
    if (!elements.empty) return;

    const titleNode = $(".empty-title", elements.empty);
    const textNode = $(".empty-text", elements.empty);

    if (titleNode) titleNode.textContent = title;
    if (textNode) textNode.textContent = text;
  }

  /* ---------- Workflow list ---------- */

  function renderList() {
    if (!elements.list) return;

    const query = (elements.search?.value || "")
      .trim()
      .toLowerCase();

    const filtered = workflows.filter(workflow => {
      const searchable = [
        workflow.name,
        formatType(workflow.type),
        formatTrigger(workflow.trigger || DEFAULT_TRIGGER),
        formatAction(workflow.action || DEFAULT_ACTION),
        workflow.condition || "",
        workflow.description
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    });

    $$(".workflow-card", elements.list).forEach(card => card.remove());

    if (elements.empty) {
      elements.empty.hidden = filtered.length > 0;
    }

    if (filtered.length === 0) {
      if (query) {
        setEmptyState(
          "No matching workflows",
          "Try another search term or create a new workflow."
        );
      } else {
        setEmptyState(
          "No workflows yet",
          "Create a workflow or start with one of the templates above."
        );
      }
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(workflow => {
      const card = document.createElement("article");
      card.className = "workflow-card";

      const icon = TYPE_ICONS[workflow.type] || TYPE_ICONS.other;
      const id = escapeHTML(workflow.id);
      const trigger = formatTrigger(
        workflow.trigger || DEFAULT_TRIGGER
      );
      const action = formatAction(
        workflow.action || DEFAULT_ACTION
      );
      const condition = (workflow.condition || "").trim();

      const conditionSummary = condition
        ? `<span><b>IF</b> ${escapeHTML(condition)}</span>`
        : "";

      const running = Boolean(engine && engine.isRunning(workflow.id));

      card.innerHTML = `
        <div class="workflow-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">${icon}</svg>
        </div>

        <div class="workflow-main">
          <div class="workflow-title-row">
            <h3 class="workflow-name">
              ${escapeHTML(workflow.name)}
            </h3>
            <span class="badge badge-draft">Draft</span>
            <span class="badge">
              ${escapeHTML(formatType(workflow.type))}
            </span>
          </div>

          <p class="workflow-description">
            ${escapeHTML(
              workflow.description || "No description provided."
            )}
          </p>

          <div class="workflow-flow-summary">
            <span><b>WHEN</b> ${escapeHTML(trigger)}</span>
            <span><b>DO</b> ${escapeHTML(action)}</span>
            ${conditionSummary}
          </div>

          <div class="workflow-meta">
            ${escapeHTML(timeAgo(workflow.updatedAt))}
          </div>
        </div>

        <div class="workflow-card-actions">
          <button
            class="action-button action-run${running ? " running" : ""}"
            type="button"
            data-action="run"
            data-id="${id}"
            aria-busy="${running ? "true" : "false"}"
            ${running ? "disabled" : ""}
          >${ICON_PLAY}<span>${running ? "Running…" : "Run Test"}</span></button>

          <button
            class="action-button"
            type="button"
            data-action="edit"
            data-id="${id}"
          >${ICON_EDIT}Edit</button>

          <button
            class="action-button action-delete"
            type="button"
            data-action="delete"
            data-id="${id}"
          >${ICON_TRASH}<span>Delete</span></button>
        </div>
      `;

      fragment.appendChild(card);
    });

    elements.list.appendChild(fragment);
  }

  function render() {
    renderStats();
    renderList();
  }

  /* ---------- Workflow editor ---------- */

  function updateCount() {
    if (elements.count && elements.description) {
      elements.count.textContent =
        `${elements.description.value.length} / ` +
        `${elements.description.maxLength}`;
    }
  }

  function clearInvalid() {
    if (!elements.form) return;

    $$(".invalid", elements.form).forEach(field => {
      field.classList.remove("invalid");
    });
  }

  function openEditor(workflow = null, prefill = null) {
    if (!elements.editor || !elements.form) return;

    lastFocus = document.activeElement;
    editingId = workflow ? workflow.id : null;

    const source = workflow || prefill;

    elements.form.reset();
    clearInvalid();

    if (elements.id) {
      elements.id.value = workflow ? workflow.id : "";
    }

    if (elements.name) {
      elements.name.value = source ? source.name : "";
    }

    if (elements.type) {
      elements.type.value = source ? source.type : "business";

      if (!elements.type.value) {
        elements.type.value = "other";
      }
    }

    if (elements.trigger) {
      elements.trigger.value =
        source?.trigger || DEFAULT_TRIGGER;
    }

    if (elements.action) {
      elements.action.value =
        source?.action || DEFAULT_ACTION;
    }

    if (elements.condition) {
      elements.condition.value =
        source?.condition || "";
    }

    if (elements.description) {
      elements.description.value =
        source ? source.description : "";
    }

    if (elements.heading) {
      elements.heading.textContent = workflow
        ? "Edit workflow"
        : "Create a workflow";
    }

    updateCount();

    elements.editor.hidden = false;
    document.body.style.overflow = "hidden";

    window.setTimeout(() => elements.name?.focus(), 30);
  }

  function closeEditor() {
    if (!elements.editor || elements.editor.hidden) return;

    elements.form?.reset();
    clearInvalid();

    elements.editor.hidden = true;
    document.body.style.overflow = "";

    editingId = null;

    if (lastFocus &&
        typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }

    lastFocus = null;
  }

  function saveWorkflow(event) {
    event.preventDefault();
    clearInvalid();

    const name = elements.name?.value.trim() || "";
    const type = elements.type?.value || "other";

    const trigger =
      elements.trigger?.value || DEFAULT_TRIGGER;

    const action =
      elements.action?.value || DEFAULT_ACTION;

    const condition =
      elements.condition?.value.trim() || "";

    const description =
      elements.description?.value.trim() || "";

    if (!name) {
      elements.name?.classList.add("invalid");
      elements.name?.focus();

      showToast(
        "Enter a workflow name before saving.",
        "error"
      );
      return;
    }

    if (!description) {
      elements.description?.classList.add("invalid");
      elements.description?.focus();

      showToast(
        "Describe what this workflow should do.",
        "error"
      );
      return;
    }

    const existing = editingId
      ? workflows.find(item => item.id === editingId)
      : null;

    const workflow = {
      id: existing ? existing.id : createId(),
      name,
      type,
      trigger,
      action,
      condition,
      description,
      status: "draft",
      updatedAt: new Date().toISOString()
    };

    const previous = workflows;

    workflows = existing
      ? workflows.map(item =>
          item.id === existing.id ? workflow : item
        )
      : [workflow, ...workflows];

    if (!persistWorkflows()) {
      workflows = previous;
      return;
    }

    closeEditor();
    render();

    showToast(
      existing ? "Draft updated." : "Draft saved."
    );
  }

  /* ---------- Templates ---------- */

  function startTemplate(key) {
    const template = templates[key];

    if (!template) {
      showToast(
        "That template could not be found.",
        "error"
      );
      return;
    }

    openEditor(null, template);
  }

  /* ---------- Delete confirmation ---------- */

  function disarmDelete() {
    window.clearTimeout(deleteTimer);

    deleteTimer = null;
    deleteArmed = null;

    $$(".action-delete.confirming").forEach(button => {
      button.classList.remove("confirming");

      const label = $("span", button);

      if (label) label.textContent = "Delete";
    });
  }

  function deleteWorkflow(id, button) {
    if (deleteArmed !== id) {
      disarmDelete();

      deleteArmed = id;
      button.classList.add("confirming");

      const label = $("span", button);

      if (label) label.textContent = "Confirm?";

      deleteTimer = window.setTimeout(
        disarmDelete,
        3000
      );

      return;
    }

    disarmDelete();

    const previous = workflows;

    workflows = workflows.filter(item => item.id !== id);

    if (!persistWorkflows()) {
      workflows = previous;
      return;
    }

    render();
    showToast("Draft deleted.");
  }

  function handleListClick(event) {
    const button = event.target.closest(
      "button[data-action]"
    );

    if (!button || !elements.list.contains(button)) return;

    const id = button.dataset.id;
    const workflow = workflows.find(item => item.id === id);

    if (!workflow) return;

    if (button.dataset.action === "edit") {
      disarmDelete();
      openEditor(workflow);
    } else if (button.dataset.action === "delete") {
      deleteWorkflow(id, button);
    } else if (button.dataset.action === "run") {
      disarmDelete();
      runTest(workflow);
    }
  }

  /* ---------- Test runs: formatting helpers ---------- */

  function formatDateTime(iso) {
    const time = Date.parse(iso);

    return time ? new Date(time).toLocaleString() : "Not recorded";
  }

  function formatDuration(ms) {
    if (!Number.isFinite(ms)) return "Not recorded";

    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
  }

  function statusClass(status) {
    switch (status) {
      case "SUCCESS":
      case "SIMULATED":
      case "MET":
        return "success";
      case "FAILED":
      case "ERROR":
        return "failed";
      case "SKIPPED":
      case "NOT_MET":
        return "skipped";
      case "UNSUPPORTED":
        return "unsupported";
      case "RUNNING":
      case "PENDING":
        return "running";
      default:
        return "neutral";
    }
  }

  function statusPill(status) {
    const label = String(status || "UNKNOWN").replace(/_/g, " ");

    return `<span class="status-pill status-${statusClass(status)}">${escapeHTML(label)}</span>`;
  }

  /* ---------- Test runs: report ---------- */

  function renderNotes(notes) {
    if (!Array.isArray(notes) || !notes.length) return "";

    return `<ul class="run-notes">${notes
      .map(note => `<li>${escapeHTML(note)}</li>`)
      .join("")}</ul>`;
  }

  function renderStep(title, step, bodyHTML) {
    const status = step && step.status ? step.status : "NOT_RUN";

    return `
      <li class="run-step run-step-${statusClass(status)}">
        <div class="run-step-head">
          <span class="run-step-title">${escapeHTML(title)}</span>
          ${statusPill(status)}
        </div>
        <div class="run-step-body">${bodyHTML}</div>
      </li>
    `;
  }

  function renderTriggerStep(run) {
    const step = run.trigger || {};
    let body;

    if (step.status === "PENDING") {
      body = '<p class="run-muted">Waiting…</p>';
    } else if (step.status === "NOT_RUN") {
      body = '<p class="run-muted">Not reached.</p>';
    } else {
      body = `
        <p>${escapeHTML(step.summary || "")}</p>
        ${renderNotes(step.notes)}
      `;
    }

    const title = step.label ? `Trigger: ${step.label}` : "Trigger";

    return renderStep(title, step, body);
  }

  function renderConditionStep(run) {
    const step = run.condition || {};
    let body;

    if (step.status === "PENDING") {
      body = '<p class="run-muted">Waiting…</p>';
    } else if (step.status === "NOT_RUN") {
      body = '<p class="run-muted">Not reached.</p>';
    } else {
      const expression = step.expression
        ? `<p class="run-code">${escapeHTML(step.expression)}</p>`
        : "";

      const clauses = Array.isArray(step.clauses) && step.clauses.length
        ? `<ul class="run-clauses">${step.clauses.map(clause => {
            let outcome;

            if (clause.error) {
              outcome = `<span class="clause-result clause-error">${escapeHTML(clause.error)}</span>`;
            } else {
              outcome = `<span class="clause-result clause-${clause.result ? "true" : "false"}">${clause.result ? "true" : "false"}</span>`;
            }

            const actual = clause.actual === null || clause.actual === undefined
              ? "not in test input"
              : clause.actual;

            return `
              <li>
                <code>${escapeHTML(clause.raw)}</code>
                <span class="run-muted">Test input: ${escapeHTML(actual)}</span>
                ${outcome}
              </li>
            `;
          }).join("")}</ul>`
        : "";

      const help = step.help
        ? `<p class="run-muted">${escapeHTML(step.help)}</p>`
        : "";

      body = `${expression}<p>${escapeHTML(step.summary || "")}</p>${clauses}${help}`;
    }

    return renderStep("Condition", step, body);
  }

  function renderActionStep(run) {
    const step = run.action || {};
    let body;

    if (step.status === "PENDING") {
      body = '<p class="run-muted">Waiting…</p>';
    } else if (step.status === "NOT_RUN" && !step.summary) {
      body = '<p class="run-muted">Not reached.</p>';
    } else {
      const preview = step.preview && typeof step.preview === "object"
        ? `<dl class="run-preview">${Object.keys(step.preview).map(key => `
            <dt>${escapeHTML(key)}</dt>
            <dd>${escapeHTML(step.preview[key])}</dd>
          `).join("")}</dl>`
        : "";

      const label = step.status === "SIMULATED"
        ? '<p class="run-simulated">Simulation only. Nothing real was done.</p>'
        : "";

      body = `
        ${label}
        <p>${escapeHTML(step.summary || "")}</p>
        ${preview}
        ${renderNotes(step.notes)}
      `;
    }

    const title = step.label ? `Action: ${step.label}` : "Action";

    return renderStep(title, step, body);
  }

  function renderReport() {
    if (!engineEls.report) return;

    const run = engine && selectedRunId ? engine.getRun(selectedRunId) : null;

    if (!run) {
      engineEls.report.innerHTML = `
        <div class="run-empty">
          <p class="empty-title">No test selected</p>
          <p class="empty-text">Click Run Test on a workflow, or choose Details in the run history.</p>
        </div>
      `;
      return;
    }

    const validation = run.validation || { errors: [], warnings: [] };

    const validationBlock = validation.errors.length || validation.warnings.length
      ? `
        <div class="run-block ${validation.errors.length ? "run-block-error" : "run-block-warn"}">
          <div class="run-block-title">Validation</div>
          <ul class="run-notes">
            ${validation.errors.map(text => `<li><b>Error:</b> ${escapeHTML(text)}</li>`).join("")}
            ${validation.warnings.map(text => `<li><b>Note:</b> ${escapeHTML(text)}</li>`).join("")}
          </ul>
        </div>
      `
      : "";

    const errorBlock = run.error
      ? `
        <div class="run-block run-block-error">
          <div class="run-block-title">${run.status === "UNSUPPORTED" ? "Unsupported" : "Error"} (${escapeHTML(run.error.code)})</div>
          <p>${escapeHTML(run.error.message)}</p>
        </div>
      `
      : "";

    const messages = Array.isArray(run.messages) ? run.messages : [];

    const logBlock = `
      <details class="run-details">
        <summary>Execution messages (${messages.length})</summary>
        <ol class="run-log">
          ${messages.map(message => `
            <li class="log-${escapeHTML(message.level)}">
              <time>${escapeHTML(message.at ? new Date(message.at).toLocaleTimeString() : "")}</time>
              <span class="log-step">${escapeHTML(message.step)}</span>
              <span>${escapeHTML(message.text)}</span>
            </li>
          `).join("")}
        </ol>
      </details>
    `;

    const inputBlock = `
      <details class="run-details">
        <summary>Test input used (sensitive-looking fields are hidden)</summary>
        <pre class="run-pre">${escapeHTML(JSON.stringify(run.testInput || {}, null, 2))}</pre>
      </details>
    `;

    engineEls.report.innerHTML = `
      <article class="run-report">
        <header class="run-report-head">
          <div class="run-report-title">
            <h4>${escapeHTML(run.workflowName)}</h4>
            <div class="run-meta">Run ID <code>${escapeHTML(run.id)}</code> · Simulation</div>
          </div>
          ${statusPill(run.status)}
        </header>

        ${run.summary ? `<p class="run-summary">${escapeHTML(run.summary)}</p>` : ""}

        <dl class="run-times">
          <div><dt>Started</dt><dd>${escapeHTML(formatDateTime(run.startedAt))}</dd></div>
          <div><dt>Completed</dt><dd>${escapeHTML(run.finishedAt ? formatDateTime(run.finishedAt) : "Still running…")}</dd></div>
          <div><dt>Duration</dt><dd>${escapeHTML(run.finishedAt ? formatDuration(run.durationMs) : "…")}</dd></div>
        </dl>

        ${validationBlock}
        ${errorBlock}

        <ol class="run-steps">
          ${renderTriggerStep(run)}
          ${renderConditionStep(run)}
          ${renderActionStep(run)}
        </ol>

        ${logBlock}
        ${inputBlock}
      </article>
    `;
  }

  /* ---------- Test runs: history ---------- */

  function renderHistory() {
    if (!engineEls.history) return;

    const runs = engine ? engine.getRuns() : [];

    if (engineEls.clear) engineEls.clear.disabled = runs.length === 0;

    if (!runs.length) {
      engineEls.history.innerHTML = `
        <li class="run-empty">
          <p class="empty-title">No test runs yet</p>
          <p class="empty-text">Runs appear here after you click Run Test.</p>
        </li>
      `;
      return;
    }

    engineEls.history.innerHTML = runs.map(run => `
      <li class="run-row${run.id === selectedRunId ? " selected" : ""}">
        <div class="run-row-main">
          <span class="run-row-name">${escapeHTML(run.workflowName)}</span>
          <span class="run-row-time">${escapeHTML(formatDateTime(run.startedAt))}${run.finishedAt ? ` · ${escapeHTML(formatDuration(run.durationMs))}` : ""}</span>
        </div>
        ${statusPill(run.status)}
        <button
          class="action-button"
          type="button"
          data-run-action="view"
          data-run-id="${escapeHTML(run.id)}"
          aria-label="View details for ${escapeHTML(run.workflowName)}, ${escapeHTML(formatDateTime(run.startedAt))}"
        >Details</button>
      </li>
    `).join("");
  }

  function updateRunButtons() {
    $$('button[data-action="run"]', elements.list).forEach(button => {
      const running = Boolean(engine && engine.isRunning(button.dataset.id));

      button.disabled = running;
      button.classList.toggle("running", running);
      button.setAttribute("aria-busy", running ? "true" : "false");

      const label = $("span", button);

      if (label) label.textContent = running ? "Running…" : "Run Test";
    });
  }

  function revealReport() {
    if (!engineEls.report) return;

    const reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    engineEls.report.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest"
    });
  }

  function handleEngineEvent(event) {
    if (event.type === "run-started" || event.type === "run-finished") {
      updateRunButtons();
    }

    renderHistory();

    if (event.type === "history-cleared") {
      selectedRunId = null;
      renderReport();
    } else if (event.run && event.run.id === selectedRunId) {
      renderReport();
    }

    if (event.type === "storage-error") {
      showToast(
        "Run history could not be saved in this browser. It will be lost when you leave the page.",
        "error"
      );
    }
  }

  /* ---------- Test runs: input and running ---------- */

  function showInputError(message) {
    if (!engineEls.inputError || !engineEls.input) return;

    engineEls.inputError.textContent = message || "";
    engineEls.inputError.hidden = !message;

    engineEls.input.classList.toggle("invalid", Boolean(message));
    engineEls.input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function readTestInput() {
    const text = (engineEls.input?.value || "").trim();

    if (!text) return { ok: true, value: {} };

    if (engine && text.length > engine.MAX_TEST_INPUT_CHARS) {
      return {
        ok: false,
        message: `Test input is longer than ${engine.MAX_TEST_INPUT_CHARS} characters.`
      };
    }

    try {
      const value = JSON.parse(text);

      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {
          ok: false,
          message: 'Test input must be a JSON object, for example {"priority": "urgent"}.'
        };
      }

      return { ok: true, value };
    } catch (error) {
      return { ok: false, message: `Test input is not valid JSON: ${error.message}` };
    }
  }

  async function runTest(workflow) {
    if (!engine) {
      showToast(
        "The test engine did not load. Check that engine.js is in the automate folder.",
        "error"
      );
      return;
    }

    const input = readTestInput();

    if (!input.ok) {
      showInputError(input.message);
      engineEls.input?.focus();
      showToast("Fix the test input before running a test.", "error");
      return;
    }

    showInputError("");

    let outcome;

    try {
      outcome = await engine.runWorkflow(workflow, {
        testInput: input.value,
        onStart: run => {
          selectedRunId = run.id;
          renderReport();
          revealReport();
        }
      });
    } catch (error) {
      console.error("Alpha-O Automate: Test run failed unexpectedly.", error);
      showToast("The test could not be run. See the browser console for details.", "error");
      return;
    }

    if (!outcome.accepted) {
      showToast(outcome.message, "warn");
      return;
    }

    const { run } = outcome;

    if (run.status === "SUCCESS") {
      showToast(`Test completed (simulation): ${run.workflowName}`);
    } else if (run.status === "SKIPPED") {
      showToast(`Test skipped, condition not met: ${run.workflowName}`, "warn");
    } else if (run.status === "UNSUPPORTED") {
      showToast(`Test not run, unsupported: ${run.workflowName}`, "warn");
    } else {
      showToast(`Test failed: ${run.workflowName}. See the execution report.`, "error");
    }
  }

  function resetTestInput() {
    if (!engine || !engineEls.input) return;

    engineEls.input.value = JSON.stringify(engine.getSampleInput(), null, 2);
    showInputError("");
  }

  function disarmClear() {
    window.clearTimeout(clearTimer);

    clearTimer = null;
    clearArmed = false;

    if (engineEls.clear) engineEls.clear.textContent = "Clear history";
  }

  function clearRunHistory() {
    if (!engine) return;

    if (!clearArmed) {
      clearArmed = true;
      engineEls.clear.textContent = "Confirm?";
      clearTimer = window.setTimeout(disarmClear, 3000);
      return;
    }

    disarmClear();
    engine.clearHistory();
    showToast("Run history cleared.");
  }

  function handleEnginePanelClick(event) {
    const viewButton = event.target.closest("button[data-run-action='view']");

    if (viewButton) {
      selectedRunId = viewButton.dataset.runId;
      renderReport();
      renderHistory();
      revealReport();
      return;
    }

    if (event.target.closest("#resetTestInput")) {
      resetTestInput();
    } else if (event.target.closest("#clearRunHistory")) {
      clearRunHistory();
    }
  }

  /* ---------- Test runs: panel setup ---------- */

  function mountEnginePanel() {
    const anchor = $(".workflow-section");

    if (!anchor || $("#engineSection")) return;

    const section = document.createElement("section");
    section.className = "section-block engine-section";
    section.id = "engineSection";
    section.setAttribute("aria-labelledby", "engineHeading");

    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h2 id="engineHeading">Test runs</h2>
          <p>Simulated tests only. Nothing is sent, saved to a spreadsheet, or posted.</p>
        </div>
      </div>

      <div class="engine-grid">
        <div class="engine-panel">
          <div class="engine-panel-head">
            <label class="field-label" for="engineTestInput">Test input (JSON)</label>
            <button class="action-button" id="resetTestInput" type="button">Reset sample</button>
          </div>
          <textarea class="text-field engine-input" id="engineTestInput" rows="10" spellcheck="false"
            aria-describedby="engineInputHelp engineInputError"></textarea>
          <div class="engine-input-error" id="engineInputError" role="alert" hidden></div>
          <p class="engine-help" id="engineInputHelp">
            Every Run Test button uses these values. Do not enter real passwords, tokens, or API keys.
          </p>
          <details class="run-details">
            <summary>How conditions are checked</summary>
            <p class="engine-help" id="engineSyntaxHelp"></p>
          </details>
        </div>

        <div class="engine-panel">
          <div class="engine-panel-head">
            <h3 class="engine-subheading">Execution report</h3>
          </div>
          <div class="engine-report" id="engineReport"></div>
        </div>
      </div>

      <div class="engine-panel engine-history-panel">
        <div class="engine-panel-head">
          <h3 class="engine-subheading">Run history</h3>
          <button class="action-button" id="clearRunHistory" type="button">Clear history</button>
        </div>
        <ol class="run-history" id="engineHistory" aria-live="polite"></ol>
      </div>
    `;

    anchor.insertAdjacentElement("afterend", section);

    engineEls.section = section;
    engineEls.input = $("#engineTestInput", section);
    engineEls.inputError = $("#engineInputError", section);
    engineEls.report = $("#engineReport", section);
    engineEls.history = $("#engineHistory", section);
    engineEls.clear = $("#clearRunHistory", section);

    if (engine) {
      resetTestInput();
      $("#engineSyntaxHelp", section).textContent = engine.CONDITION_SYNTAX_HELP;
    } else {
      engineEls.input.disabled = true;
      $("#resetTestInput", section).disabled = true;
      engineEls.clear.disabled = true;
      engineEls.report.innerHTML = `
        <div class="run-empty">
          <p class="empty-title">Test engine not loaded</p>
          <p class="empty-text">Check that engine.js is in the same folder as automate.html and loads before automate.js.</p>
        </div>
      `;
    }

    section.addEventListener("click", handleEnginePanelClick);
  }

  /* ---------- Close the Automate panel ---------- */

  function closeAutomatePanel() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        CLOSE_MESSAGE,
        window.location.origin
      );
    } else {
      window.close();
    }
  }

  /* ---------- Keyboard accessibility ---------- */

  function trapFocus(event) {
    if (
      event.key !== "Tab" ||
      !elements.editor ||
      elements.editor.hidden
    ) {
      return;
    }

    const focusable = $$(
      "button, input, select, textarea",
      elements.editor
    ).filter(node =>
      !node.disabled && node.type !== "hidden"
    );

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------- Initialize ---------- */

  function init() {
    elements.form?.addEventListener(
      "submit",
      saveWorkflow
    );

    elements.newButton?.addEventListener(
      "click",
      () => openEditor()
    );

    elements.cancelButton?.addEventListener(
      "click",
      closeEditor
    );

    elements.cancelBottom?.addEventListener(
      "click",
      closeEditor
    );

    elements.closeButton?.addEventListener(
      "click",
      closeAutomatePanel
    );

    elements.editor?.addEventListener(
      "mousedown",
      event => {
        if (event.target === elements.editor) {
          closeEditor();
        }
      }
    );

    elements.description?.addEventListener(
      "input",
      updateCount
    );

    elements.name?.addEventListener(
      "input",
      () => elements.name.classList.remove("invalid")
    );

    elements.search?.addEventListener(
      "input",
      renderList
    );

    elements.list?.addEventListener(
      "click",
      handleListClick
    );

    document.addEventListener("keydown", event => {
      if (
        event.key === "Escape" &&
        elements.editor &&
        !elements.editor.hidden
      ) {
        closeEditor();
      }

      trapFocus(event);
    });

    $$("[data-workflow-template]").forEach(button => {
      button.addEventListener("click", () => {
        startTemplate(button.dataset.workflowTemplate);
      });
    });

    mountEnginePanel();

    if (engine) engine.subscribe(handleEngineEvent);

    render();
    renderReport();
    renderHistory();
  }

  init();
})();
