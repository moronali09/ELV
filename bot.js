const mineflayer = require('mineflayer')
const fs = require('fs')
const path = require('path')
const config = require('./config.json')
let messageLog = []
let userRegistered = false
let userLoggedIn = false

function loadCommands(bot) {
  const dir = path.join(__dirname, 'commands')
  fs.readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .forEach(f => {
      const cmd = require(path.join(dir, f))
      bot.commands.set(cmd.name, cmd)
    })
}

function startBot() {
  const bot = mineflayer.createBot({ host: config.host, port: config.port, username: config.username })
  bot.commands = new Map()
  loadCommands(bot)

  bot.on('spawn', () => {
    console.log('bot successfully join')
    const edition = bot.version.includes('bedrock') ? 'Bedrock' : 'Java'
    bot.chat(`Running on ${edition} Edition`)
    if (userRegistered && !userLoggedIn) {
      bot.chat('login successful')
      userLoggedIn = true
    }
    setInterval(() => bot.chat(['I am alive','Keeping active','Hello everyone'][Math.floor(Math.random()*3)]), config.chatInterval)
    setInterval(() => {
      let a = Math.PI / 4
      bot.look(Math.cos(a), Math.sin(a), true)
    }, config.antiAfkInterval)
  })

  // Handle kicks (e.g., Aternos anti-bot)
  bot.on('kicked', reason => {
    if (reason.includes('Aternos anti-bot')) {
      bot.chat('Anti-bot detected, reconnecting...')
    }
    startBot()
  })

  bot.on('chat', (user, msg) => {
    if (user === bot.username) return
    messageLog.push(Date.now())
    const cutoff = Date.now() - config.spamInterval
    messageLog = messageLog.filter(t => t > cutoff)
    if (messageLog.length >= config.spamThreshold) {
      bot.quit()
      startBot()
      return
    }

    const parts = msg.split(' ')
    const cmd = parts[0].toLowerCase()

    // Inline detect
    if (cmd === 'detect') {
      const others = Object.values(bot.players).filter(p => p.username !== bot.username)
      if (!others.length) bot.chat('No players nearby.')
      else others.forEach(p => {
        const d = bot.entity.position.distanceTo(p.entity.position).toFixed(1)
        bot.chat(`${p.username} is ${d} blocks away.`)
      })
      return
    }

    // Follow me command
    if (cmd === 'followme') {
      const target = bot.players[user]?.entity
      if (!target) {
        bot.chat('Cannot find you to follow.')
        return
      }
      bot.chat(`Following ${user}`)
      bot.on('physicsTick', () => {
        bot.lookAt(target.position.offset(0, target.height, 0))
        bot.setControlState('forward', true)
      })
      return
    }

    // Registration and login
    if (cmd === 'register') {
      if (userRegistered) bot.chat('already registered')
      else {
        bot.chat('register successful')
        userRegistered = true
      }
      return
    }
    if (cmd === 'login') {
      if (!userRegistered) bot.chat('please register first')
      else if (userLoggedIn) bot.chat('already logged in')
      else {
        bot.chat('login successful')
        userLoggedIn = true
      }
      return
    }

    // Other commands
    const command = bot.commands.get(cmd)
    if (command) command.execute(bot, user, parts.slice(1))
  })

  bot.on('end', () => startBot())
  bot.on('error', () => {})
}

startBot()
