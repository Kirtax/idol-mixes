(() => {
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
    appShell: $(".app-shell"), storageLabel: $("#storageLabel"), themeColor: $('meta[name="theme-color"]'),
    list: $("#mixList"), count: $("#mixCount"), tabCount: $("#tabMixCount"), results: $("#resultsLabel"), empty: $("#emptyState"),
    emptyTitle: $("#emptyTitle"), emptyCopy: $("#emptyCopy"), search: $("#searchInput"),
    barFilters: $("#barFilters"), tagFilters: $("#tagFilters"), clearFilters: $("#clearFilters"),
    modeButton: $("#nameMode"), modeLabel: $("#nameModeLabel"), themeButton: $("#themeToggle"),
    workspace: $("#libraryView"), libraryTab: $("#libraryTab"), addTab: $("#addTabButton"),
    panel: $("#addPanel"), form: $("#mixForm"), formTitle: $("#formTitle"), editId: $("#editId"),
    mainTitle: $("#mainTitle"), mainTitleKana: $("#mainTitleKana"),
    nameRomaji: $("#nameRomaji"), nameKana: $("#nameKana"), readingRomaji: $("#readingRomaji"), readingKana: $("#readingKana"), readingKanaRomaji: $("#readingKanaRomaji"),
    startRomaji: $("#startRomaji"), startKana: $("#startKana"), startKanaRomaji: $("#startKanaRomaji"),
    barCountInput: $("#barCountInput"), addBarCount: $("#addBarCount"), durationChips: $("#durationChips"),
    variantList: $("#variantList"), addVariant: $("#addVariant"), baseReadingHint: $("#baseReadingHint"),
    baseRomajiRequiredMark: $("#baseRomajiRequiredMark"), baseKanaRequiredMark: $("#baseKanaRequiredMark"),
    tagInputs: [...document.querySelectorAll('input[name="mixTag"]')],
    saveButton: $("#saveMixButton"), toast: $("#toast"), importFile: $("#importFile"),
  };

  let mixes = [];
  let jsonConnected = false;
  let nameMode = readPreference(NAME_MODE_KEY) === "kana" ? "kana" : "romaji";
  let toastTimer;
  let formDraftActive = false;
  let formBarCounts = [];
  let variantDrafts = [];
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

  function normalizeMix(value) {
    if (!value || typeof value !== "object") return null;
    if (!["nameRomaji", "nameKana"].every((field) => typeof value[field] === "string" && value[field].trim())
      || typeof value.readingRomaji !== "string" || typeof value.readingKana !== "string"
      || value.nameRomaji.length > 120 || value.nameKana.length > 120
      || value.readingRomaji.length > 3000 || value.readingKana.length > 3000) return null;
    const readingKanaRomaji = value.readingKanaRomaji ?? "";
    if (typeof readingKanaRomaji !== "string" || readingKanaRomaji.length > 3000) return null;
    const startRomaji = value.startRomaji ?? "";
    const startKana = value.startKana ?? "";
    if (typeof startRomaji !== "string" || typeof startKana !== "string"
      || startRomaji.length > 3000 || startKana.length > 3000) return null;
    const startKanaRomaji = value.startKanaRomaji ?? "";
    if (typeof startKanaRomaji !== "string" || startKanaRomaji.length > 3000) return null;
    const mainTitle = value.mainTitle === undefined ? "Versión principal" : value.mainTitle;
    const mainTitleKana = value.mainTitleKana === undefined ? "" : value.mainTitleKana;
    if (typeof mainTitle !== "string" || mainTitle.length > 160) return null;
    if (typeof mainTitleKana !== "string" || mainTitleKana.length > 160) return null;
    const rawVariants = value.variants ?? [];
    if (!Array.isArray(rawVariants) || rawVariants.length > 50) return null;
    const variants = rawVariants.map(normalizeVariant);
    if (variants.some((variant) => !variant)) return null;
    const hasRomaji = Boolean(value.readingRomaji.trim());
    const hasKana = Boolean(value.readingKana.trim());
    if (hasRomaji !== hasKana || (!hasRomaji && variants.length === 0)) return null;
    return {
      id: typeof value.id === "string" && value.id ? value.id : makeId(),
      nameRomaji: value.nameRomaji.trim(),
      nameKana: value.nameKana.trim(),
      readingRomaji: value.readingRomaji.trim(),
      readingKana: value.readingKana.trim(),
      readingKanaRomaji: readingKanaRomaji.trim(),
      startRomaji: startRomaji.trim(),
      startKana: startKana.trim(),
      startKanaRomaji: startKanaRomaji.trim(),
      mainTitle: mainTitle.trim() || "Versión principal",
      mainTitleKana: mainTitleKana.trim(),
      variants,
      barCounts: Array.isArray(value.barCounts)
        ? [...new Set(value.barCounts.map(Number).filter((count) => Number.isInteger(count) && count >= 1 && count <= 999))].sort((a, b) => a - b)
        : [],
      tags: Array.isArray(value.tags) ? [...new Set(value.tags.filter((tag) => VALID_TAG_IDS.has(tag)))] : [],
      createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    };
  }

  function normalizeVariant(value) {
    if (!value || typeof value !== "object") return null;
    const fields = ["title", "readingRomaji", "readingKana"];
    if (!fields.every((field) => typeof value[field] === "string" && value[field].trim())
      || value.title.length > 160 || value.readingRomaji.length > 3000 || value.readingKana.length > 3000) return null;
    const titleKana = value.titleKana ?? "";
    if (typeof titleKana !== "string" || titleKana.length > 160) return null;
    const startRomaji = value.startRomaji ?? "";
    const startKana = value.startKana ?? "";
    if (typeof startRomaji !== "string" || typeof startKana !== "string"
      || startRomaji.length > 3000 || startKana.length > 3000) return null;
    const startKanaRomaji = value.startKanaRomaji ?? "";
    if (typeof startKanaRomaji !== "string" || startKanaRomaji.length > 3000) return null;
    const readingKanaRomaji = value.readingKanaRomaji ?? "";
    if (typeof readingKanaRomaji !== "string" || readingKanaRomaji.length > 3000) return null;
    return {
      id: typeof value.id === "string" && value.id ? value.id : makeId(),
      title: value.title.trim(),
      titleKana: titleKana.trim(),
      startRomaji: startRomaji.trim(),
      startKana: startKana.trim(),
      startKanaRomaji: startKanaRomaji.trim(),
      readingRomaji: value.readingRomaji.trim(),
      readingKana: value.readingKana.trim(),
      readingKanaRomaji: readingKanaRomaji.trim(),
    };
  }

  async function persist(nextMixes) {
    try {
      if (!jsonConnected) throw new Error("El servidor JSON no está conectado.");
      const response = await fetch("/api/mixes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextMixes),
      });
      if (!response.ok) throw new Error("No se pudo escribir el archivo JSON.");
      mixes = nextMixes;
      elements.storageLabel.textContent = "Guardado en data/mixes.json";
      return "file";
    } catch {
      elements.storageLabel.textContent = "No se pudo guardar en data/mixes.json";
      return "failed";
    }
  }

  function showSaveResult(result, successMessage) {
    if (result === "file") showToast(successMessage);
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
      const fileMixes = fileValues.map(normalizeMix);
      if (fileMixes.some((mix) => !mix)) throw new Error("data/mixes.json contiene un mix incompleto o no válido.");
      mixes = fileMixes;
      jsonConnected = true;
      elements.storageLabel.textContent = "Guardado en data/mixes.json";
    } catch (error) {
      mixes = [];
      jsonConnected = false;
      elements.storageLabel.textContent = "No se pudo leer data/mixes.json · inicia node server.js y recarga";
      showToast(error.message || "No se pudo leer data/mixes.json.");
    } finally {
      elements.appShell.inert = !jsonConnected;
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
        mix.nameRomaji, mix.nameKana, mix.mainTitle, mix.mainTitleKana, mix.startRomaji, mix.startKana, mix.startKanaRomaji, mix.readingRomaji, mix.readingKana, mix.readingKanaRomaji,
        ...mix.variants.flatMap((variant) => [variant.title, variant.titleKana, variant.startRomaji, variant.startKana, variant.startKanaRomaji, variant.readingRomaji, variant.readingKana, variant.readingKanaRomaji]),
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

  function renderVariantForm() {
    elements.variantList.innerHTML = variantDrafts.map((variant, index) => `<div class="variant-form-card" data-variant-id="${escapeHtml(variant.id)}" role="group" aria-label="Variante ${index + 1}">
      <div class="variant-form-heading"><span>VARIANTE ${String(index + 1).padStart(2, "0")}</span><button class="remove-variant" type="button" data-remove-variant="${escapeHtml(variant.id)}" aria-label="Eliminar variante ${index + 1}">×</button></div>
      <div class="form-grid">
        <label class="field"><span>Subtítulo en romaji <b>*</b></span><input class="variant-title" required maxlength="160" value="${escapeHtml(variant.title)}" placeholder="Ej. Japanese 2ren (Ura Japanese)" /></label>
        <label class="field"><span>Subtítulo en kana</span><input class="variant-title-kana" maxlength="160" value="${escapeHtml(variant.titleKana)}" placeholder="Ej. ジャパニーズ2連" /></label>
      </div>
      <div class="field-block-label"><span>Inicio propio</span><span>OPCIONAL · VACÍO = INICIO DEL MIX</span></div>
      <div class="form-grid form-grid--three">
        <label class="field"><span>Inicio en romaji</span><input class="variant-start-romaji" maxlength="3000" value="${escapeHtml(variant.startRomaji)}" placeholder="Aruka!" /></label>
        <label class="field"><span>Inicio en kana</span><input class="variant-start-kana" maxlength="3000" value="${escapeHtml(variant.startKana)}" placeholder="アルカ" /></label>
        <label class="field"><span>Inicio en romaji japonés · opcional</span><input class="variant-start-kana-romaji" maxlength="3000" value="${escapeHtml(variant.startKanaRomaji)}" placeholder="Arukaa!" /></label>
      </div>
      <div class="field-block-label"><span>Lectura de la variante</span><span>ROMAJI PRIMERO</span></div>
      <div class="form-grid form-grid--three">
        <label class="field"><span>Lectura en romaji <b>*</b></span><textarea class="variant-romaji" required rows="3" maxlength="3000" placeholder="Escribe la variante en romaji">${escapeHtml(variant.readingRomaji)}</textarea></label>
        <label class="field"><span>Lectura en kana <b>*</b></span><textarea class="variant-kana" required rows="3" maxlength="3000" placeholder="Escribe la variante en kana">${escapeHtml(variant.readingKana)}</textarea></label>
        <label class="field"><span>Romaji de la lectura japonesa · opcional</span><textarea class="variant-kana-romaji" rows="3" maxlength="3000" placeholder="Transcribe el kana a romaji si la pronunciación difiere">${escapeHtml(variant.readingKanaRomaji)}</textarea></label>
      </div>
    </div>`).join("");
    const hasVariants = variantDrafts.length > 0;
    elements.readingRomaji.required = !hasVariants;
    elements.readingKana.required = !hasVariants;
    elements.baseRomajiRequiredMark.hidden = hasVariants;
    elements.baseKanaRequiredMark.hidden = hasVariants;
    elements.baseReadingHint.textContent = hasVariants ? "OPCIONAL CON VARIANTES" : "OBLIGATORIA SIN VARIANTES";
  }

  function readVariantDrafts() {
    return [...elements.variantList.querySelectorAll(".variant-form-card")].map((card) => ({
      id: card.dataset.variantId,
      title: card.querySelector(".variant-title").value,
      titleKana: card.querySelector(".variant-title-kana").value,
      startRomaji: card.querySelector(".variant-start-romaji").value,
      startKana: card.querySelector(".variant-start-kana").value,
      startKanaRomaji: card.querySelector(".variant-start-kana-romaji").value,
      readingRomaji: card.querySelector(".variant-romaji").value,
      readingKana: card.querySelector(".variant-kana").value,
      readingKanaRomaji: card.querySelector(".variant-kana-romaji").value,
    }));
  }

  function renderReadingPair(romaji, kana, kanaRomaji = "") {
    const extraColumn = kanaRomaji ? `<div class="reading-column japanese-romaji-column" role="group" aria-label="Romaji japonés"><div class="reading-part-label">ROMAJI JAPONÉS</div><p class="reading-text" lang="ja-Latn">${escapeHtml(kanaRomaji)}</p></div>` : "";
    return `<div class="reading-grid${kanaRomaji ? " reading-grid--three" : ""}"><div class="reading-column" role="group" aria-label="Romaji"><p class="reading-text">${escapeHtml(romaji)}</p></div><div class="reading-column" role="group" aria-label="Kana"><p class="reading-text" lang="ja">${escapeHtml(kana)}</p></div>${extraColumn}</div>`;
  }

  function renderStartPair(romaji, kana, kanaRomaji = "") {
    if (!romaji && !kana && !kanaRomaji) return "";
    const romajiBlock = romaji ? `<div class="reading-part-label">INICIO · 始動</div><p class="reading-text">${escapeHtml(romaji)}</p>` : "";
    const kanaBlock = kana ? `<div class="reading-part-label">INICIO · 始動</div><p class="reading-text" lang="ja">${escapeHtml(kana)}</p>` : "";
    const kanaRomajiBlock = kanaRomaji ? `<div class="reading-part-label">INICIO · ROMAJI JAPONÉS</div><p class="reading-text" lang="ja-Latn">${escapeHtml(kanaRomaji)}</p>` : "";
    return `<div class="reading-grid shared-start${kanaRomaji ? " reading-grid--three" : ""}"><div class="reading-column" role="group" aria-label="Romaji">${romajiBlock}</div><div class="reading-column" role="group" aria-label="Kana">${kanaBlock}</div>${kanaRomaji ? `<div class="reading-column japanese-romaji-column" role="group" aria-label="Romaji japonés">${kanaRomajiBlock}</div>` : ""}</div>`;
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
        ...(mix.variants.length ? [`<span class="mix-badge variant-badge">${mix.variants.length} ${mix.variants.length === 1 ? "variante" : "variantes"}</span>`] : []),
      ].join("");
      const sharedStart = renderStartPair(mix.startRomaji, mix.startKana, mix.startKanaRomaji);
      const visibleMainTitle = nameMode === "kana" ? (mix.mainTitleKana || mix.mainTitle) : mix.mainTitle;
      const mainReading = mix.readingRomaji || mix.readingKana || mix.readingKanaRomaji
        ? `<section class="variant-display main-version">${mix.variants.length || visibleMainTitle !== "Versión principal" ? `<h3 class="variant-display-title">${escapeHtml(visibleMainTitle || "Versión principal")}</h3>` : ""}${renderReadingPair(mix.readingRomaji, mix.readingKana, mix.readingKanaRomaji)}</section>`
        : "";
      const variantReadings = mix.variants.map((variant) => {
        const variantTitle = nameMode === "kana" && variant.titleKana ? variant.titleKana : variant.title;
        const secondaryTitle = nameMode === "kana" ? (variant.titleKana ? variant.title : "") : variant.titleKana;
        const variantStart = renderStartPair(variant.startRomaji, variant.startKana, variant.startKanaRomaji);
        return `<details class="variant-display variant-accordion"><summary class="variant-accordion-summary"><h3 class="variant-display-title"><span>${escapeHtml(variantTitle)}</span>${secondaryTitle && secondaryTitle !== variantTitle ? `<span class="variant-display-subtitle">${escapeHtml(secondaryTitle)}</span>` : ""}</h3><span class="variant-chevron" aria-hidden="true"></span></summary>${variantStart}${renderReadingPair(variant.readingRomaji, variant.readingKana, variant.readingKanaRomaji)}</details>`;
      }).join("");
      return `<details class="mix-card" data-id="${escapeHtml(mix.id)}">
        <summary>
          <span class="mix-order">${String(index + 1).padStart(2, "0")}</span>
          <span class="mix-title-wrap"><span class="mix-title">${escapeHtml(primaryName)}</span><span class="mix-subtitle">${escapeHtml(secondaryName)}</span>${badges ? `<span class="entry-badges">${badges}</span>` : ""}</span>
          <span class="mix-summary-right"><span class="chevron" aria-hidden="true"></span></span>
        </summary>
        <div class="mix-detail">
          ${sharedStart}${mainReading}${variantReadings}
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
      elements.mainTitle.value = mix?.mainTitle ?? "Versión principal";
      elements.mainTitleKana.value = mix?.mainTitleKana ?? "";
      elements.nameRomaji.value = mix?.nameRomaji ?? "";
      elements.nameKana.value = mix?.nameKana ?? "";
      elements.readingRomaji.value = mix?.readingRomaji ?? "";
      elements.readingKana.value = mix?.readingKana ?? "";
      elements.readingKanaRomaji.value = mix?.readingKanaRomaji ?? "";
      elements.startRomaji.value = mix?.startRomaji ?? "";
      elements.startKana.value = mix?.startKana ?? "";
      elements.startKanaRomaji.value = mix?.startKanaRomaji ?? "";
      elements.barCountInput.value = "";
      formBarCounts = [...(mix?.barCounts ?? [])];
      renderDurationChips();
      variantDrafts = [...(mix?.variants ?? [])];
      renderVariantForm();
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
    variantDrafts = [];
    renderVariantForm();
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
    elements.themeColor.content = dark ? "#2E3440" : "#E5E9F0";
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
      const nextMixes = [...unique.values()];
      const saved = await persist(nextMixes);
      if (saved === "file") {
        selectedBars.clear();
        selectedTags.clear();
      }
      render();
      showSaveResult(saved, `${nextMixes.length} ${nextMixes.length === 1 ? "mix importado" : "mixes importados"}.`);
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
  elements.addVariant.addEventListener("click", () => {
    variantDrafts = readVariantDrafts();
    if (variantDrafts.length >= 50) {
      showToast("Un mix puede tener hasta 50 variantes.");
      return;
    }
    const variant = { id: makeId(), title: "", titleKana: "", startRomaji: "", startKana: "", startKanaRomaji: "", readingRomaji: "", readingKana: "", readingKanaRomaji: "" };
    variantDrafts.push(variant);
    renderVariantForm();
    elements.variantList.querySelector(`[data-variant-id="${variant.id}"] .variant-title`)?.focus();
  });
  elements.variantList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove-variant]");
    if (!button) return;
    variantDrafts = readVariantDrafts().filter((variant) => variant.id !== button.dataset.removeVariant);
    renderVariantForm();
  });
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
    const variants = readVariantDrafts();
    const hasBaseRomaji = Boolean(elements.readingRomaji.value.trim());
    const hasBaseKana = Boolean(elements.readingKana.value.trim());
    if (hasBaseRomaji !== hasBaseKana) {
      showToast("Completa la versión principal tanto en romaji como en kana, o deja ambos campos vacíos.");
      (hasBaseRomaji ? elements.readingKana : elements.readingRomaji).focus();
      return;
    }
    const invalidVariantIndex = variants.findIndex((variant) => !normalizeVariant(variant));
    if (invalidVariantIndex !== -1) {
      showToast("Completa el subtítulo y las dos lecturas de cada variante.");
      const invalidCard = elements.variantList.children[invalidVariantIndex];
      [...invalidCard.querySelectorAll("input, textarea")].find((field) => !field.value.trim())?.focus();
      return;
    }
    const now = new Date().toISOString();
    const mix = normalizeMix({
      id: previous?.id ?? makeId(),
      mainTitle: elements.mainTitle.value,
      mainTitleKana: elements.mainTitleKana.value,
      nameRomaji: elements.nameRomaji.value,
      nameKana: elements.nameKana.value,
      readingRomaji: elements.readingRomaji.value,
      readingKana: elements.readingKana.value,
      readingKanaRomaji: elements.readingKanaRomaji.value,
      startRomaji: elements.startRomaji.value,
      startKana: elements.startKana.value,
      startKanaRomaji: elements.startKanaRomaji.value,
      variants,
      barCounts: formBarCounts,
      tags: elements.tagInputs.filter((input) => input.checked).map((input) => input.value),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    });
    if (!mix) return;
    const nextMixes = previous ? mixes.map((entry) => entry.id === editId ? mix : entry) : [...mixes, mix];
    const saved = await persist(nextMixes);
    if (saved !== "file") {
      showSaveResult(saved, "Mix guardado.");
      return;
    }
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
      const nextMixes = mixes.filter((entry) => entry.id !== mix.id);
      const saved = await persist(nextMixes);
      if (saved !== "file") {
        showSaveResult(saved, "Mix eliminado.");
        return;
      }
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
