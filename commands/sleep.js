module.exports = {
  name: 'sleep',
  execute(bot) {
    const time = bot.time.timeOfDay;
    if (time < 13000 || time > 23000) {
      bot.chat('🛏️ Its not night yet.');
      return;
    }
    if (!bot.homePosition) {
      bot.chat('Home not set. Use /sethome first.');
      return;
    }
    const { x, y, z } = bot.homePosition;
    bot.chat(`↩️ Heading home to sleep at X:${x.toFixed(0)}, Y:${y.toFixed(0)}, Z:${z.toFixed(0)}`);
    bot.pathfinder.setGoal(new (require('mineflayer-pathfinder').goals.GoalBlock)(x, y, z), true);
    bot.once('goal_reached', async () => {
      const bed = bot.findBlock({ matching: block => block.name.includes('bed'), maxDistance: 5 });
      if (!bed) {
        bot.chat('No bed found nearby.');
        return;
      }
      try {
        await bot.sleep(bed.position);
        bot.chat('😴 Good night!');
      } catch (err) {
        bot.chat('Failed to sleep.');
      }
    });
  }
};
