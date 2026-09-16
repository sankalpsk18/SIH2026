import React, { useState } from 'react';
import { Bell, CheckCircle2, Database, Eye, Globe, HardDrive, Key, Lock, Monitor, Moon, Network, Palette, Save, Settings, Shield, Smartphone, Sun, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

type TabKey = 'general' | 'security' | 'notifications' | 'appearance' | 'advanced';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [isSaving, setIsSaving] = useState(false);

  const tabs: Array<{ id: TabKey; label: string; icon: React.ReactNode }> = [
    { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <Zap className="w-4 h-4" /> },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 400));
    setIsSaving(false);
    toast.success('Settings saved successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your application preferences</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="btn-primary">
          {isSaving ? (
            <span className="inline-flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Saving...</span>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Save Changes</>
          )}
        </button>
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

        <div className="p-6 max-w-3xl">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'appearance' && <AppearanceSettings />}
          {activeTab === 'advanced' && <AdvancedSettings />}
        </div>
      </div>
    </div>
  );
}

function GeneralSettings() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Globe className="w-5 h-5" /> Language & Region</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="label">Language</label><select className="input"><option>English</option><option>हिन्दी</option><option>தமிழ்</option></select></div>
          <div><label className="label">Timezone</label><select className="input"><option>Asia/Kolkata</option><option>UTC</option></select></div>
          <div><label className="label">Date Format</label><select className="input"><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option></select></div>
          <div><label className="label">Time Format</label><select className="input"><option>24 Hour</option><option>12 Hour</option></select></div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Smartphone className="w-5 h-5" /> Device Preferences</h3>
        <div className="space-y-4">
          <PreferenceToggle label="Auto-sync Data" description="Automatically sync data when online" defaultChecked />
          <PreferenceToggle label="Background Sync" description="Allow sync in background" defaultChecked />
          <PreferenceToggle label="Cellular Data Sync" description="Allow sync over cellular data" />
          <PreferenceToggle label="Auto-download Attachments" description="Automatically download document attachments" defaultChecked />
        </div>
      </div>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Lock className="w-5 h-5" /> Password & Authentication</h3>
        <div className="space-y-4">
          <SecurityAction title="Change Password" description="Update your account password" actionLabel="Change Password" icon={<Lock className="w-5 h-5" />} onClick={() => toast('Navigate to Profile > Security')} />
          <SecurityAction title="Two-Factor Authentication" description="Add an extra layer of security with TOTP" actionLabel="Configure 2FA" icon={<Shield className="w-5 h-5" />} status="Enabled" statusColor="green" onClick={() => toast('Navigate to Profile > Security')} />
          <SecurityAction title="Backup Codes" description="Manage your 2FA backup codes" actionLabel="Manage Codes" icon={<Key className="w-5 h-5" />} status="10 codes available" onClick={() => toast('Navigate to Profile > Security')} />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Eye className="w-5 h-5" /> Security Alerts</h3>
        <div className="space-y-3">
          <PreferenceToggle label="New Login Alerts" description="Get notified of new logins" defaultChecked />
          <PreferenceToggle label="Password Change Alerts" description="Alert when password is changed" defaultChecked />
          <PreferenceToggle label="MFA Changes Alerts" description="Alert when MFA settings change" defaultChecked />
          <PreferenceToggle label="Suspicious Activity Alerts" description="Alert for unusual account activity" defaultChecked />
        </div>
      </div>
    </div>
  );
}

function NotificationSettings() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Bell className="w-5 h-5" /> Email Notifications</h3>
        <div className="space-y-3">
          <PreferenceToggle label="Case Assignment Notifications" description="When you're assigned to a new case" defaultChecked />
          <PreferenceToggle label="Document Upload Notifications" description="When documents are uploaded to your cases" defaultChecked />
          <PreferenceToggle label="Evidence Updates" description="When evidence status changes" defaultChecked />
          <PreferenceToggle label="RTI Request Updates" description="Status changes on your RTI requests" defaultChecked />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Bell className="w-5 h-5" /> Push Notifications</h3>
        <div className="space-y-3">
          <PreferenceToggle label="Urgent Alerts" description="Critical security and deadline alerts" defaultChecked />
          <PreferenceToggle label="Case Updates" description="Real-time case activity" defaultChecked />
          <PreferenceToggle label="Evidence Status Changes" description="Custody transfers and lab results" defaultChecked />
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Palette className="w-5 h-5" /> Theme</h3>
        <div className="grid grid-cols-3 gap-4">
          <ThemeCard name="Light" description="Clean light interface" icon={<Sun className="w-6 h-6" />} selected onSelect={() => {}} />
          <ThemeCard name="Dark" description="Easy on the eyes" icon={<Moon className="w-6 h-6" />} onSelect={() => {}} />
          <ThemeCard name="System" description="Follow system setting" icon={<Monitor className="w-6 h-6" />} onSelect={() => {}} />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Zap className="w-5 h-5" /> Density & Spacing</h3>
        <div className="grid grid-cols-3 gap-4">
          <DensityCard name="Comfortable" description="More whitespace" selected onSelect={() => {}} />
          <DensityCard name="Compact" description="More content on screen" onSelect={() => {}} />
          <DensityCard name="Condensed" description="Maximum density" onSelect={() => {}} />
        </div>
      </div>
    </div>
  );
}

function AdvancedSettings() {
  return (
    <div className="space-y-8">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-amber-600" />
          <div>
            <h3 className="font-medium text-amber-800">Advanced Settings</h3>
            <p className="text-amber-700 text-sm">These settings affect system behavior. Change with caution.</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Database className="w-5 h-5" /> Data & Storage</h3>
        <div className="space-y-4">
          <PreferenceToggle label="Auto-cleanup Old Drafts" description="Automatically delete draft documents older than 30 days" defaultChecked />
          <PreferenceToggle label="Compress Attachments" description="Automatically compress uploaded files" defaultChecked />
          <PreferenceToggle label="Local Cache" description="Cache frequently accessed documents locally" defaultChecked />
          <PreferenceToggle label="Offline Mode" description="Allow limited offline access to cached data" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Network className="w-5 h-5" /> Network & Sync</h3>
        <div className="space-y-4">
          <PreferenceToggle label="Auto-sync on Startup" description="Sync all data when app starts" defaultChecked />
          <PreferenceToggle label="Background Sync" description="Sync data in background every 15 minutes" defaultChecked />
          <PreferenceToggle label="Retry Failed Syncs" description="Automatically retry failed synchronizations" defaultChecked />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><HardDrive className="w-5 h-5" /> Cache Management</h3>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-900">Cache Size</p>
            <p className="text-sm text-gray-500">Current: 247 MB / 1 GB limit</p>
          </div>
          <button className="btn-secondary">Clear Cache</button>
        </div>
      </div>
    </div>
  );
}

function PreferenceToggle({ label, description, defaultChecked = false }: { label: string; description: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex-1">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => setChecked(e.target.checked)} />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
      </label>
    </div>
  );
}

function SecurityAction({ title, description, actionLabel, icon, status, statusColor, onClick }: { title: string; description: string; actionLabel: string; icon: React.ReactNode; status?: string; statusColor?: string; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600">{icon}</div>
        <div>
          <p className="font-medium text-gray-900">{title}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {status && <span className={`badge badge-${statusColor || 'gray'}`}>{status}</span>}
        <button onClick={onClick} className="btn-secondary">{actionLabel}</button>
      </div>
    </div>
  );
}

function ThemeCard({ name, description, icon, selected = false, onSelect }: { name: string; description: string; icon: React.ReactNode; selected?: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className={`p-4 rounded-xl border-2 transition-all ${selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}>
      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 mb-3">{icon}</div>
      <h4 className="font-semibold text-gray-900">{name}</h4>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
      {selected && <CheckCircle2 className="w-5 h-5 text-primary-500 mt-2" />}
    </button>
  );
}

function DensityCard({ name, description, selected = false, onSelect }: { name: string; description: string; selected?: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className={`p-4 rounded-xl border-2 transition-all ${selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}>
      <h4 className="font-semibold text-gray-900">{name}</h4>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
      {selected && <CheckCircle2 className="w-5 h-5 text-primary-500 mt-2" />}
    </button>
  );
}
