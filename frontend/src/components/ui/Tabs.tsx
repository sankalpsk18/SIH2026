// ============================================================================
// ADALAT360 - Tabs Component
// ============================================================================

import React, { useState, ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  variant?: 'default' | 'pills' | 'underline';
}

export function Tabs({ tabs, activeTab, onChange, className = '', variant = 'default' }: TabsProps) {
  const variantStyles = {
    default: 'border-b border-gray-200',
    pills: '',
    underline: 'border-b border-gray-200',
  };

  const tabStyles = {
    default: 'px-4 py-3 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-primary-600 hover:border-primary-300 transition-colors',
    pills: 'px-4 py-2 text-sm font-medium text-gray-500 rounded-lg hover:text-primary-600 hover:bg-primary-50 transition-colors',
    underline: 'px-4 py-3 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-primary-600 hover:border-primary-300 transition-colors',
  };

  const activeStyles = {
    default: 'text-primary-600 border-primary-600',
    pills: 'text-primary-600 bg-primary-50',
    underline: 'text-primary-600 border-primary-600',
  };

  return (
    <div className={className} role="tablist">
      <div className={variantStyles[variant]}>
        <nav className="flex" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && onChange(tab.id)}
              disabled={tab.disabled}
              className={`flex items-center gap-2 ${tabStyles[variant]} ${activeTab === tab.id ? activeStyles[variant] : ''} ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
            >
              {tab.icon && <span className="w-4 h-4 flex-shrink-0">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-4">
        {tabs.map((tab) => (
          <div
            key={`panel-${tab.id}`}
            role="tabpanel"
            id={`panel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            hidden={activeTab !== tab.id}
          >
            {/* Tab content is rendered by parent via conditional rendering */}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TabPanels({ tabs, activeTab, children }: { tabs: Tab[]; activeTab: string; children: ReactNode }) {
  const activeTabObj = tabs.find(t => t.id === activeTab);
  return (
    <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} hidden={!activeTabObj}>
      {activeTabObj ? children : null}
    </div>
  );
}