// Save as cleanerbot_pvp.js
// Requires: npm i mineflayer mineflayer-pathfinder mineflayer-pvp minecraft-data
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder')
const pvpPlugin = require('mineflayer-pvp').plugin
const mcDataLib = require('minecraft-data')

/**
 * CONFIG - change these to match your server/account
 */
const CONFIG = {
  host: 'sparrowcraft.aternos.me',
  port: 25519,
  username: '_cleanerBot',
  auth: 'mojang',
  registerName: 'cleanerbot',
  registerPass: 'cleanerbot',
  reconnectDelay: 3000,
  itemSearchRange: 20,
  playerDetectRange: 8,
  eatHungerThreshold: 16,
  wanderRadius: 6,

  // PvP settings
  enablePvp: true,               // set false to disable PvP
  pvpDetectRange: 12,           // how far to search for a PvP target
  minTargetHealth: 6,           // stop attacking if target health <= this (prevents kills)
  maxAttackDurationMs: 8000,    // max time to attack a single target (prevents lethal fights)
  attackReach: 3                // desired distance to target while attacking
}

let shouldQuit = false

function createBot() {
  if (shouldQuit) return
  const bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    auth: CONFIG.auth
  })

  // plugins
  bot.loadPlugin(pathfinder)
  bot.loadPlugin(pvpPlugin)

  let mcData
  bot.once('inject_allowed', () => {
    mcData = mcDataLib(bot.version)
  })

  // silent: we will not log to console or chat except register/login commands
  bot.on('spawn', () => {
    try { bot.chat(`/register ${CONFIG.registerName} ${CONFIG.registerPass}`) } catch (e) {}
    setTimeout(() => { try { bot.chat(`/login ${CONFIG.registerPass}`) } catch (e) {} }, 1000)

    const movements = new Movements(bot, mcData)
    bot.pathfinder.setMovements(movements)
  })

  // reconnect handlers (silent)
  bot.on('end', () => setTimeout(createBot, CONFIG.reconnectDelay))
  bot.on('kicked', () => setTimeout(createBot, CONFIG.reconnectDelay))
  bot.on('error', () => {}) // suppress errors

  // helper sleeps
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))

  // equip helpers
  async function equipBestSword() {
    try {
      const sword = bot.inventory.items().find(it => it && /sword/.test(it.name))
      if (sword) await bot.equip(sword, 'hand')
    } catch (e) {}
  }
  async function equipArmorSet() {
    try {
      const inv = bot.inventory.items()
      const slotMap = [
        { part: 'head', names: ['netherite_helmet','diamond_helmet','iron_helmet','chainmail_helmet','golden_helmet','leather_helmet'] },
        { part: 'torso', names: ['netherite_chestplate','diamond_chestplate','iron_chestplate','chainmail_chestplate','golden_chestplate','leather_chestplate'] },
        { part: 'legs', names: ['netherite_leggings','diamond_leggings','iron_leggings','chainmail_leggings','golden_leggings','leather_leggings'] },
        { part: 'feet', names: ['netherite_boots','diamond_boots','iron_boots','chainmail_boots','golden_boots','leather_boots'] }
      ]
      for (const m of slotMap) {
        for (const name of m.names) {
          const item = inv.find(it => it && it.name === name)
          if (item) {
            await bot.equip(item, m.part)
            break
          }
        }
      }
    } catch (e) {}
  }

  // PvP controller: find target, equip, attack non-lethally
  let pvpActive = false
  async function tryStartPvp() {
    if (!CONFIG.enablePvp) return
    if (pvpActive) return
    // find nearest player (exclude self)
    const target = bot.nearestEntity(e =>
      e && e.type === 'player' && e.username && e.username !== bot.username &&
      e.position && e.position.distanceTo(bot.entity.position) <= CONFIG.pvpDetectRange
    )
    if (!target) return

    pvpActive = true
    try {
      await equipArmorSet()
      await equipBestSword()
    } catch (e) {}

    // start attack
    try {
      bot.pvp.attack(target, true)
    } catch (e) {}

    const startTime = Date.now()
    const monitor = setInterval(() => {
      try {
        // stop conditions: target gone, exceeded time, target health low, or bot died
        const targetEntity = bot.entities[target.id]
        const targetHealth = targetEntity && typeof targetEntity.health === 'number' ? targetEntity.health : undefined
        const elapsed = Date.now() - startTime
        const tooLong = elapsed > CONFIG.maxAttackDurationMs
        const lowHealth = typeof targetHealth === 'number' && targetHealth <= CONFIG.minTargetHealth
        const targetMissing = !targetEntity
        const botDead = (typeof bot.health === 'number' && bot.health <= 0)

        if (targetMissing || tooLong || lowHealth || botDead) {
          try { bot.pvp.stop() } catch (e) {}
          clearInterval(monitor)
          pvpActive = false
        } else {
          // adjust goal to stay near target
          try {
            bot.pathfinder.setGoal(new GoalNear(target.position.x, target.position.y, target.position.z, CONFIG.attackReach))
          } catch (e) {}
        }
      } catch (e) {
        try { bot.pvp.stop() } catch (err) {}
        clearInterval(monitor)
        pvpActive = false
      }
    }, 300)
  }

  // core behaviour loop (collect items, follow players to drop items, eat, wander) preserving previous logic
  const mainLoop = async () => {
    if (!bot.entity || !bot.entity.position) return

    // PvP attempt (if enabled)
    try { await tryStartPvp() } catch (e) {}

    // If a nearby player (friendly) detected, go and drop items to them (same as before)
    const player = bot.nearestEntity(e =>
      e && e.type === 'player' &&
      e.username && e.username !== bot.username &&
      e.position && e.position.distanceTo(bot.entity.position) <= CONFIG.playerDetectRange
    )

    if (player) {
      try {
        bot.pathfinder.setGoal(new GoalNear(player.position.x, player.position.y, player.position.z, 1))
        await waitForCondition(() => {
          const ent = bot.entities[player.id]
          return ent && bot.entity && ent.position && bot.entity.position.distanceTo(ent.position) <= 2
        }, 7000)
      } catch (e) {}

      try {
        const items = bot.inventory.items()
        for (const item of items) {
          await tossStackPromise(bot, item).catch(()=>{})
          await sleep(250)
        }
      } catch (e) {}

      return
    }

    // Eat when hungry
    try {
      if (typeof bot.food === 'number' && bot.food < CONFIG.eatHungerThreshold && !bot.foodEating) {
        const foodItem = bot.inventory.items().find(it => it && /^(apple|bread|cooked|baked|pumpkin_pie|mushroom_stew|rabbit_stew|cookie|golden_apple|golden_carrot|beetroot)/.test(it.name))
        if (foodItem) {
          try {
            await bot.equip(foodItem, 'hand')
            if (typeof bot.consume === 'function') await bot.consume()
            else if (typeof bot.activateItem === 'function') await bot.activateItem()
            await sleep(600)
          } catch (e) {}
        }
      }
    } catch (e) {}

    // collect nearest dropped item
    const itemEntity = bot.nearestEntity(e => e && e.name === 'item' && e.position && e.position.distanceTo(bot.entity.position) <= CONFIG.itemSearchRange)
    if (itemEntity) {
      try {
        bot.pathfinder.setGoal(new GoalNear(itemEntity.position.x, itemEntity.position.y, itemEntity.position.z, 0.5))
        return
      } catch (e) {}
    }

    // wander
    try {
      const rx = bot.entity.position.x + (Math.random() * 2 - 1) * CONFIG.wanderRadius
      const rz = bot.entity.position.z + (Math.random() * 2 - 1) * CONFIG.wanderRadius
      const ry = bot.entity.position.y
      bot.pathfinder.setGoal(new GoalNear(rx, ry, rz, 1))
    } catch (e) {}
  }

  // loop runner
  const loopInterval = setInterval(() => {
    if (bot && bot.entity) mainLoop().catch(()=>{})
  }, 800)

  // utilities
  function tossStackPromise(bot, item) {
    return new Promise((resolve, reject) => {
      try {
        bot.tossStack(item, err => err ? reject(err) : resolve())
      } catch (e) { reject(e) }
    })
  }
  function waitForCondition(condFn, timeout = 5000, interval = 200) {
    return new Promise((resolve) => {
      const start = Date.now()
      const t = setInterval(() => {
        try {
          if (condFn()) { clearInterval(t); resolve(true) }
          else if (Date.now() - start > timeout) { clearInterval(t); resolve(false) }
        } catch (e) { clearInterval(t); resolve(false) }
      }, interval)
    })
  }

  bot.on('end', () => { try { clearInterval(loopInterval) } catch(e){} })
  bot.on('kicked', () => { try { clearInterval(loopInterval) } catch(e){} })
}

// start
createBot()
process.on('SIGINT', () => { shouldQuit = true; process.exit() })
