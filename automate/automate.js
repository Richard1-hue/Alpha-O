
(() => {
  "use strict";

  const DRAFTS_KEY = "alpha_o_automate_drafts_v1";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  function showMessage(message) {
    let toast = $("#automate-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "automate-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("visible");

    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(() => {
      toast.classList.remove("visible");
    }, 2800);
  }

  function loadDrafts() {
    try {
      const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]");
      return Array.isArray(drafts) ? drafts : [];
    } catch {
      return [];
    }
  }

  function saveDrafts(drafts) {
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
      return true;
    } catch {
      showMessage("Could not save the draft in this browser.");
      return false;
    }
  }

  function openWorkflowForm(template = {}) {
    const form = $("#workflow-form");
    if (!form) {
      showMessage("The workflow form was not found in automate.html.");
      return;
    }

    form.hidden = false;

    const nameField = $('[name="workflow-name"]', form);
    const typeField = $('[name="workflow-type"]', form);
    const descriptionField = $('[name="workflow-description"]', form);

    if (nameField) nameField.value = template.name || "";
    if (typeField && template.type) typeField.value = template.type;
    if (descriptionField) {
      descriptionField.value = template.description || "";
    }

    form.scrollIntoView({ behavior: "smooth", block: "start" });
    nameField?.focus();
  }

  function closeWorkflowForm() {
    const form = $("#workflow-form");
    if (form) form.hidden = true;
  }

  function renderDrafts() {
    const container = $("#recent-workflows");
    if (!container) return;

    const drafts = loadDrafts();

    if (!drafts.length) {
      container.innerHTML =
        '<p class="empty-state">No saved workflow drafts yet.</p>';
      return;
    }

    container.replaceChildren();

    drafts.forEach((draft) => {
      const item = document.createElement("article");
      item.className = "workflow-item";

      const heading = document.createElement("h3");
      heading.textContent = draft.name;

      const description = document.createElement("p");
      description.textContent = draft.description || "No description provided.";

      const status = document.createElement("span");
      status.className = "workflow-status";
      status.textContent = "Draft · Not running";

      item.append(heading, description, status);
      container.appendChild(item);
    });
  }

  function handleTemplateClick(button) {
    const template = {
      name: button.dataset.name || "",
      type: button.dataset.type || "",
      description: button.dataset.description || ""
    };

    openWorkflowForm(template);
  }

  function handleSave(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const name = $('[name="workflow-name"]', form)?.value.trim();
    const type = $('[name="workflow-type"]', form)?.value || "custom";
    const description =
      $('[name="workflow-description"]', form)?.value.trim() || "";

    if (!name) {
      showMessage("Enter a workflow name first.");
      $('[name="workflow-name"]', form)?.focus();
      return;
    }

    const drafts = loadDrafts();
    drafts.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      type,
      description,
      status: "draft",
      updatedAt: new Date().toISOString()
    });

    if (saveDrafts(drafts.slice(0, 30))) {
      renderDrafts();
      closeWorkflowForm();
      form.reset();
      showMessage("Workflow draft saved in this browser.");
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const templateButton = target.closest("[data-workflow-template]");
    if (templateButton) {
      handleTemplateClick(templateButton);
      return;
    }

    if (target.closest("#new-workflow")) {
      openWorkflowForm();
      return;
    }

    if (target.closest("[data-cancel-workflow]")) {
      closeWorkflowForm();
      return;
    }

    if (target.closest("[data-close-automate]")) {
      window.parent.postMessage(
        { type: "ALPHA_O_AUTOMATE_CLOSE" },
        window.location.origin
      );
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches("#workflow-form")) {
      handleSave(event);
    }
  });

  document.addEventListener("DOMContentLoaded", renderDrafts);

  if (document.readyState !== "loading") {
    renderDrafts();
  }
})();
