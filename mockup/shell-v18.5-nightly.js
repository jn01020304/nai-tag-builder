const { parsePngTextChunks, extractStealthPngMetadata } = pngMetadata;
const KEY = "tag-lab";
const GENERATION_STATE_VERSION = 3;
const ORCHESTRATION_STATE_VERSION = 2;
const imageObjects = new Map();
function readStoredSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  catch { return {}; }
}
function writeStoredSettings(value) {
  try { localStorage.setItem(KEY, JSON.stringify(value)); }
  catch { }
}
function indexedDbRequest(dbName, storeName, mode, createRequest) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(dbName, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(storeName)) open.result.createObjectStore(storeName);
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(storeName, mode);
      const request = createRequest(tx.objectStore(storeName));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || request.error); };
    };
  });
}
const putIndexedDbValue = (dbName, storeName, key, value) =>
  indexedDbRequest(dbName, storeName, "readwrite", store => store.put(value, key)).then(() => key);
const getIndexedDbValue = (dbName, storeName, key) =>
  indexedDbRequest(dbName, storeName, "readonly", store => store.get(key));
const deleteIndexedDbValue = (dbName, storeName, key) =>
  indexedDbRequest(dbName, storeName, "readwrite", store => store.delete(key)).then(() => undefined);
let storedSettings = readStoredSettings();
const load = () => storedSettings;
const save = patch => {
  storedSettings = { ...storedSettings, ...patch };
  writeStoredSettings(storedSettings);
  return storedSettings;
};
const S = load(), root = document.documentElement;
const COMPACT_LAYOUT_WIDTH = 960, MIN_UI_SCALE = .5, MAX_UI_SCALE = 2;
let fs = Math.min(20, Math.max(11, Number(S.fs) || 13));
let uiScale = Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, Number(S.uiScale) || 1));
const fontValue = document.getElementById("fontValue");
const fsIncreaseButton = document.getElementById("fsU");
const fsDecreaseButton = document.getElementById("fsD");
const themeButton = document.getElementById("th");
function syncCompactLayout() {
  const fontScale = Math.max(1, fs / 13);
  const effectiveWidth = innerWidth / uiScale / fontScale;
  document.body.classList.toggle("compact-layout", effectiveWidth <= COMPACT_LAYOUT_WIDTH);
  document.body.classList.toggle("narrow-layout", effectiveWidth <= 420);
}
const applyFs = () => {
  root.style.setProperty("--fs", fs + "px");
  fontValue.textContent = fs;
  save({ fs });
  syncCompactLayout();
  requestAnimationFrame(clampLayout);
};
applyFs();
fsIncreaseButton.onclick = () => { fs = Math.min(fs + 1, 20); applyFs(); };
fsDecreaseButton.onclick = () => { fs = Math.max(fs - 1, 11); applyFs(); };
if (S.theme)
    root.setAttribute("data-theme", S.theme);
const syncTheme = () => themeButton.textContent = root.getAttribute("data-theme") === "dark" ? "밝게" : "어둡게";
syncTheme();
themeButton.onclick = () => {
    const n = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", n);
    save({ theme: n });
    syncTheme();
};
const uiScaleInput = document.getElementById("uiScaleInput");
function applyUiScale() {
  root.style.setProperty("--ui-scale", String(uiScale));
  document.body.style.zoom = String(uiScale);
  uiScaleInput.value = String(Math.round(uiScale * 1000) / 10);
  save({ uiScale });
  syncCompactLayout();
  requestAnimationFrame(clampLayout);
}
applyUiScale();
uiScaleInput.addEventListener("change", () => {
  const value = Number(uiScaleInput.value);
  if (!Number.isFinite(value) || value <= 0) { applyUiScale(); return; }
  uiScale = Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, value / 100));
  applyUiScale();
});
const systemReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let motionEnabled = S.motion !== false;
let reducedMotion = systemReducedMotion || !motionEnabled;
const motionToggle = document.getElementById("settingMotion");
const applyMotion = () => {
    reducedMotion = systemReducedMotion || !motionEnabled;
    document.body.classList.toggle("no-motion", reducedMotion);
    motionToggle.checked = motionEnabled;
    motionToggle.disabled = systemReducedMotion;
};
applyMotion();
motionToggle.onchange = () => { motionEnabled = motionToggle.checked; save({ motion: motionEnabled }); applyMotion(); };
const settingsPanel = document.getElementById("settingsPanel");
const settingsOpen = document.getElementById("settingsOpen");
const helpPanel = document.getElementById("helpPanel");
const helpOpen = document.getElementById("helpOpen");
const setSettings = open => {
  settingsPanel.hidden = !open;
  settingsOpen.classList.toggle("on", open);
  settingsOpen.setAttribute("aria-expanded", String(open));
  if (open) setHelp(false);
};
const setHelp = open => {
  helpPanel.hidden = !open;
  helpOpen.classList.toggle("on", open);
  helpOpen.setAttribute("aria-expanded", String(open));
  if (open) { settingsPanel.hidden = true; settingsOpen.classList.remove("on"); settingsOpen.setAttribute("aria-expanded", "false"); }
};
settingsOpen.onclick = () => setSettings(settingsPanel.hidden);
helpOpen.onclick = () => setHelp(helpPanel.hidden);
document.getElementById("settingsClose").onclick = () => setSettings(false);
document.getElementById("helpClose").onclick = () => setHelp(false);
addEventListener("pointerdown", e => {
  if (!settingsPanel.hidden && !settingsPanel.contains(e.target) && e.target !== settingsOpen) setSettings(false);
  if (!helpPanel.hidden && !helpPanel.contains(e.target) && e.target !== helpOpen) setHelp(false);
});
addEventListener("keydown", e => { if (e.key === "Escape") { setSettings(false); setHelp(false); } });
const floor = document.getElementById("floor");
const floorHeightCap = () => Math.max(70, floor.parentElement.clientHeight - 180 - (document.getElementById("spF")?.getBoundingClientRect().height || 0));
const panelControls = [
    ["noL", "왼쪽 패널", "‹", "›"],
    ["noF", "하단 패널", "⌄", "⌃"],
    ["noR", "오른쪽 패널", "›", "‹"]
];
panelControls.forEach(([key]) => document.body.classList.toggle(key, S[key] === true));
const syncPanelControls = () => panelControls.forEach(([key, label, closeIcon, openIcon]) => {
    const hidden = document.body.classList.contains(key);
    const action = label + " " + (hidden ? "열기" : "접기");
    document.querySelectorAll(`.panelcontrol[data-panel="${key}"]`).forEach(button => {
        button.textContent = hidden ? openIcon : closeIcon;
        button.classList.toggle("on", hidden);
        button.setAttribute("aria-pressed", String(hidden));
        button.title = action;
        button.setAttribute("aria-label", action);
    });
});
const showPanels = (...keys) => {
    keys.forEach(key => document.body.classList.remove(key));
    save(Object.fromEntries(keys.map(key => [key, false])));
    syncPanelControls();
    requestAnimationFrame(clampLayout);
};
document.addEventListener("click", e => {
    const button = e.target.closest(".panelcontrol[data-panel]");
    if (!button)
        return;
    const key = button.dataset.panel;
    const hidden = !document.body.classList.contains(key);
    document.body.classList.toggle(key, hidden);
    save({ [key]: hidden });
    syncPanelControls();
    if (!hidden) requestAnimationFrame(clampLayout);
});
syncPanelControls();
if (S.floorH)
    floor.style.height = Math.min(floorHeightCap(), Math.max(70, S.floorH)) + "px";
document.getElementById("spF").addEventListener("pointerdown", e => {
    const h = e.currentTarget;
    h.setPointerCapture(e.pointerId);
    const y0 = e.clientY, h0 = floor.getBoundingClientRect().height;
    const move = ev => { floor.style.height = Math.min(floorHeightCap(), Math.max(70, h0 - (ev.clientY - y0))) + "px"; };
    const up = () => {
        h.removeEventListener("pointermove", move);
        h.removeEventListener("pointerup", up);
        save({ floorH: Math.round(floor.getBoundingClientRect().height) });
    };
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
});
document.querySelectorAll(".tabs").forEach(tabList => {
    tabList.addEventListener("click", e => {
        const button = e.target.closest(".tab[data-t]");
        if (!button || !tabList.contains(button))
            return;
        const scope = tabList.parentElement;
        const target = document.getElementById(button.dataset.t);
        if (!scope || !target || !scope.contains(target))
            return;
        tabList.querySelectorAll(".tab").forEach(item => item.classList.remove("on"));
        scope.querySelectorAll(":scope > .tabbody").forEach(body => body.classList.remove("on"));
        button.classList.add("on");
        target.classList.add("on");
    });
});
function drag(handle, target, key, axis, dir, min, max) {
    handle.addEventListener("pointerdown", e => {
        handle.setPointerCapture(e.pointerId);
        const p0 = axis === "x" ? e.clientX : e.clientY;
        const r = target.getBoundingClientRect(), s0 = axis === "x" ? r.width : r.height;
        const move = ev => {
            const p = axis === "x" ? ev.clientX : ev.clientY;
            const upper = typeof max === "function" ? max() : max;
            target.style.flex = "0 0 " + Math.min(upper, Math.max(min, s0 + (p - p0) * dir)) + "px";
        };
        const up = () => {
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", up);
            const rr = target.getBoundingClientRect();
            save({ [key]: Math.round(axis === "x" ? rr.width : rr.height) });
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
    });
}
const sideL = document.getElementById("sideL"), sideR = document.getElementById("sideR"), mainL = document.getElementById("mainL"), pt = document.getElementById("pt"), mirror = document.getElementById("mirror"), ptwrap = document.getElementById("ptwrap");
const splitLeft = document.getElementById("spL"), splitMain = document.getElementById("spM"), splitRight = document.getElementById("spR");
function resetTournamentSplit() {
    if (!document.body.classList.contains("chunkDuel")) return;
    mainL.style.flex = "1 1 0";
}
function captureTournamentLayout() {
    return {
        noL: document.body.classList.contains("noL"),
        mainLFlex: mainL.style.flex,
        mainLStored: storedSettings.mainL ?? null
    };
}
function restoreTournamentLayout() {
    if (!tournamentPanelBefore) return;
    mainL.style.flex = tournamentPanelBefore.mainLFlex || "";
    save({ mainL: tournamentPanelBefore.mainLStored });
    if (tournamentPanelBefore.noL) document.body.classList.add("noL");
}
splitMain.title = "드래그로 폭 조절 · Tournament에서 더블 클릭하면 1:1로 복원";
splitMain.addEventListener("dblclick", event => {
    if (!document.body.classList.contains("chunkDuel")) return;
    event.preventDefault();
    resetTournamentSplit();
});
if (S.sideL)
    sideL.style.flex = "0 0 " + S.sideL + "px";
if (S.sideR)
    sideR.style.flex = "0 0 " + S.sideR + "px";
if (S.mainL)
    mainL.style.flex = "0 0 " + S.mainL + "px";
if (S.ptH)
    ptwrap.style.height = S.ptH + "px";
const MIN_SIDE_L = 280, MIN_SIDE_R = 112, MIN_MAIN_L = 200, MIN_MAIN_R = 260;
const widthOf = element => element.getBoundingClientRect().width;
const innerWidthOf = element => {
    const style = getComputedStyle(element);
    return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
};
const minCenterWidth = () => MIN_MAIN_L + MIN_MAIN_R + widthOf(splitMain);
const railMax = (other, hard, min) => () => Math.max(min,
    Math.min(hard, innerWidthOf(sideL.parentElement) - widthOf(splitLeft) - widthOf(splitRight) - widthOf(other) - minCenterWidth()));
const maxMainL = () => Math.max(MIN_MAIN_L, mainL.parentElement.clientWidth - MIN_MAIN_R - widthOf(splitMain));
function clampLayout() {
    if (document.body.classList.contains("compact-layout")) return;
    const floorCap = floorHeightCap();
    if (!document.body.classList.contains("noF") && floor.getBoundingClientRect().height > floorCap + 1)
        floor.style.height = Math.round(floorCap) + "px";
    if (document.body.classList.contains("chunkDuel") || document.body.classList.contains("chunkTune")) return;
    const fit = (element, min, max) => {
        const limit = max();
        const size = widthOf(element);
        const next = Math.min(limit, Math.max(min, size));
        if (Math.abs(size - next) > 1) element.style.flex = "0 0 " + Math.round(next) + "px";
    };
    if (!document.body.classList.contains("noR")) fit(sideR, MIN_SIDE_R, railMax(sideL, 420, MIN_SIDE_R));
    if (!document.body.classList.contains("noL")) fit(sideL, MIN_SIDE_L, railMax(sideR, 560, MIN_SIDE_L));
    fit(mainL, MIN_MAIN_L, maxMainL);
}
drag(splitLeft, sideL, "sideL", "x", +1, MIN_SIDE_L, railMax(sideR, 560, MIN_SIDE_L));
drag(splitMain, mainL, "mainL", "x", +1, MIN_MAIN_L, maxMainL);
drag(splitRight, sideR, "sideR", "x", -1, MIN_SIDE_R, railMax(sideL, 420, MIN_SIDE_R));
clampLayout();
new ResizeObserver(clampLayout).observe(sideL.parentElement);
addEventListener("resize", () => { syncCompactLayout(); requestAnimationFrame(clampLayout); });
document.getElementById("spT").addEventListener("pointerdown", e => {
    const h = e.currentTarget;
    h.setPointerCapture(e.pointerId);
    const y0 = e.clientY, h0 = ptwrap.getBoundingClientRect().height;
    const move = ev => { ptwrap.style.height = Math.min(600, Math.max(52, h0 + (ev.clientY - y0))) + "px"; };
    const up = () => {
        h.removeEventListener("pointermove", move);
        h.removeEventListener("pointerup", up);
        save({ ptH: Math.round(ptwrap.getBoundingClientRect().height) });
    };
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
});
document.getElementById("settingsReset").onclick = () => {
    sideL.style.flex = "0 0 320px";
    mainL.style.flex = "1 1 55%";
    sideR.style.flex = "0 0 132px";
    ptwrap.style.height = "150px";
    floor.style.height = Math.min(300, floorHeightCap()) + "px";
    document.body.classList.remove("noL", "noR", "noF");
    save({ sideL: null, mainL: null, sideR: null, ptH: null, floorH: null, noL: false, noR: false, noF: false });
    syncPanelControls();
    syncCompactLayout();
    requestAnimationFrame(clampLayout);
};

const modelSelect = document.getElementById("modelSelect");
const styleSelect = document.getElementById("styleSelect");
const qualityPresetSelect = document.getElementById("qualityPresetSelect");
const ucPresetSelect = document.getElementById("ucPresetSelect");
const MODEL_CAPABILITIES = Object.freeze({
  "V5 Full": Object.freeze({ family: "v5", maxCharacters: 22, datasetModes: ["Anime", "Furry", "Background"], qualityPresets: ["standard", "light", "off"], ucPresets: ["human", "furry", "heavy", "light", "off"], transparentBackground: true, baseImage: true, vibeTransfer: false, preciseReference: false, characterPositionMode: "free" }),
  "V5 Curated": Object.freeze({ family: "v5", maxCharacters: 22, datasetModes: ["Anime", "Furry", "Background"], qualityPresets: ["standard", "light", "off"], ucPresets: ["human", "furry", "heavy", "light", "off"], transparentBackground: true, baseImage: true, vibeTransfer: false, preciseReference: false, characterPositionMode: "free" }),
  "V4.5 Full": Object.freeze({ family: "v4.5", maxCharacters: 6, datasetModes: ["Anime", "Furry", "Background"], qualityPresets: ["standard", "off"], ucPresets: ["human", "furry", "heavy", "light", "off"], transparentBackground: false, baseImage: true, vibeTransfer: true, preciseReference: true, characterPositionMode: "grid" }),
  "V4.5 Curated": Object.freeze({ family: "v4.5", maxCharacters: 6, datasetModes: ["Anime", "Furry", "Background"], qualityPresets: ["standard", "off"], ucPresets: ["human", "heavy", "light", "off"], transparentBackground: false, baseImage: true, vibeTransfer: true, preciseReference: true, characterPositionMode: "grid" }),
  "V4 Full": Object.freeze({ family: "v4", maxCharacters: 6, datasetModes: ["Anime", "Furry"], qualityPresets: ["standard", "off"], ucPresets: ["heavy", "light", "off"], transparentBackground: false, baseImage: true, vibeTransfer: true, preciseReference: false, characterPositionMode: "grid" }),
  "V4 Curated": Object.freeze({ family: "v4", maxCharacters: 6, datasetModes: ["Anime", "Furry"], qualityPresets: ["standard", "off"], ucPresets: ["heavy", "light", "off"], transparentBackground: false, baseImage: true, vibeTransfer: true, preciseReference: false, characterPositionMode: "grid" })
});
const DATASET_PREFIX = Object.freeze({ Anime: "", Furry: "fur dataset", Background: "background dataset" });
const QUALITY_PRESET_LABELS = Object.freeze({ standard: "Standard", light: "Light", off: "Off" });
const UC_PRESET_LABELS = Object.freeze({ human: "Human Focus", furry: "Furry Focus", heavy: "Heavy", light: "Light", off: "Off" });
const QUALITY_TAGS = Object.freeze({
  "V5 Full": Object.freeze({ standard: "very aesthetic, masterpiece, no text", light: "very aesthetic, amazing quality, no text", off: "" }),
  "V5 Curated": Object.freeze({ standard: "very aesthetic, masterpiece, no text", light: "very aesthetic, amazing quality, no text", off: "" }),
  "V4.5 Full": Object.freeze({ standard: "location, very aesthetic, masterpiece, no text", off: "" }),
  "V4.5 Curated": Object.freeze({ standard: "location, masterpiece, no text, -0.8::feet::, rating:general", off: "" }),
  "V4 Full": Object.freeze({ standard: "no text, best quality, very aesthetic, absurdres", off: "" }),
  "V4 Curated": Object.freeze({ standard: "rating:general, amazing quality, very aesthetic, absurdres", off: "" })
});
const UC_COMMON = Object.freeze({
  modernHeavy: "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page",
  modernHuman: "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy",
  furry: "{worst quality}, distracting watermark, unfinished, bad quality, {widescreen}, upscale, {sequence}, {{grandfathered content}}, blurred foreground, chromatic aberration, sketch, everyone, [sketch background], simple, [flat colors], ych (character), outline, multiple scenes, [[horror (theme)]], comic"
});
const UC_PRESETS = Object.freeze({
  "V5 Full": Object.freeze({ human: UC_COMMON.modernHuman, furry: UC_COMMON.furry, heavy: UC_COMMON.modernHeavy, light: "lowres, bad hands, bad anatomy, artistic error, sepia, white haze, worst quality, very displeasing, jpeg artifacts, 0::ai-generated::", off: "" }),
  "V5 Curated": Object.freeze({ human: UC_COMMON.modernHuman, furry: UC_COMMON.furry, heavy: UC_COMMON.modernHeavy, light: "lowres, bad hands, bad anatomy, artistic error, sepia, white haze, worst quality, very displeasing, jpeg artifacts, 0::ai-generated::", off: "" }),
  "V4.5 Full": Object.freeze({ human: UC_COMMON.modernHuman, furry: UC_COMMON.furry, heavy: UC_COMMON.modernHeavy, light: "lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page", off: "" }),
  "V4.5 Curated": Object.freeze({ human: "blurry, lowres, upscaled, artistic error, film grain, scan artifacts, bad anatomy, bad hands, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, logo, too many watermarks, @_@, mismatched pupils, glowing eyes, negative space, blank page", heavy: "blurry, lowres, upscaled, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, logo, too many watermarks, negative space, blank page", light: "blurry, lowres, upscaled, artistic error, scan artifacts, jpeg artifacts, logo, too many watermarks, negative space, blank page", off: "" }),
  "V4 Full": Object.freeze({ heavy: "blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, multiple views, logo, too many watermarks", light: "blurry, lowres, error, worst quality, bad quality, jpeg artifacts, very displeasing", off: "" }),
  "V4 Curated": Object.freeze({ heavy: "blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, logo, dated, signature, multiple views, gigantic breasts", light: "blurry, lowres, error, worst quality, bad quality, jpeg artifacts, very displeasing, logo, dated, signature", off: "" })
});
const DEFAULT_MODEL = "V4.5 Full";
const storedGeneration = S.generation?.schemaVersion === GENERATION_STATE_VERSION ? S.generation : {};
const storedOrchestration = S.generationOrchestration?.schemaVersion === ORCHESTRATION_STATE_VERSION ? S.generationOrchestration : {};
const savedModel = MODEL_CAPABILITIES[storedGeneration.model] ? storedGeneration.model : DEFAULT_MODEL;
const savedDatasetMode = storedGeneration.datasetMode || "Anime";
modelSelect.value = savedModel;

const paramSummary = document.getElementById("paramSummary");
const aiSettingsDrawer = document.getElementById("aiSettingsDrawer");
const openAiSettingsBtn = document.getElementById("openAiSettingsBtn");
const closeAiSettingsBtn = document.getElementById("closeAiSettingsBtn");
const inpSteps = document.getElementById("inpSteps"), rangeSteps = document.getElementById("rangeSteps"), sumSteps = document.getElementById("sumSteps");
const inpGuidance = document.getElementById("inpGuidance"), rangeGuidance = document.getElementById("rangeGuidance"), sumGuidance = document.getElementById("sumGuidance");
const inpRescale = document.getElementById("inpRescale"), rangeRescale = document.getElementById("rangeRescale"), sumRescale = document.getElementById("sumRescale");
const selSampler = document.getElementById("selSampler"), sumSampler = document.getElementById("sumSampler");
const selNoise = document.getElementById("selNoise");
const seedInput = document.getElementById("inpSeed"), seedSummary = document.getElementById("sumSeed"), seedLockBtn = document.getElementById("btnSeedLock"), seedRandomBtn = document.getElementById("btnRndSeed");
const resDisplay = document.getElementById("resDisplay"), mainResolution = document.getElementById("mainResolution");
const resLand = document.getElementById("resLand"), resPort = document.getElementById("resPort"), resSq = document.getElementById("resSq");
const genRunLabel = document.getElementById("genRunLabel");
let nextCharacterId = 2;
const makeCharacterPosition = () => ({ mode: "auto", x: null, y: null });
function makeCharacterState(id = `character-${nextCharacterId++}`) {
  return {
    id,
    enabled: true,
    prompt: "",
    undesired: "",
    collapsed: false,
    activeTab: "prompt",
    position: makeCharacterPosition()
  };
}
function normalizeStoredCharacter(character, index) {
  const source = character && typeof character === "object" ? character : {};
  return {
    id: String(source.id || `character-${index + 1}`),
    enabled: source.enabled !== false,
    prompt: String(source.prompt || ""),
    undesired: String(source.undesired || ""),
    collapsed: !!source.collapsed,
    activeTab: source.activeTab === "undesired" ? "undesired" : "prompt",
    position: source.position && typeof source.position === "object"
      ? { mode: source.position.mode || "auto", x: source.position.x ?? null, y: source.position.y ?? null }
      : makeCharacterPosition()
  };
}
/** @typedef {"increment"|"decrement"|"random"} ContinuousSeedMode */
/** @typedef {{id:string,assetKey:(string|null),fileName:string,mime:string,size:number,file:(Blob|null)}} ImageAssetBase */
/** @typedef {ImageAssetBase & {strength:number,noise:number}} BaseImageState */
/** @typedef {ImageAssetBase & {strength:number,informationExtracted:number}} VibeState */
/** @typedef {ImageAssetBase & {referenceType:string,strength:number,fidelity:number}} PreciseReferenceState */
/** @typedef {{count:number,seedMode:ContinuousSeedMode,delaySeconds:number}} GenerationOrchestrationState */
const emptyAsset = () => ({ assetKey: null, fileName: "", mime: "", size: 0, file: null });
function normalizeBaseImage(source = storedGeneration.baseImage) {
  return { id: "base-image", ...emptyAsset(), strength: .7, noise: 0, ...(source && typeof source === "object" ? source : {}), file: null };
}
function normalizeVibe(source, index) {
  return { id: String(source?.id || `vibe-${index + 1}`), ...emptyAsset(), strength: .6, informationExtracted: 1, ...(source || {}), file: null };
}
function normalizePrecise(source, index) {
  return { id: String(source?.id || `precise-${index + 1}`), ...emptyAsset(), referenceType: "character", strength: 1, fidelity: 1, ...(source || {}), file: null };
}
const storedCharacters = Array.isArray(storedGeneration.characters) && storedGeneration.characters.length
  ? storedGeneration.characters.map(normalizeStoredCharacter) : [makeCharacterState("character-1")];
const storedCharacterIds = storedCharacters.map(character => Number(String(character.id).match(/(\d+)$/)?.[1] || 0));
nextCharacterId = Math.max(2, ...storedCharacterIds) + 1;
const storedResolution = storedGeneration.resolution && typeof storedGeneration.resolution === "object"
  ? storedGeneration.resolution : { ratio: "832/1216", label: "832 × 1216", width: 832, height: 1216 };
const generationState = {
  model: savedModel,
  datasetMode: savedDatasetMode,
  qualityPreset: storedGeneration.qualityPreset || "standard",
  ucPreset: storedGeneration.ucPreset || "human",
  characters: storedCharacters,
  baseImage: normalizeBaseImage(),
  vibes: Array.isArray(storedGeneration.vibes) ? storedGeneration.vibes.map(normalizeVibe) : [],
  preciseReferences: Array.isArray(storedGeneration.preciseReferences) ? storedGeneration.preciseReferences.map(normalizePrecise) : [],
  transparentBackground: !!storedGeneration.transparentBackground,
  steps: Number(storedGeneration.steps ?? 28),
  guidance: Number(storedGeneration.guidance ?? 8),
  rescale: Number(storedGeneration.rescale ?? .5),
  sampler: String(storedGeneration.sampler || selSampler.value),
  noiseSchedule: String(storedGeneration.noiseSchedule || selNoise.value),
  seed: Math.max(0, Math.min(4294967295, Number(storedGeneration.seed ?? 4257072022))),
  seedLocked: !!storedGeneration.seedLocked,
  resolution: {
    ratio: String(storedResolution.ratio || "832/1216"),
    label: String(storedResolution.label || "832 × 1216"),
    width: Number(storedResolution.width || 832),
    height: Number(storedResolution.height || 1216)
  },
  variety: !!storedGeneration.variety
};
const MAX_CONTINUOUS_GENERATIONS = 32;
const generationOrchestration = {
  count: Math.max(1, Math.min(MAX_CONTINUOUS_GENERATIONS, Math.trunc(Number(storedOrchestration.count) || 1))),
  seedMode: ["increment", "decrement", "random"].includes(storedOrchestration.seedMode) ? storedOrchestration.seedMode : "increment",
  delaySeconds: Math.max(0, Number(storedOrchestration.delaySeconds) || 0)
};
function generationStorageProjection(state = generationState) {
  return {
    schemaVersion: GENERATION_STATE_VERSION,
    model: state.model,
    datasetMode: state.datasetMode,
    qualityPreset: state.qualityPreset,
    ucPreset: state.ucPreset,
    transparentBackground: !!state.transparentBackground,
    steps: Number(state.steps),
    guidance: Number(state.guidance),
    rescale: Number(state.rescale),
    sampler: state.sampler,
    noiseSchedule: state.noiseSchedule,
    seed: Number(state.seed),
    seedLocked: !!state.seedLocked,
    resolution: { ...state.resolution },
    variety: !!state.variety,
    characters: state.characters.map(character => ({
      id: character.id, enabled: character.enabled !== false, prompt: character.prompt || "", undesired: character.undesired || "",
      collapsed: !!character.collapsed, activeTab: character.activeTab === "undesired" ? "undesired" : "prompt",
      position: { ...(character.position || makeCharacterPosition()) }
    })),
    baseImage: { id: "base-image", assetKey: state.baseImage.assetKey || null, fileName: state.baseImage.fileName || "", mime: state.baseImage.mime || "", size: Number(state.baseImage.size) || 0, strength: Number(state.baseImage.strength), noise: Number(state.baseImage.noise) },
    vibes: state.vibes.map(vibe => ({ id: vibe.id, assetKey: vibe.assetKey || null, fileName: vibe.fileName || "", mime: vibe.mime || "", size: Number(vibe.size) || 0, strength: Number(vibe.strength), informationExtracted: Number(vibe.informationExtracted) })),
    preciseReferences: state.preciseReferences.map(reference => ({ id: reference.id, assetKey: reference.assetKey || null, fileName: reference.fileName || "", mime: reference.mime || "", size: Number(reference.size) || 0, referenceType: reference.referenceType || "character", strength: Number(reference.strength), fidelity: Number(reference.fidelity) }))
  };
}
let generationPersistTimer = 0;
function persistGenerationState() {
  if (generationPersistTimer) {
    clearTimeout(generationPersistTimer);
    generationPersistTimer = 0;
  }
  save({
    generationSchemaVersion: GENERATION_STATE_VERSION,
    generation: generationStorageProjection(),
    generationOrchestration: { schemaVersion: ORCHESTRATION_STATE_VERSION, count: generationOrchestration.count, seedMode: generationOrchestration.seedMode, delaySeconds: generationOrchestration.delaySeconds }
  });
}
function scheduleGenerationPersist() {
  if (generationPersistTimer) clearTimeout(generationPersistTimer);
  generationPersistTimer = setTimeout(persistGenerationState, 180);
}
addEventListener("pagehide", persistGenerationState);
const capabilitiesForState = (state = generationState) => MODEL_CAPABILITIES[state.model] || MODEL_CAPABILITIES[DEFAULT_MODEL];
const modelCapabilities = () => capabilitiesForState();
function syncExperimentIfActive() {
  if (document.body.classList.contains("chunkStage"))
    syncSidebarExperiment();
}

function renderPromptControls(capabilities = modelCapabilities()) {
  const qualityPreset = capabilities.qualityPresets.includes(generationState.qualityPreset) ? generationState.qualityPreset : capabilities.qualityPresets[0];
  const ucPreset = capabilities.ucPresets.includes(generationState.ucPreset) ? generationState.ucPreset : capabilities.ucPresets[0];
  qualityPresetSelect.innerHTML = capabilities.qualityPresets
    .map(key => `<option value="${key}">${QUALITY_PRESET_LABELS[key]}</option>`).join("");
  qualityPresetSelect.value = qualityPreset;
  ucPresetSelect.innerHTML = capabilities.ucPresets
    .map(key => `<option value="${key}">${UC_PRESET_LABELS[key]}</option>`).join("");
  ucPresetSelect.value = ucPreset;
  document.getElementById("qualityAutoNote").textContent = qualityPreset === "off" ? "자동 태그 없음" : "프롬프트 끝에 자동 적용";
  document.getElementById("ucAutoNote").textContent = ucPreset === "off" ? "자동 UC 없음" : "사용자 UC와 결합";
}
function renderModelControls() {
  const capabilities = modelCapabilities();
  const datasetMode = capabilities.datasetModes.includes(generationState.datasetMode) ? generationState.datasetMode : capabilities.datasetModes[0];
  modelSelect.value = generationState.model;
  styleSelect.innerHTML = capabilities.datasetModes.map(mode => `<option value="${mode}">${mode}</option>`).join("");
  styleSelect.value = datasetMode;
  styleSelect.hidden = capabilities.datasetModes.length <= 1;
  styleSelect.disabled = capabilities.datasetModes.length <= 1;
  renderPromptControls(capabilities);

  const transparentRow = document.getElementById("transparentBgRow");
  const transparentToggle = document.getElementById("transparentBgToggle");
  transparentRow.hidden = !capabilities.transparentBackground;
  transparentToggle.classList.toggle("on", generationState.transparentBackground);
  transparentToggle.setAttribute("aria-pressed", String(generationState.transparentBackground));
  transparentToggle.textContent = generationState.transparentBackground ? "On" : "Off";

  if (typeof renderGenerationInputs === "function") renderGenerationInputs();
  if (typeof renderCharacters === "function")
    renderCharacters();
  syncExperimentIfActive();
}
function setModel(model) {
  generationState.model = MODEL_CAPABILITIES[model] ? model : DEFAULT_MODEL;
  persistGenerationState();
  renderModelControls();
}
modelSelect.addEventListener("change", () => setModel(modelSelect.value));
styleSelect.addEventListener("change", () => {
  const capabilities = modelCapabilities();
  if (!capabilities.datasetModes.includes(styleSelect.value)) {
    renderModelControls();
    return;
  }
  generationState.datasetMode = styleSelect.value;
  persistGenerationState();
  syncExperimentIfActive();
});
qualityPresetSelect.addEventListener("change", () => {
  const capabilities = modelCapabilities();
  generationState.qualityPreset = capabilities.qualityPresets.includes(qualityPresetSelect.value) ? qualityPresetSelect.value : capabilities.qualityPresets[0];
  persistGenerationState();
  renderPromptControls(capabilities);
  syncExperimentIfActive();
});
ucPresetSelect.addEventListener("change", () => {
  const capabilities = modelCapabilities();
  generationState.ucPreset = capabilities.ucPresets.includes(ucPresetSelect.value) ? ucPresetSelect.value : capabilities.ucPresets[0];
  persistGenerationState();
  renderPromptControls(capabilities);
  syncExperimentIfActive();
});
function toggleAiDrawer(open) {
  aiSettingsDrawer.classList.toggle("on", open);
  paramSummary.style.display = open ? "none" : "grid";
}
openAiSettingsBtn.onclick = event => { event.stopPropagation(); toggleAiDrawer(true); };
paramSummary.onclick = () => toggleAiDrawer(true);
closeAiSettingsBtn.onclick = () => toggleAiDrawer(false);

function bindPair(key, input, range, summary, normalize, format) {
  const setValue = raw => {
    const value = normalize(raw);
    generationState[key] = value;
    const shown = format(value);
    input.value = shown;
    range.value = String(value);
    summary.textContent = shown;
    syncExperimentIfActive();
  };
  input.oninput = () => { setValue(input.value); scheduleGenerationPersist(); };
  range.oninput = () => { setValue(range.value); scheduleGenerationPersist(); };
  setValue(generationState[key]);
  return setValue;
}
const setSteps = bindPair("steps", inpSteps, rangeSteps, sumSteps,
  value => Math.max(1, Math.min(50, Math.round(Number(value) || 1))),
  value => String(value));
const setGuidance = bindPair("guidance", inpGuidance, rangeGuidance, sumGuidance,
  value => Math.max(1, Math.min(20, Number(value) || 1)),
  value => value.toFixed(1));
const formatRescale = value => value.toFixed(2).replace(/0$/, "");
const setRescale = bindPair("rescale", inpRescale, rangeRescale, sumRescale,
  value => Math.max(0, Math.min(1, Number(value) || 0)),
  formatRescale);

selSampler.onchange = () => {
  generationState.sampler = selSampler.value;
  sumSampler.textContent = generationState.sampler;
  persistGenerationState();
  syncExperimentIfActive();
};
selNoise.onchange = () => {
  generationState.noiseSchedule = selNoise.value;
  persistGenerationState();
  syncExperimentIfActive();
};

document.getElementById("btnVariety").onclick = event => {
  const button = event.currentTarget;
  generationState.variety = !generationState.variety;
  persistGenerationState();
  button.classList.toggle("on", generationState.variety);
  button.textContent = (generationState.variety ? "✔" : "✖") + " Variety+";
};

function paintUiSeed() {
  if (document.activeElement !== seedInput) {
    seedInput.value = String(generationState.seed);
    seedInput.removeAttribute("aria-invalid");
  }
  seedSummary.textContent = (generationState.seedLocked ? "🔒 " : "📌 ") + generationState.seed;
  seedLockBtn.textContent = generationState.seedLocked ? "🔒" : "🔓";
  seedLockBtn.title = generationState.seedLocked ? "Seed 고정 해제 · 연속 생성에서는 첫 Seed만 고정됩니다" : "현재 Seed 고정 · 연속 생성에서는 첫 Seed를 고정합니다";
  seedLockBtn.setAttribute("aria-pressed", String(generationState.seedLocked));
  seedLockBtn.setAttribute("aria-label", seedLockBtn.title);
}
seedInput.oninput = () => {
  const raw = seedInput.value.trim();
  const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
  const valid = Number.isSafeInteger(value) && value >= 0 && value <= 4294967295;
  seedInput.setAttribute("aria-invalid", String(!valid));
  if (!valid) return;
  generationState.seed = value;
  generationState.seedLocked = true;
  scheduleGenerationPersist();
  paintUiSeed();
};
seedInput.addEventListener("blur", paintUiSeed);
seedLockBtn.onclick = () => {
  generationState.seedLocked = !generationState.seedLocked;
  persistGenerationState();
  paintUiSeed();
};
seedRandomBtn.onclick = () => {
  generationState.seed = Math.floor(Math.random() * 4294967296);
  generationState.seedLocked = true;
  persistGenerationState();
  paintUiSeed();
};
const addCharBtn = document.getElementById("addCharBtn");
const characterList = document.getElementById("characterList");
const characterById = id => generationState.characters.find(character => character.id === id) || null;
const characterIndex = id => generationState.characters.findIndex(character => character.id === id);
const characterAllowedAt = index => index >= 0 && index < modelCapabilities().maxCharacters;
function setCharacterTab(id, name) {
  const character = characterById(id);
  if (!character || !["prompt", "undesired"].includes(name))
    return false;
  character.activeTab = name;
  persistGenerationState();
  renderCharacters();
  return true;
}
function setCharacterField(id, field, value) {
  const character = characterById(id);
  if (!character || !["prompt", "undesired"].includes(field))
    return false;
  character[field] = String(value);
  scheduleGenerationPersist();
  return true;
}
function addCharacter() {
  if (generationState.characters.length >= modelCapabilities().maxCharacters)
    return null;
  const character = makeCharacterState();
  generationState.characters.push(character);
  persistGenerationState();
  renderCharacters(character.id);
  return character;
}
function removeCharacter(id) {
  const index = characterIndex(id);
  if (index < 0)
    return false;
  if (!confirm(`Character ${index + 1}의 Prompt, Undesired Content, Position을 삭제할까요?`))
    return false;
  generationState.characters.splice(index, 1);
  persistGenerationState();
  renderCharacters();
  return true;
}
function moveCharacter(id, direction) {
  const index = characterIndex(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= generationState.characters.length) return false;
  [generationState.characters[index], generationState.characters[target]] = [generationState.characters[target], generationState.characters[index]];
  persistGenerationState();
  renderCharacters();
  return true;
}
function moveCharacterTo(id, targetIndex) {
  const index = characterIndex(id);
  if (index < 0) return false;
  const [character] = generationState.characters.splice(index, 1);
  generationState.characters.splice(Math.max(0, Math.min(generationState.characters.length, targetIndex)), 0, character);
  persistGenerationState();
  renderCharacters();
  return true;
}
function toggleCharacter(id) {
  const index = characterIndex(id);
  if (!characterAllowedAt(index))
    return false;
  const character = generationState.characters[index];
  character.enabled = !character.enabled;
  persistGenerationState();
  renderCharacters();
  return character.enabled;
}
function toggleCharacterCollapsed(id) {
  const character = characterById(id);
  if (!character)
    return false;
  character.collapsed = !character.collapsed;
  persistGenerationState();
  renderCharacters();
  return character.collapsed;
}
function createCharacterCard(character, index) {
  const modelAllowed = characterAllowedAt(index);
  const card = document.createElement("div");
  card.className = "char-card";
  card.dataset.characterCard = "";
  card.dataset.characterId = character.id;
  card.classList.toggle("collapsed", character.collapsed);
  card.classList.toggle("inactive", !character.enabled);
  card.classList.toggle("model-incompatible", !modelAllowed);
  card.innerHTML = `<div class="char-head"><span class="char-name"></span>${modelAllowed ? "" : `<span class="char-cap-note">모델 한도 초과</span>`}<div class="char-acts">` +
    `<button class="char-act-btn" data-char-action="collapse" title="접기/펼치기">${character.collapsed ? "▼" : "▲"}</button>` +
    `<button class="char-act-btn" data-char-action="toggle" title="활성화/비활성화">${character.enabled ? "✓" : "○"}</button>` +
    `<button class="char-act-btn" data-char-action="up" title="위로 이동" ${index === 0 ? "disabled" : ""}>↑</button>` +
    `<button class="char-act-btn" data-char-action="down" title="아래로 이동" ${index === generationState.characters.length - 1 ? "disabled" : ""}>↓</button>` +
    `<button class="char-act-btn char-drag" draggable="true" data-char-drag title="끌어서 순서 변경">⠿</button>` +
    `<button class="char-act-btn" data-char-action="delete" title="삭제">🗑</button></div></div>` +
    `<div class="tabs char-tabs"><button class="tab" data-char-tab="prompt">Prompt</button><button class="tab" data-char-tab="undesired">Undesired Content</button></div>` +
    `<textarea class="char-pt" data-char-pane="prompt" placeholder="Character tags"></textarea>` +
    `<textarea class="char-pt" data-char-pane="undesired" placeholder="Undesired character tags"></textarea>`;
  card.querySelector(".char-name").textContent = `♀ Character ${index + 1}`;
  const prompt = card.querySelector('[data-char-pane="prompt"]');
  const undesired = card.querySelector('[data-char-pane="undesired"]');
  prompt.value = character.prompt;
  undesired.value = character.undesired;
  prompt.disabled = !character.enabled || !modelAllowed;
  undesired.disabled = !character.enabled || !modelAllowed;
  card.querySelectorAll("[data-char-tab]").forEach(button =>
    button.classList.toggle("on", button.dataset.charTab === character.activeTab));
  card.querySelectorAll("[data-char-pane]").forEach(pane =>
    pane.classList.toggle("on", pane.dataset.charPane === character.activeTab));
  const toggle = card.querySelector('[data-char-action="toggle"]');
  toggle.disabled = !modelAllowed;
  if (!modelAllowed)
    toggle.title = "현재 모델의 Character 한도를 초과했습니다.";
  return card;
}
function renderCharacters(focusId = null) {
  const limit = modelCapabilities().maxCharacters;
  characterList.replaceChildren(...generationState.characters.map(createCharacterCard));
  document.getElementById("charLimit").textContent = `${generationState.characters.length} / ${limit}`;
  addCharBtn.disabled = generationState.characters.length >= limit;
  addCharBtn.title = addCharBtn.disabled ? `현재 모델은 Character를 최대 ${limit}명까지 지원합니다.` : "캐릭터 추가";
  if (focusId)
    characterList.querySelector(`[data-character-id="${focusId}"] [data-char-pane="prompt"]:not(:disabled)`)?.focus();
}
addCharBtn.onclick = addCharacter;
characterList.addEventListener("input", event => {
  const pane = event.target.closest("[data-char-pane]");
  const card = pane?.closest(".char-card");
  if (pane && card)
    setCharacterField(card.dataset.characterId, pane.dataset.charPane, pane.value);
});
characterList.addEventListener("click", event => {
  const card = event.target.closest(".char-card");
  if (!card)
    return;
  const id = card.dataset.characterId;
  const tabButton = event.target.closest("[data-char-tab]");
  if (tabButton) {
    setCharacterTab(id, tabButton.dataset.charTab);
    return;
  }
  const actionButton = event.target.closest("[data-char-action]");
  if (!actionButton)
    return;
  const action = actionButton.dataset.charAction;
  if (action === "collapse")
    toggleCharacterCollapsed(id);
  else if (action === "toggle")
    toggleCharacter(id);
  else if (action === "delete") removeCharacter(id);
  else if (action === "up") moveCharacter(id, -1);
  else if (action === "down") moveCharacter(id, 1);
});
let draggedCharacterId = null;
characterList.addEventListener("dragstart", event => {
  const handle = event.target.closest("[data-char-drag]");
  const card = handle?.closest(".char-card");
  if (!card) return;
  draggedCharacterId = card.dataset.characterId;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});
characterList.addEventListener("dragover", event => {
  if (!draggedCharacterId) return;
  const card = event.target.closest(".char-card");
  if (!card || card.dataset.characterId === draggedCharacterId) return;
  event.preventDefault();
  characterList.querySelectorAll(".drop-before,.drop-after").forEach(element => element.classList.remove("drop-before", "drop-after"));
  const after = event.clientY > card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2;
  card.classList.add(after ? "drop-after" : "drop-before");
});
characterList.addEventListener("drop", event => {
  const card = event.target.closest(".char-card");
  if (!card || !draggedCharacterId) return;
  event.preventDefault();
  const targetIndex = characterIndex(card.dataset.characterId) + (event.clientY > card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2 ? 1 : 0);
  moveCharacterTo(draggedCharacterId, targetIndex > characterIndex(draggedCharacterId) ? targetIndex - 1 : targetIndex);
});
characterList.addEventListener("dragend", () => {
  draggedCharacterId = null;
  characterList.querySelectorAll(".dragging,.drop-before,.drop-after").forEach(element => element.classList.remove("dragging", "drop-before", "drop-after"));
});

const baseImageControls = document.getElementById("baseImageControls");
const vibeList = document.getElementById("vibeList");
const preciseList = document.getElementById("preciseList");
const assetPreviewUrls = new Map();
const assetHasFile = asset => !!asset?.file;
const allGenerationAssets = () => [generationState.baseImage, ...generationState.vibes, ...generationState.preciseReferences];
const featureSupported = (kind, state = generationState) => {
  const capabilities = capabilitiesForState(state);
  if (kind === "base") return capabilities.baseImage;
  if (kind === "vibe") return capabilities.vibeTransfer;
  if (kind === "precise") return capabilities.preciseReference;
  return false;
};
const hasVibeAsset = state => state.vibes.some(assetHasFile);
const hasPreciseAsset = state => state.preciseReferences.some(assetHasFile);
function featureConflict(kind, state = generationState) {
  if (kind === "vibe" && hasPreciseAsset(state)) return "Precise Reference와 함께 사용할 수 없습니다.";
  if (kind === "precise" && hasVibeAsset(state)) return "Vibe Transfer와 함께 사용할 수 없습니다.";
  return "";
}
function assetPreviewUrl(asset) {
  if (!assetHasFile(asset)) return "";
  const cached = assetPreviewUrls.get(asset.id);
  if (cached?.file === asset.file) return cached.url;
  if (cached?.url) URL.revokeObjectURL(cached.url);
  const url = URL.createObjectURL(asset.file);
  assetPreviewUrls.set(asset.id, { file: asset.file, url });
  return url;
}
function releaseAssetPreview(id) {
  const cached = assetPreviewUrls.get(id);
  if (cached?.url) URL.revokeObjectURL(cached.url);
  assetPreviewUrls.delete(id);
}
const REFERENCE_ASSET_DB = "tag-lab-reference-assets";
const REFERENCE_ASSET_STORE = "assets";
const persistReferenceAsset = (assetKey, file) => assetKey && file instanceof Blob
  ? putIndexedDbValue(REFERENCE_ASSET_DB, REFERENCE_ASSET_STORE, assetKey, file) : Promise.resolve(null);
const loadReferenceAsset = assetKey => assetKey
  ? getIndexedDbValue(REFERENCE_ASSET_DB, REFERENCE_ASSET_STORE, assetKey) : Promise.resolve(null);
const deleteReferenceAsset = assetKey => assetKey
  ? deleteIndexedDbValue(REFERENCE_ASSET_DB, REFERENCE_ASSET_STORE, assetKey) : Promise.resolve();
async function hydrateStoredReferenceAssets() {
  let changed = false;
  for (const asset of allGenerationAssets()) {
    if (!asset.assetKey || asset.file) continue;
    try {
      const file = await loadReferenceAsset(asset.assetKey);
      if (file instanceof Blob) {
        asset.file = file instanceof File ? file : new File([file], asset.fileName || `${asset.id}.png`, { type: asset.mime || file.type || "image/png" });
        changed = true;
      }
    }
    catch { }
  }
  if (changed) renderGenerationInputs();
}
function makeAssetKey(kind, id) {
  return `ref-${kind}-${id}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
}
async function setAssetFile(asset, kind, file) {
  if (!asset || !file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) return false;
  if (!featureSupported(kind) || featureConflict(kind)) return false;
  const previousKey = asset.assetKey;
  releaseAssetPreview(asset.id);
  asset.file = file;
  asset.assetKey = makeAssetKey(kind, asset.id);
  asset.fileName = file.name || "";
  asset.mime = file.type || "";
  asset.size = Number(file.size) || 0;
  void persistReferenceAsset(asset.assetKey, file)
    .then(() => previousKey && previousKey !== asset.assetKey ? deleteReferenceAsset(previousKey) : null)
    .catch(() => {});
  persistGenerationState();
  renderGenerationInputs();
  return true;
}
function clearAsset(asset) {
  if (!asset) return false;
  if (!confirm("Base Image와 Strength/Noise 설정을 제거할까요?")) return false;
  const assetKey = asset.assetKey;
  releaseAssetPreview(asset.id);
  Object.assign(asset, emptyAsset());
  void deleteReferenceAsset(assetKey).catch(() => {});
  persistGenerationState();
  renderGenerationInputs();
  return true;
}
function assetControl(label, kind, id, field, value, allowNegative = false) {
  const number = Number(value);
  const rangeValue = Math.max(0, Math.min(1, number));
  return `<div class="asset-control"><label>${label}</label><input type="range" min="0" max="1" step="0.01" value="${rangeValue.toFixed(2)}" data-asset-kind="${kind}" data-asset-id="${id}" data-asset-field="${field}"><input type="number" ${allowNegative ? "" : 'min="0" '}max="1" step="0.01" value="${number.toFixed(2)}" data-asset-kind="${kind}" data-asset-id="${id}" data-asset-field="${field}"></div>`;
}
function assetById(kind, id) {
  if (kind === "base") return generationState.baseImage.id === id ? generationState.baseImage : null;
  const list = kind === "vibe" ? generationState.vibes : generationState.preciseReferences;
  return list.find(item => item.id === id) || null;
}
function setAssetField(kind, id, field, value) {
  const asset = assetById(kind, id);
  if (!asset || !featureSupported(kind) || featureConflict(kind)) return false;
  if (kind === "precise" && field === "referenceType") {
    if (!["character", "style", "character-style"].includes(value)) return false;
    asset.referenceType = value;
    persistGenerationState();
    return true;
  }
  const allowed = kind === "base" ? ["strength", "noise"] : kind === "vibe" ? ["strength", "informationExtracted"] : ["strength", "fidelity"];
  if (!allowed.includes(field)) return false;
  const number = Number(value);
  if (!Number.isFinite(number)) return false;
  asset[field] = kind === "precise" ? Math.min(1, number) : Math.max(0, Math.min(1, number));
  scheduleGenerationPersist();
  return true;
}
function assetCard(asset, kind) {
  const hasFile = assetHasFile(asset);
  const imageId = `${kind}:${asset.id}`;
  const preview = hasFile ? assetPreviewUrl(asset) : "";
  const title = kind === "base" ? "Base Image" : kind === "vibe" ? "Vibe" : "Precise Reference";
  if (hasFile) registerImageObject(imageId, { source: kind, label: title, caption: `${title} · ${asset.fileName || "이미지"}`, src: preview, file: asset.file || null, fileName: asset.fileName || `${asset.id}.png`, meta: { kind, id: asset.id } });
  const controls = !hasFile ? "" : kind === "base"
    ? assetControl("Strength", kind, asset.id, "strength", asset.strength) + assetControl("Noise", kind, asset.id, "noise", asset.noise)
    : kind === "vibe"
      ? assetControl("Reference Strength", kind, asset.id, "strength", asset.strength) + assetControl("Information Extracted", kind, asset.id, "informationExtracted", asset.informationExtracted)
      : `<div class="asset-control"><label>Reference Type</label><select data-asset-kind="precise" data-asset-id="${asset.id}" data-asset-field="referenceType"><option value="character">Image Character Reference</option><option value="style">Image Style Reference</option><option value="character-style">Image Character & Style Reference</option></select></div>` + assetControl("Strength", kind, asset.id, "strength", asset.strength, true) + assetControl("Fidelity", kind, asset.id, "fidelity", asset.fidelity, true);
  const html = `<div class="asset-card" data-asset-card data-asset-kind="${kind}" data-asset-id="${asset.id}"><div class="asset-main">${hasFile ? `<img class="asset-thumb image-object" data-image-id="${imageId}" src="${preview}" alt="">` : ""}<div class="asset-info"><div class="asset-name">${esc(asset.fileName || title)}</div><div class="asset-sub">${hasFile ? esc(asset.mime || "image") : "이미지 없음"}</div></div><div class="asset-actions"><button class="nai-icon-btn" data-asset-action="upload" title="${hasFile ? "교체" : "추가"}">⍗</button><button class="nai-icon-btn" data-asset-action="remove" title="제거">×</button></div><input class="asset-file-input" type="file" accept="image/png,image/jpeg,image/webp" data-asset-file></div>${controls ? `<div class="asset-controls">${controls}</div>` : ""}</div>`;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const card = wrapper.firstElementChild;
  if (kind === "precise" && hasFile) card.querySelector('select[data-asset-field="referenceType"]').value = asset.referenceType;
  if (!featureSupported(kind) || featureConflict(kind)) {
    card.querySelectorAll('[data-asset-field],[data-asset-action="upload"],[data-asset-file]').forEach(control => control.disabled = true);
  }
  return card;
}
function syncFeatureSection(sectionId, statusId, addId, kind) {
  const supported = featureSupported(kind);
  const conflict = featureConflict(kind);
  const section = document.getElementById(sectionId);
  const status = document.getElementById(statusId);
  const add = document.getElementById(addId);
  section.classList.toggle("feature-disabled", !supported);
  status.classList.toggle("unsupported", !supported);
  status.textContent = !supported ? "현재 모델 미지원" : conflict || "";
  add.disabled = !supported || !!conflict;
}
function renderBaseImage() {
  syncFeatureSection("baseImageSection", "baseImageStatus", "baseImageAdd", "base");
  baseImageControls.replaceChildren(assetHasFile(generationState.baseImage) ? assetCard(generationState.baseImage, "base") : (() => { const empty = document.createElement("div"); empty.className = "asset-empty"; empty.textContent = "Base Image 없음"; return empty; })());
}
function renderVibes() {
  syncFeatureSection("vibeSection", "vibeStatus", "vibeAdd", "vibe");
  vibeList.replaceChildren(...generationState.vibes.map(vibe => assetCard(vibe, "vibe")));
  if (!generationState.vibes.length) { const empty = document.createElement("div"); empty.className = "asset-empty"; empty.textContent = "Vibe 없음"; vibeList.appendChild(empty); }
}
function renderPreciseReferences() {
  syncFeatureSection("preciseSection", "preciseStatus", "preciseAdd", "precise");
  preciseList.replaceChildren(...generationState.preciseReferences.map(reference => assetCard(reference, "precise")));
  if (!generationState.preciseReferences.length) { const empty = document.createElement("div"); empty.className = "asset-empty"; empty.textContent = "Precise Reference 없음"; preciseList.appendChild(empty); }
}
function renderGenerationInputs() {
  renderBaseImage();
  renderVibes();
  renderPreciseReferences();
  syncImageSelectionState();
}
function addCollectionAsset(kind) {
  if (!featureSupported(kind) || featureConflict(kind)) return null;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const list = kind === "vibe" ? generationState.vibes : generationState.preciseReferences;
    const prefix = kind === "vibe" ? "vibe" : "precise";
    let number = 1;
    while (list.some(item => item.id === `${prefix}-${number}`)) number++;
    const asset = kind === "vibe" ? normalizeVibe({ id: `${prefix}-${number}` }, list.length) : normalizePrecise({ id: `${prefix}-${number}` }, list.length);
    list.push(asset);
    if (!(await setAssetFile(asset, kind, file))) {
      const index = list.indexOf(asset);
      if (index >= 0) list.splice(index, 1);
      renderGenerationInputs();
    }
  };
  input.click();
  return input;
}
function removeCollectionAsset(kind, id) {
  const list = kind === "vibe" ? generationState.vibes : generationState.preciseReferences;
  const index = list.findIndex(item => item.id === id);
  if (index < 0) return false;
  const label = kind === "vibe" ? "Vibe" : "Precise Reference";
  if (!confirm(`${label}와 세부 설정을 제거할까요?`)) return false;
  const [asset] = list.splice(index, 1);
  releaseAssetPreview(asset.id);
  void deleteReferenceAsset(asset.assetKey).catch(() => {});
  persistGenerationState();
  renderGenerationInputs();
  return true;
}
document.getElementById("baseImageAdd").onclick = () => {
  if (!featureSupported("base")) return;
  if (!assetHasFile(generationState.baseImage)) {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = () => { const file = input.files?.[0]; if (file) void setAssetFile(generationState.baseImage, "base", file); };
    input.click();
  }
  else baseImageControls.querySelector("[data-asset-file]")?.click();
};
document.getElementById("vibeAdd").onclick = () => addCollectionAsset("vibe");
document.getElementById("preciseAdd").onclick = () => addCollectionAsset("precise");
for (const host of [baseImageControls, vibeList, preciseList]) {
  host.addEventListener("click", event => {
    const card = event.target.closest("[data-asset-card]");
    const action = event.target.closest("[data-asset-action]")?.dataset.assetAction;
    if (!card || !action) return;
    const kind = card.dataset.assetKind, id = card.dataset.assetId, asset = assetById(kind, id);
    if (action === "upload") card.querySelector("[data-asset-file]")?.click();
    else if (action === "remove") kind === "base" ? clearAsset(asset) : removeCollectionAsset(kind, id);
  });
  host.addEventListener("change", event => {
    const card = event.target.closest("[data-asset-card]");
    if (!card) return;
    const kind = card.dataset.assetKind, id = card.dataset.assetId, asset = assetById(kind, id);
    if (event.target.matches("[data-asset-file]")) { const file = event.target.files?.[0]; if (file) void setAssetFile(asset, kind, file); return; }
    const control = event.target.closest("[data-asset-field]");
    if (control && setAssetField(kind, id, control.dataset.assetField, control.value)) renderGenerationInputs();
  });
  host.addEventListener("input", event => {
    const card = event.target.closest("[data-asset-card]");
    const control = event.target.closest('input[data-asset-field]');
    if (!card || !control) return;
    const kind = card.dataset.assetKind, id = card.dataset.assetId;
    if (setAssetField(kind, id, control.dataset.assetField, control.value)) {
      card.querySelectorAll(`[data-asset-field="${control.dataset.assetField}"]`).forEach(peer => { if (peer !== control) peer.value = control.value; });
    }
  });
}
document.getElementById("transparentBgToggle").onclick = () => {
  if (!modelCapabilities().transparentBackground)
    return;
  generationState.transparentBackground = !generationState.transparentBackground;
  persistGenerationState();
  renderModelControls();
};

function setResolution(ratio, label, active) {
  const [width, height] = ratio.split("/").map(Number);
  generationState.resolution = { ratio, label, width, height };
  persistGenerationState();
  [resLand, resPort, resSq].forEach(button => button.classList.remove("on"));
  active.classList.add("on");
  resDisplay.textContent = generationState.resolution.label;
  mainResolution.textContent = generationState.resolution.label;
  root.style.setProperty("--shot", generationState.resolution.ratio);
  syncExperimentIfActive();
}
resLand.onclick = () => setResolution("1216/832", "1216 × 832", resLand);
resPort.onclick = () => setResolution("832/1216", "832 × 1216", resPort);
resSq.onclick = () => setResolution("1024/1024", "1024 × 1024", resSq);

const continuousCount = document.getElementById("continuousCount");
const continuousSeedMode = document.getElementById("continuousSeedMode");
const continuousDelay = document.getElementById("continuousDelay");
function renderContinuousGeneration() {
  continuousCount.value = String(generationOrchestration.count);
  continuousSeedMode.value = generationOrchestration.seedMode;
  continuousDelay.value = String(generationOrchestration.delaySeconds);
  continuousSeedMode.disabled = generationOrchestration.count <= 1;
  continuousDelay.disabled = generationOrchestration.count <= 1;
  genRunLabel.textContent = generationOrchestration.count > 1 ? `Generate ×${generationOrchestration.count}` : "Generate 1 Image";
}
continuousCount.addEventListener("change", () => {
  generationOrchestration.count = Math.max(1, Math.min(MAX_CONTINUOUS_GENERATIONS, Math.trunc(Number(continuousCount.value) || 1)));
  persistGenerationState();
  renderContinuousGeneration();
});
continuousSeedMode.addEventListener("change", () => {
  if (!["increment", "decrement", "random"].includes(continuousSeedMode.value)) return;
  generationOrchestration.seedMode = continuousSeedMode.value;
  persistGenerationState();
});
continuousDelay.addEventListener("change", () => {
  generationOrchestration.delaySeconds = Math.max(0, Number(continuousDelay.value) || 0);
  persistGenerationState();
  renderContinuousGeneration();
});
document.getElementById("resetAiSettings").onclick = () => {
  setSteps(28);
  setGuidance(8);
  setRescale(.5);
  selSampler.selectedIndex = 0;
  generationState.sampler = selSampler.value;
  sumSampler.textContent = generationState.sampler;
  selNoise.selectedIndex = 0;
  generationState.noiseSchedule = selNoise.value;
  generationState.variety = false;
  document.getElementById("btnVariety").classList.remove("on");
  document.getElementById("btnVariety").textContent = "✖ Variety+";
  persistGenerationState();
};

function syncSidebarExperiment() {
  const tuning = document.body.classList.contains("chunkTune");
  const payload = experimentSnapshot?.payload || buildNovelAIPayload({ source: "lock-preview" });
  const dataset = payload.datasetMode && payload.datasetMode !== "Anime" ? " · " + payload.datasetMode : "";
  const seed = selectedSeed ? shortName(selectedSeed) : "—";
  const stage = tuning ? "가중치 조율" : competitionStageLabel();
  const progress = tuning ? "" : ` · ${competition.matches.length}/${TOTAL_MATCHES}`;
  document.getElementById("competitionRun").innerHTML = `<b>${esc(seed)}</b> · ${esc(stage)}${progress}`;
  document.getElementById("lockConditionPrimary").innerHTML = `<b>${esc(payload.model + dataset)}</b> · ${esc(payload.resolution.label)} · ${payload.steps}/${Number(payload.guidance).toFixed(1)} · R${esc(formatRescale(payload.rescale))}`;
  document.getElementById("lockConditionSecondary").textContent = payload.sampler + " · " + payload.noiseSchedule;
}

const hues = new Map();
let hueN = 0;
const colorOf = name => {
    if (!hues.has(name))
        hues.set(name, Math.round((hueN++ * 137.508) % 360));
    return `hsl(${hues.get(name)} 62% 62%)`;
};
const fmt = v => String(Math.round(v * 100) / 100);
const isArtist = n => /^artist:/i.test(n);
const shortName = n => n.replace(/^artist:/i, "");
const esc = s => String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
function hydrateGenerationUi() {
  renderModelControls();
  selSampler.value = generationState.sampler;
  sumSampler.textContent = generationState.sampler;
  selNoise.value = generationState.noiseSchedule;
  const variety = document.getElementById("btnVariety");
  variety.classList.toggle("on", generationState.variety);
  variety.textContent = (generationState.variety ? "✔" : "✖") + " Variety+";
  paintUiSeed();
  renderResolutionFromState();
  renderContinuousGeneration();
  void hydrateStoredReferenceAssets();
}
hydrateGenerationUi();

function registerImageObject(id, descriptor = {}, element = null) {
  const key = String(id);
  const current = imageObjects.get(key) || {};
  const object = { ...current, ...descriptor, id: key };
  imageObjects.set(key, object);
  if (element)
    bindImageElement(element, key);
  return object;
}
function bindImageElement(element, imageId) {
  if (!element)
    return null;
  element.dataset.imageId = String(imageId);
  element.classList.add("image-object");
  return element;
}
function imageObjectFromTarget(target) {
  const element = target instanceof Element ? target.closest("[data-image-id]") : null;
  if (!element)
    return null;
  return imageObjects.get(element.dataset.imageId) || null;
}
function imageObjectCaption(object) {
  if (!object)
    return "";
  if (object.caption)
    return String(object.caption);
  return String(object.label || object.fileName || object.source || "이미지");
}
function imageObjectFileName(object) {
  if (object?.fileName)
    return object.fileName;
  const raw = String(object?.src || "").split(/[?#]/)[0];
  const tail = raw.split("/").pop();
  if (tail && /\.[a-z0-9]{2,5}$/i.test(tail))
    return tail;
  return String(object?.label || object?.source || "tag-lab-image").replace(/[\\/:*?"<>|]+/g, "_") + ".png";
}
async function imageObjectBlob(object) {
  if (object?.file instanceof Blob)
    return object.file;
  if (object?.blob instanceof Blob)
    return object.blob;
  if (!object?.src)
    throw new Error("이미지 원본을 찾을 수 없습니다.");
  const response = await fetch(object.src);
  if (!response.ok)
    throw new Error("이미지 원본을 읽지 못했습니다.");
  return response.blob();
}
async function imageObjectPngBlob(object) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(await imageObjectBlob(object));
  }
  catch {
    const image = new Image();
    image.src = object.src;
    await image.decode();
    bitmap = await createImageBitmap(image);
  }
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("이미지를 복사할 수 없습니다.")), "image/png"));
}
async function copyImageObject(object) {
  if (!navigator.clipboard?.write || typeof ClipboardItem !== "function")
    throw new Error("이 브라우저에서는 이미지 복사를 사용할 수 없습니다.");
  let blob;
  try {
    blob = await imageObjectBlob(object);
  }
  catch {
    blob = await imageObjectPngBlob(object);
  }
  const supported = typeof ClipboardItem.supports === "function" ? ClipboardItem.supports(blob.type) : blob.type === "image/png";
  if (!supported)
    blob = await imageObjectPngBlob({ ...object, blob });
  await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
}
async function saveImageObject(object) {
  let href = object?.src || "";
  let revoke = false;
  try {
    const blob = await imageObjectBlob(object);
    href = URL.createObjectURL(blob);
    revoke = true;
  }
  catch {
    if (!href)
      throw new Error("이미지 원본을 저장할 수 없습니다.");
  }
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = imageObjectFileName(object);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (revoke)
    setTimeout(() => URL.revokeObjectURL(href), 1000);
}
function parseCore(core) {
    const m = /^(-?\d+(?:\.\d+)?)\s*::\s*([\s\S]+?)\s*::$/.exec(core);
    return m ? { w: parseFloat(m[1]), name: m[2] } : { w: 1, name: core };
}
function tokenize(text) {
    const out = [];
    let start = 0;
    for (let i = 0; i <= text.length; i++) {
        if (i < text.length && text[i] !== ",")
            continue;
        const body = text.slice(start, i);
        let sep = "";
        if (i < text.length) {
            let j = i + 1;
            while (j < text.length && /\s/.test(text[j]))
                j++;
            sep = text.slice(i, j);
            i = j - 1;
            start = j;
        }
        const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(body);
        out.push({ pre: m[1], post: m[3], sep, ...parseCore(m[2]) });
        if (!sep)
            break;
    }
    return out;
}
const tokenText = t => t.w === 1 ? t.name : `${fmt(t.w)}::${t.name}::`;
function syncText(refreshMirror = true) {
    const s = pt.selectionStart;
    pt.value = toks.map(t => t.pre + tokenText(t) + t.post + t.sep).join("");
    try {
        pt.selectionStart = pt.selectionEnd = Math.min(s, pt.value.length);
    }
    catch { }
    if (refreshMirror)
        paintMirror();
}
function paintMirror() {
    const slot = new Map();
    ai.forEach((ti, k) => slot.set(ti, k));
    let html = "";
    toks.forEach((t, i) => {
        const k = slot.get(i), body = esc(tokenText(t));
        html += esc(t.pre)
            + (k === undefined ? body
                : `<span class="tk" data-k="${k}" style="color:${colorOf(t.name)}">${body}</span>`)
            + esc(t.post) + esc(t.sep);
    });
    mirror.innerHTML = html + "\n";
    mirror.scrollTop = pt.scrollTop;
}
pt.addEventListener("scroll", () => { mirror.scrollTop = pt.scrollTop; });
const HARD = 10;
let allowNegative = S.allowNegative === true;
const floorW = () => allowNegative ? -HARD : 0;
let LO = -0.5, HI = 1.5;
function fitAxis(growOnly) {
    let mx = 1, mn = 0;
    ai.map(i => toks[i].w).forEach(w => { if (w > mx)
        mx = w; if (w < mn)
        mn = w; });
    const pad = Math.max((mx - mn) * 0.12, 0.25);
    let hi = Math.min(HARD, Math.ceil((mx + pad) * 2) / 2), lo = Math.max(-HARD, Math.floor((mn - pad) * 2) / 2);
    if (growOnly) {
        hi = Math.max(hi, HI);
        lo = Math.min(lo, LO);
    }
    HI = hi;
    LO = lo;
}
const pctOf = v => (v - LO) / (HI - LO) * 100;
let toks = [], ai = [], onlyArtist = S.onlyArtist !== false, selectedSeed = S.seedArtist || null;
const combo = document.getElementById("combo"), bars = document.getElementById("bars"), ticks = document.getElementById("ticks"), names = document.getElementById("names"), sortKey = document.getElementById("sortKey"), sortDir = document.getElementById("sortDir");
sortKey.value = S.sortKey || "prompt";
sortDir.value = S.sortDir || "asc";
// 작가 카탈로그. v18.1의 실측 데이터와 alias/shot index를 복원한다.
const { dan: DAN_RAW, alias: ALIAS, images: IMAGES } = artistCatalogData;
const cacheDir = "../resource/catalog/images/";
const midUrl = entry => cacheDir + entry.split(".")[0] + ".m.jpg";
const fullUrl = entry => { const [hash, , ext] = entry.split("."); return cacheDir + hash + "." + ext; };
const tagOf = name => String(name).trim().toLowerCase().replace(/\s+/g, "_").replace(/_+/g, "_");
const spaced = tag => String(tag).replace(/_/g, " ");
const canonTag = name => { const tag = tagOf(shortName(name)); return ALIAS[tag] || tag; };
const canonName = name => spaced(canonTag(name));
const aliasOf = name => { const tag = tagOf(shortName(name)); return ALIAS[tag] ? spaced(tag) : null; };
const danOf = (name, field) => {
  const row = DAN_RAW[canonTag(name)];
  if (!row) return null;
  return field === "pop" ? row[0] : row[1];
};
const shotsOf = name => IMAGES[canonTag(name)] || null;
const sortVal = {
    prompt: i => i,
    weight: i => toks[i].w,
    pop: i => danOf(toks[i].name, "pop"),
    train: i => danOf(toks[i].name, "train"),
};
function cmp(a, b, d) {
    const A = a[1], B = b[1], an = A == null || Number.isNaN(A), bn = B == null || Number.isNaN(B);
    if (an && bn)
        return a[0] - b[0];
    if (an)
        return 1;
    if (bn)
        return -1;
    return (A - B) * d || a[0] - b[0];
}
function rebuild() {
    toks = tokenize(pt.value);
    ai = toks.map((t, i) => i).filter(i => toks[i].name && (!onlyArtist || isArtist(toks[i].name)));
    const artists = toks.filter(t => isArtist(t.name));
    if (selectedSeed && !artists.some(t => t.name.toLowerCase() === selectedSeed.toLowerCase())) {
        selectedSeed = null;
        save({ seedArtist: selectedSeed });
    }
    const f = sortVal[sortKey.value] || sortVal.prompt, d = sortDir.value === "desc" ? -1 : 1;
    ai = ai.map(i => [i, f(i)]).sort((a, b) => cmp(a, b, d)).map(x => x[0]);
    fitAxis(false);
    render();
}
function render() {
    combo.innerHTML = "";
    names.innerHTML = "";
    [...bars.querySelectorAll(".bar")].forEach(b => b.remove());
    const order = new Map();
    let no = 0;
    toks.forEach((t, i) => { if (isArtist(t.name))
        order.set(i, ++no); });
    ai.forEach((ti, k) => {
        const t = toks[ti], c = colorOf(t.name);
        const row = document.createElement("div");
        row.className = "arow" + (isArtist(t.name) ? "" : " plain");
        row.dataset.k = k;
        row.style.setProperty("--c", c);
        row.title = isArtist(t.name) ? "위아래로 끌어서 프롬프트 순서 변경" : "";
        const sk = sortKey.value, showMeta = (sk === "pop" || sk === "train");
        const mv = showMeta ? danOf(t.name, sk) : undefined;
        row.innerHTML = `<span class="dot"></span>` +
            `<span class="idx"></span><span class="nm"></span>` +
            (showMeta ? `<span class="meta"></span>` : "") +
            `<input class="w"><button class="x">×</button>`;
        row.querySelector(".idx").textContent = order.has(ti)
            ? String(order.get(ti)).padStart(2, "0") : "—";
        const nameCell = row.querySelector(".nm");
        nameCell.textContent = shortName(t.name);
        nameCell.title = t.name;
        if (showMeta) {
            const meta = row.querySelector(".meta");
            meta.title = sk === "pop" ? "Score 평균" : "Danbooru 장수";
            meta.textContent = mv == null ? "—" : String(mv);
        }
        row.querySelector(".w").value = t.w.toFixed(2);
        combo.appendChild(row);
        const b = document.createElement("div");
        b.className = "bar";
        b.dataset.k = k;
        b.title = t.name + " · 가로: 순서 / 세로: 가중치";
        b.style.setProperty("--c", c);
        b.innerHTML = `<span class="val"></span><span class="stem"></span>`;
        bars.appendChild(b);
        const n = document.createElement("span");
        n.textContent = shortName(t.name);
        n.title = t.name;
        n.dataset.k = k;
        n.style.setProperty("--c", c);
        names.appendChild(n);
    });
    paintMirror();
    paint();
    paintSeedSelection();
    renderSeedContext();
}
function paint() {
    const ZERO = pctOf(0), ONE = pctOf(1);
    let mx = -Infinity, mn = Infinity;
    ai.forEach(i => { const w = toks[i].w; if (w > mx)
        mx = w; if (w < mn)
        mn = w; });
    [...combo.children].forEach(row => {
        const t = toks[ai[row.dataset.k]], inp = row.querySelector(".w");
        if (document.activeElement !== inp)
            inp.value = t.w.toFixed(2);
        row.classList.toggle("neg", t.w < 0);
        row.classList.toggle("top", mx !== 1 && t.w === mx);
        row.classList.toggle("bot", mn !== 1 && t.w === mn);
    });
    [...bars.querySelectorAll(".bar")].forEach(b => {
        const v = toks[ai[b.dataset.k]].w;
        const p = pctOf(v), neg = v < 0;
        const stem = b.querySelector(".stem"), val = b.querySelector(".val");
        b.classList.toggle("neg", neg);
        b.classList.toggle("pos", !neg);
        stem.style.top = "auto";
        if (neg) {
            stem.style.bottom = p + "%";
            stem.style.height = (ZERO - p) + "%";
            val.style.bottom = "calc(" + p + "% - 14px)";
        }
        else {
            stem.style.bottom = ZERO + "%";
            stem.style.height = (p - ZERO) + "%";
            val.style.bottom = "calc(" + p + "% + 2px)";
        }
        val.textContent = fmt(v);
    });
    paintTicks();
    document.getElementById("wsum").textContent = ai.reduce((s, i) => s + toks[i].w, 0).toFixed(1);
    document.getElementById("wcnt").textContent = ai.length;
    const artistWeights = ai.filter(i => isArtist(toks[i].name)).map(i => toks[i].w);
    const vals = artistWeights;
    document.getElementById("infoLabel").textContent = "작가";
    document.getElementById("infoCount").textContent = vals.length;
    document.getElementById("infoMax").textContent = vals.length ? fmt(Math.max(...vals)) : "—";
    document.getElementById("infoMin").textContent = vals.length ? fmt(Math.min(...vals)) : "—";
}
function paintTicks() {
    ticks.innerHTML = "";
    for (let v = Math.ceil(LO * 2) / 2; v <= HI + .001; v += .5) {
        const line = document.createElement("div"), label = document.createElement("span");
        const p = pctOf(v);
        line.className = "tickline" + (v === 0 || v === 1 ? " major" : "");
        line.style.bottom = p + "%";
        label.className = "ticklabel";
        label.style.bottom = p + "%";
        label.textContent = v === 0 ? "0" : v.toFixed(1);
        ticks.append(line, label);
    }
}
function hi(k, on) {
    [combo.querySelector(`.arow[data-k="${k}"]`),
        bars.querySelector(`.bar[data-k="${k}"]`),
        names.querySelector(`span[data-k="${k}"]`),
        mirror.querySelector(`.tk[data-k="${k}"]`)]
        .forEach(el => el && el.classList.toggle("hi", on));
}
[combo, bars, names].forEach(host => {
    host.addEventListener("pointerover", e => { const el = e.target.closest("[data-k]"); if (el)
        hi(el.dataset.k, true); });
    host.addEventListener("pointerout", e => { const el = e.target.closest("[data-k]"); if (el)
        hi(el.dataset.k, false); });
});
const artistpeek = document.getElementById("artistpeek"), peekimg = document.getElementById("peekimg"), peekname = document.getElementById("peekname");
const peekSources = ["../resource/original.png", "../resource/test.png"];
let artistShotIndex = 0;
function setArtistLink(id, url) {
  const link = document.getElementById(id);
  link.href = url || "#";
  link.setAttribute("aria-disabled", url ? "false" : "true");
}
function clearArtistShots() {
  const hero = document.getElementById("artistHero");
  const tiles = document.getElementById("shotTiles");
  artistShotIndex = 0;
  hero.removeAttribute("src");
  hero.removeAttribute("data-image-id");
  hero.classList.remove("image-object");
  hero.alt = "";
  hero.hidden = true;
  tiles.hidden = true;
  tiles.replaceChildren();
}
function artistShotObject(artist, shot, index, src) {
  const label = canonName(artist);
  return registerImageObject(`artist:${canonTag(artist)}:${index}`, {
    source: "artist",
    label,
    caption: `${label} · ${index + 1}`,
    src,
    fileName: `${canonTag(artist)}-${index + 1}.${src.split(".").pop() || "jpg"}`,
    meta: { artist: canonTag(artist), shotIndex: index }
  });
}
function paintArtistShots(shots) {
  const hero = document.getElementById("artistHero");
  const prompt = document.getElementById("artistPrompt");
  const tiles = document.getElementById("shotTiles");
  const artist = selectedSeed;
  if (!artist || !shots?.length) return;
  const heroSrc = artistShotIndex === 0 ? fullUrl(shots[0]) : midUrl(shots[artistShotIndex]);
  const heroObject = artistShotObject(artist, shots[artistShotIndex], artistShotIndex, heroSrc);
  hero.hidden = false;
  prompt.hidden = true;
  hero.src = heroSrc;
  hero.alt = `${canonName(artist)}의 Danbooru 그림 ${artistShotIndex + 1}번`;
  bindImageElement(hero, heroObject.id);
  hero.onerror = () => { hero.hidden = true; prompt.hidden = false; prompt.textContent = "이미지를 불러오지 못했습니다."; };
  tiles.hidden = shots.length < 2;
  tiles.replaceChildren();
  shots.forEach((shot, index) => {
    if (index === artistShotIndex) return;
    const src = midUrl(shot);
    const object = artistShotObject(artist, shot, index, src);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shottile";
    button.title = "이 그림을 크게";
    const image = document.createElement("img");
    image.src = src;
    image.alt = `${canonName(artist)}의 Danbooru 그림 ${index + 1}번`;
    bindImageElement(image, object.id);
    button.appendChild(image);
    button.addEventListener("click", () => { artistShotIndex = index; paintArtistShots(shots); syncImageSelectionState(); });
    tiles.appendChild(button);
  });
  syncImageSelectionState();
}
function renderCodexStats() {
  const token = selectedSeed ? toks.find(item => isArtist(item.name) && canonTag(item.name) === canonTag(selectedSeed)) : null;
  const train = selectedSeed ? danOf(selectedSeed, "train") : null;
  const pop = selectedSeed ? danOf(selectedSeed, "pop") : null;
  const setCell = (id, value) => {
    const element = document.getElementById(id);
    element.textContent = value == null ? "미수집" : value;
    element.classList.toggle("none", value == null);
  };
  setCell("codexTrain", train == null ? null : `${train.toLocaleString()}장`);
  setCell("codexPop", pop == null ? null : pop.toFixed(1));
  setCell("codexWeight", token ? fmt(token.w) : null);
  const oldName = selectedSeed ? aliasOf(selectedSeed) : null;
  const alias = document.getElementById("codexAlias");
  alias.textContent = oldName ? `${oldName} → ${canonName(selectedSeed)}` : "최신";
  alias.classList.toggle("none", !oldName);
  alias.title = oldName ? "프롬프트에 적힌 이름이 옛 태그입니다." : "";
}
function renderSeedContext() {
  const label = selectedSeed ? canonName(selectedSeed) : "—";
  document.getElementById("whoA").textContent = label;
  document.getElementById("chunkSeed").textContent = selectedSeed ? shortName(selectedSeed) : "—";
  const prompt = document.getElementById("artistPrompt");
  const start = document.getElementById("chunkStart");
  const stats = document.getElementById("codexStats");
  start.disabled = !selectedSeed;
  stats.hidden = !selectedSeed;
  if (!selectedSeed) {
    prompt.hidden = false;
    prompt.textContent = "왼쪽 작가명이나 그래프 막대를 눌러 시드 선택";
    clearArtistShots();
    setArtistLink("danbooruLink", null);
    setArtistLink("twitterLink", null);
    return;
  }
  renderCodexStats();
  const shots = shotsOf(selectedSeed);
  if (shots?.length) {
    artistShotIndex = 0;
    paintArtistShots(shots);
  }
  else {
    clearArtistShots();
    prompt.hidden = false;
    prompt.textContent = "Danbooru 대표 그림을 사용할 수 없습니다.";
  }
  const canonical = canonName(selectedSeed);
  setArtistLink("danbooruLink", "https://danbooru.donmai.us/posts?tags=" + encodeURIComponent(canonical.replace(/ /g, "_")));
  setArtistLink("twitterLink", "https://x.com/search?q=" + encodeURIComponent(canonical));
}
const artistShots = document.getElementById("artistShots");
if (typeof ResizeObserver === "function") {
  new ResizeObserver(() => {
    const rect = artistShots.getBoundingClientRect();
    artistShots.classList.toggle("tall", rect.height > rect.width * 1.2);
  }).observe(artistShots);
}
function paintSeedSelection() {
    document.querySelectorAll(".arow.seed,.bar.seed,#names .seed,.ptmirror .seed").forEach(el => el.classList.remove("seed"));
    if (!selectedSeed)
        return;
    const k = ai.findIndex(ti => toks[ti].name.toLowerCase() === selectedSeed.toLowerCase());
    if (k < 0)
        return;
    [combo.querySelector(`.arow[data-k="${k}"]`), bars.querySelector(`.bar[data-k="${k}"]`),
        names.querySelector(`span[data-k="${k}"]`), mirror.querySelector(`.tk[data-k="${k}"]`)]
        .forEach(el => el && el.classList.add("seed"));
}
function selectSeed(k) {
    if (competitionLocked)
        return;
    const token = toks[ai[Number(k)]];
    if (!token || !isArtist(token.name))
        return;
    selectedSeed = token.name;
    document.body.classList.remove("historyDetail");
    save({ seedArtist: selectedSeed });
    if (document.body.classList.contains("chunkDuel") || document.body.classList.contains("chunkTune"))
        returnToChunkSelection();
    paintSeedSelection();
    renderSeedContext();
}
bars.addEventListener("pointermove", e => {
    const bar = e.target.closest(".bar");
    if (!bar || bar.dataset.k == null) {
        artistpeek.classList.remove("on");
        return;
    }
    const t = toks[ai[bar.dataset.k]], w = artistpeek.offsetWidth, h = Math.max(artistpeek.offsetHeight || 0, 290);
    const scale = uiScale, viewportWidth = innerWidth / scale, viewportHeight = innerHeight / scale;
    const pointerX = e.clientX / scale, pointerY = e.clientY / scale;
    peekname.textContent = shortName(t.name) + "  ·  " + fmt(t.w);
    peekimg.src = peekSources[Number(bar.dataset.k) % peekSources.length];
    peekimg.alt = shortName(t.name) + " 대표 이미지";
    artistpeek.style.left = Math.max(10, Math.min(viewportWidth - w - 10, pointerX + 16)) + "px";
    artistpeek.style.top = Math.max(10, Math.min(viewportHeight - h - 10, pointerY - h / 2)) + "px";
    artistpeek.classList.add("on");
});
bars.addEventListener("pointerleave", () => artistpeek.classList.remove("on"));
bars.addEventListener("click", e => { const bar = e.target.closest(".bar"); if (bar && bar.dataset.k != null)
    selectSeed(bar.dataset.k); });
names.addEventListener("click", e => {
    const name = e.target.closest("[data-k]");
    if (name)
        selectSeed(name.dataset.k);
});
function setW(k, v, growOnly) {
    const w = Math.round(Math.min(HARD, Math.max(floorW(), v)) * 20) / 20;
    toks[ai[k]].w = w;
    fitAxis(growOnly);
    syncText();
    paint();
    return w;
}
function clearDropMarks() {
    document.querySelectorAll(".drop-before,.drop-after,.dragging").forEach(el => el.classList.remove("drop-before", "drop-after", "dragging"));
}
function reorderArtist(fromK, toK, after) {
    if (fromK === toK)
        return;
    const fromTi = ai[fromK], toTi = ai[toK];
    if (fromTi == null || toTi == null || !isArtist(toks[fromTi].name) || !isArtist(toks[toTi].name))
        return;
    const shown = ai.filter(ti => isArtist(toks[ti].name));
    const from = shown.indexOf(fromTi), to = shown.indexOf(toTi);
    if (from < 0 || to < 0)
        return;
    const values = shown.map(ti => ({ name: toks[ti].name, w: toks[ti].w }));
    const [moving] = values.splice(from, 1);
    let at = to + (after ? 1 : 0) - (from < to ? 1 : 0);
    values.splice(Math.max(0, Math.min(values.length, at)), 0, moving);
    const slots = toks.map((t, i) => isArtist(t.name) ? i : -1).filter(i => i >= 0);
    slots.forEach((ti, i) => Object.assign(toks[ti], values[i]));
    sortKey.value = "prompt";
    sortDir.value = "asc";
    save({ sortKey: "prompt", sortDir: "asc" });
    syncText();
    rebuild();
}
combo.addEventListener("pointerdown", e => {
    if (e.target.closest("input,button"))
        return;
    const row = e.target.closest(".arow");
    if (!row || !isArtist(toks[ai[row.dataset.k]].name))
        return;
    row.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    let active = false, target = null, after = false;
    const move = ev => {
        if (!active && Math.abs(ev.clientY - y0) < 4)
            return;
        active = true;
        row.classList.add("dragging");
        document.querySelectorAll(".arow.drop-before,.arow.drop-after").forEach(el => el.classList.remove("drop-before", "drop-after"));
        target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".arow") || null;
        if (!target || !isArtist(toks[ai[target.dataset.k]]?.name))
            return;
        after = ev.clientY > target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
        target.classList.add(after ? "drop-after" : "drop-before");
    };
    const up = () => {
        row.removeEventListener("pointermove", move);
        row.removeEventListener("pointerup", up);
        const toK = target?.dataset.k;
        clearDropMarks();
        if (active && toK != null)
            reorderArtist(Number(row.dataset.k), Number(toK), after);
    };
    row.addEventListener("pointermove", move);
    row.addEventListener("pointerup", up);
});
bars.addEventListener("pointerdown", e => {
    const b = e.target.closest(".bar");
    if (!b)
        return;
    b.setPointerCapture(e.pointerId);
    const k = Number(b.dataset.k), x0 = e.clientX, y0 = e.clientY;
    let mode = null, target = null, after = false;
    const move = ev => {
        if (!mode) {
            const dx = ev.clientX - x0, dy = ev.clientY - y0;
            if (Math.hypot(dx, dy) < 4)
                return;
            mode = Math.abs(dx) > Math.abs(dy) ? "order" : "weight";
            b.classList.add("dragging");
        }
        if (mode === "order") {
            document.querySelectorAll(".bar.drop-before,.bar.drop-after").forEach(el => el.classList.remove("drop-before", "drop-after"));
            target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".bar") || null;
            if (!target)
                return;
            after = ev.clientX > target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2;
            target.classList.add(after ? "drop-after" : "drop-before");
            return;
        }
        const r = bars.getBoundingClientRect();
        setW(k, LO + ((r.bottom - ev.clientY) / (r.height - 14)) * (HI - LO), true);
    };
    const up = () => {
        b.removeEventListener("pointermove", move);
        b.removeEventListener("pointerup", up);
        const toK = target?.dataset.k;
        clearDropMarks();
        if (mode === "order" && toK != null)
            reorderArtist(k, Number(toK), after);
        else if (mode === "weight") {
            rebuild();
            reconcileFromPrompt();
        }
    };
    b.addEventListener("pointermove", move);
    b.addEventListener("pointerup", up);
});
combo.addEventListener("input", e => {
    if (!e.target.classList.contains("w"))
        return;
    const v = parseFloat(e.target.value);
    if (!isNaN(v))
        e.target.value = setW(e.target.closest(".arow").dataset.k, v, false).toFixed(2);
});
combo.addEventListener("change", e => { if (e.target.classList.contains("w")) {
    rebuild();
    reconcileFromPrompt();
} });
combo.addEventListener("click", e => {
    const row = e.target.closest(".arow");
    if (!row)
        return;
    if (e.target.classList.contains("x")) {
        toks.splice(ai[row.dataset.k], 1);
        syncText(false);
        rebuild();
        reconcileFromPrompt();
        return;
    }
    selectSeed(row.dataset.k);
});
const addArtist = document.getElementById("addArtist");
const artistFind = document.getElementById("artistFind");
const FIND_MAX = 40;
const artistAliases = new Map();
for (const [oldTag, currentTag] of Object.entries(ALIAS)) {
  if (!artistAliases.has(currentTag)) artistAliases.set(currentTag, []);
  artistAliases.get(currentTag).push(oldTag);
}
/** @typedef {{tag:string,label:string,pop:number,train:number,hasShots:boolean,aliases:string[]}} ArtistFindEntry */
/** @typedef {{ok:boolean,message:string}} MetadataApplyResult */
const artistFindIndex = Object.keys(DAN_RAW).map(tag => ({
  tag,
  label: spaced(tag),
  pop: DAN_RAW[tag][0],
  train: DAN_RAW[tag][1],
  hasShots: !!IMAGES[tag],
  aliases: artistAliases.get(tag) || []
})).sort((a, b) => b.pop - a.pop);
/** @param {string} query @returns {ArtistFindEntry[]} */
function findArtists(query) {
  const normalized = tagOf(query);
  if (!normalized) return artistFindIndex.slice(0, FIND_MAX);
  const matches = [];
  for (const entry of artistFindIndex) {
    const rank = entry.tag.startsWith(normalized) ? 0
      : entry.tag.includes("_" + normalized) ? 1
      : entry.tag.includes(normalized) ? 2
      : entry.aliases.some(alias => alias.includes(normalized)) ? 3 : -1;
    if (rank >= 0) matches.push([rank, entry]);
  }
  return matches.sort((a, b) => a[0] - b[0] || b[1].pop - a[1].pop).slice(0, FIND_MAX).map(match => match[1]);
}
let findRows = [];
let findAt = -1;
const artistInPrompt = tag => toks.some(token => isArtist(token.name) && canonTag(token.name) === tag);
function findRow(entry, index) {
  const duplicate = artistInPrompt(entry.tag);
  const mark = duplicate ? "이미 있음" : entry.hasShots ? "" : "그림 없음";
  return `<button type="button" class="frow${index === findAt ? " on" : ""}" role="option" aria-selected="${index === findAt}" aria-disabled="${duplicate}" data-i="${index}">` +
    `<span class="fnm">${esc(entry.label)}</span><span class="fnum">인기 ${entry.pop.toFixed(1)} · ${entry.train.toLocaleString()}장</span><span class="fmark">${mark}</span></button>`;
}
function renderArtistFind() {
  const query = addArtist.value.trim();
  findRows = findArtists(query);
  findAt = findRows.length ? 0 : -1;
  artistFind.innerHTML = findRows.length
    ? `<div class="findhead">${query ? `<b>${esc(query)}</b> · ${findRows.length}명` : `인기순 ${findRows.length}명`}</div>` + findRows.map(findRow).join("")
    : `<div class="findnone">일치하는 작가가 없습니다. ＋로 직접 추가할 수 있습니다.</div>`;
  artistFind.hidden = false;
  addArtist.setAttribute("aria-expanded", "true");
  const inputRect = addArtist.getBoundingClientRect();
  const panelRect = artistFind.closest(".panel").getBoundingClientRect();
  artistFind.style.maxHeight = Math.max(132, Math.min(340, panelRect.bottom - inputRect.bottom - 12)) + "px";
  artistFind.scrollTop = 0;
}
function closeArtistFind() {
  artistFind.hidden = true;
  findRows = [];
  findAt = -1;
  addArtist.setAttribute("aria-expanded", "false");
}
function moveArtistFind(step) {
  if (!findRows.length) return;
  findAt = (findAt + step + findRows.length) % findRows.length;
  artistFind.querySelectorAll(".frow").forEach((element, index) => {
    element.classList.toggle("on", index === findAt);
    element.setAttribute("aria-selected", String(index === findAt));
  });
  artistFind.querySelector(".frow.on")?.scrollIntoView({ block: "nearest" });
}
function addArtistTag(rawValue = null) {
  const raw = String(rawValue ?? addArtist.value).trim();
  if (!raw) return false;
  const parsed = parseCore(raw);
  parsed.name = /^artist:/i.test(parsed.name) ? parsed.name : "artist:" + parsed.name;
  const canonical = canonTag(parsed.name);
  if (toks.some(token => isArtist(token.name) && canonTag(token.name) === canonical)) {
    addArtist.select();
    return false;
  }
  const last = toks.map((token, index) => isArtist(token.name) ? index : -1).filter(index => index >= 0).at(-1);
  const fresh = { pre: "", post: "", sep: "", w: parsed.w, name: parsed.name };
  if (last == null) {
    if (toks.length) toks[toks.length - 1].sep = toks[toks.length - 1].sep || ", ";
    toks.push(fresh);
  }
  else {
    fresh.sep = toks[last].sep || ", ";
    toks[last].sep = ", ";
    toks.splice(last + 1, 0, fresh);
  }
  addArtist.value = "";
  syncText(false);
  rebuild();
  reconcileFromPrompt();
  return true;
}
function takeArtistFind(index) {
  const entry = findRows[index];
  if (!entry || artistInPrompt(entry.tag)) return;
  addArtistTag(entry.label);
  addArtist.value = "";
  renderArtistFind();
  addArtist.focus();
}
document.getElementById("addArtistBtn").onclick = () => addArtistTag();
addArtist.addEventListener("input", renderArtistFind);
addArtist.addEventListener("focus", renderArtistFind);
addArtist.addEventListener("keydown", event => {
  if (event.key === "ArrowDown") { event.preventDefault(); artistFind.hidden ? renderArtistFind() : moveArtistFind(1); return; }
  if (event.key === "ArrowUp") { event.preventDefault(); moveArtistFind(-1); return; }
  if (event.key === "Escape") { if (!artistFind.hidden) { event.preventDefault(); closeArtistFind(); } return; }
  if (event.key === "Enter") {
    event.preventDefault();
    if (!artistFind.hidden && findAt >= 0) takeArtistFind(findAt);
    else addArtistTag();
  }
});
artistFind.addEventListener("mousedown", event => event.preventDefault());
artistFind.addEventListener("click", event => {
  const row = event.target.closest(".frow");
  if (row) takeArtistFind(Number(row.dataset.i));
});
document.addEventListener("pointerdown", event => {
  if (!artistFind.hidden && !event.target.closest(".artistadd")) closeArtistFind();
});
let comp = null;
let compExpanded = new Set([""]);
let forkSeq = 0;
const artistNode = (tag, weight) => ({ kind: "artist", tag, weight });
const chunkNode = (name, children, weight, fromId) => ({ kind: "chunk", name, children, weight: weight ?? 1, fromId: fromId ?? null });
const pathKey = p => p.join(".");
function nodeAtRoot(root, path) {
    let n = root;
    for (const i of path) {
        if (!n || !n.children)
            return null;
        n = n.children[i];
    }
    return n;
}
const nodeAt = path => nodeAtRoot(comp, path);
function rebasePathAfterDelete(path, deleted) {
    if (deleted.length <= path.length && deleted.every((part, index) => path[index] === part))
        return null;
    const parent = deleted.slice(0, -1), removedIndex = deleted.at(-1);
    const sharesParent = parent.every((part, index) => path[index] === part);
    if (sharesParent && path.length > parent.length && path[parent.length] > removedIndex) {
        const next = path.slice();
        next[parent.length]--;
        return next;
    }
    return path.slice();
}
function rebaseExpandedAfterDelete(deleted) {
    const expanded = new Set();
    for (const key of compExpanded) {
        const path = key === "" ? [] : key.split(".").map(Number);
        const rebased = rebasePathAfterDelete(path, deleted);
        if (rebased)
            expanded.add(pathKey(rebased));
    }
    expanded.add("");
    compExpanded = expanded;
}
function effectiveAt(path) {
    let n = comp, w = comp ? comp.weight : 1;
    for (const i of path) {
        n = n.children[i];
        if (!n)
            return w;
        w *= n.weight;
    }
    return w;
}
function flattenInto(node, mult, out) {
    const w = mult * node.weight;
    if (node.kind === "artist") {
        out.set(node.tag, (out.get(node.tag) || 0) + w);
        return out;
    }
    (node.children || []).forEach(c => flattenInto(c, w, out));
    return out;
}
const flattenComp = () => comp ? flattenInto(comp, 1, new Map()) : new Map();
const leafCount = node => node.kind === "artist" ? 1 : (node.children || []).reduce((n, c) => n + leafCount(c), 0);
const round2 = v => Math.round(v * 100) / 100;
function appendArtistToken(name, w) {
    const last = toks.map((t, i) => isArtist(t.name) ? i : -1).filter(i => i >= 0).at(-1);
    const fresh = { pre: "", post: "", sep: "", w, name };
    if (last == null) {
        if (toks.length)
            toks[toks.length - 1].sep = toks[toks.length - 1].sep || ", ";
        toks.push(fresh);
    }
    else {
        fresh.sep = toks[last].sep || ", ";
        toks[last].sep = ", ";
        toks.splice(last + 1, 0, fresh);
    }
}
function syncPromptFromComp() {
    const flat = flattenComp(), seen = new Set(), remove = [];
    toks.forEach((t, i) => {
        if (!isArtist(t.name))
            return;
        if (!flat.has(t.name) || seen.has(t.name)) {
            remove.push(i);
            return;
        }
        t.w = round2(flat.get(t.name));
        seen.add(t.name);
    });
    for (let i = remove.length - 1; i >= 0; i--)
        toks.splice(remove[i], 1);
    [...flat.keys()].filter(n => !seen.has(n)).forEach(n => appendArtistToken(n, round2(flat.get(n))));
    syncText(false);
    rebuild();
    renderComp();
}
function promptArtists() {
    const totals = new Map();
    toks.forEach(t => {
        if (!isArtist(t.name))
            return;
        totals.set(t.name, (totals.get(t.name) || 0) + t.w);
    });
    return new Map([...totals].map(([tag, w]) => [tag, round2(w)]));
}
function reconcileFromPrompt() {
    const current = flattenComp(), entered = promptArtists();
    const same = !!comp && current.size === entered.size &&
        [...current].every(([tag, w]) => Math.abs((entered.get(tag) ?? NaN) - round2(w)) <= 1e-9);
    if (!comp || same) {
        renderComp();
        return;
    }
    const flat = [...promptArtists()].map(([tag, w]) => artistNode(tag, w));
    if (comp && comp.forkedFrom) {
        comp.children = flat;
        renderComp();
        return;
    }
    const base = comp ? comp.name : "프롬프트";
    comp = chunkNode(`${base} 사본 ${++forkSeq}`, flat, 1, null);
    comp.forkedFrom = base;
    compExpanded = new Set([""]);
    renderComp();
}
function adoptComposition(node, label) {
    comp = node;
    comp.forkedFrom = null;
    compExpanded = new Set([""]);
    if (label)
        comp.name = label;
    syncPromptFromComp();
}
function compRowHtml(node, path, depth) {
    const key = pathKey(path), open = compExpanded.has(key);
    const isChunk = node.kind === "chunk";
    const label = isChunk ? node.name : shortName(node.tag);
    const color = isChunk ? "var(--accent)" : colorOf(node.tag);
    const eff = effectiveAt(path);
    let html = `<div class="crow ${isChunk ? "chunk" : "artist"}" data-path="${key}" ` +
        `style="--c:${color};padding-left:${3 + depth * 13}px">` +
        (isChunk ? `<button class="ctwist" data-twist="${key}">${open ? "▾" : "▸"}</button>`
            : `<span class="ctwist"></span>`) +
        `<span class="cdot"></span>` +
        `<span class="cname" title="${esc(isChunk ? node.name : node.tag)}">${esc(label)}</span>` +
        (isChunk ? `<span class="ckind">${leafCount(node)}명</span>` : "") +
        `<input class="cw" data-w="${key}" value="${node.weight.toFixed(2)}">` +
        `<span class="ceff">→ <b>${round2(eff).toFixed(2)}</b></span>` +
        `<button class="cx" data-del="${key}">×</button></div>`;
    if (isChunk && open)
        (node.children || []).forEach((c, i) => { html += compRowHtml(c, [...path, i], depth + 1); });
    return html;
}
function renderComp() {
    const host = document.getElementById("comptree");
    const bar = host.previousElementSibling;
    const crumb = document.getElementById("compCrumb");
    const fork = document.getElementById("compFork");
    const visible = !!comp?.children?.some(node => node.kind === "chunk");
    bar.hidden = host.hidden = !visible;
    if (!visible)
        return;
    crumb.textContent = comp.name;
    fork.hidden = !comp.forkedFrom;
    if (comp.forkedFrom)
        fork.textContent = `${comp.forkedFrom} 에서 분기`;
    host.innerHTML = (comp.children || []).map((c, i) => compRowHtml(c, [i], 0)).join("") ||
        `<div class="cempty">이 작가 조합은 비어 있다.</div>`;
}
document.getElementById("comptree").addEventListener("click", e => {
    const twist = e.target.closest("[data-twist]");
    if (twist) {
        const k = twist.dataset.twist;
        compExpanded.has(k) ? compExpanded.delete(k) : compExpanded.add(k);
        renderComp();
        return;
    }
    const del = e.target.closest("[data-del]");
    if (del) {
        const path = del.dataset.del.split(".").map(Number);
        const node = nodeAt(path);
        if (!node)
            return;
        const warning = node.kind === "chunk"
            ? `「${node.name}」 묶음과 그 안의 작가 ${leafCount(node)}명을 삭제할까요?`
            : `${shortName(node.tag)} 작가를 Composition에서 삭제할까요?`;
        if (!confirm(warning))
            return;
        const parent = path.length === 1 ? comp : nodeAt(path.slice(0, -1));
        parent.children.splice(path.at(-1), 1);
        rebaseExpandedAfterDelete(path);
        syncPromptFromComp();
        return;
    }
});
document.getElementById("comptree").addEventListener("change", e => {
    const box = e.target.closest("[data-w]");
    if (!box)
        return;
    const path = box.dataset.w.split(".").map(Number);
    const node = nodeAt(path);
    if (!node)
        return;
    const v = parseFloat(box.value);
    if (isNaN(v)) {
        renderComp();
        return;
    }
    node.weight = Math.round(clampNodeW(v, node) * 20) / 20;
    syncPromptFromComp();
});
const negativeToggle = document.getElementById("settingNegative");
negativeToggle.checked = allowNegative;
negativeToggle.onchange = () => {
    allowNegative = negativeToggle.checked;
    save({ allowNegative });
    fitAxis(false);
    paint();
};
pt.addEventListener("input", () => { rebuild(); reconcileFromPrompt(); });
sortKey.onchange = () => { save({ sortKey: sortKey.value }); rebuild(); };
sortDir.onchange = () => { save({ sortDir: sortDir.value }); rebuild(); };
const resetW = document.getElementById("resetW");
let resetWeightsUndo = null;
resetW.onclick = () => {
    const canUndo = resetWeightsUndo
        && resetWeightsUndo.every(item => toks[item.index]?.name === item.name && toks[item.index].w === 1);
    if (canUndo) {
        resetWeightsUndo.forEach(item => toks[item.index].w = item.w);
        resetWeightsUndo = null;
        resetW.textContent = "전부 1.0";
    }
    else {
        const targets = ai.map(index => ({ index, name: toks[index].name, w: toks[index].w }));
        if (!targets.some(item => item.w !== 1)) {
            resetWeightsUndo = null;
            resetW.textContent = "전부 1.0";
            return;
        }
        resetWeightsUndo = targets;
        targets.forEach(item => toks[item.index].w = 1);
        resetW.textContent = "↶ 직전 가중치";
    }
    syncText();
    rebuild();
    reconcileFromPrompt();
};
const onlyA = document.getElementById("onlyA");
onlyA.classList.toggle("on", onlyArtist);
onlyA.onclick = () => {
    onlyArtist = !onlyArtist;
    onlyA.classList.toggle("on", onlyArtist);
    save({ onlyArtist });
    rebuild();
};
const defaultChunkPreset = {
  "차가운 판타지": [["lack", 1], ["wlop", .8], ["happoubi jin", 1.25]],
  "유리빛 인물화": [["mignon", 1], ["fuzichoco", .7]],
  "선명한 명암": [["ciloranko", 1], ["quasarcake", .65], ["michiking", .85], ["freng", .55]],
  "부드러운 채색": [["modare", 1], ["riichu", .7], ["fuzichoco", .8]],
  "무채색 의상": [["asanagi", 1], ["parsley-f", -.4]],
  "강한 선화": [["sousouman", 1], ["wanke", .9], ["toosaka asagi", .6]],
  "몽환 배경": [["wlop", 1], ["mignon", .75]],
  "차분한 색감": [["happoubi jin", 1], ["quasarcake", .5], ["fuzichoco", .8]],
  "옅은 수채": [["fuzichoco", 1], ["modare", .6]],
  "금빛 역광": [["wlop", 1], ["ciloranko", .85], ["mignon", .5]],
  "푸른 야경": [["quasarcake", 1], ["wanke", .7]],
  "고전 삽화": [["toosaka asagi", 1], ["happoubi jin", .75], ["lack", .45]],
  "맑은 선화": [["sousouman", 1], ["michiking", .8]],
  "짙은 채도": [["asanagi", 1], ["freng", .9], ["mignon", .55]],
  "겨울 공기": [["modare", 1], ["wlop", .65], ["fuzichoco", .4]],
  "따뜻한 필름": [["mignon", 1], ["lack", .7], ["parsley-f", -.3]],
  "청명한 역광": [["wlop", 1], ["riichu", .75]],
  "연한 파스텔": [["fuzichoco", 1], ["modare", .75]],
  "푸른 유리": [["quasarcake", 1], ["mignon", .7]],
  "거친 펜선": [["sousouman", 1], ["lack", .65]],
  "저채도 판타지": [["happoubi jin", 1], ["wanke", .7]],
  "따뜻한 인물화": [["mignon", 1], ["riichu", .8]],
  "차가운 선화": [["lack", 1], ["sousouman", .75]],
  "몽환 채광": [["wlop", 1], ["fuzichoco", .65]],
  "선명한 수채": [["ciloranko", 1], ["fuzichoco", .75]],
  "고요한 야경": [["wanke", 1], ["quasarcake", .65]],
  "부드러운 명암": [["modare", 1], ["mignon", .7]],
  "금빛 의상": [["toosaka asagi", 1], ["ciloranko", .7]],
  "맑은 배경": [["fuzichoco", 1], ["wlop", .65]],
  "짙은 선화": [["sousouman", 1], ["michiking", .75]],
  "겨울 초상": [["riichu", 1], ["modare", .65]],
  "필름 판타지": [["lack", 1], ["happoubi jin", .7]]
};
const defaultChunkKeys = [["cold-fantasy", "차가운 판타지"], ["glass-portrait", "유리빛 인물화"], ["vivid-contrast", "선명한 명암"], ["soft-color", "부드러운 채색"], ["gray-outfit", "무채색 의상"], ["strong-line", "강한 선화"], ["dream-bg", "몽환 배경"], ["calm-color", "차분한 색감"]];
const chunkLibrary = Object.fromEntries(defaultChunkKeys.map(([key, name]) => [key, defaultChunkPreset[name]]));
function chunkRows(entry) {
    if (Array.isArray(entry))
        return entry.map(([name, weight]) => [name, Number(weight)]);
    if (!entry?.root)
        return [];
    return [...flattenInto(entry.root, 1, new Map())].map(([tag, w]) => [shortName(tag), round2(w)]);
}
function chunkRoot(entry, title, fromId) {
    if (Array.isArray(entry))
        return chunkNode(title, entry.map(([name, weight]) => artistNode("artist:" + name, Number(weight))), 1, fromId);
    if (!entry?.root)
        return chunkNode(title, [], 1, fromId);
    const root = structuredClone(entry.root);
    root.name = title || root.name;
    root.fromId = fromId ?? root.fromId ?? null;
    return root;
}
const chunkTooltip = document.getElementById("chunkTooltip");
function showChunkTooltip(card, x, y) {
    const artists = chunkRows(chunkLibrary[card.dataset.chunk]);
    if (!artists.length)
        return;
    const title = card.querySelector(".chunkname").firstChild.textContent.trim();
    chunkTooltip.innerHTML = `<div class="chunktooltip-head"><b>${esc(title)}</b><span>${artists.length}명</span></div>` +
        `<div class="chunktooltip-list">${artists.map((artist, index) => {
            const weight = Number(artist[1]);
            return `<div class="chunktooltip-row"><span class="chunktooltip-order">${String(index + 1).padStart(2, "0")}</span>` +
                `<span class="chunktooltip-name">${esc(artist[0])}</span>` +
                `<span class="chunktooltip-weight${weight < 0 ? " neg" : ""}">${weight.toFixed(2)}</span></div>`;
        }).join("")}</div>`;
    chunkTooltip.classList.add("on");
    chunkTooltip.setAttribute("aria-hidden", "false");
    const gap = 14, w = chunkTooltip.offsetWidth, h = chunkTooltip.offsetHeight, scale = uiScale;
    const viewportWidth = innerWidth / scale, viewportHeight = innerHeight / scale, anchorX = x / scale, anchorY = y / scale;
    chunkTooltip.style.left = Math.max(8, Math.min(viewportWidth - w - 8, anchorX + gap)) + "px";
    chunkTooltip.style.top = Math.max(8, Math.min(viewportHeight - h - 8, anchorY + gap)) + "px";
}
function hideChunkTooltip() {
    chunkTooltip.classList.remove("on");
    chunkTooltip.setAttribute("aria-hidden", "true");
}
function selectExistingChunk(card) {
    resetCompetition();
    abandonTuning();
    document.querySelectorAll(".chunkcard[data-chunk]").forEach(item => item.classList.toggle("selected", item === card));
    document.body.classList.add("chunkStage");
    document.body.classList.remove("chunkDuel", "chunkPodium");
    const key = card.dataset.chunk, entry = chunkLibrary[key];
    const title = card.querySelector(".chunkname").firstChild.textContent.trim();
    const root = chunkRoot(entry, title, key);
    const seed = selectedSeed;
    const flat = flattenInto(root, 1, new Map());
    if (seed && !flat.has(seed))
        root.children.unshift(artistNode(seed, 1));
    adoptComposition(root);
}
function wireChunkCard(card) {
    card.draggable = true;
    const artists = chunkRows(chunkLibrary[card.dataset.chunk]);
    const image = card.querySelector("img");
    const title = card.querySelector(".chunkname").firstChild.textContent.trim();
    const selectTarget = card.querySelector("[data-chunk-select]") || card;
    if (image)
        registerImageObject(`chunk:${card.dataset.chunk}`, { source: "chunk", label: title, caption: `작가 조합 · ${title}`, src: image.src, fileName: `${title}.png`, meta: { chunkKey: card.dataset.chunk } }, image);
    const meta = card.querySelector(".chunkmeta"), status = meta.textContent.split("·").slice(1).join("·").trim();
    meta.textContent = artists.length + "명" + (status ? " · " + status : "");
    selectTarget.setAttribute("aria-describedby", "chunkTooltip");
    card.addEventListener("pointermove", e => showChunkTooltip(card, e.clientX, e.clientY));
    card.addEventListener("pointerleave", hideChunkTooltip);
    selectTarget.addEventListener("focus", () => {
        const r = card.getBoundingClientRect();
        showChunkTooltip(card, r.right, r.top);
    });
    selectTarget.addEventListener("blur", hideChunkTooltip);
    selectTarget.onclick = () => selectExistingChunk(card);
}
document.querySelectorAll(".chunkcard[data-chunk]").forEach(wireChunkCard);
const competitionPlayers = Object.keys(defaultChunkPreset).map((name, id) => ({
  id,
  name,
  src: id % 2 ? "../resource/test.png" : "../resource/original.png"
}));
// 새 작가 조합 Tournament는 시작 순간의 32개 조합을 고정한다.
// 이후 UI 값이나 프롬프트가 바뀌어도 진행 중인 Run의 후보는 변하지 않는다.
let competitionCompositions = null;
let competitionCreateOptions = null;
const cloneCompetitionMembers = members => (Array.isArray(members) ? members : []).map(member => ({
  name: String(member?.name || ""),
  w: Number(member?.w)
})).filter(member => member.name && Number.isFinite(member.w));
function serializeCompetitionCompositions() {
  if (!competitionCompositions || typeof competitionCompositions !== "object") return null;
  return Object.fromEntries(competitionPlayers.map(player => [player.id, cloneCompetitionMembers(competitionCompositions[player.id])]));
}
function normalizeCompetitionCompositions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out = {};
  let found = false;
  competitionPlayers.forEach(player => {
    const members = cloneCompetitionMembers(value[player.id]);
    if (members.length) { out[player.id] = members; found = true; }
  });
  return found ? out : null;
}
const BRIDGE_MATCHES = 8, ADAPTIVE_MATCHES = 4;
const TOTAL_MATCHES = 24 + BRIDGE_MATCHES + ADAPTIVE_MATCHES;
const BT_L2 = .1, BT_ITERATIONS = 48, COMPETITION_VERSION = 5, NOVELAI_PAYLOAD_VERSION = 2;
/** @typedef {"knockout"|"bridge"|"adaptive"|"podium"} CompetitionPhase */
/** @typedef {"knockout"|"bridge"|"adaptive"} MatchPhase */
/** @typedef {{id:number,phase:MatchPhase,left:number,right:number,winner:number,coin:boolean,advance:(number|null),roundSize:(number|null)}} CompetitionMatch */
/** @typedef {{phase:CompetitionPhase,roundSize:number,roundPlayers:number[],nextPlayers:number[],matchIndex:number,top8:number[],bridgeQueue:number[][],bridgeIndex:number,adaptiveRemaining:number,adaptivePair:(number[]|null),matches:CompetitionMatch[],podium:{first:(number|null),second:(number|null),third:(number|null)}}} CompetitionState */
function shufflePlayers(players) {
  const out = players.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
/** @param {number[]} [players] @param {boolean} [randomize] @returns {CompetitionState} */
function createCompetition(players = competitionPlayers.map(player => player.id), randomize = true) {
  const entrants = randomize ? shufflePlayers(players) : players.slice();
  return {
    phase: "knockout",
    roundSize: entrants.length,
    roundPlayers: entrants,
    nextPlayers: [],
    matchIndex: 0,
    top8: [],
    bridgeQueue: [],
    bridgeIndex: 0,
    adaptiveRemaining: ADAPTIVE_MATCHES,
    adaptivePair: null,
    matches: [],
    podium: { first: null, second: null, third: null }
  };
}
let competition = createCompetition();
let competitionLocked = false;
let decisionHistory = [];
let experimentSnapshot = null;
let duelPayloads = { left: null, right: null };
/** @param {string[]} left @param {string[]} right @returns {{leftStart:number,rightStart:number,length:number}} */
function longestCommonArtistBlock(left, right) {
  const lengths = new Uint32Array(right.length + 1);
  let best = { leftStart: -1, rightStart: -1, length: 0 };
  for (let i = 0; i < left.length; i++) {
    for (let j = right.length - 1; j >= 0; j--) {
      const length = left[i] === right[j] ? lengths[j] + 1 : 0;
      lengths[j + 1] = length;
      const leftStart = i - length + 1, rightStart = j - length + 1;
      if (length && (length > best.length || (length === best.length &&
        (leftStart > best.leftStart || (leftStart === best.leftStart && rightStart > best.rightStart))))) {
        best = { leftStart, rightStart, length };
      }
    }
  }
  return best;
}
/** @param {[string,number][]} rows @param {number} start @param {number} length @param {boolean} showWeights @returns {string} */
function duelArtistList(rows, start, length, showWeights) {
  const artist = ([name, weight]) => `<span class="duel-artist">${esc(name)}${showWeights && weight !== 1 ? `<small>${esc(fmt(weight))}</small>` : ""}</span>`;
  if (!length) return rows.map(artist).join("");
  return rows.slice(0, start).map(artist).join("") +
    `<span class="duel-common-block">${rows.slice(start, start + length).map(artist).join("")}</span>` +
    rows.slice(start + length).map(artist).join("");
}
function renderDuelCompositions() {
  const host = document.getElementById("duelCompositions");
  const left = duelPayloads.left?.artists || [], right = duelPayloads.right?.artists || [];
  const block = longestCommonArtistBlock(left.map(row => row[0]), right.map(row => row[0]));
  const artistPoolSize = new Set([...left, ...right].map(row => row[0])).size;
  if (artistPoolSize < 4 || block.length < 2) block.length = 0;
  const showWeights = !document.body.classList.contains("chunkTune");
  host.innerHTML = [left, right].map((rows, index) => `<section class="duel-composition"><div class="duel-composition-head"><b>${index ? "B" : "A"}</b><span aria-label="작가 ${rows.length}명">${rows.length}명</span></div><div class="duel-artist-list">${duelArtistList(rows, index ? block.rightStart : block.leftStart, block.length, showWeights)}</div></section>`).join("");
  scheduleDuelLayout();
}
/** @param {number[]} ratios @param {number} width @returns {boolean} */
function useDuelBottomBar(ratios, width) {
  return width < 1100 || ratios.some(ratio => Number.isFinite(ratio) && ratio >= .95);
}
function syncDuelLayout() {
  const body = document.body;
  const active = body.classList.contains("chunkDuel") || body.classList.contains("chunkTune");
  const ratios = ["left", "right"].map(side => {
    const image = document.getElementById(side === "left" ? "duelLeftImage" : "duelRightImage");
    const resolution = duelPayloads[side]?.resolution || experimentSnapshot?.payload?.resolution;
    return image.getAttribute("src") && image.complete && image.naturalHeight
      ? image.naturalWidth / image.naturalHeight : Number(resolution?.width) / Number(resolution?.height);
  });
  body.classList.toggle("duel-adaptive", active);
  body.classList.toggle("duel-bottom", active && useDuelBottomBar(ratios, sideL.parentElement.clientWidth));
}
let duelLayoutFrame = 0;
function scheduleDuelLayout() {
  if (duelLayoutFrame) return;
  duelLayoutFrame = requestAnimationFrame(() => { duelLayoutFrame = 0; syncDuelLayout(); });
}
["duelLeftImage", "duelRightImage"].forEach(id => {
  const image = document.getElementById(id);
  image.addEventListener("load", scheduleDuelLayout);
  image.addEventListener("error", scheduleDuelLayout);
});
const duelView = { scale: 1, x: 0, y: 0 };
let duelDrag = null;
function paintDuelView() {
  document.querySelectorAll(".duelviewport").forEach(viewport => {
    const limit = Math.max(0, (duelView.scale - 1) / 2);
    const x = Math.max(-limit, Math.min(limit, duelView.x));
    const y = Math.max(-limit, Math.min(limit, duelView.y));
    viewport.style.setProperty("--duel-scale", duelView.scale);
    viewport.style.setProperty("--duel-pan-x", `${x * viewport.clientWidth}px`);
    viewport.style.setProperty("--duel-pan-y", `${y * viewport.clientHeight}px`);
  });
}
function resetDuelView() {
  Object.assign(duelView, { scale: 1, x: 0, y: 0 });
  paintDuelView();
}
document.querySelectorAll(".duelviewport").forEach(viewport => {
  viewport.addEventListener("wheel", event => {
    if (!document.body.classList.contains("chunkDuel") && !document.body.classList.contains("chunkTune")) return;
    event.preventDefault();
    duelView.scale = Math.max(1, Math.min(4, duelView.scale * (event.deltaY < 0 ? 1.12 : .89)));
    paintDuelView();
  }, { passive: false });
  viewport.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    duelDrag = { viewport, pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: duelView.x, startY: duelView.y };
    viewport.classList.add("duel-dragging");
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", event => {
    if (!duelDrag || duelDrag.viewport !== viewport || duelDrag.pointerId !== event.pointerId) return;
    duelView.x = duelDrag.startX + (event.clientX - duelDrag.x) / Math.max(1, viewport.clientWidth);
    duelView.y = duelDrag.startY + (event.clientY - duelDrag.y) / Math.max(1, viewport.clientHeight);
    paintDuelView();
  });
  const stopDrag = event => {
    if (!duelDrag || duelDrag.viewport !== viewport || duelDrag.pointerId !== event.pointerId) return;
    viewport.classList.remove("duel-dragging");
    duelDrag = null;
  };
  viewport.addEventListener("pointerup", stopDrag);
  viewport.addEventListener("pointercancel", stopDrag);
  viewport.addEventListener("dblclick", resetDuelView);
  viewport.addEventListener("keydown", event => {
    if (event.key === "0") resetDuelView();
    if (event.key === "+" || event.key === "=") { duelView.scale = Math.min(4, duelView.scale * 1.12); paintDuelView(); }
    if (event.key === "-") { duelView.scale = Math.max(1, duelView.scale * .89); paintDuelView(); }
  });
});
new ResizeObserver(scheduleDuelLayout).observe(sideL.parentElement);
new ResizeObserver(paintDuelView).observe(document.getElementById("center"));
new MutationObserver(scheduleDuelLayout).observe(document.body, { attributes: true, attributeFilter: ["class"] });
let competitionReviewIndex = null;
let tournamentPanelBefore = null;
let activeCompetitionRunId = null;
let competitionCandidateCache = new Map();
let competitionGenerationTask = null;
const runCardObjectUrls = new Map();
const storedCompetitionRuns = () => {
  const runs = load().competitionRuns;
  return runs && typeof runs === "object" && !Array.isArray(runs) ? runs : {};
};
const validCompetitionState = state => state && ["knockout", "bridge", "adaptive", "podium"].includes(state.phase)
  && Array.isArray(state.roundPlayers) && Array.isArray(state.matches) && Array.isArray(state.top8);
const validExperimentSnapshot = snapshot => snapshot && typeof snapshot.id === "string" && snapshot.payload?.schemaVersion === NOVELAI_PAYLOAD_VERSION;
const validCompetitionRun = run => run && run.version === COMPETITION_VERSION && typeof run.id === "string"
  && typeof run.seed === "string" && validCompetitionState(run.state) && validExperimentSnapshot(run.snapshot)
  && Array.isArray(run.checkpoints);
function serializeCompetitionCandidates() {
  return Object.fromEntries([...competitionCandidateCache].map(([player, entry]) => [player, {
    status: entry.status === "ready" ? "ready" : entry.status === "error" ? "error" : "queued",
    src: entry.src && !/^(blob:|data:)/i.test(String(entry.src)) ? entry.src : "",
    fileName: entry.fileName || "",
    error: entry.error || null
  }]));
}
function runPreviewSource(run) {
  const candidates = run?.candidates && typeof run.candidates === "object" ? Object.values(run.candidates) : [];
  return candidates.find(candidate => candidate?.status === "ready" && candidate.src)?.src || "";
}
function competitionRunRecord(existing = null) {
  const now = Date.now();
  return {
    version: COMPETITION_VERSION,
    id: activeCompetitionRunId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    seed: selectedSeed,
    state: structuredClone(competition),
    checkpoints: decisionHistory.slice(),
    snapshotId: experimentSnapshot?.id || null,
    snapshot: experimentSnapshot,
    createOptions: competitionCreateOptions ? { ...competitionCreateOptions } : null,
    compositions: serializeCompetitionCompositions(),
    candidates: serializeCompetitionCandidates(),
    previewAssetKey: existing?.previewAssetKey || null,
    previewFileName: existing?.previewFileName || ""
  };
}
function persistCompetition() {
  if (!activeCompetitionRunId || !experimentSnapshot) return null;
  const runs = storedCompetitionRuns();
  const record = competitionRunRecord(runs[activeCompetitionRunId]);
  runs[activeCompetitionRunId] = record;
  save({ competitionRuns: runs });
  syncUnfinishedRunCard(record);
  return record;
}
function clearCompetitionPersistence(runId = activeCompetitionRunId) {
  if (!runId) return;
  const runs = storedCompetitionRuns();
  const previewAssetKey = runs[runId]?.previewAssetKey;
  delete runs[runId];
  save({ competitionRuns: runs });
  const previewUrl = runCardObjectUrls.get(runId);
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  runCardObjectUrls.delete(runId);
  if (previewAssetKey) void deleteReferenceAsset(previewAssetKey).catch(() => {});
  document.querySelector(`.chunkcard.run-card[data-run-id="${CSS.escape(runId)}"]`)?.remove();
}
function clearCompetitionRuntime() {
  competitionReviewIndex = null;
  competitionGenerationTask = null;
  activeCompetitionRunId = null;
  competitionCandidateCache = new Map();
  competitionCompositions = null;
  competitionCreateOptions = null;
  competition = createCompetition();
  decisionHistory = [];
  experimentSnapshot = null;
  duelPayloads = { left: null, right: null };
  document.body.classList.remove("chunkPodium", "competitionLocked");
}
function resetCompetition() {
  if (competitionLocked) return;
  clearCompetitionRuntime();
  renderCompetition();
}
function rememberCompetitionDecision() {
  decisionHistory.push(structuredClone(competition));
}
/** @param {CompetitionState} state */
function applyCompetitionState(state) {
  competitionReviewIndex = null;
  competition = state;
  persistCompetition();
  document.body.classList.add("chunkStage", "chunkDuel");
  document.body.classList.toggle("chunkPodium", competition.phase === "podium");
  renderCompetition();
  requestAnimationFrame(animateDuelArrival);
}
function restoreCompetitionDecision() {
  competitionReviewIndex = null;
  const state = decisionHistory.pop();
  if (state) applyCompetitionState(state);
}
function normalizeStoredCandidate(entry) {
  if (!entry || typeof entry !== "object") return { status: "queued", src: "", fileName: "", error: null, blob: null, file: null };
  const src = typeof entry.src === "string" && !/^(blob:|data:)/i.test(entry.src) ? entry.src : "";
  return {
    status: entry.status === "ready" && src ? "ready" : entry.status === "error" ? "error" : "queued",
    src,
    fileName: entry.fileName || "",
    error: entry.error || null,
    blob: null,
    file: null
  };
}
function restoreCompetitionCandidateState(run) {
  competitionCandidateCache = new Map(competitionPlayers.map(player => [player.id, normalizeStoredCandidate(run.candidates?.[player.id])]));
}
function candidateReady(player) {
  const entry = competitionCandidateCache.get(player);
  return !!entry && entry.status === "ready" && !!entry.src;
}
const pairReady = pair => Array.isArray(pair) && pair.length === 2 && pair.every(candidateReady);
function refreshCompetitionCandidateSurfaces(player) {
  if (!document.body.classList.contains("chunkDuel")) return;
  const pair = competitionReviewIndex == null ? currentCompetitionPair() : (() => {
    const match = competition.matches[competitionReviewIndex];
    return match ? [match.left, match.right] : null;
  })();
  if (pair?.includes(player)) updateDuelCandidateState(pair);
  if (competitionCandidateCache.get(player)?.status === "ready") updateCompetitionCandidateSlots(player);
}
async function generateCompetitionCandidate(player, runId = activeCompetitionRunId) {
  if (!runId || runId !== activeCompetitionRunId) return;
  const entry = competitionCandidateCache.get(player) || normalizeStoredCandidate(null);
  competitionCandidateCache.set(player, entry);
  if (entry.status === "ready" || entry.status === "loading" || entry.status === "error") return;
  entry.status = "loading";
  entry.error = null;
  refreshCompetitionCandidateSurfaces(player);
  try {
    const shot = await requestGeneration(competitionPayload(player), { src: competitionPlayers[player].src });
    if (runId !== activeCompetitionRunId) return;
    entry.status = "ready";
    entry.src = shot.src || "";
    entry.fileName = shot.fileName || `candidate-${player + 1}.png`;
    entry.blob = shot.blob instanceof Blob ? shot.blob : null;
    entry.file = shot.file instanceof Blob ? shot.file : null;
    const record = persistCompetition();
    const binary = entry.file || entry.blob;
    if (binary && record && !record.previewAssetKey) {
      const previewAssetKey = `run-preview:${runId}`;
      try {
        await persistReferenceAsset(previewAssetKey, binary);
        if (runId === activeCompetitionRunId) {
          const runs = storedCompetitionRuns();
          if (runs[runId]) {
            runs[runId].previewAssetKey = previewAssetKey;
            runs[runId].previewFileName = entry.fileName;
            save({ competitionRuns: runs });
          }
        }
      } catch (error) { console.error("competition run preview persistence failed", error); }
    }
  }
  catch (error) {
    if (runId !== activeCompetitionRunId) return;
    entry.status = "error";
    entry.error = "생성 실패";
    persistCompetition();
    console.error("competition candidate generation failed", error);
  }
  refreshCompetitionCandidateSurfaces(player);
}
async function queueCompetitionCandidates() {
  if (competitionGenerationTask) return competitionGenerationTask;
  const runId = activeCompetitionRunId;
  if (!runId || !experimentSnapshot) return;
  const task = (async () => {
    while (runId === activeCompetitionRunId) {
      const pair = currentCompetitionPair() || [];
      const order = [...new Set([...pair, ...competitionPlayers.map(player => player.id)])];
      const player = order.find(player => {
        const entry = competitionCandidateCache.get(player);
        return !entry || entry.status === "queued" || entry.status === "ready" && !entry.src;
      });
      if (player == null) break;
      await generateCompetitionCandidate(player, runId);
    }
  })();
  competitionGenerationTask = task;
  try { await task; }
  finally { if (competitionGenerationTask === task) competitionGenerationTask = null; }
}
function retryCompetitionCandidate(player) {
  if (!Number.isInteger(player) || !activeCompetitionRunId) return;
  const entry = competitionCandidateCache.get(player) || normalizeStoredCandidate(null);
  entry.status = "queued";
  entry.error = null;
  competitionCandidateCache.set(player, entry);
  void queueCompetitionCandidates();
}
function runCardPreview(record) {
  if (activeCompetitionRunId === record.id) {
    const live = [...competitionCandidateCache.values()].find(candidate => candidate.status === "ready" && candidate.src);
    if (live?.src) return live.src;
  }
  return runPreviewSource(record) || runCardObjectUrls.get(record.id) || "";
}
function syncUnfinishedRunCard(record) {
  const grid = document.querySelector(".chunkgrid");
  const create = document.getElementById("newChunkButton");
  if (!grid || !create || !record?.id) return;
  let card = grid.querySelector(`.chunkcard.run-card[data-run-id="${CSS.escape(record.id)}"]`);
  if (!card) {
    card = document.createElement("button");
    card.type = "button";
    card.className = "chunkcard run-card";
    card.dataset.runId = record.id;
    const placeholder = document.createElement("span");
    placeholder.className = "run-placeholder";
    placeholder.textContent = "◇";
    const badge = document.createElement("span");
    badge.className = "run-badge";
    badge.textContent = "🏷";
    const name = document.createElement("span");
    name.className = "chunkname";
    name.textContent = shortName(record.seed || "실험");
    card.append(placeholder, badge, name);
    card.addEventListener("click", () => { void resumeCompetitionRun(record.id); });
    grid.insertBefore(card, create);
  }
  const preview = runCardPreview(record);
  const oldImage = card.querySelector("img");
  if (preview) {
    const image = oldImage || document.createElement("img");
    image.src = preview;
    image.alt = "";
    if (!oldImage) card.insertBefore(image, card.firstChild);
    const live = activeCompetitionRunId === record.id
      ? [...competitionCandidateCache.values()].find(candidate => candidate.status === "ready" && candidate.src) : null;
    registerImageObject(`run-preview:${record.id}`, {
      source: "chunk", label: shortName(record.seed || "실험"), caption: "미완성 작가 조합", src: preview,
      blob: live?.blob || null, file: live?.file || null, fileName: live?.fileName || record.previewFileName || `run-${record.id}.png`, meta: { runId: record.id }
    }, image);
    card.querySelector(".run-placeholder")?.remove();
  }
}
async function hydrateUnfinishedRunCardPreview(run) {
  if (!validCompetitionRun(run) || runPreviewSource(run) || !run.previewAssetKey || runCardObjectUrls.has(run.id)) return;
  try {
    const blob = await loadReferenceAsset(run.previewAssetKey);
    if (!(blob instanceof Blob) || !storedCompetitionRuns()[run.id]) return;
    const url = URL.createObjectURL(blob);
    runCardObjectUrls.set(run.id, url);
    syncUnfinishedRunCard(storedCompetitionRuns()[run.id]);
  } catch (error) { console.error("competition run preview restore failed", error); }
}
function renderUnfinishedRunCards() {
  document.querySelectorAll(".chunkcard.run-card").forEach(card => card.remove());
  const runs = Object.values(storedCompetitionRuns()).filter(validCompetitionRun)
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  runs.forEach(run => { syncUnfinishedRunCard(run); void hydrateUnfinishedRunCardPreview(run); });
}
function restoreCompetitionFromStorage(runId) {
  const run = storedCompetitionRuns()[runId];
  if (!validCompetitionRun(run)) return false;
  clearCompetitionRuntime();
  activeCompetitionRunId = run.id;
  selectedSeed = run.seed;
  save({ seedArtist: selectedSeed });
  competitionCreateOptions = run.createOptions ? normalizeChunkCreateOptions(run.createOptions) : null;
  competitionCompositions = normalizeCompetitionCompositions(run.compositions);
  // 구버전 Run에는 고정 조합 정보가 없으므로 당시의 기본 프리셋 구성을 그대로 사용한다.
  useExperimentSnapshot(run.snapshot);
  competition = structuredClone(run.state);
  decisionHistory = run.checkpoints.slice();
  restoreCompetitionCandidateState(run);
  tournamentPanelBefore = captureTournamentLayout();
  document.body.classList.remove("noL", "historyDetail");
  document.body.classList.add("chunkStage", "chunkDuel");
  document.body.classList.toggle("chunkPodium", competition.phase === "podium");
  if (competition.phase !== "podium") resetTournamentSplit();
  paintSeedSelection();
  renderSeedContext();
  syncPanelControls();
  renderCompetition();
  void queueCompetitionCandidates();
  requestAnimationFrame(animateDuelArrival);
  return true;
}
const resumeCompetitionRun = restoreCompetitionFromStorage;
function cancelCompetitionRun() {
  if (competitionLocked || !activeCompetitionRunId) return;
  if (!confirm("현재 Tournament Run과 판정 기록을 영구 삭제할까요?")) return;
  const runId = activeCompetitionRunId;
  clearCompetitionPersistence(runId);
  clearCompetitionRuntime();
  abandonTuning();
  document.body.classList.remove("chunkDuel", "chunkPodium", "chunkTune", "chunkSave");
  restoreTournamentLayout();
  tournamentPanelBefore = null;
  syncPanelControls();
  renderCompetition();
}
function buildBridgeSchedule(players) {
  const ring = shufflePlayers(players);
  return ring.map((player, index) => [player, ring[(index + 1) % ring.length]]);
}
const pairKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
const sigmoid = value => value >= 0 ? 1 / (1 + Math.exp(-value)) : Math.exp(value) / (1 + Math.exp(value));
/** @param {CompetitionMatch[]} [matches] @returns {Map<number,number>} */
function fitBradleyTerry(matches = competition.matches) {
  const evidence = matches.filter(match => !match.coin);
  const players = [...new Set(evidence.flatMap(match => [match.left, match.right]))];
  const scores = new Map(players.map(player => [player, 0]));
  if (!evidence.length) return scores;
  for (let iteration = 0; iteration < BT_ITERATIONS; iteration++) {
    const gradient = new Map(players.map(player => [player, -BT_L2 * scores.get(player)]));
    const curvature = new Map(players.map(player => [player, BT_L2]));
    for (const match of evidence) {
      const leftScore = scores.get(match.left) || 0, rightScore = scores.get(match.right) || 0;
      const probability = sigmoid(leftScore - rightScore);
      const outcome = match.winner === match.left ? 1 : 0;
      const delta = outcome - probability, info = probability * (1 - probability);
      gradient.set(match.left, (gradient.get(match.left) || 0) + delta);
      gradient.set(match.right, (gradient.get(match.right) || 0) - delta);
      curvature.set(match.left, (curvature.get(match.left) || BT_L2) + info);
      curvature.set(match.right, (curvature.get(match.right) || BT_L2) + info);
    }
    let maxStep = 0;
    for (const player of players) {
      const step = Math.max(-1, Math.min(1, gradient.get(player) / curvature.get(player)));
      scores.set(player, scores.get(player) + step);
      maxStep = Math.max(maxStep, Math.abs(step));
    }
    const mean = players.reduce((sum, player) => sum + scores.get(player), 0) / players.length;
    players.forEach(player => scores.set(player, scores.get(player) - mean));
    if (maxStep < 1e-6) break;
  }
  return scores;
}
const predictWinProbability = (left, right, scores = fitBradleyTerry()) =>
  sigmoid((scores.get(left) || 0) - (scores.get(right) || 0));
function comparisonCounts() {
  const games = new Map(competition.top8.map(player => [player, 0]));
  const pairs = new Map();
  competition.matches.filter(match => match.phase !== "knockout").forEach(match => {
    games.set(match.left, (games.get(match.left) || 0) + 1);
    games.set(match.right, (games.get(match.right) || 0) + 1);
    const key = pairKey(match.left, match.right);
    pairs.set(key, (pairs.get(key) || 0) + 1);
  });
  return { games, pairs };
}
function selectAdaptivePair() {
  const scores = fitBradleyTerry(), { games, pairs } = comparisonCounts();
  let best = null, bestScore = Infinity;
  for (let i = 0; i < competition.top8.length; i++) {
    for (let j = i + 1; j < competition.top8.length; j++) {
      const left = competition.top8[i], right = competition.top8[j];
      const repeats = pairs.get(pairKey(left, right)) || 0;
      const uncertainty = Math.abs(.5 - predictWinProbability(left, right, scores));
      const load = (games.get(left) || 0) + (games.get(right) || 0);
      const score = repeats * 100 + uncertainty + load * .005;
      if (score < bestScore) {
        bestScore = score;
        best = [left, right];
      }
    }
  }
  return best;
}
function startBridge() {
  competition.phase = "bridge";
  competition.top8 = competition.nextPlayers.slice();
  competition.bridgeQueue = buildBridgeSchedule(competition.top8);
  competition.bridgeIndex = 0;
  competition.nextPlayers = [];
}
function startAdaptive() {
  competition.phase = "adaptive";
  competition.adaptiveRemaining = ADAPTIVE_MATCHES;
  competition.adaptivePair = selectAdaptivePair();
}
function finalRanking() {
  const scores = fitBradleyTerry();
  return competition.top8.slice().sort((a, b) => (scores.get(b) || 0) - (scores.get(a) || 0) || a - b);
}
function finishCompetition() {
  const ranking = finalRanking();
  [competition.podium.first, competition.podium.second, competition.podium.third] = ranking;
  competition.phase = "podium";
  competition.adaptivePair = null;
  document.body.classList.add("chunkPodium");
}
function currentCompetitionPair() {
  if (competition.phase === "knockout") {
    const index = competition.matchIndex * 2;
    const pair = competition.roundPlayers.slice(index, index + 2);
    return pair.length === 2 ? pair : null;
  }
  if (competition.phase === "bridge")
    return competition.bridgeQueue[competition.bridgeIndex] || null;
  if (competition.phase === "adaptive")
    return competition.adaptivePair;
  return null;
}
function advanceCompetition(advance) {
  if (competition.phase === "knockout") {
    competition.nextPlayers.push(advance);
    competition.matchIndex++;
    if (competition.matchIndex < competition.roundPlayers.length / 2)
      return;
    if (competition.roundSize === 32) {
      competition.roundSize = 16;
      competition.roundPlayers = competition.nextPlayers;
      competition.nextPlayers = [];
      competition.matchIndex = 0;
      return;
    }
    startBridge();
    return;
  }
  if (competition.phase === "bridge") {
    competition.bridgeIndex++;
    if (competition.bridgeIndex >= competition.bridgeQueue.length)
      startAdaptive();
    return;
  }
  if (competition.phase === "adaptive") {
    competition.adaptiveRemaining--;
    if (competition.adaptiveRemaining <= 0) {
      finishCompetition();
      return;
    }
    competition.adaptivePair = selectAdaptivePair();
  }
}
function recordComparison(player, coin = false) {
  const pair = currentCompetitionPair();
  if (!pair || (!coin && !pair.includes(player))) return false;
  rememberCompetitionDecision();
  const knockout = competition.phase === "knockout";
  const winner = coin ? pair[Math.random() < .5 ? 0 : 1] : player;
  const advance = knockout ? winner : null;
  competition.matches.push({
    id: competition.matches.length,
    phase: competition.phase,
    left: pair[0],
    right: pair[1],
    winner,
    coin,
    advance,
    roundSize: knockout ? competition.roundSize : null
  });
  advanceCompetition(advance);
  persistCompetition();
  void queueCompetitionCandidates();
  return true;
}
function candidateImage(player) {
  const candidate = competitionCandidateCache.get(player);
  if (!candidateReady(player)) return "";
  const id = `competition:${experimentSnapshot?.id || "draft"}:${player}`;
  registerImageObject(id, {
    source: "competition", label: "비교 후보", caption: "Tournament 후보", src: candidate.src,
    blob: candidate.blob || null, file: candidate.file || null, fileName: candidate.fileName || `candidate-${player + 1}.png`,
    meta: { player, snapshotId: experimentSnapshot?.id || null, runId: activeCompetitionRunId }
  });
  return `<img class="image-object" data-image-id="${id}" src="${candidate.src}" alt="">`;
}
function competitionStageLabel() {
  if (competition.phase === "knockout") return competition.roundSize + "강";
  if (competition.phase === "bridge" || competition.phase === "adaptive") return "전체 대진";
  return "순위 확정";
}
function historyMatch(match, index) {
  const slot = player => {
    const winner = match.winner === player;
    const state = winner ? "win" : "lose";
    const coin = match.coin && winner ? '<span class="coinmark" aria-label="동전 던지기로 선택">●</span>' : "";
    return `<span class="hslot ${state}" data-player="${player}">${candidateImage(player)}${coin}</span>`;
  };
  const reviewing = competitionReviewIndex === index ? " reviewing" : "";
  return `<button type="button" class="hmatch${reviewing}" data-match-index="${index}" aria-label="${index + 1}번째 판정 다시 보기"><span class="hstep">${index + 1}</span>${slot(match.left)}<span class="hvs">◇</span>${slot(match.right)}</button>`;
}
function renderHistory() {
  const host = document.getElementById("matchHistory");
  if (!competition.matches.length) {
    host.innerHTML = '<div class="history-empty" role="img" aria-label="아직 판정 기록이 없습니다"><span aria-hidden="true"></span></div>';
    return;
  }
  const later = competitionReviewIndex == null ? 0 : competition.matches.length - competitionReviewIndex - 1;
  const warning = competitionReviewIndex == null ? "" : `<div class="competition-review-warning" role="status"><b>${competitionReviewIndex + 1}번째 판정 재검토</b> · ${later ? `다시 선택하면 이후 ${later}개 판정이 삭제됩니다.` : "이 판정을 다시 선택할 수 있습니다."}</div>`;
  host.innerHTML = warning + competition.matches.map((match, index) => historyMatch(match, index)).reverse().join("");
}
function prependLatestHistoryMatch() {
  const host = document.getElementById("matchHistory");
  const index = competition.matches.length - 1;
  const match = competition.matches[index];
  if (!host || !match) return;
  host.querySelector(".history-empty")?.remove();
  host.querySelector(`[data-match-index="${index}"]`)?.remove();
  host.insertAdjacentHTML("afterbegin", historyMatch(match, index));
}
function reviewCompetitionMatch(index) {
  if (!Number.isInteger(index) || index < 0 || index >= competition.matches.length || !decisionHistory[index]) return;
  competitionReviewIndex = competitionReviewIndex === index ? null : index;
  renderHistory();
  renderDuel();
}
function reviseCompetitionMatch(player, coin = false, button = null) {
  const index = competitionReviewIndex;
  if (index == null || !decisionHistory[index]) return;
  const later = competition.matches.length - index - 1;
  if (later > 0 && !confirm(`${index + 1}번째 판정을 변경하면 이후 ${later}개 판정이 삭제됩니다. 계속할까요?`)) return;
  const base = structuredClone(decisionHistory[index]);
  decisionHistory = decisionHistory.slice(0, index);
  competitionReviewIndex = null;
  competition = base;
  submitCompetitionResult(player, coin, button, true);
}

function setDuelCandidate(button, image, player, enabled) {
  const host = button.closest(".duelcandidate");
  delete button.dataset.candidate;
  delete button.dataset.retryCandidate;
  host.classList.remove("candidate-pending", "candidate-error");
  const state = host.querySelector(".candidate-state");
  host.classList.toggle("empty", player == null);
  if (state) state.textContent = "";
  if (player == null) {
    button.disabled = true;
    image.removeAttribute("src");
    image.alt = "";
    return;
  }
  const candidate = competitionCandidateCache.get(player) || normalizeStoredCandidate(null);
  if (!candidateReady(player)) {
    image.removeAttribute("src");
    image.alt = "";
    host.classList.remove("empty");
    if (candidate.status === "error") {
      host.classList.add("candidate-error");
      button.disabled = false;
      button.dataset.retryCandidate = player;
      if (state) state.textContent = "생성 실패 · 클릭 재시도";
    } else {
      host.classList.add("candidate-pending");
      button.disabled = true;
      if (state) state.textContent = candidate.error || "생성 중…";
    }
    return;
  }
  button.disabled = !enabled;
  image.src = candidate.src;
  image.alt = "비교 후보";
  registerImageObject(`competition:${experimentSnapshot?.id || "draft"}:${player}`, {
    source: "competition", label: "비교 후보", caption: "Tournament 후보", src: candidate.src,
    blob: candidate.blob || null, file: candidate.file || null, fileName: candidate.fileName || `candidate-${player + 1}.png`,
    meta: { player, snapshotId: experimentSnapshot?.id || null, runId: activeCompetitionRunId }
  }, image);
  if (enabled) button.dataset.candidate = player;
}
function updateDuelCandidateState(pair) {
  if (!Array.isArray(pair) || pair.length !== 2) return;
  const left = document.getElementById("duelLeftPick"), right = document.getElementById("duelRightPick");
  const leftImage = document.getElementById("duelLeftImage"), rightImage = document.getElementById("duelRightImage");
  const ready = pairReady(pair);
  setDuelCandidate(left, leftImage, pair[0], ready);
  setDuelCandidate(right, rightImage, pair[1], ready);
  document.getElementById("duelAlt").disabled = !ready;
  renderDuelCompositions();
}
function renderDuel() {
  const left = document.getElementById("duelLeftPick"), right = document.getElementById("duelRightPick");
  const leftImage = document.getElementById("duelLeftImage"), rightImage = document.getElementById("duelRightImage");
  const reviewed = competitionReviewIndex == null ? null : competition.matches[competitionReviewIndex];
  const pair = reviewed ? [reviewed.left, reviewed.right] : currentCompetitionPair();
  if (pair) {
    duelPayloads = experimentSnapshot
      ? { left: competitionPayload(pair[0]), right: competitionPayload(pair[1]) }
      : { left: null, right: null };
    updateDuelCandidateState(pair);
    return;
  }
  duelPayloads = { left: experimentSnapshot && competition.podium.first != null ? competitionPayload(competition.podium.first) : null, right: null };
  setDuelCandidate(left, leftImage, competition.podium.first, false);
  setDuelCandidate(right, rightImage, null, false);
  renderDuelCompositions();
}
function competitionStatus() {
  const stage = competitionStageLabel();
  if (competition.phase === "knockout") return `<b>${stage}</b> · ${competition.matchIndex + 1}/${competition.roundPlayers.length / 2}`;
  if (competition.phase === "bridge") return `<b>전체 대진</b> · ${competition.bridgeIndex + 1}/${BRIDGE_MATCHES + ADAPTIVE_MATCHES}`;
  if (competition.phase === "adaptive") return `<b>전체 대진</b> · ${BRIDGE_MATCHES + (ADAPTIVE_MATCHES - competition.adaptiveRemaining + 1)}/${BRIDGE_MATCHES + ADAPTIVE_MATCHES}`;
  return `<b>순위 확정</b>`;
}
function renderCompetition({ history = true } = {}) {
  if (history) renderHistory();
  renderDuel();
  renderPodium();
  const topStatus = document.getElementById("competitionStatus");
  if (topStatus) topStatus.innerHTML = competitionStatus();
  const undoButton = document.getElementById("sideDuelUndo");
  if (undoButton) undoButton.disabled = decisionHistory.length === 0;
  const altButton = document.getElementById("duelAlt");
  altButton.textContent = "◉ 동전 던지기";
  altButton.title = "선호를 기록하지 않고 무작위로 한 후보를 선택";
  const activePair = competitionReviewIndex == null ? currentCompetitionPair() : (() => {
    const match = competition.matches[competitionReviewIndex];
    return match ? [match.left, match.right] : null;
  })();
  altButton.disabled = !pairReady(activePair);
  syncSidebarExperiment();
}
function podiumRow(rank, player) {
  if (player == null) return `<div class="prow pending"><span class="prank">${rank}</span></div>`;
  return `<div class="prow${rank === 1 ? " gold" : ""}"><span class="prank">${rank}</span>${candidateImage(player)}</div>`;
}
function renderPodium() {
  if (competition.phase !== "podium")
    return;
  const body = document.getElementById("podiumBody"), foot = document.getElementById("podiumFoot");
  body.innerHTML = podiumRow(1, competition.podium.first) + podiumRow(2, competition.podium.second) + podiumRow(3, competition.podium.third);
  const tree = podiumTree();
  const size = `작가 ${flattenInto(tree, 1, new Map()).size}`;
  foot.innerHTML = `<button class="genbtn" id="goTune">가중치 조율 <span style="opacity:.7">${size}</span></button>`;
  document.getElementById("goTune").onclick = startTuning;
}
function animateDuelArrival() {
  if (reducedMotion || !document.body.classList.contains("chunkDuel") || !currentCompetitionPair())
    return;
  const left = document.getElementById("duelLeftPick"), right = document.getElementById("duelRightPick");
  left.animate([{ opacity: .15, transform: "translateX(-22px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: 220, easing: "ease-out" });
  right.animate([{ opacity: .15, transform: "translateX(22px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: 220, easing: "ease-out" });
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function submitCompetitionResult(player, coin = false, button = null, fullHistoryRender = false) {
  const pair = currentCompetitionPair();
  if (competitionLocked || !pair || !pairReady(pair) || (!coin && !pair.includes(player)))
    return;
  competitionLocked = true;
  document.body.classList.add("competitionLocked");
  let accepted = false;
  try {
    if (!coin && button && !reducedMotion) {
      const other = button.id === "duelLeftPick" ? document.getElementById("duelRightPick") : document.getElementById("duelLeftPick");
      button.closest(".duelcandidate").classList.add("choice-win");
      other.closest(".duelcandidate").classList.add("choice-lose");
      await wait(180);
      button.closest(".duelcandidate").classList.remove("choice-win");
      other.closest(".duelcandidate").classList.remove("choice-lose");
    }
    accepted = recordComparison(player, coin);
    if (accepted) {
      if (fullHistoryRender)
        renderCompetition();
      else {
        prependLatestHistoryMatch();
        renderCompetition({ history: false });
      }
    }
    if (reducedMotion || coin)
      await wait(80);
  }
  finally {
    competitionLocked = false;
    document.body.classList.remove("competitionLocked");
  }
  if (accepted && competition.phase !== "podium")
    requestAnimationFrame(animateDuelArrival);
}
function handleDuelPick(button) {
  if (document.body.classList.contains("chunkTune")) {
    const retrySide = button.dataset.retryTune;
    if (retrySide) {
      retryTuneCandidate(retrySide);
      return;
    }
    animateTuneChoice(button);
    return;
  }
  const retry = Number(button.dataset.retryCandidate);
  if (Number.isInteger(retry)) {
    retryCompetitionCandidate(retry);
    return;
  }
  const player = Number(button.dataset.candidate);
  if (!Number.isInteger(player)) return;
  if (competitionReviewIndex != null) reviseCompetitionMatch(player, false, button);
  else submitCompetitionResult(player, false, button);
}
function handleTie() {
  if (document.body.classList.contains("chunkSave")) return;
  if (document.body.classList.contains("chunkTune")) {
    markTuneIndistinguishable();
    return;
  }
  const pair = competitionReviewIndex == null ? currentCompetitionPair() : (() => {
    const match = competition.matches[competitionReviewIndex];
    return match ? [match.left, match.right] : null;
  })();
  if (!pairReady(pair)) return;
  if (competitionReviewIndex != null) reviseCompetitionMatch(null, true);
  else submitCompetitionResult(null, true);
}
document.getElementById("duelLeftPick").addEventListener("click", e => handleDuelPick(e.currentTarget));
document.getElementById("duelRightPick").addEventListener("click", e => handleDuelPick(e.currentTarget));
document.getElementById("duelAlt").addEventListener("click", handleTie);
addEventListener("keydown", e => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const duel = document.body.classList.contains("chunkDuel");
  const tuneMode = document.body.classList.contains("chunkTune");
  if (duel && (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (!competitionLocked) restoreCompetitionDecision();
    return;
  }
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const comparing = duel || tuneMode;
  if (!comparing || document.body.classList.contains("chunkSave") || document.body.classList.contains("chunkPodium")) return;
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    handleDuelPick(document.getElementById("duelLeftPick"));
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    handleDuelPick(document.getElementById("duelRightPick"));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    handleTie();
  }
});
document.getElementById("matchHistory").addEventListener("click", event => {
  const row = event.target.closest("[data-match-index]");
  if (row) reviewCompetitionMatch(Number(row.dataset.matchIndex));
});
function startCompetition() {
  if (!selectedSeed || competitionLocked) return;
  closeDetailCompare(true);
  abandonTuning();
  clearCompetitionRuntime();
  activeCompetitionRunId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  competitionCreateOptions = readChunkCreateOptions(true);
  competitionCompositions = buildCompetitionCompositions(competitionCreateOptions);
  competition = createCompetition();
  decisionHistory = [];
  useExperimentSnapshot(captureExperimentSnapshot());
  competitionCandidateCache = new Map();
  document.querySelectorAll(".chunkcard[data-chunk]").forEach(card => card.classList.remove("selected"));
  tournamentPanelBefore = captureTournamentLayout();
  document.body.classList.remove("noL", "historyDetail");
  document.body.classList.add("chunkStage", "chunkDuel");
  resetTournamentSplit();
  syncPanelControls();
  persistCompetition();
  renderCompetition();
  void queueCompetitionCandidates();
}
const chunkByName = new Map();
document.querySelectorAll(".chunkcard[data-chunk]").forEach(card => chunkByName.set(card.querySelector(".chunkname").firstChild.textContent.trim(), card.dataset.chunk));
function basePlayerComposition(player) {
    const p = competitionPlayers[player];
    if (!p) return [];
    const key = chunkByName.get(p.name);
    const rows = key ? chunkRows(chunkLibrary[key]) : defaultChunkPreset[p.name] || [];
    const members = rows.map(r => ({ name: r[0], w: Number(r[1]) }));
    const seed = selectedSeed ? shortName(selectedSeed) : null;
    if (seed && !members.some(m => m.name.toLowerCase() === seed.toLowerCase()))
        members.unshift({ name: seed, w: 1 });
    return members;
}
function shuffleCompetitionMembers(members) {
    const out = cloneCompetitionMembers(members);
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
function randomCompetitionWeight(min, max) {
    // UI가 0.1 단위이므로 실제 난수도 같은 격자를 사용한다.
    const lowStep = Math.ceil(min * 10 - 1e-9);
    const highStep = Math.floor(max * 10 + 1e-9);
    if (highStep < lowStep) return Math.round(min * 10) / 10;
    return (lowStep + Math.floor(Math.random() * (highStep - lowStep + 1))) / 10;
}
function buildCompetitionCompositions(options) {
    const out = {};
    competitionPlayers.forEach(player => {
        let members = basePlayerComposition(player.id);
        if (options.shuffleOrder) members = shuffleCompetitionMembers(members);
        else members = cloneCompetitionMembers(members);
        if (options.randomWeights) {
            members = members.map(member => ({
                ...member,
                w: randomCompetitionWeight(options.weightMin, options.weightMax)
            }));
        }
        out[player.id] = members;
    });
    return out;
}
function playerComposition(player) {
    const frozen = competitionCompositions?.[player];
    return frozen?.length ? cloneCompetitionMembers(frozen) : basePlayerComposition(player);
}
function openArtistExperiment() {
  if (!selectedSeed) return;
  document.body.classList.remove("historyDetail");
  closeDetailCompare(true);
  resetCompetition();
  document.body.classList.add("chunkStage");
  document.body.classList.remove("chunkDuel");
  showPanels("noF", "noR");
  renderUnfinishedRunCards();
}
document.getElementById("chunkStart").onclick = openArtistExperiment;
document.getElementById("newChunkButton").onclick = startCompetition;
const chunkShuffleToggle = document.getElementById("chunkShuffleToggle");
const chunkWeightToggle = document.getElementById("chunkWeightToggle");
const chunkWeightMin = document.getElementById("chunkWeightMin");
const chunkWeightMax = document.getElementById("chunkWeightMax");
function normalizeChunkCreateOptions(source = {}) {
  const shuffleOrder = source.shuffleOrder !== false;
  const randomWeights = source.randomWeights !== false;
  let weightMin = Number(source.weightMin);
  let weightMax = Number(source.weightMax);
  if (!Number.isFinite(weightMin)) weightMin = .8;
  if (!Number.isFinite(weightMax)) weightMax = 1.8;
  weightMin = Math.min(HARD, Math.max(0, Math.round(weightMin * 10) / 10));
  weightMax = Math.min(HARD, Math.max(0, Math.round(weightMax * 10) / 10));
  if (weightMin > weightMax) [weightMin, weightMax] = [weightMax, weightMin];
  return { shuffleOrder, randomWeights, weightMin, weightMax };
}
function readChunkCreateOptions(writeBack = false) {
  const options = normalizeChunkCreateOptions({
    shuffleOrder: !!chunkShuffleToggle?.checked,
    randomWeights: !!chunkWeightToggle?.checked,
    weightMin: chunkWeightMin?.value,
    weightMax: chunkWeightMax?.value
  });
  if (writeBack) {
    if (chunkShuffleToggle) chunkShuffleToggle.checked = options.shuffleOrder;
    if (chunkWeightToggle) chunkWeightToggle.checked = options.randomWeights;
    if (chunkWeightMin) chunkWeightMin.value = options.weightMin.toFixed(1);
    if (chunkWeightMax) chunkWeightMax.value = options.weightMax.toFixed(1);
    save({ chunkCreateOptions: options });
  }
  return options;
}
function syncChunkCreateUi(persist = false) {
  const enabled = !!chunkWeightToggle?.checked;
  if (chunkWeightMin) chunkWeightMin.disabled = !enabled;
  if (chunkWeightMax) chunkWeightMax.disabled = !enabled;
  if (persist) readChunkCreateOptions(true);
}
const storedChunkCreateOptions = normalizeChunkCreateOptions(load().chunkCreateOptions || {});
if (chunkShuffleToggle) chunkShuffleToggle.checked = storedChunkCreateOptions.shuffleOrder;
if (chunkWeightToggle) chunkWeightToggle.checked = storedChunkCreateOptions.randomWeights;
if (chunkWeightMin) chunkWeightMin.value = storedChunkCreateOptions.weightMin.toFixed(1);
if (chunkWeightMax) chunkWeightMax.value = storedChunkCreateOptions.weightMax.toFixed(1);
chunkShuffleToggle?.addEventListener("change", () => syncChunkCreateUi(true));
chunkWeightToggle?.addEventListener("change", () => syncChunkCreateUi(true));
chunkWeightMin?.addEventListener("change", () => syncChunkCreateUi(true));
chunkWeightMax?.addEventListener("change", () => syncChunkCreateUi(true));
syncChunkCreateUi(false);
function returnToChunkSelection() {
  if (activeCompetitionRunId) persistCompetition();
  abandonTuning();
  document.body.classList.remove("chunkDuel", "chunkPodium", "chunkTune", "chunkSave");
  restoreTournamentLayout();
  tournamentPanelBefore = null;
  clearCompetitionRuntime();
  syncPanelControls();
  renderUnfinishedRunCards();
  renderCompetition();
}
document.getElementById("duelExit").onclick = returnToChunkSelection;
document.getElementById("sideDuelExit").onclick = returnToChunkSelection;
document.getElementById("sideDuelUndo").onclick = () => { if (!competitionLocked) restoreCompetitionDecision(); };
document.getElementById("sideDuelCancel").onclick = event => { event.currentTarget.closest("details").open = false; void cancelCompetitionRun(); };
document.getElementById("podiumBack").onclick = returnToChunkSelection;
document.getElementById("chunkBack").onclick = () => {
  document.body.classList.remove("historyDetail");
  resetCompetition();
  abandonTuning();
  document.body.classList.remove("chunkStage", "chunkDuel");
};

const NAME_ADJ=["다정한", "온화한", "활발한", "차분한", "용감한", "신중한", "꼼꼼한", "솔직한", "성실한", "너그러운", "털털한", "대범한", "소심한", "얌전한", "명랑한", "냉정한", "친절한", "정직한", "온순한", "사나운", "급한", "둔한", "예민한", "꿋꿋한", "씩씩한", "상냥한", "침착한", "까다로운", "관대한", "겸손한", "거만한", "냉철한", "쾌활한", "게으른", "부지런한", "고집스러운", "순수한", "드센", "자상한", "묵직한", "엉뚱한", "당돌한", "대담한", "조용한", "변덕스러운", "우직한", "강직한", "호탕한", "능청스러운", "다정다감한"];
const NAME_NOUN=["호랑이", "사자", "늑대", "여우", "곰", "코끼리", "기린", "얼룩말", "하마", "코뿔소", "토끼", "다람쥐", "너구리", "고슴도치", "수달", "사슴", "노루", "고양이", "개", "소", "말", "양", "염소", "돼지", "캥거루", "코알라", "판다", "원숭이", "침팬지", "고릴라", "족제비", "비버", "카피바라", "오리너구리", "알파카", "치타", "표범", "재규어", "하이에나", "펭귄", "물개", "바다사자", "고래", "돌고래", "두더지", "미어캣", "나무늘보", "라쿤", "낙타", "오소리", "오랑우탄", "보노보", "서벌", "퓨마", "스컹크", "아르마딜로", "개미핥기", "왈라비", "쿼카", "웜뱃", "청설모", "당나귀", "순록", "바다코끼리", "듀공", "순록", "퓨마", "티라노사우루스", "트리케라톱스", "브라키오사우루스", "스테고사우루스", "벨로키랍토르", "안킬로사우루스", "스피노사우루스", "파라사우롤로푸스", "파키케팔로사우루스", "알로사우루스", "이구아노돈", "아파토사우루스", "데이노니쿠스"];
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const randomCombinationName = () => pickOne(NAME_ADJ) + " " + pickOne(NAME_NOUN);
const TUNE_STEP0 = .2, GRID = .05;
/** @typedef {{kind:"artist",tag:string,weight:number}} ArtistNode */
/** @typedef {{kind:"chunk",name:string,children:Array<CompositionNode>,weight:number,fromId:(string|null)}} ChunkNode */
/** @typedef {ArtistNode|ChunkNode} CompositionNode */
/** @typedef {"pending"|"active"|"tuned"|"jnd"|"skipped"} TuneStatus */
/** @typedef {{node:ArtistNode,isChunk:false,name:string,baseWeight:number,step:number,dir:number,reversals:number,status:TuneStatus,resolution:(number|null),uncertainStep:(number|null),uncertainAtStep:number}} TuneAxis */
const onGrid = v => Math.round(v / GRID) * GRID;
const clampNodeW = (v, node) => Math.min(HARD, Math.max(node?.kind === "artist" ? floorW() : 0, v));
const stepDown = s => Math.floor((s / 2) / GRID + 1e-9) * GRID;
let tune = null;
function podiumTree() {
    const places = [competition.podium.first, competition.podium.second, competition.podium.third].filter(p => p != null);
    const children = places.map((player, i) => {
        const scale = [1, .8, .6][i] ?? .6;
        const p = competitionPlayers[player];
        return chunkNode(p.name, playerComposition(player).map(m => artistNode("artist:" + m.name, onGrid(clampNodeW(m.w, { kind: "artist" })))), onGrid(scale), null);
    });
    return chunkNode(competitionPlayers[competition.podium.first].name + " 조합", children, 1, null);
}
/** @param {CompositionNode|null|undefined} node @param {ArtistNode[]} out @returns {ArtistNode[]} */
function collectArtistLeaves(node, out = []) {
    if (!node)
        return out;
    if (node.kind === "artist") {
        out.push(node);
        return out;
    }
    (node.children || []).forEach(child => collectArtistLeaves(child, out));
    return out;
}
/** @param {CompositionNode} root @param {number[]} focus @returns {TuneAxis[]} */
function tuneAxesFromFocus(root, focus = []) {
    const node = nodeAtRoot(root, focus) || root;
    return collectArtistLeaves(node).map(artist => {
        artist.weight = onGrid(clampNodeW(artist.weight, artist));
        return {
            node: artist,
            isChunk: false,
            name: shortName(artist.tag),
            baseWeight: artist.weight,
            step: TUNE_STEP0,
            dir: 1,
            reversals: 0,
            status: "pending",
            resolution: null,
            uncertainStep: null,
            uncertainAtStep: 0
        };
    });
}
/** @param {TuneAxis} a @returns {string} */
const axisColor = a => a.isChunk ? "var(--accent)" : colorOf(a.node.tag);
/** @param {TuneAxis} a @returns {number} */
const axisWeight = a => a.node.weight;
/** @param {TuneAxis} a @returns {boolean} */
const axisDone = a => a.status === "tuned" || a.status === "jnd" || a.status === "skipped";
let tuneSessionSeq = 0, tuneImageSeq = 0;
function startTuning() {
    closeDetailCompare(true);
    if (!experimentSnapshot)
        useExperimentSnapshot(captureExperimentSnapshot());
    const champion = competition.podium.first;
    if (champion == null)
        return;
    competition.podium.first = champion;
    const draft = podiumTree();
    tune = {
        sessionId: ++tuneSessionSeq,
        champion,
        draft,
        axes: tuneAxesFromFocus(draft),
        trials: [],
        cursor: 0,
        pair: null,
        candidateCache: new Map(),
        finalShot: null,
        saveName: ""
    };
    advanceAxis(true);
    document.body.classList.remove("chunkDuel", "chunkSave", "chunkPodium");
    document.body.classList.add("chunkStage", "chunkTune");
    showPanels("noF", "noR");
    renderTuning();
    syncSidebarExperiment();
    if (!tune.pair)
        openSave();
}
function abandonTuning() {
    tune = null;
    document.body.classList.remove("chunkTune", "chunkSave");
}
function commitTuningDraft() {
    return tune ? tune.draft : null;
}
function buildPair() {
    const a = tune.axes[tune.cursor];
    tune.pair = null;
    if (!a || axisDone(a))
        return;
    const hold = axisWeight(a);
    let probe = onGrid(clampNodeW(hold + a.dir * a.step, a.node));
    if (probe === hold) {
        a.dir = -a.dir;
        probe = onGrid(clampNodeW(hold + a.dir * a.step, a.node));
    }
    if (probe === hold) {
        a.status = "tuned";
        return;
    }
    a.status = "active";
    tune.pair = { axis: tune.cursor, hold, probe, probeLeft: Math.random() < .5 };
}
function advanceAxis(reset) {
    if (reset)
        tune.cursor = 0;
    for (let n = 0; n < tune.axes.length; n++) {
        const i = (tune.cursor + n) % tune.axes.length;
        if (axisDone(tune.axes[i]))
            continue;
        tune.cursor = i;
        buildPair();
        if (tune.pair)
            return;
    }
    tune.pair = null;
}
function tuneTrialBase(action, pair, a) {
    return {
        action,
        axis: pair?.axis ?? tune.cursor,
        name: a.name,
        isChunk: a.isChunk,
        step: a.step,
        prevWeight: axisWeight(a),
        prevDir: a.dir,
        prevReversals: a.reversals,
        prevResolution: a.resolution,
        prevUncertainStep: a.uncertainStep,
        prevUncertainAtStep: a.uncertainAtStep,
        prevStep: a.step,
        prevStatus: a.status,
        prevPair: tune.pair ? { ...tune.pair } : null
    };
}
function continueTuningAfterDecision() {
  const previousAxis = tune.pair?.axis ?? tune.cursor;
  advanceAxis(false);
  const nextAxis = tune.pair?.axis;
  renderTuning({ floorAxes: [previousAxis, nextAxis].filter(Number.isInteger), logMode: "latest" });
  if (!tune.pair) openSave();
}
function decideTune(chosenLeft) {
    const pair = tune.pair;
    if (!pair || !tunePairReady())
        return;
    const a = tune.axes[pair.axis];
    const tookProbe = chosenLeft === pair.probeLeft;
    const trial = tuneTrialBase(tookProbe ? "choose-probe" : "choose-hold", pair, a);
    trial.kept = tookProbe ? pair.probe : pair.hold;
    trial.dropped = tookProbe ? pair.hold : pair.probe;
    tune.trials.push(trial);
    a.uncertainStep = null;
    a.uncertainAtStep = 0;
    if (tookProbe) {
        a.node.weight = pair.probe;
    }
    else {
        a.dir = -a.dir;
        a.reversals++;
    }
    a.status = "pending";
    if (a.reversals >= 2) {
        const next = stepDown(a.step);
        if (next < GRID - 1e-9)
            a.status = "tuned";
        else {
            a.step = next;
            a.reversals = 0;
        }
    }
    continueTuningAfterDecision();
}
function markTuneIndistinguishable() {
    const pair = tune.pair;
    if (!pair || !tunePairReady())
        return;
    const a = tune.axes[pair.axis];
    const trial = tuneTrialBase("indistinguishable", pair, a);
    trial.hold = pair.hold;
    trial.probe = pair.probe;
    tune.trials.push(trial);
    if (a.uncertainStep !== a.step) {
        a.uncertainStep = a.step;
        a.uncertainAtStep = 0;
    }
    a.uncertainAtStep++;
    if (a.uncertainAtStep >= 2) {
        a.status = "jnd";
        a.resolution = a.step;
    }
    else {
        a.status = "pending";
    }
    continueTuningAfterDecision();
}
function undoTune() {
    const trial = tune.trials.pop();
    if (!trial)
        return;
    const a = tune.axes[trial.axis];
    a.node.weight = trial.prevWeight;
    a.dir = trial.prevDir;
    a.reversals = trial.prevReversals;
    a.step = trial.prevStep ?? trial.step;
    a.resolution = trial.prevResolution ?? null;
    a.uncertainStep = trial.prevUncertainStep ?? null;
    a.uncertainAtStep = trial.prevUncertainAtStep ?? 0;
    a.status = trial.prevStatus ?? "pending";
    tune.cursor = trial.axis;
    tune.pair = trial.prevPair ? { ...trial.prevPair } : null;
    tune.finalShot = null;
    if (!tune.pair && !axisDone(a))
        buildPair();
    document.body.classList.remove("chunkSave");
    renderTuning();
}
function skipAxis() {
    const a = tune.axes[tune.cursor];
    if (!a || !tune.pair)
        return;
    tune.trials.push(tuneTrialBase("skip", tune.pair, a));
    a.status = "skipped";
    a.resolution = null;
    continueTuningAfterDecision();
}
function tuneRange() {
    let mx = 1, mn = 0;
    const eat = v => { if (v > mx)
        mx = v; if (v < mn)
        mn = v; };
    tune.axes.forEach(a => { eat(axisWeight(a)); eat(a.baseWeight); });
    tune.trials.forEach(t => {
        if (Number.isFinite(t.kept))
            eat(t.kept);
        if (Number.isFinite(t.dropped))
            eat(t.dropped);
        if (Number.isFinite(t.hold))
            eat(t.hold);
        if (Number.isFinite(t.probe))
            eat(t.probe);
    });
    if (tune.pair) {
        eat(tune.pair.hold);
        eat(tune.pair.probe);
    }
    const pad = Math.max((mx - mn) * .15, .25);
    return { lo: Math.max(-HARD, Math.floor((mn - pad) * 2) / 2), hi: Math.min(HARD, Math.ceil((mx + pad) * 2) / 2) };
}
let tuneFloorRangeKey = "";
function paintTuneAxis(bar, name, a, i, pc, zero) {
  const live = tune.pair?.axis === i;
  const currentWeight = axisWeight(a), p = pc(currentWeight), neg = currentWeight < 0;
  const statusLabel = { pending: "대기", active: "조율 중", tuned: "조율 완료", jnd: "구분 한계", skipped: "건너뜀" }[a.status] || a.status;
  const seen = new Map();
  tune.trials.filter(t => t.axis === i).forEach(t => {
    if (Number.isFinite(t.dropped)) seen.set(t.dropped, seen.get(t.dropped) || false);
    if (Number.isFinite(t.kept)) seen.set(t.kept, true);
  });
  let ghosts = "";
  seen.forEach((kept, v) => {
    if (Math.abs(v - currentWeight) >= 1e-9) ghosts += `<span class="tghost${kept ? " kept" : ""}" style="bottom:${pc(v)}%"></span>`;
  });
  const probes = live ? `<span class="tprobe hold" style="bottom:${pc(tune.pair.hold)}%"><span>지금 ${tune.pair.hold.toFixed(2)}</span></span><span class="tprobe" style="bottom:${pc(tune.pair.probe)}%"><span>후보 ${tune.pair.probe.toFixed(2)}</span></span>` : "";
  bar.className = `tunebar ${a.status}${neg ? " neg" : ""}${live ? " live" : ""}`;
  bar.style.setProperty("--c", axisColor(a));
  bar.title = `${a.name} · ${statusLabel} · 눌러서 이 축부터 다시`;
  bar.innerHTML = ghosts + `<span class="tstem" style="${neg ? `top:${100 - zero}%;height:${zero - p}%` : `bottom:${zero}%;height:${p - zero}%`}"></span><span class="tval" style="bottom:calc(${p}% ${neg ? "- 14px" : "+ 2px"})">${currentWeight.toFixed(2)}</span>` + probes;
  name.textContent = a.name;
  name.title = a.name;
  name.className = live ? "live" : a.status;
  name.style.setProperty("--c", axisColor(a));
}
function renderTuneFloor(axisIndices = null) {
  const { lo, hi } = tuneRange(), pc = v => (v - lo) / (hi - lo) * 100;
  const host = document.getElementById("tuneBars"), names = document.getElementById("tuneNames");
  const rangeKey = `${tune.sessionId}:${lo}:${hi}`;
  const bars = host.querySelectorAll(".tunebar");
  const full = !axisIndices || rangeKey !== tuneFloorRangeKey || bars.length !== tune.axes.length;
  if (full) {
    const ticks = document.getElementById("tuneTicks"), tickFragment = document.createDocumentFragment();
    for (let v = Math.ceil(lo * 2) / 2; v <= hi + .001; v += .5) {
      const line = document.createElement("div"), label = document.createElement("span");
      line.className = "tickline" + (Math.abs(v) < 1e-9 || Math.abs(v - 1) < 1e-9 ? " major" : "");
      line.style.bottom = pc(v) + "%";
      label.className = "ticklabel";
      label.style.bottom = pc(v) + "%";
      label.textContent = Math.abs(v) < 1e-9 ? "0" : v.toFixed(1);
      tickFragment.append(line, label);
    }
    ticks.replaceChildren(tickFragment);
    bars.forEach(bar => bar.remove());
    names.replaceChildren();
    tune.axes.forEach((a, i) => {
      const bar = document.createElement("div"), name = document.createElement("span");
      bar.dataset.axis = i;
      host.appendChild(bar);
      names.appendChild(name);
      paintTuneAxis(bar, name, a, i, pc, pc(0));
    });
  } else {
    [...new Set(axisIndices)].forEach(i => {
      if (!Number.isInteger(i) || !tune.axes[i]) return;
      const bar = host.querySelector(`.tunebar[data-axis="${i}"]`), name = names.children[i];
      if (bar && name) paintTuneAxis(bar, name, tune.axes[i], i, pc, pc(0));
    });
  }
  tuneFloorRangeKey = rangeKey;
}
function tuneCurrentLogRow() {
  if (!tune.pair) return "";
  const a = tune.axes[tune.pair.axis];
  return `<div class="tunerow current" style="--c:${axisColor(a)}"><span class="tname">${esc(a.name)}</span><span class="tstepmark">±${a.step.toFixed(2)}</span><span class="tpair">판정 대기 <span class="tarrow">·</span> A / B</span></div>`;
}
function tuneTrialLogRow(t, index) {
  const pair = t.action === "skip" ? `<span class="tarrow">⇥</span><span>스킵됨</span>`
    : t.action === "indistinguishable" ? `<span class="tarrow">≈</span><span>${t.hold.toFixed(2)} / ${t.probe.toFixed(2)} 구분 어려움</span>`
    : `<b>${t.kept.toFixed(2)}</b><span class="tarrow">◇</span><s>${t.dropped.toFixed(2)}</s>`;
  return `<div class="tunerow${t.action === "indistinguishable" ? " indistinguishable" : ""}" data-trial-index="${index}" style="--c:${t.isChunk ? "var(--accent)" : colorOf("artist:" + t.name)}"><span class="tname">${esc(t.name)}</span><span class="tstepmark">±${t.step.toFixed(2)}</span><span class="tpair">${pair}</span></div>`;
}
function renderTuneLog(mode = "full") {
  const host = document.getElementById("tuneLog");
  if (mode === "full") {
    const rows = [];
    if (tune.pair) rows.push(tuneCurrentLogRow());
    for (let i = tune.trials.length - 1; i >= 0; i--) rows.push(tuneTrialLogRow(tune.trials[i], i));
    host.innerHTML = rows.join("") || `<div class="tunehint">아직 판정이 없다.<br>두 이미지 중 마음에 드는 쪽을 고르면<br>현재 축의 가중치가 그쪽으로 움직인다.</div>`;
  } else {
    host.querySelector(".tunerow.current")?.remove();
    host.querySelector(".tunehint")?.remove();
    if (mode === "latest" && tune.trials.length) {
      const index = tune.trials.length - 1;
      host.querySelector(`[data-trial-index="${index}"]`)?.remove();
      host.insertAdjacentHTML("afterbegin", tuneTrialLogRow(tune.trials[index], index));
    }
    const current = tuneCurrentLogRow();
    if (current) host.insertAdjacentHTML("afterbegin", current);
    if (!host.children.length) host.innerHTML = `<div class="tunehint">아직 판정이 없다.<br>두 이미지 중 마음에 드는 쪽을 고르면<br>현재 축의 가중치가 그쪽으로 움직인다.</div>`;
  }
  document.getElementById("tuneCount").textContent = tune.trials.length;
}
function clearTuneCandidateElement(button, image) {
    const host = button.closest(".duelcandidate");
    delete button.dataset.retryTune;
    host.classList.remove("empty", "candidate-pending", "candidate-error");
    const state = host.querySelector(".candidate-state");
    if (state)
        state.textContent = "";
    image.removeAttribute("src");
    image.alt = "";
    delete image.dataset.imageId;
    image.classList.remove("image-object", "compare-selected");
}
function tunePairBundle() {
    if (!tune?.pair)
        return null;
    const { hold, probe, probeLeft, axis } = tune.pair;
    const leftWeight = probeLeft ? probe : hold;
    const rightWeight = probeLeft ? hold : probe;
    const left = tuningPayload(leftWeight);
    const right = tuningPayload(rightWeight);
    const fingerprint = JSON.stringify({
        snapshotId: experimentSnapshot?.id || null,
        axis,
        hold,
        probe,
        probeLeft,
        leftArtists: left?.artists || [],
        rightArtists: right?.artists || [],
        seed: left?.seed ?? null
    });
    return {
        axis,
        leftWeight,
        rightWeight,
        payloads: { left, right },
        keys: { left: fingerprint + ":left", right: fingerprint + ":right" }
    };
}
function tunePairReady(bundle = tunePairBundle()) {
    if (!tune || !bundle)
        return false;
    return ["left", "right"].every(side => tune.candidateCache.get(bundle.keys[side])?.status === "ready");
}
async function generateTuneCandidate(bundle, side) {
    if (!tune || !bundle || !["left", "right"].includes(side))
        return;
    const key = bundle.keys[side];
    const existing = tune.candidateCache.get(key);
    if (existing && (existing.status === "pending" || existing.status === "ready"))
        return;
    const sessionId = tune.sessionId;
    const payload = bundle.payloads[side];
    const record = { status: "pending", payload, src: "", blob: null, file: null, fileName: "", error: "" };
    tune.candidateCache.set(key, record);
    renderTuneDuel();
    try {
        const mockRender = { src: side === "left" ? "../resource/original.png" : "../resource/test.png" };
        const shot = await requestGeneration(payload, mockRender);
        if (!tune || tune.sessionId !== sessionId || tune.candidateCache.get(key) !== record)
            return;
        Object.assign(record, {
            status: "ready",
            src: shot.src,
            ...normalizeImageAsset(shot, `tuning-${side}.png`),
            error: ""
        });
    }
    catch (error) {
        if (!tune || tune.sessionId !== sessionId || tune.candidateCache.get(key) !== record)
            return;
        record.status = "error";
        record.error = String(error?.message || error || "생성 실패");
    }
    renderTuneDuel();
}
function ensureTunePairCandidates() {
    const bundle = tunePairBundle();
    if (!bundle)
        return;
    for (const side of ["left", "right"])
        void generateTuneCandidate(bundle, side);
}
function retryTuneCandidate(side) {
    const bundle = tunePairBundle();
    if (!tune || !bundle || !["left", "right"].includes(side))
        return;
    tune.candidateCache.delete(bundle.keys[side]);
    void generateTuneCandidate(bundle, side);
}
function setTuneCandidate(button, image, bundle, side) {
    const host = button.closest(".duelcandidate");
    delete button.dataset.tPlayer;
    delete button.dataset.tRound;
    delete button.dataset.tMatch;
    clearTuneCandidateElement(button, image);
    const record = tune.candidateCache.get(bundle.keys[side]);
    const state = host.querySelector(".candidate-state");
    if (!record || record.status === "pending") {
        host.classList.add("candidate-pending");
        button.disabled = true;
        if (state)
            state.textContent = "생성 중…";
        return;
    }
    if (record.status === "error") {
        host.classList.add("candidate-error");
        button.disabled = false;
        button.dataset.retryTune = side;
        if (state)
            state.textContent = "생성 실패 · 클릭 재시도";
        return;
    }
    const axis = tune.axes[bundle.axis];
    const weight = side === "left" ? bundle.leftWeight : bundle.rightWeight;
    image.src = record.src;
    image.alt = "가중치 조율 후보";
    if (!record.imageId)
        record.imageId = `tuning:${tune.sessionId}:shot:${++tuneImageSeq}`;
    registerImageObject(record.imageId, {
        source: "tuning",
        label: "조율 후보",
        caption: `${axis.name} · ${weight.toFixed(2)}`,
        src: record.src,
        blob: record.blob,
        file: record.file,
        fileName: record.fileName || `tuning-${side}.png`,
        meta: { axis: bundle.axis, weight, payload: record.payload, snapshotId: experimentSnapshot?.id || null }
    }, image);
    button.disabled = !tunePairReady(bundle) || document.body.classList.contains("chunkSave");
}
function renderTuneDuel() {
    const L = document.getElementById("duelLeftPick"), R = document.getElementById("duelRightPick");
    const li = document.getElementById("duelLeftImage"), ri = document.getElementById("duelRightImage");
    if (!tune?.pair) {
        duelPayloads = { left: null, right: null };
        clearTuneCandidateElement(L, li);
        clearTuneCandidateElement(R, ri);
        R.classList.add("empty");
        L.disabled = true;
        R.disabled = true;
        const finalShot = tune?.finalShot;
        duelPayloads.left = finalShot?.payload || null;
        const state = L.closest(".duelcandidate").querySelector(".candidate-state");
        if (finalShot?.status === "ready") {
            li.src = finalShot.src;
            li.alt = "최종 조율 결과";
            registerImageObject(`tuning:${tune.sessionId}:result`, {
                source: "tuning",
                label: "최종 조율 결과",
                caption: "최종 조율 결과",
                src: finalShot.src,
                blob: finalShot.blob || null,
                file: finalShot.file || null,
                fileName: finalShot.fileName || "tuning-result.png",
                meta: { payload: finalShot.payload, snapshotId: experimentSnapshot?.id || null }
            }, li);
        }
        else if (document.body.classList.contains("chunkSave")) {
            L.classList.add(finalShot?.status === "error" ? "candidate-error" : "candidate-pending");
            if (state)
                state.textContent = finalShot?.status === "error" ? "최종 미리보기 생성 실패" : "최종 미리보기 생성 중…";
        }
        renderDuelCompositions();
        return;
    }
    const bundle = tunePairBundle();
    duelPayloads = bundle ? bundle.payloads : { left: null, right: null };
    setTuneCandidate(L, li, bundle, "left");
    setTuneCandidate(R, ri, bundle, "right");
    renderDuelCompositions();
}
function renderTuning({ floorAxes = null, logMode = "full" } = {}) {
  if (!tune) return;
  renderTuneFloor(floorAxes);
  renderTuneLog(logMode);
    renderTuneDuel();
    if (tune.pair)
        ensureTunePairCandidates();
    const done = tune.axes.filter(axisDone).length;
    const decisions = tune.trials.filter(t => t.action !== "skip").length;
    const a = tune.pair ? tune.axes[tune.pair.axis] : null;
    document.getElementById("tuneCursor").textContent = done + "/" + tune.axes.length;
    document.getElementById("tuneStepLabel").textContent = (a ? a.step : GRID).toFixed(2);
    document.getElementById("tuneWho").textContent = a ? a.name : "전부 수렴";
    document.getElementById("tuneUndo").disabled = tune.trials.length === 0;
    document.getElementById("tuneSkip").disabled = !tune.pair;
    const altButton = document.getElementById("duelAlt");
    altButton.textContent = "≈ 차이 없음";
    altButton.title = "두 후보의 차이를 구별하기 어려움으로 기록";
    altButton.disabled = !tune.pair || !tunePairReady();
    const status = document.getElementById("competitionStatus");
    const statsOpen = status.querySelector("details")?.open || false;
    status.innerHTML = `<div class="tune-progress"><span class="tune-target">${esc(a ? a.name : "조율 완료")}</span><progress max="${Math.max(1, tune.axes.length)}" value="${done}" aria-label="가중치 조율 진행" title="${done}/${tune.axes.length}"></progress><details class="tune-stats"${statsOpen ? " open" : ""}><summary title="조율 통계" aria-label="조율 통계">⋯</summary><div>${done}/${tune.axes.length} 처리 · ${tune.axes.filter(a => a.status === "jnd").length} JND · ${tune.axes.filter(a => a.status === "skipped").length} 스킵 · ${decisions}판</div></details></div>`;
}
async function animateTuneChoice(button) {
    if (!tune || !tune.pair || !tunePairReady() || button.disabled || competitionLocked)
        return;
    const chosenLeft = button.id === "duelLeftPick";
    if (reducedMotion) {
        decideTune(chosenLeft);
        return;
    }
    competitionLocked = true;
    document.body.classList.add("competitionLocked");
    const other = chosenLeft ? document.getElementById("duelRightPick") : document.getElementById("duelLeftPick");
    button.closest(".duelcandidate").classList.add("choice-win");
    other.closest(".duelcandidate").classList.add("choice-lose");
    const source = button.querySelector("img"), from = source.getBoundingClientRect();
    const target = document.querySelector(".tunebar.live");
    if (target) {
        const to = target.getBoundingClientRect(), token = source.cloneNode();
        token.removeAttribute("id");
        token.alt = "";
        token.className = "motion-token";
        Object.assign(token.style, { left: from.left + "px", top: from.top + "px",
            width: from.width + "px", height: from.height + "px" });
        document.body.appendChild(token);
        const dx = to.left + to.width / 2 - from.left - from.width / 2, dy = to.top - from.top;
        await token.animate([
            { transform: "translate(0,0) scale(1)", opacity: 1 },
            { transform: `translate(${dx}px,${dy}px) scale(${Math.max(.18, to.width / from.width)})`, opacity: .9 }
        ], { duration: 380, easing: "cubic-bezier(.25,.75,.2,1)", fill: "forwards" }).finished.catch(() => { });
        token.remove();
    }
    else
        await new Promise(r => setTimeout(r, 220));
    button.closest(".duelcandidate").classList.remove("choice-win");
    other.closest(".duelcandidate").classList.remove("choice-lose");
    competitionLocked = false;
    document.body.classList.remove("competitionLocked");
    decideTune(chosenLeft);
}
document.getElementById("tuneBars").addEventListener("click", e => {
    const bar = e.target.closest(".tunebar");
    if (!bar || !tune || document.body.classList.contains("chunkSave")) return;
    const previousAxis = tune.pair?.axis;
    const a = tune.axes[Number(bar.dataset.axis)];
    if (!a)
        return;
    a.status = "pending";
    a.reversals = 0;
    a.resolution = null;
    a.uncertainStep = null;
    a.uncertainAtStep = 0;
    tune.finalShot = null;
    if (a.step < GRID)
        a.step = GRID;
    tune.cursor = Number(bar.dataset.axis);
    buildPair();
    renderTuning({ floorAxes: [previousAxis, tune.cursor].filter(Number.isInteger), logMode: "current" });
});
document.getElementById("tuneUndo").onclick = undoTune;
document.getElementById("tuneSkip").onclick = skipAxis;
function renderSavePanel() {
    if (!tune)
        return;
    const moved = tune.axes.filter(a => Math.abs(axisWeight(a) - a.baseWeight) > 1e-9).length;
    const blind = tune.axes.filter(a => a.status === "jnd").length;
    const decisions = tune.trials.filter(t => t.action !== "skip").length;
    document.getElementById("saveSeed").textContent = selectedSeed ? shortName(selectedSeed) : "—";
    const nameField = document.getElementById("saveName");
    nameField.value = tune.saveName;
    const finalShot = tune.finalShot;
    const hero = document.getElementById("saveHero");
    const commit = document.getElementById("saveCommit");
    if (finalShot?.status === "ready") {
        hero.src = finalShot.src;
        hero.alt = "작가 조합 저장 미리보기";
        registerImageObject(`save:${tune.sessionId}:final`, {
            source: "save",
            label: tune.saveName,
            caption: "작가 조합 저장 미리보기",
            src: finalShot.src,
            blob: finalShot.blob || null,
            file: finalShot.file || null,
            fileName: finalShot.fileName || `${tune.saveName || "artist-combination"}.png`,
            meta: { payload: finalShot.payload, snapshotId: experimentSnapshot?.id || null }
        }, hero);
        commit.textContent = "작가 조합 저장";
        commit.title = "";
        commit.disabled = false;
    }
    else {
        hero.removeAttribute("src");
        delete hero.dataset.imageId;
        hero.classList.remove("image-object", "compare-selected");
        const failed = finalShot?.status === "error";
        hero.alt = failed ? "최종 미리보기 생성 실패" : "최종 미리보기 생성 중";
        commit.textContent = failed ? "최종 미리보기 재시도" : "작가 조합 저장";
        commit.title = failed ? "최종 미리보기 생성을 다시 시도" : "";
        commit.disabled = !failed;
    }
    const previewState = finalShot?.status === "error" ? " · 최종 미리보기 생성 실패" : finalShot?.status === "ready" ? "" : " · 최종 미리보기 생성 중";
    document.getElementById("saveSummary").textContent =
        `${tune.axes.length}축 · ${decisions}판 판정 · ${moved}축 값 변경` +
            (blind ? ` · ${blind}축은 구분 한계 도달` : "") + previewState;
    document.getElementById("saveList").innerHTML = tune.axes.map(a => {
        const changed = Math.abs(axisWeight(a) - a.baseWeight) > 1e-9;
        const res = a.status === "jnd" && a.resolution != null
            ? `<span class="ptag" title="이 차이에서 두 후보를 반복해서 구별하지 못함">JND ${a.resolution.toFixed(2)}</span>`
            : a.status === "skipped" ? `<span class="ptag">스킵</span>` : "";
        return `<div class="saverow${changed ? " moved" : ""}" style="--c:${axisColor(a)}">` +
            `<span class="sname">${esc(a.name)}</span>${res}` +
            `<span class="sfrom">${a.baseWeight.toFixed(2)} →</span>` +
            `<span class="sto">${axisWeight(a).toFixed(2)}</span></div>`;
    }).join("");
}
async function ensureTuneFinalShot() {
    if (!tune || tune.pair || tune.finalShot?.status === "pending" || tune.finalShot?.status === "ready")
        return;
    const sessionId = tune.sessionId;
    const payload = tuningResultPayload();
    const finalShot = { status: "pending", payload, src: "", blob: null, file: null, fileName: "", error: "" };
    tune.finalShot = finalShot;
    renderSavePanel();
    renderTuneDuel();
    try {
        const shot = await requestGeneration(payload, { src: "../resource/original.png" });
        if (!tune || tune.sessionId !== sessionId || tune.finalShot !== finalShot)
            return;
        Object.assign(finalShot, {
            status: "ready",
            src: shot.src,
            ...normalizeImageAsset(shot, "artist-combination.png"),
            error: ""
        });
    }
    catch (error) {
        if (!tune || tune.sessionId !== sessionId || tune.finalShot !== finalShot)
            return;
        finalShot.status = "error";
        finalShot.error = String(error?.message || error || "생성 실패");
    }
    renderSavePanel();
    renderTuneDuel();
}
function openSave() {
    if (!tune || tune.pair)
        return;
    if (!tune.saveName)
        tune.saveName = randomCombinationName();
    document.body.classList.add("chunkSave");
    renderSavePanel();
    renderTuneDuel();
    void ensureTuneFinalShot();
}
document.getElementById("saveName").addEventListener("input", event => {
    if (tune)
        tune.saveName = event.currentTarget.value;
});
document.getElementById("saveReroll").onclick = () => {
    if (!tune)
        return;
    tune.saveName = randomCombinationName();
    document.getElementById("saveName").value = tune.saveName;
    if (tune.finalShot?.status === "ready")
        renderSavePanel();
};
function persistSavedChunks() {
    const savedChunks = Object.fromEntries(Object.entries(chunkLibrary)
        .filter(([, entry]) => !Array.isArray(entry))
        .map(([key, entry]) => [key, { ...entry, src: /^(blob:|data:)/i.test(String(entry.src || "")) ? "" : entry.src || "" }]));
    save({ savedChunks });
}
function registerChunkCard(key, title, root, src, persist = true, beforeNode = null) {
    const savedRoot = structuredClone(root);
    savedRoot.name = title;
    savedRoot.fromId = key;
    chunkLibrary[key] = { root: savedRoot, src };
    if (persist)
        persistSavedChunks();
    const rows = chunkRows(chunkLibrary[key]);
    const card = document.createElement("div");
    card.className = "chunkcard fresh saved-card";
    card.dataset.chunk = key;
    const select = document.createElement("button");
    select.type = "button";
    select.className = "chunkcard-select";
    select.dataset.chunkSelect = "";
    const image = document.createElement("img");
    image.src = src;
    image.alt = title + " 작가 조합";
    const name = document.createElement("span");
    name.className = "chunkname";
    name.append(document.createTextNode(title));
    const meta = document.createElement("span");
    meta.className = "chunkmeta";
    meta.textContent = rows.length + "명 · 조율 완료";
    name.append(meta);
    select.append(image, name);
    const actions = document.createElement("span");
    actions.className = "chunkcard-actions";
    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "chunkcard-action";
    rename.title = "이름 변경";
    rename.setAttribute("aria-label", `${title} 이름 변경`);
    rename.textContent = "✎";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "chunkcard-action";
    remove.title = "삭제";
    remove.setAttribute("aria-label", `${title} 삭제`);
    remove.textContent = "×";
    actions.append(rename, remove);
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "chunkcard-action";
    edit.textContent = "⚙";
    edit.title = "조합 편집";
    edit.setAttribute("aria-label", "조합 편집");
    edit.onclick = event => { event.stopPropagation(); openChunkEditor(key); };
    actions.prepend(edit);
    card.append(select, actions);
    wireChunkCard(card);
    rename.onclick = event => {
        event.stopPropagation();
        hideChunkTooltip();
        const entry = chunkLibrary[key];
        if (!entry || Array.isArray(entry)) return;
        const currentTitle = entry.root?.name || name.firstChild.textContent.trim();
        const nextTitle = prompt("저장 작가 조합 이름", currentTitle);
        if (nextTitle == null || !nextTitle.trim() || nextTitle.trim() === currentTitle) return;
        const trimmed = nextTitle.trim();
        entry.root.name = trimmed;
        name.firstChild.nodeValue = trimmed;
        image.alt = trimmed + " 작가 조합";
        rename.setAttribute("aria-label", `${trimmed} 이름 변경`);
        remove.setAttribute("aria-label", `${trimmed} 삭제`);
        if (comp?.fromId === key) {
            comp.name = trimmed;
            renderComp();
        }
        registerImageObject(`chunk:${key}`, { source: "chunk", label: trimmed, caption: `작가 조합 · ${trimmed}`, src: image.src, fileName: `${trimmed}.png`, meta: { chunkKey: key } }, image);
        persistSavedChunks();
    };
    remove.onclick = event => {
        event.stopPropagation();
        hideChunkTooltip();
        const entry = chunkLibrary[key];
        if (!entry || Array.isArray(entry)) return;
        const currentTitle = entry.root?.name || name.firstChild.textContent.trim();
        if (!confirm(`저장한 작가 조합 “${currentTitle}”을 삭제할까요?`)) return;
        delete chunkLibrary[key];
        persistSavedChunks();
        releaseAssetPreview(`saved:${key}`);
        void deleteReferenceAsset(`saved-preview:${key}`).catch(() => {});
        imageObjects.delete(`chunk:${key}`);
        if (comp?.fromId === key) comp.fromId = null;
        card.remove();
    };
    const grid = document.querySelector(".chunkgrid");
    const anchor = beforeNode?.parentElement === grid ? beforeNode : document.getElementById("newChunkButton");
    grid.insertBefore(card, anchor);
    return card;
}
document.getElementById("saveCommit").onclick = () => {
    if (!tune) return;
    if (tune.finalShot?.status === "error") {
        void ensureTuneFinalShot();
        return;
    }
    if (tune.finalShot?.status !== "ready") return;
    const title = document.getElementById("saveName").value.trim() || tune.saveName || randomCombinationName();
    const draft = commitTuningDraft();
    draft.name = title;
    const runId = activeCompetitionRunId;
    const savedKey = runId ? `saved-${runId}` : "saved-" + Date.now().toString(36);
    const runCard = runId ? document.querySelector(`.chunkcard.run-card[data-run-id="${CSS.escape(runId)}"]`) : null;
    const cardAnchor = runCard?.nextElementSibling || null;
    if (runId) clearCompetitionPersistence(runId);
    registerChunkCard(savedKey, title, draft, tune.finalShot.src, true, cardAnchor);
    const previewBlob = tune.finalShot.file instanceof Blob ? tune.finalShot.file : tune.finalShot.blob instanceof Blob ? tune.finalShot.blob : null;
    if (previewBlob)
        void persistReferenceAsset(`saved-preview:${savedKey}`, previewBlob).catch(() => {});
    else if (/^blob:/i.test(String(tune.finalShot.src || "")))
        void fetch(tune.finalShot.src).then(response => response.blob()).then(blob => persistReferenceAsset(`saved-preview:${savedKey}`, blob)).catch(() => {});
    clearCompetitionRuntime();
    abandonTuning();
    document.body.classList.add("chunkStage");
    document.getElementById("saveName").value = "";
    renderUnfinishedRunCards();
};
document.getElementById("saveApply").onclick = () => {
    if (!tune)
        return;
    const draft = commitTuningDraft();
    adoptComposition(structuredClone(draft));
    const btn = document.getElementById("saveApply");
    btn.textContent = "넣었음 ✓";
    setTimeout(() => { btn.textContent = "프롬프트에 넣기"; }, 1400);
};
const validCompositionNode = node => !!node && typeof node === "object" &&
    (node.kind === "artist" ? typeof node.tag === "string" :
        node.kind === "chunk" && Array.isArray(node.children) && node.children.every(validCompositionNode));
function restoreSavedChunkCards() {
    Object.entries(S.savedChunks || {}).forEach(([key, entry]) => {
        if (!validCompositionNode(entry?.root)) {
            if (entry?.root) console.warn("손상된 저장 작가 조합을 건너뜁니다.", key);
            return;
        }
        try {
            const storedSrc = /^(blob:|data:)/i.test(String(entry.src || "")) ? "" : entry.src || "";
            const title = entry.root.name || "저장 작가 조합";
            document.querySelector(`.chunkcard[data-chunk="${CSS.escape(key)}"]`)?.remove();
            const card = registerChunkCard(key, title, entry.root, storedSrc || peekSources[0], false);
            chunkLibrary[key].src = storedSrc;
            if (!storedSrc) void loadReferenceAsset(`saved-preview:${key}`).then(blob => {
                if (!(blob instanceof Blob) || !card.isConnected || !chunkLibrary[key]) return;
                const image = card.querySelector("img");
                if (!image) return;
                const preview = assetPreviewUrl({ id: `saved:${key}`, file: blob });
                image.src = preview;
                registerImageObject(`chunk:${key}`, { source: "chunk", label: title, caption: `작가 조합 · ${title}`, src: preview, blob, fileName: `${title}.png`, meta: { chunkKey: key } }, image);
            }).catch(() => {});
        }
        catch (error) { console.warn("저장 작가 조합 복원 실패", key, error); }
    });
}

let chunkEdit = null;
const chunkEditor = document.createElement("dialog");
chunkEditor.id = "chunkEditor";
chunkEditor.setAttribute("aria-label", "작가 조합 편집");
chunkEditor.innerHTML = `<form><input id="chunkEditName" aria-label="조합 이름" required><div id="chunkEditRows"></div><p id="chunkEditError" role="alert"></p><footer><button type="button" data-editor-cancel>취소</button><button type="submit">저장</button></footer></form>`;
document.body.append(chunkEditor);
function openChunkEditor(key) {
  const card = document.querySelector(`.chunkcard[data-chunk="${CSS.escape(key)}"]`);
  if (!card || !chunkLibrary[key]) return;
  hideChunkTooltip();
  const title = card.querySelector(".chunkname").firstChild.textContent.trim();
  chunkEdit = { key, root: chunkRoot(chunkLibrary[key], title, key), src: chunkLibrary[key].src || card.querySelector("img").getAttribute("src") };
  chunkEditor.querySelector("#chunkEditName").value = title;
  chunkEditor.querySelector("#chunkEditError").textContent = "";
  renderChunkEditor();
  chunkEditor.showModal();
}
function chunkEditNode(path) {
  return path === "" ? chunkEdit.root : path.split(".").reduce((node, index) => node.children[Number(index)], chunkEdit.root);
}
function renderChunkEditor() {
  const render = (node, path) => {
    const rows = node.children.map((child, index) => {
      const childPath = path ? `${path}.${index}` : String(index);
      const name = child.kind === "artist" ? shortName(child.tag) : child.name;
      return `<div class="chunk-edit-item" data-edit-path="${childPath}"><div class="chunk-edit-row" draggable="true"><span title="드래그로 순서 변경">⠿</span><input data-edit-name aria-label="${child.kind === "artist" ? "작가 이름" : "하위 조합 이름"}" value="${esc(name)}" required><input data-edit-weight aria-label="가중치" type="number" step="0.05" value="${child.weight}" required><button type="button" data-edit-up title="위로" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-edit-down title="아래로" ${index === node.children.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-edit-remove title="제거">×</button></div>${child.kind === "chunk" ? render(child, childPath) : ""}</div>`;
    }).join("");
    return `<div class="chunk-edit-group">${rows}<button type="button" data-edit-add="${path}" title="작가 추가">＋ 작가</button></div>`;
  };
  chunkEditor.querySelector("#chunkEditRows").innerHTML = render(chunkEdit.root, "");
}
chunkEditor.addEventListener("change", event => {
  const item = event.target.closest("[data-edit-path]");
  if (!item) return;
  const node = chunkEditNode(item.dataset.editPath);
  if (event.target.matches("[data-edit-name]")) {
    const name = event.target.value.trim().replace(/^artist:/i, "");
    if (node.kind === "artist") node.tag = "artist:" + name;
    else node.name = name;
  }
  if (event.target.matches("[data-edit-weight]") && event.target.value !== "" && Number.isFinite(event.target.valueAsNumber)) {
    node.weight = round2(Math.round(clampNodeW(event.target.valueAsNumber, node) * 20) / 20);
    event.target.value = node.weight;
  }
});
chunkEditor.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.hasAttribute("data-editor-cancel")) { chunkEditor.close(); return; }
  if (button.hasAttribute("data-edit-add")) {
    chunkEditNode(button.dataset.editAdd).children.push(artistNode("artist:", 1));
    renderChunkEditor();
    return;
  }
  const item = button.closest("[data-edit-path]");
  if (!item) return;
  const parts = item.dataset.editPath.split("."), index = Number(parts.pop());
  const children = chunkEditNode(parts.join(".")).children;
  if (button.hasAttribute("data-edit-remove")) children.splice(index, 1);
  else {
    const target = index + (button.hasAttribute("data-edit-up") ? -1 : 1);
    if (target < 0 || target >= children.length) return;
    children.splice(target, 0, children.splice(index, 1)[0]);
  }
  renderChunkEditor();
});
let chunkRowDrag = null;
chunkEditor.addEventListener("dragstart", event => {
  const row = event.target.closest(".chunk-edit-row");
  if (!row || event.target.matches("input")) { event.preventDefault(); return; }
  chunkRowDrag = row.parentElement.dataset.editPath;
  event.dataTransfer.setData("text/plain", chunkRowDrag);
});
chunkEditor.addEventListener("dragover", event => { if (chunkRowDrag !== null) event.preventDefault(); });
chunkEditor.addEventListener("drop", event => {
  event.preventDefault();
  const target = event.target.closest("[data-edit-path]")?.dataset.editPath;
  if (chunkRowDrag === null || target == null) return;
  const from = chunkRowDrag.split("."), to = target.split(".");
  const fromIndex = Number(from.pop()), toIndex = Number(to.pop());
  if (from.join(".") === to.join(".")) {
    const children = chunkEditNode(from.join(".")).children;
    children.splice(toIndex, 0, children.splice(fromIndex, 1)[0]);
    renderChunkEditor();
  }
  chunkRowDrag = null;
});
chunkEditor.addEventListener("dragend", () => { chunkRowDrag = null; });
chunkEditor.querySelector("form").addEventListener("submit", event => {
  event.preventDefault();
  const valid = node => Number.isFinite(node.weight) && (node.kind === "artist" ? !!shortName(node.tag).trim() : !!node.children.length && node.children.every(valid));
  const title = chunkEditor.querySelector("#chunkEditName").value.trim();
  if (!title || !valid(chunkEdit.root)) {
    chunkEditor.querySelector("#chunkEditError").textContent = "이름과 가중치를 확인하고 각 조합에 작가를 한 명 이상 남겨 주세요.";
    return;
  }
  const old = document.querySelector(`.chunkcard[data-chunk="${CSS.escape(chunkEdit.key)}"]`);
  registerChunkCard(chunkEdit.key, title, chunkEdit.root, chunkEdit.src, true, old);
  old?.remove();
  persistChunkOrder();
  chunkEditor.close();
});
function persistChunkOrder() {
  save({ chunkCardOrder: [...document.querySelectorAll(".chunkgrid > [data-chunk],.chunkgrid > [data-run-id]")].map(card => card.dataset.chunk ? "chunk:" + card.dataset.chunk : "run:" + card.dataset.runId) });
}
function setupChunkEditing() {
  document.querySelectorAll(".chunkcard[data-chunk]:not(.saved-card)").forEach(card => {
    const key = card.dataset.chunk, title = card.querySelector(".chunkname").firstChild.textContent.trim();
    registerChunkCard(key, title, chunkRoot(chunkLibrary[key], title, key), card.querySelector("img").getAttribute("src"), false, card);
    card.remove();
  });
  const grid = document.querySelector(".chunkgrid");
  for (const id of S.chunkCardOrder || []) {
    const card = [...grid.children].find(card => (card.dataset.chunk ? "chunk:" + card.dataset.chunk : "run:" + card.dataset.runId) === id);
    if (card) grid.insertBefore(card, document.getElementById("newChunkButton"));
  }
  let dragged = null;
  grid.addEventListener("pointerdown", event => {
    const card = event.target.closest(".chunkcard");
    if (card && !card.classList.contains("create")) card.draggable = true;
  });
  grid.addEventListener("dragstart", event => {
    dragged = event.target.closest(".chunkcard:not(.create)");
    if (!dragged) return;
    hideChunkTooltip();
    event.dataTransfer.setData("text/plain", dragged.dataset.chunk || dragged.dataset.runId);
    event.dataTransfer.effectAllowed = "move";
  });
  grid.addEventListener("dragover", event => { if (dragged) event.preventDefault(); });
  grid.addEventListener("drop", event => {
    if (!dragged) return;
    event.preventDefault();
    const target = event.target.closest(".chunkcard");
    if (target && target !== dragged) {
      grid.insertBefore(dragged, target);
      persistChunkOrder();
    }
    dragged = null;
  });
  grid.addEventListener("dragend", () => { dragged = null; });
}
const HISTORY = [
  { id: "h6", at: "22:41", seed: 4257072022, src: "../resource/original.png" },
  { id: "h5", at: "22:33", seed: 1180552317, src: "../resource/test.png" },
  { id: "h4", at: "22:20", seed: 884301764, src: "../resource/original.png" },
  { id: "h3", at: "22:02", seed: 512773390, src: "../resource/test.png" },
  { id: "h2", at: "21:47", seed: 99204411, src: "../resource/original.png" },
  { id: "h1", at: "21:30", seed: 36618205, src: "../resource/test.png" }
];
const histRail = document.getElementById("histRail");
const detailCompare = document.getElementById("detailCompare");
const detailCompareToggle = document.getElementById("detailCompareToggle");
const detailCompareA = document.getElementById("detailCompareA");
const detailCompareB = document.getElementById("detailCompareB");
const shotHole = document.getElementById("shotHole");
let detailCompareSelecting = false;
let detailComparePick = [];
let detailCompareMode = "switch";
let detailComparePhase = 0;
let generatingShot = false;
const historyImportBtn = document.getElementById("historyImportBtn");
const historyImportInput = document.getElementById("historyImportInput");
const inspectModal = document.getElementById("inspectModal");
const naiToast = document.getElementById("naiToast");
let inspectPreview = null;
let toastTimer = 0;
function showToast(message) {
  clearTimeout(toastTimer);
  naiToast.textContent = message;
  naiToast.classList.add("on");
  toastTimer = setTimeout(() => naiToast.classList.remove("on"), 1800);
}

function appendCommaPart(base, addition) {
  if (!addition)
    return base;
  if (!base || !base.trim())
    return addition;
  return `${base}${base.trimEnd().endsWith(",") ? " " : ", "}${addition}`;
}
function prependCommaPart(base, prefix) {
  if (!prefix)
    return base;
  if (!base || !base.trim())
    return prefix;
  return `${prefix}, ${base}`;
}
function buildEffectivePrompt(rawPrompt = pt.value, state = generationState) {
  const capabilities = capabilitiesForState(state);
  const datasetMode = capabilities.datasetModes.includes(state.datasetMode) ? state.datasetMode : capabilities.datasetModes[0];
  const qualityPreset = capabilities.qualityPresets.includes(state.qualityPreset) ? state.qualityPreset : capabilities.qualityPresets[0];
  const datasetPrefix = DATASET_PREFIX[datasetMode] || "";
  const quality = QUALITY_TAGS[state.model]?.[qualityPreset] || "";
  return appendCommaPart(prependCommaPart(String(rawPrompt ?? ""), datasetPrefix), quality);
}
function buildEffectiveUndesired(rawUndesired = document.getElementById("ucPrompt").value, state = generationState) {
  const capabilities = capabilitiesForState(state);
  const ucPreset = capabilities.ucPresets.includes(state.ucPreset) ? state.ucPreset : capabilities.ucPresets[0];
  const preset = UC_PRESETS[state.model]?.[ucPreset] || "";
  return appendCommaPart(preset, String(rawUndesired ?? ""));
}
function promptTokens(rawPrompt = pt.value) {
  return tokenize(String(rawPrompt ?? ""));
}
function promptArtistRows(rawPrompt = pt.value) {
  return promptTokens(rawPrompt).filter(token => isArtist(token.name)).map(token => [shortName(token.name), Number(token.w)]);
}
function fixedPromptText(rawPrompt = pt.value) {
  return promptTokens(rawPrompt).filter(token => token.name.trim() && !isArtist(token.name)).map(token => tokenText(token).trim()).filter(Boolean).join(", ");
}
function promptContract(state = generationState, rawPrompt = pt.value, rawUndesired = document.getElementById("ucPrompt").value) {
  const capabilities = capabilitiesForState(state);
  return {
    rawPrompt: String(rawPrompt ?? ""),
    rawUndesired: String(rawUndesired ?? ""),
    effectivePrompt: buildEffectivePrompt(rawPrompt, state),
    effectiveUndesired: buildEffectiveUndesired(rawUndesired, state),
    fixedPrompt: fixedPromptText(rawPrompt),
    datasetMode: capabilities.datasetModes.includes(state.datasetMode) ? state.datasetMode : capabilities.datasetModes[0],
    qualityPreset: capabilities.qualityPresets.includes(state.qualityPreset) ? state.qualityPreset : capabilities.qualityPresets[0],
    ucPreset: capabilities.ucPresets.includes(state.ucPreset) ? state.ucPreset : capabilities.ucPresets[0]
  };
}
function historyArtists() {
  return promptArtistRows(pt.value);
}
function normalizeArtistRows(rows = historyArtists()) {
  return (rows || []).map(row => Array.isArray(row)
    ? [shortName(String(row[0]).replace(/^artist:/i, "artist:")), Number(row[1])]
    : [shortName(String(row.name || row.tag || "").replace(/^artist:/i, "artist:")), Number(row.w ?? row.weight ?? 1)])
    .filter(row => row[0] && Number.isFinite(row[1]));
}
function artistPromptText(rows) {
  return normalizeArtistRows(rows).map(([name, weight]) => weight === 1
    ? `artist:${name}` : `${fmt(weight)}::artist:${name}::`).join(", ");
}
function characterPromptState(state = generationState) {
  const limit = capabilitiesForState(state).maxCharacters;
  return state.characters.map((character, index) => ({
    id: character.id,
    name: `Character ${index + 1}`,
    order: index,
    enabled: character.enabled && index < limit,
    modelAllowed: index < limit,
    prompt: character.prompt,
    undesired: character.undesired,
    position: { ...character.position }
  }));
}
function payloadAsset(asset, kind, state = generationState) {
  const hasFile = !!asset?.file || !!asset?.fileName;
  const file = asset?.file || null;
  const supported = featureSupported(kind, state);
  const conflict = !!featureConflict(kind, state);
  return {
    id: asset.id,
    fileName: asset.fileName || "",
    mime: asset.mime || "",
    size: Number(asset.size) || 0,
    assetKey: hasFile ? (asset.assetKey || `${kind}:${asset.fileName}:${asset.size}:${Number(file?.lastModified) || 0}`) : null,
    hasFile,
    modelAllowed: supported,
    active: hasFile && supported && !conflict,
    ...(kind === "base" ? { strength: Number(asset.strength), noise: Number(asset.noise) } : {}),
    ...(kind === "vibe" ? { strength: Number(asset.strength), informationExtracted: Number(asset.informationExtracted) } : {}),
    ...(kind === "precise" ? { referenceType: asset.referenceType || "character", strength: Number(asset.strength), fidelity: Number(asset.fidelity) } : {})
  };
}
function payloadGenerationInputs(state = generationState) {
  return {
    baseImage: payloadAsset(state.baseImage, "base", state),
    vibeTransfer: state.vibes.map(vibe => payloadAsset(vibe, "vibe", state)),
    preciseReferences: state.preciseReferences.map(reference => payloadAsset(reference, "precise", state))
  };
}
function buildNovelAIPayload(options = {}) {
  const state = options.state || generationState;
  const rawPrompt = options.rawPrompt ?? pt.value;
  const contract = promptContract(state, rawPrompt, options.rawUndesired ?? document.getElementById("ucPrompt").value);
  const artists = normalizeArtistRows(options.artists ?? promptArtistRows(rawPrompt));
  const overrideArtists = Object.prototype.hasOwnProperty.call(options, "artists");
  const sourcePrompt = overrideArtists ? appendCommaPart(options.fixedPrompt ?? contract.fixedPrompt, artistPromptText(artists)) : contract.rawPrompt;
  const effectivePrompt = overrideArtists ? buildEffectivePrompt(sourcePrompt, state) : contract.effectivePrompt;
  return {
    schemaVersion: NOVELAI_PAYLOAD_VERSION,
    source: options.source || "generate",
    model: state.model,
    datasetMode: contract.datasetMode,
    qualityPreset: contract.qualityPreset,
    ucPreset: contract.ucPreset,
    prompt: effectivePrompt,
    undesiredContent: contract.effectiveUndesired,
    sourcePrompt,
    sourceUndesired: contract.rawUndesired,
    fixedPrompt: contract.fixedPrompt,
    artists,
    characters: characterPromptState(state),
    ...payloadGenerationInputs(state),
    transparentBackground: capabilitiesForState(state).transparentBackground && !!state.transparentBackground,
    steps: Number(state.steps),
    guidance: Number(state.guidance),
    rescale: Number(state.rescale),
    sampler: state.sampler,
    noiseSchedule: state.noiseSchedule,
    seed: Number(options.seed ?? state.seed),
    resolution: state.resolution,
    variety: !!state.variety,
    context: options.context || null
  };
}
function captureExperimentSnapshot() {
  const now = Date.now();
  return { id: `exp-${now.toString(36)}`, createdAt: now, payload: buildNovelAIPayload({ source: "experiment" }) };
}
function useExperimentSnapshot(snapshot = captureExperimentSnapshot()) {
  experimentSnapshot = snapshot;
  if (document.body.classList.contains("chunkStage")) syncSidebarExperiment();
  return experimentSnapshot;
}
function experimentPayload(artists, context = null) {
  const snapshot = experimentSnapshot || useExperimentSnapshot();
  const payload = { ...snapshot.payload, source: "experiment", artists: normalizeArtistRows(artists), context, snapshotId: snapshot.id };
  payload.sourcePrompt = appendCommaPart(payload.fixedPrompt, artistPromptText(payload.artists));
  payload.prompt = buildEffectivePrompt(payload.sourcePrompt, payload);
  return payload;
}
function competitionPayload(player) {
  return experimentPayload(playerComposition(player), { type: "competition", player });
}
function flattenTuningArtists(root, overrideNode = null, overrideWeight = null, mult = 1, out = new Map()) {
  if (!root)
    return out;
  const own = root === overrideNode ? overrideWeight : root.weight;
  const weight = mult * own;
  if (root.kind === "artist") {
    out.set(shortName(root.tag), (out.get(shortName(root.tag)) || 0) + weight);
    return out;
  }
  (root.children || []).forEach(child => flattenTuningArtists(child, overrideNode, overrideWeight, weight, out));
  return out;
}
function tuningPayload(weight) {
  if (!tune?.pair)
    return null;
  const axis = tune.axes[tune.pair.axis];
  const rows = [...flattenTuningArtists(tune.draft, axis.node, weight)].map(([name, w]) => [name, round2(w)]);
  return experimentPayload(rows, { type: "tuning", axis: tune.pair.axis, weight });
}
function tuningResultPayload() {
  if (!tune)
    return null;
  const rows = [...flattenTuningArtists(tune.draft)].map(([name, weight]) => [name, round2(weight)]);
  return experimentPayload(rows, { type: "tuning-result" });
}
function historyImageObject(history) {
  return registerImageObject(`history:${history.id}`, {
    source: "history",
    label: history.at,
    caption: `${history.at} · seed ${history.seed}`,
    src: history.src,
    blob: history.blob || null,
    file: history.file || null,
    fileName: history.fileName || `history-${history.id}.png`,
    meta: { historyId: history.id, seed: history.seed, payload: history.payload || null }
  });
}
function renderDetailHistory() {
  histRail.innerHTML = HISTORY.map(history => {
    const object = historyImageObject(history);
    const order = detailComparePick.indexOf(object.id);
    const selected = order >= 0;
    const current = history.id === historyDetailId;
    return `<div class="histshot${current ? " current" : ""}${selected ? " on" : ""}${detailCompareSelecting ? " selectable" : ""}" data-history-id="${history.id}">` +
      `<button type="button" data-history-action="open"${current ? ' aria-current="true"' : ""} aria-label="${history.at} 생성 결과${detailCompareSelecting ? " 비교에 선택" : " 보기"}">` +
      `<img class="image-object${selected ? " compare-selected" : ""}" data-image-id="${object.id}" src="${history.src}" alt=""></button>` +
      `<span class="historder">${selected ? order + 1 : ""}</span></div>`;
  }).join("");
  syncImageSelectionState();
}
function syncImageSelectionState() {
  document.querySelectorAll(".image-object").forEach(element =>
    element.classList.toggle("compare-selected", detailComparePick.includes(element.dataset.imageId)));
}
function paintDetailCompare() {
  const open = detailComparePick.length === 2 && document.body.classList.contains("detail-compare-open");
  const difference = detailCompareMode === "difference";
  detailCompare.classList.toggle("phase-b", !difference && detailComparePhase === 1);
  detailCompare.classList.toggle("difference", difference);
  detailCompare.setAttribute("aria-hidden", String(!open));
  detailCompareA.style.mixBlendMode = "normal";
  detailCompareB.style.mixBlendMode = difference ? "difference" : "normal";
  document.getElementById("detailComparePhase").textContent = difference ? "픽셀 차이" : detailComparePhase ? "B" : "A";
  const active = imageObjects.get(detailComparePick[detailComparePhase ? 1 : 0]);
  document.getElementById("detailCompareMeta").textContent = imageObjectCaption(active);
  detailCompare.querySelectorAll("[data-detail-phase]").forEach(button =>
    button.classList.toggle("on", !difference && Number(button.dataset.detailPhase) === detailComparePhase));
  detailCompare.querySelectorAll("[data-detail-mode]").forEach(button =>
    button.classList.toggle("on", difference && button.dataset.detailMode === detailCompareMode));
}
function openDetailCompare() {
  if (detailComparePick.length !== 2)
    return;
  const [a, b] = detailComparePick.map(id => imageObjects.get(id));
  if (!a?.src || !b?.src)
    return;
  detailCompareA.src = a.src;
  detailCompareB.src = b.src;
  detailCompareMode = "switch";
  detailComparePhase = 0;
  document.body.classList.add("detail-compare-open");
  paintDetailCompare();
}
function closeDetailCompare(clearSelection = false) {
  document.body.classList.remove("detail-compare-open");
  if (clearSelection) {
    detailCompareSelecting = false;
    detailComparePick = [];
    document.body.classList.remove("detail-compare-selecting");
    detailCompareToggle.setAttribute("aria-pressed", "false");
    detailCompareToggle.textContent = "◫ 그림 상세 비교";
    renderDetailHistory();
  }
  syncImageSelectionState();
  detailCompare.setAttribute("aria-hidden", "true");
}
function updateDetailCompareToggle() {
  detailCompareToggle.setAttribute("aria-pressed", String(detailCompareSelecting));
  detailCompareToggle.textContent = detailCompareSelecting
    ? `◫ 비교 그림 ${detailComparePick.length}/2`
    : "◫ 그림 상세 비교";
  document.body.classList.toggle("detail-compare-selecting", detailCompareSelecting);
}
function toggleDetailCompareSelection(imageId) {
  if (!imageObjects.has(imageId))
    return;
  const index = detailComparePick.indexOf(imageId);
  if (index >= 0)
    detailComparePick.splice(index, 1);
  else {
    if (detailComparePick.length >= 2)
      detailComparePick.shift();
    detailComparePick.push(imageId);
  }
  updateDetailCompareToggle();
  renderDetailHistory();
  syncImageSelectionState();
  if (detailComparePick.length === 2)
    openDetailCompare();
  else
    document.body.classList.remove("detail-compare-open");
}
function detailCompareBlocked() {
  return document.body.classList.contains("chunkDuel") || document.body.classList.contains("chunkTune");
}
function syncDetailCompareAvailability() {
  const blocked = detailCompareBlocked();
  detailCompareToggle.disabled = blocked;
  if (blocked && (detailCompareSelecting || document.body.classList.contains("detail-compare-open")))
    closeDetailCompare(true);
}
function toggleDetailCompareMode() {
  if (detailCompareBlocked()) return;
  detailCompareSelecting = !detailCompareSelecting;
  detailComparePick = [];
  closeDetailCompare(false);
  updateDetailCompareToggle();
  renderDetailHistory();
  syncImageSelectionState();
}
detailCompareToggle.onclick = toggleDetailCompareMode;

function showCurrentShot(history) {
  const object = registerImageObject(`current:${history.id}`, {
    source: "current",
    label: "현재 생성",
    caption: `현재 생성 · seed ${history.seed}`,
    src: history.src,
    blob: history.blob || null,
    file: history.file || null,
    fileName: history.fileName || `current-${history.id}.png`,
    meta: { historyId: history.id, seed: history.seed, payload: history.payload || null }
  });
  shotHole.classList.add("has");
  shotHole.innerHTML = `<img class="image-object" data-image-id="${object.id}" src="${history.src}" alt="현재 생성 결과">`;
  syncImageSelectionState();
}
let historyDetailId = null;
const historyDetailIndex = () => HISTORY.findIndex(history => history.id === historyDetailId);
function historyMetaRow(label, value, options = {}) {
  const className = options.code ? "history-meta-value code" : "history-meta-value";
  return `<div class="history-meta-row"><span class="history-meta-label">${esc(label)}</span><span class="${className}">${esc(value)}</span></div>`;
}
function historyAssetText(asset, kind) {
  const parts = [asset.fileName || "이미지"];
  const addNumber = (label, value) => { if (Number.isFinite(Number(value))) parts.push(`${label} ${fmt(Number(value))}`); };
  if (kind === "base") { addNumber("Strength", asset.strength); addNumber("Noise", asset.noise); }
  else if (kind === "vibe") { addNumber("Strength", asset.strength); addNumber("Information", asset.informationExtracted); }
  else { parts.push(asset.referenceType || "character"); addNumber("Strength", asset.strength); addNumber("Fidelity", asset.fidelity); }
  return parts.join(" · ");
}
function payloadImageInputs(payload) {
  if (!payload) return { baseImage: null, vibes: [], precise: [] };
  if (payload.baseImage || Array.isArray(payload.vibeTransfer) || Array.isArray(payload.preciseReferences)) {
    return { baseImage: payload.baseImage || null, vibes: Array.isArray(payload.vibeTransfer) ? payload.vibeTransfer : [], precise: Array.isArray(payload.preciseReferences) ? payload.preciseReferences : [] };
  }
  const legacy = Array.isArray(payload.references) ? payload.references : [];
  return {
    baseImage: legacy.find(item => item?.kind === "image2image") || null,
    vibes: legacy.filter(item => item?.kind === "vibe"),
    precise: legacy.filter(item => item?.kind === "precise")
  };
}
function characterMetadataText(payload) {
  return (payload.characters || []).filter(character => character && (character.prompt || character.undesired)).map((character, index) => {
    const prompt = character.prompt ? `Prompt: ${character.prompt}` : "";
    const undesired = character.undesired ? `UC: ${character.undesired}` : "";
    return `Character ${index + 1} · ${[prompt, undesired].filter(Boolean).join(" · ")}`;
  }).join("\n");
}
function metadataFieldRegistry() {
  const has = (payload, key) => Object.prototype.hasOwnProperty.call(payload, key);
  return [
    { field: "prompt", historyLabel: "Prompt", actionLabel: "Prompt", code: true, present: payload => has(payload, "sourcePrompt"), value: payload => String(payload.sourcePrompt ?? ""), apply: payload => { replaceBasePromptFromPayload(payload); return { ok: true, message: "Prompt 가져오기 완료" }; } },
    { field: "undesired", historyLabel: "Undesired Content", actionLabel: "UC", code: true, present: payload => has(payload, "sourceUndesired"), value: payload => String(payload.sourceUndesired ?? ""), apply: payload => { replaceUndesiredFromPayload(payload); return { ok: true, message: "Undesired Content 가져오기 완료" }; } },
    { field: "characters", historyLabel: "Character Prompts", actionLabel: "Characters", code: true, present: payload => !!characterMetadataText(payload), value: characterMetadataText, apply: payload => { restoreCharactersFromPayload(payload.characters || []); renderCharacters(); persistGenerationState(); return { ok: true, message: "Character Prompts 가져오기 완료" }; } },
    { field: "seed", historyLabel: "Seed", actionLabel: "Seed", present: payload => Number.isFinite(Number(payload.seed)), value: payload => String(payload.seed), apply: payload => restoreSeedFromPayload(payload) ? { ok: true, message: `Seed ${generationState.seed} 가져오기 완료` } : { ok: false, message: "Seed를 가져올 수 없습니다." } },
    { field: "modelMode", historyLabel: "Model", actionLabel: "Model", present: payload => !!payload.model, value: payload => `${payload.model}${payload.datasetMode ? ` · ${payload.datasetMode}` : ""}`, apply: payload => {
      if (!MODEL_CAPABILITIES[payload.model]) return { ok: false, message: "지원하지 않는 Model입니다." };
      generationState.model = payload.model;
      const capabilities = modelCapabilities();
      if (payload.datasetMode && capabilities.datasetModes.includes(payload.datasetMode)) generationState.datasetMode = payload.datasetMode;
      persistGenerationState(); renderModelControls();
      return { ok: true, message: "Model 설정 가져오기 완료" };
    } },
    { field: "qualityPreset", historyLabel: "Quality Tags", actionLabel: "Quality", present: payload => payload.qualityPreset != null, value: payload => String(payload.qualityPreset), apply: payload => {
      const capabilities = modelCapabilities();
      if (!capabilities.qualityPresets.includes(payload.qualityPreset)) return { ok: false, message: "현재 Model에서 사용할 수 없는 Quality preset입니다." };
      generationState.qualityPreset = payload.qualityPreset; persistGenerationState(); renderPromptControls(capabilities);
      return { ok: true, message: "Quality Tags 가져오기 완료" };
    } },
    { field: "ucPreset", historyLabel: "UC Preset", actionLabel: "UC Preset", present: payload => payload.ucPreset != null, value: payload => String(payload.ucPreset), apply: payload => {
      const capabilities = modelCapabilities();
      if (!capabilities.ucPresets.includes(payload.ucPreset)) return { ok: false, message: "현재 Model에서 사용할 수 없는 UC preset입니다." };
      generationState.ucPreset = payload.ucPreset; persistGenerationState(); renderPromptControls(capabilities);
      return { ok: true, message: "UC Preset 가져오기 완료" };
    } },
    { field: "resolution", historyLabel: "Resolution", actionLabel: "Resolution", present: payload => !!payload.resolution?.label, value: payload => payload.resolution.label, apply: payload => {
      if (!payload.resolution?.ratio || !payload.resolution?.label) return { ok: false, message: "Resolution 정보가 없습니다." };
      generationState.resolution = { ...payload.resolution }; persistGenerationState(); renderResolutionFromState();
      return { ok: true, message: "Resolution 가져오기 완료" };
    } },
    { field: "steps", historyLabel: "Steps", actionLabel: "Steps", present: payload => Number.isFinite(Number(payload.steps)), value: payload => String(payload.steps), apply: payload => { setSteps(payload.steps); persistGenerationState(); return { ok: true, message: "Steps 가져오기 완료" }; } },
    { field: "guidance", historyLabel: "Prompt Guidance", actionLabel: "Guidance", present: payload => Number.isFinite(Number(payload.guidance)), value: payload => Number(payload.guidance).toFixed(1), apply: payload => { setGuidance(payload.guidance); persistGenerationState(); return { ok: true, message: "Prompt Guidance 가져오기 완료" }; } },
    { field: "rescale", historyLabel: "CFG Rescale", actionLabel: "Rescale", present: payload => Number.isFinite(Number(payload.rescale)), value: payload => formatRescale(Number(payload.rescale)), apply: payload => { setRescale(payload.rescale); persistGenerationState(); return { ok: true, message: "CFG Rescale 가져오기 완료" }; } },
    { field: "sampler", historyLabel: "Sampler", actionLabel: "Sampler", present: payload => !!payload.sampler, value: payload => String(payload.sampler), apply: payload => {
      if (!selectHasOption(selSampler, String(payload.sampler))) return { ok: false, message: "현재 UI에서 지원하지 않는 Sampler입니다." };
      selSampler.value = String(payload.sampler); generationState.sampler = selSampler.value; sumSampler.textContent = generationState.sampler; persistGenerationState();
      return { ok: true, message: "Sampler 가져오기 완료" };
    } },
    { field: "noiseSchedule", historyLabel: "Noise Schedule", actionLabel: "Noise", present: payload => !!payload.noiseSchedule, value: payload => String(payload.noiseSchedule), apply: payload => {
      if (!selectHasOption(selNoise, String(payload.noiseSchedule))) return { ok: false, message: "현재 UI에서 지원하지 않는 Noise Schedule입니다." };
      selNoise.value = String(payload.noiseSchedule); generationState.noiseSchedule = selNoise.value; persistGenerationState();
      return { ok: true, message: "Noise Schedule 가져오기 완료" };
    } },
    { field: "transparentBackground", historyLabel: "Transparent BG", actionLabel: "Transparent BG", present: payload => has(payload, "transparentBackground"), value: payload => payload.transparentBackground ? "On" : "Off", apply: payload => {
      if (payload.transparentBackground && !modelCapabilities().transparentBackground) return { ok: false, message: "현재 Model은 Transparent Background를 지원하지 않습니다." };
      generationState.transparentBackground = !!payload.transparentBackground; persistGenerationState(); renderModelControls();
      return { ok: true, message: "Transparent BG 가져오기 완료" };
    } }
  ];
}
function imageMetadataFields(payload) {
  const inputs = payloadImageInputs(payload), fields = [];
  const push = (field, historyLabel, actionLabel, asset, kind) => {
    if (asset?.hasFile) fields.push({ field, historyLabel, actionLabel, historyActionLabel: "확인 중…", value: () => historyAssetText(asset, kind), apply: source => applyImageInputFromPayload(source, field) });
  };
  push("baseImage", "Base Image", "Base Image", inputs.baseImage, "base");
  inputs.vibes.forEach(item => push(`vibe:${item.id}`, "Vibe Transfer", "Vibe", item, "vibe"));
  inputs.precise.forEach(item => push(`precise:${item.id}`, "Precise Reference", "Precise", item, "precise"));
  return fields;
}
const availableMetadataFields = payload => payload
  ? [...metadataFieldRegistry().filter(field => field.present(payload)), ...imageMetadataFields(payload)] : [];
const metadataSettingsFields = ["modelMode", "qualityPreset", "ucPreset", "resolution", "steps", "guidance", "rescale", "sampler", "noiseSchedule", "transparentBackground"];
function metadataImportHtml(payload) {
  if (!payload) return "";
  const has = key => Object.prototype.hasOwnProperty.call(payload, key);
  const settings = !!payload.model || has("datasetMode") || metadataSettingsFields.slice(1).some(field => has(field)) || has("variety");
  const groups = [
    ["prompt", "Main Prompt", has("sourcePrompt")],
    ["undesired", "Undesired Content", has("sourceUndesired")],
    ["characters", "Character Prompts", has("characters")],
    ["settings", "Settings", settings],
    ["seed", "Seed", Number.isFinite(Number(payload.seed))]
  ];
  return `<div class="metadata-import">${groups.map(([id, label, enabled]) => `<label><input type="checkbox" data-metadata-group="${id}"${enabled ? " checked" : " disabled"}>${label}</label>`).join("")}<button class="history-apply" type="button" data-metadata-import>선택 항목 가져오기</button></div>`;
}
async function applyMetadataImport(payload, host) {
  if (!payload || !host) return;
  const selected = new Set([...host.querySelectorAll("[data-metadata-group]:checked")].map(input => input.dataset.metadataGroup));
  if (!selected.size) { showToast("가져올 항목을 선택하세요."); return; }
  let error = "";
  const available = new Set(availableMetadataFields(payload).map(item => item.field));
  const apply = async field => {
    const result = await applyPayloadField(payload, field);
    if (!result.ok && !error) error = result.message;
  };
  if (selected.has("settings")) {
    for (const field of metadataSettingsFields)
      if (available.has(field)) await apply(field);
    if (!payload.model && payload.datasetMode && modelCapabilities().datasetModes.includes(payload.datasetMode)) {
      generationState.datasetMode = payload.datasetMode;
      renderModelControls();
      persistGenerationState();
    }
    if (Object.prototype.hasOwnProperty.call(payload, "variety")) {
      generationState.variety = !!payload.variety;
      const button = document.getElementById("btnVariety");
      button.classList.toggle("on", generationState.variety);
      button.textContent = `${generationState.variety ? "✔" : "✖"} Variety+`;
      persistGenerationState();
    }
  }
  if (selected.has("prompt")) await apply("prompt");
  if (selected.has("undesired")) await apply("undesired");
  if (selected.has("characters")) {
    restoreCharactersFromPayload(payload.characters || []);
    renderCharacters();
    persistGenerationState();
  }
  if (selected.has("seed")) await apply("seed");
  showToast(error || "선택한 metadata 가져오기 완료");
}
function historyInspectorHtml(history) {
  const payload = history.payload || history;
  const rows = availableMetadataFields(payload).map(field =>
    historyMetaRow(field.historyLabel, field.value(payload), { code: !!field.code }));
  const details = rows.length ? `<div class="history-meta-group">${rows.join("")}</div>` : `<div class="history-inspector-empty">이 기록에서 확인할 수 있는 generation metadata가 없습니다.</div>`;
  return metadataImportHtml(payload) + details;
}
function renderHistoryInspector(history) {
  document.getElementById("historyInspector").innerHTML = historyInspectorHtml(history);
}
function paintHistoryDetail() {
  const index = historyDetailIndex();
  const history = HISTORY[index];
  if (!history) { closeHistoryDetail(); return; }
  const object = historyImageObject(history);
  document.body.classList.add("historyDetail");
  document.getElementById("historyDetailWhen").textContent = history.at;
  document.getElementById("historyDetailPos").textContent = `${index + 1} / ${HISTORY.length}`;
  document.getElementById("historyPrev").disabled = index <= 0;
  document.getElementById("historyNext").disabled = index >= HISTORY.length - 1;
  const image = document.getElementById("historyDetailImage");
  image.src = history.src;
  image.alt = `${history.at} 생성 결과`;
  bindImageElement(image, object.id);
  renderHistoryInspector(history);
  renderDetailHistory();
  histRail.querySelector(`[data-history-id="${CSS.escape(history.id)}"]`)?.scrollIntoView({ block: "nearest" });
}
function openHistoryAt(index) {
  if (!HISTORY.length) return;
  const clamped = Math.max(0, Math.min(HISTORY.length - 1, index));
  historyDetailId = HISTORY[clamped].id;
  paintHistoryDetail();
}
function openHistoryDetail(history) {
  if (!history) return;
  historyDetailId = history.id;
  paintHistoryDetail();
}
function closeHistoryDetail() {
  historyDetailId = null;
  document.body.classList.remove("historyDetail");
  renderDetailHistory();
}
function replaceBasePromptFromPayload(payload) {
  pt.value = String(payload?.sourcePrompt ?? "");
  toks = tokenize(pt.value);
  comp = chunkNode("프롬프트", [...promptArtists()].map(([tag, weight]) => artistNode(tag, weight)), 1, null);
  compExpanded = new Set([""]);
  rebuild();
  renderComp();
}
function replaceUndesiredFromPayload(payload) {
  document.getElementById("ucPrompt").value = String(payload?.sourceUndesired ?? "");
}
function restoreSeedFromPayload(payload) {
  const seed = Number(payload?.seed);
  if (!Number.isFinite(seed)) return false;
  generationState.seed = Math.max(0, Math.min(4294967295, Math.trunc(seed)));
  generationState.seedLocked = true;
  persistGenerationState();
  paintUiSeed();
  return true;
}
function restoreCharactersFromPayload(rows) {
  if (!Array.isArray(rows)) return;
  generationState.characters = rows.map((row, index) => ({
    id: String(row?.id || `character-${index + 1}`),
    enabled: row?.enabled !== false,
    prompt: String(row?.prompt || ""),
    undesired: String(row?.undesired || ""),
    collapsed: false,
    activeTab: "prompt",
    position: row?.position ? { ...row.position } : makeCharacterPosition()
  }));
  const maxId = generationState.characters.reduce((max, character) => {
    const match = /^character-(\d+)$/.exec(character.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  nextCharacterId = Math.max(nextCharacterId, maxId + 1);
}
function renderResolutionFromState() {
  const resolution = generationState.resolution;
  const buttons = new Map([["1216/832", resLand], ["832/1216", resPort], ["1024/1024", resSq]]);
  [resLand, resPort, resSq].forEach(button => button.classList.toggle("on", button === buttons.get(resolution.ratio)));
  resDisplay.textContent = resolution.label;
  mainResolution.textContent = resolution.label;
  root.style.setProperty("--shot", resolution.ratio);
}
/** @returns {Promise<MetadataApplyResult>} */
async function applyImageInputFromPayload(payload, field) {
  const inputs = payloadImageInputs(payload);
  const kind = field === "baseImage" ? "base" : field.startsWith("vibe:") ? "vibe" : "precise";
  const id = field.includes(":") ? field.split(":")[1] : "";
  const row = kind === "base" ? inputs.baseImage : (kind === "vibe" ? inputs.vibes : inputs.precise).find(item => item?.id === id);
  if (!row?.hasFile) return { ok: false, message: "이미지 입력 정보가 없습니다." };
  if (!featureSupported(kind)) return { ok: false, message: "현재 Model에서는 이 기능을 사용할 수 없습니다." };
  if (featureConflict(kind)) return { ok: false, message: "현재 이미지 입력 설정과 충돌합니다." };
  const file = row.assetKey ? await loadReferenceAsset(row.assetKey).catch(() => null) : null;
  if (!(file instanceof Blob)) return { ok: false, message: "metadata는 있지만 원본 이미지가 없습니다." };
  let asset;
  if (kind === "base") asset = generationState.baseImage;
  else if (kind === "vibe") {
    asset = normalizeVibe({ ...row, id: `vibe-${Date.now().toString(36)}` }, generationState.vibes.length);
    generationState.vibes.push(asset);
  }
  else {
    asset = normalizePrecise({ ...row, id: `precise-${Date.now().toString(36)}` }, generationState.preciseReferences.length);
    generationState.preciseReferences.push(asset);
  }
  releaseAssetPreview(asset.id);
  asset.assetKey = makeAssetKey(kind, asset.id);
  asset.fileName = String(row.fileName || "");
  asset.mime = String(row.mime || file.type || "");
  asset.size = Number(row.size) || Number(file.size) || 0;
  asset.file = file instanceof File ? file : new File([file], asset.fileName || `${asset.id}.png`, { type: asset.mime || file.type || "image/png" });
  void persistReferenceAsset(asset.assetKey, asset.file).catch(() => {});
  if (kind === "base") { asset.strength = Number(row.strength ?? asset.strength); asset.noise = Number(row.noise ?? asset.noise); }
  else if (kind === "vibe") { asset.strength = Number(row.strength ?? asset.strength); asset.informationExtracted = Number(row.informationExtracted ?? asset.informationExtracted); }
  else { asset.referenceType = ["character", "style", "character-style"].includes(row.referenceType) ? row.referenceType : asset.referenceType; asset.strength = Number(row.strength ?? asset.strength); asset.fidelity = Number(row.fidelity ?? asset.fidelity); }
  persistGenerationState();
  renderGenerationInputs();
  return { ok: true, message: `${kind === "base" ? "Base Image" : kind === "vibe" ? "Vibe Transfer" : "Precise Reference"} 가져오기 완료` };
}
function selectHasOption(select, value) {
  return [...select.options].some(option => option.value === value || option.textContent === value);
}
/** @returns {Promise<MetadataApplyResult>} */
async function applyPayloadField(payload, field) {
  if (!payload) return { ok: false, message: "적용할 metadata가 없습니다." };
  const descriptor = availableMetadataFields(payload).find(item => item.field === field);
  return descriptor?.apply ? descriptor.apply(payload) : { ok: false, message: "지원하지 않는 metadata 항목입니다." };
}
function parseJsonText(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}
function normalizeRawNovelAIMetadata(textMetadata, stealthMetadata) {
  const merged = { ...(textMetadata || {}), ...(stealthMetadata || {}) };
  if (Object.prototype.hasOwnProperty.call(merged, "Comment"))
    merged.Comment = parseJsonText(merged.Comment);
  return merged;
}
function detectNovelAIMetadata(raw) {
  const comment = raw?.Comment;
  return raw?.Software === "NovelAI" || !!(comment && typeof comment === "object" && (comment.signed_hash || comment.request_type));
}
function matchNovelAIMetadataSchema(raw, pngWidth = 0, pngHeight = 0) {
  if (!detectNovelAIMetadata(raw)) return null;
  const comment = raw?.Comment && typeof raw.Comment === "object" ? raw.Comment : {};
  const has = key => Object.prototype.hasOwnProperty.call(comment, key);
  const modelMap = {
    "nai-diffusion-5-full": "V5 Full", "nai-diffusion-5-curated": "V5 Curated",
    "nai-diffusion-4-5-full": "V4.5 Full", "nai-diffusion-4-5-curated": "V4.5 Curated",
    "nai-diffusion-4-full": "V4 Full", "nai-diffusion-4-curated-preview": "V4 Curated", "nai-diffusion-4-curated": "V4 Curated",
    "v5 full": "V5 Full", "v5 curated": "V5 Curated", "v4.5 full": "V4.5 Full", "v4.5 curated": "V4.5 Curated",
    "v4 full": "V4 Full", "v4 curated": "V4 Curated"
  };
  const samplerMap = {
    k_euler_ancestral: "Euler Ancestral", k_euler: "Euler",
    k_dpmpp_2s_ancestral: "DPM++ 2S Ancestral", k_dpmpp_2s_a: "DPM++ 2S Ancestral",
    k_dpmpp_2m: "DPM++ 2M", ddim: "DDIM", ddim_v3: "DDIM"
  };
  const modelRaw = String(comment.model ?? comment.model_name ?? raw.Model ?? "").trim().toLowerCase();
  const source = String(raw.Source || "").trim();
  const model = modelMap[modelRaw] || (source === "NovelAI Diffusion V5 0ADF9AB7" ? "V5 Full" : source === "NovelAI Diffusion V4.5 4BDE2A90" ? "V4.5 Full" : undefined);
  const effectivePrompt = String(comment.prompt ?? comment.v4_prompt?.caption?.base_caption ?? raw.Description ?? "").trim();
  const effectiveUndesired = String(comment.uc ?? comment.undesired_content ?? comment.v4_negative_prompt?.caption?.base_caption ?? "").trim();
  let sourcePrompt = String(comment.original_prompt ?? effectivePrompt).trim();
  let sourceUndesired = String(comment.original_negative_prompt ?? effectiveUndesired).trim();
  let datasetMode;
  const promptLower = effectivePrompt.toLowerCase();
  if (promptLower === "fur dataset" || promptLower.startsWith("fur dataset,")) datasetMode = "Furry";
  else if (promptLower === "background dataset" || promptLower.startsWith("background dataset,")) datasetMode = "Background";
  else if (comment.v4_prompt || Number(comment.params_version) >= 3 || model) datasetMode = "Anime";
  if (!has("original_prompt") && datasetMode && DATASET_PREFIX[datasetMode]) {
    const prefix = DATASET_PREFIX[datasetMode];
    if (sourcePrompt.toLowerCase() === prefix.toLowerCase()) sourcePrompt = "";
    else if (sourcePrompt.toLowerCase().startsWith(prefix.toLowerCase() + ",")) sourcePrompt = sourcePrompt.slice(prefix.length + 1).trim();
  }
  const tagHintQt = Number(comment.tag_hint_qt);
  let qualityPreset = tagHintQt === 0 ? "off" : tagHintQt === 1 && (model === "V5 Full" || model === "V5 Curated") ? "standard" : comment.qualityToggle === false ? "off" : null;
  if (!has("original_prompt") && tagHintQt === 1 && qualityPreset === "standard") {
    const tags = QUALITY_TAGS[model]?.standard || "", pipe = sourcePrompt.indexOf("|");
    const head = pipe < 0 ? sourcePrompt : sourcePrompt.slice(0, pipe), tail = pipe < 0 ? "" : sourcePrompt.slice(pipe);
    const at = tags ? head.toLowerCase().lastIndexOf(tags.toLowerCase()) : -1;
    if (at >= 0) sourcePrompt = (head.slice(0, at) + head.slice(at + tags.length)).replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim() + tail;
  }
  if (!has("original_prompt") && qualityPreset == null && comment.qualityToggle !== false) {
    const candidates = [];
    for (const presets of Object.values(QUALITY_TAGS))
      for (const [key, tags] of Object.entries(presets)) if (tags) candidates.push([key, tags]);
    candidates.push(["standard", "very aesthetic, masterpiece, no text, -0.8::feet::, rating:general"]);
    candidates.sort((a, b) => b[1].length - a[1].length);
    for (const [key, tags] of candidates) {
      const lower = sourcePrompt.toLowerCase(), suffix = tags.toLowerCase();
      if (lower === suffix || lower.endsWith(", " + suffix) || lower.endsWith("," + suffix)) {
        sourcePrompt = sourcePrompt.slice(0, sourcePrompt.length - tags.length).replace(/,\s*$/, "").trim();
        qualityPreset = key;
        break;
      }
    }
  }
  if (qualityPreset == null && comment.qualityToggle === true) qualityPreset = "standard";
  let ucPreset = null, ucLength = 0;
  for (const presets of Object.values(UC_PRESETS)) {
    for (const [key, value] of Object.entries(presets)) {
      if (!value || value.length <= ucLength) continue;
      const lower = effectiveUndesired.toLowerCase(), prefix = value.toLowerCase();
      if (lower === prefix || lower.startsWith(prefix + ",")) { ucPreset = key; ucLength = value.length; }
    }
  }
  if (Number(comment.tag_hint_uc_preset) === 2) ucPreset = "heavy";
  if (!ucPreset && has("ucPreset")) ucPreset = ({ 0: "heavy", 1: "light", 2: "off", 3: "off", 4: "heavy", 5: "light", 6: "human", 7: "furry" })[Number(comment.ucPreset)] ?? null;
  if (!has("original_negative_prompt") && ucPreset) sourceUndesired = effectiveUndesired.replace(UC_PRESETS[model]?.[ucPreset] || "", "").replace(/^\s*,\s*|\s*,\s*$/g, "").replace(/,\s*,/g, ",").trim();
  const payload = { schemaVersion: NOVELAI_PAYLOAD_VERSION, source: "import", prompt: effectivePrompt, undesiredContent: effectiveUndesired, sourcePrompt, sourceUndesired };
  if (model) payload.model = model;
  if (datasetMode) payload.datasetMode = datasetMode;
  if (qualityPreset) payload.qualityPreset = qualityPreset;
  if (ucPreset) payload.ucPreset = ucPreset;
  const steps = Number(comment.steps), guidance = Number(comment.scale), rescale = Number(comment.cfg_rescale), seed = Number(comment.seed);
  if (Number.isFinite(steps)) payload.steps = steps;
  if (Number.isFinite(guidance)) payload.guidance = guidance;
  if (Number.isFinite(rescale)) payload.rescale = rescale;
  if (Number.isFinite(seed)) payload.seed = seed;
  if (comment.sampler) payload.sampler = samplerMap[String(comment.sampler)] || String(comment.sampler);
  if (comment.noise_schedule) payload.noiseSchedule = String(comment.noise_schedule);
  const width = Number(comment.width) || Number(pngWidth), height = Number(comment.height) || Number(pngHeight);
  if (width > 0 && height > 0) payload.resolution = { ratio: `${width}/${height}`, label: `${width} × ${height}`, width, height };
  if (has("skip_cfg_above_sigma")) payload.variety = comment.skip_cfg_above_sigma != null && Number(comment.skip_cfg_above_sigma) > 0;
  const transparentHint = comment.tag_hint_transparent_background ?? comment.transparent_background;
  if (transparentHint === true || transparentHint === false || transparentHint === 1 || transparentHint === 0)
    payload.transparentBackground = transparentHint === true || transparentHint === 1;
  const positiveCharacters = comment.v4_prompt?.caption?.char_captions;
  const negativeCharacters = comment.v4_negative_prompt?.caption?.char_captions;
  if (Array.isArray(positiveCharacters)) {
    const useCoords = comment.v4_prompt?.use_coords === true;
    payload.characters = positiveCharacters.map((row, index) => {
      const center = Array.isArray(row?.centers) ? row.centers[0] : null;
      const positioned = useCoords && Number.isFinite(Number(center?.x)) && Number.isFinite(Number(center?.y));
      return {
        id: `character-${index + 1}`, enabled: true, prompt: String(row?.char_caption ?? ""),
        undesired: String(negativeCharacters?.[index]?.char_caption ?? ""),
        position: positioned ? { mode: "manual", x: Number(center.x), y: Number(center.y) } : { mode: "auto", x: null, y: null }
      };
    });
  }
  return { version: Number(comment.params_version || comment.version || 0), payload };
}
async function parseNovelAIMetadata(file) {
  if (!file || file.type && file.type !== "image/png")
    throw new Error("NovelAI metadata 검사는 PNG만 지원합니다.");
  const buffer = await file.arrayBuffer();
  const textMetadata = await parsePngTextChunks(buffer);
  const stealthMetadata = await extractStealthPngMetadata(file);
  const raw = normalizeRawNovelAIMetadata(textMetadata, stealthMetadata);
  const view = new DataView(buffer);
  const schema = matchNovelAIMetadataSchema(raw, view.getUint32(16, false), view.getUint32(20, false));
  return {
    fileName: file.name || "image.png",
    raw,
    textMetadata,
    stealthMetadata,
    transport: [Object.keys(textMetadata).length ? "PNG text" : "", stealthMetadata ? "stealth_pngcomp" : ""].filter(Boolean),
    isNovelAI: detectNovelAIMetadata(raw),
    schema,
    payload: schema?.payload || null
  };
}
function inspectJsonPreview(value, max = 12000) {
  let text;
  try { text = JSON.stringify(value, null, 2); } catch { text = String(value); }
  return text.length > max ? text.slice(0, max) + "\n…" : text;
}
async function importMetadataFromButton(button, payload) {
  button.disabled = true;
  try {
    await applyMetadataImport(payload, button.closest(".metadata-import"));
  }
  catch (error) {
    showToast(error?.message || "메타데이터를 가져오지 못했습니다.");
  }
  finally {
    button.disabled = false;
  }
}
function renderInspectActions(payload) {
  document.getElementById("inspectActions").innerHTML = metadataImportHtml(payload);
}
function previewImportedMetadata(parsed) {
  inspectPreview = parsed;
  document.getElementById("inspectFileName").textContent = parsed.fileName;
  const status = document.getElementById("inspectStatus");
  const mapped = !!parsed.payload;
  status.className = "inspect-status " + (mapped ? "ok" : "wait");
  status.textContent = mapped
    ? "검증된 NovelAI metadata schema입니다. 필요한 항목만 선택해서 가져올 수 있습니다."
    : parsed.isNovelAI
      ? "NovelAI metadata는 확인됐지만 현재 검증된 metadata schema로 매핑할 수 없어 적용하지 않습니다."
      : "NovelAI 생성 이미지로 확인할 수 없습니다.";
  const comment = parsed.raw?.Comment;
  const commentKeys = comment && typeof comment === "object" ? Object.keys(comment) : [];
  document.getElementById("inspectSummary").innerHTML =
    `<dt>NovelAI</dt><dd>${parsed.isNovelAI ? "감지됨" : "확인 안 됨"}</dd>` +
    `<dt>저장 방식</dt><dd>${parsed.transport.join(" + ") || "metadata 없음"}</dd>` +
    `<dt>PNG keys</dt><dd>${Object.keys(parsed.raw || {}).join(", ") || "—"}</dd>` +
    `<dt>Comment keys</dt><dd>${commentKeys.join(", ") || "—"}</dd>`;
  document.getElementById("inspectRaw").textContent = inspectJsonPreview(parsed.raw || {});
  renderInspectActions(parsed.payload);
  inspectModal.hidden = false;
  return parsed;
}
function closeInspectPreview() {
  inspectModal.hidden = true;
  inspectPreview = null;
  historyImportInput.value = "";
}

/**
 * @param {{blob?: unknown, file?: unknown, fileName?: string}} asset
 * @param {string} fallbackFileName
 * @returns {{blob: Blob|null, file: Blob|null, fileName: string}}
 */
function normalizeImageAsset(asset = {}, fallbackFileName = "") {
  return {
    blob: asset.blob instanceof Blob ? asset.blob : null,
    file: asset.file instanceof Blob ? asset.file : null,
    fileName: asset.fileName || fallbackFileName
  };
}
function addHistoryShot(src, payload = buildNovelAIPayload(), asset = {}) {
  HISTORY.unshift({
    id: "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    at: new Date().toTimeString().slice(0, 5),
    seed: payload.seed,
    src,
    ...normalizeImageAsset(asset, ""),
    payload
  });
  renderDetailHistory();
}
const novelaiTokenInput = document.getElementById("novelaiTokenInput");
const genError = document.getElementById("genError");
novelaiTokenInput.value = novelaiApi.readToken();
novelaiTokenInput.addEventListener("change", () => { novelaiTokenInput.value = novelaiApi.writeToken(novelaiTokenInput.value); });
function showGenerationError(message = "") {
  genError.textContent = message;
  genError.hidden = !message;
}
// 사람이 누른 Generate만 실제 API로 보낸다. Tournament·조율 자동 큐는 NovelAI 약관상 샘플 유지
async function requestGeneration(payload, mockRender = {}, options = {}) {
  if (payload.source === "generate" && novelaiApi.readToken()) {
    const shot = await novelaiApi.generateImage(payload, options);
    return { src: URL.createObjectURL(shot.blob), blob: shot.blob, file: null, fileName: shot.fileName, payload };
  }
  return {
    src: mockRender.src || (HISTORY.length % 2 ? "../resource/original.png" : "../resource/test.png"),
    ...normalizeImageAsset(mockRender, ""),
    payload
  };
}
function nextContinuousSeed(seed, mode) {
  if (mode === "random") return Math.floor(Math.random() * 4294967295);
  if (mode === "decrement") return seed <= 0 ? 4294967295 : seed - 1;
  return seed >= 4294967295 ? 0 : seed + 1;
}
let generationCancelRequested = false;
let generationAbort = null;
async function runMockGeneration() {
  if (generatingShot) {
    generationCancelRequested = true;
    generationAbort?.abort();
    genRunLabel.textContent = "취소 중…";
    return;
  }
  if (!pt.value.trim()) return;
  if (!novelaiApi.readToken()) {
    showGenerationError("사용자 설정(⚙)에서 NovelAI 토큰을 입력하면 실제로 생성됩니다. 지금은 샘플 이미지입니다.");
  }
  else showGenerationError();
  generatingShot = true;
  generationCancelRequested = false;
  const button = document.getElementById("genRun");
  const historyLength = HISTORY.length;
  const seedWasLocked = generationState.seedLocked;
  const startingSeed = seedWasLocked ? generationState.seed : Math.floor(Math.random() * 4294967296);
  const count = generationOrchestration.count;
  const seedMode = generationOrchestration.seedMode;
  const delaySeconds = generationOrchestration.delaySeconds;
  button.setAttribute("aria-busy", "true");
  continuousCount.disabled = true;
  continuousSeedMode.disabled = true;
  continuousDelay.disabled = true;
  genRunLabel.textContent = "Cancel";
  try {
    let seed = startingSeed;
    for (let index = 0; index < count && !generationCancelRequested; index++) {
      generationState.seed = seed;
      const payload = buildNovelAIPayload({ source: "generate", seed });
      const mockRender = { src: (historyLength + index) % 2 ? "../resource/original.png" : "../resource/test.png" };
      generationAbort = new AbortController();
      const shot = await requestGeneration(payload, mockRender, { signal: generationAbort.signal });
      addHistoryShot(shot.src, payload, shot);
      showCurrentShot(HISTORY[0]);
      if (generationCancelRequested) break;
      if (index < count - 1) {
        const deadline = Date.now() + delaySeconds * 1000;
        while (!generationCancelRequested && Date.now() < deadline)
          await wait(Math.min(100, deadline - Date.now()));
        if (!generationCancelRequested) seed = nextContinuousSeed(seed, seedMode);
      }
    }
  }
  catch (error) {
    if (error?.name !== "AbortError") {
      showGenerationError(error?.message || "생성 실패");
      console.error("generation failed", error);
    }
  }
  finally {
    if (seedWasLocked) generationState.seed = startingSeed;
    persistGenerationState();
    paintUiSeed();
    generationAbort = null;
    generatingShot = false;
    generationCancelRequested = false;
    button.removeAttribute("aria-busy");
    continuousCount.disabled = false;
    renderContinuousGeneration();
  }
}

document.addEventListener("click", event => {
  if (!detailCompareSelecting)
    return;
  const object = imageObjectFromTarget(event.target);
  if (!object)
    return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  toggleDetailCompareSelection(object.id);
}, true);
histRail.addEventListener("click", event => {
  if (document.body.classList.contains("chunkStage")) return;
  const shot = event.target.closest(".histshot");
  if (!shot) return;
  const history = HISTORY.find(item => item.id === shot.dataset.historyId);
  if (history) openHistoryDetail(history);
});
document.getElementById("historyDetailBack").addEventListener("click", closeHistoryDetail);
document.getElementById("historyPrev").addEventListener("click", () => openHistoryAt(historyDetailIndex() - 1));
document.getElementById("historyNext").addEventListener("click", () => openHistoryAt(historyDetailIndex() + 1));
addEventListener("keydown", event => {
  if (!document.body.classList.contains("historyDetail") || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
  if (event.key === "ArrowUp") { event.preventDefault(); openHistoryAt(historyDetailIndex() - 1); }
  else if (event.key === "ArrowDown") { event.preventDefault(); openHistoryAt(historyDetailIndex() + 1); }
});
document.getElementById("historyInspector").addEventListener("click", async event => {
  const button = event.target.closest("[data-metadata-import]");
  if (!button) return;
  const history = HISTORY.find(item => item.id === historyDetailId);
  if (!history) return;
  await importMetadataFromButton(button, history.payload || history);
});

const imageContextMenu = document.getElementById("imageContextMenu");
let contextImageId = null;
function closeImageContextMenu() {
  imageContextMenu.hidden = true;
  contextImageId = null;
}
function openImageContextMenu(object, x, y) {
  contextImageId = object.id;
  imageContextMenu.hidden = false;
  const width = imageContextMenu.offsetWidth, height = imageContextMenu.offsetHeight, scale = uiScale;
  const viewportWidth = innerWidth / scale, viewportHeight = innerHeight / scale;
  imageContextMenu.style.left = Math.max(6, Math.min(viewportWidth - width - 6, x / scale)) + "px";
  imageContextMenu.style.top = Math.max(6, Math.min(viewportHeight - height - 6, y / scale)) + "px";
  imageContextMenu.querySelector("button")?.focus({ preventScroll: true });
}
document.addEventListener("contextmenu", event => {
  const object = imageObjectFromTarget(event.target);
  if (!object)
    return;
  event.preventDefault();
  openImageContextMenu(object, event.clientX, event.clientY);
});
imageContextMenu.addEventListener("click", async event => {
  const action = event.target.closest("[data-image-action]")?.dataset.imageAction;
  const object = imageObjects.get(contextImageId);
  if (!action || !object)
    return;
  closeImageContextMenu();
  try {
    if (action === "copy") {
      await copyImageObject(object);
      showToast("이미지 복사 완료");
    }
    else if (action === "save") {
      await saveImageObject(object);
      showToast("이미지 저장 시작");
    }
  }
  catch (error) {
    showToast(error?.message || "이미지 작업을 완료하지 못했습니다.");
  }
});
document.addEventListener("pointerdown", event => {
  if (!imageContextMenu.hidden && !imageContextMenu.contains(event.target))
    closeImageContextMenu();
}, true);
addEventListener("blur", closeImageContextMenu);
addEventListener("resize", closeImageContextMenu);
historyImportBtn.addEventListener("click", () => historyImportInput.click());
historyImportInput.addEventListener("change", async () => {
  const file = historyImportInput.files?.[0];
  if (!file)
    return;
  try { previewImportedMetadata(await parseNovelAIMetadata(file)); }
  catch (error) { showToast(error?.message || "PNG metadata를 읽지 못했습니다."); historyImportInput.value = ""; }
});
document.getElementById("inspectClose").addEventListener("click", closeInspectPreview);
inspectModal.addEventListener("click", event => { if (event.target === inspectModal) closeInspectPreview(); });
document.getElementById("inspectActions").addEventListener("click", async event => {
  const button = event.target.closest("[data-metadata-import]");
  if (!button || !inspectPreview?.payload) return;
  await importMetadataFromButton(button, inspectPreview.payload);
});
detailCompare.querySelector(".detail-compare-toolbar").addEventListener("click", event => {
  const phaseButton = event.target.closest("[data-detail-phase]");
  if (phaseButton) {
    detailCompareMode = "switch";
    detailComparePhase = Number(phaseButton.dataset.detailPhase);
    paintDetailCompare();
    return;
  }
  const modeButton = event.target.closest("[data-detail-mode]");
  if (modeButton) {
    detailCompareMode = modeButton.dataset.detailMode;
    paintDetailCompare();
  }
});
document.getElementById("detailCompareCanvas").addEventListener("click", () => {
  if (detailCompareMode === "difference")
    detailCompareMode = "switch";
  detailComparePhase = detailComparePhase ? 0 : 1;
  paintDetailCompare();
});
document.getElementById("detailCompareClose").addEventListener("click", () => closeDetailCompare(true));
document.getElementById("genRun").addEventListener("click", runMockGeneration);
addEventListener("keydown", event => {
  if (event.key !== "Escape")
    return;
  if (!imageContextMenu.hidden) {
    event.preventDefault();
    closeImageContextMenu();
    return;
  }
  if (!inspectModal.hidden) {
    event.preventDefault();
    closeInspectPreview();
    return;
  }
  if (detailCompareSelecting || document.body.classList.contains("detail-compare-open")) {
    event.preventDefault();
    closeDetailCompare(true);
    return;
  }
  if (document.body.classList.contains("historyDetail")) {
    event.preventDefault();
    closeHistoryDetail();
  }
});
new MutationObserver(syncDetailCompareAvailability).observe(document.body, { attributes: true, attributeFilter: ["class"] });
function initApp() {
  restoreSavedChunkCards();
  setupChunkEditing();
  if (new URLSearchParams(location.search).has("chunk")) {
    document.body.classList.add("chunkStage");
    showPanels("noF", "noR");
  }
  toks = tokenize(pt.value);
  comp = chunkNode("프롬프트", [...promptArtists()].map(([tag, w]) => artistNode(tag, w)), 1, null);
  compExpanded = new Set([""]);
  rebuild();
  renderComp();
  renderUnfinishedRunCards();
  renderCompetition();
  renderDetailHistory();
  syncDetailCompareAvailability();
  persistGenerationState();
}
initApp();
