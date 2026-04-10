import React, { useState, useRef, useEffect } from 'react';
import { generateArchitecture, generateCodeSnippet } from './services/githubService';
import MermaidDiagram from './components/MermaidDiagram';
import TypewriterText from './components/TypewriterText';
import { ChatMessage, ArchitectureResponse, CodeSnippetResponse, ChatSession } from './types';
import Sidebar from './components/Sidebar';

const SUGGESTIONS = [
  "SECURE PAYMENTS",
  "REAL-TIME CHAT",
  "VIDEO STREAMING",
  "IOT PIPELINE"
];

// Component Code Generator UI
interface CodeGeneratorProps {
  context: string;
}

const CodeGenerator: React.FC<CodeGeneratorProps> = ({ context }) => {
  const [target, setTarget] = useState('');
  const [snippetData, setSnippetData] = useState<CodeSnippetResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!target.trim()) return;
    setIsGenerating(true);
    setSnippetData(null);
    
    try {
      const result = await generateCodeSnippet(target, context);
      setSnippetData(result);
    } catch (error) {
      console.error("Failed to generate code", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mt-2 mx-2 p-4 bg-dark-bg/40 border border-green-500/20 backdrop-blur-sm relative overflow-hidden rounded-sm">
      {/* Decorative Green Accent */}
      <div className="absolute top-0 left-0 w-1 h-full bg-green-500/50"></div>
      
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
        <div className="text-[10px] text-green-400/80 uppercase tracking-widest font-bold">
          Component Code Generator
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 relative z-10">
         <input 
           type="text" 
           value={target}
           onChange={(e) => setTarget(e.target.value)}
           placeholder="Target Component (e.g. Auth Service)"
           className="flex-1 bg-black/40 border border-green-900/50 text-xs text-white px-3 py-2 focus:border-green-400 focus:bg-black/60 focus:outline-none transition-all placeholder-gray-600 font-mono"
         />
         <button
           onClick={handleGenerate}
           disabled={!target.trim() || isGenerating}
           className={`px-4 py-2 border border-green-500/50 bg-green-500/10 text-green-400 text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap
             ${!target.trim() || isGenerating 
               ? 'opacity-50 cursor-not-allowed' 
               : 'hover:bg-green-500/20 hover:shadow-[0_0_15px_rgba(74,222,128,0.2)] hover:border-green-400'
             }`}
         >
           {isGenerating ? 'GENERATING...' : 'GENERATE CODE'}
         </button>
      </div>

      {snippetData && (
        <div className="mt-4 animate-[fadeIn_0.3s_ease-out]">
           <div className="relative bg-[#0d1117] border border-green-900/50 p-4 shadow-inner group">
             <div className="absolute top-0 right-0 px-2 py-1 bg-green-900/30 text-[9px] text-green-400 uppercase tracking-wider border-bl border-l border-b border-green-900/50 font-mono flex gap-2">
                <span>{snippetData.language}</span>
             </div>
             <div className="mb-2 text-[10px] text-gray-500 font-mono border-b border-gray-800 pb-1">
                // {snippetData.description}
             </div>
             <pre className="text-[10px] sm:text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed selection:bg-green-900/50 selection:text-white scrollbar-thin scrollbar-thumb-green-900 scrollbar-track-transparent">
               {snippetData.code}
             </pre>
             
             {/* Subtle Glow Effect */}
             <div className="absolute -inset-px bg-green-500/5 pointer-events-none z-0"></div>
           </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const [isJarvisMode, setIsJarvisMode] = useState(false);
  const isJarvisModeRef = useRef(false);
  const [isAwake, setIsAwake] = useState(false);
  const isAwakeRef = useRef(false);
  const handleSubmitRef = useRef<any>(null);

  // Load chat history from localStorage
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('aura_chat_sessions');
        if (saved) {
          return JSON.parse(saved);
        }
        // Migrate old history if exists
        const oldSaved = localStorage.getItem('aura_chat_history');
        if (oldSaved) {
          const oldMessages = JSON.parse(oldSaved);
          if (oldMessages.length > 0) {
            return [{
              id: 'legacy-session',
              title: 'Legacy Project',
              timestamp: Date.now(),
              messages: oldMessages
            }];
          }
        }
      } catch (e) {
        console.warn("Failed to load chat sessions", e);
      }
    }
    return [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('aura_current_session');
        return saved || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState(false);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('aura_chat_sessions', JSON.stringify(sessions));
      if (currentSessionId) {
        localStorage.setItem('aura_current_session', currentSessionId);
      } else {
        localStorage.removeItem('aura_current_session');
      }
    } catch (e) {
      console.warn("Failed to save chat sessions", e);
    }
  }, [sessions, currentSessionId]);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession ? currentSession.messages : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  const setJarvis = (val: boolean) => {
    setIsJarvisMode(val);
    isJarvisModeRef.current = val;
  };

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true; // Enable real-time typing effect
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        console.log("Speech recognition started");
      };

      recognition.onend = () => {
        setIsListening(false);
        console.log("Speech recognition ended");
        if (isJarvisModeRef.current) {
          try {
            recognition.start();
          } catch (e) {
            console.log("Failed to restart recognition:", e);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === 'not-allowed') {
          alert("Microphone access denied. Please allow microphone access in your browser settings.");
          setJarvis(false);
          setIsListening(false);
        } else if (event.error === 'audio-capture') {
          alert("No microphone found or microphone is in use by another application.");
          setJarvis(false);
          setIsListening(false);
        } else if (event.error === 'aborted') {
          console.log("Speech recognition was aborted - likely permission issue");
          // Don't show alert for aborted, just log it
        } else if (event.error === 'no-speech') {
          console.log("No speech detected");
        } else {
          console.log("Speech recognition error:", event.error);
        }
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
           fullTranscript += event.results[i][0].transcript;
        }
        
        const lowerTranscript = fullTranscript.toLowerCase();

        if (!isAwakeRef.current) {
          // Looking for wake word
          if (lowerTranscript.includes('hey jarvis') || lowerTranscript.includes('hey, jarvis')) {
            setIsAwake(true);
            isAwakeRef.current = true;
            
            // Speak hello
            const utterance = new SpeechSynthesisUtterance("Hello");
            window.speechSynthesis.speak(utterance);
            
            setPrompt('');
            
            // Restart recognition to clear the transcript buffer
            recognition.stop(); 
          }
        } else {
          // Awake, listening for command and "execute"
          let displayTranscript = fullTranscript;
          const wakeWord = 'jarvis';
          const wakeIndex = displayTranscript.toLowerCase().lastIndexOf(wakeWord);
          if (wakeIndex !== -1) {
             displayTranscript = displayTranscript.substring(wakeIndex + wakeWord.length).trim();
          }
          
          // Strip out any leading punctuation that might be left over
          displayTranscript = displayTranscript.replace(/^[.,!?]\s*/, '');

          if (displayTranscript.toLowerCase().includes('execute')) {
            const cleanPrompt = displayTranscript.replace(/execute/gi, '').trim();
            setPrompt(cleanPrompt);
            
            setIsAwake(false);
            isAwakeRef.current = false;
            
            if (handleSubmitRef.current) {
               handleSubmitRef.current(undefined, cleanPrompt);
            }
            
            recognition.stop();
          } else {
            setPrompt(displayTranscript);
          }
        }
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const startJarvisMode = () => {
    setJarvis(true);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
    setShowWelcomeModal(false);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("VOICE MODULE NOT DETECTED. SYSTEM INCOMPATIBLE.");
      return;
    }
    if (isJarvisMode) {
      setJarvis(false);
      setIsAwake(false);
      isAwakeRef.current = false;
      recognitionRef.current.stop();
    } else {
      setJarvis(true);
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  };

  const handleReset = () => {
    if (!purgeConfirm) {
      setPurgeConfirm(true);
      setTimeout(() => setPurgeConfirm(false), 3000);
      return;
    }
    setSessions([]);
    setCurrentSessionId(null);
    localStorage.removeItem('aura_chat_sessions');
    localStorage.removeItem('aura_current_session');
    localStorage.removeItem('aura_chat_history');
    setPurgeConfirm(false);
  };

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Project',
      timestamp: Date.now(),
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
    }
  };

  const handleRenameSession = (sessionId: string, newTitle: string) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, title: newTitle } : s
    ));
  };

  const handleSubmit = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const inputPrompt = customPrompt || prompt;
    if (!inputPrompt.trim() || isLoading) return;

    let sessionId = currentSessionId;
    let updatedSessions = [...sessions];

    if (!sessionId) {
      sessionId = Date.now().toString();
      const newSession: ChatSession = {
        id: sessionId,
        title: inputPrompt.slice(0, 30) + (inputPrompt.length > 30 ? '...' : ''),
        timestamp: Date.now(),
        messages: []
      };
      updatedSessions = [newSession, ...updatedSessions];
      setCurrentSessionId(sessionId);
    } else {
      const sessionIndex = updatedSessions.findIndex(s => s.id === sessionId);
      if (sessionIndex !== -1 && updatedSessions[sessionIndex].messages.length === 0 && updatedSessions[sessionIndex].title === 'New Project') {
        updatedSessions[sessionIndex] = {
          ...updatedSessions[sessionIndex],
          title: inputPrompt.slice(0, 30) + (inputPrompt.length > 30 ? '...' : '')
        };
      }
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputPrompt,
      timestamp: Date.now(),
      sessionId: sessionId
    };

    updatedSessions = updatedSessions.map(s => 
      s.id === sessionId ? { ...s, messages: [...s.messages, userMsg] } : s
    );
    setSessions(updatedSessions);
    setPrompt('');
    setIsLoading(true);

    try {
      const data: ArchitectureResponse = await generateArchitecture(inputPrompt);
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.explanation,
        diagramData: data,
        timestamp: Date.now(),
        sessionId: sessionId
      };
      
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, messages: [...s.messages, aiMsg] } : s
      ));
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "CRITICAL ERROR: ARCHITECTURE GENERATION FAILED. CHECK NEURAL LINK.",
        timestamp: Date.now(),
        sessionId: sessionId
      };
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, messages: [...s.messages, errorMsg] } : s
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#050b14]">
      <Sidebar 
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={(id) => {
          setCurrentSessionId(id);
          if (window.innerWidth < 768) setIsSidebarOpen(false);
        }}
        onNewChat={handleNewChat}
        onPurge={handleReset}
        purgeConfirm={purgeConfirm}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
      />

      <div className="flex-1 flex flex-col h-screen text-white overflow-hidden font-mono relative z-10 selection:bg-aura-500 selection:text-black">
        
        {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg w-full bg-dark-surface/90 border border-aura-500 shadow-[0_0_50px_rgba(14,165,233,0.15)] p-8 relative overflow-hidden group">
            
            {/* Decorative Scanline */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_4px,6px_100%]"></div>
            
            {/* Corner Accents */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-aura-400"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-aura-400"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-aura-400"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-aura-400"></div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 mb-6 border border-aura-400 bg-aura-900/20 flex items-center justify-center rounded-full shadow-[0_0_20px_rgba(14,165,233,0.3)]">
                <svg className="w-8 h-8 text-aura-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-white mb-4 tracking-widest uppercase drop-shadow-[0_0_10px_rgba(14,165,233,0.8)]">
                Welcome to AURA Architect (v1.0)
              </h2>
              
              <div className="h-px w-24 bg-gradient-to-r from-transparent via-aura-500 to-transparent mb-6"></div>

              <p className="text-gray-300 mb-8 font-light leading-relaxed text-sm tracking-wide">
                This is a Voice-First Spatial Architecture Tool. Click the Microphone to speak a command, or type below. Use the Toggle to switch between System & Sequence views.
              </p>
              
              <button 
                onClick={startJarvisMode}
                className="group relative px-8 py-3 bg-aura-600 hover:bg-aura-500 text-white font-bold uppercase tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(14,165,233,0.4)] hover:shadow-[0_0_40px_rgba(14,165,233,0.6)] overflow-hidden"
              >
                <span className="relative z-10">Initialize System</span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HUD Header */}
      <header className="flex-none p-4 border-b border-aura-500/20 bg-dark-bg/80 backdrop-blur-md z-20 flex items-center justify-between shadow-[0_4px_20px_rgba(14,165,233,0.1)]">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-2 text-aura-400 hover:text-white hover:bg-aura-500/20 rounded-md transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="relative">
            <div className="w-10 h-10 border border-aura-400 bg-aura-900/20 flex items-center justify-center relative overflow-hidden group">
               <div className="absolute inset-0 bg-aura-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
               <svg className="w-6 h-6 text-aura-400 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            {/* Corner Markers */}
            <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-aura-500"></div>
            <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-aura-500"></div>
          </div>
          
          <div>
            <h1 className="text-2xl font-bold tracking-widest text-white uppercase" style={{ textShadow: '0 0 10px rgba(14,165,233,0.5)' }}>AURA</h1>
            <div className="flex items-center gap-2">
              <div className="h-[2px] w-4 bg-aura-500"></div>
              <p className="text-[10px] text-aura-400 tracking-[0.2em] uppercase">Canvas Architect v2.1</p>
            </div>
          </div>
        </div>
        
        <div className="hidden md:flex flex-col items-end gap-1">
           <div className="flex items-center gap-3">
             <button 
                onClick={handleReset}
                className="text-[10px] text-red-400/70 hover:text-red-400 border border-red-900/30 hover:bg-red-900/20 px-2 py-1 uppercase tracking-widest transition-all"
                title="Clear Chat History"
             >
               Purge Memory
             </button>
             <div className="flex items-center gap-2 text-xs text-aura-300/80">
               <span className="uppercase tracking-wider">Status:</span>
               <span className="text-green-400 animate-pulse">ONLINE</span>
             </div>
           </div>
           <div className="text-[10px] text-gray-500 font-mono">
             CORE: GITHUB GPT-4O
           </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto scroll-smooth p-4 md:p-8 space-y-8 container mx-auto max-w-6xl relative">
        
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-0 animate-[fadeIn_0.5s_ease-out_forwards] relative z-0" style={{ animationDelay: '0.1s' }}>
            <div className="text-center max-w-3xl border border-aura-500/20 bg-dark-surface/40 backdrop-blur-sm p-12 relative">
               {/* Decorative HUD Elements */}
               <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-aura-500"></div>
               <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-aura-500"></div>
               <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-aura-500"></div>
               <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-aura-500"></div>

              <h2 className="text-5xl md:text-6xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white to-aura-400 tracking-tight">
                INITIATE PROTOCOL
              </h2>
              <p className="text-aura-200/70 mb-12 text-lg font-light tracking-wide">
                AWAITING ARCHITECTURAL PARAMETERS. VOICE INPUT ACTIVE.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSubmit(undefined, suggestion)}
                    className="p-4 border border-aura-500/30 bg-aura-500/5 hover:bg-aura-500/20 hover:border-aura-400 transition-all duration-300 text-left group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-aura-400/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500"></div>
                    <span className="text-aura-500 block mb-1 text-[10px] font-bold opacity-70 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Seq_0{idx + 1}</span>
                    <span className="text-gray-300 group-hover:text-white text-sm relative z-10">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-4xl w-full rounded-none overflow-hidden relative ${
              msg.role === 'user' 
                ? 'bg-aura-900/20 border-r-2 border-aura-400' 
                : 'bg-dark-surface/60 border-l-2 border-aura-500'
            } backdrop-blur-md`}>
              
              {/* User Message Bubble */}
              {msg.role === 'user' && (
                <div className="p-6 text-right">
                  <div className="text-[10px] text-aura-400/60 uppercase tracking-widest mb-1">USER_INPUT</div>
                  <p className="text-xl text-white font-medium tracking-wide">{msg.content}</p>
                </div>
              )}

              {/* Assistant Message (Architecture) */}
              {msg.role === 'assistant' && (
                <div className="space-y-0 animate-[fadeIn_0.5s_ease-out]">
                  {/* Header Bar */}
                  <div className="bg-aura-900/30 p-3 border-b border-aura-500/20 flex items-center gap-3">
                     <div className="w-2 h-2 bg-aura-500 shadow-[0_0_10px_#0ea5e9]"></div>
                     <span className="text-xs text-aura-300 font-bold tracking-widest uppercase">
                       {msg.diagramData ? `ARCH_GEN: ${msg.diagramData.title}` : 'SYSTEM_MESSAGE'}
                     </span>
                  </div>

                  {/* Diagram Container */}
                  {msg.diagramData && (
                    <div className="relative p-1 bg-black/20 flex flex-col gap-1">
                      <MermaidDiagram 
                        graphCode={msg.diagramData.mermaidCode}
                        sequenceCode={msg.diagramData.sequenceCode} 
                        title={msg.diagramData.title}
                        className="!bg-transparent !border-0" 
                      />
                      
                      {/* Component Code Generator - Inserted here */}
                      <CodeGenerator context={msg.diagramData.title + " - " + msg.diagramData.explanation} />
                    </div>
                  )}

                  {/* Explanation Text */}
                  <div className="p-6 bg-gradient-to-r from-aura-900/10 to-transparent">
                     <div className="text-[10px] text-aura-500/50 uppercase tracking-widest mb-2">Analysis Log</div>
                     <TypewriterText text={msg.content} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start w-full">
            <div className="flex flex-col gap-2 max-w-xl w-full p-4 border-l-2 border-aura-500/50 bg-aura-900/10 animate-pulse">
              <div className="flex items-center gap-3 text-aura-400 font-mono text-xs tracking-widest uppercase">
                 <span className="w-1.5 h-1.5 bg-aura-400 animate-ping"></span>
                 Processing Logic Gates...
              </div>
              <div className="h-32 bg-aura-500/5 border border-dashed border-aura-500/20 flex items-center justify-center">
                 <div className="text-aura-500/50 text-xs uppercase tracking-[0.2em]">Constructing</div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* HUD Footer Input */}
      <footer className="flex-none p-4 md:p-6 bg-dark-bg/90 backdrop-blur-xl border-t border-aura-500/30 z-30 relative">
         {/* Decorative Top Line */}
         <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-aura-500 to-transparent opacity-50"></div>

        <div className="container mx-auto max-w-4xl relative">
          <form onSubmit={(e) => handleSubmit(e)} className="relative flex items-center group">
            
            {/* Input Field */}
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                isAwake ? "JARVIS AWAKE - SPEAK COMMAND THEN SAY 'EXECUTE'..." : 
                isJarvisMode ? "WAITING FOR WAKE WORD 'HEY JARVIS'..." : 
                "ENTER COMMAND OR CLICK MIC..."
              }
              disabled={isLoading}
              className={`w-full bg-dark-surface/80 border ${isAwake ? 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.3)]' : isListening ? 'border-aura-400 shadow-[0_0_20px_rgba(14,165,233,0.2)]' : 'border-aura-500/30'} py-4 pl-14 pr-32 text-white placeholder-aura-500/30 focus:outline-none focus:border-aura-400 focus:bg-dark-surface transition-all uppercase tracking-wider font-mono text-sm`}
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 98% 100%, 0 100%)' }}
            />

            {/* Mic Button - Inside Input, Left */}
            <button
              type="button"
              onClick={toggleListening}
              className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-sm transition-all duration-300 ${
                isJarvisMode ? 'text-red-500' : 'text-gray-500 hover:text-aura-400'
              }`}
              title="Toggle Voice Input"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {isJarvisMode && (
                <div className="absolute -top-1 -right-1 w-3 h-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                </div>
              )}
            </button>

            {/* Submit Button - Inside Input, Right */}
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-aura-600 hover:bg-aura-500 text-white text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-aura-400"
              style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 100%, 0 100%)' }}
            >
              {isLoading ? 'PROC...' : 'EXECUTE'}
            </button>
            
          </form>
          
          <div className="flex justify-between items-center mt-2 px-2 opacity-50">
             <div className="text-[9px] text-aura-400 uppercase tracking-[0.2em] flex gap-2">
                <span>MEM: 64TB</span>
                <span>LATENCY: 12ms</span>
             </div>
             <p className="text-[9px] text-aura-500 uppercase tracking-widest">AURA ARCHITECT // GITHUB GPT-4O</p>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default App;