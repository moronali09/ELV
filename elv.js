const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const fs = require('fs');

// Load config
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
let reconnectTimeout = null;
let afkInterval = null;

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

    // start anti-AFK after spawn
    afkInterval = setInterval(() => {
      if (bot.entity && bot.entity.position) {
        const pos = bot.entity.position;
        try {
          bot.lookAt(pos.offset(1, 0, 0));
        } catch (err) {}
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 100);
      }
    }, 60000);
  });

  // reconnect logic
  bot.on('end', () => {
    console.log('Disconnected. Reconnecting in 10s...');
    if (afkInterval) clearInterval(afkInterval);
    reconnectTimeout = setTimeout(createBot, 10000);
  });
  bot.on('error', err => console.error('Error:', err));

  // chat commands
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const [cmd, ...args] = message.split(' ');
    if (cmd === '!come') {
      const target = bot.players[args[0]];
      if (target && target.entity) {
        const pos = target.entity.position;
        bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
        bot.chat(`Coming to ${args[0]}`);
      } else {
        bot.chat(`Player ${args[0]} not found`);
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

  return bot;
}

// start
createBot();
