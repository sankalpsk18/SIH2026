// ============================================================================
// ADALAT360 - Admin Blockchain Page
// Blockchain network management and monitoring
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Loader2,
  RefreshCw,
  Network,
  Server,
  Shield,
  Link,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  Terminal,
  Download,
  Eye,
  Copy,
  Hash,
  Block,
  ArrowRightLeft,
} from 'lucide-react';
import { blockchainApi, authApi } from '../../../services/api';
import { toast } from 'react-hot-toast';

interface BlockchainNode {
  id: string;
  node_id: string;
  node_type: string;
  organization_name: string;
  organization_msp_id: string;
  peer_endpoint: string;
  ca_endpoint: string;
  is_active: boolean;
  is_orderer: boolean;
  orderer_endpoint: string;
}

interface Block {
  block_number: number;
  block_hash: string;
  prev_block_hash: string;
  tx_count: number;
  tx_ids: string[];
  merkle_root: string;
  proposer_node_id: string;
  committed_at: string;
}

export function AdminBlockchainPage() {
  const [nodes, setNodes] = useState<BlockchainNode[]>([]);
  const [latestBlock, setLatestBlock] = useState<Block | null>(null);
  const [chainVerification, setChainVerification] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [editingNode, setEditingNode] = useState<any>(null);

  useEffect(() => {
    loadBlockchainData();
  }, []);

  const loadBlockchainData = async () => {
    setIsLoading(true);
    try {
      const [nodesRes, blockRes] = await Promise.allSettled([
        authApi.getBlockchainNodes(),
        blockchainApi.getLatestBlock(),
      ]);

      if (nodesRes.status === 'fulfilled') {
        setNodes(nodesRes.value.data || []);
      }
      if (blockRes.status === 'fulfilled') {
        setLatestBlock(blockRes.value.data);
      }
    } catch (error) {
      toast.error('Failed to load blockchain data');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyChain = async () => {
    setIsVerifying(true);
    try {
      const result = await blockchainApi.verifyFullChain();
      setChainVerification(result);
      toast.success(result.valid ? 'Chain verification passed' : 'Chain verification failed');
    } catch (error: any) {
      toast.error('Chain verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const verifyRange = async (start: number, end: number) => {
    setIsVerifying(true);
    try {
      const result = await blockchainApi.verifyChain(start, end);
      setChainVerification(result);
      toast.success(result.valid ? 'Range verification passed' : 'Range verification failed');
    } catch (error: any) {
      toast.error('Range verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blockchain Network</h1>
          <p className="text-gray-600 mt-1">Monitor and manage the Hyperledger Fabric network</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadBlockchainData} disabled={isLoading} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={verifyChain} disabled={isVerifying} className="btn-primary">
            <Shield className={`w-4 h-4 mr-2 ${isVerifying ? 'animate-spin' : ''}`} />
            Verify Full Chain
          </button>
        </div>
      </div>

      {/* Network Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatusCard
          title="Network Status"
          value={nodes.filter(n => n.is_active).length + '/' + nodes.length}
          subtitle="Active Nodes"
          icon={<Network className="w-6 h-6" />}
          color="blue"
        />
        <StatusCard
          title="Latest Block"
          value={latestBlock?.block_number?.toString() || '—'}
          subtitle="Block Height"
          icon={<Block className="w-6 h-6" />}
          color="green"
        />
        <StatusCard
          title="Chain Integrity"
          value={chainVerification?.valid ? 'Valid' : chainVerification === null ? 'Unknown' : 'Invalid'}
          subtitle={chainVerification ? `${chainVerification.verified_blocks} blocks verified` : 'Not verified'}
          icon={<Shield className="w-6 h-6" />}
          color={chainVerification?.valid ? 'green' : chainVerification === null ? 'gray' : 'red'}
        />
        <StatusCard
          title="Organizations"
          value={nodes.length.toString()}
          subtitle="Registered Orgs"
          icon={<Server className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Latest Block Info */}
      <div className="card">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Latest Block</h2>
          {latestBlock && (
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Hash className="w-4 h-4" />
                {latestBlock.block_hash.slice(0, 16)}...
              </span>
              <span className="flex items-center gap-1">
                <ArrowRightLeft className="w-4 h-4" />
                {latestBlock.tx_count} TXs
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(latestBlock.committed_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>
        {latestBlock && (
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Block Number</p>
                <p className="font-mono font-medium">{latestBlock.block_number}</p>
              </div>
              <div>
                <p className="text-gray-500">Block Hash</p>
                <p className="font-mono text-xs break-all">{latestBlock.block_hash}</p>
              </div>
              <div>
                <p className="text-gray-500">Previous Hash</p>
                <p className="font-mono text-xs break-all">{latestBlock.prev_block_hash}</p>
              </div>
              <div>
                <p className="text-gray-500">Merkle Root</p>
                <p className="font-mono text-xs break-all">{latestBlock.merkle_root}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-gray-500">Transaction IDs</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {latestBlock.tx_ids.slice(0, 5).map((txId, i) => (
                    <span key={i} className="badge-secondary text-xs font-mono">{txId.slice(0, 12)}...</span>
                  ))}
                  {latestBlock.tx_ids.length > 5 && (
                    <span className="badge-secondary text-xs">+{latestBlock.tx_ids.length - 5} more</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chain Verification Result */}
      {chainVerification && (
        <div className="card">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Chain Verification Result</h2>
            <span className={`badge ${chainVerification.valid ? 'badge-green' : 'badge-red'}`}>
              {chainVerification.valid ? 'Valid' : 'Invalid'}
            </span>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Status</p>
              <p className="font-medium">{chainVerification.valid ? 'Valid' : 'Invalid'}</p>
            </div>
            <div>
              <p className="text-gray-500">Last Block</p>
              <p className="font-mono">{chainVerification.last_block_number}</p>
            </div>
            <div>
              <p className="text-gray-500">Verified Blocks</p>
              <p className="font-medium">{chainVerification.verified_blocks}</p>
            </div>
            <div>
              <p className="text-gray-500">Errors</p>
              <p className="font-medium text-danger-600">{chainVerification.errors.length}</p>
            </div>
            {chainVerification.errors.length > 0 && (
              <div className="col-span-full mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Errors:</h4>
                <ul className="list-disc list-inside text-sm text-danger-600 space-y-1 max-h-40 overflow-y-auto">
                  {chainVerification.errors.map((err: string, i: number) => (
                    <li key={i} className="text-xs">{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nodes */}
      <div className="card">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Network Nodes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Node ID</th>
                <th>Organization</th>
                <th>Type</th>
                <th>MSP ID</th>
                <th>Peer Endpoint</th>
                <th>Status</th>
                <th>Orderer</th>
              </tr>
            </thead>
            <tbody>
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">No nodes configured</td>
                </tr>
              ) : (
                nodes.map((node) => (
                  <tr key={node.id} className="hover:bg-gray-50">
                    <td className="font-mono text-sm text-gray-900">{node.node_id}</td>
                    <td className="font-medium text-gray-900">{node.organization_name}</td>
                    <td>
                      <span className="badge badge-blue">{node.node_type.replace('_', ' ')}</span>
                    </td>
                    <td className="font-mono text-sm text-gray-600">{node.organization_msp_id}</td>
                    <td className="font-mono text-sm text-gray-600">{node.peer_endpoint}</td>
                    <td>
                      <span className={`badge ${node.is_active ? 'badge-green' : 'badge-red'}`}>
                        {node.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${node.is_orderer ? 'badge-purple' : 'badge-gray'}`}>
                        {node.is_orderer ? 'Orderer' : 'Peer'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chain Verification Tool */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Verify Chain Range</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Start Block</label>
              <input type="number" min="1" id="verifyStart" className="input" defaultValue="1" />
            </div>
            <div>
              <label className="label">End Block</label>
              <input type="number" min="1" id="verifyEnd" className="input" placeholder="Optional - defaults to latest" />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  const start = parseInt((document.getElementById('verifyStart') as HTMLInputElement)?.value || '1');
                  const end = parseInt((document.getElementById('verifyEnd') as HTMLInputElement)?.value || '0');
                  verifyRange(start, end || undefined);
                }}
                disabled={isVerifying}
                className="btn-primary"
              >
                {isVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : ''}
                Verify Range
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, value, subtitle, icon, color }: { title: string; value: string; subtitle: string; icon: React.ReactNode; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color] || colorClasses.blue}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}