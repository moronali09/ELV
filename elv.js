const { createBot } = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const Vec3 = require('vec3')

const config = {
  host: 'tensionlage.aternos.me',
  port: 63085,
  username: 'ELV',
  version: '1.21.1',
  password: 'elvmoronby'
}

function randomPos(origin, range = 10) {
  return origin.offset(
    Math.floor(Math.random() * range - range / 2),
    0,
    Math.floor(Math.random() * range - range / 2)
  )
}

async function moveTo(bot, position) {
  try {
    bot.pathfinder.setMovements(new Movements(bot))
    return new Promise(resolve => {
      bot.pathfinder.goto(
        new goals.GoalBlock(position.x, position.y, position.z),
        err => {
          if (err) {
            console.log('⚠️ moveTo error:', err.message)
            resolve(false)
          } else {
            resolve(true)
          }
        }
      )
    })
  } catch (e) {
    console.log('⚠️ moveTo failed:', e.message)
  }
}

function start() {
  const bot = createBot(config)
  bot.loadPlugin(pathfinder)

  let following = false

  bot.on('spawn', () => {
    if (config.password) {
      bot.chat(`/login ${config.password}`)
    }
    bot.chat('I am 24/7 bot to keep server online. Type help for commands.')

    bot.on('chat', (username, message) => {
      console.log(`[CHAT] <${username}> ${message}`)
      if (message === 'help') {
        bot.chat('Commands: follow me, stop, help')
      } else if (message === 'follow me') {
        following = true
        bot.chat('Following you')
      } else if (message === 'stop') {
        following = false
        bot.chat('Stopped following')
      }
    })

    setInterval(() => {
      if (!following) {
        const target = randomPos(bot.entity.position)
        moveTo(bot, target)
      }
    }, 30000)

    bot.on('physicsTick', () => {
      const mob = bot.nearestEntity(e => e.type === 'mob')
      if (mob && bot.entity.position.distanceTo(mob.position) < 10) {
        const away = bot.entity.position.offset(
          bot.entity.position.x - mob.position.x,
          0,
          bot.entity.position.z - mob.position.z
        )
        moveTo(bot, away)
      } else if (following) {
        const playerEntity = bot.players[config.username]?.entity
        if (playerEntity) {
          moveTo(bot, playerEntity.position)
        }
      }
    })
  })

  bot.on('error', err => console.log('❌ Error:', err.message))
  bot.on('end', () => {
    console.log('🔌 Disconnected, reconnecting...')
    setTimeout(start, 5000)
  })
}

start()
