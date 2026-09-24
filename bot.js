// Telegram Bot for KPI Group ПІ-51
// Live KPI Campus API + Subject Zoom Links + Real-time Kyiv Air Raid Alarm Monitor + Deadlines + DTEK Light Info (Vyshhorod 6.2)

process.env.TZ = 'Europe/Kyiv';

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

// Prevent unhandled crashes
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.BOT_TOKEN || '8866763001:AAEDnXFRytLSju4XJCuC34zbh_0y9YYkCnY';
const GROUP_ID = '5255';
const BOSS_ID = '1277111400';
const SUBSCRIBERS_FILE = path.join(__dirname, 'subscribers.json');
const LINKS_FILE = path.join(__dirname, 'links.json');
const DEADLINES_FILE = path.join(__dirname, 'deadlines.json');
const RSO_FILE = path.join(__dirname, 'rso.json');

// Built-in HTTP server for cloud platforms (Render, Koyeb, Railway)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('KPI Schedule & Student Assistant Bot (ПІ-51) is running 24/7! 🚀');
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
  }, 10 * 60 * 1000);
}

// Timezone Helper
function getKyivDate() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
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

// Conference links
function loadLinks() {
  try {
    if (fs.existsSync(LINKS_FILE)) {
      return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading links.json:', err);
  }
  return [];
}

let conferenceLinks = loadLinks();

function findLinkForPair(pair) {
  if (!pair || !pair.name) return null;
  const nameLower = pair.name.toLowerCase();
  const typeLower = (pair.type || '').toLowerCase();

  for (const item of conferenceLinks) {
    const matchesKeyword = item.keywords.some(k => nameLower.includes(k.toLowerCase()));
    if (matchesKeyword) {
      if (item.type) {
        if (typeLower.includes(item.type.toLowerCase())) {
          return item;
        }
      } else {
        return item;
      }
    }
  }
  return null;
}

// Deadlines Manager
function loadDeadlines() {
  try {
    if (fs.existsSync(DEADLINES_FILE)) {
      return JSON.parse(fs.readFileSync(DEADLINES_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading deadlines.json:', err);
  }
  return [];
}

function saveDeadlines(list) {
  try {
    fs.writeFileSync(DEADLINES_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving deadlines.json:', err);
  }
}

let deadlines = loadDeadlines();

// Subscribers
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
 
// RSO Manager (Grade Points)
function loadRso() {
  try {
    if (fs.existsSync(RSO_FILE)) {
      return JSON.parse(fs.readFileSync(RSO_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading rso.json:', err);
  }
  return {};
}

function saveRso(data) {
  try {
    fs.writeFileSync(RSO_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving rso.json:', err);
  }
}

let rsoData = loadRso();

// Real-time Air Raid Alarm in Kyiv
let lastKyivAlarmState = null;
let lastKyivAlarmChanged = null;

async function fetchKyivAlarm() {
  try {
    const res = await fetch('https://ubilling.net.ua/aerialalerts/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const kyiv = data.states?.['м. Київ'];
    if (kyiv) {
      return {
        isActive: !!kyiv.alertnow,
        changed: kyiv.changed || '',
      };
    }
  } catch (err) {
    console.error('Air alarm API fetch error:', err.message);
  }
  return null;
}

// Schedule Cache
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
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch current time from campus API:', err.message);
    const now = getKyivDate();
    let day = now.getDay();
    if (day === 0) day = 7;
    return { currentWeek: 2, currentDay: day, currentLesson: 0 };
  }
}

// Format pair
function formatPair(pair, index) {
  const time = pair.time ? pair.time.slice(0, 5) : 'Час не вказано';
  const typeBadge = pair.type ? `[${pair.type}]` : '';
  const lecturer = pair.lecturer && pair.lecturer.name ? `👨‍🏫 ${pair.lecturer.name}` : '';
  const location = pair.location && pair.location.title ? `📍 Ауд. ${pair.location.title}` : '📍 Дистанційно';
  
  const linkObj = findLinkForPair(pair);
  let linkStr = '';
  if (linkObj) {
    linkStr = `\n   🔗 [👉 Підключитися до Zoom](${linkObj.url})`;
    if (linkObj.passcode) {
      linkStr += ` (Пароль: \`${linkObj.passcode}\`)`;
    }
  }

  return `*${index != null ? index + '. ' : ''}⏰ ${time}* ${typeBadge} *${pair.name}*\n   ${lecturer ? lecturer + '\n   ' : ''}${location}${linkStr}`;
}

function filterPairsForDate(pairs, dateStr) {
  if (!pairs || !Array.isArray(pairs)) return [];
  const filtered = pairs.filter(p => {
    if (!p.dates || p.dates.length === 0) return true;
    return p.dates.includes(dateStr);
  });
  return filtered.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

function getTodayDateStr(offsetDays = 0) {
  const d = getKyivDate();
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

const BOSS_KEYBOARD = {
  keyboard: [
    [{ text: '📅 Сьогодні' }, { text: '⏭ Завтра' }, { text: '⏰ Зараз' }],
    [{ text: '🗓 Цей тиждень' }, { text: '🗓 Наступний' }, { text: '🚨 Тривога' }],
    [{ text: '📝 Дедлайни' }, { text: '📊 Бали РСО' }, { text: '🚨 SOS' }],
    [{ text: '⚡ Світло' }, { text: '🔗 Посилання' }, { text: '🔔 Сповіщення' }],
  ],
  resize_keyboard: true,
};

const DEFAULT_KEYBOARD = {
  keyboard: [
    [{ text: '📅 Сьогодні' }, { text: '⏭ Завтра' }, { text: '⏰ Зараз' }],
    [{ text: '🗓 Цей тиждень' }, { text: '🗓 Наступний' }, { text: '🚨 Тривога' }],
    [{ text: '📝 Дедлайни' }, { text: '📊 Бали РСО' }, { text: '🚨 SOS' }],
    [{ text: '🔗 Посилання' }, { text: '🔔 Сповіщення' }],
  ],
  resize_keyboard: true,
};

function getKeyboardForChat(chatId) {
  if (String(chatId) === BOSS_ID) {
    return BOSS_KEYBOARD;
  }
  return DEFAULT_KEYBOARD;
}

async function sendMessage(chatId, text, extra = {}) {
  const keyboard = extra.reply_markup || getKeyboardForChat(chatId);
  return await tgRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: keyboard,
    disable_web_page_preview: true,
  });
}

function getAlarmBanner() {
  if (lastKyivAlarmState === true) {
    return `\n\n🚨 *УВАГА: Зараз у Києві триває повітряна тривога! За правилами КПІ навчання призупинено, пари не проводяться!* Бережи себе! 🛡`;
  }
  return '';
}

// Handlers
async function handleToday(chatId) {
  const kpiTime = await getCurrentKpiTime();
  const dayInfo = DAY_NAMES[kpiTime.currentDay] || { full: 'Сьогодні' };
  const dateStr = getTodayDateStr(0);
  const pairs = await getDaySchedule(kpiTime.currentDay, kpiTime.currentWeek, dateStr);

  const banner = getAlarmBanner();

  if (!pairs || pairs.length === 0) {
    return sendMessage(chatId, `📅 *Сьогодні ${dayInfo.full}* (${kpiTime.currentWeek}-й тиждень, ${dateStr})\n\n🎉 *Пар немає! Можна відпочивати.*${banner}`);
  }

  const list = pairs.map((p, i) => formatPair(p, i + 1)).join('\n\n');
  return sendMessage(chatId, `📅 *Розклад на сьогодні — ${dayInfo.full}*\n🏷 *${kpiTime.currentWeek}-й тиждень* (${dateStr})\nГрупа: *ПІ-51*\n\n${list}${banner}`);
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
    return sendMessage(chatId, `⏭ *Завтра ${dayInfo.full}* (${nextWeek}-й тиждень, ${dateStr})\n\n🎉 *Завтра пар немає!* Відпочивай.`);
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

  const banner = getAlarmBanner();

  if (!pairs || pairs.length === 0) {
    return sendMessage(chatId, `🏖 Сьогодні пар немає.${banner}`);
  }

  const now = getKyivDate();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let currentPair = null;
  let nextPair = null;

  for (const pair of pairs) {
    const [h, m] = pair.time.split(':').map(Number);
    const startM = h * 60 + m;
    const endM = startM + 95;

    if (currentMinutes >= startM && currentMinutes <= endM) {
      currentPair = pair;
    } else if (currentMinutes < startM && !nextPair) {
      nextPair = pair;
    }
  }

  let text = `⏰ *Статус на цей момент (${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}):*\n`;
  if (currentPair) {
    text += `\n🟢 *ЗАРАЗ ІДЕ ПАРА:*\n${formatPair(currentPair)}\n`;
  } else {
    text += `\n⏸ *Зараз перерва або пари немає.*\n`;
  }

  if (nextPair) {
    const [h, m] = nextPair.time.split(':').map(Number);
    const diff = h * 60 + m - currentMinutes;
    text += `\n🔜 *НАСТУПНА ПАРА (через ${diff} хв):*\n${formatPair(nextPair)}`;
  } else {
    text += `\n🏁 На сьогодні всі пари закінчилися!`;
  }

  text += banner;
  return sendMessage(chatId, text);
}

async function handleAlarmStatus(chatId) {
  const status = await fetchKyivAlarm();
  if (!status) {
    return sendMessage(chatId, `⚠️ Не вдалося отримати поточний статус тривог.`);
  }

  if (status.isActive) {
    const timeStr = status.changed ? status.changed.slice(11, 16) : 'нещодавно';
    return sendMessage(
      chatId,
      `🚨 *У КИЄВІ ЗАРАЗ ПОВІТРЯНА ТРИВОГА!* 🚨\n\n` +
      `⏰ Початок: *${timeStr}*\n` +
      `⚠️ *За правилами КПІ навчання зупиняється!* Пари не проводяться до закінчення тривоги.\n\n` +
      `Перебувай у безпечному місці або укритті! 🛡`
    );
  } else {
    return sendMessage(
      chatId,
      `🟢 *У Києві спокійно, тривоги немає!* 🟢\n\n` +
      `Навчальний процес і пари тривають у звичайному режимі за розкладом. 🎓`
    );
  }
}

async function handleAllLinks(chatId) {
  if (conferenceLinks.length === 0) {
    return sendMessage(chatId, `ℹ️ Список посилань наразі порожній.`);
  }

  let text = `🔗 *Посилання на пари Zoom/Meet (ПІ-51):*\n\n`;
  conferenceLinks.forEach((item, idx) => {
    text += `${idx + 1}. *${item.title}*\n`;
    text += `   👉 [Підключитися до Zoom](${item.url})\n`;
    if (item.passcode) {
      text += `   🔑 Пароль: \`${item.passcode}\`\n`;
    }
    text += `\n`;
  });

  text += `_Збережи собі або просто тисни кнопку у меню!_ 🚀`;
  return sendMessage(chatId, text);
}

// Deadlines Handlers
function getDaysDiff(targetDateStr) {
  const todayStr = getTodayDateStr(0);
  const d1 = new Date(todayStr);
  const d2 = new Date(targetDateStr);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 3600 * 24));
}

async function handleShowDeadlines(chatId) {
  deadlines = loadDeadlines();
  if (deadlines.length === 0) {
    return sendMessage(
      chatId,
      `📝 *Активних дедлайнів немає!* 🎉\n\n` +
      `Щоб додати новий дедлайн, надішли команду:\n` +
      `👉 \`/add 29.09 Назва предмету і лаби\`\n` +
      `*(наприклад: \`/add 29.09 Програмування: лаба 1\`)*`
    );
  }

  deadlines.sort((a, b) => a.date.localeCompare(b.date));

  let text = `📝 *Список активних дедлайнів та лаб (ПІ-51):*\n\n`;
  deadlines.forEach(item => {
    const diff = getDaysDiff(item.date);
    let badge = '';
    if (diff < 0) badge = '❌ *ПРОСТРОЧЕНО!*';
    else if (diff === 0) badge = '🔴 *СЬОГОДНІ ДЕДЛАЙН!*';
    else if (diff === 1) badge = '⚠️ *ЗАВТРА!*';
    else if (diff <= 3) badge = `⏳ *Залишилось ${diff} дн.*`;
    else badge = `🗓 До ${item.date.slice(8, 10)}.${item.date.slice(5, 7)} (${diff} дн.)`;

    text += `📌 *[ID: ${item.id}]* ${badge}\n`;
    text += `   *${item.title}*\n`;
    text += `   _Додано: ${item.addedBy || '6u6en'}_\n\n`;
  });

  text += `💡 *Як керувати:*\n`;
  text += `➕ Додати: \`/add 29.09 Текст\`\n`;
  text += `✅ Видалити здану: \`/done ID\` *(наприклад: \`/done 1\`)*`;

  return sendMessage(chatId, text);
}

async function handleAddDeadline(chatId, text, fromUser) {
  const regex = /^\/(?:add|task)\s+(\d{1,2})[\.\/-](\d{1,2})(?:[\.\/-](\d{2,4}))?\s+(.+)$/i;
  const match = text.match(regex);

  if (!match) {
    return sendMessage(
      chatId,
      `⚠️ *Неправильний формат команди!*\n\n` +
      `Пиши так:\n` +
      `👉 \`/add 29.09 Програмування: лаба №1\`\n` +
      `або з роком:\n` +
      `👉 \`/add 05.10.2026 Вишмат: розрахункова\``
    );
  }

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const nowYear = getKyivDate().getFullYear();
  let year = match[3] ? (match[3].length === 2 ? `20${match[3]}` : match[3]) : String(nowYear);
  const title = match[4].trim();

  const formattedDate = `${year}-${month}-${day}`;

  deadlines = loadDeadlines();
  const newId = deadlines.length > 0 ? Math.max(...deadlines.map(d => d.id || 0)) + 1 : 1;

  let authorName = 'Студент';
  if (fromUser) {
    if (fromUser.first_name === '6u6en' || fromUser.username === '6u6en' || fromUser.id === 1277111400) {
      authorName = '6u6en';
    } else if (fromUser.first_name) {
      authorName = fromUser.first_name;
    } else if (fromUser.username) {
      authorName = `@${fromUser.username}`;
    }
  }

  const newItem = {
    id: newId,
    date: formattedDate,
    title: title,
    addedBy: authorName,
  };

  deadlines.push(newItem);
  saveDeadlines(deadlines);

  const diff = getDaysDiff(formattedDate);
  
  // 1. Send confirmation to sender
  await sendMessage(
    chatId,
    `✅ *Дедлайн успішно додано!* 📌\n\n` +
    `ID: *${newId}*\n` +
    `Дата: *${day}.${month}.${year}* (через ${diff} дн.)\n` +
    `Завдання: *${title}*\n\n` +
    `_Бот надіслав сповіщення всім друзям у групі!_`
  );

  // 2. Broadcast to all other subscribers in real-time
  const broadcastMsg = 
    `📌 *Новий дедлайн для групи ПІ-51!*\n\n` +
    `👤 Додав: *${authorName}*\n` +
    `🗓 Дата: *${day}.${month}.${year}* (через ${diff} дн.)\n` +
    `📝 Завдання: *${title}*\n\n` +
    `_Дедлайн збережено у загальний список бота!_`;

  const otherSubIds = Object.keys(subscribers).filter(id => id !== String(chatId) && subscribers[id].notifications !== false);
  for (const sId of otherSubIds) {
    await sendMessage(sId, broadcastMsg);
  }
}

async function handleDeleteDeadline(chatId, text, fromUser) {
  const match = text.match(/^\/(?:done|del)\s+(\d+)$/i);
  if (!match) {
    return sendMessage(chatId, `⚠️ Вкажи ID завдання: наприклад \`/done 1\``);
  }

  const targetId = Number(match[1]);
  deadlines = loadDeadlines();
  const idx = deadlines.findIndex(d => d.id === targetId);

  if (idx === -1) {
    return sendMessage(chatId, `❌ Завдання з ID ${targetId} не знайдено.`);
  }

  const removed = deadlines.splice(idx, 1)[0];
  saveDeadlines(deadlines);

  let authorName = 'Студент';
  if (fromUser) {
    if (fromUser.first_name === '6u6en' || fromUser.username === '6u6en' || fromUser.id === 1277111400) {
      authorName = '6u6en';
    } else if (fromUser.first_name) {
      authorName = fromUser.first_name;
    }
  }

  // 1. Reply to sender
  await sendMessage(chatId, `🎉 *Завдання виконано і видалено!* ✅\n\n*${removed.title}*\nМінус один дедлайн! Завдання закрито.`);

  // 2. Notify other group members
  const doneMsg = 
    `🎉 *Один з дедлайнів закрито!*\n\n` +
    `*${removed.title}*\n` +
    `👤 Виконав / зняв: *${authorName}*`;

  const otherSubIds = Object.keys(subscribers).filter(id => id !== String(chatId) && subscribers[id].notifications !== false);
  for (const sId of otherSubIds) {
    await sendMessage(sId, doneMsg);
  }
}

// --- RSO Grade Points & Calculator Module ---

function renderProgressBar(score, max = 100) {
  const totalBars = 10;
  const ratio = Math.max(0, Math.min(1, score / max));
  const filledBars = Math.round(ratio * totalBars);
  const emptyBars = totalBars - filledBars;
  let fillChar = '🟩';
  if (score < 60) fillChar = '🟧';
  else if (score < 75) fillChar = '🟨';
  else if (score >= 95) fillChar = '🟦';
  return fillChar.repeat(filledBars) + '⬜'.repeat(emptyBars);
}

function getEctsGrade(score) {
  if (score >= 95) return { letter: 'A', title: 'Відмінно (Автомат)', icon: '🏆' };
  if (score >= 85) return { letter: 'B', title: 'Дуже добре', icon: '✨' };
  if (score >= 75) return { letter: 'C', title: 'Добре', icon: '👍' };
  if (score >= 65) return { letter: 'D', title: 'Задовільно', icon: '👌' };
  if (score >= 60) return { letter: 'E', title: 'Достатньо (Залік/Допуск)', icon: '🟢' };
  return { letter: 'Fx', title: 'Недопуск / Незадовільно', icon: '🔴' };
}

function normalizeSubject(input) {
  if (!input) return 'Інший предмет';
  const low = input.toLowerCase().trim();
  if (low.includes('прог') || low.includes('обчисл') || low.includes('код') || low.includes('it')) {
    return '💻 Обчислювальна техніка та програмування';
  }
  if (low.includes('спец') || low.includes('спвм')) {
    return '📊 Спец. питання вищої математики';
  }
  if (low.includes('сигнал') || low.includes('теск') || low.includes('кіл') || low.includes('схем')) {
    return '⚡ Теорія сигналів і кіл (ТЕСК)';
  }
  if (low.includes('мат') || low.includes('матан') || low.includes('аналіз')) {
    return '📐 Вища математика (Мат. аналіз)';
  }
  if (low.includes('філос') || low.includes('филос')) {
    return '📜 Вступ до філософії';
  }
  if (low.includes('псих')) {
    return '🧠 Психологія';
  }
  if (low.includes('англ') || low.includes('eng')) {
    return '🇬🇧 Англійська мова';
  }
  return input.trim().charAt(0).toUpperCase() + input.trim().slice(1);
}

async function handleRso(chatId) {
  rsoData = loadRso();
  const userScores = rsoData[chatId];

  if (!userScores || Object.keys(userScores).length === 0) {
    return sendMessage(
      chatId,
      `📊 *Калькулятор балів РСО (Рейтингова система КПІ)*\n\n` +
      `У тебе поки що немає збережених балів. Ти можеш легко фіксувати бали за лаби, тести та контрольні!\n\n` +
      `📌 *Як додати бали:*\n` +
      `\`/rso_add <предмет> <бали> [опис]\`\n\n` +
      `💡 *Приклади для групи ПІ-51:*\n` +
      `• \`/rso_add прог 15 Лабораторна 1\`\n` +
      `• \`/rso_add матан 20 Контрольна робота\`\n` +
      `• \`/rso_add спец 12 Практикум\`\n` +
      `• \`/rso_add теск 10 Лаба з кіл\`\n` +
      `• \`/rso_add англ 15 Модульний тест\`\n\n` +
      `🎯 *Швидкий розрахунок цілей:*\n` +
      `\`/rso_calc [поточні_бали]\` (наприклад: \`/rso_calc 45\`)\n\n` +
      `_Бот підрахує твій прогрес та покаже, скільки лишилося до заліку (60 б.) чи автомату (95 б.)!_`
    );
  }

  let text = `📊 *Твої бали РСО (Рейтингова система КПІ):*\n\n`;
  let totalScore = 0;
  let count = 0;

  for (const [subjName, data] of Object.entries(userScores)) {
    const score = data.score || 0;
    totalScore += score;
    count++;
    const grade = getEctsGrade(score);
    const bar = renderProgressBar(score);

    text += `*${subjName}*\n`;
    text += `   ${bar} *${score} / 100 б.* (${grade.icon} ${grade.title})\n`;

    if (score >= 95) {
      text += `   🏆 *Оцінка «Відмінно» (Автомат) досягнута!*\n`;
    } else if (score >= 60) {
      text += `   ✅ *Залік складено!* До автомату (95 б.): ще *+${(95 - score).toFixed(1)} б.*\n`;
    } else {
      text += `   🟢 До заліку / допуску (60 б.): ще *+${(60 - score).toFixed(1)} б.*\n`;
      text += `   👍 До «Добре» (75 б.): ще *+${(75 - score).toFixed(1)} б.*\n`;
    }

    if (data.items && data.items.length > 0) {
      const recent = data.items.slice(-3).map(it => `${it.title} (+${it.points})`).join(', ');
      text += `   📝 _Історія:_ ${recent}\n`;
    }
    text += `\n`;
  }

  const avg = (totalScore / count).toFixed(1);
  text += `📈 *Середній рейтинг по предметах:* *${avg} / 100 б.*\n\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `➕ *Додати бали:* \`/rso_add [предмет] [бал] [опис]\`\n`;
  text += `🎯 *Розрахувати ціль:* \`/rso_calc [бал]\`\n`;
  text += `🗑 *Скинути предмет:* \`/rso_reset [предмет]\` (або \`/rso_reset все\`)`;

  return sendMessage(chatId, text);
}

async function handleAddRso(chatId, text) {
  const raw = text.replace(/^\/rso_add\s+/i, '').trim();
  if (!raw) {
    return sendMessage(
      chatId,
      `⚠️ Вкажи дані у форматі:\n\`/rso_add [предмет] [бал] [опис]\`\n\nПриклад:\n\`/rso_add прог 15 Лабораторна 1\``
    );
  }

  const tokens = raw.split(/\s+/);
  let pointsIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (/^[0-9]+([.,][0-9]+)?$/.test(tokens[i])) {
      pointsIdx = i;
      break;
    }
  }

  if (pointsIdx === -1) {
    return sendMessage(
      chatId,
      `⚠️ Не вдалося знайти кількість балів. Вкажи число, наприклад:\n\`/rso_add прог 15 Лаба 1\``
    );
  }

  const points = parseFloat(tokens[pointsIdx].replace(',', '.'));
  const subjectRaw = tokens.slice(0, pointsIdx).join(' ');
  const desc = tokens.slice(pointsIdx + 1).join(' ') || 'Додано бали';

  if (!subjectRaw) {
    return sendMessage(chatId, `⚠️ Вкажи назву предмета, наприклад:\n\`/rso_add прог 15 Лаба 1\``);
  }

  const subject = normalizeSubject(subjectRaw);
  rsoData = loadRso();

  if (!rsoData[chatId]) {
    rsoData[chatId] = {};
  }
  if (!rsoData[chatId][subject]) {
    rsoData[chatId][subject] = { score: 0, items: [] };
  }

  rsoData[chatId][subject].score = Math.round((rsoData[chatId][subject].score + points) * 10) / 10;
  rsoData[chatId][subject].items.push({
    points,
    title: desc,
    date: getTodayDateStr(0),
  });
  saveRso(rsoData);

  const curScore = rsoData[chatId][subject].score;
  const grade = getEctsGrade(curScore);
  const bar = renderProgressBar(curScore);

  let progressText = '';
  if (curScore >= 95) {
    progressText = `🏆 *Вітаю! Автомат / Відмінно гарантовано!*`;
  } else if (curScore >= 60) {
    progressText = `✅ *Залік складено!* До автомату (95 б.) лишилося: *+${(95 - curScore).toFixed(1)} б.*`;
  } else {
    progressText = `⏳ До заліку / допуску (60 б.) лишилося: *+${(60 - curScore).toFixed(1)} б.*`;
  }

  return sendMessage(
    chatId,
    `✅ *Бали успішно додано!* 📈\n\n` +
    `Предмет: *${subject}*\n` +
    `За що: *${desc}* (+${points} б.)\n\n` +
    `📊 *Поточний результат:* ${bar} *${curScore} / 100 б.*\n` +
    `Рівень: *${grade.icon} ${grade.title} (${grade.letter})*\n` +
    `${progressText}\n\n` +
    `_Переглянути всі предмети:_ \`/rso\``
  );
}

async function handleDelRso(chatId, text) {
  const raw = text.replace(/^\/(?:rso_del|rso_reset)\s*/i, '').trim();
  if (!raw) {
    return sendMessage(chatId, `⚠️ Вкажи предмет для скидання:\n\`/rso_reset прог\` або \`/rso_reset все\``);
  }

  rsoData = loadRso();
  if (!rsoData[chatId] || Object.keys(rsoData[chatId]).length === 0) {
    return sendMessage(chatId, `ℹ️ У тебе немає збережених балів для видалення.`);
  }

  if (raw.toLowerCase() === 'все' || raw.toLowerCase() === 'all') {
    delete rsoData[chatId];
    saveRso(rsoData);
    return sendMessage(chatId, `🗑 *Всі бали РСО повністю очищено!*`);
  }

  const norm = normalizeSubject(raw);
  const existingKey = Object.keys(rsoData[chatId]).find(k => k === norm || k.toLowerCase().includes(raw.toLowerCase()));

  if (!existingKey) {
    return sendMessage(chatId, `❌ Предмет *${raw}* не знайдено серед твоїх записів.`);
  }

  delete rsoData[chatId][existingKey];
  saveRso(rsoData);
  return sendMessage(chatId, `🗑 *Бали для предмету "${existingKey}" скинуто!*`);
}

async function handleRsoCalc(chatId, text) {
  const raw = text.replace(/^\/rso_calc\s*/i, '').trim();
  const num = parseFloat(raw.replace(',', '.'));
  if (isNaN(num)) {
    return sendMessage(
      chatId,
      `🎯 *Калькулятор цілей РСО*\n\nВкажи свій поточний бал:\n\`/rso_calc 45\`\n\nБот розрахує точну кількість балів, якої не вистачає до кожної оцінки!`
    );
  }

  const score = Math.max(0, Math.min(100, num));
  const grade = getEctsGrade(score);
  const bar = renderProgressBar(score);

  let to60 = score >= 60 ? '✅ Досягнуто (Залік є!)' : `⏳ Потрібно ще *+${(60 - score).toFixed(1)} б.*`;
  let to75 = score >= 75 ? '✅ Досягнуто (Оцінка Добре)' : `⏳ Потрібно ще *+${(75 - score).toFixed(1)} б.*`;
  let to85 = score >= 85 ? '✅ Досягнуто (Дуже добре)' : `⏳ Потрібно ще *+${(85 - score).toFixed(1)} б.*`;
  let to95 = score >= 95 ? '🏆 Досягнуто (Автомат / Відмінно!)' : `⏳ Потрібно ще *+${(95 - score).toFixed(1)} б.*`;

  return sendMessage(
    chatId,
    `🎯 *Розрахунок цілей РСО для балу ${score}:*\n\n` +
    `${bar} *${score} / 100 б.*\n` +
    `Поточний статус: *${grade.icon} ${grade.title} (${grade.letter})*\n\n` +
    `• 🟢 *До заліку / допуску (60 б.):*\n   ${to60}\n` +
    `• 👍 *До оцінки «Добре» (75 б., C):*\n   ${to75}\n` +
    `• ✨ *До оцінки «Дуже добре» (85 б., B):*\n   ${to85}\n` +
    `• 🏆 *До «Автомату / Відмінно» (95 б., A):*\n   ${to95}`
  );
}

// --- Survival / Panic Mode (SOS) ---
async function handleSos(chatId) {
  deadlines = loadDeadlines();
  rsoData = loadRso();
  const userScores = rsoData[chatId] || {};

  // 1. Analyze Deadlines
  const activeDeadlines = [];
  const overdueDeadlines = [];

  for (const d of deadlines) {
    const diff = getDaysDiff(d.date);
    if (diff < 0) {
      overdueDeadlines.push({ ...d, diff });
    } else {
      activeDeadlines.push({ ...d, diff });
    }
  }

  activeDeadlines.sort((a, b) => a.diff - b.diff);
  overdueDeadlines.sort((a, b) => b.diff - a.diff);

  const burningNow = activeDeadlines.filter(d => d.diff <= 1);
  const burningSoon = activeDeadlines.filter(d => d.diff >= 2 && d.diff <= 4);
  const laterTasks = activeDeadlines.filter(d => d.diff > 4);

  // 2. Analyze RSO Critical Subjects (< 60 points)
  const criticalSubjects = [];
  const safeSubjects = [];

  for (const [subjName, data] of Object.entries(userScores)) {
    const score = data.score || 0;
    if (score < 60) {
      criticalSubjects.push({ name: subjName, score, need: Math.round((60 - score) * 10) / 10 });
    } else {
      safeSubjects.push({ name: subjName, score });
    }
  }
  criticalSubjects.sort((a, b) => b.need - a.need);

  let text = `🚨 *РЕЖИМ SOS: ПЛАН ВИЖИВАННЯ ДЛЯ ПІ-51* 🚨\n\n`;
  text += `_Спокійно, без паніки! Розкладаємо весь завал на чіткі пріоритети:_\n\n`;

  // Section 1: Burning Deadlines
  if (burningNow.length > 0) {
    text += `🔥 *ГОРИТЬ ЗАРАЗ (Сьогодні / Завтра):*\n`;
    burningNow.forEach(d => {
      const tag = d.diff === 0 ? '🔴 СЬОГОДНІ' : '⚠️ ЗАВТРА';
      text += `• ${tag}: *${d.title}* (ID: \`${d.id}\`)\n`;
    });
    text += `\n`;
  }

  if (burningSoon.length > 0) {
    text += `⏳ *НА ПІДХОДІ (2–4 дні):*\n`;
    burningSoon.forEach(d => {
      text += `• Через ${d.diff} дн.: *${d.title}* (ID: \`${d.id}\`)\n`;
    });
    text += `\n`;
  }

  if (overdueDeadlines.length > 0) {
    text += `⚠️ *ПРОСТРОЧЕНО (здати якомога швидше):*\n`;
    overdueDeadlines.forEach(d => {
      text += `• Прострочено на ${Math.abs(d.diff)} дн.: *${d.title}* (ID: \`${d.id}\`)\n`;
    });
    text += `\n`;
  }

  if (activeDeadlines.length === 0 && overdueDeadlines.length === 0) {
    text += `🟢 *Активних дедлайнів немає!* У списку завдань зараз чисто й спокійно.\n\n`;
  }

  // Section 2: RSO Health Check
  if (criticalSubjects.length > 0) {
    text += `📉 *НЕБЕЗПЕЧНІ ЗОНИ ПО РСО (< 60 б.):*\n`;
    criticalSubjects.forEach(s => {
      text += `• ${s.name}: *${s.score} / 100 б.* (до заліку ще *+${s.need} б.*)\n`;
    });
    text += `\n`;
  } else if (safeSubjects.length > 0) {
    text += `🛡 *По РСО порядок:* усі записані дисципліни мають 60+ балів!\n\n`;
  }

  // Section 3: Strategic Action Plan
  text += `🎯 *ТВІЙ ПОКРОКОВИЙ ПЛАН ДІЙ:*\n`;

  let stepNum = 1;
  if (burningNow.length > 0) {
    const topUrgent = burningNow[0];
    text += `1️⃣ *Крок 1:* Сконцентруйся на *«${topUrgent.title}»*. Здай його першим — це зніме 50% стресу та вбереже від дедлайну.\n`;
    stepNum++;
  } else if (overdueDeadlines.length > 0) {
    const topOverdue = overdueDeadlines[0];
    text += `1️⃣ *Крок 1:* Напиши викладачу з приводу хвоста *«${topOverdue.title}»* і здай його сьогодні.\n`;
    stepNum++;
  }

  if (criticalSubjects.length > 0) {
    const worstSubj = criticalSubjects[0];
    text += `${stepNum}️⃣ *Крок ${stepNum}:* Зроби додаткову лабу чи тест з *«${worstSubj.name}»*, щоб добрати +${worstSubj.need} б. до допуску.\n`;
    stepNum++;
  } else if (burningSoon.length > 0) {
    const nextTask = burningSoon[0];
    text += `${stepNum}️⃣ *Крок ${stepNum}:* Почни заздалегідь робити *«${nextTask.title}»*, щоб не сидіти в останню ніч.\n`;
    stepNum++;
  }

  text += `${stepNum}️⃣ *Крок ${stepNum}:* Працюй відрізками по 45 хвилин із 10-хвилинними перервами. Заряди телефон і ноут!\n\n`;

  text += `💪 _Пам'ятай: «Очі бояться, а руки роблять». Закрив завдання — тисни \`/done [id]\` і рухайся далі!_`;

  return sendMessage(chatId, text);
}

// Light & DTEK Info Handler
async function handleLight(chatId) {
  if (String(chatId) !== BOSS_ID) {
    const publicText =
      `⚡ *Графіки відключень світла ДТЕК:*\n\n` +
      `🔗 *Офіційні ресурси перевірки графіків у реальному часі:*\n` +
      `👉 [ДТЕК Київські електромережі (м. Київ)](https://www.dtek-kem.com.ua/ua/shutdowns)\n` +
      `👉 [ДТЕК Київські регіональні електромережі (Область)](https://www.dtek-krem.com.ua/ua/shutdowns)\n` +
      `👉 [Чат-бот ДТЕК КРЕМ у Telegram](https://t.me/DTEKKyivRegionElektromerezhiBot)\n` +
      `👉 [Чат-бот ДТЕК КЕМ у Telegram](https://t.me/DTEKKyivskieElektromerezhibot)\n\n` +
      `💡 _Обери свій населений пункт, вулицю та номер будинку у відповідному боті для отримання сповіщень про свою чергу!_`;
    return sendMessage(chatId, publicText);
  }

  const text = 
    `⚡ *Графік відключень світла — м. Вишгород (Черга 6.2):*\n\n` +
    `📍 *Локація:* м. Вишгород (Київська обл.)\n` +
    `🏷 *Твоя лінія / черга:* **6.2** (ДТЕК Київські регіональні електромережі)\n\n` +
    `🔗 *Офіційні ресурси перевірки відключень у реальному часі:*\n` +
    `👉 [Перевірити графік на сайті ДТЕК КРЕМ (Вишгород)](https://www.dtek-krem.com.ua/ua/shutdowns)\n` +
    `👉 [Чат-бот ДТЕК КРЕМ у Telegram](https://t.me/DTEKKyivRegionElektromerezhiBot)\n` +
    `👉 [Чат-бот ДТЕК КРЕМ у Viber](https://chats.viber.com/dtekkyivregionelektromerezhi)\n\n` +
    `📞 *Кол-центр ДТЕК КРЕМ:* \`0800 400 740\` або \`(067) 495 70 40\`\n\n` +
    `💡 _Підказка: У боті ДТЕК КРЕМ введи назву міста "Вишгород", свою вулицю і будинок — і він надсилатиме тобі прямі пуші про відключення саме твоєї черги 6.2!_`;

  return sendMessage(chatId, text);
}

// Background Alert Monitor (checks every 15 seconds)
async function monitorAirRaid() {
  try {
    const status = await fetchKyivAlarm();
    if (!status) return;

    const subIds = Object.keys(subscribers).filter(id => subscribers[id].notifications !== false);

    if (lastKyivAlarmState !== null && lastKyivAlarmState !== status.isActive) {
      const timeStr = status.changed ? status.changed.slice(11, 16) : 'зараз';

      if (status.isActive) {
        console.log('🚨 AIR RAID ALARM STARTED IN KYIV!');
        const msg = 
          `🚨 *УВАГА! ПОВІТРЯНА ТРИВОГА У КИЄВІ!* 🚨\n\n` +
          `⏰ Час початку: *${timeStr}*\n\n` +
          `⚠️ *За правилами КПІ пари призупинено!* Навчальний процес під час тривоги не проводиться.\n` +
          `Перейди в укриття та бережи себе! 🛡`;
        
        for (const chatId of subIds) {
          await sendMessage(chatId, msg);
        }
      } else {
        console.log('🟢 AIR RAID ALARM ENDED IN KYIV!');
        const msg = 
          `🟢 *ВІДБІЙ ПОВІТРЯНОЇ ТРИВОГИ У КИЄВІ!* 🟢\n\n` +
          `⏰ Час відбою: *${timeStr}*\n\n` +
          `✅ Небезпека минула! Навчальний процес відновлюється за розкладом. 🎓`;

        for (const chatId of subIds) {
          await sendMessage(chatId, msg);
        }
      }
    }

    lastKyivAlarmState = status.isActive;
    lastKyivAlarmChanged = status.changed;
  } catch (err) {
    console.error('Error in monitorAirRaid:', err);
  }
}

// Background scheduler
let alertedToday = new Set();
let morningDigestSentDay = null;

async function checkAndSendPairAlerts() {
  try {
    const now = getKyivDate();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const timeInMinutes = currentHours * 60 + currentMinutes;
    const todayDateStr = getTodayDateStr(0);

    if (morningDigestSentDay !== todayDateStr && currentHours === 0 && currentMinutes < 5) {
      alertedToday.clear();
    }

    const kpiTime = await getCurrentKpiTime();
    const pairs = await getDaySchedule(kpiTime.currentDay, kpiTime.currentWeek, todayDateStr);
    if (!pairs || pairs.length === 0) return;

    const subIds = Object.keys(subscribers).filter(id => subscribers[id].notifications !== false);
    if (subIds.length === 0) return;

    // 1. Morning Digest at 07:45 Kyiv time
    if (morningDigestSentDay !== todayDateStr && currentHours === 7 && currentMinutes >= 45 && currentMinutes <= 55) {
      morningDigestSentDay = todayDateStr;
      const dayInfo = DAY_NAMES[kpiTime.currentDay] || { full: 'Сьогодні' };
      const list = pairs.map((p, i) => formatPair(p, i + 1)).join('\n\n');
      const banner = getAlarmBanner();

      deadlines = loadDeadlines();
      const upcomingDeadlines = deadlines.filter(d => {
        const diff = getDaysDiff(d.date);
        return diff >= 0 && diff <= 3;
      });

      let deadlinesSection = '';
      if (upcomingDeadlines.length > 0) {
        deadlinesSection = `\n\n📌 *Найближчі дедлайни:*\n` + upcomingDeadlines.map(d => {
          const diff = getDaysDiff(d.date);
          const prefix = diff === 0 ? '🔴 СЬОГОДНІ: ' : (diff === 1 ? '⚠️ ЗАВТРА: ' : `⏳ (${diff} дн.): `);
          return `• ${prefix}*${d.title}*`;
        }).join('\n');
      }

      const msg = `🌅 *Доброго ранку!*\n\nСьогодні *${dayInfo.full}* (${kpiTime.currentWeek}-й тиждень, ${todayDateStr}).\nОсь твій розклад на сьогодні:\n\n${list}${banner}${deadlinesSection}\n\nУспішного дня! 🚀`;
      for (const chatId of subIds) {
        await sendMessage(chatId, msg);
      }
    }

    // 2. Alert 15 minutes before each pair
    for (const pair of pairs) {
      const [pHour, pMin] = pair.time.split(':').map(Number);
      const pairStartMinutes = pHour * 60 + pMin;
      const diff = pairStartMinutes - timeInMinutes;

      const alertKey = `${todayDateStr}_${pair.time}_${pair.name}`;
      if (diff >= 14 && diff <= 16 && !alertedToday.has(alertKey)) {
        alertedToday.add(alertKey);
        
        let alarmWarning = '';
        if (lastKyivAlarmState === true) {
          alarmWarning = `\n\n🚨 *ЗВЕРНИ УВАГУ:* У Києві зараз триває повітряна тривога! За правилами пари не проводяться, уточни у викладача чи буде пара.`;
        }

        const msg = `🔔 *Через 15 хвилин пара!*\n\n${formatPair(pair)}${alarmWarning}\n\nНе запізнюйся! ⚡`;
        for (const chatId of subIds) {
          await sendMessage(chatId, msg);
        }
      }
    }
  } catch (err) {
    console.error('Error in checkAndSendPairAlerts:', err);
  }
}

// Fast Polling loop
let lastUpdateId = 0;

async function pollUpdates() {
  try {
    const res = await tgRequest('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 10,
    });

    if (res && res.ok && Array.isArray(res.result)) {
      for (const update of res.result) {
        lastUpdateId = update.update_id;
        if (!update.message || !update.message.text) continue;

        const chatId = update.message.chat.id;
        const text = update.message.text.trim();
        const from = update.message.from?.first_name || 'Студент';

        if (!subscribers[chatId]) {
          const uName = update.message.from?.username || '';
          subscribers[chatId] = {
            name: from,
            username: uName,
            notifications: true,
            joinedAt: new Date().toISOString(),
          };
          saveSubscribers(subscribers);

          // Alert boss in real-time
          if (String(chatId) !== BOSS_ID) {
            const handle = uName ? ` (@${uName})` : '';
            sendMessage(
              BOSS_ID,
              `👋 *Новий користувач запустив бота!*\n\n👤 *${from}*${handle}\n🆔 ID: \`${chatId}\``
            ).catch(() => {});
          }
        }

        console.log(`[MSG from ${from} (${chatId})]: ${text}`);

        if (text === '/start') {
          const isBoss = String(chatId) === BOSS_ID;
          const lightLine = isBoss ? `⚡ *Графік світла* (м. Вишгород, черга 6.2)\n` : '';
          await sendMessage(
            chatId,
            `👋 *Привіт!*\n\nЯ персональний помічник по розкладу для групи *ПІ-51*.\n\n` +
            `✅ Автоматичний розклад з офіційного сервера КПІ (Campus)\n` +
            `⏰ Нагадування за *15 хвилин* до кожної пари з Zoom-посиланням\n` +
            `🚨 *Моніторинг повітряних тривог Києва* у реальному часі\n` +
            `📝 *Трекер дедлайнів по лабам* (\`/add 29.09 Назва\`)\n` +
            `📊 *Калькулятор балів РСО КПІ* (\`/rso\` або \`/rso_add\`)\n` +
            `🚨 *Режим SOS / План виживання* (\`/sos\`) — порятунок від завалів\n` +
            lightLine +
            `🌅 Ранковий дайджест о 07:45 зі списком пар та дедлайнів!\n\n` +
            `Тисни на кнопки внизу для перевірки! 👇`
          );
          await handleToday(chatId);
        } else if (text === '📅 Сьогодні' || text === '/today') {
          await handleToday(chatId);
        } else if (text === '⏭ Завтра' || text === '/tomorrow') {
          await handleTomorrow(chatId);
        } else if (text === '🗓 Цей тиждень' || text === '/week') {
          await handleWeek(chatId);
        } else if (text === '🗓 Наступний тиждень' || text === '🗓 Наступний' || text === '/nextweek') {
          const kpi = await getCurrentKpiTime();
          const nextWeek = kpi.currentWeek === 1 ? 2 : 1;
          await handleWeek(chatId, nextWeek);
        } else if (text === '⏰ Що зараз?' || text === '⏰ Зараз' || text === '/now') {
          await handleNow(chatId);
        } else if (text === '🚨 Статус тривоги' || text === '🚨 Тривога' || text === '/alarm') {
          await handleAlarmStatus(chatId);
        } else if (text === '📝 Дедлайни' || text === '/deadlines' || text === '/tasks') {
          await handleShowDeadlines(chatId);
        } else if (text.startsWith('/add') || text.startsWith('/task')) {
          await handleAddDeadline(chatId, text, update.message.from);
        } else if (text.startsWith('/done') || text.startsWith('/del')) {
          await handleDeleteDeadline(chatId, text, update.message.from);
        } else if (text === '📊 Бали РСО' || text === '/rso') {
          await handleRso(chatId);
        } else if (text.startsWith('/rso_add')) {
          await handleAddRso(chatId, text);
        } else if (text.startsWith('/rso_del') || text.startsWith('/rso_reset')) {
          await handleDelRso(chatId, text);
        } else if (text.startsWith('/rso_calc')) {
          await handleRsoCalc(chatId, text);
        } else if (text === '🚨 Режим SOS' || text === '🚨 SOS' || text === '/sos' || text === '/panic') {
          await handleSos(chatId);
        } else if (text === '⚡ Графік світла' || text === '⚡ Світло' || text === '/light') {
          await handleLight(chatId);
        } else if (text === '🔗 Всі посилання' || text === '🔗 Посилання' || text === '/links') {
          await handleAllLinks(chatId);
        } else if (text === '/users' || text === '/subscribers' || text === '/stats') {
          const list = Object.keys(subscribers).map((id, idx) => {
            const u = subscribers[id];
            const handle = u.username ? ` (@${u.username})` : '';
            return `${idx + 1}. *${u.name || 'Студент'}*${handle}\n   🆔 \`${id}\`\n   📅 Приєднався: ${u.joinedAt ? u.joinedAt.slice(0, 16).replace('T', ' ') : 'раніше'}`;
          }).join('\n\n');

          await sendMessage(
            chatId,
            `👥 *Користувачі бота (всього: ${Object.keys(subscribers).length}):*\n\n${list || 'Поки що немає даних.'}`
          );
        } else if (text === '🔔 Сповіщення') {
          const current = subscribers[chatId]?.notifications !== false;
          subscribers[chatId].notifications = !current;
          saveSubscribers(subscribers);
          const status = !current ? 'увімкнено 🔔' : 'вимкнено 🔕';
          await sendMessage(chatId, `Статус автоматичних нагадувань: *${status}*`);
        } else {
          await sendMessage(chatId, `Не зовсім зрозумів команду. Скористайся кнопками внизу! 👇`);
        }
      }
    }
  } catch (err) {
    console.error('Polling error:', err.message);
  }

  setTimeout(pollUpdates, 100);
}

// Start
console.log('🚀 Бот розкладу ПІ-51, тривог, дедлайнів та світла запущений!');

// Make sure webhook is clean
tgRequest('deleteWebhook').then(() => {
  console.log('✅ Webhook cleaned up for fast polling.');
  pollUpdates();
});

fetchKyivAlarm().then(st => {
  if (st) {
    lastKyivAlarmState = st.isActive;
    lastKyivAlarmChanged = st.changed;
    console.log(`Початковий статус тривоги у Києві: ${st.isActive ? '🚨 ТРИВОГА' : '🟢 ВІДБІЙ'}`);
  }
});

// Alarm monitor (every 15 seconds)
setInterval(monitorAirRaid, 15000);

// Pair alerts scheduler (every 30 seconds)
setInterval(checkAndSendPairAlerts, 30000);
checkAndSendPairAlerts();
