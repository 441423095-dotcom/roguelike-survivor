// The run itself: a walled arena that fills the panel, waves of monsters walking
// in from the edges, an auto-aiming weapon, XP gems and upgrades. The bottom band
// is reserved for the touch controls so nothing is ever drawn over the arena.

import { computeLayout, hudGeometry } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { rollCards, UPGRADE_BY_KEY } from '../game/upgrades.js';
import {
  rollShopItems,
  SHOP_REFRESH_COST,
  ITEM_SLOTS,
  WEAPON_OFFERS
} from '../game/shop.js';
import {
  ITEM_POOL,
  ITEM_BY_KEY,
  activeCooldown,
  frogInterval,
  teapotInterval,
  refreshDiscount,
  shopDiscount
} from '../game/passives.js';
import { Sfx, setMusicTrack, duckMusic } from '../game/audio.js';
import { xpForLevel, coinBudgetForWave } from '../game/loot.js';
import { rarityColor, rarityFor } from '../game/rarities.js';
import { nextRarity, mergeCost } from '../game/rarities.js';
import { recordAchievement } from '../game/achievements.js';
import {
  metaBonuses,
  activeSkinTint,
  shardsForRun,
  addShards
} from '../game/meta.js';
import { markDiscovered } from '../game/bestiary.js';
import {
  WEAPONS,
  WEAPON_SLOTS,
  weaponStats,
  weaponDef,
  evolvedWeapon
} from '../game/weapons.js';
import { getCharacter } from '../game/characters.js';
import { loadProgress, recordWave, recordRun } from '../game/progress.js';
import { difficultyFor } from '../game/difficulty.js';
import { TEXT_RESOLUTION, sharpenText } from '../ui/text.js';
import {
  ENEMY_TYPES,
  pickEnemyType,
  waveDuration,
  waveScaling,
  waveSpawnPlan,
  isBossWave,
  isEndlessWave
} from '../game/enemies.js';
import { haptic } from '../haptics.js';

const BLINK_COOLDOWN = 4000;
const BLINK_INVULN = 900;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.layout = computeLayout(
      this.scale.gameSize.width,
      this.scale.gameSize.height
    );

    const saved = loadProgress();
    this.character = getCharacter(saved.character);

    this.difficulty = difficultyFor(saved.difficulty);

    // Permanent perks bought with star dust apply from the first second.
    this.meta = metaBonuses();

    this.dead = [];
    this.pickups = [];
    this.cooldowns = [];
    this.pending = [];
    // Level-ups are banked while the wave runs and handed out once it is over,
    // so a card never stops a fight halfway through.
    this.levelsQueued = 0;
    this.pendingWaveStart = false;
    this.shopItems = [];
    this.pendingBuff = null;
    this.activeBuff = null;
    this.shopOpen = false;
    this.choiceOpen = false;
    this.weaponChoice = null;
    this.pausedByUser = false;
    this.running = true;
    this.waveEnding = false;
    this.bossFight = false;
    this.boss = null;
    this.invulnUntil = 0;
    this.lastHurtAt = 0;
    this.dashUntil = 0;
    this.dashReadyAt = 0;
    this.blinkReadyAt = 0;
    this.hapticAt = 0;
    this.facing = 0;

    this.joyDir = new Phaser.Math.Vector2(0, 0);
    // Where the grab started, relative to the character: plain numbers, so the
    // per-frame follow never allocates anything.
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.joyPointer = null;
    this.lastDir = new Phaser.Math.Vector2(1, 0);
    this.dashDir = new Phaser.Math.Vector2(1, 0);

    this.state = {
      hp: this.character.hp + this.meta.health,
      maxHp: this.character.hp + this.meta.health,
      speed: this.character.speed * this.meta.speed,
      damage: this.character.damage * this.meta.damage,
      fireInterval: this.character.fireInterval,
      projectiles: 1,
      weapons: [
        { key: 'blaster', level: 1, rarity: 'common' },
        { key: 'smg', level: 1, rarity: 'common' }
      ],
      range: 300,
      bulletSpeed: 480,
      pickupRadius: 95,
      regen: 0,
      armor: 0,
      lifesteal: 0,
      critChance: 0,
      critMult: 2,
      pierceBonus: 0,
      slowOnHit: 0,
      outRegen: 0,
      level: 1,
      xp: 0,
      xpNext: 30,
      wave: 1,
      waveLeft: 0,
      kills: 0,
      coins: 0,
      // 生锈的硬币 locks the purse and doubles every drop; both stay neutral
      // until the trinket is bought.
      coinCap: Number.POSITIVE_INFINITY,
      coinMult: 1,
      // Item bonuses: per-style weapon damage, per-gun synergy, padding on
      // splash radius, a bonus against slowed enemies and the kill explosion.
      styleBonus: { bullet: 1, energy: 1, explosive: 1, blade: 1 },
      weaponSynergy: 0,
      splashBonus: 0,
      slowBonus: 0,
      chainKill: 0,
      runTime: 0
    };
    // The starting stats before any card or item touches them. Selling an item
    // rebuilds the run's numbers from this snapshot.
    this.baseRun = {
      hp: this.state.hp,
      maxHp: this.state.maxHp,
      speed: this.state.speed,
      damage: this.state.damage,
      fireInterval: this.state.fireInterval,
      range: this.state.range,
      bulletSpeed: this.state.bulletSpeed,
      pickupRadius: this.state.pickupRadius
    };

    this.stacks = {};

    // Everything bought in the shop, passive and active, keyed by item and
    // holding a stack count. The two charge figures are the frog's and the
    // teapot's own clocks; activeTimers holds each gadget's recharge.
    this.items = {};
    this.frogCharge = 0;
    this.teapotCharge = 0;
    this.activeTimers = {};
    this.mines = [];
    this.turrets = [];
    this.companions = [];
    this.poisonPools = [];
    this.cactuses = [];
    this.boomerangs = [];
    this.blackholes = [];

    // The starting numbers, so runaway stacking can be clamped against them.
    this.baseStats = {
      fireInterval: this.state.fireInterval,
      speed: this.state.speed,
      damage: this.state.damage
    };

    this.cameras.main.setBackgroundColor(0x070a10);

    this.buildWorld();
    this.buildPlayer();
    this.buildGroups();
    this.buildControls();
    this.buildTopBar();

    this.startWave(1);
    this.scene.launch('Hud');
    this.cameras.main.fadeIn(320, 7, 10, 16);

    sharpenText(this);

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', this.onShutdown, this);
  }

  onShutdown() {
    this.scale.off('resize', this.onResize, this);
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off('pointerup', this.onPointerUp, this);
    this.input.off('pointerupoutside', this.onPointerUp, this);
    if (this.spawnTimer) {
      this.spawnTimer.remove();
      this.spawnTimer = null;
    }
  }

  // ---------------------------------------------------------------- arena

  buildWorld() {
    const field = this.layout.field;

    this.floor = this.add
      .tileSprite(0, 0, field.width, field.height, 'floor')
      .setOrigin(0, 0)
      .setDepth(-20);

    this.border = this.add.graphics().setDepth(-10);
    this.drawBorder();

    // The whole arena is walkable left to right; the only floor is the bottom
    // of the top HUD, so nobody ever hides under it.
    const hud = hudGeometry(this.layout);
    this.safeTop = hud.safeTop;

    this.physics.world.setBounds(
      0,
      this.safeTop,
      Math.max(40, this.layout.width),
      Math.max(40, this.layout.height - this.safeTop)
    );
  }

  drawBorder() {
    const field = this.layout.field;
    const g = this.border;
    g.clear();

    // Pull the floor down a little so bright sprites read against it.
    g.fillStyle(0x05080d, 0.45);
    g.fillRect(0, 0, field.width, field.height);

    g.lineStyle(3, 0x1f5f63, 0.55);
    g.strokeRect(6, 6, field.width - 12, field.height - 12);

    g.lineStyle(1, 0x2bd3c4, 0.3);
    g.strokeRect(9, 9, field.width - 18, field.height - 18);

    // Corner brackets give the arena a cage feel.
    const len = Math.min(24, field.width * 0.08);
    const w = field.width;
    const h = field.height;
    g.lineStyle(3, 0x2bd3c4, 0.65);
    g.beginPath();
    g.moveTo(11, 11 + len);
    g.lineTo(11, 11);
    g.lineTo(11 + len, 11);
    g.moveTo(w - 11 - len, 11);
    g.lineTo(w - 11, 11);
    g.lineTo(w - 11, 11 + len);
    g.moveTo(11, h - 11 - len);
    g.lineTo(11, h - 11);
    g.lineTo(11 + len, h - 11);
    g.moveTo(w - 11 - len, h - 11);
    g.lineTo(w - 11, h - 11);
    g.lineTo(w - 11, h - 11 - len);
    g.strokePath();
  }

  buildPlayer() {
    const field = this.layout.field;

    this.shadow = this.add
      .ellipse(field.centerX, field.centerY + 15, 30, 12, 0x000000, 0.35)
      .setDepth(1);

    this.player = this.physics.add.sprite(
      field.centerX,
      field.centerY,
      this.character.texture
    );
    this.player.setDepth(12);
    // The hero texture is 48x48; a 30px square body sits centred inside it.
    this.player.body.setSize(30, 30, true);
    this.player.setCollideWorldBounds(true);

    // A bought tint is worn for the whole run.
    this.skinTint = activeSkinTint();
    if (this.skinTint) this.player.setTint(this.skinTint);
  }

  // ------------------------------------------------------------- entities

  buildGroups() {
    this.bullets = this.physics.add.group({ allowGravity: false });
    this.enemies = this.physics.add.group({ allowGravity: false });
    this.enemyShots = this.physics.add.group({ allowGravity: false });

    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(
      this.bullets,
      this.enemies,
      this.onBulletHit,
      undefined,
      this
    );
    this.physics.add.overlap(
      this.enemies,
      this.player,
      this.onEnemyTouch,
      undefined,
      this
    );
    this.physics.add.overlap(
      this.enemyShots,
      this.player,
      this.onShotTouch,
      undefined,
      this
    );
  }

  // ------------------------------------------------------------- controls

  buildControls() {
    // One control and one only: the flash button in the bottom-right corner.
    // It sits half-transparent so it never covers the fight, and comes solid
    // while a thumb is on it.
    this.dashGfx = this.add.graphics().setDepth(20);
    // The recharge ring lives on its own layer, so it stays readable while the
    // disc underneath is half-transparent.
    this.dashRing = this.add.graphics().setDepth(20);
    this.dashIcon = this.add
      .image(0, 0, 'icon-zap')
      .setDepth(20)
      .setTint(0xa8f0ff);

    this.buttonPressed = false;
    this.buttonPointer = null;

    this.slotPositions = [];

    this.drawFlashButton();

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
  }

  /// The stick is deliberately invisible: you steer by dragging anywhere on the
  /// screen, and the character moving is the only feedback needed.
  drawJoystick() {
    // Intentionally draws nothing.
  }


  /// The flash button: one lightning bolt in the corner. Half-transparent at
  /// rest so it never covers the fight, solid and a touch smaller while a thumb
  /// holds it, with the recharge ring drawn around it.
  drawFlashButton() {
    const button = this.layout.dash;
    if (!button || !this.dashGfx) return;

    const ratio = this.blinkCoolRatio();
    const pressed = !!this.buttonPressed;
    const alpha = pressed ? 1 : 0.4;
    const r = button.radius * (pressed ? 0.92 : 1);
    const g = this.dashGfx;

    g.clear();
    g.setAlpha(alpha);
    g.fillStyle(0x121a26, 0.95);
    g.fillCircle(button.x, button.y, r);
    g.lineStyle(2, 0xa8f0ff, ratio > 0 ? 0.3 : 0.85);
    g.strokeCircle(button.x, button.y, r);

    const ring = this.dashRing;
    if (ring) {
      ring.clear();
      if (ratio > 0) {
        ring.setAlpha(pressed ? 1 : 0.8);
        ring.lineStyle(4, 0xa8f0ff, 0.75);
        ring.beginPath();
        ring.arc(
          button.x,
          button.y,
          r - 4,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * ratio,
          false
        );
        ring.strokePath();
      }
    }

    this.dashIcon.setPosition(button.x, button.y);
    this.dashIcon.setDisplaySize(r * 1.05, r * 1.05);
    this.dashIcon.setAlpha(alpha * (ratio > 0 ? 0.45 : 1));
  }

  blinkCoolRatio() {
    return Math.max(0, (this.blinkReadyAt - this.time.now) / BLINK_COOLDOWN);
  }

  onPointerDown(pointer) {
    if (!this.running || this.pausedByUser || this.shopOpen || this.choiceOpen)
      return;

    const button = this.layout.dash;
    if (
      button &&
      Phaser.Math.Distance.Between(pointer.x, pointer.y, button.x, button.y) <
        button.radius * 1.2
    ) {
      // Press feedback first, then the skill: a tap that finds the button on
      // cooldown still answers the thumb.
      this.buttonPointer = pointer;
      this.buttonPressed = true;
      this.drawFlashButton();
      this.tryBlink();
      return;
    }

    if (this.joyPointer !== null) return;

    // Grab anywhere: remember where the character sits relative to the finger
    // and let the frame loop drag it there directly.
    this.joyPointer = pointer;
    this.dragOffsetX = this.player.x - pointer.x;
    this.dragOffsetY = this.player.y - pointer.y;
  }

  onPointerUp(pointer) {
    if (pointer === this.buttonPointer) {
      this.buttonPointer = null;
      this.buttonPressed = false;
      this.drawFlashButton();
    }

    if (pointer === this.joyPointer) this.releaseJoystick();
  }

  releaseJoystick() {
    this.joyPointer = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.joyDir.set(0, 0);
    if (this.player && this.player.body) this.player.body.velocity.set(0, 0);
  }

  tryBlink() {
    if (!this.running || this.time.now < this.blinkReadyAt) return;

    const field = this.layout.field;
    const dir =
      this.joyDir.lengthSq() > 0.01 ? this.joyDir.clone() : this.lastDir.clone();
    if (dir.lengthSq() < 0.0001) dir.set(1, 0);
    dir.normalize();

    const fromX = this.player.x;
    const fromY = this.player.y;
    const margin = 20;
    const toX = Phaser.Math.Clamp(
      fromX + dir.x * 150,
      field.left + margin,
      field.right - margin
    );
    const toY = Phaser.Math.Clamp(
      fromY + dir.y * 150,
      (this.safeTop || field.top) + margin,
      field.bottom - margin
    );

    this.blinkReadyAt = this.time.now + BLINK_COOLDOWN;
    // The whole flash is invulnerable: a teleport that can land you inside a
    // boss and eat a hit is not worth using.
    this.invulnUntil = Math.max(this.invulnUntil, this.time.now + BLINK_INVULN);

    const ghost = this.add
      .image(fromX, fromY, this.character.texture)
      .setDepth(12)
      .setAlpha(0.55)
      .setTint(0xa8f0ff);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 0.7,
      duration: 260,
      onComplete: () => ghost.destroy()
    });

    // A streak plus a row of after-images, so the blink reads as a dash with a
    // trail rather than a teleport.
    const streak = this.add.graphics().setDepth(11);
    streak.lineStyle(7, 0xa8f0ff, 0.45);
    streak.lineBetween(fromX, fromY, toX, toY);
    this.tweens.add({
      targets: streak,
      alpha: 0,
      duration: 240,
      onComplete: () => streak.destroy()
    });

    const trailSteps = 6;
    for (let i = 1; i <= trailSteps; i++) {
      const t = i / (trailSteps + 1);
      const after = this.add
        .image(
          fromX + (toX - fromX) * t,
          fromY + (toY - fromY) * t,
          this.character.texture
        )
        .setDepth(11)
        .setAlpha(0.5 * (1 - t))
        .setTint(0xa8f0ff);

      this.tweens.add({
        targets: after,
        alpha: 0,
        scale: 0.65,
        duration: 240 + 160 * (1 - t),
        onComplete: () => after.destroy()
      });
    }

    this.player.setPosition(toX, toY);
    if (this.player.body) this.player.body.reset(toX, toY);

    const ring = this.add
      .circle(toX, toY, 16, 0xa8f0ff, 0.5)
      .setDepth(12)
      .setScale(0.6);
    this.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy()
    });

    haptic('blink');
    Sfx.blink();
  }

  // --------------------------------------------------------------- top bar

  /// The health strip, the wave label and the wave clock. They live in this
  /// scene at depths below the entities, so the player, the horde and the
  /// bullets always draw over the panel instead of behind it.
  buildTopBar() {
    if (this.topBarItems) {
      for (const item of this.topBarItems) item.destroy();
    }
    this.topBarItems = [];

    const L = this.layout;
    const s = L.uiScale;
    const stripX = 10;
    const stripW = L.width - 20;
    const hud = hudGeometry(L);
    const top = hud.stripTop;
    const stripH = hud.stripH;

    // Leave room on the right for the pause button, which stays in the HUD.
    const pauseR = Math.max(13, Math.round(17 * s));
    const pauseX = 10 + (L.width - 20) - pauseR - 10;
    const waveRight = pauseX - pauseR - 14;

    const waveW = Math.round(72 * s);
    const barX = stripX + 32;
    const barW = Math.max(56, waveRight - waveW - barX - 8);
    const barH = Math.max(8, Math.round(10 * s));
    const hpY = top + stripH * 0.42;
    const xpY = top + stripH * 0.76;
    const xpH = Math.max(3, Math.round(4 * s));

    const panel = this.add.graphics().setDepth(-6);
    panel.fillStyle(0x0b1018, 0.72);
    panel.fillRoundedRect(stripX, top, stripW, stripH, 12);
    panel.lineStyle(2, 0x2bd3c4, 0.5);
    panel.strokeRoundedRect(stripX, top, stripW, stripH, 12);
    this.topBarItems.push(panel);

    const heart = this.add
      .image(stripX + 17, hpY, 'icon-heart')
      .setDisplaySize(Math.round(15 * s), Math.round(15 * s))
      .setTint(0xff5a72)
      .setDepth(-5);
    this.topBarItems.push(heart);

    this.hpBack = this.add
      .rectangle(barX, hpY, barW, barH, 0x1b2634)
      .setOrigin(0, 0.5)
      .setDepth(-5);
    this.hpFill = this.add
      .rectangle(barX, hpY, barW, barH, 0xff5a72)
      .setOrigin(0, 0.5)
      .setDepth(-5);
    this.topBarItems.push(this.hpBack, this.hpFill);

    this.hpText = this.add
      .text(barX + barW - 8, hpY, '100/100', {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5)
      .setDepth(-4);
    this.topBarItems.push(this.hpText);

    // The purse sits at the right of the second row, where it is always in
    // sight: what a wave pays is only useful if it is seen arriving. The icon
    // rides right up against the number so the pair reads as one figure.
    const coinSize = Math.max(10, Math.round(13 * s));
    const xpW = Math.max(24, barW - Math.round(56 * s) - 10);

    this.coinRight = barX + barW;
    this.coinGap = Math.round(5 * s);

    this.coinIcon = this.add
      .image(barX + barW, xpY, 'coin')
      .setDisplaySize(coinSize, coinSize)
      .setDepth(-5);
    this.coinText = this.add
      .text(barX + barW, xpY, '0', {
        fontFamily: FONT,
        fontSize: `${Math.round(12 * s)}px`,
        color: COLORS.goldHex,
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5)
      .setDepth(-4);
    this.topBarItems.push(this.coinIcon, this.coinText);

    // The experience bar: one thin line tucked under the health bar.
    this.xpBack = this.add
      .rectangle(barX, xpY, xpW, xpH, 0x1d2a3a)
      .setOrigin(0, 0.5)
      .setDepth(-5);
    this.xpFill = this.add
      .rectangle(barX, xpY, xpW, xpH, 0x39e6cd)
      .setOrigin(0, 0.5)
      .setDepth(-5);
    this.topBarItems.push(this.xpBack, this.xpFill);

    this.waveText = this.add
      .text(waveRight, hpY, '第 1 波', {
        fontFamily: FONT,
        fontSize: `${Math.round(14 * s)}px`,
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5)
      .setDepth(-4);
    this.topBarItems.push(this.waveText);

    // The wave clock, centred under the strip: small, bright, unmissable.
    const timerW = Math.round(104 * s);
    const timerH = hud.timerH;
    const timerX = L.width / 2 - timerW / 2;
    const timerY = hud.timerY;

    this.timerGfx = this.add.graphics().setDepth(-6);
    this.timerGfx.fillStyle(0x0b1018, 0.6);
    this.timerGfx.fillRoundedRect(timerX, timerY, timerW, timerH, 12);
    this.timerGfx.lineStyle(2, 0x2bd3c4, 0.45);
    this.timerGfx.strokeRoundedRect(timerX, timerY, timerW, timerH, 12);
    this.topBarItems.push(this.timerGfx);

    this.timerText = this.add
      .text(L.width / 2, timerY + timerH * 0.45, '20s', {
        fontFamily: FONT,
        fontSize: `${Math.round(18 * s)}px`,
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(-4);
    this.topBarItems.push(this.timerText);

    const timerBarW = timerW - 20;
    const timerBarH = Math.max(3, Math.round(3 * s));

    this.timerBack = this.add
      .rectangle(timerX + 10, timerY + timerH - 7, timerBarW, timerBarH, 0x1d2a3a)
      .setOrigin(0, 0.5)
      .setDepth(-5);
    this.timerFill = this.add
      .rectangle(timerX + 10, timerY + timerH - 7, timerBarW, timerBarH, 0x2bd3c4)
      .setOrigin(0, 0.5)
      .setDepth(-5);
    this.topBarItems.push(this.timerBack, this.timerFill);

    sharpenText(this);
  }

  /// Keeps the strip in sync with the run: health, wave label and clock.
  updateTopBar() {
    if (!this.hpFill || !this.hpText || !this.waveText) return;

    const s = this.state;
    const boss = !!this.bossFight;
    const clearing = !!this.waveEnding;
    const left = Math.max(0, s.waveLeft);
    const total = waveDuration(s.wave);

    this.hpFill.setScale(
      Math.max(0.0001, Phaser.Math.Clamp(s.hp / s.maxHp, 0, 1)),
      1
    );
    this.hpText.setText(`${Math.ceil(s.hp)}/${s.maxHp}`);
    this.xpFill.setScale(
      Math.max(0.0001, Phaser.Math.Clamp(s.xp / s.xpNext, 0, 1)),
      1
    );

    if (this.coinText) {
      const coins = Math.floor(s.coins);
      this.coinText.setText(
        Number.isFinite(s.coinCap)
          ? `${Math.min(coins, s.coinCap)}/${s.coinCap}`
          : String(coins)
      );

      // Keep the coin hugging the left of the number, whatever its width.
      if (this.coinIcon) {
        const half = this.coinIcon.displayWidth / 2;
        this.coinIcon.x = this.coinRight - this.coinText.width - this.coinGap - half;
      }
    }
    this.waveText.setText(
      isEndlessWave(s.wave) ? `无尽波 ${s.wave}` : `第 ${s.wave} 波`
    );

    this.timerText.setText(
      boss ? '首领' : clearing ? '清场' : `${Math.ceil(left)}s`
    );

    const urgent = !boss && !clearing && left <= 5;
    this.timerText.setColor(
      urgent ? COLORS.dangerHex : boss ? '#ff9db0' : '#ffffff'
    );
    this.timerText.setScale(urgent ? 1 + 0.07 * Math.sin(this.time.now / 90) : 1);

    const ratio = total > 0 ? Math.min(1, left / total) : 0;
    this.timerBack.setVisible(!boss);
    this.timerFill.setVisible(!boss);
    this.timerFill.setScale(Math.max(0.0001, ratio), 1);
  }

  // ----------------------------------------------------------------- frame

  update(time, delta) {
    this.flushDead();
    if (!this.running) return;
    if (!this.player || !this.player.active) return;

    if (this.joyPointer && !this.joyPointer.isDown) this.releaseJoystick();

    const dt = Math.min(delta, 48) / 1000;
    this.state.runTime += dt;

    this.updateMovement(time);
    this.updateFiring(delta);
    this.updateEnemies(delta);
    this.updatePickups(dt);
    this.updateBullets(delta);
    this.updateShots(delta);
    this.updateWave(dt);
    this.updateRegen(dt);
    this.updateItems(dt);
    this.updateMines(dt);
    this.updateTurrets(delta);
    this.updateCompanions(delta);
    this.updatePoisonPools(delta);
    this.updateCacti(delta);
    this.updateBoomerangs(delta);
    this.updateBlackholes(delta);

    this.drawFlashButton();
    this.updateTopBar();

    this.shadow.setPosition(this.player.x, this.player.y + 15);
  }

  /// Absolute finger follow. The position is read straight off the live pointer
  /// every frame and the character is put there — no lerp, no velocity ramp, no
  /// per-move maths and no effects. The only work is one clamp and one sqrt to
  /// keep `joyDir` up to date for the flash.
  updateMovement(time) {
    const p = this.joyPointer;

    if (p && p.isDown) {
      const margin = 16;
      let nx = p.x + this.dragOffsetX;
      let ny = p.y + this.dragOffsetY;

      if (nx < margin) nx = margin;
      else if (nx > this.layout.width - margin) nx = this.layout.width - margin;

      const top = (this.safeTop || 0) + margin;
      const bottom = this.layout.height - margin;
      if (ny < top) ny = top;
      else if (ny > bottom) ny = bottom;

      const dx = nx - this.player.x;
      const dy = ny - this.player.y;
      const distSq = dx * dx + dy * dy;
      const stepCap = this.state.speed * 0.06;

      if (distSq > 0.25) {
        const inv = 1 / Math.sqrt(distSq);
        this.joyDir.set(dx * inv, dy * inv);
        this.lastDir.copy(this.joyDir);

        // Glued to the finger, with one generous cap so a violent swipe cannot
        // teleport the character across the arena in a single frame.
        if (distSq > stepCap * stepCap) {
          nx = this.player.x + dx * inv * stepCap;
          ny = this.player.y + dy * inv * stepCap;
        }
      } else {
        this.joyDir.set(0, 0);
        nx = this.player.x;
        ny = this.player.y;
      }

      if (nx !== this.player.x || ny !== this.player.y) this.player.setPosition(nx, ny);
      if (this.player.body) this.player.body.velocity.set(0, 0);
    } else if (this.joyDir.x !== 0 || this.joyDir.y !== 0) {
      this.joyDir.set(0, 0);
    }

    // The invulnerability flicker only touches alpha while it is actually on.
    if (time < this.invulnUntil) {
      this.player.setAlpha(Math.floor(time / 90) % 2 === 0 ? 0.4 : 1);
    } else if (this.player.alpha !== 1) {
      this.player.setAlpha(1);
    }
  }

  updateFiring(delta) {
    const weapons = this.state.weapons;

    for (let i = 0; i < weapons.length; i++) {
      const stats = weaponStats(weapons[i], this.state);
      if (!stats) continue;

      this.cooldowns[i] = (this.cooldowns[i] || 0) - delta;
      if (this.cooldowns[i] > 0) continue;

      const behaviour = stats.behaviour || 'gun';
      const needsTarget = behaviour !== 'puddle' && behaviour !== 'cactus';

      const target = needsTarget ? this.nearestEnemy(stats.range) : null;
      if (needsTarget && !target) {
        this.cooldowns[i] = 90;
        continue;
      }

      if (behaviour === 'swing') this.swingWeapon(stats, target);
      else if (behaviour === 'smite') this.smiteWeapon(stats);
      else if (behaviour === 'puddle') this.dropPoisonPool(stats);
      else if (behaviour === 'cactus') this.placeCactusWeapon(stats);
      else if (behaviour === 'boomerang') this.throwBoomerang(stats, target);
      else this.fireWeapon(stats, target);

      // 狂躁症药丸: every attack costs a sliver of health.
      if (this.items.mania) this.drainHp(1);

      this.cooldowns[i] = stats.interval;
    }
  }

  nearestEnemy(range) {
    let best = null;
    let bestDist = range;

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      const d = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        enemy.x,
        enemy.y
      );
      if (d < bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    return best;
  }

  fireWeapon(stats, target) {
    const base = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      target.x,
      target.y
    );
    this.facing = base;

    const count = stats.count;
    for (let i = 0; i < count; i++) {
      const angle = base + (i - (count - 1) / 2) * stats.spread;
      const bullet = this.bullets.create(
        this.player.x + Math.cos(angle) * 20,
        this.player.y + Math.sin(angle) * 20,
        stats.def.texture
      );
      if (!bullet) continue;

      bullet.setDepth(7);
      bullet.setRotation(angle);
      bullet.body.setCircle(stats.def.bodyRadius, stats.def.bodyOffset, stats.def.bodyOffset);
      bullet.setVelocity(
        Math.cos(angle) * stats.speed,
        Math.sin(angle) * stats.speed
      );
      bullet.setData('damage', stats.damage);
      bullet.setData('pierce', (stats.pierce || 0) + this.state.pierceBonus);
      bullet.setData('slow', stats.slow || 0);
      bullet.setData('splash', stats.splash || 0);
      bullet.setData('hits', []);
      bullet.setData('age', 0);
    }

    Sfx.shoot();

    const flash = this.add
      .circle(
        this.player.x + Math.cos(base) * 18,
        this.player.y + Math.sin(base) * 18,
        8,
        stats.def.color,
        0.85
      )
      .setDepth(6);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.9,
      duration: 130,
      onComplete: () => flash.destroy()
    });
  }

  updateEnemies(delta) {
    const px = this.player.x;
    const py = this.player.y;

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active || !enemy.body) continue;

      // A pan hit or a cactus throw lets the enemy fly for a moment before its
      // own chase resumes.
      const knockUntil = enemy.getData('knockUntil') || 0;
      if (this.time.now < knockUntil) {
        const kx = enemy.getData('knockX') || 0;
        const ky = enemy.getData('knockY') || 0;
        enemy.body.velocity.set(kx * 460, ky * 460);
        const auraK = enemy.getData('aura');
        if (auraK) auraK.setPosition(enemy.x, enemy.y);
        continue;
      }

      const angle = Math.atan2(py - enemy.y, px - enemy.x);
      const dist = Math.hypot(px - enemy.x, py - enemy.y);
      const slowed = (enemy.getData('slowUntil') || 0) > this.time.now;
      const speed = (enemy.getData('speed') || 60) * (slowed ? 0.6 : 1);

      // Enemies standing on top of the player turn see-through, so she is never
      // lost in the crowd.
      enemy.setAlpha(dist < 54 ? 0.55 : 1);
      const behaviour = enemy.getData('behaviour') || 'chase';

      if (behaviour === 'boss') {
        this.updateBoss(enemy, delta);
      } else if (behaviour === 'ranged') {
        const near = enemy.getData('keepNear') || 150;
        const far = enemy.getData('keepFar') || 250;

        if (dist > far) {
          enemy.body.velocity.set(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
          );
        } else if (dist < near) {
          enemy.body.velocity.set(
            -Math.cos(angle) * speed,
            -Math.sin(angle) * speed
          );
        } else {
          // Hold the band but keep drifting inwards: the ring tightens instead
          // of the shooter wandering around the player.
          const strafe = enemy.getData('strafe') || 1;
          const side = angle + (Math.PI / 2) * strafe * 0.25;
          enemy.body.velocity.set(
            Math.cos(side) * speed * 0.35,
            Math.sin(side) * speed * 0.35
          );
        }

        const timer = (enemy.getData('shootTimer') || 0) - delta;
        if (dist < 520 && timer <= 0) {
          this.fireEnemyShot(enemy);
          enemy.setData('shootInterval', enemy.getData('shootInterval') || 1900);
          enemy.setData('shootTimer', enemy.getData('shootInterval'));
        } else {
          enemy.setData('shootTimer', timer);
        }
      } else {
        // Predictive chase: aim where the player is going, not where she was,
        // and weave slightly so the crowd flanks instead of filing in.
        const lead = enemy.getData('lead') || 0.12;
        const body = this.player.body;
        const vx = body ? body.velocity.x : 0;
        const vy = body ? body.velocity.y : 0;

        const targetX = px + vx * lead;
        const targetY = py + vy * lead;

        let chaseAngle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
        const weave = enemy.getData('weave') || 0;

        if (weave > 0) {
          chaseAngle +=
            Math.sin(this.time.now / 520 + (enemy.getData('phase') || 0)) * weave;
        }

        enemy.body.velocity.set(
          Math.cos(chaseAngle) * speed,
          Math.sin(chaseAngle) * speed
        );
      }

      const aura = enemy.getData('aura');
      if (aura) aura.setPosition(enemy.x, enemy.y);
    }
  }

  /// Enemy fire: a visible magenta orb on a slow enough arc that the player can
  // step out of it, or dash straight through it.
  fireEnemyShot(enemy) {
    const angle = Phaser.Math.Angle.Between(
      enemy.x,
      enemy.y,
      this.player.x,
      this.player.y
    );

    this.spawnOrb(enemy.x, enemy.y, angle, 205, enemy.getData('shotDamage') || 7);

    const flash = this.add
      .circle(enemy.x, enemy.y, 9, 0xff3d8b, 0.6)
      .setDepth(4);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.9,
      duration: 200,
      onComplete: () => flash.destroy()
    });
  }

  spawnOrb(x, y, angle, speed, damage) {
    const shot = this.enemyShots.create(
      x + Math.cos(angle) * 16,
      y + Math.sin(angle) * 16,
      'orb'
    );
    if (!shot) return;

    shot.setDepth(6);
    shot.body.setCircle(8, 4, 4);
    shot.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    shot.setData('damage', damage);
    shot.setData('age', 0);
  }

  /// The boss: slow chase, then alternating between a telegraphed charge and a
  /// ring of orbs. Both windows stop it dead for a moment so they are readable.
  updateBoss(boss, delta) {
    const now = this.time.now;
    const windupUntil = boss.getData('windupUntil') || 0;
    const chargeUntil = boss.getData('chargeUntil') || 0;
    const stunUntil = boss.getData('stunUntil') || 0;

    if (now < windupUntil) {
      boss.body.velocity.set(0, 0);
      return;
    }

    if (now < chargeUntil) {
      const angle = boss.getData('chargeAngle') || 0;
      boss.body.velocity.set(Math.cos(angle) * 520, Math.sin(angle) * 520);
      return;
    }

    if (now < stunUntil) {
      boss.body.velocity.set(0, 0);
      return;
    }

    const angle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
    const speed = boss.getData('speed') || 52;
    boss.body.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed);

    const timer = (boss.getData('actionTimer') || 0) - delta;
    boss.setData('actionTimer', timer);
    if (timer > 0) return;

    if ((boss.getData('nextAction') || 'barrage') === 'charge') {
      boss.setData('nextAction', 'barrage');
      boss.setData('windupUntil', now + 520);
      boss.setData('chargeUntil', now + 520 + 560);
      boss.setData('stunUntil', now + 520 + 560 + 700);
      boss.setData('chargeAngle', angle);
      boss.setData('actionTimer', 1500);

      boss.setTint(0xff9db0);
      const sprite = boss;
      this.time.delayedCall(520, () => {
        if (sprite.active) sprite.clearTint();
      });
      haptic('charge');
    } else {
      boss.setData('nextAction', 'charge');
      boss.setData('windupUntil', now + 420);
      boss.setData('actionTimer', 1700);

      const sprite = boss;
      this.time.delayedCall(430, () => {
        if (sprite.active && this.running) this.bossBarrage(sprite);
      });
    }
  }

  bossBarrage(boss) {
    const angle = Phaser.Math.Angle.Between(
      boss.x,
      boss.y,
      this.player.x,
      this.player.y
    );
    // A wider ring: the gaps between orbs are where a player lives, so sixteen
    // of them turn a boss barrage into a real dodge.
    const count = 16;

    for (let i = 0; i < count; i++) {
      this.spawnOrb(
        boss.x,
        boss.y,
        angle + (i / count) * Math.PI * 2,
        185,
        boss.getData('shotDamage') || 12
      );
    }

    const flash = this.add.circle(boss.x, boss.y, 26, 0xff3d6e, 0.5).setDepth(4);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2.2,
      duration: 320,
      onComplete: () => flash.destroy()
    });
    haptic('impact');
  }

  onShotTouch(a, b) {
    const shot = a === this.player ? b : a;
    if (!this.running || !shot || shot === this.player || !shot.active) return;

    const now = this.time.now;
    // Dashing carries the player clean through enemy fire, and the hurt
    // recovery window does the same: neither one takes the hit.
    if (now < this.dashUntil || now < this.invulnUntil) return;

    const damage = shot.getData('damage') || 7;
    this.spawnBurst(shot.x, shot.y, 0xff3d8b, 4);
    this.kill(shot);
    this.hurt(damage);
  }

  updateShots(delta) {
    const field = this.layout.field;

    for (const shot of this.enemyShots.getChildren()) {
      if (!shot.active) continue;
      const age = (shot.getData('age') || 0) + delta;
      shot.setData('age', age);

      if (
        age > 5000 ||
        shot.x < -40 ||
        shot.y < -40 ||
        shot.x > field.width + 40 ||
        shot.y > field.height + 40
      ) {
        this.kill(shot);
      }
    }
  }

  updatePickups(dt) {
    const px = this.player.x;
    const py = this.player.y;
    const radius = this.state.pickupRadius;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      if (!pickup.active) {
        this.pickups.splice(i, 1);
        continue;
      }

      const dx = px - pickup.x;
      const dy = py - pickup.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (dist < radius) {
        const pull = Phaser.Math.Clamp(1 - dist / radius, 0.2, 1);
        const speed = 170 + 430 * pull;
        pickup.x += (dx / dist) * speed * dt;
        pickup.y += (dy / dist) * speed * dt;
      }

      if (dist < 20) {
        const value = pickup.getData('value') || 1;
        const kind = pickup.getData('kind');

        if (kind === 'coin') {
          this.addCoins(value);
          Sfx.coin();
        } else if (kind === 'heart') {
          this.healNow(value);
          Sfx.heal();
        } else {
          this.addXp(value);
          Sfx.gem();
        }
        this.hapticOnce('pickup', 70);
        pickup.destroy();
        this.pickups.splice(i, 1);
      }
    }
  }

  updateBullets(delta) {
    const field = this.layout.field;

    for (const bullet of this.bullets.getChildren()) {
      if (!bullet.active) continue;
      const age = (bullet.getData('age') || 0) + delta;
      bullet.setData('age', age);

      if (
        age > 1700 ||
        bullet.x < -30 ||
        bullet.y < -30 ||
        bullet.x > field.width + 30 ||
        bullet.y > field.height + 30
      ) {
        this.kill(bullet);
      }
    }
  }

  updateWave(dt) {
    if (this.waveEnding || this.bossFight) return;
    this.state.waveLeft -= dt;
    if (this.state.waveLeft <= 0) {
      this.state.waveLeft = 0;
      this.endWave();
    }
  }

  updateRegen(dt) {
    const s = this.state;
    if (s.hp >= s.maxHp) return;

    if (s.regen > 0) {
      s.hp = Math.min(s.maxHp, s.hp + s.regen * dt);
    }

    // "Out of combat" healing only starts after a few quiet seconds.
    if (s.outRegen > 0 && this.time.now - this.lastHurtAt > 3000) {
      s.hp = Math.min(s.maxHp, s.hp + s.outRegen * dt);
    }
  }

  // ----------------------------------------------------------------- items

  /// Everything the shop sold, ticked once a frame. Passive items run their own
  /// little clocks; active items recharge and fire themselves when ready.
  updateItems(dt) {
    const owned = this.items;
    if (!owned) return;

    if (owned.frog) {
      const moving =
        this.joyDir.lengthSq() > 0.01 || this.time.now < this.dashUntil;
      if (moving) this.frogCharge += dt;

      if (this.frogCharge >= frogInterval(owned.frog)) {
        this.frogCharge = 0;
        this.fart();
      }
    }

    if (owned.teapot) {
      this.teapotCharge += dt;
      const interval = teapotInterval(owned.teapot);

      if (this.teapotCharge >= interval) {
        this.teapotCharge -= interval;
        this.summonMouse();
      }
    }

    for (const key of Object.keys(owned)) {
      const def = ITEM_BY_KEY[key];
      if (!def || !def.active) continue;

      this.activeTimers[key] = (this.activeTimers[key] || 0) - dt;
      if (this.activeTimers[key] > 0) continue;

      this.activeTimers[key] = activeCooldown(key, owned[key]);
      this.triggerActive(key, owned[key]);
    }
  }

  triggerActive(key, stacks) {
    if (key === 'flamer') this.burstFlame(stacks);
    else if (key === 'mine') this.dropMine();
    else if (key === 'totem') this.healNow(12 + 4 * (stacks - 1));
    else if (key === 'emp') this.burstEmp(stacks);
    else if (key === 'chicken') this.squawk();
    else if (key === 'blackhole') this.spawnBlackhole();
  }

  /// 尖叫鸡: one scream, every enemy takes a little damage and flinches.
  squawk() {
    const damage = this.state.damage * 0.35;
    const ring = this.add
      .circle(this.player.x, this.player.y, 40, 0xffd166, 0.3)
      .setDepth(6);

    this.tweens.add({
      targets: ring,
      scale: 8,
      alpha: 0,
      duration: 520,
      onComplete: () => ring.destroy()
    });

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      enemy.setData('slowUntil', this.time.now + 3000);
      this.damageEnemy(enemy, damage);
    }

    this.cameras.main.shake(120, 0.004);
    haptic('squeak');
    Sfx.zap();
  }

  /// 黑洞发生器: a hole opens at a random spot, drags the horde in, then pops.
  spawnBlackhole() {
    const x = Phaser.Math.Between(70, Math.max(80, this.layout.width - 70));
    const y = Phaser.Math.Between(
      this.safeTop + 70,
      Math.max(this.safeTop + 80, this.layout.height - 70)
    );

    const sprite = this.add.circle(x, y, 26, 0x1b0f2a, 0.92).setDepth(5);
    sprite.setStrokeStyle(2, 0xb07bff, 0.9);

    this.blackholes.push({
      sprite,
      until: this.time.now + 1200,
      damage: this.state.damage * 1.2
    });

    this.tweens.add({
      targets: sprite,
      scale: { from: 0.4, to: 1 },
      duration: 200,
      ease: 'Back.out'
    });

    Sfx.zap();
  }

  updateBlackholes(delta) {
    if (this.blackholes.length === 0) return;

    const now = this.time.now;

    for (let i = this.blackholes.length - 1; i >= 0; i--) {
      const hole = this.blackholes[i];
      const sprite = hole.sprite;

      if (!sprite.active || now > hole.until) {
        if (sprite.active) {
          const radius = 120;
          this.spawnBurst(sprite.x, sprite.y, 0xb07bff, 12);

          for (const enemy of this.enemies.getChildren()) {
            if (!enemy.active) continue;
            if (
              Phaser.Math.Distance.Between(sprite.x, sprite.y, enemy.x, enemy.y) >
              radius
            ) {
              continue;
            }
            this.damageEnemy(enemy, hole.damage);
          }

          this.tweens.add({
            targets: sprite,
            scale: 1.6,
            alpha: 0,
            duration: 200,
            onComplete: () => sprite.destroy()
          });
        }

        this.blackholes.splice(i, 1);
        Sfx.mine();
        continue;
      }

      for (const enemy of this.enemies.getChildren()) {
        if (!enemy.active || !enemy.body) continue;
        const dist = Phaser.Math.Distance.Between(
          sprite.x,
          sprite.y,
          enemy.x,
          enemy.y
        );
        if (dist > 240) continue;

        const angle = Math.atan2(sprite.y - enemy.y, sprite.x - enemy.x);
        enemy.body.velocity.set(Math.cos(angle) * 260, Math.sin(angle) * 260);
      }
    }
  }

  /// A melee swing: a short arc that hits everything in front and throws it.
  swingWeapon(stats, target) {
    const base = Math.atan2(
      target.y - this.player.y,
      target.x - this.player.x
    );
    const r = stats.range;

    const arc = this.add.graphics().setDepth(8);
    arc.fillStyle(stats.def.color, 0.3);
    arc.beginPath();
    arc.arc(this.player.x, this.player.y, r, base - 0.9, base + 0.9, false);
    arc.lineTo(this.player.x, this.player.y);
    arc.closePath();
    arc.fillPath();

    this.tweens.add({
      targets: arc,
      alpha: 0,
      duration: 200,
      onComplete: () => arc.destroy()
    });

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;

      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        enemy.x,
        enemy.y
      );
      if (dist > r + 14) continue;

      const angle = Math.atan2(
        enemy.y - this.player.y,
        enemy.x - this.player.x
      );
      if (Math.abs(Phaser.Math.Angle.Wrap(angle - base)) > 1.1) continue;

      this.damageEnemy(enemy, stats.damage);
      enemy.setData('knockUntil', this.time.now + 260);
      enemy.setData('knockX', Math.cos(angle));
      enemy.setData('knockY', Math.sin(angle));
    }

    Sfx.hit();
    this.hapticOnce('impact', 120);
  }

  /// 闪电法杖: bolts fall on a few random enemies in range.
  smiteWeapon(stats) {
    const pool = [];

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        enemy.x,
        enemy.y
      );
      if (dist > stats.range) continue;
      pool.push(enemy);
    }

    const count = Math.min(stats.count, pool.length);

    for (let i = 0; i < count; i++) {
      const enemy = pool.splice(Phaser.Math.Between(0, pool.length - 1), 1)[0];

      const bolt = this.add.graphics().setDepth(9);
      bolt.lineStyle(3, 0xffee88, 0.95);
      bolt.lineBetween(
        enemy.x + Phaser.Math.Between(-40, 40),
        this.safeTop,
        enemy.x,
        enemy.y
      );

      this.tweens.add({
        targets: bolt,
        alpha: 0,
        duration: 180,
        onComplete: () => bolt.destroy()
      });

      this.spawnBurst(enemy.x, enemy.y, 0xffee88, 3);
      this.damageEnemy(enemy, stats.damage);
    }

    if (count > 0) Sfx.zap();
  }

  /// 毒液蘑菇: a puddle of poison at the player's feet.
  dropPoisonPool(stats) {
    const pool = this.add
      .circle(this.player.x, this.player.y, 44, 0x9be564, 0.28)
      .setDepth(1);

    this.poisonPools.push({
      sprite: pool,
      damage: stats.damage,
      until: this.time.now + 4500,
      tickAt: 0
    });

    if (this.poisonPools.length > 5) {
      const old = this.poisonPools.shift();
      old.sprite.destroy();
    }
  }

  updatePoisonPools(delta) {
    if (this.poisonPools.length === 0) return;

    const now = this.time.now;

    for (let i = this.poisonPools.length - 1; i >= 0; i--) {
      const pool = this.poisonPools[i];

      if (!pool.sprite.active || now > pool.until) {
        if (pool.sprite.active) {
          const sprite = pool.sprite;
          this.tweens.add({
            targets: sprite,
            alpha: 0,
            duration: 260,
            onComplete: () => sprite.destroy()
          });
        }
        this.poisonPools.splice(i, 1);
        continue;
      }

      if (now < pool.tickAt) continue;
      pool.tickAt = now + 500;

      for (const enemy of this.enemies.getChildren()) {
        if (!enemy.active) continue;
        if (
          Phaser.Math.Distance.Between(
            pool.sprite.x,
            pool.sprite.y,
            enemy.x,
            enemy.y
          ) > 52
        ) {
          continue;
        }

        enemy.setData('slowUntil', now + 1200);
        this.damageEnemy(enemy, pool.damage);
      }
    }
  }

  /// 仙人掌: planted where the player stands, pricks anyone who touches it.
  placeCactusWeapon(stats) {
    if (this.cactuses.length >= 3) {
      const old = this.cactuses.shift();
      old.sprite.destroy();
    }

    const sprite = this.add
      .text(this.player.x, this.player.y, '🌵', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: `${Math.round(28 * this.layout.uiScale)}px`
      })
      .setOrigin(0.5, 0.8)
      .setDepth(4);

    this.cactuses.push({
      sprite,
      damage: stats.damage,
      tickAt: 0,
      until: this.time.now + 12000
    });

    this.tweens.add({
      targets: sprite,
      scale: { from: 0.4, to: 1 },
      duration: 220,
      ease: 'Back.out'
    });
  }

  updateCacti(delta) {
    if (this.cactuses.length === 0) return;

    const now = this.time.now;

    for (let i = this.cactuses.length - 1; i >= 0; i--) {
      const cactus = this.cactuses[i];

      if (!cactus.sprite.active || now > cactus.until) {
        if (cactus.sprite.active) {
          const sprite = cactus.sprite;
          this.tweens.add({
            targets: sprite,
            alpha: 0,
            duration: 220,
            onComplete: () => sprite.destroy()
          });
        }
        this.cactuses.splice(i, 1);
        continue;
      }

      if (now < cactus.tickAt) continue;
      cactus.tickAt = now + 500;

      for (const enemy of this.enemies.getChildren()) {
        if (!enemy.active) continue;
        const dist = Phaser.Math.Distance.Between(
          cactus.sprite.x,
          cactus.sprite.y,
          enemy.x,
          enemy.y
        );
        if (dist > 46) continue;

        const angle = Math.atan2(
          enemy.y - cactus.sprite.y,
          enemy.x - cactus.sprite.x
        );
        enemy.setData('knockUntil', now + 200);
        enemy.setData('knockX', Math.cos(angle));
        enemy.setData('knockY', Math.sin(angle));
        this.damageEnemy(enemy, cactus.damage);
      }
    }
  }

  /// 回旋镖: flies out, turns around, hits everything again on the way back.
  throwBoomerang(stats, target) {
    const angle = Math.atan2(
      target.y - this.player.y,
      target.x - this.player.x
    );

    const sprite = this.add
      .image(this.player.x, this.player.y, 'disc')
      .setDepth(9)
      .setTint(stats.def.color);

    this.boomerangs.push({
      sprite,
      angle,
      speed: stats.speed,
      travelled: 0,
      outLimit: Math.min(stats.range, 240),
      phase: 'out',
      damage: stats.damage,
      hit: new Set()
    });

    Sfx.shoot();
  }

  updateBoomerangs(delta) {
    if (this.boomerangs.length === 0) return;

    const dt = delta / 1000;

    for (let i = this.boomerangs.length - 1; i >= 0; i--) {
      const b = this.boomerangs[i];
      const sprite = b.sprite;

      if (!sprite.active) {
        this.boomerangs.splice(i, 1);
        continue;
      }

      if (b.phase === 'out') {
        sprite.x += Math.cos(b.angle) * b.speed * dt;
        sprite.y += Math.sin(b.angle) * b.speed * dt;
        b.travelled += b.speed * dt;

        if (b.travelled >= b.outLimit) {
          b.phase = 'back';
          b.hit.clear();
        }
      } else {
        const dx = this.player.x - sprite.x;
        const dy = this.player.y - sprite.y;
        const dist = Math.hypot(dx, dy) || 1;

        sprite.x += (dx / dist) * b.speed * dt;
        sprite.y += (dy / dist) * b.speed * dt;

        if (dist < 26) {
          sprite.destroy();
          this.boomerangs.splice(i, 1);
          continue;
        }
      }

      sprite.rotation += dt * 12;

      for (const enemy of this.enemies.getChildren()) {
        if (!enemy.active || b.hit.has(enemy)) continue;
        if (
          Phaser.Math.Distance.Between(sprite.x, sprite.y, enemy.x, enemy.y) > 26
        ) {
          continue;
        }

        b.hit.add(enemy);
        this.damageEnemy(enemy, b.damage);
      }
    }
  }

  /// 狂躁症药丸 pays its price here: a sliver of health, no i-frames.
  drainHp(amount) {
    const s = this.state;
    s.hp = Math.max(0, s.hp - amount);
    if (s.hp <= 0) this.gameOver();
  }

  /// 固定炮塔: one deployment per stack, planted around the player as the wave
  /// begins and packed away the moment it ends.
  spawnWaveTurrets() {
    const stacks = this.items ? this.items.turret || 0 : 0;
    if (stacks <= 0) return;

    const count = Math.min(2, stacks);
    const field = this.layout.field;
    const base = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      const angle = base + (i / count) * Math.PI * 2;
      const x = Phaser.Math.Clamp(
        this.player.x + Math.cos(angle) * 46,
        28,
        field.width - 28
      );
      const y = Phaser.Math.Clamp(
        this.player.y + Math.sin(angle) * 46,
        28,
        field.height - 28
      );

      const turret = this.add.image(x, y, 'turret').setDepth(4).setScale(0.2);
      turret.setData('cool', 400);
      turret.setData('stacks', stacks);

      this.tweens.add({
        targets: turret,
        scale: 1,
        duration: 220,
        ease: 'Back.out'
      });

      this.turrets.push(turret);
      this.spawnBurst(x, y, 0x39e6cd, 4);
    }

    Sfx.buy();
  }

  clearTurrets() {
    for (const turret of this.turrets) {
      if (!turret.active) continue;
      this.tweens.killTweensOf(turret);
      this.spawnBurst(turret.x, turret.y, 0x39e6cd, 4);
      turret.destroy();
    }
    this.turrets = [];
  }

  updateTurrets(delta) {
    if (this.turrets.length === 0) return;

    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const turret = this.turrets[i];
      if (!turret.active) {
        this.turrets.splice(i, 1);
        continue;
      }

      const target = this.nearestEnemyFrom(turret.x, turret.y, 300);
      if (!target) continue;

      turret.setRotation(
        Phaser.Math.Angle.Between(turret.x, turret.y, target.x, target.y) +
          Math.PI / 2
      );

      const cool = (turret.getData('cool') || 0) - delta;
      if (cool > 0) {
        turret.setData('cool', cool);
        continue;
      }

      const stacks = turret.getData('stacks') || 1;
      turret.setData('cool', Math.max(280, 620 - 120 * (stacks - 1)));
      this.fireTurret(turret, target, stacks);
    }
  }

  fireTurret(turret, target, stacks) {
    if (!this.running) return;

    const angle = Phaser.Math.Angle.Between(
      turret.x,
      turret.y,
      target.x,
      target.y
    );

    const bullet = this.bullets.create(
      turret.x + Math.cos(angle) * 14,
      turret.y + Math.sin(angle) * 14,
      'bullet'
    );
    if (!bullet) return;

    bullet.setDepth(7);
    bullet.setRotation(angle);
    bullet.body.setCircle(5, 3, 3);
    bullet.setVelocity(Math.cos(angle) * 580, Math.sin(angle) * 580);
    bullet.setData('damage', this.state.damage * 0.5 * stacks);
    bullet.setData('pierce', 0);
    bullet.setData('slow', 0);
    bullet.setData('splash', 0);
    bullet.setData('hits', []);
    bullet.setData('age', 0);
  }

  // ------------------------------------------------------------ companions

  /// Keeps one visible entity per summon item — the pet rat, the orbiting orb,
  /// the guard drone. Rebuilt whenever a summon item is bought.
  syncCompanions() {
    for (const companion of this.companions) {
      if (companion.sprite) {
        this.tweens.killTweensOf(companion.sprite);
        companion.sprite.destroy();
      }
      if (companion.glow) companion.glow.destroy();
      if (companion.body) companion.body.destroy();
    }
    this.companions = [];

    const pets = Math.min(2, this.items.pet || 0);
    for (let i = 0; i < pets; i++) {
      const sprite = this.add
        .image(this.player.x, this.player.y + 20, 'mouse')
        .setDepth(11)
        .setTint(0xffd166)
        .setScale(0.95);

      this.companions.push({
        kind: 'pet',
        sprite,
        phase: Math.random() * Math.PI * 2,
        state: 'follow',
        readyAt: 0
      });
    }

    const orbs = Math.min(2, this.items.orb || 0);
    for (let i = 0; i < orbs; i++) {
      const glow = this.add
        .circle(this.player.x, this.player.y, 14, 0x8fd8ff, 0.18)
        .setDepth(10);
      const sprite = this.add
        .circle(this.player.x, this.player.y, 7, 0x8fd8ff, 0.95)
        .setDepth(11);

      this.companions.push({
        kind: 'orb',
        sprite,
        glow,
        angle: (i / Math.max(1, orbs)) * Math.PI * 2,
        readyAt: 0
      });
    }

    const drones = Math.min(2, this.items.drone || 0);
    for (let i = 0; i < drones; i++) {
      const body = this.add
        .rectangle(this.player.x, this.player.y - 40, 18, 8, 0x1b2634)
        .setStrokeStyle(2, 0x63ffe0)
        .setDepth(11);
      const sprite = this.add
        .circle(this.player.x, this.player.y - 40, 5, 0x63ffe0, 0.95)
        .setDepth(12);

      this.companions.push({
        kind: 'drone',
        sprite,
        body,
        angle: i * Math.PI,
        readyAt: 0
      });
    }
  }

  updateCompanions(delta) {
    if (this.companions.length === 0) return;

    const px = this.player.x;
    const py = this.player.y;

    for (const companion of this.companions) {
      if (companion.kind === 'pet') this.updatePet(companion, delta, px, py);
      else if (companion.kind === 'orb') this.updateOrb(companion, delta, px, py);
      else if (companion.kind === 'drone') {
        this.updateDrone(companion, delta, px, py);
      }
    }
  }

  /// 宠物鼠: trots around the player, then leaps at anything close and bites it
  /// before trotting back.
  updatePet(pet, delta, px, py) {
    if (pet.state === 'leap') return;

    const target = this.nearestEnemyFrom(px, py, 165);

    if (target && this.time.now >= pet.readyAt) {
      pet.state = 'leap';
      pet.readyAt = this.time.now + 1000;

      const tx = target.x;
      const ty = target.y;

      this.tweens.add({
        targets: pet.sprite,
        x: tx,
        y: ty,
        scale: 1.25,
        duration: 180,
        ease: 'Quad.out',
        onComplete: () => {
          if (target.active && this.running) {
            this.damageEnemy(target, this.state.damage * 0.9);
            this.spawnBurst(tx, ty, 0xffd166, 4);
          }

          this.tweens.add({
            targets: pet.sprite,
            scale: 0.95,
            duration: 160,
            onComplete: () => {
              pet.state = 'follow';
            }
          });
        }
      });
      return;
    }

    pet.phase += delta / 650;
    const tx = px + Math.cos(pet.phase) * 34;
    const ty = py + Math.sin(pet.phase) * 20 + 12;
    const k = Math.min(1, delta / 90);

    pet.sprite.x += (tx - pet.sprite.x) * k;
    pet.sprite.y += (ty - pet.sprite.y) * k;
  }

  /// 环绕光球: circles the player and burns whatever it touches.
  updateOrb(orb, delta, px, py) {
    orb.angle += delta * 0.0024;

    const x = px + Math.cos(orb.angle) * 58;
    const y = py + Math.sin(orb.angle) * 46;

    orb.sprite.setPosition(x, y);
    if (orb.glow) orb.glow.setPosition(x, y);

    if (this.time.now < orb.readyAt) return;

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > 22) continue;

      orb.readyAt = this.time.now + 260;
      this.damageEnemy(enemy, this.state.damage * 0.5);
      this.spawnBurst(x, y, 0x8fd8ff, 3);
      break;
    }
  }

  /// 守卫无人机: hovers over the player and cuts down the nearest enemy with a
  /// visible beam.
  updateDrone(drone, delta, px, py) {
    drone.angle += delta * 0.0012;

    const x = px + Math.cos(drone.angle) * 44;
    const y = py - 38 + Math.sin(drone.angle * 1.6) * 12;

    if (drone.body) drone.body.setPosition(x, y);
    if (drone.sprite) drone.sprite.setPosition(x, y);

    if (this.time.now < drone.readyAt) return;

    const target = this.nearestEnemyFrom(x, y, 340);
    if (!target) return;

    drone.readyAt = this.time.now + 700;

    const beam = this.add.graphics().setDepth(11);
    beam.lineStyle(3, 0x63ffe0, 0.75);
    beam.lineBetween(x, y, target.x, target.y);
    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 140,
      onComplete: () => beam.destroy()
    });

    this.damageEnemy(target, this.state.damage * 0.45);
    Sfx.hit();
  }

  /// Two identical guns at the same rarity pulse in the weapon bar, so the
  /// player notices there is a merge waiting in the shop.
  drawMergeHints() {
    const g = this.mergeGfx;
    if (!g) return;

    g.clear();

    const pairs = this.mergeablePairs();
    if (pairs.length === 0) return;

    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 180);

    for (const pair of pairs) {
      for (const index of [pair.a, pair.b]) {
        const pos = this.slotPositions[index];
        if (!pos) continue;

        g.lineStyle(3, 0xffd166, 0.3 + 0.55 * pulse);
        g.strokeCircle(pos.x, pos.y, pos.r + 3 + 2 * pulse);
      }
    }
  }

  /// The nearest live enemy to an arbitrary point, used by turrets and companions.
  nearestEnemyFrom(x, y, range) {
    let best = null;
    let bestDist = range;

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      const d = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (d < bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    return best;
  }

  /// 喷火器: a ring of fire around the player.
  burstFlame(stacks) {
    const x = this.player.x;
    const y = this.player.y;
    const radius = 110 + 20 * stacks;
    const damage = this.state.damage * (0.5 + 0.2 * stacks);

    const ring = this.add.circle(x, y, radius * 0.4, 0xff7a1f, 0.28).setDepth(6);
    this.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 420,
      onComplete: () => ring.destroy()
    });

    this.spawnBurst(x, y, 0xff9a3f, 8);

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > radius) continue;
      this.damageEnemy(enemy, damage);
    }

    Sfx.flame();
  }

  /// 便携地雷: a little charge left on the floor.
  dropMine() {
    const mine = this.add
      .circle(this.player.x, this.player.y, 7, 0xff5a72, 0.9)
      .setDepth(4);
    mine.setData('age', 0);
    this.mines.push(mine);

    this.tweens.add({
      targets: mine,
      alpha: 0.35,
      duration: 380,
      yoyo: true,
      repeat: -1
    });

    Sfx.click();
  }

  updateMines(dt) {
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const mine = this.mines[i];
      if (!mine.active) {
        this.mines.splice(i, 1);
        continue;
      }

      const age = (mine.getData('age') || 0) + dt;
      mine.setData('age', age);

      let trigger = age > 8;
      if (!trigger) {
        for (const enemy of this.enemies.getChildren()) {
          if (!enemy.active) continue;
          const d = Phaser.Math.Distance.Between(
            mine.x,
            mine.y,
            enemy.x,
            enemy.y
          );
          if (d < 34) {
            trigger = true;
            break;
          }
        }
      }

      if (!trigger) continue;
      this.mines.splice(i, 1);
      this.explodeMine(mine);
    }
  }

  explodeMine(mine) {
    const x = mine.x;
    const y = mine.y;
    this.tweens.killTweensOf(mine);
    mine.destroy();

    const radius = 76;
    const damage = this.state.damage * 1.3;

    const ring = this.add.circle(x, y, radius * 0.4, 0xffb038, 0.35).setDepth(6);
    this.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 320,
      onComplete: () => ring.destroy()
    });

    this.spawnBurst(x, y, 0xff7a1f, 10);

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > radius) continue;
      this.damageEnemy(enemy, damage);
    }

    Sfx.mine();
  }

  /// 电磁脉冲: a shockwave that damages and slows the whole crowd.
  burstEmp(stacks) {
    const x = this.player.x;
    const y = this.player.y;
    const radius = 210 + 30 * stacks;
    const damage = this.state.damage * (0.45 + 0.15 * stacks);

    const ring = this.add.circle(x, y, radius * 0.35, 0x8fd8ff, 0.25).setDepth(6);
    this.tweens.add({
      targets: ring,
      scale: 3,
      alpha: 0,
      duration: 520,
      onComplete: () => ring.destroy()
    });

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > radius) continue;

      enemy.setData('slowUntil', this.time.now + 3000);
      this.damageEnemy(enemy, damage);
    }

    Sfx.zap();
  }

  healNow(amount) {
    const before = this.state.hp;
    this.state.hp = Math.min(this.state.maxHp, this.state.hp + amount);
    if (this.state.hp > before) {
      this.notify('+生命', this.player.x, this.player.y);
    }
    Sfx.heal();
  }

  /// 发条青蛙: a puff of green gas at the player's feet. Whatever is standing in
  /// it takes a hit and crawls out of it slowed.
  fart() {
    const x = this.player.x;
    const y = this.player.y;
    const stacks = this.items.frog || 1;

    const radius = 88 + 8 * stacks;
    const damage = this.state.damage * (0.55 + 0.25 * stacks);

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + Math.random();
      const bubble = this.add
        .circle(
          x + Math.cos(angle) * 12,
          y + Math.sin(angle) * 12,
          9 + Math.random() * 8,
          0x7fe36b,
          0.4
        )
        .setDepth(6);

      this.tweens.add({
        targets: bubble,
        x: x + Math.cos(angle) * radius * 0.8,
        y: y + Math.sin(angle) * radius * 0.8,
        alpha: 0,
        scale: 1.6,
        duration: 520 + Math.random() * 180,
        onComplete: () => bubble.destroy()
      });
    }

    const ring = this.add
      .circle(x, y, radius * 0.5, 0x7fe36b, 0.18)
      .setDepth(5);
    this.tweens.add({
      targets: ring,
      scale: 2,
      alpha: 0,
      duration: 480,
      onComplete: () => ring.destroy()
    });

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist > radius) continue;

      enemy.setData('slowUntil', this.time.now + 1400);
      this.damageEnemy(enemy, damage);
    }

    haptic('fart');
  }

  /// 尖叫的茶壶: a mouse pops up somewhere on the floor. It is quick, it pays coins
  /// when it dies, and it bites whoever it reaches.
  summonMouse() {
    const def = ENEMY_TYPES.mouse;
    if (!def) return;

    markDiscovered('mouse');

    // Two pests at a time is plenty: a crowd of them would be unreadable.
    let live = 0;
    for (const enemy of this.enemies.getChildren()) {
      if (enemy.active && enemy.getData('teapot')) live += 1;
    }
    if (live >= 2) return;

    const field = this.layout.field;
    let x = field.centerX;
    let y = field.centerY;

    for (let i = 0; i < 10; i++) {
      x = Phaser.Math.Between(34, Math.max(35, field.width - 34));
      y = Phaser.Math.Between(34, Math.max(35, field.height - 34));

      const far = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
      if (far > 140) break;
    }

    const mouse = this.makeEnemy(def, x, y);
    if (!mouse) return;

    // A pest is a pest at any wave: no tier scaling, always one clean shot.
    mouse.setData('hp', def.hp);
    mouse.setData('maxHp', def.hp);
    mouse.setData('teapot', true);

    this.notify('吱！', x, y);
    haptic('squeak');

    // Left alone it scurries off, so the floor never fills up with them.
    const pest = mouse;
    this.time.delayedCall(13000, () => {
      if (!pest.active) return;
      this.spawnBurst(pest.x, pest.y, 0xf0a05a, 4);
      this.kill(pest);
    });
  }

  /// Every coin goes through here, so a capped purse can never overflow.
  addCoins(amount) {
    const s = this.state;
    const cap = Number.isFinite(s.coinCap) ? s.coinCap : Infinity;
    const before = s.coins;

    s.coins = Math.min(cap, before + amount);
    return s.coins - before;
  }

  flushDead() {
    while (this.dead.length > 0) {
      const object = this.dead.pop();
      if (object && object.scene) object.destroy();
    }
  }

  // --------------------------------------------------------------- combat

  onBulletHit(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;

    // A piercing round must not hit the same enemy on every overlapping frame.
    const hits = bullet.getData('hits');
    if (hits) {
      if (hits.indexOf(enemy) !== -1) return;
      hits.push(enemy);
    }

    let damage = bullet.getData('damage') || 1;
    const crit =
      this.state.critChance > 0 && Math.random() < this.state.critChance;
    if (crit) {
      damage *= this.state.critMult;
      this.dropCoin(enemy.x, enemy.y, 14);
    }

    // The frost gun and the toxin darts slow whatever they touch.
    const slow = bullet.getData('slow') || 0;
    if (slow > 0) {
      enemy.setData('slowUntil', this.time.now + 1200);
    }

    this.damageEnemy(enemy, damage);

    // A rocket bursts on impact and catches everything standing nearby.
    const splash = bullet.getData('splash') || 0;
    if (splash > 0) {
      this.spawnBurst(enemy.x, enemy.y, 0xff9a3f, 9);

      for (const other of this.enemies.getChildren()) {
        if (other === enemy || !other.active) continue;
        const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
        if (d <= splash) this.damageEnemy(other, damage * 0.6);
      }
      Sfx.mine();
    } else {
      Sfx.hit();
    }

    const pierce = bullet.getData('pierce') || 0;
    if (pierce > 0) {
      bullet.setData('pierce', pierce - 1);
    } else {
      this.kill(bullet);
    }
  }

  // Both of the handlers below are wired to an overlap of a Group against the
  // single player sprite. Phaser hands those callbacks the lone object FIRST and
  // the group member second, whatever order overlap() was given — so each
  // handler works out which argument is the player instead of trusting order.
  onEnemyTouch(a, b) {
    const enemy = a === this.player ? b : a;
    if (!this.running || !enemy || enemy === this.player || !enemy.active)
      return;

    const now = this.time.now;
    if (now < this.dashUntil) return;
    if (now < this.invulnUntil) return;

    // A hit that goes wrong must never take the whole run down with it: an
    // exception thrown inside a physics callback stops the game loop dead.
    try {
      this.hurt(enemy.getData('damage') || 8);
    } catch (error) {
      console.warn('Contact damage failed:', error);
    }
  }

  damageEnemy(enemy, amount) {
    const s = this.state;

    if (s.lifesteal > 0) {
      s.hp = Math.min(s.maxHp, s.hp + amount * s.lifesteal);
    }
    if (s.slowOnHit > 0) {
      enemy.setData('slowUntil', this.time.now + 1500);
    }

    // 冷冻剂 pays off against anything already crawling: the frost gun, the
    // toxin darts, the EMP and the frog's gas all set this up.
    const slowed = (enemy.getData('slowUntil') || 0) > this.time.now;
    const dealt = slowed ? amount * (1 + (s.slowBonus || 0)) : amount;

    const hp = (enemy.getData('hp') || 1) - dealt;
    if (hp <= 0) {
      this.killEnemy(enemy);
      return;
    }
    enemy.setData('hp', hp);
    enemy.setTint(0xffffff);
    const target = enemy;
    this.time.delayedCall(70, () => {
      if (target.active) target.clearTint();
    });
  }

  killEnemy(enemy) {
    if (!enemy.active) return;

    const xp = enemy.getData('xp') || 1;
    const gems = enemy.getData('gems') || 1;
    const color = enemy.getData('color') || COLORS.purple;
    const isBoss = enemy.getData('behaviour') === 'boss';

    this.spawnBurst(enemy.x, enemy.y, color, isBoss ? 24 : gems > 1 ? 13 : 7);

    // The elite leaves a fistful of shards where it fell.
    for (let i = 0; i < gems; i++) {
      this.dropGem(enemy.x, enemy.y, xp, 6 + i * 5);
    }

    // Coins are not guaranteed: the small fry mostly do not pay out, which is
    // what makes saving up for something in the shop a real decision. The wave's
    // coin budget is a hard ceiling on top of that.
    const coins = enemy.getData('coins') || 1;
    const coinChance =
      enemy.getData('coinChance') === undefined
        ? 1
        : enemy.getData('coinChance');
    if (Math.random() < coinChance) {
      // 生锈的硬币 doubles what every corpse pays out, and a hard run pays a
      // little more on top of that.
      const value = (this.state.coinMult || 1) * this.difficulty.coin;
      for (let i = 0; i < coins; i++) {
        if (this.coinsDropped >= this.coinBudget) break;
        this.dropCoin(enemy.x, enemy.y, 8 + i * 4, value);
        this.coinsDropped += 1;
      }
    }

    this.state.kills += 1;
    if (gems > 1) haptic('impact');

    // Off the board before the chain runs, so a chain reaction can never come
    // back round and kill this corpse a second time.
    this.kill(enemy);
    this.hapticOnce('enemy_death', 90);
    Sfx.kill();

    // 连锁反应: the corpse goes off and takes a bite out of the crowd.
    if (this.state.chainKill > 0) {
      const stacks = this.items.chain || 1;
      const radius = 46 + 10 * stacks;
      const damage = this.state.damage * 0.35 * stacks;

      this.spawnBurst(enemy.x, enemy.y, 0xff9a3f, 5);
      for (const other of this.enemies.getChildren()) {
        if (other === enemy || !other.active) continue;
        const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
        if (d <= radius) this.damageEnemy(other, damage);
      }
    }

    if (isBoss) this.onBossDefeated();
  }

  /// A boss falling is what ends its wave: a bigger heal and a shower of shards
  /// land first, then the usual wave-clear card opens.
  onBossDefeated() {
    if (!this.bossFight) return;
    this.bossFight = false;
    this.boss = null;

    haptic('wave_clear');

    this.announceAchievements(recordAchievement({ bossKills: 1 }));

    this.state.hp = Math.min(this.state.maxHp, this.state.hp + 20);
    for (let i = 0; i < 10; i++) {
      this.dropGem(
        this.player.x + Phaser.Math.Between(-70, 70),
        this.player.y + Phaser.Math.Between(-70, 70),
        3,
        10
      );
    }

    this.endWave();
  }

  /// One tap per burst: a wave of deaths should read as a rumble, not a
  /// machine gun of separate ticks.
  hapticOnce(name, gap) {
    const now = this.time.now;
    if (now - this.hapticAt < gap) return;
    this.hapticAt = now;
    haptic(name);
  }

  kill(object) {
    if (!object || !object.active) return;
    // Never let a stray callback take the player out of the scene: with no
    // player every later frame throws and the whole game locks up.
    if (object === this.player) return;

    // The elite's ground glow is a separate object and has to go with it.
    const aura = object.getData ? object.getData('aura') : null;
    if (aura) {
      this.tweens.killTweensOf(aura);
      aura.destroy();
    }

    object.setActive(false);
    object.setVisible(false);
    if (object.body) {
      object.body.enable = false;
    }
    this.dead.push(object);
  }

  spawnBurst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 70;
      const dot = this.add
        .circle(x, y, 2 + Math.random() * 2, color, 0.95)
        .setDepth(8);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.4,
        duration: 260 + Math.random() * 180,
        onComplete: () => dot.destroy()
      });
    }
  }

  dropGem(x, y, value, spread = 5) {
    this.dropPickup('gem', 'gem', value, x, y, spread);
  }

  dropCoin(x, y, spread = 8, value = 1) {
    this.dropPickup('coin', 'coin', value, x, y, spread);
  }

  /// A small solid heart on the floor: walk over it and a chunk of health comes
  /// back. Coin-sized, so it reads as a pickup rather than a landmark.
  dropHeart() {
    const field = this.layout.field;
    const top = (this.safeTop || 0) + 50;
    const x = Phaser.Math.Between(40, Math.max(50, field.width - 40));
    const y = Phaser.Math.Between(
      top,
      Math.max(this.safeTop + 60, field.height - 70)
    );

    const heart = this.add.graphics().setDepth(2);
    heart.fillStyle(0xff4d6a, 1);
    heart.fillCircle(-3.6, -2.4, 4.6);
    heart.fillCircle(3.6, -2.4, 4.6);
    heart.fillTriangle(-7.6, -0.4, 7.6, -0.4, 0, 8);
    heart.setPosition(x, y);
    heart.setScale(0.95);

    heart.setData('kind', 'heart');
    heart.setData('value', Math.round(this.state.maxHp * 0.12) + 6);

    this.tweens.add({
      targets: heart,
      scale: 1.15,
      duration: 650,
      yoyo: true,
      repeat: -1
    });

    this.pickups.push(heart);
    return true;
  }

  dropPickup(texture, kind, value, x, y, spread) {
    const pickup = this.add
      .image(
        x + Phaser.Math.Between(-spread, spread),
        y + Phaser.Math.Between(-spread, spread),
        texture
      )
      .setDepth(2)
      .setScale(0.12);

    pickup.setData('kind', kind);
    pickup.setData('value', value);
    // Shards are deliberately small: the field stays readable even when a big
    // drop is flying at the player.
    const targetScale = kind === 'coin' ? 0.8 : 0.62;
    this.tweens.add({
      targets: pickup,
      scale: targetScale,
      duration: 200,
      ease: 'Back.out'
    });
    this.pickups.push(pickup);
  }

  addXp(amount) {
    const s = this.state;
    s.xp += amount;
    while (s.xp >= s.xpNext) {
      s.xp -= s.xpNext;
      s.level += 1;
      // The cost is rebuilt from the wave, not compounded, so levelling stays at
      // roughly one per wave no matter how long the run goes.
      s.xpNext = xpForLevel(s.wave);

      // The card is banked, not shown: a level-up never interrupts a fight. It
      // is handed out when the wave is over, on the way back into the arena.
      this.levelsQueued = (this.levelsQueued || 0) + 1;
      haptic('level_up');
      Sfx.levelUp();
      if (this.player) this.notify('升级', this.player.x, this.player.y - 10);
    }
  }

  hurt(amount) {
    if (!this.running) return;

    const s = this.state;
    const taken = amount * (1 - (s.armor || 0));
    s.hp = Math.max(0, s.hp - taken);
    this.lastHurtAt = this.time.now;
    this.invulnUntil = this.time.now + 600;

    this.cameras.main.shake(140, 0.007);
    this.player.setTint(0xff8899);
    const player = this.player;
    this.time.delayedCall(140, () => {
      if (!player.active) return;

      player.clearTint();
      if (this.skinTint) player.setTint(this.skinTint);
    });

    this.spawnBurst(this.player.x, this.player.y, COLORS.danger, 6);
    haptic('hurt');
    Sfx.hurt();

    if (s.hp <= 0) this.gameOver();
  }

  // ----------------------------------------------------------------- waves

  startWave(wave) {
    const s = this.state;

    // A shop buff lasts exactly one wave: drop the old one, then take the new.
    this.clearWaveBuff();
    if (this.pendingBuff) {
      this.applyWaveBuff(this.pendingBuff);
      this.activeBuff = this.pendingBuff;
      this.pendingBuff = null;
    }

    s.wave = wave;
    // Whatever was banked toward the next level is re-measured against this
    // wave's price, so a cheap level cannot be saved up across waves.
    s.xpNext = Math.max(s.xpNext, xpForLevel(wave));

    // The loops switch with the stakes: a boss wave gets its own tense track.
    setMusicTrack(isBossWave(wave) ? 'boss' : 'battle');

    this.announceAchievements(
      recordAchievement(
        {
          wave,
          pair: this.state.weapons.length >= 2,
          endless: isEndlessWave(wave),
          maxCoins: Math.floor(this.state.coins)
        },
        this.character.key
      )
    );

    // Reaching a deep enough wave is what unlocks the hidden characters.
    const unlocked = recordWave(wave, this.difficulty.key);
    for (const character of unlocked) {
      haptic('level_up');
      this.notify(
        `解锁角色 ${character.name}`,
        this.layout.width / 2,
        this.layout.field.height * 0.5
      );
    }

    // Coins for the whole wave are budgeted up front, so a hundred kills in a
    // late wave cannot flood the purse, and the first waves still pay enough for
    // a shop purchase.
    this.coinBudget = coinBudgetForWave(wave);
    this.coinsDropped = 0;

    this.waveEnding = false;

    if (this.spawnTimer) {
      this.spawnTimer.remove();
      this.spawnTimer = null;
    }

    // 固定炮塔 sets up shop for the whole wave, boss waves included.
    this.spawnWaveTurrets();

    if (isBossWave(wave)) {
      // A boss wave has no clock: no spawns, no countdown. It ends when the
      // boss falls.
      this.bossFight = true;
      s.waveLeft = 0;
      this.banner(
        isEndlessWave(wave) ? `无尽波 ${wave} · 首领` : `第 ${wave} 波 · 首领`,
        '击败首领结束这一波'
      );
      this.time.delayedCall(700, () => this.spawnBoss());
      return;
    }

    this.bossFight = false;
    s.waveLeft = waveDuration(wave);

    const plan = waveSpawnPlan(wave);
    this.spawnTimer = this.time.addEvent({
      delay: plan.delay,
      loop: true,
      callback: this.spawnTick,
      callbackScope: this
    });

    this.banner(
      isEndlessWave(wave) ? `无尽波 ${wave}` : `第 ${wave} 波`,
      `坚持 ${Math.round(s.waveLeft)} 秒`
    );

    // An elite joins from wave 5, and a second one from wave 8.
    if (wave >= 5) {
      this.time.delayedCall(900, () => {
        if (!this.running || this.waveEnding) return;
        this.spawnExtra('elite');
        if (wave >= 8) this.spawnExtra('elite');
      });
    }
  }

  /// Drops one extra enemy of a given kind at a random edge of the field.
  spawnExtra(typeKey) {
    const def = ENEMY_TYPES[typeKey];
    if (!def) return;

    markDiscovered(typeKey);

    const field = this.layout.field;
    const edge = Phaser.Math.Between(0, 3);
    let x = 0;
    let y = 0;

    if (edge === 0) {
      x = Phaser.Math.Between(30, field.width - 30);
      y = this.safeTop + def.radius + 6;
    } else if (edge === 1) {
      x = field.width - def.radius - 14;
      y = Phaser.Math.Between(30, field.height - 30);
    } else if (edge === 2) {
      x = Phaser.Math.Between(30, field.width - 30);
      y = field.height - def.radius - 14;
    } else {
      x = def.radius + 14;
      y = Phaser.Math.Between(30, field.height - 30);
    }

    this.makeEnemy(def, x, y);
  }

  endWave() {
    if (this.waveEnding) return;
    this.waveEnding = true;

    if (this.spawnTimer) {
      this.spawnTimer.remove();
      this.spawnTimer = null;
    }

    // Everything left on the field evaporates so the player is never hit while
    // reading the reward screen — orbs included.
    for (const enemy of this.enemies.getChildren().slice()) {
      if (!enemy.active) continue;
      this.spawnBurst(
        enemy.x,
        enemy.y,
        enemy.getData('color') || COLORS.purple,
        5
      );
      this.kill(enemy);
    }
    for (const shot of this.enemyShots.getChildren().slice()) {
      if (shot.active) this.kill(shot);
    }

    // Turrets are wave equipment: they fold up when the wave is cleared.
    this.clearTurrets();

    this.state.hp = Math.min(this.state.maxHp, this.state.hp + 10);
    haptic('wave_clear');
    Sfx.waveClear();

    // The wave pays out its remaining coin budget at the player's feet, so the
    // income for a wave is steady no matter how many enemies showed up.
    const value = (this.state.coinMult || 1) * this.difficulty.coin;
    const remaining = Math.max(0, this.coinBudget - this.coinsDropped);

    if (remaining > 0) {
      const chunks = Math.min(8, remaining);
      const perChunk = Math.ceil(remaining / chunks);

      for (let i = 0; i < chunks; i++) {
        this.dropCoin(this.player.x, this.player.y, 18, perChunk * value);
      }
      this.coinsDropped += remaining;
    }

    const rewardGems = 2 + Math.floor(this.state.wave / 5);
    for (let i = 0; i < rewardGems; i++) {
      this.dropGem(this.player.x, this.player.y, 1, 16);
    }

    this.announceAchievements(
      recordAchievement({ maxCoins: Math.floor(this.state.coins) })
    );

    this.openShop();
  }

  startNextWave() {
    this.startWave(this.state.wave + 1);
  }

  spawnTick() {
    if (!this.running || this.waveEnding) return;

    // A heart on the floor, more likely the deeper and harder the run gets.
    const heartChance =
      Math.min(0.22, 0.02 + this.state.wave * 0.008) *
      (this.difficulty.hp || 1);
    if (Math.random() < heartChance) this.dropHeart();

    const plan = waveSpawnPlan(this.state.wave);
    if (this.enemies.countActive(true) >= plan.cap) return;

    for (let i = 0; i < plan.count; i++) this.spawnEnemy();
  }

  spawnEnemy() {
    const typeKey = pickEnemyType(this.state.wave);
    const def = ENEMY_TYPES[typeKey];
    if (!def) return;

    markDiscovered(typeKey);

    const field = this.layout.field;
    const edge = Phaser.Math.Between(0, 3);
    let x = 0;
    let y = 0;

    if (edge === 0) {
      x = Phaser.Math.Between(30, field.width - 30);
      y = this.safeTop + def.radius + 6;
    } else if (edge === 1) {
      x = field.width - def.radius - 14;
      y = Phaser.Math.Between(30, field.height - 30);
    } else if (edge === 2) {
      x = Phaser.Math.Between(30, field.width - 30);
      y = field.height - def.radius - 14;
    } else {
      x = def.radius + 14;
      y = Phaser.Math.Between(30, field.height - 30);
    }

    this.makeEnemy(def, x, y);
  }

  /// The boss drops into the top of the arena on its own, after the warning
  /// banner has had a moment to read.
  spawnBoss() {
    if (!this.running || !this.bossFight) return;

    const def = ENEMY_TYPES.boss;
    if (!def) return;

    markDiscovered('boss');

    const field = this.layout.field;
    const boss = this.makeEnemy(
      def,
      field.centerX,
      Math.max(this.safeTop + 60, field.height * 0.22)
    );
    if (!boss) return;

    this.boss = boss;
    boss.setCollideWorldBounds(true);
    boss.setData('actionTimer', 1400);
    this.spawnBurst(boss.x, boss.y, 0xff3d6e, 16);
    haptic('impact');
    Sfx.boss();
  }

  makeEnemy(def, x, y) {
    const wave = this.state.wave;

    const enemy = this.enemies.create(x, y, def.texture);
    if (!enemy) return null;

    enemy.setDepth(3);
    // Nothing walks up under the HUD strip; the world bounds take care of it.
    enemy.setCollideWorldBounds(true);
    const offX = def.offsetX || def.offset;
    const offY = def.offsetY || def.offset;
    enemy.body.setCircle(def.radius, offX, offY);

    // Every three waves the whole bestiary steps up a tier. The curve lives in
    // enemies.js so the late run cannot quietly drift out of control.
    const scale = waveScaling(wave);

    // The boss is a checkpoint rather than one more body: it outgrows the horde
    // it leads, so every fifth wave is a real wall.
    const bossBoost = def.behaviour === 'boss' ? 1.3 : 1;
    const hp = Math.max(
      1,
      Math.round(def.hp * scale.hp * bossBoost * this.difficulty.hp)
    );
    enemy.setData('hp', hp);
    enemy.setData('maxHp', hp);

    // Individuals differ: a herd moving at exactly one speed reads as scenery,
    // a herd with fast and slow members reads as a hunt.
    const jitter =
      def.behaviour === 'boss' ? 1 : Phaser.Math.FloatBetween(0.85, 1.25);
    enemy.setData('speed', def.speed * scale.speed * jitter);
    // A boss hits harder than the tier it stands in, but only slightly: one
    // charge should cost a chunk of health, never the whole run.
    const hitBoost = 1;
    enemy.setData(
      'damage',
      Math.round(def.damage * scale.damage * hitBoost * this.difficulty.damage)
    );

    // Steering: how far ahead of the player this one aims, plus a slow weave so
    // it never runs in a dead straight line.
    enemy.setData('lead', Phaser.Math.FloatBetween(0.06, 0.26));
    enemy.setData('weave', Phaser.Math.FloatBetween(0, 0.22));
    enemy.setData('phase', Math.random() * Math.PI * 2);
    enemy.setData('xp', def.xp);
    enemy.setData('gems', def.gems || 1);
    enemy.setData('coins', def.coins || 1);
    enemy.setData('coinChance', def.coinChance === undefined ? 1 : def.coinChance);
    enemy.setData('weaponChance', def.weaponChance || 0);
    enemy.setData('color', def.color);
    enemy.setData('behaviour', def.behaviour || 'chase');

    if (def.behaviour === 'ranged') {
      enemy.setData('keepNear', def.keepNear || 150);
      enemy.setData('keepFar', def.keepFar || 250);
      enemy.setData('shootInterval', def.shootInterval || 1900);
      enemy.setData(
        'shotDamage',
        Math.round((def.shotDamage || 7) * scale.damage * this.difficulty.damage)
      );
      enemy.setData(
        'shootTimer',
        (def.shootInterval || 1900) * Phaser.Math.FloatBetween(0.5, 1.2)
      );
      enemy.setData('strafe', Math.random() < 0.5 ? 1 : -1);
    }

    // Only the elite gets a glow beneath it: one look tells you it matters.
    if (def.aura) {
      const aura = this.add
        .ellipse(x, y, def.aura, def.aura * 0.62, def.auraColor || 0xff3d8b, 0.18)
        .setDepth(2);
      enemy.setData('aura', aura);
      this.tweens.add({
        targets: aura,
        alpha: 0.32,
        scale: 1.16,
        duration: 850,
        yoyo: true,
        repeat: -1
      });
    }

    // Spawn-in: scale only, so the physics circle never changes size.
    enemy.setScale(0.2);
    enemy.setAlpha(0.4);
    this.tweens.add({
      targets: enemy,
      scale: 1,
      alpha: 1,
      duration: 220,
      ease: 'Back.out'
    });

    return enemy;
  }

  // -------------------------------------------------------------- upgrades

  requestChoice(kind) {
    if (!this.running) return false;

    if (this.choiceOpen || this.bossFight) {
      this.pending.push(kind);
      return false;
    }

    const cards = rollCards(this.stacks, 3, this.state.weapons);
    if (cards.length === 0) return false;

    this.choiceOpen = true;
    if (kind === 'level') {
      haptic('level_up');
      Sfx.levelUp();
    }

    const title =
      kind === 'wave'
        ? `第 ${this.state.wave} 波 完成`
        : `等级提升 · Lv ${this.state.level}`;

    this.scene.launch('Choice', { kind, title, cards });
    this.scene.pause();
    return true;
  }

  /// Presents one banked level-up card, if any is waiting. Returns true when a
  /// card was opened, in which case the caller must leave the run frozen.
  flushLevelUps() {
    if (!this.running) return false;
    if (this.levelsQueued <= 0) return false;

    this.levelsQueued -= 1;
    return this.requestChoice('level');
  }

  finishChoice() {
    this.choiceOpen = false;

    // Whatever happens here, the run must not be left paused with no UI.
    try {
      // Cards for everything banked during the wave come first, one after
      // another, then any older request.
      if (this.flushLevelUps()) return;

      if (this.pending.length > 0) {
        const kind = this.pending.shift();
        if (this.requestChoice(kind)) return;
      }
    } catch (error) {
      console.warn('Next choice failed:', error);
    }

    if (!this.running) return;

    // The last banked card was picked after the shop, so the next wave starts
    // now that the player has spent their upgrades.
    if (this.pendingWaveStart) {
      this.pendingWaveStart = false;
      this.startNextWave();
    }

    this.scene.resume();
  }

  applyUpgrade(key) {
    if (key.startsWith('weapon:')) {
      const weaponKey = key.slice('weapon:'.length);
      const slot = this.state.weapons.find((w) => w.key === weaponKey);
      if (!slot) return;

      slot.level = Math.min(5, (slot.level || 1) + 1);
      this.drawWeaponSlots();
      return;
    }

    const item = UPGRADE_BY_KEY[key];
    if (!item) return;

    this.stacks[key] = (this.stacks[key] || 0) + 1;
    item.apply(this.state);
    this.clampPlayerStats();
    if (this.state.hp > this.state.maxHp) this.state.hp = this.state.maxHp;
  }

  /// Caps runaway stacking, so a long run cannot turn into a free ride: damage
  /// tops out at five times its starting figure, fire rate at four, and the
  /// defensive stats are held down too. The level-up pool stops offering the
  /// stat cards that reach these ceilings.
  clampPlayerStats() {
    const s = this.state;
    const base = this.baseStats;
    if (!base) return;

    s.fireInterval = Math.max(base.fireInterval / 4, s.fireInterval);
    s.damage = Math.min(base.damage * 5, s.damage);
    s.speed = Math.min(base.speed * 2.2, s.speed);
    s.critChance = Math.min(0.75, s.critChance);
    s.armor = Math.min(0.6, s.armor);
    s.lifesteal = Math.min(0.2, s.lifesteal);
    s.projectiles = Math.min(5, s.projectiles);
  }

  // ------------------------------------------------------------------ shop

  /// Opens the between-wave shop. The run stays frozen until the player either
  /// spends or presses continue, so coins are never spent under pressure.
  openShop() {
    this.shopOpen = true;
    this.shopRefreshes = 0;
    duckMusic(0.45);
    this.buildShopStock();

    // A full shelf counts as seeing several cards at once.
    this.announceAchievements(
      recordAchievement({ maxCards: this.shopItems.length })
    );

    // One tick later, so a boss dying inside a physics step never pauses the
    // world halfway through it.
    this.time.delayedCall(0, () => {
      if (!this.shopOpen) return;
      this.scene.launch('Shop', {
        wave: this.state.wave,
        items: this.shopItems
      });
      this.scene.pause();
    });
  }

  /// The shelf is two rows: ITEM_SLOTS trinkets on top and the weapon offers
  /// under them. Whatever the player locked is carried over — through a refresh
  /// and into the next wave's shop — and the rest is rolled fresh.
  buildShopStock() {
    const previous = this.shopItems || [];
    const kept = previous.filter((item) => item.locked && !item.sold);
    const keptItems = kept.filter((item) => item.kind === 'item');
    const keptWeapons = kept.filter((item) => item.kind === 'weapon');

    const fresh = rollShopItems(
      this.state.wave,
      this.items,
      this.state.weapons
    );
    const items = fresh.filter((item) => item.kind !== 'weapon');
    const weapons = fresh.filter((item) => item.kind === 'weapon');
    const roomForItems = Math.max(0, ITEM_SLOTS - keptItems.length);
    const roomForWeapons = Math.max(0, WEAPON_OFFERS - keptWeapons.length);

    this.shopItems = keptItems
      .concat(items.slice(0, roomForItems), keptWeapons)
      .concat(weapons.slice(0, roomForWeapons));

    return this.shopItems;
  }

  /// Pins a card to the shelf, so a re-roll and the next visit keep it.
  toggleShopLock(index) {
    const item = this.shopItems[index];
    if (!item || item.sold) return false;

    item.locked = !item.locked;
    return item.locked;
  }

  /// Buying from the shelf. The effect is applied first and the coins are only
  /// taken once it has landed, so a card that cannot work never costs money.
  buyShopItem(index) {
    const item = this.shopItems[index];
    if (!item || item.sold) return false;
    if (this.state.coins < item.price) return false;

    if (item.kind === 'item') {
      // A blue-or-better card carries two stacks; apply everything it promised.
      const stacks = Math.max(1, item.stacks || 1);
      let applied = 0;
      for (let i = 0; i < stacks; i++) {
        if (!this.addItem(item.key)) break;
        applied += 1;
      }
      if (applied === 0) return false;
    } else if (item.kind === 'weapon') {
      const mergeIndex = this.weaponMergeIndex(item.key, item.rarity);
      if (mergeIndex >= 0) this.mergeWeaponRarity(mergeIndex);
      else if (!this.buyWeapon(item)) return false;
    } else if (item.kind === 'upgrade') {
      const def = UPGRADE_BY_KEY[item.key];
      if (!def) return false;
      this.stacks[item.key] = (this.stacks[item.key] || 0) + 1;
      def.apply(this.state);
    } else if (item.kind === 'heal') {
      this.state.hp = Math.min(this.state.maxHp, this.state.hp + item.heal);
    } else if (item.kind === 'buff') {
      // Banked now, switched on when the next wave starts and gone when it ends.
      this.pendingBuff = { key: item.key, mult: item.mult };
    } else {
      return false;
    }

    this.state.coins -= item.price;
    item.sold = true;

    // A discount bought mid-visit applies to the rest of the shelf right away
    // rather than waiting for the next wave.
    if (
      item.kind === 'item' &&
      (item.key === 'coupon' || item.key === 'membercard')
    ) {
      this.repriceShop();
    }

    this.clampPlayerStats();

    if (this.state.hp > this.state.maxHp) this.state.hp = this.state.maxHp;
    return true;
  }

  /// Buying an item: the effect lands at once, the left-hand column picks up
  /// another chip, and an active gadget starts half charged.
  addItem(key) {
    const def = ITEM_BY_KEY[key];
    if (!def) return false;

    const have = this.items[key] || 0;
    if (have >= (def.max || 1)) return false;

    this.items[key] = have + 1;
    if (def.apply) def.apply(this.state);

    if (key === 'rustycoin') {
      // 存钱罐: every coin the monsters drop is worth two, and the purse is
      // never capped again.
      this.state.coinMult = 2;
    } else if (key === 'frog') {
      this.frogCharge = 0;
    } else if (key === 'teapot') {
      this.teapotCharge = 0;
    } else if (def.active) {
      this.activeTimers[key] = activeCooldown(key, this.items[key]) * 0.5;
    }

    this.clampPlayerStats();
    if (this.state.hp > this.state.maxHp) this.state.hp = this.state.maxHp;
    this.drawItemBar();
    this.syncCompanions();
    return true;
  }

  /// What the next re-roll costs: it climbs with every refresh in the same
  /// visit, so re-rolling forever is not free, and 会员卡 takes a slice off.
  refreshCost() {
    const climbs = SHOP_REFRESH_COST * Math.pow(1.6, this.shopRefreshes || 0);
    const cost = Math.round(climbs * refreshDiscount(this.items));
    return Math.max(SHOP_REFRESH_COST, cost);
  }

  /// Paid re-roll of the shop's stock. A bad roll should never be a dead end.
  refreshShopItems() {
    if (!this.shopOpen) return false;

    const cost = this.refreshCost();
    if (this.state.coins < cost) return false;

    this.state.coins -= cost;
    this.shopRefreshes = (this.shopRefreshes || 0) + 1;
    this.buildShopStock();
    return true;
  }

  /// Re-prices the cards still on the shelf, so a 打折券 bought mid-visit shows
  /// up in the prices immediately instead of only on the next wave.
  repriceShop() {
    const discount = shopDiscount(this.items);

    for (const item of this.shopItems) {
      if (item.sold || !item.basePrice) continue;
      item.price = Math.max(10, Math.round((item.basePrice * discount) / 5) * 5);
    }
  }

  /// Leaving the shop hands out the upgrades earned during the wave — after the
  /// fight, never inside it — and the next wave starts once the last card is
  /// picked. With nothing banked the run simply rolls on.
  leaveShop() {
    this.shopOpen = false;
    duckMusic(1);

    if (!this.running) return;

    if (this.levelsQueued > 0) {
      this.pendingWaveStart = true;
      if (this.flushLevelUps()) return;
      this.pendingWaveStart = false;
    }

    this.startNextWave();
    this.scene.resume();
  }

  applyWaveBuff(buff) {
    const s = this.state;
    if (buff.key === 'damage') s.damage *= buff.mult;
    else if (buff.key === 'firerate') s.fireInterval *= buff.mult;
    else if (buff.key === 'speed') s.speed *= buff.mult;
  }

  clearWaveBuff() {
    if (!this.activeBuff) return;

    const s = this.state;
    const buff = this.activeBuff;
    if (buff.key === 'damage') s.damage /= buff.mult;
    else if (buff.key === 'firerate') s.fireInterval /= buff.mult;
    else if (buff.key === 'speed') s.speed /= buff.mult;

    this.activeBuff = null;
  }

  // --------------------------------------------------------------- weapons

  /// The left-hand inventory: weapon chips in a two-wide grid under the status
  /// bar, one chip per gun, so a full arsenal still fits on a phone.
  drawWeaponSlots() {
    const g = this.slotGfx;
    if (!g || !this.slotIcons) return;

    g.clear();
    for (const icon of this.slotIcons) icon.destroy();
    this.slotIcons = [];
    this.slotPositions = [];

    const layout = this.layout;
    const s = layout.uiScale;

    const chip = Math.max(20, Math.round(23 * s));
    const gap = Math.max(4, Math.round(5 * s));
    const pad = 6;
    const cols = 2;

    const weapons = this.state.weapons;
    const rows = Math.max(1, Math.ceil(weapons.length / cols));

    const width = cols * chip + (cols - 1) * gap + pad * 2;
    const height = rows * chip + (rows - 1) * gap + pad * 2;
    const x = 8;
    const y = layout.topInset + Math.round(72 * s) + 6;

    g.fillStyle(0x0b1018, 0.42);
    g.fillRoundedRect(x, y, width, height, 10);
    g.lineStyle(1, 0x2bd3c4, 0.2);
    g.strokeRoundedRect(x, y, width, height, 10);

    this.slotsBox = { x, y, width, height, chip, gap, pad, cols };
    const r = chip / 2;

    // Which chips have a partner waiting for a merge, so they can show the
    // little up arrow.
    const mergeable = new Set();
    for (const pair of this.mergeablePairs()) {
      mergeable.add(pair.a);
      mergeable.add(pair.b);
    }

    weapons.forEach((slot, index) => {
      const def = weaponDef(slot);
      if (!def) return;

      const col = index % 2;
      const row = Math.floor(index / 2);
      const cx = x + 6 + r + col * (chip + gap);
      const cy = y + 6 + r + row * (chip + gap);

      this.slotPositions.push({ x: cx, y: cy, r });

      // A weapon keeps the colour of the rarity it was bought at.
      const ringColor = slot.rarity ? rarityColor(slot.rarity) : def.color;

      g.fillStyle(0x0d1522, 0.9);
      g.fillCircle(cx, cy, r);
      g.lineStyle(2, ringColor, 0.85);
      g.strokeCircle(cx, cy, r);

      this.slotIcons.push(
        this.add
          .text(cx, cy, def.emoji || '🔫', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: `${Math.round(r * 1.1)}px`
          })
          .setOrigin(0.5)
          .setDepth(21)
      );

      if (mergeable.has(index)) {
        this.slotIcons.push(
          this.add
            .text(cx + r * 0.8, cy - r * 0.85, '↑', {
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: `${Math.round(r * 0.95)}px`,
              color: '#ffd166',
              fontStyle: 'bold'
            })
            .setOrigin(0.5)
            .setDepth(23)
        );
      }

      const level = Math.min(slot.level || 1, 4);
      for (let p = 0; p < level; p++) {
        const px = cx - (level - 1) * 3 + p * 6;
        g.fillStyle(ringColor, 0.9);
        g.fillCircle(px, cy + r + 2, 1.5);
      }
    });

    // The item column hangs underneath, so it moves with the panel.
    this.drawItemBar();
  }

  /// The item column: every trinket and gadget owned, stacked under the weapon
  /// chips in the same left-hand column.
  drawItemBar() {
    const g = this.itemGfx;
    if (!g) return;

    g.clear();
    for (const node of this.itemIcons) node.destroy();
    this.itemIcons = [];
    this.itemPositions = {};

    const owned = ITEM_POOL.filter((def) => (this.items[def.key] || 0) > 0);
    if (owned.length === 0 || !this.slotsBox) return;

    const box = this.slotsBox;
    const s = this.layout.uiScale;

    const chip = Math.max(18, Math.round(21 * s));
    const gap = Math.max(4, Math.round(5 * s));
    const pad = 6;
    const cols = 2;

    const rows = Math.ceil(owned.length / cols);
    const width = cols * chip + (cols - 1) * gap + pad * 2;
    const height = rows * chip + (rows - 1) * gap + pad * 2;
    const x = box.x;
    const y = box.y + box.height + 6;

    g.fillStyle(0x0b1018, 0.42);
    g.fillRoundedRect(x, y, width, height, 10);
    g.lineStyle(1, 0x2bd3c4, 0.2);
    g.strokeRoundedRect(x, y, width, height, 10);

    const r = chip / 2;

    owned.forEach((def, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const cx = x + pad + r + col * (chip + gap);
      const cy = y + pad + r + row * (chip + gap);
      const stacks = this.items[def.key] || 1;

      this.itemPositions[def.key] = { x: cx, y: cy, r };

      g.fillStyle(0x0d1522, 0.9);
      g.fillCircle(cx, cy, r);
      g.lineStyle(2, def.color, def.active ? 0.9 : 0.6);
      g.strokeCircle(cx, cy, r);

      this.itemIcons.push(
        this.add
          .text(cx, cy, def.emoji, {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: `${Math.round(r * 1.15)}px`
          })
          .setOrigin(0.5)
          .setDepth(21)
      );

      const pips = Math.min(stacks, 4);
      for (let p = 0; p < pips; p++) {
        const px = cx - (pips - 1) * 3 + p * 6;
        g.fillStyle(def.color, 0.9);
        g.fillCircle(px, cy + r + 2, 1.5);
      }
    });
  }

  /// Recharge arcs for the active items, redrawn each frame on their own layer.
  drawItemCharges() {    const g = this.chargeGfx;
    if (!g) return;

    g.clear();
    if (!this.itemPositions) return;

    for (const key of Object.keys(this.itemPositions)) {
      const def = ITEM_BY_KEY[key];
      if (!def || !def.active) continue;

      const pos = this.itemPositions[key];
      const stacks = this.items[key] || 1;
      const full = activeCooldown(key, stacks);
      const left = Math.max(0, this.activeTimers[key] || 0);
      const ratio = 1 - Math.min(1, left / full);

      if (ratio >= 1) {
        g.lineStyle(2, def.color, 0.9);
        g.strokeCircle(pos.x, pos.y, pos.r + 3);
        continue;
      }

      g.lineStyle(2, def.color, 0.55);
      g.beginPath();
      g.arc(
        pos.x,
        pos.y,
        pos.r + 3,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * ratio,
        false
      );
      g.strokePath();
    }
  }

  /// A quick ring around the slot that just changed, standing in for a floating
  /// "you got X" label.
  flashSlot(index) {
    const pos = this.slotPositions && this.slotPositions[index];
    if (!pos) return;

    const ring = this.add
      .circle(pos.x, pos.y, pos.r, 0xffffff, 0.3)
      .setDepth(21)
      .setScale(0.85);
    this.tweens.add({
      targets: ring,
      scale: 1.7,
      alpha: 0,
      duration: 320,
      onComplete: () => ring.destroy()
    });
  }

  /// Picking a crate up: a duplicate levels the weapon you already own, a free
  /// slot simply takes the new gun, and a full rack opens the swap-or-merge
  /// screen instead of silently throwing something away.
  acquireWeapon(key) {
    const def = WEAPONS[key];
    if (!def) return;

    const owned = this.state.weapons.find((w) => w.key === key);
    if (owned) {
      owned.level = Math.min(5, (owned.level || 1) + 1);
      this.drawWeaponSlots();
      this.flashSlot(this.state.weapons.indexOf(owned));
      Sfx.buy();
      return;
    }

    if (this.state.weapons.length < WEAPON_SLOTS) {
      this.state.weapons.push({ key, level: 1 });
      this.drawWeaponSlots();
      this.flashSlot(this.state.weapons.length - 1);
      Sfx.buy();
      return;
    }

    this.openWeaponChoice(key);
  }

  /// All three slots are taken: ask which gun to give up, or whether to weld two
  /// of them together and keep the newcomer as well.
  openWeaponChoice(key) {
    const def = WEAPONS[key];
    if (!def || this.weaponChoice) return;

    this.weaponChoice = key;

    const carried = this.state.weapons.map((slot) => {
      const carriedDef = weaponDef(slot);
      return {
        key: slot.key,
        name: carriedDef ? carriedDef.name : slot.key,
        emoji: carriedDef ? carriedDef.emoji : '🔫',
        color: carriedDef ? carriedDef.color : 0x39e6cd,
        level: slot.level || 1
      };
    });

    this.time.delayedCall(0, () => {
      if (!this.weaponChoice) return;
      this.scene.launch('Weapon', {
        weapon: { key, name: def.name, emoji: def.emoji, color: def.color },
        carried
      });
      this.scene.pause();
    });
  }

  applyWeaponPick(index) {
    const key = this.weaponChoice;
    const slots = this.state.weapons;
    if (!key || !slots[index]) return false;

    slots[index] = { key, level: 1 };
    this.cooldowns[index] = 0;

    this.weaponChoice = null;
    this.drawWeaponSlots();
    this.flashSlot(index);
    Sfx.buy();
    return true;
  }

  mergeWeapons(a, b) {
    const key = this.weaponChoice;
    const slots = this.state.weapons;
    const first = slots[a];
    const second = slots[b];
    if (!first || !second || a === b) return false;

    const evolved = evolvedWeapon(first, second);
    if (!evolved) return false;

    const kept = slots.filter((_, index) => index !== a && index !== b);
    const level = Math.max(first.level || 1, second.level || 1);
    const next = [{ key: evolved.key, def: evolved, level }];

    for (const slot of kept) next.push(slot);
    if (key && next.length < WEAPON_SLOTS) next.push({ key, level: 1 });

    this.state.weapons = next;
    this.cooldowns = [];
    this.weaponChoice = null;

    this.drawWeaponSlots();
    Sfx.levelUp();
    haptic('level_up');

    this.announceAchievements(recordAchievement({ evolved: 1 }));
    return true;
  }

  skipWeaponPick() {
    this.weaponChoice = null;
  }

  finishWeaponChoice() {
    this.weaponChoice = null;
    if (!this.running) return;
    this.scene.resume();
  }

  /// The shop asks these three things before it charges for a weapon.
  weaponMergeIndex(key, rarity) {
    return this.state.weapons.findIndex(
      (slot) => slot.key === key && (slot.rarity || 'common') === rarity
    );
  }

  needsWeaponSlot(key, rarity) {
    if (this.weaponMergeIndex(key, rarity) >= 0) return false;
    return this.state.weapons.length >= WEAPON_SLOTS;
  }

  /// A bought duplicate fuses into the gun already carried: same slot, next
  /// rarity, one more level.
  mergeWeaponRarity(index) {
    const slot = this.state.weapons[index];
    if (!slot) return false;

    const next = nextRarity(slot.rarity || 'common');
    if (!next) return false;

    slot.rarity = next.key;
    slot.level = Math.min(5, (slot.level || 1) + 1);
    this.cooldowns = [];
    this.drawWeaponSlots();
    this.flashSlot(index);
    return true;
  }

  /// Swaps one carried gun for the weapon just paid for, freeing old for new.
  replaceWeaponSlot(slotIndex, shopIndex) {
    const item = this.shopItems[shopIndex];
    if (!item || item.sold) return false;

    const slot = this.state.weapons[slotIndex];
    if (!slot) return false;
    if (this.state.coins < item.price) return false;

    this.state.coins -= item.price;
    item.sold = true;

    this.state.weapons[slotIndex] = {
      key: item.key,
      level: item.level || 1,
      rarity: item.rarity || 'common'
    };

    this.cooldowns = [];
    this.drawWeaponSlots();
    this.flashSlot(slotIndex);
    return true;
  }

  weaponSellPrice(slot) {
    const def = weaponDef(slot);
    if (!def) return 0;

    const rarity = rarityFor(slot.rarity);
    return 8 + rarity.rank * 8 + Math.max(0, (slot.level || 1) - 1) * 4;
  }

  /// Sells a carried gun for part of what it is worth, freeing its slot.
  sellWeapon(index) {
    const slot = this.state.weapons[index];
    if (!slot) return 0;
    if (this.state.weapons.length <= 1) return 0;

    const refund = this.weaponSellPrice(slot);
    this.state.coins += refund;
    this.state.weapons.splice(index, 1);
    this.cooldowns = [];
    this.drawWeaponSlots();
    return refund;
  }

  itemSellPrice(key) {
    const def = ITEM_BY_KEY[key];
    if (!def) return 0;
    return 10;
  }

  /// Sells one stack of an item. The run's stats are replayed from the base
  /// snapshot afterwards, so the sold bonus really disappears.
  sellItem(key) {
    const def = ITEM_BY_KEY[key];
    const stacks = this.items[key] || 0;
    if (!def || stacks <= 0) return 0;

    const refund = this.itemSellPrice(key);
    this.state.coins += refund;

    if (stacks <= 1) delete this.items[key];
    else this.items[key] = stacks - 1;

    this.rebuildRunStats();
    this.drawItemBar();
    this.syncCompanions();
    return refund;
  }

  /// Rebuilds every stat from the starting snapshot, then replays the level-up
  /// cards and the items still owned. Used when an item is sold.
  rebuildRunStats() {
    const s = this.state;
    const base = this.baseRun;
    if (!base) return;

    s.maxHp = base.maxHp;
    s.speed = base.speed;
    s.damage = base.damage;
    s.fireInterval = base.fireInterval;
    s.range = base.range;
    s.bulletSpeed = base.bulletSpeed;
    s.pickupRadius = base.pickupRadius;

    s.regen = 0;
    s.armor = 0;
    s.lifesteal = 0;
    s.critChance = 0;
    s.projectiles = 1;
    s.pierceBonus = 0;
    s.slowOnHit = 0;
    s.outRegen = 0;
    s.styleBonus = { bullet: 1, energy: 1, explosive: 1, blade: 1 };
    s.weaponSynergy = 0;
    s.splashBonus = 0;
    s.slowBonus = 0;
    s.chainKill = 0;
    s.coinCap = Number.POSITIVE_INFINITY;
    s.coinMult = 1;

    for (const key of Object.keys(this.stacks)) {
      const def = UPGRADE_BY_KEY[key];
      if (!def) continue;
      for (let i = 0; i < this.stacks[key]; i++) def.apply(s);
    }

    for (const key of Object.keys(this.items)) {
      const def = ITEM_BY_KEY[key];
      if (!def || !def.apply) continue;
      for (let i = 0; i < this.items[key]; i++) def.apply(s);
    }

    if (this.items.rustycoin) s.coinMult = 2;

    this.clampPlayerStats();
    s.hp = Math.min(s.hp, s.maxHp);
  }

  /// Equips the weapon bought from the wave shop. Duplicates are kept as their
  /// own slot so a pair can be merged into a higher tier.
  buyWeapon(item) {
    const def = WEAPONS[item.key];
    if (!def) return false;
    if (this.state.weapons.length >= WEAPON_SLOTS) return false;

    this.state.weapons.push({
      key: item.key,
      level: item.level || 1,
      rarity: item.rarity || 'common'
    });

    this.cooldowns = [];
    this.drawWeaponSlots();
    return true;
  }

  /// Every pair of identical guns at the same rarity, ready to be welded into
  /// the next tier. Pairs are consumed two at a time.
  mergeablePairs() {
    const slots = this.state.weapons;
    const groups = new Map();

    slots.forEach((slot, index) => {
      const rarity = slot.rarity || 'common';
      if (!nextRarity(rarity)) return;

      const groupKey = `${slot.key}:${rarity}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { key: slot.key, rarity, indices: [] });
      }
      groups.get(groupKey).indices.push(index);
    });

    const pairs = [];
    groups.forEach((group) => {
      for (let i = 0; i + 1 < group.indices.length; i += 2) {
        pairs.push({
          a: group.indices[i],
          b: group.indices[i + 1],
          key: group.key,
          rarity: group.rarity,
          next: nextRarity(group.rarity)
        });
      }
    });

    return pairs;
  }

  /// Fuses two identical guns into one of the next rarity, for a little gold.
  mergeWeaponPair(a, b) {
    const slots = this.state.weapons;
    const first = slots[a];
    const second = slots[b];
    if (!first || !second || a === b) return false;

    const rarity = first.rarity || 'common';
    if (second.key !== first.key) return false;
    if ((second.rarity || 'common') !== rarity) return false;

    const next = nextRarity(rarity);
    if (!next) return false;

    const cost = mergeCost(rarity);
    if (this.state.coins < cost) return false;

    this.state.coins -= cost;
    first.rarity = next.key;
    first.level = Math.max(first.level || 1, second.level || 1);
    slots.splice(b, 1);

    this.cooldowns = [];
    this.drawWeaponSlots();
    this.flashSlot(a);
    Sfx.levelUp();
    haptic('level_up');
    return true;
  }

  notify(text, x, y) {
    const label = this.add
      .text(x, y - 24, text, {
        fontFamily: FONT,
        fontSize: `${Math.round(14 * this.layout.uiScale)}px`,
        color: '#eafcff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(31);

    this.tweens.add({
      targets: label,
      y: y - 64,
      alpha: 0,
      duration: 1000,
      ease: 'Cubic.out',
      onComplete: () => label.destroy()
    });
  }

  // ----------------------------------------------------------- achievements

  /// A short gold banner whenever the archive gains something, so it is noticed
  /// without stopping the fight.
  announceAchievements(items) {
    if (!items || items.length === 0) return;

    haptic('level_up');
    Sfx.levelUp();

    items.forEach((def, index) => {
      this.time.delayedCall(index * 320, () => {
        this.showAchievementToast(def, index);
      });
    });
  }

  showAchievementToast(def, index) {
    if (!this.layout) return;

    const field = this.layout.field;
    const s = this.layout.uiScale;
    const width = Math.min(field.width - 48, 340 * s);
    const height = Math.round(42 * s);
    const cx = field.centerX;
    const y = field.height * 0.17 + index * (height + 8);

    const bg = this.add.graphics().setDepth(40).setAlpha(0);
    bg.fillStyle(0x2a2413, 0.97);
    bg.fillRoundedRect(cx - width / 2, y - height / 2, width, height, 12);
    bg.lineStyle(2, 0xffd166, 0.85);
    bg.strokeRoundedRect(cx - width / 2, y - height / 2, width, height, 12);
    bg.y = -16;

    const label = this.add
      .text(cx, y, `成就达成：${def.name}`, {
        fontFamily: FONT,
        fontSize: `${Math.round(14 * s)}px`,
        color: COLORS.goldHex,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(41)
      .setAlpha(0);
    label.setResolution(TEXT_RESOLUTION);
    label.y = y - 16;

    this.tweens.add({
      targets: [bg, label],
      alpha: 1,
      y: '+=16',
      duration: 240,
      ease: 'Cubic.out'
    });

    this.time.delayedCall(2400, () => {
      if (!bg.active || !label.active) return;
      this.tweens.add({
        targets: [bg, label],
        alpha: 0,
        y: '-=16',
        duration: 320,
        onComplete: () => {
          bg.destroy();
          label.destroy();
        }
      });
    });
  }

  // ------------------------------------------------------------------- end

  gameOver() {
    if (!this.running) return;
    this.running = false;

    let result = null;
    try {
      result = recordRun({
        wave: this.state.wave,
        kills: this.state.kills,
        time: this.state.runTime,
        difficulty: this.difficulty.key
      });
    } catch (error) {
      console.warn('Saving the run failed:', error);
    }

    this.announceAchievements(
      recordAchievement({
        totalKills: result && result.best ? result.best.totalKills : 0,
        maxCoins: Math.floor(this.state.coins)
      })
    );

    // Star dust is the meta currency: earned at the end of a run, spent outside
    // it. In-run coins never leave the run.
    const shardReward = shardsForRun(this.state.wave);
    const shardTotal = addShards(shardReward);

    if (this.spawnTimer) {
      this.spawnTimer.remove();
      this.spawnTimer = null;
    }

    this.releaseJoystick();
    this.player.setVelocity(0, 0);

    // Freeze the field so nothing keeps sliding around behind the summary.
    for (const enemy of this.enemies.getChildren()) {
      if (enemy.body) enemy.body.velocity.set(0, 0);
    }
    for (const shot of this.enemyShots.getChildren()) {
      if (shot.body) shot.body.velocity.set(0, 0);
    }

    this.player.setTint(0xff8899);
    this.cameras.main.shake(320, 0.012);
    haptic('game_over');
    Sfx.gameOver();
    this.spawnBurst(this.player.x, this.player.y, COLORS.danger, 14);

    this.tweens.add({
      targets: this.player,
      alpha: 0.2,
      duration: 520,
      ease: 'Back.in'
    });

    // Straight to the summary — no timer and no scene pause in between, so the
    // run can never end up sitting frozen with nothing on screen.
    this.scene.launch('GameOver', {
      wave: this.state.wave,
      kills: this.state.kills,
      time: this.state.runTime,
      records: result
        ? result.records
        : { wave: false, kills: false, time: false },
      best: result ? result.best : null,
      shards: shardReward,
      shardTotal
    });
  }

  userPause() {
    if (!this.running || this.choiceOpen || this.shopOpen || this.weaponChoice)
      return;
    this.pausedByUser = true;
    this.releaseJoystick();
    this.player.setVelocity(0, 0);
    this.scene.pause();
  }

  userResume() {
    this.pausedByUser = false;
    this.scene.resume();
  }

  /// Restarts the run from scratch: the scene shuts itself down and every
  /// overlay goes with it, then create() runs again and re-launches the HUD.
  restartRun() {
    this.scene.stop('Choice');
    this.scene.stop('Weapon');
    this.scene.stop('Hud');
    this.scene.stop('GameOver');
    if (this.scene.isPaused()) this.scene.resume();
    this.scene.restart();
  }

  goToTitle() {
    this.scene.stop('Choice');
    this.scene.stop('Weapon');
    this.scene.stop('Hud');
    this.scene.stop('GameOver');
    if (this.scene.isPaused()) this.scene.resume();
    this.scene.start('Title');
  }

  // ---------------------------------------------------------------- resize

  onResize(gameSize) {
    this.layout = computeLayout(gameSize.width, gameSize.height);
    const field = this.layout.field;

    this.floor.setSize(field.width, field.height);
    this.drawBorder();

    const hud = hudGeometry(this.layout);
    this.safeTop = hud.safeTop;
    this.physics.world.setBounds(
      0,
      this.safeTop,
      Math.max(40, field.width),
      Math.max(40, field.height - this.safeTop)
    );

    this.player.x = Phaser.Math.Clamp(this.player.x, 18, field.width - 18);
    this.player.y = Phaser.Math.Clamp(
      this.player.y,
      this.safeTop + 18,
      field.height - 18
    );

    this.drawFlashButton();
    this.buildTopBar();
  }

  // ----------------------------------------------------------------- banner

  banner(title, subtitle) {
    const field = this.layout.field;
    const size = Math.round(26 * this.layout.uiScale);

    const text = this.add
      .text(field.centerX, field.height * 0.28, title, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color: '#eafcff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);

    const sub = this.add
      .text(field.centerX, field.height * 0.28 + size + 6, subtitle, {
        fontFamily: FONT,
        fontSize: `${Math.round(size * 0.5)}px`,
        color: COLORS.dim
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);

    this.tweens.add({ targets: [text, sub], alpha: 1, duration: 260 });
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: [text, sub],
        alpha: 0,
        duration: 420,
        onComplete: () => {
          text.destroy();
          sub.destroy();
        }
      });
    });
  }
}
