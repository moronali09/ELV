// Save as cleanerbot_pvp_offline.js
// Requires: npm i mineflayer mineflayer-pathfinder mineflayer-pvp minecraft-data
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder')
const pvpPlugin = require('mineflayer-pvp').plugin
const mcDataLib = require('minecraft-data')

/**
 * CONFIG - change these if needed or pass via environment variables
 */
const CONFIG = {
  host: process.env.HOST || 'sparrowcraft.aternos.me',
  port: parseInt(process.env.PORT || '25519', 10),
  username: process.env.USERNAME || 'cleanerbot',
  auth: process.env.AUTH || 'offline',   // <-- use 'offline' for cracked accounts
  registerName: process.env.REGNAME || 'cleanerbot',
  registerPass: process.env.REGPASS || 'cleanerbot',
  reconnectDelay: 3000,
  itemSearchRange: 20,
  playerDetectRange: 8,
  eatHungerThreshold: 16,
  wanderRadius: 6,

  // PvP settings
  enablePvp: true,
  pvpDetectRange: 12,
  minTargetHealth: 6,
  maxAttackDurationMs: 8000,
  attackReach: 3
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

  bot.loadPlugin(pathfinder)
  bot.loadPlugin(pvpPlugin)

  let mcData
  bot.once('inject_allowed', () => {
    try { mcData = mcDataLib(bot.version) } catch (e) { mcData = null }
  })

  bot.on('spawn', () => {
    // If the server uses an auth plugin (like AuthMe), register/login via chat commands.
    // Keep silent otherwise.
    try { bot.chat(`/register ${CONFIG.registerName} ${CONFIG.registerPass}`) } catch (e) {}
    setTimeout(() => {
      try { bot.chat(`/login ${CONFIG.registerPass}`) } catch (e) {}
    }, 1000)

    if (mcData) {
      const movements = new Movements(bot, mcData)
      bot.pathfinder.setMovements(movements)
    }
  })

  bot.on('end', () => setTimeout(() => createBot(), CONFIG.reconnectDelay))
  bot.on('kicked', () => setTimeout(() => createBot(), CONFIG.reconnectDelay))
  bot.on('error', () => {}) // silent

  const sleep = (ms) => new Promise(r => setTimeout(r, ms))

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

  let pvpActive = false
  async function tryStartPvp() {
    if (!CONFIG.enablePvp || pvpActive) return
    if (!bot.entity || !bot.entity.position) return

    const target = bot.nearestEntity(e =>
      e && e.type === 'player' && e.username && e.username !== bot.username &&
      e.position && e.position.distanceTo(bot.entity.position) <= CONFIG.pvpDetectRange
    )
    if (!target) return

    pvpActive = true
    try { await equipArmorSet(); await equipBestSword() } catch (e) {}

    try { bot.pvp.attack(target, true) } catch (e) {}

    const startTime = Date.now()
    const monitor = setInterval(() => {
      try {
        const ent = bot.entities[target.id]
        const targetHealth = ent && typeof ent.health === 'number' ? ent.health : undefined
        const elapsed = Date.now() - startTime
        const tooLong = elapsed > CONFIG.maxAttackDurationMs
        const lowHealth = typeof targetHealth === 'number' && targetHealth <= CONFIG.minTargetHealth
        const targetMissing = !ent
        const botDead = (typeof bot.health === 'number' && bot.health <= 0)

        if (targetMissing || tooLong || lowHealth || botDead) {
          try { bot.pvp.stop() } catch (e) {}
          clearInterval(monitor)
          pvpActive = false
        } else {
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

  const FOOD_REGEX = /^(apple|bread|cooked|baked|pumpkin_pie|mushroom_stew|rabbit_stew|cookie|golden_apple|golden_carrot|beetroot)/

  const mainLoop = async () => {
    if (!bot.entity || !bot.entity.position) return

    try { await tryStartPvp() } catch (e) {}

    const player = bot.nearestEntity(e =>
      e && e.type === 'player' && e.username && e.username !== bot.username &&
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

    try {
      if (typeof bot.food === 'number' && bot.food < CONFIG.eatHungerThreshold && !bot.foodEating) {
        const foodItem = bot.inventory.items().find(it => it && FOOD_REGEX.test(it.name))
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

    const itemEntity = bot.nearestEntity(e => e && e.name === 'item' && e.position && e.position.distanceTo(bot.entity.position) <= CONFIG.itemSearchRange)
    if (itemEntity) {
      try {
        bot.pathfinder.setGoal(new GoalNear(itemEntity.position.x, itemEntity.position.y, itemEntity.position.z, 0.5))
        return
      } catch (e) {}
    }

    try {
      const rx = bot.entity.position.x + (Math.random() * 2 - 1) * CONFIG.wanderRadius
      const rz = bot.entity.position.z + (Math.random() * 2 - 1) * CONFIG.wanderRadius
      const ry = bot.entity.position.y
      bot.pathfinder.setGoal(new GoalNear(rx, ry, rz, 1))
    } catch (e) {}
  }

  const loopInterval = setInterval(() => {
    if (bot && bot.entity) mainLoop().catch(()=>{})
  }, 800)

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
