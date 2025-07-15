const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const { GoalNear } = goals
const Vec3 = require('vec3')

function startBot() {
  const bot = mineflayer.createBot({
    host: 'aternos.org',
    port: 63085,
    username: 'ELV',
    password: 'elvmoronby'
  })

  bot.once('spawn', () => {
    bot.loadPlugin(pathfinder)
    bot.chat('Hey! I am a 24/7 bot, here to help keep the server always online.')
  })
    setInterval(() => {
      const players = Object.keys(bot.players).filter(name => name !== bot.username)
      console.log(`👥 Online Players (${players.length}): ${players.join(', ') || 'No one'}`)
  }, 60000)
})

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return

    const player = bot.players[username]?.entity
    if (message === 'follow me') {
      if (!player) return bot.chat("I can't see you right now.")
      const mcData = require('minecraft-data')(bot.version)
      const movements = new Movements(bot, mcData)
      bot.pathfinder.setMovements(movements)
      bot.chat('I am following you now.')
      bot.pathfinder.setGoal(new GoalNear(player.position.x, player.position.y, player.position.z, 1))
    }

    if (message === 'stop') {
      bot.chat('Stopped following.')
      bot.pathfinder.setGoal(null)
    }

    if (message === 'help') {
      bot.chat('Commands: follow me, stop, help')
    }
  })

  bot.on('physicTick', () => {
    const mobs = Object.values(bot.entities).filter(e => e.type === 'mob')
    if (mobs.length > 0) {
      const mob = mobs[0]
      const dx = bot.entity.position.x - mob.position.x
      const dz = bot.entity.position.z - mob.position.z
      const fleePos = bot.entity.position.offset(dx * 5, 0, dz * 5)
      const mcData = require('minecraft-data')(bot.version)
      const movements = new Movements(bot, mcData)
      bot.pathfinder.setMovements(movements)
      bot.pathfinder.setGoal(new GoalNear(fleePos.x, fleePos.y, fleePos.z, 1))
    }
  })

  bot.on('chat', (username, message) => {
    console.log(`[CHAT] <${username}> ${message}`)
  })

  bot.on('kicked', (reason) => {
    console.log('Kicked:', reason)
    setTimeout(startBot, 5000)
  })

  bot.on('error', (err) => {
    console.log('❌ Error:', err)
    setTimeout(startBot, 5000)
  })

  bot.on('end', () => {
    console.log('🔌 Disconnected')
    setTimeout(startBot, 5000)
  })
}

startBot()
