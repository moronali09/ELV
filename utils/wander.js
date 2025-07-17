module.exports = function wander(bot) {
  function randomMove() {
    const x = bot.entity.position.x + Math.floor(Math.random() * 10 - 5);
    const y = bot.entity.position.y;
    const z = bot.entity.position.z + Math.floor(Math.random() * 10 - 5);
    const pos = new Vec3(x, y, z);

    bot.pathfinder.setGoal(null);
    bot.pathfinder.setGoal(new bot.pathfinder.goals.GoalBlock(pos.x, pos.y, pos.z));
  }

  setInterval(() => {
    if (bot.entity && bot.health > 0) {
      randomMove();
    }
  }, 8000);
};
