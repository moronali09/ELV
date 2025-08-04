const fetch = require('node-fetch')
const config = require('../config.json')

module.exports = {
  name: 'server',
  description: 'Manage server list via JSONBin',
  async execute(bot, user, args) {
    const sub = args[0]
    const binUrl = config.serverListUrl
    const apiKey = config.jsonbinSecretKey

    if (sub === 'add') {
      // args: add <name> <host> <port>
      const [ , name, host, port ] = args
      if (!name || !host || !port) {
        return bot.chat('Usage: /server add <name> <host> <port>')
      }
      // Fetch current list
      let res = await fetch(binUrl, { headers: { 'X-Master-Key': apiKey } })
      let data = await res.json()
      const list = data.record || []
      list.push({ name, host, port: parseInt(port, 10) })
      // Update JSONBin
      await fetch(binUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': apiKey
        },
        body: JSON.stringify(list)
      })
      bot.chat(`Server ${name} added.`)

    } else if (sub === 'list') {
      // List servers
      let res = await fetch(binUrl, { headers: { 'X-Master-Key': apiKey } })
      let data = await res.json()
      const list = data.record || []
      if (!list.length) return bot.chat('No servers in list.')
      list.forEach(srv => {
        bot.chat(`${srv.name}: ${srv.host}:${srv.port}`)
      })
    } else {
      bot.chat('Usage: /server add <name> <host> <port> or /server list')
    }
  }
}
