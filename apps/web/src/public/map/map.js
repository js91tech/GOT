(async function () {
  const data = window.__realmMapData;
  if (!data?.territories) return;

  const mount = document.getElementById('realm-map');
  const overviewMount = document.getElementById('realm-map-overview');
  const panel = document.getElementById('map-detail');
  if (!mount || !panel) return;

  const imageUrl = mount.dataset.mapUrl || '/public/map/realm-world.png';
  const byId = Object.fromEntries(data.territories.map((t) => [t.id, t]));

  let hotspots;
  try {
    const res = await fetch('/public/map/map-hotspots.json');
    hotspots = await res.json();
  } catch {
    mount.textContent = 'Could not load map.';
    return;
  }

  const { width, height, regions } = hotspots;

  function ownerClass(t) {
    const c = t.control;
    if (!c) return 'owner-neutral';
    if (c.owner_type === 'guild') return 'owner-guild';
    if (c.owner_type === 'faction') return `owner-faction-${c.owner_id}`;
    return 'owner-neutral';
  }

  function buildStage(container, interactive) {
    container.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'realm-map-stage';
    stage.style.aspectRatio = `${width} / ${height}`;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = 'The Realm — a world of lost tales';
    img.className = 'realm-map-image';
    img.width = width;
    img.height = height;
    img.loading = 'eager';
    stage.appendChild(img);

    if (interactive) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('class', 'realm-map-hotspots');
      svg.setAttribute('aria-hidden', 'true');

      for (const spot of regions) {
        const t = byId[spot.id];
        if (!t) continue;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', spot.id);
        g.setAttribute('class', `map-hotspot ${ownerClass(t)}`);
        g.dataset.id = spot.id;

        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', spot.cx);
        ring.setAttribute('cy', spot.cy);
        ring.setAttribute('r', spot.r);
        ring.setAttribute('class', 'hotspot-ring');

        const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hit.setAttribute('cx', spot.cx);
        hit.setAttribute('cy', spot.cy);
        hit.setAttribute('r', spot.r);
        hit.setAttribute('class', 'hotspot-hit');

        g.appendChild(ring);
        g.appendChild(hit);
        svg.appendChild(g);
      }
      stage.appendChild(svg);
    }

    container.appendChild(stage);
    return stage;
  }

  function territoryDetailHtml(t) {
    const siege = t.active_siege
      ? `<p class="meta">Siege in progress (${t.active_siege.progress}/100)</p>`
      : '';
    const crest =
      t.control?.owner_type === 'faction'
        ? `<img class="map-crest" src="/public/assets/crests/${t.control.owner_id}.svg" alt="" width="40" height="40" />`
        : '';
    const spot = regions.find((r) => r.id === t.id);
    const subtitle = spot?.subtitle ? `<p class="meta map-subtitle">${spot.subtitle}</p>` : '';
    return `
      ${crest}
      <h2>${t.display_name}</h2>
      ${subtitle}
      <p class="meta">Resource: <strong>${t.resource_type}</strong> · ${t.base_yield_per_hour}/hr base yield</p>
      <p class="meta">Holder: ${t.owner_label}</p>
      ${siege}
      <div class="map-actions">
        ${
          data.player?.guild_id
            ? `<form method="post" action="/map/siege"><input type="hidden" name="territory_id" value="${t.id}" /><button type="submit" class="btn-stone">Declare siege</button></form>
        <form method="post" action="/map/reinforce"><button type="submit" class="btn-wood">Reinforce siege</button></form>`
            : '<p class="meta">Join a guild to wage war.</p>'
        }
      </div>`;
  }

  function allLandsHtml() {
    const rows = data.territories
      .map((t) => {
        const spot = regions.find((r) => r.id === t.id);
        const sub = spot?.subtitle ? ` · ${spot.subtitle}` : '';
        return `<li><strong>${t.display_name}</strong>${sub}<br><span class="meta">${t.resource_type} · ${t.base_yield_per_hour}/hr · ${t.owner_label}</span></li>`;
      })
      .join('');
    return `<h2>All lands &amp; resources</h2><ul class="map-legend-list">${rows}</ul>`;
  }

  function showDetail(id) {
    const t = byId[id];
    if (!t) return;
    mount.querySelectorAll('.map-hotspot.selected').forEach((el) => el.classList.remove('selected'));
    const el = mount.querySelector(`#${CSS.escape(id)}`);
    if (el) el.classList.add('selected');
    panel.innerHTML = territoryDetailHtml(t);
    panel.hidden = false;
  }

  buildStage(mount, true);
  if (overviewMount) {
    buildStage(overviewMount, false);
  }

  mount.querySelectorAll('.map-hotspot').forEach((el) => {
    el.addEventListener('click', () => showDetail(el.dataset.id));
  });

  const first = data.territories[0];
  if (first) showDetail(first.id);

  document.querySelectorAll('.map-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      document.querySelectorAll('.map-tab').forEach((b) => b.classList.toggle('active', b === btn));
      const interactive = document.getElementById('realm-map');
      const overview = document.getElementById('realm-map-overview');
      if (interactive) interactive.hidden = view !== 'interactive';
      if (overview) overview.hidden = view !== 'overview';
      if (view === 'overview') {
        panel.innerHTML = allLandsHtml();
        panel.hidden = false;
      } else if (first) {
        showDetail(first.id);
      }
    });
  });
})();
