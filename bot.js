// pro_level_cleanerbot.js // Pro-level Mineflayer bot: cleaner + non-lethal PvP + auto-armor/sword/eat + item pickup/drop + follow + reconnect // Install: npm i mineflayer mineflayer-pathfinder mineflayer-pvp mineflayer-armor-manager

const mineflayer = require('mineflayer') const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder') let pvpPlugin try { pvpPlugin = require('mineflayer-pvp').plugin } catch (e) { pvpPlugin = null } let armorManagerPlugin try { armorManagerPlugin = require('mineflayer-armor-manager') } catch (e) { armorManagerPlugin = null } const mcDataLib = require('minecraft-data')

// ---------- CONFIG ---------- const CONFIG = { host: process.env.HOST || 'sparrowcraft.aternos.me', port: parseInt(process.env.PORT || '25519', 10), username: process.env.USERNAME || 'cleanerbot', auth: process.env.AUTH || 'offline', // 'offline' for cracked registerName: process.env.REGNAME || 'cleanerbot', registerPass: process.env.REGPASS || 'cleanerbot', reconnectDelay: 3000,

itemSearchRange: 24, playerDetectRange: 8, pvpDetectRange: 12, wanderRadius: 6, eatHungerThreshold: 16,

// PvP safety: do not kill players enablePvp: true, minTargetHealth: 6,           // stop if target health <= this maxAttackDurationMs: 9000, attackReach: 3 }

// A set of food-name prefixes to match inventory names (keeps it generic) const FOOD_PREFIXES = ['apple','bread','cooked','baked','pumpkin_pie','mushroom_stew','rabbit_stew','cookie','golden_apple','golden_carrot','beetroot']

let shouldQuit = false

function createBot() { if (shouldQuit) return

const bot = mineflayer.createBot({ host: CONFIG.host, port: CONFIG.port, username: CONFIG.username, auth: CONFIG.auth })

// load optional plugins bot.loadPlugin(pathfinder) if (pvpPlugin) try { bot.loadPlugin(pvpPlugin) } catch (e) {} if (armorManagerPlugin) try { bot.loadPlugin(armorManagerPlugin) } catch (e) {}

let mcData bot.once('inject_allowed', () => { try { mcData = mcDataLib(bot.version) } catch (e) { mcData = null } })

// silent register/login for auth plugins like AuthMe bot.on('spawn', async () => { try { bot.chat(/register ${CONFIG.registerName} ${CONFIG.registerPass}) } catch (e) {} setTimeout(() => { try { bot.chat(/login ${CONFIG.registerPass}) } catch (e) {} }, 1000)

if (mcData) {
  const movements = new Movements(bot, mcData)
  bot.pathfinder.setMovements(movements)
}

})

// reconnect logic bot.on('end', () => setTimeout(createBot, CONFIG.reconnectDelay)) bot.on('kicked', () => setTimeout(createBot, CONFIG.reconnectDelay)) bot.on('error', () => {})

// helper utilities const sleep = (ms) => new Promise(r => setTimeout(r, ms)) function tossStackPromise(item) { return new Promise((resolve, reject) => { try { bot.tossStack(item, err => err ? reject(err) : resolve()) } catch (e) { reject(e) } }) } function waitForCondition(condFn, timeout = 5000, interval = 200) { return new Promise((resolve) => { const start = Date.now() const t = setInterval(() => { try { if (condFn()) { clearInterval(t); resolve(true) } else if (Date.now() - start > timeout) { clearInterval(t); resolve(false) } } catch (e) { clearInterval(t); resolve(false) } }, interval) }) }

async function equipBestSword() { try { const sword = bot.inventory.items().find(it => it && /sword/.test(it.name)) if (sword) await bot.equip(sword, 'hand') } catch (e) {} }

async function equipBestArmor() { // If armor manager plugin available, use it try { if (bot.armorManager && typeof bot.armorManager.equip === 'function') { await bot.armorManager.equip() return } } catch (e) {}

// fallback: try equip known armor names from best to worst for each slot
const inv = bot.inventory.items()
const slots = [
  { part: 'head', names: ['netherite_helmet','diamond_helmet','iron_helmet','chainmail_helmet','golden_helmet','leather_helmet'] },
  { part: 'torso', names: ['netherite_chestplate','diamond_chestplate','iron_chestplate','chainmail_chestplate','golden_chestplate','leather_chestplate'] },
  { part: 'legs', names: ['netherite_leggings','diamond_leggings','iron_leggings','chainmail_leggings','golden_leggings','leather_leggings'] },
  { part: 'feet', names: ['netherite_boots','diamond_boots','iron_boots','chainmail_boots','golden_boots','leather_boots'] }
]
for (const s of slots) {
  for (const name of s.names) {
    const item = inv.find(it => it && it.name === name)
    if (item) {
      try { await bot.equip(item, s.part) } catch (e) {}
      break
    }
  }
}

}

// simple function to find a food item in inventory function findFood() { const inv = bot.inventory.items() return inv.find(it => it && FOOD_PREFIXES.some(p => it.name.startsWith(p))) }

// PvP controller: non-lethal attack behavior let pvpActive = false async function tryStartPvp() { if (!CONFIG.enablePvp || !pvpPlugin || pvpActive) return if (!bot.entity || !bot.entity.position) return

const target = bot.nearestEntity(e => e && e.type === 'player' && e.username && e.username !== bot.username && e.position && e.position.distanceTo(bot.entity.position) <= CONFIG.pvpDetectRange)
if (!target) return

pvpActive = true
try { await equipBestArmor(); await equipBestSword() } catch (e) {}

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

// main behaviour loop const mainLoop = async () => { if (!bot.entity || !bot.entity.position) return

// try PvP first (will return quickly if not applicable)
try { await tryStartPvp() } catch (e) {}

// If a nearby player to give items to exists -> follow & dump inventory
const nearPlayer = bot.nearestEntity(e => e && e.type === 'player' && e.username && e.username !== bot.username && e.position && e.position.distanceTo(bot.entity.position) <= CONFIG.playerDetectRange)
if (nearPlayer) {
  try {
    bot.pathfinder.setGoal(new GoalNear(nearPlayer.position.x, nearPlayer.position.y, nearPlayer.position.z, 1))
    await waitForCondition(() => {
      const ent = bot.entities[nearPlayer.id]
      return ent && bot.entity && ent.position && bot.entity.position.distanceTo(ent.position) <= 2
    }, 7000)
  } catch (e) {}

  try {
    const items = bot.inventory.items()
    for (const item of items) {
      await tossStackPromise(item).catch(()=>{})
      await sleep(200)
    }
  } catch (e) {}
  return
}

// Eat when hungry
try {
  if (typeof bot.food === 'number' && bot.food < CONFIG.eatHungerThreshold && !bot.foodEating) {
    const food = findFood()
    if (food) {
      try {
        await bot.equip(food, 'hand')
        if (typeof bot.consume === 'function') await bot.consume()
        else if (typeof bot.activateItem === 'function') await bot.activateItem()
        await sleep(600)
      } catch (e) {}
    }
  }
} catch (e) {}

// Collect nearest dropped item in range
const itemEnt = bot.nearestEntity(e => e && e.name === 'item' && e.position && e.position.distanceTo(bot.entity.position) <= CONFIG.itemSearchRange)
if (itemEnt) {
  try {
    bot.pathfinder.setGoal(new GoalNear(itemEnt.position.x, itemEnt.position.y, itemEnt.position.z, 0.6))
    return
  } catch (e) {}
}

// If nothing else, wander
try {
  const rx = bot.entity.position.x + (Math.random() * 2 - 1) * CONFIG.wanderRadius
  const rz = bot.entity.position.z + (Math.random() * 2 - 1) * CONFIG.wanderRadius
  const ry = bot.entity.position.y
  bot.pathfinder.setGoal(new GoalNear(rx, ry, rz, 1))
} catch (e) {}

}

const loopInterval = setInterval(() => { if (bot && bot.entity) mainLoop().catch(()=>{}) }, 800)

// cleanup bot.on('end', () => { try { clearInterval(loopInterval) } catch (e) {} }) bot.on('kicked', () => { try { clearInterval(loopInterval) } catch (e) {} }) }

createBot() process.on('SIGINT', () => { shouldQuit = true; process.exit() })

