import React, { useState } from 'react';
import { Copy, Loader2, RefreshCw, Save, Settings } from 'lucide-react';

export function AdminConfigPage() {
  const [isLoading, setIsLoading] = useState(false);

  const configs = [
    { key: 'app.name', value: 'ADALAT360', description: 'Application display name', sensitive: false },
    { key: 'api.base_url', value: 'https://api.adalat360.gov.in/v1', description: 'Core API endpoint', sensitive: false },
    { key: 'auth.jwt_secret', value: '••••••••', description: 'JWT signing secret', sensitive: true },
  ];

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 300);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
          <p className="text-gray-600 mt-1">Manage application settings and sensitive values</p>
        </div>
        <button onClick={handleRefresh} disabled={isLoading} className="btn-secondary">
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Refresh
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Config Key</th>
                <th>Description</th>
                <th>Value</th>
                <th>Sensitive</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map(config => (
                <tr key={config.key}>
                  <td className="font-mono text-sm">{config.key}</td>
                  <td className="text-gray-600">{config.description}</td>
                  <td className="font-mono text-sm">{config.value}</td>
                  <td><span className={`badge ${config.sensitive ? 'badge-red' : 'badge-green'}`}>{config.sensitive ? 'Sensitive' : 'Public'}</span></td>
                  <td><div className="flex gap-2"><button className="btn-secondary btn-sm"><Save className="w-4 h-4" /></button><button className="btn-secondary btn-sm"><Copy className="w-4 h-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-6 text-center">
        <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Configuration management is available in safe mode while the backend policy layer is being validated.</p>
      </div>
    </div>
  );
}
