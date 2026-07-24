const today = new Date().toISOString().slice(0, 10);
const currentWeek = getWeekRange(today);

const state = {
  activeView: 'dashboard',
  activePlayer: 'male',
  imageData: '',
  trendPoints: [],
  players: JSON.parse(localStorage.getItem('shuangran.players') || 'null') || {
    male: {
      name: '柯柯', gender: 'male', height: 175, factor: 1,
      records: []
    },
    female: {
      name: '兔姐', gender: 'female', height: 163, factor: 1.28,
      records: []
    }
  }
};

state.players.male.name = '柯柯';
state.players.female.name = '兔姐';
state.players.male.records = removeDemoRecords(state.players.male.records || []);
state.players.female.records = removeDemoRecords(state.players.female.records || []);

function rec(date, weight, fat, muscle, metabolism, image = 'demo') {
  return { date, weight, fat, muscle, metabolism, image, state: '力量训练', note: '' };
}

function removeDemoRecords(records) {
  return records.filter(record => record.image !== 'demo');
}

function isFilled(value) { return value !== '' && value !== null && value !== undefined && !Number.isNaN(Number(value)); }
function display(value, suffix = '') { return isFilled(value) ? `${value}${suffix}` : '-'; }
function round(value, digits = 2) { return Number(value.toFixed(digits)); }
function pct(start, end) { return ((end - start) / start) * 100; }

function scorePlayer(player) {
  const records = currentWeekRecords(player).filter(hasCoreFields).sort((a, b) => a.date.localeCompare(b.date));
  const validDays = currentWeekRecords(player).filter(r => r.image && hasCoreFields(r)).length;
  const missingDays = Math.max(0, 7 - validDays);
  if (records.length < 2) {
    return emptyScore(player, validDays, missingDays, '至少需要本周两天完整数据才能计算趋势分。');
  }
  if (missingDays > 0) {
    return emptyScore(player, validDays, missingDays, `本周仍缺少 ${missingDays} 天完整截图数据，结算前暂不计分。`);
  }

  const first = records[0];
  const last = records[records.length - 1];
  const fatDrop = ((first.fat - last.fat) / first.fat) * 100;
  const muscleChange = pct(first.muscle, last.muscle);
  const weightChange = Math.abs(pct(first.weight, last.weight));
  const weightDrop = ((first.weight - last.weight) / first.weight) * 100;
  const metabolismChange = pct(first.metabolism, last.metabolism);

  const fatFull = player.gender === 'male' ? 1.2 : 1.0;
  let fatScore = 0;
  if (fatDrop >= fatFull) fatScore = 40;
  else if (fatDrop >= 0.6) fatScore = 22;
  else if (fatDrop >= 0.1) fatScore = 10;

  const muscleFull = player.gender === 'male' ? 0.7 : 0.4;
  const muscleMid = player.gender === 'male' ? 0.35 : 0.2;
  const muscleLow = player.gender === 'male' ? 0.34 : 0.19;
  let muscleScore = 0;
  if (muscleChange >= muscleFull) muscleScore = 35;
  else if (muscleChange >= muscleMid) muscleScore = 18;
  else if (muscleChange >= 0 && muscleChange <= muscleLow) muscleScore = 8;
  else if (muscleChange < 0) muscleScore = -15;

  const healthyBand = player.gender === 'male' ? 1.8 : 1.2;
  let weightScore = weightChange <= healthyBand ? 15 : 5;
  if (weightDrop > 3) weightScore = 0;

  let metabolismScore = 0;
  if (metabolismChange >= 0) metabolismScore = 10;
  else if (metabolismChange > -2) metabolismScore = 4;

  const raw = fatScore + muscleScore + weightScore + metabolismScore;
  return {
    validDays, missingDays, fatScore, muscleScore, weightScore, metabolismScore,
    raw: round(raw), final: round(raw * player.factor, 1),
    fatDrop: round(fatDrop), muscleChange: round(muscleChange),
    weightChange: round(weightChange), metabolismChange: round(metabolismChange),
    summary: summaryText(fatScore, muscleScore, weightScore, metabolismScore)
  };
}

function emptyScore(player, validDays, missingDays, summary) {
  return { validDays, missingDays, fatScore: '-', muscleScore: '-', weightScore: '-', metabolismScore: '-', raw: '-', final: '-', fatDrop: '-', muscleChange: '-', weightChange: '-', metabolismChange: '-', summary };
}

function summaryText(fat, muscle, weight, metabolism) {
  const notes = [];
  if (fat >= 22) notes.push('体脂优化表现亮眼');
  if (muscle >= 18) notes.push('骨骼肌增长有效');
  if (muscle < 0) notes.push('肌肉流失拖累得分');
  if (weight === 15) notes.push('体重控制稳定');
  if (metabolism === 10) notes.push('基础代谢保持住了');
  return notes.length ? `${notes.join('，')}。` : '本周变化较温和，继续稳定推进。';
}

function getScores() {
  const male = scorePlayer(state.players.male);
  const female = scorePlayer(state.players.female);
  const maleFinal = Number(male.final);
  const femaleFinal = Number(female.final);
  if (!isFilled(maleFinal) && !isFilled(femaleFinal)) return { male, female, winnerKey: null, winner: null };
  const winnerKey = maleFinal > femaleFinal ? 'male' : femaleFinal > maleFinal ? 'female' : Number(male.muscleChange) >= Number(female.muscleChange) ? 'male' : 'female';
  return { male, female, winnerKey, winner: state.players[winnerKey] };
}

function render() {
  const scores = getScores();
  document.querySelector('#leaderPill').textContent = scores.winner ? `${scores.winner.name}领先 · ${scores[scores.winnerKey].final}分` : '等待完整数据';
  document.querySelector('#seasonRange').textContent = `${currentWeek.start} 至 ${currentWeek.end}`;
  renderScoreCard('male', scores.male);
  renderScoreCard('female', scores.female);
  renderDashboard(scores);
  renderRecordList();
  renderReport(scores);
  drawTrend();
  localStorage.setItem('shuangran.players', JSON.stringify(state.players));
}

function renderScoreCard(key, score) {
  const player = state.players[key];
  const latest = latestRecord(player);
  document.querySelector(`#${key}ScoreCard`).innerHTML = `
    <div class="score-name"><span>${player.name}</span><span class="gender-tag">${player.gender === 'male' ? '男 · ×1.00' : '女 · ×1.28'}</span></div>
    <div class="score-number">${score.final}</div>
    <div class="score-sub">原始 ${score.raw} 分 · 有效记录 ${score.validDays}/7</div>
    <div class="score-kpis">
      <div class="mini-kpi"><span>体重</span><strong>${display(latest?.weight, ' kg')}</strong></div>
      <div class="mini-kpi"><span>体脂</span><strong>${display(latest?.fat, '%')}</strong></div>
      <div class="mini-kpi"><span>骨骼肌</span><strong>${display(latest?.muscle, ' kg')}</strong></div>
      <div class="mini-kpi"><span>基础代谢</span><strong>${display(latest?.metabolism)}</strong></div>
    </div>`;
}

function renderDashboard(scores) {
  document.querySelector('#weeklyInsight').textContent = scores.winner ? `本周暂时由${scores.winner.name}领先。${scores.winner.name}${scores[scores.winnerKey].summary}` : '上传每天的体脂秤截图后，系统会尝试 OCR 自动识别数据；识别不到的字段保持空值，不参与计算。下一周会按日期自动生成新的自然周。';
  const totalValid = scores.male.validDays + scores.female.validDays;
  document.querySelector('#recordCountLabel').textContent = `双方 ${totalValid}/14`;
  document.querySelector('#todayGrid').innerHTML = ['male', 'female'].map(key => {
    const player = state.players[key];
    const latest = latestRecord(player);
    return `<article class="today-card"><strong>${player.name}</strong><div class="status-ok">${latest?.image ? '今日已记录' : '等待截图'}</div><div class="metric-line">体重 ${display(latest?.weight, ' kg')}</div><div class="metric-line">体脂 ${display(latest?.fat, '%')}</div><div class="metric-line">骨骼肌 ${display(latest?.muscle, ' kg')}</div></article>`;
  }).join('');
}

function renderRecordList() {
  const player = state.players[state.activePlayer];
  const records = currentWeekRecords(player).sort((a, b) => b.date.localeCompare(a.date));
  document.querySelector('#recordList').innerHTML = records.length ? records.map(r => `
    <article class="record-item">
      <div><strong>${r.date} · ${r.state || '未标记'}</strong><span>${display(r.weight, 'kg')} / ${display(r.fat, '%')} / 骨骼肌 ${display(r.muscle, 'kg')} / 代谢 ${display(r.metabolism)}</span></div>
      <div class="thumb">${r.image && r.image !== 'demo' ? `<img src="${r.image}" alt="截图">` : '图'}</div>
    </article>`).join('') : '<p class="summary">本周还没有记录。上传截图后会自动识别并保存到这里。</p>';
}

function renderReport(scores) {
  document.querySelector('#winnerPanel').innerHTML = scores.winner ? `<h3>本周冠军：${scores.winner.name}</h3><p>${scores.winner.name}最终分更高。单周胜负独立结算，赛季累计总分定总冠军。</p>` : '<h3>等待本周完整数据</h3><p>当前没有足够完整的数据结算。本周结束后会根据自然周日期自动统计，不需要手动创建下一周。</p>';
  document.querySelector('#breakdownGrid').innerHTML = ['male', 'female'].map(key => breakdownHtml(state.players[key], scores[key])).join('');
}

function breakdownHtml(player, score) {
  return `<section class="panel"><div class="panel-head"><h3>${player.name} · ${score.final} 分</h3><span>${score.raw} × ${player.factor}</span></div>
    ${scoreRow('体脂率优化', score.fatScore, `变化 ${score.fatDrop}%`)}
    ${scoreRow('骨骼肌增长', score.muscleScore, `变化 ${score.muscleChange}%`)}
    ${scoreRow('健康体重稳定', score.weightScore, `波动 ${score.weightChange}%`)}
    ${scoreRow('基础代谢维持', score.metabolismScore, `变化 ${score.metabolismChange}%`)}
    <p class="summary">${score.summary}</p></section>`;
}

function scoreRow(label, value, detail) {
  return `<div class="score-row"><div><strong>${label}</strong><br><span>${detail}</span></div><b>${value}</b></div>`;
}

function latestRecord(player) { return currentWeekRecords(player).sort((a, b) => a.date.localeCompare(b.date)).at(-1) || {}; }

function currentWeekRecords(player) {
  return [...player.records].filter(r => r.date >= currentWeek.start && r.date <= currentWeek.end);
}

function hasCoreFields(record) {
  return ['weight', 'fat', 'muscle', 'metabolism'].every(key => isFilled(record[key]));
}

function drawTrend() {
  const canvas = document.querySelector('#trendCanvas');
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#596f28');
  bg.addColorStop(0.52, '#758a35');
  bg.addColorStop(1, '#b09359');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, width, height, 22);
  ctx.fill();
  const series = [
    { key: 'male', color: '#fff4b8', glow: 'rgba(255, 244, 184, .32)', fill: 'rgba(255, 244, 184, .16)', label: '柯柯' },
    { key: 'female', color: '#ffd0a3', glow: 'rgba(255, 208, 163, .34)', fill: 'rgba(255, 208, 163, .16)', label: '兔姐' }
  ];
  state.trendPoints = [];
  const all = series.flatMap(s => relativeFatSeries(state.players[s.key].records).map(item => item.value));
  if (!all.length) {
    ctx.fillStyle = 'rgba(255,251,234,.82)';
    ctx.font = '800 24px "SF Pro Rounded", "PingFang SC", system-ui';
    ctx.fillText('暂无本周体脂数据', 54, 118);
    ctx.font = '700 15px "SF Pro Rounded", "PingFang SC", system-ui';
    ctx.fillText('上传截图并识别数据后，这里会自动生成趋势。', 54, 150);
    return;
  }
  const min = Math.min(...all, 0) - 0.25;
  const max = Math.max(...all, 0) + 0.25;
  const plot = { left: 54, right: width - 42, top: 46, bottom: height - 42 };
  drawGrid(ctx, width, height, min, max, plot);
  series.forEach((s, index) => {
    const relative = relativeFatSeries(state.players[s.key].records);
    const points = relative.map((item, i, arr) => {
      const x = plot.left + (i / Math.max(arr.length - 1, 1)) * (plot.right - plot.left);
      const y = plot.top + (1 - ((item.value - min) / (max - min))) * (plot.bottom - plot.top);
      return { x, y, record: item.record, value: item.value, series: s };
    });
    state.trendPoints.push(...points);
    const area = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
    area.addColorStop(0, s.fill);
    area.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, plot.bottom);
    ctx.lineTo(points[0].x, plot.bottom);
    ctx.closePath();
    ctx.fillStyle = area;
    ctx.fill();

    ctx.save();
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.45;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = s.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
    points.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = s.color;
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = s.color;
    ctx.font = '800 22px "SF Pro Rounded", "PingFang SC", system-ui';
    ctx.fillText(s.label, plot.left + index * 92, 30);
  });

  ctx.fillStyle = 'rgba(255,251,234,.78)';
  ctx.font = '700 18px "SF Pro Rounded", "PingFang SC", system-ui';
  ctx.fillText('优化幅度 %', width - 120, 30);
}

function drawGrid(ctx, width, height, min, max, plot) {
  ctx.strokeStyle = 'rgba(255,251,234,.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = plot.top + i * ((plot.bottom - plot.top) / 4);
    ctx.beginPath(); ctx.moveTo(plot.left, y); ctx.lineTo(plot.right, y); ctx.stroke();
    const value = max - i * ((max - min) / 4);
    ctx.fillStyle = 'rgba(255,251,234,.62)';
    ctx.font = '700 13px "SF Pro Rounded", "PingFang SC", system-ui';
    ctx.fillText(`${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, plot.right + 8, y + 4);
  }
  for (let i = 0; i < 7; i++) {
    const x = plot.left + i * ((plot.right - plot.left) / 6);
    ctx.beginPath(); ctx.moveTo(x, plot.top); ctx.lineTo(x, plot.bottom); ctx.stroke();
  }
}

function relativeFatSeries(records) {
  const sorted = [...records].filter(r => r.date >= currentWeek.start && r.date <= currentWeek.end && isFilled(r.fat)).sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0]?.fat || 1;
  return sorted.map(record => ({
    record,
    value: ((first - record.fat) / first) * 100
  }));
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function switchView(view) {
  state.activeView = view;
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `${view}View`));
  document.querySelectorAll('.nav-item, .mobile-tab').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  document.querySelector('#pageTitle').textContent = '异地无监督公平赛';
  if (view === 'record') fillFormFromLatest();
  setTimeout(drawTrend, 60);
}

function bindTrendTooltip() {
  const canvas = document.querySelector('#trendCanvas');
  const tooltip = document.querySelector('#chartTooltip');
  const show = event => {
    if (!state.trendPoints.length) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    let nearest = null;
    let best = Infinity;
    for (const point of state.trendPoints) {
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < best) { best = distance; nearest = point; }
    }
    if (!nearest || best > 34) {
      tooltip.style.display = 'none';
      return;
    }
    tooltip.innerHTML = `<strong>${nearest.series.label} · ${nearest.record.date}</strong><span>优化幅度 ${nearest.value >= 0 ? '+' : ''}${nearest.value.toFixed(2)}%</span><span>真实体脂率 ${nearest.record.fat}%</span><span>体重 ${nearest.record.weight}kg · 骨骼肌 ${nearest.record.muscle}kg</span>`;
    tooltip.style.display = 'block';
    tooltip.style.left = `${nearest.x / scaleX + 10}px`;
    tooltip.style.top = `${nearest.y / scaleY + 4}px`;
  };
  const hide = () => { tooltip.style.display = 'none'; };
  canvas.addEventListener('mousemove', show);
  canvas.addEventListener('mouseleave', hide);
  canvas.addEventListener('touchstart', show, { passive: true });
  canvas.addEventListener('touchmove', show, { passive: true });
  canvas.addEventListener('touchend', hide);
}

function fillFormFromLatest() {
  const latest = latestRecord(state.players[state.activePlayer]);
  document.querySelector('#dateInput').value = today;
  document.querySelector('#weightInput').value = latest.weight ?? '';
  document.querySelector('#fatInput').value = latest.fat ?? '';
  document.querySelector('#muscleInput').value = latest.muscle ?? '';
  document.querySelector('#metabolismInput').value = latest.metabolism ?? '';
}

function fillSettingsForm() {
  document.querySelector('#maleNameSetting').value = state.players.male.name;
  document.querySelector('#maleHeightSetting').value = state.players.male.height ?? '';
  document.querySelector('#femaleNameSetting').value = state.players.female.name;
  document.querySelector('#femaleHeightSetting').value = state.players.female.height ?? '';
}

document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
document.querySelectorAll('.segment').forEach(btn => btn.addEventListener('click', () => {
  state.activePlayer = btn.dataset.player;
  document.querySelectorAll('.segment').forEach(el => el.classList.toggle('active', el === btn));
  state.imageData = '';
  document.querySelector('#imagePreview').removeAttribute('src');
  document.querySelector('.upload-box').classList.remove('has-image');
  fillFormFromLatest();
  renderRecordList();
}));

document.querySelector('#imageInput').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.imageData = reader.result;
    document.querySelector('#imagePreview').src = reader.result;
    document.querySelector('.upload-box').classList.add('has-image');
    document.querySelector('#uploadText').textContent = '已选择截图，点击更换';
    runOcr(reader.result);
  };
  reader.readAsDataURL(file);
});

async function runOcr(imageData) {
  const status = document.querySelector('#ocrStatus');
  if (!window.Tesseract) {
    status.textContent = 'OCR库未加载，已保留手动空值';
    return;
  }
  status.textContent = 'OCR识别中...';
  try {
    const result = await Tesseract.recognize(imageData, 'chi_sim+eng');
    const text = result.data.text || '';
    const parsed = parseScaleText(text);
    fillIfParsed('#weightInput', parsed.weight);
    fillIfParsed('#fatInput', parsed.fat);
    fillIfParsed('#muscleInput', parsed.muscle);
    fillIfParsed('#metabolismInput', parsed.metabolism);
    const found = Object.values(parsed).filter(isFilled).length;
    status.textContent = found ? `OCR完成：识别到 ${found}/4 项` : 'OCR未识别到有效数据，请保留空值或手动修正';
  } catch (error) {
    status.textContent = 'OCR识别失败，字段保持空值';
  }
}

function fillIfParsed(selector, value) {
  if (isFilled(value)) document.querySelector(selector).value = value;
}

function parseScaleText(text) {
  const normalized = text.replace(/\s+/g, ' ').replace(/％/g, '%');
  return {
    weight: pickNumber(normalized, ['体重', 'weight', 'kg']),
    fat: pickNumber(normalized, ['体脂率', '体脂', 'body fat', 'fat']),
    muscle: pickNumber(normalized, ['骨骼肌', '肌肉量', 'skeletal muscle', 'muscle']),
    metabolism: pickNumber(normalized, ['基础代谢', '代谢', 'bmr', 'kcal'])
  };
}

function pickNumber(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}[^0-9]{0,12}([0-9]{2,4}(?:\\.[0-9]{1,2})?)`, 'i');
    const match = text.match(regex);
    if (match) return Number(match[1]);
  }
  return '';
}

document.querySelector('#recordForm').addEventListener('submit', event => {
  event.preventDefault();
  const player = state.players[state.activePlayer];
  const date = document.querySelector('#dateInput').value;
  const next = {
    date,
    weight: readNumber('#weightInput'),
    fat: readNumber('#fatInput'),
    muscle: readNumber('#muscleInput'),
    metabolism: readNumber('#metabolismInput'),
    state: document.querySelector('#stateInput').value,
    note: document.querySelector('#noteInput').value,
    image: state.imageData || ''
  };
  player.records = player.records.filter(r => r.date !== date).concat(next).sort((a, b) => a.date.localeCompare(b.date));
  state.imageData = '';
  document.querySelector('#noteInput').value = '';
  document.querySelector('#imageInput').value = '';
  document.querySelector('.upload-box').classList.remove('has-image');
  document.querySelector('#uploadText').textContent = '上传体脂秤截图';
  render();
  switchView('dashboard');
});

document.querySelector('#settingsForm').addEventListener('submit', event => {
  event.preventDefault();
  state.players.male.name = document.querySelector('#maleNameSetting').value || '柯柯';
  state.players.male.height = readNumber('#maleHeightSetting');
  state.players.female.name = document.querySelector('#femaleNameSetting').value || '兔姐';
  state.players.female.height = readNumber('#femaleHeightSetting');
  localStorage.setItem('shuangran.players', JSON.stringify(state.players));
  render();
});

function getWeekRange(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toDateInput(monday), end: toDateInput(sunday) };
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readNumber(selector) {
  const value = document.querySelector(selector).value;
  return value === '' ? '' : Number(value);
}

fillFormFromLatest();
fillSettingsForm();
bindTrendTooltip();
render();
