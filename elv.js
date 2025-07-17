const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const { loadCommands, handleCommand } = require('./utils/commandHandler');
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

  bot.loadPlugin(pathfinder.pathfinder);

  bot.once('spawn', () => {
    console.log('✅ Connected');
    const mcData = mcDataLoader(bot.version);
    bot.pathfinder.setMovements(new pathfinder.Movements(bot, mcData));
    setupListeners();
  });

  bot.on('end', () => setTimeout(createBot, 10000));
  bot.on('error', err => console.log(`⚠️ Error: ${err.message}`));
}

function setupListeners() {
  const commands = loadCommands(bot);

  bot.on('chat', (username, message) => {
    handleCommand(bot, commands, username, message.toLowerCase());
  });
}

createBot();
