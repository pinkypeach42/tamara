import React, { useEffect, useRef } from 'react';

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

  // Premium color palette for different channels
  const channelColors = [
    '#2563EB', // Royal Blue
    '#DC2626', // Crimson Red  
    '#059669', // Emerald Green
    '#7C3AED', // Violet Purple
    '#EA580C', // Orange
    '#0891B2', // Cyan
    '#BE185D', // Pink
    '#65A30D', // Lime Green
    '#4338CA', // Indigo
    '#B91C1C', // Red
    '#047857', // Teal
    '#9333EA', // Purple
    '#C2410C', // Orange Red
    '#0E7490', // Sky Blue
    '#A21CAF', // Fuchsia
    '#84CC16', // Lime
  ];

  const getChannelLabels = (count: number, names?: string[]) => {
    if (names && names.length >= count) {
      return names.slice(0, count);
    }
    
    const standardLabels = ['Fp1', 'Fp2', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2'];
    if (count <= 8) return standardLabels.slice(0, count);
    
    // For more than 8 channels, use generic labels
    return Array.from({ length: count }, (_, i) => `Ch${i + 1}`);
  };

  const channelLabels = getChannelLabels(channelCount, channelNames);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Set canvas size with high DPI support
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      
      const width = rect.width;
      const height = rect.height;
      const channelHeight = height / channelCount;

      // Premium gradient background
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      if (isFiltered) {
        gradient.addColorStop(0, 'rgba(244, 237, 234, 0.98)');
        gradient.addColorStop(0.5, 'rgba(244, 209, 174, 0.08)');
        gradient.addColorStop(1, 'rgba(11, 49, 66, 0.03)');
      } else {
        gradient.addColorStop(0, 'rgba(244, 237, 234, 0.95)');
        gradient.addColorStop(0.5, 'rgba(244, 209, 174, 0.05)');
        gradient.addColorStop(1, 'rgba(11, 49, 66, 0.02)');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      if (data.length < 2) {
        // Elegant waiting state
        ctx.fillStyle = 'rgba(11, 49, 66, 0.4)';
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Initializing Neural Interface...', width / 2, height / 2 - 30);
        
        ctx.font = '16px Inter, sans-serif';
        ctx.fillStyle = 'rgba(11, 49, 66, 0.3)';
        ctx.fillText(`${channelCount}-channel ${isFiltered ? 'filtered' : 'raw'} EEG visualization`, width / 2, height / 2 + 10);
        
        // Subtle pulsing indicator
        const pulseAlpha = 0.3 + 0.2 * Math.sin(Date.now() * 0.003);
        ctx.fillStyle = `rgba(244, 209, 174, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2 + 40, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        return;
      }

      // Draw elegant channel separators
      ctx.strokeStyle = 'rgba(11, 49, 66, 0.08)';
      ctx.lineWidth = 1;
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'left';

      for (let ch = 0; ch < channelCount; ch++) {
        const y = ch * channelHeight;
        
        // Subtle channel separator
        if (ch > 0) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // Premium channel label design
        const labelY = y + channelHeight / 2;
        const channelColor = channelColors[ch % channelColors.length];
        
        // Channel label background with gradient
        const labelGradient = ctx.createLinearGradient(10, labelY - 12, 55, labelY + 12);
        labelGradient.addColorStop(0, channelColor + '20');
        labelGradient.addColorStop(1, channelColor + '10');
        
        ctx.fillStyle = labelGradient;
        ctx.fillRect(10, labelY - 12, 50, 24);
        
        // Channel label border
        ctx.strokeStyle = channelColor + '40';
        ctx.lineWidth = 1;
        ctx.strokeRect(10, labelY - 12, 50, 24);
        
        // Channel label text
        ctx.fillStyle = channelColor;
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(channelLabels[ch], 35, labelY + 3);

        // Subtle center reference line
        ctx.strokeStyle = 'rgba(11, 49, 66, 0.06)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(70, labelY);
        ctx.lineTo(width - 10, labelY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Premium time grid
      ctx.strokeStyle = 'rgba(11, 49, 66, 0.04)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        const x = 70 + (i / 10) * (width - 80);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw premium waveforms
      if (data.length > 1) {
        for (let ch = 0; ch < channelCount; ch++) {
          const channelData = data.map(sample => sample.channels[ch] || 0);
          const maxValue = Math.max(...channelData.map(Math.abs));
          const scale = maxValue > 0 ? (channelHeight * 0.4) / maxValue : 1;
          const centerY = ch * channelHeight + channelHeight / 2;
          const channelColor = channelColors[ch % channelColors.length];

          // Premium line styling
          ctx.strokeStyle = channelColor;
          ctx.lineWidth = isFiltered ? 2.5 : 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Add premium glow effect when active
          if (isActive) {
            ctx.shadowColor = channelColor;
            ctx.shadowBlur = isFiltered ? 4 : 2;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }

          ctx.beginPath();
          
          for (let i = 0; i < channelData.length; i++) {
            const x = 70 + ((i / (channelData.length - 1)) * (width - 80));
            const y = centerY - (channelData[i] * scale);
            
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              // Smooth bezier curves for premium look
              const prevX = 70 + (((i - 1) / (channelData.length - 1)) * (width - 80));
              const prevY = centerY - (channelData[i - 1] * scale);
              const cpX = (prevX + x) / 2;
              ctx.quadraticCurveTo(cpX, prevY, x, y);
            }
          }
          
          ctx.stroke();

          // Reset shadow
          ctx.shadowBlur = 0;

          // Premium fill under curve for filtered data
          if (isActive && isFiltered) {
            ctx.globalAlpha = 0.08;
            ctx.fillStyle = channelColor;
            ctx.lineTo(width - 10, centerY);
            ctx.lineTo(70, centerY);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }

      // Premium info overlay
      ctx.fillStyle = 'rgba(11, 49, 66, 0.7)';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('μV', width - 15, 30);
      
      // Enhanced metadata display
      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = 'rgba(11, 49, 66, 0.5)';
      ctx.textAlign = 'right';
      ctx.fillText(`250 Hz • ${channelCount} Ch • ${isFiltered ? 'Filtered' : 'Raw'}`, width - 15, height - 15);
      
      // Premium live indicator
      if (isActive) {
        const pulseAlpha = 0.6 + 0.4 * Math.sin(Date.now() * 0.008);
        ctx.fillStyle = `rgba(34, 197, 94, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.arc(width - 40, 20, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      if (isActive) {
        animationRef.current = requestAnimationFrame(draw);
      }
    };

    draw();
    
    if (isActive) {
      animationRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [data, isActive, channelCount, channelNames, isFiltered]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-80 rounded-2xl zen-shadow-lg"
        style={{ 
          imageRendering: 'auto',
          background: 'linear-gradient(135deg, rgba(244, 237, 234, 0.95) 0%, rgba(244, 209, 174, 0.1) 100%)',
          border: '1px solid rgba(11, 49, 66, 0.08)'
        }}
      />
      
      {/* Premium status indicator */}
      {isActive && (
        <div className="absolute top-4 right-4">
          <div className="premium-card px-3 py-1.5 flex items-center">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full mr-2 pulse-gentle" />
            <span className="text-xs text-[#0B3142] font-bold tracking-wide">LIVE</span>
          </div>
        </div>
      )}

      {/* Enhanced channel legend */}
      <div className="absolute bottom-4 left-4 premium-card p-3 max-w-md">
        <div className="text-xs font-semibold text-[#0B3142] mb-2 opacity-70">
          {title} • {channelCount} Channels
        </div>
        <div className={`grid gap-2 text-xs ${channelCount <= 8 ? 'grid-cols-4' : 'grid-cols-6'}`}>
          {channelLabels.map((label, index) => (
            <div key={label} className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded-full shadow-sm" 
                style={{ 
                  backgroundColor: channelColors[index % channelColors.length],
                  boxShadow: `0 0 4px ${channelColors[index % channelColors.length]}40`
                }}
              />
              <span className="text-[#0B3142] font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter indicator for filtered data */}
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