const { createBot } = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const Vec3 = require('vec3');

const config = {
  host: 'tensionlage.aternos.me',
  port: 63085,
  username: 'ELV',
  version: '1.21.1',
  password: 'elvmoronby',
};

const missions = [
  { type: 'goto', position: Vec3(10, 65, -5) },
  { type: 'collect', item: 'oak_log', count: 5 },
  { type: 'fight', mob: 'zombie', count: 3 },
];

function getRandomMission() {
  return missions[Math.floor(Math.random() * missions.length)];
}

async function moveTo(bot, position, timeout = 30000) {
  bot.pathfinder.setMovements(new Movements(bot));
  const goal = new goals.GoalBlock(position.x, position.y, position.z);
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        bot.pathfinder.stop();
        console.log(`⚠️ moveTo timeout after ${timeout}ms`);
        done = true;
        resolve(false);
      }
    }, timeout);
    bot.pathfinder.goto(goal, (err) => {
      if (done) return;
      clearTimeout(timer);
      if (err) console.log(`❌ Path error: ${err.message}`);
      else console.log(`✅ Arrived at ${position.x},${position.y},${position.z}`);
      done = true;
      resolve(!err);
    });
  });
}

async function collectItems(bot, item, count) {
  console.log(`🪓 Collecting ${count} ${item}`);
  let gathered = 0;
  while (gathered < count) {
    const block = bot.findBlock({ matching: b => b.name.includes(item), maxDistance: 64 });
    if (!block) {
      console.log(`🔍 Searching for ${item}`);
      await moveTo(bot, bot.entity.position.offset(5, 0, 5));
      continue;
    }
    const ok = await moveTo(bot, block.position);
    if (!ok) break;
    await bot.dig(block);
    gathered++;
    console.log(`🪓 Gathered ${gathered}/${count}`);
  }
}

async function fightMob(bot, mobName, count) {
  console.log(`⚔️ Fighting ${count} ${mobName}`);
  for (let i = 0; i < count; i++) {
    const mob = bot.nearestEntity(e => e.name === mobName);
    if (!mob) {
      console.log(`🔍 No ${mobName} found`);
      await moveTo(bot, bot.entity.position.offset(5, 0, 5));
      continue;
    }
    await bot.pvp.attack(mob);
    console.log(`⚔️ Defeated ${i + 1}/${count}`);
  }
}

async function executeMission(bot, mission) {
  switch (mission.type) {
    case 'goto':
      await moveTo(bot, mission.position);
      break;
    case 'collect':
      await collectItems(bot, mission.item, mission.count);
      break;
    case 'fight':
      await fightMob(bot, mission.mob, mission.count);
      break;
  }
}

function startBot() {
  const bot = createBot(config);
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.on('login', () => console.log('🔌 Logged in'));  
  bot.on('spawn', () => {
    console.log('🎮 Spawned');
    if (config.password) {
      bot.chat(`/login ${config.password}`);
      console.log('🔑 Logging in');
    }
    nextMission();
  });

  bot.on('chat', (username, message) => console.log(`[CHAT] <${username}> ${message}`));
  bot.on('whisper', (username, message) => console.log(`[WHISPER] <${username}> ${message}`));

  bot.on('error', err => console.log('❌ Error:', err.message));
  bot.on('end', () => {
    console.log('🔌 Disconnected, reconnecting in 5s...');
    setTimeout(startBot, 5000);
  });

  async function nextMission() {
    const mission = getRandomMission();
    console.log(`🎯 New mission: ${JSON.stringify(mission)}`);
    bot.chat(`Mission: ${mission.type}`);
    await executeMission(bot, mission);
    console.log('🏁 Mission done');
    nextMission();
  }
}

startBot();
      
