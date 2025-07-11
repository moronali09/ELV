module.exports = {
  logJoin: (username) => {
    console.log(`[32mJoined:[0m ${username}`);
  },
  logLeave: (username) => {
    console.log(`[31mLeft:  [0m ${username}`);
  }
};
