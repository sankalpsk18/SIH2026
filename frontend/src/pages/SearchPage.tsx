import React, { useState, useEffect } from 'react';
import { Search, Filter, Loader2, FileText, ShieldCheck, FolderKanban, Clock, Brain, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { searchApi } from '../services/api';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.suggestions(query);
        setSuggestions(res.data?.suggestions || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await searchApi.search({ query, page: 1, limit: 20 });
      setResults(response.data?.results || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Search</h1>
          <p className="text-gray-600 mt-1">Find documents, evidence, cases, and events</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 text-primary-600 border-gray-300 rounded" />
          <span className="flex items-center gap-1 text-sm text-gray-600"><Brain className="w-4 h-4" />Semantic Search</span>
        </label>
      </div>

      <form onSubmit={onSubmit} className="card p-6 relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="text" placeholder="Search for documents, evidence, cases..." className="input pl-12 pr-12 text-lg" autoComplete="off" autoFocus />
          {query && <button type="button" onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>}
          <button type="submit" disabled={isLoading || !query.trim()} className="absolute right-16 top-1/2 -translate-y-1/2 btn-primary">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}</button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => { setQuery(suggestion); setShowSuggestions(false); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <button type="button" onClick={() => setShowFilters((v) => !v)} className={`btn-secondary ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-200' : ''}`}>
            <Filter className="w-4 h-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {showFilters && (
          <div className="card p-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="label">Case ID</label><input className="input" placeholder="Filter by case UUID" /></div>
              <div><label className="label">Document Type</label><select className="input"><option value="">Any</option><option value="FIR">FIR</option></select></div>
              <div><label className="label">Evidence Type</label><select className="input"><option value="">Any</option><option value="DIGITAL">Digital</option></select></div>
            </div>
          </div>
        )}
      </form>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-10 h-10 animate-spin text-primary-600" /></div>
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-500 mb-4">Try a different search term or filter.</p>
          </div>
        ) : (
          <>
            {results.map((result, index) => (
              <div key={`${result.resourceId || index}`} className="card p-4 flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  {result.resourceType === 'DOCUMENT' ? <FileText className="w-5 h-5 text-blue-600" /> : result.resourceType === 'EVIDENCE' ? <ShieldCheck className="w-5 h-5 text-purple-600" /> : result.resourceType === 'CASE' ? <FolderKanban className="w-5 h-5 text-green-600" /> : <Clock className="w-5 h-5 text-orange-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-gray-900">{result.title || result.name || 'Search result'}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{result.resourceType || 'RESULT'}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{result.snippet || 'No preview available.'}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <span className="text-sm text-gray-600">Page 1</span>
              <div className="flex gap-2">
                <button className="btn-secondary btn-sm" disabled><ChevronLeft className="w-4 h-4" /></button>
                <button className="btn-secondary btn-sm" disabled><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
