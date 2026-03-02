/**
 * Wormkey owner control bar overlay.
 * Served at /.wormkey/overlay.js by the gateway.
 * Design: https://www.figma.com/design/7CEkYWa9qILAR44XxKckGe/Studio?node-id=1533-250
 * Tabs: Copy Url (1533-236), Logs, etc. Bar at bottom (1533-211).
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
  function getShareUrl(){
    var slug = getSlug();
    return slug ? gatewayOrigin + '/s/' + slug : null;
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

  function copyToClipboard(text, onDone){
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function(){ onDone(true); }).catch(function(){ onDone(false); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); onDone(true); } catch(e){ onDone(false); }
      document.body.removeChild(ta);
    }
  }

  req('/.wormkey/me').then(function(r){ if (!r.ok) return; return r.json(); }).then(function(me){
    if (!me || !me.owner) return;
    var shareUrl = getShareUrl();
    var activeTab = 'copy';
    var panelOpen = false;
    var wormkeyDownX = 0, wormkeyDownY = 0;

    var styleEl = document.createElement('style');
    styleEl.textContent = '@keyframes tabbar-shield-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}#wormkey-overlay .tabbar-connected:hover .tabbar-shield{animation:tabbar-shield-spin .6s ease-in-out}#wormkey-overlay .tabbar-views .tabbar-eye{transform-origin:center;transition:transform .2s ease-out}#wormkey-overlay .tabbar-views:hover .tabbar-eye{transform:scaleY(.15)}#wormkey-overlay .tabbar-btn:hover{background:rgba(255,255,255,0.03)}@media(prefers-reduced-motion:reduce){#wormkey-overlay .tabbar-shield,#wormkey-overlay .tabbar-eye{animation:none!important;transition:none!important}}';
    document.head.appendChild(styleEl);

    var root = document.createElement('div');
    root.id = 'wormkey-overlay';
    root.style.cssText = 'position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;flex-direction:column;justify-content:flex-end;gap:4px;width:fit-content;min-width:0;max-width:calc(100vw - 20px);user-select:none';
    var dragging = false, dx = 0, dy = 0;
    function startDrag(ev){
      dragging = true;
      wormkeyDownX = ev.clientX;
      wormkeyDownY = ev.clientY;
      root.style.transform = 'none';
      var rect = root.getBoundingClientRect();
      root.style.left = rect.left + 'px';
      root.style.bottom = (window.innerHeight - rect.bottom) + 'px';
      root.style.top = 'auto';
      dx = ev.clientX - rect.left;
      dy = ev.clientY - rect.top;
      ev.preventDefault();
    }
    document.addEventListener('mousemove', function(ev){
      if (!dragging) return;
      root.style.left = Math.max(0, Math.min(ev.clientX - dx, window.innerWidth - root.offsetWidth)) + 'px';
      var h = root.offsetHeight;
      var newBottom = window.innerHeight - (ev.clientY - dy + h);
      root.style.bottom = Math.max(10, Math.min(newBottom, window.innerHeight - h)) + 'px';
      root.style.top = 'auto';
    });
    document.addEventListener('mouseup', function(ev){
      if (dragging && (Math.abs(ev.clientX - wormkeyDownX) > 4 || Math.abs(ev.clientY - wormkeyDownY) > 4) === false) {
        panelOpen = false;
        panel.style.display = 'none';
      }
      dragging = false;
      wormkeyHandle.style.cursor = 'grab';
    });

    var panel = document.createElement('div');
    panel.id = 'wormkey-panel';
    panel.style.cssText = 'display:none;flex-direction:column;gap:4px;padding:4px;border-radius:10px;background:rgba(109,109,109,0.2);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);width:100%;min-width:0;min-height:44px;box-sizing:border-box';

    function row(label, value, onCopy){
      var r = document.createElement('div');
      r.style.cssText = 'display:flex;align-items:center;padding:10px;border-radius:6px;background:rgba(255,255,255,0.02);overflow:hidden';
      var p = document.createElement('p');
      p.style.cssText = 'flex:1;min-width:0;margin:0;padding:10px;font:10px "Geist",ui-sans-serif,sans-serif;font-weight:500;color:rgba(255,255,255,0.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      p.innerHTML = '<span style="color:rgba(255,255,255,0.8)">' + label + '</span> <span style="color:rgba(255,255,255,0.5)">' + (value || '') + '</span>';
      r.appendChild(p);
      if (onCopy && value) {
        var copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        copyBtn.style.cssText = 'border:0;border-radius:6px;padding:4px 10px;margin-right:8px;cursor:pointer;background:rgba(255,255,255,0.15);color:#fff;font:10px "Geist",sans-serif;font-weight:500';
        copyBtn.onclick = function(){ copyToClipboard(value, function(ok){ copyBtn.textContent = ok ? 'Copied!' : 'Copy'; if(ok) setTimeout(function(){ copyBtn.textContent = 'Copy'; }, 1200); }); };
        r.appendChild(copyBtn);
      }
      return r;
    }

    var copyContent = document.createElement('div');
    copyContent.style.cssText = 'display:flex;flex-direction:column;gap:4px';
    var mainUrlRow = row('Main_Url:', shareUrl || '...', true);
    var ownerUrlRow = row('Owner:', '...', true);
    copyContent.appendChild(mainUrlRow);
    copyContent.appendChild(ownerUrlRow);

    var logsContent = document.createElement('div');
    logsContent.style.cssText = 'display:flex;align-items:center;padding:10px;font:10px "Geist",sans-serif;color:rgba(255,255,255,0.5)';
    logsContent.textContent = 'Logs will appear here.';

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:4px;align-items:stretch;padding:4px;border-radius:10px;background:rgba(109,109,109,0.6);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);font:10px "Geist",ui-sans-serif,system-ui,sans-serif;font-weight:500;color:#fff;height:40px';

    var wormkeyHandle = document.createElement('div');
    wormkeyHandle.textContent = 'Wormkey';
    wormkeyHandle.className = 'tabbar-btn';
    wormkeyHandle.style.cssText = 'padding:0 10px;opacity:0.5;white-space:nowrap;display:flex;align-items:center;cursor:grab;user-select:none;border-radius:6px;background:transparent;border:0;transition:background .15s';
    wormkeyHandle.title = 'Drag to move; click to close panel';
    wormkeyHandle.onmousedown = function(ev){
      startDrag(ev);
      wormkeyHandle.style.cursor = 'grabbing';
    };
    bar.appendChild(wormkeyHandle);

    var copyTabBtn = document.createElement('button');
    copyTabBtn.className = 'tabbar-btn';
    copyTabBtn.textContent = 'Copy Url';
    copyTabBtn.style.cssText = 'border:0;background:transparent;border-radius:6px;padding:0 10px;cursor:pointer;color:#fff;font:10px "Geist",sans-serif;font-weight:500;opacity:0.5;white-space:nowrap;display:flex;align-items:center;justify-content:center;transition:background .15s';
    copyTabBtn.onclick = function(){ activeTab = 'copy'; panelOpen = true; panel.style.display = 'flex'; setTab(); };
    bar.appendChild(copyTabBtn);

    var logsTabBtn = document.createElement('button');
    logsTabBtn.className = 'tabbar-btn';
    logsTabBtn.textContent = 'Logs';
    logsTabBtn.style.cssText = 'border:0;background:transparent;padding:0 10px;cursor:pointer;color:#fff;font:10px "Geist",sans-serif;font-weight:500;opacity:0.5;white-space:nowrap;display:flex;align-items:center;justify-content:center;transition:background .15s';
    logsTabBtn.onclick = function(){ activeTab = 'logs'; panelOpen = true; panel.style.display = 'flex'; setTab(); };
    bar.appendChild(logsTabBtn);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'tabbar-btn';
    closeBtn.textContent = 'Close Tunnel';
    closeBtn.style.cssText = 'border:0;background:transparent;padding:0 10px;cursor:pointer;color:#fff;font:10px "Geist",sans-serif;font-weight:500;opacity:0.5;white-space:nowrap;display:flex;align-items:center;justify-content:center;transition:background .15s';
    bar.appendChild(closeBtn);

    var divider = document.createElement('div');
    divider.style.cssText = 'width:1px;height:100%;background:rgba(255,255,255,0.2);flex-shrink:0';
    bar.appendChild(divider);

    var statusWrap = document.createElement('div');
    statusWrap.className = 'tabbar-connected';
    statusWrap.style.cssText = 'display:flex;gap:6px;align-items:center;padding:0 10px;cursor:default';
    statusWrap.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" class="tabbar-shield" style="flex-shrink:0;transform-origin:5px 5px"><path d="M8.04151 2.52766L5.69751 1.09866C5.26701 0.837156 4.73251 0.836656 4.30201 1.09866L1.95801 2.52716C1.52101 2.79366 1.24951 3.29266 1.24951 3.82916V6.16866C1.24951 6.70566 1.52101 7.20466 1.95801 7.47066L4.30201 8.89966C4.51701 9.03066 4.75851 9.09616 4.99951 9.09616C5.24051 9.09616 5.48201 9.03066 5.69701 8.89966L8.04101 7.47116C8.47801 7.20466 8.74951 6.70566 8.74951 6.16916V3.82966C8.74951 3.29266 8.47851 2.79366 8.04151 2.52766ZM7.14201 3.80966L4.76701 6.80966C4.67551 6.92516 4.53801 6.99466 4.39051 6.99916C4.38551 6.99916 4.38001 6.99916 4.37501 6.99916C4.23351 6.99916 4.09801 6.93916 4.00351 6.83366L2.87851 5.58366C2.69401 5.37816 2.71051 5.06216 2.91551 4.87766C3.12101 4.69266 3.43651 4.70966 3.62151 4.91466L4.35051 5.72466L6.35801 3.18916C6.52951 2.97316 6.84351 2.93616 7.06051 3.10716C7.27701 3.27866 7.31351 3.59316 7.14201 3.80966Z" fill="#5BFF6D"/></svg>';
    var statusText = document.createElement('span');
    statusText.textContent = 'Connected';
    statusText.style.cssText = 'color:#5BFF6D;white-space:nowrap';
    statusWrap.appendChild(statusText);
    bar.appendChild(statusWrap);

    var viewerWrap = document.createElement('div');
    viewerWrap.className = 'tabbar-views';
    viewerWrap.style.cssText = 'display:flex;gap:6px;align-items:center;padding:0 10px;cursor:default';
    viewerWrap.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" class="tabbar-eye" style="flex-shrink:0"><path d="M8.75554 4.098C8.31704 3.317 7.07304 1.5 5.00004 1.5C2.92704 1.5 1.68304 3.317 1.25204 4.085C0.920543 4.6365 0.918043 5.3475 1.24404 5.9015C1.57554 6.527 2.79754 8.4995 5.00004 8.4995C7.07304 8.4995 8.31704 6.6825 8.74804 5.9145C9.08204 5.359 9.08204 4.6405 8.75554 4.0975V4.098ZM5.00004 6.5C4.17154 6.5 3.50004 5.8285 3.50004 5C3.50004 4.1715 4.17154 3.5 5.00004 3.5C5.82854 3.5 6.50004 4.1715 6.50004 5C6.50004 5.8285 5.82854 6.5 5.00004 6.5Z" fill="#A0A0A0"/></svg>';
    var viewerCount = document.createElement('span');
    viewerCount.textContent = '0';
    viewerCount.style.cssText = 'color:#818181;white-space:nowrap';
    viewerWrap.appendChild(viewerCount);
    bar.appendChild(viewerWrap);

    function setTab(){
      copyContent.style.display = activeTab === 'copy' ? 'flex' : 'none';
      logsContent.style.display = activeTab === 'logs' ? 'block' : 'none';
      copyTabBtn.style.background = activeTab === 'copy' ? 'rgba(255,255,255,0.15)' : 'transparent';
      copyTabBtn.style.opacity = activeTab === 'copy' ? '1' : '0.5';
      logsTabBtn.style.background = activeTab === 'logs' ? 'rgba(255,255,255,0.15)' : 'transparent';
      logsTabBtn.style.opacity = activeTab === 'logs' ? '1' : '0.5';
    }

    function refresh(){
      req('/.wormkey/state').then(function(r){ if (!r.ok) throw new Error('state'); return r.json(); }).then(function(s){
        viewerCount.textContent = String(s.activeViewers || 0);
      }).catch(function(){
        statusWrap.querySelectorAll('svg path').forEach(function(p){ p.setAttribute('fill', '#818181'); });
        statusText.textContent = 'Disconnected';
        statusText.style.color = '#818181';
      });
      req('/.wormkey/urls').then(function(r){ if (!r.ok) return; return r.json(); }).then(function(u){
        if (u && u.ownerUrl) {
          var p = ownerUrlRow.querySelector('p');
          if (p) p.innerHTML = '<span style="color:rgba(255,255,255,0.8)">Owner: </span><span style="color:rgba(255,255,255,0.5)">' + (u.ownerUrl.length > 50 ? u.ownerUrl.slice(0,47) + '...' : u.ownerUrl) + '</span>';
          ownerUrlRow._fullUrl = u.ownerUrl;
        }
      }).catch(function(){});
    }

    closeBtn.onclick = function(){
      req('/.wormkey/close', { method:'POST' }).then(function(){
        statusText.textContent = 'Closed';
        statusText.style.color = '#818181';
        statusWrap.querySelectorAll('svg path').forEach(function(p){ p.setAttribute('fill', '#818181'); });
      });
    };

    panel.appendChild(copyContent);
    panel.appendChild(logsContent);
    root.appendChild(panel);
    root.appendChild(bar);

    setTab();
    refresh();

    if (shareUrl) {
      var p = mainUrlRow.querySelector('p');
      if (p) p.innerHTML = '<span style="color:rgba(255,255,255,0.8)">Main_Url: </span><span style="color:rgba(255,255,255,0.5)">' + shareUrl + '</span>';
      mainUrlRow._fullUrl = shareUrl;
    }

    var copyMainBtn = mainUrlRow.querySelector('button');
    if (copyMainBtn) copyMainBtn.onclick = function(){ copyToClipboard(shareUrl || '', function(ok){ copyMainBtn.textContent = ok ? 'Copied!' : 'Copy'; if(ok) setTimeout(function(){ copyMainBtn.textContent = 'Copy'; }, 1200); }); };
    var copyOwnerBtn = ownerUrlRow.querySelector('button');
    if (copyOwnerBtn) copyOwnerBtn.onclick = function(){ var url = ownerUrlRow._fullUrl || ''; copyToClipboard(url, function(ok){ copyOwnerBtn.textContent = ok ? 'Copied!' : 'Copy'; if(ok) setTimeout(function(){ copyOwnerBtn.textContent = 'Copy'; }, 1200); }); };

    document.body.appendChild(root);
  }).catch(function(){});
})();
