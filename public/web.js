<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minecraft Bot Dashboard</title>
  <style>
    body { font-family: sans-serif; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1rem; }
    section { border: 1px solid #ccc; padding: 0.5rem; height: 90vh; overflow-y: auto; }
    h2 { margin: 0 0 0.5rem; }
    .status { font-weight: bold; }
  </style>
</head>
<body>
  <section id="status">
    <h2>Status</h2>
    <div class="status">Ping: <span id="ping">-</span>ms | Players: <span id="count">-</span></div>
  </section>
  <section id="players">
    <h2>Join/Leave</h2><ul id="plogs"></ul>
  </section>
  <section id="server-chat">
    <h2>Server Chat</h2><div id="slogs"></div>
  </section>
  <section id="console">
    <h2>Bot Console</h2><div id="clogs"></div>
  </section>
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    socket.on('status', data => {
      document.getElementById('ping').textContent = data.ping;
      document.getElementById('count').textContent = data.count;
    });
    socket.on('playerJoined', u => {
      const li = document.createElement('li'); li.textContent = u + ' joined';
      document.getElementById('plogs').appendChild(li);
    });
    socket.on('playerLeft', u => {
      const li = document.createElement('li'); li.textContent = u + ' left';
      document.getElementById('plogs').appendChild(li);
    });
    socket.on('serverChat', msg => {
      const d = document.createElement('div'); d.textContent = msg;
      document.getElementById('slogs').appendChild(d);
    });
    socket.on('console', msg => {
      const d = document.createElement('div'); d.textContent = msg;
      document.getElementById('clogs').appendChild(d);
    });
  </script>
</body>
</html>
