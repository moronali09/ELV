// bot.js
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');

const HOST     = 'EXTRA_ZONE345.aternos.me';
const PORT     = 14137;
const BOT_NAME = 'SmartAFK_Bot';
const VERSION  = '1.21.1';
const OWNER    = 'moronali09';

let bot = null;

function createBot() {
  console.log('▶️ Creating bot…');
  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: BOT_NAME,
    version: VERSION
  });

  // শুধুমাত্র pathfinder প্লাগইন লোড
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log('✅ Bot joined the server!');

    // minecraft-data এখন bot.version দিয়ে লোড
    const mcData = mcDataLoader(bot.version);

    // pathfinder movements সেটাপ
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);

    // র‍্যান্ডম হেঁটে বেড়ানোর শুরু
    startWalking();
  });

  bot.on('playerJoined', player => {
    if (player.username !== BOT_NAME) {
      console.log(`🟢 Join: ${player.username}`);
    }
  });

  bot.on('playerLeft', player => {
    if (player.username !== BOT_NAME) {
      console.log(`🔴 Leave: ${player.username}`);
    }
  });

  // পানি বা গর্ত এড়ানোর জন্য
  bot.on('physicsTick', () => {
    if (!bot.entity) return;
    const pos = bot.entity.position;
    const below = bot.blockAt(pos.offset(0, -1, 0));
    if (!below || below.name.includes('water') || below.boundingBox === 'empty') {
      bot.setControlState('jump', true);
      bot.setControlState('forward', false);
    } else {
      bot.setControlState('jump', false);
    }
  });

  // আক্রমণে পিছু সরে যাওয়া
  bot.on('entityHurt', entity => {
    if (entity.type === 'player' && entity.username === BOT_NAME) {
      console.log('⚠️ Under attack! Escaping…');
      bot.clearControlStates();
      bot.setControlState('back', true);
      setTimeout(() => bot.clearControlStates(), 2000);
    }
  });

  // চ্যাট কমান্ড হ্যান্ডলার
  bot.on('chat', async (username, message) => {
    if (username !== OWNER) return; // শুধু OWNER কমান্ড চালাতে পারবে

    // Jump কমান্ড
    if (message === 'jump') {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
      bot.chat('Jumped!');
    }
    
    // Follow Me কমান্ড
    else if (message === 'follow me') {
      const target = bot.players[username]?.entity;
      if (!target) return bot.chat("Can't see you!");
      bot.chat('Following you...');
      const { GoalFollow } = goals;
      bot.pathfinder.setGoal(new GoalFollow(target, 1), true);
    }

    // Stop কমান্ড
    else if (message === 'stop') {
      bot.pathfinder.setGoal(null);
      bot.clearControlStates();
      bot.chat('Stopped.');
    }

    // Location জানতে চাওয়া
    else if (message === 'where are you') {
      const pos = bot.entity.position;
      bot.chat(`I am at X:${pos.x.toFixed(1)} Y:${pos.y.toFixed(1)} Z:${pos.z.toFixed(1)}`);
    }

    // Look at me কমান্ড
    else if (message === 'look at me') {
      const target = bot.players[username]?.entity;
      if (!target) return bot.chat("Can't find you.");
      await bot.lookAt(target.position.offset(0, 1.6, 0));
      bot.chat('👀 I am looking at you!');
    }

    // House বানানোর প্লেসহোল্ডার
    else if (message === 'house banao') {
      bot.chat('House building not implemented yet.');
    }
  });

  // ডিসকানেক্ট হলে রিকনেক্ট
  bot.on('end', () => {
    console.log('❌ Bot disconnected – retrying in 10s');
    bot = null;
    setTimeout(createBot, 10000);
  });

  bot.on('error', err => {
    console.log('⚠️ Bot error:', err.message, '– retrying in 10s');
    bot = null;
    setTimeout(createBot, 10000);
  });
}

// র‍্যান্ডম হাঁটা লজিক
function startWalking() {
  const directions = ['forward', 'back', 'left', 'right'];
  let current = null;
  setInterval(() => {
    if (!bot || !bot.entity) return;
    if (current) bot.setControlState(current, false);
    current = directions[Math.floor(Math.random() * directions.length)];
    bot.setControlState(current, true);
    setTimeout(() => bot.setControlState(current, false), 2000);
  }, 4000);
}

// শুরু করো
createBot();
