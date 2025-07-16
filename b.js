const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');

const HOST     = 'tensionlage.aternos.me';
const PORT     = 63085;
const BOT_NAME = 'elv';
const VERSION  = '1.21.1';
const OWNER    = 'moronali';

let retrying = false;

function createBot() {
  if (retrying) return;
  retrying = true;
  console.log('▶️ Creating bot…');
  const bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: BOT_NAME,
    version: VERSION,
    keepAlive: true,
    connectTimeout: 60 * 1000
  });

  // Pathfinder প্লাগইন লোড
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    retrying = false;
    console.log('✅ Bot joined the server!');

    const mcData = mcDataLoader(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);
    startWalking(bot);
  });

  // খেলোয়াড় যোগ/বিয়ে
  bot.on('playerJoined', p => p.username !== BOT_NAME && console.log(`🟢 Join: ${p.username}`));
  bot.on('playerLeft',   p => p.username !== BOT_NAME && console.log(`🔴 Leave: ${p.username}`));

  // physicsTick ও EntityHandled
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
      console.log('⚠️ Under attack! Escaping…');
      bot.clearControlStates();
      bot.setControlState('back', true);
      setTimeout(() => bot.clearControlStates(), 2000);
    }
  });

  // chat কমান্ড
  bot.on('chat', async (u, msg) => {
    if (u !== OWNER) return;
    const lower = msg.toLowerCase();
    switch (lower) {
      case 'jump':
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 500);
        return bot.chat('Jumped!');
      case 'follow me': {
        const target = bot.players[u]?.entity;
        if (!target) return bot.chat("Can't see you!");
        bot.chat('Following you...');
        const { GoalFollow } = goals;
        return bot.pathfinder.setGoal(new GoalFollow(target, 1), true);
      }
      case 'stop':
        bot.pathfinder.setGoal(null);
        bot.clearControlStates();
        return bot.chat('Stopped.');
      case 'where are you': {
        const { x, y, z } = bot.entity.position;
        return bot.chat(`I am at X:${x.toFixed(1)} Y:${y.toFixed(1)} Z:${z.toFixed(1)}`);
      }
      case 'look at me': {
        const target = bot.players[u]?.entity;
        if (!target) return bot.chat("Can't find you.");
        await bot.lookAt(target.position.offset(0, 1.6, 0));
        return bot.chat('👀 I am looking at you!');
      }
      case 'house banao':
        return bot.chat('House building not implemented yet.');
      default:
        return;
    }
  });

  // বন্ধ / এরর হ্যান্ডলিং
  bot.on('kicked', reason => {
    console.log(`❌ Kicked: ${reason}`);
  });
  bot.on('end', () => {
    console.log('❌ Connection closed – retrying in 10s');
    setTimeout(() => { retrying = false; createBot(); }, 10000);
  });
  bot.on('error', err => {
    console.log('⚠️ Bot error:', err.message);
  });
}

function startWalking(bot) {
  const dirs = ['forward', 'back', 'left', 'right'];
  let curr = null;
  setInterval(() => {
    if (!bot.entity) return;
    if (curr) bot.setControlState(curr, false);
    curr = dirs[Math.floor(Math.random() * dirs.length)];
    bot.setControlState(curr, true);
    setTimeout(() => bot.setControlState(curr, false), 2000);
  }, 4000);
}

createBot();
