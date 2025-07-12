// bot.js
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const fs = require('fs');

const HOST       = 'shadow_elites.ignorelist.com';
const PORT       = 25604;
const BOT_NAME   = 'ELV';
const VERSION    = '1.21.1';
const OWNER      = 'moronali09';
const PASSWORD   = 'elvmoronby';
const WELCOME_SET = new Set();

function stripFormatting(text) {
  return text.replace(/§[0-9a-fk-or]/gi, '');
}

let bot = null;

function createBot() {
  console.log('▶️ Creating bot…');
  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: BOT_NAME,
    version: VERSION
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log('✅ Bot joined the server!');

    const mcData = mcDataLoader(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);

    setTimeout(() => bot.chat(`/register ${PASSWORD} ${PASSWORD}`), 5000);
    setTimeout(() => bot.chat(`/login ${PASSWORD}`), 10000);

    startWalking();
  });

  bot.on('message', msg => {
    console.log('[Chat]', stripFormatting(msg.toString()));
  });

  bot.on('playerJoined', player => {
    if (!player.username || player.username === BOT_NAME) return;
    const name = stripFormatting(player.username);
    console.log(`🟢 Join: ${name}`);

    if (!WELCOME_SET.has(name)) {
      bot.chat(`👋 Welcome ${name}!`);
      WELCOME_SET.add(name);
    }

    const target = bot.players[player.username]?.entity;
    if (target) {
      const { GoalFollow } = goals;
      bot.pathfinder.setGoal(new GoalFollow(target, 1), true);
      bot.chat(`👣 I'm following you, ${name}`);
    }
  });

  bot.on('playerLeft', player => {
    if (!player.username || player.username === BOT_NAME) return;
    const name = stripFormatting(player.username);
    console.log(`🔴 Leave: ${name}`);
    bot.chat(`${name} left the server.`);
  });

  // physicsTick: জল বা ফাঁকা ব্লক এড়িয়ে যাবে
  bot.on('physicsTick', () => {
    if (!bot.entity) return;
    const pos   = bot.entity.position;
    const below = bot.blockAt(pos.offset(0, -1, 0));
    if (!below || below.name.includes('water') || below.boundingBox === 'empty') {
      bot.setControlState('jump', true);
      bot.setControlState('forward', false);
    } else {
      bot.setControlState('jump', false);
    }
  });

  bot.on('entityHurt', entity => {
    if (entity.type === 'player' && entity.username === BOT_NAME) {
      console.log('⚠️ Under attack! Escaping…');
      bot.clearControlStates();
      bot.setControlState('back', true);
      setTimeout(() => bot.clearControlStates(), 2000);
    }
  });

  bot.on('chat', async (username, message) => {
    if (username !== OWNER) return;

    const msg = message.toLowerCase();

    if (msg === 'jump') {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
      bot.chat('Jumped!');
    }
    else if (msg === 'follow me') {
      const target = bot.players[username]?.entity;
      if (!target) return bot.chat("Can't see you!");
      bot.chat('Following you...');
      const { GoalFollow } = goals;
      bot.pathfinder.setGoal(new GoalFollow(target, 1), true);
    }
    else if (msg === 'stop') {
      bot.pathfinder.setGoal(null);
      bot.clearControlStates();
      bot.chat('Stopped.');
    }
    else if (msg === 'where are you') {
      const p = bot.entity.position;
      bot.chat(`I am at X:${p.x.toFixed(1)} Y:${p.y.toFixed(1)} Z:${p.z.toFixed(1)}`);
    }
    else if (msg === 'look at me') {
      const target = bot.players[username]?.entity;
      if (!target) return bot.chat("Can't find you.");
      await bot.lookAt(target.position.offset(0, 1.6, 0));
      bot.chat('👀 I am looking at you!');
    }
    else if (msg === 'ping') {
      const ping = bot._client?.ping ?? 'N/A';
      bot.chat(`🏓 Ping: ${ping}ms`);
    }
    else if (msg === 'players') {
      const list = Object.keys(bot.players)
        .map(n => stripFormatting(n))
        .filter(n => n !== BOT_NAME);
      bot.chat(`👥 Players online (${list.length}): ${list.join(', ') || 'None'}`);
    }
    else if (msg === 'house banao') {
      bot.chat('House building not implemented yet.');
    }
  });

  bot.on('end', () => {
    console.log('❌ Bot disconnected – retrying in 10s');
    setTimeout(createBot, 10000);
  });
  bot.on('error', err => {
    console.log('⚠️ Bot error:', err.message, '– retrying in 10s');
    setTimeout(createBot, 10000);
  });
}

function startWalking() {
  const directions = ['forward', 'back', 'left', 'right'];
  let current = null;
  setInterval(() => {
    if (!bot || !bot.entity) return;
    if (current) bot.setControlState(current, false);
    current = directions[Math.floor(Math.random() * directions.length)];
    bot.setControlState(current, true);
    setTimeout(() => bot.setControlState(current, false), 2000);
  }, 5000);
}

createBot();
