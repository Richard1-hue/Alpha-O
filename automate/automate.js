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
    description: $("#workflowDescription"),
    count: $("#descCount"),
    heading: $("#editorHeading"),
    newButton: $("#newWorkflow"),
    cancelButton: $("#cancelWorkflow"),
    cancelBottom: $("#cancelWorkflowBottom"),
    closeButton: $("#closeAutomate"),
    toast: $("#toastRegion")
  };

  const TYPE_LABELS = {
    business: "Business operations",
    communication: "Communication",
    productivity: "Productivity",
    reporting: "Data and reporting",
    other: "Other",
    // Legacy values from earlier drafts
    data: "Data and reporting",
    custom: "Other"
  };

  const TYPE_ICONS = {
    communication: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
    productivity: '<path d="m5 12 4 4L19 6"/>',
    reporting: '<path d="M4 19V5m0 14h17"/><rect x="7" y="11" width="3" height="5" rx="1"/><rect x="13" y="7" width="3" height="9" rx="1"/>',
    business: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
    other: '<rect x="4" y="4" width="6" height="6" rx="2"/><rect x="14" y="14" width="6" height="6" rx="2"/><path d="M10 7h3a3 3 0 0 1 3 3v4"/>'
  };
  TYPE_ICONS.data = TYPE_ICONS.reporting;
  TYPE_ICONS.custom = TYPE_ICONS.other;

  const ICON_EDIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  const ICON_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>';
  const ICON_ERR = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3h.01"/></svg>';

  const templates = {
    "email-follow-up": {
      name: "Email follow-up",
      type: "communication",
      description: "Prepare a follow-up message after a meeting, request, or important conversation."
    },
    "task-management": {
      name: "Task management",
      type: "productivity",
      description: "Organize tasks by priority, deadline, and status to make the next action clear."
    },
    "data-reporting": {
      name: "Data reporting",
      type: "reporting",
      description: "Prepare a structured report from collected data, highlighting important changes and results."
    }
  };

  let workflows = loadWorkflows();
  let editingId = null;
  let lastFocus = null;
  let deleteArmed = null;
  let deleteTimer = null;

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
      console.error("Alpha-O Automate: Could not load saved drafts.", error);
      return [];
    }
  }

  function persistWorkflows() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
      return true;
    } catch (error) {
      console.error("Alpha-O Automate: Could not save drafts.", error);
      showToast("Could not save drafts. Check your browser storage and try again.", "error");
      return false;
    }
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function formatType(type) {
    return TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
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
    if (days < 7) return `Updated ${days} day${days > 1 ? "s" : ""} ago`;
    return `Updated ${new Date(time).toLocaleDateString()}`;
  }

  /* ---------- Toasts ---------- */
  function showToast(message, kind = "success") {
    if (!elements.toast) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${kind}`;
    toast.innerHTML = `${kind === "error" ? ICON_ERR : ICON_OK}<span></span>`;
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

  /* ---------- Rendering ---------- */
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
    // Workflows stay drafts until a real execution system is connected.
    setStat(elements.active, 0);
  }

  function setEmptyState(title, text) {
    if (!elements.empty) return;
    const titleNode = $(".empty-title", elements.empty);
    const textNode = $(".empty-text", elements.empty);
    if (titleNode) titleNode.textContent = title;
    if (textNode) textNode.textContent = text;
  }

  function renderList() {
    if (!elements.list) return;

    const query = (elements.search?.value || "").trim().toLowerCase();
    const filtered = workflows.filter(workflow =>
      [workflow.name, formatType(workflow.type), workflow.description]
        .join(" ").toLowerCase().includes(query)
    );

    $$(".workflow-card", elements.list).forEach(card => card.remove());

    if (elements.empty) {
      elements.empty.hidden = filtered.length > 0;
    }

    if (filtered.length === 0) {
      if (query) {
        setEmptyState("No matching workflows", "Try another search term or create a new workflow.");
      } else {
        setEmptyState("No workflows yet", "Create a workflow or start with one of the templates above.");
      }
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(workflow => {
      const card = document.createElement("article");
      card.className = "workflow-card";
      const icon = TYPE_ICONS[workflow.type] || TYPE_ICONS.other;
      const id = escapeHTML(workflow.id);

      card.innerHTML = `
        <div class="workflow-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icon}</svg></div>
        <div class="workflow-main">
          <div class="workflow-title-row">
            <h3 class="workflow-name">${escapeHTML(workflow.name)}</h3>
            <span class="badge badge-draft">Draft</span>
            <span class="badge">${escapeHTML(formatType(workflow.type))}</span>
          </div>
          <p class="workflow-description">${escapeHTML(workflow.description || "No description provided.")}</p>
          <div class="workflow-meta">${escapeHTML(timeAgo(workflow.updatedAt))}</div>
        </div>
        <div class="workflow-card-actions">
          <button class="action-button" type="button" data-action="edit" data-id="${id}">${ICON_EDIT}Edit</button>
          <button class="action-button action-delete" type="button" data-action="delete" data-id="${id}">${ICON_TRASH}<span>Delete</span></button>
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

  /* ---------- Editor ---------- */
  function updateCount() {
    if (elements.count && elements.description) {
      elements.count.textContent = `${elements.description.value.length} / ${elements.description.maxLength}`;
    }
  }

  function clearInvalid() {
    $$(".invalid", elements.form).forEach(field => field.classList.remove("invalid"));
  }

  function openEditor(workflow = null, prefill = null) {
    if (!elements.editor || !elements.form) return;

    lastFocus = document.activeElement;
    editingId = workflow ? workflow.id : null;
    const source = workflow || prefill;

    elements.form.reset();
    clearInvalid();

    if (elements.id) elements.id.value = workflow ? workflow.id : "";
    if (elements.name) elements.name.value = source ? source.name : "";
    if (elements.type) {
      elements.type.value = source ? source.type : "business";
      if (!elements.type.value) elements.type.value = "other";
    }
    if (elements.description) elements.description.value = source ? source.description : "";
    if (elements.heading) {
      elements.heading.textContent = workflow ? "Edit workflow" : "Create a workflow";
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

    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    lastFocus = null;
  }

  function saveWorkflow(event) {
    event.preventDefault();
    clearInvalid();

    const name = elements.name?.value.trim() || "";
    const type = elements.type?.value || "other";
    const description = elements.description?.value.trim() || "";

    if (!name) {
      elements.name?.classList.add("invalid");
      elements.name?.focus();
      showToast("Enter a workflow name before saving.", "error");
      return;
    }

    if (!description) {
      elements.description?.classList.add("invalid");
      elements.description?.focus();
      showToast("Describe what this workflow should do.", "error");
      return;
    }

    const existing = editingId ? workflows.find(item => item.id === editingId) : null;

    const workflow = {
      id: existing ? existing.id : createId(),
      name,
      type,
      description,
      status: "draft",
      updatedAt: new Date().toISOString()
    };

    const previous = workflows;
    workflows = existing
      ? workflows.map(item => (item.id === existing.id ? workflow : item))
      : [workflow, ...workflows];

    if (!persistWorkflows()) {
      workflows = previous;
      return;
    }

    closeEditor();
    render();
    showToast(existing ? "Draft updated." : "Draft saved.");
  }

  function startTemplate(key) {
    const template = templates[key];
    if (!template) {
      showToast("That template could not be found.", "error");
      return;
    }
    openEditor(null, template);
  }

  /* ---------- Delete (two-step, no browser popup) ---------- */
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
      deleteTimer = window.setTimeout(disarmDelete, 3000);
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
    const button = event.target.closest("button[data-action]");
    if (!button || !elements.list.contains(button)) return;

    const id = button.dataset.id;
    const workflow = workflows.find(item => item.id === id);
    if (!workflow) return;

    if (button.dataset.action === "edit") {
      disarmDelete();
      openEditor(workflow);
    } else if (button.dataset.action === "delete") {
      deleteWorkflow(id, button);
    }
  }

  /* ---------- Close the Automate panel (call unchanged) ---------- */
  function closeAutomatePanel() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(CLOSE_MESSAGE, window.location.origin);
    } else {
      window.close();
    }
  }

  function trapFocus(event) {
    if (event.key !== "Tab" || !elements.editor || elements.editor.hidden) return;
    const focusable = $$("button, input, select, textarea", elements.editor).filter(node => !node.disabled && node.type !== "hidden");
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function init() {
    elements.form?.addEventListener("submit", saveWorkflow);
    elements.newButton?.addEventListener("click", () => openEditor());
    elements.cancelButton?.addEventListener("click", closeEditor);
    elements.cancelBottom?.addEventListener("click", closeEditor);
    elements.closeButton?.addEventListener("click", closeAutomatePanel);

    elements.editor?.addEventListener("mousedown", event => {
      if (event.target === elements.editor) closeEditor();
    });
    elements.description?.addEventListener("input", updateCount);
    elements.name?.addEventListener("input", () => elements.name.classList.remove("invalid"));
    elements.search?.addEventListener("input", renderList);
    elements.list?.addEventListener("click", handleListClick);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && elements.editor && !elements.editor.hidden) {
        closeEditor();
      }
      trapFocus(event);
    });

    $$("[data-workflow-template]").forEach(button => {
      button.addEventListener("click", () => startTemplate(button.dataset.workflowTemplate));
    });

    render();
  }

  init();
})();
