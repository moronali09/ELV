const mineflayer = require('mineflayer')
const fs = require('fs')
const path = require('path')
const config = require('./config.json')

let messageLog = []

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

  bot.on('spawn', () => console.log('✅bot successfully join'))

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
    const args = message.split(' ')
    const command = bot.commands.get(args[0].toLowerCase())
    if (command) command.execute(bot, user, args.slice(1))
  })

  bot.on('end', () => startBot())
  bot.on('error', () => {})
}

startBot()
