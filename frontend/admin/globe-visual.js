(() => {
  "use strict";

  const mapRoots = Array.from(document.querySelectorAll(".auth-globe[data-globe]"));
  if (!mapRoots.length) return;

  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const d2r = Math.PI / 180;
  const renderers = [];
  let rafId = 0;

  const continentPolygons = [
    [
      [-168, 72], [-150, 66], [-132, 58], [-120, 50], [-108, 48], [-96, 46], [-84, 38],
      [-82, 28], [-94, 20], [-108, 22], [-118, 30], [-126, 42], [-140, 52], [-156, 64],
      [-168, 72],
    ],
    [
      [-82, 12], [-72, 10], [-64, 4], [-60, -8], [-56, -20], [-56, -32], [-62, -42],
      [-70, -54], [-78, -50], [-80, -36], [-82, -18], [-82, 0], [-82, 12],
    ],
    [
      [-72, 83], [-60, 82], [-44, 80], [-30, 74], [-28, 66], [-40, 60], [-54, 60],
      [-66, 66], [-72, 74], [-72, 83],
    ],
    [
      [-10, 72], [10, 72], [34, 68], [56, 66], [80, 68], [106, 62], [126, 54], [148, 50],
      [168, 56], [176, 50], [168, 40], [146, 30], [126, 24], [108, 20], [92, 14], [76, 10],
      [66, 20], [54, 28], [42, 34], [30, 40], [16, 44], [6, 50], [-4, 58], [-10, 66], [-10, 72],
    ],
    [
      [-18, 37], [-4, 36], [12, 32], [26, 24], [36, 10], [40, -6], [34, -22], [22, -32],
      [10, -36], [-2, -30], [-10, -20], [-14, -2], [-17, 16], [-18, 37],
    ],
    [
      [112, -10], [124, -12], [138, -18], [152, -30], [146, -42], [132, -44], [118, -36],
      [112, -24], [112, -10],
    ],
    [
      [46, 30], [58, 28], [66, 22], [64, 14], [56, 14], [48, 20], [46, 30],
    ],
    [
      [-180, -72], [-150, -76], [-118, -79], [-84, -78], [-54, -74], [-28, -70], [0, -69],
      [30, -71], [62, -75], [98, -80], [132, -78], [160, -73], [180, -70],
    ],
  ];

  const islandEllipses = [
    { lon: 48, lat: -19, rx: 6, ry: 9 },
    { lon: 122, lat: 13, rx: 11, ry: 9 },
    { lon: 142, lat: 36, rx: 8, ry: 6 },
    { lon: 173, lat: -41, rx: 7, ry: 6 },
    { lon: -8, lat: 54, rx: 4, ry: 5 },
    { lon: -74, lat: 19, rx: 5, ry: 3.5 },
    { lon: -157, lat: 21, rx: 4, ry: 3 },
  ];

  let worldPaths = buildFallbackWorldPaths();
  const networkNodes = buildNetworkNodes();
  const networkLinks = buildNetworkLinks(networkNodes);
  loadWorldGeoJSON();

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function fract(value) {
    return value - Math.floor(value);
  }

  function hash2(x, y) {
    return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
  }

  function wrapLongitude(lon) {
    let value = lon;
    while (value < -180) value += 360;
    while (value >= 180) value -= 360;
    return value;
  }

  function pointInPolygon(lon, lat, polygon) {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersects =
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-7) + xi;

      if (intersects) inside = !inside;
    }

    return inside;
  }

  function inEllipse(lon, lat, ellipse) {
    const dx = wrapLongitude(lon - ellipse.lon) / ellipse.rx;
    const dy = (lat - ellipse.lat) / ellipse.ry;
    return dx * dx + dy * dy <= 1;
  }

  function isLand(lon, lat) {
    if (lat < -62) return true;

    for (let i = 0; i < continentPolygons.length; i += 1) {
      if (pointInPolygon(lon, lat, continentPolygons[i])) return true;
    }

    for (let i = 0; i < islandEllipses.length; i += 1) {
      if (inEllipse(lon, lat, islandEllipses[i])) return true;
    }

    return false;
  }

  function densifyPath(points, maxStepDeg) {
    if (!points.length) return [];

    const dense = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const lonDelta = wrapLongitude(p2[0] - p1[0]);
      const latDelta = p2[1] - p1[1];
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lonDelta), Math.abs(latDelta)) / maxStepDeg));

      for (let s = 0; s < steps; s += 1) {
        const t = s / steps;
        dense.push({
          lon: wrapLongitude(p1[0] + lonDelta * t),
          lat: p1[1] + latDelta * t,
        });
      }
    }

    const last = points[points.length - 1];
    dense.push({ lon: wrapLongitude(last[0]), lat: last[1] });
    return dense;
  }

  function ellipseToPath(ellipse) {
    const points = [];
    for (let deg = 0; deg <= 360; deg += 14) {
      const rad = deg * d2r;
      points.push([
        wrapLongitude(ellipse.lon + Math.cos(rad) * ellipse.rx),
        ellipse.lat + Math.sin(rad) * ellipse.ry,
      ]);
    }
    return points;
  }

  function buildFallbackWorldPaths() {
    const paths = [];

    for (let i = 0; i < continentPolygons.length; i += 1) {
      paths.push(densifyPath(continentPolygons[i], 3.5));
    }

    for (let i = 0; i < islandEllipses.length; i += 1) {
      paths.push(densifyPath(ellipseToPath(islandEllipses[i]), 3));
    }

    return paths;
  }

  function simplifyGeoRing(ring, minDeltaDeg) {
    if (!Array.isArray(ring) || !ring.length) return [];

    const out = [];
    let prevLon = null;
    let prevLat = null;

    for (let i = 0; i < ring.length; i += 1) {
      const point = ring[i];
      if (!Array.isArray(point) || point.length < 2) continue;

      const lon = wrapLongitude(Number(point[0]));
      const lat = clamp(Number(point[1]), -89.5, 89.5);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;

      if (
        prevLon === null ||
        Math.abs(lon - prevLon) + Math.abs(lat - prevLat) >= minDeltaDeg
      ) {
        out.push({ lon, lat });
        prevLon = lon;
        prevLat = lat;
      }
    }

    if (!out.length) return out;

    const first = out[0];
    const last = out[out.length - 1];
    if (Math.abs(first.lon - last.lon) > 1e-6 || Math.abs(first.lat - last.lat) > 1e-6) {
      out.push({ lon: first.lon, lat: first.lat });
    }

    return out;
  }

  function buildWorldPathsFromGeoJSON(data) {
    if (!data || !Array.isArray(data.features)) return [];

    const paths = [];

    function pushPolygonRings(coords) {
      if (!Array.isArray(coords) || !coords.length) return;
      const outer = simplifyGeoRing(coords[0], 0.24);
      if (outer.length > 3) {
        paths.push(outer);
      }
    }

    for (let i = 0; i < data.features.length; i += 1) {
      const feature = data.features[i];
      const geometry = feature && feature.geometry;
      if (!geometry || !geometry.type) continue;

      if (geometry.type === "Polygon") {
        pushPolygonRings(geometry.coordinates);
      } else if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
        for (let j = 0; j < geometry.coordinates.length; j += 1) {
          pushPolygonRings(geometry.coordinates[j]);
        }
      }
    }

    return paths;
  }

  function loadWorldGeoJSON() {
    if (typeof fetch !== "function") return;

    fetch("./assets/world.geojson")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const parsed = buildWorldPathsFromGeoJSON(data);
        if (parsed.length > 0) {
          worldPaths = parsed;
        }
      })
      .catch(() => {});
  }

  function buildNetworkNodes() {
    const seeds = [
      { lon: 116.4, lat: 39.9 }, { lon: 121.5, lat: 31.2 }, { lon: 114.1, lat: 22.6 },
      { lon: 139.7, lat: 35.6 }, { lon: 127.0, lat: 37.5 }, { lon: 103.8, lat: 1.3 },
      { lon: 77.1, lat: 28.7 }, { lon: 72.8, lat: 19.0 }, { lon: 55.3, lat: 25.2 },
      { lon: 31.2, lat: 30.0 }, { lon: 2.35, lat: 48.86 }, { lon: 13.4, lat: 52.5 },
      { lon: -0.12, lat: 51.5 }, { lon: -74.0, lat: 40.7 }, { lon: -118.2, lat: 34.0 },
      { lon: -46.6, lat: -23.5 }, { lon: 151.2, lat: -33.9 }, { lon: 37.6, lat: 55.7 },
      { lon: 28.0, lat: -26.2 },
    ];

    const nodes = [];

    function pushNode(lon, lat, seed) {
      nodes.push({
        lon: wrapLongitude(lon),
        lat,
        phase: hash2(seed + 11, 41) * Math.PI * 2,
        pulse: 0.8 + hash2(seed + 23, 57) * 1.5,
        size: 0.9 + hash2(seed + 37, 73) * 1.4,
      });
    }

    for (let i = 0; i < seeds.length; i += 1) {
      pushNode(seeds[i].lon, seeds[i].lat, i + 1);
    }

    for (let i = 0; nodes.length < 45 && i < 1200; i += 1) {
      const lon = hash2(i + 17, 31) * 360 - 180;
      const lat = hash2(i + 29, 53) * 140 - 60;
      if (!isLand(lon, lat)) continue;

      let tooClose = false;
      for (let j = 0; j < nodes.length; j += 1) {
        const dLon = wrapLongitude(nodes[j].lon - lon);
        const dLat = nodes[j].lat - lat;
        if (Math.hypot(dLon * Math.cos(lat * d2r), dLat) < 10) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        pushNode(lon, lat, i + 100);
      }
    }

    return nodes;
  }

  function buildNetworkLinks(nodes) {
    const links = [];
    const visited = new Set();

    for (let i = 0; i < nodes.length; i += 1) {
      const candidates = [];
      for (let j = 0; j < nodes.length; j += 1) {
        if (i === j) continue;
        const dLon = wrapLongitude(nodes[j].lon - nodes[i].lon);
        const dLat = nodes[j].lat - nodes[i].lat;
        const dist = Math.hypot(dLon * Math.cos(((nodes[i].lat + nodes[j].lat) * 0.5) * d2r), dLat);
        if (dist < 64) {
          candidates.push({ j, dist });
        }
      }

      candidates.sort((a, b) => a.dist - b.dist);
      for (let k = 0; k < Math.min(2, candidates.length); k += 1) {
        const a = Math.min(i, candidates[k].j);
        const b = Math.max(i, candidates[k].j);
        const key = `${a}-${b}`;
        if (!visited.has(key)) {
          visited.add(key);
          links.push([a, b]);
        }
      }
    }

    return links;
  }

  function createRenderer(root) {
    const canvas = root.querySelector(".auth-globe__canvas");
    if (!canvas) return null;

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return null;

    const state = {
      root,
      canvas,
      ctx,
      width: 0,
      height: 0,
      dpr: 1,
      startTime: performance.now(),
      observer: null,
    };

    function resize() {
      const cssWidth = Math.max(260, root.clientWidth || 0);
      const cssHeight = Math.max(150, root.clientHeight || 0);
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);

      if (!cssWidth || !cssHeight) return;
      if (state.width === cssWidth && state.height === cssHeight && state.dpr === nextDpr) return;

      state.width = cssWidth;
      state.height = cssHeight;
      state.dpr = nextDpr;
      canvas.width = Math.floor(cssWidth * nextDpr);
      canvas.height = Math.floor(cssHeight * nextDpr);
      ctx.setTransform(nextDpr, 0, 0, nextDpr, 0, 0);
    }

    function project(lon, lat, mapX, mapY, mapW, mapH, originX) {
      return {
        x: originX + ((wrapLongitude(lon) + 180) / 360) * mapW,
        y: mapY + ((90 - lat) / 180) * mapH,
      };
    }

    function drawBackground(width, height) {
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "rgba(6, 24, 64, 0.96)");
      bg.addColorStop(1, "rgba(3, 13, 36, 0.98)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 28; i += 1) {
        const x = (i / 27) * width;
        const alpha = 0.02 + hash2(i + 3, 17) * 0.03;
        ctx.strokeStyle = `rgba(95, 181, 255, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function drawGrid(mapX, mapY, mapW, mapH, elapsed, motionFactor) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i <= 18; i += 1) {
        const x = mapX + (i / 18) * mapW;
        ctx.strokeStyle = "rgba(92, 178, 248, 0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, mapY);
        ctx.lineTo(x, mapY + mapH);
        ctx.stroke();
      }

      for (let i = 0; i <= 10; i += 1) {
        const y = mapY + (i / 10) * mapH;
        ctx.strokeStyle = "rgba(82, 168, 236, 0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mapX, y);
        ctx.lineTo(mapX + mapW, y);
        ctx.stroke();
      }

      const sweepX = mapX + ((elapsed * 74 * motionFactor) % (mapW + 140)) - 140;
      const sweep = ctx.createLinearGradient(sweepX, mapY, sweepX + 140, mapY);
      sweep.addColorStop(0, "rgba(82, 200, 255, 0)");
      sweep.addColorStop(0.5, "rgba(132, 229, 255, 0.25)");
      sweep.addColorStop(1, "rgba(82, 200, 255, 0)");
      ctx.fillStyle = sweep;
      ctx.fillRect(mapX, mapY, mapW, mapH);

      ctx.restore();
    }

    function drawWorldMap(mapX, mapY, mapW, mapH, scrollOffset) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let copy = 0; copy < 3; copy += 1) {
        const originX = mapX - mapW + scrollOffset + copy * mapW;

        for (let i = 0; i < worldPaths.length; i += 1) {
          const path = worldPaths[i];
          if (!path.length) continue;

          ctx.beginPath();
          let hasWrapBreak = false;
          let prevX = null;
          for (let j = 0; j < path.length; j += 1) {
            const p = project(path[j].lon, path[j].lat, mapX, mapY, mapW, mapH, originX);
            if (j === 0 || (prevX !== null && Math.abs(p.x - prevX) > mapW * 0.5)) {
              if (j !== 0) hasWrapBreak = true;
              ctx.moveTo(p.x, p.y);
            } else {
              ctx.lineTo(p.x, p.y);
            }
            prevX = p.x;
          }

          if (!hasWrapBreak) {
            ctx.closePath();
            ctx.fillStyle = "rgba(82, 152, 233, 0.34)";
            ctx.fill();
          }

          ctx.strokeStyle = "rgba(114, 222, 255, 0.56)";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.strokeStyle = "rgba(189, 246, 255, 0.14)";
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    function drawNetwork(mapX, mapY, mapW, mapH, scrollOffset, elapsed) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let copy = 0; copy < 3; copy += 1) {
        const originX = mapX - mapW + scrollOffset + copy * mapW;
        const projectedNodes = [];

        for (let i = 0; i < networkNodes.length; i += 1) {
          const node = networkNodes[i];
          const p = project(node.lon, node.lat, mapX, mapY, mapW, mapH, originX);

          if (p.x < mapX - 30 || p.x > mapX + mapW + 30 || p.y < mapY - 20 || p.y > mapY + mapH + 20) {
            projectedNodes.push(null);
            continue;
          }

          projectedNodes.push(p);
        }

        for (let i = 0; i < networkLinks.length; i += 1) {
          const link = networkLinks[i];
          const a = projectedNodes[link[0]];
          const b = projectedNodes[link[1]];
          if (!a || !b) continue;

          const pulse = 0.35 + 0.65 * Math.sin(elapsed * 1.8 + i * 0.33);
          const mx = (a.x + b.x) * 0.5;
          const my = (a.y + b.y) * 0.5;
          const arcHeight = 8 + (Math.abs(a.x - b.x) / mapW) * 22;

          ctx.strokeStyle = `rgba(90, 214, 255, ${(0.08 + pulse * 0.18).toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(mx, my - arcHeight, b.x, b.y);
          ctx.stroke();
        }

        for (let i = 0; i < networkNodes.length; i += 1) {
          const node = networkNodes[i];
          const p = projectedNodes[i];
          if (!p) continue;

          const twinkle = 0.55 + 0.45 * Math.sin(elapsed * node.pulse + node.phase);
          const core = 1.1 + node.size * 1.05;
          const halo = core * (2.4 + twinkle * 1.3);

          const glow = ctx.createRadialGradient(p.x, p.y, core * 0.1, p.x, p.y, halo);
          glow.addColorStop(0, `rgba(217, 250, 255, ${(0.46 + twinkle * 0.34).toFixed(3)})`);
          glow.addColorStop(0.42, `rgba(120, 228, 255, ${(0.2 + twinkle * 0.22).toFixed(3)})`);
          glow.addColorStop(1, "rgba(98, 215, 255, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.x, p.y, halo, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(225, 252, 255, ${(0.7 + twinkle * 0.26).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, core, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    function drawScanLines(mapX, mapY, mapW, mapH, elapsed) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      const offset = (elapsed * 24) % 6;
      for (let y = mapY + offset; y <= mapY + mapH; y += 6) {
        const alpha = 0.03 + 0.02 * Math.sin((y + elapsed * 16) * 0.09);
        ctx.fillStyle = `rgba(176, 236, 255, ${alpha.toFixed(3)})`;
        ctx.fillRect(mapX, y, mapW, 1);
      }

      ctx.restore();
    }

    function drawFrame(mapX, mapY, mapW, mapH, elapsed) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      const border = ctx.createLinearGradient(mapX, mapY, mapX + mapW, mapY + mapH);
      border.addColorStop(0, "rgba(112, 216, 255, 0.42)");
      border.addColorStop(0.5, "rgba(143, 226, 255, 0.2)");
      border.addColorStop(1, "rgba(90, 182, 245, 0.36)");
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(mapX, mapY, mapW, mapH);

      for (let i = 0; i < 6; i += 1) {
        const y = mapY + (i / 5) * mapH;
        const pulse = 0.24 + 0.2 * Math.sin(elapsed * 0.9 + i);
        ctx.strokeStyle = `rgba(114, 220, 255, ${pulse.toFixed(3)})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(mapX - 12, y);
        ctx.lineTo(mapX + 12, y);
        ctx.moveTo(mapX + mapW - 12, y);
        ctx.lineTo(mapX + mapW + 12, y);
        ctx.stroke();
      }

      ctx.restore();
    }

    function draw(now) {
      const elapsed = (now - state.startTime) / 1000;
      const motionFactor = prefersReducedMotion ? 0 : 1;

      const width = state.width;
      const height = state.height;
      if (!width || !height) return;

      const mapX = 0;
      const mapY = 0;
      const mapW = width;
      const mapH = height;
      const scrollOffset = (elapsed * 34 * motionFactor) % mapW;

      ctx.clearRect(0, 0, width, height);
      drawBackground(width, height);
      drawGrid(mapX, mapY, mapW, mapH, elapsed, motionFactor);
      drawWorldMap(mapX, mapY, mapW, mapH, scrollOffset);
      drawNetwork(mapX, mapY, mapW, mapH, scrollOffset, elapsed);
      drawScanLines(mapX, mapY, mapW, mapH, elapsed);
    }

    function disconnect() {
      if (state.observer) {
        state.observer.disconnect();
      }
    }

    resize();

    if (typeof ResizeObserver !== "undefined") {
      state.observer = new ResizeObserver(() => resize());
      state.observer.observe(root);
    }

    return { resize, draw, disconnect };
  }

  for (let i = 0; i < mapRoots.length; i += 1) {
    const renderer = createRenderer(mapRoots[i]);
    if (renderer) renderers.push(renderer);
  }

  if (!renderers.length) return;

  function renderFrame(now) {
    for (let i = 0; i < renderers.length; i += 1) {
      renderers[i].draw(now);
    }
    rafId = window.requestAnimationFrame(renderFrame);
  }

  function handleWindowResize() {
    for (let i = 0; i < renderers.length; i += 1) {
      renderers[i].resize();
    }
  }

  window.addEventListener("resize", handleWindowResize, { passive: true });

  if (prefersReducedMotion) {
    for (let i = 0; i < renderers.length; i += 1) {
      renderers[i].draw(performance.now());
    }
  } else {
    rafId = window.requestAnimationFrame(renderFrame);
  }

  window.addEventListener("beforeunload", () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
    for (let i = 0; i < renderers.length; i += 1) {
      renderers[i].disconnect();
    }
  });
})();
