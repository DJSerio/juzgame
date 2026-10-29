// generado desde data/words.json: índice de palabra → palo
const RUNS: [number, string, string][] = [[0, "Lore del grupo", "🔥"], [34, "Pueblos, fiestas y tierra", "🏘️"], [53, "Fútbol y deporte", "⚽"], [83, "Música urbana y famosos", "🎤"], [122, "Política", "🏛️"], [141, "Historia", "📜"], [156, "Series, juegos e internet", "📺"], [187, "Comida y bebida", "🍽️"], [248, "Personajes cotidianos", "🧍"], [270, "Animales", "🐾"], [318, "Cosas, lugares y momentos", "🧳"], [361, "Conceptos", "💭"], [420, "Personajes de la historia", "👑"], [453, "Famosos de siempre", "⭐"], [486, "Ficción y dibujos", "🦸"], [526, "Cosas de casa y objetos", "🏠"], [570, "Profesiones y gente", "💼"], [610, "Lugares", "🗺️"], [666, "Tecnología y vida moderna", "📱"], [704, "Actividades y momentos", "🎉"], [743, "Del juego original", "🍎"]];
export function suitOf(id?: number): { c: string; s: string } {
  if (id === undefined || id === null) return { c: 'Escrita por un jugador', s: '✍️' };
  let r = RUNS[0];
  for (const x of RUNS) { if (x[0] <= id) r = x; else break; }
  return { c: r[1], s: r[2] };
}
