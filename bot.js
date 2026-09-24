// Telegram Bot for KPI Group ПІ-51
// Powered by live KPI Campus API

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.BOT_TOKEN || '8866763001:AAEDnXFRytLSju4XJCuC34zbh_0y9YYkCnY';
const GROUP_ID = '5255';
const SUBSCRIBERS_FILE = path.join(__dirname, 'subscribers.json');

// Built-in HTTP server for cloud platforms (Render, Koyeb, Railway)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('KPI Schedule Bot (ПІ-51) is running 24/7 in the cloud! 🚀');
});
server.listen(PORT, () => {
  console.log(`🌐 Web server active on port ${PORT}`);
});

// Self-ping mechanism to keep free cloud instances awake 24/7
const APP_URL = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
if (APP_URL) {
  setInterval(async () => {
    try {
      await fetch(APP_URL);
      console.log('⏰ Self-ping sent successfully');
    } catch (e) {
      console.error('Self-ping failed:', e.message);
    }
  }, 10 * 60 * 1000); // Every 10 mins
}

const DAY_NAMES = {
  1: { code: 'Пн', full: 'Понеділок' },
  2: { code: 'Вв', full: 'Вівторок' },
  3: { code: 'Ср', full: 'Середа' },
  4: { code: 'Чт', full: 'Четвер' },
  5: { code: 'Пт', full: 'П’ятниця' },
  6: { code: 'Сб', full: 'Субота' },
  7: { code: 'Нд', full: 'Неділя' },
};

// Load or initialize subscribers
function loadSubscribers() {
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading subscribers:', err);
  }
  return {};
}

function saveSubscribers(subs) {
  try {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving subscribers:', err);
  }
}

let subscribers = loadSubscribers();

// Cache for schedule
let scheduleCache = null;
let lastScheduleFetch = 0;

async function getLiveSchedule() {
  const now = Date.now();
  if (scheduleCache && now - lastScheduleFetch < 3600000) {
    return scheduleCache;
  }
  try {
    const res = await fetch(`https://api.campus.kpi.ua/schedule/lessons?groupId=${GROUP_ID}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    scheduleCache = data;
    lastScheduleFetch = now;
    return data;
  } catch (err) {
    console.error('Failed to fetch schedule from campus API:', err.message);
    return scheduleCache;
  }
}

async function getCurrentKpiTime() {
  try {
    const res = await fetch('https://api.campus.kpi.ua/time/current');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json(); // { currentWeek: 2, currentDay: 4, currentLesson: 3 }
  } catch (err) {
    console.error('Failed to fetch current time from campus API:', err.message);
    const now = new Date();
    let day = now.getDay();
    if (day === 0) day = 7;
    return { currentWeek: 2, currentDay: day, currentLesson: 0 };
  }
}

// Format a single pair into readable text
function formatPair(pair, index) {
  const time = pair.time ? pair.time.slice(0, 5) : 'Час не вказано';
  const typeBadge = pair.type ? `[${pair.type}]` : '';
  const lecturer = pair.lecturer && pair.lecturer.name ? `👨‍🏫 ${pair.lecturer.name}` : '';
  const location = pair.location && pair.location.title ? `📍 Ауд. ${pair.location.title}` : '📍 Дистанційно';
  
  return `*${index != null ? index + '. ' : ''}⏰ ${time}* ${typeBadge} *${pair.name}*\n   ${lecturer ? lecturer + '\n   ' : ''}${location}`;
}

// Filter pairs that are active on a specific date (if dates array is specified)
function filterPairsForDate(pairs, dateStr) {
  if (!pairs || !Array.isArray(pairs)) return [];
  return pairs.filter(p => {
    if (!p.dates || p.dates.length === 0) return true;
    return p.dates.includes(dateStr);
  });
}

function getTodayDateStr(offsetDays = 0) {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function getDaySchedule(targetDayNum, targetWeekNum, dateStr) {
  const scheduleData = await getLiveSchedule();
  if (!scheduleData) return null;

  const weekKey = targetWeekNum === 1 ? 'scheduleFirstWeek' : 'scheduleSecondWeek';
  const weekList = scheduleData[weekKey] || [];
  const dayCode = DAY_NAMES[targetDayNum]?.code;
  const dayItem = weekList.find(d => d.day === dayCode);

  if (!dayItem || !dayItem.pairs || dayItem.pairs.length === 0) {
    return [];
  }

  return filterPairsForDate(dayItem.pairs, dateStr);
}

// Telegram API Helper
async function tgRequest(method, params = {}) {
  try {
    const url = `https://api.telegram.org/bot${TOKEN}/${method}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err) {
    console.error(`Telegram API error (${method}):`, err.message);
    return null;
  }
}

const KEYBOARD = {
  keyboard: [
    [{ text: '📅 Сьогодні' }, { text: '⏭ Завтра' }],
    [{ text: '🗓 Цей тиждень' }, { text: '🗓 Наступний тиждень' }],
    [{ text: '⏰ Що зараз?' }, { text: '🔔 Сповіщення' }],
  ],
  resize_keyboard: true,
};

async function sendMessage(chatId, text, extra = {}) {
  return await tgRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: extra.reply_markup || KEYBOARD,
    disable_web_page_preview: true,
  });
}

// Handlers for user commands
async function handleToday(chatId) {
  const kpiTime = await getCurrentKpiTime();
  const dayInfo = DAY_NAMES[kpiTime.currentDay] || { full: 'Сьогодні' };
  const dateStr = getTodayDateStr(0);
  const pairs = await getDaySchedule(kpiTime.currentDay, kpiTime.currentWeek, dateStr);

  if (!pairs || pairs.length === 0) {
    return sendMessage(chatId, `📅 *Сьогодні ${dayInfo.full}* (${kpiTime.currentWeek}-й тиждень, ${dateStr})\n\n🎉 *Пар немає! Можна чілити, босс!* 😎`);
  }

  const list = pairs.map((p, i) => formatPair(p, i + 1)).join('\n\n');
  return sendMessage(chatId, `📅 *Розклад на сьогодні — ${dayInfo.full}*\n🏷 *${kpiTime.currentWeek}-й тиждень* (${dateStr})\nГрупа: *ПІ-51*\n\n${list}`);
}

async function handleTomorrow(chatId) {
  const kpiTime = await getCurrentKpiTime();
  let nextDay = kpiTime.currentDay + 1;
  let nextWeek = kpiTime.currentWeek;
  if (nextDay > 7) {
    nextDay = 1;
    nextWeek = nextWeek === 1 ? 2 : 1;
  }

  const dayInfo = DAY_NAMES[nextDay] || { full: 'Завтра' };
  const dateStr = getTodayDateStr(1);
  const pairs = await getDaySchedule(nextDay, nextWeek, dateStr);

  if (!pairs || pairs.length === 0) {
    return sendMessage(chatId, `⏭ *Завтра ${dayInfo.full}* (${nextWeek}-й тиждень, ${dateStr})\n\n🎉 *Завтра пар немає!* Відпочивай, босс.`);
  }

  const list = pairs.map((p, i) => formatPair(p, i + 1)).join('\n\n');
  return sendMessage(chatId, `⏭ *Розклад на завтра — ${dayInfo.full}*\n🏷 *${nextWeek}-й тиждень* (${dateStr})\nГрупа: *ПІ-51*\n\n${list}`);
}

async function handleWeek(chatId, targetWeek) {
  const kpiTime = await getCurrentKpiTime();
  const weekNum = targetWeek || kpiTime.currentWeek;
  const scheduleData = await getLiveSchedule();
  if (!scheduleData) {
    return sendMessage(chatId, '⚠️ Не вдалося завантажити розклад з сервера КПІ.');
  }

  const weekKey = weekNum === 1 ? 'scheduleFirstWeek' : 'scheduleSecondWeek';
  const days = scheduleData[weekKey] || [];

  let text = `🗓 *Розклад на ${weekNum}-й тиждень* (Група *ПІ-51*):\n`;

  let totalPairsCount = 0;
  for (let i = 1; i <= 6; i++) {
    const dayInfo = DAY_NAMES[i];
    const dayData = days.find(d => d.day === dayInfo.code);
    const pairs = dayData ? dayData.pairs || [] : [];
    
    if (pairs.length > 0) {
      totalPairsCount += pairs.length;
      text += `\n*─── ${dayInfo.full.toUpperCase()} (${dayInfo.code}) ───*\n`;
      pairs.forEach((p, idx) => {
        text += `${formatPair(p, idx + 1)}\n\n`;
      });
    }
  }

  if (totalPairsCount === 0) {
    text += '\n🎉 На цей тиждень занять немає!';
  }

  return sendMessage(chatId, text);
}

async function handleNow(chatId) {
  const kpiTime = await getCurrentKpiTime();
  const dateStr = getTodayDateStr(0);
  const pairs = await getDaySchedule(kpiTime.currentDay, kpiTime.currentWeek, dateStr);

  if (!pairs || pairs.length === 0) {
    return sendMessage(chatId, `🏖 Сьогодні пар немає.`);
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let currentPair = null;
  let nextPair = null;

  for (const pair of pairs) {
    const [h, m] = pair.time.split(':').map(Number);
    const startM = h * 60 + m;
    const endM = startM + 95; // 1h 35m pair duration

    if (currentMinutes >= startM && currentMinutes <= endM) {
      currentPair = pair;
    } else if (currentMinutes < startM && !nextPair) {
      nextPair = pair;
    }
  }

  let text = `⏰ *Статус на цей момент:*\n`;
  if (currentPair) {
    text += `\n🟢 *ЗАРАЗ ІДЕ ПАРА:*\n${formatPair(currentPair)}\n`;
  } else {
    text += `\n⏸ *Зараз пари немає.*\n`;
  }

  if (nextPair) {
    const [h, m] = nextPair.time.split(':').map(Number);
    const diff = h * 60 + m - currentMinutes;
    text += `\n🔜 *НАСТУПНА ПАРА (через ${diff} хв):*\n${formatPair(nextPair)}`;
  } else {
    text += `\n🏁 На сьогодні всі пари закінчилися!`;
  }

  return sendMessage(chatId, text);
}

// Background scheduler for notifications
let alertedToday = new Set();
let morningDigestSentDay = null;

async function checkAndSendAlerts() {
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const timeInMinutes = currentHours * 60 + currentMinutes;
  const todayDateStr = getTodayDateStr(0);

  // Reset alert cache at midnight
  if (morningDigestSentDay !== todayDateStr && currentHours === 0 && currentMinutes < 5) {
    alertedToday.clear();
  }

  const kpiTime = await getCurrentKpiTime();
  const pairs = await getDaySchedule(kpiTime.currentDay, kpiTime.currentWeek, todayDateStr);
  if (!pairs || pairs.length === 0) return;

  const subIds = Object.keys(subscribers).filter(id => subscribers[id].notifications !== false);
  if (subIds.length === 0) return;

  // 1. Morning Digest at 07:45
  if (morningDigestSentDay !== todayDateStr && currentHours === 7 && currentMinutes >= 45 && currentMinutes <= 55) {
    morningDigestSentDay = todayDateStr;
    const dayInfo = DAY_NAMES[kpiTime.currentDay] || { full: 'Сьогодні' };
    const list = pairs.map((p, i) => formatPair(p, i + 1)).join('\n\n');
    const msg = `🌅 *Доброго ранку, босс!*\n\nСьогодні *${dayInfo.full}* (${kpiTime.currentWeek}-й тиждень, ${todayDateStr}).\nОсь твій розклад на сьогодні:\n\n${list}\n\nУспішного дня! 🚀`;
    for (const chatId of subIds) {
      await sendMessage(chatId, msg);
    }
  }

  // 2. Alert 15 minutes before each pair
  for (const pair of pairs) {
    const [pHour, pMin] = pair.time.split(':').map(Number);
    const pairStartMinutes = pHour * 60 + pMin;
    const diff = pairStartMinutes - timeInMinutes;

    // Send alert between 14 and 16 minutes before start
    const alertKey = `${todayDateStr}_${pair.time}_${pair.name}`;
    if (diff >= 14 && diff <= 16 && !alertedToday.has(alertKey)) {
      alertedToday.add(alertKey);
      const msg = `🔔 *Босс, через 15 хвилин пара!*\n\n${formatPair(pair)}\n\nНе запізнюйся! ⚡`;
      for (const chatId of subIds) {
        await sendMessage(chatId, msg);
      }
    }
  }
}

// Polling loop
let lastUpdateId = 0;

async function pollUpdates() {
  try {
    const res = await tgRequest('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 25,
    });

    if (res && res.ok && Array.isArray(res.result)) {
      for (const update of res.result) {
        lastUpdateId = update.update_id;
        if (!update.message || !update.message.text) continue;

        const chatId = update.message.chat.id;
        const text = update.message.text.trim();
        const from = update.message.from?.first_name || 'Босс';

        // Auto subscribe
        if (!subscribers[chatId]) {
          subscribers[chatId] = {
            name: from,
            notifications: true,
            joinedAt: new Date().toISOString(),
          };
          saveSubscribers(subscribers);
        }

        console.log(`[MSG from ${from} (${chatId})]: ${text}`);

        if (text === '/start') {
          await sendMessage(
            chatId,
            `👋 *Привіт, босс!*\n\nЯ твій персональний помічник по розкладу для групи *ПІ-51*.\n\n` +
            `✅ Я автоматично підтягую актуальні дані з офіційного сервера КПІ (Campus).\n` +
            `⏰ Я пам'ятаю, який зараз тиждень (1 чи 2) і надішлю тобі нагадування за *15 хвилин* до кожної пари!\n` +
            `🌅 А щоранку о 07:45 пришлю повний список пар на день.\n\n` +
            `Тисни на кнопки внизу, щоб глянути розклад! 👇`
          );
          await handleToday(chatId);
        } else if (text === '📅 Сьогодні' || text === '/today') {
          await handleToday(chatId);
        } else if (text === '⏭ Завтра' || text === '/tomorrow') {
          await handleTomorrow(chatId);
        } else if (text === '🗓 Цей тиждень' || text === '/week') {
          await handleWeek(chatId);
        } else if (text === '🗓 Наступний тиждень' || text === '/nextweek') {
          const kpi = await getCurrentKpiTime();
          const nextWeek = kpi.currentWeek === 1 ? 2 : 1;
          await handleWeek(chatId, nextWeek);
        } else if (text === '⏰ Що зараз?' || text === '/now') {
          await handleNow(chatId);
        } else if (text === '🔔 Сповіщення') {
          const current = subscribers[chatId]?.notifications !== false;
          subscribers[chatId].notifications = !current;
          saveSubscribers(subscribers);
          const status = !current ? 'увімкнено 🔔' : 'вимкнено 🔕';
          await sendMessage(chatId, `Статус автоматичних нагадувань: *${status}*`);
        } else {
          await sendMessage(chatId, `Не зовсім зрозумів команду, босс. Скористайся кнопками внизу! 👇`);
        }
      }
    }
  } catch (err) {
    console.error('Polling error:', err.message);
  }

  // Run next poll
  setTimeout(pollUpdates, 500);
}

// Start bot
console.log('🚀 Бот розкладу ПІ-51 запущений!');
console.log('Зв\'язок з сервером KPI Campus налагоджено.');

// Start background notification ticker (every 30 seconds)
setInterval(checkAndSendAlerts, 30000);
checkAndSendAlerts();

// Start polling
pollUpdates();
