const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const { GoalFollow } = goals
const bot = mineflayer.createBot({
  host: 'tensionlage.aternos.me',
  port: 63085,
  username: 'ELV',
  password: 'elvmoronby'
})

bot.once('spawn', () => {
  bot.loadPlugin(pathfinder)
  const defaultMove = new Movements(bot)
  bot.pathfinder.setMovements(defaultMove)
  bot.chat('Hey! I am a 24/7 bot, here to help keep the server always online.')

  setInterval(() => {
    const players = Object.keys(bot.players).filter(name => name !== bot.username)
    console.log(`👥 Online Players (${players.length}): ${players.join(', ') || 'No one'}`)
  }, 10000)

  setInterval(() => {
    if (!bot.pathfinder.isMoving()) {
      const x = bot.entity.position.x + (Math.random() * 20 - 10)
      const z = bot.entity.position.z + (Math.random() * 20 - 10)
      const y = bot.entity.position.y
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z))
    }
  }, 15000)
})

bot.on('chat', async (username, message) => {
  if (username === bot.username) return

  if (message === 'follow me') {
    const target = bot.players[username]?.entity
    if (target) {
      bot.chat('Following you!')
      bot.pathfinder.setGoal(new GoalFollow(target, 1), true)
    } else {
      bot.chat("I can't see you right now.")
    }
  }

  if (message === 'stop') {
    bot.chat('Stopping.')
    bot.pathfinder.setGoal(null)
  }

  if (message === 'help') {
    bot.chat('Commands: follow me, stop, help')
  }
})

bot.on('physicTick', () => {
  const mobs = Object.values(bot.entities).filter(e => e.type === 'mob')
  if (mobs.length > 0) {
    const dx = Math.random() * 10 - 5
    const dz = Math.random() * 10 - 5
    const goal = new goals.GoalBlock(
      Math.floor(bot.entity.position.x + dx),
      Math.floor(bot.entity.position.y),
      Math.floor(bot.entity.position.z + dz)
    )
    bot.pathfinder.setGoal(goal)
    bot.chat('Mob detected! I am running away.')
  }
})

bot.on('end', () => {
  console.log('🔌 Bot disconnected. Reconnecting...')
  setTimeout(() => {
    process.exit(1)
  }, 5000)
})

bot.on('error', err => {
  console.log('❌ Error:', err)
})
