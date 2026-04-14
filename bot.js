require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { db } = require('./firebase');

const bot = new TelegramBot(process.env.8628815980:AAFYtpbyLgLlJDs_oi_6GhYl9wIF87TiNg8, { polling: true });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Helper: Get/Create User ───────────────────────────
async function getUser(chatId) {
  const ref = db.collection('users').doc(String(chatId));
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ balance: 0, chatId, createdAt: new Date() });
    return { balance: 0 };
  }
  return snap.data();
}

// ─── Helper: Update Balance ────────────────────────────
async function updateBalance(chatId, amount) {
  const ref = db.collection('users').doc(String(chatId));
  await ref.update({ balance: admin.firestore.FieldValue.increment(amount) });
}

// ─── Main Menu ─────────────────────────────────────────
function mainMenu() {
  return {
    reply_markup: {
      keyboard: [
        ['💰 Balance', '📤 Send Money'],
        ['📥 Deposit', '📋 History'],
        ['🤖 AI Assistant']
      ],
      resize_keyboard: true
    }
  };
}

// ─── Bot Commands ──────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await getUser(chatId); // create if not exists
  bot.sendMessage(chatId,
    `👋 Welcome to *PayQuest Bot*!\n\nTera wallet ready hai bhai 🚀`,
    { parse_mode: 'Markdown', ...mainMenu() }
  );
});

// Balance
bot.onText(/💰 Balance/, async (msg) => {
  const user = await getUser(msg.chat.id);
  bot.sendMessage(msg.chat.id, `💰 Tera balance: *₹${user.balance}*`, { parse_mode: 'Markdown' });
});

// Send Money
const pendingTransfer = {};
bot.onText(/📤 Send Money/, (msg) => {
  pendingTransfer[msg.chat.id] = 'awaiting_recipient';
  bot.sendMessage(msg.chat.id, '📤 Jisko bhejana hai uska *Chat ID* bhej:', { parse_mode: 'Markdown' });
});

// Deposit
bot.onText(/📥 Deposit/, (msg) => {
  pendingTransfer[msg.chat.id] = 'awaiting_deposit';
  bot.sendMessage(msg.chat.id, '📥 Kitna deposit karna hai? Amount bhej (sirf number):');
});

// History
bot.onText(/📋 History/, async (msg) => {
  const chatId = msg.chat.id;
  const txns = await db.collection('transactions')
    .where('userId', '==', String(chatId))
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  if (txns.empty) return bot.sendMessage(chatId, '📋 Koi transaction nahi abhi tak!');

  let text = '📋 *Last 5 Transactions:*\n\n';
  txns.forEach(doc => {
    const t = doc.data();
    text += `${t.type === 'credit' ? '✅' : '❌'} ₹${t.amount} — ${t.note}\n`;
  });
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// AI Assistant
bot.onText(/🤖 AI Assistant/, (msg) => {
  pendingTransfer[msg.chat.id] = 'ai_mode';
  bot.sendMessage(msg.chat.id, '🤖 AI mode ON! Kuch bhi pooch, /exit se wapas ao.');
});

// ─── General Message Handler ───────────────────────────
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const state = pendingTransfer[chatId];

  if (!state || text.startsWith('/') || text.startsWith('�')) return;

  // AI Mode
  if (state === 'ai_mode') {
    if (text === '/exit') {
      delete pendingTransfer[chatId];
      return bot.sendMessage(chatId, '👋 AI mode OFF!', mainMenu());
    }
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(text);
    return bot.sendMessage(chatId, result.response.text());
  }

  // Deposit Flow
  if (state === 'awaiting_deposit') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, '❌ Valid amount daal!');
    await updateBalance(chatId, amount);
    await db.collection('transactions').add({
      userId: String(chatId), amount, type: 'credit',
      note: 'Deposit', createdAt: new Date()
    });
    delete pendingTransfer[chatId];
    return bot.sendMessage(chatId, `✅ ₹${amount} deposit ho gaya!`, mainMenu());
  }

  // Transfer Flow - Step 1: Recipient ID
  if (state === 'awaiting_recipient') {
    pendingTransfer[chatId] = { step: 'awaiting_amount', recipientId: text };
    return bot.sendMessage(chatId, '💸 Kitna bhejna hai? Amount daal:');
  }

  // Transfer Flow - Step 2: Amount
  if (state?.step === 'awaiting_amount') {
    const amount = parseFloat(text);
    const sender = await getUser(chatId);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, '❌ Valid amount daal!');
    if (sender.balance < amount) return bot.sendMessage(chatId, '❌ Balance kam hai bhai!');

    const recipientId = state.recipientId;
    await updateBalance(chatId, -amount);
    await updateBalance(recipientId, amount);

    // Log transactions
    const batch = db.batch();
    batch.set(db.collection('transactions').doc(), {
      userId: String(chatId), amount, type: 'debit',
      note: `Transfer to ${recipientId}`, createdAt: new Date()
    });
    batch.set(db.collection('transactions').doc(), {
      userId: recipientId, amount, type: 'credit',
      note: `Received from ${chatId}`, createdAt: new Date()
    });
    await batch.commit();

    // Notify recipient
    try {
      bot.sendMessage(recipientId, `💰 Tujhe *₹${amount}* mila ${chatId} se!`, { parse_mode: 'Markdown' });
    } catch (e) {}

    delete pendingTransfer[chatId];
    return bot.sendMessage(chatId, `✅ ₹${amount} bhej diya!`, mainMenu());
  }
});

console.log('🚀 PayQuest Bot running...');
