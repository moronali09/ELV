module.exports = {
  name: 'koi',
  execute(bot, user) {
    const { x, y, z } = bot.entity.position;
    bot.chat(`koi: X:${x.toFixed(1)}, Y:${y.toFixed(1)}, Z:${z.toFixed(1)}`);
  }
};
