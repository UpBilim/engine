# UpBilim Engine

A tiny game engine for **kids' games and AI-written games**. One script, one global `UB`, and a game is a page of plain JavaScript:

- **2D**: canvas scenes, keyboard + mouse + touch, auto-scaling, particles, sounds, music, tweens, cameras, levels from text, platformer physics, enemy AI, HUD, quiz windows.
- **3D**: a world on [three.js](https://threejs.org): objects, ready-made low-poly models, voxel worlds (thousands of blocks in one draw call), follow / top / **first-person** cameras, phone joystick.
- **Characters and models**: animated blocky people (Roblox-like, no files needed: walk, run, jump, wave, dance, cheer) and glTF models with skeletal animation.
- **Blocks**: 58 built-in Minecraft-like blocks with pixel textures drawn by code (grass, stone, brick, glass, water, flowers, lamps, torches…): `UB.voxels3d([{ x, y, z, b: 'grass' }])`, only visible faces are drawn, soft corner shadows.
- **Effects**: GPU particles in one call (`UB.effect3d('fire' | 'smoke' | 'magic' | 'confetti' | 'explosion' | 'snow' | 'rain' | ...)`), soft glow halos, sun shadows, gradient sky, automatic quality for slow devices.
- **Physics**: real rigid bodies on [Rapier](https://rapier.rs): falling, rolling, stacking, explosions, ropes, hinges, a character that climbs steps and pushes crates.
- **Genre kits**: `UB.kit.platformer / runner / maze / shooter / quiz`: a whole polished game (menu, levels, stars, best score, phone controls) from one config object.
- **Team mode**: one shared screen + phones as gamepads (needs a small relay server, see below).

It powers the game studio of [UpBilim](https://upbilim.com), where students describe a game in words and the AI writes it on top of this engine. The API is small and predictable on purpose: it is easy for a child to read and for a language model to write.

## Quick start (2D)

```html
<!doctype html>
<meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/gh/UpBilim/engine@v0.2.0/src/upbilim-engine.js"></script>
<script>
UB.create({ width: 960, height: 540, background: '#10142a' });
UB.scene('play', {
  enter(s) { s.x = 480; s.stars = []; s.score = 0; UB.every(0.7, () => s.stars.push({ x: UB.rand(40, 920), y: -20 })); },
  update(s, dt) {
    if (UB.key('left')) s.x -= 420 * dt;
    if (UB.key('right')) s.x += 420 * dt;
    for (const st of s.stars) { st.y += 220 * dt; if (Math.abs(st.x - s.x) < 50 && Math.abs(st.y - 480) < 30) { st.y = 999; s.score++; UB.sfx('coin'); } }
  },
  draw(g, s) {
    for (const st of s.stars) g.circle(st.x, st.y, 14, '#ffd166');
    g.roundRect(s.x - 50, 470, 100, 24, 12, '#4cc9f0');
    g.text('Stars: ' + s.score, 20, 20, { size: 28 });
  },
});
UB.start('play');
</script>
```

Or download `src/upbilim-engine.js` and put it next to your page.

## 3D and physics

The 3D part needs `THREE` on `window`; physics needs `RAPIER` too. With ES modules from a CDN:

```html
<script type="module">
  import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';
  import * as RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.19.3/rapier.mjs';
  window.THREE = THREE; window.RAPIER = RAPIER;
  await import('./upbilim-engine.js');

  UB.ready(() => {            // runs when the physics WebAssembly is ready
    UB.create3d({ sky: '#8fd3ff' });
    UB.scene('play', {
      enter() {
        for (let y = 0; y < 6; y++) UB.body(UB.spawn({ shape: 'box', x: 0, y: 0.5 + y, z: -6, color: '#ef476f' }));
        const ball = UB.spawn({ shape: 'sphere', r: 0.5, x: 0, y: 0.5, z: 4, color: '#3a0ca3' });
        UB.body(ball, { mass: 6 }).push(0, 0, -80);
        UB.camera3d({ mode: 'fixed', x: 8, y: 6, z: 8, look: { x: 0, y: 1, z: -3 } });
      },
    });
    UB.start('play');
  });
</script>
```

Physics is optional: games that never call `UB.body / UB.physics / UB.ray3d / UB.explode / UB.joint` do not need Rapier.

## Examples

Open them through any static server (ES modules do not load from `file://`):

```
python3 -m http.server 8080    # then open http://localhost:8080/examples/
```

| File | What it shows |
|---|---|
| `examples/hello-2d.html` | 2D basics: scenes, input, drawing, sounds |
| `examples/platformer-kit.html` | A full platformer from one `UB.kit.platformer` config |
| `examples/obby-3d.html` | 3D parkour: platforms, coins, follow camera, phone joystick |
| `examples/characters-3d.html` | Animated characters and a glTF robot; the hero animates by itself |
| `examples/blocks-3d.html` | A block island: built-in pixel-textured blocks (grass, brick, glass, water, flowers, torches), walkable |
| `examples/physics-3d.html` | Physics: a tower, bowling pins, a pendulum, an explosion, a player who pushes crates |

## API

The full reference is in [`docs/API.md`](docs/API.md). It is the same text the UpBilim AI reads before writing a game, so it is short and complete.

Images: `UB.image('Hero', 'hero.png')` before `UB.start(...)`, then `g.image('Hero', x, y, w, h)` in 2D or `UB.spawn({ shape: 'image', image: 'Hero' })` in 3D.

## Characters and models

```js
const hero = UB.character3d({ shirt: '#ef476f', hat: 'cap' });   // animates by itself: idle / walk / run / jump
UB.player3d(hero);
hero.play('wave', { once: true });                                 // wave, dance, cheer, hit, jump
UB.loadModel('robot', 'RobotExpressive.glb');                      // before UB.start
UB.model3d('robot', { x: 0, z: -4, h: 2.4 }).play('Dance');        // skeletal animation clips by name
```

Models need `GLTFLoader` and `SkeletonUtils` from three.js addons on `window` (see `examples/characters-3d.html`).

## Embedding and team mode

The engine takes over the whole page (the canvas fits the window). To put a game inside another page, load it in an `<iframe>`.
A game inside an iframe reports to the parent page with `postMessage`: `{ ub: 1, type: 'ub:ready' | 'ub:score' | 'ub:finish' | 'ub:error', ... }`.

Team mode (`UB.net`) needs the parent page to relay messages between the shared screen and the phones (`net:init`, `net:msg`, `net:state`, `net:players`). The relay server is part of the UpBilim platform and is not included here.

## Versions

Tested with three.js 0.186.1 and Rapier (`@dimforge/rapier3d-compat`) 0.19.3.

## License

MIT, © 2026 UpBilim. three.js is MIT, Rapier is Apache-2.0.

---

## По-русски

UpBilim Engine — маленький игровой движок для детских игр и игр, которые пишет ИИ. На нём работает «Студия игр» [UpBilim](https://upbilim.com): ученик описывает игру словами, ИИ пишет её код. В движке есть 2D, 3D на three.js, физика на Rapier и готовые жанры (платформер, раннер, лабиринт, шутер, викторина). Лицензия MIT. Примеры лежат в `examples/`, справочник — в `docs/API.md`.
