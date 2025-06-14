import React, { useEffect, useRef } from 'react';

interface EEGSample {
  timestamp: number;
  channels: number[];
}

interface EEGWaveformProps {
  data: EEGSample[];
  isActive: boolean;
  channelCount?: number;
}

const EEGWaveform: React.FC<EEGWaveformProps> = ({ data, isActive, channelCount = 8 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const channelColors = [
    '#0B3142', '#F4D1AE', '#8B4513', '#2E8B57',
    '#4682B4', '#9370DB', '#CD853F', '#708090',
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
  ];

  const getChannelLabels = (count: number) => {
    const standardLabels = ['Fp1', 'Fp2', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2'];
    if (count <= 8) return standardLabels.slice(0, count);
    
    // For more than 8 channels, use generic labels
    return Array.from({ length: count }, (_, i) => `Ch${i + 1}`);
  };

  const channelLabels = getChannelLabels(channelCount);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Set canvas size
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      
      const width = rect.width;
      const height = rect.height;
      const channelHeight = height / channelCount;

      // Clear canvas with zen background
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, 'rgba(244, 237, 234, 0.95)');
      gradient.addColorStop(1, 'rgba(11, 49, 66, 0.05)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      if (data.length < 2) {
        // Show zen waiting message
        ctx.fillStyle = 'rgba(11, 49, 66, 0.4)';
        ctx.font = '20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Preparing your meditation space...', width / 2, height / 2 - 20);
        ctx.font = '16px Inter, sans-serif';
        ctx.fillStyle = 'rgba(11, 49, 66, 0.3)';
        ctx.fillText(`${channelCount}-channel EEG visualization will appear here`, width / 2, height / 2 + 10);
        return;
      }

      // Draw channel separators and labels
      ctx.strokeStyle = 'rgba(11, 49, 66, 0.1)';
      ctx.lineWidth = 1;
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'left';

      for (let ch = 0; ch < channelCount; ch++) {
        const y = ch * channelHeight;
        
        // Channel separator line
        if (ch > 0) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // Channel label with colored background
        const labelY = y + channelHeight / 2;
        ctx.fillStyle = channelColors[ch % channelColors.length];
        ctx.fillRect(10, labelY - 10, 45, 20);
        ctx.fillStyle = 'rgba(244, 237, 234, 0.95)';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(channelLabels[ch], 32.5, labelY + 3);

        // Center line for each channel
        ctx.strokeStyle = 'rgba(11, 49, 66, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(65, labelY);
        ctx.lineTo(width, labelY);
        ctx.stroke();
      }

      // Draw time grid
      ctx.strokeStyle = 'rgba(11, 49, 66, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        const x = (i / 10) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw waveforms for all channels
      if (data.length > 1) {
        for (let ch = 0; ch < channelCount; ch++) {
          const channelData = data.map(sample => sample.channels[ch] || 0);
          const maxValue = Math.max(...channelData.map(Math.abs));
          const scale = maxValue > 0 ? (channelHeight * 0.35) / maxValue : 1;
          const centerY = ch * channelHeight + channelHeight / 2;

          ctx.strokeStyle = channelColors[ch % channelColors.length];
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Add glow effect when active
          if (isActive) {
            ctx.shadowColor = channelColors[ch % channelColors.length];
            ctx.shadowBlur = 3;
          }

          ctx.beginPath();
          
          for (let i = 0; i < channelData.length; i++) {
            const x = 70 + ((i / (channelData.length - 1)) * (width - 80));
            const y = centerY - (channelData[i] * scale);
            
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              // Smooth curve
              const prevX = 70 + (((i - 1) / (channelData.length - 1)) * (width - 80));
              const prevY = centerY - (channelData[i - 1] * scale);
              const cpX = (prevX + x) / 2;
              ctx.quadraticCurveTo(cpX, prevY, x, y);
            }
          }
          
          ctx.stroke();

          // Reset shadow
          ctx.shadowBlur = 0;

          // Add subtle fill under the curve
          if (isActive) {
            ctx.globalAlpha = 0.06;
            ctx.fillStyle = channelColors[ch % channelColors.length];
            ctx.lineTo(width - 10, centerY);
            ctx.lineTo(70, centerY);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }

      // Draw elegant info overlay
      ctx.fillStyle = 'rgba(11, 49, 66, 0.8)';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('μV', width - 15, 25);
      
      // Sample rate info
      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = 'rgba(11, 49, 66, 0.5)';
      ctx.textAlign = 'right';
      ctx.fillText(`250 Hz • ${channelCount} Channels`, width - 15, height - 10);
      
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
  }, [data, isActive, channelCount]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-80 eeg-canvas zen-shadow rounded-2xl"
        style={{ imageRendering: 'auto' }}
      />
      
      {isActive && (
        <div className="absolute top-3 right-3">
          <div className="zen-glass rounded-full px-3 py-1.5 flex items-center">
            <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 pulse-gentle" />
            <span className="text-xs text-[#0B3142] font-semibold">LIVE</span>
          </div>
        </div>
      )}

      {/* Channel Legend */}
      <div className="absolute bottom-3 left-3 zen-glass rounded-xl p-2">
        <div className={`grid gap-1 text-xs ${channelCount <= 8 ? 'grid-cols-4' : 'grid-cols-6'}`}>
          {channelLabels.map((label, index) => (
            <div key={label} className="flex items-center gap-1">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: channelColors[index % channelColors.length] }}
              />
              <span className="text-[#0B3142] font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EEGWaveform;