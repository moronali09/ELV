const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'sethome',
  execute(bot) {
    const home = bot.entity.position;
    const data = {
      x: home.x,
      y: home.y,
      z: home.z
    };
    const filePath = path.join(__dirname, '..', 'save', 'home.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    bot.chat(`🏡 Home saved at (${home.x.toFixed(1)}, ${home.y.toFixed(1)}, ${home.z.toFixed(1)})`);
  }
};
