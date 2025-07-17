module.exports = {
  name: 'autoloot',
  execute(bot) {
    const mcData = require('minecraft-data')(bot.version);
    bot.on('itemDrop', async (entity) => {
      const itemName = mcData.itemsById[entity.itemStack.type].name;
      const useful = ['sword','axe','pickaxe','bow','food'].some(k => itemName.includes(k));
      try {
        await bot.collectBlock.collect(entity);
      } catch {}
      if (!useful) {
        await bot.toss(entity.itemStack.type, null, entity.itemStack.metadata, entity.itemStack.count);
      }
    });
    bot.chat('🗡️ Auto-loot activated');
  }
};
