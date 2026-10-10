# UpBilim Engine API

This is the complete reference. It is the same text the UpBilim AI reads before it writes a game, so it is compact: one line per function, with the options and defaults.

Loading:
- 2D only: `<script src="upbilim-engine.js"></script>`, then your game script.
- 3D: set `window.THREE` (three.js 0.160+) before loading the engine.
- Physics: also set `window.RAPIER` (`@dimforge/rapier3d-compat`), and start the game inside `UB.ready(() => { ... })`.

## 2D, input, sound, building blocks

```
The engine is the global `UB`. A game is plain JavaScript: create the screen, define scenes, start. Draw with shapes, emoji sprites and images (UB.image).

SETUP
  UB.create({ width: 960, height: 540, background: '#10142a' })   // logical resolution (auto-scaled to fit, letterboxed). Call once, first.
  UB.scene('play', { enter(s, data) {...}, update(s, dt) {...}, draw(g, s) {...} })   // s = fresh state object per scene entry; dt in seconds (<= 0.05)
  UB.go('over', { score: 10 })   // switch scene (state is reset, data passed to enter)
  UB.start('menu')               // start the loop with the first scene. Call last.
  The engine clears the screen with the background before each draw.

INPUT (logical coordinates)
  UB.key('left'|'right'|'up'|'down'|'jump'|'fire'|'Space'|'KeyX'...)   // held; arrows also mapped from WASD. 'jump'/'fire'/'action' = Space
  UB.pressed(name)               // true only on the frame it was pressed
  UB.pointer = { x, y, down, pressed, released }   // mouse or finger; pressed/released are one-frame flags
  UB.touchControls(['left','right','jump'])   // on-screen buttons on phones only (no-op on desktop); call in a scene enter or top level if the game uses keys
  UB.isTouch                     // true on touch devices (use to show "tap" vs "press Space" hints)

TWO PLAYERS ON ONE DEVICE (mode "duo")
  UB.p1.key(name) / UB.p1.pressed(name)   // player 1: WASD to move, F = action/jump/fire
  UB.p2.key(name) / UB.p2.pressed(name)   // player 2: arrows to move, Enter = action/jump/fire
  UB.touchControlsDuo(['left','right','action'])   // phones: player 1 pad on the left edge (blue), player 2 on the right (pink)
  In duo mode do NOT use UB.key / UB.touchControls for the players. Show both scores, a clear winner screen, colors blue (P1) and pink (P2).

DRAW (g)
  g.rect(x,y,w,h,color)  g.roundRect(x,y,w,h,r,color)  g.strokeRect(x,y,w,h,color,lw)
  g.circle(x,y,r,color)  g.ring(x,y,r,color,lw)  g.line(x1,y1,x2,y2,color,lw)  g.poly([[x,y],...],color)
  g.text(str,x,y,{ size:24, color:'#fff', align:'left'|'center'|'right', baseline:'top'|'middle', bold:true, shadow:false })
  g.sprite('char',x,y,size,{ flip, rot, alpha })   // centered emoji as a sprite (e.g. a cat, coin, star, rocket)
  g.image(name,x,y,w,h,{ flip, rot, alpha })   // centered AI-drawn picture of a design object (register it first: UB.image(name, url) before UB.start); unknown name -> colored placeholder
  g.gradient(topColor, bottomColor)   // full-screen vertical gradient background
  g.button(label,x,y,w,h,{ color, hover, textColor, size }) -> true when clicked/tapped this frame (draw AND check in draw())
  g.ctx                          // raw CanvasRenderingContext2D for anything else

EFFECTS & SOUND
  UB.burst(x,y,{ count:16, color, speed:260, size:5 })   // particle explosion
  UB.shake(8, 0.25)              // screen shake (amount px, seconds)
  UB.sfx('jump'|'coin'|'hit'|'shoot'|'click'|'correct'|'wrong'|'win'|'lose'|'powerup')

HELPERS
  UB.overlap(a,b) for {x,y,w,h}; UB.circleHit(a,b) for {x,y,r}; UB.pointIn(p,rect); UB.dist(a,b)
  UB.clamp(v,min,max) UB.rand(a,b) UB.randInt(a,b) UB.pick(arr) UB.shuffle(arr) UB.lerp(a,b,t)
  UB.width UB.height UB.time UB.store (persists across scenes, e.g. best score)

TEAM MODE (mode "team": a shared host screen — projector / teacher / room creator — plus every player's phone)
  The SAME program runs on the host screen and on each phone; branch on UB.net.role ('host' | 'player').
  Host: UB.net.players() -> [{ id, name, team }] (team 0 or 1, assigned automatically; list changes as people join/leave)
        for (const m of UB.net.inbox()) { m.from /* player id */; m.data /* what the phone sent */ }   // read every frame in update()
        UB.net.broadcast(state)   // the shared state for all phones (small JSON, no functions); call when it changes (sent max 10/s)
  Player: UB.net.me -> { id, name, team };  UB.net.state -> latest host state (null until the first broadcast)
        UB.net.send(data)   // an action for the host, e.g. { answer: 2 } (max 15/s)
  All game logic, timers and scoring live ONLY on the host; phones only send inputs and draw UB.net.state.
  Host: lobby scene (big title, joined players by team, Start button) -> rounds -> team results; UB.finish({ score, won: true }) at the end.
  Player: call UB.create({ width: 540, height: 960 }) for a portrait phone layout; big tap targets (g.button), show own team color and
  what to do now; no UB.touchControls needed (buttons are tapped). Teams: team 0 = blue '#4cc9f0', team 1 = pink '#f72585'.

BUILDING BLOCKS (use them — they are tested; spend your code on gameplay, levels and content, not plumbing)
  Timers & animation (reset on scene change, run on game time — never use setTimeout):
    UB.after(sec, fn)  UB.every(sec, fn)  -> { cancel() }      // waves, spawns, delayed events
    UB.tween(obj, { x, y, scale, alpha, ... }, sec, 'outBack'|'outQuad'|'inOut'|'outBounce'|'outElastic'|'linear', onDone)
    UB.wave(speed, amount, phase)   // sin of game time: bobbing, pulsing, floating
    UB.popup('+10', x, y, { color, size })   // floating text that rises and fades (score, "Combo x3", "Miss")
  Camera for levels bigger than the screen:
    const cam = UB.camera2d({ follow: hero, bounds: lvl.bounds, lerp: 8, zoom: 1 })   // create in enter(); it follows automatically
    draw(g, s) { g.world(() => { /* everything in WORLD coordinates */ }); /* HUD in screen coordinates */ }
    cam.toWorld(UB.pointer.x, UB.pointer.y) ; cam.visible(rect)  // particles/popups made while a camera exists are in world coordinates
  Levels from text (design 3+ levels as strings, '#' solid, '=' one-way platform, any other char is yours):
    const lvl = UB.level(['#..........C.....F#', '#..P....==....E...#', '###################'], { tile: 48 })
    lvl.solids  lvl.find('C') -> [{ x, y, w, h, col, row }]  lvl.first('P')  lvl.solidAt(x, y)  lvl.w  lvl.h  lvl.bounds
  Physics for rect bodies b = { x, y, w, h, vx, vy } (x, y = top-left):
    UB.platformer(b, lvl.solids, dt, { speed: 320, jump: 720, gravity: 1800, input: UB | UB.p1 | UB.p2 }) -> { ground, ceil, left, right }
       // acceleration, coyote time, jump buffer, higher jump while held — game feel included; b.onGround, b.facing
    UB.topdown(b, solids, dt, { speed: 260, input })   UB.move(b, solids, dt, { gravity })   // raw move with collisions
  Enemy behaviour: UB.ai.patrol(e, dt, { speed, level: lvl } | { min, max }) ; UB.ai.chase(e, target, dt, speed) ; UB.ai.flee(...) ;
    UB.ai.orbit(e, cx, cy, r, speed, phase) ; UB.path(lvl, from, to) -> [{x, y}] cell centers (maze chasers)
  HUD (call in draw): UB.hud.score(n, { label }) ; UB.hud.hearts(x, y, lives, maxLives) ; UB.hud.bar(x, y, w, h, 0..1, { label, color }) ;
    UB.hud.timer(secondsLeft, x, y) ; UB.hud.banner('Level 2', { size }) ; UB.hud.panel(x, y, w, h)
    g.textBox(text, x, y, maxWidth, { size, color, align }) -> height (word wrap) ; g.dialog(title, body) -> box rect (pause / hint / story)
  Quiz window (the standard way to ask a learning question — looks good, keyboard 1-4 and taps work):
    s.q = UB.quiz({ q: '7 x 8 = ?', options: ['54', '56', '64', '48'], correct: 1, time: 10, onAnswer: (ok) => { ... } })
    draw: if (s.q && s.q.open) s.q.draw(g)   // freeze gameplay in update while s.q && s.q.open
  Music: UB.music('happy'|'calm'|'tense'|'space'|'boss'|'retro') in 'play' enter (procedural loop, starts after the first tap/key) ; UB.music(null) to stop

PLATFORM
  UB.score(n)                    // report the current score whenever it changes
  UB.finish({ score, won })      // call once when a round ends (game over / victory)
```

## 3D and physics

```
3D needs three.js loaded as window.THREE before the engine. The engine wraps it: use the UB 3D API below (THREE stays available for anything else).
  UB.create3d({ sky: '#8fd3ff', fog: true, ground: true, groundColor: '#7ccf6b', groundSize: 240 })   // INSTEAD of UB.create, first line
  const e = UB.spawn({ shape: 'box'|'sphere'|'cylinder'|'cone'|'image', x, y, z, w, h, d /* box */, r /* sphere, cylinder, cone */, color, image: 'Name', solid: false, rotY: 0, glow: '#ffcc00', opacity })
     // units are meters; y is the CENTER height (a box standing on the ground: y = h / 2). Player-sized: 1 x 2 x 1.
     // 'image' = a flat picture (UB.image) that always faces the camera — use it for heroes, enemies and items (w, h).
     // solid: true = the player stands on it and bumps into it (platforms, walls, floors). The ground is already solid.
  e.x e.y e.z e.rotY e.visible e.data ; e.setColor('#ff0000') ; e.remove()
  UB.entities() ; UB.clear3d()   // removes every spawned object except the ground — call it in every scene enter() that builds a level
  UB.hit3d(a, b) (box overlap) ; UB.dist3d(a, b)
  const pc = UB.player3d(e, { speed: 7, jump: 10, gravity: 28 })   // built-in controls: WASD/arrows + Space, on phones a joystick + jump button;
     // moves relative to the camera, collides with solid objects; pc.onGround; pc.enabled = false to freeze; e.y < -10 means the player fell
  UB.camera3d({ mode: 'follow', target: e, distance: 9, height: 5 })   // camera stays behind (+z side): FORWARD is -z, build levels along -z
  UB.camera3d({ mode: 'top', target: e, height: 22 }) | UB.camera3d({ mode: 'fixed', x, y, z, look: { x, y, z } })
  UB.camera3d({ mode: 'first', target: e })   // FIRST-PERSON: eyes of the hero; mouse (click locks the cursor) / right-half finger drag look around,
     // W/S forward-back, A/D strafe, arrows turn; the hero body is hidden. UB.look = { yaw, pitch } — where the player looks:
     // forward vector = { x: -Math.sin(UB.look.yaw), z: -Math.cos(UB.look.yaw) } (shoot / interact along it). Draw a crosshair at the screen center in draw().
  UB.burst3d(x, y, z, { color, count })
  UB.prefab('tree'|'pine'|'bush'|'rock'|'coin'|'crystal'|'star'|'heart'|'key'|'flag'|'house'|'tower'|'lamp'|'gate'|'portal'|'chest'|'cloud'|'fence'|'car', { x, z, y, scale, color, solid, rotY })
     // ready-made low-poly models (an entity like spawn: hitbox, e.remove(), e.setColor). Use them to make worlds look rich instead of bare boxes.
  UB.label3d('42', x, y, z, { h: 0.9, color, bg }) -> e ; e.setText('43')   // text in the world facing the camera: answers on doors, names, signs
  UB.toScreen3d(x, y, z) -> { x, y, visible }   // world point -> HUD coordinates (health bars, hints over objects in draw)
  Scenes work as usual: update(s, dt) moves things; draw(g, s) draws ONLY the 2D HUD on top (score, timer, hints, buttons) — the 3D world renders itself.
  Build the level in the 'play' scene enter() (UB.clear3d() first). Keep under 300 objects. Bright colors, glowing collectibles, simple shapes.
  The hero must always be visible: follow camera distance 9-11, height 5-6; never put big objects between the camera and the hero (keep the
  space behind and around the start clear); decorations go far to the sides, below the path or in the distance, not on the path itself.
PHYSICS (real rigid-body physics, Rapier: load it as window.RAPIER before the engine and put the game inside UB.ready(() => { ... }) — it runs when the WebAssembly is ready) — use it when objects should fall, roll, bounce, stack, topple or be thrown/pushed
  (bowling, toppling towers, catapults, dominoes, marble runs, cars hitting cones, pushing crates). Not needed for simple parkour/collecting.
  const b = UB.body(e, { type: 'dynamic'|'static'|'kinematic', mass: 1, bounce: 0.2, friction: 0.6, lockRotation: false, sensor: false, shape: 'box'|'sphere'|'cylinder'|'capsule' })
     // e (from UB.spawn / UB.prefab) now follows the body: e.x/e.y/e.z and the rotation update by themselves — never move a dynamic e every frame.
     // Setting e.x/e.y/e.z once = teleport (respawn). Shape comes from the entity (sphere rolls, box tumbles). 'static' = fixed support,
     // 'kinematic' = you move it via e.x/e.y/e.z/e.rotY (moving platforms, spinners) and it pushes dynamic bodies. sensor: true = trigger zone.
  b.push(x, y, z) (impulse: throw, kick, jump pad; bigger for heavier bodies) ; b.spin(x, y, z) ; b.velocity() -> { x, y, z } ; b.setVelocity(x, y, z)
  b.onHit((other) => { ... }) (other = the entity it touched, or null) ; b.onLeave(fn) ; b.remove()
  UB.explode(x, y, z, { radius: 5, power: 12 })   // everything movable nearby flies away (bombs, cannon balls, fireworks)
  UB.ray3d({ x, y, z }, { x: dx, y: dy, z: dz }, maxDist, { ignore: shooter }) -> { e, x, y, z, dist } | null   // what is in that direction
  UB.joint(a, b|null, { type: 'ball'|'hinge'|'rope'|'spring', at: { x, y, z }, axis: 'y', length })   // chains, doors, swings, pendulums (null = hang from the world point at)
  UB.physics({ gravity: 18 })   // optional: change gravity (it starts automatically with the first UB.body)
  Every solid: true object (and the ground) is a fixed wall for physics automatically. UB.player3d walks with a physics character
  (climbs small steps, pushes crates). UB.voxels3d(list, { solid: true }) makes a block world you can stand on.
  Keep under 150 dynamic bodies. Detect "fell off" with e.y < -5, "knocked down" with a lower e.y than at the start.
```

## Genre kits

A kit is a whole game: menu, levels, results with stars, best score, phone controls and music. You give it the content.

### UB.kit.platformer

```
GENRE KIT (strongly preferred — a tested, polished game frame: title menu, level banners, results with 1-3 stars, best score, phone controls, music).
Call UB.kit.<name>({ ...config }) once, then UB.start('menu') (no UB.create — the kit sets the screen). Do NOT define scenes 'menu' / 'play' / 'over' yourself (the kit does); you may add extra scenes for cut-scenes.
Common config: lang: 'ru'|'uz'|'en' (UI texts), title, goal (one line how to play), hero: { name: 'IMAGE name' | emoji: 'char' | color }, background: 'IMAGE name of the world object' | ['#top', '#bottom', '#farHills', '#nearHills'],
  music: 'happy'|'calm'|'tense'|'space'|'boss'|'retro', lives: 3, questions: [{ q, options: [4 strings], correct: index }] (for educational games), quizScore, text: { override any UI string },
  levels: [...] (3-4, each clearly different), hooks: { start(s, level /* the level OBJECT; its index is s.li */), update(s, dt), drawWorld(g, s), drawHud(g, s), answer(s, ok), pickup(s, item /* { name, ch, x, y } */), hurt(s), defeat(s, enemy /* { name, ch, x, y, w, h } */) }.
  In hooks: s.score, s.lives, s.t (seconds in level), s.li (level index), s.hero; actions s.addScore(n, x, y), s.hurt(), s.heal(), s.win(), s.lose(), s.ask(ok => ...) (opens the next question). Use hooks for the design's twist and special rules.
UB.kit.platformer({ ..., tile: 48, speed: 300, jump: 760, powerTime: 6,
  enemies: { E: { name, color, ai: 'patrol'|'chase'|'fly'|'still', speed: 80, stomp: true, hp: 1, score: 20, size: 1 }, ... },
  items: { C: { name, color, score: 10 }, ... },          // your collectibles by letter
  tiles: { W: { draw(g, cell, s), touch(s, cell) } },   // custom cells (e.g. wind zone, word leaf, portal)
  levels: [{ name: 'Forest', background, music, time: 0, colors: { ground, top, plank, door, flag, spikes }, rows: [ ...strings... ] }] })
Built-in level letters: # ground, = one-way plank, P start, F finish flag, o coin, ^ spikes, B spring, ? question block (correct = +score), D door that opens on a correct answer, H heart, * power star (fast + invincible), M moving platform.
Levels: 12-16 rows, 60-140 columns, ground at the bottom rows, gaps, plank stairs, enemies on ledges, coins in arcs; every level must introduce something new. s.hero = { x, y, w, h, vx, vy, onGround }.
```

### UB.kit.runner

```
GENRE KIT (strongly preferred — a tested, polished game frame: title menu, level banners, results with 1-3 stars, best score, phone controls, music).
Call UB.kit.<name>({ ...config }) once, then UB.start('menu') (no UB.create — the kit sets the screen). Do NOT define scenes 'menu' / 'play' / 'over' yourself (the kit does); you may add extra scenes for cut-scenes.
Common config: lang: 'ru'|'uz'|'en' (UI texts), title, goal (one line how to play), hero: { name: 'IMAGE name' | emoji: 'char' | color }, background: 'IMAGE name of the world object' | ['#top', '#bottom', '#farHills', '#nearHills'],
  music: 'happy'|'calm'|'tense'|'space'|'boss'|'retro', lives: 3, questions: [{ q, options: [4 strings], correct: index }] (for educational games), quizScore, text: { override any UI string },
  levels: [...] (3-4, each clearly different), hooks: { start(s, level /* the level OBJECT; its index is s.li */), update(s, dt), drawWorld(g, s), drawHud(g, s), answer(s, ok), pickup(s, item /* { name, ch, x, y } */), hurt(s), defeat(s, enemy /* { name, ch, x, y, w, h } */) }.
  In hooks: s.score, s.lives, s.t (seconds in level), s.li (level index), s.hero; actions s.addScore(n, x, y), s.hurt(), s.heal(), s.win(), s.lose(), s.ask(ok => ...) (opens the next question). Use hooks for the design's twist and special rules.
UB.kit.runner({ ..., speed: 380, speedUp: 8, jump: 820, doubleJump: false, duck: false, quizEvery: 10,
  obstacles: [{ name, color, w: 40, h: 50, fly: false }], pickup: { name, color, score: 5 },
  levels: [{ name, length: 4000 /* px of distance */, speed, background, obstacles: [...] /* new ones per level */ }] })
Questions appear as two answer boards: jump through the top one or run under for the bottom one (2 options: the correct + a random wrong).
```

### UB.kit.maze

```
GENRE KIT (strongly preferred — a tested, polished game frame: title menu, level banners, results with 1-3 stars, best score, phone controls, music).
Call UB.kit.<name>({ ...config }) once, then UB.start('menu') (no UB.create — the kit sets the screen). Do NOT define scenes 'menu' / 'play' / 'over' yourself (the kit does); you may add extra scenes for cut-scenes.
Common config: lang: 'ru'|'uz'|'en' (UI texts), title, goal (one line how to play), hero: { name: 'IMAGE name' | emoji: 'char' | color }, background: 'IMAGE name of the world object' | ['#top', '#bottom', '#farHills', '#nearHills'],
  music: 'happy'|'calm'|'tense'|'space'|'boss'|'retro', lives: 3, questions: [{ q, options: [4 strings], correct: index }] (for educational games), quizScore, text: { override any UI string },
  levels: [...] (3-4, each clearly different), hooks: { start(s, level /* the level OBJECT; its index is s.li */), update(s, dt), drawWorld(g, s), drawHud(g, s), answer(s, ok), pickup(s, item /* { name, ch, x, y } */), hurt(s), defeat(s, enemy /* { name, ch, x, y, w, h } */) }.
  In hooks: s.score, s.lives, s.t (seconds in level), s.li (level index), s.hero; actions s.addScore(n, x, y), s.hurt(), s.heal(), s.win(), s.lose(), s.ask(ok => ...) (opens the next question). Use hooks for the design's twist and special rules.
UB.kit.maze({ ..., hero, enemy: { name, color }, item: { name, color, score: 10 }, speed,
  levels: [{ name, size: 11 /* columns, odd */, rows: 9, items: 5, enemies: 1, enemySpeed, doors: 2 /* question doors */, hearts: 0, stars: 1, loops: 0.04, time: 90, colors: { wall, wallTop, floor, door, bg, bg2 } }] })
Mazes are generated each time; collect all items to open the exit; enemies chase along corridors; doors open on a correct answer.
```

### UB.kit.shooter

```
GENRE KIT (strongly preferred — a tested, polished game frame: title menu, level banners, results with 1-3 stars, best score, phone controls, music).
Call UB.kit.<name>({ ...config }) once, then UB.start('menu') (no UB.create — the kit sets the screen). Do NOT define scenes 'menu' / 'play' / 'over' yourself (the kit does); you may add extra scenes for cut-scenes.
Common config: lang: 'ru'|'uz'|'en' (UI texts), title, goal (one line how to play), hero: { name: 'IMAGE name' | emoji: 'char' | color }, background: 'IMAGE name of the world object' | ['#top', '#bottom', '#farHills', '#nearHills'],
  music: 'happy'|'calm'|'tense'|'space'|'boss'|'retro', lives: 3, questions: [{ q, options: [4 strings], correct: index }] (for educational games), quizScore, text: { override any UI string },
  levels: [...] (3-4, each clearly different), hooks: { start(s, level /* the level OBJECT; its index is s.li */), update(s, dt), drawWorld(g, s), drawHud(g, s), answer(s, ok), pickup(s, item /* { name, ch, x, y } */), hurt(s), defeat(s, enemy /* { name, ch, x, y, w, h } */) }.
  In hooks: s.score, s.lives, s.t (seconds in level), s.li (level index), s.hero; actions s.addScore(n, x, y), s.hurt(), s.heal(), s.win(), s.lose(), s.ask(ok => ...) (opens the next question). Use hooks for the design's twist and special rules.
UB.kit.shooter({ ..., hero /* the ship */, target: { name, color } /* the answer bubbles */, hazard: { name, color } /* falling rocks */,
  levels: [{ name, questions: 6, speed: 45 /* target fall speed */, rocks: 0.5 /* per second */, boss: { name, color, hp: 6 } /* optional last level */ }] })
Targets with the answer options fall; shoot the correct one; streak multiplier; rocks drop power-ups (triple shot, slow time, heart). Questions are REQUIRED.
```

### UB.kit.quiz

```
GENRE KIT (strongly preferred — a tested, polished game frame: title menu, level banners, results with 1-3 stars, best score, phone controls, music).
Call UB.kit.<name>({ ...config }) once, then UB.start('menu') (no UB.create — the kit sets the screen). Do NOT define scenes 'menu' / 'play' / 'over' yourself (the kit does); you may add extra scenes for cut-scenes.
Common config: lang: 'ru'|'uz'|'en' (UI texts), title, goal (one line how to play), hero: { name: 'IMAGE name' | emoji: 'char' | color }, background: 'IMAGE name of the world object' | ['#top', '#bottom', '#farHills', '#nearHills'],
  music: 'happy'|'calm'|'tense'|'space'|'boss'|'retro', lives: 3, questions: [{ q, options: [4 strings], correct: index }] (for educational games), quizScore, text: { override any UI string },
  levels: [...] (3-4, each clearly different), hooks: { start(s, level /* the level OBJECT; its index is s.li */), update(s, dt), drawWorld(g, s), drawHud(g, s), answer(s, ok), pickup(s, item /* { name, ch, x, y } */), hurt(s), defeat(s, enemy /* { name, ch, x, y, w, h } */) }.
  In hooks: s.score, s.lives, s.t (seconds in level), s.li (level index), s.hero; actions s.addScore(n, x, y), s.hurt(), s.heal(), s.win(), s.lose(), s.ask(ok => ...) (opens the next question). Use hooks for the design's twist and special rules.
UB.kit.quiz({ ..., hero, enemy: { name, color }, quizTime: 15, rounds: 10 /* team mode */,
  levels: [{ name, questions: 8 /* answers to defeat the opponent */, time: 15, boss: { name, color } }] })
Single player: a quiz battle — each correct answer hits the opponent (health bar), a wrong one costs a life. TEAM MODE: the same call works for host and phones automatically (lobby, phones with 4 big buttons, faster correct answers score more, tug-of-war rope, results) — do not write UB.net code yourself.
```
