const { goals } = require('mineflayer-pathfinder');
module.exports = {
  name: 'pvp',
  execute(bot) {
    bot.chat('⚔️ PvP mode ON');
    bot.on('physicsTick', () => {
      const target = Object.values(bot.entities)
        .filter(e => ['Zombie','Skeleton','Creeper','Spider'].includes(e.mobType))
        .sort((a,b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0];
      if (target) {
        bot.pathfinder.setGoal(new goals.GoalFollow(target, 1), true);
        if (bot.entity.position.distanceTo(target.position) < 3) {
          const weapon = bot.inventory.items().find(i => ['diamond_sword','iron_sword','stone_sword']
            .includes(mcData.itemsById[i.type].name));
          if (weapon) bot.equip(weapon, 'hand');
          bot.attack(target);
        }
      }
    });
  }
};
