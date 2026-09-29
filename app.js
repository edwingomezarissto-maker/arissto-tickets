const STORAGE_KEY = "arisstoSupportCases";
const TASKS_KEY = "arisstoSupportTasks";
const THEME_KEY = "arisstoTheme";
const COOPERATIVES_KEY = "arisstoCooperatives";
const COOPERATIVES_VERSION_KEY = "arisstoCooperativesVersion";
const COOPERATIVES_VERSION = "2026-06-25-1";
const DEFAULT_CASES = Array.isArray(window.ARISSTO_DEFAULT_CASES) ? window.ARISSTO_DEFAULT_CASES : [];
const MONTH_FILTER_START = "2026-01";
const MONTH_FILTER_END = "2028-12";

const DEFAULT_COOPERATIVES = [
  "C_360GRADOS",
  "C_ACEISRI",
  "C_ACOCAM",
  "C_ACOEMPROES",
  "C_ACOEMPROES_TEST",
  "C_ACOESUR",
  "C_ASOSYKES",
  "C_AVANCE",
  "C_CODESAL",
  "C_COODESAL",
  "C_CODEFAM_TEST",
  "C_CREDESAL",
  "C_CREDIFIABLE",
  "C_CREDIORIENTE",
  "C_CREDIPLATA",
  "C_CREDIPLATA_TEST",
  "C_CREDIPLUS",
  "C_CRECEFINANCE",
  "C_DEFAM",
  "C_FPE_BFA",
  "C_FUNDASAL",
  "C_HABITAT_LIVING",
  "C_INTERNACIONAL",
  "C_INTERNACIONAL_TES",
  "C_INVERSIONES",
  "C_KAPITAL",
  "C_NICO",
  "C_NORTHLINE_TEST",
  "C_PROGREZA",
  "C_RAPIDITOCASH",
  "C_SOCECONDIR",
];

const DEFAULT_CONTACTS_BY_COOPERATIVE = {
  C_360GRADOS: [
    { name: "Beatriz 360", phone: "50360793584", position: "" },
  ],
  C_ACEISRI: [
    { name: "anairma_g...", phone: "50375941535", position: "" },
    { name: "Marco Mar...", phone: "50375149439", position: "" },
    { name: "Maricela ro...", phone: "50377484569", position: "" },
    { name: "Mau", phone: "50379716072", position: "" },
  ],
  C_ACOCAM: [
    { name: "Fabio Menj...", phone: "50376502622", position: "" },
    { name: "Moises Bla...", phone: "50376779280", position: "" },
    { name: "Moises Bla...", phone: "50376655897", position: "" },
  ],
  C_ACOEMPROES: [
    { name: "Fabio Menj...", phone: "50376502622", position: "" },
    { name: "ACOEMPR...", phone: "50374696629", position: "" },
    { name: "Andrea Ra...", phone: "50377572900", position: "" },
    { name: "Aristides A...", phone: "50379647890", position: "" },
    { name: "DANIEL IN...", phone: "50378330349", position: "" },
    { name: "David Ram...", phone: "50371985628", position: "" },
    { name: "Franklin", phone: "50373491297", position: "" },
    { name: "FREDDY IN...", phone: "50378330043", position: "" },
    { name: "Griselda Vil...", phone: "50373491321", position: "" },
    { name: "MARIA JO...", phone: "50377686516", position: "" },
    { name: "Moises Bla...", phone: "50376779280", position: "" },
    { name: "Moises Bla...", phone: "50376655897", position: "" },
    { name: "Operacione...", phone: "50378021731", position: "" },
    { name: "Raul Anton...", phone: "50373905891", position: "" },
    { name: "Raul Argueta", phone: "50377683861", position: "" },
  ],
  C_ACOESUR: [
    { name: "Gabriela", phone: "50376064942", position: "" },
    { name: "Gabriela Ri...", phone: "50370174806", position: "" },
    { name: "Roxana Ser...", phone: "50378420657", position: "" },
    { name: "Stephanie ...", phone: "50371581601", position: "" },
  ],
  C_CODESAL: [
    { name: "Contacto COODESAL", phone: "50378080221", position: "" },
    { name: "Elizabeth P...", phone: "50360200090", position: "" },
    { name: "Josue", phone: "50374837070", position: "" },
    { name: "ManfredyZ...", phone: "50375130334", position: "" },
    { name: "Oscar Oma...", phone: "50377439765", position: "" },
    { name: "Roberto Al...", phone: "50372388759", position: "" },
    { name: "Wendy Cer...", phone: "50379132801", position: "" },
    { name: "Yessenia", phone: "50379403747", position: "" },
    { name: "Yessi", phone: "50361578233", position: "" },
  ],
  C_COODESAL: [
    { name: "Contacto COODESAL", phone: "50378080221", position: "" },
    { name: "Elizabeth P...", phone: "50360200090", position: "" },
    { name: "Josue", phone: "50374837070", position: "" },
    { name: "ManfredyZ...", phone: "50375130334", position: "" },
    { name: "Oscar Oma...", phone: "50377439765", position: "" },
    { name: "Roberto Al...", phone: "50372388759", position: "" },
    { name: "Wendy Cer...", phone: "50379132801", position: "" },
    { name: "Yessenia", phone: "50379403747", position: "" },
    { name: "Yessi", phone: "50361578233", position: "" },
  ],
};

const state = {
  cases: [],
  tasks: [],
  cooperatives: [],
  selectedCooperativeId: "",
  cooperativeSearch: "",
  dashboardMonth: "",
  filters: {
    search: "",
    status: "active",
    priority: "",
  },
};

const chartInstances = {};

const elements = {
  tabButtons: document.querySelectorAll("[data-tab-target]"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  countOpen: document.getElementById("countOpen"),
  countInProgress: document.getElementById("countInProgress"),
  countWaiting: document.getElementById("countWaiting"),
  countFinished: document.getElementById("countFinished"),
  countOverdue: document.getElementById("countOverdue"),
  dashboardUpdatedAt: document.getElementById("dashboardUpdatedAt"),
  dashboardMonthFilter: document.getElementById("dashboardMonthFilter"),
  chartEmptyState: document.getElementById("chartEmptyState"),
  graphicDashboardContent: document.getElementById("graphicDashboardContent"),
  visualActiveCases: document.getElementById("visualActiveCases"),
  visualHighPriorityCases: document.getElementById("visualHighPriorityCases"),
  visualOverdueCases: document.getElementById("visualOverdueCases"),
  visualFinishedCases: document.getElementById("visualFinishedCases"),
  visualTotalCases: document.getElementById("visualTotalCases"),
  statusChartTotal: document.getElementById("statusChartTotal"),
  priorityChartTotal: document.getElementById("priorityChartTotal"),
  ownerChartTotal: document.getElementById("ownerChartTotal"),
  requestDateChartTotal: document.getElementById("requestDateChartTotal"),
  statusChart: document.getElementById("statusChart"),
  priorityChart: document.getElementById("priorityChart"),
  ownerChart: document.getElementById("ownerChart"),
  requestDateChart: document.getElementById("requestDateChart"),
  dueOverdueCount: document.getElementById("dueOverdueCount"),
  dueTodayCount: document.getElementById("dueTodayCount"),
  dueSoonCount: document.getElementById("dueSoonCount"),
  recentCasesList: document.getElementById("recentCasesList"),
  caseTotalLabel: document.getElementById("caseTotalLabel"),
  casesTableBody: document.getElementById("casesTableBody"),
  emptyState: document.getElementById("emptyState"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  priorityFilter: document.getElementById("priorityFilter"),
  openCreateCase: document.getElementById("openCreateCase"),
  openCreateCaseSecondary: document.getElementById("openCreateCaseSecondary"),
  openCreateTask: document.getElementById("openCreateTask"),
  openCreateTaskSecondary: document.getElementById("openCreateTaskSecondary"),
  openCreateTaskTertiary: document.getElementById("openCreateTaskTertiary"),
  caseModal: document.getElementById("caseModal"),
  caseModalTitle: document.getElementById("caseModalTitle"),
  caseForm: document.getElementById("caseForm"),
  formAlert: document.getElementById("formAlert"),
  detailModal: document.getElementById("detailModal"),
  detailContent: document.getElementById("detailContent"),
  processModal: document.getElementById("processModal"),
  processForm: document.getElementById("processForm"),
  processAlert: document.getElementById("processAlert"),
  taskModal: document.getElementById("taskModal"),
  taskModalTitle: document.getElementById("taskModalTitle"),
  taskForm: document.getElementById("taskForm"),
  taskAlert: document.getElementById("taskAlert"),
  taskTotalLabel: document.getElementById("taskTotalLabel"),
  tasksTableBody: document.getElementById("tasksTableBody"),
  tasksEmptyState: document.getElementById("tasksEmptyState"),
  themeToggle: document.getElementById("themeToggle"),
  themeToggleText: document.getElementById("themeToggleText"),
  cooperativeTotalLabel: document.getElementById("cooperativeTotalLabel"),
  cooperativeForm: document.getElementById("cooperativeForm"),
  cooperativeAlert: document.getElementById("cooperativeAlert"),
  cooperativeSearch: document.getElementById("cooperativeSearch"),
  cooperativeList: document.getElementById("cooperativeList"),
  cooperativesEmptyState: document.getElementById("cooperativesEmptyState"),
  cancelCooperativeEdit: document.getElementById("cancelCooperativeEdit"),
  saveCooperativeButton: document.getElementById("saveCooperativeButton"),
  selectedCooperativeTitle: document.getElementById("selectedCooperativeTitle"),
  selectedCooperativeHelp: document.getElementById("selectedCooperativeHelp"),
  contactForm: document.getElementById("contactForm"),
  contactAlert: document.getElementById("contactAlert"),
  contactFieldset: document.getElementById("contactFieldset"),
  contactsTableBody: document.getElementById("contactsTableBody"),
  contactsEmptyState: document.getElementById("contactsEmptyState"),
  cancelContactEdit: document.getElementById("cancelContactEdit"),
  saveContactButton: document.getElementById("saveContactButton"),
  cooperativeOptions: document.getElementById("cooperativeOptions"),
  requesterOptions: document.getElementById("requesterOptions"),
  exportCasesTasks: document.getElementById("exportCasesTasks"),
  importCasesTasks: document.getElementById("importCasesTasks"),
  importFile: document.getElementById("importFile"),
  importMode: document.getElementById("importMode"),
  migrationAlert: document.getElementById("migrationAlert"),
  migrationStatus: document.getElementById("migrationStatus"),
};

const formFields = {
  id: document.getElementById("caseId"),
  title: document.getElementById("caseTitle"),
  cooperative: document.getElementById("cooperative"),
  requester: document.getElementById("requester"),
  requesterPhone: document.getElementById("requesterPhone"),
  requesterPosition: document.getElementById("requesterPosition"),
  owner: document.getElementById("owner"),
  status: document.getElementById("status"),
  priority: document.getElementById("priority"),
  requestDate: document.getElementById("requestDate"),
  commitmentDate: document.getElementById("commitmentDate"),
  clientRequest: document.getElementById("clientRequest"),
  currentProcess: document.getElementById("currentProcess"),
  observations: document.getElementById("observations"),
};

const cooperativeFields = {
  id: document.getElementById("cooperativeId"),
  name: document.getElementById("cooperativeName"),
};

const contactFields = {
  id: document.getElementById("contactId"),
  name: document.getElementById("contactName"),
  phone: document.getElementById("contactPhone"),
  position: document.getElementById("contactPosition"),
};

const processFields = {
  id: document.getElementById("processCaseId"),
  process: document.getElementById("processUpdate"),
  observations: document.getElementById("processObservations"),
};

const taskFields = {
  id: document.getElementById("taskId"),
  title: document.getElementById("taskTitle"),
  owner: document.getElementById("taskOwner"),
  progress: document.getElementById("taskProgress"),
  details: document.getElementById("taskDetails"),
};

document.addEventListener("DOMContentLoaded", init);

window.ARISSTO_APP = {
  clearModals() {
    closeCaseModal(); closeTaskModal(); closeDetailModal(); closeProcessModal();
  },
  receive(data) {
    state.cases = structuredClone(data.cases || []);
    state.tasks = structuredClone(data.tasks || []);
    state.cooperatives = structuredClone(data.cooperatives || []);
    if (!state.cooperatives.some(item => item.id === state.selectedCooperativeId)) {
      state.selectedCooperativeId = state.cooperatives[0]?.id || "";
    }
    render();
  },
  clear() {
    closeCaseModal(); closeTaskModal(); closeDetailModal(); closeProcessModal();
    elements.caseForm.reset(); elements.taskForm.reset(); elements.processForm.reset();
    elements.detailContent.replaceChildren();
    resetCooperativeForm(); resetContactForm();
    state.filters = { search: "", status: "active", priority: "" };
    state.dashboardMonth = "";
    state.cooperativeSearch = "";
    elements.cooperativeSearch.value = "";
    elements.searchInput.value = "";
    elements.statusFilter.value = "active";
    elements.priorityFilter.value = "";
    elements.dashboardMonthFilter.value = "";
    this.receive({});
    activateTab("dashboardSection");
  },
  editing() {
    return Boolean(document.querySelector('.modal-backdrop[aria-hidden="false"]')) ||
      Boolean(document.activeElement?.closest('#cooperativeForm, #contactForm, #userForm'));
  },
  legacy() {
    const read = (key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const rows = JSON.parse(raw);
      if (!Array.isArray(rows)) throw new Error("El respaldo local no tiene el formato esperado. Se conservo sin modificar.");
      return rows;
    };
    return { cases: read(STORAGE_KEY).map(normalizeCaseRecord), tasks: read(TASKS_KEY).map(normalizeTaskRecord),
      cooperatives: read(COOPERATIVES_KEY).map(normalizeCooperativeRecord) };
  },
};

function init() {
  const local = location.protocol === "file:";
  state.cases = local ? loadCases() : [];
  state.tasks = local ? loadTasks() : [];
  state.cooperatives = local ? loadCooperatives() : [];
  state.selectedCooperativeId = state.cooperatives[0]?.id || "";
  syncThemeToggle();
  renderMonthFilterOptions();
  bindEvents();
  render();
  if (local) {
    document.getElementById("accessScreen").hidden = true;
    document.getElementById("appShell").hidden = false;
    document.getElementById("syncStatus").textContent = "Guardado en este navegador. La sincronizacion requiere ingresar al sitio web.";
  } else if (window.ARISSTO_CLOUD) {
    window.ARISSTO_CLOUD.start();
  } else {
    document.getElementById("accessMessage").textContent = "No se pudo cargar el acceso. Recargue la pagina o contacte al administrador.";
  }
}

function bindEvents() {
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tabTarget));
  });

  elements.openCreateCase.addEventListener("click", openCreateModal);
  elements.openCreateCaseSecondary.addEventListener("click", openCreateModal);
  elements.openCreateTask.addEventListener("click", openCreateTaskModal);
  elements.openCreateTaskSecondary.addEventListener("click", openCreateTaskModal);
  elements.openCreateTaskTertiary.addEventListener("click", openCreateTaskModal);
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.caseForm.addEventListener("submit", handleCaseSubmit);
  elements.processForm.addEventListener("submit", handleProcessSubmit);
  elements.taskForm.addEventListener("submit", handleTaskSubmit);
  elements.cooperativeForm.addEventListener("submit", handleCooperativeSubmit);
  elements.contactForm.addEventListener("submit", handleContactSubmit);
  elements.cancelCooperativeEdit.addEventListener("click", resetCooperativeForm);
  elements.cancelContactEdit.addEventListener("click", resetContactForm);

  elements.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    renderCasesTable();
  });
  elements.statusFilter.addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    renderCasesTable();
  });
  elements.priorityFilter.addEventListener("change", (event) => {
    state.filters.priority = event.target.value;
    renderCasesTable();
  });
  elements.dashboardMonthFilter.addEventListener("change", (event) => {
    state.dashboardMonth = event.target.value;
    renderGraphicDashboard();
  });
  elements.cooperativeSearch.addEventListener("input", (event) => {
    state.cooperativeSearch = event.target.value.trim().toLowerCase();
    renderCooperatives();
  });
  elements.cooperativeList.addEventListener("click", handleCooperativeListAction);
  elements.contactsTableBody.addEventListener("click", handleContactTableAction);

  formFields.cooperative.addEventListener("input", () => {
    renderRequesterOptions();
    clearRequesterAutofill(false);
  });
  formFields.cooperative.addEventListener("change", () => {
    renderRequesterOptions();
    autofillRequesterFromSelection();
  });
  formFields.requester.addEventListener("input", autofillRequesterFromSelection);
  formFields.requester.addEventListener("change", autofillRequesterFromSelection);

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeCaseModal);
  });
  document.querySelectorAll("[data-close-detail]").forEach((button) => {
    button.addEventListener("click", closeDetailModal);
  });
  document.querySelectorAll("[data-close-process]").forEach((button) => {
    button.addEventListener("click", closeProcessModal);
  });
  document.querySelectorAll("[data-close-task]").forEach((button) => {
    button.addEventListener("click", closeTaskModal);
  });

  elements.caseModal.addEventListener("click", closeWhenBackdrop);
  elements.detailModal.addEventListener("click", closeWhenBackdrop);
  elements.processModal.addEventListener("click", closeWhenBackdrop);
  elements.taskModal.addEventListener("click", closeWhenBackdrop);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCaseModal();
      closeDetailModal();
      closeProcessModal();
      closeTaskModal();
    }
  });

  elements.casesTableBody.addEventListener("click", handleTableAction);
  elements.tasksTableBody.addEventListener("click", handleTaskTableAction);
  elements.exportCasesTasks.addEventListener("click", exportCasesAndTasks);
  elements.importCasesTasks.addEventListener("click", importCasesAndTasks);
}

function activateTab(tabId) {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === tabId);
  });
  elements.tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";

  if (nextTheme === "dark") {
    document.documentElement.dataset.theme = "dark";
    localStorage.setItem(THEME_KEY, "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem(THEME_KEY, "light");
  }

  syncThemeToggle();
  renderGraphicDashboard();
}

function syncThemeToggle() {
  const isDark = document.documentElement.dataset.theme === "dark";
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  elements.themeToggleText.textContent = isDark ? "Modo claro" : "Modo oscuro";
}

function loadCases() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const seededCases = DEFAULT_CASES.map(normalizeCaseRecord);
    if (seededCases.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seededCases));
    }
    return seededCases;
  }

  try {
    const parsed = JSON.parse(saved);
    const normalized = Array.isArray(parsed) ? parsed.map(normalizeCaseRecord) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    return [];
  }
}

async function saveCases() {
  if (location.protocol !== "file:") return window.ARISSTO_CLOUD.commit(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cases));
  return true;
}

function loadTasks() {
  const saved = localStorage.getItem(TASKS_KEY);
  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved);
    const normalized = Array.isArray(parsed) ? parsed.map(normalizeTaskRecord) : [];
    localStorage.setItem(TASKS_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    return [];
  }
}

async function saveTasks() {
  if (location.protocol !== "file:") return window.ARISSTO_CLOUD.commit(state);
  localStorage.setItem(TASKS_KEY, JSON.stringify(state.tasks));
  return true;
}

async function saveCasesAndTasks() {
  if (location.protocol !== "file:") return window.ARISSTO_CLOUD.commit(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cases));
  localStorage.setItem(TASKS_KEY, JSON.stringify(state.tasks));
  return true;
}

function normalizeCaseRecord(supportCase) {
  const now = new Date().toISOString();
  const status = ["Abierto", "En proceso", "En espera", "Finalizado"].includes(supportCase.status)
    ? supportCase.status
    : "Abierto";
  const priority = ["Baja", "Media", "Alta"].includes(supportCase.priority)
    ? supportCase.priority
    : "Media";

  return {
    id: String(supportCase.id || createId()).trim(),
    ownerId: supportCase.ownerId || "",
    _version: supportCase._version || "",
    title: cleanText(supportCase.title || supportCase.caseName || supportCase.case || supportCase.name),
    cooperative: cleanText(supportCase.cooperative),
    requester: cleanText(supportCase.requester),
    requesterPhone: cleanText(supportCase.requesterPhone || supportCase.phone || supportCase.telephone),
    requesterPosition: cleanText(supportCase.requesterPosition || supportCase.position),
    owner: cleanText(supportCase.owner || supportCase.manager || supportCase.encargado),
    status,
    priority,
    requestDate: normalizeDateValue(supportCase.requestDate || supportCase.fechaSolicitud),
    commitmentDate: normalizeDateValue(supportCase.commitmentDate || supportCase.dueDate || supportCase.fechaCompromiso),
    clientRequest: cleanText(supportCase.clientRequest || supportCase.request),
    currentProcess: cleanText(supportCase.currentProcess || supportCase.process),
    observations: cleanText(supportCase.observations),
    createdAt: cleanText(supportCase.createdAt) || now,
    updatedAt: cleanText(supportCase.updatedAt) || cleanText(supportCase.createdAt) || now,
  };
}

function normalizeTaskRecord(task) {
  const now = new Date().toISOString();
  return {
    id: String(task.id || createId()).trim(),
    ownerId: task.ownerId || "",
    _version: task._version || "",
    title: cleanText(task.title || task.task || task.name),
    owner: cleanText(task.owner || task.encargado),
    progress: cleanText(task.progress || task.done || task.hecho),
    details: cleanText(task.details || task.detalles),
    createdAt: cleanText(task.createdAt) || now,
    updatedAt: cleanText(task.updatedAt) || cleanText(task.createdAt) || now,
  };
}

function loadCooperatives() {
  const saved = localStorage.getItem(COOPERATIVES_KEY);
  const savedVersion = localStorage.getItem(COOPERATIVES_VERSION_KEY);
  let cooperatives = [];

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      cooperatives = Array.isArray(parsed) ? parsed.map(normalizeCooperativeRecord) : [];
    } catch (error) {
      cooperatives = [];
    }
  }

  if (savedVersion !== COOPERATIVES_VERSION) {
    DEFAULT_COOPERATIVES.forEach((name) => {
      if (!cooperatives.some((cooperative) => sameText(cooperative.name, name))) {
        cooperatives.push(createCooperative(name));
      }
    });
    mergeDefaultContacts(cooperatives);
    localStorage.setItem(COOPERATIVES_VERSION_KEY, COOPERATIVES_VERSION);
  }

  cooperatives = sortCooperatives(cooperatives);
  localStorage.setItem(COOPERATIVES_KEY, JSON.stringify(cooperatives));
  return cooperatives;
}

async function saveCooperatives() {
  if (location.protocol !== "file:") return window.ARISSTO_CLOUD.commit(state);
  state.cooperatives = sortCooperatives(state.cooperatives);
  localStorage.setItem(COOPERATIVES_KEY, JSON.stringify(state.cooperatives));
  return true;
}

function normalizeCooperativeRecord(cooperative) {
  return {
    id: cooperative.id || createId(),
    name: String(cooperative.name || "").trim(),
    contacts: Array.isArray(cooperative.contacts) ? cooperative.contacts.map(normalizeContactRecord) : [],
  };
}

function normalizeContactRecord(contact) {
  return {
    id: contact.id || createId(),
    name: String(contact.name || "").trim(),
    phone: String(contact.phone || "").trim(),
    position: String(contact.position || "").trim(),
  };
}

function createCooperative(name) {
  return {
    id: createId(),
    name,
    contacts: [],
  };
}

function mergeDefaultContacts(cooperatives) {
  cooperatives.forEach((cooperative) => {
    const defaultContacts = DEFAULT_CONTACTS_BY_COOPERATIVE[cooperative.name] || [];
    defaultContacts.forEach((defaultContact) => {
      const exists = cooperative.contacts.some((contact) => contact.phone === defaultContact.phone);
      if (!exists) {
        cooperative.contacts.push({
          id: createId(),
          ...defaultContact,
        });
      }
    });
    cooperative.contacts = sortContacts(cooperative.contacts);
  });
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


function exportCasesAndTasks() {
  clearMigrationMessage();
  const payload = {
    app: "ARISSTO Control de Soporte",
    version: 1,
    exportedAt: new Date().toISOString(),
    cases: state.cases.map(stripRuntimeFields),
    tasks: state.tasks.map(stripRuntimeFields),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `arissto-casos-tareas-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showMigrationStatus(`Archivo generado con ${payload.cases.length} casos y ${payload.tasks.length} tareas.`);
}

async function importCasesAndTasks() {
  clearMigrationMessage();
  const file = elements.importFile.files?.[0];
  if (!file) {
    showMigrationError("Seleccione un archivo JSON para importar.");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (error) {
    showMigrationError("El archivo no es un JSON valido.");
    return;
  }

  const importedCases = Array.isArray(parsed?.cases) ? parsed.cases.map(normalizeImportedCase) : [];
  const importedTasks = Array.isArray(parsed?.tasks) ? parsed.tasks.map(normalizeImportedTask) : [];
  if (!importedCases.length && !importedTasks.length) {
    showMigrationError("El archivo no contiene casos ni tareas para importar.");
    return;
  }

  const replace = elements.importMode.value === "replace";
  const action = replace ? "reemplazar los casos y tareas actuales" : "combinar los datos del archivo con los actuales";
  if (!confirm(`Se importaran ${importedCases.length} casos y ${importedTasks.length} tareas. Desea ${action}?`)) return;

  const nextCases = replace ? importedCases.map(withFreshId) : mergeImportedRows(state.cases, importedCases);
  const nextTasks = replace ? importedTasks.map(withFreshId) : mergeImportedRows(state.tasks, importedTasks);
  const previousCases = state.cases;
  const previousTasks = state.tasks;
  state.cases = nextCases;
  state.tasks = nextTasks;

  if (!await saveCasesAndTasks()) {
    state.cases = previousCases;
    state.tasks = previousTasks;
    showMigrationError("No se pudo importar. Revise la conexion e intente nuevamente.");
    return;
  }

  elements.importFile.value = "";
  render();
  showMigrationStatus(`Importacion completada. Casos: ${state.cases.length}. Tareas: ${state.tasks.length}.`);
  activateTab("migrationSection");
}

function normalizeImportedCase(row) {
  const normalized = normalizeCaseRecord(row || {});
  delete normalized._version;
  normalized.ownerId = "";
  return normalized;
}

function normalizeImportedTask(row) {
  const normalized = normalizeTaskRecord(row || {});
  delete normalized._version;
  normalized.ownerId = "";
  return normalized;
}

function mergeImportedRows(currentRows, importedRows) {
  const existingIds = new Set(currentRows.map(row => row.id));
  const existingKeys = new Set(currentRows.map(row => migrationRowKey(row)));
  const merged = [...currentRows];
  for (const row of importedRows) {
    const key = migrationRowKey(row);
    if (existingIds.has(row.id) || existingKeys.has(key)) continue;
    merged.push(row);
    existingIds.add(row.id);
    existingKeys.add(key);
  }
  return merged;
}

function migrationRowKey(row) {
  return [row.title, row.owner, row.createdAt || row.requestDate || ""].map(value => String(value || "").trim().toLowerCase()).join("|");
}

function withFreshId(row) {
  return { ...row, id: createId(), _version: "", ownerId: "" };
}

function stripRuntimeFields(row) {
  const clean = { ...row };
  delete clean._version;
  return clean;
}

function clearMigrationMessage() {
  elements.migrationAlert.textContent = "";
  elements.migrationAlert.classList.remove("visible");
  elements.migrationStatus.textContent = "";
}

function showMigrationError(text) {
  elements.migrationAlert.textContent = text;
  elements.migrationAlert.classList.add("visible");
  elements.migrationStatus.textContent = "";
}

function showMigrationStatus(text) {
  elements.migrationStatus.textContent = text;
}
function render() {
  renderDashboard();
  try {
    renderGraphicDashboard();
  } catch (error) {
    console.error("No se pudo actualizar el dashboard grafico.", error);
  }
  renderCasesTable();
  renderTasksTable();
  renderCooperatives();
  renderSelectedCooperative();
  renderDatalists();
}

function renderDashboard() {
  elements.countOpen.textContent = countByStatus("Abierto");
  elements.countInProgress.textContent = countByStatus("En proceso");
  elements.countWaiting.textContent = countByStatus("En espera");
  elements.countFinished.textContent = countByStatus("Finalizado");
  elements.countOverdue.textContent = state.cases.filter(isOverdue).length;
}

function countByStatus(status, sourceCases = state.cases) {
  return sourceCases.filter((supportCase) => supportCase.status === status).length;
}

function renderGraphicDashboard() {
  const dashboardCases = getDashboardCases();
  const hasCases = dashboardCases.length > 0;
  destroyCharts();

  if (elements.dashboardUpdatedAt) {
    elements.dashboardUpdatedAt.textContent = hasCases ? formatDateTime(new Date().toISOString()) : "Sin datos";
  }

  if (elements.chartEmptyState) {
    elements.chartEmptyState.textContent = "No hay datos suficientes para generar gráficos.";
    elements.chartEmptyState.classList.toggle("visible", !hasCases);
  }

  if (elements.graphicDashboardContent) {
    elements.graphicDashboardContent.classList.toggle("hidden", !hasCases);
  }

  if (!hasCases) {
    return;
  }

  const dueSummary = getDueSummary(dashboardCases);
  const overdue = dueSummary.overdue;
  const activeCases = dashboardCases.filter((supportCase) => supportCase.status !== "Finalizado").length;
  const highPriority = countByPriority("Alta", dashboardCases);
  const finished = countByStatus("Finalizado", dashboardCases);
  const totalCases = dashboardCases.length;
  const statusCounts = [
    { label: "Abierto", value: countByStatus("Abierto", dashboardCases) },
    { label: "En proceso", value: countByStatus("En proceso", dashboardCases) },
    { label: "En espera", value: countByStatus("En espera", dashboardCases) },
    { label: "Finalizado", value: finished },
  ];
  const priorityCounts = [
    { label: "Baja", value: countByPriority("Baja", dashboardCases) },
    { label: "Media", value: countByPriority("Media", dashboardCases) },
    { label: "Alta", value: highPriority },
  ];
  const ownerCounts = getCasesByOwner(dashboardCases);
  const requestDateCounts = getCasesByRequestDate(dashboardCases);

  elements.visualActiveCases.textContent = activeCases;
  elements.visualHighPriorityCases.textContent = highPriority;
  elements.visualOverdueCases.textContent = overdue;
  elements.visualFinishedCases.textContent = finished;
  elements.visualTotalCases.textContent = totalCases;
  elements.statusChartTotal.textContent = totalCases;
  elements.priorityChartTotal.textContent = totalCases;
  elements.ownerChartTotal.textContent = totalCases;
  elements.requestDateChartTotal.textContent = totalCases;
  elements.dueOverdueCount.textContent = dueSummary.overdue;
  elements.dueTodayCount.textContent = dueSummary.today;
  elements.dueSoonCount.textContent = dueSummary.soon;
  renderRecentCases(dashboardCases);

  if (!window.Chart) {
    elements.chartEmptyState.textContent = "No se pudo cargar Chart.js. Revise la conexión e intente actualizar.";
    elements.chartEmptyState.classList.add("visible");
    return;
  }

  renderStatusChart(statusCounts);
  renderPriorityChart(priorityCounts);
  renderOwnerChart(ownerCounts);
  renderRequestDateChart(requestDateCounts);
}

function countByPriority(priority, sourceCases = state.cases) {
  return sourceCases.filter((supportCase) => supportCase.priority === priority).length;
}

function destroyCharts() {
  Object.values(chartInstances).forEach((chart) => chart.destroy());
  Object.keys(chartInstances).forEach((key) => {
    delete chartInstances[key];
  });
}

function renderStatusChart(rows) {
  createChart("status", elements.statusChart, {
    type: "doughnut",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          data: rows.map((row) => row.value),
          backgroundColor: ["#1d5d9f", "#f97316", "#f5b91b", "#18a058"],
          borderColor: getCardBackground(),
          borderWidth: 3,
        },
      ],
    },
    options: getBaseChartOptions({
      cutout: "62%",
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: getChartTextColor(),
            boxWidth: 12,
            padding: 14,
          },
        },
      },
    }),
  });
}

function renderPriorityChart(rows) {
  createChart("priority", elements.priorityChart, {
    type: "bar",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: "Casos",
          data: rows.map((row) => row.value),
          backgroundColor: ["#18a058", "#f5b91b", "#ef4444"],
          borderRadius: 8,
          maxBarThickness: 58,
        },
      ],
    },
    options: getBaseChartOptions({
      scales: getCartesianScales(),
    }),
  });
}

function renderOwnerChart(rows) {
  createChart("owner", elements.ownerChart, {
    type: "bar",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: "Casos",
          data: rows.map((row) => row.value),
          backgroundColor: "#2563eb",
          borderRadius: 8,
          maxBarThickness: 28,
        },
      ],
    },
    options: getBaseChartOptions({
      indexAxis: "y",
      scales: getCartesianScales(),
    }),
  });
}

function renderRequestDateChart(rows) {
  createChart("requestDate", elements.requestDateChart, {
    type: "line",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: "Casos",
          data: rows.map((row) => row.value),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.14)",
          pointBackgroundColor: "#2563eb",
          pointRadius: 4,
          pointHoverRadius: 5,
          borderWidth: 3,
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: getBaseChartOptions({
      scales: getCartesianScales(),
    }),
  });
}

function createChart(key, canvas, config) {
  if (!canvas || !window.Chart) {
    return;
  }

  chartInstances[key] = new Chart(canvas, config);
}

function getBaseChartOptions(extraOptions = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "#162033",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        displayColors: false,
      },
      ...(extraOptions.plugins || {}),
    },
    ...extraOptions,
  };
}

function getCartesianScales() {
  const textColor = getChartTextColor();
  const gridColor = getChartGridColor();

  return {
    x: {
      beginAtZero: true,
      ticks: {
        color: textColor,
        precision: 0,
      },
      grid: {
        color: gridColor,
      },
    },
    y: {
      beginAtZero: true,
      ticks: {
        color: textColor,
        precision: 0,
      },
      grid: {
        color: gridColor,
      },
    },
  };
}

function getCasesByOwner(sourceCases = state.cases) {
  const grouped = new Map();
  sourceCases.forEach((supportCase) => {
    const owner = supportCase.owner || "Sin encargado";
    grouped.set(owner, (grouped.get(owner) || 0) + 1);
  });

  return Array.from(grouped, ([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "es"))
    .slice(0, 8);
}

function getCasesByRequestDate(sourceCases = state.cases) {
  const grouped = new Map();
  sourceCases.forEach((supportCase) => {
    const label = supportCase.requestDate ? formatDate(supportCase.requestDate) : "Sin fecha";
    grouped.set(label, (grouped.get(label) || 0) + 1);
  });

  return Array.from(grouped, ([label, value]) => ({ label, value })).sort((left, right) => {
    const leftDate = toSortableDate(left.label);
    const rightDate = toSortableDate(right.label);
    if (leftDate && rightDate) {
      return leftDate.localeCompare(rightDate);
    }
    if (leftDate) {
      return -1;
    }
    if (rightDate) {
      return 1;
    }
    return left.label.localeCompare(right.label, "es");
  });
}

function getDueSummary(sourceCases = state.cases) {
  const today = getTodayString();
  const nextWeek = addDaysString(7);

  return sourceCases.reduce(
    (summary, supportCase) => {
      if (supportCase.status === "Finalizado" || !supportCase.commitmentDate) {
        return summary;
      }

      if (supportCase.commitmentDate < today) {
        summary.overdue += 1;
      } else if (supportCase.commitmentDate === today) {
        summary.today += 1;
      } else if (supportCase.commitmentDate <= nextWeek) {
        summary.soon += 1;
      }

      return summary;
    },
    { overdue: 0, today: 0, soon: 0 }
  );
}

function renderRecentCases(sourceCases = state.cases) {
  if (!elements.recentCasesList) {
    return;
  }

  const recentCases = [...sourceCases]
    .sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt))
    .slice(0, 4);

  elements.recentCasesList.innerHTML = recentCases
    .map(
      (supportCase) => `
        <li>
          <div>
            <strong>${escapeHtml(supportCase.title || "Sin nombre")}</strong>
            <span>${escapeHtml(supportCase.cooperative || "Sin cooperativa")}</span>
          </div>
          ${createPriorityBadge(supportCase.priority || "Media")}
        </li>
      `
    )
    .join("");
}

function getDashboardCases() {
  if (!state.dashboardMonth) {
    return state.cases;
  }

  return state.cases.filter((supportCase) => {
    const requestMonth = getMonthKey(supportCase.requestDate);
    return requestMonth === state.dashboardMonth;
  });
}

function renderMonthFilterOptions() {
  const months = getMonthOptions(MONTH_FILTER_START, MONTH_FILTER_END);
  elements.dashboardMonthFilter.innerHTML = [
    '<option value="">Todos los meses</option>',
    ...months.map((month) => `<option value="${month.value}">${month.label}</option>`),
  ].join("");
  elements.dashboardMonthFilter.value = state.dashboardMonth;
}

function getMonthOptions(start, end) {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  const date = new Date(startYear, startMonth - 1, 1);
  const lastDate = new Date(endYear, endMonth - 1, 1);
  const formatter = new Intl.DateTimeFormat("es-SV", { month: "long", year: "numeric" });
  const months = [];

  while (date <= lastDate) {
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const formattedMonth = formatter.format(date);
    const label = formattedMonth.charAt(0).toUpperCase() + formattedMonth.slice(1);
    months.push({ value, label });
    date.setMonth(date.getMonth() + 1);
  }

  return months;
}

function getMonthKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(0, 7) : "";
}

function addDaysString(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toSortableDate(label) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(label);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function getChartTextColor() {
  return getCssVariable("--gray-700") || "#4d5a6c";
}

function getChartGridColor() {
  return getCssVariable("--gray-200") || "#e8edf3";
}

function getCardBackground() {
  return getCssVariable("--white") || "#ffffff";
}

function getCssVariable(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderCasesTable() {
  const filteredCases = getFilteredCases();
  elements.caseTotalLabel.textContent = `${state.cases.length} ${state.cases.length === 1 ? "caso registrado" : "casos registrados"}`;
  elements.casesTableBody.innerHTML = "";

  if (state.cases.length === 0) {
    elements.emptyState.textContent = "No hay casos de soporte registrados. Cree su primer caso.";
    elements.emptyState.classList.add("visible");
    return;
  }

  if (filteredCases.length === 0) {
    elements.emptyState.textContent = "No se encontraron casos con los filtros seleccionados.";
    elements.emptyState.classList.add("visible");
    return;
  }

  elements.emptyState.classList.remove("visible");

  filteredCases.forEach((supportCase) => {
    const row = document.createElement("tr");
    const overdueLabel = isOverdue(supportCase) ? '<span class="overdue-text">Vencido</span>' : "";
    row.innerHTML = `
      <td><span class="case-name">${escapeHtml(supportCase.title)}</span></td>
      <td>${escapeHtml(supportCase.cooperative)}</td>
      <td>${escapeHtml(supportCase.requester || "Sin solicitante")}</td>
      <td>${escapeHtml(supportCase.requesterPhone || "Sin telefono")}</td>
      <td>${escapeHtml(supportCase.owner)}</td>
      <td>${createStatusBadge(supportCase.status)}</td>
      <td>${createPriorityBadge(supportCase.priority)}</td>
      <td>${formatDate(supportCase.requestDate)}</td>
      <td>${formatDate(supportCase.commitmentDate)}${overdueLabel}</td>
      <td>
        <div class="actions">
          <button class="text-button" type="button" data-action="view" data-id="${supportCase.id}">Ver detalle</button>
          <button class="text-button" type="button" data-action="edit" data-id="${supportCase.id}">Editar</button>
          <button class="text-button" type="button" data-action="process" data-id="${supportCase.id}">Actualizar proceso</button>
          <button class="secondary-button" type="button" data-action="finish" data-id="${supportCase.id}" ${supportCase.status === "Finalizado" ? "disabled" : ""}>Finalizar</button>
          <button class="danger-button" type="button" data-action="delete" data-id="${supportCase.id}">Eliminar</button>
        </div>
      </td>
    `;
    elements.casesTableBody.appendChild(row);
  });
}

function getFilteredCases() {
  return state.cases.filter((supportCase) => {
    const requester = supportCase.requester || "";
    const matchesSearch =
      !state.filters.search ||
      supportCase.title.toLowerCase().includes(state.filters.search) ||
      supportCase.cooperative.toLowerCase().includes(state.filters.search) ||
      requester.toLowerCase().includes(state.filters.search);
    const matchesStatus =
      state.filters.status === "active"
        ? supportCase.status !== "Finalizado"
        : !state.filters.status || supportCase.status === state.filters.status;
    const matchesPriority = !state.filters.priority || supportCase.priority === state.filters.priority;
    return matchesSearch && matchesStatus && matchesPriority;
  });
}

function renderTasksTable() {
  elements.taskTotalLabel.textContent = `${state.tasks.length} ${state.tasks.length === 1 ? "tarea registrada" : "tareas registradas"}`;
  elements.tasksTableBody.innerHTML = "";

  if (state.tasks.length === 0) {
    elements.tasksEmptyState.textContent = "No hay tareas registradas. Cree su primera tarea.";
    elements.tasksEmptyState.classList.add("visible");
    return;
  }

  elements.tasksEmptyState.classList.remove("visible");
  state.tasks.forEach((task) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="case-name">${escapeHtml(task.title)}</span></td>
      <td>${escapeHtml(task.owner)}</td>
      <td>${escapeHtml(task.progress || "Sin avance registrado")}</td>
      <td>${escapeHtml(task.details || "Sin detalles")}</td>
      <td>${formatDateTime(task.createdAt)}</td>
      <td>
        <div class="actions compact-actions">
          <button class="text-button" type="button" data-action="edit-task" data-id="${task.id}">Editar</button>
          <button class="danger-button" type="button" data-action="delete-task" data-id="${task.id}">Eliminar</button>
        </div>
      </td>
    `;
    elements.tasksTableBody.appendChild(row);
  });
}

function renderCooperatives() {
  const filtered = getFilteredCooperatives();
  elements.cooperativeTotalLabel.textContent = `${state.cooperatives.length} ${state.cooperatives.length === 1 ? "cooperativa registrada" : "cooperativas registradas"}`;
  elements.cooperativeList.innerHTML = "";

  if (state.cooperatives.length === 0) {
    elements.cooperativesEmptyState.textContent = "No hay cooperativas registradas.";
    elements.cooperativesEmptyState.classList.add("visible");
    return;
  }

  if (filtered.length === 0) {
    elements.cooperativesEmptyState.textContent = "No se encontraron cooperativas con esa busqueda.";
    elements.cooperativesEmptyState.classList.add("visible");
    return;
  }

  elements.cooperativesEmptyState.classList.remove("visible");

  filtered.forEach((cooperative) => {
    const button = document.createElement("button");
    button.className = `cooperative-item ${cooperative.id === state.selectedCooperativeId ? "selected" : ""}`;
    button.type = "button";
    button.dataset.action = "select";
    button.dataset.id = cooperative.id;
    button.innerHTML = `
      <span>
        <strong>${escapeHtml(cooperative.name)}</strong>
        <small>${cooperative.contacts.length} ${cooperative.contacts.length === 1 ? "persona" : "personas"}</small>
      </span>
    `;
    elements.cooperativeList.appendChild(button);
  });
}

function getFilteredCooperatives() {
  if (!state.cooperativeSearch) {
    return state.cooperatives;
  }
  return state.cooperatives.filter((cooperative) =>
    cooperative.name.toLowerCase().includes(state.cooperativeSearch)
  );
}

function renderSelectedCooperative() {
  const cooperative = getSelectedCooperative();
  elements.contactsTableBody.innerHTML = "";

  if (!cooperative) {
    elements.selectedCooperativeTitle.textContent = "Seleccione una cooperativa";
    elements.selectedCooperativeHelp.textContent = "Al seleccionar una cooperativa podra agregar personas, telefono y cargo.";
    elements.contactFieldset.disabled = true;
    elements.contactsEmptyState.textContent = "Seleccione una cooperativa para ver sus personas.";
    elements.contactsEmptyState.classList.add("visible");
    return;
  }

  elements.selectedCooperativeTitle.textContent = cooperative.name;
  elements.selectedCooperativeHelp.textContent = "Agregue personas para usar sus datos al crear casos.";
  elements.contactFieldset.disabled = false;

  if (cooperative.contacts.length === 0) {
    elements.contactsEmptyState.textContent = "Esta cooperativa aun no tiene personas registradas.";
    elements.contactsEmptyState.classList.add("visible");
    return;
  }

  elements.contactsEmptyState.classList.remove("visible");
  cooperative.contacts.forEach((contact) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="case-name">${escapeHtml(contact.name)}</span></td>
      <td>${escapeHtml(contact.position || "Sin cargo")}</td>
      <td>${escapeHtml(contact.phone)}</td>
      <td>
        <div class="actions compact-actions">
          <button class="text-button" type="button" data-action="edit-contact" data-id="${contact.id}">Editar</button>
          <button class="danger-button" type="button" data-action="delete-contact" data-id="${contact.id}">Eliminar</button>
        </div>
      </td>
    `;
    elements.contactsTableBody.appendChild(row);
  });
}

function renderDatalists() {
  elements.cooperativeOptions.innerHTML = state.cooperatives
    .map((cooperative) => `<option value="${escapeHtml(cooperative.name)}"></option>`)
    .join("");
  renderRequesterOptions();
}

function renderRequesterOptions() {
  const cooperative = findCooperativeByName(formFields.cooperative.value);
  const contacts = cooperative ? cooperative.contacts : getAllContacts();
  elements.requesterOptions.innerHTML = contacts
    .map((contact) => `<option value="${escapeHtml(contact.name)}"></option>`)
    .join("");
}

function openCreateModal() {
  elements.caseModalTitle.textContent = "Crear caso";
  elements.caseForm.reset();
  formFields.id.value = "";
  window.ARISSTO_CLOUD?.prepareAssignment("case");
  clearValidation(elements.caseForm, elements.formAlert);
  renderDatalists();
  openModal(elements.caseModal);
  formFields.title.focus();
}

function openCreateTaskModal() {
  elements.taskModalTitle.textContent = "Crear tarea";
  elements.taskForm.reset();
  taskFields.id.value = "";
  window.ARISSTO_CLOUD?.prepareAssignment("task");
  clearValidation(elements.taskForm, elements.taskAlert);
  openModal(elements.taskModal);
  taskFields.title.focus();
}

function openEditTaskModal(id) {
  const task = findTask(id);
  if (!task) {
    return;
  }

  elements.taskModalTitle.textContent = "Editar tarea";
  taskFields.id.value = task.id;
  taskFields.title.value = task.title;
  taskFields.owner.value = task.owner;
  taskFields.progress.value = task.progress || "";
  taskFields.details.value = task.details || "";
  window.ARISSTO_CLOUD?.prepareAssignment("task", task);
  clearValidation(elements.taskForm, elements.taskAlert);
  openModal(elements.taskModal);
  taskFields.title.focus();
}

function openEditModal(id) {
  const supportCase = findCase(id);
  if (!supportCase) {
    return;
  }

  elements.caseModalTitle.textContent = "Editar caso";
  formFields.id.value = supportCase.id;
  formFields.title.value = supportCase.title;
  formFields.cooperative.value = supportCase.cooperative;
  formFields.requester.value = supportCase.requester || "";
  formFields.requesterPhone.value = supportCase.requesterPhone || "";
  formFields.requesterPosition.value = supportCase.requesterPosition || "";
  formFields.owner.value = supportCase.owner;
  formFields.status.value = supportCase.status;
  formFields.priority.value = supportCase.priority;
  formFields.requestDate.value = supportCase.requestDate;
  formFields.commitmentDate.value = supportCase.commitmentDate;
  formFields.clientRequest.value = supportCase.clientRequest;
  formFields.currentProcess.value = supportCase.currentProcess;
  formFields.observations.value = supportCase.observations || "";
  window.ARISSTO_CLOUD?.prepareAssignment("case", supportCase);
  clearValidation(elements.caseForm, elements.formAlert);
  renderDatalists();
  openModal(elements.caseModal);
  formFields.title.focus();
}

function closeCaseModal() {
  closeModal(elements.caseModal);
}

function closeTaskModal() {
  closeModal(elements.taskModal);
}

function openDetailModal(id) {
  const supportCase = findCase(id);
  if (!supportCase) {
    return;
  }

  elements.detailContent.innerHTML = `
    ${createDetailItem("Caso / Pendiente", supportCase.title)}
    ${createDetailItem("Cooperativa", supportCase.cooperative)}
    ${createDetailItem("Persona que solicito soporte", supportCase.requester || "Sin solicitante")}
    ${createDetailItem("Telefono", supportCase.requesterPhone || "Sin telefono")}
    ${createDetailItem("Cargo", supportCase.requesterPosition || "Sin cargo")}
    ${createDetailItem("Encargado", supportCase.owner)}
    ${createDetailItem("Estado", supportCase.status)}
    ${createDetailItem("Prioridad", supportCase.priority)}
    ${createDetailItem("Fecha de solicitud", formatDate(supportCase.requestDate))}
    ${createDetailItem("Fecha de compromiso", formatDate(supportCase.commitmentDate))}
    ${createDetailItem("Que esta solicitando el cliente", supportCase.clientRequest, true)}
    ${createDetailItem("Que se esta haciendo / proceso actual", supportCase.currentProcess, true)}
    ${createDetailItem("Observaciones adicionales", supportCase.observations || "Sin observaciones", true)}
    ${createDetailItem("Fecha de creacion", formatDateTime(supportCase.createdAt))}
    ${createDetailItem("Ultima actualizacion", formatDateTime(supportCase.updatedAt))}
  `;
  openModal(elements.detailModal);
}

function closeDetailModal() {
  closeModal(elements.detailModal);
}

function openProcessModal(id) {
  const supportCase = findCase(id);
  if (!supportCase) {
    return;
  }

  processFields.id.value = supportCase.id;
  processFields.process.value = supportCase.currentProcess;
  processFields.observations.value = supportCase.observations || "";
  clearValidation(elements.processForm, elements.processAlert);
  openModal(elements.processModal);
  processFields.process.focus();
}

function closeProcessModal() {
  closeModal(elements.processModal);
}

function openModal(modal) {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(modal) {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".modal-backdrop.open")) {
    document.body.style.overflow = "";
  }
}

function closeWhenBackdrop(event) {
  if (event.target === event.currentTarget) {
    closeModal(event.currentTarget);
  }
}

async function handleCaseSubmit(event) {
  event.preventDefault();
  clearValidation(elements.caseForm, elements.formAlert);

  const requiredFields = [
    formFields.title,
    formFields.cooperative,
    formFields.requester,
    formFields.requesterPhone,
    formFields.owner,
    formFields.status,
    formFields.priority,
    formFields.requestDate,
    formFields.clientRequest,
    formFields.currentProcess,
  ];

  if (!validateRequiredFields(requiredFields, elements.formAlert)) {
    return;
  }

  const now = new Date().toISOString();
  const id = formFields.id.value;
  const caseData = {
    ownerId: window.ARISSTO_CLOUD?.assignedAccount("case") || "",
    title: formFields.title.value.trim(),
    cooperative: formFields.cooperative.value.trim(),
    requester: formFields.requester.value.trim(),
    requesterPhone: formFields.requesterPhone.value.trim(),
    requesterPosition: formFields.requesterPosition.value.trim(),
    owner: formFields.owner.value.trim(),
    status: formFields.status.value,
    priority: formFields.priority.value,
    requestDate: formFields.requestDate.value,
    commitmentDate: formFields.commitmentDate.value,
    clientRequest: formFields.clientRequest.value.trim(),
    currentProcess: formFields.currentProcess.value.trim(),
    observations: formFields.observations.value.trim(),
  };

  if (id) {
    state.cases = state.cases.map((supportCase) =>
      supportCase.id === id
        ? {
            ...supportCase,
            ...caseData,
            updatedAt: now,
          }
        : supportCase
    );
  } else {
    state.cases.unshift({
      id: createId(),
      ...caseData,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!await saveCases()) return;
  closeCaseModal();
  render();
  activateTab("casesSection");
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  clearValidation(elements.taskForm, elements.taskAlert);

  if (!validateRequiredFields([taskFields.title, taskFields.owner], elements.taskAlert)) {
    return;
  }

  const now = new Date().toISOString();
  const id = taskFields.id.value;
  const taskData = {
    ownerId: window.ARISSTO_CLOUD?.assignedAccount("task") || "",
    title: taskFields.title.value.trim(),
    owner: taskFields.owner.value.trim(),
    progress: taskFields.progress.value.trim(),
    details: taskFields.details.value.trim(),
  };

  if (id) {
    state.tasks = state.tasks.map((task) =>
      task.id === id
        ? {
            ...task,
            ...taskData,
            updatedAt: now,
          }
        : task
    );
  } else {
    state.tasks.unshift({
      id: createId(),
      ...taskData,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!await saveTasks()) return;
  closeTaskModal();
  renderTasksTable();
  activateTab("tasksSection");
}

async function handleProcessSubmit(event) {
  event.preventDefault();
  clearValidation(elements.processForm, elements.processAlert);

  if (!validateRequiredFields([processFields.process], elements.processAlert)) {
    return;
  }

  const id = processFields.id.value;
  const now = new Date().toISOString();
  state.cases = state.cases.map((supportCase) =>
    supportCase.id === id
      ? {
          ...supportCase,
          currentProcess: processFields.process.value.trim(),
          observations: processFields.observations.value.trim(),
          updatedAt: now,
        }
      : supportCase
  );

  if (!await saveCases()) return;
  closeProcessModal();
  render();
}

async function handleCooperativeSubmit(event) {
  event.preventDefault();
  clearValidation(elements.cooperativeForm, elements.cooperativeAlert);

  if (!validateRequiredFields([cooperativeFields.name], elements.cooperativeAlert)) {
    return;
  }

  const name = cooperativeFields.name.value.trim();
  const duplicate = state.cooperatives.find(
    (cooperative) => sameText(cooperative.name, name) && cooperative.id !== cooperativeFields.id.value
  );

  if (duplicate) {
    showAlert(elements.cooperativeAlert, "Ya existe una cooperativa con ese nombre.");
    cooperativeFields.name.focus();
    return;
  }

  if (cooperativeFields.id.value) {
    const oldCooperative = state.cooperatives.find((cooperative) => cooperative.id === cooperativeFields.id.value);
    const oldName = oldCooperative?.name || "";
    state.cooperatives = state.cooperatives.map((cooperative) =>
      cooperative.id === cooperativeFields.id.value ? { ...cooperative, name } : cooperative
    );
    if (oldName && oldName !== name) {
      state.cases = state.cases.map((supportCase) =>
        supportCase.cooperative === oldName ? { ...supportCase, cooperative: name } : supportCase
      );
      if (!await saveCases()) return;
    }
  } else {
    const cooperative = createCooperative(name);
    state.cooperatives.push(cooperative);
    state.selectedCooperativeId = cooperative.id;
  }

  if (!await saveCooperatives()) return;
  resetCooperativeForm();
  render();
}

async function handleContactSubmit(event) {
  event.preventDefault();
  clearValidation(elements.contactForm, elements.contactAlert);

  const cooperative = getSelectedCooperative();
  if (!cooperative) {
    showAlert(elements.contactAlert, "Seleccione una cooperativa antes de guardar personas.");
    return;
  }

  if (!validateRequiredFields([contactFields.name, contactFields.phone], elements.contactAlert)) {
    return;
  }

  const contactData = {
    name: contactFields.name.value.trim(),
    phone: contactFields.phone.value.trim(),
    position: contactFields.position.value.trim(),
  };

  const duplicate = cooperative.contacts.find(
    (contact) => sameText(contact.name, contactData.name) && contact.id !== contactFields.id.value
  );

  if (duplicate) {
    showAlert(elements.contactAlert, "Ya existe una persona con ese nombre en esta cooperativa.");
    contactFields.name.focus();
    return;
  }

  state.cooperatives = state.cooperatives.map((item) => {
    if (item.id !== cooperative.id) {
      return item;
    }

    const contacts = contactFields.id.value
      ? item.contacts.map((contact) =>
          contact.id === contactFields.id.value ? { ...contact, ...contactData } : contact
        )
      : [...item.contacts, { id: createId(), ...contactData }];

    return {
      ...item,
      contacts: sortContacts(contacts),
    };
  });

  if (!await saveCooperatives()) return;
  resetContactForm();
  render();
}

function handleCooperativeListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const cooperative = state.cooperatives.find((item) => item.id === button.dataset.id);
  if (!cooperative) {
    return;
  }

  state.selectedCooperativeId = cooperative.id;
  cooperativeFields.id.value = cooperative.id;
  cooperativeFields.name.value = cooperative.name;
  elements.cancelCooperativeEdit.classList.remove("hidden");
  elements.saveCooperativeButton.textContent = "Actualizar cooperativa";
  clearValidation(elements.cooperativeForm, elements.cooperativeAlert);
  resetContactForm();
  renderCooperatives();
  renderSelectedCooperative();
}

async function handleContactTableAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const cooperative = getSelectedCooperative();
  if (!cooperative) {
    return;
  }

  const contact = cooperative.contacts.find((item) => item.id === button.dataset.id);
  if (!contact) {
    return;
  }

  if (button.dataset.action === "edit-contact") {
    contactFields.id.value = contact.id;
    contactFields.name.value = contact.name;
    contactFields.phone.value = contact.phone;
    contactFields.position.value = contact.position || "";
    elements.cancelContactEdit.classList.remove("hidden");
    elements.saveContactButton.textContent = "Actualizar persona";
    clearValidation(elements.contactForm, elements.contactAlert);
  }

  if (button.dataset.action === "delete-contact") {
    const confirmed = confirm(`Desea eliminar a "${contact.name}" de esta cooperativa?`);
    if (!confirmed) {
      return;
    }
    cooperative.contacts = cooperative.contacts.filter((item) => item.id !== contact.id);
    if (!await saveCooperatives()) return;
    resetContactForm();
    render();
  }
}

function validateRequiredFields(fields, alertElement) {
  const emptyFields = fields.filter((field) => !field.value.trim());

  emptyFields.forEach((field) => {
    const label = field.dataset.label || "Este campo";
    const wrapper = field.closest("label");
    const error = wrapper.querySelector(".field-error");
    wrapper.classList.add("has-error");
    error.textContent = `El campo "${label}" es obligatorio.`;
  });

  if (emptyFields.length > 0) {
    alertElement.textContent = `Revise los campos obligatorios: ${emptyFields
      .map((field) => field.dataset.label)
      .join(", ")}.`;
    alertElement.classList.add("visible");
    emptyFields[0].focus();
    return false;
  }

  return true;
}

function clearValidation(form, alertElement) {
  form.querySelectorAll(".has-error").forEach((field) => field.classList.remove("has-error"));
  form.querySelectorAll(".field-error").forEach((error) => {
    error.textContent = "";
  });
  alertElement.textContent = "";
  alertElement.classList.remove("visible");
}

function showAlert(alertElement, message) {
  alertElement.textContent = message;
  alertElement.classList.add("visible");
}

function resetCooperativeForm() {
  elements.cooperativeForm.reset();
  cooperativeFields.id.value = "";
  elements.cancelCooperativeEdit.classList.add("hidden");
  elements.saveCooperativeButton.textContent = "Guardar cooperativa";
  clearValidation(elements.cooperativeForm, elements.cooperativeAlert);
}

function resetContactForm() {
  elements.contactForm.reset();
  contactFields.id.value = "";
  elements.cancelContactEdit.classList.add("hidden");
  elements.saveContactButton.textContent = "Guardar persona";
  clearValidation(elements.contactForm, elements.contactAlert);
}

function clearRequesterAutofill(clearName) {
  if (clearName) {
    formFields.requester.value = "";
  }
  formFields.requesterPhone.value = "";
  formFields.requesterPosition.value = "";
}

function autofillRequesterFromSelection() {
  const cooperative = findCooperativeByName(formFields.cooperative.value);
  const contact = cooperative?.contacts.find((item) => sameText(item.name, formFields.requester.value));

  if (!contact) {
    formFields.requesterPhone.value = "";
    formFields.requesterPosition.value = "";
    return;
  }

  formFields.requesterPhone.value = contact.phone;
  formFields.requesterPosition.value = contact.position || "";
}

function handleTableAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "view") {
    openDetailModal(id);
  }

  if (action === "edit") {
    openEditModal(id);
  }

  if (action === "process") {
    openProcessModal(id);
  }

  if (action === "finish") {
    finishCase(id);
  }

  if (action === "delete") {
    deleteCase(id);
  }
}

function handleTaskTableAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "edit-task") {
    openEditTaskModal(id);
  }

  if (action === "delete-task") {
    deleteTask(id);
  }
}

async function finishCase(id) {
  const supportCase = findCase(id);
  if (!supportCase || supportCase.status === "Finalizado") {
    return;
  }

  const now = new Date().toISOString();
  state.cases = state.cases.map((item) =>
    item.id === id
      ? {
          ...item,
          status: "Finalizado",
          updatedAt: now,
        }
      : item
  );
  if (!await saveCases()) return;
  render();
}

async function deleteCase(id) {
  const supportCase = findCase(id);
  if (!supportCase) {
    return;
  }

  const confirmed = confirm(`Desea eliminar el caso "${supportCase.title}"? Esta accion no se puede deshacer.`);
  if (!confirmed) {
    return;
  }

  state.cases = state.cases.filter((item) => item.id !== id);
  if (!await saveCases()) return;
  render();
}

async function deleteTask(id) {
  const task = findTask(id);
  if (!task) {
    return;
  }

  const confirmed = confirm(`Desea eliminar la tarea "${task.title}"? Esta accion no se puede deshacer.`);
  if (!confirmed) {
    return;
  }

  state.tasks = state.tasks.filter((item) => item.id !== id);
  if (!await saveTasks()) return;
  renderTasksTable();
}

function findCase(id) {
  return state.cases.find((supportCase) => supportCase.id === id);
}

function findTask(id) {
  return state.tasks.find((task) => task.id === id);
}

function getSelectedCooperative() {
  return state.cooperatives.find((cooperative) => cooperative.id === state.selectedCooperativeId);
}

function findCooperativeByName(name) {
  return state.cooperatives.find((cooperative) => sameText(cooperative.name, name));
}

function getAllContacts() {
  return state.cooperatives.flatMap((cooperative) => cooperative.contacts);
}

function isOverdue(supportCase) {
  return (
    supportCase.status !== "Finalizado" &&
    Boolean(supportCase.commitmentDate) &&
    supportCase.commitmentDate < getTodayString()
  );
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createStatusBadge(status) {
  return `<span class="badge ${getStatusClass(status)}">${escapeHtml(status)}</span>`;
}

function createPriorityBadge(priority) {
  return `<span class="badge ${getPriorityClass(priority)}">${escapeHtml(priority)}</span>`;
}

function getStatusClass(status) {
  return `status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

function getPriorityClass(priority) {
  return `priority-${priority.toLowerCase()}`;
}

function createDetailItem(label, value, isFull = false) {
  return `
    <article class="detail-item ${isFull ? "full" : ""}">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(value)}</p>
    </article>
  `;
}

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("es-SV", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sortCooperatives(cooperatives) {
  return [...cooperatives].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function sortContacts(contacts) {
  return [...contacts].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function sameText(left, right) {
  return normalizeText(left) === normalizeText(right);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value) {
  return String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim();
}

function normalizeDateValue(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

