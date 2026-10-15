"use client";

import { useState, useRef, useEffect } from "react";
import * as Icons from "lucide-react";

export function Notifications() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Placeholder state for unread
  const unreadCount = 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Icons.Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg py-1 border border-gray-200 z-50 flex flex-col max-h-96">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                Mark all read
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {unreadCount === 0 ? (
              <div className="text-center py-6">
                <Icons.CheckCircle2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">You&apos;re all caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Notification Items will go here */}
              </div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-gray-100 text-center">
            <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
