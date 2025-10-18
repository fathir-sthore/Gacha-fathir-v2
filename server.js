const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (WAJIB untuk Railway)
app.get('/', (req, res) => {
  res.json({
    status: 'Bot Gacha Premium - RAILWAY',
    timestamp: new Date().toLocaleString('id-ID'),
    platform: 'Railway',
    uptime: process.uptime(),
    memory: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB',
    node_version: process.version
  });
});

// Health check untuk Railway
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    environment: process.env.NODE_ENV || 'production'
  });
});

// Bot status endpoint
app.get('/status', async (req, res) => {
  try {
    const dataDir = path.join(__dirname, 'data');
    
    let usersCount = 0;
    let itemsCount = 0;
    
    if (fs.existsSync(path.join(dataDir, 'users.json'))) {
      const users = await fs.readJson(path.join(dataDir, 'users.json'));
      usersCount = users.length;
    }
    
    if (fs.existsSync(path.join(dataDir, 'items.json'))) {
      const items = await fs.readJson(path.join(dataDir, 'items.json'));
      itemsCount = items.length;
    }
    
    res.json({
      users: usersCount,
      items: itemsCount,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: 'Railway'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Railway URL: ${process.env.RAILWAY_STATIC_URL || 'https://your-app.railway.app'}`);
  
  // Start bot setelah server ready
  startBot();
});

// Import dan start bot
function startBot() {
  try {
    console.log('🤖 Starting Telegram Bot...');
    
    // Pastikan BOT_TOKEN ada
    if (!process.env.BOT_TOKEN) {
      console.error('❌ BOT_TOKEN is required!');
      return;
    }
    
    // Import bot logic
    const bot = require('./bot.js');
    console.log('✅ Bot started successfully on Railway!');
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});