const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');

const HOST     = 'tensionlage.aternos.me';
const PORT     = 63085;
const BOT_NAME = 'elv';
const VERSION  = '1.21.1';
const OWNER    = 'moronali';

let retrying = false;
let currentFollower = null;

function createBot() {
  if (retrying) return;
  retrying = true;
  console.log('🤖 Connecting…');
  const bot = mineflayer.createBot({ host: HOST, port: PORT, username: BOT_NAME, version: VERSION, keepAlive: true, connectTimeout: 60000 });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    retrying = false;
    console.log('\n✅ Connected');

    const mcData = mcDataLoader(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
    startWalking(bot);

    bot.on('playerJoined', p => {
      if (p.username === BOT_NAME) return;
      console.log(`\n\n✨ ${p.username} joined`);
    });
    bot.on('playerLeft', p => {
      if (p.username === BOT_NAME) return;
      console.log(`\n\n🕳️ ${p.username} left`);
    });

    bot.on('message', jsonMsg => {
      const text = jsonMsg.toString();
      if (/ joined$/.test(text) || / left$/.test(text)) {
        console.log(`\n\n🎉 ${text}`);
      }
    });
  });

  bot.on('physicsTick', () => {
    if (!bot.entity) return;
    const pos = bot.entity.position;
    const below = bot.blockAt(pos.offset(0, -1, 0));
    if (!below || below.name.includes('water') || below.boundingBox === 'empty') {
      bot.setControlState('jump', true);
      bot.setControlState('forward', false);
    } else bot.setControlState('jump', false);
  });

  bot.on('entityHurt', e => {
    if (e.type === 'player' && e.username === BOT_NAME) {
      console.log('\n⚠️ Under attack');
      bot.clearControlStates();
      bot.setControlState('back', true);
      setTimeout(() => bot.clearControlStates(), 2000);
    }
  });

  bot.on('chat', async (username, message) => {
    const msg = message.toLowerCase();

    if (msg === 'follow me') {
      const target = bot.players[username]?.entity;
      if (!target) return bot.chat("Can't see you.");
      if (username === OWNER) {
        currentFollower = OWNER; bot.chat('➡️ Following owner');
      } else {
        if (currentFollower === OWNER) return bot.chat('🔒 Owner has priority');
        currentFollower = username; bot.chat(`➡️ Following ${username}`);
      }
      const { GoalFollow } = goals;
      return bot.pathfinder.setGoal(new GoalFollow(target, 1), true);
    }

    if (msg === 'stop') {
      bot.pathfinder.setGoal(null);
      bot.clearControlStates();
      currentFollower = null;
      return bot.chat('🛑 Stopped');
    }

    if (msg === 'jump') {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
      return bot.chat('🤾 Jumped');
    }

    if (msg === 'where are you') {
      const { x, y, z } = bot.entity.position;
      return bot.chat(`📍 X:${x.toFixed(1)} Y:${y.toFixed(1)} Z:${z.toFixed(1)}`);
    }

    if (msg === 'look at me') {
      const target = bot.players[username]?.entity;
      if (!target) return bot.chat("Can't find you.");
      await bot.lookAt(target.position.offset(0, 1.6, 0));
      return bot.chat('👀 Looking');
    }
  });

  bot.on('kicked', reason => console.log(`\n❌ Kicked: ${reason}`));
  bot.on('end', () => {
    console.log('\n🔄 Reconnecting in 10s');
    setTimeout(() => { retrying = false; createBot(); }, 10000);
  });
  bot.on('error', err => console.log(`\n⚠️ Error: ${err.message}`));
}

function startWalking(bot) {
  const dirs = ['forward','back','left','right']; let curr = null;
  setInterval(() => {
    if (!bot.entity) return;
    if (curr) bot.setControlState(curr, false);
    curr = dirs[Math.floor(Math.random() * dirs.length)];
    bot.setControlState(curr, true);
    setTimeout(() => bot.setControlState(curr, false), 2000);
  }, 4000);
}

createBot();
