// auth_fixed_pro_level_cleanerbot.js
// Fixes auth reliability: retries register/login, listens for chat success messages, and stops retrying when detected.
// Install: npm i mineflayer mineflayer-pathfinder mineflayer-pvp mineflayer-armor-manager minecraft-data

const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder')
let pvpPlugin
try { pvpPlugin = require('mineflayer-pvp').plugin } catch (e) { pvpPlugin = null }
let armorManagerPlugin
try { armorManagerPlugin = require('mineflayer-armor-manager') } catch (e) { armorManagerPlugin = null }
const mcDataLib = require('minecraft-data')

// ---------- CONFIG ----------
const CONFIG = {
  host: process.env.HOST || 'sparrowcraft.aternos.me',
  port: parseInt(process.env.PORT || '25519', 10),
  username: process.env.USERNAME || 'cleanerbot',
  auth: process.env.AUTH || 'offline', // 'offline' for cracked servers
  version: process.env.VERSION || undefined, // set if server uses specific MC version (e.g. '1.16.5')

  registerName: process.env.REGNAME || 'cleanerbot',
  registerPass: process.env.REGPASS || 'cleanerbot',

  // auth retry settings
  authIntervalMs: 5000,     // how often to attempt register/login
  authMaxAttempts: 12,      // total attempts before giving up (will keep reconnecting overall)

  reconnectInitial: 2000,
  reconnectMax: 60000,

  // behavior
  itemSearchRange: 24,
  playerDetectRange: 8,
  pvpDetectRange: 12,
  wanderRadius: 6,
  eatHungerThreshold: 16,
  enablePvp: true,
  minTargetHealth: 6,
  maxAttackDurationMs: 9000,
  attackReach: 3
}

const FOOD_PREFIXES = ['apple','bread','cooked','baked','pumpkin_pie','mushroom_stew','rabbit_stew','cookie','golden_apple','golden_carrot','beetroot']

let shouldQuit = false
let reconnectDelay = CONFIG.reconnectInitial

function createBot() {
  if (shouldQuit) return

  const options = {
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    auth: CONFIG.auth
  }
  if (CONFIG.version) options.version = CONFIG.version

  const bot = mineflayer.createBot(options)

  // load plugins
  try { bot.loadPlugin(pathfinder) } catch (e) {}
  if (pvpPlugin) try { bot.loadPlugin(pvpPlugin) } catch (e) {}
  if (armorManagerPlugin) try { bot.loadPlugin(armorManagerPlugin) } catch (e) {}

  let mcData = null
  bot.once('inject_allowed', () => {
    try { mcData = mcDataLib(bot.version) } catch (e) { mcData = null }
    if (mcData) {
      const movements = new Movements(bot, mcData)
      bot.pathfinder.setMovements(movements)
    }
  })

  // minimal console output for debugging authentication
  bot.on('login', () => {
    console.error(`[bot] logged in as "${bot.username}"`)
    reconnectDelay = CONFIG.reconnectInitial
  })

  // --- AUTH RETRY LOGIC ---
  // keywords to detect success/failure from chat messages (loose matching)
  const authSuccessKeywords = [
    'logged in', 'successfully logged in', 'you are now logged in',
    'successfully authenticated', 'authentication successful',
    'registered', 'you are now registered', 'successfully registered'
  ]
  const authPromptKeywords = [
    'register', 'type /register', 'please register', 'not registered',
    'login', 'please login', 'type /login', 'not authenticated', 'authme'
  ]

  let authInterval = null
  let authAttempts = 0
  let authCompleted = false

  function textFromMessage(jsonMsg) {
    try {
      return jsonMsg && typeof jsonMsg.toString === 'function' ? jsonMsg.toString() : String(jsonMsg)
    } catch (e) { return '' }
  }

  function checkAuthMessage(text) {
    if (!text) return
    const lower = text.toLowerCase()
    for (const k of authSuccessKeywords) {
      if (lower.includes(k)) {
        authCompleted = true
        stopAuthRetries()
        console.error('[bot] auth success detected -> stopping auth retries')
        return
      }
    }
  }

  function startAuthRetries() {
    if (authInterval || authCompleted) return
    authAttempts = 0
    // initial immediate attempt
    attemptAuthOnce()
    authInterval = setInterval(() => {
      if (authCompleted) { stopAuthRetries(); return }
      authAttempts++
      if (authAttempts >= CONFIG.authMaxAttempts) {
        console.error('[bot] auth attempts exhausted (will stop trying until reconnect)')
        stopAuthRetries()
        return
      }
      attemptAuthOnce()
    }, CONFIG.authIntervalMs)
  }

  function stopAuthRetries() {
    if (authInterval) { clearInterval(authInterval); authInterval = null }
  }

  function attemptAuthOnce() {
    // Try /register then /login (some servers allow only one; both are safe to try for cracked/auth plugins)
    try {
      // only try if bot.chat exists
      if (typeof bot.chat === 'function') {
        // send register first (some servers ignore if already registered)
        try { bot.chat(`/register ${CONFIG.registerName} ${CONFIG.registerPass}`) } catch (e) {}
        // quick delay then login
        setTimeout(() => {
          try { bot.chat(`/login ${CONFIG.registerPass}`) } catch (e) {}
        }, 1000)
      }
    } catch (e) {
      // ignore errors to avoid crashes
    }
    console.error(`[bot] auth attempt #${authAttempts + 1}`)
  }

  // listen to all chat messages to detect auth success
  bot.on('message', (jsonMsg) => {
    const txt = textFromMessage(jsonMsg)
    checkAuthMessage(txt)
  })

  // also check system 'player joined' or 'spawn' timing and start retries on spawn
  bot.on('spawn', () => {
    // start auth retry loop on spawn (some servers require a bit of time before accepting chat)
    setTimeout(() => {
      if (!authCompleted) startAuthRetries()
    }, 1200) // small delay before first attempt
  })

  // when kicked/disconnected/end -> cleanup and reconnect with backoff
  bot.on('kicked', (reason) => {
    console.error('[bot] kicked:', reason)
    cleanupAndReconnect()
  })
  bot.on('end', () => {
    console.error('[bot] connection ended')
    cleanupAndReconnect()
  })
  bot.on('error', (err) => {
    console.error('[bot] error:', err && err.message ? err.message : String(err))
  })

  function cleanupAndReconnect() {
    stopAuthRetries()
    if (shouldQuit) return
    const delay = Math.min(reconnectDelay, CONFIG.reconnectMax)
    console.error(`[bot] reconnecting in ${delay} ms`)
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, CONFIG.reconnectMax)
      createBot()
    }, delay)
  }

  // --- BEHAVIOR (kept minimal & same as before) ---
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  function tossStackPromise(item) {
    return new Promise((resolve, reject) => {
      try { bot.tossStack(item, err => err ? reject(err) : resolve()) } catch (e) { reject(e) }
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
  async function equipBestSword() {
    try { const sword = bot.inventory.items().find(it => it && /sword/.test(it.name)); if (sword) await bot.equip(sword, 'hand') } catch (e) {}
  }
  async function equipBestArmor() {
    try { if (bot.armorManager && typeof bot.armorManager.equip === 'function') { await bot.armorManager.equip(); return } } catch (e) {}
    try {
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
          if (item) { try { await bot.equip(item, s.part) } catch (e) {} ; break }
        }
      }
    } catch (e) {}
  }
  function findFood() { const inv = bot.inventory.items(); return inv.find(it => it && FOOD_PREFIXES.some(p => it.name.startsWith(p))) }

  // PvP controller (non-lethal)
  let pvpActive = false
  async function tryStartPvp() {
    if (!CONFIG.enablePvp || !pvpPlugin || pvpActive) return
    if (!bot.entity || !bot.entity.position) return
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
        if (targetMissing || tooLong || lowHealth || botDead) { try { bot.pvp.stop() } catch (e) {} ; clearInterval(monitor); pvpActive = false }
        else { try { bot.pathfinder.setGoal(new GoalNear(target.position.x, target.position.y, target.position.z, CONFIG.attackReach)) } catch (e) {} }
      } catch (e) { try { bot.pvp.stop() } catch (err) {} ; clearInterval(monitor); pvpActive = false }
    }, 300)
  }

  // main behavior loop
  const mainLoop = async () => {
    if (!bot.entity || !bot.entity.position) return
    try { await tryStartPvp() } catch (e) {}
    const nearPlayer = bot.nearestEntity(e => e && e.type === 'player' && e.username && e.username !== bot.username && e.position && e.position.distanceTo(bot.entity.position) <= CONFIG.playerDetectRange)
    if (nearPlayer) {
      try { bot.pathfinder.setGoal(new GoalNear(nearPlayer.position.x, nearPlayer.position.y, nearPlayer.position.z, 1))
        await waitForCondition(() => { const ent = bot.entities[nearPlayer.id]; return ent && bot.entity && ent.position && bot.entity.position.distanceTo(ent.position) <= 2 }, 7000)
      } catch (e) {}
      try { const items = bot.inventory.items(); for (const item of items) { await tossStackPromise(item).catch(()=>{}); await sleep(200) } } catch (e) {}
      return
    }
    try {
      if (typeof bot.food === 'number' && bot.food < CONFIG.eatHungerThreshold && !bot.foodEating) {
        const food = findFood()
        if (food) { try { await bot.equip(food, 'hand'); if (typeof bot.consume === 'function') await bot.consume(); else if (typeof bot.activateItem === 'function') await bot.activateItem(); await sleep(600) } catch (e) {} }
      }
    } catch (e) {}
    const itemEnt = bot.nearestEntity(e => e && e.name === 'item' && e.position && e.position.distanceTo(bot.entity.position) <= CONFIG.itemSearchRange)
    if (itemEnt) { try { bot.pathfinder.setGoal(new GoalNear(itemEnt.position.x, itemEnt.position.y, itemEnt.position.z, 0.6)) } catch (e) {} ; return }
    try { const rx = bot.entity.position.x + (Math.random() * 2 - 1) * CONFIG.wanderRadius; const rz = bot.entity.position.z + (Math.random() * 2 - 1) * CONFIG.wanderRadius; const ry = bot.entity.position.y; bot.pathfinder.setGoal(new GoalNear(rx, ry, rz, 1)) } catch (e) {}
  }

  const loopInterval = setInterval(() => { if (bot && bot.entity) mainLoop().catch(()=>{}) }, 800)

  bot.on('end', () => { try { clearInterval(loopInterval) } catch (e) {} })
  bot.on('kicked', () => { try { clearInterval(loopInterval) } catch (e) {} })
}

// start
createBot()
process.on('SIGINT', () => { shouldQuit = true; process.exit() })
