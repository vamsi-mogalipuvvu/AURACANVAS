import React from 'react';
import { ChatMessage, ChatSession } from '../types';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onPurge: () => void;
  purgeConfirm: boolean;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  toggleSidebar, 
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat, 
  onPurge,
  purgeConfirm,
  onRenameSession,
  onDeleteSession
}) => {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  const startEditing = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (deleteConfirmId === sessionId) {
      onDeleteSession(sessionId);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(sessionId);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const saveEditing = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId && editTitle.trim()) {
      onRenameSession(editingId, editTitle.trim());
      setEditingId(null);
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#050b14] border-r border-aura-500/20 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header / New Chat */}
        <div className="p-4 border-b border-aura-500/10">
          <button 
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-4 py-3 bg-aura-500/10 hover:bg-aura-500/20 border border-aura-500/20 hover:border-aura-500/50 rounded-md transition-all group"
          >
            <div className="p-1 bg-aura-500/20 rounded-sm group-hover:bg-aura-500 group-hover:text-black transition-colors">
              <svg className="w-4 h-4 text-aura-400 group-hover:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-xs font-bold text-aura-100 tracking-wider uppercase">New Project</span>
          </button>
        </div>

        {/* Session History List */}
        <div className="flex-1 overflow-y-auto py-4 px-2 scrollbar-thin scrollbar-thumb-aura-900 scrollbar-track-transparent">
          <div className="px-2 mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Project Archives
          </div>
          
          <div className="space-y-1">
            {sessions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[10px] text-gray-600 italic">No project archives found.</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="relative group">
                  {editingId === session.id ? (
                    <form onSubmit={saveEditing} className="px-2 py-1">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={cancelEditing}
                        autoFocus
                        className="w-full bg-black/40 border border-aura-500/50 text-xs text-white px-2 py-1 focus:outline-none rounded font-mono"
                      />
                    </form>
                  ) : (
                    <>
                      <button
                        onClick={() => onSelectSession(session.id)}
                        className={`w-full text-left px-3 py-3 rounded group transition-colors relative overflow-hidden pr-16 ${
                          currentSessionId === session.id ? 'bg-aura-500/10 border border-aura-500/20' : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <div className={`text-xs truncate font-mono relative z-10 ${
                          currentSessionId === session.id ? 'text-aura-400 font-bold' : 'text-gray-300 group-hover:text-white'
                        }`}>
                          {session.title}
                        </div>
                        <div className="text-[9px] text-gray-600 group-hover:text-aura-400 mt-1 font-mono">
                          {new Date(session.timestamp).toLocaleDateString()} {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        
                        {/* Active Indicator */}
                        {currentSessionId === session.id && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-aura-500"></div>
                        )}
                      </button>

                      {/* Action Buttons (Visible on Hover) - Now Siblings */}
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        {/* Rename */}
                        <button 
                          onClick={(e) => startEditing(e, session)}
                          className="p-1 text-gray-500 hover:text-white cursor-pointer focus:outline-none bg-[#050b14]/80 rounded backdrop-blur-sm"
                          title="Rename Project"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {/* Delete */}
                        <button 
                          onClick={(e) => deleteSession(e, session.id)}
                          className={`p-1 cursor-pointer focus:outline-none bg-[#050b14]/80 rounded backdrop-blur-sm transition-colors ${
                            deleteConfirmId === session.id 
                              ? 'text-white bg-red-600 hover:bg-red-700' 
                              : 'text-red-500/70 hover:text-red-500'
                          }`}
                          title={deleteConfirmId === session.id ? "Click again to confirm" : "Delete Project"}
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {deleteConfirmId === session.id ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            )}
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer / User Profile & Purge */}
        <div className="p-4 border-t border-aura-500/10 bg-black/20">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-aura-600 to-aura-900 border border-aura-500/30 flex items-center justify-center">
              <span className="text-xs font-bold text-white">AR</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">Architect</div>
              <div className="text-[9px] text-aura-400 truncate">Level 5 Access</div>
            </div>
          </div>

          <button 
            onClick={onPurge}
            className={`w-full flex items-center justify-center gap-2 text-[10px] border px-3 py-2 uppercase tracking-widest transition-all rounded-sm group ${
              purgeConfirm 
                ? 'text-white bg-red-600 border-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.6)]' 
                : 'text-red-400 hover:text-white border-red-500/30 hover:bg-red-600/10 hover:border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.05)]'
            }`}
          >
            <svg className={`w-3 h-3 ${!purgeConfirm && 'group-hover:animate-pulse'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {purgeConfirm ? 'CONFIRM PURGE?' : 'PURGE MEMORY'}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
