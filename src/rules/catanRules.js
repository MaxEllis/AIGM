// Catan rules data
export const catanRules = [
  {
    id: 1,
    title: "Initial Settlement Placement",
    keywords: ["initial", "settlement", "placement", "starting", "beginning", "first"],
    answer: "Players take turns placing one settlement and one road. The first player places two settlements and two roads, then the last player does the same in reverse order. Settlements must be at least two roads apart from other settlements.",
    source: "Catan Rulebook - Setup"
  },
  {
    id: 2,
    title: "Resource Production",
    keywords: ["resource", "production", "roll", "dice", "number", "generate"],
    answer: "On each turn, roll two dice. All hexes with the rolled number produce resources for adjacent settlements and cities. Cities produce two resources, settlements produce one.",
    source: "Catan Rulebook - Turn Sequence"
  },
  {
    id: 3,
    title: "Trading",
    keywords: ["trade", "trading", "exchange", "port", "harbor", "maritime"],
    answer: "Players can trade resources with other players or use ports. Ports allow trading 2:1 or 3:1 depending on the port type. General trading is 4:1 with the bank.",
    source: "Catan Rulebook - Trading"
  },
  {
    id: 4,
    title: "Building Roads",
    keywords: ["road", "building", "construct", "brick", "wood", "lumber"],
    answer: "Roads cost one brick and one wood. They connect settlements and cities. The longest road of five or more segments earns two victory points.",
    source: "Catan Rulebook - Building"
  },
  {
    id: 5,
    title: "Robber and 7",
    keywords: ["robber", "seven", "7", "steal", "knight", "block"],
    answer: "When a 7 is rolled, the active player moves the robber to any hex, blocking resource production there. They may steal one resource from a player with a settlement or city on that hex.",
    source: "Catan Rulebook - Special Rolls"
  },
  {
    id: 6,
    title: "Development Cards",
    keywords: ["development", "card", "knight", "victory", "progress"],
    answer: "Development cards cost one sheep, one wheat, and one ore. They can be knights, progress cards, or victory point cards. Play them on your turn, except victory points which are revealed at game end.",
    source: "Catan Rulebook - Development Cards"
  },
  {
    id: 7,
    title: "Victory Points",
    keywords: ["victory", "point", "win", "winning", "points", "score"],
    answer: "The first player to reach 10 victory points wins. Points come from settlements, cities, longest road, largest army, and victory point development cards.",
    source: "Catan Rulebook - Winning"
  }
];

// Simple keyword matching function
export function findRule(query) {
  const lowerQuery = query.toLowerCase();
  const matches = catanRules.map(rule => {
    const keywordMatches = rule.keywords.filter(keyword => 
      lowerQuery.includes(keyword.toLowerCase())
    ).length;
    const titleMatch = lowerQuery.includes(rule.title.toLowerCase()) ? 2 : 0;
    const confidence = (keywordMatches * 0.5) + titleMatch;
    
    return { rule, confidence };
  }).filter(match => match.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);
  
  return matches.length > 0 ? matches[0] : null;
}
