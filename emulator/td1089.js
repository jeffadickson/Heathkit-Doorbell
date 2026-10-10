(() => {
  const NAMES = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B","C′"];
  const BEATS = 16, MAX_PER_ROW = 9;
  // Ladder from the schematic, top row (high C′) first. R40 is unused in the numbering.
  const LADDER = [["R31",27000],["R32",3300],["R33",3600],["R34",3600],["R35",3900],["R36",3900],["R37",4300],["R38",4700],["R39",4700],["R41",5100],["R42",5600],["R43",5600],["R44",6200]];
  const X_OFFSET = 27250; // tuning pot + oscillator, fitted
  // Note index n: 0 = low C … 12 = C′. Row k from top = 12 - n.
  function ladderTotals(vals){ let s = X_OFFSET; return vals.map(v => (s += v)); }
  const nominalTotals = ladderTotals(LADDER.map(r => r[1]));
  const centsErr = NAMES.map((_, n) => { const k = 12 - n; const f = nominalTotals[12] / nominalTotals[k]; return 1200*Math.log2(f) - 100*n; });

  // Fixed "as-built" ±5% tolerances (seeded so your kit always sounds like your kit).
  let seed = 1089; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return (s - 3) / 1.0; };
  const builtVals = LADDER.map(r => r[1] * (1 + Math.max(-0.05, Math.min(0.05, gauss() * 0.02))));
  const builtTotals = ladderTotals(builtVals);

  // Ladder table
  const tb = document.getElementById("ladderTable");
  LADDER.forEach((r, k) => {
    const n = 12 - k, e = centsErr[n];
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${NAMES[n]}</td><td class="mono">${r[0]}</td><td class="r">${r[1] >= 10000 ? (r[1]/1000)+"K" : r[1]}</td><td class="r ${Math.abs(e) < 5 ? "ok" : ""}">${e >= 0 ? "+" : "−"}${Math.abs(e).toFixed(1)}¢</td>`;
    tb.appendChild(tr);
  });

  const PRESETS = {
    "Westminster": [9,7,5,0, 5,9,7,5, 9,5,7,0, 0,7,9,5],
    "Ode to Joy":  [4,4,5,7, 7,5,4,2, 0,0,2,4, 4,2,2,-1],
    "Twinkle":     [0,0,7,7, 9,9,7,-1, 5,5,4,4, 2,2,0,-1],
    "Charge!":     [0,5,9,12,-1,9,12,-1,-1,-1,-1,-1,-1,-1,-1,-1],
    "Shave & haircut":[0,7,-1,7,9,7,-1,-1,11,-1,12,-1,-1,-1,-1,-1],
    "Chromatic":   [0,1,2,3,4,5,6,7,8,9,10,11,12,-1,-1,-1]
  };
  let tune = PRESETS["Westminster"].slice();

  const $ = id => document.getElementById(id);
  const board = $("board"), presetsEl = $("presets"), status = $("status");
  const leds = [], ledEls = [], cells = [], counts = [];

  board.appendChild(Object.assign(document.createElement("div"), {className:"lbl"}));
  for (let b = 0; b < BEATS; b++) {
    const d = document.createElement("div"); d.className = "lbl beat";
    const l = document.createElement("div"); l.className = "led";
    d.appendChild(l); d.appendChild(Object.assign(document.createElement("span"), {textContent:"A"+(b+1)}));
    leds.push(l); board.appendChild(d);
  }
  board.appendChild(Object.assign(document.createElement("div"), {className:"cnt", textContent:"/9"}));
  for (let n = 12; n >= 0; n--) {
    board.appendChild(Object.assign(document.createElement("div"), {className:"lbl note", textContent:NAMES[n]}));
    cells[n] = [];
    for (let b = 0; b < BEATS; b++) {
      const c = document.createElement("button");
      c.type = "button"; c.className = "cell"; c.id = `s-${n}-${b}`;
      c.setAttribute("aria-label", `Lead A${b+1} to ${NAMES[n]}`);
      c.addEventListener("click", () => plug(b, n));
      cells[n][b] = c; board.appendChild(c);
    }
    const ct = document.createElement("div"); ct.className = "cnt num"; counts[n] = ct; board.appendChild(ct);
  }
  function markRear() { const k = +$("rearpin").value; leds.forEach((l, i) => l.classList.toggle("rear", i < k)); }
  function plug(b, n) {
    if (tune[b] === n) { tune[b] = -1; custom(); render(); return; }
    if (tune.filter(x => x === n).length >= MAX_PER_ROW) { status.textContent = `All nine ${NAMES[n]} sockets are taken. Move another lead first.`; return; }
    tune[b] = n; custom(); render(); if (ctx) blip(n);
  }
  function custom() { [...presetsEl.children].forEach(x => x.setAttribute("aria-pressed","false")); }
  function render() {
    for (let n = 0; n <= 12; n++) {
      let k = 0;
      for (let b = 0; b < BEATS; b++) { const on = tune[b] === n; if (on) k++; cells[n][b].classList.toggle("on", on); cells[n][b].setAttribute("aria-pressed", on ? "true" : "false"); }
      counts[n].textContent = k || ""; counts[n].classList.toggle("full", k >= MAX_PER_ROW);
    }
    fixSlots(); drawWires();
  }

  // ---- Wire view: 16 leads off the beat bar, 13 note rows × 9 socket holes ----
  const slot = Array(BEATS).fill(-1);
  const WIRE_COL = ["#262626","#7a4a22","#c8321e","#e57a1c","#e2bf22","#3f9a3a","#2f63c4","#7d4bb3","#8f8f8f","#f2f2f2"];
  const TX = b => 62 + b * 37, TY = 76, RY = n => 124 + (12 - n) * 33, SX = s => 128 + s * 60;
  const svg = $("wires"), NS = "http://www.w3.org/2000/svg";
  let active = -1, drag = null;
  function fixSlots() {
    const used = Array.from({length:13}, () => new Set());
    for (let b = 0; b < BEATS; b++) { const n = tune[b];
      if (n < 0) { slot[b] = -1; continue; }
      if (slot[b] >= 0 && slot[b] < MAX_PER_ROW && !used[n].has(slot[b])) used[n].add(slot[b]); else slot[b] = -1; }
    for (let b = 0; b < BEATS; b++) { const n = tune[b];
      if (n >= 0 && slot[b] < 0) for (let s = 0; s < MAX_PER_ROW; s++) if (!used[n].has(s)) { slot[b] = s; used[n].add(s); break; } }
  }
  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); (parent || svg).appendChild(e); return e; }
  function wirePath(b, x2, y2, hanging) {
    const x1 = TX(b), y1 = TY + 7;
    if (hanging) return `M${x1},${y1} C${x1},${y1 + 18} ${x2},${y2 - 14} ${x2},${y2}`;
    const d = Math.max(30, y2 - y1);
    return `M${x1},${y1} C${x1},${y1 + d * 0.75 + 34} ${x2 + (x1 - x2) * 0.12},${y2 + 40} ${x2},${y2 + 4}`;
  }
  function drawWires() {
    svg.textContent = "";
    const defs = el("defs", {});
    const pat = el("pattern", {id:"weave", width:4, height:4, patternUnits:"userSpaceOnUse", patternTransform:"rotate(45)"}, defs);
    el("rect", {width:4, height:4, style:"fill:var(--fabric-a)"}, pat);
    el("rect", {width:2, height:4, style:"fill:var(--fabric-b)"}, pat);
    el("rect", {x:0, y:0, width:680, height:560, rx:6, fill:"url(#weave)"});
    // beat bar with LEDs and lead terminals
    el("rect", {x:38, y:30, width:604, height:58, rx:4, fill:"#3a2a1f", stroke:"#c99a35", "stroke-width":2});
    for (let b = 0; b < BEATS; b++) {
      el("text", {x:TX(b), y:22, "text-anchor":"middle", style:"font:600 11px var(--f-mono);fill:#2a1d15"}).textContent = "A" + (b + 1);
      el("circle", {cx:TX(b), cy:46, r:5, fill: b === active ? "#ff6a3d" : "#5a3a28", style: b === active ? "filter:drop-shadow(0 0 4px #ff6a3d)" : ""});
      if (b < +$("rearpin").value) el("circle", {cx:TX(b), cy:46, r:7.5, fill:"none", stroke:"#c99a35", "stroke-width":1});
      el("circle", {cx:TX(b), cy:TY, r:7, fill:"#d9ad45", stroke:"#6b4a0e", "stroke-width":1.5, "data-b":b, style:"cursor:grab"});
    }
    // note rows and holes
    for (let n = 12; n >= 0; n--) {
      el("text", {x:44, y:RY(n) + 4, "text-anchor":"middle", style:"font:600 13px var(--f-mono);fill:#2a1d15"}).textContent = NAMES[n];
      el("line", {x1:100, y1:RY(n), x2:640, y2:RY(n), stroke:"#8a7150", "stroke-width":1, "stroke-dasharray":"2 4"});
      for (let s = 0; s < MAX_PER_ROW; s++) {
        el("circle", {cx:SX(s), cy:RY(n), r:8.5, fill:"#d8c7a6", stroke:"#8a7150", "stroke-width":1});
        el("circle", {cx:SX(s), cy:RY(n), r:4, fill:"#140d09"});
      }
    }
    // wires, in lead order so later leads lie on top
    for (let b = 0; b < BEATS; b++) {
      let x2, y2, hanging = false;
      if (drag && drag.b === b && drag.moved) { x2 = drag.x; y2 = drag.y; }
      else if (tune[b] >= 0) { x2 = SX(slot[b]); y2 = RY(tune[b]); }
      else { x2 = TX(b) + 7; y2 = TY + 44; hanging = true; }
      const d = wirePath(b, x2, y2, hanging), col = WIRE_COL[b % 10], hot = b === active;
      el("path", {d, fill:"none", stroke: hot ? "#ff6a3d" : "#1a120c", "stroke-width": hot ? 7 : 5.2, "stroke-linecap":"round", opacity: hot ? 0.9 : 0.85});
      el("path", {d, fill:"none", stroke:col, "stroke-width":3.2, "stroke-linecap":"round"});
      el("rect", {x:x2 - 5, y:y2 - 5, width:10, height:10, rx:2, fill:col, stroke:"#1a120c", "stroke-width":1.5, "data-b":b, style:"cursor:grab"});
    }
  }
  function svgPoint(e) { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
  svg.addEventListener("pointerdown", e => {
    const t = e.target.closest("[data-b]"); if (!t) return;
    e.preventDefault(); const p = svgPoint(e);
    drag = {b: +t.getAttribute("data-b"), x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false};
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", e => {
    if (!drag) return; const p = svgPoint(e);
    drag.x = p.x; drag.y = p.y;
    if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 4) drag.moved = true;
    if (drag.moved) drawWires();
  });
  function endDrag(e) {
    if (!drag) return; const d = drag; drag = null;
    if (!d.moved) { drawWires(); return; }
    let best = null, bd = 20;
    for (let n = 0; n <= 12; n++) for (let s = 0; s < MAX_PER_ROW; s++) {
      const dist = Math.hypot(SX(s) - d.x, RY(n) - d.y); if (dist < bd) { bd = dist; best = {n, s}; }
    }
    if (!best) {
      if (tune[d.b] >= 0) status.textContent = `Lead A${d.b + 1} unplugged: beat ${d.b + 1} is now a rest.`;
      tune[d.b] = -1; custom(); render(); return;
    }
    const other = tune.findIndex((n, o) => o !== d.b && n === best.n && slot[o] === best.s);
    if (other >= 0) { status.textContent = `That ${NAMES[best.n]} hole already has lead A${other + 1} in it.`; drawWires(); return; }
    tune[d.b] = best.n; slot[d.b] = best.s; custom(); render();
    status.textContent = `A${d.b + 1} → ${NAMES[best.n]}.`;
    if (ctx) blip(best.n);
  }
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  function setActive(b) { active = b; leds.forEach((l, i) => l.classList.toggle("lit", i === b)); drawWires(); }
  function setMode(wire) {
    $("wireView").hidden = !wire; $("gridView").hidden = wire;
    $("modeWire").setAttribute("aria-pressed", wire ? "true" : "false");
    $("modeGrid").setAttribute("aria-pressed", wire ? "false" : "true");
  }
  $("modeWire").addEventListener("click", () => setMode(true));
  $("modeGrid").addEventListener("click", () => setMode(false));
  Object.keys(PRESETS).forEach((name, i) => {
    const p = document.createElement("button"); p.type = "button"; p.className = "chip"; p.textContent = name;
    p.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    p.addEventListener("click", () => { tune = PRESETS[name].slice(); slot.fill(-1); [...presetsEl.children].forEach(x => x.setAttribute("aria-pressed", x === p ? "true" : "false")); render(); status.textContent = `${name} loaded. Press FRONT or BACK.`; });
    presetsEl.appendChild(p);
  });
  $("clear").addEventListener("click", () => { tune = Array(BEATS).fill(-1); custom(); render(); status.textContent = "All leads unplugged."; });

  const tempo = $("tempo"), decay = $("decay"), tuning = $("tuning"), vol = $("vol");
  function showKnobs() {
    $("tempoV").textContent = `${(60/ +tempo.value).toFixed(2)} s/beat`;
    $("decayV").textContent = `${Math.round(+decay.value*1000)} ms`;
    const t = +tuning.value; $("tuningV").textContent = t === 0 ? "low C = C4" : `${t > 0 ? "+" : ""}${t} semitones`;
    $("volV").textContent = `${Math.round(vol.value*100)}%`;
  }
  [tempo, decay, tuning, vol].forEach(e => e.addEventListener("input", showKnobs)); showKnobs();
  $("rearpin").addEventListener("change", () => { markRear(); drawWires(); }); markRear();

  // Heard pitch for note n (the ÷4 output).
  function noteFreq(n) {
    const lowC = 261.6256 * Math.pow(2, +tuning.value / 12);
    if (!$("ladder").checked) return lowC * Math.pow(2, n / 12);
    const k = 12 - n; return lowC * nominalTotals[12] / builtTotals[k];
  }

  let ctx = null, input, spk = {}, playing = false;
  const onePole = fc => { const a = Math.exp(-2 * Math.PI * fc / ctx.sampleRate); return ctx.createIIRFilter([1 - a], [1, -a]); };
  function audio() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    input = ctx.createGain();                 // summing node at Q5's collector
    const p1 = onePole(1100), p2 = onePole(340); // C5 at the node, then R27/C6
    const makeup = ctx.createGain(); makeup.gain.value = 3.2;
    spk.vol = ctx.createGain();
    spk.hp = ctx.createBiquadFilter(); spk.hp.type = "highpass"; spk.hp.Q.value = 0.9;
    spk.pk = ctx.createBiquadFilter(); spk.pk.type = "peaking"; spk.pk.frequency.value = 1200; spk.pk.Q.value = 1.2;
    spk.lp = ctx.createBiquadFilter(); spk.lp.type = "lowpass"; spk.lp.Q.value = 0.7;
    spk.sh = ctx.createWaveShaper(); const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i/511.5 - 1; curve[i] = Math.tanh(1.6*x)/Math.tanh(1.6); }
    spk.sh.curve = curve;
    input.connect(p1); p1.connect(p2); p2.connect(makeup); makeup.connect(spk.vol);
    spk.vol.connect(spk.sh); spk.sh.connect(spk.hp); spk.hp.connect(spk.pk); spk.pk.connect(spk.lp); spk.lp.connect(ctx.destination);
  }
  function setSpeaker() {
    const s = $("speaker").checked;
    spk.hp.frequency.value = s ? 320 : 30;
    spk.pk.gain.value = s ? 7 : 0;
    spk.lp.frequency.value = s ? 4500 : 16000;
    spk.vol.gain.value = +vol.value * 0.6;
  }
  // One beat: ÷4 square (15K), ÷8 (330K), ÷16 (1M) summed, Q5 shunt decay, cut at next beat.
  function strike(n, t, end, coldTap) {
    const f = noteFreq(n), tau = +decay.value;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.003);
    env.gain.setTargetAtTime(0.0001, t + 0.003, tau);
    if (coldTap) { // intermittent ladder tap: the oscillator stalls and restarts
      let x = t + 0.01;
      while (x < end) { const off = 0.006 + rnd()*0.035, on = 0.01 + rnd()*0.05;
        env.gain.setValueAtTime(0.0001, x); env.gain.setTargetAtTime(0.0001, x + off, tau);
        env.gain.setValueAtTime(0.45 * Math.exp(-(x + off - t)/tau), x + off); x += off + on; }
      crackle(t, end - t);
    }
    // Next beat: the counter moves on, so this note is cut where it stands.
    if (env.gain.cancelAndHoldAtTime) env.gain.cancelAndHoldAtTime(end);
    env.gain.linearRampToValueAtTime(0.0001, end + 0.003);
    [[1, 1], [0.5, 15/330], [0.25, 15/1000]].forEach(([mul, w]) => {
      const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = f * mul;
      const g = ctx.createGain(); g.gain.value = w;
      o.connect(g); g.connect(env); o.start(t); o.stop(end + 0.01);
    });
    env.connect(input);
  }
  function crackle(t, dur) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = rnd() < 0.002 ? (rnd()*2-1) * 0.5 : 0;
    const s = ctx.createBufferSource(); s.buffer = buf; s.connect(spk.vol); s.start(t);
  }
  function ripple(t, dur) {
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 60;
    const g = ctx.createGain(); g.gain.value = 0.01; o.connect(g); g.connect(spk.vol); o.start(t); o.stop(t + dur);
  }
  function blip(n) { setSpeaker(); const t = ctx.currentTime + 0.01; strike(n, t, t + 0.3, false); }

  function ring(beats, label) {
    audio(); if (ctx.state === "suspended") ctx.resume();
    if (playing) return;
    setSpeaker();
    const beat = 60 / +tempo.value, seq = tune.slice(0, beats);
    const used = seq.filter(x => x >= 0);
    if (!used.length) { status.textContent = "No leads plugged in for those beats, so the oscillator never starts."; return; }
    const freq = {}; used.forEach(n => freq[n] = (freq[n]||0) + 1);
    const coldN = $("cold").checked ? +Object.keys(freq).sort((a,b) => freq[b]-freq[a])[0] : -2;
    playing = true; const t0 = ctx.currentTime + 0.06;
    const total = beat * beats + +decay.value * 4;
    if ($("speaker").checked) ripple(t0, total);
    seq.forEach((n, b) => {
      const t = t0 + b*beat, last = b === beats - 1;
      if (n >= 0) strike(n, t, last ? t + Math.max(beat, +decay.value * 4) : t + beat, n === coldN);
      setTimeout(() => setActive(b), (t - ctx.currentTime)*1000);
    });
    setTimeout(() => { setActive(-1); playing = false;
      status.textContent = $("cold").checked ? `${label} done. The ${NAMES[coldN]} tap has a cold joint: dull grey, balled-up solder. Reflow it.` : `${label} done.`; },
      (t0 - ctx.currentTime + beats*beat + 0.15)*1000);
    status.textContent = `${label}: ${beats} beats…`;
  }
  const front = $("front"), rear = $("rear");
  front.addEventListener("click", () => ring(16, "Front door"));
  rear.addEventListener("click", () => ring(+$("rearpin").value, "Back door"));
  [front, rear].forEach(btn => {
    btn.addEventListener("pointerdown", () => btn.classList.add("pressed"));
    ["pointerup","pointerleave"].forEach(e => btn.addEventListener(e, () => btn.classList.remove("pressed")));
  });
  render();
})();
