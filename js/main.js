/* ==========================================================
   ELYTE portfolio – behaviour (no dependencies)
   1. Footer year  2. Mobile nav  3. Active nav link
   4. Scroll reveal  5. Copy email  6. Digital globe (Canvas 2D)
   ========================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. Footer year ---------------------------------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* 2. Mobile navigation ---------------------------------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  var mobileMq = window.matchMedia('(max-width: 959px)');

  function setNav(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setNav(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setNav(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setNav(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (toggle.getAttribute('aria-expanded') === 'true' &&
          !nav.contains(e.target) && !toggle.contains(e.target)) setNav(false);
    });
    var onMq = function (e) { if (!e.matches) setNav(false); };
    if (mobileMq.addEventListener) mobileMq.addEventListener('change', onMq);
    else if (mobileMq.addListener) mobileMq.addListener(onMq);
  }

  /* 3. Active nav link ------------------------------------ */
  var links = Array.prototype.slice.call(document.querySelectorAll('.site-nav ul a[href^="#"]'));
  if ('IntersectionObserver' in window && links.length) {
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          links.forEach(function (a) { a.removeAttribute('aria-current'); });
          map[en.target.id].setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) spy.observe(s);
    });
  }

  /* 4. Scroll reveal (single fade per block) -------------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* 5. Copy email ----------------------------------------- */
  var statusEl = document.querySelector('.copy-status');
  if (navigator.clipboard && window.isSecureContext) {
    Array.prototype.forEach.call(document.querySelectorAll('.copy-btn'), function (btn) {
      btn.hidden = false;
      btn.setAttribute('aria-label', 'Copy email address');
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(function () {
          btn.textContent = 'Copied';
          if (statusEl) statusEl.textContent = 'Email address copied to clipboard.';
          setTimeout(function () {
            btn.textContent = 'Copy';
            if (statusEl) statusEl.textContent = '';
          }, 2400);
        }, function () {
          if (statusEl) statusEl.textContent = 'Copy failed. Please select the address manually.';
        });
      });
    });
  }

  /* 6. Digital globe -------------------------------------- */
  var container = document.getElementById('globe');
  var canvas = document.getElementById('globe-canvas');
  if (!container || !canvas) return;

  try {
    initGlobe(container, canvas);
  } catch (err) {
    // The static SVG fallback stays visible if anything fails.
  }

  function initGlobe(container, canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var TAU = Math.PI * 2;
    var DEG = Math.PI / 180;
    var VIEW_TILT = 18 * DEG;
    var cosT = Math.cos(VIEW_TILT), sinT = Math.sin(VIEW_TILT);
    var small = window.matchMedia('(max-width: 600px)').matches;

    var size = 0, cx = 0, cy = 0, R = 0;
    var rot = 0.6, last = 0, running = false, rafId = 0;
    var gSphere, gGlow, gRim;

    // Illustrative network nodes (abstract hubs, not live data). Lagos is index 0.
    var HUBS = [
      [6.5, 3.4], [51.5, -0.1], [40.7, -74.0], [1.35, 103.8], [25.2, 55.3],
      [37.8, -122.4], [-23.5, -46.6], [35.7, 139.7], [-1.3, 36.8], [52.5, 13.4],
      [-33.9, 151.2], [19.4, -99.1], [47.4, 8.5], [22.3, 114.2], [-26.2, 28.0],
      [43.7, -79.4], [12.97, 77.6], [30.0, 31.2], [-34.6, -58.4], [60.2, 24.9]
    ];
    if (small) HUBS = HUBS.slice(0, 14);
    // Long-range "partnership" arcs from/between hubs
    var ARC_PAIRS = [[0, 1], [0, 4], [0, 2], [1, 3], [2, 5], [4, 7], [0, 8], [3, 10], [2, 6], [4, 16], [1, 12], [0, 14]]
      .filter(function (p) { return p[0] < HUBS.length && p[1] < HUBS.length; });

    function vec(lat, lon) {
      var la = lat * DEG, lo = lon * DEG;
      return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
    }
    // Spin around Y, then tilt around X (view angle). Writes into `out`.
    var cR = 1, sR = 0;
    function xf(v, out) {
      var x = v[0] * cR + v[2] * sR;
      var z = -v[0] * sR + v[2] * cR;
      out[0] = x;
      out[1] = v[1] * cosT - z * sinT;
      out[2] = v[1] * sinT + z * cosT;
      return out;
    }

    // Lat/long grid (flattened into segments once)
    var gridSegs = [];
    var lat, lon;
    for (lat = -60; lat <= 60; lat += 30) {
      for (lon = -180; lon < 180; lon += 8) gridSegs.push([vec(lat, lon), vec(lat, lon + 8)]);
    }
    for (lon = -180; lon < 180; lon += 30) {
      for (lat = -88; lat < 88; lat += 8) gridSegs.push([vec(lat, lon), vec(lat + 8, lon)]);
    }

    var nodes = HUBS.map(function (c) { return vec(c[0], c[1]); });

    // Short-range mesh: link each node to its 2 nearest neighbours
    var mesh = [];
    var seen = {};
    nodes.forEach(function (a, i) {
      var d = nodes.map(function (b, j) {
        return { j: j, d: i === j ? 9 : (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]) };
      }).sort(function (x, y) { return x.d - y.d; });
      for (var k = 0; k < 2; k++) {
        var j = d[k].j, key = Math.min(i, j) + '-' + Math.max(i, j);
        if (!seen[key] && d[k].d < 0.9) { seen[key] = 1; mesh.push([i, j]); }
      }
    });

    function slerpArc(a, b, liftAmt, steps) {
      var dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      var w = Math.acos(dot), sw = Math.sin(w) || 1e-6;
      function point(t) {
        var A = Math.sin((1 - t) * w) / sw, B = Math.sin(t * w) / sw;
        var lift = 1 + liftAmt * Math.sin(Math.PI * t) * (w / Math.PI);
        return [(a[0] * A + b[0] * B) * lift, (a[1] * A + b[1] * B) * lift, (a[2] * A + b[2] * B) * lift];
      }
      var samples = [];
      for (var k = 0; k <= steps; k++) samples.push(point(k / steps));
      return { samples: samples, point: point };
    }

    var arcs = ARC_PAIRS.map(function (p, idx) {
      var arc = slerpArc(nodes[p[0]], nodes[p[1]], 0.22, 32);
      arc.offset = idx * 0.19;
      arc.speed = 0.5 + (idx % 3) * 0.13;
      return arc;
    });
    var meshArcs = mesh.map(function (p) { return slerpArc(nodes[p[0]], nodes[p[1]], 0.02, 10); });

    var ORBIT = { r: 1.3, a: 74 * DEG, b: -20 * DEG, speed: 0.00018 };
    function orbitPoint(th, out) {
      var x = Math.cos(th) * ORBIT.r, z = Math.sin(th) * ORBIT.r;
      var ca = Math.cos(ORBIT.a), sa = Math.sin(ORBIT.a);
      var y1 = -z * sa, z1 = z * ca;
      var cb = Math.cos(ORBIT.b), sb = Math.sin(ORBIT.b);
      out[0] = x * cb - y1 * sb; out[1] = x * sb + y1 * cb; out[2] = z1;
      return out;
    }

    var A = [0, 0, 0], B = [0, 0, 0];

    function resize() {
      size = container.clientWidth;
      if (!size) return;
      var dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = cy = size / 2;
      R = size * 0.36;

      gSphere = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      gSphere.addColorStop(0, '#10243a');
      gSphere.addColorStop(0.6, '#0a1626');
      gSphere.addColorStop(1, '#050A14');

      gGlow = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.38);
      gGlow.addColorStop(0, 'rgba(79,216,235,0.14)');
      gGlow.addColorStop(1, 'rgba(79,216,235,0)');

      gRim = ctx.createRadialGradient(cx, cy, R * 0.78, cx, cy, R);
      gRim.addColorStop(0, 'rgba(79,216,235,0)');
      gRim.addColorStop(1, 'rgba(79,216,235,0.14)');

      draw(performance.now());
    }

    function strokePath(samples, minZ) {
      var open = false;
      for (var s = 0; s < samples.length; s++) {
        xf(samples[s], A);
        if (A[2] > minZ) {
          var px = cx + R * A[0], py = cy - R * A[1];
          if (!open) { ctx.moveTo(px, py); open = true; } else ctx.lineTo(px, py);
        } else open = false;
      }
    }

    function drawOrbit(time, front) {
      var n = 96, started = false, base = time * ORBIT.speed * 0.2;
      ctx.beginPath();
      for (var k = 0; k <= n; k++) {
        orbitPoint((k / n) * TAU + base, A);
        if ((A[2] >= 0) === front) {
          var sx = cx + R * A[0], sy = cy - R * A[1];
          if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
        } else started = false;
      }
      ctx.strokeStyle = front ? 'rgba(79,216,235,0.24)' : 'rgba(79,216,235,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      orbitPoint(time * ORBIT.speed + 0.5, B);
      if ((B[2] >= 0) === front) {
        var X = cx + R * B[0], Y = cy - R * B[1];
        ctx.fillStyle = 'rgba(159,242,212,0.16)';
        ctx.beginPath(); ctx.arc(X, Y, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#9FF2D4';
        ctx.beginPath(); ctx.arc(X, Y, 2.2, 0, TAU); ctx.fill();
      }
    }

    function draw(time) {
      cR = Math.cos(rot); sR = Math.sin(rot);
      ctx.clearRect(0, 0, size, size);

      ctx.fillStyle = gGlow;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.38, 0, TAU); ctx.fill();

      drawOrbit(time, false);

      ctx.fillStyle = gSphere;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.fillStyle = gRim;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

      // Grid: far side faint, near side brighter
      for (var pass = 0; pass < 2; pass++) {
        var front = pass === 1;
        ctx.beginPath();
        for (var g = 0; g < gridSegs.length; g++) {
          xf(gridSegs[g][0], A); xf(gridSegs[g][1], B);
          if (front ? (A[2] > 0 && B[2] > 0) : (A[2] <= 0 && B[2] <= 0)) {
            ctx.moveTo(cx + R * A[0], cy - R * A[1]);
            ctx.lineTo(cx + R * B[0], cy - R * B[1]);
          }
        }
        ctx.strokeStyle = front ? 'rgba(79,216,235,0.22)' : 'rgba(79,216,235,0.045)';
        ctx.lineWidth = front ? 0.8 : 0.6;
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(79,216,235,0.4)';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

      // Mesh (local network links)
      ctx.beginPath();
      for (var m = 0; m < meshArcs.length; m++) strokePath(meshArcs[m].samples, 0.05);
      ctx.strokeStyle = 'rgba(45,212,191,0.32)';
      ctx.lineWidth = 0.9;
      ctx.stroke();

      // Long-range arcs + travelling pulses
      ctx.beginPath();
      for (var j = 0; j < arcs.length; j++) strokePath(arcs[j].samples, 0.02);
      ctx.strokeStyle = 'rgba(159,242,212,0.36)';
      ctx.lineWidth = 1;
      ctx.stroke();

      for (j = 0; j < arcs.length; j++) {
        var arc = arcs[j];
        var t = ((time * 0.00006 * arc.speed) + arc.offset) % 1;
        xf(arc.point(t), B);
        if (B[2] > 0.02) {
          var qx = cx + R * B[0], qy = cy - R * B[1];
          ctx.fillStyle = 'rgba(79,216,235,0.2)';
          ctx.beginPath(); ctx.arc(qx, qy, 4.5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#4FD8EB';
          ctx.beginPath(); ctx.arc(qx, qy, 1.6, 0, TAU); ctx.fill();
        }
      }

      // Nodes
      for (j = 0; j < nodes.length; j++) {
        xf(nodes[j], A);
        if (A[2] > 0) {
          var nx = cx + R * A[0], ny = cy - R * A[1];
          var depth = 0.4 + 0.6 * A[2];
          ctx.fillStyle = 'rgba(79,216,235,' + (0.15 * depth).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(nx, ny, 6.5, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(159,242,212,' + depth.toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(nx, ny, j === 0 ? 3 : 2.2, 0, TAU); ctx.fill();
          if (j === 0 && running) { // Lagos: gentle pulse ring
            var pr = (time * 0.0006) % 1;
            ctx.strokeStyle = 'rgba(159,242,212,' + (0.5 * (1 - pr) * depth).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(nx, ny, 3.5 + pr * 13, 0, TAU); ctx.stroke();
          }
        }
      }

      drawOrbit(time, true);
    }

    function frame(ts) {
      if (!running) return;
      var dt = Math.min(ts - last, 50);
      last = ts;
      rot += dt * 0.0001;
      draw(ts);
      rafId = requestAnimationFrame(frame);
    }
    function start() {
      if (running || reduceMotion || !size || document.hidden) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    }

    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { resize(); }).observe(container);
    } else {
      window.addEventListener('resize', resize);
    }
    resize();
    if (!size) return;
    container.classList.add('is-ready');

    // Pause when off-screen or the tab is hidden (saves battery on mobile)
    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        visible ? start() : stop();
      }).observe(container);
    } else {
      start();
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else if (visible) start();
    });
  }
})();
