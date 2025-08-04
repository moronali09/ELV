const fs = require('fs');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const prettyMeta = require('pretty-meta');       // optional but helps auto print debug info
const config = require('./config.json');

async function startBot() {
  console.log('🔎 Server →', config.host, ':', config.port);

  const botOptions = {
    host: config.host,
    port: config.port,
    username: config.botName,
    version: config.version || false,
    auth: config.auth || 'offline',
    keepAlive: true,
    connectTimeout: 60000
  };

  console.log('➡️ Connecting with version:', botOptions.version, 'auth:', botOptions.auth);

  const bot = mineflayer.createBot(botOptions);
  bot.loadPlugin(pathfinder);

  bot.on('kicked', reason => {
    console.log('👢 Kicked! reason =', reason.toString());
  });

  bot.on('error', err => {
    console.error('❗ Bot error:', err.message);
  });

  bot.once('spawn', () => {
    console.log('✅ Spawned as', bot.username, 'on version', bot.version);
    const mcData = minecraftData(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
    prettyMeta(bot);  // auto-print ping/latency/etc
  });

  bot.on('chat', (username, message) => {
    if (username !== bot.username) bot.chat(`You said: ${message}`);
  });

  bot.on('end', () => {
    console.log('🔄 Disconnected; reconnecting in 8s...');
    setTimeout(startBot, 8000);
  });
}

startBot().catch(err => console.error('🚫 Fatal error:', err));
