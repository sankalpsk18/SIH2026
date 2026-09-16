import React, { useState } from 'react';
import { Activity, BadgeCheck, Building, CheckCircle2, Eye, EyeOff, Loader2, Lock, Settings, Shield, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

type TabKey = 'profile' | 'security' | 'preferences' | 'sessions';

export function ProfilePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const tabs: Array<{ id: TabKey; label: string; icon: React.ReactNode }> = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'preferences', label: 'Preferences', icon: <Settings className="w-4 h-4" /> },
    { id: 'sessions', label: 'Sessions', icon: <Activity className="w-4 h-4" /> },
  ];

  const handleSave = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success('Profile updated successfully');
    }, 400);
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-700">{user?.full_name?.charAt(0) || 'U'}</span>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{user?.full_name || 'User'}</h2>
            <p className="text-gray-600">{user?.email || 'user@example.com'}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1"><BadgeCheck className="w-4 h-4" />{user?.role || 'User'}</span>
              <span className="flex items-center gap-1"><Building className="w-4 h-4" />{user?.department || 'Operations'}</span>
              <span className="flex items-center gap-1"><Shield className="w-4 h-4" />MFA: {user?.totp_enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="tabs border-b border-gray-200 px-4">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}>
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="max-w-2xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Full Name</label>
                  <input defaultValue={user?.full_name || ''} className="input" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input defaultValue={user?.phone || ''} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Designation</label>
                <input defaultValue={user?.designation || ''} className="input" />
              </div>
              <button type="button" disabled={isLoading} onClick={handleSave} className="btn-primary">
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Save Profile</>}
              </button>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <label className="label">Current Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} defaultValue="" className="input pr-10" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
              <div>
                <label className="label">New Password</label>
                <input type="password" className="input" />
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input type="password" className="input" />
              </div>
              <button type="button" className="btn-primary">Update Password</button>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"><div><p className="font-medium">Email notifications</p><p className="text-sm text-gray-500">Receive case updates by email</p></div><button className="btn-secondary">Enabled</button></div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"><div><p className="font-medium">Dark mode</p><p className="text-sm text-gray-500">Use the dark interface theme</p></div><button className="btn-secondary">Disabled</button></div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><Lock className="w-5 h-5 text-primary-600" /><div><p className="font-medium">Current Session</p><p className="text-sm text-gray-500">Windows • Last active now</p></div></div><span className="badge badge-green">Active</span></div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><Shield className="w-5 h-5 text-primary-600" /><div><p className="font-medium">Backup device</p><p className="text-sm text-gray-500">Android • Last active 2 hours ago</p></div></div><button className="btn-secondary">Revoke</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
