import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Link, Search, Target, Users, Globe, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Filter, Settings } from 'lucide-react';
import { casesApi, entityGraphApi } from '../services/api';
import { Case } from '../types';

interface EntityNode {
  id: string;
  label: string;
  type: 'person' | 'organization' | 'location' | 'evidence' | 'document' | 'case';
  x: number;
  y: number;
  color: string;
}

interface EntityEdge {
  source: string;
  target: string;
  label: string;
}

export function EntityGraphPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseId || '');
  const [isLoadingCases, setIsLoadingCases] = useState(!caseId);
  const [nodes, setNodes] = useState<EntityNode[]>([]);
  const [edges, setEdges] = useState<EntityEdge[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [graphData, setGraphData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'network' | 'table'>('network');
  const [selectedNode, setSelectedNode] = useState<EntityNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Color scheme for node types
  const nodeColors = {
    person: '#3B82F6',
    organization: '#8B5CF6',
    location: '#10B981',
    evidence: '#F59E0B',
    document: '#EC4899',
    case: '#6366F1',
  };

  // Load user's accessible cases
  useEffect(() => {
    const loadCases = async () => {
      if (isLoadingCases) {
        try {
          const res = await casesApi.list({ limit: 100, sort_by: 'created_at', sort_order: 'desc' });
          setCases(res.data.cases || []);
          if (!selectedCaseId && res.data.cases?.length > 0) {
            setSelectedCaseId(res.data.cases[0].id);
            navigate(`/entity-graph/${res.data.cases[0].id}`);
          }
        } catch (error) {
          console.error('Failed to load cases:', error);
        } finally {
          setIsLoadingCases(false);
        }
      }
    };
    loadCases();
  }, [isLoadingCases]);

  // Load entity graph when caseId changes
  useEffect(() => {
    if (!selectedCaseId) return;
    loadGraph();
  }, [selectedCaseId]);

  const loadGraph = async () => {
    if (!selectedCaseId) return;
    setIsLoadingGraph(true);
    try {
      // Try to fetch from API, fallback to mock data
      let data;
      try {
        const res = await entityGraphApi.getGraph(selectedCaseId, { includeDocuments: true, includeEvidence: true });
        data = res.data;
      } catch (e) {
        // Generate mock graph data for demo
        data = generateMockGraphData(selectedCaseId);
      }

      if (data?.nodes && data?.edges) {
        setNodes(data.nodes.map((n: any) => ({
          ...n,
          color: n.color || nodeColors[n.type as keyof typeof nodeColors] || '#6B7280',
          x: n.x || Math.random() * 800,
          y: n.y || Math.random() * 500,
        })));
        setEdges(data.edges);
      }
      setGraphData(data);
    } catch (error) {
      console.error('Failed to load entity graph:', error);
    } finally {
      setIsLoadingGraph(false);
    }
  };

  const generateMockGraphData = (caseId: string) => {
    const mockNodes: EntityNode[] = [
      { id: 'case-1', label: 'Case FIR/2024/DEL/001234', type: 'case', x: 400, y: 100, color: nodeColors.case },
      { id: 'person-1', label: 'Amit Verma', type: 'person', x: 200, y: 250, color: nodeColors.person },
      { id: 'person-2', label: 'Priya Sharma', type: 'person', x: 600, y: 250, color: nodeColors.person },
      { id: 'person-3', label: 'Rajesh Kumar', type: 'person', x: 400, y: 400, color: nodeColors.person },
      { id: 'org-1', label: 'MediCore Labs', type: 'organization', x: 100, y: 350, color: nodeColors.organization },
      { id: 'org-2', label: 'Delhi Police', type: 'organization', x: 700, y: 350, color: nodeColors.organization },
      { id: 'loc-1', label: 'Saket, Delhi', type: 'location', x: 300, y: 500, color: nodeColors.location },
      { id: 'evi-1', label: 'EVD-104 (Mobile Phone)', type: 'evidence', x: 500, y: 500, color: nodeColors.evidence },
      { id: 'doc-1', label: 'FIR Document', type: 'document', x: 400, y: 50, color: nodeColors.document },
    ];

    const mockEdges: EntityEdge[] = [
      { source: 'case-1', target: 'person-1', label: 'Investigator' },
      { source: 'case-1', target: 'person-2', label: 'Prosecutor' },
      { source: 'case-1', target: 'person-3', label: 'Witness' },
      { source: 'case-1', target: 'org-1', label: 'Forensic Lab' },
      { source: 'case-1', target: 'org-2', label: 'Police Station' },
      { source: 'case-1', target: 'loc-1', label: 'Incident Location' },
      { source: 'case-1', target: 'evi-1', label: 'Seized Evidence' },
      { source: 'case-1', target: 'doc-1', label: 'Case Document' },
      { source: 'person-1', target: 'evi-1', label: 'Collected' },
      { source: 'org-1', target: 'evi-1', label: 'Analyzed' },
    ];

    return { nodes: mockNodes, edges: mockEdges };
  };

  // Canvas drawing for network view
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Clear
      ctx.clearRect(0, 0, width, height);

      // Draw edges
      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (!source || !target) return;

        const sx = source.x * zoom + pan.x;
        const sy = source.y * zoom + pan.y;
        const tx = target.x * zoom + pan.x;
        const ty = target.y * zoom + pan.y;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = '#9CA3AF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw edge label
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        ctx.fillStyle = '#6B7280';
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(edge.label, mx, my - 5);
      });

      // Draw nodes
      nodes.forEach(node => {
        const x = node.x * zoom + pan.x;
        const y = node.y * zoom + pan.y;
        const radius = Math.max(20, 30 * zoom);

        // Node circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Node label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.max(10, 12 * zoom)}px Inter`;
        ctx.textAlign = 'center';
        const label = node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label;
        ctx.fillText(label, x, y + 4);

        // Highlight selected node
        if (selectedNode?.id === node.id) {
          ctx.beginPath();
          ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      });
    };

    draw();
  }, [nodes, edges, zoom, pan, selectedNode]);

  // Mouse handlers for pan/zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.3), 3));
  };

  const [isPanning, setIsPanning] = useState(false);
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !selectedNode) {
      setIsPanning(true);
      setLastPan({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPan.x;
      const dy = e.clientY - lastPan.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPan({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleNodeClick = (node: EntityNode) => {
    setSelectedNode(selectedNode?.id === node.id ? null : node);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const clickedNode = nodes.find(n =>
      Math.hypot(n.x - x, n.y - y) < 30 / zoom
    );

    if (clickedNode) {
      handleNodeClick(clickedNode);
    } else {
      setSelectedNode(null);
    }
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (isLoadingCases) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!selectedCaseId && cases.length > 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entity Graph</h1>
          <p className="text-gray-600 mt-1">Explore relationships between people, organizations, and evidence</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl">
          {cases.map(c => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCaseId(c.id);
                navigate(`/entity-graph/${c.id}`);
              }}
              className="card p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <p className="font-medium text-gray-900">{c.title}</p>
              <p className="text-sm text-gray-500 mt-1">{c.case_number}</p>
              <span className={`badge ${getStatusBadgeColor(c.status)} mt-2 inline-block`}>
                {formatStatus(c.status)}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedCaseId) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-gray-900">No cases available</h2>
        <p className="text-gray-500 mt-2">You don't have access to any cases yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entity Graph</h1>
          <p className="text-gray-600 mt-1">Explore relationships between people, organizations, and evidence</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={viewMode}
            onChange={e => setViewMode(e.target.value as 'network' | 'table')}
            className="input w-40"
          >
            <option value="network">Network View</option>
            <option value="table">Table View</option>
          </select>
          <button className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Case Selector */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="label">Case:</label>
          <select
            value={selectedCaseId}
            onChange={e => {
              const newCaseId = e.target.value;
              setSelectedCaseId(newCaseId);
              navigate(`/entity-graph/${newCaseId}`);
            }}
            className="input w-full max-w-md"
          >
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.title} ({c.case_number})</option>
            ))}
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={resetView} className="btn-secondary btn-sm" title="Reset View">
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </button>
            <div className="flex items-center border border-gray-300 rounded-lg px-3">
              <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.3))} className="p-1 text-gray-600 hover:text-gray-900" title="Zoom Out">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 text-sm text-gray-600">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(z * 1.25, 3))} className="p-1 text-gray-600 hover:text-gray-900" title="Zoom In">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-6">
          {Object.entries(nodeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm text-gray-600 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph View */}
      {viewMode === 'network' ? (
        <div className="card relative">
          <canvas
            ref={canvasRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleCanvasClick}
            className="w-full h-[600px] bg-gray-50 cursor-grab"
            style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          />
          {isLoadingGraph && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary-500 border-t-transparent"></div>
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <Search className="w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search entities..." className="input w-full max-w-sm ml-2" />
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Type</th>
                  <th>Connections</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map(node => {
                  const connections = edges.filter(e => e.source === node.id || e.target === node.id).length;
                  return (
                    <tr key={node.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleNodeClick(node)}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium" style={{ backgroundColor: node.color }}>
                            {node.label.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{node.label}</p>
                            <p className="text-xs text-gray-500 capitalize">{node.type}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-blue capitalize">{node.type}</span>
                      </td>
                      <td className="text-gray-600">{connections} connections</td>
                      <td>
                        <button className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg">
                          <Search className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Node Detail Panel */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="w-full max-w-md bg-white shadow-xl rounded-t-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: selectedNode.color }}>
                  {selectedNode.label.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedNode.label}</p>
                  <p className="text-sm text-gray-500 capitalize">{selectedNode.type}</p>
                </div>
              </div>
              <button onClick={() => setSelectedNode(null)} className="p-2 text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Connections</h4>
                <div className="space-y-2">
                  {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).map((edge, idx) => {
                    const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                    const otherNode = nodes.find(n => n.id === otherId);
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: otherNode?.color || '#6B7280' }}>
                            {otherNode?.label.charAt(0) || '?'}
                          </div>
                          <span className="text-sm text-gray-700">{otherNode?.label || otherId}</span>
                        </div>
                        <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">{edge.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button className="btn-primary w-full" onClick={() => setSelectedNode(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatStatus(status: string): string {
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    OPEN: 'badge-blue',
    UNDER_INVESTIGATION: 'badge-yellow',
    CHARGE_SHEET_FILED: 'badge-purple',
    TRIAL_IN_PROGRESS: 'badge-indigo',
    JUDGMENT_RESERVED: 'badge-pink',
    DISPOSED: 'badge-green',
    APPEALED: 'badge-orange',
    CLOSED: 'badge-gray',
  };
  return colors[status] || 'badge-gray';
}
