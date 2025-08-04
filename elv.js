const fs = require('fs');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const mcServerUtil = require('minecraft-server-util');
const { loadCommands, handleCommand } = require('./utils/commandHandler');
const wander = require('./utils/wander');

// config.json:
// {
//   "host": "",
//   "port": 25565,
//   "botName": "Player123",
//   "password": "",
//   "version": false,
//   "edition": "java" // optional: "java" or "bedrock"
// }

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

/**
 * Detects server edition unless overridden in config
 */
async function detectEdition() {
  if (config.edition === 'java' || config.edition === 'bedrock') {
    return config.edition;
  }

  try {
    await mcServerUtil.status(config.host, { port: config.port, timeout: 7000 });
    return 'java';
  } catch {
    try {
      const result = await mcServerUtil.statusBedrock(config.host, config.port, { timeout: 7000 });
      // store protocol version for Bedrock
      config.version = result.protocolVersion;
      return 'bedrock';
    } catch (err) {
      console.error('🔍 Server detection failed:', err.message);
      console.log('👉 Using default edition from config or falling back to Java');
      return config.edition || 'java';
    }
  }
}

async function startBot() {
  const edition = await detectEdition();
  console.log('Detected edition:', edition);

  const botOptions = {
    host: config.host,
    port: config.port,
    username: config.botName,
    keepAlive: true,
    connectTimeout: 60000
  };

  if (edition === 'bedrock') {
    botOptions.version = config.version;
    botOptions.offline = true;
  } else {
    botOptions.version = config.version || false;
    botOptions.auth = 'offline';
  }

  const bot = mineflayer.createBot(botOptions);
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log('✅ Connected');
    const mcData = minecraftData(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
    bot.commands = loadCommands(bot);
    wander(bot);

    let loggedIn = false;
    const pw = config.password;
    const loginEvent = edition === 'java' ? 'message' : 'text';

    bot.on(loginEvent, msg => {
      const txt = msg.toString().toLowerCase();
      if (/successfully|logged in/.test(txt)) {
        console.log('🔐 Login successful');
        loggedIn = true;
      }
    });

    if (pw) {
      (function tryLogin() {
        if (loggedIn) return;
        bot.chat(`/register ${pw} ${pw}`);
        setTimeout(() => bot.chat(`/login ${pw}`), 3000);
      })();
    }
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    handleCommand(bot, bot.commands, username, message.toLowerCase());
  });

  bot.on('end', () => {
    console.log('🔄 Reconnecting...');
    setTimeout(startBot, 10000);
  });

  bot.on('error', err => console.log(`⚠️ Error: ${err.message}`));
}

startBot().catch(err => console.error('❌ Fatal error:', err));
