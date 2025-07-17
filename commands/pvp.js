let enabled = false;

module.exports = {
  name: 'pvp',
  execute(bot) {
    enabled = !enabled;
    bot.chat(`⚔️ PvP mode ${enabled ? 'ON' : 'OFF'}`);
    
    if (!enabled) return;

    const mcData = require('minecraft-data')(bot.version);
    const { goals } = require('mineflayer-pathfinder');

    bot.on('physicsTick', function pvpLogic() {
      if (!enabled) return bot.removeListener('physicsTick', pvpLogic);

      const target = Object.values(bot.entities)
        .filter(e => ['Zombie', 'Skeleton', 'Creeper', 'Spider'].includes(e.mobType))
        .sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0];

      if (target) {
        bot.pathfinder.setGoal(new goals.GoalFollow(target, 1), true);
        if (bot.entity.position.distanceTo(target.position) < 3) {
          const weapon = bot.inventory.items().find(i =>
            ['sword', 'axe'].some(type => mcData.itemsById[i.type].name.includes(type))
          );
          if (weapon) bot.equip(weapon, 'hand');
          bot.attack(target);
        }
      }
    });
  }
};
