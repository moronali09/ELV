const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const fs = require('fs');

// Load config
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
let reconnectTimeout = null;

function createBot() {
  console.log('Connecting to', config.host, config.port);
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version || false
  });

  // load pathfinder
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log('Bot spawned at', bot.entity.position);
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);
  });

  // reconnect logic
  bot.on('end', () => {
    console.log('Disconnected. Reconnecting in 10s...');
    reconnectTimeout = setTimeout(createBot, 10000);
  });
  bot.on('error', err => console.error('Error:', err));

  // chat commands
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const [cmd, ...args] = message.split(' ');
    if (cmd === '!come') {
      const target = bot.players[args[0]];
      if (target) {
        const pos = target.entity.position;
        bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
        bot.chat(`Coming to ${args[0]}`);
      }
    }
    if (cmd === '!stop') {
      bot.pathfinder.setGoal(null);
      bot.chat('Stopped');
    }
    if (cmd === '!ping') {
      bot.chat(`Ping: ${bot.player.ping}ms`);
    }
  });

  // auto equip sword
  bot.on('health', () => {
    const sword = bot.inventory.items().find(item => item.name.includes('sword'));
    if (sword) bot.equip(sword, 'hand').catch(() => {});
  });

  // anti-AFK
  setInterval(() => {
    bot.lookAt(bot.entity.position.offset(1, 0, 0));
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 100);
  }, 60000);

  return bot;
}

// start
createBot();
