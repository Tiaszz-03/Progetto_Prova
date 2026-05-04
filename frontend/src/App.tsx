/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Ship, FileText, ClipboardList, Send, LayoutDashboard, ChevronRight } from "lucide-react";
import { ShipmentDashboard } from "./components/ShipmentDashboard";
import { ShipmentDetails } from "./components/ShipmentDetails";

export default function App() {
  const uploadInputRef = useRef<HTMLInputElement>(null);

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <div className="fixed inset-y-0 left-0 w-64 bg-slate-900 text-white p-6 shadow-xl hidden md:block">
          <div className="flex items-center gap-3 mb-10">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Ship className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">FreightAgent</h1>
          </div>

          <nav className="space-y-1">
            <NavItem to="/" icon={<LayoutDashboard className="w-5 h-5" />} label="Shipments" active />
            <NavItem to="#" icon={<FileText className="w-5 h-5" />} label="Documents" />
            <NavItem to="#" icon={<ClipboardList className="w-5 h-5" />} label="Reports" />
            <NavItem to="#" icon={<Send className="w-5 h-5" />} label="Integrations" />
          </nav>

          <div className="absolute bottom-10 left-6">
            <p className="text-xs text-slate-400">User: rbenassi@tradefast.eu</p>
          </div>
        </div>

        <div className="md:pl-64">
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <span>Operations</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-slate-900 font-medium">Shipment Tracker</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                + New Shipment
              </button>
            </div>
          </header>

          <main className="p-8">
            <Routes>
              <Route path="/" element={<ShipmentDashboard uploadInputRef={uploadInputRef} />} />
              <Route path="/shipment/:id" element={<ShipmentDetails />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

function NavItem({
  to = "#",
  icon,
  label,
  active = false,
}: {
  to?: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        active ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  );
}
