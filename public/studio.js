(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const API = (window.__HATCHABLE__ && window.__HATCHABLE__.api) || "/api";
  const palettes = {
    lime: { accent: "#C9F34A", ink: "#191D1E", outline: "#FFFFFF" },
    mono: { accent: "#EDEAE2", ink: "#171B1A", outline: "#FFFFFF" },
    ember: { accent: "#FF795F", ink: "#191D1E", outline: "#FFFFFF" },
    ocean: { accent: "#75D8DF", ink: "#132426", outline: "#FFFFFF" }
  };
  const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : "layer-" + Math.random().toString(36).slice(2));
  const escapeText = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const baseElements = () => [
    { id:"team", type:"text", text:"NORTHSIDE", shape:"star", x:380, y:661, size:51, color:"#191D1E", rotation:-4, font:"Syne", weight:"bold", opacity:1 },
    { id:"number", type:"text", text:"07", shape:"star", x:380, y:750, size:91, color:"#C9F34A", rotation:-5, font:"Syne", weight:"bold", opacity:1 },
    { id:"tagline", type:"text", text:"MADE TO STAND OUT", shape:"star", x:380, y:815, size:19, color:"#191D1E", rotation:0, font:"DM Sans", weight:"bold", opacity:1 }
  ];
  const defaultConfig = () => ({
    format:"diecut", style:"performance", motif:"bolt",
    team:"NORTHSIDE", tagline:"MADE TO STAND OUT", number:"07",
    photo_key:"", photo_name:"", photo_x:380, photo_y:385, photo_scale:1, photo_rotation:0,
    outline_color:"#FFFFFF", outline_width:12, shadow:true, shadow_blur:18, shadow_opacity:42,
    background:"#F3F0E8", accent:"#C9F34A", ink:"#191D1E", font:"Syne", type_color:"#191D1E",
    elements:baseElements()
  });
  let cfg = defaultConfig();
  let studioKey = localStorage.getItem("cc_studio_key");
  if (!studioKey) { studioKey = makeId(); localStorage.setItem("cc_studio_key", studioKey); }
  let photoDataUrl = "";
  let originalFile = null;
  let photoWidth = 1, photoHeight = 1;
  let selectedLayer = "photo";
  let undoStack = [], redoStack = [], lastSnapshot = "";
  let activeBlobUrl = "";
  let toastTimer = null;
  let bgRemoveLoad = null;
  let latestShareCode = "";
  let busyCutout = false;
  let customTextInput = null;

  function snapshotData() { return JSON.stringify({ cfg, photoDataUrl, photoWidth, photoHeight, selectedLayer }); }
  function pushHistory() {
    const now = snapshotData();
    if (now === lastSnapshot) return;
    if (lastSnapshot) undoStack.push(lastSnapshot);
    if (undoStack.length > 40) undoStack.shift();
    lastSnapshot = now;
    redoStack = [];
    updateUndoButtons();
  }
  function restoreSnapshot(raw) {
    const x = JSON.parse(raw);
    cfg = x.cfg; photoDataUrl = x.photoDataUrl || ""; photoWidth = x.photoWidth || 1; photoHeight = x.photoHeight || 1; selectedLayer = x.selectedLayer || "photo";
    lastSnapshot = snapshotData();
    syncInputs(); render(); updateUndoButtons(); markDirty();
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshotData());
    restoreSnapshot(undoStack.pop());
    toast("Undid last change");
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshotData());
    restoreSnapshot(redoStack.pop());
    toast("Change restored");
  }
  function updateUndoButtons() {
    $("#undo-btn").disabled = !undoStack.length;
    $("#redo-btn").disabled = !redoStack.length;
    $("#undo-btn").style.opacity = undoStack.length ? "1" : ".42";
    $("#redo-btn").style.opacity = redoStack.length ? "1" : ".42";
  }
  function toast(message) {
    const el = $("#toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }
  function setStatus(text, mode = "dirty") {
    const el = $("#save-status"); el.className = "save-status " + (mode === "saved" ? "saved" : mode === "saving" ? "saving" : "");
    const span = $("span", el); if (span) span.textContent = text;
  }
  function markDirty() { setStatus("Unsaved changes", "dirty"); }
  function imageHref() {
    if (photoDataUrl) return photoDataUrl;
    if (cfg.photo_key) return new URL(API + "/assets?key=" + encodeURIComponent(cfg.photo_key), location.origin).href;
    return "";
  }
  function fitDims(maxW, maxH) {
    const ratio = photoWidth / photoHeight || 1;
    let w = maxW, h = maxH;
    if (w / h > ratio) w = h * ratio; else h = w / ratio;
    return { w, h };
  }
  function shapeMarkup(shape, x, y, size, color, rotation = 0) {
    let path = "";
    if (shape === "circle") return '<circle cx="' + x + '" cy="' + y + '" r="' + (size/2) + '" fill="' + color + '"/>';
    if (shape === "bolt") path = 'M -8 -52 L 18 -9 L 0 -9 L 12 42 L -23 -6 L -5 -6 Z';
    else if (shape === "stripe") path = 'M -36 -17 L 24 -42 L 36 -42 L -22 -9 L 36 -7 L 20 2 L -34 2 Z';
    else path = 'M0 -32 L8 -9 L32 -9 L13 6 L20 29 L0 15 L-20 29 L-13 6 L-32 -9 L-8 -9 Z';
    return '<path d="' + path + '" transform="translate(' + x + ' ' + y + ') rotate(' + rotation + ') scale(' + (size/64) + ')" fill="' + color + '"/>';
  }
  function motifMarkup(c) {
    if (c.motif === "none") return "";
    if (c.motif === "bolt") return '<path d="M90 285 L206 155 L174 278 L234 251 L130 398 L157 291 Z" fill="' + c.accent + '" opacity=".97"/><path d="M560 400 L649 316 L620 405 L661 389 L592 501 L610 421 Z" fill="' + c.accent + '" opacity=".88"/>';
    if (c.motif === "star") return '<g fill="' + c.accent + '"><path d="M138 283l10 27 28 2-22 17 7 28-23-16-23 16 7-28-22-17 28-2z"/><path d="M614 202l7 19 20 1-16 12 6 20-17-12-17 12 6-20-16-12 20-1z"/></g>';
    if (c.motif === "stripes") return '<g fill="' + c.accent + '" opacity=".9"><path d="M88 342l160-155-26 55L94 383z"/><path d="M101 395l133-129-19 43-132 126z"/><path d="M552 469l108-103-25 48-99 96z"/></g>';
    return '<path d="M112 312l112-141-32 108 52-27-91 130 23-75z" fill="' + c.accent + '"/>';
  }
  function sampleMarkup(c) {
    const outer = "M176 210 L244 155 L309 188 L365 119 L419 183 L501 160 L546 237 L624 285 L583 367 L598 470 L527 516 L507 621 L414 613 L360 710 L306 641 L217 660 L215 562 L142 520 L173 431 L127 356 Z";
    const inner = "M184 218 L248 166 L311 199 L365 134 L416 194 L494 172 L536 244 L612 289 L571 369 L586 465 L518 508 L498 612 L410 604 L359 694 L310 631 L227 649 L225 555 L153 513 L184 428 L138 357 Z";
    return '<g filter="url(#shadow-filter)"><path d="' + outer + '" fill="' + c.outline_color + '" stroke="' + c.accent + '" stroke-width="8" stroke-linejoin="round"/><path d="' + inner + '" fill="' + c.ink + '" stroke="' + c.outline_color + '" stroke-width="3" stroke-linejoin="round"/></g>' +
      '<g opacity=".98"><path d="M190 251l109-76-53 88 30-8-91 100 28-70z" fill="' + c.accent + '"/><path d="M512 281l91 31-71 15 22 21-78-17z" fill="' + c.accent + '"/><path d="M198 453l-20 42 71-34z" fill="' + c.accent + '"/>' +
      '<path d="M343 182 L372 153 L399 190 L376 201 Z" fill="#F4F0E7"/><path d="M359 188l17-24 18 28-18 27z" fill="' + c.accent + '"/>' +
      '<path d="M299 267 L344 236 L388 247 L432 226 L471 266 L458 320 L421 355 L359 345 L321 319 Z" fill="#313833" stroke="' + c.outline_color + '" stroke-width="4"/><path d="M341 264l41 11 28-13 26 22-27 35-47-8z" fill="' + c.accent + '"/><circle cx="372" cy="291" r="17" fill="#101311" stroke="' + c.outline_color + '" stroke-width="3"/><path d="M361 283l23 16m0-16-23 16" stroke="' + c.accent + '" stroke-width="4"/>' +
      '<path d="M255 388l-42 41 75-7 26-29zM482 381l72 8-57 32-38-18z" fill="' + c.accent + '"/>' +
      '<text x="380" y="470" text-anchor="middle" font-family="Syne,sans-serif" font-size="45" font-weight="800" fill="' + c.outline_color + '" letter-spacing="1">CREASE</text><text x="380" y="519" text-anchor="middle" font-family="Syne,sans-serif" font-size="45" font-weight="800" fill="' + c.outline_color + '" letter-spacing="1">CRAFT</text><path d="M226 538L535 538" stroke="' + c.accent + '" stroke-width="5"/>' +
      '</g>';
  }
  function svgForConfig(c, href = "", interactive = false, dims = null) {
    const photoDims = dims || fitDims(480, 530);
    const outlineR = Math.max(0, Math.min(14, Number(c.outline_width || 0) / 2.2));
    let out = '<defs><filter id="outline-filter" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="' + outlineR + '" result="dilated"/><feFlood flood-color="' + c.outline_color + '" result="outlineColor"/><feComposite in="outlineColor" in2="dilated" operator="in" result="outline"/><feMerge><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="shadow-filter" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="10" stdDeviation="' + Number(c.shadow_blur || 0) / 2 + '" flood-color="#111711" flood-opacity="' + (c.shadow ? Number(c.shadow_opacity || 42)/100 : 0) + '"/></filter></defs>';
    const isPhoto = !!href;
    if (!isPhoto) {
      if (c.style !== "blank") out += motifMarkup(c) + sampleMarkup(c);
    } else {
      out += motifMarkup(c);
      out += '<g data-layer="photo" class="sticker-layer" transform="translate(' + c.photo_x + ' ' + c.photo_y + ') rotate(' + c.photo_rotation + ') scale(' + c.photo_scale + ')" opacity="1">';
      out += '<image href="' + escapeText(href) + '" x="' + (-photoDims.w/2) + '" y="' + (-photoDims.h/2) + '" width="' + photoDims.w + '" height="' + photoDims.h + '" preserveAspectRatio="xMidYMid meet" filter="url(#outline-filter)" />';
      out += '</g>';
    }
    if (c.format === "bat") out += '<path d="M120 150L164 120 214 173 170 206Z" fill="' + c.accent + '" opacity=".8"/>';
    if (c.format === "helmet") out += '<path d="M560 220l42 20 14 41-42-19z" fill="' + c.accent + '" opacity=".8"/>';
    if (c.format === "badge") out += '<path d="M380 85l20 22 31 4-21 24 5 32-35-16-35 16 5-32-21-24 31-4z" fill="' + c.accent + '" stroke="' + c.outline_color + '" stroke-width="5"/>';
    const defaultSize = isPhoto ? [48, 87, 17] : [51, 91, 19];
    for (const el of (Array.isArray(c.elements) ? c.elements : [])) {
      if (el.type === "shape") {
        out += '<g data-layer="' + escapeText(el.id) + '" class="sticker-layer" opacity="' + Number(el.opacity || 1) + '">' + shapeMarkup(el.shape, el.x, el.y, el.size, el.color, el.rotation) + '</g>';
      } else {
        const isCore = ["team","number","tagline"].includes(el.id);
        const size = Number(el.size || defaultSize[0]);
        const stroke = c.outline_width > 0 ? ' stroke="' + c.outline_color + '" stroke-width="' + Math.max(0, c.outline_width/2.5) + '" stroke-linejoin="round" paint-order="stroke fill"' : "";
        out += '<text data-layer="' + escapeText(el.id) + '" class="sticker-layer" x="' + Number(el.x) + '" y="' + Number(el.y) + '" transform="rotate(' + Number(el.rotation || 0) + ' ' + Number(el.x) + ' ' + Number(el.y) + ')" text-anchor="middle" dominant-baseline="middle" font-family="' + (el.font === "DM Sans" ? "DM Sans,sans-serif" : "Syne,sans-serif") + '" font-size="' + size + '" font-weight="' + (el.weight === "normal" ? "500" : "800") + '" letter-spacing="' + (el.id === "tagline" ? 1.8 : -1.3) + '" fill="' + (el.color || c.ink) + '"' + stroke + ' opacity="' + Number(el.opacity || 1) + '">' + escapeText(el.text) + '</text>';
      }
    }
    if (interactive && selectedLayer) {
      let selected = null;
      if (selectedLayer === "photo" && isPhoto) {
        selected = '<rect x="' + (c.photo_x-photoDims.w*c.photo_scale/2-10) + '" y="' + (c.photo_y-photoDims.h*c.photo_scale/2-10) + '" width="' + (photoDims.w*c.photo_scale+20) + '" height="' + (photoDims.h*c.photo_scale+20) + '" rx="8" fill="none" stroke="#8fb430" stroke-width="2" stroke-dasharray="7 6" pointer-events="none"/>';
      } else {
        const el = (c.elements || []).find(e => e.id === selectedLayer);
        if (el) selected = '<circle cx="' + el.x + '" cy="' + el.y + '" r="' + Math.max(22, el.size*.8) + '" fill="none" stroke="#8fb430" stroke-width="1.5" stroke-dasharray="5 6" opacity=".8" pointer-events="none"/>';
      }
      out += '<g pointer-events="none">' + (selected || "") + '</g>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1520" height="1800" viewBox="0 0 760 900">' + out + '</svg>';
  }
  function render() {
    const href = imageHref();
    $("#sticker-svg").innerHTML = svgForConfig(cfg, href, true, fitDims(480, 530)).replace(/^<svg[^>]*>|<\/svg>$/g, "");
    $("#canvas-empty").style.display = "none";
    $("#canvas-context").textContent = cfg.format === "diecut" ? "PHOTO STICKER CANVAS" : cfg.format.toUpperCase() + " DESIGN CANVAS";
    $("#canvas-footer-status").textContent = href ? (cfg.photo_name || "Image loaded") + " · drag elements to reposition" : "Start with a photo, or customise the sample";
    renderLayers();
    syncSmallValues();
  }
  function renderLayers() {
    const layers = [];
    if (imageHref()) layers.push({id:"photo", name:cfg.photo_name || "Uploaded photo", kind:"IMG"});
    (cfg.elements || []).slice().reverse().forEach(e => layers.push({id:e.id, name:e.id === "team" ? "Team name · " + e.text : e.id === "number" ? "Number · " + e.text : e.id === "tagline" ? "Tagline · " + e.text : e.type === "shape" ? "Graphic · " + e.shape : "Text · " + e.text, kind:e.type === "shape" ? "✦" : "T"}));
    $("#layer-count").textContent = layers.length;
    const box = $("#layer-list");
    if (!layers.length) { box.innerHTML = '<div class="layer-empty">Add text or upload an image to start.</div>'; return; }
    box.innerHTML = layers.map(l => '<div class="layer-row ' + (selectedLayer === l.id ? "selected" : "") + '" data-select-layer="' + escapeText(l.id) + '"><span class="layer-kind">' + escapeText(l.kind) + '</span><span class="layer-name">' + escapeText(l.name) + '</span>' + (["team","number","tagline"].includes(l.id) ? "" : '<button class="layer-remove" data-remove-layer="' + escapeText(l.id) + '" title="Delete layer">×</button>') + '</div>').join("");
  }
  function syncSmallValues() {
    $("#outline-value").textContent = cfg.outline_width + " px";
    $("#outline-hex").textContent = cfg.outline_color.toUpperCase();
    $("#accent-hex").textContent = cfg.accent.toUpperCase();
    $("#blur-value").textContent = cfg.shadow_blur + " px";
    $("#shadow-opacity-value").textContent = cfg.shadow_opacity + "%";
    $("#scale-value").textContent = Math.round(cfg.photo_scale*100) + "%";
    $("#rotation-value").textContent = cfg.photo_rotation + "°";
    $("#outline-width").value = cfg.outline_width;
    $("#outline-color").value = cfg.outline_color;
    $("#accent-color").value = cfg.accent;
    $("#shadow-toggle").checked = cfg.shadow;
    $("#shadow-blur").value = cfg.shadow_blur;
    $("#shadow-opacity").value = cfg.shadow_opacity;
    $("#photo-scale").value = Math.round(cfg.photo_scale*100);
    $("#photo-rotation").value = cfg.photo_rotation;
  }
  function syncInputs() {
    $("#team-text").value = (cfg.elements.find(e => e.id === "team") || {}).text || cfg.team || "";
    $("#number-text").value = (cfg.elements.find(e => e.id === "number") || {}).text || cfg.number || "";
    $("#tagline-text").value = (cfg.elements.find(e => e.id === "tagline") || {}).text || cfg.tagline || "";
    $("#font-select").value = cfg.font || "Syne";
    $("#type-color").value = cfg.type_color || cfg.ink;
    $("#motif-select").value = cfg.motif === "star" || cfg.motif === "stripes" ? cfg.motif : cfg.motif;
    $$(".inspector-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === activeTab));
    $$(".inspector-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === activeTab));
    $$(".format-chip").forEach(b => b.classList.toggle("active", b.dataset.format === cfg.format));
    $$(".format-chip").forEach(b => b.classList.toggle("active", b.dataset.format === cfg.format));
    $$(".outline-option").forEach(b => b.classList.toggle("selected", Number(b.dataset.outline) === Number(cfg.outline_width)));
    $$(".palette-option").forEach(b => b.classList.toggle("active", b.dataset.palette === activePalette));
    $$(".template-card").forEach(b => b.classList.toggle("selected", b.dataset.template === cfg.style));
  }
  let activeTab = "sticker", activePalette = "lime", canvasBg = "checker";
  function chooseTab(tab) {
    activeTab = tab;
    $$(".inspector-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    $$(".inspector-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === tab));
  }
  function update(fn, dirty = true) { pushHistory(); fn(); render(); if (dirty) markDirty(); lastSnapshot = snapshotData(); updateUndoButtons(); }
  function updateElement(id, props) {
    const el = cfg.elements.find(e => e.id === id);
    if (el) Object.assign(el, props);
  }
  function setFormat(format) {
    update(() => { cfg.format = format; }, true);
    $$(".format-chip").forEach(b => b.classList.toggle("active", b.dataset.format === format));
    $$(".product-item").forEach(b => b.classList.toggle("active", b.dataset.format === format));
  }
  function applyTemplate(template) {
    const theme = {
      performance:{accent:"#C9F34A",ink:"#191D1E",outline:"#FFFFFF",motif:"bolt",width:12,format:"diecut"},
      street:{accent:"#FF795F",ink:"#171717",outline:"#FFFFFF",motif:"stripes",width:10,format:"diecut"},
      heritage:{accent:"#D5BD7C",ink:"#283029",outline:"#F4ECDD",motif:"crest",width:8,format:"badge"},
      league:{accent:"#75D8DF",ink:"#132426",outline:"#FFFFFF",motif:"star",width:14,format:"badge"},
      blank:{accent:"#C9F34A",ink:"#191D1E",outline:"#FFFFFF",motif:"none",width:0,format:"diecut"}
    }[template] || null;
    if (!theme) return;
    update(() => {
      cfg.style = template; cfg.accent = theme.accent; cfg.ink = theme.ink; cfg.outline_color = theme.outline; cfg.motif = theme.motif; cfg.outline_width = theme.width; cfg.format = theme.format;
      if (template === "blank") cfg.elements = [];
      else if (!cfg.elements.length) cfg.elements = baseElements();
      cfg.elements.forEach(e => { if (e.id === "number") e.color = theme.accent; if (e.id === "team" || e.id === "tagline") e.color = theme.ink; });
      activePalette = Object.keys(palettes).find(k => palettes[k].accent === theme.accent) || "";
    });
    syncInputs(); toast(template === "blank" ? "Blank canvas ready" : template[0].toUpperCase() + template.slice(1) + " style applied");
  }
  function pickFile() { $("#file-input").click(); }
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read that image.")); reader.readAsDataURL(file); });
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("Unable to open this image.")); img.src = src; });
  }
  async function acceptPhoto(file) {
    if (!file) return;
    if (!["image/png","image/jpeg","image/webp"].includes(file.type)) { toast("Choose a PNG, JPG or WebP image."); return; }
    if (file.size > 15 * 1024 * 1024) { toast("That image is over 15 MB. Please choose a smaller file."); return; }
    try {
      pushHistory();
      const data = await fileToDataUrl(file);
      const img = await loadImage(data);
      photoDataUrl = data; originalFile = file; photoWidth = img.naturalWidth || img.width; photoHeight = img.naturalHeight || img.height;
      cfg.photo_key = ""; cfg.photo_name = file.name; cfg.photo_x = 380; cfg.photo_y = 370; cfg.photo_scale = 1; cfg.photo_rotation = 0;
      latestShareCode = "";
      render(); syncInputs(); markDirty(); lastSnapshot = snapshotData();
      toast("Image loaded — customise your sticker.");
      if (fileInput) fileInput.value = "";
    } catch (e) { toast(e.message || "Could not load that image."); }
  }
  const fileInput = $("#file-input");
  async function getBgRemove() {
    if (window.BgRemove && typeof window.BgRemove.removeBackground === "function") return window.BgRemove;
    if (!bgRemoveLoad) bgRemoveLoad = new Promise((resolve, reject) => {
      const s = document.createElement("script"); s.src = "https://bgremovers.org/sdk/v1.js"; s.async = true;
      s.onload = () => window.BgRemove && typeof window.BgRemove.removeBackground === "function" ? resolve(window.BgRemove) : reject(new Error("Cutout engine did not initialise."));
      s.onerror = () => reject(new Error("Could not load the cutout engine."));
      document.head.appendChild(s);
    });
    return bgRemoveLoad;
  }
  async function sourceFile() {
    if (originalFile) return originalFile;
    if (photoDataUrl) {
      const r = await fetch(photoDataUrl); const b = await r.blob();
      return new File([b], "creasecraft-photo.png", { type:b.type || "image/png" });
    }
    if (cfg.photo_key) {
      const r = await fetch(imageHref()); if (!r.ok) throw new Error("Could not load the saved image.");
      const b = await r.blob(); return new File([b], "creasecraft-photo.png", { type:b.type || "image/png" });
    }
    throw new Error("Upload a photo first.");
  }
  async function aiCutout() {
    if (busyCutout) return;
    if (!imageHref()) { toast("Upload a photo before removing its background."); pickFile(); return; }
    busyCutout = true; $("#remove-bg-btn").disabled = true; $("#remove-bg-btn").textContent = "Loading cutout…"; $("#canvas-footer-status").textContent = "Preparing background removal…";
    try {
      const file = await sourceFile();
      toast("Preparing the cutout model. First use can take a little longer.");
      const engine = await getBgRemove();
      const blob = await engine.removeBackground(file, { maxDimension: 2048, onProgress: p => {
        const pct = p && Number.isFinite(p.progress) ? Math.round(p.progress * 100) + "%" : (p && p.stage ? p.stage : "working");
        $("#canvas-footer-status").textContent = "Background removal · " + pct;
      }});
      pushHistory();
      photoDataUrl = await fileToDataUrl(new File([blob], "creasecraft-cutout.png", {type:"image/png"}));
      originalFile = new File([blob], "creasecraft-cutout.png", {type:"image/png"});
      const img = await loadImage(photoDataUrl); photoWidth = img.naturalWidth; photoHeight = img.naturalHeight;
      cfg.photo_key = ""; cfg.photo_name = (cfg.photo_name || "Sticker").replace(/.[^.]+$/, "") + "-cutout.png";
      render(); markDirty(); lastSnapshot = snapshotData(); toast("Background removed. Your transparent cutout is ready.");
    } catch (err) {
      console.error("Background removal:", err);
      try {
        const src = imageHref();
        const img = await loadImage(src);
        const scale = Math.min(1, 1100 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.naturalWidth*scale)); c.height = Math.max(1, Math.round(img.naturalHeight*scale));
        const ctx = c.getContext("2d", {willReadFrequently:true}); ctx.drawImage(img,0,0,c.width,c.height);
        const imageData = ctx.getImageData(0,0,c.width,c.height), data = imageData.data, w=c.width, h=c.height;
        const samples = [[1,1],[w-2,1],[1,h-2],[w-2,h-2], [Math.floor(w/2),1], [Math.floor(w/2),h-2], [1,Math.floor(h/2)],[w-2,Math.floor(h/2)]];
        let r=0,g=0,b=0; samples.forEach(([x,y])=>{const i=(y*w+x)*4;r+=data[i];g+=data[i+1];b+=data[i+2]}); r/=samples.length;g/=samples.length;b/=samples.length;
        const seen=new Uint8Array(w*h), queue=new Int32Array(w*h); let head=0,tail=0;
        const tryPush = i => { if (i<0 || i>=w*h || seen[i]) return; const j=i*4, dr=data[j]-r,dg=data[j+1]-g,db=data[j+2]-b; const dist=Math.sqrt(dr*dr+dg*dg+db*db); if(dist<58){seen[i]=1;queue[tail++]=i;} };
        for(let x=0;x<w;x++){tryPush(x);tryPush((h-1)*w+x)} for(let y=1;y<h-1;y++){tryPush(y*w);tryPush(y*w+w-1)}
        while(head<tail){const i=queue[head++];data[i*4+3]=0;const x=i%w,y=(i/w)|0;if(x>0)tryPush(i-1);if(x<w-1)tryPush(i+1);if(y>0)tryPush(i-w);if(y<h-1)tryPush(i+w);}
        ctx.putImageData(imageData,0,0);
        const fallbackUrl = c.toDataURL("image/png");
        const fallbackImg = await loadImage(fallbackUrl);
        pushHistory(); photoDataUrl=fallbackUrl; originalFile=null; photoWidth=fallbackImg.naturalWidth; photoHeight=fallbackImg.naturalHeight; cfg.photo_key=""; cfg.photo_name=(cfg.photo_name||"Sticker").replace(/.[^.]+$/,"")+"-quick-cutout.png";
        render(); markDirty(); lastSnapshot=snapshotData();
        toast("Quick cutout applied to edge-matching background pixels. Review the edges; complex photos need the AI engine.");
      } catch (fallbackErr) {
        toast("Cutout engine unavailable. Try again shortly or upload a transparent PNG.");
      }
    } finally {
      busyCutout = false; $("#remove-bg-btn").disabled = false; $("#remove-bg-btn").textContent = "✦ AI cutout";
    }
  }
  async function compactPhotoData() {
    const src = photoDataUrl;
    if (!src) return "";
    try {
      const img = await loadImage(src); const max = 1800; const ratio = Math.min(1, max/Math.max(img.naturalWidth,img.naturalHeight));
      const c = document.createElement("canvas"); c.width=Math.max(1,Math.round(img.naturalWidth*ratio)); c.height=Math.max(1,Math.round(img.naturalHeight*ratio));
      const ctx=c.getContext("2d");ctx.drawImage(img,0,0,c.width,c.height);
      let out=c.toDataURL("image/webp",.88);
      if (out.length > 7800000) { const ratio2=.7; c.width=Math.round(c.width*ratio2); c.height=Math.round(c.height*ratio2);ctx.drawImage(img,0,0,c.width,c.height);out=c.toDataURL("image/webp",.8); }
      return out;
    } catch { return src; }
  }
  async function persistPhoto() {
    if (!photoDataUrl || cfg.photo_key) return cfg.photo_key;
    const data_url = await compactPhotoData();
    if (data_url.length > 8400000) throw new Error("Image is too large to save. Export your sticker and try a smaller source photo.");
    const res = await fetch(API + "/assets", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({data_url}) });
    const payload = await res.json().catch(()=>({}));
    if (!res.ok || !payload.key) throw new Error(payload.error || "Could not save the uploaded image.");
    cfg.photo_key = payload.key;
    return payload.key;
  }
  async function saveDesign() {
    const name = ($("#design-name").value || "").trim().slice(0,70) || "Untitled sticker";
    setStatus("Saving…","saving");
    try {
      await persistPhoto();
      const res = await fetch(API + "/designs", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({studio_key:studioKey,share_code:latestShareCode,design_name:name,config:cfg}) });
      const payload=await res.json().catch(()=>({}));
      if(!res.ok || !payload.design) throw new Error(payload.error || "Could not save this design.");
      latestShareCode=payload.design.share_code; $("#design-name").value=payload.design.design_name || name;
      setStatus("Saved just now","saved"); toast("Design saved to My Designs."); return payload.design;
    } catch(e) { setStatus("Save failed","dirty"); toast(e.message || "Save failed. Check your connection and try again."); return null; }
  }
  async function getDesigns() {
    const r=await fetch(API+"/designs?key="+encodeURIComponent(studioKey)); const j=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error || "Couldn't load your saved designs."); return j.designs || [];
  }
  async function openLibrary() {
    $("#modal-title").innerHTML='My designs<span>.</span>'; $("#modal-content").innerHTML='<div class="empty-gallery">Loading your designs…</div>'; $("#modal-backdrop").hidden=false;
    try {
      const designs=await getDesigns();
      if(!designs.length){$("#modal-content").innerHTML='<div class="empty-gallery"><strong>Your next great sticker starts here.</strong><p>Design something and hit Save. It will show up here when you return.</p><button class="button button-primary" id="start-first-design">＋ Create a design</button></div>';$("#start-first-design").onclick=closeModal;return;}
      $("#modal-content").innerHTML='<div class="design-grid">'+designs.map(d=>{
        const c={...defaultConfig(),...(d.config||{})};const href=c.photo_key?new URL(API+"/assets?key="+encodeURIComponent(c.photo_key),location.origin).href:"";
        const svg=svgForConfig(c,href,false,fitDims(400,480));
        return '<article class="design-card"><div class="design-card-preview">'+svg+'</div><div class="design-card-copy"><b>'+escapeText(d.design_name)+'</b><small>Saved '+new Date(d.updated_at||d.created_at).toLocaleDateString()+'</small><button data-open-design="'+escapeText(d.share_code)+'">Open design ↗</button></div></article>';
      }).join("")+'</div>';
      $$("[data-open-design]").forEach(b=>b.addEventListener("click",()=>loadSharedDesign(b.dataset.openDesign,false)));
    } catch(e) { $("#modal-content").innerHTML='<div class="empty-gallery"><strong>Could not load saved designs</strong><p>'+escapeText(e.message)+'</p><button class="button button-ghost" id="retry-library">Try again</button></div>';$("#retry-library").onclick=openLibrary; }
  }
  function closeModal() { $("#modal-backdrop").hidden=true; }
  async function loadSharedDesign(code, shared = true) {
    try {
      const res=await fetch(API+"/designs?share="+encodeURIComponent(code));const payload=await res.json().catch(()=>({}));
      if(!res.ok||!payload.design)throw new Error(payload.error||"Could not open this design.");
      pushHistory(); const d=payload.design; cfg={...defaultConfig(),...(d.config||{})}; cfg.elements=Array.isArray(cfg.elements)?cfg.elements:baseElements();
      photoDataUrl="";originalFile=null;latestShareCode=d.share_code;selectedLayer=cfg.photo_key?"photo":"team";$("#design-name").value=d.design_name||"Shared design";
      activePalette=Object.keys(palettes).find(k=>palettes[k].accent===cfg.accent)||"";
      if(cfg.photo_key) {
        const img=await loadImage(imageHref());photoWidth=img.naturalWidth||1;photoHeight=img.naturalHeight||1;
      }
      syncInputs();render();closeModal();lastSnapshot=snapshotData();setStatus("Shared design loaded","saved");
      if(shared)toast("Shared design loaded. Make it your own.");
    }catch(e){toast(e.message||"Could not open design.");}
  }
  async function shareDesign() {
    const d=await saveDesign(); if(!d)return;
    const url=new URL(location.href);url.search="";url.searchParams.set("share",d.share_code);
    try { await navigator.clipboard.writeText(url.href);toast("Share link copied to clipboard."); }
    catch { window.prompt("Copy this share link",url.href); }
  }
  function downloadBlob(blob, filename) {
    if(activeBlobUrl)URL.revokeObjectURL(activeBlobUrl);
    activeBlobUrl=URL.createObjectURL(blob);const a=document.createElement("a");a.href=activeBlobUrl;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>{if(activeBlobUrl){URL.revokeObjectURL(activeBlobUrl);activeBlobUrl="";}},30000);
  }
  function safeFilename(s) { return (s||"creasecraft-sticker").normalize("NFKD").replace(/[^a-zA-Z0-9-_]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"creasecraft-sticker"; }
  async function exportDesign(type) {
    $("#export-popover").hidden=true;
    const name=safeFilename($("#design-name").value);
    try {
      if(type==="json") { downloadBlob(new Blob([JSON.stringify({app:"CreaseCraft Studio",version:1,name:$("#design-name").value,config:cfg},null,2)],{type:"application/json"}),name+".json");toast("Editable design backup exported.");return; }
      const svg = svgForConfig(cfg,imageHref(),false,fitDims(480,530));
      if(type==="svg") { downloadBlob(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}),name+".svg");toast("SVG artwork exported.");return; }
      toast("Rendering transparent PNG…");
      const blob=new Blob([svg],{type:"image/svg+xml;charset=utf-8"});const url=URL.createObjectURL(blob);
      try {
        const img=await loadImage(url);const c=document.createElement("canvas");c.width=1520;c.height=1800;
        const ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
        const png=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error("PNG export failed.")),"image/png"));
        downloadBlob(png,name+".png");toast("Transparent 2× PNG exported.");
      } finally {URL.revokeObjectURL(url);}
    } catch(e) { console.error(e);toast("Export failed: "+(e.message||"please try again.")); }
  }
  function addText() {
    const text=window.prompt("What should the new sticker text say?", "YOUR TEXT");
    if(text===null)return;
    const val=text.trim().slice(0,80);if(!val){toast("Text cannot be empty.");return;}
    update(()=>{const id=makeId();cfg.elements.push({id,type:"text",text:val,shape:"star",x:380,y:260,size:46,color:cfg.ink,rotation:0,font:cfg.font||"Syne",weight:"bold",opacity:1});selectedLayer=id;},true);
    chooseTab("type");ensureCustomTextEditor();$("#custom-layer-text").value=val;toast("Text layer added. Drag it on the canvas.");
  }
  function ensureCustomTextEditor() {
    if($("#custom-text-control"))return;
    const block=document.createElement("div");block.id="custom-text-control";block.className="field";
    block.innerHTML='<label for="custom-layer-text">Selected text layer</label><input id="custom-layer-text" maxlength="80" placeholder="Edit selected text">';
    const parent=$('[data-panel="type"] .control-section');parent.appendChild(block);
    $("#custom-layer-text").addEventListener("input",e=>{update(()=>updateElement(selectedLayer,{text:e.target.value}),false);});
  }
  function selectLayer(id) {
    selectedLayer=id;render();
    if(!["team","number","tagline","photo"].includes(id)) {
      const el=cfg.elements.find(e=>e.id===id);
      if(el&&el.type==="text"){ensureCustomTextEditor();$("#custom-layer-text").value=el.text;chooseTab("type");}
    }
  }
  function deleteSelected() {
    if(selectedLayer==="photo"){if(!imageHref()){toast("There is no photo to remove.");return;}update(()=>{photoDataUrl="";originalFile=null;cfg.photo_key="";cfg.photo_name="";selectedLayer="team";},true);toast("Photo removed from the canvas.");return;}
    if(["team","number","tagline"].includes(selectedLayer)){toast("Use the text controls to edit this core layer.");return;}
    update(()=>{cfg.elements=cfg.elements.filter(e=>e.id!==selectedLayer);selectedLayer="photo";},true);toast("Layer deleted.");
  }
  function centerSelected() {
    update(()=>{if(selectedLayer==="photo"){cfg.photo_x=380;cfg.photo_y=380;cfg.photo_rotation=0;cfg.photo_scale=1;}else{const e=cfg.elements.find(x=>x.id===selectedLayer);if(e){e.x=380;e.y=450;e.rotation=0;}}},true);
  }
  function setCanvasBg(mode) {
    canvasBg=mode;$("#canvas-wrap").classList.toggle("checker",mode==="checker");$("#canvas-wrap").classList.toggle("cream",mode==="cream");$("#canvas-wrap").classList.toggle("dark",mode==="dark");
    $$(".canvas-bg-option").forEach(b=>b.classList.toggle("active",b.dataset.bg===mode));
  }
  function resetDesign() {
    if(!confirm("Reset the current design? This won't delete saved designs."))return;
    update(()=>{cfg=defaultConfig();photoDataUrl="";originalFile=null;photoWidth=photoHeight=1;selectedLayer="team";activePalette="lime";},true);syncInputs();setCanvasBg("checker");toast("A fresh canvas is ready.");
  }
  async function loadLocalOrShare() {
    const share=new URLSearchParams(location.search).get("share");
    if(share){await loadSharedDesign(share,false);return;}
    try {
      const local=localStorage.getItem("cc_last_design");
      if(local){const x=JSON.parse(local);if(x&&x.cfg){cfg={...defaultConfig(),...x.cfg};photoDataUrl=x.photoDataUrl||"";selectedLayer=x.selectedLayer||"team";}}
    } catch {}
  }

  // Image/layer pointer gestures are handled at the stable SVG root, so re-rendering doesn't lose the drag capture.
  let dragState=null;
  function svgPoint(evt) {
    const rect=$("#sticker-svg").getBoundingClientRect();
    return {x:(evt.clientX-rect.left)/rect.width*760,y:(evt.clientY-rect.top)/rect.height*900};
  }
  $("#sticker-svg").addEventListener("pointerdown",evt=>{
    const target=evt.target.closest("[data-layer]");
    if(!target)return;
    const id=target.dataset.layer;if(id==="photo"&&!imageHref())return;
    selectLayer(id);const p=svgPoint(evt);
    const el=cfg.elements.find(e=>e.id===id);
    dragState={id,start:p,origin:id==="photo"?{x:cfg.photo_x,y:cfg.photo_y}:{x:el.x,y:el.y},didMove:false};
    $("#sticker-svg").setPointerCapture(evt.pointerId);evt.preventDefault();
  });
  $("#sticker-svg").addEventListener("pointermove",evt=>{
    if(!dragState)return;const p=svgPoint(evt);const dx=p.x-dragState.start.x,dy=p.y-dragState.start.y;
    if(Math.abs(dx)+Math.abs(dy)>1)dragState.didMove=true;
    if(dragState.id==="photo"){cfg.photo_x=Math.max(-100,Math.min(860,dragState.origin.x+dx));cfg.photo_y=Math.max(-100,Math.min(1000,dragState.origin.y+dy));}
    else {const el=cfg.elements.find(e=>e.id===dragState.id);if(el){el.x=Math.max(0,Math.min(760,dragState.origin.x+dx));el.y=Math.max(0,Math.min(900,dragState.origin.y+dy));}}
    render();
  });
  function stopDrag(){if(dragState){if(dragState.didMove){markDirty();lastSnapshot=snapshotData();}dragState=null;}}
  $("#sticker-svg").addEventListener("pointerup",stopDrag);$("#sticker-svg").addEventListener("pointercancel",stopDrag);

  // Events
  fileInput.addEventListener("change",e=>acceptPhoto(e.target.files&&e.target.files[0]));
  ["#empty-upload-btn","#toolbar-upload-btn"].forEach(id=>$(id).addEventListener("click",pickFile));
  $("#remove-bg-btn").addEventListener("click",aiCutout);
  $("#canvas-wrap").addEventListener("dragover",e=>{e.preventDefault();$("#canvas-wrap").style.outline="2px solid #c9f34a";});
  $("#canvas-wrap").addEventListener("dragleave",()=>$("#canvas-wrap").style.outline="");
  $("#canvas-wrap").addEventListener("drop",e=>{e.preventDefault();$("#canvas-wrap").style.outline="";const f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f)acceptPhoto(f);});
  $$(".inspector-tab").forEach(b=>b.addEventListener("click",()=>chooseTab(b.dataset.tab)));
  $$(".format-chip,[data-format].product-item").forEach(b=>b.addEventListener("click",()=>setFormat(b.dataset.format)));
  $$(".template-card").forEach(b=>b.addEventListener("click",()=>applyTemplate(b.dataset.template)));
  $("#all-templates-btn").addEventListener("click",()=>$("#templates-section").scrollIntoView({behavior:"smooth",block:"start"}));
  $$("[data-nav]").forEach(b=>b.addEventListener("click",()=>{
    $$(".nav-item").forEach(n=>n.classList.toggle("active",n===b));
    const nav=b.dataset.nav;
    if(nav==="designs")openLibrary();
    else if(nav==="templates")$("#templates-section").scrollIntoView({behavior:"smooth",block:"start"});
    else if(nav==="brand"){chooseTab("sticker");$(".control-section:nth-of-type(2)",$('[data-panel="sticker"]')).scrollIntoView({behavior:"smooth",block:"nearest"});toast("Choose a brand palette or set your own colours.");}
    else window.scrollTo({top:0,behavior:"smooth"});
  }));
  $$("[data-outline]").forEach(b=>b.addEventListener("click",()=>update(()=>{cfg.outline_width=Number(b.dataset.outline);syncSmallValues();},true)));
  $("#outline-width").addEventListener("input",e=>{cfg.outline_width=Number(e.target.value);syncSmallValues();render();markDirty();lastSnapshot=snapshotData();});
  $("#outline-color").addEventListener("input",e=>{cfg.outline_color=e.target.value;syncSmallValues();render();markDirty();lastSnapshot=snapshotData();});
  $$("[data-color]").forEach(b=>b.addEventListener("click",()=>{cfg.outline_color=b.dataset.color;syncSmallValues();render();markDirty();lastSnapshot=snapshotData();}));
  $$("[data-palette]").forEach(b=>b.addEventListener("click",()=>{
    const p=palettes[b.dataset.palette];if(!p)return;
    update(()=>{activePalette=b.dataset.palette;cfg.accent=p.accent;cfg.ink=p.ink;cfg.outline_color=p.outline;cfg.elements.forEach(e=>{if(e.id==="number")e.color=cfg.accent;if(e.id==="team"||e.id==="tagline")e.color=cfg.ink;});syncInputs();},true);
  }));
  $("#accent-color").addEventListener("input",e=>{cfg.accent=e.target.value;updateElement("number",{color:cfg.accent});syncSmallValues();render();markDirty();lastSnapshot=snapshotData();});
  $("#team-text").addEventListener("input",e=>{cfg.team=e.target.value;updateElement("team",{text:e.target.value});render();markDirty();lastSnapshot=snapshotData();});
  $("#number-text").addEventListener("input",e=>{cfg.number=e.target.value;updateElement("number",{text:e.target.value,color:cfg.accent});render();markDirty();lastSnapshot=snapshotData();});
  $("#tagline-text").addEventListener("input",e=>{cfg.tagline=e.target.value;updateElement("tagline",{text:e.target.value});render();markDirty();lastSnapshot=snapshotData();});
  $("#font-select").addEventListener("change",e=>update(()=>{cfg.font=e.target.value;cfg.elements.filter(x=>["team","number","tagline"].includes(x.id)).forEach(x=>x.font=cfg.font);},true));
  $("#type-color").addEventListener("input",e=>{cfg.type_color=e.target.value;update(()=>{cfg.ink=e.target.value;cfg.elements.forEach(x=>{if(x.id==="team"||x.id==="tagline")x.color=e.target.value;});},true);});
  $("#shadow-toggle").addEventListener("change",e=>update(()=>cfg.shadow=e.target.checked,true));
  $("#shadow-blur").addEventListener("input",e=>{cfg.shadow_blur=Number(e.target.value);syncSmallValues();render();markDirty();lastSnapshot=snapshotData();});
  $("#shadow-opacity").addEventListener("input",e=>{cfg.shadow_opacity=Number(e.target.value);syncSmallValues();render();markDirty();lastSnapshot=snapshotData();});
  $("#motif-select").addEventListener("change",e=>update(()=>cfg.motif=e.target.value,true));
  $("#photo-scale").addEventListener("input",e=>{cfg.photo_scale=Number(e.target.value)/100;syncSmallValues();render();markDirty();lastSnapshot=snapshotData();});
  $("#photo-rotation").addEventListener("input",e=>{cfg.photo_rotation=Number(e.target.value);syncSmallValues();render();markDirty();lastSnapshot=snapshotData();});
  ["#center-image-btn","#center-photo-btn"].forEach(id=>$(id).addEventListener("click",centerSelected));
  $("#delete-layer-btn").addEventListener("click",deleteSelected);
  $("#add-text-btn").addEventListener("click",addText);$("#add-layer-btn").addEventListener("click",addText);
  $("#reset-design-btn").addEventListener("click",resetDesign);
  $("#reset-view-btn").addEventListener("click",()=>{cfg.photo_x=380;cfg.photo_y=385;cfg.photo_scale=1;cfg.photo_rotation=0;syncSmallValues();render();toast("Canvas view reset.");});
  $("#checker-btn").addEventListener("click",()=>setCanvasBg(canvasBg==="checker"?"cream":"checker"));
  $("#fit-btn").addEventListener("click",()=>{$("#canvas-stage").style.transform="scale(1)";toast("Canvas fitted to workspace.");});
  $$(".canvas-bg-option").forEach(b=>b.addEventListener("click",()=>setCanvasBg(b.dataset.bg)));
  $("#undo-btn").addEventListener("click",undo);$("#redo-btn").addEventListener("click",redo);
  $("#select-tool").addEventListener("click",()=>{ $("#select-tool").classList.add("selected"); toast("Select a photo or text layer on the canvas to move it."); });
  $("#save-btn").addEventListener("click",saveDesign);
  $("#share-btn").addEventListener("click",shareDesign);
  $("#export-menu-btn").addEventListener("click",e=>{e.stopPropagation();$("#export-popover").hidden=!$("#export-popover").hidden;});
  $$("[data-export]").forEach(b=>b.addEventListener("click",()=>exportDesign(b.dataset.export)));
  $("#modal-close").addEventListener("click",closeModal);
  $("#modal-backdrop").addEventListener("click",e=>{if(e.target===$("#modal-backdrop"))closeModal();});
  document.addEventListener("keydown",e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo();}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();saveDesign();}
    if(e.key==="Escape"){closeModal();$("#export-popover").hidden=true;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="o"){e.preventDefault();pickFile();}
  });
  document.addEventListener("click",e=>{if(!e.target.closest("#export-menu-btn")&&!e.target.closest("#export-popover"))$("#export-popover").hidden=true;});
  $("#layer-list").addEventListener("click",e=>{
    const remove=e.target.closest("[data-remove-layer]");if(remove){e.stopPropagation();const id=remove.dataset.removeLayer;if(id===selectedLayer)selectedLayer="team";update(()=>cfg.elements=cfg.elements.filter(el=>el.id!==id),true);return;}
    const row=e.target.closest("[data-select-layer]");if(row)selectLayer(row.dataset.selectLayer);
  });
  $("#design-name").addEventListener("input",()=>markDirty());

  // Startup: shared link first, else fresh canvas; save settings locally as a useful recovery path.
  (async()=>{
    await loadLocalOrShare();
    syncInputs();render();updateUndoButtons();lastSnapshot=snapshotData();
    setCanvasBg("checker");
    setInterval(()=>{try{localStorage.setItem("cc_last_design",JSON.stringify({cfg,photoDataUrl,selectedLayer}));}catch{}},5000);
    const saved = $("#save-status");
    if(saved) saved.title = "Save to My Designs to create a persistent share link.";
  })();
})();