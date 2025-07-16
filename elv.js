const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const mcDataLoader = require('minecraft-data')

const HOST = 'tensionlage.aternos.me'
const PORT = 63085
const BOT_NAME = 'ELV'
const VERSION = '1.21.1'
const FOOD = ['cooked_beef', 'cooked_porkchop', 'bread', 'apple']

let bot

function log(...args) {
  console.log(new Date().toISOString(), ...args)
}

function createBot() {
  bot = mineflayer.createBot({ host: HOST, port: PORT, username: BOT_NAME, version: VERSION })
  bot.loadPlugin(pathfinder)

  bot.once('spawn', () => {
    const mcData = mcDataLoader(bot.version)
    bot.pathfinder.setMovements(new Movements(bot, mcData))
    log('Spawned as', BOT_NAME)
    bot.chat('24/7 Bot Online and ready')

    startWalking()
    startDancing()
    startFoodRoutine()
    startSleepRoutine()
    monitorPlayers()
  })

  bot.on('playerJoined', p => {
    if (p.username !== BOT_NAME) {
      bot.chat(`🎉 Welcome ${p.username}!`)
      log('Player joined:', p.username)
    }
  })

  bot.on('message', message => {
    log('[SERVER]', message.toString())
  })

  bot.on('chat', (username, message) => {
    if (username === BOT_NAME) return
    log(`<${username}>`, message)
    const msg = message.toLowerCase()

    if (msg.startsWith('wlc')) {
      const name = message.split(' ')[1] || username
      bot.chat(`👋 Hello ${name}, welcome!`)
    }
    if (msg === 'help') {
      bot.chat('Commands: wlc, help')
    }
  })

  bot.on('death', () => {
    bot.chat('✖ I died! Respawning...')
    log('Died, respawning')
    setTimeout(() => bot.spawn(), 3000)
  })

  bot.on('error', err => {
    log('Error:', err.message)
  })

  bot.on('end', () => {
    log('Disconnected, reconnecting...')
    setTimeout(createBot, 5000)
  })
}

function startWalking() {
  const dirs = ['forward', 'back', 'left', 'right']
  let cur = null
  setInterval(() => {
    if (!bot.entity) return
    if (cur) bot.setControlState(cur, false)
    cur = dirs[Math.floor(Math.random() * dirs.length)]
    bot.setControlState(cur, true)
    setTimeout(() => bot.setControlState(cur, false), 2000)
  }, 5000)
}

function startDancing() {
  const emotes = ['dance', 'spin', 'groove']
  setInterval(() => {
    const em = emotes[Math.floor(Math.random() * emotes.length)]
    bot.chat(`💃 ${em}`)
    log('Danced:', em)
  }, 300000)
}

async function eatFood() {
  if (!bot.food || bot.food > 14) return
  const stack = bot.inventory.items().find(i => FOOD.includes(i.name))
  if (!stack) return
  try {
    await bot.equip(stack, 'hand')
    await bot.consume(stack)
    bot.chat('😋 Nom nom')
    log('Ate:', stack.name)
  } catch (e) {
    log('Eat error:', e.message)
  }
}

function startFoodRoutine() {
  setInterval(eatFood, 120000)
}

async function trySleep() {
  const time = bot.time.time % 24000
  if (time < 12500 || time > 23000) return
  const bed = bot.findBlock({ matching: b => b.name.includes('_bed'), maxDistance: 20 })
  if (!bed) {
    bot.chat('🔍 No bed nearby')
    return
  }
  try {
    await bot.pathfinder.goto(new goals.GoalBlock(bed.position.x, bed.position.y, bed.position.z))
    await bot.sleep(bed)
    bot.chat('😴 Slept well')
    log('Slept at bed')
  } catch (e) {
    log('Sleep error:', e.message)
  }
}

function startSleepRoutine() {
  setInterval(trySleep, 60000)
}

function monitorPlayers() {
  setInterval(() => {
    const players = Object.keys(bot.players).filter(n => n !== BOT_NAME)
    log('Players online:', players.length, players.join(', ') || 'None')
  }, 60000)
}

createBot()
