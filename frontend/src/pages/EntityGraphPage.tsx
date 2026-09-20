import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Download, Search, Target, ZoomIn, ZoomOut, RotateCcw, X,
  User, Building2, MapPin, FileText, ShieldCheck, Briefcase,
} from 'lucide-react';
import { casesApi, entityGraphApi } from '../services/api';
import { Case } from '../types';

// ============================================================================
// Types
// ============================================================================

interface GNode {
  id: string;
  label: string;
  type: 'person' | 'organization' | 'location' | 'evidence' | 'document' | 'case';
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
}

interface GEdge {
  source: string;
  target: string;
  label: string;
}

// ============================================================================
// Constants
// ============================================================================

const NODE_COLORS: Record<string, string> = {
  person: '#3B82F6',
  organization: '#8B5CF6',
  location: '#10B981',
  evidence: '#F59E0B',
  document: '#EC4899',
  case: '#6366F1',
};

const NODE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  person: User,
  organization: Building2,
  location: MapPin,
  evidence: ShieldCheck,
  document: FileText,
  case: Briefcase,
};

// ============================================================================
// Force simulation helpers
// ============================================================================

function runForceSimulation(nodes: GNode[], edges: GEdge[], width: number, height: number, iterations = 120) {
  // Center
  const cx = width / 2;
  const cy = height / 2;

  // Place nodes in a circle initially
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const r = Math.min(width, height) * 0.3;
    n.x = cx + r * Math.cos(angle);
    n.y = cy + r * Math.sin(angle);
    n.vx = 0;
    n.vy = 0;
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations; // cooling
    const repulsion = 8000 * alpha;
    const attraction = 0.005;
    const centerPull = 0.01 * alpha;

    // Repulsion between every pair
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.max(Math.hypot(dx, dy), 1);
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction along edges
    edges.forEach((e) => {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) return;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const force = dist * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    });

    // Center gravity
    nodes.forEach((n) => {
      n.vx += (cx - n.x) * centerPull;
      n.vy += (cy - n.y) * centerPull;
    });

    // Apply velocity with damping
    const damping = 0.85;
    nodes.forEach((n) => {
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
      // Keep within bounds (with padding)
      n.x = Math.max(60, Math.min(width - 60, n.x));
      n.y = Math.max(60, Math.min(height - 60, n.y));
    });
  }
}

// ============================================================================
// Main component
// ============================================================================

export function EntityGraphPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseId || '');
  const [isLoadingCases, setIsLoadingCases] = useState(!caseId);

  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [viewMode, setViewMode] = useState<'network' | 'table'>('network');

  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GNode | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Load cases ----
  useEffect(() => {
    if (!isLoadingCases) return;
    (async () => {
      try {
        const res = await casesApi.list({ limit: 100, sort_by: 'created_at', sort_order: 'desc' });
        setCases(res.data.cases || []);
        if (!selectedCaseId && res.data.cases?.length > 0) {
          setSelectedCaseId(res.data.cases[0].id);
          navigate(`/cases/${res.data.cases[0].id}/entity-graph`);
        }
      } catch {
        console.error('Failed to load cases');
      } finally {
        setIsLoadingCases(false);
      }
    })();
  }, [isLoadingCases]);

  // ---- Load graph when caseId changes ----
  useEffect(() => {
    if (!selectedCaseId) return;
    loadGraph();
  }, [selectedCaseId]);

  const loadGraph = async () => {
    if (!selectedCaseId) return;
    setIsLoadingGraph(true);
    try {
      let data: any;
      try {
        const res = await entityGraphApi.getGraph(selectedCaseId, { includeDocuments: true, includeEvidence: true });
        data = res.data;
      } catch {
        data = generateMockGraphData();
      }

      if (!data?.nodes?.length) data = generateMockGraphData();

      const canvas = canvasRef.current;
      const w = canvas?.getBoundingClientRect().width || 900;
      const h = 600;

      const gNodes: GNode[] = data.nodes.map((n: any) => ({
        ...n,
        color: n.color || NODE_COLORS[n.type] || '#6B7280',
        radius: n.type === 'case' ? 34 : 26,
        vx: 0,
        vy: 0,
        x: 0,
        y: 0,
      }));

      runForceSimulation(gNodes, data.edges, w, h);
      setNodes(gNodes);
      setEdges(data.edges);
    } catch {
      console.error('Failed to load entity graph');
    } finally {
      setIsLoadingGraph(false);
    }
  };

  // ---- Generate mock data ----
  const generateMockGraphData = () => {
    const mockNodes = [
      { id: 'case-1', label: 'Case FIR/2024/DEL/001234', type: 'case' },
      { id: 'person-1', label: 'Amit Verma', type: 'person' },
      { id: 'person-2', label: 'Priya Sharma', type: 'person' },
      { id: 'person-3', label: 'Rajesh Kumar', type: 'person' },
      { id: 'org-1', label: 'MediCore Labs', type: 'organization' },
      { id: 'org-2', label: 'Delhi Police', type: 'organization' },
      { id: 'loc-1', label: 'Saket, Delhi', type: 'location' },
      { id: 'evi-1', label: 'EVD-104 (Phone)', type: 'evidence' },
      { id: 'doc-1', label: 'FIR Document', type: 'document' },
    ];

    const mockEdges: GEdge[] = [
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

  // ---- Canvas drawing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    // Build a set of connected node IDs for hovered / selected highlights
    const highlightIds = new Set<string>();
    const focusNode = hoveredNode || selectedNode;
    if (focusNode) {
      highlightIds.add(focusNode.id);
      edges.forEach((e) => {
        if (e.source === focusNode.id) highlightIds.add(e.target);
        if (e.target === focusNode.id) highlightIds.add(e.source);
      });
    }

    const dimmed = !!focusNode;

    // Helper to transform coords
    const tx = (x: number) => x * zoom + pan.x;
    const ty = (y: number) => y * zoom + pan.y;

    // ---- Draw edges ----
    edges.forEach((edge) => {
      const src = nodes.find((n) => n.id === edge.source);
      const tgt = nodes.find((n) => n.id === edge.target);
      if (!src || !tgt) return;

      const x1 = tx(src.x);
      const y1 = ty(src.y);
      const x2 = tx(tgt.x);
      const y2 = ty(tgt.y);

      const isHighlighted =
        focusNode && (edge.source === focusNode.id || edge.target === focusNode.id);

      ctx.save();
      ctx.globalAlpha = dimmed ? (isHighlighted ? 1 : 0.1) : 0.5;
      ctx.strokeStyle = isHighlighted ? '#3B82F6' : '#CBD5E1';
      ctx.lineWidth = isHighlighted ? 2.5 : 1.2;

      // Curved bezier line
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.hypot(dx, dy);
      // offset perpendicular for curve
      const curveOffset = Math.min(dist * 0.12, 30);
      const cx1 = mx - (dy / dist) * curveOffset;
      const cy1 = my + (dx / dist) * curveOffset;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx1, cy1, x2, y2);
      ctx.stroke();

      // Edge label on a white pill
      if (zoom > 0.5) {
        const lx = (x1 + 2 * cx1 + x2) / 4;
        const ly = (y1 + 2 * cy1 + y2) / 4;
        const text = edge.label;
        ctx.font = `${Math.max(9, 10 * zoom)}px Inter, system-ui, sans-serif`;
        const textW = ctx.measureText(text).width;

        ctx.globalAlpha = dimmed ? (isHighlighted ? 0.95 : 0.08) : 0.85;
        // Pill background
        const pillH = 16;
        const pillW = textW + 12;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        const r = pillH / 2;
        ctx.roundRect(lx - pillW / 2, ly - pillH / 2, pillW, pillH, r);
        ctx.fill();
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.fillStyle = isHighlighted ? '#1E40AF' : '#64748B';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, lx, ly);
      }

      ctx.restore();
    });

    // ---- Draw nodes ----
    nodes.forEach((node) => {
      const x = tx(node.x);
      const y = ty(node.y);
      const r = node.radius * zoom;

      const isFocus = focusNode?.id === node.id;
      const isConnected = highlightIds.has(node.id);

      ctx.save();
      ctx.globalAlpha = dimmed ? (isConnected ? 1 : 0.15) : 1;

      // Outer glow for focused node
      if (isFocus) {
        ctx.beginPath();
        ctx.arc(x, y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = node.color + '30'; // 30 hex = ~19% alpha
        ctx.fill();
      }

      // Node circle with white border
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Icon initial in white
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.max(11, 13 * zoom)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label.charAt(0).toUpperCase(), x, y);

      ctx.restore();

      // Label below node
      ctx.save();
      ctx.globalAlpha = dimmed ? (isConnected ? 1 : 0.12) : 0.9;
      ctx.fillStyle = '#1E293B';
      ctx.font = `600 ${Math.max(10, 11 * zoom)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = node.label.length > 20 ? node.label.slice(0, 18) + '…' : node.label;
      ctx.fillText(label, x, y + r + 5);

      // Type label
      ctx.fillStyle = '#94A3B8';
      ctx.font = `${Math.max(8, 9 * zoom)}px Inter, system-ui, sans-serif`;
      ctx.fillText(node.type, x, y + r + 5 + (13 * zoom));
      ctx.restore();
    });
  }, [nodes, edges, zoom, pan, selectedNode, hoveredNode]);

  // ---- Mouse interactions ----
  const getNodeAtPos = useCallback(
    (clientX: number, clientY: number): GNode | null => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const mx = (clientX - rect.left - pan.x) / zoom;
      const my = (clientY - rect.top - pan.y) / zoom;
      return nodes.find((n) => Math.hypot(n.x - mx, n.y - my) < n.radius + 4) || null;
    },
    [nodes, zoom, pan]
  );

  const handleCanvasClick = (e: React.MouseEvent) => {
    const node = getNodeAtPos(e.clientX, e.clientY);
    setSelectedNode(node && selectedNode?.id === node.id ? null : node);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan((p) => ({
        x: p.x + e.clientX - lastPan.x,
        y: p.y + e.clientY - lastPan.y,
      }));
      setLastPan({ x: e.clientX, y: e.clientY });
      return;
    }
    const node = getNodeAtPos(e.clientX, e.clientY);
    setHoveredNode(node);
    if (canvasRef.current) canvasRef.current.style.cursor = node ? 'pointer' : 'grab';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setLastPan({ x: e.clientX, y: e.clientY });
    }
  };
  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(z * delta, 0.3), 3));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // ---- Loading / empty states ----
  if (isLoadingCases) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary-500 border-t-transparent" />
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
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedCaseId(c.id); navigate(`/cases/${c.id}/entity-graph`); }}
              className="card p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <p className="font-medium text-gray-900">{c.title}</p>
              <p className="text-sm text-gray-500 mt-1">{c.case_number}</p>
              <span className={`badge ${getStatusBadgeColor(c.status)} mt-2 inline-block`}>
                {fmtStatus(c.status)}
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

  // ---- Main view ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entity Graph</h1>
          <p className="text-gray-500 mt-1 text-sm">Explore relationships between people, organizations, and evidence</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'network' | 'table')}
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

      {/* Case selector + zoom controls */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="label mb-0">Case:</label>
          <select
            value={selectedCaseId}
            onChange={(e) => { setSelectedCaseId(e.target.value); navigate(`/cases/${e.target.value}/entity-graph`); }}
            className="input w-full max-w-md"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.title} ({c.case_number})</option>
            ))}
          </select>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={resetView} className="btn-secondary btn-sm" title="Reset View">
              <RotateCcw className="w-4 h-4 mr-1" /> Reset
            </button>
            <div className="flex items-center border border-gray-300 rounded-lg px-3 bg-white">
              <button onClick={() => setZoom((z) => Math.max(z * 0.8, 0.3))} className="p-1 text-gray-600 hover:text-gray-900">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 text-sm text-gray-600 tabular-nums">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(z * 1.25, 3))} className="p-1 text-gray-600 hover:text-gray-900">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GraphStat label="Entities" value={nodes.length} tone="text-primary-700 bg-primary-50" />
        <GraphStat label="Relationships" value={edges.length} tone="text-violet-700 bg-violet-50" />
        <GraphStat label="People / Orgs" value={nodes.filter((n) => n.type === 'person' || n.type === 'organization').length} tone="text-emerald-700 bg-emerald-50" />
        <GraphStat label="Evidence links" value={nodes.filter((n) => n.type === 'evidence' || n.type === 'document').length} tone="text-amber-700 bg-amber-50" />
      </div>

      {/* Legend */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {Object.entries(NODE_COLORS).map(([type, color]) => {
            const Icon = NODE_ICONS[type] || Target;
            return (
              <div
                key={type}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="w-3 h-3" />
                </div>
                <span className="text-xs font-medium text-gray-600 capitalize">{type}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Graph / Table */}
      {viewMode === 'network' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-6">
          {/* Canvas card */}
          <div className="card relative overflow-hidden" ref={containerRef}>
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white">
              <div>
                <p className="font-semibold text-gray-900 text-sm">Relationship Network</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Click a node to inspect · Drag to pan · Scroll to zoom
                </p>
              </div>
              {selectedNode && (
                <span className="badge badge-primary flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: selectedNode.color }} />
                  {selectedNode.label}
                </span>
              )}
            </div>

            <canvas
              ref={canvasRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => { handleMouseUp(); setHoveredNode(null); }}
              onClick={handleCanvasClick}
              className="w-full h-[600px] bg-gradient-to-br from-slate-50 to-slate-100"
              style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
            />

            {isLoadingGraph && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary-500 border-t-transparent" />
              </div>
            )}
          </div>

          {/* Key entities sidebar */}
          <div className="card p-5 h-fit">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">Key Entities</h2>
                <p className="text-xs text-gray-500 mt-0.5">Click to focus on the graph</p>
              </div>
              <Target className="w-5 h-5 text-primary-600" />
            </div>

            <div className="space-y-1.5">
              {nodes.slice(0, 10).map((node) => {
                const connCount = edges.filter(
                  (e) => e.source === node.id || e.target === node.id
                ).length;
                const Icon = NODE_ICONS[node.type] || Target;
                const isActive = selectedNode?.id === node.id;

                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNode(isActive ? null : node)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isActive ? 'bg-primary-50 ring-1 ring-primary-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: node.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 truncate">
                        {node.label}
                      </span>
                      <span className="block text-xs text-gray-500 capitalize">
                        {node.type} · {connCount} link{connCount !== 1 ? 's' : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Table view */
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search entities..." className="input w-full max-w-sm" />
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
                {nodes.map((node) => {
                  const connCount = edges.filter(
                    (e) => e.source === node.id || e.target === node.id
                  ).length;
                  const Icon = NODE_ICONS[node.type] || Target;
                  return (
                    <tr
                      key={node.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedNode(node)}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                            style={{ backgroundColor: node.color }}
                          >
                            <Icon className="w-4 h-4" />
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
                      <td className="text-gray-600">{connCount} connections</td>
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

      {/* Node detail panel */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setSelectedNode(null)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-md bg-white shadow-xl rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up z-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg"
                  style={{ backgroundColor: selectedNode.color }}
                >
                  {(() => {
                    const Icon = NODE_ICONS[selectedNode.type] || Target;
                    return <Icon className="w-6 h-6" />;
                  })()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedNode.label}</p>
                  <p className="text-sm text-gray-500 capitalize">{selectedNode.type}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Connections list */}
            <div className="p-4 bg-slate-50 rounded-xl">
              <h4 className="font-medium text-gray-900 text-sm mb-3">
                Connections ({edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                {edges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map((edge, idx) => {
                    const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                    const otherNode = nodes.find((n) => n.id === otherId);
                    const OtherIcon = NODE_ICONS[otherNode?.type || 'case'] || Target;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-gray-100"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0"
                            style={{ backgroundColor: otherNode?.color || '#6B7280' }}
                          >
                            <OtherIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm text-gray-700 truncate max-w-[180px]">
                            {otherNode?.label || otherId}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 px-2 py-1 bg-gray-50 rounded-md font-medium flex-shrink-0">
                          {edge.label}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <button
              className="btn-primary w-full mt-4"
              onClick={() => setSelectedNode(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function fmtStatus(status: string): string {
  return status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
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

function GraphStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card p-4 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
        <Target className="w-4 h-4" />
      </div>
    </div>
  );
}
