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
    setInterval(() => {
      const msgs = ['I am alive', 'Keeping active', 'Hello everyone']
      bot.chat(msgs[Math.floor(Math.random() * msgs.length)])
    }, config.chatInterval)
    let angle = 0
    setInterval(() => {
      angle += Math.PI / 4
      bot.look(Math.cos(angle), Math.sin(angle), true)
    }, config.antiAfkInterval)
  })

  bot.on('chat', (user, message) => {
    if (user === bot.username) return

    messageLog.push(Date.now())
    const cutoff = Date.now() - config.spamInterval
    messageLog = messageLog.filter(t => t > cutoff)
    if (messageLog.length >= config.spamThreshold) {
      bot.quit()
      startBot()
      return
    }

    const parts = message.split(' ')
    const cmdName = parts[0].toLowerCase()

    if (cmdName === 'detect') {
      const others = Object.values(bot.players).filter(p => p.username !== bot.username)
      if (others.length === 0) bot.chat('No players nearby.')
      else others.forEach(p => {
        const d = bot.entity.position.distanceTo(p.entity.position).toFixed(1)
        bot.chat(`${p.username} is ${d} blocks away.`)
      })
      return
    }

    if (cmdName === 'register') {
      if (userRegistered) {
        bot.chat('already registered')
      } else if (bot._client.registry.getPlugin('register')) {
        bot.chat('register successful')
        userRegistered = true
      } else {
        bot.chat('register plugin not found')
      }
      return
    }

    if (cmdName === 'login') {
      if (!userRegistered) {
        bot.chat('please register first')
      } else if (userLoggedIn) {
        bot.chat('already logged in')
      } else {
        bot.chat('login successful')
        userLoggedIn = true
      }
      return
    }

    const cmd = bot.commands.get(cmdName)
    if (cmd) cmd.execute(bot, user, parts.slice(1))
  })

  bot.on('end', () => startBot())
  bot.on('error', () => {})
}

startBot()
