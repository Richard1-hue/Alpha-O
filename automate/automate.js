"use strict";

(() => {
  const STORAGE_KEY = "alphaO.automate.workflows.v1";
  const TOKEN_KEY = "alphaO.automate.adminToken.v1";
  const API_BASE = "https://alpha-o-api.ituzerichard6.workers.dev";
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
    toast: $("#toastRegion"),
    cloudToken: $("#cloudAdminToken"),
    cloudConnect: $("#cloudConnect"),
    cloudDisconnect: $("#cloudDisconnect"),
    cloudStatus: $("#cloudSyncStatus"),
    storageNote: $("#workflowStorageNote"),
    // v2 additions
    footerNote: $("#workspaceFooterNote"),
    editorNote: $("#editorNote"),
    newAlt: $("#newWorkflowAlt"),
    categoryFilter: $("#workflowCategoryFilter"),
    statusFilter: $("#workflowStatusFilter"),
    sort: $("#workflowSort"),
    resultCount: $("#workflowCount"),
    clearFilters: $("#clearWorkflowFilters"),
    drawer: $("#detailDrawer"),
    drawerBody: $("#drawerBody"),
    drawerTitle: $("#drawerTitle"),
    dialog: $("#appDialog")
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

  const TRIGGER_HELP = {
    manual: "You start it yourself. In this phase the Run Test button is the only way to start one.",
    schedule: "Needs a scheduler, which does not exist yet. Tests simulate a single tick.",
    "new-email": "Needs a connected mailbox, which is not available yet. Tests use sample email fields.",
    "form-submission": "Needs a connected form, which is not available yet. Tests use sample form fields.",
    "file-added": "Needs file storage, which is not available yet. Tests use a sample file name.",
    webhook: "Needs a receiving endpoint, which does not exist yet. Tests simulate a call."
  };

  const ACTION_HELP = {
    summarize: "Lists the fields it would summarize. No AI model is connected.",
    "draft-email": "Prepares an email outline. Nothing is created or sent.",
    "create-task": "Outlines a task. No task tool is connected.",
    "analyze-data": "Calculates sum, average, minimum and maximum of the numeric test fields.",
    notify: "Prepares a notification. Nothing is posted anywhere.",
    "process-file": "Needs a fileName in the test input. No file is read or changed."
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

  const ICON_COPY =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>';

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

  /* ---------- v2: template library (uses only existing triggers and actions) ---------- */

  const LIBRARY_CATEGORIES = [
    ["all", "All templates"],
    ["business-operations", "Business operations"],
    ["customer-management", "Customer management"],
    ["marketing", "Marketing"],
    ["sales", "Sales"],
    ["administration", "Administration"],
    ["notifications", "Notifications"],
    ["reporting", "Reporting"],
    ["developer", "Developer and agency"]
  ];

  const LIBRARY = [
    { key: "lib-daily-ops", category: "business-operations", name: "Daily operations summary", type: "business", trigger: "schedule", action: "summarize", condition: "", description: "Summarize the day's operational updates into a short briefing for the team." },
    { key: "lib-invoice-intake", category: "business-operations", name: "Invoice intake", type: "business", trigger: "file-added", action: "process-file", condition: "fileName ends with .pdf", description: "When an invoice PDF arrives, process the file and prepare it for review." },
    { key: "lib-customer-triage", category: "customer-management", name: "Customer request triage", type: "business", trigger: "form-submission", action: "create-task", condition: "", description: "Check each new customer request, categorize it, and create a follow-up task." },
    { key: "lib-customer-reply", category: "customer-management", name: "Urgent customer reply draft", type: "communication", trigger: "new-email", action: "draft-email", condition: "priority is urgent", description: "Draft a reply for urgent customer emails so a person can review it quickly." },
    { key: "lib-campaign-report", category: "marketing", name: "Weekly campaign report", type: "reporting", trigger: "schedule", action: "analyze-data", condition: "", description: "Analyze campaign numbers each week and prepare a short performance report." },
    { key: "lib-lead-follow-up", category: "marketing", name: "Lead form follow-up", type: "communication", trigger: "form-submission", action: "draft-email", condition: "", description: "Draft a friendly follow-up whenever a lead submits the contact form." },
    { key: "lib-large-deal", category: "sales", name: "Large deal alert", type: "communication", trigger: "webhook", action: "notify", condition: "amount > 5000", description: "Prepare a notification for the sales team when a deal above the threshold arrives." },
    { key: "lib-sales-notify", category: "sales", name: "Sales team notification", type: "communication", trigger: "form-submission", action: "notify", condition: "status is open", description: "Prepare a notification for the sales team about each open customer request." },
    { key: "lib-onboarding", category: "administration", name: "Staff onboarding checklist", type: "productivity", trigger: "manual", action: "create-task", condition: "", description: "Create the standard onboarding tasks for a new team member." },
    { key: "lib-document-filing", category: "administration", name: "Document filing", type: "business", trigger: "file-added", action: "process-file", condition: "", description: "Process newly added documents so they can be filed in the right place." },
    { key: "lib-urgent-alert", category: "notifications", name: "Urgent email alert", type: "communication", trigger: "new-email", action: "notify", condition: "priority is urgent", description: "Prepare an alert when an urgent email arrives." },
    { key: "lib-deadline", category: "notifications", name: "Deadline reminder", type: "productivity", trigger: "schedule", action: "notify", condition: "", description: "Prepare a reminder about upcoming deadlines on a regular schedule." },
    { key: "lib-monthly-report", category: "reporting", name: "Monthly performance report", type: "reporting", trigger: "schedule", action: "analyze-data", condition: "", description: "Analyze monthly figures and prepare a report highlighting what changed." },
    { key: "lib-weekly-digest", category: "reporting", name: "Weekly digest", type: "reporting", trigger: "schedule", action: "summarize", condition: "", description: "Summarize the week's activity into a digest." },
    { key: "lib-webhook-summary", category: "developer", name: "Webhook payload summary", type: "other", trigger: "webhook", action: "summarize", condition: "", description: "Summarize the fields of an incoming webhook payload for quick inspection." },
    { key: "lib-client-handoff", category: "developer", name: "Client handoff checklist", type: "productivity", trigger: "manual", action: "create-task", condition: "", description: "Create the handoff tasks when a client project is delivered." },
    { key: "lib-failed-deploy", category: "developer", name: "Failed deploy notification", type: "other", trigger: "webhook", action: "notify", condition: "status is failed", description: "Prepare a notification when a deployment webhook reports a failure." }
  ];

  LIBRARY.forEach(item => { templates[item.key] = item; });

  /* ---------- v2: temporary demonstration data (never saved, never sent) ---------- */

  const SAMPLE_ACTIVITY = [
    { kind: "success", text: "Test passed: Weekly campaign report", minutesAgo: 12 },
    { kind: "warn", text: "Test skipped: Large deal alert (condition not met)", minutesAgo: 47 },
    { kind: "failed", text: "Test failed: Invoice intake (no file name in test input)", minutesAgo: 190 }
  ];

  const WORKSPACES = [
    { id: "personal", name: "My workspace (this browser)", kind: "local" },
    {
      id: "northwind", name: "Northwind Digital (sample agency)", kind: "demo",
      clients: [
        { id: "harbor", name: "Harbor Café", status: "active", workflows: [
          { name: "Order inquiry triage", type: "business", trigger: "form-submission", action: "create-task", condition: "", description: "Sort incoming order questions into tasks for the café team.", owner: "Developer" },
          { name: "Weekly sales digest", type: "reporting", trigger: "schedule", action: "summarize", condition: "", description: "Summarize the week's orders for the owner.", owner: "Agency owner" }
        ], activity: [{ text: "Test passed: Order inquiry triage", minutesAgo: 35 }, { text: "Draft edited: Weekly sales digest", minutesAgo: 400 }] },
        { id: "fitwell", name: "Fitwell Studio", status: "onboarding", workflows: [
          { name: "New member welcome", type: "communication", trigger: "form-submission", action: "draft-email", condition: "", description: "Draft a welcome email when someone joins.", owner: "Developer" }
        ], activity: [{ text: "Client workspace created", minutesAgo: 1500 }] },
        { id: "summit", name: "Summit Legal", status: "paused", workflows: [
          { name: "Document intake", type: "business", trigger: "file-added", action: "process-file", condition: "fileName ends with .pdf", description: "Process new case documents.", owner: "Administrator" }
        ], activity: [{ text: "Client paused by agency owner", minutesAgo: 4300 }] }
      ]
    },
    {
      id: "brightpath", name: "BrightPath Studio (sample agency)", kind: "demo",
      clients: [
        { id: "greenfield", name: "Greenfield Clinic", status: "active", workflows: [
          { name: "Appointment reminders", type: "communication", trigger: "schedule", action: "notify", condition: "", description: "Prepare daily appointment reminders.", owner: "Developer" },
          { name: "Monthly patient report", type: "reporting", trigger: "schedule", action: "analyze-data", condition: "", description: "Analyze monthly visit counts.", owner: "Agency owner" }
        ], activity: [{ text: "Test failed: Appointment reminders (sample)", minutesAgo: 90 }] },
        { id: "atlas", name: "Atlas Logistics", status: "onboarding", workflows: [
          { name: "Shipment webhook summary", type: "other", trigger: "webhook", action: "summarize", condition: "", description: "Summarize shipment webhook payloads.", owner: "Developer" }
        ], activity: [{ text: "Integration planning started", minutesAgo: 2600 }] }
      ]
    }
  ];

  const INTEGRATIONS = [
    { id: "gmail", name: "Gmail", status: "available", blurb: "Watch for new mail and prepare reply drafts for review.", plans: ["Read messages that match a rule", "Create drafts (never sends without approval)"] },
    { id: "sheets", name: "Google Sheets", status: "available", blurb: "Read rows for reports and add rows from workflow results.", plans: ["Read selected spreadsheets", "Append rows to a chosen sheet"] },
    { id: "slack", name: "Slack", status: "later", blurb: "Prepare notifications for team channels.", plans: ["Post to chosen channels"] },
    { id: "microsoft", name: "Microsoft 365", status: "later", blurb: "Outlook mail, calendar and Excel connections.", plans: ["Read and draft Outlook mail", "Read Excel workbooks"] },
    { id: "webhook", name: "Webhook receiver", status: "demo", blurb: "Test runs can simulate a webhook call. No real endpoint exists.", plans: ["Receive HTTPS calls from other systems"] },
    { id: "rest", name: "Custom REST API", status: "not-connected", blurb: "Connect another business API with its own settings.", plans: ["Call a base URL you configure", "Use a credential stored on the server"] }
  ];

  const INT_STATUS = {
    available: { label: "Available for future connection", badge: "badge-sim" },
    "not-connected": { label: "Not connected", badge: "badge-muted" },
    later: { label: "Coming later", badge: "badge-muted" },
    demo: { label: "Demonstration only", badge: "badge-warn" }
  };

  const ROLES = [
    { id: "admin", name: "Administrator", blurb: "Full control of every workspace.", perms: ["yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes"] },
    { id: "owner", name: "Agency owner", blurb: "Runs the agency and its client workspaces.", perms: ["yes", "yes", "yes", "yes", "yes", "yes", "yes", "limited"] },
    { id: "developer", name: "Developer", blurb: "Builds and tests automations for clients.", perms: ["yes", "yes", "limited", "yes", "yes", "yes", "no", "no"] },
    { id: "client", name: "Client", blurb: "Sees only their own workflows.", perms: ["limited", "no", "no", "limited", "no", "no", "no", "no"] },
    { id: "viewer", name: "Viewer", blurb: "Read-only access.", perms: ["yes", "no", "no", "no", "no", "no", "no", "no"] }
  ];

  const CAPABILITIES = [
    "View workflows", "Create and edit workflows", "Delete workflows", "Run tests",
    "Use templates", "Manage integrations", "Manage client workspaces", "Manage roles"
  ];

  const AI_SUGGESTIONS = [
    "Check new customer requests, categorize them, and prepare a notification for the sales team.",
    "Every Monday morning, analyze last week's sales numbers and prepare a report.",
    "When a new email arrives from an urgent customer, draft a reply.",
    "When a file is uploaded, process it and notify the finance channel."
  ];

  const VIEWS = ["dashboard", "workflows", "templates", "assistant", "monitoring", "workspaces", "integrations", "access"];

  /* ---------- State ---------- */

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

  // v2 session state (memory only; nothing here is persisted or sent anywhere)
  const session = {
    view: viewFromHash(),
    viewApplied: false,
    activity: [],
    libraryCategory: "all",
    runFilter: "all",
    intFilter: "all",
    wsId: "personal",
    clientId: null,
    role: "admin",
    chat: [],
    aiBusy: false,
    proposalSeq: 0
  };

  let drawerId = null;
  let drawerFocus = null;
  let dialogResolve = null;
  let dialogFocus = null;

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

  /* ---------- Cloudflare workflow storage ---------- */

  let cloudToken = "";
  let cloudConnected = false;
  let cloudBusy = false;

  function setCloudStatus(message) {
    if (elements.cloudStatus) {
      elements.cloudStatus.textContent = message;
    }
  }

  async function cloudRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cloudToken}`,
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Cloud request failed (${response.status})`);
    }

    return data;
  }

  function fromCloud(item) {
    return {
      id: String(item.id),
      name: item.name || "",
      type: item.category || "other",
      trigger: item.triggerType || DEFAULT_TRIGGER,
      action: item.actionType || DEFAULT_ACTION,
      condition: item.conditionText || "",
      description: item.description || "",
      status: item.status || "draft",
      updatedAt: item.updatedAt || item.updated_at || new Date().toISOString()
    };
  }

  function toCloud(workflow) {
    return {
      name: workflow.name,
      category: workflow.type,
      triggerType: workflow.trigger,
      actionType: workflow.action,
      conditionText: workflow.condition,
      description: workflow.description,
      status: workflow.status || "draft"
    };
  }

  async function loadCloudWorkflows() {
    const data = await cloudRequest("/admin/workflows");
    workflows = Array.isArray(data.workflows)
      ? data.workflows.map(fromCloud)
      : [];
    render();
    if (elements.storageNote) {
      elements.storageNote.textContent = "Saved in Cloudflare database";
    }
  }
  async function connectCloud() {
    if (cloudBusy) return;

    const token = elements.cloudToken?.value.trim() || "";

    if (!token) {
      setCloudStatus("Enter your Cloudflare admin token first.");
      elements.cloudToken?.focus();
      return;
    }

    cloudBusy = true;
    cloudToken = token;
    elements.cloudConnect.disabled = true;
    elements.list?.setAttribute("aria-busy", "true");
    setCloudStatus("Connecting to Cloudflare...");

    try {
      await loadCloudWorkflows();

      cloudConnected = true;
      sessionStorage.setItem(TOKEN_KEY, cloudToken);

      elements.cloudToken.value = "";
      elements.cloudDisconnect.disabled = false;

      setCloudStatus("Connected — workflows are stored online.");
      syncStorageMode();
      showToast("Cloudflare connected.");
    } catch (error) {
      cloudToken = "";
      cloudConnected = false;
      sessionStorage.removeItem(TOKEN_KEY);
      setCloudStatus(`Connection failed: ${error.message}`);
      showToast("Could not connect to Cloudflare.", "error");
    } finally {
      cloudBusy = false;
      elements.cloudConnect.disabled = false;
      elements.list?.removeAttribute("aria-busy");
    }
  }

  function disconnectCloud() {
    if (cloudBusy) return;

    cloudToken = "";
    cloudConnected = false;
    sessionStorage.removeItem(TOKEN_KEY);

    workflows = loadWorkflows();
    render();

    if (elements.storageNote) {
      elements.storageNote.textContent = "Saved in this browser";
    }

    elements.cloudDisconnect.disabled = true;
    setCloudStatus("Disconnected — using browser storage.");
    syncStorageMode();
    showToast("Cloudflare disconnected.");
  }
  
  async function saveCloudWorkflow(workflow, existing) {
    if (cloudBusy) return;

    cloudBusy = true;

    try {
      const isEditing = Boolean(existing);
      const path = isEditing
        ? `/admin/workflows/${encodeURIComponent(existing.id)}`
        : "/admin/workflows";

      await cloudRequest(path, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(toCloud(workflow))
      });

      await loadCloudWorkflows();

      closeEditor();
      logActivity("info", `${isEditing ? "Updated" : "Created"} workflow in Cloudflare: ${workflow.name}`);
      showToast(isEditing ? "Cloud workflow updated." : "Cloud workflow saved.");
    } catch (error) {
      console.error("Alpha-O cloud save failed:", error);
      showToast(`Cloud save failed: ${error.message}`, "error");
    } finally {
      cloudBusy = false;
    }
  }

  async function deleteCloudWorkflow(id) {
    if (cloudBusy) return;

    cloudBusy = true;

    try {
      await cloudRequest(
        `/admin/workflows/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      await loadCloudWorkflows();
      logActivity("info", "Deleted a workflow from Cloudflare");
      showToast("Cloud workflow deleted.");
    } catch (error) {
      console.error("Alpha-O cloud delete failed:", error);
      showToast(`Cloud delete failed: ${error.message}`, "error");
    } finally {
      cloudBusy = false;
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

  // v2 helpers
  function relTime(iso) {
    const time = typeof iso === "number" ? iso : Date.parse(iso);

    if (!time) return "";

    const seconds = Math.max(0, (Date.now() - time) / 1000);

    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);

    if (hours < 24) return `${hours} hr ago`;

    const days = Math.floor(hours / 24);

    return days < 7 ? `${days} day${days > 1 ? "s" : ""} ago` : new Date(time).toLocaleDateString();
  }

  function normType(type) {
    if (type === "data") return "reporting";
    if (type === "custom") return "other";
    return TYPE_LABELS[type] ? type : "other";
  }

  function clip(text, max) {
    const value = String(text);
    return value.length > max ? value.slice(0, max) : value;
  }

  function wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function runWord(status) {
    return ({ SUCCESS: "passed", FAILED: "failed", SKIPPED: "skipped", UNSUPPORTED: "unsupported", RUNNING: "running" })[status] || "finished";
  }

  function latestRunMap() {
    const map = new Map();

    if (!engine) return map;

    engine.getRuns().forEach(run => {
      if (run.workflowId && run.status !== "RUNNING" && !map.has(run.workflowId)) {
        map.set(run.workflowId, run);
      }
    });

    return map;
  }

  function testGroup(run) {
    if (!run) return "untested";
    return run.status === "SUCCESS" ? "passed" : "attention";
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
    setStat(
      elements.drafts,
      workflows.filter(item => !item.status || item.status === "draft").length
    );

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

  function getFilteredWorkflows() {
    const query = (elements.search?.value || "")
      .trim()
      .toLowerCase();
    const category = elements.categoryFilter?.value || "all";
    const status = elements.statusFilter?.value || "all";
    const sort = elements.sort?.value || "updated";
    const runMap = latestRunMap();

    let list = workflows.filter(workflow => {
      const searchable = [
        workflow.name,
        formatType(workflow.type),
        formatTrigger(workflow.trigger || DEFAULT_TRIGGER),
        formatAction(workflow.action || DEFAULT_ACTION),
        workflow.condition || "",
        workflow.description
      ].join(" ").toLowerCase();

      if (!searchable.includes(query)) return false;
      if (category !== "all" && normType(workflow.type) !== category) return false;
      if (status !== "all" && testGroup(runMap.get(workflow.id)) !== status) return false;

      return true;
    });

    if (sort === "name") {
      list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "category") {
      list = list.slice().sort((a, b) =>
        formatType(normType(a.type)).localeCompare(formatType(normType(b.type))) ||
        a.name.localeCompare(b.name)
      );
    } else {
      list = list.slice().sort((a, b) =>
        (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
      );
    }

    return {
      list,
      runMap,
      filtersActive: Boolean(query) || category !== "all" || status !== "all"
    };
  }

  function testBadge(run) {
    if (!run) return "";

    if (run.status === "SUCCESS") {
      return '<span class="badge badge-test-passed">Last test passed</span>';
    }

    return `<span class="badge badge-test-attention">Last test ${escapeHTML(runWord(run.status))}</span>`;
  }

  function renderList() {
    if (!elements.list) return;

    const { list: filtered, runMap, filtersActive } = getFilteredWorkflows();

    $$(".workflow-card", elements.list).forEach(card => card.remove());

    if (elements.empty) {
      elements.empty.hidden = filtered.length > 0;
    }

    if (elements.resultCount) {
      elements.resultCount.textContent = workflows.length
        ? `Showing ${filtered.length} of ${workflows.length}`
        : "";
    }

    if (elements.clearFilters) {
      elements.clearFilters.hidden = !filtersActive;
    }

    if (filtered.length === 0) {
      if (filtersActive) {
        setEmptyState(
          "No matching workflows",
          "Try another search term or filter, or create a new workflow."
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
      const status = workflow.status || "draft";
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

      card.innerHTML = `
        <div class="workflow-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">${icon}</svg>
        </div>

        <div class="workflow-main">
          <div class="workflow-title-row">
            <h3 class="workflow-name">
              <button class="link-button" type="button" data-action="details" data-id="${id}" title="Open workflow details">${escapeHTML(workflow.name)}</button>
            </h3>
            <span class="badge${status === "draft" ? " badge-draft" : ""}">${escapeHTML(statusLabel)}</span>
            <span class="badge">
              ${escapeHTML(formatType(workflow.type))}
            </span>
            ${testBadge(runMap.get(workflow.id))}
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
            data-action="duplicate"
            data-id="${id}"
            ${cloudConnected ? 'disabled title="Duplicate is frontend-only for now and is turned off while Cloudflare is connected."' : 'title="Save a copy as a new draft in this browser"'}
          >${ICON_COPY}Duplicate</button>

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

    try {
      renderSecondary();
    } catch (error) {
      console.error("Alpha-O Automate: Secondary views could not refresh.", error);
    }
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

    $$(".field-error", elements.form).forEach(node => {
      node.hidden = true;
      node.textContent = "";
    });
  }

  function setFieldError(input, errorId, message) {
    const node = $(`#${errorId}`);

    input?.classList.add("invalid");

    if (node) {
      node.textContent = message;
      node.hidden = false;
    }
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
    updateBuilderPreview();
    updateConditionHint();

    const result = $("#builderTestResult");
    if (result) result.hidden = true;

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

  async function saveWorkflow(event) {
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
      setFieldError(elements.name, "workflowNameError", "Give this workflow a name so you can find it later.");
      elements.name?.focus();

      showToast(
        "Enter a workflow name before saving.",
        "error"
      );
      return;
    }

    if (!description) {
      setFieldError(elements.description, "workflowDescriptionError", "Describe what this workflow should do and what result you expect.");
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
    if (cloudConnected) {
      await saveCloudWorkflow(workflow, existing);
      return;
    }
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

    logActivity("info", `${existing ? "Updated" : "Saved"} draft: ${workflow.name}`);

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

  function commitDelete(id) {
    if (cloudConnected) {
      deleteCloudWorkflow(id);
      return;
    }

    const previous = workflows;
    const removed = workflows.find(item => item.id === id);

    workflows = workflows.filter(item => item.id !== id);

    if (!persistWorkflows()) {
      workflows = previous;
      return;
    }

    render();
    logActivity("info", `Deleted draft: ${removed ? removed.name : "workflow"}`);
    showToast("Draft deleted.");
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
    commitDelete(id);
  }

  function duplicateWorkflow(source) {
    if (cloudConnected) {
      showToast(
        "Duplicate is frontend-only for now and is turned off while Cloudflare is connected.",
        "warn"
      );
      return false;
    }

    const copy = {
      ...source,
      id: createId(),
      name: clip(`${source.name} (copy)`, 100),
      status: "draft",
      updatedAt: new Date().toISOString()
    };

    const previous = workflows;

    workflows = [copy, ...workflows];

    if (!persistWorkflows()) {
      workflows = previous;
      return false;
    }

    render();
    logActivity("info", `Duplicated draft: ${source.name}`);
    showToast("Draft duplicated. The copy is saved in this browser.");

    return true;
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
    } else if (button.dataset.action === "details") {
      disarmDelete();
      openDrawer(id);
    } else if (button.dataset.action === "duplicate") {
      disarmDelete();
      duplicateWorkflow(workflow);
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

    const allRuns = engine ? engine.getRuns() : [];
    const runs = session.runFilter === "all"
      ? allRuns
      : allRuns.filter(run => run.status === session.runFilter);

    if (engineEls.clear) engineEls.clear.disabled = allRuns.length === 0;

    renderMonitorSummary(allRuns);

    if (!runs.length) {
      engineEls.history.innerHTML = allRuns.length
        ? `<li class="run-empty"><p class="empty-title">No runs with this status</p><p class="empty-text">Choose another status to see other runs.</p></li>`
        : `<li class="run-empty"><p class="empty-title">No test runs yet</p><p class="empty-text">Runs appear here after you click Run Test.</p></li>`;
      return;
    }

    engineEls.history.innerHTML = runs.map(run => `
      <li class="run-row${run.id === selectedRunId ? " selected" : ""}">
        <div class="run-row-main">
          <span class="run-row-name">${escapeHTML(run.workflowName)}</span>
          <span class="run-row-time">${escapeHTML(formatDateTime(run.startedAt))}${run.finishedAt ? ` · ${escapeHTML(formatDuration(run.durationMs))}` : ""}</span>
          ${run.error && run.error.message ? `<span class="run-row-error">${escapeHTML(clip(run.error.message, 140))}</span>` : ""}
        </div>
        ${statusPill(run.status)}
        <div class="run-row-actions">
          <button
            class="action-button"
            type="button"
            data-run-action="view"
            data-run-id="${escapeHTML(run.id)}"
            aria-label="View details for ${escapeHTML(run.workflowName)}, ${escapeHTML(formatDateTime(run.startedAt))}"
          >Details</button>
          <button
            class="action-button"
            type="button"
            data-run-action="retry"
            data-run-id="${escapeHTML(run.id)}"
            ${run.status === "RUNNING" ? "disabled" : ""}
            title="Run the same test again with the same test input (simulation)"
          >Retry</button>
        </div>
      </li>
    `).join("");
  }

  function renderMonitorSummary(allRuns) {
    const counts = { RUNNING: 0, SUCCESS: 0, FAILED: 0, other: 0 };

    allRuns.forEach(run => {
      if (run.status in counts) counts[run.status] += 1;
      else counts.other += 1;
    });

    const set = (id, value) => {
      const node = $(`#${id}`);
      if (node) node.textContent = String(value);
    };

    set("monRunning", counts.RUNNING);
    set("monSuccess", counts.SUCCESS);
    set("monFailed", counts.FAILED);
    set("monOther", counts.other);
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

    if (event.type === "run-finished" && event.run) {
      logActivity(
        event.run.status === "SUCCESS" ? "success" : event.run.status === "FAILED" ? "failed" : "warn",
        `Test ${runWord(event.run.status)}: ${event.run.workflowName}`,
        event.run.finishedAt
      );
      renderList();
    } else if (event.type === "history-cleared") {
      renderList();
    }

    if (event.type === "run-finished" || event.type === "history-cleared") {
      renderDashboard();
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

  // overrideInput (optional) replaces the test input box. opts.navigate === false keeps the
  // person on the current screen (used by the editor, the AI proposal and Retry).
  // Returns the finished run, or null when no run happened.
  async function runTest(workflow, overrideInput, opts = {}) {
    if (!engine) {
      showToast(
        "The test engine did not load. Check that engine.js is in the automate folder.",
        "error"
      );
      return null;
    }

    const hasOverride = overrideInput && typeof overrideInput === "object" && !Array.isArray(overrideInput);
    const input = hasOverride ? { ok: true, value: overrideInput } : readTestInput();

    if (!input.ok) {
      showInputError(input.message);
      engineEls.input?.focus();
      showToast("Fix the test input before running a test.", "error");
      return null;
    }

    if (!hasOverride) showInputError("");

    let outcome;

    try {
      outcome = await engine.runWorkflow(workflow, {
        testInput: input.value,
        onStart: run => {
          selectedRunId = run.id;
          if (opts.navigate !== false) navigateTo("monitoring");
          renderReport();
          revealReport();
        }
      });
    } catch (error) {
      console.error("Alpha-O Automate: Test run failed unexpectedly.", error);
      showToast("The test could not be run. See the browser console for details.", "error");
      return null;
    }

    if (!outcome.accepted) {
      showToast(outcome.message, "warn");
      return null;
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

    return run;
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

  function retryRun(runId) {
    if (!engine) return;

    const run = engine.getRun(runId);

    if (!run) {
      showToast("That run is no longer available.", "warn");
      return;
    }

    const workflow = workflows.find(item => item.id === run.workflowId);

    if (!workflow) {
      showToast(
        "This run was for an unsaved test or a workflow that no longer exists, so it cannot be retried.",
        "warn"
      );
      return;
    }

    showToast("Retrying the current saved version with the same test input (simulation).", "success");
    runTest(workflow, run.testInput || {}, { navigate: false });
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

    const retryButton = event.target.closest("button[data-run-action='retry']");

    if (retryButton) {
      retryRun(retryButton.dataset.runId);
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
    section.dataset.view = "monitoring";
    section.hidden = session.view !== "monitoring";
    section.setAttribute("aria-labelledby", "engineHeading");

    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h2 id="engineHeading">Test runs</h2>
          <p>Simulated tests only. Nothing is sent, saved to a spreadsheet, or posted.</p>
        </div>
      </div>

      <div class="monitor-summary" aria-label="Run totals">
        <div class="monitor-cell"><div class="stat-label">Running now</div><strong id="monRunning">0</strong></div>
        <div class="monitor-cell"><div class="stat-label">Passed</div><strong id="monSuccess">0</strong></div>
        <div class="monitor-cell"><div class="stat-label">Failed</div><strong id="monFailed">0</strong></div>
        <div class="monitor-cell"><div class="stat-label">Skipped or unsupported</div><strong id="monOther">0</strong></div>
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
          <div class="history-tools">
            <label class="sr-only" for="runStatusFilter">Filter runs by status</label>
            <select class="text-field compact" id="runStatusFilter">
              <option value="all">All statuses</option>
              <option value="SUCCESS">Passed</option>
              <option value="FAILED">Failed</option>
              <option value="SKIPPED">Skipped</option>
              <option value="UNSUPPORTED">Unsupported</option>
              <option value="RUNNING">Running</option>
            </select>
            <button class="action-button" id="clearRunHistory" type="button">Clear history</button>
          </div>
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

    $("#runStatusFilter", section)?.addEventListener("change", event => {
      session.runFilter = event.target.value;
      renderHistory();
    });
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

  // Same behaviour as trapFocus, for the drawer and dialog.
  function trapFocusIn(container, event) {
    if (event.key !== "Tab" || !container || container.hidden) return false;

    const focusable = $$("button, input, select, textarea, a[href], summary", container)
      .filter(node => !node.disabled && !node.hidden && !node.closest("[hidden]"));

    if (!focusable.length) return true;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }

    return true;
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      if (dialogResolve) {
        closeDialog(false);
        return;
      }

      if (elements.drawer && !elements.drawer.hidden) {
        closeDrawer();
        return;
      }

      if (elements.editor && !elements.editor.hidden) {
        closeEditor();
      }

      return;
    }

    if (dialogResolve) {
      trapFocusIn(elements.dialog, event);
    } else if (elements.drawer && !elements.drawer.hidden) {
      trapFocusIn(elements.drawer, event);
    } else {
      trapFocus(event);
    }
  }

  /* ==========================================================================
     v2 — Navigation (hash routing; sections are shown and hidden, never moved)
     ========================================================================== */

  function viewFromHash() {
    const name = window.location.hash.replace("#", "");
    return VIEWS.includes(name) ? name : "dashboard";
  }

  function applyView(view) {
    const changed = session.view !== view || !session.viewApplied;

    session.view = view;
    session.viewApplied = true;

    $$("[data-view]").forEach(node => {
      node.hidden = !node.dataset.view.split(/\s+/).includes(view);
    });

    $$("[data-nav]").forEach(link => {
      if (link.dataset.nav === view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    if (!changed) return;

    window.scrollTo(0, 0);

    if (view === "dashboard") renderDashboard();
    else if (view === "templates") renderLibrary();
    else if (view === "assistant") updateProposalState();
    else if (view === "monitoring") { renderHistory(); renderReport(); }
    else if (view === "workspaces") renderWorkspaces();
    else if (view === "integrations") renderIntegrations();
    else if (view === "access") renderAccess();
  }

  function navigateTo(view) {
    if (!VIEWS.includes(view)) return;

    applyView(view);

    if (window.location.hash !== `#${view}`) {
      window.location.hash = view;
    }
  }

  /* ==========================================================================
     v2 — Activity log, storage mode and dashboard
     ========================================================================== */

  function logActivity(kind, text, at) {
    session.activity.unshift({ kind, text, at: at || new Date().toISOString() });
    session.activity = session.activity.slice(0, 30);
    renderActivity();
  }

  function seedActivity() {
    if (!engine) return;

    engine.getRuns()
      .filter(run => run.finishedAt)
      .slice(0, 5)
      .reverse()
      .forEach(run => {
        session.activity.unshift({
          kind: run.status === "SUCCESS" ? "success" : run.status === "FAILED" ? "failed" : "warn",
          text: `Test ${runWord(run.status)}: ${run.workflowName}`,
          at: run.finishedAt
        });
      });
  }

  function renderActivity() {
    const host = $("#dashActivity");
    const badge = $("#dashActivityBadge");

    if (!host) return;

    const real = session.activity.slice(0, 8);
    const items = real.length
      ? real
      : SAMPLE_ACTIVITY.map(item => ({ ...item, at: Date.now() - item.minutesAgo * 60000, sample: true }));

    if (badge) {
      badge.textContent = real.length ? "Recorded in this browser" : "Sample activity";
      badge.className = real.length ? "badge" : "badge badge-warn";
    }

    host.innerHTML = items.map(item => `
      <li class="activity-item">
        <span class="activity-dot k-${escapeHTML(item.kind)}" aria-hidden="true"></span>
        <span>${escapeHTML(item.text)}${item.sample ? '<span class="sample-tag">SAMPLE</span>' : ""}</span>
        <span class="activity-time">${escapeHTML(relTime(item.at))}</span>
      </li>
    `).join("");
  }

  function renderStatusIndicators() {
    const host = $("#dashStatus");

    if (!host) return;

    const rows = [
      ["Execution engine", "Simulation only", "badge-warn"],
      ["Workflow storage", cloudConnected ? "Cloudflare database" : "This browser", cloudConnected ? "badge-ok" : "badge-muted"],
      ["Real triggers and schedules", "Not available yet", "badge-muted"],
      ["ALPHA-O AUTOMATE AI", "Local preview, no AI model", "badge-warn"],
      ["External integrations", "None connected", "badge-muted"],
      ["Roles and sign-in", "Preview only", "badge-muted"]
    ];

    host.innerHTML = rows.map(([label, value, cls]) => `
      <li class="status-row"><span>${escapeHTML(label)}</span><span class="badge ${cls}">${escapeHTML(value)}</span></li>
    `).join("");
  }

  function renderPerformance() {
    const host = $("#dashPerformance");

    if (!host) return;

    const runs = (engine ? engine.getRuns() : []).filter(run => run.finishedAt);

    if (!runs.length) {
      host.innerHTML = '<p class="mini-empty">No test runs yet. Run a test from the Workflows page and the results will be charted here.</p>';
      return;
    }

    const recent = runs.slice(0, 12).reverse();
    const maxDuration = Math.max(1, ...recent.map(run => run.durationMs || 0));
    const width = 12 * 28 + 8;
    const height = 120;

    const bars = recent.map((run, index) => {
      const barHeight = Math.max(8, Math.round(((run.durationMs || 0) / maxDuration) * (height - 12)));
      const label = `${run.workflowName}: ${runWord(run.status)}, ${formatDuration(run.durationMs)}`;

      return `<rect class="bar bar-${statusClass(run.status)}" x="${index * 28 + 4}" y="${height - barHeight}" width="20" height="${barHeight}" rx="3"><title>${escapeHTML(label)}</title></rect>`;
    }).join("");

    const total = runs.length;
    const passed = runs.filter(run => run.status === "SUCCESS").length;
    const rate = Math.round((passed / total) * 100);

    host.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Bar chart of the last ${recent.length} test runs. Bar height shows duration; colour shows result.">${bars}</svg>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-swatch s-success"></span>Passed</span>
        <span class="legend-item"><span class="legend-swatch s-failed"></span>Failed</span>
        <span class="legend-item"><span class="legend-swatch s-skipped"></span>Skipped</span>
        <span class="legend-item"><span class="legend-swatch s-unsupported"></span>Unsupported</span>
      </div>
      <p class="chart-summary">${passed} of ${total} recorded simulated runs passed (${rate}%). Bar height is run duration.</p>
    `;
  }

  function renderWorkflowPerformance() {
    const host = $("#dashWorkflowPerf");

    if (!host) return;

    const stats = new Map();

    (engine ? engine.getRuns() : []).filter(run => run.finishedAt).forEach(run => {
      const workflow = workflows.find(item => item.id === run.workflowId);

      if (!workflow) return;

      const entry = stats.get(workflow.id) || { name: workflow.name, runs: 0, passed: 0 };

      entry.runs += 1;
      if (run.status === "SUCCESS") entry.passed += 1;
      stats.set(workflow.id, entry);
    });

    const rows = Array.from(stats.values()).sort((a, b) => b.runs - a.runs).slice(0, 5);

    if (!rows.length) {
      host.innerHTML = '<p class="mini-empty">Results per saved workflow appear after you test one.</p>';
      return;
    }

    host.innerHTML = rows.map(row => {
      const rate = Math.round((row.passed / row.runs) * 100);

      return `
        <div class="perf-row">
          <div class="perf-row-top"><span class="perf-name">${escapeHTML(row.name)}</span><span class="perf-meta">${row.runs} run${row.runs === 1 ? "" : "s"} · ${rate}% passed</span></div>
          <div class="perf-track" role="presentation"><div class="perf-fill" style="width:${rate}%"></div></div>
        </div>
      `;
    }).join("");
  }

  function renderDashboard() {
    const runs = engine ? engine.getRuns().filter(run => run.finishedAt) : [];
    const passed = runs.filter(run => run.status === "SUCCESS").length;
    const failed = runs.filter(run => run.status === "FAILED").length;
    const other = runs.length - passed - failed;

    setStat($("#dashRunsSuccess"), passed);
    setStat($("#dashRunsFailed"), failed);
    setStat($("#dashRunsTotal"), runs.length);

    const note = $("#dashRunsTotalNote");

    if (note) {
      note.textContent = runs.length
        ? `${other} skipped or unsupported`
        : "No runs yet";
    }

    renderPerformance();
    renderWorkflowPerformance();
    renderActivity();
    renderStatusIndicators();
  }

  // Called from render(): keeps dependent views in step with the workflow list.
  function renderSecondary() {
    renderDashboard();

    if (session.view === "workspaces") renderWorkspaces();

    updateProposalState();
  }

  // Updates wording and disabled states that depend on where workflows are stored.
  function syncStorageMode() {
    if (elements.footerNote) {
      elements.footerNote.textContent = cloudConnected
        ? "Connected to Cloudflare · Test runs are simulation only"
        : "Workspace preview · Local drafts only";
    }

    if (elements.editorNote) {
      elements.editorNote.textContent = cloudConnected
        ? "Saving sends this workflow to your Cloudflare database. Triggers and actions are configuration only; the workflow will not execute automatically."
        : "Saving creates a local draft. Triggers and actions are configuration only; the workflow will not execute automatically.";
    }

    renderList();
    renderStatusIndicators();
    updateProposalState();

    if (drawerId && elements.drawer && !elements.drawer.hidden) {
      const duplicate = $('[data-drawer-action="duplicate"]', elements.drawer);

      if (duplicate) duplicate.disabled = cloudConnected;
    }
  }

  /* ==========================================================================
     v2 — Workflow filters and quick actions
     ========================================================================== */

  function clearWorkflowFilters() {
    if (elements.search) elements.search.value = "";
    if (elements.categoryFilter) elements.categoryFilter.value = "all";
    if (elements.statusFilter) elements.statusFilter.value = "all";

    renderList();
    elements.search?.focus();
  }

  function initFilters() {
    elements.categoryFilter?.addEventListener("change", renderList);
    elements.statusFilter?.addEventListener("change", renderList);
    elements.sort?.addEventListener("change", renderList);
    elements.clearFilters?.addEventListener("click", clearWorkflowFilters);
    elements.newAlt?.addEventListener("click", () => openEditor());

    $("#dashQuick")?.addEventListener("click", event => {
      const button = event.target.closest("button[data-quick]");

      if (!button) return;

      if (button.dataset.quick === "new") openEditor();
      else navigateTo(button.dataset.quick);
    });
  }

  /* ==========================================================================
     v2 — Dialog (confirmations and information) and details drawer
     ========================================================================== */

  function showDialog(options) {
    return new Promise(resolve => {
      if (!elements.dialog) {
        resolve(false);
        return;
      }

      if (dialogResolve) dialogResolve(false);

      dialogResolve = resolve;
      dialogFocus = document.activeElement;

      $("#dialogTitle").textContent = options.title || "Confirm";

      const body = $("#dialogBody");
      body.replaceChildren();

      (options.paragraphs || []).forEach(text => {
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        body.appendChild(paragraph);
      });

      if (options.facts && options.facts.length) {
        const list = document.createElement("dl");

        options.facts.forEach(([label, value]) => {
          const term = document.createElement("dt");
          const detail = document.createElement("dd");
          term.textContent = label;
          detail.textContent = value;
          list.append(term, detail);
        });

        body.appendChild(list);
      }

      if (options.items && options.items.length) {
        const list = document.createElement("ul");

        options.items.forEach(text => {
          const item = document.createElement("li");
          item.textContent = text;
          list.appendChild(item);
        });

        body.appendChild(list);
      }

      const confirm = $("#dialogConfirm");
      const cancel = $("#dialogCancel");

      confirm.textContent = options.confirmLabel || "OK";
      confirm.classList.toggle("danger", Boolean(options.danger));
      cancel.hidden = options.cancelLabel === null;
      cancel.textContent = options.cancelLabel || "Cancel";

      elements.dialog.hidden = false;
      document.body.style.overflow = "hidden";
      (options.danger ? cancel : confirm).focus();
    });
  }

  function closeDialog(result) {
    if (!dialogResolve) return;

    const resolve = dialogResolve;

    dialogResolve = null;
    elements.dialog.hidden = true;

    const editorOpen = elements.editor && !elements.editor.hidden;
    const drawerOpen = elements.drawer && !elements.drawer.hidden;

    if (!editorOpen && !drawerOpen) document.body.style.overflow = "";

    if (dialogFocus && document.contains(dialogFocus) && typeof dialogFocus.focus === "function") {
      dialogFocus.focus();
    }

    dialogFocus = null;
    resolve(Boolean(result));
  }

  function renderDrawer(workflow) {
    if (!elements.drawerBody || !elements.drawerTitle) return;

    elements.drawerTitle.textContent = workflow.name;

    const run = latestRunMap().get(workflow.id);
    const condition = (workflow.condition || "").trim();
    const status = workflow.status || "draft";

    const lastTest = run
      ? `
        <div class="inline-result">
          <div class="inline-result-head"><span>Last test</span>${statusPill(run.status)}</div>
          <p>${escapeHTML(run.summary || "")}</p>
          <p class="run-muted">${escapeHTML(formatDateTime(run.startedAt))} · ${escapeHTML(formatDuration(run.durationMs))}</p>
          <button class="action-button" type="button" data-drawer-action="report" data-run-id="${escapeHTML(run.id)}">View full report</button>
        </div>
      `
      : '<p class="run-muted">This workflow has not been tested yet. Run a test to see how it behaves with sample input.</p>';

    const exportable = {
      id: workflow.id,
      name: workflow.name,
      type: workflow.type,
      trigger: workflow.trigger || DEFAULT_TRIGGER,
      action: workflow.action || DEFAULT_ACTION,
      condition: workflow.condition || "",
      description: workflow.description,
      status
    };

    elements.drawerBody.innerHTML = `
      <div class="detail-badges">
        <span class="badge${status === "draft" ? " badge-draft" : ""}">${escapeHTML(status.charAt(0).toUpperCase() + status.slice(1))}</span>
        <span class="badge">${escapeHTML(formatType(workflow.type))}</span>
        <span class="badge badge-warn">Not active</span>
      </div>

      <h3 class="panel-subtitle">Execution order</h3>
      <ol class="order-list">
        <li class="order-item"><span class="flow-index">1</span><div><b>Trigger</b>${escapeHTML(formatTrigger(workflow.trigger || DEFAULT_TRIGGER))}</div></li>
        <li class="order-item"><span class="flow-index">2</span><div><b>Condition</b>${condition ? escapeHTML(condition) : "None. The action always runs."}</div></li>
        <li class="order-item"><span class="flow-index">3</span><div><b>Action</b>${escapeHTML(formatAction(workflow.action || DEFAULT_ACTION))}</div></li>
      </ol>

      <h3 class="panel-subtitle">Configuration</h3>
      <dl class="detail-list">
        <dt>Notes</dt><dd>${escapeHTML(workflow.description || "No description provided.")}</dd>
        <dt>Updated</dt><dd>${escapeHTML(timeAgo(workflow.updatedAt).replace("Updated ", "") || "Not recorded")}</dd>
        <dt>Stored in</dt><dd>${cloudConnected ? "Cloudflare database" : "This browser"}</dd>
      </dl>

      <h3 class="panel-subtitle">Test result</h3>
      ${lastTest}

      <details class="run-details">
        <summary>Configuration as data</summary>
        <pre class="run-pre">${escapeHTML(JSON.stringify(exportable, null, 2))}</pre>
      </details>
    `;

    const duplicate = $('[data-drawer-action="duplicate"]', elements.drawer);

    if (duplicate) {
      duplicate.disabled = cloudConnected;
      duplicate.title = cloudConnected
        ? "Duplicate is frontend-only for now and is turned off while Cloudflare is connected."
        : "Save a copy as a new draft in this browser";
    }
  }

  function openDrawer(id) {
    const workflow = workflows.find(item => item.id === id);

    if (!workflow || !elements.drawer) return;

    drawerId = id;
    drawerFocus = document.activeElement;
    renderDrawer(workflow);

    elements.drawer.hidden = false;
    document.body.style.overflow = "hidden";

    window.setTimeout(() => $("#drawerClose")?.focus(), 30);
  }

  function closeDrawer() {
    if (!elements.drawer || elements.drawer.hidden) return;

    elements.drawer.hidden = true;
    drawerId = null;

    if (!elements.editor || elements.editor.hidden) document.body.style.overflow = "";

    if (drawerFocus && document.contains(drawerFocus) && typeof drawerFocus.focus === "function") {
      drawerFocus.focus();
    }

    drawerFocus = null;
  }

  function openReport(runId) {
    if (elements.editor && !elements.editor.hidden) closeEditor();

    closeDrawer();
    selectedRunId = runId;
    navigateTo("monitoring");
    renderReport();
    renderHistory();
    revealReport();
  }

  async function handleDrawerClick(event) {
    if (event.target === elements.drawer) {
      closeDrawer();
      return;
    }

    const button = event.target.closest("[data-drawer-action]");

    if (!button) return;

    const workflow = workflows.find(item => item.id === drawerId);
    const action = button.dataset.drawerAction;

    if (action === "report") {
      openReport(button.dataset.runId);
      return;
    }

    if (!workflow) {
      closeDrawer();
      return;
    }

    if (action === "run") {
      closeDrawer();
      runTest(workflow);
    } else if (action === "edit") {
      closeDrawer();
      openEditor(workflow);
    } else if (action === "duplicate") {
      if (duplicateWorkflow(workflow)) closeDrawer();
    } else if (action === "delete") {
      const confirmed = await showDialog({
        title: "Delete this workflow?",
        paragraphs: [
          `“${workflow.name}” will be removed${cloudConnected ? " from your Cloudflare database" : " from this browser"}. This cannot be undone.`
        ],
        confirmLabel: "Delete workflow",
        cancelLabel: "Keep it",
        danger: true
      });

      if (confirmed) {
        closeDrawer();
        commitDelete(workflow.id);
      }
    }
  }

  function initDialogAndDrawer() {
    $("#dialogConfirm")?.addEventListener("click", () => closeDialog(true));
    $("#dialogCancel")?.addEventListener("click", () => closeDialog(false));

    elements.dialog?.addEventListener("mousedown", event => {
      if (event.target === elements.dialog) closeDialog(false);
    });

    $("#drawerClose")?.addEventListener("click", closeDrawer);
    elements.drawer?.addEventListener("click", handleDrawerClick);
  }

  /* ==========================================================================
     v2 — Builder extras: live preview, condition hint, test configuration
     ========================================================================== */

  function updateBuilderPreview() {
    const host = $("#builderPreview");

    if (!host) return;

    const trigger = elements.trigger?.value || DEFAULT_TRIGGER;
    const action = elements.action?.value || DEFAULT_ACTION;
    const condition = (elements.condition?.value || "").trim();

    host.innerHTML = `
      <ol class="flow-steps">
        <li class="flow-step"><span class="flow-index">1</span><div><b>When</b><span>${escapeHTML(formatTrigger(trigger))}</span></div></li>
        <li class="flow-step"><span class="flow-index">2</span><div><b>If</b><span>${condition ? escapeHTML(condition) : "No condition. The action always runs."}</span></div></li>
        <li class="flow-step"><span class="flow-index">3</span><div><b>Do</b><span>${escapeHTML(formatAction(action))}</span></div></li>
      </ol>
    `;

    const triggerHelp = $("#triggerHelp");
    const actionHelp = $("#actionHelp");

    if (triggerHelp) triggerHelp.textContent = TRIGGER_HELP[trigger] || "";
    if (actionHelp) actionHelp.textContent = ACTION_HELP[action] || "";
  }

  function updateConditionHint() {
    const hint = $("#conditionHint");

    if (!hint) return;

    const text = (elements.condition?.value || "").trim();

    if (!engine || !text) {
      hint.hidden = true;
      hint.textContent = "";
      hint.className = "field-hint";
      return;
    }

    const result = engine.evaluateCondition(text, engine.getSampleInput());

    hint.hidden = false;

    if (result.status === "UNSUPPORTED") {
      hint.className = "field-hint is-warn";
      hint.textContent = `The test engine cannot read this yet. ${result.summary.replace("This condition cannot be evaluated: ", "")} You can still save it as a note.`;
    } else {
      hint.className = "field-hint is-ok";
      hint.textContent = "The test engine understands this condition format.";
    }
  }

  function renderInlineRun(host, run) {
    if (!host) return;

    host.hidden = false;
    host.innerHTML = `
      <div class="inline-result-head"><span>Simulated test result</span>${statusPill(run.status)}</div>
      <p>${escapeHTML(run.summary || "")}</p>
      <p class="run-muted">Simulation only. Nothing was saved, sent or changed.</p>
      <button class="action-button" type="button" data-report-run="${escapeHTML(run.id)}">View full report</button>
    `;
  }

  async function testEditorConfiguration() {
    if (!engine) {
      showToast("The test engine did not load. Check that engine.js is in the automate folder.", "error");
      return;
    }

    const button = $("#testConfig");
    const name = elements.name?.value.trim() || "Untitled workflow";

    const draft = {
      id: `preview-${editingId || "new"}`,
      name: `${clip(name, 80)} (unsaved test)`,
      type: elements.type?.value || "other",
      trigger: elements.trigger?.value || DEFAULT_TRIGGER,
      action: elements.action?.value || DEFAULT_ACTION,
      condition: (elements.condition?.value || "").trim(),
      description: (elements.description?.value || "").trim() || "(no description yet)",
      status: "draft",
      updatedAt: new Date().toISOString()
    };

    if (button) button.disabled = true;

    const run = await runTest(draft, null, { navigate: false });

    if (button) button.disabled = false;

    if (run) renderInlineRun($("#builderTestResult"), run);
  }

  function initBuilderExtras() {
    const syntax = $("#conditionSyntax");

    if (syntax && engine) syntax.textContent = engine.CONDITION_SYNTAX_HELP;

    elements.form?.addEventListener("input", () => {
      updateBuilderPreview();
    });

    elements.form?.addEventListener("change", updateBuilderPreview);
    elements.condition?.addEventListener("input", updateConditionHint);

    elements.description?.addEventListener("input", () => {
      elements.description.classList.remove("invalid");

      const error = $("#workflowDescriptionError");

      if (error) error.hidden = true;
    });

    elements.name?.addEventListener("input", () => {
      const error = $("#workflowNameError");

      if (error) error.hidden = true;
    });

    $("#testConfig")?.addEventListener("click", testEditorConfiguration);

    $("#builderTestResult")?.addEventListener("click", event => {
      const button = event.target.closest("[data-report-run]");

      if (button) openReport(button.dataset.reportRun);
    });
  }

  /* ==========================================================================
     v2 — Template library
     ========================================================================== */

  function renderLibrary() {
    const host = $("#templateLibrary");
    const chips = $("#templateCategories");

    if (!host || !chips) return;

    const query = ($("#templateSearch")?.value || "").trim().toLowerCase();

    chips.innerHTML = LIBRARY_CATEGORIES.map(([key, label]) => `
      <button class="chip" type="button" data-lib-category="${escapeHTML(key)}" aria-pressed="${session.libraryCategory === key ? "true" : "false"}">${escapeHTML(label)}</button>
    `).join("");

    const items = LIBRARY.filter(item => {
      if (session.libraryCategory !== "all" && item.category !== session.libraryCategory) return false;

      return !query || [item.name, item.description, formatTrigger(item.trigger), formatAction(item.action)]
        .join(" ").toLowerCase().includes(query);
    });

    const count = $("#templateCount");

    if (count) count.textContent = `${items.length} template${items.length === 1 ? "" : "s"}`;

    if (!items.length) {
      host.innerHTML = `
        <div class="empty-state lib-empty">
          <p class="empty-title">No templates match</p>
          <p class="empty-text">Try another category or search term.</p>
        </div>
      `;
      return;
    }

    host.innerHTML = items.map(item => `
      <article class="lib-card">
        <h3>${escapeHTML(item.name)}</h3>
        <p>${escapeHTML(item.description)}</p>
        <div class="lib-flow">
          <span class="badge">${escapeHTML(formatTrigger(item.trigger))}</span>
          <span class="badge badge-sim">${escapeHTML(formatAction(item.action))}</span>
        </div>
        <div class="lib-actions">
          <button class="action-button" type="button" data-lib-preview="${escapeHTML(item.key)}">Preview</button>
          <button class="action-button" type="button" data-lib-use="${escapeHTML(item.key)}">Use template</button>
        </div>
      </article>
    `).join("");
  }

  async function previewTemplate(key) {
    const item = templates[key];

    if (!item) return;

    const useIt = await showDialog({
      title: item.name,
      paragraphs: [item.description],
      facts: [
        ["Category", formatType(item.type)],
        ["Start when", formatTrigger(item.trigger)],
        ["Only if", item.condition || "No condition"],
        ["Action", formatAction(item.action)]
      ],
      confirmLabel: "Use this template",
      cancelLabel: "Close"
    });

    if (useIt) startTemplate(key);
  }

  function initTemplateLibrary() {
    $("#templateSearch")?.addEventListener("input", renderLibrary);

    $("#templateCategories")?.addEventListener("click", event => {
      const chip = event.target.closest("[data-lib-category]");

      if (!chip) return;

      session.libraryCategory = chip.dataset.libCategory;
      renderLibrary();
      $(`[data-lib-category="${session.libraryCategory}"]`, $("#templateCategories"))?.focus();
    });

    $("#templateLibrary")?.addEventListener("click", event => {
      const use = event.target.closest("[data-lib-use]");
      const preview = event.target.closest("[data-lib-preview]");

      if (use) startTemplate(use.dataset.libUse);
      else if (preview) previewTemplate(preview.dataset.libPreview);
    });
  }

  /* ==========================================================================
     v2 — ALPHA-O AUTOMATE AI (frontend only)

     No AI model is connected. aiAdapter.generate() is the single place a secure
     backend call will be connected later (never call a provider from this file
     and never place keys here). Until then it maps keywords in the request to
     the triggers and actions the engine supports, and says so.
     ========================================================================== */

  function firstMatchIndex(pattern, text) {
    return text.search(new RegExp(pattern.source, "i"));
  }

  function lastMatchIndex(pattern, text) {
    const global = new RegExp(pattern.source, "gi");
    let match;
    let index = -1;

    while ((match = global.exec(text)) !== null) {
      index = match.index;
      if (match[0].length === 0) global.lastIndex += 1;
    }

    return index;
  }

  const AI_TRIGGER_RULES = [
    ["schedule", /\b(every|daily|weekly|monthly|each (day|week|month|morning)|scheduled?|on a schedule)\b/],
    ["new-email", /\b(e-?mails?|inbox|gmail|mailbox)\b/],
    ["form-submission", /\b(forms?|submissions?|submitted|requests?|inquir(y|ies)|enquir(y|ies)|sign-?ups?)\b/],
    ["file-added", /\b(files?|upload(ed|s)?|attachments?|pdf|documents?)\b/],
    ["webhook", /\b(webhooks?|callbacks?|api call)\b/]
  ];

  const AI_ACTION_RULES = [
    ["summarize", /\b(summari[sz]e|summary|digest|recap)\b/],
    ["draft-email", /\b(draft|reply|respond|follow-?up|write an? e-?mail|email (them|back))\b/],
    ["create-task", /\b(tasks?|to-?do|assign|categori[sz]e[sd]?|classify|sort|prioriti[sz]e|organi[sz]e|checklist)\b/],
    ["analyze-data", /\b(report|analy[sz]e|analysis|metrics|statistics|kpis?)\b/],
    ["notify", /\b(notif(y|ication|ications)|alerts?|remind(er|ers)?|ping|inform|slack)\b/],
    ["process-file", /\b(process|convert|extract|rename|archive)\b/]
  ];

  function deriveName(prompt) {
    const cleaned = prompt
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^(please\s+)?(can you\s+)?(create|make|build|set up|setup|add)\s+(me\s+)?(a|an|the)?\s*(new\s+)?(automation|workflow)?\s*(that|which|to|for)?\s*/i, "")
      .replace(/[.!?]+$/, "")
      .replace(/[,;:]/g, "");

    const words = cleaned.split(" ").filter(Boolean).slice(0, 6).join(" ");

    return clip(words ? words.charAt(0).toUpperCase() + words.slice(1) : "New workflow", 100);
  }

  function interpretPrompt(prompt) {
    const text = prompt.trim();
    const notes = [];

    // Trigger: the earliest matching phrase usually describes what starts the workflow.
    let trigger = DEFAULT_TRIGGER;
    let earliest = Infinity;

    AI_TRIGGER_RULES.forEach(([key, pattern]) => {
      const index = firstMatchIndex(pattern, text);

      if (index !== -1 && index < earliest) {
        earliest = index;
        trigger = key;
      }
    });

    if (earliest === Infinity) {
      notes.push("I could not tell what should start this workflow, so I chose “Manually started”.");
    }

    // Action: the last matching phrase usually describes the final goal.
    const matchedActions = AI_ACTION_RULES
      .map(([key, pattern]) => ({ key, index: lastMatchIndex(pattern, text) }))
      .filter(item => item.index !== -1)
      .sort((a, b) => b.index - a.index);

    let action = DEFAULT_ACTION;

    if (matchedActions.length) {
      action = matchedActions[0].key;

      if (matchedActions.length > 1) {
        const others = matchedActions.slice(1).map(item => formatAction(item.key)).join(", ");
        notes.push(`Your request mentions several actions. This engine supports one action per workflow, so I chose “${formatAction(action)}”. Also mentioned: ${others}.`);
      }
    } else {
      notes.push("I could not match an action, so I chose “Summarize information”.");
    }

    // Condition: only simple rules the engine can evaluate.
    const clauses = [];

    if (/\b(urgent|high[- ]priority|critical)\b/i.test(text)) clauses.push("priority is urgent");

    const amount = text.match(/\b(over|above|more than|greater than|exceeds?|larger than|at least)\s+(?:usd\s*)?\$?\s?(\d[\d,]*(?:\.\d+)?)/i);

    if (amount) {
      const operator = /at least/i.test(amount[1]) ? ">=" : ">";
      clauses.push(`amount ${operator} ${amount[2].replace(/,/g, "")}`);
    }

    if (/\b(unpaid|overdue)\b/i.test(text)) clauses.push("status is open");
    if (/\b(failed|failure)\b/i.test(text)) clauses.push("status is failed");

    const condition = clauses.slice(0, 2).join(" AND ");

    if (condition) {
      notes.push("I guessed the condition from keywords. Check that the field names match the data your workflow will receive.");
    }

    let type;

    if (action === "analyze-data") type = "reporting";
    else if (/\b(sales|customers?|clients?|invoices?|orders?|operations|business)\b/i.test(text)) type = "business";
    else if (action === "draft-email" || action === "notify") type = "communication";
    else if (action === "create-task" || action === "summarize") type = "productivity";
    else type = "other";

    return {
      source: "local-rules",
      notes,
      proposal: {
        name: deriveName(text),
        type,
        trigger,
        action,
        condition,
        description: clip(`${text}\n\nProposed from your request by local keyword rules. No AI model was used.`, 2000)
      }
    };
  }

  const AI_VALID_TYPES = ["business", "communication", "productivity", "reporting", "other"];
  const AI_VALID_TRIGGERS = ["manual", "schedule", "new-email", "form-submission", "file-added", "webhook"];
  const AI_VALID_ACTIONS = ["summarize", "draft-email", "create-task", "analyze-data", "notify", "process-file"];

  // Never trust model output: force every field into what this workspace supports.
  function sanitizeAiProposal(raw) {
    const p = raw && typeof raw === "object" ? raw : {};
    const str = (value, max) => clip(String(value == null ? "" : value).replace(/\s+/g, " ").trim(), max);

    return {
      name: str(p.name, 100) || "New workflow",
      type: AI_VALID_TYPES.includes(p.type) ? p.type : "other",
      trigger: AI_VALID_TRIGGERS.includes(p.trigger) ? p.trigger : DEFAULT_TRIGGER,
      action: AI_VALID_ACTIONS.includes(p.action) ? p.action : DEFAULT_ACTION,
      condition: str(p.condition, 300),
      description: clip(String(p.description || "").trim(), 2000)
    };
  }

  const aiAdapter = {
    mode: "local-rules",
    async generate(prompt) {
      // Real AI: goes through your Cloudflare Worker. The provider key lives
      // only on the server. Needs the admin token, so only when connected.
      if (cloudConnected) {
        try {
          const data = await cloudRequest("/admin/ai/propose", {
            method: "POST",
            body: JSON.stringify({ prompt: clip(prompt, 2000) })
          });

          if (!data || typeof data.proposal !== "object") throw new Error("Empty AI response");

          return {
            source: "ai",
            provider: typeof data.provider === "string" ? clip(data.provider, 40) : "",
            notes: (Array.isArray(data.notes) ? data.notes : [])
              .slice(0, 6).map(n => clip(String(n), 300)).filter(Boolean),
            proposal: sanitizeAiProposal(data.proposal)
          };
        } catch (error) {
          console.warn("Alpha-O Automate: AI service failed, using local rules.", error);
          const fallback = interpretPrompt(prompt);

          fallback.notes.unshift("The AI service could not be reached, so I used local keyword rules instead.");
          return fallback;
        }
      }

      await wait(450); // Short pause so the busy state is visible.
      return interpretPrompt(prompt);
    }
  };

  function addChat(role, text, extra = {}) {
    const entry = { role, text, busy: Boolean(extra.busy) };

    session.chat.push(entry);
    session.chat = session.chat.slice(-30);
    renderChat();

    return entry;
  }

  function renderChat() {
    const host = $("#aiMessages");

    if (!host) return;

    host.replaceChildren();

    session.chat.forEach(entry => {
      const bubble = document.createElement("div");
      bubble.className = `ai-msg ai-msg-${entry.role}${entry.busy ? " ai-msg-busy" : ""}`;

      const name = document.createElement("span");
      name.className = "ai-msg-name";
      name.textContent = entry.role === "user" ? "You" : "ALPHA-O AUTOMATE AI";
      bubble.appendChild(name);

      if (entry.busy) {
        const spinner = document.createElement("span");
        spinner.className = "spinner";
        spinner.setAttribute("aria-hidden", "true");
        bubble.appendChild(spinner);
      }

      bubble.appendChild(document.createTextNode(entry.text));
      host.appendChild(bubble);
    });

    host.scrollTop = host.scrollHeight;
  }

  function setAiError(message) {
    const node = $("#aiError");
    const input = $("#aiPrompt");

    if (!node) return;

    node.textContent = message || "";
    node.hidden = !message;
    input?.classList.toggle("invalid", Boolean(message));
  }

  function readProposalFields() {
    return {
      name: ($("#aiName")?.value || "").trim(),
      type: $("#aiType")?.value || "other",
      trigger: $("#aiTrigger")?.value || DEFAULT_TRIGGER,
      action: $("#aiAction")?.value || DEFAULT_ACTION,
      condition: ($("#aiCondition")?.value || "").trim(),
      description: ($("#aiDescription")?.value || "").trim()
    };
  }

  function checkProposal(fields) {
    const checks = [];

    if (!fields.name) checks.push({ level: "error", text: "Add a name." });
    if (!fields.description) checks.push({ level: "error", text: "Add notes describing the expected result." });

    if (engine) {
      const normalized = engine.normalizeWorkflow({ id: "proposal", ...fields, updatedAt: "" });

      normalized.errors
        .filter(text => !/no name|description/i.test(text))
        .forEach(text => checks.push({ level: "error", text }));
    }

    if (!fields.condition) {
      checks.push({ level: "ok", text: "No condition. The action will always run." });
    } else if (engine) {
      const result = engine.evaluateCondition(fields.condition, engine.getSampleInput());

      if (result.status === "UNSUPPORTED") {
        checks.push({ level: "warn", text: `The test engine cannot read this condition yet. ${result.summary.replace("This condition cannot be evaluated: ", "")}` });
      } else if (result.status === "ERROR") {
        checks.push({ level: "warn", text: "The condition format is valid, but the sample test input is missing a field it uses. Edit the test input before testing." });
      } else {
        checks.push({ level: "ok", text: "The test engine understands this condition." });
      }
    }

    checks.push({ level: "ok", text: "The trigger and action are supported by the test engine." });
    checks.push({ level: "warn", text: "Not active. It can only be tested in simulation." });

    return checks;
  }

  function renderProposalChecks() {
    const host = $("#aiChecks");

    if (!host) return;

    const checks = checkProposal(readProposalFields());
    const labels = { ok: "OK", warn: "Note", error: "Fix" };

    host.innerHTML = checks.map(check => `
      <li class="check-item check-${check.level}"><span class="check-mark">${labels[check.level]}</span><span>${escapeHTML(check.text)}</span></li>
    `).join("");

    updateProposalState(checks);
  }

  function updateProposalState(knownChecks) {
    const accept = $("#aiAccept");

    if (!accept) return;

    const body = $("#aiProposalBody");
    const hasProposal = body && !body.hidden;
    const checks = knownChecks || (hasProposal ? checkProposal(readProposalFields()) : []);
    const hasErrors = checks.some(check => check.level === "error");

    accept.disabled = cloudConnected || hasErrors || !hasProposal;

    accept.title = cloudConnected
      ? "Accepting is frontend-only for now and is turned off while Cloudflare is connected. Use Open in builder to save through the normal editor."
      : hasErrors
        ? "Fix the items marked Fix first."
        : "Save as a draft in this browser. It will not be active.";
  }

  function loadProposal(result) {
    const proposal = result.proposal;

    $("#aiName").value = proposal.name;
    $("#aiType").value = proposal.type;
    $("#aiTrigger").value = proposal.trigger;
    $("#aiAction").value = proposal.action;
    $("#aiCondition").value = proposal.condition;
    $("#aiDescription").value = proposal.description;

    $("#aiProposalSource").textContent = result.source === "local-rules"
      ? "Source: local keyword rules. No AI model was used."
      : `Source: connected AI service${result.provider ? " (" + result.provider + ")" : ""}.`;

    const notes = $("#aiProposalNotes");

    notes.replaceChildren();
    result.notes.forEach(text => {
      const item = document.createElement("li");
      item.textContent = text;
      notes.appendChild(item);
    });

    const testResult = $("#aiTestResult");

    if (testResult) testResult.hidden = true;

    $("#aiProposalEmpty").hidden = true;
    $("#aiProposalBody").hidden = false;

    session.proposalSeq += 1;
    renderProposalChecks();
  }

  function clearProposal() {
    const body = $("#aiProposalBody");
    const empty = $("#aiProposalEmpty");

    if (body) body.hidden = true;
    if (empty) empty.hidden = false;

    updateProposalState([]);
  }

  async function submitPrompt(event) {
    event.preventDefault();

    if (session.aiBusy) return;

    const input = $("#aiPrompt");
    const text = (input?.value || "").trim();

    if (text.length < 8) {
      setAiError("Describe what should start the workflow and what it should do, in at least a few words.");
      input?.focus();
      return;
    }

    setAiError("");
    session.aiBusy = true;

    const send = $("#aiSend");

    if (send) send.disabled = true;

    addChat("user", text);
    input.value = "";
    updateAiCount();

    const pending = addChat("assistant", "Reading your request…", { busy: true });

    try {
      const result = await aiAdapter.generate(text);

      pending.busy = false;
      pending.text = result.source === "ai"
        ? "I read your request and drafted a proposal on the right. Review and edit it before saving anything."
        : cloudConnected
          ? "The AI service did not answer, so I matched keywords instead. The proposal is on the right. Review and edit it before saving anything."
          : "Connect your workspace (Cloud connection on the Dashboard) to use the real AI. For now I matched keywords in your request. The proposal is on the right. Review and edit it before saving anything.";
      loadProposal(result);
    } catch (error) {
      console.error("Alpha-O Automate: Could not build a proposal.", error);
      pending.busy = false;
      pending.text = "I could not build a proposal from that request. Try rewording it, or create the workflow in the builder.";
    } finally {
      session.aiBusy = false;
      if (send) send.disabled = false;
      renderChat();
    }
  }

  function updateAiCount() {
    const input = $("#aiPrompt");
    const count = $("#aiPromptCount");

    if (input && count) count.textContent = `${input.value.length} / ${input.maxLength}`;
  }

  async function testProposal() {
    const fields = readProposalFields();

    if (!fields.name || !fields.description) {
      renderProposalChecks();
      showToast("Add a name and notes before testing the proposal.", "error");
      return;
    }

    const button = $("#aiTest");

    if (button) button.disabled = true;

    const run = await runTest({
      id: `proposal-${session.proposalSeq}`,
      ...fields,
      name: `${clip(fields.name, 80)} (proposal test)`,
      status: "draft",
      updatedAt: new Date().toISOString()
    }, null, { navigate: false });

    if (button) button.disabled = false;

    if (run) renderInlineRun($("#aiTestResult"), run);
  }

  function acceptProposal() {
    if (cloudConnected) {
      showToast("Accepting is frontend-only for now and is turned off while Cloudflare is connected. Use Open in builder instead.", "warn");
      return;
    }

    const fields = readProposalFields();
    const checks = checkProposal(fields);

    if (checks.some(check => check.level === "error")) {
      renderProposalChecks();
      showToast("Fix the items marked Fix before accepting.", "error");
      return;
    }

    const workflow = {
      id: createId(),
      ...fields,
      status: "draft",
      updatedAt: new Date().toISOString()
    };

    const previous = workflows;

    workflows = [workflow, ...workflows];

    if (!persistWorkflows()) {
      workflows = previous;
      return;
    }

    clearProposal();
    render();
    logActivity("info", `Accepted AI proposal as draft: ${workflow.name}`);
    addChat("assistant", `Saved “${workflow.name}” as a draft in this browser. It is not active. Open Workflows to review it, edit it or run a test.`);
    showToast("Saved as a draft. It is not active.");
  }

  function rejectProposal() {
    clearProposal();
    addChat("assistant", "Proposal discarded. Nothing was saved. Describe another automation whenever you are ready.");
    showToast("Proposal discarded.");
  }

  function openProposalInBuilder() {
    const fields = readProposalFields();

    openEditor(null, {
      name: fields.name,
      type: fields.type,
      trigger: fields.trigger,
      action: fields.action,
      condition: fields.condition,
      description: fields.description
    });
  }

  function initAssistant() {
    const copyOptions = (from, to) => {
      if (!from || !to) return;

      to.replaceChildren();
      $$("option", from).forEach(option => to.appendChild(option.cloneNode(true)));
    };

    copyOptions(elements.type, $("#aiType"));
    copyOptions(elements.trigger, $("#aiTrigger"));
    copyOptions(elements.action, $("#aiAction"));

    const suggestions = $("#aiSuggestions");

    if (suggestions) {
      suggestions.replaceChildren();

      AI_SUGGESTIONS.forEach(text => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ai-suggestion";
        button.textContent = text;
        button.addEventListener("click", () => {
          const input = $("#aiPrompt");

          input.value = text;
          setAiError("");
          updateAiCount();
          input.focus();
        });
        suggestions.appendChild(button);
      });
    }

    session.chat = [{
      role: "assistant",
      busy: false,
      text: "Hi, I'm ALPHA-O AUTOMATE AI. Describe an automation in plain language and I will propose a trigger, condition and action. Once your workspace is connected to Cloudflare I use the same AI as Alpha-O; until then I match keywords. You stay in control: nothing is saved until you accept it, and nothing becomes active."
    }];

    renderChat();
    updateAiCount();

    $("#aiForm")?.addEventListener("submit", submitPrompt);
    $("#aiPrompt")?.addEventListener("input", () => {
      updateAiCount();
      setAiError("");
    });

    $("#aiPrompt")?.addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        $("#aiForm")?.requestSubmit();
      }
    });

    ["#aiName", "#aiType", "#aiTrigger", "#aiAction", "#aiCondition", "#aiDescription"].forEach(selector => {
      const node = $(selector);

      node?.addEventListener("input", renderProposalChecks);
      node?.addEventListener("change", renderProposalChecks);
    });

    $("#aiTest")?.addEventListener("click", testProposal);
    $("#aiAccept")?.addEventListener("click", acceptProposal);
    $("#aiReject")?.addEventListener("click", rejectProposal);
    $("#aiBuilder")?.addEventListener("click", openProposalInBuilder);

    $("#aiTestResult")?.addEventListener("click", event => {
      const button = event.target.closest("[data-report-run]");

      if (button) openReport(button.dataset.reportRun);
    });

    updateProposalState([]);
  }

  /* ==========================================================================
     v2 — Workspaces and clients (demonstration data only)
     ========================================================================== */

  const CLIENT_STATUS = {
    active: { label: "Active", badge: "badge-ok" },
    onboarding: { label: "Onboarding", badge: "badge-warn" },
    paused: { label: "Paused", badge: "badge-muted" }
  };

  function renderWorkspaces() {
    const select = $("#wsSwitch");

    if (!select) return;

    if (!select.options.length) {
      WORKSPACES.forEach(workspace => {
        const option = document.createElement("option");
        option.value = workspace.id;
        option.textContent = workspace.name;
        select.appendChild(option);
      });
    }

    const workspace = WORKSPACES.find(item => item.id === session.wsId) || WORKSPACES[0];

    select.value = workspace.id;

    const notice = $("#wsNotice");
    const summary = $("#wsSummary");
    const list = $("#wsClients");
    const detail = $("#wsDetail");
    const title = $("#wsListTitle");

    const cell = (label, value) =>
      `<div class="monitor-cell"><div class="stat-label">${escapeHTML(label)}</div><strong>${escapeHTML(value)}</strong></div>`;

    if (workspace.kind === "local") {
      notice.textContent = "This is your real workspace: the workflows saved in this browser (or Cloudflare when connected). Client workspaces are not available yet.";
      summary.innerHTML = cell("Clients", "0") + cell("Workflows", String(workflows.length)) + cell("Owner", "You") + cell("Storage", cloudConnected ? "Cloudflare" : "This browser");
      title.textContent = "Clients";
      list.innerHTML = '<li class="mini-empty">No clients yet. Separate client workspaces arrive with the database phase.</li>';

      detail.innerHTML = `
        <div class="panel-head"><h3 class="panel-title">Your workflows</h3></div>
        ${workflows.length ? `<ul class="ws-rows">${workflows.slice(0, 12).map(item => `
          <li class="ws-row">
            <div class="ws-row-main"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(formatTrigger(item.trigger || DEFAULT_TRIGGER))} → ${escapeHTML(formatAction(item.action || DEFAULT_ACTION))} · Owner: you</span></div>
            <button class="action-button" type="button" data-ws-open="${escapeHTML(item.id)}">Details</button>
          </li>`).join("")}</ul>` : '<p class="mini-empty">You have no workflows yet. Create one from the Workflows page.</p>'}
      `;

      return;
    }

    notice.textContent = "Demonstration data. These agencies, clients and workflows are samples for layout only. They are not stored, and each client's sample data stays inside that client.";

    const clients = workspace.clients;
    const totalWorkflows = clients.reduce((sum, client) => sum + client.workflows.length, 0);
    const activeClients = clients.filter(client => client.status === "active").length;

    summary.innerHTML = cell("Clients", String(clients.length)) + cell("Active clients", String(activeClients)) + cell("Sample workflows", String(totalWorkflows)) + cell("Data", "Demonstration");

    title.textContent = "Clients";

    if (!clients.some(client => client.id === session.clientId)) session.clientId = clients[0].id;

    list.innerHTML = clients.map(client => `
      <li><button class="ws-client" type="button" data-ws-client="${escapeHTML(client.id)}" aria-current="${client.id === session.clientId ? "true" : "false"}">
        <span class="ws-client-name">${escapeHTML(client.name)}</span>
        <span class="badge ${CLIENT_STATUS[client.status].badge}">${escapeHTML(CLIENT_STATUS[client.status].label)}</span>
      </button></li>
    `).join("");

    const client = clients.find(item => item.id === session.clientId);

    detail.innerHTML = `
      <div class="panel-head">
        <h3 class="panel-title">${escapeHTML(client.name)}</h3>
        <span class="badge badge-warn">Sample client</span>
      </div>
      <h4 class="panel-subtitle">Workflows</h4>
      <ul class="ws-rows">
        ${client.workflows.map((item, index) => `
          <li class="ws-row">
            <div class="ws-row-main"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(formatTrigger(item.trigger))} → ${escapeHTML(formatAction(item.action))} · Owner: ${escapeHTML(item.owner)}</span></div>
            <button class="action-button" type="button" data-ws-template="${index}" title="Open a copy in the builder. It is not linked to this sample client.">Use as template</button>
          </li>`).join("")}
      </ul>
      <h4 class="panel-subtitle">Workspace activity</h4>
      <ol class="activity-list">
        ${client.activity.map(item => `
          <li class="activity-item"><span class="activity-dot" aria-hidden="true"></span><span>${escapeHTML(item.text)}<span class="sample-tag">SAMPLE</span></span><span class="activity-time">${escapeHTML(relTime(Date.now() - item.minutesAgo * 60000))}</span></li>`).join("")}
      </ol>
    `;
  }

  function initWorkspaces() {
    $("#wsSwitch")?.addEventListener("change", event => {
      session.wsId = event.target.value;
      session.clientId = null;
      renderWorkspaces();
    });

    $("#wsClients")?.addEventListener("click", event => {
      const button = event.target.closest("[data-ws-client]");

      if (!button) return;

      session.clientId = button.dataset.wsClient;
      renderWorkspaces();
      $(`[data-ws-client="${session.clientId}"]`, $("#wsClients"))?.focus();
    });

    $("#wsDetail")?.addEventListener("click", event => {
      const open = event.target.closest("[data-ws-open]");
      const template = event.target.closest("[data-ws-template]");

      if (open) {
        openDrawer(open.dataset.wsOpen);
      } else if (template) {
        const workspace = WORKSPACES.find(item => item.id === session.wsId);
        const client = workspace && workspace.clients && workspace.clients.find(item => item.id === session.clientId);
        const item = client && client.workflows[Number(template.dataset.wsTemplate)];

        if (item) {
          openEditor(null, {
            name: item.name,
            type: item.type,
            trigger: item.trigger,
            action: item.action,
            condition: item.condition,
            description: item.description
          });
        }
      }
    });
  }

  /* ==========================================================================
     v2 — Integrations and API management (nothing is connected)
     ========================================================================== */

  function renderIntegrations() {
    const filters = $("#intFilters");
    const grid = $("#intGrid");
    const rows = $("#intRows");

    if (!filters || !grid || !rows) return;

    const options = [["all", "All"], ...Object.keys(INT_STATUS).map(key => [key, INT_STATUS[key].label])];

    filters.innerHTML = options.map(([key, label]) => `
      <button class="chip" type="button" data-int-filter="${escapeHTML(key)}" aria-pressed="${session.intFilter === key ? "true" : "false"}">${escapeHTML(label)}</button>
    `).join("");

    const items = INTEGRATIONS.filter(item => session.intFilter === "all" || item.status === session.intFilter);

    grid.innerHTML = items.length
      ? items.map(item => `
        <article class="int-card">
          <div class="int-card-top">
            <h3>${escapeHTML(item.name)}</h3>
            <span class="badge ${INT_STATUS[item.status].badge}">${escapeHTML(INT_STATUS[item.status].label)}</span>
          </div>
          <p>${escapeHTML(item.blurb)}</p>
          <dl class="int-facts"><dt>Credentials</dt><dd>None stored</dd><dt>Permissions</dt><dd>Not requested</dd></dl>
          <button class="action-button" type="button" data-int-details="${escapeHTML(item.id)}">What this will do</button>
        </article>`).join("")
      : '<div class="empty-state lib-empty"><p class="empty-title">Nothing in this group</p><p class="empty-text">Choose another status.</p></div>';

    rows.innerHTML = INTEGRATIONS.map(item => `
      <tr>
        <th scope="row">${escapeHTML(item.name)}</th>
        <td><span class="badge ${INT_STATUS[item.status].badge}">${escapeHTML(INT_STATUS[item.status].label)}</span></td>
        <td>None stored</td>
        <td>Not requested</td>
        <td><button class="action-button" type="button" data-int-details="${escapeHTML(item.id)}">Details</button></td>
      </tr>`).join("");
  }

  function showIntegration(id) {
    const item = INTEGRATIONS.find(entry => entry.id === id);

    if (!item) return;

    showDialog({
      title: item.name,
      paragraphs: [
        item.blurb,
        "Connecting is not possible in this phase. Real connections will sign in on the server, so no password, token or key is ever stored in this page."
      ],
      facts: [
        ["Status", INT_STATUS[item.status].label],
        ["Credentials", "None stored"],
        ["Permissions", "Not requested"]
      ],
      items: item.plans.map(text => `Planned: ${text}`),
      confirmLabel: "Close",
      cancelLabel: null
    });
  }

  function initIntegrations() {
    $("#intFilters")?.addEventListener("click", event => {
      const button = event.target.closest("[data-int-filter]");

      if (!button) return;

      session.intFilter = button.dataset.intFilter;
      renderIntegrations();
      $(`[data-int-filter="${session.intFilter}"]`, $("#intFilters"))?.focus();
    });

    $("#integrationsSection")?.addEventListener("click", event => {
      const button = event.target.closest("[data-int-details]");

      if (button) showIntegration(button.dataset.intDetails);
    });
  }

  /* ==========================================================================
     v2 — Roles and permissions (visual preview only; not a security control)
     ========================================================================== */

  const PERM_LABEL = { yes: "Allowed", limited: "Limited", no: "Not allowed" };

  function renderAccess() {
    const select = $("#rbacRole");
    const head = $("#rbacHead");
    const body = $("#rbacBody");
    const summary = $("#rbacSummary");

    if (!select || !head || !body || !summary) return;

    if (!select.options.length) {
      ROLES.forEach(role => {
        const option = document.createElement("option");
        option.value = role.id;
        option.textContent = role.name;
        select.appendChild(option);
      });
    }

    select.value = session.role;

    const active = ROLES.find(role => role.id === session.role) || ROLES[0];

    head.innerHTML = `<tr><th scope="col">Capability</th>${ROLES.map(role =>
      `<th scope="col" class="${role.id === active.id ? "col-active" : ""}">${escapeHTML(role.name)}</th>`).join("")}</tr>`;

    body.innerHTML = CAPABILITIES.map((capability, row) => `
      <tr><th scope="row">${escapeHTML(capability)}</th>${ROLES.map(role =>
        `<td class="${role.id === active.id ? "col-active" : ""}"><span class="perm perm-${role.perms[row]}">${PERM_LABEL[role.perms[row]]}</span></td>`).join("")}</tr>`).join("");

    const group = level => CAPABILITIES.filter((_, index) => active.perms[index] === level);
    const list = items => items.length ? items.join(", ") : "none";

    summary.innerHTML = `
      <p><strong>Previewing as ${escapeHTML(active.name)}.</strong> ${escapeHTML(active.blurb)}</p>
      <p>Allowed: ${escapeHTML(list(group("yes")))}. Limited: ${escapeHTML(list(group("limited")))}. Not allowed: ${escapeHTML(list(group("no")))}.</p>
      <p>Nothing in this workspace changes when you pick a role.</p>
    `;
  }

  function initAccess() {
    $("#rbacRole")?.addEventListener("change", event => {
      session.role = event.target.value;
      renderAccess();
    });
  }

  /* ==========================================================================
     v2 — Start-up for the new modules (each isolated so one failure cannot
     stop the original workspace from loading)
     ========================================================================== */

  function safeInit(name, fn) {
    try {
      fn();
    } catch (error) {
      console.error(`Alpha-O Automate: ${name} could not start.`, error);
    }
  }

  function initEnhancements() {
    safeInit("filters", initFilters);
    safeInit("dialogs", initDialogAndDrawer);
    safeInit("builder extras", initBuilderExtras);
    safeInit("template library", initTemplateLibrary);
    safeInit("assistant", initAssistant);
    safeInit("workspaces", initWorkspaces);
    safeInit("integrations", initIntegrations);
    safeInit("access", initAccess);
    safeInit("activity", seedActivity);

    window.addEventListener("hashchange", () => applyView(viewFromHash()));
    applyView(viewFromHash());
  }

  /* ---------- Initialize ---------- */

  function init() {
    elements.form?.addEventListener(
      "submit",
      saveWorkflow
    );
    elements.cloudConnect?.addEventListener(
      "click",
      connectCloud
    );

    elements.cloudDisconnect?.addEventListener(
      "click",
      disconnectCloud
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

    document.addEventListener("keydown", handleKeydown);

    $$("[data-workflow-template]").forEach(button => {
      button.addEventListener("click", () => {
        startTemplate(button.dataset.workflowTemplate);
      });
    });

    mountEnginePanel();

    if (engine) engine.subscribe(handleEngineEvent);

    initEnhancements();

    render();
    renderReport();
    renderHistory();

    const savedCloudToken = sessionStorage.getItem(TOKEN_KEY);

    if (savedCloudToken) {
      cloudToken = savedCloudToken;
      elements.cloudToken.value = savedCloudToken;
      connectCloud();
    }
  }

  init();
})();
