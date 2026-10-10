/*! UpBilim Engine v0.3.0 | MIT License | (c) 2026 UpBilim | https://upbilim.com
 * A tiny game engine for kids' games and AI-written games: 2D canvas, 3D on three.js (window.THREE),
 * physics on Rapier (window.RAPIER), genre kits UB.kit.*. Reference: docs/API.md */
(function () {
  if (typeof document === 'undefined' || document.getElementById('ub-style')) return;
  var st = document.createElement('style'); st.id = 'ub-style';
  st.textContent = "html,body{margin:0;height:100%;overflow:hidden;background:#05060c;touch-action:none;user-select:none;-webkit-user-select:none}\ncanvas{position:absolute;display:block}\n.ub-pad{position:fixed;left:0;right:0;bottom:12px;display:flex;justify-content:space-between;padding:0 14px;pointer-events:none}\n.ub-pad div{display:flex;gap:10px}\n.ub-pad button{pointer-events:auto;display:grid;place-items:center;padding:0;width:64px;height:64px;border-radius:50%;border:2px solid rgba(255,255,255,.5);background:rgba(255,255,255,.18);color:#fff;font:700 22px system-ui;touch-action:none}\n.ub-pad button:active{background:rgba(255,255,255,.4)}";
  (document.head || document.documentElement).appendChild(st);
})();
(function () {
  'use strict';
  var send = function (m) { try { parent.postMessage(Object.assign({ ub: 1 }, m), '*'); } catch (e) {} };
  window.addEventListener('error', function (e) { send({ type: 'ub:error', message: String(e.message || e.error || 'error'), line: e.lineno || 0 }); });
  window.addEventListener('unhandledrejection', function (e) { send({ type: 'ub:error', message: String((e.reason && e.reason.message) || e.reason || 'promise') }); });

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var UB = {
    clamp: clamp, rand: rand,
    randInt: function (a, b) { return Math.floor(rand(a, b + 1)); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    shuffle: function (arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    dist: function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
    overlap: function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; },
    circleHit: function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r; },
    pointIn: function (p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; },
    store: {},
  };

  // ---- sound: WebAudio synthesis, no files ----
  var ac = null;
  var tone = function (f1, f2, dur, type, vol, delay) {
    if (!ac) return;
    var t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(toneDest || ac.destination); o.start(t); o.stop(t + dur + 0.02);
  };
  // noise hit (boom, pop, whoosh, splash): a shared white-noise buffer through a filter
  var noiseBuf = null, toneDest = null;
  var noiseHit = function (dur, f1, f2, type, vol, delay) {
    if (!ac) return;
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); var nd = noiseBuf.getChannelData(0); for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; }
    var t = ac.currentTime + (delay || 0), src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; fl.type = type || 'lowpass'; fl.frequency.setValueAtTime(f1, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(toneDest || ac.destination); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  };
  var SFX = {
    jump: function () { tone(300, 700, 0.15, 'square', 0.06); },
    coin: function () { tone(900, 900, 0.07, 'square', 0.06); tone(1350, 1350, 0.12, 'square', 0.06, 0.07); },
    hit: function () { tone(220, 60, 0.25, 'sawtooth', 0.08); },
    shoot: function () { tone(1200, 200, 0.12, 'square', 0.04); },
    click: function () { tone(600, 600, 0.04, 'triangle', 0.08); },
    correct: function () { tone(523, 523, 0.1, 'triangle', 0.1); tone(784, 784, 0.18, 'triangle', 0.1, 0.1); },
    wrong: function () { tone(200, 150, 0.3, 'sawtooth', 0.07); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, f, 0.18, 'triangle', 0.09, i * 0.12); }); },
    lose: function () { [392, 330, 262].forEach(function (f, i) { tone(f, f * 0.95, 0.25, 'sawtooth', 0.07, i * 0.18); }); },
    powerup: function () { tone(300, 1500, 0.35, 'square', 0.05); },
    boom: function () { noiseHit(1.1, 900, 60, 'lowpass', 0.5); tone(90, 35, 0.6, 'sine', 0.25); },
    pop: function () { noiseHit(0.08, 3000, 1500, 'bandpass', 0.25); tone(500, 900, 0.06, 'triangle', 0.05); },
    whoosh: function () { noiseHit(0.45, 400, 2400, 'bandpass', 0.18); },
    splash: function () { noiseHit(0.5, 2500, 500, 'lowpass', 0.25); noiseHit(0.25, 4000, 2000, 'highpass', 0.08, 0.05); },
    magic: function () { [1046, 1318, 1568, 2093].forEach(function (f, i) { tone(f, f * 1.01, 0.25, 'sine', 0.05, i * 0.06); }); },
  };
  // a sound "from somewhere": in 3D from a world point ({ at: entity } or { x, y, z }), in 2D left/right by { x } on screen
  var spatial = null;   // set by the 3D part: (o) -> an input node with a panner, or null
  UB.sfx = function (name, o) {
    var f = SFX[name]; if (!f) return;
    if (!o || !ac) return f();
    var dest = null, g = ac.createGain(); g.gain.value = o.volume == null ? 1 : o.volume;
    if (UB.is3d && spatial && (o.at || o.z != null)) dest = spatial(o);
    else if (o.x != null && ac.createStereoPanner) { dest = ac.createStereoPanner(); dest.pan.value = clamp((o.x / (W || 960)) * 2 - 1, -1, 1) * 0.8; }
    g.connect(dest || ac.destination); if (dest) dest.connect(ac.destination);
    toneDest = g; try { f(); } finally { toneDest = null; }
    setTimeout(function () { try { g.disconnect(); if (dest) dest.disconnect(); } catch (e) {} }, 3000);
  };

  // ---- input: keyboard, mouse/touch in game coordinates, on-screen buttons on phones ----
  var held = {}, pressedNow = {}, aliases = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'Space', fire: 'Space', action: 'Space' };
  var keyName = function (k) { return aliases[k] || k; };
  var pointer = { x: 0, y: 0, down: false, pressed: false, released: false };
  UB.pointer = pointer;
  UB.key = function (k) { k = keyName(k); return !!held[k] || (k === 'ArrowLeft' && held.KeyA) || (k === 'ArrowRight' && held.KeyD) || (k === 'ArrowUp' && held.KeyW) || (k === 'ArrowDown' && held.KeyS); };
  UB.pressed = function (k) { k = keyName(k); return !!pressedNow[k] || (k === 'ArrowUp' && pressedNow.KeyW) || (k === 'ArrowLeft' && pressedNow.KeyA) || (k === 'ArrowRight' && pressedNow.KeyD) || (k === 'ArrowDown' && pressedNow.KeyS); };
  var unlock = function () { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume(); };
  window.addEventListener('keydown', function (e) {
    unlock();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].indexOf(e.code) >= 0) e.preventDefault();
    if (!held[e.code]) pressedNow[e.code] = true; held[e.code] = true;
  });
  window.addEventListener('keyup', function (e) { held[e.code] = false; });
  window.addEventListener('blur', function () { held = {}; });

  // ---- canvas: fixed game resolution, fitted into the window ----
  var canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'), W = 960, H = 540, scale = 1, offX = 0, offY = 0;
  document.body.appendChild(canvas);
  var fit = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), vw = window.innerWidth, vh = window.innerHeight;
    scale = Math.min(vw / W, vh / H); offX = (vw - W * scale) / 2; offY = (vh - H * scale) / 2;
    canvas.style.width = W * scale + 'px'; canvas.style.height = H * scale + 'px'; canvas.style.left = offX + 'px'; canvas.style.top = offY + 'px';
    canvas.width = Math.round(W * scale * dpr); canvas.height = Math.round(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    if (UB.onFit) UB.onFit(scale, offX, offY, dpr);
  };
  window.addEventListener('resize', fit);
  var toGame = function (e) { pointer.x = (e.clientX - offX) / scale; pointer.y = (e.clientY - offY) / scale; };
  canvas.addEventListener('pointerdown', function (e) { unlock(); toGame(e); pointer.down = true; pointer.pressed = true; });
  window.addEventListener('pointermove', toGame);
  window.addEventListener('pointerup', function (e) { toGame(e); if (pointer.down) pointer.released = true; pointer.down = false; });

  // __UB_TOUCH — the editor's "as on a phone" preview: on-screen buttons and touch hints on a computer
  var touch = window.__UB_TOUCH != null ? !!window.__UB_TOUCH : 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  UB.isTouch = touch;
  // level editor: "Play this level" — the kit skips the menu and starts this level right away
  UB.testLevel = typeof window.__UB_LEVEL === 'number' ? window.__UB_LEVEL : null;
  // On-screen buttons (touch screens only): names are left, right, up, down, jump, fire, action.
  // Arrows are SVG chevrons (arrow characters are banned by the "no emoji" rule), action buttons are letters.
  var chev = function (rot) { return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(' + rot + 'deg)"><path d="m15 18-6-6 6-6"/></svg>'; };
  var ICON = { left: chev(0), right: chev(180), up: chev(90), down: chev(270) }, LABEL = { jump: 'A', fire: 'B', action: 'A' };
  var padButton = function (n, code, color) {
    var b = document.createElement('button'); if (ICON[n]) b.innerHTML = ICON[n]; else b.textContent = LABEL[n] || n;
    if (color) b.style.borderColor = color;
    var on = function (e) { e.preventDefault(); unlock(); if (!held[code]) pressedNow[code] = true; held[code] = true; };
    var off = function (e) { e.preventDefault(); held[code] = false; };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    return b;
  };
  UB.touchControls = function (names) {
    if (!touch) return;
    var bar = document.createElement('div'); bar.className = 'ub-pad';
    var lr = document.createElement('div'), act = document.createElement('div');
    names.forEach(function (n) { (['left', 'right', 'up', 'down'].indexOf(n) >= 0 ? lr : act).appendChild(padButton(n, keyName(n))); });
    bar.appendChild(lr); bar.appendChild(act); document.body.appendChild(bar);
  };

  // Two players on one device: player 1 — WASD + F, player 2 — arrows + Enter; on phones each has buttons at their edge
  var DUO = {
    1: { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', action: 'KeyF', jump: 'KeyF', fire: 'KeyF' },
    2: { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', action: 'Enter', jump: 'Enter', fire: 'Enter' },
  };
  var player = function (n) {
    var m = DUO[n];
    return { key: function (k) { return !!held[m[k] || k]; }, pressed: function (k) { return !!pressedNow[m[k] || k]; } };
  };
  UB.p1 = player(1); UB.p2 = player(2);
  UB.touchControlsDuo = function (names) {
    if (!touch) return;
    var bar = document.createElement('div'); bar.className = 'ub-pad';
    [1, 2].forEach(function (p) {
      var side = document.createElement('div');
      names.forEach(function (n) { side.appendChild(padButton(n, DUO[p][n] || n, p === 1 ? '#4cc9f0' : '#f72585')); });
      bar.appendChild(side);
    });
    document.body.appendChild(bar);
  };

  // ---- team game (team mode): the host screen keeps the state, phones send actions and draw what they receive ----
  // The parent page (the iframe's host) relays messages through the server; messages from it are tagged ub:2.
  var net = { role: 'solo', me: null, state: null, ready: !window.__UB_NET }, bgTick = null;
  var players = [], inbox = [], outState = null, lastFlush = 0, sentAt = [];
  window.addEventListener('message', function (e) {
    if (e.source !== parent) return;
    var d = e.data; if (!d || d.ub !== 2) return;
    if (d.type === 'net:init') { net.role = d.role === 'host' ? 'host' : 'player'; net.me = d.me || null; players = d.players || []; net.ready = true; runGame(); }
    else if (d.type === 'net:players') players = d.players || [];
    else if (d.type === 'net:msg' && net.role === 'host') { if (inbox.length < 500) inbox.push({ from: d.from, data: d.data }); }
    else if (d.type === 'net:state' && net.role === 'player') net.state = d.state;
    else if (d.type === 'net:tick' && bgTick) bgTick();
  });
  // team game: the game code runs once the role is known (host / phone) — otherwise top-level code (for example
  // UB.create with different sizes for host and phone) would see the role 'solo'. No answer in 6 s — run anyway.
  // A game with physics (the RAPIER library is on the page): WebAssembly starts asynchronously — the game code waits for it too.
  var gameRan = false, physWait = !!window.RAPIER;
  var runGame = function () { if (gameRan || physWait || !net.ready || typeof window.__UB_GAME !== 'function') return; gameRan = true; window.__UB_GAME(); };
  window.__UB_RUN = runGame;
  // outside the sandbox (the engine as a library): UB.ready(() => { game code }) — run once physics is ready (and the role is known)
  UB.ready = function (fn) { if (gameRan) return fn(); window.__UB_GAME = fn; runGame(); };
  if (window.__UB_NET) setTimeout(function () { net.ready = true; runGame(); }, 6000);
  if (physWait) window.RAPIER.init().then(function () { physWait = false; runGame(); }, function (e) { physWait = false; send({ type: 'ub:error', message: 'physics failed to start: ' + (e && e.message) }); });
  net.players = function () { return players.slice(); };
  net.inbox = function () { var m = inbox; inbox = []; return m; };
  // player → host: at most 15 times per second, small JSON
  net.send = function (data) {
    if (net.role !== 'player') return false;
    var now = performance.now(); sentAt = sentAt.filter(function (t) { return now - t < 1000; });
    if (sentAt.length >= 15) return false;
    sentAt.push(now); send({ type: 'ub:net', kind: 'msg', data: data }); return true;
  };
  // host → all phones: the latest state goes out at most 10 times per second (in the game loop)
  net.broadcast = function (state) { if (net.role === 'host') outState = { v: state }; };
  var flushNet = function (now) {
    if (outState && now - lastFlush >= 100) { send({ type: 'ub:net', kind: 'state', state: outState.v }); outState = null; lastFlush = now; }
  };
  UB.net = net;

  // ---- game images (window.__UB_ASSETS: name → data URL, filled in by studioHtml) ----
  var images = {}, pending = 0;
  var ASSETS = window.__UB_ASSETS || {};
  Object.keys(ASSETS).forEach(function (name) {
    var im = new Image(); pending++;
    im.onload = im.onerror = function () { pending--; };
    im.src = ASSETS[name]; images[name] = im;
  });
  UB.hasImage = function (name) { return !!ASSETS[name]; };
  UB.images = Object.keys(ASSETS);
  // your own image by URL (engine as a library; the Studio sandbox has no network — only __UB_ASSETS there). Call before UB.start: the start waits for it
  UB.image = function (name, src) {
    var im = new Image(); pending++; im.onload = im.onerror = function () { pending--; }; im.src = src;
    images[name] = im; ASSETS[name] = src; if (UB.images.indexOf(name) < 0) UB.images.push(name);
  };

  // ---- drawing ----
  var g = {
    ctx: ctx,
    clear: function (c) { ctx.fillStyle = c || '#000'; ctx.fillRect(0, 0, W, H); },
    rect: function (x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); },
    roundRect: function (x, y, w, h, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); },
    strokeRect: function (x, y, w, h, c, lw) { ctx.strokeStyle = c; ctx.lineWidth = lw || 2; ctx.strokeRect(x, y, w, h); },
    circle: function (x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill(); },
    ring: function (x, y, r, c, lw) { ctx.strokeStyle = c; ctx.lineWidth = lw || 2; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.stroke(); },
    line: function (x1, y1, x2, y2, c, lw) { ctx.strokeStyle = c; ctx.lineWidth = lw || 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
    poly: function (pts, c) { ctx.fillStyle = c; ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); },
    text: function (s, x, y, o) {
      o = o || {}; ctx.fillStyle = o.color || '#fff'; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.baseline || 'top';
      ctx.font = (o.bold === false ? '' : '700 ') + (o.size || 24) + 'px ' + (o.font || 'system-ui, sans-serif');
      if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 6; }
      ctx.fillText(String(s), x, y); ctx.shadowBlur = 0;
    },
    // An icon from a character (emoji) — a quick "sprite" without files
    sprite: function (ch, x, y, size, o) {
      o = o || {}; ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.flip) ctx.scale(-1, 1); if (o.alpha != null) ctx.globalAlpha = o.alpha;
      ctx.font = (size || 48) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, 0); ctx.restore();
    },
    // An AI-drawn picture of a hero / item / background (by the object name from the design). Not loaded — a colored tile with a letter.
    image: function (name, x, y, w, h, o) {
      o = o || {}; var im = images[name];
      ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.flip) ctx.scale(-1, 1); if (o.alpha != null) ctx.globalAlpha = o.alpha;
      if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -w / 2, -h / 2, w, h);
      else {
        var hue = 0; for (var i = 0; i < String(name).length; i++) hue = (hue * 31 + String(name).charCodeAt(i)) % 360;
        ctx.fillStyle = 'hsl(' + hue + ',70%,55%)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(Math.min(w, h) * 0.5) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(name).charAt(0).toUpperCase(), 0, 0);
      }
      ctx.restore();
    },
    gradient: function (c1, c2) { var gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, c1); gr.addColorStop(1, c2); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); },
    // An in-game button: draws it and returns true if it was clicked this frame
    button: function (label, x, y, w, h, o) {
      o = o || {}; var r = { x: x, y: y, w: w, h: h }, over = UB.pointIn(pointer, r);
      g.roundRect(x, y, w, h, o.radius == null ? 14 : o.radius, over ? (o.hover || '#ffd166') : (o.color || '#ffffff'));
      g.text(label, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle', size: o.size || 26, color: o.textColor || '#1b1b2f' });
      return pointer.pressed && over;
    },
  };

  // ---- particles and screen shake ----
  var parts = [], shakeT = 0, shakeA = 0;
  UB.burst = function (x, y, o) {
    o = o || {}; var n = o.count || 16;
    for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, s = rand(60, o.speed || 260); parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.9), t: 0, r: rand(2, o.size || 5), world: !!camOn, c: o.color || UB.pick(['#ffd166', '#ef476f', '#06d6a0', '#118ab2']) }); }
  };
  UB.shake = function (amount, time) { shakeA = amount || 8; shakeT = time || 0.25; };

  // ==== v2: ready-made building blocks, so the AI writes game content, not plumbing. Additions only: old games work as before ====
  // Timers and animations live until the scene changes (UB.go resets them) and run on game time — no setTimeout.
  var timers = [], tweens = [], popups = [], camOn = null;
  UB.after = function (sec, fn) { var t = { at: UB.time + (sec || 0), fn: fn }; timers.push(t); return { cancel: function () { t.dead = true; } }; };
  UB.every = function (sec, fn) { var e = Math.max(0.05, sec || 1), t = { at: UB.time + e, fn: fn, every: e }; timers.push(t); return { cancel: function () { t.dead = true; } }; };
  var EASE = {
    linear: function (t) { return t; },
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return t * (2 - t); },
    inOut: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    outBack: function (t) { var c = 1.70158; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; },
    outBounce: function (t) { var n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; } if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; } t -= 2.625 / d; return n * t * t + 0.984375; },
    outElastic: function (t) { return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1; },
  };
  UB.ease = EASE;
  UB.tween = function (obj, to, sec, ease, done) {
    var from = {}; Object.keys(to || {}).forEach(function (k) { from[k] = +obj[k] || 0; });
    var tw = { obj: obj, from: from, to: to, t: 0, d: Math.max(0.01, sec || 0.3), ease: typeof ease === 'function' ? ease : EASE[ease] || EASE.outQuad, done: done };
    tweens.push(tw); return { cancel: function () { tw.dead = true; } };
  };
  UB.wave = function (speed, amount, phase) { return Math.sin(UB.time * (speed || 4) + (phase || 0)) * (amount == null ? 1 : amount); };
  UB.popup = function (text, x, y, o) { o = o || {}; if (popups.length < 60) popups.push({ s: String(text), x: x, y: y, t: 0, life: o.life || 0.9, c: o.color || '#ffd166', size: o.size || 28, world: !!camOn }); };

  // ---- 2D camera: levels bigger than the screen. Draw the world inside g.world(fn), the HUD outside ----
  UB.camera2d = function (o) {
    o = o || {};
    var c = { x: 0, y: 0, zoom: o.zoom || 1, lerp: o.lerp == null ? 8 : o.lerp, bounds: o.bounds || null, target: o.follow || null, offsetY: o.offsetY || 0 };
    var aim = function () {
      var t = c.target, vw = W / c.zoom, vh = H / c.zoom;
      var x = t.x + (t.w || 0) / 2 - vw / 2, y = t.y + (t.h || 0) / 2 - vh / 2 + c.offsetY;
      if (c.bounds) {
        var bx = c.bounds.x || 0, by = c.bounds.y || 0;
        // a level narrower than the screen — centered; shorter than the screen — pinned to the bottom (ground below, sky above)
        x = c.bounds.w < vw ? bx + (c.bounds.w - vw) / 2 : clamp(x, bx, bx + c.bounds.w - vw);
        y = c.bounds.h < vh ? by + c.bounds.h - vh : clamp(y, by, by + c.bounds.h - vh);
      }
      return { x: x, y: y };
    };
    c.follow = function (t) { c.target = t; return c; };
    c.snap = function () { if (c.target) { var a = aim(); c.x = a.x; c.y = a.y; } return c; };
    c.step = function (dt) { if (!c.target) return; var a = aim(), k = c.lerp ? Math.min(1, dt * c.lerp) : 1; c.x += (a.x - c.x) * k; c.y += (a.y - c.y) * k; };
    c.toWorld = function (sx, sy) { return { x: sx / c.zoom + c.x, y: sy / c.zoom + c.y }; };
    c.toScreen = function (wx, wy) { return { x: (wx - c.x) * c.zoom, y: (wy - c.y) * c.zoom }; };
    c.visible = function (r, pad) { pad = pad || 0; return r.x + (r.w || 0) > c.x - pad && r.x < c.x + W / c.zoom + pad && r.y + (r.h || 0) > c.y - pad && r.y < c.y + H / c.zoom + pad; };
    camOn = c; if (c.target) c.snap();
    return c;
  };
  var camApply = function () { ctx.scale(camOn.zoom, camOn.zoom); ctx.translate(-camOn.x, -camOn.y); };

  // ---- a level from strings: '#' — wall/platform, any other character is up to you (coins, enemies, start) ----
  UB.level = function (rows, o) {
    o = o || {}; var size = o.tile || 48, solidCh = o.solid || '#', oneWayCh = o.oneWay || '=';
    var lvl = { tile: size, rows: rows, cols: 0, w: 0, h: rows.length * size, solids: [], cells: [] };
    rows.forEach(function (row, r) {
      lvl.cols = Math.max(lvl.cols, row.length);
      for (var c = 0; c < row.length; c++) {
        var ch = row.charAt(c); if (ch === ' ' || ch === '.') continue;
        var cell = { ch: ch, x: c * size, y: r * size, w: size, h: size, col: c, row: r };
        if (solidCh.indexOf(ch) >= 0) lvl.solids.push(cell);
        else if (oneWayCh.indexOf(ch) >= 0) { cell.oneWay = true; cell.h = Math.max(8, size / 4); lvl.solids.push(cell); }
        else lvl.cells.push(cell);
      }
    });
    lvl.w = lvl.cols * size;
    lvl.find = function (ch) { return lvl.cells.filter(function (c) { return c.ch === ch; }).concat(lvl.solids.filter(function (c) { return c.ch === ch; })); };
    lvl.first = function (ch) { return lvl.find(ch)[0] || null; };
    lvl.solidAt = function (x, y) { var row = rows[Math.floor(y / size)]; var ch = row ? row.charAt(Math.floor(x / size)) : ''; return !!ch && solidCh.indexOf(ch) >= 0; };
    lvl.bounds = { x: 0, y: 0, w: lvl.w, h: lvl.h };
    return lvl;
  };

  // ---- rectangle physics: b = { x, y, w, h, vx, vy } (x, y — top-left corner), solids — an array of rectangles ----
  UB.move = function (b, solids, dt, o) {
    o = o || {}; solids = solids || [];
    var res = { ground: false, ceil: false, left: false, right: false };
    if (o.gravity) b.vy = Math.min((b.vy || 0) + o.gravity * dt, o.maxFall || 1500);
    var i, s, prevBottom = b.y + b.h;
    b.x += (b.vx || 0) * dt;
    for (i = 0; i < solids.length; i++) { s = solids[i]; if (s.oneWay || s.dead || !UB.overlap(b, s)) continue; if ((b.vx || 0) > 0) { b.x = s.x - b.w; res.right = true; } else if ((b.vx || 0) < 0) { b.x = s.x + s.w; res.left = true; } }
    if (res.left || res.right) b.vx = 0;
    b.y += (b.vy || 0) * dt;
    for (i = 0; i < solids.length; i++) {
      s = solids[i]; if (s.dead || !UB.overlap(b, s)) continue;
      if (s.oneWay && !((b.vy || 0) >= 0 && prevBottom <= s.y + 1)) continue;
      if ((b.vy || 0) >= 0) { b.y = s.y - b.h; res.ground = true; b.vy = 0; } else { b.y = s.y + s.h; res.ceil = true; b.vy = 0; }
    }
    b.onGround = res.ground;
    return res;
  };
  // Ready platformer controls: acceleration, coyote time, jump buffer, higher jump while held. input — UB, UB.p1 or UB.p2
  UB.platformer = function (b, solids, dt, o) {
    o = o || {}; var inp = o.input || UB, speed = o.speed || 320, grav = o.gravity || 1800;
    var dir = (inp.key('right') ? 1 : 0) - (inp.key('left') ? 1 : 0);
    b.vx = (b.vx || 0) + (dir * speed - (b.vx || 0)) * Math.min(1, dt * (b.onGround ? 14 : 7));
    if (dir) b.facing = dir;
    b._coy = b.onGround ? 0.1 : (b._coy || 0) - dt;
    b._buf = inp.pressed('jump') || inp.pressed('up') ? 0.12 : (b._buf || 0) - dt;
    if (b._buf > 0 && b._coy > 0) { b.vy = -(o.jump || 720); b._buf = 0; b._coy = 0; UB.sfx('jump'); }
    if (b.vy < 0 && !inp.key('jump') && !inp.key('up')) b.vy += grav * dt;
    return UB.move(b, solids, dt, { gravity: grav });
  };
  // Top-down: 8 directions, walls stop you
  UB.topdown = function (b, solids, dt, o) {
    o = o || {}; var inp = o.input || UB, speed = o.speed || 260;
    var dx = (inp.key('right') ? 1 : 0) - (inp.key('left') ? 1 : 0), dy = (inp.key('down') ? 1 : 0) - (inp.key('up') ? 1 : 0), l = Math.hypot(dx, dy) || 1;
    b.vx = dx / l * speed; b.vy = dy / l * speed; if (dx) b.facing = dx;
    return UB.move(b, solids, dt);
  };

  // ---- enemy behaviour ----
  var center = function (e) { return { x: e.x + (e.w || 0) / 2, y: e.y + (e.h || 0) / 2 }; };
  UB.ai = {
    // walks back and forth between min and max (or to a wall / platform edge, if level is given)
    patrol: function (e, dt, o) {
      o = o || {}; e.dir = e.dir || 1; e.x += e.dir * (o.speed || 90) * dt;
      if (o.level) { var ax = e.dir > 0 ? e.x + e.w + 1 : e.x - 1; if (o.level.solidAt(ax, e.y + e.h / 2) || (o.edges !== false && !o.level.solidAt(ax, e.y + e.h + 2))) e.dir = -e.dir; }
      if (o.min != null && e.x < o.min) { e.x = o.min; e.dir = 1; }
      if (o.max != null && e.x > o.max) { e.x = o.max; e.dir = -1; }
      e.facing = e.dir;
    },
    chase: function (e, target, dt, speed) { var a = center(e), b = center(target), d = Math.hypot(b.x - a.x, b.y - a.y) || 1; e.x += (b.x - a.x) / d * (speed || 90) * dt; e.y += (b.y - a.y) / d * (speed || 90) * dt; },
    flee: function (e, target, dt, speed) { var a = center(e), b = center(target), d = Math.hypot(b.x - a.x, b.y - a.y) || 1; e.x -= (b.x - a.x) / d * (speed || 90) * dt; e.y -= (b.y - a.y) / d * (speed || 90) * dt; },
    orbit: function (e, cx, cy, r, speed, phase) { var a = UB.time * (speed || 1.5) + (phase || 0); e.x = cx + Math.cos(a) * r - (e.w || 0) / 2; e.y = cy + Math.sin(a) * r - (e.h || 0) / 2; },
  };
  // A path over level cells (breadth-first search), point to point; [] — no path. For mazes and smart enemies
  UB.path = function (lvl, from, to) {
    var cs = lvl.tile, cols = lvl.cols, rows = lvl.rows.length, fc = Math.floor(from.x / cs), fr = Math.floor(from.y / cs), tc = Math.floor(to.x / cs), tr = Math.floor(to.y / cs);
    if (tc < 0 || tr < 0 || tc >= cols || tr >= rows) return [];
    var prev = {}, q = [[fc, fr]], key = function (c, r) { return r * cols + c; }, n = 0;
    prev[key(fc, fr)] = -1;
    while (q.length && n++ < 20000) {
      var p = q.shift(); if (p[0] === tc && p[1] === tr) break;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var c = p[0] + d[0], r = p[1] + d[1], k = key(c, r); if (c < 0 || r < 0 || c >= cols || r >= rows || k in prev || lvl.solidAt(c * cs + 1, r * cs + 1)) return; prev[k] = key(p[0], p[1]); q.push([c, r]); });
    }
    var k = key(tc, tr); if (!(k in prev)) return [];
    var out = []; while (k !== -1 && out.length < 5000) { out.unshift({ x: (k % cols) * cs + cs / 2, y: Math.floor(k / cols) * cs + cs / 2 }); k = prev[k]; }
    return out;
  };

  // ---- HUD: equally neat in every game ----
  var heart = function (x, y, s, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y + s * 0.3); ctx.bezierCurveTo(x, y, x - s / 2, y, x - s / 2, y + s * 0.3); ctx.bezierCurveTo(x - s / 2, y + s * 0.6, x, y + s * 0.8, x, y + s); ctx.bezierCurveTo(x, y + s * 0.8, x + s / 2, y + s * 0.6, x + s / 2, y + s * 0.3); ctx.bezierCurveTo(x + s / 2, y, x, y, x, y + s * 0.3); ctx.fill(); };
  UB.hud = {
    panel: function (x, y, w, h, o) { o = o || {}; g.roundRect(x, y, w, h, o.radius == null ? 14 : o.radius, o.color || 'rgba(10,12,30,.6)'); },
    hearts: function (x, y, n, max, o) { o = o || {}; var s = o.size || 26; for (var i = 0; i < (max || n); i++) heart(x + s / 2 + i * (s + 6), y, s, i < n ? o.color || '#ff4d6d' : 'rgba(255,255,255,.22)'); },
    bar: function (x, y, w, h, v, o) {
      o = o || {}; v = clamp(v || 0, 0, 1);
      g.roundRect(x, y, w, h, h / 2, o.back || 'rgba(255,255,255,.18)');
      if (v > 0) g.roundRect(x, y, Math.max(h, w * v), h, h / 2, o.color || (v < 0.25 ? '#ef476f' : '#06d6a0'));
      if (o.label) g.text(o.label, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle', size: Math.max(12, h * 0.6), color: o.textColor || '#fff' });
    },
    score: function (n, o) { o = o || {}; var s = String(o.label == null ? '' : o.label + ' ') + n; ctx.font = '700 26px system-ui, sans-serif'; var w = ctx.measureText(s).width + 32; UB.hud.panel(o.x == null ? 16 : o.x, o.y == null ? 14 : o.y, w, 44, { radius: 22 }); g.text(s, (o.x == null ? 16 : o.x) + 16, (o.y == null ? 14 : o.y) + 22, { baseline: 'middle', size: 26, color: o.color || '#ffd166' }); },
    timer: function (sec, x, y, o) { o = o || {}; sec = Math.max(0, Math.ceil(sec)); g.text(Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2), x, y, { align: o.align || 'center', size: o.size || 30, color: sec <= (o.warn == null ? 10 : o.warn) ? '#ef476f' : o.color || '#fff', shadow: true }); },
    banner: function (text, o) { o = o || {}; var h = o.size ? o.size * 2.4 : 96, y = (o.y == null ? H / 2 : o.y) - h / 2; g.rect(0, y, W, h, o.back || 'rgba(0,0,0,.55)'); g.text(text, W / 2, y + h / 2, { align: 'center', baseline: 'middle', size: o.size || 44, color: o.color || '#fff', shadow: true }); },
  };
  // Word-wrapped text within width maxW; returns the height
  g.textBox = function (s, x, y, maxW, o) {
    o = o || {}; var size = o.size || 24, lh = size * (o.lineHeight || 1.25);
    ctx.font = (o.bold === false ? '' : '700 ') + size + 'px ' + (o.font || 'system-ui, sans-serif');
    var words = String(s).split(/\s+/), lines = [], line = '';
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    lines.forEach(function (l, i) { g.text(l, x, y + i * lh, { size: size, color: o.color, align: o.align || 'left', bold: o.bold, shadow: o.shadow }); });
    return lines.length * lh;
  };
  // A neatly drawn window over a dimmed backdrop — for pauses, hints, dialogs
  g.dialog = function (title, body, o) {
    o = o || {}; var w = Math.min(W - 60, o.w || 640), x = (W - w) / 2, h = o.h || 220, y = (H - h) / 2;
    g.rect(0, 0, W, H, 'rgba(0,0,0,.45)'); g.roundRect(x, y, w, h, 22, o.color || '#1d2140'); g.strokeRect(x + 2, y + 2, w - 4, h - 4, 'rgba(255,255,255,.12)', 2);
    g.text(title, W / 2, y + 26, { align: 'center', size: 32, color: o.titleColor || '#ffd166' });
    if (body) g.textBox(body, x + 30, y + 80, w - 60, { size: 22, color: '#e8eaff', align: 'left' });
    return { x: x, y: y, w: w, h: h };
  };

  // ---- learning question: a ready window with answers, timer, highlighting and sound. Call q.draw(g) every frame while q.open ----
  UB.quiz = function (o) {
    var Q = { q: o.q, options: o.options || [], correct: o.correct, time: o.time || 0, t0: UB.time, picked: -1, at: 0, open: true, ok: false };
    var choose = function (i) { if (Q.picked >= 0) return; Q.picked = i; Q.ok = i === Q.correct; Q.at = UB.time; UB.sfx(Q.ok ? 'correct' : 'wrong'); if (Q.ok) UB.burst(W / 2, H / 2 - 60, { count: 24 }); else UB.shake(6, 0.2); };
    Q.draw = function (gg) {
      if (!Q.open) return;
      var n = Q.options.length, left = Q.time ? Q.time - (UB.time - Q.t0) : 1;
      if (Q.picked < 0) { if (Q.time && left <= 0) choose(-1); for (var k = 0; k < n && k < 9; k++) if (UB.pressed('Digit' + (k + 1))) choose(k); }
      if (o.dim !== false) g.rect(0, 0, W, H, 'rgba(5,8,25,.62)');
      var pw = Math.min(W - 40, 820), px = (W - pw) / 2, py = Math.max(16, H / 2 - 230);
      g.roundRect(px, py, pw, 150, 22, '#1d2140');
      var th = g.textBox(Q.q, px + 28, py + 24, pw - 56, { size: o.size || (String(Q.q).length > 60 ? 26 : 32), color: '#fff' });
      if (Q.time) UB.hud.bar(px + 28, py + Math.max(110, Math.min(130, th + 34)), pw - 56, 10, left / Q.time);
      var cols = W < 700 || n > 4 ? 1 : 2, bw = cols === 2 ? (pw - 16) / 2 : pw, bh = n > 4 ? 52 : 70, by = py + 170;
      for (var i = 0; i < n; i++) {
        var c = i % cols, r = Math.floor(i / cols), x = px + c * (bw + 16), y = by + r * (bh + 12);
        var col = Q.picked < 0 ? '#ffffff' : i === Q.correct ? '#06d6a0' : i === Q.picked ? '#ef476f' : 'rgba(255,255,255,.45)';
        if (g.button((n <= 9 && !UB.isTouch ? (i + 1) + '. ' : '') + Q.options[i], x, y, bw, bh, { color: col, hover: Q.picked < 0 ? '#ffd166' : col, size: String(Q.options[i]).length > 28 ? 20 : 26 }) && Q.picked < 0) choose(i);
      }
      if (Q.picked >= 0 || (Q.time && left <= 0)) {
        if (Q.picked === -1 && Q.at === 0) Q.at = UB.time;
        if (UB.time - Q.at > (o.feedback == null ? 0.8 : o.feedback)) { Q.open = false; if (o.onAnswer) o.onAnswer(Q.ok, Q.picked); }
      }
    };
    return Q;
  };

  // ---- music: a procedural loop without files (WebAudio). UB.music('happy'|'calm'|'tense'|'space'|'boss'|'retro'), UB.music(null) — silence ----
  var MUSIC = {
    happy: { bpm: 124, root: 60, scale: [0, 2, 4, 7, 9], chords: [0, 5, 7, 5], lead: 'square', seed: 3 },
    calm: { bpm: 92, root: 62, scale: [0, 2, 4, 7, 9], chords: [0, 9, 5, 7], lead: 'triangle', seed: 7 },
    tense: { bpm: 140, root: 57, scale: [0, 3, 5, 7, 10], chords: [0, 0, 8, 7], lead: 'sawtooth', seed: 11 },
    space: { bpm: 100, root: 55, scale: [0, 2, 5, 7, 10], chords: [0, 10, 8, 7], lead: 'sine', seed: 5 },
    boss: { bpm: 156, root: 52, scale: [0, 1, 5, 7, 8], chords: [0, 1, 0, 8], lead: 'sawtooth', seed: 13 },
    retro: { bpm: 132, root: 64, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 7, 9, 5], lead: 'square', seed: 17 },
  };
  var mus = null, musNext = 0, musStep = 0, musPat = [];
  var freq = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  UB.music = function (name) {
    mus = MUSIC[name] || null; musStep = 0; musNext = 0; if (!mus) return;
    var s = mus.seed; musPat = [];
    for (var i = 0; i < 32; i++) { s = (s * 16807) % 2147483647; musPat.push(s % 10 < 6 ? s % mus.scale.length : -1); }
  };
  var stepMusic = function () {
    if (!mus || !ac) return;
    var eighth = 60 / mus.bpm / 2;
    if (musNext < ac.currentTime) musNext = ac.currentTime + 0.05;
    while (musNext < ac.currentTime + 0.25) {
      var st = musStep % 32, ch = mus.chords[Math.floor(musStep / 8) % 4], d = musNext - ac.currentTime;
      if (st % 4 === 0) tone(freq(mus.root - 24 + ch), freq(mus.root - 24 + ch), eighth * 3.6, 'triangle', 0.05, d);
      if (st % 8 === 4) tone(freq(mus.root - 12 + ch + 7), freq(mus.root - 12 + ch + 7), eighth * 1.5, 'triangle', 0.025, d);
      if (musPat[st] >= 0) tone(freq(mus.root + ch % 12 + mus.scale[musPat[st]]), freq(mus.root + ch % 12 + mus.scale[musPat[st]]), eighth * 0.9, mus.lead, mus.lead === 'sine' ? 0.035 : 0.018, d);
      if (st % 2 === 1) tone(6000, 5000, 0.03, 'square', 0.006, d);
      musNext += eighth; musStep++;
    }
  };

  // one v2 step per frame (after the scene update)
  var stepV2 = function (dt) {
    var list = timers;
    for (var i = 0; i < list.length && timers === list; i++) { var t = list[i]; if (t.dead || UB.time < t.at) continue; if (t.every) t.at += t.every; else t.dead = true; t.fn(); }
    timers = timers.filter(function (x) { return !x.dead; });
    var tl = tweens;
    for (var j = 0; j < tl.length && tweens === tl; j++) {
      var w = tl[j]; if (w.dead) continue; w.t += dt; var k = Math.min(1, w.t / w.d), e = w.ease(k);
      for (var p in w.to) w.obj[p] = w.from[p] + (w.to[p] - w.from[p]) * e;
      if (k >= 1) { w.dead = true; if (w.done) w.done(); }
    }
    tweens = tweens.filter(function (x) { return !x.dead; });
    for (var m = popups.length - 1; m >= 0; m--) { popups[m].t += dt; if (popups[m].t > popups[m].life) popups.splice(m, 1); }
    if (camOn) camOn.step(dt);
    stepMusic();
  };
  g.world = function (fn) { ctx.save(); if (camOn) camApply(); try { fn(); } finally { ctx.restore(); } };
  var drawPopups = function (world) {
    popups.forEach(function (p) { if (p.world !== world) return; var k = p.t / p.life; ctx.globalAlpha = Math.max(0, 1 - k * k); g.text(p.s, p.x, p.y - 50 * EASE.outQuad(k), { align: 'center', baseline: 'middle', size: p.size * (k < 0.15 ? 0.6 + k * 2.7 : 1), color: p.c, shadow: true }); });
    ctx.globalAlpha = 1;
  };

  // ---- scenes and the loop ----
  var scenes = {}, cur = null, curName = '', state = {};
  UB.width = W; UB.height = H; UB.time = 0;
  var created = false;
  UB.create = function (o) {
    o = o || {}; created = true; W = o.width || 960; H = o.height || 540; UB.width = W; UB.height = H; UB.bg = o.background || '#10142a';
    send({ type: 'ub:screen', w: W, h: H });   // the team-game preview turns the "phone" to match the game's screen orientation
    document.body.style.background = o.letterbox || '#05060c'; fit(); return UB;
  };
  UB.scene = function (name, def) { scenes[name] = def; return UB; };
  UB.go = function (name, data) {
    if (!scenes[name]) throw new Error('scene "' + name + '" not found');
    cur = scenes[name]; curName = name; state = {}; parts = []; timers = []; tweens = []; popups = []; camOn = null;
    if (cur.enter) cur.enter(state, data || {});
  };
  UB.state = function () { return state; };
  UB.scene_ = function () { return curName; };
  var lastScore = null;
  UB.score = function (n) { if (n !== lastScore) { lastScore = n; send({ type: 'ub:score', score: n }); } };
  UB.finish = function (o) { send({ type: 'ub:finish', score: o && o.score != null ? o.score : lastScore, won: !!(o && o.won) }); };
  UB.start = function (name, data) {
    // the game never called UB.create (kit games don't) — default screen, otherwise the canvas is not fitted to the window
    if (!created) UB.create({});
    // wait for images (at most 4 seconds), then start
    if (pending > 0 || !net.ready) {
      var t0 = performance.now();
      var wait = function () { if ((pending > 0 || !net.ready) && performance.now() - t0 < 6000) { ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, H); requestAnimationFrame(wait); } else UB.start_(name, data); };
      requestAnimationFrame(wait); return;
    }
    UB.start_(name, data);
  };
  UB.start_ = function (name, data) {
    UB.go(name, data); send({ type: 'ub:ready' });
    var last = performance.now();
    // hidden tab: requestAnimationFrame stops. The team game's shared screen is woken by the room page (a 50 ms tick from a Web Worker,
    // which the browser barely throttles) — run the game in 0.05 s steps without drawing; back on the tab — the normal loop
    var rafOn = false;
    var schedule = function () { if (!rafOn) { rafOn = true; requestAnimationFrame(function (t) { rafOn = false; frame(t); }); } };
    var frame = function (now) {
      var hidden = !!document.hidden, total = Math.min(hidden ? 1 : 0.05, Math.max(0, (now - last) / 1000)); last = now;
      var steps = Math.max(1, Math.ceil(total / 0.05 - 1e-6)), dt = total / steps;
      for (var st = 0; st < steps; st++) {
        UB.time += dt;
        if (UB.is3d && UB.physics3d) UB.physics3d(dt);
        if (cur && cur.update) cur.update(state, dt);
        stepV2(dt);
      }
      flushNet(now);
      for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.t += total; p.x += p.vx * total; p.y += p.vy * total; p.vy += 300 * total; if (p.t > p.life) parts.splice(i, 1); }
      if (!hidden) {
        if (UB.is3d && UB.render3d) UB.render3d(total);
        ctx.save();
        if (shakeT > 0) { shakeT -= total; ctx.translate(rand(-shakeA, shakeA), rand(-shakeA, shakeA)); }
        if (UB.is3d) ctx.clearRect(-50, -50, W + 100, H + 100); else g.clear(UB.bg);   // 3D: WebGL draws the world under the transparent 2D layer
        if (cur && cur.draw) cur.draw(g, state);
        // particles and popups created while a 2D camera exists are in world coordinates
        var drawParts = function (world) { parts.forEach(function (p) { if (!!p.world !== world) return; ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); g.circle(p.x, p.y, p.r, p.c); }); ctx.globalAlpha = 1; };
        if (camOn) { ctx.save(); camApply(); drawParts(true); drawPopups(true); ctx.restore(); }
        drawParts(false); drawPopups(false);
        ctx.restore();
      }
      pressedNow = {}; pointer.pressed = false; pointer.released = false;
      if (!hidden) schedule();
    };
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { last = performance.now(); schedule(); } });
    bgTick = function () { if (document.hidden && net.role === 'host') frame(performance.now()); };
    schedule();
  };

  // ==== 3D (if THREE is loaded): the world on WebGL under the 2D layer; scenes, input, sound and the 2D HUD are shared ====
  (function () {
    var T = window.THREE;
    var skyDome = null, sun = null, quality = null;
    var ents = [], scene = null, camera = null, renderer = null, gl = null, ground = null, cam = { mode: 'fixed', x: 0, y: 12, z: 18, look: { x: 0, y: 0, z: 0 } };
    var players = [], joy = { x: 0, y: 0 }, joyJump = false, padMade = false, fx = [];
    UB.is3d = false;
    UB.entities = function () { return ents.slice(); };
    var no3d = function () { throw new Error('3D is not available'); };
    if (!T) { UB.create3d = no3d; UB.spawn = no3d; UB.body = no3d; UB.physics = no3d; return; }
    var color = function (c) { return new T.Color(c || '#cccccc'); };
    UB.create3d = function (o) {
      o = o || {};
      UB.create({ width: o.width || 960, height: o.height || 540, background: o.sky || '#8fd3ff', letterbox: '#05060c' });
      UB.is3d = true;
      // a repeated call (arena: shared screen and own player in one tab) reuses the same renderer (WebGL context)
      // with a new scene: a second context in the tab would cost memory and a second to create
      if (scene) { UB.clear3d(); if (ground) { ground.remove(); ground = null; } batches = {}; }
      if (!renderer) {
        gl = document.createElement('canvas'); gl.style.position = 'absolute'; gl.style.display = 'block';
        document.body.insertBefore(gl, canvas); canvas.style.background = 'transparent';
        renderer = new T.WebGLRenderer({ canvas: gl, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      scene = new T.Scene(); scene.background = color(o.sky || '#8fd3ff');
      // gradient sky: lighter at the horizon, deeper above; fog has the horizon color, so the world's edges fade into the sky
      var skyC = color(o.sky || '#8fd3ff'), horizon = skyC.clone().lerp(new T.Color(0xffffff), 0.35), zenith = skyC.clone().multiplyScalar(0.78);
      if (o.skyGradient !== false) {
        skyDome = new T.Mesh(new T.SphereGeometry(450, 24, 12), new T.ShaderMaterial({
          side: T.BackSide, depthWrite: false, fog: false,
          uniforms: { top: { value: zenith }, mid: { value: skyC }, bot: { value: horizon } },
          vertexShader: 'varying float h; void main() { h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying float h; void main() { float t = clamp(h, 0.0, 1.0); vec3 c = t < 0.25 ? mix(bot, mid, t / 0.25) : mix(mid, top, (t - 0.25) / 0.75); gl_FragColor = vec4(h < 0.0 ? bot : c, 1.0); }',
        }));
        skyDome.renderOrder = -1; skyDome.frustumCulled = false; scene.add(skyDome);
      }
      if (o.fog !== false) scene.fog = new T.Fog(o.skyGradient !== false ? horizon : skyC, o.fogNear || 40, o.fogFar || 140);
      camera = new T.PerspectiveCamera(o.fov || 60, W / H, 0.1, 600);
      // nothing is visible beyond the fog anyway (fog color) — don't draw past it at all; the sky dome sits just inside the far plane
      if (o.fog !== false) { camera.far = Math.max(60, (o.fogFar || 140) * 1.15); camera.updateProjectionMatrix(); if (skyDome) skyDome.scale.setScalar(camera.far * 0.9 / 450); }
      scene.add(new T.HemisphereLight(0xffffff, 0x445566, 1.1));
      sun = new T.DirectionalLight(0xffffff, 1.2); sun.position.set(30, 60, 20); scene.add(sun); scene.add(sun.target);
      // soft sun shadows: a 70 m shadow box follows the camera (see render3d); quality 'auto' — a slow device turns them off
      quality = { mode: o.quality || 'auto', shadows: o.shadows !== false && o.quality !== 'low', ratio: Math.min(window.devicePixelRatio || 1, o.quality === 'low' ? 1 : 1.5), frames: 0, slow: 0, t: 0 };
      renderer.setPixelRatio(quality.ratio);
      renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = T.PCFShadowMap;
      sun.castShadow = quality.shadows; var sm = touch ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm);
      var shc = sun.shadow.camera; shc.left = -35; shc.right = 35; shc.top = 35; shc.bottom = -35; shc.near = 1; shc.far = 160;
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
      UB.quality3d = { shadows: quality.shadows, pixelRatio: quality.ratio };
      if (o.ground !== false) { var gs = o.groundSize || 240; ground = UB.spawn({ shape: 'box', x: 0, y: -0.5, z: 0, w: gs, h: 1, d: gs, color: o.groundColor || '#7ccf6b', solid: true }); ground.ground = true; }
      UB.onFit = function (sc, ox, oy) {
        gl.style.width = W * sc + 'px'; gl.style.height = H * sc + 'px'; gl.style.left = ox + 'px'; gl.style.top = oy + 'px';
        renderer.setSize(Math.round(W * sc), Math.round(H * sc), false); camera.aspect = W / H; camera.updateProjectionMatrix();
      };
      fit();
      return UB;
    };
    // A world object. Its hitbox is a box centered at (x, y, z) with size w×h×d (spheres and cylinders: 2r).
    UB.spawn = function (o) {
      if (!scene) throw new Error('call UB.create3d first');
      if (ents.length >= 400) throw new Error('too many 3D objects (max 400)');
      o = o || {};
      var shape = o.shape || 'box', r = o.r || 0.5, w = o.w || (shape === 'box' ? 1 : r * 2), h = o.h || (shape === 'box' || shape === 'image' ? 1 : shape === 'sphere' ? r * 2 : o.h || 1), d = o.d || (shape === 'box' ? 1 : r * 2);
      var mesh, mat;
      if (shape === 'label') {
        // a label in the world (always faces the camera): answers on gates, names, hints
        var lc = document.createElement('canvas'), lctx = lc.getContext('2d');
        mat = new T.SpriteMaterial({ transparent: true, depthWrite: false });
        mesh = new T.Sprite(mat);
        var paint = function (txt) {
          var fs = 64, pad = 22; lctx.font = '700 ' + fs + 'px system-ui, sans-serif';
          var tw = Math.max(fs, Math.ceil(lctx.measureText(String(txt)).width) || fs);
          lc.width = tw + pad * 2; lc.height = fs + pad * 2;
          lctx.font = '700 ' + fs + 'px system-ui, sans-serif'; lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
          if (o.bg !== null) { lctx.fillStyle = o.bg || 'rgba(15,18,40,.78)'; lctx.beginPath(); if (lctx.roundRect) lctx.roundRect(0, 0, lc.width, lc.height, 28); else lctx.rect(0, 0, lc.width, lc.height); lctx.fill(); }
          lctx.fillStyle = o.color || '#ffffff'; lctx.fillText(String(txt), lc.width / 2, lc.height / 2 + 2);
          if (mat.map) mat.map.dispose(); mat.map = new T.CanvasTexture(lc); mat.needsUpdate = true;
          h = o.h || 0.9; w = h * (lc.width / lc.height || 1); mesh.scale.set(w, h, 1);
        };
        paint(o.text == null ? '' : o.text);
      } else if (shape === 'character') {
        mesh = character(o); var cs = o.scale || 1; w = 0.9 * cs; h = 2 * cs; d = 0.9 * cs;
        mat = { dispose: function () {}, color: null };
      } else if (shape === 'model') {
        mesh = new T.Group(); mat = { dispose: function () {}, color: null };   // the model itself arrives once it loads (UB.model3d)
      } else if (shape === 'prefab') {
        mesh = prefab(o.prefab || o.name || 'rock', o);
        var bb = PREFAB_BOX[o.prefab || o.name] || [1, 1, 1], sc = o.scale || 1;
        w = o.w || bb[0] * sc; h = o.h || bb[1] * sc; d = o.d || bb[2] * sc;
        mat = { dispose: function () {}, color: null };
      } else if (shape === 'image') {
        var img = images[o.image], tex = new T.Texture();
        if (img) { tex.image = img; var up = function () { tex.needsUpdate = true; }; if (img.complete) up(); else img.addEventListener('load', up); }
        mat = new T.SpriteMaterial({ map: img ? tex : null, color: img ? 0xffffff : color(o.color || '#ff8fb1'), transparent: true });
        mesh = new T.Sprite(mat); mesh.scale.set(w, h, 1);
      } else {
        var geo = shape === 'sphere' ? new T.SphereGeometry(r, 20, 14) : shape === 'cylinder' ? new T.CylinderGeometry(r, r, h, 20) : shape === 'cone' ? new T.ConeGeometry(r, h, 20) : new T.BoxGeometry(w, h, d);
        var bdef = o.block != null && shape === 'box' ? BLOCK_BY[String(o.block)] : null;
        if (bdef && bdef.id && bdef.boxes) {
          // a slab or stairs block as a box: real parts (a stair = a lower half and a back upper half), the hero steps up them;
          // collisions go by parts (e.parts, see collide)
          var pm = [], pg = new T.Group(); geo.dispose();
          bdef.boxes.forEach(function (bx) {
            var pw2 = (bx[3] - bx[0]) * w, ph2 = (bx[4] - bx[1]) * h, pd2 = (bx[5] - bx[2]) * d, mm = getAtlas() ? blockBoxMats(bdef, pw2, ph2, pd2) : [new T.MeshLambertMaterial({ color: color(bdef.side) })];
            var part = new T.Mesh(new T.BoxGeometry(pw2, ph2, pd2), mm); part.position.set(((bx[0] + bx[3]) / 2 - 0.5) * w, ((bx[1] + bx[4]) / 2 - 0.5) * h, ((bx[2] + bx[5]) / 2 - 0.5) * d);
            pg.add(part); pm = pm.concat(mm);
          });
          mesh = pg; o.__parts = bdef.boxes;
          mat = { color: null, map: null, dispose: function () { pm.forEach(function (m) { m.dispose(); }); pg.children.forEach(function (c) { c.geometry.dispose(); }); } };
        } else if (bdef && bdef.id && getAtlas()) {   // a box made of a world block: the tile texture repeats along its size
          var bm = blockBoxMats(bdef, w, h, d); mesh = new T.Mesh(geo, bm);
          mat = { color: null, map: null, dispose: function () { bm.forEach(function (m) { m.dispose(); }); } };
        } else {
        mat = new T.MeshLambertMaterial({ color: color(o.color), transparent: o.opacity != null, opacity: o.opacity == null ? 1 : o.opacity, emissive: o.glow ? color(o.glow) : 0x000000 });
        mesh = new T.Mesh(geo, mat);
        }
      }
      var hp = shape === 'prefab' && !o.glow && HALO[o.prefab || o.name];
      if (o.halo !== false && shape !== 'label' && shape !== 'image') {
        if (hp) addHalo(mesh, o.color || hp[0], hp[1]).position.y = hp[2];
        else if (o.glow) addHalo(mesh, o.glow, Math.min(4, Math.max(w, h, d) / (shape === 'prefab' ? (o.scale || 1) : 1) * 1.8));
      }
      if (shape !== 'label' && shape !== 'image') mesh.traverse(function (m) { if (m.isMesh) { m.castShadow = o.shadow !== false && !(o.opacity != null && o.opacity < 0.6); m.receiveShadow = true; } });
      scene.add(mesh);
      var e = { x: o.x || 0, y: o.y == null ? h / 2 : o.y, z: o.z || 0, w: w, h: h, d: d, rotY: o.rotY || 0, vx: 0, vy: 0, vz: 0, solid: !!o.solid, visible: true, data: o.data || {}, mesh: mesh, shape: shape,
        setColor: function (c) { if (e._sleep) wakeE(e); e._pk = null; if (mat.color) mat.color.set(c); else if (shape === 'prefab' || shape === 'character') mesh.traverse(function (m) { if (m.material && m.userData.tint) m.material.color.set(c); }); },
        setText: function (t) { if (shape === 'label') { paint(t); e.w = w; e.h = h; } },
        remove: function () {
          if (e._phys) unphys(e);
          if (e._sleep) wakeE(e);
          for (var pi = players.length - 1; pi >= 0; pi--) if (players[pi].e === e) { unplayer(players[pi]); players.splice(pi, 1); }
          var ai = animated.indexOf(e); if (ai >= 0) animated.splice(ai, 1); if (e._mixer) e._mixer.stopAllAction();
          scene.remove(mesh);
          if (shape === 'model') { /* geometry is shared by all copies of the model — don't dispose */ }
          else if (shape === 'character') mesh.traverse(function (m) { if (m.material && m.material.userData.own) m.material.dispose(); });
          else if (shape === 'prefab') mesh.traverse(function (m) { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); });
          else { if (mesh.geometry) mesh.geometry.dispose(); if (mat.map) mat.map.dispose(); mat.dispose(); if (!e.parts) mesh.children.forEach(function (c) { [].concat(c.material || []).forEach(function (m) { if (m && m.dispose) m.dispose(); }); }); }
          var i = ents.indexOf(e); if (i >= 0) ents.splice(i, 1);
        } };
      if (shape === 'prefab') e._kind = o.prefab || o.name || 'rock';
      if (o.__parts) e.parts = o.__parts;
      ents.push(e); return e;
    };
    // Ready-made models from simple shapes: the group's center is the hitbox center (like other objects)
    var PREFAB_BOX = { tree: [1.6, 3.4, 1.6], pine: [1.6, 4, 1.6], bush: [1.4, 0.9, 1.4], rock: [1.4, 0.9, 1.2], coin: [0.8, 0.8, 0.2], crystal: [0.7, 1.2, 0.7], star: [1, 1, 0.3],
      flag: [0.8, 3, 0.2], house: [4, 4, 4], lamp: [0.4, 3.2, 0.4], gate: [4, 4, 0.6], chest: [1.1, 0.9, 0.8], cloud: [3, 1.2, 1.6], fence: [2, 1, 0.15], car: [1.8, 1.4, 3.4], heart: [0.8, 0.8, 0.3], key: [0.4, 0.9, 0.15], portal: [2.4, 3, 0.4], tower: [2.4, 6, 2.4] };
    var prefab = function (kind, o) {
      var grp = new T.Group(), bb = PREFAB_BOX[kind] || [1, 1, 1], sc = o.scale || 1, base = -bb[1] / 2, tint = o.color;
      var lam = function (c, glow) { return new T.MeshLambertMaterial({ color: color(c), emissive: glow ? color(glow) : 0x000000 }); };
      var add = function (geo, c, x, y, z, glow, isTint) { var m = new T.Mesh(geo, lam(isTint && tint ? tint : c, glow)); m.position.set(x, base + y, z); if (isTint) m.userData.tint = true; grp.add(m); return m; };
      var B = function (w, h, d) { return new T.BoxGeometry(w, h, d); }, C = function (r1, r2, h, n) { return new T.CylinderGeometry(r1, r2, h, n || 12); }, S = function (r) { return new T.SphereGeometry(r, 16, 12); };
      if (kind === 'tree') { add(C(0.18, 0.25, 1.4), '#8a5a2b', 0, 0.7, 0); add(S(0.95), '#3fb950', 0, 2.2, 0, null, true); add(S(0.6), '#56d364', 0.35, 2.8, 0.2, null, true); }
      else if (kind === 'pine') { add(C(0.15, 0.2, 1), '#7a4a22', 0, 0.5, 0); add(new T.ConeGeometry(0.8, 1.6, 10), '#2ea043', 0, 1.6, 0, null, true); add(new T.ConeGeometry(0.6, 1.3, 10), '#3fb950', 0, 2.6, 0, null, true); add(new T.ConeGeometry(0.4, 1, 10), '#56d364', 0, 3.4, 0, null, true); }
      else if (kind === 'bush') { add(S(0.55), '#3fb950', 0, 0.45, 0, null, true); add(S(0.4), '#56d364', 0.4, 0.4, 0.1, null, true); add(S(0.4), '#2ea043', -0.4, 0.38, -0.1, null, true); }
      else if (kind === 'rock') { var r = add(new T.DodecahedronGeometry(0.65), '#8b949e', 0, 0.45, 0, null, true); r.scale.set(1.1, 0.7, 0.95); }
      else if (kind === 'coin') { var cn = add(C(0.4, 0.4, 0.12, 20), '#ffd166', 0, 0.4, 0, '#7a5a00', true); cn.rotation.x = Math.PI / 2; }
      else if (kind === 'crystal') { var cr = add(new T.OctahedronGeometry(0.45), '#7df9ff', 0, 0.6, 0, '#1b8a9a', true); cr.scale.set(0.8, 1.35, 0.8); }
      else if (kind === 'star') { var sh = new T.Shape(); for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 0.22 : 0.5; if (i) sh.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr); else sh.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr); } add(new T.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }), '#ffd166', 0, 0.5, -0.09, '#7a5a00', true); }
      else if (kind === 'heart') { add(S(0.22), '#ff4d6d', -0.15, 0.55, 0, '#5a0018', true); add(S(0.22), '#ff4d6d', 0.15, 0.55, 0, '#5a0018', true); var hc = add(new T.ConeGeometry(0.33, 0.45, 16), '#ff4d6d', 0, 0.3, 0, '#5a0018', true); hc.rotation.z = Math.PI; }
      else if (kind === 'key') { add(new T.TorusGeometry(0.15, 0.05, 8, 16), '#ffd166', 0, 0.72, 0, '#7a5a00', true); add(B(0.08, 0.5, 0.08), '#ffd166', 0, 0.35, 0, '#7a5a00', true); add(B(0.16, 0.06, 0.08), '#ffd166', 0.08, 0.15, 0, '#7a5a00', true); }
      else if (kind === 'flag') { add(C(0.05, 0.05, 3), '#e6edf3', 0, 1.5, 0); add(B(0.8, 0.5, 0.04), '#ef476f', 0.42, 2.7, 0, null, true); }
      else if (kind === 'house') { add(B(3.6, 2.6, 3.6), '#f2cc8f', 0, 1.3, 0, null, true); var rf = add(new T.ConeGeometry(2.9, 1.4, 4), '#e07a5f', 0, 3.3, 0); rf.rotation.y = Math.PI / 4; add(B(0.8, 1.3, 0.1), '#6d4c41', 0, 0.65, 1.81); add(B(0.7, 0.6, 0.1), '#9ad1ff', -1, 1.6, 1.81); add(B(0.7, 0.6, 0.1), '#9ad1ff', 1, 1.6, 1.81); }
      else if (kind === 'tower') { add(C(1.1, 1.2, 5, 10), '#c9b79c', 0, 2.5, 0, null, true); add(new T.ConeGeometry(1.4, 1.4, 10), '#7b2cbf', 0, 5.4, 0); }
      else if (kind === 'lamp') { add(C(0.07, 0.1, 3), '#30363d', 0, 1.5, 0); add(S(0.22), '#fff3b0', 0, 3.05, 0, '#ffd166'); }
      else if (kind === 'gate') { add(B(0.5, 4, 0.5), '#c9b79c', -1.75, 2, 0, null, true); add(B(0.5, 4, 0.5), '#c9b79c', 1.75, 2, 0, null, true); add(B(4, 0.6, 0.6), '#e07a5f', 0, 3.8, 0); }
      else if (kind === 'portal') { var pt = add(new T.TorusGeometry(1.1, 0.18, 10, 28), '#b388ff', 0, 1.5, 0, '#5b2bbf', true); pt.scale.y = 1.3; var pm = add(new T.CircleGeometry(1, 24), '#7c4dff', 0, 1.5, 0, '#3d1d99'); pm.scale.y = 1.3; pm.material.transparent = true; pm.material.opacity = 0.55; pm.material.side = T.DoubleSide; }
      else if (kind === 'chest') { add(B(1.1, 0.6, 0.8), '#a0522d', 0, 0.3, 0, null, true); add(B(1.12, 0.3, 0.82), '#8b4513', 0, 0.75, 0); add(B(0.18, 0.22, 0.05), '#ffd166', 0, 0.55, 0.42, '#7a5a00'); }
      else if (kind === 'cloud') { add(S(0.6), '#ffffff', 0, 0.6, 0, null, true); add(S(0.45), '#ffffff', 0.7, 0.5, 0, null, true); add(S(0.45), '#ffffff', -0.7, 0.5, 0.1, null, true); add(S(0.4), '#ffffff', 0.2, 0.95, 0.2, null, true); }
      else if (kind === 'fence') { add(B(2, 0.12, 0.08), '#c4a484', 0, 0.75, 0, null, true); add(B(2, 0.12, 0.08), '#c4a484', 0, 0.4, 0, null, true); [-0.9, 0, 0.9].forEach(function (x) { add(B(0.12, 1, 0.12), '#a0826d', x, 0.5, 0); }); }
      else if (kind === 'car') { add(B(1.8, 0.7, 3.4), '#ef476f', 0, 0.55, 0, null, true); add(B(1.5, 0.6, 1.8), '#9ad1ff', 0, 1.15, -0.2); [[-0.85, -1.1], [0.85, -1.1], [-0.85, 1.1], [0.85, 1.1]].forEach(function (p) { var wh = add(C(0.32, 0.32, 0.25, 14), '#222222', p[0], 0.32, p[1]); wh.rotation.z = Math.PI / 2; }); }
      else add(B(bb[0], bb[1], bb[2]), tint || '#cccccc', 0, bb[1] / 2, 0);
      grp.scale.setScalar(sc);
      return grp;
    };
    UB.prefab = function (kind, o) { o = Object.assign({}, o || {}); o.shape = 'prefab'; o.prefab = kind; return UB.spawn(o); };
    // ==== Blocky characters (Roblox-like) and glTF models with skeletal animation ====
    // Animations: 'idle' | 'walk' | 'run' | 'jump' | 'wave' | 'dance' | 'cheer' | 'hit'. Unless one is set (e.play), the character
    // picks stand / walk / run / jump from how it moves (for the UB.player3d hero also from "on the ground").
    var animated = [], charGeo = {}, charMats = {};
    var character = function (o) {
      var robot = o.style === 'robot';
      // geometry and non-recolorable materials are shared by all characters (there may be dozens), clothes are per character (setColor, hit flash)
      var lam = function (c, glow, own) {
        var key = c + '|' + (glow || ''); if (!own && charMats[key]) return charMats[key];
        var m = new T.MeshLambertMaterial({ color: color(c), emissive: glow ? color(glow) : 0x000000 }); if (own) m.userData.own = true; else charMats[key] = m; return m;
      };
      var box = function (w, h, d, c, glow, own) { var k = w + 'x' + h + 'x' + d; return new T.Mesh(charGeo[k] || (charGeo[k] = new T.BoxGeometry(w, h, d)), lam(c, glow, own)); };
      var at = function (m, x, y, z) { m.position.set(x, y, z); return m; };
      var skin = o.skin || (robot ? '#b8c4d6' : '#f2c79c'), shirt = o.shirt || (robot ? '#7d8da8' : '#4cc9f0'), pants = o.pants || (robot ? '#5c6b82' : '#3a0ca3');
      var root = new T.Group(), body = new T.Group(); root.add(body);
      var joint = function (x, y) { var g = new T.Group(); g.position.set(x, y, 0); body.add(g); return g; };
      // legs: hinge at the hip (y = −0.2 from the center; bottom is −1)
      var hipL = joint(0.16, -0.2), hipR = joint(-0.16, -0.2);
      if (robot) return robotBody(o, root, body, joint, hipL, hipR, box, at);
      [hipL, hipR].forEach(function (hp) { hp.add(at(box(0.3, 0.62, 0.32, pants), 0, -0.31, 0)); hp.add(at(box(0.32, 0.18, 0.38, o.shoes || '#2b2d42'), 0, -0.71, 0.03)); });
      var torso = at(box(0.68, 0.72, 0.38, shirt, null, true), 0, 0.15, 0); torso.userData.tint = true; body.add(torso);
      // arms: hinge at the shoulder
      var shL = joint(0.47, 0.44), shR = joint(-0.47, 0.44);
      [shL, shR].forEach(function (sh) { var a = at(box(0.24, 0.5, 0.26, shirt, null, true), 0, -0.22, 0); a.userData.tint = true; sh.add(a); sh.add(at(box(0.22, 0.2, 0.24, skin), 0, -0.56, 0)); });
      // in hand: a blaster along the arm (with e.aim the arms point forward — the blaster faces where the character faces)
      if (o.item === 'blaster') { shR.add(at(box(0.12, 0.5, 0.17, '#2b2d42'), 0, -0.78, 0.04)); shR.add(at(box(0.08, 0.08, 0.08, o.itemColor || '#7df9ff', o.itemColor || '#7df9ff'), 0, -1.05, 0.04)); }
      // head with a face (+z is the front: the hero looks that way at rotY = 0)
      var neck = joint(0, 0.52);
      neck.add(at(box(0.52, 0.52, 0.5, skin), 0, 0.27, 0));
      var eye = o.eyes || (robot ? '#7df9ff' : '#1b1b2f');
      [-0.12, 0.12].forEach(function (x) { neck.add(at(box(0.09, robot ? 0.07 : 0.11, 0.03, eye, robot ? eye : null), x, 0.31, 0.255)); });
      if (!robot) neck.add(at(box(0.16, 0.035, 0.03, '#8d3b3b'), 0, 0.15, 0.255));
      if (robot) { neck.add(at(box(0.04, 0.22, 0.04, '#8b949e'), 0, 0.63, 0)); neck.add(at(box(0.1, 0.1, 0.1, '#ff4d6d', '#ff4d6d'), 0, 0.77, 0)); }
      else if (o.hair !== null && o.hair !== 'none') { var hc = o.hair || '#4a2b0f'; neck.add(at(box(0.56, 0.14, 0.54, hc), 0, 0.56, 0)); neck.add(at(box(0.56, 0.3, 0.12, hc), 0, 0.42, -0.22)); }
      var hat = o.hat, hatC = o.hatColor || '#ef476f';
      if (hat === 'cap') { neck.add(at(box(0.58, 0.16, 0.56, hatC), 0, 0.6, 0)); neck.add(at(box(0.5, 0.05, 0.26, hatC), 0, 0.54, 0.36)); }
      else if (hat === 'crown') { neck.add(at(box(0.5, 0.12, 0.5, '#ffd166', '#7a5a00'), 0, 0.6, 0)); [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(function (p) { neck.add(at(box(0.1, 0.14, 0.1, '#ffd166', '#7a5a00'), p[0], 0.72, p[1])); }); }
      else if (hat === 'party') { var cone = at(new T.Mesh(charGeo.cone || (charGeo.cone = new T.ConeGeometry(0.2, 0.5, 12)), lam(hatC)), 0, 0.82, 0); neck.add(cone); }
      else if (hat === 'helmet') { neck.add(at(box(0.6, 0.34, 0.58, hatC), 0, 0.5, -0.02)); neck.add(at(box(0.46, 0.14, 0.04, '#9ad1ff'), 0, 0.33, 0.3)); }
      else if (hat === 'bow') { neck.add(at(box(0.16, 0.12, 0.1, hatC), -0.1, 0.62, 0)); neck.add(at(box(0.16, 0.12, 0.1, hatC), 0.1, 0.62, 0)); }
      root.userData.rig = { body: body, hipL: hipL, hipR: hipR, shL: shL, shR: shR, neck: neck };
      root.scale.setScalar(o.scale || 1);
      return root;
    };
    // A blocky robot like a game hero: helmet with a dark visor and glowing eyes, chest plate with a glowing core, backpack,
    // shoulder pads, gloves, big boots and (with item: 'blaster') an arm cannon with a glowing muzzle. Same joints as people,
    // so all animations work. Colors: shirt — the body, pants — the accent (plates, boots), eyes — the glow.
    var robotBody = function (o, root, body, joint, hipL, hipR, box, at) {
      var main = o.shirt || '#f39c34', acc = o.pants || '#3f9e4f', dark = '#2b2d42', metal = '#8d96a0', glow = o.eyes || '#ffb547';
      var tint = function (m) { m.userData.tint = true; return m; };
      [hipL, hipR].forEach(function (hp) {
        hp.add(at(tint(box(0.3, 0.34, 0.32, main, null, true)), 0, -0.17, 0)); hp.add(at(box(0.26, 0.12, 0.28, dark), 0, -0.38, 0.01));
        hp.add(at(tint(box(0.32, 0.24, 0.34, main, null, true)), 0, -0.55, 0)); hp.add(at(box(0.38, 0.17, 0.46, acc), 0, -0.715, 0.05));
      });
      body.add(at(tint(box(0.72, 0.6, 0.42, main, null, true)), 0, 0.17, 0));                 // torso
      body.add(at(box(0.5, 0.32, 0.06, acc), 0, 0.24, 0.23));                                   // chest plate
      body.add(at(box(0.12, 0.12, 0.04, glow, glow), 0, 0.24, 0.27));                           // glowing core
      body.add(at(box(0.74, 0.1, 0.44, dark), 0, -0.13, 0));                                     // belt
      body.add(at(box(0.5, 0.42, 0.14, dark), 0, 0.2, -0.27));                                   // backpack
      var shL = joint(0.47, 0.44), shR = joint(-0.47, 0.44);
      [shL, shR].forEach(function (sh) {
        sh.add(at(box(0.32, 0.16, 0.36, acc), 0, 0.05, 0));                                       // shoulder pad
        sh.add(at(tint(box(0.22, 0.26, 0.24, main, null, true)), 0, -0.15, 0)); sh.add(at(box(0.2, 0.08, 0.22, dark), 0, -0.32, 0));
        sh.add(at(box(0.24, 0.2, 0.26, metal), 0, -0.44, 0)); sh.add(at(box(0.3, 0.22, 0.3, dark), 0, -0.63, 0));   // forearm, glove
      });
      if (o.item === 'blaster') {   // arm cannon: a big cube on the right fist, the muzzle glows (forward when aiming)
        var gc = o.itemColor || '#7df9ff';
        shR.add(at(box(0.38, 0.36, 0.38, dark), 0, -0.78, 0.02)); shR.add(at(box(0.3, 0.04, 0.3, gc, gc), 0, -0.97, 0.02));
        shR.add(at(box(0.4, 0.06, 0.4, acc), 0, -0.62, 0.02));
      }
      var neck = joint(0, 0.5);
      neck.add(at(tint(box(0.56, 0.46, 0.5, main, null, true)), 0, 0.25, 0));                   // head
      neck.add(at(box(0.6, 0.08, 0.54, metal), 0, 0.5, 0));                                      // helmet rim
      neck.add(at(box(0.46, 0.17, 0.03, '#1b1b2f'), 0, 0.27, 0.255));                            // visor
      [-0.11, 0.11].forEach(function (x) { neck.add(at(box(0.12, 0.07, 0.02, glow, glow), x, 0.28, 0.272)); });   // eyes
      neck.add(at(box(0.18, 0.04, 0.02, dark), 0, 0.1, 0.255));                                  // mouth grille
      [-0.3, 0.3].forEach(function (x) { neck.add(at(box(0.06, 0.18, 0.18, dark), x, 0.26, 0)); });   // ear discs
      neck.add(at(box(0.04, 0.18, 0.04, metal), 0.18, 0.62, -0.05)); neck.add(at(box(0.08, 0.08, 0.08, glow, glow), 0.18, 0.74, -0.05));
      root.userData.rig = { body: body, hipL: hipL, hipR: hipR, shL: shL, shR: shR, neck: neck };
      root.scale.setScalar(o.scale || 1);
      return root;
    };
    var POSES = { wave: 1.6, dance: 3, cheer: 1.6, hit: 0.5, jump: 0.8 };
    // a blocky character's pose (angles in radians): legs/arms around x (negative is forward), arms sideways around z
    var pose = function (name, t) {
      var p = { lx: 0, rx: 0, alx: 0, arx: 0, alz: 0.06, arz: -0.06, lean: 0, bob: 0, twist: 0, head: 0 }, s;
      if (name === 'walk') { s = Math.sin(t * 9); p.lx = 0.6 * s; p.rx = -0.6 * s; p.alx = -0.5 * s; p.arx = 0.5 * s; p.bob = Math.abs(s) * 0.05; }
      else if (name === 'run') { s = Math.sin(t * 13); p.lx = s; p.rx = -s; p.alx = -0.9 * s; p.arx = 0.9 * s; p.lean = 0.18; p.bob = Math.abs(s) * 0.1; }
      else if (name === 'jump') { p.lx = -0.6; p.rx = 0.3; p.alx = p.arx = -2.6; p.alz = 0.25; p.arz = -0.25; }
      else if (name === 'wave') { p.arz = -2.7 + 0.35 * Math.sin(t * 10); p.alx = 0.05 * Math.sin(t * 2); p.head = 0.1; }
      else if (name === 'dance') { s = Math.sin(t * 6); p.alx = -1.2 - 1.2 * s; p.arx = -1.2 + 1.2 * s; p.twist = 0.35 * s; p.bob = 0.08 * Math.abs(Math.cos(t * 6)); p.lx = 0.25 * s; p.rx = -0.25 * s; }
      else if (name === 'cheer') { p.alx = p.arx = -2.9 + 0.2 * Math.sin(t * 16); p.alz = 0.35; p.arz = -0.35; p.bob = 0.15 * Math.abs(Math.sin(t * 8)); }
      else if (name === 'hit') { p.lean = -0.35; p.alx = p.arx = -0.6; p.alz = 0.5; p.arz = -0.5; p.head = -0.2; }
      else { s = Math.sin(t * 2); p.alx = 0.05 * s; p.arx = -0.05 * s; p.bob = 0.02 * s; }
      return p;
    };
    // what to play now: a set one (e.play) or by movement
    var autoAnim = function (e, dt) {
      if (e._lx == null) { e._lx = e.x; e._ly = e.y; e._lz = e.z; }
      var v = dt > 0 ? Math.hypot(e.x - e._lx, e.z - e._lz) / dt : 0, vy = dt > 0 ? (e.y - e._ly) / dt : 0;
      e._lx = e.x; e._ly = e.y; e._lz = e.z;
      e._v = (e._v || 0) + (v - (e._v || 0)) * Math.min(1, dt * 10);   // smoothed: frame hiccups don't jerk the animation
      if (e._once) { e._onceT -= dt; if (e._onceT > 0) return e._once; e._once = null; }
      if (e._loop) return e._loop;
      var air = e._pc ? !e._pc.onGround : Math.abs(vy) > 2.5;
      return air ? 'jump' : e._v > 4.6 * (e.h / 2) ? 'run' : e._v > 0.4 ? 'walk' : 'idle';
    };
    var animatable = function (e) {
      e.play = function (name, o) {
        o = o || {}; name = String(name || 'idle');
        if (o.once) { e._once = name; e._onceT = o.time || POSES[name.toLowerCase()] || clipLen(e, name) || 1.5; } else { e._once = null; e._loop = name === 'auto' ? null : name; }
        return e;
      };
      e.stop = function () { e._once = e._loop = null; return e; };
      animated.push(e);
    };
    UB.character3d = function (o) {
      o = Object.assign({}, o || {}); o.shape = 'character';
      var e = UB.spawn(o); e.y = o.y == null ? e.h / 2 : o.y;
      e._t = Math.random() * 10; e._cur = pose('idle', 0);
      e._animate = function (dt) {
        var name = autoAnim(e, dt).toLowerCase(), rig = e.mesh.userData.rig; if (!rig) return;
        e._t += dt * (name === 'walk' || name === 'run' ? Math.max(0.6, Math.min(1.6, e._v / (name === 'run' ? 7 : 3) / (e.h / 2))) : 1);
        var tg = pose(name, e._t), c = e._cur, k = 1 - Math.exp(-dt * 14);
        if (e.aim && !e._once) { tg.alx = -1.35; tg.arx = -1.5; tg.alz = -0.35; tg.arz = 0.1; }   // arms hold the blaster in front (legs as usual)
        for (var key in tg) c[key] += (tg[key] - c[key]) * k;
        rig.hipL.rotation.x = c.lx; rig.hipR.rotation.x = c.rx; rig.shL.rotation.x = c.alx; rig.shR.rotation.x = c.arx; rig.shL.rotation.z = c.alz; rig.shR.rotation.z = c.arz;
        rig.body.rotation.x = c.lean; rig.body.rotation.y = c.twist; rig.body.position.y = c.bob; rig.neck.rotation.x = -c.head;
      };
      animatable(e); return e;
    };
    // ---- glTF models: in Studio built-in ones (a script from our origin puts them into window.__UB_MODELS), in the library — UB.loadModel ----
    var gltfs = {};
    var Loader = function () { return T.GLTFLoader || window.GLTFLoader; };
    var cloneSkinned = function (o) { var SU = T.SkeletonUtils || window.SkeletonUtils; return SU && SU.clone ? SU.clone(o) : o.clone(true); };
    var modelRec = function (name) { return gltfs[name] || (gltfs[name] = { gltf: null, waiting: [], failed: false }); };
    var modelReady = function (rec, g) { rec.gltf = g; rec.waiting.forEach(function (f) { f(g); }); rec.waiting = []; };
    var modelFailed = function (rec, name, err) { rec.failed = true; rec.waiting.forEach(function (f) { f(null); }); rec.waiting = []; console.warn('model ' + name + ': ' + (err && err.message || err)); };
    UB.loadModel = function (name, url) {
      var L = Loader(), rec = modelRec(name); if (!L) return modelFailed(rec, name, 'GLTFLoader is not loaded');
      pending++;
      new L().load(url, function (g) { pending--; modelReady(rec, g); }, undefined, function (err) { pending--; modelFailed(rec, name, err); });
    };
    (function () {
      var M = window.__UB_MODELS || {}, L = Loader();
      Object.keys(M).forEach(function (name) {
        var rec = modelRec(name); if (!L) return modelFailed(rec, name, 'GLTFLoader is not loaded');
        try {
          var bin = atob(M[name]), buf = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
          pending++;
          new L().parse(buf.buffer, '', function (g) { pending--; modelReady(rec, g); }, function (err) { pending--; modelFailed(rec, name, err); });
        } catch (err) { modelFailed(rec, name, err); }
      });
    })();
    // bounds including bones: a skinned model keeps its geometry in the bind pose (often in centimeters)
    var boundsOf = function (obj) { obj.updateMatrixWorld(true); obj.traverse(function (m) { if (m.isSkinnedMesh) m.boundingBox = null; }); return new T.Box3().setFromObject(obj); };
    var clipLen = function (e, name) { var a = e._actions && findClip(e, name); return a ? a.getClip().duration : 0; };
    var findClip = function (e, name) {
      var n = String(name).toLowerCase(), names = Object.keys(e._actions || {}), exact = names.filter(function (k) { return k.toLowerCase() === n; })[0];
      if (exact) return e._actions[exact];
      var alias = { idle: /idle|stand/i, walk: /^walk(?!.*jump)|walking/i, run: /run/i, jump: /jump/i, wave: /wave/i, dance: /dance/i, cheer: /yes|thumbs|cheer|victory/i, hit: /hit|punch|no$/i };
      var re = alias[n] || new RegExp(n.replace(/[^a-z0-9]/gi, ''), 'i');
      var k = names.filter(function (x) { return re.test(x); })[0];
      return k ? e._actions[k] : null;
    };
    // UB.model3d('robot', { x, z, h: 2, rotY, solid, turn }) — a world object: hitbox from the model's size (height h, 2 m by default)
    UB.model3d = function (name, o) {
      o = Object.assign({}, o || {});
      var want = o.h || 2;
      var e = UB.spawn({ shape: 'model', x: o.x, z: o.z, y: o.y, w: o.w || want * 0.5, h: want, d: o.d || want * 0.5, rotY: o.rotY, solid: o.solid, data: o.data });
      e.modelName = name; e.anims = []; e._t = 0;
      var attach = function (g) {
        if (ents.indexOf(e) < 0) return;   // the object has already been removed
        var root;
        if (!g) { root = new T.Mesh(new T.CapsuleGeometry(want * 0.22, want * 0.5, 4, 10), new T.MeshLambertMaterial({ color: color(o.color || '#b388ff') })); root.position.y = 0; root.castShadow = true; e.mesh.add(root); return; }
        root = cloneSkinned(g.scene);
        root.traverse(function (m) { if (m.isMesh) { m.castShadow = o.shadow !== false; m.receiveShadow = true; m.frustumCulled = false; } });
        var inner = new T.Group(); inner.add(root); inner.rotation.y = o.turn || 0;
        var bb = boundsOf(inner), sz = bb.getSize(new T.Vector3());
        var k = o.scale || want / (sz.y || 1); inner.scale.setScalar(k);
        bb = boundsOf(inner); var cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        e.h = bb.max.y - bb.min.y; e.w = Math.max(0.3, bb.max.x - bb.min.x); e.d = Math.max(0.3, bb.max.z - bb.min.z);
        if (o.y == null) e.y = e.h / 2;
        inner.position.set(-cx, -bb.min.y - e.h / 2, -cz);
        e.mesh.add(inner);
        if (g.animations && g.animations.length) {
          e._mixer = new T.AnimationMixer(root); e._actions = {};
          g.animations.forEach(function (clip) { e._actions[clip.name] = e._mixer.clipAction(clip); e.anims.push(clip.name); });
        }
      };
      var rec = gltfs[name];
      if (rec && rec.gltf) attach(rec.gltf);
      else if (rec && !rec.failed) rec.waiting.push(attach);
      else attach(null);   // no such model — a simple shape instead, the game doesn't break
      e._animate = function (dt) {
        var want2 = autoAnim(e, dt); if (!e._mixer) return;
        var act = findClip(e, want2) || findClip(e, 'idle');
        if (act && act !== e._act) {
          act.reset(); act.setLoop(e._once ? T.LoopOnce : T.LoopRepeat, Infinity); act.clampWhenFinished = !!e._once; act.play();
          if (e._act) e._act.crossFadeTo(act, 0.25, false);
          e._act = act;
        }
        var sp = 1; if (act && (want2 === 'walk' || want2 === 'run')) sp = Math.max(0.6, Math.min(1.8, e._v / (want2 === 'run' ? 7 : 3) / (e.h / 2)));
        e._mixer.update(dt * sp);
      };
      animatable(e); return e;
    };
    UB.label3d = function (text, x, y, z, o) { o = Object.assign({}, o || {}); o.shape = 'label'; o.text = text; o.x = x; o.y = y; o.z = z; return UB.spawn(o); };
    // world point → 2D layer coordinates (for labels and bars over objects in draw); visible = false — behind the camera
    UB.toScreen3d = function (x, y, z) {
      if (!camera) return { x: 0, y: 0, visible: false };
      var v = new T.Vector3(x, y, z); v.project(camera);
      return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, visible: v.z < 1 && v.z > -1 };
    };
    // Voxels — a world of cubes like Minecraft: thousands of cubes are cheap even on a weak laptop.
    // list: [{ x, y, z, c } | { x, y, z, b: 'grass' }] — cube center and color or block; o.size — edge (m). Returns { remove() }; UB.clear3d removes it too.
    var vox = [];
    // ---- school world blocks (shared package @upbilim/blocks): the same catalog and pixel textures as in the UpBilim world ----
    var BLOCK_DEFS = [{"id":0,"key":"air","top":"#000","side":"#000","solid":false,"clear":true,"glow":false,"cross":false},{"id":1,"key":"grass","top":"#6FBF4B","side":"#8B6A4E","solid":true,"clear":false,"glow":false,"cross":false},{"id":2,"key":"dirt","top":"#8B6A4E","side":"#8B6A4E","solid":true,"clear":false,"glow":false,"cross":false},{"id":3,"key":"stone","top":"#9AA0A6","side":"#8C9298","solid":true,"clear":false,"glow":false,"cross":false},{"id":4,"key":"sand","top":"#E9D9A6","side":"#E3D29B","solid":true,"clear":false,"glow":false,"cross":false},{"id":5,"key":"planks","top":"#C49A6C","side":"#B98C5C","solid":true,"clear":false,"glow":false,"cross":false},{"id":6,"key":"log","top":"#C9A77A","side":"#7A5536","solid":true,"clear":false,"glow":false,"cross":false},{"id":7,"key":"leaves","top":"#3F9E4F","side":"#3A9148","solid":true,"clear":false,"glow":false,"cross":false},{"id":8,"key":"white","top":"#F4F1EC","side":"#EAE6DF","solid":true,"clear":false,"glow":false,"cross":false},{"id":9,"key":"path","top":"#B8AE9C","side":"#A89E8B","solid":true,"clear":false,"glow":false,"cross":false},{"id":10,"key":"brick","top":"#B5533C","side":"#A94B35","solid":true,"clear":false,"glow":false,"cross":false},{"id":11,"key":"glass","top":"#CFE8FB","side":"#CFE8FB","solid":true,"clear":true,"glow":false,"cross":false},{"id":12,"key":"purple","top":"#AF58EA","side":"#9E4BD6","solid":true,"clear":false,"glow":false,"cross":false},{"id":13,"key":"yellow","top":"#F2C94C","side":"#E6BB3C","solid":true,"clear":false,"glow":false,"cross":false},{"id":14,"key":"blue","top":"#2F80ED","side":"#276FD1","solid":true,"clear":false,"glow":false,"cross":false},{"id":15,"key":"red","top":"#E8484A","side":"#D23E40","solid":true,"clear":false,"glow":false,"cross":false},{"id":16,"key":"green","top":"#27AE60","side":"#219653","solid":true,"clear":false,"glow":false,"cross":false},{"id":17,"key":"black","top":"#2E2A33","side":"#27232C","solid":true,"clear":false,"glow":false,"cross":false},{"id":18,"key":"books","top":"#C49A6C","side":"#8C5A3C","solid":true,"clear":false,"glow":false,"cross":false},{"id":19,"key":"water","top":"#5AA9E6","side":"#4F9BD9","solid":false,"clear":true,"glow":false,"cross":false},{"id":20,"key":"flowers","top":"#F0617A","side":"#6FBF4B","solid":false,"clear":false,"glow":false,"cross":true},{"id":21,"key":"lamp","top":"#FFE58A","side":"#FFD95A","solid":true,"clear":false,"glow":true,"cross":false},{"id":22,"key":"gold","top":"#F5B301","side":"#E0A300","solid":true,"clear":false,"glow":false,"cross":false},{"id":23,"key":"bedrock","top":"#4A4F57","side":"#4A4F57","solid":true,"clear":false,"glow":false,"cross":false},{"id":24,"key":"school","top":"#F2C94C","side":"#EAD9A0","solid":true,"clear":false,"glow":false,"cross":false},{"id":25,"key":"tallgrass","top":"#5DAE3E","side":"#5DAE3E","solid":false,"clear":false,"glow":false,"cross":true},{"id":26,"key":"cobble","top":"#8A8F95","side":"#8A8F95","solid":true,"clear":false,"glow":false,"cross":false},{"id":27,"key":"sandstone","top":"#E3CB8F","side":"#D9BE7E","solid":true,"clear":false,"glow":false,"cross":false},{"id":28,"key":"snow","top":"#FBFDFF","side":"#EEF4FA","solid":true,"clear":false,"glow":false,"cross":false},{"id":29,"key":"orange","top":"#F2994A","side":"#E0873A","solid":true,"clear":false,"glow":false,"cross":false},{"id":30,"key":"pink","top":"#F497C0","side":"#E585B0","solid":true,"clear":false,"glow":false,"cross":false},{"id":31,"key":"ice","top":"#A9D8F5","side":"#9CCDEE","solid":true,"clear":true,"glow":false,"cross":false},{"id":32,"key":"torch","top":"#FFB547","side":"#8B6A4E","solid":false,"clear":false,"glow":true,"cross":true},{"id":33,"key":"start","top":"#27AE60","side":"#219653","solid":true,"clear":false,"glow":true,"cross":false},{"id":34,"key":"finish","top":"#FFFFFF","side":"#27221A","solid":true,"clear":false,"glow":true,"cross":false},{"id":35,"key":"checkpoint","top":"#F2C94C","side":"#E0A300","solid":true,"clear":false,"glow":false,"cross":false},{"id":36,"key":"lava","top":"#FF6A1A","side":"#E24A0E","solid":true,"clear":false,"glow":true,"cross":false},{"id":37,"key":"bounce","top":"#7ED957","side":"#5BBF3A","solid":true,"clear":false,"glow":false,"cross":false},{"id":38,"key":"question","top":"#8E44D6","side":"#7B35C1","solid":true,"clear":false,"glow":true,"cross":false},{"id":39,"key":"lift","top":"#A7B3C2","side":"#8794A5","solid":true,"clear":false,"glow":false,"cross":false},{"id":40,"key":"door","top":"#B98C5C","side":"#A0703F","solid":true,"clear":false,"glow":false,"cross":false},{"id":41,"key":"button","top":"#E8484A","side":"#9AA0A6","solid":true,"clear":false,"glow":false,"cross":false},{"id":42,"key":"lever","top":"#8A8F95","side":"#8A8F95","solid":true,"clear":false,"glow":false,"cross":false},{"id":43,"key":"leverOn","top":"#27AE60","side":"#8A8F95","solid":true,"clear":false,"glow":true,"cross":false},{"id":44,"key":"chair","top":"#C44B4B","side":"#B98C5C","solid":true,"clear":false,"glow":false,"cross":false},{"id":45,"key":"stove","top":"#2E2A33","side":"#DDE1E6","solid":true,"clear":false,"glow":false,"cross":false},{"id":46,"key":"fridge","top":"#F4F6F8","side":"#E9EDF1","solid":true,"clear":false,"glow":false,"cross":false},{"id":47,"key":"sink","top":"#D9D2C5","side":"#9CC3A6","solid":true,"clear":false,"glow":false,"cross":false},{"id":48,"key":"counter","top":"#D9D2C5","side":"#9CC3A6","solid":true,"clear":false,"glow":false,"cross":false},{"id":49,"key":"wallCabinet","top":"#8DB497","side":"#9CC3A6","solid":true,"clear":false,"glow":false,"cross":false},{"id":50,"key":"table","top":"#C49A6C","side":"#A87B4F","solid":true,"clear":false,"glow":false,"cross":false},{"id":51,"key":"tiles","top":"#F7F8FA","side":"#F7F8FA","solid":true,"clear":false,"glow":false,"cross":false},{"id":52,"key":"checker","top":"#2E2A33","side":"#F4F1EC","solid":true,"clear":false,"glow":false,"cross":false},{"id":53,"key":"asphalt","top":"#46494F","side":"#3A3D42","solid":true,"clear":false,"glow":false,"cross":false},{"id":54,"key":"roadWhite","top":"#F2F2EE","side":"#3A3D42","solid":true,"clear":false,"glow":false,"cross":false},{"id":55,"key":"roadYellow","top":"#F2C230","side":"#3A3D42","solid":true,"clear":false,"glow":false,"cross":false},{"id":56,"key":"sidewalk","top":"#C9C6BF","side":"#B3AFA7","solid":true,"clear":false,"glow":false,"cross":false},{"id":57,"key":"bikeLane","top":"#B8574A","side":"#9C4A3F","solid":true,"clear":false,"glow":false,"cross":false},{"id":58,"key":"sandstoneBricks","top":"#E2C48E","side":"#D6B47A","solid":true,"clear":false,"glow":false,"cross":false},{"id":59,"key":"shutter","top":"#8D96A0","side":"#7E8792","solid":true,"clear":false,"glow":false,"cross":false},{"id":60,"key":"windowFrame","top":"#F4F1EC","side":"#CFE8FB","solid":true,"clear":true,"glow":false,"cross":false},{"id":61,"key":"crate","top":"#C49A6C","side":"#B07E4A","solid":true,"clear":false,"glow":false,"cross":false},{"id":62,"key":"metal","top":"#A7B3C2","side":"#98A4B3","solid":true,"clear":false,"glow":false,"cross":false},{"id":63,"key":"glowCube","top":"#7DF9FF","side":"#4CC9F0","solid":true,"clear":false,"glow":true,"cross":false},{"id":64,"key":"slabSandstone","top":"#E3CB8F","side":"#D9BE7E","solid":true,"clear":false,"glow":false,"cross":false,"tex":"sandstone","boxes":[[0,0,0,1,0.5,1]]},{"id":65,"key":"slabPlanks","top":"#C49A6C","side":"#B98C5C","solid":true,"clear":false,"glow":false,"cross":false,"tex":"planks","boxes":[[0,0,0,1,0.5,1]]},{"id":66,"key":"slabStone","top":"#8A8F95","side":"#8A8F95","solid":true,"clear":false,"glow":false,"cross":false,"tex":"cobble","boxes":[[0,0,0,1,0.5,1]]},{"id":67,"key":"stairsSandstone","top":"#E3CB8F","side":"#D9BE7E","solid":true,"clear":false,"glow":false,"cross":false,"tex":"sandstone","boxes":[[0,0,0,1,0.5,1],[0,0.5,0,1,1,0.5]]},{"id":68,"key":"stairsSandstone1","top":"#E3CB8F","side":"#D9BE7E","solid":true,"clear":false,"glow":false,"cross":false,"tex":"sandstone","boxes":[[0,0,0,1,0.5,1],[0.5,0.5,0,1,1,1]],"base":67},{"id":69,"key":"stairsSandstone2","top":"#E3CB8F","side":"#D9BE7E","solid":true,"clear":false,"glow":false,"cross":false,"tex":"sandstone","boxes":[[0,0,0,1,0.5,1],[0,0.5,0.5,1,1,1]],"base":67},{"id":70,"key":"stairsSandstone3","top":"#E3CB8F","side":"#D9BE7E","solid":true,"clear":false,"glow":false,"cross":false,"tex":"sandstone","boxes":[[0,0,0,1,0.5,1],[0,0.5,0,0.5,1,1]],"base":67},{"id":71,"key":"stairsPlanks","top":"#C49A6C","side":"#B98C5C","solid":true,"clear":false,"glow":false,"cross":false,"tex":"planks","boxes":[[0,0,0,1,0.5,1],[0,0.5,0,1,1,0.5]]},{"id":72,"key":"stairsPlanks1","top":"#C49A6C","side":"#B98C5C","solid":true,"clear":false,"glow":false,"cross":false,"tex":"planks","boxes":[[0,0,0,1,0.5,1],[0.5,0.5,0,1,1,1]],"base":71},{"id":73,"key":"stairsPlanks2","top":"#C49A6C","side":"#B98C5C","solid":true,"clear":false,"glow":false,"cross":false,"tex":"planks","boxes":[[0,0,0,1,0.5,1],[0,0.5,0.5,1,1,1]],"base":71},{"id":74,"key":"stairsPlanks3","top":"#C49A6C","side":"#B98C5C","solid":true,"clear":false,"glow":false,"cross":false,"tex":"planks","boxes":[[0,0,0,1,0.5,1],[0,0.5,0,0.5,1,1]],"base":71}];
    // the function's source from the package: TypeScript loaders (tsx, esbuild with keepNames) insert __name calls into it — here it does nothing
    var __name = function (t) { return t; };
    var paintBlockTiles = function paintBlockTiles(blocks                                                                                     , cols        , T        , d                   , width        )       {
                                      
  const hex = (h        )      => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mul = (c     , k        )      => [c[0] * k, c[1] * k, c[2] * k];

  // deterministic generator: the same tile always gets the same pattern
  function rng(seed        ) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

                                        
                                                                                                                                              

  function paint(t      , b                                                                      , face      ) {
    const S = 16, top = hex(b.top), side = hex(b.side), base = face === 'top' ? top : side, { set, fill, r } = t;
    const wood = (c     ) => {                        // planks: 4-pixel bands, joints, grain
      fill(c, 0.08);
      for (let y = 0; y < S; y++) { if (y % 4 === 3) for (let x = 0; x < S; x++) set(x, y, mul(c, 0.72)); }
      for (let row = 0; row < 4; row++) { const sx = Math.floor(r() * S); for (let y = row * 4; y < row * 4 + 3; y++) set(sx, y, mul(c, 0.8)); }
    };
    switch (b.tex || b.key) {
      case 'grass':
        if (face === 'top') { fill(top, 0.22); for (let i = 0; i < 18; i++) set(r() * S | 0, r() * S | 0, mul(top, 0.8)); }
        else if (face === 'side') {
          fill(side, 0.25);
          for (let x = 0; x < S; x++) { const h = 3 + (r() < 0.5 ? 1 : 0) + (r() < 0.2 ? 1 : 0); for (let y = 0; y < h; y++) set(x, y, mul(top, 0.9 + r() * 0.2)); }
        } else fill(side, 0.25);
        break;
      case 'dirt': fill(base, 0.28); for (let i = 0; i < 10; i++) set(r() * S | 0, r() * S | 0, mul(base, 0.7)); break;
      case 'stone': case 'bedrock':
        fill(base, b.key === 'bedrock' ? 0.4 : 0.16);
        for (let i = 0; i < 6; i++) { let x = r() * S | 0, y = r() * S | 0; for (let k = 0; k < 4; k++) { set(x, y, mul(base, 0.78)); x += r() < 0.5 ? 1 : 0; y += r() < 0.5 ? 1 : -1; } }
        break;
      case 'cobble': {
        fill(base, 0.1);
        // stones: an offset 4×4 grid, each stone its own tone, dark seams between them
        for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) {
          const k = 0.85 + r() * 0.3, ox = cy % 2 ? 2 : 0;
          for (let y = cy * 4; y < cy * 4 + 4; y++) for (let x = cx * 4; x < cx * 4 + 4; x++) {
            const edge = y === cy * 4 || x === cx * 4;
            set((x + ox) % S, y, edge ? mul(base, 0.6) : mul(base, k * (0.95 + r() * 0.1)));
          }
        }
        break;
      }
      case 'sand': case 'snow': fill(base, b.key === 'snow' ? 0.04 : 0.12); if (b.key === 'snow') for (let i = 0; i < 6; i++) set(r() * S | 0, r() * S | 0, [220, 232, 245]); break;
      case 'sandstone':
        fill(base, 0.08);
        for (let x = 0; x < S; x++) { set(x, 0, mul(base, 1.08)); set(x, 5, mul(base, 0.85)); set(x, 10, mul(base, 0.88)); set(x, 15, mul(base, 0.82)); }
        break;
      case 'planks': wood(base); break;
      case 'log':
        if (face === 'side') { fill(side, 0.1); for (let x = 0; x < S; x++) { const k = 0.8 + ((x * 7) % 5) / 12; for (let y = 0; y < S; y++) if (r() < 0.8) set(x, y, mul(side, k)); } }
        else { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); set(x, y, d > 6.5 ? side : mul(top, (Math.floor(d) % 2 ? 0.86 : 1) * (0.96 + r() * 0.08))); } }
        break;
      case 'leaves': fill(base, 0.3); for (let i = 0; i < 26; i++) set(r() * S | 0, r() * S | 0, mul(base, 0.6)); for (let i = 0; i < 10; i++) set(r() * S | 0, r() * S | 0, mul(base, 1.2)); break;
      case 'path': fill(base, 0.18); for (let i = 0; i < 14; i++) { const x = r() * S | 0, y = r() * S | 0, c = mul(base, 0.8 + r() * 0.35); set(x, y, c); set(x + 1, y, c); } break;
      case 'brick': {
        const mortar      = [214, 205, 194];
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const row = y >> 2, ox = row % 2 ? 4 : 0;
          set(x, y, y % 4 === 3 || (x + ox) % 8 === 7 ? mortar : mul(base, 0.9 + r() * 0.18));
        }
        break;
      }
      case 'glass': case 'ice': {
        const ice = b.key === 'ice';
        fill(base, ice ? 0.08 : 0.02, ice ? 205 : 60);
        if (!ice) for (let i = 0; i < S; i++) { set(i, 0, [255, 255, 255], 210); set(i, S - 1, [255, 255, 255], 210); set(0, i, [255, 255, 255], 210); set(S - 1, i, [255, 255, 255], 210); }
        for (let i = 0; i < 4; i++) { set(3 + i, 6 - i, [255, 255, 255], 190); set(8 + i, 12 - i, [255, 255, 255], 160); }
        break;
      }
      case 'water': fill(base, 0.08, 170); for (let y = 2; y < S; y += 5) for (let x = 0; x < S; x++) if ((x + y) % 7 < 3) set(x, y, mul(base, 1.18), 170); break;
      case 'books':
        if (face !== 'side') { wood(top); break; }
        wood(hex('#B98C5C'));
        for (const shelf of [1, 9]) {
          let x = 1;
          while (x < S - 1) {
            const w = r() < 0.7 ? 2 : 1, h = 5 + (r() * 2 | 0), c = hex(['#AF58EA', '#2F80ED', '#E8484A', '#27AE60', '#F2C94C', '#F4F1EC'][r() * 6 | 0] );
            for (let dx = 0; dx < w && x + dx < S - 1; dx++) for (let y = shelf + 6 - h; y < shelf + 6; y++) set(x + dx, y, mul(c, dx ? 0.85 : 1));
            x += w;
          }
        }
        break;
      case 'lamp': case 'gold': {
        const lamp = b.key === 'lamp';
        fill(base, lamp ? 0.06 : 0.1);
        for (let i = 0; i < S; i++) {
          set(i, 0, mul(base, lamp ? 0.7 : 1.15)); set(0, i, mul(base, lamp ? 0.7 : 1.15));
          set(i, S - 1, mul(base, 0.7)); set(S - 1, i, mul(base, 0.7));
        }
        if (lamp) for (let i = 2; i < S - 2; i++) { set(i, 7, [255, 250, 225]); set(7, i, [255, 250, 225]); }
        else for (let i = 0; i < 5; i++) set(2 + i, 2, [255, 244, 190]);
        break;
      }
      case 'white': case 'school': fill(base, 0.05); if (b.key === 'school') for (let x = 0; x < S; x++) set(x, 7, mul(base, 0.92)); break;
      case 'flowers': {
        // stems and leaves, flowers in the block color on top with a yellow center
        for (const [fx, fy] of [[4, 4], [11, 6], [7, 9]]         ) {
          for (let y = fy + 1; y < S; y++) set(fx, y, hex('#3F9E4F'));
          set(fx - 1, fy + 5, hex('#5DAE3E')); set(fx + 1, fy + 7, hex('#5DAE3E'));
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]         ) set(fx + dx, fy + dy, top);
          set(fx, fy, hex('#F2C94C'));
        }
        break;
      }
      case 'tallgrass':
        for (let i = 0; i < 9; i++) {
          let x = 1 + (r() * 14 | 0);
          const h = 6 + (r() * 8 | 0), lean = r() < 0.5 ? -1 : 1;
          for (let k = 0; k < h; k++) { set(x, S - 1 - k, mul(base, 0.8 + k / h * 0.4)); if (k === (h >> 1)) x += lean; }
        }
        break;
      case 'torch':
        for (let y = 6; y < S; y++) { set(7, y, hex('#8B6A4E')); set(8, y, hex('#6F5238')); }
        for (const [x, y, c] of [[7, 5, '#FFD95A'], [8, 5, '#FFD95A'], [7, 4, '#FFB547'], [8, 4, '#FFE58A'], [7, 3, '#FF8A3D'], [8, 3, '#FFB547'], [7, 2, '#FF8A3D']]         ) set(x, y, hex(c));
        break;
      case 'start':
        fill(base, 0.08);
        if (face === 'top') for (let y = 3; y <= 12; y++) for (let x = 0; x < S; x++) {   // a white "forward" arrow
          const head = y <= 7 && Math.abs(x - 7.5) <= 7 - y + 3, shaft = y > 7 && Math.abs(x - 7.5) <= 2;
          if (head || shaft) set(x, y, [255, 255, 255]);
        } else for (let x = 0; x < S; x++) { set(x, 0, [255, 255, 255]); set(x, S - 1, mul(base, 0.7)); }
        break;
      case 'finish':
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, ((x >> 2) + (y >> 2)) % 2 ? [39, 34, 26] : [255, 255, 255]);   // checkerboard
        break;
      case 'checkpoint':
        fill(base, 0.08);
        for (let y = 3; y < 13; y++) set(5, y, [39, 34, 26]);                        // a flag
        for (let y = 3; y < 7; y++) for (let x = 6; x < 6 + (7 - y) + 4; x++) set(x, y, [175, 88, 234]);
        break;
      case 'lava':
        fill(base, 0.25);
        for (let i = 0; i < 22; i++) set(r() * S | 0, r() * S | 0, [255, 214, 90]);  // hot sparks
        for (let i = 0; i < 14; i++) set(r() * S | 0, r() * S | 0, [170, 40, 10]);
        break;
      case 'bounce':
        fill(base, 0.06);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (face === 'top' && (Math.abs(d - 6) < 0.8 || Math.abs(d - 3) < 0.8)) set(x, y, [255, 255, 255]); }
        if (face !== 'top') for (let x = 0; x < S; x++) for (const y of [4, 8, 12]) set(x, y, mul(base, 0.8));
        break;
      case 'door': {
        // a wooden door: planks, two panels, a brass handle at the side
        wood(base);
        if (face !== 'top') {
          for (const [y0, y1] of [[2, 6], [9, 13]]                           ) for (let y = y0; y <= y1; y++) for (let x = 3; x <= 12; x++) {
            const edge = y === y0 || y === y1 || x === 3 || x === 12;
            set(x, y, mul(base, edge ? 0.7 : 1.08));
          }
          set(13, 8, [242, 201, 76]); set(13, 7, [224, 163, 0]);
        }
        break;
      }
      case 'button': {
        // a steel panel with a round red button
        fill(hex('#9AA0A6'), 0.05);
        for (let i = 0; i < S; i++) { set(i, 0, [110, 116, 122]); set(i, S - 1, [110, 116, 122]); set(0, i, [110, 116, 122]); set(S - 1, i, [110, 116, 122]); }
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          if (d < 4.2) set(x, y, d < 2 ? [255, 130, 120] : hex('#E8484A'));
          else if (d < 5) set(x, y, [70, 74, 80]);
        }
        break;
      }
      case 'lever': case 'leverOn': {
        // a cobblestone base and a handle: off — tilted left, on — right, with a green knob
        const on = b.key === 'leverOn';
        fill(hex('#8A8F95'), 0.14);
        if (face !== 'bottom') for (let i = 0; i < 9; i++) {
          const x = Math.round(7.5 + (on ? 1 : -1) * i * 0.45), y = 13 - i;
          set(x, y, [111, 82, 56]); set(x + 1, y, [139, 106, 78]);
          if (i === 8) for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [1, -1]]         ) set(x + dx, y + dy - 1, on ? [39, 174, 96] : [206, 40, 40]);
        }
        break;
      }
      case 'chair': {
        // a chair: on top a red cushion with piping, on the sides wooden legs and the seat
        if (face === 'top') {
          fill(base, 0.06);
          for (let i = 0; i < S; i++) { set(i, 0, mul(base, 0.75)); set(i, S - 1, mul(base, 0.75)); set(0, i, mul(base, 0.75)); set(S - 1, i, mul(base, 0.75)); }
          for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]         ) set(x, y, mul(base, 0.8));
        } else {
          fill(mul(hex('#8B6A4E'), 0.55), 0.05);                                // between the legs — the shadow under the seat
          for (let y = 0; y < 5; y++) for (let x = 0; x < S; x++) set(x, y, y < 3 ? hex(b.top) : side);   // seat with a cushion
          for (let y = 5; y < S; y++) for (const x of [1, 2, 13, 14]) set(x, y, mul(side, 0.8));   // legs
        }
        break;
      }
      /* ---------------------------------- kitchen ---------------------------------- */
      case 'stove': {
        if (face === 'top') {
          // glass-ceramic: four ring burners and a highlight
          fill(base, 0.04);
          for (const [cx, cy] of [[4, 4], [11, 4], [4, 11], [11, 11]]         ) for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
            const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);
            if (d > 1.9 && d < 3.1) set(x, y, [96, 90, 104]); else if (d <= 1.1) set(x, y, [74, 68, 80]);
          }
          for (let i = 0; i < 4; i++) set(13 - i, 1 + i, [88, 84, 96]);
          for (let i = 0; i < S; i++) { set(i, 0, [22, 20, 26]); set(i, S - 1, [22, 20, 26]); set(0, i, [22, 20, 26]); set(S - 1, i, [22, 20, 26]); }
        } else {
          // steel: the hob edge, control knobs, an oven door with glass and a handle
          fill(side, 0.03);
          for (let x = 0; x < S; x++) { set(x, 0, hex(b.top)); set(x, 1, mul(side, 0.8)); set(x, S - 1, mul(side, 0.55)); }
          if (face === 'side') {
            for (const x of [2, 6, 9, 13]) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]         ) set(x - 1 + dx, 2 + dy + 1, dx + dy === 0 ? [96, 100, 108] : [58, 60, 66]);
            for (let y = 6; y <= 14; y++) for (let x = 1; x <= 14; x++) set(x, y, mul(side, y === 6 || y === 14 || x === 1 || x === 14 ? 0.78 : 0.94));
            for (let x = 4; x <= 11; x++) set(x, 7, [150, 156, 166]);                                  // handle
            for (let y = 9; y <= 12; y++) for (let x = 3; x <= 12; x++) set(x, y, y === 9 ? [70, 64, 72] : [44, 40, 48]);   // oven glass
            set(4, 10, [242, 153, 74]); set(5, 10, [242, 153, 74]);                                     // a flame inside
          }
        }
        break;
      }
      case 'fridge': {
        // a white fridge: freezer seam, two handles, feet; a grille on top
        fill(base, 0.03);
        for (let i = 0; i < S; i++) { set(i, 0, mul(base, 0.9)); set(0, i, mul(base, 0.92)); set(S - 1, i, mul(base, 0.88)); }
        if (face === 'top') for (let y = 5; y <= 10; y += 2) for (let x = 3; x <= 12; x++) set(x, y, mul(base, 0.82));
        else if (face === 'side') {
          for (let x = 1; x < S - 1; x++) set(x, 5, mul(base, 0.72));
          for (const [y0, y1] of [[1, 3], [7, 12]]         ) for (let y = y0; y <= y1; y++) { set(12, y, [168, 174, 184]); set(13, y, [140, 146, 156]); }
          for (let x = 0; x < S; x++) set(x, S - 1, x < 2 || x > 13 ? [90, 94, 100] : mul(base, 0.7));
        }
        break;
      }
      case 'sink': case 'counter': {
        if (face === 'top') {
          // a stone-look worktop: small specks
          fill(top, 0.04);
          for (let i = 0; i < 22; i++) set(r() * S | 0, r() * S | 0, mul(top, r() < 0.5 ? 0.86 : 1.06));
          for (let i = 0; i < S; i++) { set(i, 0, mul(top, 0.9)); set(i, S - 1, mul(top, 0.9)); set(0, i, mul(top, 0.9)); set(S - 1, i, mul(top, 0.9)); }
          if (b.key === 'sink') {
            // a steel sink with a drain and a tap at the far edge
            for (let y = 5; y <= 13; y++) for (let x = 3; x <= 12; x++) set(x, y, y === 5 || y === 13 || x === 3 || x === 12 ? [150, 156, 166] : [196, 202, 210]);
            for (const [x, y] of [[7, 9], [8, 9], [7, 10], [8, 10]]         ) set(x, y, [108, 114, 124]);
            for (let y = 1; y <= 5; y++) { set(7, y, [166, 172, 182]); set(8, y, [140, 146, 156]); }
            set(6, 2, [120, 126, 136]); set(9, 2, [120, 126, 136]);
          }
        } else {
          // a cabinet: worktop edge, two doors with handles, a plinth
          fill(side, 0.04);
          for (let x = 0; x < S; x++) { set(x, 0, top); set(x, 1, mul(top, 0.8)); set(x, S - 1, mul(side, 0.55)); }
          if (face === 'side') for (const [x0, x1] of [[1, 7], [8, 14]]                           ) for (let y = 3; y <= 13; y++) for (let x = x0; x <= x1; x++) {
            set(x, y, mul(side, y === 3 || y === 13 || x === x0 || x === x1 ? 0.8 : 1.04));
          }
          if (face === 'side') for (const x of [6, 9]) for (let y = 5; y <= 7; y++) set(x, y, [214, 218, 224]);
        }
        break;
      }
      case 'wallCabinet': {
        // a wall cabinet: two doors, handles at the bottom (easy to pull down)
        fill(base, 0.04);
        for (let i = 0; i < S; i++) { set(i, 0, mul(base, 0.8)); set(i, S - 1, mul(base, 0.8)); set(0, i, mul(base, 0.85)); set(S - 1, i, mul(base, 0.85)); }
        if (face === 'side') {
          for (let y = 1; y < S - 1; y++) set(7, y, mul(side, 0.72));
          for (const x of [5, 10]) for (let y = 11; y <= 13; y++) set(x, y, [214, 218, 224]);
        }
        break;
      }
      case 'table': {
        if (face === 'top') { wood(top); for (let i = 0; i < S; i++) { set(i, 0, mul(top, 0.8)); set(i, S - 1, mul(top, 0.8)); set(0, i, mul(top, 0.8)); set(S - 1, i, mul(top, 0.8)); } }
        else {
          // side view: a thick tabletop, shadow under it and legs at the edges (like the chair)
          fill(mul(hex('#8B6A4E'), 0.5), 0.05);
          if (face === 'side') {
            for (let y = 0; y < 3; y++) for (let x = 0; x < S; x++) set(x, y, y === 2 ? mul(top, 0.72) : mul(top, 0.95));
            for (let x = 2; x < S - 2; x++) set(x, 3, mul(side, 0.8));
            for (let y = 3; y < S; y++) for (const x of [1, 2, 13, 14]) set(x, y, mul(side, x === 2 || x === 14 ? 0.82 : 1));
          } else for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2], [13, 1], [14, 1], [13, 2], [14, 2], [1, 13], [2, 13], [1, 14], [2, 14], [13, 13], [14, 13], [13, 14], [14, 14]]         ) set(x, y, side);
        }
        break;
      }
      case 'tiles': {
        // 4 × 4 tiles with grey seams; a couple of tiles slightly bluer
        fill(base, 0.02);
        for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) if (r() < 0.18) for (let y = ty * 4; y < ty * 4 + 3; y++) for (let x = tx * 4; x < tx * 4 + 3; x++) set(x, y, [226, 238, 250]);
        for (let i = 0; i < S; i++) for (const k of [3, 7, 11, 15]) { set(i, k, [200, 205, 212]); set(k, i, [200, 205, 212]); }
        break;
      }
      case 'asphalt': case 'roadWhite': case 'roadYellow': {
        // asphalt: dark grit; road markings are paint on top, asphalt on the sides
        if (face !== 'top' || b.key === 'asphalt') { fill(base, 0.1); for (let i = 0; i < 22; i++) set(r() * S | 0, r() * S | 0, mul(base, r() < 0.5 ? 0.8 : 1.18)); }
        else { fill(base, 0.04); for (let i = 0; i < 10; i++) set(r() * S | 0, r() * S | 0, mul(base, 0.86)); }
        break;
      }
      case 'bikeLane': {
        // bike lane: red grit, a white stripe along the edges (joins lengthwise)
        fill(base, 0.08); for (let i = 0; i < 16; i++) set(r() * S | 0, r() * S | 0, mul(base, r() < 0.5 ? 0.85 : 1.12));
        if (face === 'top') for (let i = 0; i < S; i++) { set(i, 0, [236, 232, 226]); set(0, i, [236, 232, 226]); }
        break;
      }
      case 'sidewalk': {
        // 8 × 8 paving slabs with seams
        fill(base, 0.05);
        for (let i = 0; i < S; i++) for (const k of [7, 15]) { set(i, k, mul(base, 0.78)); set(k, i, mul(base, 0.78)); }
        break;
      }
      case 'checker': {
        // 8 × 8 checkerboard: on any face, joins with neighboring blocks
        const dark = hex(b.top), light = hex(b.side);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const c = ((x >> 3) + (y >> 3)) % 2 ? dark : light;
          set(x, y, mul(c, 0.97 + r() * 0.05));
        }
        break;
      }
      case 'lift': {
        // on top a steel plate with "up / down" arrows, on the sides lift doors with a seam in the middle
        fill(base, 0.05);
        for (let i = 0; i < S; i++) { set(i, 0, mul(base, 0.8)); set(i, S - 1, mul(base, 0.8)); set(0, i, mul(base, 0.8)); set(S - 1, i, mul(base, 0.8)); }
        if (face === 'top') {
          const ink      = [255, 255, 255];
          for (let k = 0; k < 4; k++) for (let x = 7 - k; x <= 8 + k; x++) { set(x, 2 + k, ink); set(x, 13 - k, ink); }   // arrows
        } else for (let y = 1; y < S - 1; y++) { set(7, y, mul(base, 0.62)); set(8, y, mul(base, 1.12)); }
        break;
      }
      case 'sandstoneBricks': {
        // big sandstone blocks: 2×2 per tile, light top edge and dark seams like a desert wall
        fill(base, 0.06);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const bx = (x + (y >= 8 ? 4 : 0)) % 8, by = y % 8;
          if (bx === 7 || by === 7) set(x, y, mul(base, 0.72)); else if (by === 0 || bx === 0) set(x, y, mul(base, 1.1));
        }
        break;
      }
      case 'shutter': {
        // a steel roller shutter: horizontal slats, a dark frame and a handle at the bottom
        fill(base, 0.04);
        if (face !== 'top') {
          for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (y % 3 === 2) set(x, y, mul(base, 0.75));
          for (let i = 0; i < S; i++) { set(0, i, mul(base, 0.55)); set(S - 1, i, mul(base, 0.55)); set(i, 0, mul(base, 0.55)); }
          for (let x = 6; x <= 9; x++) set(x, 13, [60, 64, 70]);
        }
        break;
      }
      case 'windowFrame': {
        // a white frame with a cross and bluish glass (the glass is see-through)
        fill(hex(b.side), 0.03, 110);
        const fr = hex(b.top);
        for (let i = 0; i < S; i++) { set(i, 0, fr); set(i, 1, fr); set(i, S - 1, fr); set(i, S - 2, fr); set(0, i, fr); set(1, i, fr); set(S - 1, i, fr); set(S - 2, i, fr); set(7, i, fr); set(8, i, fr); set(i, 7, fr); set(i, 8, fr); }
        for (let i = 0; i < 3; i++) { set(3 + i, 5 - i, [255, 255, 255], 200); set(11 + i, 13 - i, [255, 255, 255], 170); }
        break;
      }
      case 'crate': {
        // a wooden crate: plank frame and a diagonal brace
        wood(base);
        for (let i = 0; i < S; i++) { set(i, 0, mul(base, 0.6)); set(i, S - 1, mul(base, 0.6)); set(0, i, mul(base, 0.6)); set(S - 1, i, mul(base, 0.6)); set(i, 1, mul(base, 0.85)); set(1, i, mul(base, 0.85)); }
        for (let i = 2; i < S - 2; i++) { set(i, i, mul(base, 0.68)); set(i + 1, i, mul(base, 0.8)); }
        break;
      }
      case 'metal': {
        // a steel plate with rivets in the corners and a soft highlight
        fill(base, 0.04);
        for (let i = 0; i < S; i++) { set(i, 0, mul(base, 1.15)); set(0, i, mul(base, 1.12)); set(i, S - 1, mul(base, 0.7)); set(S - 1, i, mul(base, 0.72)); }
        for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]         ) { set(x, y, mul(base, 0.6)); set(x, y - 1, mul(base, 1.25)); }
        for (let i = 0; i < 5; i++) set(4 + i, 4, mul(base, 1.2));
        break;
      }
      case 'glowCube': {
        // a glowing cube: a bright core, a darker frame and a light ring (like the blaster cube in the reference)
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)), r = Math.hypot(x - 7.5, y - 7.5);
          set(x, y, d > 6.5 ? mul(base, 0.45) : r < 3.2 ? [240, 255, 255] : r < 4.6 ? mul(top, 1.15) : mul(base, 0.85));
        }
        break;
      }
      case 'question': {
        // a purple tile with a white "?"
        fill(base, 0.06);
        for (let i = 0; i < S; i++) { set(i, 0, mul(base, 0.75)); set(i, S - 1, mul(base, 0.75)); set(0, i, mul(base, 0.75)); set(S - 1, i, mul(base, 0.75)); }
        const Q = ['.####.', '##..##', '....##', '...##.', '..##..', '..##..', '......', '..##..'];
        Q.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') set(x + 5, y + 4, [255, 255, 255]); }));
        break;
      }
      default: {
        // colored blocks (like wool): soft noise and a barely visible "weave"
        fill(base, 0.08);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if ((x + y) % 4 === 0 && r() < 0.5) set(x, y, mul(base, 0.92));
      }
    }
  }

  for (const b of blocks) {
    if (!b.id) continue;
    for (const face of ['top', 'side', 'bottom']         ) {
      const tile = b.id * 3 + (face === 'top' ? 0 : face === 'side' ? 1 : 2), ox = (tile % cols) * T, oy = Math.floor(tile / cols) * T;
      const r = rng(b.id * 131 + (face === 'top' ? 7 : face === 'side' ? 13 : 29));
      const set = (x        , y        , c     , a = 255) => {
        x = Math.floor(x); y = Math.floor(y);
        if (x < 0 || y < 0 || x >= T || y >= T) return;
        const i = ((oy + y) * width + ox + x) * 4;
        d[i] = Math.min(255, Math.max(0, c[0])); d[i + 1] = Math.min(255, Math.max(0, c[1])); d[i + 2] = Math.min(255, Math.max(0, c[2])); d[i + 3] = a;
      };
      const fill = (c     , amp        , a = 255) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set(x, y, mul(c, 1 + (r() - 0.5) * amp), a); };
      paint({ set, fill, r }, b, face);
    }
  }
};
    var BLOCK_BY = {}; BLOCK_DEFS.forEach(function (b) { BLOCK_BY[b.key] = b; BLOCK_BY[String(b.id)] = b; });
    UB.blocks = BLOCK_DEFS.filter(function (b) { return b.id; }).map(function (b) { return b.key; });
    // colors of a block (for maps and HUD): { top, side } or null
    UB.blockColor = function (key) { var b = BLOCK_BY[String(key)]; return b && b.id ? { top: b.top, side: b.side } : null; };
    var ATL_C = 16, ATL_T = 16, ATL_R = Math.ceil(BLOCK_DEFS.length * 3 / 16), blockAtlas;
    // atlas: tile 0 ("air" has none) is white: plain colored cubes in the same mesh are tinted through it
    var getAtlas = function () {
      if (blockAtlas !== undefined) return blockAtlas;
      blockAtlas = null;
      var cv = document.createElement('canvas'); cv.width = ATL_C * ATL_T; cv.height = ATL_R * ATL_T;
      var g2 = cv.getContext && cv.getContext('2d'), img = g2 && g2.createImageData && g2.createImageData(cv.width, cv.height);
      if (!img || !img.data) return null;
      paintBlockTiles(BLOCK_DEFS, ATL_C, ATL_T, img.data, cv.width);
      for (var y = 0; y < ATL_T; y++) for (var x = 0; x < ATL_T; x++) { var k = (y * cv.width + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = img.data[k + 3] = 255; }
      g2.putImageData(img, 0, 0);
      var tex = new T.CanvasTexture(cv); tex.magFilter = T.NearestFilter; tex.minFilter = T.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = T.SRGBColorSpace;
      blockAtlas = { canvas: cv, tex: tex };
      return blockAtlas;
    };
    var tileUV = function (tile, u, v) {
      var col = tile % ATL_C, row = Math.floor(tile / ATL_C), E = 0.01, uu = E + u * (1 - 2 * E), vv = E + v * (1 - 2 * E);
      return [(col + uu) / ATL_C, 1 - (row + 1 - vv) / ATL_R];
    };
    // a texture of one block tile for boxes of any size (repeats, doesn't stretch)
    var tileTex = {};
    var blockTileTex = function (b, face, rx, ry) {
      var key = b.id + ':' + face + ':' + rx + ':' + ry; if (tileTex[key]) return tileTex[key];
      var A = getAtlas(); if (!A) return null;
      var base = tileTex[b.id + ':' + face];
      if (!base) {
        var t = b.id * 3 + (face === 'top' ? 0 : face === 'side' ? 1 : 2), c = document.createElement('canvas'); c.width = c.height = ATL_T;
        c.getContext('2d').drawImage(A.canvas, (t % ATL_C) * ATL_T, Math.floor(t / ATL_C) * ATL_T, ATL_T, ATL_T, 0, 0, ATL_T, ATL_T);
        base = tileTex[b.id + ':' + face] = new T.CanvasTexture(c); base.magFilter = T.NearestFilter; base.minFilter = T.NearestFilter; base.generateMipmaps = false; base.colorSpace = T.SRGBColorSpace;
        base.wrapS = base.wrapT = T.RepeatWrapping;
      }
      var tx = base.clone(); tx.repeat.set(rx, ry); tx.needsUpdate = true; tileTex[key] = tx; return tx;
    };
    var blockBoxMats = function (b, w, h, d) {
      var mk = function (face, rx, ry) { var m = new T.MeshLambertMaterial({ map: blockTileTex(b, face, Math.max(1, Math.round(rx)), Math.max(1, Math.round(ry))), transparent: !!b.clear, opacity: 1, alphaTest: b.clear ? 0 : 0.5 }); if (b.glow) m.emissive = color(b.top).multiplyScalar(0.6); return m; };
      return [mk('side', d, h), mk('side', d, h), mk('top', w, d), mk('bottom', w, d), mk('side', w, h), mk('side', w, h)];   // +x −x +y −y +z −z
    };
    UB.voxels3d = function (list, o) {
      if (!scene) throw new Error('call UB.create3d first');
      o = o || {}; var size = o.size || 1, n = Math.min(list.length, 60000), hs = size / 2, i;
      // Grid: cubes on one lattice (step = size) hide each other's faces — only open faces are drawn. An off-lattice cube is drawn whole.
      // The world is cut into 16×16 chunks: chunks off screen aren't drawn. World blocks (b: 'grass') use the world textures, plants are
      // crossed quads, glass / ice / water are transparent, lamps and torches glow; soft shadows in corners (ambient occlusion).
      var x0 = n ? list[0].x : 0, y0 = n ? list[0].y : 0, z0 = n ? list[0].z : 0, grid = {}, cells = new Array(n), defs = new Array(n), textured = false;
      for (i = 0; i < n; i++) {
        var v = list[i], df = v.b != null ? BLOCK_BY[String(v.b)] || null : null; if (df && !df.id) df = null;
        defs[i] = df; if (df) textured = true;
        var gx = (v.x - x0) / size, gy = (v.y - y0) / size, gz = (v.z - z0) / size, rx = Math.round(gx), ry = Math.round(gy), rz = Math.round(gz);
        if (Math.abs(gx - rx) < 0.01 && Math.abs(gy - ry) < 0.01 && Math.abs(gz - rz) < 0.01) {
          cells[i] = [rx, ry, rz];
          if (!(df && (df.cross || df.boxes))) grid[rx + ',' + ry + ',' + rz] = df && df.clear ? 1000 + df.id : 1;   // 1 — an opaque cube (slabs and stairs hide nothing)
        }
      }
      var A = textured ? getAtlas() : null;
      var opq = function (x, y, z) { return grid[x + ',' + y + ',' + z] === 1 ? 1 : 0; };
      var FACES = [[1, 0, 0, 0, 1, 0, 0, 0, 1], [-1, 0, 0, 0, 0, 1, 0, 1, 0], [0, 1, 0, 0, 0, 1, 1, 0, 0], [0, -1, 0, 1, 0, 0, 0, 0, 1], [0, 0, 1, 1, 0, 0, 0, 1, 0], [0, 0, -1, 0, 1, 0, 1, 0, 0]];
      var AOV = [0.42, 0.62, 0.8, 1];
      var chunks = {}, col = new T.Color(), CH = 16 * size;
      var bufOf = function (w, kind) {
        var key = Math.floor((w.x - x0) / CH) + ',' + Math.floor((w.z - z0) / CH) + ':' + kind;
        return chunks[key] || (chunks[key] = { kind: kind, p: [], nm: [], c: [], uv: [], ix: [] });
      };
      var quad = function (bf, pts, nrm, cols, uvs, flip) {
        var base = bf.p.length / 3;
        for (var q = 0; q < 4; q++) { bf.p.push(pts[q][0], pts[q][1], pts[q][2]); bf.nm.push(nrm[0], nrm[1], nrm[2]); bf.c.push(cols[q][0], cols[q][1], cols[q][2]); bf.uv.push(uvs[q][0], uvs[q][1]); }
        if (flip) bf.ix.push(base + 1, base + 2, base + 3, base + 1, base + 3, base); else bf.ix.push(base, base + 1, base + 2, base, base + 2, base + 3);
      };
      var white = A ? tileUV(0, 0.5, 0.5) : [0, 0];
      for (i = 0; i < n; i++) {
        var w = list[i], c = cells[i], df2 = defs[i];
        var jit = 1 + (((i * 73856093) ^ (i * 19349663)) & 7) / 160 - 0.02;
        if (df2) col.setRGB(jit, jit, jit); else { col.set(w.c || '#cccccc'); if (o.jitter !== false) col.offsetHSL(0, 0, (((i * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.07); }
        if (df2 && df2.cross) {
          // a plant: two crossed pictures (visible from both sides)
          var bfc = bufOf(w, df2.glow ? 'glow' : 'cutout'), a = 0.35 * size, t1 = df2.id * 3 + 1, cc = [col.r, col.g, col.b];
          // each picture is two faces (front and back), both lit like a block top: otherwise the back side would be dark
          [[-a, -a, a, a], [a, -a, -a, a], [a, a, -a, -a], [-a, a, a, -a]].forEach(function (d4) {
            quad(bfc, [[w.x + d4[0], w.y - hs, w.z + d4[1]], [w.x + d4[2], w.y - hs, w.z + d4[3]], [w.x + d4[2], w.y + hs, w.z + d4[3]], [w.x + d4[0], w.y + hs, w.z + d4[1]]],
              [0, 1, 0], [cc, cc, cc, cc], [tileUV(t1, 0, 0), tileUV(t1, 1, 0), tileUV(t1, 1, 1), tileUV(t1, 0, 1)], false);
          });
          continue;
        }
        if (df2 && df2.boxes) {
          // a slab or stairs: each part is its own box; a face on the cell edge next to an opaque cube is hidden, and so is
          // the bottom face of the upper part (it lies inside the lower one); the tile is cropped to the part's size
          var bfs = bufOf(w, 'opaque'), cs = [col.r, col.g, col.b];
          df2.boxes.forEach(function (bx) {
            FACES.forEach(function (F2) {
              if (F2[1] < 0 && bx[1] > 0) return;
              var lo = [bx[0], bx[1], bx[2]], hi = [bx[3], bx[4], bx[5]], ax = F2[0] ? 0 : F2[1] ? 1 : 2, sgn = F2[ax];
              if (c && (sgn > 0 ? hi[ax] === 1 : lo[ax] === 0) && grid[(c[0] + F2[0]) + ',' + (c[1] + F2[1]) + ',' + (c[2] + F2[2])] === 1) return;
              var pts2 = [], uvs2 = [], tile2 = df2.id * 3 + (F2[1] > 0 ? 0 : F2[1] < 0 ? 2 : 1);
              for (var q2 = 0; q2 < 4; q2++) {
                var su2 = q2 === 1 || q2 === 2 ? 1 : -1, sv2 = q2 >= 2 ? 1 : -1, lc = [0, 0, 0];
                for (var k3 = 0; k3 < 3; k3++) { var dirv = F2[k3] + su2 * F2[3 + k3] + sv2 * F2[6 + k3]; lc[k3] = dirv > 0 ? hi[k3] : lo[k3]; }
                pts2.push([w.x + (lc[0] - 0.5) * size, w.y + (lc[1] - 0.5) * size, w.z + (lc[2] - 0.5) * size]);
                var uu2 = F2[0] > 0 ? 1 - lc[2] : F2[0] < 0 ? lc[2] : F2[2] > 0 ? lc[0] : F2[2] < 0 ? 1 - lc[0] : lc[0], vv3 = F2[1] !== 0 ? 1 - lc[2] : lc[1];
                uvs2.push(tileUV(tile2, uu2, vv3));
              }
              quad(bfs, pts2, [F2[0], F2[1], F2[2]], [cs, cs, cs, cs], uvs2, false);
            });
          });
          continue;
        }
        var kind = df2 && df2.clear ? 'clear' : df2 && df2.glow ? 'glow' : 'opaque';
        for (var f = 0; f < 6; f++) {
          var F = FACES[f];
          if (c) {
            var nb = grid[(c[0] + F[0]) + ',' + (c[1] + F[1]) + ',' + (c[2] + F[2])];
            if (nb === 1) continue;                                   // the neighbor is an opaque cube
            if (kind === 'clear' && nb === 1000 + df2.id) continue;   // no faces between the same glass / water
          }
          var pts = [], cols = [], uvs = [], ao = [];
          var tile = df2 ? df2.id * 3 + (F[1] > 0 ? 0 : F[1] < 0 ? 2 : 1) : 0;
          for (var q = 0; q < 4; q++) {
            var su = q === 1 || q === 2 ? 1 : -1, sv = q >= 2 ? 1 : -1;
            var px = w.x + hs * (F[0] + su * F[3] + sv * F[6]), py = w.y + hs * (F[1] + su * F[4] + sv * F[7]), pz = w.z + hs * (F[2] + su * F[5] + sv * F[8]);
            pts.push([px, py, pz]);
            var k2 = 3;
            if (c && kind === 'opaque') {   // soft corner shadow: neighbors on both sides and diagonally in the layer in front of the face
              var ox = c[0] + F[0], oy = c[1] + F[1], oz = c[2] + F[2];
              var s1 = opq(ox + su * F[3], oy + su * F[4], oz + su * F[5]), s2 = opq(ox + sv * F[6], oy + sv * F[7], oz + sv * F[8]);
              var cn = opq(ox + su * F[3] + sv * F[6], oy + su * F[4] + sv * F[7], oz + su * F[5] + sv * F[8]);
              k2 = s1 && s2 ? 0 : 3 - s1 - s2 - cn;
            }
            ao.push(k2); var sh = AOV[k2]; cols.push([col.r * sh, col.g * sh, col.b * sh]);
            if (!df2) { uvs.push(white); continue; }
            // tile coordinates: on side faces the tile's "up" is up (+y), on top and bottom along x / z
            var cx = (px - w.x) / size + 0.5, cy = (py - w.y) / size + 0.5, cz = (pz - w.z) / size + 0.5;
            var uu = F[0] > 0 ? 1 - cz : F[0] < 0 ? cz : F[2] > 0 ? cx : F[2] < 0 ? 1 - cx : cx, vv2 = F[1] !== 0 ? 1 - cz : cy;
            uvs.push(tileUV(tile, uu, vv2));
          }
          quad(bufOf(w, kind), pts, [F[0], F[1], F[2]], cols, uvs, ao[0] + ao[2] < ao[1] + ao[3]);
        }
      }
      var grp = new T.Group(), mats = {}, geos = [], map = A ? A.tex : null;
      var matOf = function (kind) {
        if (mats[kind]) return mats[kind];
        var opt = { vertexColors: true }; if (map) opt.map = map;
        if (kind === 'glow') { opt.alphaTest = 0.5; return (mats[kind] = new T.MeshBasicMaterial(opt)); }
        if (kind === 'cutout') opt.alphaTest = 0.5;
        if (kind === 'clear') { opt.transparent = true; opt.depthWrite = false; }
        return (mats[kind] = new T.MeshLambertMaterial(opt));
      };
      Object.keys(chunks).forEach(function (k) {
        var ck = chunks[k]; if (!ck.ix.length) return;
        var geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(ck.p, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(ck.nm, 3));
        geo.setAttribute('color', new T.Float32BufferAttribute(ck.c, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(ck.uv, 2));
        geo.setIndex(ck.p.length / 3 > 65000 ? new T.Uint32BufferAttribute(ck.ix, 1) : ck.ix);
        geo.computeBoundingSphere();
        var m = new T.Mesh(geo, matOf(ck.kind));
        m.castShadow = o.shadow !== false && ck.kind !== 'clear' && ck.kind !== 'cutout'; m.receiveShadow = true; if (ck.kind === 'clear') m.renderOrder = 1;
        grp.add(m); geos.push(geo);
      });
      scene.add(grp);
      // physics gets only solid ones (water, flowers and torches are walk-through)
      // slabs and stairs: their parts instead of the whole cell (cells[key] = the box list; plain solid cubes = 1)
      var solidList = [], solidCells = {}, shapeList = [];
      for (i = 0; i < n; i++) if (!defs[i] || (defs[i].solid && !defs[i].cross)) {
        if (defs[i] && defs[i].boxes) { shapeList.push({ x: list[i].x, y: list[i].y, z: list[i].z, boxes: defs[i].boxes }); if (cells[i]) solidCells[cells[i].join(',')] = defs[i].boxes; continue; }
        solidList.push(list[i]); if (cells[i]) solidCells[cells[i].join(',')] = 1;
      }
      var h = { mesh: grp, solid: !!o.solid, list: solidList, shapes: shapeList, cells: solidCells, o: [x0, y0, z0], size: size, col: null, cols: [],
        remove: function () { if (h.col && pw) pw.removeCollider(h.col, true); if (pw) h.cols.forEach(function (c2) { pw.removeCollider(c2, true); }); h.col = null; h.cols = []; scene.remove(grp); geos.forEach(function (g3) { g3.dispose(); }); Object.keys(mats).forEach(function (k) { mats[k].dispose(); }); var k = vox.indexOf(h); if (k >= 0) vox.splice(k, 1); } };
      vox.push(h); if (pw && h.solid) voxCollider(h); return h;
    };
    UB.clear3d = function () { ents.slice().forEach(function (e) { if (!e.ground) e.remove(); }); vox.slice().forEach(function (v) { v.remove(); }); players.forEach(unplayer); players = []; fx.forEach(function (f) { scene.remove(f.m); }); fx = []; effects.slice().forEach(function (f) { f.remove(); }); loops.slice().forEach(function (l) { l.stop(); }); };
    UB.hit3d = function (a, b) { return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h && Math.abs(a.z - b.z) * 2 < a.d + b.d; };
    UB.dist3d = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); };
    UB.camera3d = function (o) {
      var keep = cam && cam.mode === 'first' ? { yaw: cam.yaw, pitch: cam.pitch } : {};
      cam = Object.assign({ mode: 'follow', distance: 9, height: 5 }, o || {});
      if (cam.mode === 'first') { if (cam.yaw == null) cam.yaw = keep.yaw || 0; if (cam.pitch == null) cam.pitch = keep.pitch || 0; lookInput(); }
    };
    // First person: the mouse (pointer lock on click) or a finger on the right half of the screen turns the view; arrows turn too.
    // cam.yaw = 0 looks toward −z (like the chase camera); UB.look = { yaw, pitch } — for the game (e.g. shoot where you look).
    var lookMade = false;
    var lookInput = function () {
      if (lookMade) return; lookMade = true;
      var turn = function (dx, dy) { if (!cam || cam.mode !== 'first') return; cam.yaw -= dx * 0.0032; cam.pitch = clamp((cam.pitch || 0) - dy * 0.0028, -1.2, 1.2); };
      canvas.addEventListener('click', function () { if (cam && cam.mode === 'first' && !touch && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} } });
      document.addEventListener('mousemove', function (ev) { if (document.pointerLockElement === canvas) turn(ev.movementX || 0, ev.movementY || 0); });
      var lp = null;
      canvas.addEventListener('pointerdown', function (ev) { if (ev.pointerType !== 'mouse' && ev.clientX > window.innerWidth * 0.45) lp = { id: ev.pointerId, x: ev.clientX, y: ev.clientY }; });
      window.addEventListener('pointermove', function (ev) { if (lp && ev.pointerId === lp.id) { turn((ev.clientX - lp.x) * 1.6, (ev.clientY - lp.y) * 1.6); lp.x = ev.clientX; lp.y = ev.clientY; } });
      var up = function (ev) { if (lp && ev.pointerId === lp.id) lp = null; }; window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    };
    UB.look = { yaw: 0, pitch: 0 };
    // camera field of view (degrees): scope zoom and the like
    UB.fov3d = function (deg) { if (camera && deg && Math.abs(camera.fov - deg) > 0.01) { camera.fov = deg; camera.updateProjectionMatrix(); } };
    // ==== Spatial sound: the "ears" (AudioListener) are on the hero (the camera target), turned like the camera; sources are PannerNodes ====
    // Ambient world sounds without files: a loop is synthesized on first use (noise + filters + clicks), joined without a click.
    var mkPanner = function (x, y, z, ref) {
      var p = ac.createPanner();
      p.panningModel = touch ? 'equalpower' : 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref || 3; p.maxDistance = 80; p.rolloffFactor = 1.3;
      setPos(p, x, y, z); return p;
    };
    var setPos = function (p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); };
    spatial = function (o) { var at = o.at || o; return mkPanner(at.x || 0, at.y == null ? 1 : at.y, at.z || 0, o.ref); };
    var LOOPS = {}, loops = [];
    var bake = function (kind) {
      if (LOOPS[kind]) return LOOPS[kind];
      var sr = ac.sampleRate, len = { wind: 4, waves: 6, birds: 4, engine: 1, hum: 1, magic: 2 }[kind] || 2, N = Math.floor(sr * len), F = Math.floor(sr * 0.08);
      var a = new Float32Array(N + F), i, b0 = 0, b1 = 0, br = 0, t;
      for (i = 0; i < N + F; i++) {
        var w = Math.random() * 2 - 1; t = i / sr;
        br = (br + 0.02 * w) / 1.02; b0 = 0.99 * b0 + w * 0.1; b1 = 0.9 * b1 + w * 0.3;   // brown, pinkish and soft noise
        if (kind === 'fire') a[i] = br * 2.2 + (Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : 0);
        else if (kind === 'water') a[i] = (b1 * 0.5 + w * 0.05) * (0.75 + 0.25 * Math.sin(t * 7 + Math.sin(t * 3) * 2));
        else if (kind === 'rain') a[i] = w * 0.22 + b1 * 0.15;
        else if (kind === 'wind') a[i] = br * 3 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 / len) * Math.sin(t * 1.7 + 1));
        else if (kind === 'waves') a[i] = (b0 * 0.9 + w * 0.04) * Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 2 / len * 1 - 1.5), 2);
        else if (kind === 'engine') a[i] = (((t * 55) % 1) * 2 - 1) * 0.3 + (((t * 110) % 1) * 2 - 1) * 0.12 + br * 0.8;
        else if (kind === 'hum') a[i] = Math.sin(t * Math.PI * 2 * 110) * 0.25 * (0.8 + 0.2 * Math.sin(t * Math.PI * 2 * 4)) + Math.sin(t * Math.PI * 2 * 220) * 0.08;
        else if (kind === 'magic') a[i] = [880, 1108.5, 1318.5, 1760].reduce(function (sum, f, k) { return sum + Math.sin(t * Math.PI * 2 * f) * 0.05 * (0.5 + 0.5 * Math.sin(t * Math.PI * (2 + k))); }, 0);
        else if (kind === 'birds') a[i] = 0;
        else a[i] = w * 0.1;
      }
      if (kind === 'birds') for (var c = 0; c < 9; c++) {   // birdsong: short whistles with a trill at random moments
        var st = Math.floor(Math.random() * (N - sr * 0.4)), f0 = 2200 + Math.random() * 1800, ph = 0;
        for (i = 0; i < sr * 0.25; i++) { t = i / sr; var f = f0 + Math.sin(t * 90) * 400 - t * 2000; ph += f / sr; a[st + i] += Math.sin(ph * Math.PI * 2) * 0.18 * Math.sin(Math.PI * t / 0.25); }
      }
      if (kind === 'fire') for (i = 1; i < N + F; i++) a[i] = a[i] * 0.6 + a[i - 1] * 0.4;   // softer crackle
      for (i = 0; i < F; i++) a[i] = a[i] * (i / F) + a[N + i] * (1 - i / F);   // loop without a click at the seam
      var buf = ac.createBuffer(1, N, sr); buf.getChannelData(0).set(a.subarray(0, N));
      return (LOOPS[kind] = buf);
    };
    // UB.sound3d('fire', { x, y, z | follow: e, volume }) — an ambient world sound (no x/z/follow — just background, e.g. rain)
    UB.sound3d = function (kind, o) {
      o = o || {};
      var h = { kind: kind, x: o.x || 0, y: o.y == null ? 1 : o.y, z: o.z || 0, follow: o.follow || null, vol: o.volume == null ? 1 : o.volume, src: null, gain: null, pan: null, dead: false,
        positional: o.follow != null || o.x != null || o.z != null };
      h.start = function () {
        if (h.src || h.dead || !ac || loops.filter(function (l) { return l.src; }).length >= 8) return;   // at most 8 loops at once
        h.src = ac.createBufferSource(); h.src.buffer = bake(kind); h.src.loop = true;
        h.gain = ac.createGain(); h.gain.gain.setValueAtTime(0, ac.currentTime); h.gain.gain.linearRampToValueAtTime(0.35 * h.vol, ac.currentTime + 0.4);
        h.src.connect(h.gain);
        if (h.positional) { h.pan = mkPanner(h.x, h.y, h.z, o.ref || 3); h.gain.connect(h.pan); h.pan.connect(ac.destination); } else h.gain.connect(ac.destination);
        h.src.start(ac.currentTime, Math.random() * h.src.buffer.duration);
      };
      h.volume = function (v) { h.vol = v; if (h.gain) h.gain.gain.setTargetAtTime(0.35 * v, ac.currentTime, 0.1); return h; };
      h.stop = function () {
        if (h.dead) return; h.dead = true; var k = loops.indexOf(h); if (k >= 0) loops.splice(k, 1);
        if (h.src) { var s0 = h.src, g0 = h.gain, p0 = h.pan; g0.gain.setTargetAtTime(0, ac.currentTime, 0.12); setTimeout(function () { try { s0.stop(); s0.disconnect(); g0.disconnect(); if (p0) p0.disconnect(); } catch (e) {} }, 800); }
      };
      h.remove = h.stop;
      loops.push(h); h.start(); return h;
    };
    // every frame: ears follow the hero, sources follow their objects; sound not yet allowed by the browser — loops start after the first tap
    var stepAudio = function () {
      if (!ac || !camera) return;
      var L = ac.listener, t = cam && cam.target, px = t ? t.x : camera.position.x, py = t ? t.y + 0.6 : camera.position.y, pz = t ? t.z : camera.position.z;
      var fw = new T.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      if (L.positionX) { L.positionX.value = px; L.positionY.value = py; L.positionZ.value = pz; L.forwardX.value = fw.x; L.forwardY.value = fw.y; L.forwardZ.value = fw.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
      else { L.setPosition(px, py, pz); L.setOrientation(fw.x, fw.y, fw.z, 0, 1, 0); }
      for (var i = 0; i < loops.length; i++) {
        var h = loops[i]; if (!h.src) h.start();
        if (h.follow) { if (ents.indexOf(h.follow) < 0 && h.follow.mesh) { h.stop(); i--; continue; } h.x = h.follow.x; h.y = h.follow.y; h.z = h.follow.z; }
        if (h.pan) setPos(h.pan, h.x, h.y, h.z);
      }
    };
    // ==== Batches of still objects (automatic): an object that stays put for 30 frames is drawn by a shared InstancedMesh
    // (one draw call for all such cubes / spheres / tree parts and so on); moved, hidden, recolored — it gets its own mesh back at once.
    // The engine draws it, not the game: the game notices nothing (e.x, e.visible, e.setColor work as before).
    var batches = {}, BATCH_UNIT = null;
    var batchFor = function (key, geo, srcMat) {
      var b = batches[key]; if (b && b.free.length) return b;
      var cap = b ? b.cap * 2 : 32, mat = b ? b.mesh.material : new T.MeshLambertMaterial({ color: 0xffffff, emissive: srcMat && srcMat.emissive ? srcMat.emissive.clone() : 0x000000 });
      var im = new T.InstancedMesh(b ? b.mesh.geometry : (geo.parameters && BATCH_UNIT && BATCH_UNIT.box === geo ? geo : geo.clone()), mat, cap), zero = new T.Matrix4().makeScale(0, 0, 0), c0 = new T.Color(1, 1, 1);
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      for (var i = 0; i < cap; i++) { im.setMatrixAt(i, zero); im.setColorAt(i, c0); }
      var nb = { key: key, mesh: im, cap: cap, free: [], occ: b ? b.occ.slice() : [] };
      if (b) { var m4 = new T.Matrix4(), cc = new T.Color(); for (i = 0; i < b.cap; i++) { b.mesh.getMatrixAt(i, m4); im.setMatrixAt(i, m4); b.mesh.getColorAt(i, cc); im.setColorAt(i, cc); } scene.remove(b.mesh); b.mesh.dispose(); }
      if (b) nb.free = b.free.slice();
      for (i = cap - 1; i >= (b ? b.cap : 0); i--) nb.free.push(i);
      nb.free.sort(function (x, y) { return y - x; });   // pop() gives the smallest: occupied slots stay at the start, only they are drawn (count)
      im.count = b ? b.mesh.count : 0;
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
      scene.add(im); batches[key] = nb; return nb;
    };
    var bM = null, bQ = null, bP = null, bS = null, bL = null;
    var canBatch = function (e) {
      if (e._isPlayer || e.shape === 'label' || e.shape === 'image' || e.shape === 'character' || e.shape === 'model' || e.noBatch) return false;
      if (e.shape === 'prefab') return true;
      var m = e.mesh, mt = m.material; return !!(m.isMesh && mt && !Array.isArray(mt) && !mt.transparent && !(mt.emissive && mt.emissive.getHex()) && !mt.map && m.children.length === 0);
    };
    var poseKey = function (e) { var q = e._q, s = e.mesh.scale; return e.x + ',' + e.y + ',' + e.z + ',' + (q ? q.x + ',' + q.y + ',' + q.z + ',' + q.w : e.rotY) + ',' + s.x + ',' + s.y + ',' + s.z; };
    var sleepE = function (e) {
      if (!bM) { bM = new T.Matrix4(); bQ = new T.Quaternion(); bP = new T.Vector3(); bS = new T.Vector3(); bL = new T.Matrix4(); }
      bP.set(e.x, e.y, e.z); if (e._q) bQ.set(e._q.x, e._q.y, e._q.z, e._q.w); else bQ.setFromAxisAngle(new T.Vector3(0, 1, 0), e.rotY || 0);
      var slots = [], parts = [];
      if (e.shape === 'prefab') { var k = 0; e.mesh.traverse(function (m) { if (m.isMesh) parts.push({ m: m, key: 'p:' + e._kind + ':' + (k++) }); }); }
      else parts.push({ m: e.mesh, key: 's:' + e.shape });
      for (var i = 0; i < parts.length; i++) {
        var m = parts[i].m, mt = m.material;
        if (!mt || mt.transparent || mt.map) return;   // this part doesn't belong in a batch — the object stays on its own
      }
      parts.forEach(function (pt) {
        var m = pt.m, mt = m.material, geo = m.geometry, key = pt.key;
        if (e.shape === 'prefab') {
          key += ':' + (mt.emissive ? mt.emissive.getHex() : 0);
          bS.copy(e.mesh.scale); bM.compose(bP, bQ, bS); m.updateMatrix(); bL.multiplyMatrices(bM, m.matrix);
        } else {
          // a unit shape stretched to the object's size: all cubes of any size and color are one batch
          var pr = geo.parameters || {}, sx, sy, sz;
          if (e.shape === 'sphere') { sx = sy = sz = (pr.radius || 0.5) * 2; } else if (e.shape === 'cylinder' || e.shape === 'cone') { sx = sz = (pr.radiusBottom || pr.radius || 0.5) * 2; sy = pr.height || 1; }
          else { sx = pr.width || 1; sy = pr.height || 1; sz = pr.depth || 1; }
          if (!BATCH_UNIT) BATCH_UNIT = { box: new T.BoxGeometry(1, 1, 1), sphere: new T.SphereGeometry(0.5, 20, 14), cylinder: new T.CylinderGeometry(0.5, 0.5, 1, 20), cone: new T.ConeGeometry(0.5, 1, 20) };
          geo = BATCH_UNIT[e.shape] || BATCH_UNIT.box;
          bS.set(sx * e.mesh.scale.x, sy * e.mesh.scale.y, sz * e.mesh.scale.z); bL.compose(bP, bQ, bS);
        }
        var b = batchFor(key, geo, mt), slot = b.free.pop(); b.occ[slot] = true; if (slot >= b.mesh.count) b.mesh.count = slot + 1;
        b.mesh.setMatrixAt(slot, bL); b.mesh.setColorAt(slot, mt.color || new T.Color(1, 1, 1));
        b.mesh.instanceMatrix.needsUpdate = true; b.mesh.instanceColor.needsUpdate = true;
        if (!m.castShadow) b.mesh.castShadow = b.mesh.castShadow;   // shadow per batch (almost everything casts one)
        slots.push({ key: key, slot: slot }); m.visible = false;
      });
      e._sleep = slots;
    };
    var wakeE = function (e) {
      var zero = new T.Matrix4().makeScale(0, 0, 0);
      (e._sleep || []).forEach(function (s) {
        var b = batches[s.key]; if (!b) return; b.mesh.setMatrixAt(s.slot, zero); b.mesh.instanceMatrix.needsUpdate = true; b.occ[s.slot] = false;
        b.free.push(s.slot); b.free.sort(function (x, y) { return y - x; });
        while (b.mesh.count > 0 && !b.occ[b.mesh.count - 1]) b.mesh.count--;
      });
      e._sleep = null; e._still = 0;
      if (e.shape === 'prefab') e.mesh.traverse(function (m) { if (m.isMesh) m.visible = true; }); else e.mesh.visible = e.visible;
    };
    var stepBatches = function () {
      for (var i = 0; i < ents.length; i++) {
        var e = ents[i]; if (e._batchOff) continue;
        if (e._canB == null) e._canB = canBatch(e);
        if (!e._canB) continue;
        var pk = e.visible ? poseKey(e) : null;
        if (pk !== e._pk) { e._pk = pk; e._still = 0; if (e._sleep) wakeE(e); continue; }
        if (!pk || e._sleep) continue;
        if (++e._still >= 30) sleepE(e);
      }
    };
    // ==== Particles and effects: one THREE.Points per effect (one draw call), motion computed here, point shape in the shader ====
    // Effects are visual only: updated in render3d (a hidden tab doesn't update them), they don't affect the game.
    var effects = [], fxTotal = 0;
    var PART_VS = 'attribute float aSize; attribute vec3 aColor; attribute float aAlpha; varying vec3 vC; varying float vA; uniform float uScale;' +
      'void main() { vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }';
    var PART_FS = 'varying vec3 vC; varying float vA; uniform int uKind; void main() { vec2 p = gl_PointCoord - 0.5; float d = length(p); float a;' +
      ' if (uKind == 1) a = smoothstep(0.1, 0.0, abs(p.x)) * smoothstep(0.5, 0.25, abs(p.y));' +   // raindrop — a streak
      ' else if (uKind == 2) a = smoothstep(0.5, 0.42, d) * smoothstep(0.28, 0.4, d) + smoothstep(0.2, 0.0, length(p + vec2(0.15, 0.15))) * 0.8;' +   // bubble — a ring with a highlight
      ' else if (uKind == 3) a = step(max(abs(p.x), abs(p.y) * 1.6), 0.42);' +   // confetti — a rectangle
      ' else a = smoothstep(0.5, 0.0, d);' +
      ' if (a * vA < 0.01) discard; gl_FragColor = vec4(vC, a * vA); }';
    var up = function (a, b, side) { return function (v) { v[0] = rand(-side, side); v[1] = rand(a, b); v[2] = rand(-side, side); }; };
    var sphere = function (a, b, lift) { return function (v) { var t = rand(0, Math.PI * 2), u = rand(-0.3, 1), s = rand(a, b), r = Math.sqrt(1 - u * u); v[0] = Math.cos(t) * r * s; v[1] = u * s + lift; v[2] = Math.sin(t) * r * s; }; };
    var still = function (v) { v[0] = v[1] = v[2] = 0; };
    var PRESETS = {
      fire: { loop: 'fire', add: true, rate: 70, life: [0.5, 1], size: [0.75, 0.15], alpha: [0.9, 0], colors: ['#fff3b0', '#ff9f1c', '#e63946'], gravity: -2.5, drag: 1.5, spread: 0.25, vel: up(1, 2.2, 0.3) },
      smoke: { rate: 12, life: [2, 3.2], size: [0.6, 2.4], alpha: [0.35, 0], colors: ['#9aa0a6', '#5f6368'], gravity: -0.4, drag: 0.6, spread: 0.3, vel: up(0.5, 1.1, 0.25) },
      sparks: { add: true, rate: 40, life: [0.35, 0.8], size: [0.18, 0.05], alpha: [1, 0], colors: ['#ffffff', '#ffd166', '#ff8c42'], gravity: 9, drag: 0.5, spread: 0.05, vel: sphere(3, 6, 2) },
      magic: { loop: 'magic', loopVol: 0.6, add: true, rate: 35, life: [0.8, 1.5], size: [0.28, 0], alpha: [1, 0], colors: ['#c77dff', '#7df9ff', '#ff70a6'], pick: true, gravity: -0.8, drag: 0.3, swirl: 2.2, spread: 0.6, vel: up(0.2, 0.7, 0.1) },
      confetti: { sfx: 'pop', kind: 3, once: 90, life: [1.6, 2.6], size: [0.22, 0.22], alpha: [1, 0.9], colors: ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#c77dff'], pick: true, gravity: 5, drag: 1.4, spread: 0.2, sway: 1.2, vel: sphere(4, 9, 6) },
      burst: { add: true, once: 24, life: [0.4, 0.9], size: [0.3, 0.05], alpha: [1, 0], colors: ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0'], pick: true, gravity: 12, drag: 0.4, spread: 0.1, vel: sphere(3, 7, 3) },
      explosion: { sfx: 'boom', add: true, once: 70, life: [0.35, 0.9], size: [1.1, 0.2], alpha: [1, 0], colors: ['#fff3b0', '#ff9f1c', '#e63946'], gravity: -1, drag: 2.5, spread: 0.3, vel: sphere(4, 11, 1), then: 'smokepuff' },
      smokepuff: { once: 22, life: [1.2, 2.2], size: [1, 3], alpha: [0.45, 0], colors: ['#8d8d8d', '#4a4a4a'], gravity: -0.6, drag: 1.5, spread: 0.6, vel: sphere(0.5, 2, 0.5) },
      snow: { rate: 140, area: 28, life: [8, 10], size: [0.14, 0.14], alpha: [0.95, 0.95], colors: ['#ffffff'], gravity: 0, drag: 0, sway: 0.6, vel: function (v) { v[0] = 0; v[1] = rand(-1.8, -1); v[2] = 0; } },
      rain: { loop: 'rain', loopVol: 0.7, kind: 1, rate: 420, area: 24, life: [1.1, 1.3], size: [0.5, 0.5], alpha: [0.55, 0.55], colors: ['#a8d8ff'], gravity: 0, drag: 0, vel: function (v) { v[0] = 0.6; v[1] = -18; v[2] = 0; } },
      bubbles: { kind: 2, rate: 8, life: [2.5, 4], size: [0.25, 0.4], alpha: [0.8, 0], colors: ['#bde0fe'], gravity: -0.6, drag: 0.8, sway: 0.5, spread: 0.3, vel: up(0.3, 0.6, 0.1) },
      dust: { once: 10, life: [0.5, 0.9], size: [0.3, 0.8], alpha: [0.5, 0], colors: ['#d4b483'], gravity: -0.3, drag: 3, spread: 0.3, vel: sphere(0.6, 1.6, 0.2) },
      sparkle: { add: true, rate: 12, life: [0.6, 1.2], size: [0.3, 0.3], twinkle: true, alpha: [1, 1], colors: ['#fff3b0', '#ffffff'], gravity: 0, drag: 0, spread: 0.8, vel: still },
      fountain: { loop: 'water', rate: 90, life: [1, 1.5], size: [0.2, 0.12], alpha: [0.85, 0.2], colors: ['#ffffff', '#4cc9f0'], gravity: 9, drag: 0.1, spread: 0.1, vel: function (v) { v[0] = rand(-0.8, 0.8); v[1] = rand(6, 8); v[2] = rand(-0.8, 0.8); } },
      trail: { add: true, rate: 60, life: [0.3, 0.5], size: [0.4, 0], alpha: [0.8, 0], colors: ['#7df9ff'], gravity: 0, drag: 0, spread: 0.08, vel: still },
    };
    UB.effect3d = function (name, o) {
      if (!scene) throw new Error('call UB.create3d first');
      o = o || {};
      var P = PRESETS[name] || PRESETS.sparks, sc = o.scale || 1;
      var lod = quality && !quality.shadows ? 0.6 : 1;   // slow device (shadows already off) — fewer particles
      var cols = (o.color ? [color(o.color).lerp(new T.Color(0xffffff), 0.45), color(o.color)] : P.colors.map(color));
      var pick = o.color ? (P.pick || false) : P.pick;
      if (o.color && (name === 'burst' || name === 'confetti')) { cols = [color(o.color)]; }
      var rate = (o.rate || P.rate || 0) * lod, once = P.once ? Math.round(Math.min(o.count || P.once, 200) * (lod < 1 ? 0.7 : 1)) : 0;
      var n = Math.max(1, Math.min(name === 'rain' ? 900 : 800, once || Math.ceil(rate * P.life[1] * 1.15)));
      if (fxTotal + n > 5000) n = Math.max(1, 5000 - fxTotal);
      fxTotal += n;
      var geo = new T.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
      geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('aColor', new T.BufferAttribute(col, 3));
      geo.setAttribute('aSize', new T.BufferAttribute(size, 1)); geo.setAttribute('aAlpha', new T.BufferAttribute(alpha, 1));
      var mat = new T.ShaderMaterial({ vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false,
        blending: P.add ? T.AdditiveBlending : T.NormalBlending, uniforms: { uScale: { value: 500 }, uKind: { value: P.kind || 0 } } });
      var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 2; scene.add(pts);
      var vel = new Float32Array(n * 3), age = new Float32Array(n), life = new Float32Array(n), seed = new Float32Array(n), pc = new Float32Array(n * 3), next = 0, acc = 0, v3 = [0, 0, 0];
      for (var i = 0; i < n; i++) { age[i] = 1; life[i] = 0; }
      var fx = { x: o.x || 0, y: o.y || 0, z: o.z || 0, follow: o.follow || null, on: true, name: name, points: pts };
      var center = function () { var f = fx.follow; return f ? { x: f.x, y: f.y + (o.dy || 0), z: f.z } : { x: fx.x, y: fx.y, z: fx.z }; };
      var spawn = function (c) {
        var k = next; next = (next + 1) % n;
        if (P.area) { var ar = P.area * sc; pos[k * 3] = c.x + rand(-ar, ar); pos[k * 3 + 1] = c.y + (name === 'rain' ? 12 : 14); pos[k * 3 + 2] = c.z + rand(-ar, ar); }
        else { var sp = (P.spread || 0) * sc; pos[k * 3] = c.x + rand(-sp, sp); pos[k * 3 + 1] = c.y + rand(-sp, sp) * 0.5; pos[k * 3 + 2] = c.z + rand(-sp, sp); }
        P.vel(v3); vel[k * 3] = v3[0] * sc; vel[k * 3 + 1] = v3[1] * sc; vel[k * 3 + 2] = v3[2] * sc;
        age[k] = 0; life[k] = rand(P.life[0], P.life[1]); seed[k] = Math.random() * 100;
        var cc = cols[pick ? Math.floor(Math.random() * cols.length) : 0]; pc[k * 3] = cc.r; pc[k * 3 + 1] = cc.g; pc[k * 3 + 2] = cc.b;
      };
      if (once) { var c0 = center(); for (var j = 0; j < n; j++) spawn(c0); }
      fx.update = function (dt) {
        var c = center();
        if (fx.on && rate) { acc += rate * dt; var cap = 0; while (acc >= 1 && cap++ < n) { spawn(c); acc -= 1; } }
        var alive = 0, g = P.gravity * sc, dr = Math.max(0, 1 - P.drag * dt);
        for (var i = 0; i < n; i++) {
          if (age[i] >= life[i]) { size[i] = 0; alpha[i] = 0; continue; }
          age[i] += dt; alive++;
          var t = Math.min(1, age[i] / life[i]), i3 = i * 3;
          vel[i3 + 1] -= g * dt; vel[i3] *= dr; vel[i3 + 1] *= dr; vel[i3 + 2] *= dr;
          pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
          if (P.sway) { pos[i3] += Math.sin(age[i] * 2 + seed[i]) * P.sway * dt; pos[i3 + 2] += Math.cos(age[i] * 1.7 + seed[i]) * P.sway * dt; }
          if (P.swirl) { var dx = pos[i3] - c.x, dz = pos[i3 + 2] - c.z, an = P.swirl * dt, ca = Math.cos(an), sa = Math.sin(an); pos[i3] = c.x + dx * ca - dz * sa; pos[i3 + 2] = c.z + dx * sa + dz * ca; }
          size[i] = (P.twinkle ? Math.sin(Math.PI * t) * P.size[1] : P.size[0] + (P.size[1] - P.size[0]) * t) * sc;
          alpha[i] = P.alpha[0] + (P.alpha[1] - P.alpha[0]) * t;
          if (pick || cols.length === 1) { col[i3] = pc[i3]; col[i3 + 1] = pc[i3 + 1]; col[i3 + 2] = pc[i3 + 2]; }
          else { var f = t * (cols.length - 1), a = Math.min(cols.length - 2, Math.floor(f)), b2 = f - a, A = cols[a], B = cols[a + 1]; col[i3] = A.r + (B.r - A.r) * b2; col[i3 + 1] = A.g + (B.g - A.g) * b2; col[i3 + 2] = A.b + (B.b - A.b) * b2; }
        }
        mat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
        geo.attributes.position.needsUpdate = geo.attributes.aColor.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aAlpha.needsUpdate = true;
        if (alive === 0 && (once || !fx.on)) fx.remove();
      };
      fx.stop = function () { fx.on = false; return fx; };
      fx.remove = function () { var k = effects.indexOf(fx); if (k < 0) return; effects.splice(k, 1); fxTotal -= n; scene.remove(pts); geo.dispose(); mat.dispose(); };
      effects.push(fx);
      if (P.then) UB.effect3d(P.then, { x: fx.x, y: fx.y, z: fx.z, scale: sc, sound: false });
      // the effect's sound (sound: false — none): one-shots play once from the point, continuous ones loop and follow the effect
      if (o.sound !== false) {
        var at = { x: fx.x, y: fx.y, z: fx.z };
        if (P.sfx) UB.sfx(P.sfx, { at: fx.follow || at, volume: o.volume });
        if (P.loop) { var snd = UB.sound3d(P.loop, P.area ? { volume: o.volume } : { x: at.x, y: at.y, z: at.z, follow: fx.follow, volume: o.volume == null ? P.loopVol || 1 : o.volume }); fx.sound = snd;
          var st0 = fx.stop, rm0 = fx.remove; fx.stop = function () { snd.stop(); return st0(); }; fx.remove = function () { snd.stop(); rm0(); }; }
      }
      return fx;
    };
    UB.burst3d = function (x, y, z, o) { o = o || {}; return UB.effect3d('burst', { x: x, y: y, z: z, color: o.color, count: o.count }); };
    // halo around glowing objects (glow and coins / crystals / stars / portals): soft glow instead of costly post-processing
    var haloTex = null;
    // halo of ready-made models: color, size (m, before model scale) and center height from the hitbox middle — only the glowing part
    var HALO = { coin: ['#ffd166', 1.4, 0], crystal: ['#7df9ff', 1.8, 0], star: ['#ffd166', 1.7, 0], heart: ['#ff4d6d', 1.4, 0], key: ['#ffd166', 1.2, 0], portal: ['#b388ff', 3, 0], lamp: ['#fff3b0', 1.3, 1.45] };
    var addHalo = function (mesh, c, sz) {
      if (!haloTex) {
        var hc = document.createElement('canvas'); hc.width = hc.height = 64; var hx = hc.getContext('2d'), gr = hx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        hx.fillStyle = gr; hx.fillRect(0, 0, 64, 64); haloTex = new T.CanvasTexture(hc);
      }
      var sp = new T.Sprite(new T.SpriteMaterial({ map: haloTex, color: color(c), blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }));
      sp.scale.set(sz, sz, 1); sp.renderOrder = 1; mesh.add(sp); return sp;
    };
    // Player: walking relative to the camera (WASD / arrows / joystick), jump (Space / button), gravity, collisions with solid
    UB.player3d = function (e, o) {
      o = o || {};
      var pc = { e: e, speed: o.speed != null ? o.speed : 7, jump: o.jump != null ? o.jump : 10, gravity: o.gravity != null ? o.gravity : 28, onGround: false, enabled: true };
      players.push(pc); e.vx = e.vy = e.vz = 0; e._isPlayer = true; e._pc = pc;
      if ((e.shape === 'character' || e.shape === 'model') && !e.rotY) e.rotY = Math.PI;   // the hero stands with its back to the camera: forward is −z
      if (touch && !padMade) makePad();
      if (cam.mode === 'fixed' && cam.target == null) cam = { mode: 'follow', target: e, distance: 9, height: 5 };
      return pc;
    };
    var makePad = function () {
      padMade = true;
      var base = document.createElement('div'), knob = document.createElement('div'), jb = document.createElement('button');
      Object.assign(base.style, { position: 'fixed', left: '24px', bottom: '24px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.4)', touchAction: 'none', zIndex: 5 });
      Object.assign(knob.style, { position: 'absolute', left: '35px', top: '35px', width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255,255,255,.6)' });
      base.appendChild(knob);
      var move = function (ev) { var b = base.getBoundingClientRect(), dx = ev.clientX - (b.left + 60), dy = ev.clientY - (b.top + 60), l = Math.min(1, Math.hypot(dx, dy) / 50) / (Math.hypot(dx, dy) || 1); joy.x = dx * l; joy.y = dy * l; knob.style.left = 35 + joy.x * 40 + 'px'; knob.style.top = 35 + joy.y * 40 + 'px'; };
      var end = function () { joy.x = joy.y = 0; knob.style.left = '35px'; knob.style.top = '35px'; };
      base.addEventListener('pointerdown', function (ev) { ev.preventDefault(); unlock(); base.setPointerCapture(ev.pointerId); move(ev); });
      base.addEventListener('pointermove', function (ev) { if (ev.buttons) move(ev); });
      base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
      jb.textContent = 'A';
      Object.assign(jb.style, { position: 'fixed', right: '28px', bottom: '40px', width: '76px', height: '76px', borderRadius: '50%', border: '2px solid rgba(255,255,255,.5)', background: 'rgba(255,255,255,.2)', color: '#fff', font: '700 24px system-ui', touchAction: 'none', zIndex: 5 });
      jb.addEventListener('pointerdown', function (ev) { ev.preventDefault(); unlock(); joyJump = true; });
      jb.addEventListener('pointerup', function () { joyJump = false; }); jb.addEventListener('pointercancel', function () { joyJump = false; });
      document.body.appendChild(base); document.body.appendChild(jb);
    };
    var camYaw = function () { return camera ? Math.atan2(camera.position.x - camTargetX, camera.position.z - camTargetZ) : 0; };
    var camTargetX = 0, camTargetZ = 0;
    var resolve = function (e, s, axis) {
      // a low obstacle (a slab, a stair step, anything up to 0.55 above the feet) — the hero steps onto it instead of stopping
      if (axis !== 'y' && e.vy <= 0.01 && e._isPlayer && (s.y + s.h / 2) - (e.y - e.h / 2) <= 0.55) { e.y = s.y + (s.h + e.h) / 2 + 0.001; return; }
      if (axis === 'y') { if (e.vy <= 0 && e.y > s.y) { e.y = s.y + (s.h + e.h) / 2; e.vy = 0; e._ground = true; } else if (e.vy > 0) { e.y = s.y - (s.h + e.h) / 2; e.vy = 0; } }
      else if (axis === 'x') e.x = e.x > s.x ? s.x + (s.w + e.w) / 2 : s.x - (s.w + e.w) / 2;
      else e.z = e.z > s.z ? s.z + (s.d + e.d) / 2 : s.z - (s.d + e.d) / 2;
    };
    var cellBox = { x: 0, y: 0, z: 0, w: 1, h: 1, d: 1 };
    var collide = function (e, axis) {
      for (var i = 0; i < ents.length; i++) {
        var s = ents[i]; if (s === e || !s.solid || !UB.hit3d(e, s)) continue;
        if (!s.parts) { resolve(e, s, axis); continue; }
        // a slab / stairs box: collide with its parts (unit boxes scaled to the entity)
        for (var qi = 0; qi < s.parts.length; qi++) {
          var qb = s.parts[qi];
          cellBox.x = s.x + ((qb[0] + qb[3]) / 2 - 0.5) * s.w; cellBox.y = s.y + ((qb[1] + qb[4]) / 2 - 0.5) * s.h; cellBox.z = s.z + ((qb[2] + qb[5]) / 2 - 0.5) * s.d;
          cellBox.w = (qb[3] - qb[0]) * s.w; cellBox.h = (qb[4] - qb[1]) * s.h; cellBox.d = (qb[5] - qb[2]) * s.d;
          if (UB.hit3d(e, cellBox)) resolve(e, cellBox, axis);
        }
      }
      // a cube world (UB.voxels3d with solid: true): solid cells around the hero act as solid boxes (even without physics)
      for (var vi = 0; vi < vox.length; vi++) {
        var hv = vox[vi]; if (!hv.solid || !hv.cells) continue;
        var sz = hv.size, o = hv.o, r = function (c, k) { return Math.round((c - o[k]) / sz); };
        for (var cx = r(e.x - e.w / 2, 0); cx <= r(e.x + e.w / 2, 0); cx++) for (var cy = r(e.y - e.h / 2, 1); cy <= r(e.y + e.h / 2, 1); cy++) for (var cz = r(e.z - e.d / 2, 2); cz <= r(e.z + e.d / 2, 2); cz++) {
          var cv = hv.cells[cx + ',' + cy + ',' + cz]; if (!cv) continue;
          var ccx = o[0] + cx * sz, ccy = o[1] + cy * sz, ccz = o[2] + cz * sz;
          var parts3 = cv === 1 ? [[0, 0, 0, 1, 1, 1]] : cv;
          for (var pi3 = 0; pi3 < parts3.length; pi3++) {
            var b3 = parts3[pi3];
            cellBox.x = ccx + ((b3[0] + b3[3]) / 2 - 0.5) * sz; cellBox.y = ccy + ((b3[1] + b3[4]) / 2 - 0.5) * sz; cellBox.z = ccz + ((b3[2] + b3[5]) / 2 - 0.5) * sz;
            cellBox.w = (b3[3] - b3[0]) * sz; cellBox.h = (b3[4] - b3[1]) * sz; cellBox.d = (b3[5] - b3[2]) * sz;
            if (UB.hit3d(e, cellBox)) resolve(e, cellBox, axis);
          }
        }
      }
    };
    // ==== Physics (Rapier; the library is on the page only if the game calls UB.body / UB.physics) ====
    // Bodies live in the Rapier world, the world object follows its body every frame (e.x/e.y/e.z and rotation). All solid objects (and the ground)
    // become solid for physics by themselves; the UB.player3d hero walks with a character controller: steps, slopes, pushing crates.
    var R = window.RAPIER, pw = null, pq = null, pcc = null, byCol = {}, physGrav = 18;
    var yawQ = function (r) { return { x: 0, y: Math.sin(r / 2), z: 0, w: Math.cos(r / 2) }; };
    var qYaw = function (q) { return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x)); };
    var qRot = function (q, v) {   // rotate a vector by a quaternion (inverse — with q.x, q.y, q.z negated)
      var ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z, iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z;
      return { x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x };
    };
    var shapeOf = function (e, o) {
      var s = o.shape || (e.shape === 'sphere' ? 'sphere' : e.shape === 'cylinder' ? 'cylinder' : e.shape === 'cone' ? 'cone' : 'box'), r = Math.max(0.05, Math.min(e.w, e.d) / 2);
      if (s === 'sphere') return R.ColliderDesc.ball(Math.max(0.05, e.w / 2));
      if (s === 'cylinder') return R.ColliderDesc.cylinder(Math.max(0.05, e.h / 2), r);
      if (s === 'cone') return R.ColliderDesc.cone(Math.max(0.05, e.h / 2), r);
      if (s === 'capsule') return R.ColliderDesc.capsule(Math.max(0.01, e.h / 2 - r), r);
      return R.ColliderDesc.cuboid(Math.max(0.02, e.w / 2), Math.max(0.02, e.h / 2), Math.max(0.02, e.d / 2));
    };
    var unphys = function (e) {
      var p = e._phys; if (!p) return; e._phys = null; e._q = null; if (e.mesh) e.mesh.rotation.set(0, e.rotY || 0, 0);
      delete byCol[p.col.handle]; if (pw) pw.removeRigidBody(p.rb);
    };
    // o.type: 'dynamic' (falls, rolls, gets pushed) | 'static' (a fixed support) | 'kinematic' (moved by the game via e.x/e.y/e.z) | 'solid' (by the engine)
    var makeBody = function (e, o) {
      if (e._phys) unphys(e);
      var type = o.type || 'dynamic';
      var bd = type === 'dynamic' ? R.RigidBodyDesc.dynamic() : type === 'static' ? R.RigidBodyDesc.fixed() : R.RigidBodyDesc.kinematicPositionBased();
      bd.setTranslation(e.x, e.y, e.z).setRotation(yawQ(e.rotY || 0));
      if (type === 'dynamic') {
        if (o.lockRotation) bd.lockRotations();
        if (o.damping != null) bd.setLinearDamping(o.damping);
        if (o.gravity != null) bd.setGravityScale(o.gravity);
        if (o.fast || e.shape === 'sphere') bd.setCcdEnabled(true);
      }
      var rb = pw.createRigidBody(bd);
      var cd = shapeOf(e, o).setRestitution(o.bounce == null ? 0.2 : o.bounce).setFriction(o.friction == null ? 0.6 : o.friction)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS).setActiveCollisionTypes(R.ActiveCollisionTypes.ALL);
      if (o.mass != null) cd.setMass(Math.max(0.01, o.mass));
      if (o.sensor) cd.setSensor(true);
      var col = pw.createCollider(cd, rb);
      var p = { e: e, rb: rb, col: col, type: type, hit: null, leave: null, x: e.x, y: e.y, z: e.z, r: e.rotY || 0 };
      e._phys = p; byCol[col.handle] = p; return p;
    };
    var voxCollider = function (h) {
      // cubes on a grid: a cube centered at (i·size) covers [i·size − size/2, i·size + size/2] — shift the collider by half a cube
      var s = h.size, a = new Int32Array(h.list.length * 3);
      h.list.forEach(function (v, i) { a[i * 3] = Math.round(v.x / s); a[i * 3 + 1] = Math.round(v.y / s); a[i * 3 + 2] = Math.round(v.z / s); });
      if (h.list.length) h.col = pw.createCollider(R.ColliderDesc.voxels(a, { x: s, y: s, z: s }).setTranslation(-s / 2, -s / 2, -s / 2));
      // slabs and stairs — a box collider per part
      h.cols = []; (h.shapes || []).forEach(function (v) { v.boxes.forEach(function (b2) {
        h.cols.push(pw.createCollider(R.ColliderDesc.cuboid((b2[3] - b2[0]) * s / 2, (b2[4] - b2[1]) * s / 2, (b2[5] - b2[2]) * s / 2).setTranslation(v.x + ((b2[0] + b2[3]) / 2 - 0.5) * s, v.y + ((b2[1] + b2[4]) / 2 - 0.5) * s, v.z + ((b2[2] + b2[5]) / 2 - 0.5) * s)));
      }); });
    };
    var unplayer = function (pc) { if (pc.rb && pw) { delete byCol[pc.col.handle]; pw.removeRigidBody(pc.rb); } pc.rb = pc.col = null; };
    UB.physics = function (o) {
      if (!scene) throw new Error('call UB.create3d first');
      if (!R) throw new Error('physics is not loaded');
      o = o || {};
      if (o.gravity != null) physGrav = o.gravity;
      if (!pw) {
        pw = new R.World({ x: 0, y: -physGrav, z: 0 }); pq = new R.EventQueue(true);
        pcc = pw.createCharacterController(0.02);
        pcc.enableAutostep(0.45, 0.2, true); pcc.enableSnapToGround(0.3); pcc.setMaxSlopeClimbAngle(50 * Math.PI / 180); pcc.setApplyImpulsesToDynamicBodies(true);
        ents.forEach(function (e) { if (e.solid && !e._phys && !e._isPlayer) makeBody(e, { type: 'solid' }); });
        vox.forEach(function (h) { if (h.solid && !h.col) voxCollider(h); });
      } else pw.gravity = { x: 0, y: -physGrav, z: 0 };
      return UB;
    };
    UB.body = function (e, o) {
      if (!e || !e.mesh) throw new Error('UB.body(e, ...): e must be an object from UB.spawn / UB.prefab');
      if (!pw) UB.physics();
      o = o || {};
      var p = makeBody(e, o), rb = p.rb;
      var b = {
        e: e,
        push: function (x, y, z) { rb.applyImpulse({ x: x || 0, y: y || 0, z: z || 0 }, true); return b; },
        spin: function (x, y, z) { rb.applyTorqueImpulse({ x: x || 0, y: y || 0, z: z || 0 }, true); return b; },
        velocity: function () { var v = rb.linvel(); return { x: v.x, y: v.y, z: v.z }; },
        setVelocity: function (x, y, z) { rb.setLinvel({ x: x || 0, y: y || 0, z: z || 0 }, true); return b; },
        moveTo: function (x, y, z) { e.x = x; e.y = y; e.z = z; return b; },
        onHit: function (fn) { p.hit = fn; return b; },
        onLeave: function (fn) { p.leave = fn; return b; },
        remove: function () { unphys(e); },
      };
      e.body = b; return b;
    };
    // ray: { e, x, y, z, dist } of the first object on the way (or null); o.ignore — an object the ray passes through (the shooter)
    UB.ray3d = function (from, dir, maxDist, o) {
      if (!pw) UB.physics();
      o = o || {};
      var l = Math.hypot(dir.x || 0, dir.y || 0, dir.z || 0) || 1, d = { x: (dir.x || 0) / l, y: (dir.y || 0) / l, z: (dir.z || 0) / l };
      var ig = o.ignore && (o.ignore._phys ? o.ignore._phys.col : players.filter(function (pc) { return pc.e === o.ignore; }).map(function (pc) { return pc.col; })[0]);
      var hit = pw.castRay(new R.Ray(from, d), maxDist || 100, true, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, ig || undefined);
      if (!hit) return null;
      var t = hit.timeOfImpact, p = byCol[hit.collider.handle];
      return { e: p ? p.e : null, x: from.x + d.x * t, y: from.y + d.y * t, z: from.z + d.z * t, dist: t };
    };
    // explosion: everything movable within the radius flies away from the point (stronger closer to the center)
    UB.explode = function (x, y, z, o) {
      if (!pw) UB.physics();
      o = o || {}; var rad = o.radius || 5, pow = o.power == null ? 12 : o.power;
      ents.forEach(function (e) {
        var p = e._phys; if (!p || p.type !== 'dynamic') return;
        var dx = e.x - x, dy = e.y - y + 0.5, dz = e.z - z, dd = Math.hypot(dx, dy, dz); if (dd > rad) return;
        var k = pow * (1 - dd / rad) * p.rb.mass() / (dd || 1);
        p.rb.applyImpulse({ x: dx * k, y: dy * k + pow * 0.3 * p.rb.mass(), z: dz * k }, true);
      });
    };
    // joint between two bodies: 'ball' (ball joint), 'hinge' (door, wheel; o.axis 'x'|'y'|'z'), 'rope' (rope of length o.length), 'spring'
    // b = null — attach to the world (pendulum, swing). o.at — the world point of the joint (default: between the centers)
    UB.joint = function (a, b2, o) {
      if (!pw) UB.physics();
      o = o || {};
      var pa = a && a._phys, pb = b2 && b2._phys, anchorBody = null;
      if (!pa) throw new Error('UB.joint: the first object needs UB.body');
      if (!pb) { anchorBody = pw.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(o.at ? o.at.x : a.x, o.at ? o.at.y : a.y + 2, o.at ? o.at.z : a.z)); }
      var rb1 = pa.rb, rb2 = pb ? pb.rb : anchorBody, t1 = rb1.translation(), t2 = rb2.translation();
      var at = o.at || { x: (t1.x + t2.x) / 2, y: (t1.y + t2.y) / 2, z: (t1.z + t2.z) / 2 }, type = o.type || 'ball';
      var local = function (rb, t) { var q = rb.rotation(); return qRot({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, { x: at.x - t.x, y: at.y - t.y, z: at.z - t.z }); };
      var jd;
      if (type === 'rope' || type === 'spring') {
        var len = o.length || Math.hypot(t1.x - t2.x, t1.y - t2.y, t1.z - t2.z);
        jd = type === 'rope' ? R.JointData.rope(len, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }) : R.JointData.spring(len, o.stiffness || 30, o.damping || 2, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
      } else if (type === 'hinge') {
        var ax = o.axis === 'x' ? { x: 1, y: 0, z: 0 } : o.axis === 'z' ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
        jd = R.JointData.revolute(local(rb1, t1), local(rb2, t2), ax);
      } else jd = R.JointData.spherical(local(rb1, t1), local(rb2, t2));
      var j = pw.createImpulseJoint(jd, rb1, rb2, true);
      return { remove: function () { if (pw) { pw.removeImpulseJoint(j, true); if (anchorBody) pw.removeRigidBody(anchorBody); } } };
    };
    // before the step: solid objects appeared/disappeared, the game moved a support or a body (e.x = …) — copy into the Rapier world
    var physSync = function () {
      ents.forEach(function (e) {
        var p = e._phys;
        if (e._isPlayer) { if (p && p.type === 'solid') unphys(e); return; }   // the hero is driven by the character controller
        if (e.solid && !p) { makeBody(e, { type: 'solid' }); return; }
        if (!p) return;
        if (p.type === 'solid' && !e.solid) { unphys(e); return; }
        var moved = e.x !== p.x || e.y !== p.y || e.z !== p.z;
        if (p.type === 'dynamic') {
          if (moved) { p.rb.setTranslation({ x: e.x, y: e.y, z: e.z }, true); p.rb.setLinvel({ x: 0, y: 0, z: 0 }, true); p.rb.setAngvel({ x: 0, y: 0, z: 0 }, true); }
        } else if (moved || e.rotY !== p.r) {
          if (p.type === 'static') { p.rb.setTranslation({ x: e.x, y: e.y, z: e.z }, true); p.rb.setRotation(yawQ(e.rotY || 0), true); }
          else { p.rb.setNextKinematicTranslation({ x: e.x, y: e.y, z: e.z }); p.rb.setNextKinematicRotation(yawQ(e.rotY || 0)); }
          p.x = e.x; p.y = e.y; p.z = e.z; p.r = e.rotY;
        }
      });
    };
    // player: a character capsule; the game moved the hero (respawn) — move without checking walls
    var physMove = function (pc, dx, dy, dz) {
      var e = pc.e;
      if (!pc.rb) {
        var r = Math.max(0.15, Math.min(e.w, e.d) / 2 * 0.9);
        pc.rb = pw.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(e.x, e.y, e.z));
        pc.col = pw.createCollider(R.ColliderDesc.capsule(Math.max(0.05, e.h / 2 - r), r).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS).setActiveCollisionTypes(R.ActiveCollisionTypes.ALL), pc.rb);
        byCol[pc.col.handle] = { e: e, player: true };
      }
      var c = pc.col.translation();
      if (Math.abs(c.x - e.x) + Math.abs(c.y - e.y) + Math.abs(c.z - e.z) > 0.05) {
        pc.rb.setTranslation({ x: e.x, y: e.y, z: e.z }, true); e.x += dx; e.z += dz; e.y += dy; pc.onGround = false;
      } else {
        pcc.computeColliderMovement(pc.col, { x: dx, y: dy, z: dz }, R.QueryFilterFlags.EXCLUDE_SENSORS);
        var m = pcc.computedMovement();
        e.x = c.x + m.x; e.y = c.y + m.y; e.z = c.z + m.z;
        pc.onGround = pcc.computedGrounded();
        if (pc.onGround && e.vy < 0) e.vy = 0;
        else if (e.vy > 0 && m.y < dy * 0.5) e.vy = 0;   // head hit the ceiling
      }
      pc.rb.setNextKinematicTranslation({ x: e.x, y: e.y, z: e.z });
    };
    var physStep = function (dt) {
      var n = Math.max(1, Math.ceil(dt * 60 - 1e-6));
      pw.timestep = dt / n;
      for (var i = 0; i < n; i++) pw.step(pq);
      ents.forEach(function (e) {
        var p = e._phys; if (!p || p.type !== 'dynamic') return;
        var t = p.rb.translation(), q = p.rb.rotation();
        e.x = p.x = t.x; e.y = p.y = t.y; e.z = p.z = t.z; e._q = q; e.rotY = p.r = qYaw(q);
      });
      pq.drainCollisionEvents(function (h1, h2, started) {
        var a = byCol[h1], b = byCol[h2]; if (!a && !b) return;
        var call = function (p, other) { var fn = p && (started ? p.hit : p.leave); if (fn) fn(other ? other.e : null); };
        call(a, b); call(b, a);
      });
    };
    UB.physics3d = function (dt) {
      if (pw) physSync();
      players.forEach(function (pc) {
        var e = pc.e; if (!pc.enabled) return;
        var fp = cam.mode === 'first';
        if (fp) cam.yaw += ((held.ArrowLeft ? 1 : 0) - (held.ArrowRight ? 1 : 0)) * 2.4 * dt;
        var ix = (fp ? (held.KeyD ? 1 : 0) - (held.KeyA ? 1 : 0) : (UB.key('right') ? 1 : 0) - (UB.key('left') ? 1 : 0)) + joy.x, iz = (UB.key('down') ? 1 : 0) - (UB.key('up') ? 1 : 0) + joy.y;
        var l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
        var yaw = camYaw(), sin = Math.sin(yaw), cos = Math.cos(yaw);
        var mx = ix * cos + iz * sin, mz = -ix * sin + iz * cos;
        if (!pw) { e.x += mx * pc.speed * dt; collide(e, 'x'); e.z += mz * pc.speed * dt; collide(e, 'z'); }
        if (fp) e.rotY = cam.yaw + Math.PI; else if (l > 0.1) e.rotY = Math.atan2(mx, mz);
        if ((UB.pressed('jump') || joyJump) && pc.onGround) { e.vy = pc.jump; UB.sfx('jump'); joyJump = false; }
        e.vy -= pc.gravity * dt;
        if (pw) physMove(pc, mx * pc.speed * dt, e.vy * dt, mz * pc.speed * dt);
        else { e._ground = false; e.y += e.vy * dt; collide(e, 'y'); pc.onGround = e._ground; }
      });
      if (pw) physStep(dt);
    };
    // Auto quality: the first 2 s are skipped (loading), then 3 s windows. Slow (frames > 28 ms) — first shadows go off,
    // then the resolution drops (1 → 0.75). A hidden tab never gets here (render3d isn't called).
    var autoQuality = function (dt) {
      var q = quality; q.t += dt; if (q.t < 2) return;
      q.frames++; if (dt > 0.028) q.slow++;
      if (q.frames < 90) return;
      var slow = q.slow / q.frames > 0.5; q.frames = 0; q.slow = 0;
      if (!slow) return;
      if (q.shadows) {
        q.shadows = false; renderer.shadowMap.enabled = false; sun.castShadow = false;
        scene.traverse(function (m) { if (m.material) [].concat(m.material).forEach(function (mt) { mt.needsUpdate = true; }); });
      } else if (q.ratio > 0.75) { q.ratio = q.ratio > 1 ? 1 : 0.75; renderer.setPixelRatio(q.ratio); fit(); }
      else q.mode = 'done';
      UB.quality3d = { shadows: q.shadows, pixelRatio: q.ratio };
    };
    // last frame's load: draw calls, triangles, objects; frames per second
    var fpsAcc = 0, fpsN = 0, fpsVal = 0;
    UB.stats3d = function () { var r = renderer && renderer.info.render; return { calls: r ? r.calls : 0, triangles: r ? r.triangles : 0, objects: ents.length, fps: fpsVal, shadows: !!(quality && quality.shadows), pixelRatio: quality ? quality.ratio : 1 }; };
    UB.render3d = function (dt) {
      fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { fpsVal = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
      for (var i = fx.length - 1; i >= 0; i--) { var f = fx[i]; f.t += dt; f.vy -= 15 * dt; f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt; if (f.t > f.life) { scene.remove(f.m); fx.splice(i, 1); } }
      ents.forEach(function (e) {
        e.mesh.position.set(e.x, e.y, e.z); e.mesh.visible = e.visible && !(e._sleep && e.shape !== 'prefab');
        if (e.shape === 'image' || e.shape === 'label') return;
        if (e._q) e.mesh.quaternion.set(e._q.x, e._q.y, e._q.z, e._q.w); else e.mesh.rotation.y = e.rotY;   // a physics body spins around all axes
      });
      if (!quality || quality.batch !== false) stepBatches();
      if (cam.mode === 'follow' && cam.target) {
        // the camera keeps a fixed angle (cam.yaw, behind by default, "forward" = −z): otherwise camera-relative controls would spin the hero in circles
        var t = cam.target, yaw = cam.yaw || 0, tx = t.x + Math.sin(yaw) * cam.distance, tz = t.z + Math.cos(yaw) * cam.distance;
        var k = Math.min(1, dt * 4);
        camera.position.x += (tx - camera.position.x) * k; camera.position.z += (tz - camera.position.z) * k; camera.position.y += (t.y + cam.height - camera.position.y) * k;
        camTargetX = t.x; camTargetZ = t.z; camera.lookAt(t.x, t.y + 1, t.z);
      } else if (cam.mode === 'first' && cam.target) {
        var ft = cam.target, ey = ft.y - (ft.h || 2) / 2 + (cam.height || (ft.h || 2) * 0.85), sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw), cp = Math.cos(cam.pitch || 0);
        camera.position.set(ft.x, ey, ft.z); camera.lookAt(ft.x - sy * cp, ey + Math.sin(cam.pitch || 0), ft.z - cy * cp);
        camTargetX = ft.x - sy; camTargetZ = ft.z - cy; if (ft.mesh) ft.mesh.visible = false;
        UB.look.yaw = cam.yaw; UB.look.pitch = cam.pitch || 0;
      } else if (cam.mode === 'top' && cam.target) {
        // screen "up" = −z, like the chase camera: the target point for the control angle is on the camera's side (otherwise WASD is mirrored)
        camera.position.set(cam.target.x, cam.target.y + (cam.height || 22), cam.target.z + 0.01); camTargetX = cam.target.x; camTargetZ = cam.target.z - 1; camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
      } else {
        camera.position.set(cam.x || 0, cam.y == null ? 12 : cam.y, cam.z == null ? 18 : cam.z); var lk = cam.look || { x: 0, y: 0, z: 0 }; camTargetX = lk.x; camTargetZ = lk.z; camera.lookAt(lk.x, lk.y, lk.z);
      }
      if (skyDome) skyDome.position.copy(camera.position);
      if (sun) {
        // the sun shines where the camera looks; 2 m steps — shadows don't shimmer while moving
        var fx0 = Math.round(camTargetX / 2) * 2, fz0 = Math.round(camTargetZ / 2) * 2;
        sun.position.set(fx0 + 30, 60, fz0 + 20); sun.target.position.set(fx0, 0, fz0);
      }
      if (quality && quality.mode === 'auto') autoQuality(dt);
      for (var ai = 0; ai < animated.length; ai++) if (animated[ai].visible) animated[ai]._animate(Math.min(dt, 0.1));
      for (var ei = effects.length - 1; ei >= 0; ei--) if (effects[ei]) effects[ei].update(Math.min(dt, 0.1));
      stepAudio();
      renderer.render(scene, camera);
    };
  })();
  window.UB = UB;
})();
(function () {
  'use strict';
  var UB = window.UB; if (!UB) return;
  var K = UB.kit = {};
  var W = function () { return UB.width; }, H = function () { return UB.height; };

  // ---------- shared UI texts ----------
  var TEXT = {
    ru: { play: 'Играть', again: 'Ещё раз', menu: 'Меню', level: 'Уровень', score: 'Очки', best: 'Рекорд', win: 'Победа!', lose: 'Игра окончена', complete: 'Уровень пройден!',
      pressStart: 'Пробел — начать', tapStart: 'Нажми «Играть»', top: 'Прыгни — верхний ответ', bottom: 'Беги — нижний ответ', lobby: 'Подключайтесь с телефонов!', players: 'Игроки',
      start: 'Начать', needPlayers: 'Нужен хотя бы один игрок', waiting: 'Ждём начала…', answered: 'Ответ принят!', correct: 'Верно!', wrong: 'Неверно', team0: 'Синие', team1: 'Розовые',
      draw: 'Ничья!', results: 'Итоги', wins: 'победили!', exitLocked: 'Собери всё — и выход откроется', exitOpen: 'Выход открыт!', boss: 'Босс', locked: 'Закрыто: ответь на вопрос', yourTeam: 'Твоя команда', question: 'Вопрос', time: 'Время вышло' },
    uz: { play: 'O‘ynash', again: 'Yana', menu: 'Menyu', level: 'Bosqich', score: 'Ochko', best: 'Rekord', win: 'G‘alaba!', lose: 'O‘yin tugadi', complete: 'Bosqich o‘tildi!',
      pressStart: 'Probel — boshlash', tapStart: '«O‘ynash»ni bos', top: 'Sakra — yuqori javob', bottom: 'Yugur — pastki javob', lobby: 'Telefonlardan ulaning!', players: 'O‘yinchilar',
      start: 'Boshlash', needPlayers: 'Kamida bitta o‘yinchi kerak', waiting: 'Boshlanishini kutamiz…', answered: 'Javob qabul qilindi!', correct: 'To‘g‘ri!', wrong: 'Noto‘g‘ri', team0: 'Ko‘klar', team1: 'Pushtilar',
      draw: 'Durang!', results: 'Natijalar', wins: 'g‘olib!', exitLocked: 'Hammasini yig‘ — chiqish ochiladi', exitOpen: 'Chiqish ochiq!', boss: 'Boss', locked: 'Yopiq: savolga javob ber', yourTeam: 'Jamoang', question: 'Savol', time: 'Vaqt tugadi' },
    en: { play: 'Play', again: 'Play again', menu: 'Menu', level: 'Level', score: 'Score', best: 'Best', win: 'Victory!', lose: 'Game over', complete: 'Level complete!',
      pressStart: 'Space to start', tapStart: 'Tap Play', top: 'Jump for the top answer', bottom: 'Run for the bottom one', lobby: 'Join from your phones!', players: 'Players',
      start: 'Start', needPlayers: 'At least one player is needed', waiting: 'Waiting for the start…', answered: 'Answer sent!', correct: 'Correct!', wrong: 'Wrong', team0: 'Blue', team1: 'Pink',
      draw: 'Draw!', results: 'Results', wins: 'win!', exitLocked: 'Collect everything to open the exit', exitOpen: 'The exit is open!', boss: 'Boss', locked: 'Locked: answer a question', yourTeam: 'Your team', question: 'Question', time: 'Time is up' },
  };
  var texts = function (cfg) { var t = Object.assign({}, TEXT[cfg.lang] || TEXT.en); return Object.assign(t, cfg.text || {}); };
  var TEAM = ['#4cc9f0', '#f72585'];

  // ---------- art: an AI picture by name, an emoji or a drawn "character" ----------
  var blob = function (g, x, y, w, h, color, o) {
    o = o || {}; var c = g.ctx; c.save(); c.translate(x, y); if (o.flip) c.scale(-1, 1); if (o.alpha != null) c.globalAlpha = o.alpha;
    g.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.38, color);
    g.roundRect(-w / 2 + w * 0.08, -h / 2 + h * 0.08, w * 0.35, h * 0.18, h * 0.09, 'rgba(255,255,255,.25)');
    var er = Math.max(2, Math.min(w, h) * 0.13);
    g.circle(w * 0.08, -h * 0.1, er, '#fff'); g.circle(w * 0.32, -h * 0.1, er, '#fff');
    g.circle(w * 0.12, -h * 0.08, er * 0.5, '#151525'); g.circle(w * 0.36, -h * 0.08, er * 0.5, '#151525');
    c.restore();
  };
  var gem = function (g, x, y, r, color) { g.circle(x, y, r * 1.35, 'rgba(255,255,255,.18)'); g.circle(x, y, r, color); g.circle(x - r * 0.3, y - r * 0.3, r * 0.3, 'rgba(255,255,255,.7)'); };
  var art = function (g, def, x, y, w, h, o) {
    def = def || {}; o = o || {};
    if (def.name && UB.hasImage(def.name)) g.image(def.name, x, y, w, h, o);
    else if (def.emoji) g.sprite(def.emoji, x, y, Math.max(w, h), o);
    else if (def.shape === 'gem') gem(g, x, y, Math.min(w, h) / 2.4, def.color || '#ffd166');
    else if (def.shape === 'box') { g.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.18, def.color || '#8d6e63'); g.rect(x - w / 2, y - h / 2, w, Math.max(4, h * 0.18), 'rgba(255,255,255,.22)'); g.strokeRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, 'rgba(0,0,0,.18)', 2); }
    else blob(g, x, y, w, h, def.color || '#ffd166', o);
  };
  var star = function (g, x, y, r, color) { var p = []; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } g.poly(p, color); };
  var hills = function (g, color, scroll, k, base, amp, freq) {
    var p = [[0, H()]];
    for (var x = 0; x <= W() + 20; x += 20) { var t = (x + scroll * k) * freq; p.push([x, base - Math.sin(t) * amp - Math.sin(t * 2.3 + 1) * amp * 0.35]); }
    p.push([W(), H()]); g.poly(p, color);
  };
  // background: a world picture name (from IMAGES) with light parallax; otherwise a gradient [top, bottom, far hills, near hills]
  var sky = function (g, bg, scroll) {
    scroll = scroll || 0;
    if (typeof bg === 'string' && UB.hasImage(bg)) {
      var off = -(((scroll * 0.2) % W()) + W()) % W();
      g.image(bg, off + W() / 2, H() / 2, W(), H()); g.image(bg, off + W() * 1.5, H() / 2, W(), H(), { flip: true }); return;
    }
    var c = Array.isArray(bg) ? bg : ['#6ec6ff', '#e3f6ff'];
    g.gradient(c[0], c[1] || c[0]);
    hills(g, c[2] || 'rgba(255,255,255,.28)', scroll, 0.15, H() * 0.62, 40, 0.006);
    hills(g, c[3] || 'rgba(20,40,60,.14)', scroll, 0.4, H() * 0.75, 30, 0.01);
  };

  // ---------- menu and results, shared by the kits ----------
  var bestKey = function (cfg) { return 'kit-best-' + (cfg.title || 'game'); };
  var menuScene = function (cfg, T) {
    UB.scene('menu', {
      enter: function (s) { s.t = 0; if (UB.testLevel != null) { var lv = UB.testLevel; UB.testLevel = null; UB.after(0, function () { UB.go('play', { level: lv }); }); } },
      update: function (s, dt) { s.t += dt; if (UB.pressed('jump') || UB.pressed('Enter')) UB.go('play', {}); },
      draw: function (g, s) {
        var bg = cfg.background || (cfg.levels && cfg.levels[0] && cfg.levels[0].background);
        sky(g, bg, s.t * 30); g.rect(0, 0, W(), H(), 'rgba(8,10,30,.35)');
        // long title — smaller font so it fits the width
        var ts = W() < 600 ? 40 : 58; g.ctx.font = '700 ' + ts + 'px system-ui, sans-serif';
        while (ts > 22 && g.ctx.measureText(cfg.title || '').width > W() - 60) { ts -= 2; g.ctx.font = '700 ' + ts + 'px system-ui, sans-serif'; }
        g.text(cfg.title || '', W() / 2, H() * 0.15 + UB.wave(2, 5), { align: 'center', baseline: 'middle', size: ts, color: '#fff', shadow: true });
        art(g, cfg.hero, W() / 2, H() * 0.42 + UB.wave(3, 6), 130, 130);
        if (cfg.goal) g.textBox(cfg.goal, W() / 2, H() * 0.6, Math.min(W() - 60, 720), { size: 22, align: 'center', color: '#fff', shadow: true });
        if (g.button(T.play, W() / 2 - 120, H() * 0.74, 240, 64, { size: 30 })) UB.go('play', {});
        var best = UB.store[bestKey(cfg)];
        g.text((best ? T.best + ': ' + best + '   ' : '') + (UB.isTouch ? '' : T.pressStart), W() / 2, H() * 0.74 + 84, { align: 'center', size: 18, color: 'rgba(255,255,255,.85)' });
      },
    });
  };
  var overScene = function (cfg, T) {
    UB.scene('over', {
      enter: function (s, d) {
        s.d = { score: d.score || 0, won: !!d.won, stars: d.stars == null ? (d.won ? 3 : 0) : d.stars }; s.t = 0;
        var k = bestKey(cfg); s.newBest = s.d.score > (UB.store[k] || 0); if (s.newBest) UB.store[k] = s.d.score;
        UB.music(null); UB.sfx(s.d.won ? 'win' : 'lose'); UB.finish({ score: s.d.score, won: s.d.won });
        if (s.d.won) UB.burst(W() / 2, H() * 0.3, { count: 40 });
      },
      update: function (s, dt) { s.t += dt; if (s.t > 0.6 && (UB.pressed('jump') || UB.pressed('Enter'))) UB.go('play', {}); },
      draw: function (g, s) {
        sky(g, cfg.background || (cfg.levels && cfg.levels[0] && cfg.levels[0].background), 0); g.rect(0, 0, W(), H(), 'rgba(8,10,30,.55)');
        var pw = Math.min(W() - 40, 520), px = (W() - pw) / 2, py = H() * 0.12;
        g.roundRect(px, py, pw, H() * 0.76, 26, 'rgba(25,28,58,.92)');
        g.text(s.d.won ? T.win : T.lose, W() / 2, py + 50, { align: 'center', baseline: 'middle', size: 44, color: s.d.won ? '#ffd166' : '#ff8fa3' });
        for (var i = 0; i < 3; i++) { var on = i < s.d.stars && s.t > 0.3 + i * 0.25; star(g, W() / 2 + (i - 1) * 74, py + 128, on ? 30 : 26, on ? '#ffd166' : 'rgba(255,255,255,.18)'); }
        g.text(T.score + ': ' + s.d.score, W() / 2, py + 196, { align: 'center', baseline: 'middle', size: 32, color: '#fff' });
        g.text(s.newBest ? T.best + '!' : T.best + ': ' + (UB.store[bestKey(cfg)] || 0), W() / 2, py + 236, { align: 'center', baseline: 'middle', size: 22, color: s.newBest ? '#06d6a0' : 'rgba(255,255,255,.7)' });
        if (g.button(T.again, W() / 2 - 130, py + H() * 0.76 - 150, 260, 60, { size: 28 })) UB.go('play', {});
        if (g.button(T.menu, W() / 2 - 90, py + H() * 0.76 - 78, 180, 48, { size: 22, color: 'rgba(255,255,255,.75)' })) UB.go('menu');
      },
    });
  };
  // a shuffled deck of questions with no repeats until all are used
  var deck = function (list) { var d = []; return function () { if (!list || !list.length) return null; if (!d.length) d = UB.shuffle(list); return d.pop(); }; };
  var starsFor = function (lives, max) { return lives >= max ? 3 : lives >= Math.max(1, max - 1) ? 2 : 1; };
  var levelBanner = function (s, T, lv, i) { s.banner = { text: T.level + ' ' + (i + 1) + (lv && lv.name ? ': ' + lv.name : ''), a: 1 }; UB.tween(s.banner, { a: 0 }, 1.8, 'inQuad'); };
  var drawBanner = function (g, s) { if (s.banner && s.banner.a > 0.02) { g.ctx.globalAlpha = Math.min(1, s.banner.a * 1.6); UB.hud.banner(s.banner.text, { size: 34, y: H() * 0.24 }); g.ctx.globalAlpha = 1; } };
  var hook = function (cfg, name) { var h = cfg.hooks && cfg.hooks[name]; return typeof h === 'function' ? h : null; };
  // shared actions for hooks: s.addScore, s.hurt, s.heal, s.win, s.lose, s.ask
  var actions = function (cfg, T, s, ask, onWin, onLose) {
    s.addScore = function (n, x, y) { s.score += n; UB.score(s.score); if (x != null) UB.popup((n > 0 ? '+' : '') + n, x, y); };
    s.hurt = function () {
      if (s.inv > 0 || s.power > 0 || s.over) return;
      s.lives--; s.inv = 1.4; UB.sfx('hit'); UB.shake(9, 0.3);
      var h = hook(cfg, 'hurt'); if (h) h(s);
      if (s.lives <= 0) s.lose();
    };
    s.heal = function () { s.lives = Math.min(s.maxLives + 2, s.lives + 1); UB.sfx('powerup'); };
    s.win = function () { if (s.over) return; s.over = true; onWin(); };
    s.lose = function () { if (s.over) return; s.over = true; UB.after(0.9, function () { onLose(); }); };
    s.ask = function (done) { var q = ask(); if (!q) { if (done) done(true); return; } s.q = UB.quiz({ q: q.q, options: q.options, correct: q.correct, time: cfg.quizTime || 0, onAnswer: function (ok) { s.q = null; var h = hook(cfg, 'answer'); if (h) h(s, ok); if (done) done(ok); } }); };
  };
  var nextLevel = function (cfg, T, s, levels) {
    UB.sfx('win'); s.banner = { text: T.complete, a: 1.4 }; UB.tween(s.banner, { a: 0 }, 1.6);
    UB.after(1.5, function () {
      if (s.li + 1 < levels.length) UB.go('play', { level: s.li + 1, score: s.score, lives: s.lives });
      else UB.go('over', { score: s.score, won: true, stars: starsFor(s.lives, s.maxLives) });
    });
  };

  // ======================= PLATFORMER =======================
  // Levels as strings: # ground, = platform (passable from below), P start, F finish, ^ spikes, B spring, ? question block,
  // D door (a correct answer opens it), H heart, * power star, M moving platform, o coin (score 10);
  // your own letters — cfg.items (collectibles), cfg.enemies (enemies), cfg.tiles (custom cells with a touch hook).
  K.platformer = function (cfg) {
    var T = texts(cfg), L = cfg.levels || [], TS = cfg.tile || 48, ask = deck(cfg.questions);
    UB.touchControls(['left', 'right', 'jump']);
    menuScene(cfg, T); overScene(cfg, T);
    var builtIn = 'FDB?H*Mo^';
    UB.scene('play', {
      enter: function (s, d) {
        s.li = d.level || 0; var lv = s.lv = L[s.li] || { rows: ['#'] };
        s.score = d.score || 0; s.maxLives = cfg.lives || 3; s.lives = d.lives == null ? s.maxLives : d.lives; s.inv = 0; s.power = 0; s.t = 0; s.over = false;
        s.lvl = UB.level(lv.rows, { tile: TS });
        var p = s.lvl.first('P') || { x: TS, y: TS };
        s.start = { x: p.x + TS * 0.15, y: p.y }; s.check = s.start;
        var hs = cfg.hero && cfg.hero.size || 1;
        s.hero = { x: s.start.x, y: s.start.y, w: TS * 0.72 * hs, h: TS * 0.9 * hs, vx: 0, vy: 0, facing: 1, sq: 1 };
        s.enemies = []; s.items = []; s.movers = []; s.doors = [];
        s.lvl.cells.forEach(function (c) {
          if (c.ch === 'P') return;
          var en = cfg.enemies && cfg.enemies[c.ch];
          if (en) { var es = en.size || 1; s.enemies.push({ def: en, name: en.name || c.ch, ch: c.ch, x: c.x + (TS - TS * 0.8 * es) / 2, y: c.y + TS - TS * 0.8 * es, w: TS * 0.8 * es, h: TS * 0.8 * es, y0: c.y, dir: -1, alive: true, hp: en.hp || 1 }); return; }
          if (c.ch === 'M') { var m = { x: c.x, y: c.y, w: TS * 2, h: TS / 3, x0: c.x, range: (lv.moverRange || 3) * TS, ph: Math.random() * 6, mover: true }; s.movers.push(m); s.lvl.solids.push(m); return; }
          if (c.ch === 'D') { var dd = { x: c.x, y: c.y, w: TS, h: TS, door: true }; s.doors.push(dd); s.lvl.solids.push(dd); return; }
          var idef = (cfg.items && cfg.items[c.ch]) || (cfg.tiles && cfg.tiles[c.ch]) || null;
          s.items.push({ ch: c.ch, name: (idef && idef.name) || c.ch, x: c.x, y: c.y, w: TS, h: TS, def: idef, ph: Math.random() * 6 });
        });
        s.cam = UB.camera2d({ follow: s.hero, bounds: s.lvl.bounds, lerp: 7, offsetY: -TS });
        actions(cfg, T, s, ask, function () { nextLevel(cfg, T, s, L); }, function () { UB.go('over', { score: s.score, won: false, stars: 0 }); });
        s.total = s.items.filter(function (i) { return i.ch === 'o' || (cfg.items && cfg.items[i.ch]); }).length;
        UB.music(lv.music || cfg.music || 'happy'); levelBanner(s, T, lv, s.li); UB.score(s.score);
        var h = hook(cfg, 'start'); if (h) h(s, lv);
      },
      update: function (s, dt) {
        if (s.q && s.q.open) return;
        s.t += dt; s.inv -= dt; s.power -= dt;
        var hero = s.hero, i;
        if (s.over) { hero.vx *= 0.9; UB.move(hero, s.lvl.solids, dt, { gravity: 1800 }); return; }
        s.movers.forEach(function (m) { var nx = m.x0 + (Math.sin(s.t * 1.2 + m.ph) * 0.5 + 0.5) * m.range; m.dx = nx - m.x; m.x = nx; if (hero.onGround && Math.abs(hero.y + hero.h - m.y) < 3 && hero.x + hero.w > m.x && hero.x < m.x + m.w) hero.x += m.dx; });
        var wasAir = !hero.onGround;
        var r = UB.platformer(hero, s.lvl.solids, dt, { speed: (cfg.speed || 300) * (s.power > 0 ? 1.3 : 1), jump: cfg.jump || 760, gravity: cfg.gravity || 1900 });
        if (r.ground && wasAir) { hero.sq = 0.7; UB.tween(hero, { sq: 1 }, 0.25, 'outBack'); }
        if (hero.y > s.lvl.h + 200) { s.hurt(); if (!s.over) { hero.x = s.check.x; hero.y = s.check.y; hero.vx = hero.vy = 0; } }
        // enemies
        s.enemies.forEach(function (e) {
          if (!e.alive) return;
          var ai = e.def.ai || 'patrol', sp = e.def.speed || 80;
          if (ai === 'fly') { e.x += e.dir * sp * dt; e.y = e.y0 + Math.sin(s.t * 2 + e.x * 0.01) * TS * 0.8; if (s.lvl.solidAt(e.dir > 0 ? e.x + e.w : e.x, e.y + e.h / 2) || Math.random() < 0.002) e.dir = -e.dir; }
          else if (ai === 'chase' && Math.abs(hero.x - e.x) < TS * 7) { e.dir = hero.x > e.x ? 1 : -1; UB.move(e, s.lvl.solids, dt, { gravity: 1800 }); e.vx = e.dir * sp; }
          else if (ai === 'still') {}
          else { UB.ai.patrol(e, dt, { speed: sp, level: s.lvl }); }
          if (ai === 'chase' && Math.abs(hero.x - e.x) >= TS * 7) e.vx = 0;
          if (UB.overlap(hero, e)) {
            if (e.def.stomp !== false && hero.vy > 60 && hero.y + hero.h - e.y < e.h * 0.55) {
              hero.vy = -560; e.hp--; UB.sfx('hit'); UB.burst(e.x + e.w / 2, e.y + e.h / 2, { color: e.def.color });
              if (e.hp <= 0) { e.alive = false; s.addScore(e.def.score || 20, e.x + e.w / 2, e.y); var hk = hook(cfg, 'defeat'); if (hk) hk(s, e); }
            } else if (s.power > 0) { e.alive = false; s.addScore(e.def.score || 20, e.x + e.w / 2, e.y); UB.burst(e.x + e.w / 2, e.y + e.h / 2); }
            else { s.hurt(); hero.vx = (hero.x < e.x ? -1 : 1) * 420; hero.vy = -380; }
          }
        });
        // items
        for (i = 0; i < s.items.length; i++) {
          var it = s.items[i]; if (it.dead) continue;
          var box = it.ch === '^' ? { x: it.x + 6, y: it.y + TS * 0.55, w: TS - 12, h: TS * 0.45 } : it.ch === 'B' ? { x: it.x + 6, y: it.y + TS * 0.6, w: TS - 12, h: TS * 0.4 } : { x: it.x + 8, y: it.y + 8, w: TS - 16, h: TS - 16 };
          if (!UB.overlap(hero, box)) continue;
          var cx = it.x + TS / 2, cy = it.y + TS / 2;
          if (it.ch === 'o' || (cfg.items && cfg.items[it.ch])) {
            var df = it.def || {}; it.dead = true; s.addScore(df.score == null ? 10 : df.score, cx, cy); UB.sfx(df.sfx || 'coin'); UB.burst(cx, cy, { color: df.color || '#ffd166', count: 10 });
            s.got = (s.got || 0) + 1; var hp = hook(cfg, 'pickup'); if (hp) hp(s, it);
          } else if (it.ch === 'H') { it.dead = true; s.heal(); UB.popup('+1', cx, cy, { color: '#ff4d6d' }); }
          else if (it.ch === '*') { it.dead = true; s.power = cfg.powerTime || 6; UB.sfx('powerup'); UB.burst(cx, cy, { count: 24 }); }
          else if (it.ch === 'B') { hero.vy = -(cfg.jump || 760) * 1.5; it.boing = 1; UB.tween(it, { boing: 0 }, 0.4, 'outElastic'); UB.sfx('jump'); }
          else if (it.ch === '^') { s.hurt(); hero.vy = -520; }
          else if (it.ch === 'F') { it.dead = true; s.check = { x: it.x, y: it.y }; s.win(); }
          else if (it.ch === '?') {
            if (it.wait > s.t) continue; it.wait = s.t + 1.5;
            (function (it) { s.ask(function (ok) { if (ok) { it.dead = true; s.addScore(cfg.quizScore || 50, it.x + TS / 2, it.y); UB.burst(it.x + TS / 2, it.y + TS / 2, { count: 24 }); } else { s.hurt(); } }); })(it);
          } else if (it.def && it.def.touch) it.def.touch(s, it);
        }
        // doors: come close — a question; correct — the door opens
        s.doors.forEach(function (dr) {
          if (dr.dead || dr.wait > s.t) return;
          if (UB.overlap({ x: hero.x - 6, y: hero.y, w: hero.w + 12, h: hero.h }, dr)) { dr.wait = s.t + 2; s.ask(function (ok) { if (ok) { dr.dead = true; UB.burst(dr.x + TS / 2, dr.y + TS / 2, { color: '#ffd166', count: 26 }); s.addScore(cfg.quizScore || 50, dr.x + TS / 2, dr.y); } else s.hurt(); }); }
        });
        if (s.lv.time) { s.left = s.lv.time - s.t; if (s.left <= 0) s.lose(); }
        var hu = hook(cfg, 'update'); if (hu) hu(s, dt);
      },
      draw: function (g, s) {
        var lv = s.lv, col = lv.colors || cfg.colors || {}, hero = s.hero;
        sky(g, lv.background || cfg.background, s.cam.x);
        g.world(function () {
          s.lvl.solids.forEach(function (c) {
            if (c.dead || !s.cam.visible(c, 60)) return;
            if (c.door) { g.roundRect(c.x + 4, c.y, c.w - 8, c.h, 8, col.door || '#8d5524'); g.circle(c.x + c.w / 2, c.y + c.h / 2, 9, '#ffd166'); g.text('?', c.x + c.w / 2, c.y + c.h / 2, { align: 'center', baseline: 'middle', size: 16, color: '#5a3a10' }); return; }
            if (c.mover) { g.roundRect(c.x, c.y, c.w, c.h, 6, col.mover || '#b08968'); return; }
            if (c.oneWay) { g.roundRect(c.x, c.y, c.w, c.h, 5, col.plank || '#c08552'); return; }
            g.rect(c.x, c.y, c.w + 0.5, c.h + 0.5, col.ground || '#6b4f3a');
            if (!s.lvl.solidAt(c.x + 1, c.y - 2)) { g.rect(c.x, c.y, c.w + 0.5, 12, col.top || '#7ccf6b'); g.rect(c.x, c.y + 12, c.w + 0.5, 4, 'rgba(0,0,0,.12)'); }
          });
          s.items.forEach(function (it) {
            if (it.dead || !s.cam.visible(it, 60)) return;
            var cx = it.x + TS / 2, cy = it.y + TS / 2, b = UB.wave(3, 4, it.ph);
            if (it.ch === 'o') gem(g, cx, cy + b, TS * 0.22, '#ffd166');
            else if (cfg.items && cfg.items[it.ch]) art(g, Object.assign({ shape: 'gem' }, it.def), cx, cy + b, TS * 0.7, TS * 0.7);
            else if (it.ch === 'H') UB.hud.hearts(cx - TS * 0.25, cy - TS * 0.2 + b, 1, 1, { size: TS * 0.45 });
            else if (it.ch === '*') star(g, cx, cy + b, TS * 0.35 + UB.wave(8, 3), '#ffd166');
            else if (it.ch === 'B') { var k = it.boing || 0, top = it.y + TS * 0.6 - k * 12, zz = []; for (var z = 0; z <= 6; z++) zz.push([it.x + TS / 2 + (z % 2 ? 9 : -9) * (z && z < 6 ? 1 : 0), it.y + TS - (it.y + TS - top - 6) * z / 6]); for (var zi = 1; zi < zz.length; zi++) g.line(zz[zi - 1][0], zz[zi - 1][1], zz[zi][0], zz[zi][1], '#adb5bd', 4); g.roundRect(it.x + 8, top, TS - 16, 9, 4, '#ef476f'); }
            else if (it.ch === '^') { for (var q = 0; q < 3; q++) g.poly([[it.x + q * TS / 3, it.y + TS], [it.x + q * TS / 3 + TS / 6, it.y + TS * 0.5], [it.x + (q + 1) * TS / 3, it.y + TS]], col.spikes || '#ced4da'); }
            else if (it.ch === 'F') { g.rect(it.x + TS / 2 - 3, it.y - TS * 1.5, 6, TS * 2.5, '#e9ecef'); g.poly([[it.x + TS / 2 + 3, it.y - TS * 1.5], [it.x + TS / 2 + 3 + TS * 0.9 + UB.wave(6, 4), it.y - TS * 1.2], [it.x + TS / 2 + 3, it.y - TS * 0.9]], col.flag || '#ef476f'); }
            else if (it.ch === '?') { g.roundRect(it.x + 3, it.y + 3 + b * 0.5, TS - 6, TS - 6, 10, '#ffb703'); g.strokeRect(it.x + 5, it.y + 5 + b * 0.5, TS - 10, TS - 10, '#fb8500', 3); g.text('?', cx, cy + b * 0.5, { align: 'center', baseline: 'middle', size: TS * 0.55, color: '#fff' }); }
            else if (it.def && it.def.draw) it.def.draw(g, it, s);
            else if (it.def) art(g, it.def, cx, cy, TS * 0.8, TS * 0.8);
          });
          s.enemies.forEach(function (e) { if (e.alive && s.cam.visible(e, 60)) art(g, e.def, e.x + e.w / 2, e.y + e.h / 2, e.w * 1.15, e.h * 1.15, { flip: e.dir > 0 === !e.def.facesRight }); });
          var blink = (s.inv > 0 && Math.floor(s.t * 14) % 2 === 0);
          if (!blink) {
            var c = g.ctx; c.save(); c.translate(hero.x + hero.w / 2, hero.y + hero.h); c.scale(1 + (1 - hero.sq) * 0.6, hero.sq);
            if (s.power > 0) g.circle(0, -hero.h / 2, hero.h * 0.75, 'rgba(255,209,102,.35)');
            art(g, cfg.hero, 0, -hero.h * 0.55, hero.w * 1.5, hero.h * 1.25, { flip: hero.facing < 0 });
            c.restore();
          }
          var dw = hook(cfg, 'drawWorld'); if (dw) dw(g, s);
        });
        UB.hud.score(s.score, { label: T.score });
        UB.hud.hearts(W() - 16 - Math.max(s.lives, s.maxLives) * 32, 22, s.lives, s.maxLives, { size: 24 });
        g.text(T.level + ' ' + (s.li + 1) + (lv.name ? ': ' + lv.name : ''), 18, 70, { size: 18, color: '#fff', shadow: true });
        if (s.lv.time) UB.hud.timer(s.left, W() / 2, 18);
        if (s.power > 0) UB.hud.bar(W() / 2 - 80, 60, 160, 12, s.power / (cfg.powerTime || 6), { color: '#ffd166' });
        var dh = hook(cfg, 'drawHud'); if (dh) dh(g, s);
        drawBanner(g, s);
        if (s.q && s.q.open) s.q.draw(g);
      },
    });
  };

  // ======================= RUNNER =======================
  K.runner = function (cfg) {
    var T = texts(cfg), L = cfg.levels || [{ length: 4000 }], ask = deck(cfg.questions);
    UB.touchControls(cfg.duck ? ['down', 'jump'] : ['jump']);
    menuScene(cfg, T); overScene(cfg, T);
    UB.scene('play', {
      enter: function (s, d) {
        s.li = d.level || 0; var lv = s.lv = L[s.li] || L[0];
        s.score = d.score || 0; s.maxLives = cfg.lives || 3; s.lives = d.lives == null ? s.maxLives : d.lives; s.inv = 0; s.power = 0; s.t = 0; s.over = false;
        s.ground = H() - 90; s.speed = lv.speed || cfg.speed || 380; s.dist = 0; s.len = lv.length || 4000;
        s.hero = { x: 150, y: s.ground - 64, w: 48, h: 64, vy: 0, onGround: true, jumps: 0, sq: 1 };
        s.obs = []; s.picks = []; s.gate = null; s.next = 1.1; s.nextQ = cfg.quizEvery || 10; s.scroll = 0;
        actions(cfg, T, s, ask, function () { nextLevel(cfg, T, s, L); }, function () { UB.go('over', { score: s.score, won: false, stars: 0 }); });
        UB.music(lv.music || cfg.music || 'happy'); levelBanner(s, T, lv, s.li); UB.score(s.score);
        var h = hook(cfg, 'start'); if (h) h(s, lv);
      },
      update: function (s, dt) {
        if (s.q && s.q.open) return;
        var hero = s.hero, lv = s.lv;
        s.t += dt; s.inv -= dt; s.power -= dt;
        if (s.over) return;
        s.speed += (cfg.speedUp == null ? 8 : cfg.speedUp) * dt;
        var v = s.speed * (s.power > 0 ? 1.35 : 1); s.dist += v * dt; s.scroll += v * dt;
        // jump (double — if cfg.doubleJump), duck
        var duck = cfg.duck && UB.key('down') && hero.onGround;
        hero.h = duck ? 36 : 64;
        if ((UB.pressed('jump') || UB.pressed('up')) && (hero.onGround || (cfg.doubleJump && hero.jumps < 2))) { hero.vy = -(cfg.jump || 820) * (hero.onGround ? 1 : 0.85); hero.onGround = false; hero.jumps++; UB.sfx('jump'); }
        if (!UB.key('jump') && !UB.key('up') && hero.vy < 0) hero.vy += 1900 * dt;
        hero.vy += 2300 * dt; hero.y += hero.vy * dt;
        if (hero.y + hero.h >= s.ground) { if (!hero.onGround) { hero.sq = 0.7; UB.tween(hero, { sq: 1 }, 0.25, 'outBack'); } hero.y = s.ground - hero.h; hero.vy = 0; hero.onGround = true; hero.jumps = 0; }
        // spawning obstacles, coins and question gates
        s.next -= dt; s.nextQ -= dt;
        var defs = lv.obstacles || cfg.obstacles || [{ color: '#6c757d', w: 40, h: 50 }];
        if (s.nextQ <= 0 && cfg.questions && cfg.questions.length && !s.gate) {
          var q = ask(); s.nextQ = cfg.quizEvery || 10;
          if (q) { var wrong = q.options.filter(function (o, i) { return i !== q.correct; }); var top = Math.random() < 0.5; s.gate = { q: q.q, x: W() + 60, top: top ? q.options[q.correct] : UB.pick(wrong), bottom: top ? UB.pick(wrong) : q.options[q.correct], ok: top ? 'top' : 'bottom', done: false }; s.next = 2.4; s.picks = s.picks.filter(function (p) { return p.x < W() - 220; }); s.obs = s.obs.filter(function (o) { return o.x < W() - 220; }); }
        }
        // while answer gates are on screen — no obstacles or coins: the sign must be readable
        if (s.next <= 0 && s.gate && !s.gate.done) s.next = 0.3;
        if (s.next <= 0) {
          var od = UB.pick(defs), fly = !!od.fly;
          s.obs.push({ def: od, x: W() + 40, y: fly ? s.ground - 64 - (od.h || 40) - 8 : s.ground - (od.h || 50), w: od.w || 40, h: od.h || 50 });
          if (Math.random() < 0.6) { var n = UB.randInt(3, 5), hy = s.ground - UB.pick([60, 150, 210]); for (var k = 0; k < n; k++) s.picks.push({ name: (cfg.pickup && cfg.pickup.name) || 'pickup', x: W() + 200 + k * 46, y: hy - Math.sin(k / (n - 1) * Math.PI) * 50, r: 13 }); }
          if (Math.random() < 0.08) s.picks.push({ x: W() + 320, y: s.ground - 170, r: 18, power: Math.random() < 0.5 ? 'star' : 'heart' });
          s.next = UB.rand(0.9, 1.7) * Math.max(0.45, 380 / s.speed);
        }
        s.obs.forEach(function (o) { o.x -= v * dt; if (!o.hit && UB.overlap({ x: hero.x + 8, y: hero.y + 6, w: hero.w - 16, h: hero.h - 8 }, o)) { o.hit = true; if (s.power > 0) { UB.burst(o.x + o.w / 2, o.y + o.h / 2); s.addScore(5, o.x, o.y); } else s.hurt(); } });
        s.obs = s.obs.filter(function (o) { return o.x > -120; });
        s.picks.forEach(function (p) {
          p.x -= v * dt;
          if (!p.got && Math.hypot(hero.x + hero.w / 2 - p.x, hero.y + hero.h / 2 - p.y) < p.r + 28) {
            p.got = true;
            if (p.power === 'star') { s.power = 5; UB.sfx('powerup'); } else if (p.power === 'heart') { s.heal(); }
            else { var pd = cfg.pickup || {}; s.addScore(pd.score || 5, p.x, p.y - 10); UB.sfx('coin'); s.got = (s.got || 0) + 1; var hp = hook(cfg, 'pickup'); if (hp) hp(s, p); }
          }
        });
        s.picks = s.picks.filter(function (p) { return p.x > -40 && !p.got; });
        if (s.gate) {
          var gt = s.gate; gt.x -= v * dt;
          if (!gt.done && gt.x < hero.x + hero.w / 2) {
            gt.done = true; var pick = hero.y + hero.h / 2 < s.ground - 150 ? 'top' : 'bottom';
            if (pick === gt.ok) { s.addScore(cfg.quizScore || 50, hero.x + 40, hero.y - 20); UB.sfx('correct'); UB.burst(hero.x + 30, hero.y, { count: 26 }); s.power = Math.max(s.power, 1.5); }
            else { UB.sfx('wrong'); UB.popup(T.wrong, hero.x + 40, hero.y - 20, { color: '#ef476f' }); s.hurt(); }
            var ha = hook(cfg, 'answer'); if (ha) ha(s, pick === gt.ok);
          }
          if (gt.x < -200) s.gate = null;
        }
        if (s.dist >= s.len) s.win();
        var hu = hook(cfg, 'update'); if (hu) hu(s, dt);
      },
      draw: function (g, s) {
        var lv = s.lv, col = lv.colors || cfg.colors || {}, hero = s.hero;
        sky(g, lv.background || cfg.background, s.scroll);
        g.rect(0, s.ground, W(), H() - s.ground, col.ground || '#6b4f3a'); g.rect(0, s.ground, W(), 14, col.top || '#7ccf6b');
        for (var x = -(s.scroll % 80); x < W(); x += 80) g.rect(x, s.ground + 34, 40, 6, 'rgba(0,0,0,.12)');
        if (s.gate) {
          var gt = s.gate;
          [['top', s.ground - 230], ['bottom', s.ground - 100]].forEach(function (b) {
            g.roundRect(gt.x - 80, b[1], 160, 64, 14, 'rgba(255,255,255,.92)'); g.strokeRect(gt.x - 78, b[1] + 2, 156, 60, '#8ecae6', 3);
            g.text(gt[b[0]], gt.x, b[1] + 32, { align: 'center', baseline: 'middle', size: String(gt[b[0]]).length > 10 ? 18 : 26, color: '#1b1b2f' });
          });
          g.rect(gt.x - 3, s.ground - 166, 6, 66, 'rgba(255,255,255,.6)');
        }
        s.picks.forEach(function (p) { if (p.power === 'star') star(g, p.x, p.y + UB.wave(5, 4), p.r, '#ffd166'); else if (p.power === 'heart') UB.hud.hearts(p.x - 12, p.y - 12, 1, 1, { size: 26 }); else art(g, Object.assign({ shape: 'gem', color: '#ffd166' }, cfg.pickup), p.x, p.y + UB.wave(5, 3, p.x * 0.05), p.r * 2.2, p.r * 2.2); });
        s.obs.forEach(function (o) { art(g, Object.assign({ shape: 'box' }, o.def), o.x + o.w / 2, o.y + o.h / 2, o.w * 1.1, o.h * 1.1); });
        if (!(s.inv > 0 && Math.floor(s.t * 14) % 2 === 0)) {
          var c = g.ctx; c.save(); c.translate(hero.x + hero.w / 2, hero.y + hero.h); c.scale(1 + (1 - hero.sq) * 0.6, hero.sq);
          if (s.power > 0) g.circle(0, -hero.h / 2, 52, 'rgba(255,209,102,.35)');
          art(g, cfg.hero, 0, -hero.h * 0.55 + (hero.onGround ? Math.abs(UB.wave(14, 4)) * -1 : 0), 76, 76 * (hero.h / 64));
          c.restore();
        }
        var dw = hook(cfg, 'drawWorld'); if (dw) dw(g, s);
        UB.hud.score(s.score, { label: T.score });
        UB.hud.hearts(W() - 16 - Math.max(s.lives, s.maxLives) * 32, 22, s.lives, s.maxLives, { size: 24 });
        UB.hud.bar(W() / 2 - 150, 24, 300, 14, s.dist / s.len, { color: '#06d6a0' });
        g.text(T.level + ' ' + (s.li + 1) + (lv.name ? ': ' + lv.name : ''), W() / 2, 46, { align: 'center', size: 16, color: '#fff', shadow: true });
        if (s.gate && !s.gate.done) {
          UB.hud.panel(W() / 2 - 300, 76, 600, 70);
          g.text(s.gate.q, W() / 2, 100, { align: 'center', baseline: 'middle', size: 24, color: '#fff' });
          g.text(T.top + ' · ' + T.bottom, W() / 2, 130, { align: 'center', baseline: 'middle', size: 15, color: 'rgba(255,255,255,.75)' });
        }
        var dh = hook(cfg, 'drawHud'); if (dh) dh(g, s);
        drawBanner(g, s);
        if (s.q && s.q.open) s.q.draw(g);
      },
    });
  };

  // ======================= MAZE =======================
  var makeMaze = function (cols, rows, loops) {
    cols = cols | 1; rows = rows | 1; var m = [], x, y;
    for (y = 0; y < rows; y++) { m.push([]); for (x = 0; x < cols; x++) m[y].push('#'); }
    var st = [[1, 1]]; m[1][1] = '.';
    while (st.length) {
      var c = st[st.length - 1], nb = [];
      [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(function (d) { var nx = c[0] + d[0], ny = c[1] + d[1]; if (nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && m[ny][nx] === '#') nb.push([nx, ny, d]); });
      if (!nb.length) { st.pop(); continue; }
      var n = UB.pick(nb); m[c[1] + n[2][1] / 2][c[0] + n[2][0] / 2] = '.'; m[n[1]][n[0]] = '.'; st.push([n[0], n[1]]);
    }
    for (var k = 0; k < (loops || 0); k++) { x = UB.randInt(1, cols - 2); y = UB.randInt(1, rows - 2); if (m[y][x] === '#' && ((m[y][x - 1] === '.' && m[y][x + 1] === '.') || (m[y - 1][x] === '.' && m[y + 1][x] === '.'))) m[y][x] = '.'; }
    return m;
  };
  K.maze = function (cfg) {
    var T = texts(cfg), L = cfg.levels || [{ size: 11 }], ask = deck(cfg.questions);
    UB.touchControls(['left', 'right', 'up', 'down']);
    menuScene(cfg, T); overScene(cfg, T);
    UB.scene('play', {
      enter: function (s, d) {
        s.li = d.level || 0; var lv = s.lv = L[s.li] || L[0];
        s.score = d.score || 0; s.maxLives = cfg.lives || 3; s.lives = d.lives == null ? s.maxLives : d.lives; s.inv = 0; s.power = 0; s.t = 0; s.over = false;
        var cols = (lv.cols || lv.size || 11) | 1, rows = (lv.rows || Math.round((lv.size || 11) * 0.6)) | 1;
        if (rows < 7) rows = 7;
        var m = makeMaze(cols, rows, Math.round(cols * rows * (lv.loops == null ? 0.04 : lv.loops)));
        var free = []; for (var y = 1; y < rows - 1; y++) for (var x = 1; x < cols - 1; x++) if (m[y][x] === '.' && (x > 3 || y > 3)) free.push([x, y]);
        free = UB.shuffle(free);
        m[rows - 2][cols - 2] = 'X';
        var take = function (ch, n, farFromStart) { for (var i = 0; i < n && free.length; i++) { var idx = farFromStart ? free.findIndex(function (f) { return f[0] + f[1] > (cols + rows) / 2; }) : 0; var f = free.splice(Math.max(0, idx), 1)[0]; if (m[f[1]][f[0]] === '.') m[f[1]][f[0]] = ch; } };
        take('i', lv.items == null ? 5 : lv.items); take('E', lv.enemies || 0, true); take('D', cfg.questions && cfg.questions.length ? (lv.doors || 0) : 0); take('H', lv.hearts || 0); take('*', lv.stars || 0);
        var tile = Math.floor(Math.min(56, W() / cols, (H() - 70) / rows));
        s.cam2 = tile < 30; if (s.cam2) tile = 40;
        s.lvl = UB.level(m.map(function (r) { return r.join(''); }), { tile: tile }); s.tile = tile;
        s.ox = s.cam2 ? 0 : Math.floor((W() - cols * tile) / 2); s.oy = s.cam2 ? 0 : Math.floor(64 + (H() - 64 - rows * tile) / 2);
        var hs = tile * 0.62;
        s.hero = { x: tile + (tile - hs) / 2, y: tile + (tile - hs) / 2, w: hs, h: hs, vx: 0, vy: 0, facing: 1 };
        s.items = s.lvl.cells.filter(function (c) { return c.ch !== 'E'; }).map(function (c) { return { ch: c.ch, name: c.ch === 'i' ? (cfg.item && cfg.item.name) || 'item' : c.ch, x: c.x, y: c.y, ph: Math.random() * 6 }; });
        s.doors = s.lvl.cells.filter(function (c) { return c.ch === 'D'; }).map(function (c) { var dd = { x: c.x, y: c.y, w: tile, h: tile, door: true }; s.lvl.solids.push(dd); return dd; });
        s.items = s.items.filter(function (i) { return i.ch !== 'D'; });
        s.enemies = s.lvl.find('E').map(function (c) { var es = tile * 0.66; return { x: c.x + (tile - es) / 2, y: c.y + (tile - es) / 2, w: es, h: es, path: [], repath: 0 }; });
        s.need = s.items.filter(function (i) { return i.ch === 'i'; }).length; s.got = 0;
        if (s.cam2) s.cam = UB.camera2d({ follow: s.hero, bounds: s.lvl.bounds, lerp: 8 });
        actions(cfg, T, s, ask, function () { nextLevel(cfg, T, s, L); }, function () { UB.go('over', { score: s.score, won: false, stars: 0 }); });
        UB.music(lv.music || cfg.music || 'calm'); levelBanner(s, T, lv, s.li); UB.score(s.score);
        var h = hook(cfg, 'start'); if (h) h(s, lv);
      },
      update: function (s, dt) {
        if (s.q && s.q.open) return;
        s.t += dt; s.inv -= dt; s.power -= dt;
        if (s.over) return;
        var hero = s.hero, tile = s.tile, lv = s.lv;
        UB.topdown(hero, s.lvl.solids, dt, { speed: (cfg.speed || tile * 4.2) * (s.power > 0 ? 1.35 : 1) });
        var hc = { x: hero.x + hero.w / 2, y: hero.y + hero.h / 2 };
        s.items.forEach(function (it) {
          if (it.dead || Math.hypot(it.x + tile / 2 - hc.x, it.y + tile / 2 - hc.y) > tile * 0.55) return;
          if (it.ch === 'i') { it.dead = true; s.got++; s.addScore((cfg.item && cfg.item.score) || 10, it.x + tile / 2, it.y); UB.sfx('coin'); UB.burst(it.x + tile / 2, it.y + tile / 2, { color: cfg.item && cfg.item.color, count: 10 }); if (s.got === s.need) { UB.sfx('powerup'); UB.popup(T.exitOpen, hc.x, hc.y - 30, { color: '#06d6a0' }); } var hp = hook(cfg, 'pickup'); if (hp) hp(s, it); }
          else if (it.ch === 'H') { it.dead = true; s.heal(); }
          else if (it.ch === '*') { it.dead = true; s.power = 6; UB.sfx('powerup'); }
          else if (it.ch === 'X') { if (s.got >= s.need) s.win(); else if (!(it.warn > s.t)) { it.warn = s.t + 2; UB.popup(T.exitLocked, hc.x, hc.y - 30, { color: '#ffd166', size: 20 }); } }
        });
        s.doors.forEach(function (dr) {
          if (dr.dead || dr.wait > s.t) return;
          if (UB.overlap({ x: hero.x - 5, y: hero.y - 5, w: hero.w + 10, h: hero.h + 10 }, dr)) { dr.wait = s.t + 2; s.ask(function (ok) { if (ok) { dr.dead = true; s.addScore(cfg.quizScore || 30, dr.x + tile / 2, dr.y); UB.burst(dr.x + tile / 2, dr.y + tile / 2, { count: 20 }); } else s.hurt(); }); }
        });
        s.enemies.forEach(function (e) {
          e.repath -= dt;
          if (e.repath <= 0) { e.repath = 0.6; e.path = UB.path(s.lvl, { x: e.x + e.w / 2, y: e.y + e.h / 2 }, hc).slice(1); }
          var tgt = e.path[0]; if (tgt) { var dx = tgt.x - (e.x + e.w / 2), dy = tgt.y - (e.y + e.h / 2), dd = Math.hypot(dx, dy); var sp = (lv.enemySpeed || tile * 2.3) * dt; if (dd <= sp) { e.x += dx; e.y += dy; e.path.shift(); } else { e.x += dx / dd * sp; e.y += dy / dd * sp; } }
          if (UB.overlap({ x: hero.x + 4, y: hero.y + 4, w: hero.w - 8, h: hero.h - 8 }, e)) { if (s.power > 0) { UB.burst(e.x, e.y); e.x = (s.lvl.cols - 2) * tile; e.y = (s.lvl.rows.length - 2) * tile; s.addScore(20, hc.x, hc.y); } else { s.hurt(); } }
        });
        if (lv.time) { s.left = lv.time - s.t; if (s.left <= 0) s.lose(); }
        var hu = hook(cfg, 'update'); if (hu) hu(s, dt);
      },
      draw: function (g, s) {
        var lv = s.lv, col = lv.colors || cfg.colors || {}, tile = s.tile, hero = s.hero;
        if (lv.background || cfg.background) sky(g, lv.background || cfg.background, 0); else g.gradient(col.bg || '#1b2a49', col.bg2 || '#0d1b2a');
        var body = function () {
          g.rect(0, 0, s.lvl.w, s.lvl.h, col.floor || 'rgba(255,255,255,.08)');
          s.lvl.solids.forEach(function (c) {
            if (c.dead) return;
            if (c.door) { g.roundRect(c.x + 3, c.y + 3, tile - 6, tile - 6, 6, col.door || '#9c6644'); g.text('?', c.x + tile / 2, c.y + tile / 2, { align: 'center', baseline: 'middle', size: tile * 0.5, color: '#ffd166' }); return; }
            g.roundRect(c.x + 1, c.y + 1, tile - 2, tile - 2, Math.min(8, tile * 0.2), col.wall || '#4361ee');
            g.rect(c.x + 1, c.y + 1, tile - 2, Math.max(3, tile * 0.18), col.wallTop || 'rgba(255,255,255,.18)');
          });
          s.items.forEach(function (it) {
            if (it.dead) return; var cx = it.x + tile / 2, cy = it.y + tile / 2, b = UB.wave(3, 3, it.ph);
            if (it.ch === 'i') art(g, Object.assign({ shape: 'gem', color: '#ffd166' }, cfg.item), cx, cy + b, tile * 0.6, tile * 0.6);
            else if (it.ch === 'H') UB.hud.hearts(cx - tile * 0.2, cy - tile * 0.2, 1, 1, { size: tile * 0.4 });
            else if (it.ch === '*') star(g, cx, cy + b, tile * 0.3, '#ffd166');
            else if (it.ch === 'X') { var open = s.got >= s.need; g.roundRect(it.x + 4, it.y + 4, tile - 8, tile - 8, 8, open ? '#06d6a0' : '#495057'); if (open) g.ring(cx, cy, tile * 0.3 + UB.wave(5, 3), '#fff', 3); else g.text('X', cx, cy, { align: 'center', baseline: 'middle', size: tile * 0.45, color: '#adb5bd' }); }
          });
          s.enemies.forEach(function (e) { art(g, cfg.enemy || { color: '#ef476f' }, e.x + e.w / 2, e.y + e.h / 2, e.w * 1.2, e.h * 1.2); });
          if (!(s.inv > 0 && Math.floor(s.t * 14) % 2 === 0)) { if (s.power > 0) g.circle(hero.x + hero.w / 2, hero.y + hero.h / 2, hero.w, 'rgba(255,209,102,.35)'); art(g, cfg.hero, hero.x + hero.w / 2, hero.y + hero.h / 2 + UB.wave(10, 1.5), hero.w * 1.45, hero.h * 1.45, { flip: hero.facing < 0 }); }
          var dw = hook(cfg, 'drawWorld'); if (dw) dw(g, s);
        };
        if (s.cam2) g.world(body); else { g.ctx.save(); g.ctx.translate(s.ox, s.oy); body(); g.ctx.restore(); }
        UB.hud.score(s.score, { label: T.score });
        g.text(s.got + ' / ' + s.need, W() / 2, 26, { align: 'center', size: 24, color: '#ffd166', shadow: true });
        UB.hud.hearts(W() - 16 - Math.max(s.lives, s.maxLives) * 32, 22, s.lives, s.maxLives, { size: 24 });
        if (lv.time) UB.hud.timer(s.left, W() - 70, 52, { size: 22 });
        var dh = hook(cfg, 'drawHud'); if (dh) dh(g, s);
        drawBanner(g, s);
        if (s.q && s.q.open) s.q.draw(g);
      },
    });
  };

  // ======================= QUIZ SHOOTER =======================
  K.shooter = function (cfg) {
    var T = texts(cfg), L = cfg.levels || [{ questions: 6 }], ask = deck(cfg.questions);
    UB.touchControls(['left', 'right', 'fire']);
    menuScene(cfg, T); overScene(cfg, T);
    var newQ = function (s) {
      var q = ask(); if (!q) { s.win(); return; }
      s.cur = q; s.targets = [];
      var n = q.options.length, xs = UB.shuffle(Array.from({ length: n }, function (_, i) { return (i + 0.5) * W() / n; }));
      q.options.forEach(function (o, i) { s.targets.push({ label: String(o), ok: i === q.correct, x: xs[i] + UB.rand(-30, 30), y: 110 + UB.rand(0, 60), vy: (s.lv.speed || 45) + s.qi * 2, ph: Math.random() * 6, r: 46 }); });
    };
    UB.scene('play', {
      enter: function (s, d) {
        s.li = d.level || 0; var lv = s.lv = L[s.li] || L[0];
        s.score = d.score || 0; s.maxLives = cfg.lives || 3; s.lives = d.lives == null ? s.maxLives : d.lives; s.inv = 0; s.power = 0; s.t = 0; s.over = false;
        s.ship = { x: W() / 2, y: H() - 70, w: 64, h: 64 }; s.shots = []; s.rocks = []; s.drops = []; s.cool = 0; s.qi = 0; s.need = lv.questions || 6; s.streak = 0; s.triple = 0;
        s.boss = lv.boss ? { def: lv.boss, hp: lv.boss.hp || 5, max: lv.boss.hp || 5, x: W() / 2, y: 120, shot: 2 } : null;
        if (s.boss) s.need = s.boss.hp + 99;
        actions(cfg, T, s, ask, function () { nextLevel(cfg, T, s, L); }, function () { UB.go('over', { score: s.score, won: false, stars: 0 }); });
        UB.music(lv.music || cfg.music || (s.boss ? 'boss' : 'space')); levelBanner(s, T, lv, s.li); UB.score(s.score);
        newQ(s);
        var h = hook(cfg, 'start'); if (h) h(s, lv);
      },
      update: function (s, dt) {
        s.t += dt; s.inv -= dt; s.power -= dt; s.triple -= dt; s.cool -= dt;
        if (s.over) return;
        var sh = s.ship, sp = cfg.speed || 460;
        if (UB.key('left')) sh.x -= sp * dt; if (UB.key('right')) sh.x += sp * dt;
        if (UB.isTouch && UB.pointer.down && UB.pointer.y > H() * 0.5) sh.x += (UB.pointer.x - sh.x) * Math.min(1, dt * 10);
        sh.x = UB.clamp(sh.x, 36, W() - 36);
        if ((UB.key('fire') || (UB.isTouch && UB.pointer.down)) && s.cool <= 0) {
          s.cool = 0.22; UB.sfx('shoot');
          (s.triple > 0 ? [-0.25, 0, 0.25] : [0]).forEach(function (a) { s.shots.push({ x: sh.x, y: sh.y - 34, vx: Math.sin(a) * 700, vy: -Math.cos(a) * 700 }); });
        }
        s.shots.forEach(function (b) { b.x += b.vx * dt; b.y += b.vy * dt; }); s.shots = s.shots.filter(function (b) { return b.y > -20 && !b.dead; });
        // answer targets
        var tg = s.targets || [];
        tg.forEach(function (t) {
          t.y += t.vy * dt * (s.power > 0 ? 0.4 : 1); t.x += Math.sin(s.t * 1.5 + t.ph) * 30 * dt;
          s.shots.forEach(function (b) {
            if (b.dead || t.dead || Math.hypot(b.x - t.x, b.y - t.y) > t.r) return;
            b.dead = true; t.dead = true;
            if (t.ok) {
              s.streak++; var pts = (cfg.quizScore || 20) * Math.min(4, 1 + Math.floor(s.streak / 3));
              s.addScore(pts, t.x, t.y); UB.sfx('correct'); UB.burst(t.x, t.y, { count: 30 }); if (s.streak % 3 === 0) UB.popup('x' + Math.min(4, 1 + Math.floor(s.streak / 3)), t.x, t.y - 40, { color: '#06d6a0' });
              if (s.boss) { s.boss.hp--; UB.shake(6, 0.2); if (s.boss.hp <= 0) { UB.burst(s.boss.x, s.boss.y, { count: 60 }); s.addScore(200, s.boss.x, s.boss.y); s.win(); return; } }
              s.qi++; var ha = hook(cfg, 'answer'); if (ha) ha(s, true);
              if (s.qi >= s.need) s.win(); else UB.after(0.6, function () { newQ(s); });
              s.targets.forEach(function (o) { o.dead = true; });
            } else { s.streak = 0; UB.sfx('wrong'); UB.burst(t.x, t.y, { color: '#ef476f' }); s.hurt(); var hw = hook(cfg, 'answer'); if (hw) hw(s, false); }
          });
          if (!t.dead && t.y > H() + 40) { t.dead = true; if (t.ok) { s.streak = 0; s.hurt(); s.targets.forEach(function (o) { o.dead = true; }); if (!s.over) UB.after(0.6, function () { newQ(s); }); } }
        });
        // rocks in the way and bonuses from them
        if (Math.random() < dt * (s.lv.rocks == null ? 0.5 : s.lv.rocks)) s.rocks.push({ x: UB.rand(30, W() - 30), y: -30, vy: UB.rand(120, 220), r: UB.rand(16, 26), rot: 0 });
        s.rocks.forEach(function (r) {
          r.y += r.vy * dt; r.rot += dt;
          s.shots.forEach(function (b) { if (!b.dead && !r.dead && Math.hypot(b.x - r.x, b.y - r.y) < r.r) { b.dead = true; r.dead = true; UB.burst(r.x, r.y, { color: '#adb5bd' }); s.addScore(5, r.x, r.y); if (Math.random() < 0.25) s.drops.push({ x: r.x, y: r.y, kind: UB.pick(['triple', 'slow', 'heart']) }); } });
          if (!r.dead && Math.hypot(r.x - sh.x, r.y - sh.y) < r.r + 26) { r.dead = true; s.hurt(); }
        });
        s.rocks = s.rocks.filter(function (r) { return !r.dead && r.y < H() + 40; });
        s.drops.forEach(function (p) { p.y += 140 * dt; if (Math.hypot(p.x - sh.x, p.y - sh.y) < 40) { p.dead = true; UB.sfx('powerup'); if (p.kind === 'triple') s.triple = 8; else if (p.kind === 'slow') s.power = 5; else s.heal(); } });
        s.drops = s.drops.filter(function (p) { return !p.dead && p.y < H() + 20; });
        if (s.boss) { var b = s.boss; b.x = W() / 2 + Math.sin(s.t * 0.8) * (W() / 2 - 120); b.shot -= dt; if (b.shot <= 0) { b.shot = 1.6; s.rocks.push({ x: b.x, y: b.y + 40, vy: 260, r: 14, rot: 0 }); } }
        var hu = hook(cfg, 'update'); if (hu) hu(s, dt);
      },
      draw: function (g, s) {
        var lv = s.lv;
        sky(g, lv.background || cfg.background || ['#0b1026', '#1d2b64', 'rgba(255,255,255,.06)', 'rgba(255,255,255,.04)'], s.t * 20);
        for (var i = 0; i < 40; i++) { var sx = (i * 137) % W(), sy = (i * 89 + s.t * (20 + (i % 3) * 25)) % H(); g.circle(sx, sy, 1 + (i % 3) * 0.6, 'rgba(255,255,255,.6)'); }
        if (s.boss) { art(g, s.boss.def, s.boss.x, s.boss.y, 150, 150); UB.hud.bar(s.boss.x - 80, s.boss.y - 95, 160, 12, s.boss.hp / s.boss.max, { color: '#ef476f' }); }
        s.rocks.forEach(function (r) { if (cfg.hazard) art(g, cfg.hazard, r.x, r.y, r.r * 2.2, r.r * 2.2, { rot: r.rot }); else { g.circle(r.x, r.y, r.r, '#6c757d'); g.circle(r.x - r.r * 0.3, r.y - r.r * 0.2, r.r * 0.3, '#495057'); } });
        (s.targets || []).forEach(function (t) {
          if (t.dead) return;
          art(g, Object.assign({ shape: 'gem', color: '#8ecae6' }, cfg.target), t.x, t.y, t.r * 2.2, t.r * 2.2);
          g.ctx.font = '700 24px system-ui'; var tw = Math.max(70, g.ctx.measureText(t.label).width + 24);
          g.roundRect(t.x - tw / 2, t.y + t.r - 6, tw, 36, 12, 'rgba(255,255,255,.95)');
          g.text(t.label, t.x, t.y + t.r + 12, { align: 'center', baseline: 'middle', size: t.label.length > 12 ? 17 : 22, color: '#1b1b2f' });
        });
        s.drops.forEach(function (p) { if (p.kind === 'heart') UB.hud.hearts(p.x - 12, p.y - 12, 1, 1, { size: 24 }); else { gem(g, p.x, p.y, 14, p.kind === 'triple' ? '#f72585' : '#4cc9f0'); g.text(p.kind === 'triple' ? '3' : 'S', p.x, p.y, { align: 'center', baseline: 'middle', size: 14, color: '#fff' }); } });
        s.shots.forEach(function (b) { g.roundRect(b.x - 3, b.y - 10, 6, 20, 3, '#ffd166'); });
        if (!(s.inv > 0 && Math.floor(s.t * 14) % 2 === 0)) art(g, cfg.hero || { color: '#4cc9f0' }, s.ship.x, s.ship.y, 76, 76);
        var dw = hook(cfg, 'drawWorld'); if (dw) dw(g, s);
        if (s.cur) { UB.hud.panel(W() / 2 - 320, 12, 640, 64); g.text(s.cur.q, W() / 2, 44, { align: 'center', baseline: 'middle', size: String(s.cur.q).length > 40 ? 20 : 26, color: '#fff' }); }
        UB.hud.score(s.score, { y: 86, label: T.score });
        UB.hud.hearts(W() - 16 - Math.max(s.lives, s.maxLives) * 32, 96, s.lives, s.maxLives, { size: 24 });
        if (!s.boss) UB.hud.bar(16, 140, 160, 10, s.qi / s.need, { color: '#06d6a0' });
        var dh = hook(cfg, 'drawHud'); if (dh) dh(g, s);
        drawBanner(g, s);
      },
    });
  };

  // ======================= QUIZ: one player (boss battle) or teams on phones =======================
  K.quiz = function (cfg) {
    var T = texts(cfg);
    if (UB.net && UB.net.role === 'host') return quizHost(cfg, T);
    if (UB.net && UB.net.role === 'player') return quizPlayer(cfg, T);
    var L = cfg.levels || [{ questions: 8 }], ask = deck(cfg.questions);
    menuScene(cfg, T); overScene(cfg, T);
    UB.scene('play', {
      enter: function (s, d) {
        s.li = d.level || 0; var lv = s.lv = L[s.li] || L[0];
        s.score = d.score || 0; s.maxLives = cfg.lives || 3; s.lives = d.lives == null ? s.maxLives : d.lives; s.inv = 0; s.power = 0; s.t = 0; s.over = false; s.streak = 0;
        s.foe = { def: lv.boss || cfg.enemy || { color: '#ef476f' }, hp: lv.questions || 8, max: lv.questions || 8, dx: 0, hit: 0 }; s.hero = { dx: 0, hit: 0 };
        actions(cfg, T, s, ask, function () { nextLevel(cfg, T, s, L); }, function () { UB.go('over', { score: s.score, won: false, stars: 0 }); });
        UB.music(lv.music || cfg.music || (lv.boss ? 'boss' : 'tense')); levelBanner(s, T, lv, s.li); UB.score(s.score);
        var round = function () {
          if (s.over) return;
          var q = ask(); if (!q) { s.win(); return; }
          s.q = UB.quiz({ q: q.q, options: q.options, correct: q.correct, time: lv.time || cfg.quizTime || 15, dim: false, onAnswer: function (ok) {
            s.q = null;
            if (ok) { s.streak++; var pts = (cfg.quizScore || 10) * Math.min(5, 1 + Math.floor(s.streak / 3)); s.addScore(pts, UB.width * 0.72, UB.height * 0.35); s.foe.hp--; s.hero.dx = 1; UB.tween(s.hero, { dx: 0 }, 0.5, 'outQuad'); s.foe.hit = 1; UB.tween(s.foe, { hit: 0 }, 0.5); }
            else { s.streak = 0; s.foe.dx = 1; UB.tween(s.foe, { dx: 0 }, 0.5, 'outQuad'); s.hurt(); }
            var ha = hook(cfg, 'answer'); if (ha) ha(s, ok);
            if (s.foe.hp <= 0) { UB.burst(UB.width * 0.75, UB.height * 0.5, { count: 50 }); s.win(); } else UB.after(1.1, round);
          } });
        };
        UB.after(1.4, round);
        var h = hook(cfg, 'start'); if (h) h(s, lv);
      },
      update: function (s, dt) { s.t += dt; s.inv -= dt; var hu = hook(cfg, 'update'); if (hu) hu(s, dt); },
      draw: function (g, s) {
        var lv = s.lv; sky(g, lv.background || cfg.background || ['#2b2d42', '#8d99ae'], s.t * 10);
        var gy = H() * 0.84; g.rect(0, gy + 40, W(), H() - gy, 'rgba(0,0,0,.18)');
        art(g, cfg.hero, W() * 0.18 + s.hero.dx * W() * 0.3, gy - 20 + UB.wave(3, 5), 130, 130, { alpha: s.inv > 0 && Math.floor(s.t * 14) % 2 === 0 ? 0.35 : 1 });
        art(g, s.foe.def, W() * 0.82 - s.foe.dx * W() * 0.3, gy - 20 + UB.wave(2.5, 6, 1), 140, 140, { flip: true, alpha: s.foe.hit > 0.5 ? 0.5 : 1 });
        UB.hud.bar(W() * 0.82 - 80, gy - 104, 160, 12, s.foe.hp / s.foe.max, { color: '#ef476f' });
        var dw = hook(cfg, 'drawWorld'); if (dw) dw(g, s);
        UB.hud.score(s.score, { label: T.score }); UB.hud.hearts(W() - 16 - Math.max(s.lives, s.maxLives) * 32, 22, s.lives, s.maxLives, { size: 24 });
        if (s.streak >= 3) g.text('x' + Math.min(5, 1 + Math.floor(s.streak / 3)), W() / 2, 30, { align: 'center', size: 28, color: '#06d6a0', shadow: true });
        var dh = hook(cfg, 'drawHud'); if (dh) dh(g, s);
        drawBanner(g, s);
        if (s.q && s.q.open) s.q.draw(g);
      },
    });
  };
  // team quiz: the host screen shows the question, timer and a tug-of-war rope between teams; phones show four big buttons
  var OPT = ['#ef476f', '#ffd166', '#06d6a0', '#4cc9f0'];
  var quizHost = function (cfg, T) {
    var qs = UB.shuffle(cfg.questions || []).slice(0, cfg.rounds || 10), time = cfg.quizTime || 15;
    var teamName = function (t) { return t ? T.team1 : T.team0; };
    UB.scene('menu', {
      enter: function (s) { s.t = 0; UB.net.broadcast({ phase: 'lobby' }); },
      update: function (s, dt) { s.t += dt; },
      draw: function (g, s) {
        sky(g, cfg.background || ['#1b1f3a', '#3a0ca3'], s.t * 20);
        g.text(cfg.title || '', W() / 2, 70, { align: 'center', baseline: 'middle', size: 54, color: '#fff', shadow: true });
        g.text(T.lobby, W() / 2, 130, { align: 'center', baseline: 'middle', size: 24, color: '#ffd166' });
        var ps = UB.net.players();
        [0, 1].forEach(function (tm) {
          var x = tm ? W() * 0.53 : W() * 0.07, w = W() * 0.4; UB.hud.panel(x, 170, w, H() - 290);
          g.text(teamName(tm), x + w / 2, 200, { align: 'center', baseline: 'middle', size: 28, color: TEAM[tm] });
          ps.filter(function (p) { return p.team === tm; }).slice(0, 12).forEach(function (p, i) { g.text(p.name, x + 24 + (i % 2) * w / 2, 240 + Math.floor(i / 2) * 32, { size: 20, color: '#fff' }); });
        });
        if (g.button(T.start, W() / 2 - 120, H() - 96, 240, 62, { size: 28 })) { if (ps.length) UB.go('play'); else UB.popup(T.needPlayers, W() / 2, H() - 120, { color: '#ef476f', size: 22 }); }
      },
    });
    UB.scene('play', {
      enter: function (s) {
        s.i = -1; s.score = [0, 0]; s.phase = 'q'; s.t = 0; s.tug = 0;
        UB.music(cfg.music || 'tense');
        s.next = function () {
          s.i++; if (s.i >= qs.length) { UB.store.kitTeamFinal = s.score.slice(); UB.go('over'); return; }
          s.q = qs[s.i]; s.phase = 'q'; s.left = time; s.ans = {};
          UB.net.broadcast({ phase: 'q', i: s.i, q: s.q.q, options: s.q.options, n: qs.length });
        };
        s.next();
      },
      update: function (s, dt) {
        s.t += dt;
        UB.net.inbox().forEach(function (m) { if (s.phase === 'q' && m.data && m.data.i === s.i && s.ans[m.from] == null && typeof m.data.a === 'number') s.ans[m.from] = { a: m.data.a, at: s.left }; });
        if (s.phase === 'q') {
          s.left -= dt; var ps = UB.net.players();
          if (s.left <= 0 || (ps.length && Object.keys(s.ans).length >= ps.length)) {
            s.phase = 'reveal'; s.left = 4; var got = [0, 0];
            ps.forEach(function (p) { var a = s.ans[p.id]; if (a && a.a === s.q.correct) { var pts = 10 + Math.round(a.at / time * 10); s.score[p.team] += pts; got[p.team] += pts; } });
            s.got = got; s.tug = UB.clamp((s.score[1] - s.score[0]) / Math.max(40, s.score[0] + s.score[1]), -1, 1);
            UB.sfx(got[0] + got[1] ? 'correct' : 'wrong'); UB.score(Math.max(s.score[0], s.score[1]));
            UB.net.broadcast({ phase: 'reveal', i: s.i, correct: s.q.correct, score: s.score });
          }
        } else if (s.phase === 'reveal') { s.left -= dt; if (s.left <= 0) s.next(); }
      },
      draw: function (g, s) {
        sky(g, cfg.background || ['#1b1f3a', '#3a0ca3'], s.t * 15);
        if (!s.q) return;
        g.text(T.question + ' ' + (s.i + 1) + ' / ' + qs.length, W() / 2, 30, { align: 'center', size: 20, color: 'rgba(255,255,255,.8)' });
        UB.hud.panel(40, 60, W() - 80, 120);
        g.textBox(s.q.q, W() / 2, 82, W() - 140, { size: String(s.q.q).length > 60 ? 26 : 34, align: 'center', color: '#fff' });
        s.q.options.forEach(function (o, i) {
          var x = 40 + (i % 2) * (W() - 80) / 2, y = 200 + Math.floor(i / 2) * 82, w = (W() - 100) / 2, rv = s.phase === 'reveal';
          g.roundRect(x + (i % 2) * 20, y, w, 70, 16, rv ? (i === s.q.correct ? '#06d6a0' : 'rgba(255,255,255,.15)') : OPT[i % 4]);
          g.text(o, x + (i % 2) * 20 + w / 2, y + 35, { align: 'center', baseline: 'middle', size: 26, color: rv && i !== s.q.correct ? 'rgba(255,255,255,.5)' : '#1b1b2f' });
        });
        if (s.phase === 'q') UB.hud.bar(40, 372, W() - 80, 14, s.left / time); else [0, 1].forEach(function (t) { if (s.got[t]) UB.popup('+' + s.got[t], t ? W() * 0.8 : W() * 0.2, 380, { color: TEAM[t] }); s.got[t] = 0; });
        // the rope moves toward the leading team
        var cy = H() - 80, cx = W() / 2 + s.tug * (W() * 0.3);
        g.line(80, cy, W() - 80, cy, '#c9a227', 8); g.rect(cx - 6, cy - 26, 12, 52, '#fff');
        [0, 1].forEach(function (t) { g.text(teamName(t) + ': ' + s.score[t], t ? W() - 60 : 60, cy - 40, { align: t ? 'right' : 'left', size: 26, color: TEAM[t], shadow: true }); });
        var answered = Object.keys(s.ans).length; g.text(answered + ' / ' + UB.net.players().length, W() - 50, 30, { align: 'right', size: 20, color: '#fff' });
      },
    });
    UB.scene('over', {
      enter: function (s) {
        s.t = 0; s.final = UB.store.kitTeamFinal || [0, 0];
        UB.music(null); UB.sfx('win'); UB.burst(W() / 2, 170, { count: 50 });
        UB.net.broadcast({ phase: 'over', score: s.final }); UB.finish({ score: Math.max(s.final[0], s.final[1]), won: true });
      },
      update: function (s, dt) { s.t += dt; },
      draw: function (g, s) {
        sky(g, cfg.background || ['#1b1f3a', '#3a0ca3'], 0);
        g.text(T.results, W() / 2, 80, { align: 'center', baseline: 'middle', size: 50, color: '#fff' });
        var sc = s.final || [0, 0], w = sc[0] === sc[1] ? -1 : sc[0] > sc[1] ? 0 : 1;
        g.text(w < 0 ? T.draw : teamName(w) + ' ' + T.wins, W() / 2, 170, { align: 'center', baseline: 'middle', size: 44, color: w < 0 ? '#ffd166' : TEAM[w] });
        [0, 1].forEach(function (t) { g.text(teamName(t) + ': ' + sc[t], W() / 2 + (t ? 160 : -160), 260, { align: 'center', baseline: 'middle', size: 34, color: TEAM[t] }); });
        if (g.button(T.again, W() / 2 - 130, H() - 120, 260, 60, { size: 26 })) UB.go('play');
      },
    });
  };
  var quizPlayer = function (cfg, T) {
    UB.create({ width: 540, height: 960, background: '#141833' });
    UB.scene('menu', {
      enter: function (s) { s.mine = null; s.lastI = -1; },
      update: function (s) { var st = UB.net.state; if (st && st.phase === 'q' && st.i !== s.lastI) { s.lastI = st.i; s.mine = null; } },
      draw: function (g, s) {
        var me = UB.net.me || { team: 0, name: '' }, st = UB.net.state, tc = TEAM[me.team || 0];
        g.rect(0, 0, W(), 12, tc);
        g.text(T.yourTeam + ': ' + (me.team ? T.team1 : T.team0), W() / 2, 50, { align: 'center', baseline: 'middle', size: 28, color: tc });
        g.text(me.name || '', W() / 2, 90, { align: 'center', baseline: 'middle', size: 22, color: 'rgba(255,255,255,.7)' });
        if (!st || st.phase === 'lobby') { g.text(T.waiting, W() / 2, H() / 2, { align: 'center', baseline: 'middle', size: 30, color: '#fff' }); return; }
        if (st.phase === 'over') { var sc = st.score || [0, 0], my = sc[me.team || 0], other = sc[me.team ? 0 : 1]; g.text(my > other ? T.win : my === other ? T.draw : T.lose, W() / 2, H() / 2, { align: 'center', baseline: 'middle', size: 52, color: my >= other ? '#ffd166' : '#ff8fa3' }); return; }
        g.textBox(st.q || '', W() / 2, 140, W() - 60, { size: 26, align: 'center', color: '#fff' });
        (st.options || []).forEach(function (o, i) {
          var y = 330 + i * 140, rv = st.phase === 'reveal', col = rv ? (i === st.correct ? '#06d6a0' : s.mine === i ? '#ef476f' : 'rgba(255,255,255,.15)') : s.mine == null ? OPT[i % 4] : s.mine === i ? '#ffffff' : 'rgba(255,255,255,.2)';
          if (g.button(String(o), 30, y, W() - 60, 120, { color: col, hover: rv || s.mine != null ? col : '#ffffff', size: String(o).length > 18 ? 24 : 32, radius: 24 }) && s.mine == null && st.phase === 'q') { s.mine = i; UB.net.send({ i: st.i, a: i }); UB.sfx('click'); }
        });
        if (st.phase === 'q' && s.mine != null) g.text(T.answered, W() / 2, H() - 40, { align: 'center', baseline: 'middle', size: 26, color: '#ffd166' });
        if (st.phase === 'reveal') g.text(s.mine === st.correct ? T.correct : T.wrong, W() / 2, H() - 40, { align: 'center', baseline: 'middle', size: 34, color: s.mine === st.correct ? '#06d6a0' : '#ef476f' });
      },
    });
    UB.scene('play', { draw: function () {} }); UB.scene('over', { draw: function () {} });
  };

})();
