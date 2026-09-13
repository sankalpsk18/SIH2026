// ============================================================================
// ADALAT360 - Settings Page
// Application settings and preferences
// ============================================================================

import React, { useState } from 'react';
import {
  Loader2,
  Save,
  Shield,
  Lock,
  Bell,
  Moon,
  Sun,
  Globe,
  Database,
  Network,
  HardDrive,
  Settings,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
  Key,
  Smartphone,
  Monitor,
  Printer,
  Palette,
  Zap,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

export function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'notifications' | 'appearance' | 'advanced'>('general');
  const [isSaving, setIsSaving] = useState(false);

  const tabs = [
    { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <Zap className="w-4 h-4" /> },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    // In production, call API to save settings
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsSaving(false);
    toast.success('Settings saved successfully');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your application preferences</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="btn-primary">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : ''}
          Save Changes
        </button>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="tabs border-b border-gray-200 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            >
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
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Info className="w-5 h-5" />
          Account Information
        </h3>
        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <SettingItem label="Full Name" value="Rajesh Sharma" description="Your display name" />
          <SettingItem label="Email" value="officer.sharma@adalat360.gov.in" description="Primary email address" />
          <SettingItem label="Employee ID" value="ADM001" description="Unique employee identifier" />
          <SettingItem label="Role" value="Investigating Officer" description="Your system role" />
          <SettingItem label="Department" value="Delhi Police" description="Your organizational unit" />
          <SettingItem label="Badge Number" value="DL-IO-001" description="Official badge number" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Language & Region
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Language</label>
            <select className="input">
              <option>English (US)</option>
              <option>English (UK)</option>
              <option>हिन्दी (Hindi)</option>
              <option>தமிழ் (Tamil)</option>
              <option>বাংলা (Bengali)</option>
            </select>
          </div>
          <div>
            <label className="label">Timezone</label>
            <select className="input">
              <option>Asia/Kolkata (UTC+5:30)</option>
              <option>UTC</option>
              <option>America/New_York (UTC-5)</option>
              <option>Europe/London (UTC+0)</option>
            </select>
          </div>
          <div>
            <label className="label">Date Format</label>
            <select className="input">
              <option>DD/MM/YYYY</option>
              <option>MM/DD/YYYY</option>
              <option>YYYY-MM-DD</option>
            </select>
          </div>
          <div>
            <label className="label">Time Format</label>
            <select className="input">
              <option>24 Hour</option>
              <option>12 Hour</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Device Preferences
        </h3>
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
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Password & Authentication
        </h3>
        <div className="space-y-4">
          <SecurityAction
            title="Change Password"
            description="Update your account password"
            actionLabel="Change Password"
            icon={<Lock className="w-5 h-5" />}
            onClick={() => alert('Navigate to Profile > Security')}
          />
          <SecurityAction
            title="Two-Factor Authentication"
            description: "Add an extra layer of security with TOTP",
            actionLabel="Configure 2FA",
            icon={<Shield className="w-5 h-5" />}
            status="Enabled"
            statusColor="green"
            onClick={() => alert('Navigate to Profile > Security')}
          />
          <SecurityAction
            title="Backup Codes"
            description: "Manage your 2FA backup codes",
            actionLabel: "Manage Codes",
            icon={<Key className="w-5 h-5" />}
            status="10 codes available"
            onClick={() => alert('Navigate to Profile > Security')}
          />
          <SecurityAction
            title="Password History",
            description: "View your password change history",
            actionLabel: "View History",
            icon={<Clock className="w-5 h-5" />}
            onClick={() => alert('Feature coming soon')}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Session Security
        </h3>
        <div className="space-y-4">
          <SecurityAction
            title="Active Sessions"
            description: "View and manage active login sessions",
            actionLabel: "View Sessions",
            icon={<Smartphone className="w-5 h-5" />}
            status: "3 active"
            onClick={() => alert('Navigate to Profile > Sessions')}
          />
          <SecurityAction
            title: "Session Timeout",
            description: "Configure automatic logout time",
            actionLabel: "Configure",
            icon={<Clock className="w-5 h-5" />}
            status: "60 minutes"
            onClick={() => alert('Configure in Advanced settings')}
          />
          <SecurityAction
            title: "Concurrent Session Limit",
            description: "Maximum simultaneous logins",
            actionLabel: "Configure",
            icon={<Users className="w-5 h-5" />}
            status: "3 sessions"
            onClick={() => alert('Configure in Advanced settings')}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Security Alerts
        </h3>
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
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Email Notifications
        </h3>
        <div className="space-y-3">
          <PreferenceToggle label="Case Assignment Notifications" description="When you're assigned to a new case" defaultChecked />
          <PreferenceToggle label="Document Upload Notifications" description="When documents are uploaded to your cases" defaultChecked />
          <PreferenceToggle label="Evidence Updates" description="When evidence status changes" defaultChecked />
          <PreferenceToggle label="Custody Transfer Alerts" description="When evidence custody changes" defaultChecked />
          <PreferenceToggle label="Lab Result Notifications" description="When forensic results are ready" defaultChecked />
          <PreferenceToggle label="Court Deadline Reminders" description="Upcoming court dates and deadlines" defaultChecked />
          <PreferenceToggle label="RTI Request Updates" description="Status changes on your RTI requests" defaultChecked />
          <PreferenceToggle label="Weekly Digest" description="Weekly summary of case activity" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Push Notifications
        </h3>
        <div className="space-y-3">
          <PreferenceToggle label="Urgent Alerts" description="Critical security and deadline alerts" defaultChecked />
          <PreferenceToggle label="Case Updates" description="Real-time case activity" defaultChecked />
          <PreferenceToggle label="Evidence Status Changes" description="Custody transfers and lab results" defaultChecked />
          <PreferenceToggle label="Document Activities" description="Uploads, versions, approvals" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Send className="w-5 h-5" />
          SMS Notifications
        </h3>
        <div className="space-y-3">
          <PreferenceToggle label="Critical Security Alerts" description="Account compromise, password resets" defaultChecked />
          <PreferenceToggle label="Urgent Deadline Reminders" description="Court dates, filing deadlines" defaultChecked />
          <PreferenceToggle label="MFA Verification Codes" description="Backup delivery for 2FA codes" defaultChecked />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Notification Timing
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Quiet Hours Start</label>
            <input type="time" className="input" defaultValue="22:00" />
          </div>
          <div>
            <label className="label">Quiet Hours End</label>
            <input type="time" className="input" defaultValue="07:00" />
          </div>
          <div>
            <label className="label">Digest Frequency</label>
            <select className="input">
              <option>Immediate</option>
              <option>Hourly</option>
              <option>Daily (9 AM)</option>
              <option>Weekly (Monday 9 AM)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Theme
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <ThemeCard
            name="Light"
            description="Clean light interface"
            icon={<Sun className="w-6 h-6" />}
            selected={true}
            onSelect={() => {}}
          />
          <ThemeCard
            name="Dark"
            description="Easy on the eyes"
            icon={<Moon className="w-6 h-6" />}
            onSelect={() => {}}
          />
          <ThemeCard
            name="System"
            description="Follow system setting"
            icon={<Monitor className="w-6 h-6" />}
            onSelect={() => {}}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Density & Spacing
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <DensityCard name="Comfortable" description="More whitespace" selected={true} onSelect={() => {}} />
          <DensityCard name="Compact" description="More content on screen" onSelect={() => {}} />
          <DensityCard name="Condensed" description="Maximum density" onSelect={() => {}} />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Visual Preferences
        </h3>
        <div className="space-y-4">
          <PreferenceToggle label="Animations" description="Enable UI animations and transitions" defaultChecked />
          <PreferenceToggle label="Reduced Motion" description="Minimize animations for accessibility" />
          <PreferenceToggle label="High Contrast" description="Increase color contrast for readability" />
          <PreferenceToggle label="Focus Indicators" description="Show visible focus outlines" defaultChecked />
          <PreferenceToggle label="Tooltips" description="Show contextual help tooltips" defaultChecked />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Accent Color
        </h3>
        <div className="flex flex-wrap gap-3">
          {['#2563eb', '#059669', '#7c3aed', '#ea580c', '#dc2626', '#0891b2', '#65a30d', '#d97706'].map(color => (
            <button
              key={color}
              className={`w-10 h-10 rounded-full border-2 transition-all ${
                color === '#2563eb' ? 'ring-2 ring-offset-2 ring-primary-500' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => {}}
              title={color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AdvancedSettings() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          <div>
            <h3 className="font-medium text-amber-800">Advanced Settings</h3>
            <p className="text-amber-700 text-sm">These settings affect system behavior. Change with caution.</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Data & Storage
        </h3>
        <div className="space-y-4">
          <PreferenceToggle label="Auto-cleanup Old Drafts" description="Automatically delete draft documents older than 30 days" defaultChecked />
          <PreferenceToggle label="Compress Attachments" description="Automatically compress uploaded files" defaultChecked />
          <PreferenceToggle label="Local Cache" description="Cache frequently accessed documents locally" defaultChecked />
          <PreferenceToggle label="Offline Mode" description="Allow limited offline access to cached data" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Network className="w-5 h-5" />
          Network & Sync
        </h3>
        <div className="space-y-4">
          <PreferenceToggle label="Auto-sync on Startup" description="Sync all data when app starts" defaultChecked />
          <PreferenceToggle label="Background Sync" description="Sync data in background every 15 minutes" defaultChecked />
          <PreferenceToggle label="Delta Sync Only" description="Only sync changed data to save bandwidth" defaultChecked />
          <PreferenceToggle label="Retry Failed Syncs" description="Automatically retry failed synchronizations" defaultChecked />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Cache Management
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Cache Size</p>
              <p className="text-sm text-gray-500">Current: 247 MB / 1 GB limit</p>
            </div>
            <button className="btn-secondary">Clear Cache</button>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Offline Documents</p>
              <p className="text-sm text-gray-500">Current: 23 documents / 45 MB</p>
            </div>
            <button className="btn-secondary">Clear Offline Data</button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Developer Options
        </h3>
        <div className="space-y-4">
          <PreferenceToggle label="Debug Logging" description="Enable verbose console logging" />
          <PreferenceToggle label="Network Request Logging" description="Log all API requests and responses" />
          <PreferenceToggle label="Performance Monitoring" description="Track render times and API latency" />
          <PreferenceToggle label="Mock API Responses" description="Use mock data instead of real API" />
        </div>
      </div>

      <div className="pt-8 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Info className="w-5 h-5" />
          Application Information
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Version" value="1.0.0" />
          <InfoRow label="Build" value="2024.01.15-1423" />
          <InfoRow label="Environment" value="Production" />
          <InfoRow label="API Endpoint" value="https://api.adalat360.gov.in/v1" />
          <InfoRow label="Node.js" value="20.10.0" />
          <InfoRow label="React" value="18.2.0" />
        </div>
      </div>
    </div>
  );
}

function SettingItem({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-100 last:border-0">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <span className="font-mono text-gray-700">{value}</span>
    </div>
  );
}

function PreferenceToggle({ label, description, defaultChecked = false, onChange }: { label: string; description: string; defaultChecked?: boolean; onChange?: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex-1">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => { setChecked(e.target.checked); onChange?.(e.target.checked); }}
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
      </label>
    </div>
  );
}

function SecurityAction({ title, description, actionLabel, icon, status, statusColor, onClick }: { title: string; description: string; actionLabel: string; icon: React.ReactNode; status?: string; statusColor?: string; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600">
          {icon}
        </div>
        <div>
          <p className="font-medium text-gray-900">{title}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {status && (
          <span className={`badge badge-${statusColor || 'gray'}`}>{status}</span>
        )}
        <button onClick={onClick} className="btn-secondary">
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function ThemeCard({ name, description, icon, selected = false, onSelect }: { name: string; description: string; icon: React.ReactNode; selected?: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-200 hover:border-primary-300'
      }`}
    >
      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 mb-3">
        {icon}
      </div>
      <h4 className="font-semibold text-gray-900">{name}</h4>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
      {selected && <CheckCircle2 className="w-5 h-5 text-primary-500 mt-2" />}
    </button>
  );
}

function DensityCard({ name, description, selected = false, onSelect }: { name: string; description: string; selected?: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-200 hover:border-primary-300'
      }`}
    >
      <h4 className="font-semibold text-gray-900">{name}</h4>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
      {selected && <CheckCircle2 className="w-5 h-5 text-primary-500 mt-2" />}
    </button>
  );
}

function ThemeCard({ name, description, icon, selected = false, onSelect }: { name: string; description: string; icon: React.ReactNode; selected?: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-200 hover:border-primary-300'
      }`}
    >
      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 mb-3">
        {icon}
      </div>
      <h4 className="font-semibold text-gray-900">{name}</h4>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
      {selected && <CheckCircle2 className="w-5 h-5 text-primary-500 mt-2" />}
    </button>
  );
}

function DensityCard({ name, description, selected = false, onSelect }: { name: string; description: string; selected?: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-200 hover:border-primary-300'
      }`}
    >
      <h4 className="font-semibold text-gray-900">{name}</h4>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
      {selected && <CheckCircle2 className="w-5 h-5 text-primary-500 mt-2" />}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="font-mono text-sm text-gray-900">{value}</p>
    </div>
  );
}