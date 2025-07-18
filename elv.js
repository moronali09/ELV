const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const { loadCommands, handleCommand } = require('./utils/commandHandler');
const wander = require('./utils/wander');
const config = require('./config.json');

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

  // apply plugin
  bot.loadPlugin(pathfinder.pathfinder);

  bot.once('spawn', () => {
    console.log('✅ Connected');

    // movement setup
    const mcData = mcDataLoader(bot.version);
    bot.pathfinder.setMovements(new pathfinder.Movements(bot, mcData));

    // load commands and wander behavior
    bot.commands = loadCommands(bot);
    setupListeners();
    wander(bot);

    // login logic
    let loggedIn = false;
    const password = config.password || 'elvmoronby';

    bot.on('message', (jsonMsg) => {
      const msg = jsonMsg.toString().toLowerCase();
      if (msg.includes('successfully') || msg.includes('logged in')) {
        console.log('🔐 Login successful!');
        loggedIn = true;
      }
    });

    const tryLogin = () => {
      if (loggedIn) return;
      bot.chat(`/register ${password} ${password}`);
      setTimeout(() => bot.chat(`/login ${password}`), 3000);
    };

    tryLogin();
  });

  // reconnect on end/error
  bot.on('end', () => setTimeout(createBot, 10000));
  bot.on('error', err => console.log(`⚠️ Error: ${err.message}`));
}

function setupListeners() {
  bot.on('chat', (username, message) => {
    handleCommand(bot, bot.commands, username, message.toLowerCase());
  });
}

// start bot
createBot();
