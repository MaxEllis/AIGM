import { useState } from 'react';
import { catanRules, findRule } from '../rules/catanRules';

export default function RulesSearchScreen({ onBack }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const match = findRule(query);
    if (match && match.rule) {
      setResults([match.rule]);
    } else {
      // Fallback: show all rules that might be relevant
      const lowerQuery = query.toLowerCase();
      const relevant = catanRules.filter(rule => 
        rule.keywords.some(kw => lowerQuery.includes(kw.toLowerCase())) ||
        rule.title.toLowerCase().includes(lowerQuery)
      );
      setResults(relevant);
    }
  };

  return (
    <div className="rules-search-screen">
      <div className="rules-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h1>Rules Help</h1>
      </div>

      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search Catan rules..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          autoFocus
        />
      </div>

      <div className="results-container">
        {results.length === 0 && searchQuery ? (
          <p className="no-results">No matching rules found. Try different keywords.</p>
        ) : results.length === 0 ? (
          <div className="all-rules">
            <h2>All Rules</h2>
            {catanRules.map(rule => (
              <div key={rule.id} className="rule-card">
                <h3>{rule.title}</h3>
                <p>{rule.answer}</p>
                <span className="rule-source">{rule.source}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="search-results">
            {results.map(rule => (
              <div key={rule.id} className="rule-card">
                <h3>{rule.title}</h3>
                <p>{rule.answer}</p>
                <span className="rule-source">{rule.source}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
