import React, { useMemo } from 'react';
import { TrendingUp, Brain, Zap, Moon, Sun, Activity } from 'lucide-react';

interface FrequencyBand {
  timestamp: number;
  channel: number;
  alpha: number;
  beta: number;
  theta: number;
  delta: number;
  gamma: number;
}

interface FrequencyBandsProps {
  data: FrequencyBand[];
  selectedChannel: number;
}

const FrequencyBands: React.FC<FrequencyBandsProps> = ({ data, selectedChannel }) => {
  const latestData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const channelData = data.filter(d => d.channel === selectedChannel);
    return channelData.length > 0 ? channelData[channelData.length - 1] : null;
  }, [data, selectedChannel]);

  const bands = useMemo(() => {
    if (!latestData) return [];
    
    const maxValue = Math.max(latestData.alpha, latestData.beta, latestData.theta, latestData.delta, latestData.gamma);
    
    return [
      {
        name: 'Delta',
        value: latestData.delta,
        percentage: maxValue > 0 ? (latestData.delta / maxValue) * 100 : 0,
        color: '#8B5CF6',
        description: '0.5-4 Hz',
        meaning: 'Deep Sleep',
        icon: Moon
      },
      {
        name: 'Theta',
        value: latestData.theta,
        percentage: maxValue > 0 ? (latestData.theta / maxValue) * 100 : 0,
        color: '#3B82F6',
        description: '4-8 Hz',
        meaning: 'Deep Meditation',
        icon: Brain
      },
      {
        name: 'Alpha',
        value: latestData.alpha,
        percentage: maxValue > 0 ? (latestData.alpha / maxValue) * 100 : 0,
        color: '#10B981',
        description: '8-12 Hz',
        meaning: 'Relaxed Awareness',
        icon: Activity
      },
      {
        name: 'Beta',
        value: latestData.beta,
        percentage: maxValue > 0 ? (latestData.beta / maxValue) * 100 : 0,
        color: '#F59E0B',
        description: '13-30 Hz',
        meaning: 'Active Thinking',
        icon: Zap
      },
      {
        name: 'Gamma',
        value: latestData.gamma,
        percentage: maxValue > 0 ? (latestData.gamma / maxValue) * 100 : 0,
        color: '#EF4444',
        description: '30-100 Hz',
        meaning: 'High Cognition',
        icon: Sun
      }
    ];
  }, [latestData]);

  if (!latestData) {
    return (
      <div className="flex items-center justify-center h-80 text-[#0B3142]/40">
        <div className="text-center">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">Analyzing your mind...</p>
          <p className="text-sm">Frequency data will appear here</p>
        </div>
      </div>
    );
  }

  const getMeditationState = () => {
    if (latestData.alpha > latestData.beta && latestData.theta > latestData.beta) {
      return { state: 'Deep Meditation', color: '#10B981', icon: Brain };
    } else if (latestData.alpha > latestData.beta) {
      return { state: 'Relaxed Focus', color: '#3B82F6', icon: Activity };
    } else {
      return { state: 'Active Mind', color: '#F59E0B', icon: Zap };
    }
  };

  const meditationState = getMeditationState();

  return (
    <div className="space-y-6 zen-scrollbar" style={{ maxHeight: '400px', overflowY: 'auto' }}>
      {bands.map((band, index) => {
        const IconComponent = band.icon;
        return (
          <div key={band.name} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-full"
                  style={{ backgroundColor: `${band.color}20` }}
                >
                  <IconComponent className="w-4 h-4" style={{ color: band.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#0B3142]">{band.name}</span>
                    <span className="text-xs text-[#0B3142]/50 bg-[#0B3142]/5 px-2 py-1 rounded-full">
                      {band.description}
                    </span>
                  </div>
                  <p className="text-xs text-[#0B3142]/60 mt-1">{band.meaning}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-mono text-[#0B3142] font-semibold">
                  {band.value.toFixed(1)}
                </span>
                <p className="text-xs text-[#0B3142]/50">{band.percentage.toFixed(0)}%</p>
              </div>
            </div>
            
            <div className="relative">
              <div className="w-full bg-[#0B3142]/10 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full frequency-bar transition-all duration-700 ease-out relative"
                  style={{ 
                    width: `${band.percentage}%`,
                    background: `linear-gradient(135deg, ${band.color} 0%, ${band.color}CC 100%)`
                  }}
                >
                  {band.percentage > 70 && (
                    <div className="absolute inset-0 bg-white/30 animate-pulse rounded-full" />
                  )}
                </div>
              </div>
              
              {/* Glow effect for high activity */}
              {band.percentage > 70 && (
                <div
                  className="absolute inset-0 rounded-full opacity-40 blur-sm"
                  style={{ 
                    background: `linear-gradient(135deg, ${band.color} 0%, ${band.color}80 100%)`,
                    transform: 'scale(1.05)',
                    animation: 'pulse 2s infinite'
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
      
      {/* Meditation State Indicator */}
      <div className="mt-8 p-6 zen-glass rounded-2xl border border-[#0B3142]/10">
        <div className="text-center">
          <p className="text-sm text-[#0B3142]/60 mb-3">Current Mind State</p>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div 
              className="p-3 rounded-full pulse-gentle"
              style={{ backgroundColor: `${meditationState.color}20` }}
            >
              <meditationState.icon 
                className="w-6 h-6" 
                style={{ color: meditationState.color }} 
              />
            </div>
            <span 
              className="text-xl font-semibold"
              style={{ color: meditationState.color }}
            >
              {meditationState.state}
            </span>
          </div>
          
          {/* Meditation quality indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#0B3142]/60">Meditation Quality</span>
              <span className="font-medium" style={{ color: meditationState.color }}>
                {meditationState.state === 'Deep Meditation' ? 'Excellent' :
                 meditationState.state === 'Relaxed Focus' ? 'Good' : 'Active'}
              </span>
            </div>
            <div className="w-full bg-[#0B3142]/10 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-1000"
                style={{ 
                  width: `${meditationState.state === 'Deep Meditation' ? 90 :
                          meditationState.state === 'Relaxed Focus' ? 70 : 40}%`,
                  background: `linear-gradient(135deg, ${meditationState.color} 0%, ${meditationState.color}CC 100%)`
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrequencyBands;