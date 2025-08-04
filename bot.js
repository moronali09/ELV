const fetch = require('node-fetch')
const mineflayer = require('mineflayer')

// এটা সার্ভার লিস্ট নিয়ে আসবে:
async function fetchServerList() {
  const res = await fetch(config.serverListUrl, {
    headers: { 'X-Master-Key': config.jsonbinSecretKey }
  })
  const body = await res.json()
  // ধরে নিচ্ছি body.record = [{ name, host, port }]
  return body.record
}

// প্রতিটা সার্ভারের জন্য নতুন Bot তৈরি করবে:
async function spawnBotsForAllServers() {
  const servers = await fetchServerList()
  servers.forEach(srv => {
    const bot = mineflayer.createBot({
      host: srv.host,
      port: srv.port,
      username: `${config.username}_${srv.name}`
    })
    bot.on('spawn', () => {
      console.log(`Joined ${srv.name} at ${srv.host}:${srv.port}`)
      bot.chat(`Hello ${srv.name}!`)
    })
    // এখানে আগের মতোই event হ্যান্ডলার, reconnect ইত্যাদি...
  })
}

// 4) বাদে যখন ইচ্ছা, কার্নালে বা /loadservers কমান্ড এ কল দাও:
bot.on('chat', (u,msg) => {
  if (msg === '/loadservers') {
    spawnBotsForAllServers().catch(console.error)
  }
})
