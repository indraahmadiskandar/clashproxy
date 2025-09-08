const $ = s => document.querySelector(s);
const file = $('#file'), parseBtn = $('#parse'), genBtn = $('#gen'), dlBtn = $('#dl');
const hostsDiv = $('#hosts'), out = $('#out');
let matrix = [], hostCols = [], bugList = [];

// render Saweria QR fixed 100x100
(function () {
  const wrap = document.getElementById('qrcode');
  const url = 'https://saweria.co/zeusid6';
  new QRCode(wrap, { text: url, width: 100, height: 100, correctLevel: QRCode.CorrectLevel.M });
  document.getElementById('dlQR').addEventListener('click', function () {
    let img = wrap.querySelector('img');
    if (!img) {
      const cvs = wrap.querySelector('canvas');
      if (cvs) {
        const a = document.createElement('a');
        a.href = cvs.toDataURL('image/png');
        a.download = 'saweria-qr.png';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 0);
      }
      return;
    }
    const cvs = document.createElement('canvas');
    cvs.width = img.naturalWidth || 100;
    cvs.height = img.naturalHeight || 100;
    const ctx = cvs.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.href = cvs.toDataURL('image/png');
    a.download = 'saweria-qr.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 0);
  });
})();

file.addEventListener('change', () => parseBtn.disabled = !file.files?.length);
parseBtn.addEventListener('click', async () => {
  const f = file.files?.[0]; if (!f) return;
  const ab = await f.arrayBuffer();
  const wb = XLSX.read(ab, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  parseFormLike();
  renderHosts();
  genBtn.disabled = hostCols.length === 0;
  dlBtn.disabled = true;
  out.value = '';
});

genBtn.addEventListener('click', () => {
  const yaml = generateYaml();
  out.value = yaml;
  dlBtn.disabled = yaml.trim() === '';
});
dlBtn.addEventListener('click', () => {
  const blob = new Blob([out.value], { type: 'text/yaml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'proxies.yaml';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
});

function val(r, c) { return (matrix[r] && matrix[r][c] != null) ? String(matrix[r][c]).trim() : ''; }
function parseFormLike() {
  hostCols = []; bugList = [];
  for (let c = 1; c < (matrix[0]?.length || 64); c++) {
    const host = val(1, c); if (!host) continue;
    hostCols.push({ colIdx: c, host, server: val(2, c), password: val(3, c), path: val(4, c), grpcName: val(5, c) });
  }
  let bugStart = -1;
  for (let r = 0; r < matrix.length; r++) {
    if (String(val(r, 0)).toUpperCase().includes('LIST BUG')) { bugStart = r + 1; break; }
  }
  if (bugStart < 0) bugStart = 8;
  for (let r = bugStart; r < matrix.length; r++) {
    const b = val(r, 0); if (bugList.indexOf(b) === -1 && b) bugList.push(b);
  }
}

function renderHosts() {
  if (!hostCols.length) { hostsDiv.innerHTML = '<div style="color:#aeb8d8">No HOST columns detected</div>'; return; }
  var html = '';
  html += '<table><thead><tr><th>NO</th><th>EXPIRED</th><th>SERVER/HOST</th><th>PASSWORD/UUID</th><th>PATH</th><th>GRPC NAME</th></tr></thead><tbody>';
  for (var i = 0; i < hostCols.length; i++) {
    var h = hostCols[i];
    html += '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td>' + esc(h.host) + '</td>'
      + '<td>' + esc(h.server) + '</td>'
      + '<td>' + esc(h.password) + '</td>'
      + '<td>' + esc(h.path) + '</td>'
      + '<td>' + esc(h.grpcName) + '</td>'
      + '</tr>';
  }
  html += '</tbody></table>';
  html += '<div style="margin-top:8px;color:#aeb8d8">BUG : ' + bugList.length + '</div>';
  if (bugList.length) {
    html += '<div style="max-height:120px;overflow:auto;margin-top:4px;border:1px solid #23305a;border-radius:8px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr><th style="width:48px;text-align:left;padding:6px 10px;border-bottom:1px solid #23305a;background:#101731">NO</th><th style="text-align:left;padding:6px 10px;border-bottom:1px solid #23305a;background:#101731">BUG</th></tr></thead>';
    html += '<tbody>';
    for (var j = 0; j < bugList.length; j++) {
      var b = bugList[j];
      html += '<tr>'
        + '<td style="padding:6px 10px;border-bottom:1px solid #23305a">' + (j + 1) + '</td>'
        + '<td style="padding:6px 10px;border-bottom:1px solid #23305a">' + esc(b) + '</td>'
        + '</tr>';
    }
    html += '</tbody></table></div>';
  }
  hostsDiv.innerHTML = html;
}

function esc(s) { return (s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function colName(n) { let r = '', x = n + 1; while (x > 0) { x--; r = String.fromCharCode(65 + (x % 26)) + r; x = Math.floor(x / 26); } return r; }
function ystr_noquote(v) {
  let s = String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim();
  s = s.replace(/["']/g, '');
  return s;
}
function toBool(v) { const s = String(v || '').toLowerCase(); return s === 'true' || s === '1' || s === 'yes' || s === 'y'; }

function generateYaml() {
  if (!hostCols.length) return '';
  const selectedModes = [...document.querySelectorAll('#modes input[type=checkbox]:checked')].map(i => i.dataset.mode);
  if (selectedModes.length === 0) return '';
  const lines = ['proxies:'];
  for (const h of hostCols) {
    const baseServer = h.server;
    const basePath = (h.path || '').replace(/^\/?/, ''); // only from Excel
    const bugs = bugList.length ? bugList : [''];
    for (const bug of bugs) {
      const nameBase = h.host + (bug ? ' ' + bug : '');
      for (const mode of selectedModes) {
        if (mode === 'trojan_gfw_sni') {
          lines.push(...tplTrojanGfwSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'trojan_ws_sni') {
          lines.push(...tplTrojanWsSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'trojan_gows_cdn') {
          lines.push(...tplTrojanGowsCdn(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'trojan_xtls_sni') {
          lines.push(...tplTrojanXtlsSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'trojan_grpc_sni') {
          lines.push(...tplTrojanGrpcSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'vmess_ws_sni') {
          lines.push(...tplVmessWsSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'vmess_ws_cdn') {
          lines.push(...tplVmessWsCdn(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'vmess_ws_cdn_ntls') {
          lines.push(...tplVmessWsCdnNtls(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'vmess_grpc_sni') {
          lines.push(...tplVmessGrpcSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'vless_ws_sni') {
          lines.push(...tplVlessWsSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'vless_ws_cdn') {
          lines.push(...tplVlessWsCdn(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'vless_ws_cdn_ntls') {
          lines.push(...tplVlessWsCdnNtls(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'vless_xtls_sni') {
          lines.push(...tplVlessXtlsSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        } else if (mode === 'vless_grpc_sni') {
          lines.push(...tplVlessGrpcSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
        }
      }
    }
  }
  return lines.join('\n') + '\n';
}

// Templates (no quotes)
function tplTrojanGfwSni(name, server, password, bug, path, grpcName) {
  const n = 'TRJGFWSNI ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    type: trojan',
    '    server: ' + ystr_noquote(server),
    '    port: 443',
    '    password: ' + ystr_noquote(password),
    '    udp: true',
    '    sni: ' + ystr_noquote(bug),
    '    skip-cert-verify: true',
  ];
  return a;
}

function tplTrojanWsSni(name, server, password, bug, path, grpcName) {
  const n = 'TRJWSSNI ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    server: ' + ystr_noquote(server),
    '    port: 443',
    '    type: trojan',
    '    password: ' + ystr_noquote(password),
    '    skip-cert-verify: true',
    '    sni: ' + ystr_noquote(bug),
    '    network: ws',
    '    ws-opts:',
    '      path: ' + ystr_noquote(path),
    '      headers:',
    '        Host: ' + ystr_noquote(bug),
    '    udp: true',
  ];
  return a;
}

function tplTrojanGowsCdn(name, server, password, bug, path, grpcName) {
  const n = 'TRJGOWSCDN ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    server: ' + ystr_noquote(bug),
    '    port: 443',
    '    type: trojan',
    '    password: ' + ystr_noquote(password),
    '    network: ws',
    '    sni: ' + ystr_noquote(server),
    '    skip-cert-verify: true',
    '    ws-opts:',
    '      path: ' + ystr_noquote(path),
    '      headers:',
    '        Host: ' + ystr_noquote(bug),
  ];
  return a;
}

function tplTrojanXtlsSni(name, server, password, bug, path, grpcName) {
  const n = 'TRJXTLSNI ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    server: ' + ystr_noquote(server),
    '    port: 443',
    '    type: trojan',
    '    password: ' + ystr_noquote(password),
    '    flow: xtls-rprx-direct',
    '    skip-cert-verify: true',
    '    sni: ' + ystr_noquote(bug),
    '    udp: true',
  ];
  return a;
}

function tplTrojanGrpcSni(name, server, password, bug, path, grpcName) {
  const n = 'TRJGRPCSNI ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    type: trojan',
    '    server: ' + ystr_noquote(server),
    '    port: 443',
    '    password: ' + ystr_noquote(password),
    '    udp: true',
    '    sni: ' + ystr_noquote(bug),
    '    skip-cert-verify: true',
    '    network: grpc',
    '    grpc-opts:',
    '      grpc-service-name: ' + ystr_noquote(grpcName),
  ];
  return a;
}

function tplVmessWsSni(name, server, password, bug, path, grpcName) {
  const n = 'VMSWSSNI ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    type: vmess',
    '    server: ' + ystr_noquote(server),
    '    port: 443',
    '    uuid: ' + ystr_noquote(password),
    '    alterId: 0',
    '    cipher: auto',
    '    udp: true',
    '    tls: true',
    '    skip-cert-verify: true',
    '    servername: ' + ystr_noquote(bug),
    '    network: ws',
    '    ws-opts:',
    '      path: /' + ystr_noquote(path),
    '      headers:',
    '        Host: ' + ystr_noquote(bug),
  ];
  return a;
}

function tplVmessWsCdn(name, server, password, bug, path, grpcName) {
  const n = 'VMSWSCDN ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    type: vmess',
    '    server: ' + ystr_noquote(bug),
    '    port: 443',
    '    uuid: ' + ystr_noquote(password),
    '    alterId: 0',
    '    cipher: auto',
    '    udp: true',
    '    tls: true',
    '    skip-cert-verify: true',
    '    servername: ' + ystr_noquote(server),
    '    network: ws',
    '    ws-opts:',
    '      path: /' + ystr_noquote(path),
    '      headers:',
    '        Host: ' + ystr_noquote(server),
  ];
  return a;
}

function tplVmessWsCdnNtls(name, server, password, bug, path, grpcName) {
  const n = 'VMSWSCDNNTLS ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    type: vmess',
    '    server: ' + ystr_noquote(bug),
    '    port: 80',
    '    uuid: ' + ystr_noquote(password),
    '    alterId: 0',
    '    cipher: auto',
    '    udp: true',
    '    tls: false',
    '    skip-cert-verify: true',
    '    servername: ' + ystr_noquote(server),
    '    network: ws',
    '    ws-opts:',
    '      path: /' + ystr_noquote(path),
    '      headers:',
    '        Host: ' + ystr_noquote(server),
  ];
  return a;
}

function tplVmessGrpcSni(name, server, password, bug, path, grpcName) {
  const n = 'VMSGRPCSNI ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    server: ' + ystr_noquote(server),
    '    port: 443',
    '    type: vmess',
    '    uuid: ' + ystr_noquote(password),
    '    alterId: 0',
    '    cipher: auto',
    '    network: grpc',
    '    tls: true',
    '    servername: ' + ystr_noquote(bug),
    '    skip-cert-verify: true',
    '    grpc-opts:',
    '      grpc-service-name: ' + ystr_noquote(grpcName),
  ];
  return a;
}

function tplVlessWsSni(name, server, password, bug, path, grpcName) {
  const n = 'VLSWSSNI ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    server: ' + ystr_noquote(server),
    '    port: 443',
    '    type: vless',
    '    uuid: ' + ystr_noquote(password),
    '    cipher: auto',
    '    tls: true',
    '    alterId: 0',
    '    skip-cert-verify: true',
    '    servername: ' + ystr_noquote(bug),
    '    network: ws',
    '    ws-opts:',
    '      path: /' + ystr_noquote(path),
    '      headers:',
    '        Host: ' + ystr_noquote(bug),
  ];
  return a;
}

function tplVlessWsCdn(name, server, password, bug, path, grpcName) {
  const n = 'VLSWSCDN ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    server: ' + ystr_noquote(bug),
    '    port: 443',
    '    type: vless',
    '    uuid: ' + ystr_noquote(password),
    '    cipher: auto',
    '    tls: true',
    '    skip-cert-verify: true',
    '    servername: ' + ystr_noquote(server),
    '    network: ws',
    '    ws-opts:',
    '      path: /' + ystr_noquote(path),
    '      headers:',
    '        Host: ' + ystr_noquote(server),
  ];
  return a;
}

function tplVlessWsCdnNtls(name, server, password, bug, path, grpcName) {
  const n = 'VLSWSCDNNTLS ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    server: ' + ystr_noquote(bug),
    '    port: 80',
    '    type: vless',
    '    uuid: ' + ystr_noquote(password),
    '    cipher: auto',
    '    tls: false',
    '    skip-cert-verify: true',
    '    servername: ' + ystr_noquote(server),
    '    network: ws',
    '    ws-opts:',
    '      path: /' + ystr_noquote(path),
    '      headers:',
    '        Host: ' + ystr_noquote(server),
    '    udp: true',
  ];
  return a;
}

function tplVlessXtlsSni(name, server, password, bug, path, grpcName) {
  const n = 'VLSXTLSNI ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    server: ' + ystr_noquote(server),
    '    port: 443',
    '    type: vless',
    '    uuid: ' + ystr_noquote(password),
    '    cipher: auto',
    '    tls: true',
    '    flow: xtls-rprx-direct',
    '    skip-cert-verify: true',
    '    servername: ' + ystr_noquote(bug),
  ];
  return a;
}

function tplVlessGrpcSni(name, server, password, bug, path, grpcName) {
  const n = 'VLSGRPCSNI ' + name;
  const a = [
    '  - name: ' + ystr_noquote(n),
    '    server: ' + ystr_noquote(server),
    '    port: 443',
    '    type: vless',
    '    uuid: ' + ystr_noquote(password),
    '    cipher: auto',
    '    tls: true',
    '    skip-cert-verify: true',
    '    servername: ' + ystr_noquote(bug),
    '    network: grpc',
    '    grpc-opts:',
    '    grpc-mode: gun',
    '    grpc-service-name: ' + ystr_noquote(grpcName),
    '    udp: true',
  ];
  return a;
}