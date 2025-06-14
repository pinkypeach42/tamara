import React, { useEffect, useRef, useCallback } from 'react';

interface EEGSample {
  timestamp: number;
  channels: number[];
}

interface EEGWaveformProps {
  data: EEGSample[];
  isActive: boolean;
  channelCount?: number;
  channelNames?: string[];
  title?: string;
  isFiltered?: boolean;
}

const EEGWaveform: React.FC<EEGWaveformProps> = ({ 
  data, 
  isActive, 
  channelCount = 8, 
  channelNames,
  title = "EEG Waveform",
  isFiltered = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const lastDrawTime = useRef<number>(0);

  // Premium color palette for different channels
  const channelColors = [
    '#2563EB', '#DC2626', '#059669', '#7C3AED', '#EA580C', '#0891B2', '#BE185D', '#65A30D',
    '#4338CA', '#B91C1C', '#047857', '#9333EA', '#C2410C', '#0E7490', '#A21CAF', '#84CC16',
  ];

  const getChannelLabels = useCallback((count: number, names?: string[]) => {
    if (names && names.length >= count) {
      return names.slice(0, count);
    }
    
    const standardLabels = ['Fp1', 'Fp2', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2'];
    if (count <= 8) return standardLabels.slice(0, count);
    
    return Array.from({ length: count }, (_, i) => `Ch${i + 1}`);
  }, []);

  const channelLabels = getChannelLabels(channelCount, channelNames);

  // Optimized drawing function with performance improvements
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Performance optimization: limit frame rate to 30 FPS
    const now = performance.now();
    if (now - lastDrawTime.current < 33) { // ~30 FPS
      if (isActive) {
        animationRef.current = requestAnimationFrame(draw);
      }
      return;
    }
    lastDrawTime.current = now;

    // Set canvas size with high DPI support
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Limit DPR for performance
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const channelHeight = height / channelCount;

    // Clear canvas with solid background for better performance
    ctx.fillStyle = isFiltered ? '#faf9f7' : '#fefefe';
    ctx.fillRect(0, 0, width, height);

    if (data.length < 2) {
      // Simplified waiting state
      ctx.fillStyle = 'rgba(11, 49, 66, 0.4)';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Initializing Neural Interface...', width / 2, height / 2 - 20);
      
      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = 'rgba(11, 49, 66, 0.3)';
      ctx.fillText(`${channelCount}-channel ${isFiltered ? 'filtered' : 'raw'} EEG`, width / 2, height / 2 + 10);
      return;
    }

    // Draw simplified channel separators
    ctx.strokeStyle = 'rgba(11, 49, 66, 0.06)';
    ctx.lineWidth = 1;

    for (let ch = 0; ch < channelCount; ch++) {
      const y = ch * channelHeight;
      
      if (ch > 0) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Simplified channel labels
      const labelY = y + channelHeight / 2;
      const channelColor = channelColors[ch % channelColors.length];
      
      ctx.fillStyle = channelColor + '30';
      ctx.fillRect(8, labelY - 10, 40, 20);
      
      ctx.fillStyle = channelColor;
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(channelLabels[ch], 28, labelY + 3);

      // Simplified center line
      ctx.strokeStyle = 'rgba(11, 49, 66, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(55, labelY);
      ctx.lineTo(width - 10, labelY);
      ctx.stroke();
    }

    // Optimized waveform drawing
    if (data.length > 1) {
      // Use only recent data for better performance
      const recentData = data.slice(-500); // Last 2 seconds at 250Hz
      
      for (let ch = 0; ch < channelCount; ch++) {
        const channelData = recentData.map(sample => sample.channels[ch] || 0);
        const maxValue = Math.max(...channelData.map(Math.abs));
        const scale = maxValue > 0 ? (channelHeight * 0.35) / maxValue : 1;
        const centerY = ch * channelHeight + channelHeight / 2;
        const channelColor = channelColors[ch % channelColors.length];

        ctx.strokeStyle = channelColor;
        ctx.lineWidth = isFiltered ? 2 : 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Simplified drawing without shadows for performance
        ctx.beginPath();
        
        const step = Math.max(1, Math.floor(channelData.length / 400)); // Reduce points for performance
        
        for (let i = 0; i < channelData.length; i += step) {
          const x = 55 + ((i / (channelData.length - 1)) * (width - 65));
          const y = centerY - (channelData[i] * scale);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.stroke();
      }
    }

    // Simplified info overlay
    ctx.fillStyle = 'rgba(11, 49, 66, 0.6)';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('μV', width - 10, 25);
    
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(11, 49, 66, 0.4)';
    ctx.fillText(`250Hz • ${channelCount}Ch • ${isFiltered ? 'Filtered' : 'Raw'}`, width - 10, height - 10);
    
    // Simple live indicator
    if (isActive) {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(width - 30, 15, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [data, isActive, channelCount, channelLabels, isFiltered]);

  useEffect(() => {
    if (isActive) {
      animationRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw, isActive]);

  // Trigger redraw when data changes
  useEffect(() => {
    if (isActive) {
      draw();
    }
  }, [data, draw, isActive]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-80 rounded-2xl zen-shadow-lg"
        style={{ 
          imageRendering: 'auto',
          background: isFiltered ? '#faf9f7' : '#fefefe',
          border: '1px solid rgba(11, 49, 66, 0.08)'
        }}
      />
      
      {/* Status indicator */}
      {isActive && (
        <div className="absolute top-4 right-4">
          <div className="premium-card px-3 py-1.5 flex items-center">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full mr-2 animate-pulse" />
            <span className="text-xs text-[#0B3142] font-bold tracking-wide">LIVE</span>
          </div>
        </div>
      )}

      {/* Simplified channel legend */}
      <div className="absolute bottom-4 left-4 premium-card p-3 max-w-md">
        <div className="text-xs font-semibold text-[#0B3142] mb-2 opacity-70">
          {title} • {channelCount} Channels
        </div>
        <div className={`grid gap-2 text-xs ${channelCount <= 8 ? 'grid-cols-4' : 'grid-cols-6'}`}>
          {channelLabels.slice(0, Math.min(channelLabels.length, 12)).map((label, index) => (
            <div key={label} className="flex items-center gap-1.5">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: channelColors[index % channelColors.length] }}
              />
              <span className="text-[#0B3142] font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter indicator */}
      {isFiltered && (
        <div className="absolute top-4 left-4">
          <div className="premium-card px-2 py-1 flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-1.5" />
            <span className="text-xs text-[#0B3142] font-semibold">1-40Hz • 50Hz Notch</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EEGWaveform;