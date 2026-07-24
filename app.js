const today = new Date().toISOString().slice(0, 10);
const currentWeek = getWeekRange(today);

const state = {
  activeView: 'dashboard',
  activePlayer: 'male',
  imageData: '',
  trendPoints: [],
  players: JSON.parse(localStorage.getItem('shuangran.players') || 'null') || {
    male: {
      name: 'qiuke', gender: 'male', age: 24, height: 175, initialWeight: 62.5, goal: '增肌 + 小幅减脂', factor: 1,
      rules: { fatFull: 1.2, muscleFull: 0.7, weightBand: 1.8 },
      records: []
    },
    female: {
      name: 'metoo', gender: 'female', age: 31, height: 163, initialWeight: 49, goal: '塑形 + 保体重 + 降体脂长肌肉', factor: 1.28,
      rules: { fatFull: 1.0, muscleFull: 0.4, weightBand: 1.2 },
      records: []
    }
  }
};

state.players.male.name = 'qiuke';
state.players.female.name = 'metoo';
ensurePlayerDefaults(state.players.male, { age: 24, height: 175, initialWeight: 62.5, goal: '增肌 + 小幅减脂', factor: 1, rules: { fatFull: 1.2, muscleFull: 0.7, weightBand: 1.8 } });
ensurePlayerDefaults(state.players.female, { age: 31, height: 163, initialWeight: 49, goal: '塑形 + 保体重 + 降体脂长肌肉', factor: 1.28, rules: { fatFull: 1.0, muscleFull: 0.4, weightBand: 1.2 } });
state.players.male.records = removeDemoRecords(state.players.male.records || []);
state.players.female.records = removeDemoRecords(state.players.female.records || []);

function rec(date, weight, fat, muscle, metabolism, image = 'demo') {
  return { date, weight, fat, muscle, metabolism, image, state: '力量训练', note: '' };
}

function removeDemoRecords(records) {
  return records.filter(record => record.image !== 'demo');
}

function ensurePlayerDefaults(player, defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    if (key === 'rules') player.rules = { ...value, ...(player.rules || {}) };
    else if (!isFilled(player[key]) && player[key] !== '') player[key] = value;
  }
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

  const fatFull = Number(player.rules?.fatFull ?? (player.gender === 'male' ? 1.2 : 1.0));
  let fatScore = 0;
  if (fatDrop >= fatFull) fatScore = 40;
  else if (fatDrop >= 0.6) fatScore = 22;
  else if (fatDrop >= 0.1) fatScore = 10;

  const muscleFull = Number(player.rules?.muscleFull ?? (player.gender === 'male' ? 0.7 : 0.4));
  const muscleMid = muscleFull / 2;
  const muscleLow = Math.max(0, muscleMid - 0.01);
  let muscleScore = 0;
  if (muscleChange >= muscleFull) muscleScore = 35;
  else if (muscleChange >= muscleMid) muscleScore = 18;
  else if (muscleChange >= 0 && muscleChange <= muscleLow) muscleScore = 8;
  else if (muscleChange < 0) muscleScore = -15;

  const healthyBand = Number(player.rules?.weightBand ?? (player.gender === 'male' ? 1.8 : 1.2));
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
  renderRuleText();
  drawTrend();
  localStorage.setItem('shuangran.players', JSON.stringify(state.players));
}

function renderRuleText() {
  const male = state.players.male;
  const female = state.players.female;
  document.querySelector('#fatRuleText').textContent = `${male.name}相对下降 ≥ ${male.rules.fatFull}% 满分，${female.name}相对下降 ≥ ${female.rules.fatFull}% 满分。无变化或上涨为 0 分。`;
  document.querySelector('#muscleRuleText').textContent = `${male.name}周涨幅 ≥ ${male.rules.muscleFull}% 满分，${female.name}周涨幅 ≥ ${female.rules.muscleFull}% 满分。骨骼肌下降倒扣 15 分。`;
  document.querySelector('#weightRuleText').textContent = `${male.name}单周体重浮动 ±${male.rules.weightBand}% 内满分，${female.name} ±${female.rules.weightBand}% 内满分。单周下降超过 3% 直接 0 分。`;
  document.querySelector('#factorRuleText').textContent = `${male.name}最终分 = 原始分 × ${male.factor}；${female.name}最终分 = 原始分 × ${female.factor}。用于平衡不同目标和身体条件下的竞赛难度。`;
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
    <article class="record-item" data-date="${r.date}" data-player="${state.activePlayer}">
      <div><strong>${r.date} · ${r.state || '未标记'}</strong><span>${display(r.weight, 'kg')} / ${display(r.fat, '%')} / 骨骼肌 ${display(r.muscle, 'kg')} / 代谢 ${display(r.metabolism)}</span></div>
      <div class="thumb">${r.image && r.image !== 'demo' ? `<img src="${r.image}" alt="截图">` : '图'}</div>
    </article>`).join('') : '<p class="summary">本周还没有记录。上传截图后会自动识别并保存到这里。</p>';
  document.querySelectorAll('.record-item').forEach(item => item.addEventListener('click', () => openRecordDetail(item.dataset.player, item.dataset.date)));
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
    { key: 'male', color: '#fff4b8', glow: 'rgba(255, 244, 184, .32)', fill: 'rgba(255, 244, 184, .16)', label: 'qiuke' },
    { key: 'female', color: '#ffd0a3', glow: 'rgba(255, 208, 163, .34)', fill: 'rgba(255, 208, 163, .16)', label: 'metoo' }
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
    if (!points.length) return;
    state.trendPoints.push(...points);
    if (points.length > 1) {
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
    }

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
  document.querySelector('#maleAgeSetting').value = state.players.male.age ?? '';
  document.querySelector('#maleHeightSetting').value = state.players.male.height ?? '';
  document.querySelector('#maleInitialWeightSetting').value = state.players.male.initialWeight ?? '';
  document.querySelector('#maleGoalSetting').value = state.players.male.goal ?? '';
  document.querySelector('#femaleNameSetting').value = state.players.female.name;
  document.querySelector('#femaleAgeSetting').value = state.players.female.age ?? '';
  document.querySelector('#femaleHeightSetting').value = state.players.female.height ?? '';
  document.querySelector('#femaleInitialWeightSetting').value = state.players.female.initialWeight ?? '';
  document.querySelector('#femaleGoalSetting').value = state.players.female.goal ?? '';
  document.querySelector('#maleFactorSetting').value = state.players.male.factor ?? '';
  document.querySelector('#femaleFactorSetting').value = state.players.female.factor ?? '';
  document.querySelector('#maleFatFullSetting').value = state.players.male.rules?.fatFull ?? '';
  document.querySelector('#femaleFatFullSetting').value = state.players.female.rules?.fatFull ?? '';
  document.querySelector('#maleMuscleFullSetting').value = state.players.male.rules?.muscleFull ?? '';
  document.querySelector('#femaleMuscleFullSetting').value = state.players.female.rules?.muscleFull ?? '';
  document.querySelector('#maleWeightBandSetting').value = state.players.male.rules?.weightBand ?? '';
  document.querySelector('#femaleWeightBandSetting').value = state.players.female.rules?.weightBand ?? '';
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
    status.textContent = location.protocol === 'file:' ? 'OCR库未加载：请用线上链接或 http://127.0.0.1:4173 打开' : 'OCR库未加载，已保留手动空值';
    return;
  }
  status.textContent = 'OCR预处理中...';
  try {
    const prepared = await prepareImageForOcr(imageData);
    status.textContent = 'OCR识别中，长截图会慢一点...';
    const result = await Tesseract.recognize(prepared, 'chi_sim+eng');
    const text = result.data.text || '';
    const parsed = parseScaleText(text);
    fillIfParsed('#weightInput', parsed.weight);
    fillIfParsed('#fatInput', parsed.fat);
    fillIfParsed('#muscleInput', parsed.muscle);
    fillIfParsed('#metabolismInput', parsed.metabolism);
    const found = Object.values(parsed).filter(isFilled).length;
    status.textContent = found ? `OCR完成：识别到 ${found}/4 项` : 'OCR未识别到有效数据，可点记录详情手动修正';
  } catch (error) {
    status.textContent = location.protocol === 'file:' ? 'OCR识别失败：file模式容易被浏览器拦截，请用在线链接打开' : 'OCR识别失败，字段保持空值';
  }
}

async function runDetailOcr(imageData) {
  const status = document.querySelector('#detailOcrStatus');
  if (!window.Tesseract) {
    status.textContent = location.protocol === 'file:' ? 'OCR库未加载：请用线上链接或本地服务打开' : 'OCR库未加载，可以手动修正字段';
    return;
  }
  status.textContent = '重新 OCR 预处理中...';
  try {
    const prepared = await prepareImageForOcr(imageData);
    status.textContent = '重新 OCR 识别中...';
    const result = await Tesseract.recognize(prepared, 'chi_sim+eng');
    const parsed = parseScaleText(result.data.text || '');
    fillIfParsed('#detailWeightInput', parsed.weight);
    fillIfParsed('#detailFatInput', parsed.fat);
    fillIfParsed('#detailMuscleInput', parsed.muscle);
    fillIfParsed('#detailMetabolismInput', parsed.metabolism);
    const found = Object.values(parsed).filter(isFilled).length;
    status.textContent = found ? `重新识别完成：更新 ${found}/4 项，可继续手动校对` : '未识别到有效数据，原字段已保留';
  } catch (error) {
    status.textContent = '重新识别失败，原字段已保留';
  }
}

function prepareImageForOcr(imageData) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxWidth = 1200;
      const scale = Math.min(maxWidth / image.width, 1.6);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, width, height);
      const imagePixels = ctx.getImageData(0, 0, width, height);
      const data = imagePixels.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const boosted = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 142));
        data[i] = boosted;
        data[i + 1] = boosted;
        data[i + 2] = boosted;
      }
      ctx.putImageData(imagePixels, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = reject;
    image.src = imageData;
  });
}

function fillIfParsed(selector, value) {
  if (isFilled(value)) document.querySelector(selector).value = value;
}

function parseScaleText(text) {
  const normalized = text.replace(/\s+/g, ' ').replace(/％/g, '%').replace(/,/g, '');
  return {
    weight: pickBodyWeight(normalized),
    fat: pickNumber(normalized, ['脂肪率', '体脂率', '体脂', 'body fat', 'fat']),
    muscle: pickJinAsKg(normalized, ['骨骼肌量', '骨骼肌', '肌肉量', 'skeletal muscle', 'muscle']),
    metabolism: pickNumber(normalized, ['基础代谢率', '基础代谢', '代谢', 'bmr', 'kcal'])
  };
}

function pickBodyWeight(text) {
  const jinMatch = text.match(/([0-9]{2,3}(?:\.[0-9]{1,2})?)\s*斤/);
  if (jinMatch) return round(Number(jinMatch[1]) / 2, 2);
  return pickNumber(text, ['体重', 'weight', 'kg']);
}

function pickJinAsKg(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}[^0-9]{0,16}([0-9]{1,3}(?:\\.[0-9]{1,2})?)\\s*斤`, 'i');
    const match = text.match(regex);
    if (match) return round(Number(match[1]) / 2, 2);
  }
  return pickNumber(text, labels);
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
  state.players.male.name = document.querySelector('#maleNameSetting').value || 'qiuke';
  state.players.male.age = readNumber('#maleAgeSetting');
  state.players.male.height = readNumber('#maleHeightSetting');
  state.players.male.initialWeight = readNumber('#maleInitialWeightSetting');
  state.players.male.goal = document.querySelector('#maleGoalSetting').value;
  state.players.male.factor = readNumber('#maleFactorSetting') || 1;
  state.players.male.rules = {
    fatFull: readNumber('#maleFatFullSetting') || 1.2,
    muscleFull: readNumber('#maleMuscleFullSetting') || 0.7,
    weightBand: readNumber('#maleWeightBandSetting') || 1.8
  };
  state.players.female.name = document.querySelector('#femaleNameSetting').value || 'metoo';
  state.players.female.age = readNumber('#femaleAgeSetting');
  state.players.female.height = readNumber('#femaleHeightSetting');
  state.players.female.initialWeight = readNumber('#femaleInitialWeightSetting');
  state.players.female.goal = document.querySelector('#femaleGoalSetting').value;
  state.players.female.factor = readNumber('#femaleFactorSetting') || 1.28;
  state.players.female.rules = {
    fatFull: readNumber('#femaleFatFullSetting') || 1.0,
    muscleFull: readNumber('#femaleMuscleFullSetting') || 0.4,
    weightBand: readNumber('#femaleWeightBandSetting') || 1.2
  };
  localStorage.setItem('shuangran.players', JSON.stringify(state.players));
  render();
  fillSettingsForm();
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

function openRecordDetail(playerKey, date) {
  const player = state.players[playerKey];
  const record = player.records.find(item => item.date === date);
  if (!record) return;
  document.querySelector('#detailOwner').textContent = `${player.name} · ${date}`;
  document.querySelector('#detailPlayerKey').value = playerKey;
  document.querySelector('#detailOriginalDate').value = date;
  document.querySelector('#detailDateInput').value = record.date;
  document.querySelector('#detailWeightInput').value = record.weight ?? '';
  document.querySelector('#detailFatInput').value = record.fat ?? '';
  document.querySelector('#detailMuscleInput').value = record.muscle ?? '';
  document.querySelector('#detailMetabolismInput').value = record.metabolism ?? '';
  document.querySelector('#detailStateInput').value = record.state || '力量训练';
  document.querySelector('#detailNoteInput').value = record.note || '';
  document.querySelector('#detailOcrStatus').textContent = '可以手动修正 OCR 识别结果';
  document.querySelector('#detailImageInput').value = '';
  const preview = document.querySelector('#detailImagePreview');
  const upload = document.querySelector('.detail-upload');
  if (record.image) {
    preview.src = record.image;
    upload.classList.add('has-image');
    document.querySelector('#detailUploadText').textContent = '重新上传截图并 OCR';
  } else {
    preview.removeAttribute('src');
    upload.classList.remove('has-image');
    document.querySelector('#detailUploadText').textContent = '上传截图并 OCR';
  }
  document.querySelector('#recordModal').classList.add('open');
  document.querySelector('#recordModal').setAttribute('aria-hidden', 'false');
}

function closeRecordDetail() {
  document.querySelector('#recordModal').classList.remove('open');
  document.querySelector('#recordModal').setAttribute('aria-hidden', 'true');
}

document.querySelector('#closeDetailBtn').addEventListener('click', closeRecordDetail);
document.querySelector('#recordModal').addEventListener('click', event => {
  if (event.target.id === 'recordModal') closeRecordDetail();
});

document.querySelector('#detailImageInput').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.querySelector('#detailImagePreview').src = reader.result;
    document.querySelector('.detail-upload').classList.add('has-image');
    document.querySelector('#detailUploadText').textContent = '已重新上传，可继续更换';
    runDetailOcr(reader.result);
  };
  reader.readAsDataURL(file);
});

document.querySelector('#detailForm').addEventListener('submit', event => {
  event.preventDefault();
  const playerKey = document.querySelector('#detailPlayerKey').value;
  const originalDate = document.querySelector('#detailOriginalDate').value;
  const player = state.players[playerKey];
  const existing = player.records.find(item => item.date === originalDate) || {};
  const imageSrc = document.querySelector('#detailImagePreview').getAttribute('src') || '';
  const updated = {
    date: document.querySelector('#detailDateInput').value,
    weight: readNumber('#detailWeightInput'),
    fat: readNumber('#detailFatInput'),
    muscle: readNumber('#detailMuscleInput'),
    metabolism: readNumber('#detailMetabolismInput'),
    state: document.querySelector('#detailStateInput').value,
    note: document.querySelector('#detailNoteInput').value,
    image: imageSrc || existing.image || ''
  };
  player.records = player.records.filter(item => item.date !== originalDate && item.date !== updated.date).concat(updated).sort((a, b) => a.date.localeCompare(b.date));
  closeRecordDetail();
  render();
});

document.querySelector('#deleteDetailBtn').addEventListener('click', () => {
  const playerKey = document.querySelector('#detailPlayerKey').value;
  const originalDate = document.querySelector('#detailOriginalDate').value;
  state.players[playerKey].records = state.players[playerKey].records.filter(item => item.date !== originalDate);
  closeRecordDetail();
  render();
});

fillFormFromLatest();
fillSettingsForm();
bindTrendTooltip();
render();
openDemoDetailIfRequested();

function openDemoDetailIfRequested() {
  if (!new URLSearchParams(location.search).has('demoDetail')) return;
  state.activePlayer = 'female';
  state.players.female.records = state.players.female.records.filter(record => record.date !== today).concat({
    date: today,
    weight: 48.45,
    fat: 25.8,
    muscle: 18.8,
    metabolism: 1078,
    state: '力量训练',
    note: 'OCR 识别后可在这里手动校对，也可以重新上传截图。',
    image: ''
  });
  render();
  switchView('record');
  openRecordDetail('female', today);
}
