/**
 * Wormkey owner control bar overlay.
 * Served at /.wormkey/overlay.js by the gateway.
 * When changing layout/buttons, also update website/app/page.tsx DemoControlBar.
 */
(function(){
  var gatewayOrigin = (function(){
    var s = document.currentScript && document.currentScript.src;
    return s ? new URL(s).origin : window.location.origin;
  })();
  function getSlug(){
    var s = new URLSearchParams(window.location.search).get('slug');
    if (s) return s;
    var m = window.location.pathname.match(/^\/s\/([^\/]+)/);
    return m ? m[1] : null;
  }
  function buildUrl(path){
    var u = new URL(path, gatewayOrigin);
    var slug = getSlug();
    if (slug) u.searchParams.set('slug', slug);
    return u.toString();
  }

  function req(path, opts){
    return fetch(buildUrl(path), Object.assign({credentials:'include'}, opts || {}));
  }

  req('/.wormkey/me').then(function(r){ if (!r.ok) return; return r.json(); }).then(function(me){
    if (!me || !me.owner) return;
    var root = document.createElement('div');
    root.id = 'wormkey-bar';
    root.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483647;font:12px ui-monospace, Menlo, monospace;background:#101820;color:#f4f4ef;border-radius:16px;padding:8px 10px;display:flex;gap:8px;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.25);max-width:calc(100vw - 24px)';

    var handle = document.createElement('button');
    handle.textContent = '::';
    handle.title = 'Drag';
    handle.style.cssText = 'border:0;background:transparent;color:#f4f4ef;cursor:grab;padding:2px 4px';
    root.appendChild(handle);

    var badge = document.createElement('strong');
    badge.textContent = 'Wormkey';
    root.appendChild(badge);

    var info = document.createElement('span');
    info.textContent = '...';
    info.style.opacity = '0.85';
    root.appendChild(info);

    var toggle = document.createElement('button');
    toggle.textContent = '-';
    toggle.title = 'Collapse';
    root.appendChild(toggle);

    var panel = document.createElement('div');
    panel.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
    root.appendChild(panel);

    var lock = document.createElement('button');
    lock.textContent = 'Lock';
    var rotate = document.createElement('button');
    rotate.textContent = 'Rotate';
    var close = document.createElement('button');
    close.textContent = 'Close';
    var maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.min = '1';
    maxInput.style.cssText = 'width:64px;border-radius:999px;border:0;padding:6px 8px';
    var maxSave = document.createElement('button');
    maxSave.textContent = 'Set max';
    var blockInput = document.createElement('input');
    blockInput.placeholder = '/admin';
    blockInput.style.cssText = 'width:110px;border-radius:999px;border:0;padding:6px 8px';
    var blockSave = document.createElement('button');
    blockSave.textContent = 'Block';
    var viewerSelect = document.createElement('select');
    viewerSelect.style.cssText = 'max-width:140px;border-radius:999px;border:0;padding:6px 8px';
    var kick = document.createElement('button');
    kick.textContent = 'Kick';

    [lock, rotate, close, maxSave, blockSave, kick].forEach(function(btn){
      btn.style.cssText = 'border:0;border-radius:999px;padding:5px 9px;cursor:pointer;background:#f4f4ef;color:#101820;font:12px ui-monospace, Menlo, monospace';
      panel.appendChild(btn);
    });
    panel.appendChild(maxInput);
    panel.appendChild(blockInput);
    panel.appendChild(viewerSelect);

    var collapsed = false;
    toggle.onclick = function(){
      collapsed = !collapsed;
      panel.style.display = collapsed ? 'none' : 'flex';
      toggle.textContent = collapsed ? '+' : '-';
      toggle.title = collapsed ? 'Expand' : 'Collapse';
    };

    var dragging = false;
    var dx = 0;
    var dy = 0;
    handle.onmousedown = function(ev){
      dragging = true;
      handle.style.cursor = 'grabbing';
      var rect = root.getBoundingClientRect();
      dx = ev.clientX - rect.left;
      dy = ev.clientY - rect.top;
      ev.preventDefault();
    };
    document.addEventListener('mousemove', function(ev){
      if (!dragging) return;
      root.style.left = Math.max(4, ev.clientX - dx) + 'px';
      root.style.top = Math.max(4, ev.clientY - dy) + 'px';
      root.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', function(){
      dragging = false;
      handle.style.cursor = 'grab';
    });

    var state = null;
    function refresh(){
      req('/.wormkey/state').then(function(r){ if (!r.ok) throw new Error('state'); return r.json(); }).then(function(s){
        state = s;
        info.textContent = (s.policy.public ? 'Public' : 'Locked') + ' | viewers ' + s.activeViewers;
        lock.textContent = s.policy.public ? 'Lock' : 'Unlock';
        maxInput.value = String(s.policy.maxConcurrentViewers || 20);
        viewerSelect.innerHTML = '';
        (s.viewers || []).forEach(function(v){
          var opt = document.createElement('option');
          opt.value = v.id;
          opt.textContent = v.id + ' (' + v.requests + ')';
          viewerSelect.appendChild(opt);
        });
      }).catch(function(){ info.textContent = 'Unavailable'; });
    }

    lock.onclick = function(){
      if (!state) return;
      req('/.wormkey/policy', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ public: !state.policy.public })
      }).then(refresh);
    };

    rotate.onclick = function(){
      req('/.wormkey/rotate-password', { method:'POST' }).then(refresh);
    };

    maxSave.onclick = function(){
      var n = parseInt(maxInput.value, 10);
      if (!Number.isFinite(n) || n < 1) return;
      req('/.wormkey/policy', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ maxConcurrentViewers: n })
      }).then(refresh);
    };

    blockSave.onclick = function(){
      if (!state || !blockInput.value) return;
      var next = (state.policy.blockPaths || []).slice();
      if (next.indexOf(blockInput.value) === -1) next.push(blockInput.value);
      req('/.wormkey/policy', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ blockPaths: next })
      }).then(function(){ blockInput.value=''; refresh(); });
    };

    kick.onclick = function(){
      if (!viewerSelect.value) return;
      req('/.wormkey/kick?id=' + encodeURIComponent(viewerSelect.value), { method:'POST' }).then(refresh);
    };

    close.onclick = function(){
      req('/.wormkey/close', { method:'POST' }).then(function(){ info.textContent = 'Closed'; });
    };

    document.body.appendChild(root);
    refresh();
  }).catch(function(){});
})();
