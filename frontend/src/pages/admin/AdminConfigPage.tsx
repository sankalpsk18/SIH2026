// ============================================================================
// ADALAT360 - Admin Config Page
// System configuration management
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Loader2,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  AlertTriangle,
  Shield,
  Database,
  Server,
  Network,
  HardDrive,
  Settings,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { authApi } from '../../../services/api';
import { toast } from 'react-hot-toast';

interface ConfigItem {
  config_key: string;
  config_value: any;
  description: string;
  is_sensitive: boolean;
  updated_at: string;
}

export function AdminConfigPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showValue, setShowValue] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setIsLoading(true);
    try {
      const response = await authApi.getConfig();
      setConfigs(response.data);
    } catch (error: any) {
      toast.error('Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (config: ConfigItem) => {
    setEditingKey(config.config_key);
    setEditValue(config.is_sensitive ? '' : JSON.stringify(config.config_value, null, 2));
  };

  const handleSave = async (config: ConfigItem) => {
    try {
      let value: any;
      try {
        value = JSON.parse(editValue);
      } catch {
        value = editValue;
      }
      await authApi.setConfig({
        config_key: config.config_key,
        config_value: value,
        description: config.description,
        is_sensitive: config.is_sensitive,
      });
      toast.success('Configuration updated');
      setEditingKey(null);
      loadConfigs();
    } catch (error: any) {
      toast.error('Failed to update configuration');
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const toggleShowValue = (key: string) => {
    setShowValue(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
          <p className="text-gray-600 mt-1">Manage application settings and sensitive values</p>
        </div>
        <button onClick={loadConfigs} disabled={isLoading} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Config Table */}
      <div className="card overflow-hidden">
        {isLoading && configs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Config Key</th>
                  <th>Description</th>
                  <th>Value</th>
                  <th>Sensitive</th>
                  <th>Updated At</th>
                  <th className="w-48">Actions</th>
                </tr>
              </thead>
              <tbody>
                {configs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No configuration found</p>
                    </td>
                  </tr>
                ) : (
                  configs.map((config) => (
                    <tr key={config.config_key} className="hover:bg-gray-50">
                      <td className="font-mono text-sm text-gray-900">{config.config_key}</td>
                      <td className="text-gray-600 max-w-xs truncate block">{config.description || '—'}</td>
                      <td className="max-w-md">
                        {editingKey === config.config_key ? (
                          <div className="flex gap-2">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="input flex-1 font-mono text-sm min-h-[80px]"
                              rows={3}
                            />
                            <div className="flex flex-col gap-1">
                              <button onClick={() => handleSave(config)} className="btn-primary btn-sm">
                                <Save className="w-4 h-4" />
                              </button>
                              <button onClick={handleCancel} className="btn-secondary btn-sm">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-gray-100 p-2 rounded text-sm font-mono text-gray-700 break-all max-w-md">
                              {config.is_sensitive ? (
                                showValue[config.config_key] ? JSON.stringify(config.config_value, null, 2) : '••••••••'
                              ) : JSON.stringify(config.config_value, null, 2)}
                            </code>
                            {config.is_sensitive && (
                              <button
                                onClick={() => toggleShowValue(config.config_key)}
                                className="p-1 text-gray-500 hover:text-primary-600"
                                title={showValue[config.config_key] ? 'Hide' : 'Show'}
                              >
                                {showValue[config.config_key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            )}
                            <button
                              onClick={() => copyToClipboard(JSON.stringify(config.config_value))}
                              className="p-1 text-gray-500 hover:text-primary-600"
                              title="Copy"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${config.is_sensitive ? 'badge-red' : 'badge-green'}`}>
                          {config.is_sensitive ? 'Sensitive' : 'Public'}
                        </span>
                      </td>
                      <td className="text-gray-500 whitespace-nowrap">{new Date(config.updated_at).toLocaleString()}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEdit(config)} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}