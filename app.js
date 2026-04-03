const els = {
  tabs: [...document.querySelectorAll('.tab')],
  basicPanel: document.getElementById('basicPanel'),
  comparePanel: document.getElementById('comparePanel'),
  advancedPanel: document.getElementById('advancedPanel'),
  advancedOnly: [...document.querySelectorAll('.advanced-only')],
  runButton: document.getElementById('runButton'),
  pauseButton: document.getElementById('pauseButton'),
  resetButton: document.getElementById('resetButton'),
  resetAllButton: document.getElementById('resetAllButton'),
  autoCompareButton: document.getElementById('autoCompareButton'),
  compToggle: document.getElementById('compToggle'),
  speedFrictionToggle: document.getElementById('speedFrictionToggle'),
  positionFrictionToggle: document.getElementById('positionFrictionToggle'),
  targetAngle: document.getElementById('targetAngle'),
  controlGain: document.getElementById('controlGain'),
  staticFriction: document.getElementById('staticFriction'),
  kineticFriction: document.getElementById('kineticFriction'),
  compensationValue: document.getElementById('compensationValue'),
  targetAngleValue: document.getElementById('targetAngleValue'),
  controlGainValue: document.getElementById('controlGainValue'),
  staticFrictionValue: document.getElementById('staticFrictionValue'),
  kineticFrictionValue: document.getElementById('kineticFrictionValue'),
  compensationValueValue: document.getElementById('compensationValueValue'),
  runStatus: document.getElementById('runStatus'),
  mainTargetMetric: document.getElementById('mainTargetMetric'),
  mainAngleMetric: document.getElementById('mainAngleMetric'),
  mainErrorMetric: document.getElementById('mainErrorMetric'),
  mainVelocityMetric: document.getElementById('mainVelocityMetric'),
  offAngleMetric: document.getElementById('offAngleMetric'),
  offErrorMetric: document.getElementById('offErrorMetric'),
  onAngleMetric: document.getElementById('onAngleMetric'),
  onErrorMetric: document.getElementById('onErrorMetric'),
  improvementMetric: document.getElementById('improvementMetric'),
  improvementRateMetric: document.getElementById('improvementRateMetric'),
  verdictMetric: document.getElementById('verdictMetric'),
  mainCanvas: document.getElementById('mainCanvas'),
  compareCanvasOff: document.getElementById('compareCanvasOff'),
  compareCanvasOn: document.getElementById('compareCanvasOn'),
  graphCanvas: document.getElementById('graphCanvas')
};

const ctxMain = els.mainCanvas.getContext('2d');
const ctxOff = els.compareCanvasOff.getContext('2d');
const ctxOn = els.compareCanvasOn.getContext('2d');
const ctxGraph = els.graphCanvas.getContext('2d');

const defaultConfig = {
  targetAngle: 90,
  controlGain: 1.4,
  staticFriction: 6.5,
  kineticFriction: 3.8,
  compensationValue: 4.2,
  compensationEnabled: true,
  speedFrictionEnabled: true,
  positionFrictionEnabled: false
};

const appState = {
  mode: 'basic',
  isRunning: false,
  isPaused: false,
  lastTime: 0,
  mainSim: null,
  compareOff: null,
  compareOn: null,
  graphHistory: []
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function signWithFallback(value, fallback = 1) {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return fallback;
}

function createSim({ compensationEnabled }) {
  return {
    angle: 0,
    velocity: 0,
    controlInput: 0,
    time: 0,
    stoppedFrames: 0,
    finished: false,
    compensationEnabled
  };
}

function getConfig() {
  const kinetic = Number(els.kineticFriction.value);
  const stat = Number(els.staticFriction.value);
  return {
    targetAngle: Number(els.targetAngle.value),
    controlGain: Number(els.controlGain.value),
    staticFriction: Math.max(stat, kinetic + 0.2),
    kineticFriction: kinetic,
    compensationValue: Number(els.compensationValue.value),
    compensationEnabled: els.compToggle.checked,
    speedFrictionEnabled: els.speedFrictionToggle.checked,
    positionFrictionEnabled: els.positionFrictionToggle.checked
  };
}

function setControls(config) {
  els.targetAngle.value = config.targetAngle;
  els.controlGain.value = config.controlGain;
  els.staticFriction.value = config.staticFriction;
  els.kineticFriction.value = config.kineticFriction;
  els.compensationValue.value = config.compensationValue;
  els.compToggle.checked = config.compensationEnabled;
  els.speedFrictionToggle.checked = config.speedFrictionEnabled;
  els.positionFrictionToggle.checked = config.positionFrictionEnabled;
  updateLabels();
}

function updateLabels() {
  const config = getConfig();
  els.targetAngleValue.textContent = `${config.targetAngle.toFixed(0)}°`;
  els.controlGainValue.textContent = config.controlGain.toFixed(1);
  els.staticFrictionValue.textContent = config.staticFriction.toFixed(1);
  els.kineticFrictionValue.textContent = config.kineticFriction.toFixed(1);
  els.compensationValueValue.textContent = config.compensationValue.toFixed(1);
  els.mainTargetMetric.textContent = `${config.targetAngle.toFixed(0)}°`;
}

function resetModeState() {
  appState.mainSim = createSim({ compensationEnabled: getConfig().compensationEnabled });
  appState.compareOff = createSim({ compensationEnabled: false });
  appState.compareOn = createSim({ compensationEnabled: true });
  appState.graphHistory = [];
  updateMetrics();
  drawAll();
}

function resetAll() {
  setControls(defaultConfig);
  appState.mode = 'basic';
  switchMode('basic');
  appState.isRunning = false;
  appState.isPaused = false;
  updateRunStatus();
  resetModeState();
}

function updateRunStatus() {
  if (appState.isRunning && !appState.isPaused) {
    els.runStatus.textContent = '실행 중';
    els.runStatus.classList.add('is-running');
  } else if (appState.isPaused) {
    els.runStatus.textContent = '일시정지';
    els.runStatus.classList.remove('is-running');
  } else {
    els.runStatus.textContent = '대기 중';
    els.runStatus.classList.remove('is-running');
  }
}

function switchMode(mode) {
  appState.mode = mode;
  els.tabs.forEach(tab => tab.classList.toggle('is-active', tab.dataset.mode === mode));
  els.basicPanel.classList.toggle('hidden', false);
  els.comparePanel.classList.toggle('hidden', mode === 'basic');
  els.advancedPanel.classList.toggle('hidden', mode !== 'advanced');
  els.advancedOnly.forEach(el => el.classList.toggle('hidden', mode !== 'advanced'));
  resetModeState();
}

function updateSimulation(sim, config, dt) {
  if (sim.finished) return;

  const error = config.targetAngle - sim.angle;
  const direction = signWithFallback(Math.abs(sim.velocity) > 0.02 ? sim.velocity : error, 1);
  let compensation = 0;
  const nearStop = Math.abs(sim.velocity) < 0.5;

  if (sim.compensationEnabled) {
    if (nearStop && Math.abs(error) > 1.2) {
      compensation = config.compensationValue * signWithFallback(error, 1);
    } else if (Math.abs(error) > 6) {
      compensation = config.compensationValue * 0.35 * signWithFallback(error, 1);
    }
  }

  let control = config.controlGain * error - 0.72 * sim.velocity + compensation;
  control = clamp(control, -28, 28);

  let friction = Math.abs(sim.velocity) < 0.8 ? config.staticFriction : config.kineticFriction;

  if (config.speedFrictionEnabled) {
    const speed = Math.abs(sim.velocity);
    const extra = (config.staticFriction - config.kineticFriction) * Math.exp(-speed / 7);
    friction = config.kineticFriction + extra;
  }

  if (config.positionFrictionEnabled) {
    friction *= 1 + 0.2 * Math.sin((sim.angle / 180) * Math.PI * 2);
  }

  const starting = Math.abs(sim.velocity) < 0.04;
  if (starting && Math.abs(control) <= friction) {
    sim.velocity = 0;
    sim.controlInput = control;
    sim.time += dt;
  } else {
    const frictionForce = friction * direction;
    const damping = 0.18 * sim.velocity;
    const acceleration = (control - frictionForce - damping) / 1.9;
    sim.velocity += acceleration * dt * 60;
    sim.velocity = clamp(sim.velocity, -140, 140);
    sim.angle += sim.velocity * dt;
    sim.controlInput = control;
    sim.time += dt;
  }

  if (Math.abs(error) < 0.8 && Math.abs(sim.velocity) < 0.8) {
    sim.stoppedFrames += 1;
  } else {
    sim.stoppedFrames = 0;
  }

  if (sim.stoppedFrames > 25 || sim.time > 12) {
    sim.finished = true;
  }
}

function updateMetrics() {
  const config = getConfig();
  if (!appState.mainSim) return;

  const main = appState.mainSim;
  const mainError = Math.abs(config.targetAngle - main.angle);
  els.mainAngleMetric.textContent = `${main.angle.toFixed(1)}°`;
  els.mainErrorMetric.textContent = `${mainError.toFixed(1)}°`;
  els.mainVelocityMetric.textContent = `${main.velocity.toFixed(1)}°/s`;
  els.mainTargetMetric.textContent = `${config.targetAngle.toFixed(0)}°`;

  const off = appState.compareOff;
  const on = appState.compareOn;
  if (off && on) {
    const offError = Math.abs(config.targetAngle - off.angle);
    const onError = Math.abs(config.targetAngle - on.angle);
    const improvement = Math.max(0, offError - onError);
    const improvementRate = offError > 0 ? improvement / offError * 100 : 0;

    els.offAngleMetric.textContent = `${off.angle.toFixed(1)}°`;
    els.offErrorMetric.textContent = `${offError.toFixed(1)}°`;
    els.onAngleMetric.textContent = `${on.angle.toFixed(1)}°`;
    els.onErrorMetric.textContent = `${onError.toFixed(1)}°`;
    els.improvementMetric.textContent = `${improvement.toFixed(1)}°`;
    els.improvementRateMetric.textContent = `${improvementRate.toFixed(0)}%`;

    let verdict = '대기 중';
    if (off.finished && on.finished) {
      if (improvement > 4) verdict = '보상 효과 뚜렷';
      else if (improvement > 1) verdict = '보상 효과 확인';
      else verdict = '차이 작음';
    }
    els.verdictMetric.textContent = verdict;
  }
}

function drawBackgroundGrid(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fbfcfd';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#eef2f6';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawMotorScene(ctx, canvas, sim, targetAngle, title) {
  const width = canvas.width;
  const height = canvas.height;
  drawBackgroundGrid(ctx, width, height);

  const cx = width * 0.3;
  const cy = height * 0.62;
  const radius = Math.min(width, height) * 0.18;
  const armLength = radius * 1.7;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#dce2e8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const targetRad = (-90 + targetAngle) * Math.PI / 180;
  const actualRad = (-90 + sim.angle) * Math.PI / 180;

  ctx.strokeStyle = '#aeb8c5';
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(targetRad) * armLength, cy + Math.sin(targetRad) * armLength);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#3182f6';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(actualRad) * armLength, cy + Math.sin(actualRad) * armLength);
  ctx.stroke();

  ctx.fillStyle = '#191f28';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#191f28';
  ctx.font = '600 18px Inter';
  ctx.fillText(title, 24, 34);

  ctx.fillStyle = '#6b7684';
  ctx.font = '500 14px Inter';
  ctx.fillText(`목표 ${targetAngle.toFixed(0)}°`, 24, 62);
  ctx.fillText(`현재 ${sim.angle.toFixed(1)}°`, 24, 84);
  ctx.fillText(`오차 ${Math.abs(targetAngle - sim.angle).toFixed(1)}°`, 24, 106);

  const barX = width * 0.62;
  const barY = 70;
  const barWidth = width * 0.26;
  const barHeight = 14;
  const normalized = (sim.controlInput + 28) / 56;

  ctx.fillStyle = '#eef2f6';
  roundRect(ctx, barX, barY, barWidth, barHeight, 8, true, false);
  ctx.fillStyle = '#2e7d68';
  roundRect(ctx, barX, barY, barWidth * clamp(normalized, 0, 1), barHeight, 8, true, false);
  ctx.fillStyle = '#6b7684';
  ctx.fillText('제어 입력', barX, barY - 10);

  ctx.strokeStyle = '#d7dde5';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(width * 0.58, height - 54);
  ctx.lineTo(width * 0.93, height - 54);
  ctx.stroke();
  ctx.fillStyle = '#6b7684';
  ctx.fillText('회전 방향', width * 0.75, height - 64);
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawGraph() {
  const ctx = ctxGraph;
  const canvas = els.graphCanvas;
  const width = canvas.width;
  const height = canvas.height;
  drawBackgroundGrid(ctx, width, height);

  const padding = { left: 54, right: 24, top: 24, bottom: 36 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const data = appState.graphHistory;
  const maxTime = Math.max(6, data.length ? data[data.length - 1].time : 6);
  const maxAngle = Math.max(els.targetAngle.valueAsNumber + 20, 180);

  ctx.strokeStyle = '#d7dde5';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  ctx.fillStyle = '#6b7684';
  ctx.font = '500 12px Inter';
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + innerH * (i / 4);
    const value = (maxAngle * (1 - i / 4)).toFixed(0);
    ctx.fillText(`${value}°`, 12, y + 4);
    ctx.strokeStyle = '#eef2f6';
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  if (!data.length) return;

  const projectX = t => padding.left + (t / maxTime) * innerW;
  const projectY = a => padding.top + innerH - (a / maxAngle) * innerH;
  const projectInput = u => padding.top + innerH - ((u + 28) / 56) * innerH;

  ctx.strokeStyle = '#aeb8c5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((point, idx) => {
    const x = projectX(point.time);
    const y = projectY(point.target);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.strokeStyle = '#3182f6';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  data.forEach((point, idx) => {
    const x = projectX(point.time);
    const y = projectY(point.angle);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.strokeStyle = '#2e7d68';
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((point, idx) => {
    const x = projectX(point.time);
    const y = projectInput(point.input);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawAll() {
  const config = getConfig();
  drawMotorScene(ctxMain, els.mainCanvas, appState.mainSim, config.targetAngle, config.compensationEnabled ? '기초 모드 · 보상 ON' : '기초 모드 · 보상 OFF');
  drawMotorScene(ctxOff, els.compareCanvasOff, appState.compareOff, config.targetAngle, '비교 모드 · 보상 OFF');
  drawMotorScene(ctxOn, els.compareCanvasOn, appState.compareOn, config.targetAngle, '비교 모드 · 보상 ON');
  drawGraph();
}

function step(timestamp) {
  if (!appState.lastTime) appState.lastTime = timestamp;
  const dt = Math.min(0.03, (timestamp - appState.lastTime) / 1000 || 0.016);
  appState.lastTime = timestamp;

  if (appState.isRunning && !appState.isPaused) {
    const config = getConfig();
    updateSimulation(appState.mainSim, { ...config, compensationEnabled: appState.mainSim.compensationEnabled }, dt);
    updateSimulation(appState.compareOff, { ...config, compensationEnabled: false }, dt);
    updateSimulation(appState.compareOn, { ...config, compensationEnabled: true }, dt);

    appState.graphHistory.push({
      time: appState.mainSim.time,
      angle: appState.mainSim.angle,
      target: config.targetAngle,
      input: appState.mainSim.controlInput
    });
    if (appState.graphHistory.length > 320) appState.graphHistory.shift();

    if (appState.mainSim.finished && appState.compareOff.finished && appState.compareOn.finished) {
      appState.isRunning = false;
      appState.isPaused = false;
      updateRunStatus();
    }
  }

  updateMetrics();
  drawAll();
  requestAnimationFrame(step);
}

function startSimulation() {
  const config = getConfig();
  appState.mainSim = createSim({ compensationEnabled: config.compensationEnabled });
  appState.compareOff = createSim({ compensationEnabled: false });
  appState.compareOn = createSim({ compensationEnabled: true });
  appState.graphHistory = [];
  appState.isRunning = true;
  appState.isPaused = false;
  appState.lastTime = 0;
  updateRunStatus();
}

els.tabs.forEach(tab => {
  tab.addEventListener('click', () => switchMode(tab.dataset.mode));
});

[els.targetAngle, els.controlGain, els.staticFriction, els.kineticFriction, els.compensationValue].forEach(input => {
  input.addEventListener('input', () => {
    if (Number(els.staticFriction.value) <= Number(els.kineticFriction.value)) {
      els.staticFriction.value = (Number(els.kineticFriction.value) + 0.2).toFixed(1);
    }
    updateLabels();
    updateMetrics();
    drawAll();
  });
});

[els.compToggle, els.speedFrictionToggle, els.positionFrictionToggle].forEach(input => {
  input.addEventListener('change', () => {
    updateLabels();
    resetModeState();
  });
});

els.runButton.addEventListener('click', startSimulation);
els.autoCompareButton.addEventListener('click', startSimulation);
els.pauseButton.addEventListener('click', () => {
  if (!appState.isRunning) return;
  appState.isPaused = !appState.isPaused;
  updateRunStatus();
});
els.resetButton.addEventListener('click', () => {
  appState.isRunning = false;
  appState.isPaused = false;
  updateRunStatus();
  resetModeState();
});
els.resetAllButton.addEventListener('click', resetAll);

updateLabels();
resetModeState();
updateRunStatus();
requestAnimationFrame(step);
