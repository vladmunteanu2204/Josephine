// Resolve a trek stage's overnight hut to a live rifugio record (by name,
// since stages link by name not id), falling back to the stage's embedded
// snapshot when there's no match. Booking requires a real rifugio_id.

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function stageHutName(stage) {
  return (
    stage?.overnight_rifugio_name ||
    stage?.sleep?.rifugio_name ||
    stage?.overnight_rifugio_details?.name ||
    null
  );
}

export function resolveHut(stage, rifugios = []) {
  const name = stageHutName(stage);
  if (!name) return null; // valley exit / no overnight

  const target = norm(name);
  const match =
    rifugios.find(r => norm(r.name) === target) ||
    rifugios.find(r => norm(r.name) && (norm(r.name).includes(target) || target.includes(norm(r.name))));

  if (match) {
    return {
      name: match.name,
      rifugio_id: match.id,
      contact: match.contact?.phone || match.contact?.email || '',
      beds: match.facilities?.beds ?? null,
      altitude: match.altitude ?? null,
      source: 'matched',
    };
  }

  const d = stage.overnight_rifugio_details || {};
  return {
    name,
    rifugio_id: null,
    contact: d.contact || '',
    beds: d.beds ?? null,
    altitude: d.altitude ?? null,
    source: 'snapshot',
  };
}
