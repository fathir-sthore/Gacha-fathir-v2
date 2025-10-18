const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

// Config dari Environment Variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS ? JSON.parse(process.env.ADMIN_IDS) : [];
const CHANNEL_ID = process.env.CHANNEL_ID;
const BOT_USERNAME = process.env.BOT_USERNAME;
const OWNER_USERNAME = process.env.OWNER_USERNAME;
const GACHA_LIMIT = process.env.GACHA_LIMIT || 5;

// Data directory path untuk Railway
const dataDir = path.join(__dirname, 'data');

// Pastikan folder data ada
const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory:', dataDir);
    
    // Initialize empty data files
    const initialFiles = {
      'users.json': [],
      'items.json': [],
      'chats.json': [],
      'blacklist.json': [],
      'gacha_codes.json': [],
      'referrals.json': [],
      'codes.json': [],
      'musik.json': [],
      'coin_transactions.json': [],
      'redeem.json' []
    };
    
    Object.entries(initialFiles).forEach(([filename, data]) => {
      const filePath = path.join(dataDir, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeJsonSync(filePath, data, { spaces: 2 });
        console.log(`📄 Created ${filename}`);
      }
    });
  }
};

// Load data function





// Initialize bot
console.log('🔧 Initializing Telegram Bot...');
ensureDataDir();

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is required! Set it in Railway environment variables.');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { 
  polling: true,
  request: {
    timeout: 30000,
    agentOptions: {
      keepAlive: true,
      family: 4
    }
  }
});

// Safe send message function
const safeSendMessage = async (chatId, text, options = {}) => {
  try {
    return await bot.sendMessage(chatId, text, options);
  } catch (error) {
    if (error.response?.body?.error_code === 403) {
      console.log(`❌ User ${chatId} blocked the bot`);
    } else {
      console.error(`❌ Send message error to ${chatId}:`, error.message);
    }
    return null;
  }
};

// === TEMPATKAN SEMUA BOT HANDLERS DI SINI ===

// Start command



// Help command

// ... TEMPATKAN SEMUA COMMAND LAINNYA DI SINI ...



// ... (Bagian setup data directory) ...
/* 💡 VARIABEL BARU UNTUK COIN SYSTEM
let coinTransactions = loadData('coin_transactions.json') || [];
*/
// --- Inisialisasi Bot ---
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true }); // INI HARUS ADA

const loadData = (file) => {
  try {
    const filePath = path.join(dataDir, file);
    // Cek jika file baru, inisialisasi dengan array kosong
    if (!fs.existsSync(filePath)) {
      if (file === 'codes.json' || file === 'blacklist.json' || file === 'users.json' || file === 'chats.json' || file === 'musik.json' || file === 'coin_transactions.json') {
         return [];
      } else {
         return [];
      }
    }
    return fs.readJsonSync(filePath);
  } catch (e) {
    console.error(`[LOAD DATA ERROR] Gagal membaca ${file}: ${e.message}`);
    // Return array kosong untuk file yang seharusnya berisi array
    return [];
  }
};

const saveData = (file, data) => {
  try {
    fs.writeJsonSync(path.join(dataDir, file), data, { spaces: 2 });
  } catch (e) {
    console.error(`[SAVE DATA ERROR] Gagal menulis ke ${file}: ${e.message}`);
  }
};

const cooldown = new Map();
const COOLDOWN_TIME = 40000;
const welcomeAudio = path.join(__dirname, 'BotGachaPremium.mp3');

// --- Inisialisasi Admin di Memori ---
// ⚠️ ADMIN_IDS dari config.js hanya dimuat saat bot start. Tidak disarankan diubah live.
let ADMIN_IDS = config.ADMIN_IDS || []; 

// 💡 VARIABEL BARU UNTUK KODE REDEEM
let codes = loadData('codes.json');
const EXPIRATION_MINUTES = 60; // Default 60 menit

// --- Helper Subscription Check ---
async function isUserSubscribed(userId) {
  if (!config.CHANNEL_ID) return true; // Lewati jika CHANNEL_ID tidak diset
  try {
    const m = await bot.getChatMember(config.CHANNEL_ID, userId);
    return ['member', 'administrator', 'creator'].includes(m.status);
  } catch (e) {
    // 400 Bad Request (user not in chat) atau 403 Forbidden (bot tidak diizinkan di channel)
    return false;
  }
}

// === Safe Send Message (versi aman dengan rate limit handling) ===
async function safeSendMessage(chatId, text, options = {}) {
  try {
    const sent = await bot.sendMessage(chatId, text, options);
    return sent;
  } catch (err) {
    if (err.response && err.response.statusCode === 429) {
      const retryAfter = (err.response.parameters?.retry_after || 1) * 1000;
      console.log(chalk.yellow(`⚠️ Rate limit hit. Retry after ${retryAfter}ms for ${chatId}`));
      await new Promise(r => setTimeout(r, retryAfter));
      return await safeSendMessage(chatId, text, options); // Rekursif
    } else if (err.response?.body?.error_code === 403 && /bot was blocked/i.test(err.message)) {
      console.log(chalk.red(`❌ User ${chatId} blokir bot, dilewati.`));
    } else {
      console.error(chalk.red(`❌ Gagal kirim pesan ke ${chatId}:`), err.message);
    }
    return null;
  }
}

// === Fungsi Handle Delete Musik ===
async function handleDeleteMusik(query, musikId) {
  const adminId = query.from.id;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  let musik = loadData("musik.json");
  const index = musik.findIndex(m => m.id === musikId);

  if (index === -1) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Musik tidak ditemukan', show_alert: true });
    return;
  }

  const deletedMusik = musik[index];
  
  // Hapus file fisik
  const filePath = path.join(dataDir, deletedMusik.filename);
  let fileDeleted = false;
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      fileDeleted = true;
      console.log(chalk.yellow(`🗑 File musik dihapus: ${deletedMusik.filename}`));
    } catch (err) {
      console.error("⚠️ Gagal hapus file musik:", err.message);
    }
  }

  // Hapus dari database
  musik.splice(index, 1);
  saveData("musik.json", musik);

  // Update message konfirmasi
  const resultText = 
    `🗑 *Musik berhasil dihapus!*\n\n` +
    `🎵 Judul: *${deletedMusik.judul}*\n` +
    `🎤 Artist: ${deletedMusik.artist}\n` +
    `🆔 ID: \`${deletedMusik.id}\`\n` +
    `📁 File: ${fileDeleted ? '✅ Dihapus' : '❌ Gagal hapus'}\n` +
    `🎧 Total Diputar: ${deletedMusik.plays || 0}x\n\n` +
    `Musik telah dihapus dari database.`;

  try {
    await bot.editMessageText(resultText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error('Error edit delete confirmation:', err.message);
  }

  await bot.answerCallbackQuery(query.id, { text: '✅ Musik berhasil dihapus!' });

  console.log(chalk.red(`🎵 Musik "${deletedMusik.judul}" dihapus oleh admin ${adminId}`));
}
// ------------------------------------------------------------------
//                             COMMANDS
// ------------------------------------------------------------------

bot.onText(/\/start(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const inviterId = match[1] ? Number(match[1]) : null;
  let users = loadData('users.json');
  const today = new Date().toDateString();
  let isNewUser = false;

  if (msg.chat.type !== 'private') return;
  if (msg.from?.is_bot) return;
  if (String(chatId).startsWith('-100')) return;

  // 💡 Cari user atau buat baru
  let user = users.find(u => u.id === chatId);
  if (!user) {
    user = { 
      id: chatId, 
      gachaToday: 0, 
      bonus: 0, 
      history: [], 
      lastDate: today, 
      extraLimit: 0, 
      redeemedCodes: [],
      coin: 0
    };
    users.push(user);
    isNewUser = true;
  }
  
  // 💡 INIT coin jika belum ada
  if (typeof user.coin !== 'number') user.coin = 0;

  // Reset harian jika beda tanggal
  if (user.lastDate !== today) {
    user.gachaToday = 0;
    user.extraLimit = 0;
    user.lastDate = today;
  }

  // --- Referral Logic ---
  if (inviterId && inviterId !== chatId) {
    const refs = loadData('referrals.json');
    let coinTransactions = loadData('coin_transactions.json');
    
    if (!refs.find(r => r.invited === chatId)) {
      refs.push({ inviter: inviterId, invited: chatId, date: new Date() });
      saveData('referrals.json', refs);

      let inviter = users.find(u => u.id === inviterId);
      if (inviter) {
        inviter.bonus = (Number(inviter.bonus) || 0) + 1;
        inviter.coin = (Number(inviter.coin) || 0) + 88;
        
        coinTransactions.push({
          userId: inviterId,
          type: 'referral_bonus',
          amount: 88,
          description: `Bonus referral: User ${chatId} bergabung`,
          date: new Date(),
          invitedUser: chatId
        });
        saveData('coin_transactions.json', coinTransactions);
        
      } else {
        users.push({ 
          id: inviterId, 
          gachaToday: 0, 
          bonus: 1, 
          history: [], 
          lastDate: today, 
          extraLimit: 0, 
          redeemedCodes: [],
          coin: 88
        });
      }

      await safeSendMessage(inviterId,
        `✨ 𝗕𝗢𝗡𝗨𝗦 𝗥𝗘𝗙𝗘𝗥𝗥𝗔𝗟 ✨

🎁 𝗧𝗲𝗺𝗮𝗻 𝗯𝗮𝗿𝘂 𝘁𝗲𝗹𝗮𝗵 𝗯𝗲𝗿𝗴𝗮𝗯𝘂𝗻𝗴 𝗹𝗲𝘄𝗮𝘁 𝗹𝗶𝗻𝗸 𝗿𝗲𝗳𝗲𝗿𝗿𝗮𝗹𝗺𝘂!
🪄 𝗕𝗼𝗻𝘂𝘀 𝟭𝘅 𝗚𝗮𝗰𝗵𝗮 𝘁𝗲𝗹𝗮𝗵 𝗱𝗶𝘁𝗮𝗺𝗯𝗮𝗵𝗸𝗮𝗻 𝗸𝗲 𝗮𝗸𝘂𝗻𝗺𝘂
💰 𝗕𝗼𝗻𝘂𝘀 𝟴𝟴 𝗖𝗼𝗶𝗻 𝘁𝗲𝗹𝗮𝗵 𝗱𝗶𝘁𝗮𝗺𝗯𝗮𝗵𝗸𝗮𝗻 𝗸𝗲 𝘀𝗮𝗹𝗱𝗼𝗺𝘂!

🪙 𝗧𝗼𝘁𝗮𝗹 𝗰𝗼𝗶𝗻 𝗸𝗮𝗺𝘂 𝘀𝗲𝗸𝗮𝗿𝗮𝗻𝗴: ${inviter ? inviter.coin : 88}
🛍️ 𝗚𝘂𝗻𝗮𝗸𝗮𝗻 𝗰𝗼𝗶𝗻 𝘂𝗻𝘁𝘂𝗸 𝗯𝗲𝗹𝗶 𝗹𝗶𝗺𝗶𝘁 𝗱𝗶 /toko

💎 𝗦𝗲𝗺𝗮𝗸𝗶𝗻 𝗯𝗮𝗻𝘆𝗮𝗸 𝘁𝗲𝗺𝗮𝗻 𝘆𝗮𝗻𝗴 𝗯𝗲𝗿𝗴𝗮𝗯𝘂𝗻𝗴, 𝘀𝗲𝗺𝗮𝗸𝗶𝗻 𝘁𝗶𝗻𝗴𝗴𝗶 𝗵𝗮𝗱𝗶𝗮𝗵 𝗲𝗸𝘀𝗸𝗹𝘂𝘀𝗶𝗳𝗺𝘂!
🌟 𝗡𝗶𝗸𝗺𝗮𝘁𝗶 𝗸𝗲𝗶𝘀𝘁𝗶𝗺𝗲𝘄𝗮𝗮𝗻𝗺𝘂 𝘀𝗲𝗯𝗮𝗴𝗮𝗶 𝗺𝗲𝗺𝗯𝗲𝗿 𝗽𝗿𝗲𝗺𝗶𝘂𝗺.`);
    }
  }

  // --- New User Notification (Admin) ---
  if (isNewUser) {
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
    const totalUsers = users.length.toLocaleString("id-ID");
    const joinTime = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    for (const adminId of ADMIN_IDS) {
      await safeSendMessage(
        adminId,
        `💠 𝗨𝘀𝗲𝗿 𝗕𝗮𝗿𝘂 𝗕𝗲𝗿𝗴𝗮𝗯𝘂𝗻𝗴!
━━━━━━━━━━━━━━━━━━━
👤 𝗡𝗮𝗺𝗮: ${msg.from.first_name}
🏷️ 𝗨𝘀𝗲𝗿𝗻𝗮𝗺𝗲: ${msg.from.username ? `@${msg.from.username}` : "—"}
🆔 𝗨𝘀𝗲𝗿 𝗜𝗗: \`${chatId}\`
⏰ 𝗪𝗮𝗸𝘁𝘂: ${joinTime}
━━━━━━━━━━━━━━━━━━━
📊 𝗧𝗼𝘁𝗮𝗹 𝗣𝗲𝗻𝗴𝗴𝘂𝗻𝗮 𝗦𝗲𝗸𝗮𝗿𝗮𝗻𝗴: ${totalUsers} user
━━━━━━━━━━━━━━━━━━━
🚀 𝗣𝗮𝗻𝘁𝗮𝘂 𝗽𝗲𝗿𝘁𝘂𝗺𝗯𝘂𝗵𝗮𝗻 𝗸𝗼𝗺𝘂𝗻𝗶𝘁𝗮𝘀 𝗽𝗿𝗲𝗺𝗶𝘂𝗺𝗺𝘂 𝘀𝗲𝗰𝗮𝗿𝗮 𝗿𝗲𝗮𝗹-𝘁𝗶𝗺𝗲!`,
        { parse_mode: "Markdown" }
      );
    }
  }

  saveData('users.json', users);

  // === Prepare Welcome Message Data ===
  const totalLimit = config.GACHA_LIMIT || 5;
  const sisaLimit = Math.max(totalLimit - user.gachaToday, 0);
  const usedBonus = Math.max(user.gachaToday - totalLimit, 0);
  const sisaBonus = Math.max(user.bonus - usedBonus, 0);
  const userCoin = user.coin || 0;
  const chats = loadData('chats.json');
  const totalUsers = users.length;
  const totalGrups = chats.length;

  const banner = 'https://files.catbox.moe/67gmyo.jpg';
  const caption = `
𝗦𝗲𝗹𝗮𝗺𝗮𝘁 𝗱𝗮𝘁𝗮𝗻𝗴 𝗱𝗶 𝗕𝗼𝘁 𝗚𝗮𝗰𝗵𝗮 𝗣𝗿𝗲𝗺𝗶𝘂𝗺

𝗔𝘂𝘁𝗵𝗼𝗿: @Daxyinz
𝗩𝗲𝗿𝘀𝗶 𝗕𝗼𝘁: 𝟮.𝟬

𝗦𝘁𝗮𝘁𝘂𝘀 𝗔𝗸𝘂𝗻:
├ 𝗟𝗶𝗺𝗶𝘁 𝗚𝗮𝗰𝗵𝗮: ${sisaLimit}
├ 𝗕𝗼𝗻𝘂𝘀: ${sisaBonus}
├ 𝗖𝗼𝗶𝗻: ${userCoin} 🪙
├ 𝗣𝗲𝗻𝗴𝗴𝘂𝗻𝗮 𝗕𝗼𝘁: ${totalUsers}
└ 𝗧𝗼𝘁𝗮𝗹 𝗚𝗿𝘂𝗽: ${totalGrups}

𝗙𝗶𝘁𝘂𝗿 𝗨𝘁𝗮𝗺𝗮:
├ /gacha - Main gacha random
├ /history - Cek history gacha
├ /listitem - Daftar item gacha
├ /redeem - Redeem code tambah limit
├ /mystat - Info akun kamu
├ /toko - Beli limit dengan coin
├ /leaderboard - Top player gacha
├ /cekid - Cek ID Telegram
├ /ping - Cek status server

𝗞𝗲𝗲𝗻𝘁𝘂𝗻𝗴𝗮𝗻:
• Invite teman → 𝟭𝘅 𝗚𝗮𝗰𝗵𝗮 + 𝟴𝟴 𝗖𝗼𝗶𝗻
• Add bot ke grup → 𝟮𝘅 𝗚𝗮𝗰𝗵𝗮 + 𝟲𝟱 𝗖𝗼𝗶𝗻

𝗚𝘂𝗻𝗮𝗸𝗮𝗻 𝗯𝗼𝘁 𝘀𝗲𝗰𝗮𝗿𝗮 𝗯𝗲𝗿𝘀𝗮𝗺𝗮-𝘀𝗮𝗺𝗮 𝗱𝗮𝗻 𝗿𝗮𝗶𝗵 𝗵𝗮𝗱𝗶𝗮𝗵𝗻𝘆𝗮! 🎉
`;

  const keyboard = [
    [
      { text: "𝗜𝗻𝘃𝗶𝘁𝗲 𝗧𝗲𝗺𝗮𝗻", callback_data: "undang_teman" },
      { text: "𝗔𝗱𝗱 𝗕𝗼𝘁 𝗸𝗲 𝗚𝗿𝘂𝗽", url: `https://t.me/${config.BOT_USERNAME}?startgroup=true` }
    ],
    [
      { text: "𝗖𝗵𝗮𝗻𝗻𝗲𝗹", url: `https://t.me/${config.CHANNEL_ID.replace('@', '')}` }
    ],
    [
      { text: "🎵 𝗥𝗮𝗻𝗱𝗼𝗺 𝗠𝘂𝘀𝗶𝗸", callback_data: "random_musik" },
      { text: "🛍️ 𝗧𝗼𝗸𝗼", callback_data: "toko_menu" }
    ],
    [
      { text: "👑 𝗢𝘄𝗻𝗲𝗿 𝗠𝗲𝗻𝘂", callback_data: "owner_menu" },
      { text: "👨‍💻 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿", url: `https://t.me/${config.OWNER_USERNAME}` }
    ]
  ];

  await bot.sendPhoto(chatId, banner, {
    caption,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  }).catch(e => console.error("Gagal kirim foto welcome:", e.message));

  if (fs.existsSync(welcomeAudio)) {
    await bot.sendAudio(chatId, welcomeAudio, { caption: "🎧 𝗪𝗲𝗹𝗰𝗼𝗺𝗲 𝗸𝗲 𝗕𝗼𝘁 𝗚𝗮𝗰𝗵𝗮 𝗣𝗿𝗲𝗺𝗶𝘂𝗺!" }).catch(e => console.error("Gagal kirim audio welcome:", e.message));
  }
});

// === CALLBACK HANDLER ===
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const isAdmin = ADMIN_IDS.includes(query.from.id);

  if (query.data === 'owner_menu') {
    if (!isAdmin) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ 𝗞𝗮𝗺𝘂 𝘁𝗶𝗱𝗮𝗸 𝗺𝗲𝗺𝗶𝗹𝗶𝗸𝗶 𝗮𝗸𝘀𝗲𝘀 𝗸𝗲 𝗢𝘄𝗻𝗲𝗿 𝗠𝗲𝗻𝘂', show_alert: true });
      return;
    }

    const users = loadData('users.json');
    const chats = loadData('chats.json');

    const user = users.find(u => u.id === query.from.id) || {};

    const totalLimit = config.GACHA_LIMIT || 5;
    const sisaLimit = Math.max(totalLimit - (user.gachaToday || 0), 0);
    const sisaBonus = user.bonus || 0;
    const totalUsers = users.length || 0;
    const totalGrups = chats.length || 0;

    const ownerCaption = `
𝗢𝘄𝗻𝗲𝗿 𝗠𝗲𝗻𝘂 - 𝗕𝗼𝘁 𝗚𝗮𝗰𝗵𝗮 𝗣𝗿𝗲𝗺𝗶𝘂𝗺

𝗔𝘂𝘁𝗵𝗼𝗿: @Daxyinz
𝗦𝘁𝗮𝘁𝘂𝘀 𝗦𝗲𝗿𝘃𝗲𝗿:
├ 𝗟𝗶𝗺𝗶𝘁 𝗚𝗮𝗰𝗵𝗮: ${sisaLimit}
├ 𝗕𝗼𝗻𝘂𝘀: ${sisaBonus}
├ 𝗣𝗲𝗻𝗴𝗴𝘂𝗻𝗮 𝗕𝗼𝘁: ${totalUsers}
└ 𝗧𝗼𝘁𝗮𝗹 𝗚𝗿𝘂𝗽: ${totalGrups}

𝗔𝗱𝗺𝗶𝗻 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀:
├ /addlimit - Tambah limit user
├ /hapuslimit - Hapus limit bonus
├ /addlimitall - Bonus massal
├ /createcode - Buat redeem code
├ /additem - Tambah item gacha
├ /delitem - Hapus item gacha
├ /clearitems - Hapus semua item
├ /backup - Backup data
├ /blacklist - Blacklist user
├ /delblacklist - Hapus blacklist
├ /listblacklist - List blacklist
├ /listadmin - List all admin
├ /bcgrub - Broadcast ke grup
├ /broadcast - Pengumuman user
├ /checkstat - Cek aktivitas user

𝗚𝘂𝗻𝗮𝗸𝗮𝗻 𝗱𝗲𝗻𝗴𝗮𝗻 𝗯𝗶𝗷𝗮𝗸 𝗱𝗮𝗻 𝗿𝗲𝘀𝗽𝗼𝗻𝘀𝗶𝗯𝗲𝗹! 👑
`;

    const ownerKeyboard = [
      [{ text: "𝗞𝗲𝗺𝗯𝗮𝗹𝗶", callback_data: "main_menu" }]
    ];

    await bot.editMessageCaption(ownerCaption, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: ownerKeyboard }
    }).catch(e => console.error("Gagal edit owner menu:", e.message));

  } else if (query.data === 'main_menu') {
    const users = loadData('users.json');
    const user = users.find(u => u.id === chatId) || { gachaToday: 0, bonus: 0 };
    const chats = loadData('chats.json');
    const totalUsers = users.length;
    const totalGrups = chats.length;
    const totalLimit = config.GACHA_LIMIT || 5;
    const sisaLimit = Math.max(totalLimit - user.gachaToday, 0);
    const usedBonus = Math.max(user.gachaToday - totalLimit, 0);
    const sisaBonus = Math.max(user.bonus - usedBonus, 0);

    const banner = 'https://files.catbox.moe/67gmyo.jpg';
    const caption = `
𝗦𝗲𝗹𝗮𝗺𝗮𝘁 𝗱𝗮𝘁𝗮𝗻𝗴 𝗱𝗶 𝗕𝗼𝘁 𝗚𝗮𝗰𝗵𝗮 𝗣𝗿𝗲𝗺𝗶𝘂𝗺

𝗔𝘂𝘁𝗵𝗼𝗿: @Daxyinz

𝗦𝘁𝗮𝘁𝘂𝘀 𝗔𝗸𝘂𝗻:
├ 𝗟𝗶𝗺𝗶𝘁 𝗚𝗮𝗰𝗵𝗮: ${sisaLimit}
├ 𝗕𝗼𝗻𝘂𝘀: ${sisaBonus}
├ 𝗣𝗲𝗻𝗴𝗴𝘂𝗻𝗮 𝗕𝗼𝘁: ${totalUsers}
└ 𝗧𝗼𝘁𝗮𝗹 𝗚𝗿𝘂𝗽: ${totalGrups}

𝗙𝗶𝘁𝘂𝗿 𝗨𝘁𝗮𝗺𝗮:
├ /gacha - Main gacha random
├ /history - Cek history gacha
├ /listitem - Daftar item gacha
├ /redeem - Redeem code
├ /mystat - Info akun kamu
├ /leaderboard - Top player

𝗞𝗲𝗲𝗻𝘁𝘂𝗻𝗴𝗮𝗻:
• Invite teman → 𝟭𝘅 𝗚𝗮𝗰𝗵𝗮
• Add bot ke grup → 𝟭𝘅 𝗚𝗮𝗰𝗵𝗮

𝗔𝗷𝗮𝗸 𝘁𝗲𝗺𝗮𝗻 𝗱𝗮𝗻 𝗱𝗮𝗽𝗮𝘁𝗸𝗮𝗻 𝗸𝗲𝘂𝗻𝘁𝘂𝗻𝗴𝗮𝗻 𝗯𝗲𝗿𝘀𝗮𝗺𝗮! 🎁
`;

    const keyboard = [
      [
        { text: "𝗜𝗻𝘃𝗶𝘁𝗲 𝗧𝗲𝗺𝗮𝗻", callback_data: "undang_teman" },
        { text: "𝗔𝗱𝗱 𝗕𝗼𝘁 𝗸𝗲 𝗚𝗿𝘂𝗽", url: `https://t.me/${config.BOT_USERNAME}?startgroup=true` }
      ],
      [
        { text: "𝗖𝗵𝗮𝗻𝗻𝗲𝗹", url: `https://t.me/${config.CHANNEL_ID.replace('@', '')}` }
      ],
      [
        { text: "🎵 𝗥𝗮𝗻𝗱𝗼𝗺 𝗠𝘂𝘀𝗶𝗸", callback_data: "random_musik" }
      ], 
      [
        { text: "👑 𝗢𝘄𝗻𝗲𝗿 𝗠𝗲𝗻𝘂", callback_data: "owner_menu" },
        { text: "👨‍💻 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿", url: `https://t.me/${config.OWNER_USERNAME}` }
      ]
    ];

    await bot.editMessageMedia(
      { type: 'photo', media: banner, caption, parse_mode: 'Markdown' },
      { chat_id: chatId, message_id: messageId }
    ).catch(e => console.error("Gagal edit media main menu:", e.message));

    await bot.editMessageReplyMarkup(
      { inline_keyboard: keyboard },
      { chat_id: chatId, message_id: messageId }
    ).catch(e => console.error("Gagal edit reply markup main menu:", e.message));
  } else if (query.data === 'undang_teman') {
    const referralLink = `https://t.me/${config.BOT_USERNAME}?start=${query.from.id}`;
    await bot.answerCallbackQuery(query.id);

    await safeSendMessage(query.from.id, `
✨ 𝗥𝗲𝗳𝗲𝗿𝗿𝗮𝗹 𝗕𝗼𝗻𝘂𝘀 ✨

🚀 𝗔𝗷𝗮𝗸 𝘁𝗲𝗺𝗮𝗻-𝘁𝗲𝗺𝗮𝗻𝗺𝘂 𝗯𝗲𝗿𝗴𝗮𝗯𝘂𝗻𝗴 𝗱𝗮𝗻 𝗿𝗮𝗶𝗵 𝗵𝗮𝗱𝗶𝗮𝗵 𝘀𝗽𝗲𝘀𝗶𝗮𝗹 𝘀𝗲𝘁𝗶𝗮𝗽 𝗸𝗮𝗹𝗶 𝗺𝗲𝗿𝗲𝗸𝗮 𝘀𝘁𝗮𝗿𝘁 𝗹𝗲𝘄𝗮𝘁 𝗹𝗶𝗻𝗸 𝗸𝗮𝗺𝘂!

💎 𝗦𝗲𝗺𝗮𝗸𝗶𝗻 𝗯𝗮𝗻𝘆𝗮𝗸 𝘁𝗲𝗺𝗮𝗻 𝘆𝗮𝗻𝗴 𝗷𝗼𝗶𝗻, 𝘀𝗲𝗺𝗮𝗸𝗶𝗻 𝗯𝗲𝘀𝗮𝗿 𝗵𝗮𝗱𝗶𝗮𝗵𝗻𝘆𝗮!

🔗 ${referralLink}
    `);
  }
});

    await bot.editMessageMedia(
      { type: 'photo', media: banner, caption, parse_mode: 'Markdown' },
      { chat_id: chatId, message_id: messageId }
    ).catch(e => console.error("Gagal edit media main menu:", e.message));

    await bot.editMessageReplyMarkup(
      { inline_keyboard: keyboard },
      { chat_id: chatId, message_id: messageId }
    ).catch(e => console.error("Gagal edit reply markup main menu:", e.message));
  } else if (query.data === 'undang_teman') {
    const referralLink = `https://t.me/${config.BOT_USERNAME}?start=${query.from.id}`;
    await bot.answerCallbackQuery(query.id);

    await safeSendMessage(query.from.id, `
\`\`\`   
✨ 𝗥𝗘𝗙𝗘𝗥𝗥𝗔𝗟 𝗕𝗢𝗡𝗨𝗦 ✨

🚀 Ajak teman-temanmu bergabung dan raih *hadiah spesial* setiap kali mereka mulai lewat link kamu!

💎 Semakin banyak teman yang join, semakin besar hadiahnya!

🔗 ${referralLink}
\`\`\`
    `, { parse_mode: "Markdown" });
  } else if (query.data.startsWith('confirm_del_musik_')) {
    const musikId = query.data.replace('confirm_del_musik_', '');
    await handleDeleteMusik(query, musikId);
  } else if (query.data === 'cancel_del_musik') {
    await bot.answerCallbackQuery(query.id, { text: '❌ Penghapusan dibatalkan' });
    await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => {});
  } else if (query.data === 'random_musik') {
    const fakeMsg = { from: query.from, chat: { id: query.message.chat.id } };
    bot.emit('text', { ...fakeMsg, text: '/musik' });
    await bot.answerCallbackQuery(query.id);
  } else if (query.data.startsWith('beli_')) {
    await handleBeliLimit(query);
  } else if (query.data === 'refresh_toko') {
    await refreshToko(query);
  } else if (query.data === 'info_coin') {
    await infoCaraDapatCoin(query);
  } else if (query.data === 'toko_menu') {
    const fakeMsg = { from: query.from, chat: { id: query.message.chat.id } };
    bot.emit('text', { ...fakeMsg, text: '/toko' });
    await bot.answerCallbackQuery(query.id);
  } else if (query.data === 'gacha_sekarang') {
    const fakeMsg = { from: query.from, chat: { id: query.message.chat.id } };
    bot.emit('text', { ...fakeMsg, text: '/gacha' });
    await bot.answerCallbackQuery(query.id);
  }
else if (query.data === 'tourl_help') {
    await bot.answerCallbackQuery(query.id, { text: '📤 Buka menu upload help' });
    const fakeMsg = { from: query.from, chat: { id: query.message.chat.id } };
    bot.emit('text', { ...fakeMsg, text: '/tourlhelp' });
    
  } else if (query.data === 'my_stat') {
    await bot.answerCallbackQuery(query.id, { text: '📊 Buka statistik kamu' });
    const fakeMsg = { from: query.from, chat: { id: query.message.chat.id } };
    bot.emit('text', { ...fakeMsg, text: '/mystat' });
    
  } else if (query.data === 'leaderboard_menu') {
    await bot.answerCallbackQuery(query.id, { text: '🏆 Buka leaderboard' });
    const fakeMsg = { from: query.from, chat: { id: query.message.chat.id } };
    bot.emit('text', { ...fakeMsg, text: '/leaderboard' });
  }
});
// === RESET OTOMATIS TIAP HARI ===  
schedule.scheduleJob({ hour: 0, minute: 0, tz: 'Asia/Jakarta' }, () => {
  let users = loadData('users.json');
  const today = new Date().toDateString();

  users = users.map(u => ({
    ...u,
    gachaToday: 0,
    extraLimit: 0, // Pastikan extraLimit juga direset
    lastDate: today
  }));

  saveData('users.json', users);
  console.log(chalk.blue(`[RESET OTOMATIS] Limit gacha direset (${today})`));

  for (const adminId of ADMIN_IDS) {
    safeSendMessage(adminId, `✅ Limit gacha harian telah direset otomatis (${today})`);
  }
});

bot.onText(/\/gacha/, async (msg) => {
  const userId = Number(msg.from.id);

  // === Cek blacklist ===
  const blacklist = loadData('blacklist.json');
  if (blacklist.includes(userId)) {
    return safeSendMessage(userId, "🚫 Kamu diblok dari menggunakan gacha. Hubungi admin jika ini kesalahan.");
  }

  if (msg.chat.type !== 'private') {
    return safeSendMessage(userId, '⚠️ Gacha hanya bisa dilakukan di chat pribadi dengan bot.');
  }

  // === Anti-Spam Cooldown ===
  const lastUse = cooldown.get(userId);
  const now = Date.now();
  if (lastUse && now - lastUse < COOLDOWN_TIME) {
    const remaining = ((COOLDOWN_TIME - (now - lastUse)) / 1000).toFixed(1);
    return safeSendMessage(userId, `🕐 Tunggu ${remaining} detik sebelum gacha lagi.`);
  }
  cooldown.set(userId, now);

  // === Wajib follow channel ===
  if (config.CHANNEL_ID && !await isUserSubscribed(userId)) {
    return safeSendMessage(
      userId,
      `⚠️ Kamu harus follow channel untuk gacha.\n👉 [Join Channel](https://t.me/${config.CHANNEL_ID.replace('@', '')})`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: `https://t.me/${config.CHANNEL_ID.replace('@', '')}` }]
          ]
        }
      }
    );
  }

  // --- Load and Initialize User Data ---
  let users = loadData('users.json');
  let gachaCodes = loadData('gacha_codes.json');
  const today = new Date().toDateString();

  let user = users.find(u => Number(u.id) === userId);

  if (!user) {
    // 💡 TAMBAH redeemedCodes
    user = { id: userId, gachaToday: 0, bonus: 0, extraLimit: 0, history: [], lastDate: today, redeemedCodes: [] };
    users.push(user);
  }

  // Reset harian
  if (user.lastDate !== today) {
    user.gachaToday = 0;
    user.extraLimit = 0;
    user.lastDate = today;
  }
  // 💡 INIT redeemedCodes jika belum ada
  if (!Array.isArray(user.redeemedCodes)) user.redeemedCodes = [];


  // === Hitung total kesempatan ===
  const dailyLimit = config.GACHA_LIMIT || 0;
  // 💡 extraLimit adalah limit tambahan dari kode redeem
  const totalLimit = dailyLimit + (user.extraLimit || 0); 
  const sisaLimit = Math.max(totalLimit - user.gachaToday, 0);
  const sisaBonus = Math.max(user.bonus, 0);
  const totalKesempatan = sisaLimit + sisaBonus;

  if (totalKesempatan <= 0) {
    return safeSendMessage(
      userId,
      `❌ *Limit Harian Habis!* (Limit: ${dailyLimit}, Extra: ${user.extraLimit || 0}, Bonus: ${user.bonus || 0})\nKamu sudah menggunakan semua kesempatan hari ini.\n\n🎁 Invite teman atau add bot ke grup untuk dapat bonus gacha, atau tunggu reset besok.`,
      { parse_mode: "Markdown" }
    );
  }

  // === Tentukan sumber gacha & KURANGI KESEMPATAN ===
  let sumber = "Limit";
  if (sisaLimit > 0) {
    user.gachaToday++;
    // 💡 KURANGI extraLimit jika limit harian dari config sudah habis, tapi extraLimit masih ada.
    // Jika limit harian (config.GACHA_LIMIT) habis, dan gachaToday > config.GACHA_LIMIT,
    // maka pemakaian gachaToday selanjutnya adalah dari extraLimit
    if ((user.gachaToday - dailyLimit) > 0) {
        user.extraLimit = Math.max(0, (user.extraLimit || 0) - 1);
        sumber = "ExtraLimit";
    } else {
        sumber = "Limit";
    }

  } else if (user.bonus > 0) {
    user.bonus--; // bonus langsung terpakai
    sumber = "Bonus";
  }


  // --- ANIMASI LOADING ---
  const barMsg = await safeSendMessage(userId, "🎰 *Menyiapkan sistem gacha...*\n[▒▒▒▒▒▒▒▒▒▒] 0%", { parse_mode: "Markdown" });
  if (barMsg) {
    for (let i = 1; i <= 10; i++) {
      await new Promise(r => setTimeout(r, 150));
      const bar = '█'.repeat(i) + '▒'.repeat(10 - i);
      await bot.editMessageText(`🎰 *Menyiapkan sistem gacha...*\n[${bar}] ${i * 10}%`, {
        chat_id: userId,
        message_id: barMsg.message_id,
        parse_mode: "Markdown"
      }).catch(() => {}); // catch error jika user hapus pesan
    }
    await bot.deleteMessage(userId, barMsg.message_id).catch(() => {});
  }

  // === Pilih item acak ===
  const items = loadData('items.json');
  if (!items.length) {
    // Kembalikan limit jika tidak ada item
    if (sumber === "Limit") user.gachaToday--;
    else if (sumber === "ExtraLimit") user.extraLimit = (user.extraLimit || 0) + 1; // Kembalikan ExtraLimit
    else if (sumber === "Bonus") user.bonus++;
    saveData('users.json', users); // Simpan kembali sebelum keluar
    return safeSendMessage(userId, '📭 Belum ada item gacha.');
  }

  const item = items[Math.floor(Math.random() * items.length)];
  const code = nanoid(6).toUpperCase();

  // === Update History dan Code Database ===
  user.history.push({ item: item.name, code, date: new Date(), sumber });
  gachaCodes.push({ userId, item: item.name, code, date: new Date(), sumber });

  saveData('users.json', users); // Simpan sekali di akhir
  saveData('gacha_codes.json', gachaCodes);

  // Re-hitung sisa limit
  const sisaLimitNow = Math.max(dailyLimit - user.gachaToday, 0);
  const sisaExtraLimitNow = Math.max(user.extraLimit, 0);
  const sisaBonusNow = Math.max(user.bonus, 0);

  // === Hasil Gacha ===
  await safeSendMessage(
    userId,
    `\`\`\`
🎰 ɢᴀᴄʜᴀ sᴇʟᴇsᴀɪ!

🎁 ʜᴀᴅɪᴀʜ : ${item.name}
🧭 sᴜᴍʙᴇʀ : ${sumber}
🎟 ᴋᴏᴅᴇ   : ${code}
────────────────────
📊 ʟɪᴍɪᴛ ᴛᴇʀsɪsᴀ : ${sisaLimitNow}
⚡ ᴇxᴛʀᴀ ʟɪᴍɪᴛ  : ${sisaExtraLimitNow} 💡
💎 ʙᴏɴᴜꜱ ᴛᴇʀsɪsᴀ : ${sisaBonusNow}
\`\`\``,
    { parse_mode: 'Markdown' }
  );

  if (item.filename) {
    const filePath = path.join(dataDir, item.filename);
    if (fs.existsSync(filePath)) {
      await bot.sendDocument(userId, filePath, { caption: `💎 ʜᴀᴅɪᴀʜ: *${item.name}*`, parse_mode: "Markdown" }).catch(e => console.error("Gagal kirim dokumen gacha:", e.message));
    }
  }

  // === 👾 Console Log ===
  const time = new Date().toLocaleTimeString("id-ID");
  console.log(chalk.hex("#00FF00")("┌──────────────────────────────────────────────┐"));
  console.log(chalk.hex("#32CD32")(`│ [${time}] SYSTEM: GACHA.EXE EXECUTED        │`));
  console.log(chalk.hex("#00FF00")("├──────────────────────────────────────────────┤"));
  console.log(`${chalk.hex("#7FFF00")("USER")}   → ${chalk.hex("#ADFF2F")(userId)}`);
  console.log(`${chalk.hex("#7FFF00")("ITEM")}   → ${chalk.hex("#ADFF2F")(item.name)}`);
  console.log(`${chalk.hex("#7FFF00")("SOURCE")} → ${chalk.hex("#ADFF2F")(sumber)}`);
  console.log(`${chalk.hex("#7FFF00")("LIMIT")}  → ${chalk.hex("#ADFF2F")(`${user.gachaToday}/${dailyLimit + user.extraLimit}`)}`);
  console.log(`${chalk.hex("#7FFF00")("BONUS")}  → ${chalk.hex("#ADFF2F")(user.bonus)}`);
  console.log(chalk.hex("#00FF00")("├──────────────────────────────────────────────┤"));
  console.log(chalk.hex("#00FF00")(`│ STATUS: ${chalk.bold.green("SUCCESS")} | CODE: ${chalk.white(code)} │`));
  console.log(chalk.hex("#00FF00")("└──────────────────────────────────────────────┘"));
});

// === /history ===
bot.onText(/\/history/, (msg) => {
  const user = loadData('users.json').find(u => u.id === msg.from.id);
  if (!user || !user.history.length) return safeSendMessage(msg.from.id, '📭 Belum ada riwayat gacha.');
  let text = '📝 Riwayat Gacha (10 Terbaru):\n';
  user.history.slice(-10).reverse().forEach((h, i) => { text += `${i + 1}. ${h.item} (${h.sumber}) — ${h.code}\n`; }); // 💡 TAMBAH SUMBER
  safeSendMessage(msg.from.id, text);
});

/// === /additem (otomatis nama file + auto broadcast) ===
bot.onText(/\/addgiv/, async (msg) => {
  const adminId = msg.from.id;
  if (!config.ADMIN_IDS.includes(adminId))
    return safeSendMessage(adminId, "❌ Kamu tidak punya izin untuk menambah item.");

  const reply = msg.reply_to_message;
  if (!reply)
    return safeSendMessage(adminId, "📎 *Reply* ke file, foto, video, teks, atau dokumen yang ingin dijadikan item.", { parse_mode: "Markdown" });

  const items = loadData("items.json");
  const users = loadData("users.json");
  const chats = loadData("chats.json");

  try {
    let fileId, fileName, ext = ".bin", jenis = "📦 File", itemName;

    // === Deteksi tipe file ===
    if (reply.document) {
      fileId = reply.document.file_id;
      fileName = reply.document.file_name || "unknown.bin";
      ext = path.extname(fileName) || ".bin";
      itemName = path.basename(fileName, ext);
      jenis = "📄 Dokumen";
    } else if (reply.photo) {
      fileId = reply.photo.slice(-1)[0].file_id;
      fileName = `photo_${Date.now()}.jpg`;
      ext = ".jpg";
      itemName = path.basename(fileName, ext);
      jenis = "📸 Foto";
    } else if (reply.video) {
      fileId = reply.video.file_id;
      fileName = reply.video.file_name || `video_${Date.now()}.mp4`;
      ext = ".mp4";
      itemName = path.basename(fileName, ext);
      jenis = "🎥 Video";
    } else if (reply.audio) {
      fileId = reply.audio.file_id;
      fileName = reply.audio.file_name || `audio_${Date.now()}.mp3`;
      ext = ".mp3";
      itemName = path.basename(fileName, ext);
      jenis = "🎵 Audio";
    } else if (reply.voice) {
      fileId = reply.voice.file_id;
      fileName = `voice_${Date.now()}.ogg`;
      ext = ".ogg";
      itemName = path.basename(fileName, ext);
      jenis = "🎤 Voice";
    } else if (reply.text) {
      const itemName = reply.text.split("\n")[0].slice(0, 50).replace(/[^\w\s-]/g, "").trim() || `text_${Date.now()}`;
      const filePath = path.join(dataDir, `${itemName}.txt`);
      fs.writeFileSync(filePath, reply.text, "utf8");
      items.push({ name: itemName, filename: `${itemName}.txt` });
      saveData("items.json", items);
      await safeSendMessage(adminId, `✅ Item *${itemName}* (📝 Teks) berhasil ditambahkan.`, { parse_mode: "Markdown" });
      return broadcastNewItem(itemName, `${itemName}.txt`, users, chats);
    } else {
      return safeSendMessage(adminId, "❌ Format tidak didukung. Gunakan *reply* ke dokumen, foto, video, teks, atau audio.", { parse_mode: "Markdown" });
    }

    // === Unduh file dari Telegram ===
    const fileInfo = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${fileInfo.file_path}`;
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Gagal mengunduh file: ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    // === Simpan ke folder data ===
    const safeFile = `${itemName.replace(/\s+/g, "_")}${ext}`;
    const savePath = path.join(dataDir, safeFile);
    fs.writeFileSync(savePath, buffer);

    // === Simpan metadata item ===
    items.push({ name: itemName, filename: safeFile });
    saveData("items.json", items);

    // === Kirim notifikasi ke admin ===
    await safeSendMessage(
      adminId,
      `✅ *Item baru berhasil ditambahkan!*\n\n📦 Nama : *${itemName}*\n🗂 Jenis : ${jenis}\n📁 File : \`${safeFile}\`\n👥 Total user : ${users.length}\n👥 Total group : ${chats.length}`,
      { parse_mode: "Markdown" }
    );

    // === Kirim preview file ===
    try {
      if (ext.match(/\.(jpg|jpeg|png|gif)$/i))
        await bot.sendPhoto(adminId, savePath, { caption: `📸 Preview item: *${itemName}*`, parse_mode: "Markdown" });
      else if (ext.match(/\.(mp4|mov)$/i))
        await bot.sendVideo(adminId, savePath, { caption: `🎥 Preview item: *${itemName}*`, parse_mode: "Markdown" });
      else if (ext.match(/\.(mp3|ogg)$/i))
        await bot.sendAudio(adminId, savePath, { caption: `🎵 Preview item: *${itemName}*`, parse_mode: "Markdown" });
    } catch (e) {
      console.log("⚠️ Gagal kirim pratinjau:", e.message);
    }

    // === Broadcast otomatis ke semua target ===
    await broadcastNewItem(itemName, safeFile, users, chats);

  } catch (err) {
    console.error("❌ Gagal add item:", err);
    safeSendMessage(adminId, `⚠️ *Gagal menambahkan item:*\n\`\`\`\n${err.message}\n\`\`\``, { parse_mode: "Markdown" });
  }
});

// === Fungsi broadcast item baru (UPDATE) ===
async function broadcastNewItem(name, filename, users, chats) {
  const notif = 
`🎁 𝗜𝗧𝗘𝗠 𝗕𝗔𝗥𝗨 𝗧𝗘𝗟𝗔𝗛 𝗛𝗔𝗗𝗜𝗥!

📦 𝗡𝗮𝗺𝗮 : ${name}
📁 𝗙𝗶𝗹𝗲 : ${filename}

✨ 𝗖𝗼𝗯𝗮 𝗽𝗲𝗿𝘂𝗻𝘁𝘂𝗻𝗴𝗮𝗻𝗺𝘂 𝗱𝗶 /gacha 𝘀𝗲𝗸𝗮𝗿𝗮𝗻𝗴!`;

  let totalSent = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  // Progress message untuk admin
  const progressMsg = await safeSendMessage(config.ADMIN_IDS[0], 
    `📢 𝗠𝗲𝗻𝗴𝗶𝗿𝗶𝗺 𝗯𝗿𝗼𝗮𝗱𝗰𝗮𝘀𝘁 𝗶𝘁𝗲𝗺 𝗯𝗮𝗿𝘂...\n\n` +
    `📦 Item: ${name}\n` +
    `👥 Target: ${users.length} users + ${chats.length} groups\n` +
    `⏳ Status: Memulai...`
  );

  const updateProgress = async (current, total, type) => {
    if (progressMsg) {
      const percent = Math.round((current / total) * 100);
      const bar = '█'.repeat(Math.floor(percent / 10)) + '▒'.repeat(10 - Math.floor(percent / 10));
      try {
        await bot.editMessageText(
          `📢 𝗠𝗲𝗻𝗴𝗶𝗿𝗶𝗺 𝗯𝗿𝗼𝗮𝗱𝗰𝗮𝘀𝘁 𝗶𝘁𝗲𝗺 𝗯𝗮𝗿𝘂...\n\n` +
          `📦 Item: ${name}\n` +
          `👥 Target: ${users.length} users + ${chats.length} groups\n` +
          `📊 Progress: [${bar}] ${percent}%\n` +
          `✅ Berhasil: ${totalSent}\n` +
          `❌ Gagal: ${totalFailed}\n` +
          `🎯 Sedang: ${type}`,
          {
            chat_id: progressMsg.chat.id,
            message_id: progressMsg.message_id
          }
        );
      } catch (e) {}
    }
  };

  // 1. BROADCAST KE SEMUA USER
  console.log(chalk.blue(`📢 Broadcasting item "${name}" ke ${users.length} users...`));
  
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    try {
      await bot.sendMessage(u.id, notif, { parse_mode: "Markdown" });
      totalSent++;
    } catch (e) {
      totalFailed++;
      console.log(`⚠️ Gagal kirim ke user ${u.id}: ${e.message}`);
    }
    
    // Update progress setiap 10 user
    if (i % 10 === 0) {
      await updateProgress(i, users.length, `Users (${i}/${users.length})`);
    }
    
    await new Promise(r => setTimeout(r, 100)); // Rate limit 10 pesan/detik
  }

  // 2. BROADCAST KE SEMUA GROUP
  console.log(chalk.blue(`📢 Broadcasting item "${name}" ke ${chats.length} groups...`));
  
  for (let i = 0; i < chats.length; i++) {
    const group = chats[i];
    try {
      await bot.sendMessage(group.id, notif, { parse_mode: "Markdown" });
      totalSent++;
    } catch (e) {
      totalFailed++;
      console.log(`⚠️ Gagal kirim ke group ${group.id}: ${e.message}`);
    }
    
    // Update progress setiap 5 group
    if (i % 5 === 0) {
      await updateProgress(i, chats.length, `Groups (${i}/${chats.length})`);
    }
    
    await new Promise(r => setTimeout(r, 200)); // Rate limit 5 pesan/detik untuk group
  }

  // 3. BROADCAST KE CHANNEL (jika ada)
  if (config.CHANNEL_ID) {
    try {
      await bot.sendMessage(config.CHANNEL_ID, notif, { parse_mode: "Markdown" });
      totalSent++;
      console.log(chalk.green(`✅ Berhasil kirim ke channel ${config.CHANNEL_ID}`));
    } catch (e) {
      totalFailed++;
      console.log(`⚠️ Gagal kirim ke channel: ${e.message}`);
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  // Final report
  const report = 
`📢 𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧 𝗦𝗘𝗟𝗘𝗦𝗔𝗜

📦 Item: ${name}
⏰ Waktu: ${duration} detik
👥 Total Target: ${users.length + chats.length + (config.CHANNEL_ID ? 1 : 0)}
✅ Berhasil: ${totalSent}
❌ Gagal: ${totalFailed}

🎉 Item baru telah diumumkan ke semua user dan group!`;

  // Update progress message dengan hasil final
  if (progressMsg) {
    try {
      await bot.editMessageText(report, {
        chat_id: progressMsg.chat.id,
        message_id: progressMsg.message_id
      });
    } catch (e) {
      await safeSendMessage(config.ADMIN_IDS[0], report);
    }
  }

  // Kirim report ke semua admin
  for (const adminId of config.ADMIN_IDS) {
    if (adminId !== config.ADMIN_IDS[0]) {
      await safeSendMessage(adminId, report);
    }
  }

  console.log(chalk.green(`✅ Broadcast item "${name}" selesai! ${totalSent} berhasil, ${totalFailed} gagal, ${duration} detik`));
}
// === /delitem ===
bot.onText(/\/delitem (.+)/, (msg, match) => {
  const userId = msg.from.id;
  if (!ADMIN_IDS.includes(userId)) return safeSendMessage(userId, "❌ Kamu tidak punya izin.");
  let items = loadData('items.json');
  const key = match[1].trim();

  // Mencari berdasarkan nama atau urutan (angka)
  const idx = isNaN(key) ? items.findIndex(i => i.name.toLowerCase() === key.toLowerCase()) : parseInt(key) - 1;

  if (idx < 0 || idx >= items.length) return safeSendMessage(userId, '❌ Item tidak ditemukan.');
  const removed = items.splice(idx, 1);

  // Hapus file fisik
  const filePath = path.join(dataDir, removed[0].filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(chalk.yellow(`🗑 File item dihapus: ${removed[0].filename}`));
  }

  saveData('items.json', items);
  safeSendMessage(userId, `🗑 Item *${removed[0].name}* berhasil dihapus.`, { parse_mode: 'Markdown' });
});



// === /clearitems ===
bot.onText(/\/clearitems/, async (msg) => {
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId))
    return safeSendMessage(adminId, "❌ Kamu tidak punya izin.");

  const items = loadData("items.json");

  if (!items.length) return safeSendMessage(adminId, "📭 Tidak ada item untuk dihapus.");

  for (const item of items) {
    const filePath = path.join(dataDir, item.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`⚠️ Gagal hapus file ${item.filename}:`, err.message);
      }
    }
  }

  saveData("items.json", []);

  await safeSendMessage(adminId, "✅ Semua item berhasil dihapus.");
});

// === /leaderboard ===
bot.onText(/\/leaderboard/, async (msg) => {
  const chatId = msg.chat.id;
  const users = loadData('users.json');
  const refs = loadData('referrals.json');

  if (!users.length) return safeSendMessage(chatId, '📭 Belum ada data user.');

  const leaderboard = users.map(u => {
    const totalGacha = (u.history || []).length;
    const totalTeman = refs.filter(r => r.inviter == u.id).length;
    return { id: u.id, totalGacha, totalTeman };
  });

  leaderboard.sort((a, b) => b.totalGacha - a.totalGacha);

  const top10 = leaderboard.slice(0, 10);

  let text = '🏆 <b>TOP 10 GACHA</b>\n\n';
  for (const [i, u] of top10.entries()) {
    const user = users.find(x => x.id === u.id);
    const name = user && msg.chat.type === 'private' && msg.from.id === u.id // Tampilkan nama user sendiri di private chat
      ? (msg.from.first_name || 'Kamu')
      : (user && user.username
        ? `@${user.username}`
        : (user && user.first_name || `User${i + 1}`));
    text += `#${i + 1}. ${name}\n🎲 Gacha: ${u.totalGacha}x | 👥 Teman: ${u.totalTeman}\n\n`;
  }

  const totalUsers = users.length;
  text += `📊 Total pengguna: <b>${totalUsers}</b>`;

  await safeSendMessage(chatId, text, { parse_mode: 'HTML' });
});

// === /broadcast ===
bot.onText(/\/broadcast/, async (msg) => {
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId)) return safeSendMessage(adminId, "❌ Tidak punya izin.");
  const reply = msg.reply_to_message;
  if (!reply) return safeSendMessage(adminId, "📌 Reply pesan untuk broadcast.");

  const users = loadData("users.json");
  if (!users.length) return safeSendMessage(adminId, "📭 Belum ada user terdaftar.");

  const totalBlocks = 10;
  const blockFull = '▰';
  const blockEmpty = '▱';
  let success = 0;
  let failed = 0;

  let progressMsg = await safeSendMessage(adminId, `🚀 Broadcast ke ${users.length} pengguna...\n[${blockEmpty.repeat(totalBlocks)}] 0%\n✅ Sukses: 0 | ❌ Gagal: 0`);

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    try {
      if (reply.text) await safeSendMessage(u.id, reply.text);
      else if (reply.photo) await bot.sendPhoto(u.id, reply.photo.slice(-1)[0].file_id, { caption: reply.caption || "" });
      else if (reply.video) await bot.sendVideo(u.id, reply.video.file_id, { caption: reply.caption || "" });
      else if (reply.document) await bot.sendDocument(u.id, reply.document.file_id, { caption: reply.caption || "" });
      success++;
    } catch (e) { 
      failed++;
      console.log(`❌ Gagal kirim ke ${u.id}: ${e.message}`); 
    }

    const percent = Math.floor(((i + 1) / users.length) * 100);
    const blocks = Math.floor((percent / 100) * totalBlocks);
    const bar = blockFull.repeat(blocks) + blockEmpty.repeat(totalBlocks - blocks);

    if (progressMsg) {
      await bot.editMessageText(`🚀 Broadcast ke ${users.length} pengguna...\n[${bar}] ${percent}%\n✅ Sukses: ${success} | ❌ Gagal: ${failed}`, {
        chat_id: adminId,
        message_id: progressMsg.message_id
      }).catch(() => { }); // Ignore edit error
    }

    await new Promise(r => setTimeout(r, 30));
  }

  // hasil akhir
  if (progressMsg) {
    await bot.editMessageText(
      `🎯 Broadcast Selesai!\n────────────────────────\n📤 Total Pengguna: ${users.length}\n✅ Berhasil: ${success}\n❌ Gagal: ${failed}\n────────────────────────\n💎 Terima kasih telah menggunakan bot premium!`,
      { chat_id: adminId, message_id: progressMsg.message_id }
    ).catch(() => { });
  }
});

// === /backup (khusus file penting) ===
bot.onText(/\/backup/, async (msg) => {
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId))
    return safeSendMessage(adminId, "❌ Tidak punya izin.");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

  const backupFile = path.join(backupDir, `backup-data-${timestamp}.zip`);
  const progressMsg = await safeSendMessage(adminId, `📦 Membuat backup data penting...\n[▒▒▒▒▒▒▒▒▒▒] 0%`);

  const output = fs.createWriteStream(backupFile);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.pipe(output);

// 💡 TAMBAH 
const targetFiles = [
  "blacklist.json",
  "chats.json", 
  "gacha_codes.json",
  "items.json",
  "referrals.json",
  "users.json",
  "codes.json",
  "musik.json",
  "coin_transactions.json",
  "redeem.json"  // 💡 HAPUS SPASI DI DEPAN
];

  for (const file of targetFiles) {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) archive.file(filePath, { name: file });
  }

  let progress = 0;
  const totalBlocks = 10;
  const interval = setInterval(async () => {
    progress++;
    const bar = '█'.repeat(progress) + '▒'.repeat(totalBlocks - progress);
    const percent = progress * 10;
    try {
      await bot.editMessageText(`📦 Membuat backup data penting...\n[${bar}] ${percent}%`, {
        chat_id: adminId,
        message_id: progressMsg.message_id
      }).catch(() => {});
    } catch {}
    if (progress >= totalBlocks) clearInterval(interval);
  }, 300);

  await archive.finalize();

  output.on("close", async () => {
    clearInterval(interval);
    const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    await bot.editMessageText(`✅ Backup selesai!\n📁 File: ${backupFile}\n📦 Ukuran: ${sizeMB} MB`, {
      chat_id: adminId,
      message_id: progressMsg.message_id
    }).catch(() => {});

    if (sizeMB <= 50) {
      await bot.sendDocument(adminId, backupFile, {
        caption: `📦 Backup data penting - ${timestamp}`
      }).catch(e => console.error("Gagal kirim backup:", e.message));
    } else {
      await safeSendMessage(adminId, `⚠️ File backup terlalu besar (${sizeMB} MB). Ambil langsung dari server.`);
    }
  });
});


// === Fungsi Backup Otomatis (khusus file penting) ===
const autoBackupDir = path.join(process.cwd(), "autobackups");
if (!fs.existsSync(autoBackupDir)) fs.mkdirSync(autoBackupDir);

async function autoBackup() {
  const backupFile = path.join(autoBackupDir, `backup-${Date.now()}.zip`);
  // 💡 TAMBAH codes.json
  const targetFiles = [
    "blacklist.json",
    "chats.json",
    "gacha_codes.json",
    "items.json",
    "referrals.json",
    "users.json",
    "codes.json"
  ];

  try {
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(backupFile);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);

      for (const file of targetFiles) {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) archive.file(filePath, { name: file });
      }

      archive.finalize();
    });

    console.log(chalk.green(`✅ Backup otomatis selesai: ${backupFile}`));

    for (const adminId of ADMIN_IDS) {
      await safeSendMessage(adminId, `📦 Notifikasi: Backup otomatis selesai! (${new Date().toLocaleTimeString()})`);
    }

    // Hapus backup lama (>3 hari)
    const files = await fs.readdir(autoBackupDir);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(autoBackupDir, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtimeMs > 3 * 24 * 60 * 60 * 1000) {
        await fs.remove(filePath);
        console.log(chalk.yellow(`🧹 Backup lama dihapus: ${file}`));
      }
    }
  } catch (err) {
    console.error(chalk.red("❌ Backup otomatis gagal:"), err);
  }
}

// === Jadwal Auto Backup Setiap 3 Jam ===
schedule.scheduleJob("0 */3 * * *", () => {
  console.log(chalk.blue("🕓 Menjalankan backup otomatis 3 jam..."));
  autoBackup();
});

// === Penanganan Bot Masuk/Keluar Grup ===
// === Penanganan Bot Masuk/Keluar Grup (UPDATE DENGAN COIN SYSTEM) ===
bot.on('my_chat_member', async (msg) => {
  try {
    const chatId = msg.chat.id;

    if (!['group', 'supergroup'].includes(msg.chat.type)) return;

    const oldStatus = msg.old_chat_member?.status;
    const newStatus = msg.new_chat_member?.status;
    const chatTitle = msg.chat.title || 'Grup ini';
    const userId = msg.from?.id;
    const username = msg.from?.username || msg.from?.first_name || 'Unknown';

    let chats = loadData('chats.json');
    let users = loadData('users.json');
    let coinTransactions = loadData('coin_transactions.json');

    // === 1️⃣ BOT DIKELUARKAN DARI GRUP ===
    if (oldStatus === 'member' && newStatus === 'kicked') {
      const groupIndex = chats.findIndex(c => c.id === chatId);
      if (groupIndex !== -1) {
        chats.splice(groupIndex, 1);
        saveData('chats.json', chats);
      }

      if (userId) {
        let user = users.find(u => u.id === userId);
        if (user && user.bonus > 0) {
          user.bonus = Math.max(0, user.bonus - 2);
          saveData('users.json', users);
          await safeSendMessage(
            userId,
            `⚠️ *BOT TELAH DIKELUARKAN DARI GRUP*\n\n` +
            `📛 Grup: *${chatTitle}*\n` +
            `💎 Bonus *2x Gacha* kamu telah *dicabut* karena bot dikeluarkan.\n\n` +
            `💡 Undang kembali bot ke grup aktif untuk mendapatkan bonus lagi.`,
            { parse_mode: 'Markdown' }
          );
        }
      }

      const userTag = username.startsWith('@') ? username : `@${username}`;
      const msgAdmin =
        `🚫 *BOT DIKELUARKAN DARI GRUP*\n\n` +
        `📛 *Nama Grup:* ${chatTitle}\n` +
        `🆔 *ID Grup:* \`${chatId}\`\n\n` +
        `👤 *Dikeluarkan oleh:* ${userTag}\n` +
        `🆔 *ID User:* \`${userId}\`\n\n` +
        `🎁 *Bonus Dicabut:* -2x Gacha`;

      for (const adminId of ADMIN_IDS) {
        await safeSendMessage(adminId, msgAdmin, { parse_mode: 'Markdown' });
      }

      console.log(chalk.red(`🚪 Bot dikeluarkan dari ${chatTitle}, bonus user dicabut.`));
      return;
    }

    // === 2️⃣ BOT DITAMBAHKAN KE GRUP ===
    if (newStatus !== 'member') return;

    let addingUserId = msg.from?.id;

    if (!addingUserId) {
      const admins = await bot.getChatAdministrators(chatId);
      const firstAdmin = admins.find(a => !a.user.is_bot);
      if (firstAdmin) {
        addingUserId = firstAdmin.user.id;
      }
    }

    if (!addingUserId) return;

    let memberCount = 0;
    let humanMembers = 0;
    try {
      memberCount = await bot.getChatMemberCount(chatId);
      
      // Hitung anggota non-bot (minimal 25 anggota manusia)
      const members = await bot.getChatAdministrators(chatId);
      humanMembers = members.filter(m => !m.user.is_bot).length;
      
    } catch (err) {
      console.error('Error getting chat info:', err.message);
    }

    // 💡 SYARAT BARU: Minimal 25 anggota manusia (non-bot)
    if (humanMembers < 25) {
      await safeSendMessage(
        chatId,
        `🚫 *BOT GACHA PREMIUM* tidak dapat diaktifkan di grup ini.\n\n` +
        `👥 Jumlah member manusia: *${humanMembers}*\n` +
        `🤖 Total member (termasuk bot): *${memberCount}*\n` +
        `📈 Minimal member manusia yang dibutuhkan: *25*\n\n` +
        `💡 Tambahkan lebih banyak anggota manusia, lalu undang bot kembali.`,
        { parse_mode: 'Markdown' }
      );

      await safeSendMessage(
        addingUserId,
        `⚠️ *${chatTitle}* belum memenuhi syarat minimal 25 member manusia.\n\n` +
        `⏳ Bot akan keluar otomatis dalam *5 detik*...`,
        { parse_mode: 'Markdown' }
      );

      setTimeout(async () => {
        try {
          await bot.leaveChat(chatId);
          console.log(`🚪 Bot keluar dari ${chatTitle} karena member manusia kurang dari 25.`);
        } catch (err) {
          console.error(`Gagal keluar dari grup:`, err.message);
        }
      }, 5000);

      return;
    }

    // --- Beri Bonus Coin 65 ---
    let group = chats.find(c => c.id === chatId);
    if (!group) {
      group = { id: chatId, name: chatTitle, bonusGiven: false, coinGiven: false };
      chats.push(group);
    }

    // Beri bonus coin hanya jika belum pernah dapat coin
    if (!group.coinGiven) {
      group.coinGiven = true;
      saveData('chats.json', chats);

      const today = new Date().toDateString();
      let user = users.find(u => u.id === addingUserId);

      if (!user) {
        user = { 
          id: addingUserId, 
          gachaToday: 0, 
          bonus: 0, 
          extraLimit: 0, 
          history: [], 
          lastDate: today, 
          redeemedCodes: [],
          coin: 65  // 💡 BONUS COIN 65
        };
        users.push(user);
      } else {
        user.coin = (Number(user.coin) || 0) + 65;
      }
      
      // 💡 INIT coin jika belum ada
      if (typeof user.coin !== 'number') user.coin = 65;
      
      saveData('users.json', users);

      // 💡 Catat transaksi coin
      coinTransactions.push({
        userId: addingUserId,
        type: 'group_bonus',
        amount: 65,
        description: `Bonus tambah bot ke grup: ${chatTitle}`,
        date: new Date(),
        chatId: chatId
      });
      saveData('coin_transactions.json', coinTransactions);

      await safeSendMessage(
        addingUserId,
        `\`\`\`\n` +
        `╭──────────────────────────────╮\n` +
        `│        🎉 BONUS COIN! 🎉      │\n` +
        `├──────────────────────────────┤\n` +
        `🎊 Terima kasih telah menambahkan\n` +
        `BOT GACHA PREMIUM ke grup *${chatTitle}*!\n\n` +
        `💰 Kamu mendapatkan: *65 Coin*\n` +
        `🪙 Total coin kamu sekarang: *${user.coin}*\n\n` +
        `🛍️ Gunakan coin untuk beli limit di /toko\n` +
        `╰──────────────────────────────╯\n` +
        `\`\`\``,
        { parse_mode: 'Markdown' }
      );
    }

    // Beri bonus gacha (seperti sebelumnya)
    if (!group.bonusGiven) {
      group.bonusGiven = true;
      saveData('chats.json', chats);

      const today = new Date().toDateString();
      let user = users.find(u => u.id === addingUserId);

      if (!user) {
        user = { 
          id: addingUserId, 
          gachaToday: 0, 
          bonus: 2, 
          extraLimit: 0, 
          history: [], 
          lastDate: today, 
          redeemedCodes: [],
          coin: 65
        };
        users.push(user);
      } else {
        user.bonus = (Number(user.bonus) || 0) + 2;
      }
      saveData('users.json', users);

      await safeSendMessage(
        addingUserId,
        `\`\`\`\n` +
        `╭──────────────────────────────╮\n` +
        `│        ✨ BONUS GACHA ✨       │\n` +
        `├──────────────────────────────┤\n` +
        `🎉 Bonus tambahan untuk grup aktif!\n\n` +
        `🎁 Kamu mendapatkan: *2x Bonus Gacha*\n` +
        `🪄 Total bonus gacha: *${user.bonus}*\n` +
        `╰──────────────────────────────╯\n` +
        `\`\`\``,
        { parse_mode: 'Markdown' }
      );
    }

    const userTag = username.startsWith('@') ? username : `@${username}`;
    const detailMessage =
      `💎 *BOT DITAMBAHKAN KE GRUP BARU*\n\n` +
      `📛 *Nama Grup:* ${chatTitle}\n` +
      `🆔 *ID Grup:* \`${chatId}\`\n` +
      `👥 *Jumlah Member:* ${memberCount} (${humanMembers} manusia)\n\n` +
      `👤 *User Penambah:* ${userTag}\n` +
      `🆔 *ID User:* \`${addingUserId}\`\n\n` +
      `💰 *Bonus Coin Diberikan:* 65 Coin\n` +
      `🎁 *Bonus Gacha Diberikan:* 2x Gacha\n` +
      `🏆 *Status:* ✅ Berhasil`;

    for (const adminId of ADMIN_IDS) {
      await safeSendMessage(adminId, detailMessage, { parse_mode: 'Markdown' });
    }

    console.log(chalk.green(`✅ Bot ditambahkan ke ${chatTitle}, bonus 65 coin + 2x gacha diberikan ke ${username}`));

  } catch (err) {
    console.error(chalk.red('❌ Error handle my_chat_member:'), err.message);
  }
});

// === Admin Lihat Info Grup (/infogrub) ===
bot.onText(/\/infogrub/, async (msg) => {
  const userId = msg.from.id;
  if (!ADMIN_IDS.includes(userId)) return safeSendMessage(userId, "❌ Tidak punya izin.");

  const chats = loadData('chats.json');
  if (chats.length === 0) return safeSendMessage(userId, "❌ Bot belum ada di grup manapun.");

  let text = "📋 Daftar Grup Bot:\n\n";

  for (const group of chats) {
    try {
      const chat = await bot.getChat(group.id);
      text += `• ${chat.title || 'Unknown'} (ID: ${group.id})\n`;
    } catch {
      text += `• ID: ${group.id} (gagal ambil info, mungkin bot sudah dikeluarkan)\n`;
    }
  }

  safeSendMessage(userId, text);
});

// === Broadcast Pesan ke Grup (/bcgrub) ===
bot.onText(/\/bcgrub/, async (msg) => {
  const userId = msg.from.id;
  if (!ADMIN_IDS.includes(userId))
    return safeSendMessage(userId, "❌ *Kamu bukan admin, tidak bisa broadcast ke grup.*", { parse_mode: "Markdown" });

  if (!msg.reply_to_message)
    return safeSendMessage(userId, "⚠️ *Reply pesan yang ingin di-broadcast ke grup.*", { parse_mode: "Markdown" });

  const chats = loadData('chats.json');
  if (!chats || chats.length === 0)
    return safeSendMessage(userId, "❌ *Bot belum ada di grup manapun.*", { parse_mode: "Markdown" });

  const total = chats.length;
  let sukses = 0;
  let gagal = 0;

  let progressMsg = await safeSendMessage(
    userId,
    "📡 *Mengirim broadcast ke grup...*\n[▒▒▒▒▒▒▒▒▒▒] 0%",
    { parse_mode: "Markdown" }
  );

  const updateBar = async (sent) => {
    if (!progressMsg || !progressMsg.chat) return;
    const percent = Math.floor((sent / total) * 100);
    const filled = Math.round(percent / 10);
    const bar = "█".repeat(filled) + "▒".repeat(10 - filled);

    try {
      await bot.editMessageText(
        `📡 *Sedang broadcast ke grup...*\n[${bar}] ${percent}%`,
        {
          chat_id: progressMsg.chat.id,
          message_id: progressMsg.message_id,
          parse_mode: "Markdown",
        }
      ).catch(() => { });
    } catch (err) {
      // ignore
    }
  };

  for (let i = 0; i < total; i++) {
    const chat = chats[i];
    try {
      await bot.forwardMessage(
        chat.id,
        msg.reply_to_message.chat.id,
        msg.reply_to_message.message_id
      );
      sukses++;
    } catch (err) {
      console.log(chalk.yellow(`⚠️ Gagal kirim ke grup ${chat.id}: ${err.message}`));
      gagal++;
    }

    await updateBar(i + 1);
    await new Promise((r) => setTimeout(r, 300));
  }

  const resultText = `
\`\`\`  
✨ *Broadcast Selesai!*
────────────────────
📊 *Statistik:*
> Total Grup: ${total}  
> ✅ Berhasil: ${sukses}  
> ❌ Gagal: ${gagal}  
────────────────────
🔥 *Broadcast sukses dikirim!*
\`\`\`
`;

  if (progressMsg && progressMsg.chat) {
    try {
      await bot.editMessageText(resultText, {
        chat_id: progressMsg.chat.id,
        message_id: progressMsg.message_id,
        parse_mode: "Markdown",
      });
    } catch (err) {
      safeSendMessage(userId, resultText, { parse_mode: "Markdown" });
    }
  } else {
    safeSendMessage(userId, resultText, { parse_mode: "Markdown" });
  }
});

// === /addlimit <user_id> <jumlah> ===
bot.onText(/\/addlimit (\d+) (\d+)/, async (msg, match) => {
  if (!msg || !msg.chat) return;
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId)) return safeSendMessage(adminId, "❌ Tidak punya izin.");

  const targetId = Number(match[1]);
  const jumlah = Number(match[2]);
  if (!targetId || isNaN(jumlah) || jumlah <= 0) {
    return safeSendMessage(adminId, "⚠️ Format salah.\nGunakan: /addlimit <user_id> <jumlah>");
  }

  let users = loadData('users.json');
  let user = users.find(u => Number(u.id) === targetId);

  if (!user) {
    // 💡 TAMBAH redeemedCodes
    user = { id: targetId, gachaToday: 0, bonus: 0, extraLimit: 0, history: [], lastDate: new Date().toDateString(), redeemedCodes: [] };
    users.push(user);
  }
  // 💡 INIT redeemedCodes jika belum ada
  if (!Array.isArray(user.redeemedCodes)) user.redeemedCodes = [];


  const waitMsg = await safeSendMessage(adminId, "🕓 Memproses permintaan...");

  user.bonus = (Number(user.bonus) || 0) + jumlah;
  saveData('users.json', users);

  const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  if (waitMsg) {
    await bot.editMessageText(
      `✅ *Bonus Gacha Ditambahkan*\n\n` +
      `👤 User ID: \`${targetId}\`\n` +
      `🎟️ Ditambah: +${jumlah}\n` +
      `💰 Total Bonus: ${user.bonus}\n\n` +
      `🕒 ${time}`,
      {
        chat_id: waitMsg.chat.id,
        message_id: waitMsg.message_id,
        parse_mode: "Markdown"
      }
    ).catch(() => { });
  }

  safeSendMessage(
    targetId,
    `🎁 *Bonus Diterima*\n\n` +
    `Kamu mendapatkan +${jumlah} tiket gacha.\n` +
    `Total tiketmu sekarang: *${user.bonus}* 🎟️`,
    { parse_mode: "Markdown" }
  );
});


// === /hapuslimit <user_id> ===
bot.onText(/\/hapuslimit (\d+)/, async (msg, match) => {
  if (!msg || !msg.chat) return;
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId)) return safeSendMessage(adminId, "❌ Tidak punya izin.");

  const targetId = Number(match[1]);
  if (!targetId) {
    return safeSendMessage(adminId, "⚠️ Format salah.\nGunakan: /hapuslimit <user_id>");
  }

  let users = loadData('users.json');
  let userIndex = users.findIndex(u => Number(u.id) === targetId);

  const waitMsg = await safeSendMessage(adminId, "🕓 Menghapus data user...");

  if (userIndex === -1) {
    return bot.editMessageText(`❌ User ${targetId} tidak ditemukan.`, {
      chat_id: waitMsg.chat.id,
      message_id: waitMsg.message_id
    }).catch(() => { });
  }

  users[userIndex].gachaToday = 0;
  users[userIndex].bonus = 0;
  users[userIndex].extraLimit = 0;
  users[userIndex].lastDate = new Date().toDateString();

  saveData('users.json', users);
  const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  if (waitMsg) {
    await bot.editMessageText(
      `✅ *Limit Direset*\n\n` +
      `👤 User ID: \`${targetId}\`\n` +
      `🎯 Limit & bonus telah dihapus.\n\n` +
      `🕒 ${time}`,
      {
        chat_id: waitMsg.chat.id,
        message_id: waitMsg.message_id,
        parse_mode: "Markdown"
      }
    ).catch(() => { });
  }

  safeSendMessage(
    targetId,
    `🔁 *Limit Direset*\n\n` +
    `Limit dan bonus kamu telah direset oleh admin.\n` +
    `Kamu bisa mulai gacha lagi sekarang.`,
    { parse_mode: "Markdown" }
  );
});


// === /addlimitall <jumlah> ===
bot.onText(/\/addlimitall (\d+)/, async (msg, match) => {
  if (!msg || !msg.chat) return;
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId)) return safeSendMessage(adminId, "❌ Tidak punya izin.");

  const jumlah = Number(match[1]);
  if (!jumlah || jumlah <= 0) {
    return safeSendMessage(adminId, "⚠️ Format salah.\nGunakan: /addlimitall <jumlah>");
  }

  const users = loadData('users.json');
  if (!users.length) return safeSendMessage(adminId, "📭 Tidak ada user di data.");

  const waitMsg = await safeSendMessage(adminId, `🕓 Menambahkan +${jumlah} limit ke semua user...`);

  users.forEach(u => {
    u.bonus = (Number(u.bonus) || 0) + jumlah;
    // 💡 INIT redeemedCodes jika belum ada
    if (!Array.isArray(u.redeemedCodes)) u.redeemedCodes = [];
  });
  saveData('users.json', users);

  const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  if (waitMsg) {
    await bot.editMessageText(
      `✅ *Bonus Massal Ditambahkan*\n\n` +
      `🎟️ Semua user mendapatkan +${jumlah} tiket gacha!\n` +
      `👥 Total user: ${users.length}\n\n` +
      `🕒 ${time}`,
      {
        chat_id: waitMsg.chat.id,
        message_id: waitMsg.message_id,
        parse_mode: "Markdown"
      }
    ).catch(() => { });
  }

  // Broadcast ke semua user (gunakan safeSendMessage)
  for (const u of users) {
    safeSendMessage(
      u.id,
      `🎉 *Bonus Massal!*\n\nAdmin memberikan +${jumlah} tiket gacha untuk semua pemain!\n` +
      `Cek saldo tiketmu sekarang: *${u.bonus}* 🎟️`,
      { parse_mode: "Markdown" }
    );
  }
});

// === CEK STATUS USER (KHUSUS ADMIN) ===
bot.onText(/\/checkstat (\d+)/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId))
    return safeSendMessage(adminId, "❌ Kamu tidak punya izin untuk perintah ini.");

  const targetId = Number(match[1]);
  const users = loadData('users.json');
  const refs = loadData('referrals.json');
  const today = new Date().toDateString();

  const user = users.find(u => u.id === targetId);
  if (!user) return safeSendMessage(adminId, "⚠️ User tidak ditemukan di database.");

  const totalLimit = config.GACHA_LIMIT || 5;
  const usedLimit = user.gachaToday || 0;
  const remainingLimit = Math.max(totalLimit - usedLimit, 0);
  const bonus = user.bonus || 0;
  const extraLimit = user.extraLimit || 0; // 💡 TAMBAH extraLimit

  const invitedAll = refs.filter(r => r.inviter === targetId).length;
  const invitedToday = refs.filter(r =>
    r.inviter === targetId && new Date(r.date).toDateString() === today
  ).length;

  const text = `
\`\`\`
📊 CEK DATA USER
──────────────────────
👤 USER ID: ${targetId}
📅 Hari ini: ${today}
🎰 Sudah gacha: ${usedLimit}x
⏳ Sisa limit harian: ${remainingLimit}
⚡ Extra limit (Redeem): ${extraLimit} 💡
🎟 Bonus gacha: ${bonus}
👥 Undangan hari ini: ${invitedToday}
👑 Total teman diundang: ${invitedAll}
──────────────────────
Gunakan data ini untuk memantau aktivitas user.
\`\`\`
`;

  await safeSendMessage(adminId, text, { parse_mode: "Markdown" });
});

// === CEK STATUS USER (MYSTAT) ===
bot.onText(/\/mystat/, async (msg) => {
  const userId = msg.from.id;
  const users = loadData('users.json');
  const refs = loadData('referrals.json');
  const today = new Date().toDateString();

  let user = users.find(u => u.id === userId);
  if (!user) {
    return safeSendMessage(userId, "⚠️ Kamu belum pernah gacha, ketik /start dulu.");
  }

  // Hitung data
  const totalLimit = config.GACHA_LIMIT || 5;
  const usedLimit = user.gachaToday || 0;
  const remainingLimit = Math.max(totalLimit - usedLimit, 0);
  const bonus = user.bonus || 0;
  const extraLimit = user.extraLimit || 0; // 💡 TAMBAH extraLimit

  // Hitung jumlah undangan
  const invitedAll = refs.filter(r => r.inviter === userId).length;
  const invitedToday = refs.filter(r =>
    r.inviter === userId && new Date(r.date).toDateString() === today
  ).length;

  // Dalam /mystat command, tambahkan coin info:
const text = `
\`\`\`
📊 STATUS KAMU
──────────────────────
📅 Hari ini: ${today}
🎰 Sudah gacha: ${usedLimit}x
⏳ Sisa limit harian: ${remainingLimit}
⚡ Extra limit (Redeem): ${extraLimit} 💡
🎟 Bonus gacha: ${bonus}
💰 Coin: ${user.coin || 0} 🪙
👥 Undangan hari ini: ${invitedToday}
👑 Total teman diundang: ${invitedAll}
──────────────────────
Gunakan bonusmu untuk gacha lebih banyak! 🎁
\`\`\`
`;

  await safeSendMessage(userId, text, { parse_mode: "Markdown" });
});

// === Blacklist: Add ===
bot.onText(/\/blacklist (\d+)/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId)) return safeSendMessage(adminId, "❌ Kamu bukan admin.");

  const targetId = Number(match[1]);
  let list = loadData('blacklist.json');

  if (list.includes(targetId)) return safeSendMessage(adminId, `⚠️ ID \`${targetId}\` sudah di-blacklist.`, { parse_mode: 'Markdown' });

  list.push(targetId);
  saveData('blacklist.json', list);
  await safeSendMessage(adminId, `🚫 ID \`${targetId}\` ditambahkan ke blacklist.`, { parse_mode: 'Markdown' });
});

// === Blacklist: Delete ===
bot.onText(/\/delblacklist (\d+)/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId)) return safeSendMessage(adminId, "❌ Kamu bukan admin.");

  const targetId = Number(match[1]);
  let list = loadData('blacklist.json');

  if (!list.includes(targetId)) return safeSendMessage(adminId, `⚠️ ID \`${targetId}\` tidak ada di blacklist.`, { parse_mode: 'Markdown' });

  list = list.filter(id => id !== targetId);
  saveData('blacklist.json', list);
  await safeSendMessage(adminId, `🗑️ ID \`${targetId}\` telah dihapus dari blacklist.`, { parse_mode: 'Markdown' });
});

// === Blacklist: List ===
bot.onText(/\/listblacklist/, async (msg) => {
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId)) return safeSendMessage(adminId, "❌ Kamu bukan admin.");

  const list = loadData('blacklist.json');
  if (!list.length) return safeSendMessage(adminId, "✅ Tidak ada user yang di-blacklist.");

  const lines = list.map((id, i) => `${i + 1}. \`${id}\``).join("\n");
  await safeSendMessage(adminId, `🚫 *Blacklist Saat Ini:*\n\n${lines}`, { parse_mode: 'Markdown' });
});

// === /listadmin (Dipertahankan di memori/config) ===
bot.onText(/\/listadmin/, async (msg) => {
  const userId = msg.from.id;
  if (!ADMIN_IDS.includes(userId))
    return safeSendMessage(userId, "❌ Hanya admin yang bisa melihat daftar admin.");

  if (!ADMIN_IDS.length)
    return safeSendMessage(userId, "📭 Belum ada admin yang terdaftar.");

  let text = "👑 <b>Daftar Admin Aktif (dari config.js):</b>\n";
  for (const id of ADMIN_IDS) {
    text += `• <code>${id}</code>\n`;
  }

  await safeSendMessage(userId, text, { parse_mode: "HTML" });
});

// === /cekid ===
bot.onText(/\/cekid/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const userProfilePhotos = await bot.getUserProfilePhotos(userId, { limit: 1 }).catch(() => null);
    const username = msg.from.username || "-";
    const firstName = msg.from.first_name || "-";
    const lastName = msg.from.last_name || "-";
    const fullName = `${firstName} ${lastName}`.trim();

    let photoFileId = null;
    if (userProfilePhotos && userProfilePhotos.total_count > 0) {
      photoFileId = userProfilePhotos.photos[0][0].file_id;
    }

    const text = `
📝 *INFO DETAIL KAMU*
────────────────────────
👤 Nama: ${fullName}
🆔 ID: \`${userId}\`  
💻 Username: @${username}
────────────────────────
`;

    const replyMarkup = {
      inline_keyboard: [
        [{ text: "𝐁𝐨𝐭 𝐆𝐚𝐜𝐡𝐚 𝐏𝐫𝐞𝐦𝐢𝐮𝐦", url: "https://t.me/gachafreefbot" }]
      ]
    };

    if (photoFileId) {
      await bot.sendPhoto(chatId, photoFileId, { caption: text, parse_mode: "Markdown", reply_markup: replyMarkup });
    } else {
      await safeSendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: replyMarkup });
    }

  } catch (e) {
    await safeSendMessage(chatId, `❌ Terjadi kesalahan saat cek ID: ${e.message}`);
  }
});

// === /ping ===
bot.onText(/\/ping(@\w+)?/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const start = Date.now();
    const pingMsg = await safeSendMessage(chatId, "🏓 *Mengecek status server...*", { parse_mode: "Markdown" });
    if (!pingMsg) return;

    const latency = Date.now() - start;

    let cpuLoad = 0;
    try {
      const cpu = await si.currentLoad();
      cpuLoad = cpu.currentLoad;
    } catch { }

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const uptime = os.uptime();
    const uptimeH = Math.floor(uptime / 3600);
    const uptimeM = Math.floor((uptime % 3600) / 60);

    let status = "";
    if (latency < 100) status = "⚡ *Super Cepat* — server stabil tanpa delay!";
    else if (latency < 300) status = "🚀 *Cukup Cepat* — performa normal.";
    else if (latency < 600) status = "⚠️ *Sedikit Delay* — koneksi agak lambat.";
    else status = "🐢 *Lambat* — mungkin panel/server sedang berat.";

    const text = `
\`\`\`
🏓  Ping Server Bot
────────────────────────
📡  Latency : ${latency} ms
💻  CPU Usage : ${cpuLoad.toFixed(1)}%
🧠  RAM Used : ${(usedMem / 1024 / 1024).toFixed(1)} MB
🗄️  Total RAM : ${(totalMem / 1024 / 1024).toFixed(0)} MB
⏳  Uptime : ${uptimeH} jam ${uptimeM} menit
────────────────────────
${status}
\`\`\`
`;

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: pingMsg.message_id,
      parse_mode: "Markdown"
    });

  } catch (err) {
    console.error(chalk.red("❌ Error /ping:"), err.message);
    try { await safeSendMessage(chatId, "⚠️ Gagal mengecek ping bot."); } catch { }
  }
});

// === /cekhistory ===
bot.onText(/\/cekhistory (\d+)/, async (msg, match) => {
  const userIdAdmin = msg.from.id;

  if (!ADMIN_IDS.includes(userIdAdmin)) {
    return safeSendMessage(userIdAdmin, "🚫 Hanya admin yang bisa menggunakan perintah ini.");
  }

  const userIdTarget = Number(match[1]);
  const users = loadData('users.json');
  const user = users.find(u => u.id === userIdTarget);

  if (!user) return safeSendMessage(userIdAdmin, `❌ User dengan ID ${userIdTarget} tidak ditemukan.`);

  const today = new Date();
  const todayHistory = (user.history || []).filter(h => {
    const hDate = new Date(h.date);
    return hDate.getFullYear() === today.getFullYear() &&
      hDate.getMonth() === today.getMonth() &&
      hDate.getDate() === today.getDate();
  });

  if (!todayHistory.length) {
    return safeSendMessage(userIdAdmin, `ℹ️ User dengan ID ${userIdTarget} belum melakukan gacha hari ini.`);
  }

  const gachaCount = todayHistory.length;
  const itemsList = todayHistory
    .map((h, i) => `${i + 1}. ${h.item} (${h.sumber || 'Limit'}) — ${new Date(h.date).toLocaleTimeString("id-ID")}`)
    .join('\n');

  const message = `
🎰 *History Gacha Hari Ini*
────────────────────────
👤 User ID: ${userIdTarget}
📅 Tanggal: ${today.toLocaleDateString("id-ID")}
🪄 Total Gacha: ${gachaCount} kali

📦 Item yang didapat:
${itemsList}
────────────────────────`;

  await safeSendMessage(userIdAdmin, message, { parse_mode: "Markdown" });
});
bot.onText(/^\/listitem(@\w+)?$/, async (msg) => {
  try {
    const items = loadData('items.json');
    if (!Array.isArray(items) || !items.length)
      return bot.sendMessage(msg.chat.id, '📭 Tidak ada item.');

    // Header dengan box art
    let text = 
`\`\`\`
╔═══════════════════════════════╗
║    🎁 𝗗𝗔𝗙𝗧𝗔𝗥 𝗜𝗧𝗘𝗠 𝗚𝗔𝗖𝗛𝗔    ║
╚═══════════════════════════════╝
\`\`\`

`;

    // Group items per 10 untuk halaman yang rapi
    const itemsPerPage = 10;
    const totalPages = Math.ceil(items.length / itemsPerPage);

    for (let page = 0; page < totalPages; page++) {
      const startIdx = page * itemsPerPage;
      const endIdx = startIdx + itemsPerPage;
      const pageItems = items.slice(startIdx, endIdx);
      
      let pageText = 
`\`\`\`
📄 𝗛𝗮𝗹𝗮𝗺𝗮𝗻 ${page + 1}/${totalPages}
┌─────────────────────────────┐
│ 𝗡𝗼  │ 𝗡𝗮𝗺𝗮 𝗜𝘁𝗲𝗺           │ 𝗧𝗶𝗽𝗲  │
├─────────────────────────────┤
`;

      pageItems.forEach((item, index) => {
        const globalIndex = startIdx + index + 1;
        const itemName = item.name.length > 15 ? item.name.substring(0, 12) + '...' : item.name.padEnd(15);
        const fileExt = path.extname(item.filename).toUpperCase().replace('.', '') || 'FILE';
        const fileType = fileExt.length > 6 ? fileExt.substring(0, 6) : fileExt.padEnd(6);
        
        pageText += `│ ${globalIndex.toString().padStart(2)} │ ${itemName} │ ${fileType} │\n`;
      });

      pageText += 
`└─────────────────────────────┘

📊 𝗧𝗼𝘁𝗮𝗹: ${items.length} 𝗶𝘁𝗲𝗺
🎰 𝗚𝘂𝗻𝗮𝗸𝗮𝗻 /gacha 𝘂𝗻𝘁𝘂𝗸 𝗺𝗲𝗻𝗱𝗮𝗽𝗮𝘁𝗸𝗮𝗻𝗻𝘆𝗮
\`\`\``;

      // Kirim setiap halaman
      await bot.sendMessage(msg.chat.id, pageText, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      // Delay antar pesan untuk hindari rate limit
      if (page < totalPages - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Kirim summary di akhir
    const fileTypes = {};
    items.forEach(item => {
      const ext = path.extname(item.filename).toLowerCase() || '.unknown';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    });

    const summaryText = 
`\`\`\`
📈 𝗦𝗧𝗔𝗧𝗜𝗦𝗧𝗜𝗞 𝗜𝗧𝗘𝗠
┌─────────────────────┐
${Object.entries(fileTypes).map(([ext, count]) => 
  `│ ${ext.replace('.', '').toUpperCase().padEnd(8)} │ ${count.toString().padStart(3)} item │`
).join('\n')}
└─────────────────────┘
🎯 𝗧𝗼𝘁𝗮𝗹 𝗸𝗲𝗺𝘂𝗻𝗴𝗸𝗶𝗻𝗮𝗻: ${items.length} 𝗶𝘁𝗲𝗺
\`\`\``;

    await bot.sendMessage(msg.chat.id, summaryText, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });

  } catch (err) {
    console.error('Error /listitem:', err);
    bot.sendMessage(msg.chat.id, 
`\`\`\`
❌ 𝗘𝗥𝗥𝗢𝗥
┌─────────────────────┐
│ Gagal memuat        │
│ daftar item         │
└─────────────────────┘
\`\`\``, {
      parse_mode: 'Markdown'
    });
  }
});
// === /createcode <limit> ===
bot.onText(/\/createcode (\d+)/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId))
    return safeSendMessage(adminId, "❌ Kamu tidak punya izin.");

  const limit = Number(match[1]);
  if (isNaN(limit) || limit <= 0)
    return safeSendMessage(adminId, "⚠️ Format salah.\nGunakan: /createcode <jumlah_limit>");

  const code = nanoid(8).toUpperCase();
  let codes = loadData('codes.json');

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); // 24 jam

  codes.push({
    code,
    limit,
    used: false,
    usedBy: null,
    createdAt,
    expiresAt,
    expired: false
  });

  saveData('codes.json', codes);

  // 🔔 Kirim ke admin
  await safeSendMessage(
    adminId,
    `✅ *Kode Redeem Berhasil Dibuat!*\n\n🎟️ Code: \`${code}\`\n💎 Limit Tambahan: +${limit}\n🕒 Berlaku hingga: ${expiresAt.toLocaleString("id-ID")}\n\nGunakan dengan perintah:\n/redeem ${code}`,
    { parse_mode: "Markdown" }
  );

  // 📢 Kirim ke Channel
  if (config.CHANNEL_ID) {
    const channelId = config.CHANNEL_ID.startsWith("@")
      ? config.CHANNEL_ID
      : `@${config.CHANNEL_ID}`;

    const channelMsg = `
🎁 *Kode Redeem Baru Tersedia!*
━━━━━━━━━━━━━━━━━━━━━━
🎟️ Kode: \`${code}\`
💎 Bonus: +${limit} Extra Gacha
⏰ Berlaku: 24 Jam Sejak Diumumkan
━━━━━━━━━━━━━━━━━━━━━━
Gunakan perintah:
/redeem ${code}
Untuk menukarkan hadiahnya 🎉
`;

    await safeSendMessage(channelId, channelMsg, { parse_mode: "Markdown" })
      .catch(err => console.error("Gagal kirim ke channel:", err.message));
  }
});


// === /redeem <code> ===
bot.onText(/\/redeem (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name || "Pengguna";
  const inputCode = match[1].trim().toUpperCase();

  let users = loadData('users.json');
  let codes = loadData('codes.json');

  let user = users.find(u => u.id === userId);
  if (!user) {
    user = { id: userId, gachaToday: 0, bonus: 0, extraLimit: 0, history: [], lastDate: new Date().toDateString(), redeemedCodes: [] };
    users.push(user);
  }
  if (!Array.isArray(user.redeemedCodes)) user.redeemedCodes = [];

  const found = codes.find(c => c.code === inputCode);

  if (!found) {
    return safeSendMessage(userId, "❌ Kode tidak ditemukan atau tidak valid.");
  }

  const now = new Date();
  if (found.expired || now > new Date(found.expiresAt)) {
    found.expired = true;
    saveData('codes.json', codes);
    return safeSendMessage(userId, "⏰ Kode ini sudah kedaluwarsa dan tidak bisa digunakan lagi.");
  }

  if (found.used) {
    return safeSendMessage(userId, "⚠️ Kode ini sudah digunakan oleh orang lain dan sudah tidak berlaku.");
  }

  if (user.redeemedCodes.includes(inputCode)) {
    return safeSendMessage(userId, "⚠️ Kamu sudah pernah menukarkan kode ini sebelumnya.");
  }

  // Tandai kode sebagai digunakan
  found.used = true;
  found.usedBy = userId;
  found.redeemedAt = now;

  user.extraLimit = (user.extraLimit || 0) + found.limit;
  user.redeemedCodes.push(inputCode);

  saveData('codes.json', codes);
  saveData('users.json', users);

  // ✅ Kirim ke user
  await safeSendMessage(
    userId,
    `🎉 *Kode Berhasil Ditukarkan!*\n\n✅ Kamu mendapatkan tambahan *${found.limit} Extra Limit Gacha!*\n🪄 Sekarang total Extra Limit kamu: ${user.extraLimit}\n\nGunakan di /gacha sekarang!`,
    { parse_mode: "Markdown" }
  );

  // 📢 Kirim ke Channel jika tersedia
  if (config.CHANNEL_ID) {
    const channelId = config.CHANNEL_ID.startsWith("@")
      ? config.CHANNEL_ID
      : `@${config.CHANNEL_ID}`;

    const channelMsg = `
💥 *Kode Redeem Digunakan!*
━━━━━━━━━━━━━━━━━━━━━━
🎟️ Kode: \`${inputCode}\`
👤 Pengguna: ${username}
💎 Bonus: +${found.limit} Extra Gacha
🕒 Waktu: ${now.toLocaleString("id-ID")}
━━━━━━━━━━━━━━━━━━━━━━
Kode ini sekarang *tidak bisa digunakan lagi*.
`;

    await safeSendMessage(channelId, channelMsg, { parse_mode: "Markdown" })
      .catch(err => console.error("Gagal kirim ke channel:", err.message));
  }
});


// === AUTO EXPIRE CHECK (tiap 1 jam) ===
schedule.scheduleJob("0 * * * *", async () => {
  let codes = loadData('codes.json');
  const now = new Date();
  let expiredNow = [];

  for (const code of codes) {
    if (!code.used && !code.expired && new Date(code.expiresAt) < now) {
      code.expired = true;
      expiredNow.push(code.code);
    }
  }

  if (expiredNow.length > 0) {
    saveData('codes.json', codes);

    for (const adminId of ADMIN_IDS) {
      await safeSendMessage(
        adminId,
        `⏰ *Kode Redeem Kadaluarsa Otomatis:*\n\n${expiredNow.map(c => `- ${c}`).join("\n")}\n\n🕒 Semua kode di atas sudah lebih dari 24 jam dan dinonaktifkan.`,
        { parse_mode: "Markdown" }
      );
    }

    console.log(`🕒 ${expiredNow.length} kode kadaluarsa otomatis (${new Date().toLocaleString("id-ID")})`);
  }
});
// === /addmusik - Tambah musik ke database ===
bot.onText(/\/addmusik/, async (msg) => {
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId))
    return safeSendMessage(adminId, "❌ Kamu tidak punya izin untuk menambah musik.");

  const reply = msg.reply_to_message;
  if (!reply)
    return safeSendMessage(adminId, "📎 *Reply* ke file audio/musik yang ingin ditambahkan.", { parse_mode: "Markdown" });

  const musik = loadData("musik.json");

  try {
    let fileId, fileName, ext = ".mp3", judul;

    // === Deteksi tipe file ===
    if (reply.audio) {
      fileId = reply.audio.file_id;
      fileName = reply.audio.file_name || `musik_${Date.now()}.mp3`;
      ext = path.extname(fileName) || ".mp3";
      judul = reply.audio.title || path.basename(fileName, ext);
    } else if (reply.voice) {
      fileId = reply.voice.file_id;
      fileName = `voice_${Date.now()}.ogg`;
      ext = ".ogg";
      judul = `Voice_${Date.now()}`;
    } else if (reply.document) {
      // Cek jika document adalah file audio
      const mimeType = reply.document.mime_type;
      if (mimeType && mimeType.startsWith('audio/')) {
        fileId = reply.document.file_id;
        fileName = reply.document.file_name || `audio_${Date.now()}`;
        ext = path.extname(fileName) || ".mp3";
        judul = path.basename(fileName, ext);
      } else {
        return safeSendMessage(adminId, "❌ File bukan format audio. Gunakan file MP3, OGG, atau format audio lainnya.");
      }
    } else {
      return safeSendMessage(adminId, "❌ Format tidak didukung. Gunakan *reply* ke file audio, voice, atau dokumen audio.", { parse_mode: "Markdown" });
    }

    // === Cek duplikat ===
    const existingMusik = musik.find(m => m.fileId === fileId);
    if (existingMusik) {
      return safeSendMessage(adminId, `❌ Musik *${existingMusik.judul}* sudah ada di database.`, { parse_mode: "Markdown" });
    }

    // === Unduh file dari Telegram ===
    const fileInfo = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${fileInfo.file_path}`;
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Gagal mengunduh file: ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    // === Simpan ke folder data ===
    const safeFileName = `${judul.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")}${ext}`;
    const savePath = path.join(dataDir, safeFileName);
    fs.writeFileSync(savePath, buffer);

    // === Simpan metadata musik ===
    const musikData = {
      id: nanoid(8),
      judul: judul,
      filename: safeFileName,
      fileId: fileId,
      duration: reply.audio?.duration || reply.voice?.duration || 0,
      addedBy: adminId,
      addedDate: new Date(),
      fileSize: buffer.length
    };

    musik.push(musikData);
    saveData("musik.json", musik);

    // === Kirim notifikasi ke admin ===
    const durationText = musikData.duration ? `${Math.floor(musikData.duration / 60)}:${(musikData.duration % 60).toString().padStart(2, '0')}` : "Unknown";
    const sizeMB = (musikData.fileSize / 1024 / 1024).toFixed(2);

    await safeSendMessage(
      adminId,
      `✅ *Musik berhasil ditambahkan!*\n\n🎵 Judul : *${judul}*\n⏱ Durasi : ${durationText}\n📁 File : \`${safeFileName}\`\n💾 Ukuran : ${sizeMB} MB\n🎫 ID Musik : \`${musikData.id}\``,
      { parse_mode: "Markdown" }
    );

    // === Kirim preview audio ===
    try {
      await bot.sendAudio(adminId, savePath, {
        caption: `🎵 Preview: *${judul}*`,
        parse_mode: "Markdown",
        title: judul,
        duration: musikData.duration
      });
    } catch (e) {
      console.log("⚠️ Gagal kirim pratinjau audio:", e.message);
    }

    console.log(chalk.green(`🎵 Musik "${judul}" berhasil ditambahkan oleh admin ${adminId}`));

  } catch (err) {
    console.error("❌ Gagal add musik:", err);
    safeSendMessage(adminId, `⚠️ *Gagal menambahkan musik:*\n\`\`\`\n${err.message}\n\`\`\``, { parse_mode: "Markdown" });
  }
});
// === /musik - Kirim musik random ===
bot.onText(/\/musik/, async (msg) => {
  const userId = msg.from.id;
  
  // Cek cooldown
  const lastUse = cooldown.get(userId);
  const now = Date.now();
  if (lastUse && now - lastUse < COOLDOWN_TIME) {
    const remaining = ((COOLDOWN_TIME - (now - lastUse)) / 1000).toFixed(1);
    return safeSendMessage(userId, `🕐 Tunggu ${remaining} detik sebelum request musik lagi.`);
  }
  cooldown.set(userId, now);

  const musik = loadData("musik.json");
  
  if (!musik.length) {
    return safeSendMessage(userId, "🎵 Belum ada musik di database. Admin bisa menambah musik dengan /addmusik");
  }

  // Pilih musik random
  const randomMusik = musik[Math.floor(Math.random() * musik.length)];
  const filePath = path.join(dataDir, randomMusik.filename);

  if (!fs.existsSync(filePath)) {
    return safeSendMessage(userId, "❌ File musik tidak ditemukan. Silakan hubungi admin.");
  }

  try {
    // Kirim loading message
    const loadingMsg = await safeSendMessage(userId, "🎵 *Mengirim musik...*", { parse_mode: "Markdown" });

    // Kirim audio
    await bot.sendAudio(userId, filePath, {
      caption: `🎵 *${randomMusik.judul}*`,
      parse_mode: "Markdown",
      title: randomMusik.judul,
      duration: randomMusik.duration
    });

    // Hapus loading message
    if (loadingMsg) {
      await bot.deleteMessage(userId, loadingMsg.message_id).catch(() => {});
    }

    // Log di console
    console.log(chalk.cyan(`🎵 Musik "${randomMusik.judul}" dikirim ke user ${userId}`));

  } catch (err) {
    console.error("❌ Gagal kirim musik:", err);
    safeSendMessage(userId, "❌ Gagal mengirim musik. Silakan coba lagi.");
  }
});
// === /listmusik - Lihat daftar musik ===
bot.onText(/\/listmusik/, async (msg) => {
  const userId = msg.from.id;
  const musik = loadData("musik.json");
  
  if (!musik.length) {
    return safeSendMessage(userId, "🎵 Belum ada musik di database.");
  }

  let text = `🎵 *Daftar Musik (${musik.length} lagu):*\n\n`;
  
  musik.forEach((m, index) => {
    const duration = m.duration ? `${Math.floor(m.duration / 60)}:${(m.duration % 60).toString().padStart(2, '0')}` : "?";
    const sizeMB = m.fileSize ? (m.fileSize / 1024 / 1024).toFixed(2) : "?";
    text += `${index + 1}. *${m.judul}*\n   ⏱ ${duration} | 💾 ${sizeMB} MB | 🆔 ${m.id}\n\n`;
  });

  text += `\nGunakan /musik untuk mendengarkan musik random.`;

  // Split message jika terlalu panjang
  if (text.length > 4000) {
    const chunks = text.match(/[\s\S]{1,4000}/g) || [];
    for (const chunk of chunks) {
      await safeSendMessage(userId, chunk, { parse_mode: "Markdown" });
      await new Promise(r => setTimeout(r, 100));
    }
  } else {
    await safeSendMessage(userId, text, { parse_mode: "Markdown" });
  }
});
// === /delmusik - Hapus musik dari database ===
bot.onText(/\/delmusik(?:\s+(.+))?/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId))
    return safeSendMessage(adminId, "❌ Kamu tidak punya izin untuk menghapus musik.");

  const key = match[1] ? match[1].trim() : null;
  
  if (!key) {
    return safeSendMessage(adminId,
      `🗑 *Cara Hapus Musik*\n\n` +
      `Gunakan: /delmusik <id_atau_judul>\n\n` +
      `Contoh:\n` +
      `/delmusik ABC12345\n` +
      `/delmusik "Judul Lagu"\n\n` +
      `💡 Lihat ID & judul dengan /listmusik`,
      { parse_mode: "Markdown" }
    );
  }

  let musik = loadData("musik.json");
  
  if (!musik.length) {
    return safeSendMessage(adminId, "🎵 Tidak ada musik di database.");
  }

  // Cari berdasarkan ID atau judul
  const index = musik.findIndex(m => 
    m.id === key || 
    m.judul.toLowerCase().includes(key.toLowerCase())
  );

  if (index === -1) {
    // Tampilkan daftar musik yang mirip
    const similar = musik.filter(m => 
      m.judul.toLowerCase().includes(key.toLowerCase()) ||
      m.id.toLowerCase().includes(key.toLowerCase())
    ).slice(0, 5);

    let response = `❌ Musik dengan ID/judul "*${key}*" tidak ditemukan.\n\n`;
    
    if (similar.length > 0) {
      response += `💡 Mungkin yang kamu maksud:\n`;
      similar.forEach(m => {
        response += `• ${m.judul} (ID: ${m.id})\n`;
      });
      response += `\nGunakan ID yang tepat untuk menghapus.`;
    } else {
      response += `💡 Gunakan /listmusik untuk melihat daftar lengkap.`;
    }

    return safeSendMessage(adminId, response, { parse_mode: "Markdown" });
  }

  const deletedMusik = musik[index];
  
  // Konfirmasi penghapusan
  const confirmKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Ya, Hapus", callback_data: `confirm_del_musik_${deletedMusik.id}` },
        { text: "❌ Batal", callback_data: "cancel_del_musik" }
      ]
    ]
  };

  await safeSendMessage(
    adminId, 
    `⚠️ *Konfirmasi Penghapusan Musik*\n\n` +
    `🎵 Judul: *${deletedMusik.judul}*\n` +
    `🎤 Artist: ${deletedMusik.artist}\n` +
    `🆔 ID: \`${deletedMusik.id}\`\n` +
    `📁 File: \`${deletedMusik.filename}\`\n` +
    `🎧 Total Diputar: ${deletedMusik.plays || 0}x\n\n` +
    `Yakin ingin menghapus musik ini?`,
    { 
      parse_mode: "Markdown",
      reply_markup: confirmKeyboard 
    }
  );
});
// === /toko - Menu Beli Limit dengan Coin ===
// Dalam callback_query handler, tambahkan case untuk toko:

// === Fungsi Handle Pembelian Limit ===
async function handleBeliLimit(query) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  
  const paketMap = {
    'beli_2': { limit: 2, harga: 55 },
    'beli_5': { limit: 5, harga: 130 },
    'beli_10': { limit: 10, harga: 250 },
    'beli_25': { limit: 25, harga: 600 },
    'beli_50': { limit: 50, harga: 1150 },
    'beli_100': { limit: 100, harga: 2200 },
    'beli_200': { limit: 200, harga: 4300 },
    'beli_350': { limit: 350, harga: 7400 },
    'beli_500': { limit: 500, harga: 10500 }
  };

  const paket = paketMap[query.data];
  if (!paket) return;

  let users = loadData('users.json');
  let coinTransactions = loadData('coin_transactions.json');
  
  let user = users.find(u => u.id === userId);
  if (!user) {
    await bot.answerCallbackQuery(query.id, { text: '❌ User tidak ditemukan', show_alert: true });
    return;
  }

  // 💡 INIT coin jika belum ada
  if (typeof user.coin !== 'number') user.coin = 0;
  
  const userCoin = user.coin;

  if (userCoin < paket.harga) {
    const kurang = paket.harga - userCoin;
    await bot.answerCallbackQuery(query.id, { 
      text: `❌ Coin tidak cukup! Butuh ${paket.harga}🪙, kamu hanya punya ${userCoin}🪙 (Kurang ${kurang}🪙)`, 
      show_alert: true 
    });
    return;
  }

  // Proses pembelian
  user.coin -= paket.harga;
  user.extraLimit = (user.extraLimit || 0) + paket.limit;
  
  // 💡 Catat transaksi
  coinTransactions.push({
    userId: userId,
    type: 'beli_limit',
    amount: -paket.harga,
    description: `Beli ${paket.limit} limit extra`,
    date: new Date(),
    package: paket.limit
  });
  
  saveData('users.json', users);
  saveData('coin_transactions.json', coinTransactions);

  // Update message
  const successText = `
✅ 𝗣𝗲𝗺𝗯𝗲𝗹𝗶𝗮𝗻 𝗕𝗲𝗿𝗵𝗮𝘀𝗶𝗹!

📦 Paket: ${paket.limit} Extra Limit
💳 Harga: ${paket.harga.toLocaleString("id-ID")} Coin
🪙 Sisa Coin: ${user.coin.toLocaleString("id-ID")}🪙
🎯 Total Extra Limit: ${user.extraLimit}

🛍️ Terima kasih telah berbelanja di Toko Bot Gacha Premium!
`;

  try {
    await bot.editMessageText(successText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Beli Lagi", callback_data: "toko_menu" }],
          [{ text: "🎰 Gacha Sekarang", callback_data: "gacha_sekarang" }],
          [{ text: "🏠 Menu Utama", callback_data: "main_menu" }]
        ]
      }
    });
  } catch (err) {
    console.error('Error edit message:', err.message);
  }

  await bot.answerCallbackQuery(query.id, { 
    text: `✅ Berhasil membeli ${paket.limit} limit!` 
  });

  console.log(chalk.green(`🛒 User ${userId} membeli ${paket.limit} limit dengan ${paket.harga} coin`));
}

// === Fungsi Refresh Toko ===
async function refreshToko(query) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  
  const users = loadData('users.json');
  const user = users.find(u => u.id === userId);
  const userCoin = user?.coin || 0;

  const updatedText = `
🛍️ 𝗧𝗢𝗞𝗢 𝗕𝗢𝗧 𝗚𝗔𝗖𝗛𝗔 𝗣𝗥𝗘𝗠𝗜𝗨𝗠

💰 𝗦𝗮𝗹𝗱𝗼 𝗖𝗼𝗶𝗻 𝗞𝗮𝗺𝘂: *${userCoin.toLocaleString("id-ID")}* 🪙

📦 𝗗𝗮𝗳𝘁𝗮𝗿 𝗣𝗮𝗸𝗲𝘁 𝗟𝗶𝗺𝗶𝘁:

🎯 𝗣𝗮𝗸𝗲𝘁 𝗕𝗮𝘀𝗶𝗰
├ 2 Limit → 55 Coin
├ 5 Limit → 130 Coin  
├ 10 Limit → 250 Coin

🚀 𝗣𝗮𝗸𝗲𝘁 𝗦𝘁𝗮𝗻𝗱𝗮𝗿𝗱
├ 25 Limit → 600 Coin
├ 50 Limit → 1.150 Coin
├ 100 Limit → 2.200 Coin

💎 𝗣𝗮𝗸𝗲𝘁 𝗣𝗿𝗲𝗺𝗶𝘂𝗺  
├ 200 Limit → 4.300 Coin
├ 350 Limit → 7.400 Coin
├ 500 Limit → 10.500 Coin

🔄 Saldo berhasil diupdate!
`;

  try {
    await bot.editMessageText(updatedText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: query.message.reply_markup
    });
  } catch (err) {
    console.error('Error refresh toko:', err.message);
  }

  await bot.answerCallbackQuery(query.id, { text: '🔄 Saldo diperbarui!' });
}

// === Fungsi Info Cara Dapat Coin ===
async function infoCaraDapatCoin(query) {
  const infoText = `
💡 𝗖𝗔𝗥𝗔 𝗗𝗔𝗣𝗔𝗧𝗞𝗔𝗡 𝗖𝗢𝗜𝗡

🎊 𝗕𝗼𝗻𝘂𝘀 𝗧𝗮𝗺𝗯𝗮𝗵 𝗕𝗼𝘁 𝗞𝗲 𝗚𝗿𝘂𝗽
• Tambah bot ke grup yang memiliki minimal 25 member manusia
• Dapatkan 65 Coin secara instan!
• Bot akan otomatis cek jumlah member

👥 𝗕𝗼𝗻𝘂𝘀 𝗜𝗻𝘃𝗶𝘁𝗲 𝗧𝗲𝗺𝗮𝗻
• Bagikan link referralmu ke teman
• Setiap teman yang join lewat linkmu: 88 Coin!
• Semakin banyak teman, semakin banyak coin

🎁 𝗘𝘃𝗲𝗻𝘁 & 𝗚𝗶𝘃𝗲𝗮𝘄𝗮𝘆
• Ikuti event-event dari admin
• Giveaway reguler dengan hadiah coin besar
• Cek channel regularly untuk info event

📣 𝗧𝗶𝗽𝘀 𝗖𝗲𝗽𝗮𝘁 𝗗𝗮𝗽𝗮𝘁 𝗖𝗼𝗶𝗻:
1. Undang bot ke grup-grup aktifmu
2. Share link referral di media sosial
3. Ikuti semua event dari admin
4. Aktif menggunakan bot setiap hari

🛍️ Gunakan coin untuk beli limit extra di /toko!
`;

  await bot.answerCallbackQuery(query.id, { 
    text: '💡 Info cara dapat coin - lihat pesan baru', 
    show_alert: true 
  });

  await safeSendMessage(query.from.id, infoText, { parse_mode: 'Markdown' });
}

bot.onText(/\/toko/, async (msg) => {
  const userId = msg.from.id;
  const users = loadData('users.json');
  
  let user = users.find(u => u.id === userId);
  if (!user) {
    return safeSendMessage(userId, "⚠️ Kamu belum terdaftar. Ketik /start dulu.");
  }

  // 💡 INIT coin jika belum ada
  if (typeof user.coin !== 'number') user.coin = 0;
  
  const userCoin = user.coin || 0;

  const tokoText = `
🛍️ 𝗧𝗢𝗞𝗢 𝗕𝗢𝗧 𝗚𝗔𝗖𝗛𝗔 𝗣𝗥𝗘𝗠𝗜𝗨𝗠

💰 𝗦𝗮𝗹𝗱𝗼 𝗖𝗼𝗶𝗻 𝗞𝗮𝗺𝘂: *${userCoin.toLocaleString("id-ID")}* 🪙

📦 𝗗𝗮𝗳𝘁𝗮𝗿 𝗣𝗮𝗸𝗲𝘁 𝗟𝗶𝗺𝗶𝘁:

🎯 𝗣𝗮𝗸𝗲𝘁 𝗕𝗮𝘀𝗶𝗰
├ 2 Limit → 55 Coin
├ 5 Limit → 130 Coin  
├ 10 Limit → 250 Coin

🚀 𝗣𝗮𝗸𝗲𝘁 𝗦𝘁𝗮𝗻𝗱𝗮𝗿𝗱
├ 25 Limit → 600 Coin
├ 50 Limit → 1.150 Coin
├ 100 Limit → 2.200 Coin

💎 𝗣𝗮𝗸𝗲𝘁 𝗣𝗿𝗲𝗺𝗶𝘂𝗺  
├ 200 Limit → 4.300 Coin
├ 350 Limit → 7.400 Coin
├ 500 Limit → 10.500 Coin

📈 𝗦𝗲𝗺𝗮𝗸𝗶𝗻 𝗯𝗮𝗻𝘆𝗮𝗸 𝗯𝗲𝗹𝗶, 𝗵𝗮𝗿𝗴𝗮 𝗺𝗮𝗸𝗶𝗻 𝗺𝘂𝗿𝗮𝗵!

💡 𝗖𝗮𝗿𝗮 𝗗𝗮𝗽𝗮𝘁𝗸𝗮𝗻 𝗖𝗼𝗶𝗻:
• 🎉 Tambah bot ke grup (25+ member) → 65 Coin
• 👥 Invite teman → 88 Coin/teman
• 🎁 Event & giveaway dari admin
`;

  const keyboard = {
    inline_keyboard: [
      // Baris 1: Paket Basic
      [
        { text: "🛒 2 Limit (55🪙)", callback_data: "beli_2" },
        { text: "🛒 5 Limit (130🪙)", callback_data: "beli_5" },
        { text: "🛒 10 Limit (250🪙)", callback_data: "beli_10" }
      ],
      // Baris 2: Paket Standard
      [
        { text: "🚀 25 Limit (600🪙)", callback_data: "beli_25" },
        { text: "🚀 50 Limit (1.150🪙)", callback_data: "beli_50" },
        { text: "🚀 100 Limit (2.200🪙)", callback_data: "beli_100" }
      ],
      // Baris 3: Paket Premium
      [
        { text: "💎 200 Limit (4.300🪙)", callback_data: "beli_200" },
        { text: "💎 350 Limit (7.400🪙)", callback_data: "beli_350" },
        { text: "💎 500 Limit (10.500🪙)", callback_data: "beli_500" }
      ],
      // Baris 4: Info & Refresh
      [
        { text: "🔄 Refresh Saldo", callback_data: "refresh_toko" },
        { text: "📊 Cara Dapat Coin", callback_data: "info_coin" },
        { text: "🏠 Menu Utama", callback_data: "main_menu" }
      ]
    ]
  };

  await safeSendMessage(userId, tokoText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
});
// === /tourl - Upload file ke Catbox ===
bot.onText(/\/tourl/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  // Cek cooldown
  const lastUse = cooldown.get(userId);
  const now = Date.now();
  if (lastUse && now - lastUse < 30000) { // 30 detik cooldown
    const remaining = ((30000 - (now - lastUse)) / 1000).toFixed(1);
    return safeSendMessage(chatId, `⏳ Tunggu ${remaining} detik sebelum upload lagi.`);
  }
  cooldown.set(userId, now);

  const reply = msg.reply_to_message;
  if (!reply) {
    return safeSendMessage(chatId,
`\`\`\`
📤 𝗨𝗣𝗟𝗢𝗔𝗗 𝗞𝗘 𝗖𝗔𝗧𝗕𝗢𝗫
┌─────────────────────┐
│ Cara penggunaan:    │
│                     │
│ Reply file dengan   │
│ /tourl              │
│                     │
│ Supported formats:  │
│ • Gambar (JPG, PNG) │
│ • Video (MP4, MOV)  │
│ • Audio (MP3, OGG)  │
│ • File (PDF, ZIP)   │
└─────────────────────┘
\`\`\``, { parse_mode: 'Markdown' });
  }

  try {
    // Kirim status processing
    const processingMsg = await safeSendMessage(chatId,
`\`\`\`
📤 𝗠𝗘𝗡𝗚𝗨𝗣𝗟𝗢𝗔𝗗...
┌─────────────────────┐
│ Memproses file...   │
│                     │
│ Mohon tunggu...     │
└─────────────────────┘
\`\`\``, { parse_mode: 'Markdown' });

    let fileId, fileName, fileType, mimeType;

    // Deteksi tipe file
    if (reply.document) {
      fileId = reply.document.file_id;
      fileName = reply.document.file_name || 'file.bin';
      fileType = 'document';
      mimeType = reply.document.mime_type;
    } else if (reply.photo) {
      fileId = reply.photo[reply.photo.length - 1].file_id; // Highest quality
      fileName = `photo_${Date.now()}.jpg`;
      fileType = 'photo';
      mimeType = 'image/jpeg';
    } else if (reply.video) {
      fileId = reply.video.file_id;
      fileName = reply.video.file_name || `video_${Date.now()}.mp4`;
      fileType = 'video';
      mimeType = reply.video.mime_type;
    } else if (reply.audio) {
      fileId = reply.audio.file_id;
      fileName = reply.audio.file_name || `audio_${Date.now()}.mp3`;
      fileType = 'audio';
      mimeType = reply.audio.mime_type;
    } else if (reply.voice) {
      fileId = reply.voice.file_id;
      fileName = `voice_${Date.now()}.ogg`;
      fileType = 'voice';
      mimeType = 'audio/ogg';
    } else if (reply.sticker) {
      fileId = reply.sticker.file_id;
      fileName = `sticker_${Date.now()}.webp`;
      fileType = 'sticker';
      mimeType = 'image/webp';
    } else {
      if (processingMsg) await bot.deleteMessage(chatId, processingMsg.message_id);
      return safeSendMessage(chatId,
`\`\`\`
❌ 𝗙𝗢𝗥𝗠𝗔𝗧 𝗧𝗜𝗗𝗔𝗞 𝗗𝗜𝗗𝗨𝗞𝗨𝗡𝗚
┌─────────────────────┐
│ Format file tidak   │
│ didukung!           │
│                     │
│ Gunakan:            │
│ • Gambar            │
│ • Video             │
│ • Audio             │
│ • Document          │
└─────────────────────┘
\`\`\``, { parse_mode: 'Markdown' });
    }

    // Update status
    if (processingMsg) {
      await bot.editMessageText(
`\`\`\`
📤 𝗠𝗘𝗡𝗚𝗨𝗣𝗟𝗢𝗔𝗗...
┌─────────────────────┐
│ Mengunduh file...   │
│                     │
│ ${fileName}         │
└─────────────────────┘
\`\`\``, {
        chat_id: chatId,
        message_id: processingMsg.message_id,
        parse_mode: 'Markdown'
      });
    }

    // Download file dari Telegram
    const fileInfo = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${fileInfo.file_path}`;
    
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Gagal download file: ${response.statusText}`);
    
    const fileBuffer = await response.arrayBuffer();
    const fileSize = fileBuffer.byteLength;

    // Update status - Uploading
    if (processingMsg) {
      await bot.editMessageText(
`\`\`\`
📤 𝗠𝗘𝗡𝗚𝗨𝗣𝗟𝗢𝗔𝗗...
┌─────────────────────┐
│ Mengupload ke       │
│ Catbox...           │
│                     │
│ ${(fileSize / 1024 / 1024).toFixed(2)} MB │
└─────────────────────┘
\`\`\``, {
        chat_id: chatId,
        message_id: processingMsg.message_id,
        parse_mode: 'Markdown'
      });
    }

    // Upload ke Catbox
    const formData = new FormData();
    const blob = new Blob([Buffer.from(fileBuffer)], { type: mimeType });
    formData.append('fileToUpload', blob, fileName);
    formData.append('reqtype', 'fileupload');

    const uploadResponse = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`Gagal upload ke Catbox: ${uploadResponse.status}`);
    }

    const catboxUrl = await uploadResponse.text();

    // Hapus processing message
    if (processingMsg) {
      await bot.deleteMessage(chatId, processingMsg.message_id);
    }

    // Kirim hasil
    const fileExtension = path.extname(fileName).toUpperCase().replace('.', '') || 'FILE';
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
    
    const resultText =
`\`\`\`
✅ 𝗨𝗣𝗟𝗢𝗔𝗗 𝗕𝗘𝗥𝗛𝗔𝗦𝗜𝗟!
┌─────────────────────┐
│ 📁 ${fileExtension.padEnd(15)} │
│ 💾 ${fileSizeMB} MB${' '.repeat(11)}│
│ 🕒 ${new Date().toLocaleTimeString('id-ID')}${' '.repeat(7)}│
└─────────────────────┘
🌐 𝗟𝗶𝗻𝗸: ${catboxUrl}

💡 𝗧𝗶𝗽: Link akan expire dalam 24 jam
\`\`\``;

    await safeSendMessage(chatId, resultText, { parse_mode: 'Markdown' });

    // Log activity
    console.log(chalk.cyan(`📤 User ${userId} upload ${fileType} ke ${catboxUrl} (${fileSizeMB}MB)`));

  } catch (error) {
    console.error('❌ Error /tourl:', error);
    
    // Hapus processing message jika ada
    const processingMsg = await safeSendMessage(chatId, '🔄 Menghapus...');
    if (processingMsg) {
      await bot.deleteMessage(chatId, processingMsg.message_id);
    }

    let errorMessage = '❌ Gagal mengupload file. ';
    
    if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMessage += 'Masalah koneksi internet.';
    } else if (error.message.includes('too large')) {
      errorMessage += 'File terlalu besar (max 200MB).';
    } else if (error.message.includes('Catbox')) {
      errorMessage += 'Server Catbox sedang bermasalah.';
    } else {
      errorMessage += 'Coba lagi nanti.';
    }

    await safeSendMessage(chatId,
`\`\`\`
❌ 𝗚𝗔𝗚𝗔𝗟 𝗨𝗣𝗟𝗢𝗔𝗗
┌─────────────────────┐
│ ${errorMessage.split(' ').slice(0, 8).join(' ')} │
│                     │
│ Coba lagi nanti!    │
└─────────────────────┘
\`\`\``, { parse_mode: 'Markdown' });
  }
});

// === /tourlhelp - Bantuan penggunaan ===
bot.onText(/\/tourlhelp/, async (msg) => {
  const chatId = msg.chat.id;
  
  const helpText =
`\`\`\`
📤 𝗕𝗔𝗡𝗧𝗨𝗔𝗡 𝗨𝗣𝗟𝗢𝗔𝗗 𝗖𝗔𝗧𝗕𝗢𝗫
┌─────────────────────┐
│ CARA PENGGUNAAN:    │
│                     │
│ 1. Reply file       │
│    dengan /tourl    │
│ 2. Tunggu proses    │
│ 3. Dapatkan link!   │
│                     │
│ FORMAT DIDUKUNG:    │
│ • Gambar (JPG/PNG)  │
│ • Video (MP4/MOV)   │
│ • Audio (MP3/OGG)   │
│ • File (PDF/ZIP)    │
│ • Sticker (WEBP)    │
│                     │
│ ⚠️  BATASAN:        │
│ • Max 200MB/file    │
│ • Cooldown 30 detik │
│ • Expire 24 jam     │
└─────────────────────┘
🎯 𝗖𝗼𝗻𝘁𝗼𝗵: Reply foto ini dengan /tourl
\`\`\``;

  // Kirim contoh gambar
  await bot.sendPhoto(chatId, 'https://files.catbox.moe/8u13f4.png', {
    caption: helpText,
    parse_mode: 'Markdown'
  }).catch(async () => {
    // Fallback ke text saja jika gagal kirim gambar
    await safeSendMessage(chatId, helpText, { parse_mode: 'Markdown' });
  });
});
// === /help - Menu Bantuan Lengkap ===
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isAdmin = ADMIN_IDS.includes(userId);

  const helpText = `
🎯 𝗕𝗢𝗧 𝗚𝗔𝗖𝗛𝗔 𝗣𝗥𝗘𝗠𝗜𝗨𝗠 - 𝗠𝗘𝗡𝗨 𝗕𝗔𝗡𝗧𝗨𝗔𝗡 🎯

🤖 𝗙𝗶𝘁𝘂𝗿 𝗨𝘁𝗮𝗺𝗮 𝗚𝗮𝗰𝗵𝗮:
├ /gacha - Main gacha untuk mendapatkan item random
├ /history - Lihat riwayat gacha kamu (10 terbaru)
├ /listitem - Daftar semua item gacha yang tersedia
├ /mystat - Cek statistik dan coin kamu
├ /leaderboard - Top 10 pemain gacha terbanyak

🪙 Sistem Coin & Toko:
├ /toko - Beli limit tambahan dengan coin
├ /cekid - Cek ID Telegram kamu
├ /ping - Test kecepatan bot

📤 𝗧𝗼𝗼𝗹𝘀 𝗨𝗽𝗹𝗼𝗮𝗱:
├ /tourl - Upload file ke Catbox (reply ke file)
├ /tourlhelp - Bantuan penggunaan upload
├ /musik - Dengarkan musik random dari database

🔗 𝗥𝗲𝗳𝗲𝗿𝗿𝗮𝗹 & 𝗕𝗼𝗻𝘂𝘀:
├ /start - Menu utama dengan link referral
├ Invite teman dapat 88 coin per orang
├ Add bot ke grup (25+ member) dapat 65 coin

🎵 𝗙𝗶𝘁𝘂𝗿 𝗠𝘂𝘀𝗶𝗸:
├ /musik - Putar musik random dari database
├ /listmusik - Lihat daftar musik tersedia
${isAdmin ? `
⚡ 𝗔𝗱𝗺𝗶𝗻 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀:
├ /additem - Tambah item gacha (reply file)
├ /addgiv - Tambah item + broadcast (reply file)
├ /delitem - Hapus item gacha
├ /clearitems - Hapus semua item
├ /addmusik - Tambah musik ke database
├ /delmusik - Hapus musik dari database
├ /createcode - Buat kode redeem limit
├ /addlimit - Tambah limit ke user
├ /addlimitall - Tambah limit ke semua user
├ /hapuslimit - Reset limit user
├ /broadcast - Broadcast ke semua user
├ /bcgrub - Broadcast ke semua grup
├ /backup - Backup data bot
├ /blacklist - Blacklist user
├ /delblacklist - Hapus blacklist
├ /listblacklist - Lihat blacklist
├ /checkstat - Cek stat user
├ /cekhistory - Cek history user
├ /infogrub - Info grup bot
` : ''}
\`\`\`
💎 𝗖𝗮𝗿𝗮 𝗗𝗮𝗽𝗮𝘁 𝗖𝗼𝗶𝗻:
┌───────────────────────────────────┐
│ 1. Invite Teman    → 88 coin/orang    │ 
│ 2. Add ke Grup    → 65 coin/grup     │ 
│ 3. Event Admin    → Coin bonus       │ 
│ 4. Kode rendam   → 50 - 1000 coin   │ 
└───────────────────────────────────┘

🎰 𝗖𝗮𝗿𝗮 𝗠𝗮𝗶𝗻 𝗚𝗮𝗰𝗵𝗮:
1. Ketik /gacha untuk main
2. Dapatkan item random
3. Gunakan bonus/redeem untuk main lagi
4. Invite teman untuk dapat coin tambahan

📊 𝗟𝗶𝗺𝗶𝘁 𝗛𝗮𝗿𝗶𝗮𝗻:
• Default: ${config.GACHA_LIMIT || 5} gacha/hari
• Bonus: Dari invite & add grup
• Extra: Beli di /toko dengan coin

🔧 𝗦𝘂𝗽𝗽𝗼𝗿𝘁 & 𝗜𝗻𝗳𝗼:
• Developer: @${config.OWNER_USERNAME}
• Channel: @${config.CHANNEL_ID?.replace('@', '') || 'Channel'}
• Version: 2.0 Premium

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 𝗧𝗶𝗽𝘀:
• Gunakan /tourl untuk share file besar
• Cek /toko regularly untuk beli limit
• Follow channel untuk info terbaru
• Laporkan bug ke developer

🎊 𝗦𝗲𝗹𝗮𝗺𝗮𝘁 𝗕𝗲𝗿𝗺𝗮𝗶𝗻 𝗱𝗮𝗻 𝗦𝗲𝗺𝗼𝗴𝗮 𝗕𝗲𝗿𝘂𝗻𝘁𝘂𝗻𝗴! 🎊
\`\`\``;

  // Keyboard untuk menu help
  const helpKeyboard = {
    inline_keyboard: [
      [
        { text: "🎰 Gacha Sekarang", callback_data: "gacha_sekarang" },
        { text: "🛍️ Toko", callback_data: "toko_menu" }
      ],
      [
        { text: "📤 Upload File", callback_data: "tourl_help" },
        { text: "🎵 Random Musik", callback_data: "random_musik" }
      ],
      [
        { text: "📊 Stat Saya", callback_data: "my_stat" },
        { text: "🏆 Leaderboard", callback_data: "leaderboard_menu" }
      ],
      [
        { text: "🔙 Menu Utama", callback_data: "main_menu" }
      ]
    ]
  };

  await safeSendMessage(chatId, helpText, {
    parse_mode: 'Markdown',
    reply_markup: helpKeyboard,
    disable_web_page_preview: true
  });
});

  
  

// === /cmd - Daftar command singkat ===
bot.onText(/\/cmd/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isAdmin = ADMIN_IDS.includes(userId);

  const cmdText = `
⚡ 𝗤𝗨𝗜𝗖𝗞 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦 ⚡

🎰 𝗚𝗮𝗰𝗵𝗮: /gacha /history /listitem /mystat /leaderboard
🪙 𝗖𝗼𝗶𝗻: /toko /cekid /ping
📤 𝗧𝗼𝗼𝗹𝘀: /tourl /musik /listmusik
🔗 𝗟𝗮𝗶𝗻𝗻𝘆𝗮: /start /help

${isAdmin ? `⚡ *Admin:* /additem /addgiv /delitem /broadcast /backup` : ''}

💡 Ketik /help untuk penjelasan lengkap
`;

  await safeSendMessage(chatId, cmdText, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
});
// === /redeem - Klaim kode redeem untuk coin ===
bot.onText(/\/redeem (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const inputCode = match[1].trim().toUpperCase();

  // Validasi format kode
  if (!inputCode || inputCode.length < 6) {
    return safeSendMessage(chatId,
`❌ 𝗙𝗼𝗿𝗺𝗮𝘁 𝗞𝗼𝗱𝗲 𝗧𝗶𝗱𝗮𝗸 𝗩𝗮𝗹𝗶d!

𝗞𝗼𝗱𝗲 𝗿𝗲𝗱𝗲𝗲𝗺 𝗵𝗮𝗿𝘂𝘀 𝘁𝗲𝗿𝗱𝗶𝗿𝗶 𝗱𝗮𝗿𝗶:
• Minimal 6 karakter
• Huruf dan angka saja
• Contoh: AS56DG, X1Y2Z3

💡 Gunakan kode yang valid dari channel/grup.`);
  }

  let users = loadData('users.json');
  let redeemCodes = loadData('redeem.json');
  let coinTransactions = loadData('coin_transactions.json');

  // Cari user
  let user = users.find(u => u.id === userId);
  if (!user) {
    user = {
      id: userId,
      gachaToday: 0,
      bonus: 0,
      history: [],
      lastDate: new Date().toDateString(),
      extraLimit: 0,
      redeemedCodes: [],
      coin: 0
    };
    users.push(user);
  }

  // Init coin jika belum ada
  if (typeof user.coin !== 'number') user.coin = 0;
  if (!Array.isArray(user.redeemedCodes)) user.redeemedCodes = [];

  // Cari kode redeem
  const redeemCode = redeemCodes.find(rc => rc.code === inputCode);

  if (!redeemCode) {
    return safeSendMessage(chatId,
`❌ 𝗞𝗼𝗱𝗲 𝗧𝗶𝗱𝗮𝗸 𝗗𝗶𝘁𝗲𝗺𝘂𝗸𝗮𝗻!

𝗞𝗼𝗱𝗲 ${inputCode} 𝘁𝗶𝗱𝗮𝗸 𝘃𝗮𝗹𝗶𝗱 𝗮𝘁𝗮𝘂 𝘁𝗶𝗱𝗮𝗸 𝗮𝗱𝗮.

💡 Pastikan:
• Kode sudah benar
• Belum expired
• Masih ada kuota`);
  }

  // Cek expired
  const now = new Date();
  if (redeemCode.expiresAt && new Date(redeemCode.expiresAt) < now) {
    return safeSendMessage(chatId,
`⏰ 𝗞𝗼𝗱𝗲 𝗦𝘂𝗱𝗮𝗵 𝗘𝘅𝗽𝗶𝗿𝗲𝗱!

Kode ${inputCode} sudah tidak berlaku.

🕒 Masa aktif: ${new Date(redeemCode.expiresAt).toLocaleDateString('id-ID')}`);
  }

  // Cek kuota
  if (redeemCode.usedCount >= redeemCode.userLimit) {
    return safeSendMessage(chatId,
`🎫 𝗞𝘂𝗼𝘁𝗮 𝗛𝗮𝗯𝗶𝘀!

𝗞𝗼𝗱𝗲 ${inputCode} 𝘀𝘂𝗱𝗮𝗵 𝗱𝗶𝗴𝘂𝗻𝗮𝗸𝗮𝗻 𝗼𝗹𝗲𝗵 ${redeemCode.usedCount} 𝘂𝘀𝗲𝗿.

📊 𝗞𝘂𝗼𝘁𝗮 maks𝟯imal: ${redeemCode.userLimit} 𝘂𝘀𝗲𝗿`);
  }

  // Cek apakah user sudah pakai kode ini
  if (user.redeemedCodes.includes(inputCode)) {
    return safeSendMessage(chatId,
`⚠️ 𝗞𝗼𝗱𝗲 𝗦𝘂𝗱𝗮𝗵 𝗗𝗶𝗴𝘂𝗻𝗮𝗸𝗮𝗻!

𝗞𝗮𝗺𝘂 𝘀𝘂𝗱𝗮𝗵 𝗺𝗲𝗻𝗴𝗴𝘂𝗻𝗮𝗸𝗮𝗻 𝗸𝗼𝗱𝗲 ${inputCode} 𝘀𝗲𝗯𝗲𝗹𝘂𝗺𝗻𝘆𝗮.

💡 Setiap kode hanya bisa digunakan 1x per user.`);
  }

  // PROSES REDEEM
  const coinEarned = redeemCode.coin;

  // Update user
  user.coin += coinEarned;
  user.redeemedCodes.push(inputCode);

  // Update redeem code
  redeemCode.usedCount += 1;
  redeemCode.usedBy.push({
    userId: userId,
    username: msg.from.username || msg.from.first_name,
    redeemedAt: new Date()
  });

  // Catat transaksi
  coinTransactions.push({
    userId: userId,
    type: 'redeem_code',
    amount: coinEarned,
    description: `Redeem code: ${inputCode}`,
    date: new Date(),
    code: inputCode
  });

  // Simpan data
  saveData('users.json', users);
  saveData('redeem.json', redeemCodes);
  saveData('coin_transactions.json', coinTransactions);

  // Kirim notifikasi sukses
  const successText =
`🎉 *𝗥𝗘𝗗𝗘𝗘𝗠 𝗕𝗘𝗥𝗛𝗔𝗦𝗜𝗟!*

💰 +${coinEarned} 𝗖𝗼𝗶𝗻 𝘁𝗲𝗹𝗮𝗵 𝗱𝗶𝘁𝗮𝗺𝗯𝗮𝗵𝗸𝗮𝗻!
🪙 𝗧𝗼𝘁𝗮𝗹 𝗰𝗼𝗶𝗻 𝗸𝗮𝗺𝘂 𝘀𝗲𝗸𝗮𝗿𝗮𝗻𝗴: *${user.coin}*

🎫 𝗞𝗼𝗱𝗲: ${inputCode}
📊 𝗗𝗶𝗴𝘂𝗻𝗮𝗸𝗮𝗻: ${redeemCode.usedCount}/${redeemCode.userLimit}

💎 𝗚𝘂𝗻𝗮𝗸𝗮𝗻 𝗰𝗼𝗶𝗻 𝘂𝗻𝘁𝘂𝗸 𝗯𝗲𝗹𝗶 𝗹𝗶𝗺𝗶𝘁 𝗱𝗶 /toko`;

  await safeSendMessage(chatId, successText, { parse_mode: 'Markdown' });

  // Broadcast ke channel & group
  await broadcastRedeemSuccess(inputCode, coinEarned, userId, msg.from.username || msg.from.first_name, redeemCode.usedCount, redeemCode.userLimit);

  console.log(chalk.green(`🎫 User ${userId} redeem code ${inputCode} dapat ${coinEarned} coin`));
});

// === /addredeem - Tambah kode redeem (Admin) ===
bot.onText(/\/addredeem (.+)/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId)) {
    return safeSendMessage(adminId, "❌ Kamu tidak punya izin untuk menambah kode redeem.");
  }

  const params = match[1].split(',');
  if (params.length !== 3) {
    return safeSendMessage(adminId,
`❌ 𝗙𝗼𝗿𝗺𝗮𝘁 𝗦𝗮𝗹𝗮𝗵!

𝗚𝘂𝗻𝗮𝗸𝗮𝗻: /addredeem KODE,COIN,LIMIT_USER

Contoh:
/addredeem AS56DG,50,10
/addredeem BONUS100,100,5
/addredeem SPECIAL500,500,3

💡 Kode: Huruf/angka kapital
💡 Coin: 50-1000
💡 Limit: Jumlah user yang bisa pakai`);
  }

  const [rawCode, coinStr, limitStr] = params.map(p => p.trim());
  const code = rawCode.toUpperCase();
  const coin = parseInt(coinStr);
  const userLimit = parseInt(limitStr);

  // Validasi input
  if (!code.match(/^[A-Z0-9]{6,12}$/)) {
    return safeSendMessage(adminId,
`❌ 𝗙𝗼𝗿𝗺𝗮𝘁 𝗞𝗼𝗱𝗲 𝗦𝗮𝗹𝗮𝗵!

Kode harus:
• 6-12 karakter
• Huruf/angka saja
• Tidak ada spasi/simbol

Contoh: AS56DG, BONUS100, SPECIAL500`);
  }

  if (isNaN(coin) || coin < 50 || coin > 1000) {
    return safeSendMessage(adminId,
`❌ 𝗝𝘂𝗺𝗹𝗮𝗵 𝗖𝗼𝗶𝗻 𝗜𝗻𝘃𝗮𝗹𝗶𝗱!

Coin harus antara *50-1000*

Contoh: 50, 100, 250, 500, 1000`);
  }

  if (isNaN(userLimit) || userLimit < 1 || userLimit > 1000) {
    return safeSendMessage(adminId,
`❌ 𝗟𝗶𝗺𝗶𝘁 𝗨𝘀𝗲𝗿 𝗜𝗻𝘃𝗮𝗹𝗶𝗱!

𝗟𝗶𝗺𝗶𝘁 𝘂𝘀𝗲𝗿 𝗵𝗮𝗿𝘂𝘀 𝗮𝗻𝘁𝗮𝗿𝗮 1-1000

𝗖𝗼𝗻𝘁𝗼𝗵: 10, 50, 100`);
  }

  let redeemCodes = loadData('redeem.json');

  // Cek kode duplikat
  if (redeemCodes.find(rc => rc.code === code)) {
    return safeSendMessage(adminId,
`❌ *Kode Sudah Ada!*

𝗞𝗼𝗱𝗲 ${code} 𝘀𝘂𝗱𝗮𝗵 𝗮𝗱𝗮 𝗱𝗶 𝗱𝗮𝘁𝗮𝗯𝗮𝘀𝗲.

💡 𝗚𝘂𝗻𝗮𝗸𝗮𝗻 𝗸𝗼𝗱𝗲 𝘆𝗮𝗻𝗴 𝗯𝗲𝗿𝗯𝗲𝗱𝗮.`);
  }

  // Buat kode redeem baru
  const newRedeem = {
    code: code,
    coin: coin,
    userLimit: userLimit,
    usedCount: 0,
    usedBy: [],
    createdBy: adminId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 hari
    isActive: true
  };

  redeemCodes.push(newRedeem);
  saveData('redeem.json', redeemCodes);

  // Kirim konfirmasi ke admin
  const adminText =
`✅ 𝗞𝗢𝗗𝗘 𝗥𝗘𝗗𝗘𝗘𝗠 𝗕𝗘𝗥𝗛𝗔𝗦𝗜𝗟 𝗗𝗜𝗧𝗔𝗠𝗕𝗔𝗛𝗞𝗔𝗡!

🎫 𝗞𝗼𝗱𝗲: ${code}
💰 𝗖𝗼𝗶𝗻: ${coin}
👥 𝗟𝗶𝗺𝗶𝘁: ${userLimit} 𝘂𝘀𝗲𝗿
🕒 𝗘𝘅𝗽𝗶𝗿𝗲𝘀: ${new Date(newRedeem.expiresAt).toLocaleDateString('id-ID')}

📊 𝗧𝗼𝘁𝗮𝗹 𝗸𝗼𝗱𝗲 𝗮𝗸𝘁𝗶𝗳: ${redeemCodes.length}

🚀 𝗞𝗼𝗱𝗲 𝗮𝗸𝗮𝗻 𝗱𝗶𝘂𝗺𝘂𝗺𝗸𝗮𝗻 𝗸𝗲 𝗰𝗵𝗮𝗻𝗻𝗲𝗹 & 𝗴𝗿𝗼𝘂𝗽!`;

  await safeSendMessage(adminId, adminText, { parse_mode: 'Markdown' });

  // Broadcast kode baru ke channel & group
  await broadcastNewRedeemCode(code, coin, userLimit);

  console.log(chalk.blue(`🎫 𝗔𝗱𝗺𝗶𝗻 ${adminId} 𝗮𝗱𝗱𝗲𝗱 𝗿𝗲𝗱𝗲𝗲𝗺 𝗰𝗼𝗱𝗲: ${code} (${coin} 𝗰𝗼𝗶𝗻, ${userLimit} 𝘂𝘀𝗲𝗿𝘀)`));
});

// === Fungsi Broadcast Kode Redeem Baru ===
async function broadcastNewRedeemCode(code, coin, userLimit) {
  const broadcastText =
`🎉 𝗞𝗢𝗗𝗘 𝗥𝗘𝗗𝗘𝗘𝗠 𝗕𝗔𝗥𝗨 𝗧𝗘𝗥𝗦𝗘𝗗𝗜𝗔!

💰 𝗗𝗮𝗽𝗮𝘁𝗸𝗮𝗻 ${coin} 𝗖𝗼𝗶𝗻 𝗚𝗥𝗔𝗧𝗜𝗦!
🎫 𝗞𝗼𝗱𝗲: ${code}
👥 𝗨𝗻𝘁𝘂𝗸 ${userLimit} 𝘂𝘀𝗲𝗿 𝗽𝗲𝗿𝘁𝗮𝗺𝗮

💡 𝗖𝗮𝗿𝗮 𝗽𝗮𝗸𝗮𝗶:
\`\`\`
/redeem ${code}
\`\`\`

⏰ 𝗖𝗲𝗽𝗮𝘁 𝗸𝗹𝗮𝗶𝗺 𝘀𝗲𝗯𝗲𝗹𝘂𝗺 𝗸𝗲𝗵𝗮𝗯𝗶𝘀𝗮𝗻!
🕒 𝗘𝘅𝗽𝗶𝗿𝗲𝘀: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID')}

🎊 𝗦𝗲𝗹𝗮𝗺𝗮𝘁 𝗸𝗲𝗽𝗮𝗱𝗮 𝘆𝗮𝗻𝗴 𝗯𝗲𝗿𝗵𝗮𝘀𝗶𝗹 𝗸𝗹𝗮𝗶𝗺!`;

  // Broadcast ke channel
  if (config.CHANNEL_ID) {
    try {
      await safeSendMessage(config.CHANNEL_ID, broadcastText, { parse_mode: 'Markdown' });
      console.log(chalk.green(`📢 Redeem code ${code} announced to channel`));
    } catch (error) {
      console.log(chalk.red(`❌ Gagal kirim ke channel: ${error.message}`));
    }
  }

  // Broadcast ke semua group
  const chats = loadData('chats.json');
  let groupSent = 0;
  
  for (const group of chats) {
    try {
      await safeSendMessage(group.id, broadcastText, { parse_mode: 'Markdown' });
      groupSent++;
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Gagal kirim ke group ${group.id}: ${error.message}`));
    }
  }

  console.log(chalk.green(`📢 Redeem code ${code} announced to ${groupSent}/${chats.length} groups`));
}

// === Fungsi Broadcast Redeem Success ===
async function broadcastRedeemSuccess(code, coin, userId, username, usedCount, userLimit) {
  const broadcastText =
`🎊 𝗦𝗘𝗟𝗔𝗠𝗔𝗧! 𝗥𝗘𝗗𝗘𝗘𝗠 𝗕𝗘𝗥𝗛𝗔𝗦𝗜𝗟

👤 𝗨𝘀𝗲𝗿: ${username || 'Anonymous'}
💰 𝗖𝗼𝗶𝗻: +${coin}
🎫 𝗞𝗼𝗱𝗲: ${code}
📊 𝗣𝗿𝗼𝗴𝗿𝗲𝘀𝘀: ${usedCount}/${userLimit}

💎 𝗦𝗲𝗺𝗮𝗸𝗶𝗻 𝗰𝗲𝗽𝗮𝘁, 𝘀𝗲𝗺𝗮𝗸𝗶𝗻 𝗱𝗮𝗽𝗮𝘁!

🎯 𝗖𝗲𝗸 𝗸𝗼𝗱𝗲 𝗿𝗲𝗱𝗲𝗲𝗺 𝗹𝗮𝗶𝗻𝗻𝘆𝗮 𝗱𝗶 𝗰𝗵𝗮𝗻𝗻𝗲𝗹!`;

  // Broadcast ke channel
  if (config.CHANNEL_ID) {
    try {
      await safeSendMessage(config.CHANNEL_ID, broadcastText, { parse_mode: 'Markdown' });
    } catch (error) {
      console.log(chalk.red(`❌ Gagal broadcast success to channel: ${error.message}`));
    }
  }
}

// === /listredeem - Lihat kode redeem (Admin) ===
bot.onText(/\/listredeem/, async (msg) => {
  const adminId = msg.from.id;
  if (!ADMIN_IDS.includes(adminId)) {
    return safeSendMessage(adminId, "❌ Kamu tidak punya izin.");
  }

  const redeemCodes = loadData('redeem.json');
  
  if (!redeemCodes.length) {
    return safeSendMessage(adminId, "📭 𝗧𝗶𝗱𝗮𝗸 𝗮𝗱𝗮 𝗸𝗼𝗱𝗲 𝗿𝗲𝗱𝗲𝗲𝗺.");
  }

  let text = `📋 𝗗𝗔𝗙𝗧𝗔𝗥 𝗞𝗢𝗗𝗘 𝗥𝗘𝗗𝗘𝗘𝗠 (${redeemCodes.length})\n\n`;

  redeemCodes.forEach((rc, index) => {
    const status = rc.isActive ? '✅' : '❌';
    const progress = `${rc.usedCount}/${rc.userLimit}`;
    const expires = new Date(rc.expiresAt).toLocaleDateString('id-ID');
    
    text += `${index + 1}. ${status} *${rc.code}*\n`;
    text += `   💰 ${rc.coin} coin | 👥 ${progress} | 🕒 ${expires}\n\n`;
  });

  await safeSendMessage(adminId, text, { parse_mode: 'Markdown' });
});

// === Auto Cleanup Expired Codes ===
schedule.scheduleJob("0 0 * * *", async () => {
  let redeemCodes = loadData('redeem.json');
  const now = new Date();
  const expiredCodes = redeemCodes.filter(rc => new Date(rc.expiresAt) < now && rc.isActive);
  
  if (expiredCodes.length > 0) {
    // Nonaktifkan kode expired
    redeemCodes.forEach(rc => {
      if (new Date(rc.expiresAt) < now) {
        rc.isActive = false;
      }
    });
    
    saveData('redeem.json', redeemCodes);
    
    console.log(chalk.yellow(`🕒 Auto-disabled ${expiredCodes.length} expired redeem codes`));
    
    // Notify admin
    for (const adminId of ADMIN_IDS) {
      await safeSendMessage(adminId,
`🕒 𝗔𝗨𝗧𝗢 𝗖𝗟𝗘𝗔𝗡𝗨𝗣 𝗥𝗘𝗗𝗘𝗘𝗠 𝗖𝗢𝗗𝗘𝗦

📊 ${expiredCodes.length} kode telah expired:
${expiredCodes.map(ec => `• ${ec.code} (${ec.usedCount}/${ec.userLimit})`).join('\n')}

𝗞𝗼𝗱𝗲 𝘁𝗲𝗹𝗮𝗵 𝗱𝗶𝗻𝗼𝗻𝗮𝗸𝘁𝗶𝗳𝗸𝗮𝗻 𝗼𝘁𝗼𝗺𝗮𝘁𝗶𝘀.`);
    }
  }
});
// Railway status command
bot.onText(/\/railway/, async (msg) => {
  const chatId = msg.chat.id;
  const users = loadData('users.json');
  const items = loadData('items.json');
  
  const status = `
🏠 *RAILWAY HOST STATUS*

🤖 *Bot Performance:*
├ Platform: Railway
├ Uptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m
├ Memory: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB
├ Users: ${users.length}
└ Items: ${items.length}

✅ *Railway Features:*
• 24/7 Uptime Guaranteed
• Auto Scaling
• Zero Downtime Deployments
• Global CDN
• Free SSL Certificate

🎯 *Bot Status:* 🟢 ACTIVE`;
  
  await safeSendMessage(chatId, status, { parse_mode: 'Markdown' });
});

// ------------------------------------------------------------------
//                             ERROR HANDLING
// ------------------------------------------------------------------

// Bot event handlers
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error);
});

bot.on('webhook_error', (error) => {
  console.error('❌ Webhook error:', error);
});

bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

// Success message
console.log('✅ Telegram Bot started successfully on Railway!');
console.log('📊 Bot is now listening for messages...');

// Export bot instance jika diperlukan
module.exports = bot;