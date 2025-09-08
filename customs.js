const $ = s => document.querySelector(s);
const file = $('#file'), parseBtn = $('#parse'), genBtn = $('#gen'), dlBtn = $('#dl');
const hostsDiv = $('#hosts'), out = $('#out');
let matrix=[], hostCols=[], bugList=[];

// render Saweria QR fixed 100x100
(function(){
  const wrap = document.getElementById('qrcode');
  const url = 'https://saweria.co/zeusid6';
  new QRCode(wrap, { text:url, width:100, height:100, correctLevel: QRCode.CorrectLevel.M });
  document.getElementById('dlQR').addEventListener('click', function(){
    let img = wrap.querySelector('img');
    if(!img){
      const cvs = wrap.querySelector('canvas');
      if(cvs){
        const a = document.createElement('a');
        a.href = cvs.toDataURL('image/png');
        a.download = 'saweria-qr.png';
        document.body.appendChild(a);
        a.click();
        setTimeout(()=>a.remove(),0);
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
    setTimeout(()=>a.remove(),0);
  });
})();

file.addEventListener('change', ()=> parseBtn.disabled = !file.files?.length);
parseBtn.addEventListener('click', async ()=>{
  const f = file.files?.[0]; if(!f) return;
  const ab = await f.arrayBuffer();
  const wb = XLSX.read(ab, {type:'array'});
  const ws = wb.Sheets[wb.SheetNames[0]];
  matrix = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:''});
  parseFormLike();
  renderHosts();
  genBtn.disabled = hostCols.length===0;
  dlBtn.disabled = true;
  out.value='';
});

genBtn.addEventListener('click', ()=>{
  const yaml = generateYaml();
  out.value = yaml;
  dlBtn.disabled = yaml.trim()==='';
});
dlBtn.addEventListener('click', ()=>{
  const blob = new Blob([out.value], {type:'text/yaml'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'proxies.yaml';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},0);
});

function val(r,c){ return (matrix[r] && matrix[r][c] != null) ? String(matrix[r][c]).trim() : ''; }
function parseFormLike(){
  hostCols=[]; bugList=[];
  for(let c=1;c< (matrix[0]?.length||64);c++){
    const host = val(1,c); if(!host) continue;
    hostCols.push({colIdx:c, host, server:val(2,c), port:val(3,c), password:val(4,c), path:val(5,c), tls:(val(6,c)||'true')});
  }
  let bugStart=-1;
  for(let r=0;r<matrix.length;r++){
    if(String(val(r,0)).toUpperCase().includes('LIST BUG')){ bugStart=r+1; break; }
  }
  if(bugStart<0) bugStart=8;
  for(let r=bugStart;r<matrix.length;r++){
    const b=val(r,0); if(bugList.indexOf(b)===-1 && b) bugList.push(b);
  }
}

function renderHosts(){
  if(!hostCols.length){ hostsDiv.innerHTML='<div style="color:#aeb8d8">No HOST columns detected</div>'; return; }
  var html = '';
  html += '<table><thead><tr><th>Col</th><th>HOST</th><th>SERVER</th><th>PORT</th><th>PASSWORD/UUID</th><th>PATH</th><th>TLS</th></tr></thead><tbody>';
  for(var i=0;i<hostCols.length;i++){
    var h = hostCols[i];
    html += '<tr>'
      + '<td>'+colName(h.colIdx)+'</td>'
      + '<td>'+esc(h.host)+'</td>'
      + '<td>'+esc(h.server)+'</td>'
      + '<td>'+esc(h.port)+'</td>'
      + '<td>'+esc(h.password)+'</td>'
      + '<td>'+esc(h.path)+'</td>'
      + '<td>'+esc(h.tls)+'</td>'
      + '</tr>';
  }
  html += '</tbody></table>';
  html += '<div style="margin-top:8px;color:#aeb8d8">BUG count: '+bugList.length+'</div>';
  if(bugList.length){
    html += '<div style="max-height:120px;overflow:auto;margin-top:4px;border:1px solid #23305a;border-radius:8px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr><th style="width:48px;text-align:left;padding:6px 10px;border-bottom:1px solid #23305a;background:#101731">No</th><th style="text-align:left;padding:6px 10px;border-bottom:1px solid #23305a;background:#101731">BUG</th></tr></thead>';
    html += '<tbody>';
    for(var j=0;j<bugList.length;j++){
      var b = bugList[j];
      html += '<tr>'
        + '<td style="padding:6px 10px;border-bottom:1px solid #23305a">'+(j+1)+'</td>'
        + '<td style="padding:6px 10px;border-bottom:1px solid #23305a">'+esc(b)+'</td>'
        + '</tr>';
    }
    html += '</tbody></table></div>';
  }
  hostsDiv.innerHTML = html;
}

function esc(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function colName(n){ let r='',x=n+1; while(x>0){x--; r=String.fromCharCode(65+(x%26))+r; x=Math.floor(x/26);} return r; }
function ystr_noquote(v){
  let s = String(v==null?'':v).replace(/[\r\n]+/g,' ').trim();
  s = s.replace(/["']/g, '');
  return s;
}
function toBool(v){ const s=String(v||'').toLowerCase(); return s==='true'||s==='1'||s==='yes'||s==='y'; }

function generateYaml(){
  if(!hostCols.length) return '';
  const selectedModes = [...document.querySelectorAll('#modes input[type=checkbox]:checked')].map(i=>i.dataset.mode);
  if(selectedModes.length===0) return '';
  const lines=['proxies:'];
  for(const h of hostCols){
    const baseServer = h.server || h.host;
    const basePath = (h.path || '').replace(/^\/?/,''); // only from Excel
    const tls = toBool(h.tls);
    const bugs = bugList.length? bugList : [''];
    for(const bug of bugs){
      const nameBase = h.host + (bug? ' '+bug : '');
      for(const mode of selectedModes){
        if(mode==='trojan_ws_sni'){
          lines.push(...tplTrojanWsSni(nameBase, baseServer, h.port, h.password, bug, basePath, tls));
        } else if(mode==='trojan_xtls_sni'){
          lines.push(...tplTrojanXtlsSni(nameBase, baseServer, h.port, h.password, bug));
        } else if(mode==='vless_ws_cdn_sni'){
          lines.push(...tplVlessWsCdn(nameBase, baseServer, h.port, h.password, bug, basePath, true));
        } else if(mode==='vless_ws_cdn_ntls'){
          lines.push(...tplVlessWsCdn(nameBase, baseServer, h.port, h.password, bug, basePath, false));
        } else if(mode==='vless_grpc_sni'){
          lines.push(...tplVlessGrpc(nameBase, baseServer, h.port, h.password, bug, basePath, true));
        } else if(mode==='vmess_ws_cdn_sni'){
          lines.push(...tplVmessWsCdn(nameBase, baseServer, h.port, h.password, bug, basePath, true));
        } else if(mode==='vmess_ws_cdn_ntls'){
          lines.push(...tplVmessWsCdn(nameBase, baseServer, h.port, h.password, bug, basePath, false));
        } else if(mode==='vmess_grpc_sni'){
          lines.push(...tplVmessGrpc(nameBase, baseServer, h.port, h.password, bug, basePath, true));
        }
      }
    }
  }
  return lines.join('\n')+'\n';
}

// Templates (no quotes)
function tplTrojanWsSni(name, server, port, password, sni, path, tls){
  const n = 'TRJWS ' + name;
  const a=[
    '  - name: ' + ystr_noquote(n),
    '    type: trojan',
    '    server: ' + ystr_noquote(server),
    '    port: ' + (Number(port)||443),
    '    password: ' + ystr_noquote(password),
    '    udp: true',
    '    network: ws'
  ];
  if(tls) a.push('    tls: true');
  if(sni) a.push('    sni: ' + ystr_noquote(sni));
  a.push('    ws-opts:');
  a.push('      path: /' + ystr_noquote(path||''));
  a.push('      headers:\n        Host: ' + ystr_noquote(server));
  return a;
}
function tplTrojanXtlsSni(name, server, port, password, sni){
  const n='TRJXTLSSNI ' + name;
  const a=[
    '  - name: ' + ystr_noquote(n),
    '    type: trojan',
    '    server: ' + ystr_noquote(server),
    '    port: ' + (Number(port)||443),
    '    password: ' + ystr_noquote(password),
    '    flow: xtls-rprx-direct',
    '    udp: true',
    '    tls: true'
  ];
  if(sni) a.push('    sni: ' + ystr_noquote(sni));
  return a;
}
function tplVlessWsCdn(name, server, port, uuid, sni, path, tls){
  const n='VLSWSCDN'+(tls?'':'NTLS')+' ' + name;
  const a=[
    '  - name: ' + ystr_noquote(n),
    '    type: vless',
    '    server: ' + ystr_noquote(server),
    '    port: ' + (Number(port)|| (tls?443:80)),
    '    uuid: ' + ystr_noquote(uuid),
    '    udp: true',
    '    network: ws'
  ];
  if(tls) a.push('    tls: true');
  if(sni) a.push('    servername: ' + ystr_noquote(sni));
  a.push('    ws-opts:');
  a.push('      path: /' + ystr_noquote(path||''));
  a.push('      headers:\n        Host: ' + ystr_noquote(server));
  return a;
}
function tplVlessGrpc(name, server, port, uuid, sni, serviceName, tls){
  const n='VLSGRPC ' + name;
  const a=[
    '  - name: ' + ystr_noquote(n),
    '    type: vless',
    '    server: ' + ystr_noquote(server),
    '    port: ' + (Number(port)||443),
    '    uuid: ' + ystr_noquote(uuid),
    '    udp: true',
    '    network: grpc',
    '    grpc-opts:',
    '      grpc-service-name: ' + ystr_noquote(serviceName || 'ServiceName')
  ];
  if(tls) a.push('    tls: true');
  if(sni) a.push('    servername: ' + ystr_noquote(sni));
  return a;
}
function tplVmessWsCdn(name, server, port, uuid, sni, path, tls){
  const n='VMSWSCDN'+(tls?'':'NTLS')+' ' + name;
  const a=[
    '  - name: ' + ystr_noquote(n),
    '    type: vmess',
    '    server: ' + ystr_noquote(server),
    '    port: ' + (Number(port)|| (tls?443:80)),
    '    uuid: ' + ystr_noquote(uuid),
    '    alterId: 0',
    '    cipher: auto',
    '    udp: true',
    '    network: ws'
  ];
  if(tls) a.push('    tls: true');
  if(sni) a.push('    servername: ' + ystr_noquote(sni));
  a.push('    ws-opts:');
  a.push('      path: /' + ystr_noquote(path||''));
  a.push('      headers:\n        Host: ' + ystr_noquote(server));
  return a;
}
function tplVmessGrpc(name, server, port, uuid, sni, serviceName, tls){
  const n='VMSGRPC ' + name;
  const a=[
    '  - name: ' + ystr_noquote(n),
    '    type: vmess',
    '    server: ' + ystr_noquote(server),
    '    port: ' + (Number(port)||443),
    '    uuid: ' + ystr_noquote(uuid),
    '    alterId: 0',
    '    cipher: auto',
    '    udp: true',
    '    network: grpc',
    '    grpc-opts:',
    '      grpc-service-name: ' + ystr_noquote(serviceName || 'ServiceName')
  ];
  if(tls) a.push('    tls: true');
  if(sni) a.push('    servername: ' + ystr_noquote(sni));
  return a;
}