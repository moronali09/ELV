module.exports = {
  name: 'eat',
  execute(bot) {
    const mcData = require('minecraft-data')(bot.version);
    const foodIds = mcData.foods.map(f => f.id);
    const items = bot.inventory.items().filter(i => foodIds.includes(i.type));
    if (!items.length) return bot.chat('No food to eat.');
    (async () => {
      for (const item of items) {
        try {
          await bot.equip(item, 'hand');
          await bot.activateItem();
          await bot.waitForTicks(30);
        } catch (_) {}
      }
      bot.chat('All food consumed!');
    })();
  }
};
