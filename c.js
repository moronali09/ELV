// auth_username_fixed_cleanerbot.fixed.js
// Fixed auth + username/pass change (username ends with "bot"), retries register/login until success.
// Tries multiple register variants, reports status into server chat (so it appears in server console).
// Install: npm i mineflayer mineflayer-pathfinder mineflayer-pvp mineflayer-armor-manager minecraft-data

const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder')
let pvpPlugin
try { pvpPlugin = require('mineflayer-pvp').plugin } catch (e) { pvpPlugin = null }
let armorManagerPlugin
try { armorManagerPlugin = require('mineflayer-armor-manager') } catch (e) { armorManagerPlugin = null }
const mcDataLib = require('minecraft-data')

// ---------- CONFIG (changed username/pass; username ends with "bot") ----------
const CONFIG = {
  host: process.env.HOST || 'sparrowcraft.aternos.me',
  port: parseInt(process.env.PORT || '25519', 10),
  username: process.env.USERNAME || 'sparrowbot',        // <-- must end with "bot"
  auth: process.env.AUTH || 'offline',                   // cracked/offline servers
  version: process.env.VERSION || undefined,

  registerName: process.env.REGNAME || 'sparrowbot',     // registration name (match username recommended)
  registerPass: process.env.REGPASS || 'Sparr0w!123',    // new password

  // auth retry settings
  authIntervalMs: 3000,    // try every 3s
  authMaxAttempts: 0,      // 0 = unlimited attempts until success

  reconnectInitial: 2000,
  reconnectMax: 60000,

  // behaviour
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

  // load plugins if available
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

  // one-line minimal login/kick/error outputs to help debugging
  bot.on('login', () => {
    console.error(`[bot] logged in as "${bot.username}"`)
    reconnectDelay = CONFIG.reconnectInitial
  })

  bot.on('kicked', (reason) => {
    const r = (reason && typeof reason.toString === 'function') ? reason.toString() : String(reason)
    console.error('[bot] kicked:', r)
    cleanupAndReconnect()
  })
  bot.on('end', () => {
    console.error('[bot] connection ended')
    cleanupAndReconnect()
  })
  bot.on('error', (err) => {
    console.error('[bot] error:', err && err.message ? err.message : String(err))
  })

  // ---------- AUTH RETRY (improved) ----------
  // auth attempts: 0 = unlimited
  let authInterval = null
  let authAttempts = 0
  let authCompleted = false

  // keywords to detect auth success in chat (loose)
  const authSuccessKeywords = [
    'logged in', 'successfully logged in', 'you are now logged in',
    'successfully authenticated', 'authentication successful',
    'registered', 'you are now registered', 'registered successfully',
    'login successful', 'welcome', 'you are already logged in', 'already logged in'
  ]
  const authPromptKeywords = [
    'register', 'type /register', 'please register', 'not registered',
    'login', 'please login', 'type /login', 'not authenticated', 'authme', 'you must register'
  ]

  function textFromMessage(jsonMsg) {
    try {
      return jsonMsg && typeof jsonMsg.toString === 'function' ? jsonMsg.toString() : String(jsonMsg)
    } catch (e) { return '' }
  }

  function checkAuthMessage(text) {
    if (!text) return
    const lower = text.toLowerCase()
    // log incoming chat locally so user sees server messages in bot console
    console.error('[chat]', text.replace(/\r?\n/g, ' '))
    for (const k of authSuccessKeywords) {
      if (lower.includes(k)) {
        if (!authCompleted) {
          authCompleted = true
          stopAuthRetries()
          console.error('[bot] auth success detected -> stopping auth retries')
          // announce to server chat (if allowed)
          try { if (typeof bot.chat === 'function') bot.chat(`[${bot.username}] auth success`) } catch (e) {}
        }
        return
      }
    }
    // if server prompts to register/login, start retries
    for (const p of authPromptKeywords) {
      if (lower.includes(p)) {
        startAuthRetries()
        return
      }
    }
  }

  function attemptAuthOnce() {
    if (authCompleted) return
    if (typeof bot.chat !== 'function') return
    // Avoid flooding server chat: only announce every N attempts (e.g., every 4 attempts)
    const announceEvery = 4
    if (authAttempts % announceEvery === 0) {
      try { bot.chat(`/msg ${CONFIG.registerName} attempting auth (attempt ${authAttempts + 1})`) } catch (e) {
        try { bot.chat(`Auth attempt ${authAttempts + 1}`) } catch (e2) {}
      }
    }

    // Try multiple common register variants followed by login.
    // Many servers use: /register <password> <password>
    // Others sometimes use: /register <name> <password>
    // We'll try several in sequence with small delays.
    try {
      bot.chat(`/register ${CONFIG.registerPass} ${CONFIG.registerPass}`)
    } catch (e) {}
    setTimeout(() => {
      try { bot.chat(`/register ${CONFIG.registerName} ${CONFIG.registerPass}`) } catch (e) {}
    }, 400)
    setTimeout(() => {
      try { bot.chat(`/register ${CONFIG.registerPass}`) } catch (e) {}
    }, 800)
    // always try login shortly after register attempts
    setTimeout(() => {
      try { bot.chat(`/login ${CONFIG.registerPass}`) } catch (e) {}
    }, 1200)

    authAttempts++
    console.error(`[bot] auth attempt #${authAttempts}`)
  }

  function startAuthRetries() {
    if (authInterval || authCompleted) return
    authAttempts = 0
    attemptAuthOnce()
    authInterval = setInterval(() => {
      if (authCompleted) { stopAuthRetries(); return }
      if (CONFIG.authMaxAttempts > 0 && authAttempts >= CONFIG.authMaxAttempts) {
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

  // listen to chat messages to detect prompts or success
  bot.on('message', (jsonMsg) => {
    const txt = textFromMessage(jsonMsg)
    checkAuthMessage(txt)
  })

  // also start auth retries on spawn (small delay to let server send prompts)
  bot.on('spawn', () => {
    setTimeout(() => {
      if (!authCompleted) startAuthRetries()
    }, 1200)
  })

  // ---------- RECONNECT helpers ----------
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

  // ---------- BEHAVIOR (cleaner + pvp non-lethal + auto-equip/eat) ----------
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
process.on('SIGINT', () => { shouldQuit = true;
  process.exit()
})
