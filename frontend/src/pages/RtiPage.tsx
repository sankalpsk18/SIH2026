import React from 'react';
import { Mail, Plus, Search } from 'lucide-react';

export function RtiPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RTI Requests</h1>
          <p className="text-gray-600 mt-1">Manage Right to Information requests</p>
        </div>
        <button className="btn-primary"><Plus className="w-4 h-4 mr-2" />New RTI Request</button>
      </div>

      <div className="card p-4">
        <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <label className="label">Search</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search by request number or applicant" className="input pl-10" />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input"><option value="">All Statuses</option><option>Received</option><option>Under Process</option></select>
          </div>
          <div>
            <label className="label">Action</label>
            <button type="submit" className="btn-primary w-full">Filter</button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="p-12 text-center text-gray-500">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No RTI requests found</p>
          <p className="text-sm text-gray-400 mt-1">Submit your first RTI request</p>
        </div>
      </div>
    </div>
  );
}
