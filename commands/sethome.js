module.exports = {
  name: 'sethome',
  execute(bot) {
    bot.homePosition = bot.entity.position.clone();
    const { x, y, z } = bot.homePosition;
    bot.chat(`Home set at X:${x.toFixed(1)}, Y:${y.toFixed(1)}, Z:${z.toFixed(1)}`);
  }
};
