// customs.js — jQuery version

$(function () {
  var $file = $('#file'),
    $parseBtn = $('#parse'),
    $genBtn = $('#gen'),
    $dlBtn = $('#dl'),
    $hostsDiv = $('#hosts'),
    $out = $('#out');

  var matrix = [], hostCols = [], bugList = [];

  // ===== QR Saweria (100x100) =====
  (function initQR() {
    var wrap = document.getElementById('qrcode');
    var url = 'https://saweria.co/zeusid6';
    try {
      new QRCode(wrap, { text: url, width: 100, height: 100, correctLevel: QRCode.CorrectLevel.M });
    } catch (e) { }
    $('#dlQR').on('click', function () {
      var img = wrap.querySelector('img');
      if (!img) {
        var cvs0 = wrap.querySelector('canvas');
        if (cvs0) {
          var a0 = document.createElement('a');
          a0.href = cvs0.toDataURL('image/png');
          a0.download = 'saweria-qr.png';
          document.body.appendChild(a0);
          a0.click();
          setTimeout(function () { a0.remove(); }, 0);
        }
        return;
      }
      var cvs = document.createElement('canvas');
      cvs.width = img.naturalWidth || 100;
      cvs.height = img.naturalHeight || 100;
      var ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0);
      var a = document.createElement('a');
      a.href = cvs.toDataURL('image/png');
      a.download = 'saweria-qr.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { a.remove(); }, 0);
    });
  })();

  toastr.options = {
    "closeButton": true,
    "progressBar": true,
    "positionClass": "toast-top-center",
  };

  // ===== File change -> enable Parse =====
  $file.on('change', function () {
    var hasFile = (this.files && this.files.length > 0);
    $parseBtn.prop('disabled', !hasFile);
  });

  // ===== Parse Excel =====
  $parseBtn.on('click', async function () {
    var f = ($file[0].files && $file[0].files[0]) || null;
    if (!f) return;

    // Pakai ArrayBuffer modern; jika perlu fallback FileReader
    var ab;
    if (f.arrayBuffer) {
      ab = await f.arrayBuffer();
    } else {
      ab = await new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function (e) { resolve(e.target.result); };
        fr.onerror = reject;
        fr.readAsArrayBuffer(f);
      });
    }

    var wb = XLSX.read(ab, { type: 'array' });
    var ws = wb.Sheets[wb.SheetNames[0]];
    matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

    parseFormLike();
    renderHosts();

    $genBtn.prop('disabled', hostCols.length === 0);
    $dlBtn.prop('disabled', true);
    $out.val('');

    // Tambahkan toastr success
    toastr.success('Excel berhasil diparse, silahkan lanjutkan Generate YAML');
  });


  // ===== Generate YAML =====
  $genBtn.on('click', function () {
    var yaml = generateYaml();
    $out.val(yaml);
    $dlBtn.prop('disabled', $.trim(yaml) === '');
    toastr.success('YAML berhasil di generate, silahkan download YAML');
  });

  // ===== Download YAML =====
  $dlBtn.on('click', function () {
    var blob = new Blob([$out.val()], { type: 'text/yaml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'proxies.yaml';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  });

  // ===== Helpers =====
  function val(r, c) {
    return (matrix[r] && matrix[r][c] != null) ? String(matrix[r][c]).trim() : '';
  }

  function parseFormLike() {
    hostCols = []; bugList = [];
    // Kolom data mulai kolom B (index 1)
    for (var c = 1; c < ((matrix[0] && matrix[0].length) || 64); c++) {
      var host = val(1, c);
      if (!host) continue;
      hostCols.push({
        colIdx: c,
        host: host,
        server: val(2, c),
        password: val(3, c),
        path: val(4, c),
        grpcName: val(5, c)
      });
    }
    var bugStart = -1;
    for (var r = 0; r < matrix.length; r++) {
      if (String(val(r, 0)).toUpperCase().indexOf('LIST BUG') !== -1) { bugStart = r + 1; break; }
    }
    if (bugStart < 0) bugStart = 8;
    for (var i = bugStart; i < matrix.length; i++) {
      var b = val(i, 0);
      if (b && bugList.indexOf(b) === -1) bugList.push(b);
    }
  }

  function renderHosts() {
    if (!hostCols.length) { $hostsDiv.html('<div style="color:#aeb8d8">No HOST columns detected</div>'); return; }

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
    $hostsDiv.html(html);
  }

  function esc(s) {
    return (s || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function ystr_noquote(v) {
    var s = String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim();
    s = s.replace(/["']/g, '');
    return s;
  }

  function generateYaml() {
    if (!hostCols.length) return '';
    var selectedModes = $('#modes input[type=checkbox]:checked').map(function () { return $(this).data('mode'); }).get();
    if (selectedModes.length === 0) return '';
    var lines = ['proxies:'];

    for (var hi = 0; hi < hostCols.length; hi++) {
      var h = hostCols[hi];
      var baseServer = h.server;
      var basePath = (h.path || '').replace(/^\/?/, '');
      var bugs = bugList.length ? bugList : [''];

      for (var bi = 0; bi < bugs.length; bi++) {
        var bug = bugs[bi];
        var nameBase = h.host + (bug ? ' ' + bug : '');
        for (var mi = 0; mi < selectedModes.length; mi++) {
          var mode = selectedModes[mi];
          if (mode === 'trojan_gfw_sni') {
            pushAll(lines, tplTrojanGfwSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'trojan_ws_sni') {
            pushAll(lines, tplTrojanWsSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'trojan_gows_cdn') {
            pushAll(lines, tplTrojanGowsCdn(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'trojan_xtls_sni') {
            pushAll(lines, tplTrojanXtlsSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'trojan_grpc_sni') {
            pushAll(lines, tplTrojanGrpcSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'vmess_ws_sni') {
            pushAll(lines, tplVmessWsSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'vmess_ws_cdn') {
            pushAll(lines, tplVmessWsCdn(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'vmess_ws_cdn_ntls') {
            pushAll(lines, tplVmessWsCdnNtls(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'vmess_grpc_sni') {
            pushAll(lines, tplVmessGrpcSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'vmess_wc') {
            pushAll(lines, tplVmessWc(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'vless_ws_sni') {
            pushAll(lines, tplVlessWsSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'vless_ws_cdn') {
            pushAll(lines, tplVlessWsCdn(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'vless_ws_cdn_ntls') {
            pushAll(lines, tplVlessWsCdnNtls(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'vless_xtls_sni') {
            pushAll(lines, tplVlessXtlsSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          } else if (mode === 'vless_grpc_sni') {
            pushAll(lines, tplVlessGrpcSni(nameBase, baseServer, h.password, bug, basePath, h.grpcName));
          }
        }
      }
    }
    return lines.join('\n') + '\n';
  }

  function pushAll(dst, arr) {
    for (var i = 0; i < arr.length; i++) dst.push(arr[i]);
  }

  // ===== Templates (no quotes) =====
  function tplTrojanGfwSni(name, server, password, bug, path, grpcName) {
    var n = 'TRJGFWSNI ' + name;
    return [
      '  - name: ' + ystr_noquote(n),
      '    type: trojan',
      '    server: ' + ystr_noquote(server),
      '    port: 443',
      '    password: ' + ystr_noquote(password),
      '    udp: true',
      '    sni: ' + ystr_noquote(bug),
      '    skip-cert-verify: true',
    ];
  }
  function tplTrojanWsSni(name, server, password, bug, path, grpcName) {
    var n = 'TRJWSSNI ' + name;
    return [
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
  }
  function tplTrojanGowsCdn(name, server, password, bug, path, grpcName) {
    var n = 'TRJGOWSCDN ' + name;
    return [
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
  }
  function tplTrojanXtlsSni(name, server, password, bug, path, grpcName) {
    var n = 'TRJXTLSNI ' + name;
    return [
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
  }
  function tplTrojanGrpcSni(name, server, password, bug, path, grpcName) {
    var n = 'TRJGRPCSNI ' + name;
    return [
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
  }
  function tplVmessWsSni(name, server, password, bug, path, grpcName) {
    var n = 'VMSWSSNI ' + name;
    return [
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
  }
  function tplVmessWsCdn(name, server, password, bug, path, grpcName) {
    var n = 'VMSWSCDN ' + name;
    return [
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
  }
  function tplVmessWsCdnNtls(name, server, password, bug, path, grpcName) {
    var n = 'VMSWSCDNNTLS ' + name;
    return [
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
  }
  function tplVmessGrpcSni(name, server, password, bug, path, grpcName) {
    var n = 'VMSGRPCSNI ' + name;
    return [
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
  }
  function tplVmessWc(name, server, password, bug, path, grpcName) {
    var n = 'VMSWC ' + name;
    return [
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
      '    servername: ' + ystr_noquote(bug) + '.' + ystr_noquote(server),
      '    network: ws',
      '    ws-opts:',
      '      path: /' + ystr_noquote(path),
      '      headers:',
      '        Host: ' + ystr_noquote(bug) + '.' + ystr_noquote(server),
    ];
  }
  function tplVlessWsSni(name, server, password, bug, path, grpcName) {
    var n = 'VLSWSSNI ' + name;
    return [
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
  }
  function tplVlessWsCdn(name, server, password, bug, path, grpcName) {
    var n = 'VLSWSCDN ' + name;
    return [
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
  }
  function tplVlessWsCdnNtls(name, server, password, bug, path, grpcName) {
    var n = 'VLSWSCDNNTLS ' + name;
    return [
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
  }
  function tplVlessXtlsSni(name, server, password, bug, path, grpcName) {
    var n = 'VLSXTLSNI ' + name;
    return [
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
  }
  function tplVlessGrpcSni(name, server, password, bug, path, grpcName) {
    var n = 'VLSGRPCSNI ' + name;
    return [
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
  }

  // Expose generateYaml if needed elsewhere
  window.generateYaml = generateYaml;

  var btn = document.getElementById('btnTutor');
  var modal = document.getElementById('tutorModal');
  var backdrop = document.getElementById('modalBackdrop');
  var closeBtn = document.getElementById('closeTutor');

  function openM() { modal.style.display = 'block'; backdrop.style.display = 'block'; }
  function closeM() { modal.style.display = 'none'; backdrop.style.display = 'none'; }

  btn.addEventListener('click', openM);
  closeBtn.addEventListener('click', closeM);
  backdrop.addEventListener('click', closeM);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeM(); });

  // Dropdown Menu
  var $dd = $('#menuDropdown');
  var $toggle = $dd.find('.dropdown-toggle');
  $toggle.on('click', function (e) {
    e.stopPropagation();
    $dd.toggleClass('open');
  });
  $dd.find('.has-sub > a').on('click', function (e) {
    e.preventDefault();
    $(this).parent().toggleClass('open');
  });
  $(document).on('click', function () { $dd.removeClass('open'); });

  // Tutor Modal
  var $modal = $('#tutorModal'), $backdrop = $('#modalBackdrop');
  function openM() { $modal.show(); $backdrop.show(); }
  function closeM() { $modal.hide(); $backdrop.hide(); }

  $('#btnTutor').on('click', openM);
  $('#closeTutor').on('click', closeM);
  $backdrop.on('click', closeM);
  $(document).on('keydown', function (e) { if (e.key === 'Escape') closeM(); });

  // Responsive Tables: wrap & auto wrap text
  function wrapResponsive($container) {
    $container.find('table').each(function () {
      var $tb = $(this);
      if (!$tb.parent().hasClass('table-responsive')) {
        $tb.wrap('<div class="table-responsive"></div>');
      }
    });
  }
  wrapResponsive($('#hosts'));
  $('[id*="bug"],[class*="bug"]').each(function () { wrapResponsive($(this)); });
});