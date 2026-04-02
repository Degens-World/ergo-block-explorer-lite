const API = 'https://api.ergoplatform.com/api/v1';
const REFRESH_SECS = 60;
let refreshTimer = null;
let countdown = REFRESH_SECS;
let selectedHeight = null;

// ── Utility ──────────────────────────────────────────────────────────────────

function nanoToErg(nano) {
  return (nano / 1e9).toFixed(3);
}

function formatDifficulty(diff) {
  if (!diff) return '—';
  const t = Number(diff);
  if (t >= 1e15) return (t / 1e15).toFixed(2) + ' P';
  if (t >= 1e12) return (t / 1e12).toFixed(2) + ' T';
  if (t >= 1e9)  return (t / 1e9).toFixed(2) + ' G';
  if (t >= 1e6)  return (t / 1e6).toFixed(2) + ' M';
  return t.toString();
}

function formatHashrate(hs) {
  if (!hs) return '—';
  const t = Number(hs);
  if (t >= 1e15) return (t / 1e15).toFixed(2) + ' PH/s';
  if (t >= 1e12) return (t / 1e12).toFixed(2) + ' TH/s';
  if (t >= 1e9)  return (t / 1e9).toFixed(2) + ' GH/s';
  if (t >= 1e6)  return (t / 1e6).toFixed(2) + ' MH/s';
  return t.toFixed(0) + ' H/s';
}

function formatSupply(nanoErg) {
  const erg = nanoErg / 1e9;
  return erg.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' ERG';
}

function timeAgo(ts) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return secs + 's ago';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}

function shortHash(h, len = 12) {
  if (!h) return '—';
  return h.slice(0, len) + '…' + h.slice(-6);
}

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

// ── API calls ────────────────────────────────────────────────────────────────

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getNetworkInfo() {
  return fetchJSON(`${API}/info`);
}

async function getRecentBlocks(limit = 20) {
  return fetchJSON(`${API}/blocks?sortBy=height&sortDirection=desc&limit=${limit}`);
}

async function getBlockByHeight(height) {
  // returns array of header IDs at this height
  const ids = await fetchJSON(`${API}/blocks/at/${height}`);
  if (!ids || !ids.length) throw new Error('Block not found');
  return fetchJSON(`${API}/blocks/${ids[0]}`);
}

async function getBlockById(id) {
  return fetchJSON(`${API}/blocks/${id}`);
}

// ── Render network bar ───────────────────────────────────────────────────────

function renderNetworkBar(info) {
  document.getElementById('net-height').textContent =
    info.fullHeight?.toLocaleString() ?? '—';
  document.getElementById('net-difficulty').textContent =
    formatDifficulty(info.difficulty);
  document.getElementById('net-hashrate').textContent =
    formatHashrate(info.hashRate);
  document.getElementById('net-supply').textContent =
    info.supply ? formatSupply(info.supply) : '—';
  document.getElementById('net-txday').textContent =
    info.transactionAverage != null
      ? Math.round(info.transactionAverage).toLocaleString()
      : '—';
}

// ── Render blocks table ──────────────────────────────────────────────────────

function renderBlocks(blocks) {
  const tbody = document.getElementById('blocks-tbody');
  document.getElementById('block-count').textContent = blocks.length + ' blocks';

  if (!blocks.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No blocks found.</td></tr>';
    return;
  }

  tbody.innerHTML = blocks.map(b => {
    const height = b.height ?? '—';
    const ts = b.timestamp ? timeAgo(b.timestamp) : '—';
    const miner = b.miner?.name || shortHash(b.miner?.address || b.minerPk || '');
    const txs = b.transactionsCount ?? (b.transactions?.length ?? '—');
    const size = formatSize(b.size);
    // mining reward is in the first coinbase tx; approximation from block reward schedule
    const reward = b.minerReward != null ? nanoToErg(b.minerReward) : '~3';
    const selected = selectedHeight === height ? ' selected' : '';

    return `<tr data-height="${height}" data-id="${b.id || ''}"${selected}>
      <td class="height-cell">${height.toLocaleString?.() ?? height}</td>
      <td class="time-cell">${ts}</td>
      <td class="miner-cell" title="${b.miner?.address || ''}">${miner}</td>
      <td class="txs-cell">${txs}</td>
      <td class="size-cell">${size}</td>
      <td class="reward-cell">${reward}</td>
    </tr>`;
  }).join('');

  // row click → open detail
  tbody.querySelectorAll('tr[data-height]').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      const height = parseInt(row.dataset.height, 10);
      selectedHeight = height;
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      openDetail(id, height);
    });
  });
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function openDetail(id, height) {
  const panel = document.getElementById('detail-panel');
  const body = document.getElementById('panel-body');
  const title = document.getElementById('panel-title');

  panel.classList.remove('hidden');
  title.textContent = `Block #${height?.toLocaleString() ?? ''}`;
  body.innerHTML = '<div class="loading-row">Loading block details…</div>';

  const loader = id ? getBlockById(id) : getBlockByHeight(height);

  loader.then(data => {
    renderDetailPanel(data, body);
  }).catch(err => {
    body.innerHTML = `<div class="loading-row" style="color:#e57373">Error: ${err.message}</div>`;
  });
}

function renderDetailPanel(data, body) {
  const h = data.header || data;
  const txs = data.blockTransactions?.transactions || data.transactions || [];

  const rows = [
    { label: 'Height',      value: h.height?.toLocaleString() },
    { label: 'Header ID',   value: h.id, mono: true },
    { label: 'Timestamp',   value: h.timestamp ? new Date(h.timestamp).toLocaleString() : '—' },
    { label: 'Miner',       value: h.minerPk || data.miner?.address || '—', mono: true },
    { label: 'Difficulty',  value: formatDifficulty(h.difficulty) },
    { label: 'Size',        value: formatSize(data.size) },
    { label: 'Transactions',value: txs.length.toString() },
    { label: 'Parent ID',   value: h.parentId || '—', mono: true },
    { label: 'Version',     value: h.version?.toString() },
    { label: 'Nonce',       value: h.nonce?.toString() },
  ];

  let html = rows.filter(r => r.value).map(r => `
    <div class="detail-row">
      <span class="d-label">${r.label}</span>
      <span class="d-value${r.mono ? ' mono' : ''}">${r.value}</span>
    </div>
  `).join('');

  if (txs.length) {
    html += `<div class="tx-list-header">Transactions (${txs.length})</div>`;
    html += txs.slice(0, 30).map(tx => {
      const totalOut = tx.outputs
        ? tx.outputs.reduce((s, o) => s + (o.value || 0), 0)
        : 0;
      return `<div class="tx-item">
        <span class="tx-id">${tx.id || '—'}</span>
        <span class="tx-meta">${tx.inputs?.length ?? 0} inputs · ${tx.outputs?.length ?? 0} outputs</span>
        ${totalOut > 0 ? `<span class="tx-value">${nanoToErg(totalOut)} ERG</span>` : ''}
      </div>`;
    }).join('');

    if (txs.length > 30) {
      html += `<div class="loading-row" style="padding:10px 0">+ ${txs.length - 30} more transactions</div>`;
    }
  }

  body.innerHTML = html;
}

// ── Search ───────────────────────────────────────────────────────────────────

function doSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;

  const panel = document.getElementById('detail-panel');
  const body = document.getElementById('panel-body');
  const title = document.getElementById('panel-title');

  panel.classList.remove('hidden');
  title.textContent = 'Searching…';
  body.innerHTML = '<div class="loading-row">Searching…</div>';

  // If numeric, treat as block height
  if (/^\d+$/.test(q)) {
    const height = parseInt(q, 10);
    title.textContent = `Block #${height.toLocaleString()}`;
    selectedHeight = height;
    getBlockByHeight(height)
      .then(data => renderDetailPanel(data, body))
      .catch(err => {
        body.innerHTML = `<div class="loading-row" style="color:#e57373">Not found: ${err.message}</div>`;
      });
  } else {
    // Treat as header ID
    title.textContent = `Block ${shortHash(q)}`;
    getBlockById(q)
      .then(data => {
        selectedHeight = data.header?.height;
        title.textContent = `Block #${data.header?.height?.toLocaleString() ?? ''}`;
        renderDetailPanel(data, body);
      })
      .catch(err => {
        body.innerHTML = `<div class="loading-row" style="color:#e57373">Not found: ${err.message}</div>`;
      });
  }
}

// ── Countdown & refresh ──────────────────────────────────────────────────────

function startCountdown() {
  countdown = REFRESH_SECS;
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    countdown--;
    document.getElementById('refresh-status').textContent =
      `Auto-refresh: ${countdown}s`;
    if (countdown <= 0) {
      loadAll();
    }
  }, 1000);
}

// ── Main load ────────────────────────────────────────────────────────────────

async function loadAll() {
  try {
    const [info, blocksData] = await Promise.all([
      getNetworkInfo(),
      getRecentBlocks(20),
    ]);
    renderNetworkBar(info);
    const blocks = blocksData.items || blocksData;
    renderBlocks(Array.isArray(blocks) ? blocks : []);
  } catch (err) {
    console.error('Load error:', err);
    document.getElementById('blocks-tbody').innerHTML =
      `<tr><td colspan="6" class="loading-row" style="color:#e57373">Error loading data: ${err.message}</td></tr>`;
  }
  startCountdown();
}

// ── Wire up events ───────────────────────────────────────────────────────────

document.getElementById('search-btn').addEventListener('click', doSearch);
document.getElementById('search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

document.getElementById('close-panel').addEventListener('click', () => {
  document.getElementById('detail-panel').classList.add('hidden');
  selectedHeight = null;
  document.querySelectorAll('tbody tr.selected').forEach(r => r.classList.remove('selected'));
});

// ── Boot ─────────────────────────────────────────────────────────────────────
loadAll();
