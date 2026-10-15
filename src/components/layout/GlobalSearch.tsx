"use client";

import { useState } from "react";
import * as Icons from "lucide-react";

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative w-full">
      <div
        className="flex items-center w-full bg-gray-100 hover:bg-gray-200 border border-transparent rounded-md px-3 py-1.5 cursor-pointer transition-colors"
        onClick={() => setIsOpen(true)}
      >
        <Icons.Search className="h-4 w-4 text-gray-500 mr-2" />
        <span className="text-sm text-gray-500 flex-1">Search VEYRA...</span>
        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 font-medium">
          <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded shadow-sm">Ctrl</kbd>
          <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded shadow-sm">K</kbd>
        </div>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 bg-gray-900/50 z-40" onClick={() => setIsOpen(false)} />
          <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
            <div className="flex items-center px-4 py-3 border-b border-gray-100">
              <Icons.Search className="h-5 w-5 text-gray-400 mr-3" />
              <input
                type="text"
                placeholder="Search across all modules..."
                className="flex-1 outline-none text-lg bg-transparent"
                autoFocus
              />
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded">ESC</kbd>
            </div>
            <div className="p-4 bg-gray-50 h-64 overflow-y-auto">
              <div className="text-center text-sm text-gray-500 mt-10">
                <Icons.Activity className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                <p>Global search foundation is ready.</p>
                <p>Type to search records across your authorized modules.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
