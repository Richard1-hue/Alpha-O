
"use strict";

(() => {
  const STORAGE_KEY = "alphaO.automate.workflows.v1";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

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
    newButton: $("#newWorkflow"),
    cancelButton: $("#cancelWorkflow"),
    cancelBottom: $("#cancelWorkflowBottom"),
    closeButton: $("#closeAutomate"),
    toast: $("#toastRegion")
  };

  let workflows = loadWorkflows();
  let editingId = null;
  let toastTimer = null;

  const templates = {
    "email-follow-up": {
      name: "Email Follow-up",
      type: "communication",
      description:
        "Prepare a follow-up message after a meeting, request, or important conversation."
    },
    "task-management": {
      name: "Task Management",
      type: "productivity",
      description:
        "Organize tasks by priority, deadline, and status to make the next action clear."
    },
    "data-reporting": {
      name: "Data Reporting",
      type: "data",
      description:
        "Prepare a structured report from collected data, highlighting important changes and results."
    }
  };

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
      showToast(
        "Could not save drafts. Check browser storage or available space.",
        "error"
      );
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
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function formatType(type) {
    const labels = {
      communication: "Communication",
      productivity: "Productivity",
      data: "Data",
      custom: "Custom"
    };

    return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  function showToast(message, kind = "success") {
    if (!elements.toast) return;

    if (toastTimer) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }

    elements.toast.replaceChildren();

    const toast = document.createElement("div");
    toast.className = `toast toast-${kind}`;
    toast.setAttribute("role", "status");
    toast.textContent = message;

    elements.toast.appendChild(toast);

    toastTimer = window.setTimeout(() => {
      toast.remove();
      toastTimer = null;
    }, 3200);
  }

  function render() {
    renderStats();
    renderList();
  }

  function renderStats() {
    if (elements.total) {
      elements.total.textContent = String(workflows.length);
    }

    if (elements.drafts) {
      elements.drafts.textContent = String(workflows.length);
    }

    // Workflows are drafts until a real execution system is connected.
    if (elements.active) {
      elements.active.textContent = "0";
    }
  }

  function renderList() {
    if (!elements.list) return;

    const query = (elements.search?.value || "").trim().toLowerCase();

    const filtered = workflows.filter(workflow => {
      const searchable = [
        workflow.name,
        workflow.type,
        workflow.description
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    });

    elements.list.replaceChildren();

    if (elements.empty) {
      elements.empty.hidden = filtered.length > 0;
    }

    if (filtered.length === 0 && query && elements.empty) {
      const title = $(".empty-state-title", elements.empty);
      const description = $(".empty-state-description", elements.empty);

      if (title) title.textContent = "No matching workflows";
      if (description) {
        description.textContent =
          "Try another search term or create a new workflow.";
      }
    } else if (elements.empty) {
      const title = $(".empty-state-title", elements.empty);
      const description = $(".empty-state-description", elements.empty);

      if (title) title.textContent = "No workflows yet";
      if (description) {
        description.textContent =
          "Create a workflow or start with one of the templates above.";
      }
    }

    filtered.forEach(workflow => {
      const card = document.createElement("article");
      card.className = "workflow-card";

      card.innerHTML = `
        <div class="workflow-card-header">
          <h3 class="workflow-name">${escapeHTML(workflow.name)}</h3>
          <span class="draft-badge">Draft</span>
        </div>
        <p class="workflow-description">${escapeHTML(
          workflow.description || "No description provided."
        )}</p>
        <div class="workflow-card-footer">
          <span class="workflow-type-badge">${escapeHTML(
            formatType(workflow.type)
          )}</span>
          <div class="workflow-card-actions">
            <button class="btn btn-small" type="button" data-action="edit"
              data-id="${escapeHTML(workflow.id)}">Edit</button>
            <button class="btn btn-small btn-danger" type="button"
              data-action="delete" data-id="${escapeHTML(workflow.id)}">
              Delete
            </button>
          </div>
        </div>
      `;

      elements.list.appendChild(card);
    });
  }

  function openEditor(workflow = null) {
    if (!elements.editor || !elements.form) return;

    editingId = workflow ? workflow.id : null;

    elements.form.reset();

    if (elements.id) {
      elements.id.value = workflow ? workflow.id : "";
    }

    if (elements.name) {
      elements.name.value = workflow ? workflow.name : "";
    }

    if (elements.type) {
      elements.type.value = workflow ? workflow.type : "custom";
    }

    if (elements.description) {
      elements.description.value = workflow ? workflow.description : "";
    }

    const heading = $(".panel-title", elements.editor);
    const subtitle = $(".panel-description", elements.editor);

    if (heading) {
      heading.textContent = workflow ? "Edit workflow" : "Create workflow";
    }

    if (subtitle) {
      subtitle.textContent = workflow
        ? "Update the details of this saved draft."
        : "Define the details of your new workflow.";
    }

    elements.editor.hidden = false;
    elements.editor.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.name?.focus();
  }

  function closeEditor() {
    if (!elements.editor || !elements.form) return;

    elements.form.reset();
    elements.editor.hidden = true;
    editingId = null;
  }

  function saveWorkflow(event) {
    event.preventDefault();

    const name = elements.name?.value.trim() || "";
    const type = elements.type?.value || "custom";
    const description = elements.description?.value.trim() || "";

    if (!name) {
      elements.name?.focus();
      showToast("Enter a workflow name before saving.", "error");
      return;
    }

    const existing = editingId
      ? workflows.find(item => item.id === editingId)
      : null;

    const workflow = {
      id: existing ? existing.id : createId(),
      name,
      type,
      description,
      status: "draft",
      updatedAt: new Date().toISOString()
    };

    const previousWorkflows = workflows;

    workflows = existing
      ? workflows.map(item => item.id === existing.id ? workflow : item)
      : [workflow, ...workflows];

    if (!persistWorkflows()) {
      workflows = previousWorkflows;
      return;
    }

    closeEditor();
    render();
    showToast(existing ? "Workflow draft updated." : "Workflow draft saved.");
  }

  function startTemplate(templateKey) {
    const template = templates[templateKey];

    if (!template) {
      showToast("That workflow template could not be found.", "error");
      return;
    }

    openEditor(template);
  }

  function deleteWorkflow(id) {
    const workflow = workflows.find(item => item.id === id);
    if (!workflow) return;

    const confirmed = window.confirm(
      `Delete the draft "${workflow.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    const previousWorkflows = workflows;
    workflows = workflows.filter(item => item.id !== id);

    if (!persistWorkflows()) {
      workflows = previousWorkflows;
      return;
    }

    if (editingId === id) closeEditor();

    render();
    showToast("Workflow draft deleted.");
  }

  function handleListClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button || !elements.list.contains(button)) return;

    const id = button.dataset.id;
    const action = button.dataset.action;
    const workflow = workflows.find(item => item.id === id);

    if (!workflow) return;

    if (action === "edit") {
      openEditor(workflow);
    } else if (action === "delete") {
      deleteWorkflow(id);
    }
  }

  function closeAutomatePanel() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        "ALPHA_O_AUTOMATE_CLOSE",
        window.location.origin
      );
    } else {
      window.close();
    }
  }

  function init() {
    if (elements.form) {
      elements.form.addEventListener("submit", saveWorkflow);
    }

    elements.newButton?.addEventListener("click", () => openEditor());
    elements.cancelButton?.addEventListener("click", closeEditor);
    elements.cancelBottom?.addEventListener("click", closeEditor);
    elements.closeButton?.addEventListener("click", closeAutomatePanel);

    elements.search?.addEventListener("input", renderList);
    elements.list?.addEventListener("click", handleListClick);

    $$("[data-workflow-template]").forEach(button => {
      button.addEventListener("click", () => {
        startTemplate(button.dataset.workflowTemplate);
      });
    });

    render();
  }

  init();
})();
