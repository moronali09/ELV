const fs = require('fs');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const mcServerUtil = require('minecraft-server-util');
const { loadCommands, handleCommand } = require('./utils/commandHandler');
const wander = require('./utils/wander');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

/**
 * Detect Java or Bedrock
 */
async function detectEdition() {
  try {
    await mcServerUtil.status(config.host, { port: config.port, timeout: 5000 });
    return 'java';
  } catch {
    try {
      const result = await mcServerUtil.statusBedrock(config.host, config.port, { timeout: 5000 });
      return { edition: 'bedrock', version: result.protocolVersion };
    } catch {
      throw new Error('Cannot reach server');
    }
  }
}

async function startBot() {
  const detect = await detectEdition();
  console.log('Detected edition:', detect.edition || detect);

  const botOptions = {
    host: config.host,
    port: config.port,
    username: config.botName,
    keepAlive: true,
    connectTimeout: 60000
  };

  if (detect !== 'java') {
    // Bedrock
    botOptions.version = detect.version;
    botOptions.offline = true;
  } else {
    // Java
    botOptions.version = config.version || false;
    botOptions.auth = 'offline';
  }

  const bot = mineflayer.createBot(botOptions);
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log('✅ Connected');
    // movement setup
    const mcData = minecraftData(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));

    // load commands & wander
    bot.commands = loadCommands(bot);
    wander(bot);

    // login/register
    let loggedIn = false;
    const pw = config.password || null;
    bot.on(detect === 'java' ? 'message' : 'text', (msg) => {
      const txt = msg.toString().toLowerCase();
      if (/successfully|logged in/.test(txt)) {
        console.log('🔐 Login successful');
        loggedIn = true;
      }
    });

    (function tryLogin() {
      if (!pw || loggedIn) return;
      bot.chat(`/register ${pw} ${pw}`);
      setTimeout(() => bot.chat(`/login ${pw}`), 3000);
    })();
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

startBot().catch(console.error);
