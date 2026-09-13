// ============================================================================
// ADALAT360 - Entity Graph Page
// Entity relationship graph visualization
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Users,
  Building,
  MapPin,
  Calendar,
  Scale,
  FileText,
  Shield,
  Link,
  Unlink,
  Settings,
  Eye,
  EyeOff,
  Target,
  Share2,
} from 'lucide-react';
import { entityGraphApi } from '../../services/api';
import { EntityGraph, EntityNode, EntityEdge } from '../../types';
import { toast } from 'react-hot-toast';

export function EntityGraphPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [graph, setGraph] = useState<EntityGraph | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [centralEntities, setCentralEntities] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<EntityNode | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    entityTypes: [] as string[],
    minWeight: 1,
    maxDepth: 3,
    includeDocuments: true,
    includeEvidence: true,
  });
  const [viewMode, setViewMode] = useState<'graph' | 'table' | 'central' | 'communities'>('graph');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (caseId) {
      loadGraph();
      loadCentralEntities();
      loadCommunities();
    }
  }, [caseId, filters]);

  const loadGraph = async () => {
    setIsLoading(true);
    try {
      const response = await entityGraphApi.getGraph(caseId!, filters);
      setGraph(response.data);
    } catch (error: any) {
      toast.error('Failed to load entity graph');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCentralEntities = async () => {
    try {
      const response = await entityGraphApi.getCentralEntities(caseId!, 15);
      setCentralEntities(response.data.centralEntities);
    } catch (error) {
      // Ignore
    }
  };

  const loadCommunities = async () => {
    try {
      const response = await entityGraphApi.getCommunities(caseId!);
      setCommunities(response.data.communities);
    } catch (error) {
      // Ignore
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    if (!graph) return;
    const data = JSON.stringify(graph, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entity-graph-${caseId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Graph exported');
  };

  const findPath = async (source: string, target: string) => {
    try {
      const response = await entityGraphApi.findPath(caseId!, source, target);
      // Highlight path in graph view
      toast.success(`Path found: ${response.data.path?.length} steps`);
    } catch (error) {
      toast.error('No path found between entities');
    }
  };

  if (!caseId) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-gray-900">No case selected</h2>
      </div>
    );
  }

  const nodeColors: Record<string, string> = {
    PERSON: 'bg-blue-500',
    ORGANIZATION: 'bg-green-500',
    LOCATION: 'bg-orange-500',
    DATE: 'bg-gray-500',
    LEGAL_REFERENCE: 'bg-purple-500',
    DOCUMENT: 'bg-indigo-500',
    EVIDENCE: 'bg-red-500',
  };

  const nodeIcons: Record<string, React.ReactNode> = {
    PERSON: <Users className="w-4 h-4" />,
    ORGANIZATION: <Building className="w-4 h-4" />,
    LOCATION: <MapPin className="w-4 h-4" />,
    DATE: <Calendar className="w-4 h-4" />,
    LEGAL_REFERENCE: <Scale className="w-4 h-4" />,
    DOCUMENT: <FileText className="w-4 h-4" />,
    EVIDENCE: <Shield className="w-4 h-4" />,
  };

  if (!caseId) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-gray-900">No case selected</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entity Graph</h1>
          <p className="text-gray-600 mt-1">Explore relationships between people, organizations, locations, and legal references</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </button>
          <button onClick={loadGraph} disabled={isLoading} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Nodes" value={graph?.statistics.nodeCount || 0} icon={<Target className="w-5 h-5" />} color="blue" />
        <StatCard title="Edges" value={graph?.statistics.edgeCount || 0} icon={<Link className="w-5 h-5" />} color="green" />
        <StatCard title="Entity Types" value={Object.keys(graph?.statistics.byType || {}).length} icon={<Tag className="w-5 h-5" />} color="purple" />
        <StatCard title="Communities" value={communities.length} icon={<Users className="w-5 h-5" />} color="orange" />
      </div>

      {/* Filters & Controls */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('graph')}
              className={`btn-secondary ${viewMode === 'graph' ? 'bg-primary-50 text-primary-700 border-primary-200' : ''}`}
            >
              Graph
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`btn-secondary ${viewMode === 'table' ? 'bg-primary-50 text-primary-700 border-primary-200' : ''}`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('central')}
              className={`btn-secondary ${viewMode === 'central' ? 'bg-primary-50 text-primary-700 border-primary-200' : ''}`}
            >
              Central Entities
            </button>
            <button
              onClick={() => setViewMode('communities')}
              className={`btn-secondary ${viewMode === 'communities' ? 'bg-primary-50 text-primary-700 border-primary-200' : ''}`}
            >
              Communities
            </button>
            <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-200' : ''}`}>
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="label">Entity Types</label>
              <select multiple value={filters.entityTypes} onChange={(e) => handleFilterChange('entityTypes', Array.from(e.target.selectedOptions).map(o => o.value))} className="input">
                {['PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'LEGAL_REFERENCE', 'DOCUMENT', 'EVIDENCE'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Min Weight</label>
              <input type="number" min="1" value={filters.minWeight} onChange={(e) => handleFilterChange('minWeight', parseInt(e.target.value))} className="input" />
            </div>
            <div>
              <label className="label">Max Depth</label>
              <input type="number" min="1" max="10" value={filters.maxDepth} onChange={(e) => handleFilterChange('maxDepth', parseInt(e.target.value))} className="input" />
            </div>
            <div>
              <label className="label">Include Documents</label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input type="checkbox" checked={filters.includeDocuments} onChange={(e) => handleFilterChange('includeDocuments', e.target.checked)} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                <span className="text-sm text-gray-600">Documents</span>
              </label>
            </div>
            <div>
              <label className="label">Include Evidence</label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input type="checkbox" checked={filters.includeEvidence} onChange={(e) => handleFilterChange('includeEvidence', e.target.checked)} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                <span className="text-sm text-gray-600">Evidence</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Content Views */}
      <div className="card">
        {isLoading && !graph ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          </div>
        ) : viewMode === 'graph' && graph ? (
          <GraphVisualization graph={graph} selectedNode={selectedNode} onNodeClick={setSelectedNode} searchQuery={searchQuery} nodeColors={nodeColors} nodeIcons={nodeIcons} />
        ) : viewMode === 'table' && graph ? (
          <EntityTableView graph={graph} searchQuery={searchQuery} nodeColors={nodeColors} nodeIcons={nodeIcons} onRowClick={setSelectedNode} />
        ) : viewMode === 'central' ? (
          <CentralEntitiesView entities={centralEntities} nodeColors={nodeColors} nodeIcons={nodeIcons} />
        ) : viewMode === 'communities' ? (
          <CommunitiesView communities={communities} nodeColors={nodeColors} nodeIcons={nodeIcons} />
        ) : null
      </div>

      {/* Node Detail Panel */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedNode(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slide-in">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${nodeColors[selectedNode.type] || 'bg-gray-500'}`}>
                  {nodeIcons[selectedNode.type] || <Tag className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedNode.label}</h3>
                  <p className="text-sm text-gray-500 capitalize">{selectedNode.type.toLowerCase().replace(/_/g, ' ')}</p>
                </div>
              </div>
              <button onClick={() => setSelectedNode(null)} className="p-2 text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Properties</h4>
                  <dl className="space-y-2 text-sm">
                    {Object.entries(selectedNode.properties).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <dt className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</dt>
                        <dd className="font-medium text-gray-900">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {graph && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Connections</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {graph.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).slice(0, 10).map((edge, i) => {
                        const otherNode = graph.nodes.find(n => n.id === (edge.source === selectedNode.id ? edge.target : edge.source));
                        return otherNode ? (
                          <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded flex items-center justify-center ${nodeColors[otherNode.type] || 'bg-gray-500'}`}>
                                {nodeIcons[otherNode.type] || <Tag className="w-3 h-3 text-white" />}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{otherNode.label}</p>
                                <p className="text-xs text-gray-500 capitalize">{otherNode.type.toLowerCase()}</p>
                              </div>
                            </div>
                            <span className="badge badge-gray text-xs">{edge.relationship} (w: {edge.weight})</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GraphVisualization({ graph, selectedNode, onNodeClick, searchQuery, nodeColors, nodeIcons }: any) {
  // Simple force-directed graph visualization using CSS
  // In production, use D3.js or Cytoscape.js
  const nodes = graph.nodes.filter(n => !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase()));
  const edges = graph.edges.filter(e =>
    nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target)
  );

  return (
    <div className="relative h-[600px] bg-gray-50 rounded-lg overflow-hidden">
      {/* Simple force-directed layout simulation */}
      <svg className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        {edges.map((edge, i) => {
          const source = nodes.find(n => n.id === edge.source);
          const target = nodes.find(n => n.id === edge.target);
          if (!source || !target) return null;
          // Simple positioning - in production use force layout
          const sx = (source.id.charCodeAt(0) % 800) + 50;
          const sy = (source.id.charCodeAt(1) % 500) + 50;
          const tx = (target.id.charCodeAt(0) % 800) + 50;
          const ty = (target.id.charCodeAt(1) % 500) + 50;
          return (
            <line
              key={i}
              x1={sx} y1={sy}
              x2={tx} y2={ty}
              stroke="#cbd5e1"
              strokeWidth={Math.max(1, edge.weight / 2)}
              strokeDasharray="5,5"
            />
          );
        })}
      </svg>
      <div className="relative h-full p-4" style={{ pointerEvents: 'auto' }}>
        {graph.nodes.filter(n => !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase())).map((node, i) => {
          const x = (node.id.charCodeAt(0) % 750) + 50;
          const y = (node.id.charCodeAt(1) % 450) + 50;
          const isSelected = selectedNode?.id === node.id;
          return (
            <div
              key={node.id}
              onClick={() => onNodeClick(node)}
              className={`absolute cursor-pointer transition-all duration-200 ${isSelected ? 'ring-2 ring-primary-500 ring-offset-2' : ''}`}
              style={{ left: x, top: y, zIndex: isSelected ? 10 : 1 }}
            >
              <div className={`w-24 h-24 rounded-lg flex flex-col items-center justify-center ${nodeColors[node.type] || 'bg-gray-500'} text-white shadow-lg`}>
                <div className="text-2xl">{nodeIcons[node.type] || <Tag className="w-6 h-6" />}</div>
                <span className="text-xs font-medium truncate w-full text-center">{node.label}</span>
                <span className="text-[10px] text-white/70 capitalize">{node.type.toLowerCase()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EntityTableView({ graph, searchQuery, nodeColors, nodeIcons, onRowClick }: any) {
  const nodes = graph.nodes.filter(n => !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Entity</th>
            <th>Type</th>
            <th>Properties</th>
            <th>Connections</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node, i) => (
            <tr key={node.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onRowClick(node)}>
              <td className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${nodeColors[node.type] || 'bg-gray-500'}`}>
                  {nodeIcons[node.type] || <Tag className="w-4 h-4 text-white" />}
                </div>
                <span className="font-medium text-gray-900">{node.label}</span>
              </td>
              <td>
                <span className={`badge ${nodeColors[node.type]?.replace('bg-', 'badge-') || 'badge-gray'}`}>
                  {node.type}
                </span>
              </td>
              <td className="max-w-xs truncate text-gray-600 text-sm">
                {Object.entries(node.properties).map(([k, v]) => `${k}: ${v}`).join(', ')}
              </td>
              <td className="text-gray-500">
                {graph.edges.filter(e => e.source === node.id || e.target === node.id).length} connections
              </td>
              <td>
                <button onClick={(e) => { e.stopPropagation(); onRowClick(node); }} className="p-1 text-gray-400 hover:text-primary-600">
                  <Eye className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CentralEntitiesView({ entities, nodeColors, nodeIcons }: any) {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Connected Entities (Degree Centrality)</h3>
      <div className="space-y-3">
        {entities.map((item, i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${nodeColors[item.entity.type] || 'bg-gray-500'}`}>
              {nodeIcons[item.entity.type] || <Tag className="w-5 h-5 text-white" />}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{item.entity.label}</p>
              <p className="text-sm text-gray-500 capitalize">{item.entity.type.toLowerCase()}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-600">{item.centrality}</p>
              <p className="text-xs text-gray-500">connections</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommunitiesView({ communities, nodeColors, nodeIcons }: any) {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Entity Communities ({communities.length})</h3>
      <div className="space-y-4">
        {communities.map((community, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h4 className="font-medium text-gray-900">Community {i + 1} ({community.length} entities)</h4>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {community.slice(0, 20).map((node, j) => (
                <span key={j} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm">
                  <span className={`w-2 h-2 rounded-full ${nodeColors[node.type] || 'bg-gray-500'}`} />
                  {node.label}
                </span>
              ))}
              {community.length > 20 && <span className="text-sm text-gray-500">+{community.length - 20} more</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color] || colorClasses.blue}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}