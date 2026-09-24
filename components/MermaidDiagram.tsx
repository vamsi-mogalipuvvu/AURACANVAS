import React, { useEffect, useRef, useState } from 'react';

interface MermaidDiagramProps {
  graphCode: string;
  sequenceCode: string;
  className?: string;
  title?: string;
}

type ViewMode = 'graph' | 'sequence';

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ 
  graphCode, 
  sequenceCode, 
  className = '', 
  title = 'diagram' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // View State
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [zoom, setZoom] = useState<number>(1);

  // Determine active code based on view mode
  const activeCode = viewMode === 'graph' ? graphCode : sequenceCode;

  // Auto-fit on content change
  useEffect(() => {
    if (svgContent && scrollContainerRef.current && containerRef.current) {
      // Small timeout to ensure rendering is complete and layout is stable
      const timer = setTimeout(() => {
        if (!scrollContainerRef.current || !containerRef.current) return;
        
        const parentWidth = scrollContainerRef.current.clientWidth;
        const parentHeight = scrollContainerRef.current.clientHeight;
        const contentWidth = containerRef.current.offsetWidth;
        const contentHeight = containerRef.current.offsetHeight;

        if (contentWidth > 0 && contentHeight > 0) {
          const padding = 40; 
          const scaleX = (parentWidth - padding) / contentWidth;
          
          // Fit to Width Logic:
          // We prioritize readability (width) over seeing the whole height at once.
          // If the diagram is tall, the user can scroll.
          // If the diagram is wide, we scale down to fit the width.
          
          let fitZoom = scaleX;
          
          // Constraints:
          // 1. Don't zoom in too much if the diagram is narrow (cap at 1.2x)
          fitZoom = Math.min(fitZoom, 1.2);
          
          // 2. Don't zoom out too much (cap at 0.2x)
          fitZoom = Math.max(fitZoom, 0.2);
          
          setZoom(fitZoom);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [svgContent]);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!window.mermaid) {
        setError("Mermaid.js not loaded");
        return;
      }

      // Initialize mermaid config for dark theme
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: 'Inter',
        themeVariables: {
          primaryColor: '#0ea5e9',
          primaryTextColor: '#fff',
          primaryBorderColor: '#38bdf8',
          lineColor: '#bae6fd',
          secondaryColor: '#1e293b',
          tertiaryColor: '#0f172a',
        }
      });

      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        // Pre-clean code to prevent common syntax errors (like empty lines breaking graphs)
        const cleanCode = activeCode.trim();
        const { svg } = await window.mermaid.render(id, cleanCode);
        
        // Clean SVG for Zoom compatibility
        // We remove hardcoded max-width/height so the container controls the size via Transform
        let cleanSvg = svg
          .replace(/max-width:\s*[^;"]+;/g, '')
          .replace(/height:\s*[^;"]+;/g, '');

        // Ensure SVG has intrinsic dimensions for the Transform to work on
        if (/<svg[^>]*\sstyle=['"]/.test(cleanSvg)) {
          cleanSvg = cleanSvg.replace(/style=['"]/, '$&overflow: visible; ');
        } else {
          cleanSvg = cleanSvg.replace(/<svg/, '<svg style="overflow: visible"');
        } 

        setSvgContent(cleanSvg);
        setError(null);
      } catch (err) {
        console.error("Mermaid render error:", err);
        setError(`Failed to render ${viewMode} syntax. The AI might have hallucinated invalid syntax.`);
      }
    };

    renderDiagram();
  }, [activeCode, viewMode]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeCode);
  };

  const handleDownload = () => {
    if (!svgContent) return;
    
    let svgWithBackground = svgContent;
    if (/<svg[^>]*\sstyle=['"]/.test(svgWithBackground)) {
      svgWithBackground = svgWithBackground.replace(/style=['"]/, '$&background-color: #050b14; ');
    } else {
      svgWithBackground = svgWithBackground.replace(/<svg/, '<svg style="background-color: #050b14;"');
    }

    const blob = new Blob([svgWithBackground], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    const filename = `${(title || 'aura_diagram').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${viewMode}`;
    link.download = `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));

  return (
    <div className={`w-full bg-dark-surface rounded-lg border border-dark-border flex flex-col ${className}`}>
      
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-aura-500/30 bg-dark-surface/80 backdrop-blur-md z-10 relative">
        
        {/* Left: View Toggles */}
        <div className="flex bg-black/40 p-1 rounded-md border border-aura-500/20">
          <button
            onClick={() => { setViewMode('graph'); setZoom(1); }}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all flex items-center gap-2 ${
              viewMode === 'graph' 
                ? 'bg-aura-600 text-white shadow-[0_0_15px_rgba(14,165,233,0.4)]' 
                : 'text-gray-500 hover:text-aura-300 hover:bg-white/5'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            System Arch
          </button>
          <button
            onClick={() => { setViewMode('sequence'); setZoom(1); }}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all flex items-center gap-2 ${
              viewMode === 'sequence' 
                ? 'bg-aura-600 text-white shadow-[0_0_15px_rgba(14,165,233,0.4)]' 
                : 'text-gray-500 hover:text-aura-300 hover:bg-white/5'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            Comm Flow
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-black/20 rounded border border-aura-500/10 px-1">
             <button onClick={handleZoomOut} className="p-1.5 text-aura-400 hover:text-white transition-colors" title="Zoom Out">
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M20 12H4" /></svg>
             </button>
             <span className="text-[9px] font-mono text-aura-500 w-8 text-center select-none">{Math.round(zoom * 100)}%</span>
             <button onClick={handleZoomIn} className="p-1.5 text-aura-400 hover:text-white transition-colors" title="Zoom In">
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
             </button>
          </div>

          <div className="h-4 w-[1px] bg-aura-500/20"></div>

          {/* Copy & Download */}
          <div className="flex gap-1">
            <button 
              onClick={handleCopy}
              className="p-1.5 text-aura-400 hover:text-white hover:bg-aura-500/20 rounded border border-transparent hover:border-aura-500/30 transition-all"
              title="Copy Mermaid Code"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
            <button 
              onClick={handleDownload}
              className="p-1.5 text-aura-400 hover:text-white hover:bg-aura-500/20 rounded border border-transparent hover:border-aura-500/30 transition-all"
              title="Download SVG"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Preview Area with Blueprint Grid */}
      <div className="relative w-full overflow-hidden bg-[#050b14] h-[500px] group">
        
        {/* Blueprint Grid Background */}
        <div className="absolute inset-0 pointer-events-none opacity-20" 
             style={{ 
               backgroundImage: `linear-gradient(rgba(14, 165, 233, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(14, 165, 233, 0.3) 1px, transparent 1px)`,
               backgroundSize: '20px 20px'
             }}>
        </div>
        <div className="absolute inset-0 pointer-events-none opacity-10" 
             style={{ 
               backgroundImage: `linear-gradient(rgba(14, 165, 233, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(14, 165, 233, 0.3) 1px, transparent 1px)`,
               backgroundSize: '100px 100px'
             }}>
        </div>

        <div 
          ref={scrollContainerRef}
          className="absolute inset-0 overflow-auto scrollbar-thin scrollbar-thumb-aura-500/20 scrollbar-track-transparent"
        >
          {error ? (
            <div className="text-red-400 p-8 font-mono text-sm bg-red-900/10 h-full w-full flex flex-col items-center justify-center text-center backdrop-blur-sm">
              <div className="w-16 h-16 mb-4 border border-red-500/30 rounded-full flex items-center justify-center bg-red-500/10 animate-pulse">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <p className="font-bold mb-2 tracking-widest uppercase text-red-500">Render Error</p>
              <p className="text-xs text-red-300/70 max-w-md bg-black/40 p-2 rounded border border-red-500/20">{error}</p>
            </div>
          ) : (
            <div 
              className="p-12 origin-top-left transition-transform duration-200 ease-out min-w-full min-h-full flex items-center justify-center"
              style={{ 
                transform: `scale(${zoom})`, 
                transformOrigin: 'top left',
                width: 'fit-content',
                height: 'fit-content'
              }}
            >
               <div 
                 ref={containerRef}
                 dangerouslySetInnerHTML={{ __html: svgContent }}
                 className="filter drop-shadow-[0_0_10px_rgba(14,165,233,0.1)]"
               />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MermaidDiagram;