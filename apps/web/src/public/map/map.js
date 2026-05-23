(async function () {
  const data = window.__realmMapData;
  if (!data?.territories) return;

  const mount = document.getElementById('realm-map');
  const panel = document.getElementById('map-detail');
  if (!mount || !panel) return;

  const url = mount.dataset.svgUrl || '/public/map/westeros.svg';
  try {
    const res = await fetch(url);
    mount.innerHTML = await res.text();
  } catch {
    mount.textContent = 'Could not load map.';
    return;
  }

  const svg = mount.querySelector('svg');
  if (!svg) return;

  const byId = Object.fromEntries(data.territories.map((t) => [t.id, t]));

  function ownerClass(t) {
    const c = t.control;
    if (!c) return 'owner-neutral';
    if (c.owner_type === 'guild') return 'owner-guild';
    if (c.owner_type === 'faction') return `owner-faction-${c.owner_id}`;
    return 'owner-neutral';
  }

  function paint() {
    for (const t of data.territories) {
      const el = svg.querySelector(`#${t.svg_path_id || t.id}`);
      if (!el) continue;
      el.classList.remove(
        ...Array.from(el.classList).filter((c) => c.startsWith('owner-'))
      );
      el.classList.add(ownerClass(t));
    }
  }

  function showDetail(id) {
    const t = byId[id];
    if (!t) return;
    svg.querySelectorAll('circle.selected').forEach((c) => c.classList.remove('selected'));
    const el = svg.querySelector(`#${t.svg_path_id || t.id}`);
    if (el) el.classList.add('selected');

    const siege = t.active_siege
      ? `<p class="meta">Siege in progress (${t.active_siege.progress}/100)</p>`
      : '';
    panel.innerHTML = `
      <h2>${t.display_name}</h2>
      <p class="meta">Resource: <strong>${t.resource_type}</strong> · ${t.base_yield_per_hour}/hr</p>
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

  paint();
  svg.querySelectorAll('#regions circle').forEach((el) => {
    el.addEventListener('click', () => showDetail(el.id));
  });

  const first = data.territories[0];
  if (first) showDetail(first.id);
})();
