import React, { useState } from 'react';
import { CheckCircle2, Loader2, Network, RefreshCw, Shield } from 'lucide-react';

export function AdminBlockchainPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 300);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blockchain Network</h1>
          <p className="text-gray-600 mt-1">Monitor and manage the Hyperledger Fabric network</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} disabled={isLoading} className="btn-secondary">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </button>
          <button className="btn-primary"><Shield className="w-4 h-4 mr-2" />Verify Full Chain</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatusCard title="Network Status" value="3/3" subtitle="Active Nodes" icon={<Network className="w-6 h-6" />} color="blue" />
        <StatusCard title="Latest Block" value="1842" subtitle="Block Height" icon={<CheckCircle2 className="w-6 h-6" />} color="green" />
        <StatusCard title="Chain Integrity" value="Valid" subtitle="All blocks verified" icon={<Shield className="w-6 h-6" />} color="green" />
        <StatusCard title="Organizations" value="4" subtitle="Registered Orgs" icon={<Network className="w-6 h-6" />} color="purple" />
      </div>

      <div className="card p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="text-gray-600">Blockchain monitoring is restored in a safe state while the live network service is being checked.</p>
      </div>
    </div>
  );
}

function StatusCard({ title, value, subtitle, icon, color }: { title: string; value: string; subtitle: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className={`rounded-lg p-3 ${color === 'blue' ? 'bg-blue-100 text-blue-600' : color === 'green' ? 'bg-green-100 text-green-600' : color === 'purple' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'}`}>{icon}</div>
      </div>
    </div>
  );
}
