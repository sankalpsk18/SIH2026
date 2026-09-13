// ============================================================================
// ADALAT360 - Search Page
// Permission-filtered semantic and keyword search
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Search,
  Filter,
  Loader2,
  FileText,
  ShieldCheck,
  FolderKanban,
  Clock,
  ChevronDown,
  ChevronUp,
  Highlighter,
  Brain,
  Eye,
  Download,
  ExternalLink,
} from 'lucide-react';
import { searchApi } from '../../services/api';
import { SearchResult, SearchResponse, DocumentType, EvidenceType } from '../../types';
import { toast } from 'react-hot-toast';

const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  caseId: z.string().uuid().optional(),
  documentTypes: z.array(z.enum([
    'FIR', 'INVESTIGATION_RECORD', 'WITNESS_STATEMENT', 'CHARGE_SHEET',
    'COURT_FILING', 'EVIDENCE_RECORD', 'FORENSIC_REPORT', 'LEGAL_NOTICE',
    'JUDGMENT', 'ORDER', 'SUMMONS', 'WARRANT', 'BAIL_APPLICATION',
    'AFFIDAVIT', 'EXHIBIT_LIST', 'SEIZURE_MEMO', 'PANCHNAMA', 'CASE_DIARY', 'OTHER'
  ])).optional(),
  evidenceTypes: z.array(z.enum([
    'DIGITAL', 'PHYSICAL', 'DOCUMENTARY', 'BIOLOGICAL', 'CHEMICAL',
    'FIREARM', 'VEHICLE', 'ELECTRONIC_DEVICE', 'FINANCIAL_RECORD', 'OTHER'
  ])).optional(),
  tags: z.array(z.string()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  authorIds: z.array(z.string().uuid()).optional(),
  entities: z.object({
    persons: z.array(z.string()).optional(),
    organizations: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
  }).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  semanticSearch: z.boolean().default(false),
  highlight: z.boolean().default(true),
});

type SearchFormData = z.infer<typeof searchSchema>;

export function SearchPage() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      page: 1,
      limit: 20,
      semanticSearch: false,
      highlight: true,
    },
  });

  const query = watch('query');
  const semanticSearch = watch('semanticSearch');

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('adalat360_recent_searches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch {}
    }
  }, []);

  // Fetch suggestions
  useEffect(() => {
    if (query.length >= 2) {
      const timer = setTimeout(async () => {
        try {
          const response = await searchApi.suggestions(query);
          setSuggestions(response.data.suggestions || []);
          setShowSuggestions(true);
        } catch {}
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setShowSuggestions(false);
    }
  }, [query]);

  const onSubmit = async (data: SearchFormData) => {
    await performSearch({ ...data, page: 1 });
  };

  const performSearch = useCallback(async (searchData: SearchFormData) => {
    setIsLoading(true);
    try {
      const response = await searchApi.search(searchData);
      const data = response.data as SearchResponse;
      setResults(data.results);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);

      // Save to recent searches
      if (searchData.query) {
        const recent = [searchData.query, ...recentSearches.filter(s => s !== searchData.query)].slice(0, 10);
        setRecentSearches(recent);
        localStorage.setItem('adalat360_recent_searches', JSON.stringify(recent));
      }
    } catch (error: any) {
      toast.error('Search failed: ' + (error.response?.data?.message || 'Unknown error'));
      setResults([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [recentSearches]);

  const handlePageChange = (newPage: number) => {
    const data = watch();
    performSearch({ ...data, page: newPage });
  };

  const clearResults = () => {
    setResults([]);
    setTotal(0);
    setTotalPages(1);
  };

  const resourceTypeIcons: Record<string, React.ReactNode> = {
    DOCUMENT: <FileText className="w-4 h-4" />,
    EVIDENCE: <ShieldCheck className="w-4 h-4" />,
    CASE: <FolderKanban className="w-4 h-4" />,
    CUSTODY_EVENT: <Clock className="w-4 h-4" />,
  };

  const resourceTypeColors: Record<string, string> = {
    DOCUMENT: 'text-blue-600 bg-blue-100',
    EVIDENCE: 'text-purple-600 bg-purple-100',
    CASE: 'text-green-600 bg-green-100',
    CUSTODY_EVENT: 'text-orange-600 bg-orange-100',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Search</h1>
          <p className="text-gray-600 mt-1">Find documents, evidence, cases, and events</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('semanticSearch')}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="flex items-center gap-1 text-sm text-gray-600">
              <Brain className="w-4 h-4" />
              Semantic Search
            </span>
          </label>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="card p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            {...register('query')}
            type="text"
            placeholder="Search for documents, evidence, cases, names, locations, sections..."
            className="input pl-12 pr-12 text-lg"
            autoComplete="off"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => { setValue('query', ''); clearResults(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading || !query}
            className="absolute right-16 top-1/2 -translate-y-1/2 btn-primary"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => { setValue('query', suggestion); setShowSuggestions(false); }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center gap-2"
              >
                <Search className="w-4 h-4 text-gray-400" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-200' : ''}`}
          >
            <Filter className="w-4 h-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {showFilters && (
          <form className="card p-4 mt-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <label className="label">Case ID</label>
                <input {...register('caseId')} type="text" placeholder="Filter by case UUID" className="input" />
              </div>
              <div>
                <label className="label">Document Types</label>
                <select {...register('documentTypes')} className="input" multiple>
                  {Object.values(DocumentType).map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Evidence Types</label>
                <select {...register('evidenceTypes')} className="input" multiple>
                  {Object.values(EvidenceType).map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Date From</label>
                <input {...register('dateFrom')} type="date" className="input" />
              </div>
              <div>
                <label className="label">Date To</label>
                <input {...register('dateTo')} type="date" className="input" />
              </div>
              <div className="lg:col-span-2">
                <label className="label">Entities (Persons)</label>
                <input
                  {...register('entities.persons')}
                  type="text"
                  placeholder="Comma-separated person names"
                  className="input"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="label">Entities (Organizations)</label>
                <input
                  {...register('entities.organizations')}
                  type="text"
                  placeholder="Comma-separated organization names"
                  className="input"
                />
              </div>
              <div className="lg:col-span-1">
                <label className="label">Tags</label>
                <input
                  {...register('tags')}
                  type="text"
                  placeholder="Comma-separated tags"
                  className="input"
                />
              </div>
              <div className="flex items-end lg:col-span-1">
                <button type="submit" className="btn-primary w-full">
                  <Search className="w-4 h-4 mr-2" />
                  Apply Filters
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Results */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {total > 0 ? `Found ${total} result${total !== 1 ? 's' : ''} in ${isLoading ? '...' : '0ms'}` : 'No results'}
              </span>
              {results.length > 0 && (
                <select
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); performSearch({ ...watch(), limit: Number(e.target.value), page: 1 }); }}
                  className="input w-auto"
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              )}
            </div>
          </div>

          {isLoading && results.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
              <p className="text-gray-500 mb-4">Try adjusting your search query or filters</p>
              <button onClick={() => { setValue('query', ''); clearResults(); }} className="btn-secondary">
                Clear Search
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {results.map((result, index) => (
                  <SearchResultCard
                    key={`${result.resourceId}-${index}`}
                    result={result}
                    index={index + 1 + (page - 1) * limit}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-gray-200">
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages} — {total} total results
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => performSearch({ ...watch(), page: page - 1 })}
                      disabled={page === 1}
                      className="btn-secondary btn-sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => performSearch({ ...watch(), page: page + 1 })}
                      disabled={page === totalPages}
                      className="btn-secondary btn-sm"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  );
}

function SearchResultCard({ result, index }: { result: SearchResult; index: number }) {
  const resourceTypeColors: Record<string, string> = {
    DOCUMENT: 'text-blue-600 bg-blue-100',
    EVIDENCE: 'text-purple-600 bg-purple-100',
    CASE: 'text-green-600 bg-green-100',
    CUSTODY_EVENT: 'text-orange-600 bg-orange-100',
  };

  const resourceTypeIcons: Record<string, React.ReactNode> = {
    DOCUMENT: <FileText className="w-4 h-4" />,
    EVIDENCE: <ShieldCheck className="w-4 h-4" />,
    CASE: <FolderKanban className="w-4 h-4" />,
    CUSTODY_EVENT: <Clock className="w-4 h-4" />,
  };

  const getResourceUrl = (result: SearchResult) => {
    switch (result.resourceType) {
      case 'DOCUMENT': return `/documents/${result.resourceId}`;
      case 'EVIDENCE': return `/evidence/${result.resourceId}`;
      case 'CASE': return `/cases/${result.resourceId}`;
      case 'CUSTODY_EVENT': return `/blockchain/events/${result.resourceId}`;
      default: return '#';
    }
  };

  return (
    <a
      href={getResourceUrl(result)}
      className="card-hover p-4 flex items-start gap-4 group"
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${result.resourceType in {DOCUMENT:1,EVIDENCE:1,CASE:1,CUSTODY_EVENT:1} ? '' : 'bg-gray-100'} ${result.resourceType in {DOCUMENT:1} ? 'bg-blue-100' : result.resourceType in {EVIDENCE:1} ? 'bg-purple-100' : result.resourceType in {CASE:1} ? 'bg-green-100' : result.resourceType in {CUSTODY_EVENT:1} ? 'bg-orange-100' : 'bg-gray-100'}`}>
        <span className={`text-blue-600`} style={{ color: result.resourceType === 'DOCUMENT' ? '#2563eb' : result.resourceType === 'EVIDENCE' ? '#9333ea' : result.resourceType === 'CASE' ? '#16a34a' : result.resourceType === 'CUSTODY_EVENT' ? '#ea580c' : '#64746b' }}>
          {result.resourceType === 'DOCUMENT' && <FileText className="w-5 h-5" />}
          {result.resourceType === 'EVIDENCE' && <ShieldCheck className="w-5 h-5" />}
          {result.resourceType === 'CASE' && <FolderKanban className="w-5 h-5" />}
          {result.resourceType === 'CUSTODY_EVENT' && <Clock className="w-5 h-5" />}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-gray-900 group-hover:text-primary-600 truncate pr-4">
            {result.title}
          </h4>
          <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeBadgeColor(result.resourceType)} flex-shrink-0`}>
            {result.resourceType.replace('_', ' ')}
          </span>
        </div>

        {result.snippet && (
          <p className="mt-2 text-sm text-gray-600 line-clamp-2">
            {renderHighlights(result.snippet, result.highlights)}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <FolderKanban className="w-3 h-3" />
            {result.metadata.caseId?.slice(0, 8)}...
          </span>
          {result.metadata.documentType && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {result.metadata.documentType}
            </span>
          )}
          {result.metadata.evidenceType && (
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              {result.metadata.evidenceType}
            </span>
          )}
          {result.metadata.tags?.length && (
            <span className="flex items-center gap-1">
              {result.metadata.tags.slice(0, 3).map(tag => (
                <span key={tag} className="badge-secondary text-xs">{tag}</span>
              ))}
            </span>
          )}
        </div>

        {Object.keys(result.highlights).length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Matched terms:</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(result.highlights).flatMap(([field, matches]) =>
                matches.map(match => (
                  <span key={`${field}-${match}`} className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded">
                    {field}: {match}
                  </span>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </a>
  );
}

function renderHighlights(text: string, highlights: Record<string, string[]>): React.ReactNode {
  if (!text) return null;
  // Simple implementation - in production, use a proper highlighter
  return text.substring(0, 300) + (text.length > 300 ? '...' : '');
}

function getTypeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    DOCUMENT: 'bg-blue-100 text-blue-800',
    EVIDENCE: 'bg-purple-100 text-purple-800',
    CASE: 'bg-green-100 text-green-800',
    CUSTODY_EVENT: 'bg-orange-100 text-orange-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
}