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

// Predefined missions
const missions = [
  'collect 10 oak logs',
  'fight 5 zombies',
  'go to 0 64 0',
  'mine 5 diamonds',
  'build a small shelter',
];

function getRandomMission() {
  return missions[Math.floor(Math.random() * missions.length)];
}

function parseMission(step) {
  const collectMatch = step.match(/collect (\d+) (\w+)/i);
  if (collectMatch) {
    return { type: 'collect', item: collectMatch[2], count: Number(collectMatch[1]) };
  }

  const fightMatch = step.match(/fight (\d+) (\w+)/i);
  if (fightMatch) {
    return { type: 'fight', mob: fightMatch[2], count: Number(fightMatch[1]) };
  }

  const gotoMatch = step.match(/go to ([-\d]+) (\d+) ([-\d]+)/i);
  if (gotoMatch) {
    return { type: 'goto', position: Vec3(Number(gotoMatch[1]), Number(gotoMatch[2]), Number(gotoMatch[3])) };
  }

  return { type: 'chat', message: step };
}

async function performTask(bot, task) {
  switch (task.type) {
    case 'collect':
      await collectItems(bot, task.item, task.count);
      break;
    case 'fight':
      await fightMob(bot, task.mob, task.count);
      break;
    case 'goto':
      await moveTo(bot, task.position);
      break;
    case 'chat':
      bot.chat(task.message);
      break;
  }
}

async function moveTo(bot, position) {
  bot.pathfinder.setMovements(new Movements(bot));
  await bot.pathfinder.goto(new goals.GoalBlock(position.x, position.y, position.z));
  console.log(`✅ Arrived at ${position.x},${position.y},${position.z}`);
}

async function collectItems(bot, item, count) {
  console.log(`🪓 Collecting ${count} ${item}`);
  let gathered = 0;
  while (gathered < count) {
    const block = bot.findBlock({ matching: b => b.name.includes(item), maxDistance: 64 });
    if (!block) {
      await wander(bot);
      continue;
    }
    await moveTo(bot, block.position);
    await bot.dig(block);
    gathered++;
    console.log(`🪓 Gathered ${gathered}/${count} ${item}`);
  }
}

async function fightMob(bot, mobName, count) {
  console.log(`⚔️ Fighting ${count} ${mobName}`);
  let defeated = 0;
  while (defeated < count) {
    const mob = bot.nearestEntity(e => e.name === mobName);
    if (!mob) {
      await wander(bot);
      continue;
    }
    await bot.pvp.attack(mob);
    defeated++;
    console.log(`⚔️ Defeated ${defeated}/${count} ${mobName}`);
  }
}

async function wander(bot) {
  const { x, y, z } = bot.entity.position.offset(10, 0, 0);
  return moveTo(bot, Vec3(x, y, z));
}

async function startBot() {
  const bot = createBot(config);
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.on('login', () => console.log(`🔌 Logged in as ${config.username}`));
  bot.on('spawn', async () => {
    if (config.password) {
      bot.chat(`/login ${config.password}`);
      console.log('🔑 Logging in');
    }
    const mission = getRandomMission();
    console.log(`🎯 Mission: ${mission}`);
    bot.chat(`Mission: ${mission}`);
    const task = parseMission(mission);
    await performTask(bot, task);
    console.log('🏁 Mission complete');
    bot.quit();
  });

  bot.on('error', err => console.log('❌ Error:', err.message));
  bot.on('end', () => console.log('🔌 Disconnected'));
}

startBot();
        
