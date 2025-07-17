const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const { loadCommands, handleCommand } = require('./utils/commandHandler');
const config = require('./config.json');
const wander = require('./utils/wander');

let bot;

function createBot() {
  console.log('🤖 Connecting...');
  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.botName,
    version: config.version,
    keepAlive: true,
    connectTimeout: 60000
  });

  bot.loadPlugin(pathfinder.pathfinder);
  bot.once('spawn', () => {
  console.log('✅ Connected');
  const mcData = mcDataLoader(bot.version);
  bot.pathfinder.setMovements(new pathfinder.Movements(bot, mcData));
  setupListeners();

  const wander = require('./utils/wander');
  wander(bot);
});
  

    let loggedIn = false;
    const password = config.password || 'elvmoronby';

    const tryLogin = () => {
      if (loggedIn) return;
      bot.chat(`/register ${password} ${password}`);
      setTimeout(() => bot.chat(`/login ${password}`), 3000);
    };

    tryLogin();

    const mcData = mcDataLoader(bot.version);
    bot.pathfinder.setMovements(new pathfinder.Movements(bot, mcData));
    setupListeners();
  });

  bot.on('end', () => setTimeout(createBot, 10000));
  bot.on('error', err => console.log(`⚠️ Error: ${err.message}`));
}

function setupListeners() {
  const commands = loadCommands(bot);
  bot.commands = commands;

  bot.on('message', (jsonMsg) => {
    const msg = jsonMsg.toString();
    if (
      msg.toLowerCase().includes('successfully') ||
      msg.toLowerCase().includes('logged in')
    ) {
      console.log('🔐 Login successful!');
    }
  });

  bot.on('chat', (username, message) => {
    handleCommand(bot, bot.commands, username, message.toLowerCase());
  });
}

createBot();
