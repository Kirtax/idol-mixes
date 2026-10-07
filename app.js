(() => {
  const STORAGE_KEY = "idol-mixes.collection.v1";
  const MIGRATION_KEY = "idol-mixes.json-migrated";
  const THEME_KEY = "idol-mixes.theme";
  const NAME_MODE_KEY = "idol-mixes.name-mode";
  const MIX_TAGS = [
    { id: "kahen-sanren", romaji: "Kahen Sanren", kana: "可変三連" },
    { id: "konton", romaji: "Konton", kana: "混沌" },
    { id: "koujou", romaji: "Koujou", kana: "口上" },
    { id: "gengo", romaji: "Gengo", kana: "言語" },
  ];
  const VALID_TAG_IDS = new Set(MIX_TAGS.map((tag) => tag.id));
  const $ = (selector) => document.querySelector(selector);

  const elements = {
    appShell: $(".app-shell"), storageLabel: $("#storageLabel"),
    list: $("#mixList"), count: $("#mixCount"), tabCount: $("#tabMixCount"), results: $("#resultsLabel"), empty: $("#emptyState"),
    emptyTitle: $("#emptyTitle"), emptyCopy: $("#emptyCopy"), search: $("#searchInput"),
    barFilters: $("#barFilters"), tagFilters: $("#tagFilters"), clearFilters: $("#clearFilters"),
    modeButton: $("#nameMode"), modeLabel: $("#nameModeLabel"), themeButton: $("#themeToggle"),
    workspace: $("#libraryView"), libraryTab: $("#libraryTab"), addTab: $("#addTabButton"),
    panel: $("#addPanel"), form: $("#mixForm"), formTitle: $("#formTitle"), editId: $("#editId"),
    nameRomaji: $("#nameRomaji"), nameKana: $("#nameKana"), readingRomaji: $("#readingRomaji"), readingKana: $("#readingKana"),
    startRomaji: $("#startRomaji"), startKana: $("#startKana"),
    barCountInput: $("#barCountInput"), addBarCount: $("#addBarCount"), durationChips: $("#durationChips"),
    tagInputs: [...document.querySelectorAll('input[name="mixTag"]')],
    saveButton: $("#saveMixButton"), toast: $("#toast"), importFile: $("#importFile"),
  };

  let mixes = loadMixes();
  let nameMode = readPreference(NAME_MODE_KEY) === "kana" ? "kana" : "romaji";
  let toastTimer;
  let formDraftActive = false;
  let formBarCounts = [];
  const selectedBars = new Set();
  const selectedTags = new Set();

  function readPreference(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function writePreference(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Preferences are optional. */ }
  }

  function makeId() {
    return globalThis.crypto?.randomUUID?.() ?? `mix-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadMixes() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const value = JSON.parse(saved);
      if (!Array.isArray(value)) return [];
      return value.map((mix) => normalizeMix(mix)).filter(Boolean);
    } catch {
      return [];
    }
  }

  function normalizeMix(value) {
    if (!value || typeof value !== "object") return null;
    const fields = ["nameRomaji", "nameKana", "readingRomaji", "readingKana"];
    if (!fields.every((field) => typeof value[field] === "string" && value[field].trim())
      || value.nameRomaji.length > 120 || value.nameKana.length > 120
      || value.readingRomaji.length > 3000 || value.readingKana.length > 3000) return null;
    const startRomaji = value.startRomaji ?? "";
    const startKana = value.startKana ?? "";
    if (typeof startRomaji !== "string" || typeof startKana !== "string"
      || startRomaji.length > 3000 || startKana.length > 3000) return null;
    return {
      id: typeof value.id === "string" && value.id ? value.id : makeId(),
      nameRomaji: value.nameRomaji.trim(),
      nameKana: value.nameKana.trim(),
      readingRomaji: value.readingRomaji.trim(),
      readingKana: value.readingKana.trim(),
      startRomaji: startRomaji.trim(),
      startKana: startKana.trim(),
      barCounts: Array.isArray(value.barCounts)
        ? [...new Set(value.barCounts.map(Number).filter((count) => Number.isInteger(count) && count >= 1 && count <= 999))].sort((a, b) => a - b)
        : [],
      tags: Array.isArray(value.tags) ? [...new Set(value.tags.filter((tag) => VALID_TAG_IDS.has(tag)))] : [],
      createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    };
  }

  async function persist() {
    let browserSaved = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mixes));
      browserSaved = true;
    } catch {
      // The JSON file remains the primary store when the local browser cache is unavailable.
    }
    try {
      const response = await fetch("/api/mixes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mixes),
      });
      if (!response.ok) throw new Error("No se pudo escribir el archivo JSON.");
      elements.storageLabel.textContent = "Guardado en data/mixes.json";
      return "file";
    } catch {
      elements.storageLabel.textContent = browserSaved
        ? "Guardado en este navegador · inicia node server.js para usar JSON"
        : "No se pudo guardar; inicia node server.js para habilitar el archivo JSON";
      return browserSaved ? "browser" : "failed";
    }
  }

  function showSaveResult(result, successMessage) {
    if (result === "file") showToast(successMessage);
    else if (result === "browser") showToast(`${successMessage} Solo quedó guardado en este navegador.`);
    else showToast("No se pudo guardar el cambio.");
  }

  async function connectToJsonFile() {
    elements.appShell.inert = true;
    elements.appShell.setAttribute("aria-busy", "true");
    elements.storageLabel.textContent = "Conectando con data/mixes.json…";
    try {
      const response = await fetch("/api/mixes", { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("No hay un servidor JSON activo.");
      const payload = await response.json();
      const fileValues = Array.isArray(payload) ? payload : payload?.mixes;
      if (!Array.isArray(fileValues)) throw new Error("El archivo JSON no contiene una lista de mixes.");

      const savedInBrowser = loadMixes();
      let fileMixes = fileValues.map(normalizeMix).filter(Boolean);
      const alreadyMigrated = readPreference(MIGRATION_KEY) === "true";
      if (fileMixes.length === 0 && savedInBrowser.length > 0 && !alreadyMigrated) {
        const migrationResponse = await fetch("/api/mixes", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(savedInBrowser),
        });
        if (!migrationResponse.ok) throw new Error("No se pudieron migrar los mixes del navegador.");
        fileMixes = savedInBrowser;
      }

      mixes = fileMixes;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mixes));
        localStorage.setItem(MIGRATION_KEY, "true");
      } catch { /* The JSON file works without a local browser mirror. */ }
      elements.storageLabel.textContent = "Guardado en data/mixes.json";
    } catch {
      mixes = loadMixes();
      elements.storageLabel.textContent = "Guardado en este navegador · inicia node server.js para usar JSON";
    } finally {
      elements.appShell.inert = false;
      elements.appShell.removeAttribute("aria-busy");
      render();
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function normalizeText(value) {
    return value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  function matchingMixes() {
    const terms = normalizeText(elements.search.value).split(/\s+/).filter(Boolean);
    const searchable = mixes.filter((mix) => {
      const tagText = mix.tags.flatMap((id) => MIX_TAGS.find((tag) => tag.id === id) ?? []);
      const content = normalizeText([
        mix.nameRomaji, mix.nameKana, mix.startRomaji, mix.startKana, mix.readingRomaji, mix.readingKana,
        ...mix.barCounts.flatMap((count) => [String(count), "小節"]),
        ...tagText.flatMap((tag) => [tag.romaji, tag.kana]),
      ].join(" "));
      const matchesSearch = terms.every((term) => content.includes(term));
      const matchesBars = selectedBars.size === 0 || mix.barCounts.some((count) => selectedBars.has(count));
      const matchesTags = selectedTags.size === 0 || mix.tags.some((tag) => selectedTags.has(tag));
      return matchesSearch && matchesBars && matchesTags;
    });
    const collator = new Intl.Collator(nameMode === "kana" ? "ja" : "en", { sensitivity: "base", numeric: true });
    return searchable.sort((a, b) => collator.compare(nameMode === "kana" ? a.nameKana : a.nameRomaji, nameMode === "kana" ? b.nameKana : b.nameRomaji));
  }

  function renderFilterOptions() {
    const allBars = new Set(mixes.flatMap((mix) => mix.barCounts));
    selectedBars.forEach((count) => allBars.add(count));
    const bars = [...allBars].sort((a, b) => a - b);
    elements.barFilters.innerHTML = bars.length
      ? bars.map((count) => `<button class="filter-chip" type="button" data-filter-kind="bar" data-filter-value="${count}" aria-pressed="${selectedBars.has(count)}">${count} 小節</button>`).join("")
      : '<span class="filter-empty">Aún no hay duraciones</span>';
    elements.tagFilters.innerHTML = MIX_TAGS.map((tag) => `<button class="filter-chip" type="button" data-filter-kind="tag" data-filter-value="${tag.id}" aria-pressed="${selectedTags.has(tag.id)}" title="${tag.kana}">${tag.romaji} · ${tag.kana}</button>`).join("");
    elements.clearFilters.hidden = selectedBars.size === 0 && selectedTags.size === 0;
  }

  function renderDurationChips() {
    elements.durationChips.innerHTML = formBarCounts.map((count) => `<span class="duration-chip">${count} 小節<button type="button" data-remove-bar="${count}" aria-label="Quitar ${count} compases">×</button></span>`).join("");
  }

  function render() {
    elements.count.textContent = String(mixes.length);
    elements.tabCount.textContent = String(mixes.length);
    renderFilterOptions();
    const visible = matchingMixes();
    const hasFilters = selectedBars.size > 0 || selectedTags.size > 0;
    elements.results.textContent = elements.search.value.trim() || hasFilters
      ? `${visible.length} ${visible.length === 1 ? "resultado" : "resultados"} · ${mixes.length} guardados`
      : `${mixes.length} ${mixes.length === 1 ? "mix guardado" : "mixes guardados"}`;

    if (visible.length === 0) {
      elements.list.replaceChildren();
      elements.empty.hidden = false;
      const isSearching = Boolean(elements.search.value.trim());
      elements.emptyTitle.textContent = isSearching ? "No encontramos ese mix" : hasFilters ? "No hay mixes con esos filtros" : "Tu colección empieza aquí";
      elements.emptyCopy.textContent = isSearching
        ? "Prueba con otra palabra, en kana o en romaji."
        : hasFilters ? "Prueba quitando algún filtro o elige otra duración o etiqueta."
          : "Añade tu primer mix para tener tus calls siempre a mano.";
      $("#emptyAddButton").hidden = isSearching || hasFilters;
      return;
    }

    elements.empty.hidden = true;
    elements.list.innerHTML = visible.map((mix, index) => {
      const primaryName = nameMode === "kana" ? mix.nameKana : mix.nameRomaji;
      const secondaryName = nameMode === "kana" ? mix.nameRomaji : mix.nameKana;
      const badges = [
        ...mix.barCounts.map((count) => `<span class="mix-badge">${count} 小節</span>`),
        ...mix.tags.map((id) => MIX_TAGS.find((tag) => tag.id === id)).filter(Boolean)
          .map((tag) => `<span class="mix-badge tag-badge" title="${tag.kana}">${tag.romaji} · ${tag.kana}</span>`),
      ].join("");
      const startRomaji = mix.startRomaji
        ? `<div class="reading-part start-part"><div class="reading-part-label">INICIO · 始動</div><p class="reading-text">${escapeHtml(mix.startRomaji)}</p></div>`
        : "";
      const startKana = mix.startKana
        ? `<div class="reading-part start-part"><div class="reading-part-label">INICIO · 始動</div><p class="reading-text" lang="ja">${escapeHtml(mix.startKana)}</p></div>`
        : "";
      return `<details class="mix-card" data-id="${escapeHtml(mix.id)}">
        <summary>
          <span class="mix-order">${String(index + 1).padStart(2, "0")}</span>
          <span class="mix-title-wrap"><span class="mix-title">${escapeHtml(primaryName)}</span><span class="mix-subtitle">${escapeHtml(secondaryName)}</span>${badges ? `<span class="entry-badges">${badges}</span>` : ""}</span>
          <span class="mix-summary-right"><span class="chevron" aria-hidden="true"></span></span>
        </summary>
        <div class="mix-detail">
          <div class="reading-grid">
            <div class="reading-column" role="group" aria-label="Romaji">${startRomaji}<div class="mix-reading"><p class="reading-text">${escapeHtml(mix.readingRomaji)}</p></div></div>
            <div class="reading-column" role="group" aria-label="Kana">${startKana}<div class="mix-reading"><p class="reading-text" lang="ja">${escapeHtml(mix.readingKana)}</p></div></div>
          </div>
          <div class="detail-actions"><button class="small-action" type="button" data-action="edit" data-id="${escapeHtml(mix.id)}">Editar</button><button class="small-action delete" type="button" data-action="delete" data-id="${escapeHtml(mix.id)}">Eliminar</button></div>
        </div>
      </details>`;
    }).join("");
  }

  function openForm(mix = null) {
    if (mix || !formDraftActive) {
      elements.formTitle.textContent = mix ? "Edita el mix" : "Añade un mix";
      elements.saveButton.innerHTML = mix ? "Guardar cambios <span aria-hidden=\"true\">↗</span>" : "Guardar mix <span aria-hidden=\"true\">↗</span>";
      elements.editId.value = mix?.id ?? "";
      elements.nameRomaji.value = mix?.nameRomaji ?? "";
      elements.nameKana.value = mix?.nameKana ?? "";
      elements.readingRomaji.value = mix?.readingRomaji ?? "";
      elements.readingKana.value = mix?.readingKana ?? "";
      elements.startRomaji.value = mix?.startRomaji ?? "";
      elements.startKana.value = mix?.startKana ?? "";
      elements.barCountInput.value = "";
      formBarCounts = [...(mix?.barCounts ?? [])];
      renderDurationChips();
      elements.tagInputs.forEach((input) => { input.checked = mix?.tags.includes(input.value) ?? false; });
      formDraftActive = true;
    }
    elements.workspace.hidden = true;
    elements.panel.hidden = false;
    elements.addTab.classList.add("active");
    elements.addTab.removeAttribute("aria-current");
    elements.libraryTab.classList.remove("active");
    elements.libraryTab.removeAttribute("aria-current");
    elements.panel.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => { if (!elements.panel.hidden) elements.nameRomaji.focus({ preventScroll: true }); }, 250);
  }

  function showLibrary() {
    elements.panel.hidden = true;
    elements.workspace.hidden = false;
    elements.libraryTab.classList.add("active");
    elements.libraryTab.setAttribute("aria-current", "page");
    elements.addTab.classList.remove("active");
    elements.addTab.removeAttribute("aria-current");
  }

  function closeForm() {
    elements.form.reset();
    elements.editId.value = "";
    formDraftActive = false;
    showLibrary();
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 2800);
  }

  function addBarDuration() {
    const count = Number(elements.barCountInput.value);
    if (!Number.isInteger(count) || count < 1 || count > 999) {
      showToast("Indica un número entero entre 1 y 999.");
      elements.barCountInput.focus();
      return;
    }
    if (formBarCounts.includes(count)) {
      showToast("Esa duración ya está añadida.");
      elements.barCountInput.select();
      return;
    }
    formBarCounts = [...formBarCounts, count].sort((a, b) => a - b);
    elements.barCountInput.value = "";
    renderDurationChips();
    elements.barCountInput.focus();
  }

  function setNameMode(mode) {
    nameMode = mode;
    elements.modeButton.dataset.mode = mode;
    elements.modeButton.setAttribute("aria-pressed", String(mode === "kana"));
    elements.modeLabel.textContent = mode === "kana" ? "Kana" : "Romaji";
    elements.modeButton.querySelectorAll(".segment").forEach((segment) => {
      segment.classList.toggle("active", segment.dataset.mode === mode);
    });
    writePreference(NAME_MODE_KEY, mode);
    render();
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const dark = theme === "dark";
    elements.themeButton.setAttribute("aria-label", dark ? "Activar modo claro" : "Activar modo oscuro");
    writePreference(THEME_KEY, theme);
  }

  function downloadBackup() {
    const backup = { format: "idol-mixes-backup", version: 1, exportedAt: new Date().toISOString(), mixes };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `idol-mixes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Copia JSON descargada.");
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : parsed?.mixes;
      if (!Array.isArray(list)) throw new Error("El archivo no contiene una lista de mixes.");
      const normalized = list.map(normalizeMix);
      if (normalized.some((mix) => !mix)) throw new Error("Hay entradas incompletas. Revisa los cuatro campos obligatorios.");
      const unique = new Map();
      normalized.forEach((mix) => {
        if (unique.has(mix.id)) mix.id = makeId();
        unique.set(mix.id, mix);
      });
      if (!window.confirm(`Se reemplazarán los ${mixes.length} mixes actuales por los ${unique.size} del archivo. ¿Continuar?`)) return;
      mixes = [...unique.values()];
      selectedBars.clear();
      selectedTags.clear();
      const saved = await persist();
      render();
      showSaveResult(saved, `${mixes.length} ${mixes.length === 1 ? "mix importado" : "mixes importados"}.`);
    } catch (error) {
      showToast(error instanceof SyntaxError ? "No se pudo leer el JSON." : (error.message || "No se pudo importar el archivo."));
    } finally {
      elements.importFile.value = "";
    }
  }

  elements.addTab.addEventListener("click", () => openForm());
  elements.libraryTab.addEventListener("click", showLibrary);
  $("#brandHome").addEventListener("click", (event) => {
    event.preventDefault();
    showLibrary();
    elements.workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#emptyAddButton").addEventListener("click", () => openForm());
  $("#closeForm").addEventListener("click", closeForm);
  $("#cancelForm").addEventListener("click", closeForm);
  elements.addBarCount.addEventListener("click", addBarDuration);
  elements.barCountInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addBarDuration();
    }
  });
  elements.durationChips.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove-bar]");
    if (!button) return;
    formBarCounts = formBarCounts.filter((count) => count !== Number(button.dataset.removeBar));
    renderDurationChips();
  });
  elements.barFilters.addEventListener("click", (event) => {
    const button = event.target.closest('button[data-filter-kind="bar"]');
    if (!button) return;
    const count = Number(button.dataset.filterValue);
    if (selectedBars.has(count)) selectedBars.delete(count);
    else selectedBars.add(count);
    render();
    elements.barFilters.querySelector(`[data-filter-value="${count}"]`)?.focus();
  });
  elements.tagFilters.addEventListener("click", (event) => {
    const button = event.target.closest('button[data-filter-kind="tag"]');
    if (!button) return;
    const tag = button.dataset.filterValue;
    if (selectedTags.has(tag)) selectedTags.delete(tag);
    else selectedTags.add(tag);
    render();
    elements.tagFilters.querySelector(`[data-filter-value="${tag}"]`)?.focus();
  });
  elements.clearFilters.addEventListener("click", () => {
    selectedBars.clear();
    selectedTags.clear();
    render();
  });
  elements.search.addEventListener("input", render);
  elements.modeButton.addEventListener("click", () => setNameMode(nameMode === "romaji" ? "kana" : "romaji"));
  elements.themeButton.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  $("#exportButton").addEventListener("click", downloadBackup);
  $("#importButton").addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", (event) => importBackup(event.target.files?.[0]));

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const editId = elements.editId.value;
    const previous = mixes.find((mix) => mix.id === editId);
    const now = new Date().toISOString();
    const mix = normalizeMix({
      id: previous?.id ?? makeId(),
      nameRomaji: elements.nameRomaji.value,
      nameKana: elements.nameKana.value,
      readingRomaji: elements.readingRomaji.value,
      readingKana: elements.readingKana.value,
      startRomaji: elements.startRomaji.value,
      startKana: elements.startKana.value,
      barCounts: formBarCounts,
      tags: elements.tagInputs.filter((input) => input.checked).map((input) => input.value),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    });
    if (!mix) return;
    mixes = previous ? mixes.map((entry) => entry.id === editId ? mix : entry) : [...mixes, mix];
    const saved = await persist();
    closeForm();
    elements.search.value = "";
    selectedBars.clear();
    selectedTags.clear();
    render();
    showSaveResult(saved, previous ? "Mix actualizado." : "Mix añadido a tu colección.");
  });

  elements.list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const mix = mixes.find((entry) => entry.id === button.dataset.id);
    if (!mix) return;
    if (button.dataset.action === "edit") {
      openForm(mix);
    } else if (button.dataset.action === "delete" && window.confirm(`¿Eliminar “${mix.nameRomaji}” de tu colección?`)) {
      mixes = mixes.filter((entry) => entry.id !== mix.id);
      const saved = await persist();
      render();
      showSaveResult(saved, "Mix eliminado.");
    }
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const typing = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      elements.search.focus();
    }
    if (event.key === "Escape" && document.activeElement === elements.search) {
      elements.search.value = "";
      render();
      elements.search.blur();
    }
  });

  const preferredTheme = readPreference(THEME_KEY) || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  setTheme(preferredTheme);
  setNameMode(nameMode);
  render();
  connectToJsonFile();
})();
