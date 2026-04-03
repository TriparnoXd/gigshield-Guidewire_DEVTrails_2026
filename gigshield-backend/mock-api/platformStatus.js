const express = require('express');
const app = express();

// Toggle this manually to simulate an outage during demo
let isDown = false;
let downtimeSince = null;

app.get('/mock/platform-status', (req, res) => {
  res.json({
    platform: 'zepto',
    status: isDown ? 'down' : 'up',
    since: isDown ? downtimeSince : null,
    message: isDown ? 'Platform outage detected' : 'All systems operational'
  });
});

// Admin endpoint to toggle outage — use this during demo
app.post('/mock/trigger-outage', (req, res) => {
  isDown = true;
  downtimeSince = new Date().toISOString();
  res.json({ message: 'Outage triggered', since: downtimeSince });
});

app.post('/mock/resolve-outage', (req, res) => {
  isDown = false;
  downtimeSince = null;
  res.json({ message: 'Outage resolved' });
});

const PORT = process.env.MOCK_PORT || 3001;
app.listen(PORT, () => console.log(`Mock API running on port ${PORT}`));
