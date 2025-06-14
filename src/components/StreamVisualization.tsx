import React, { useState, useEffect } from 'react';
import { ArrowLeft, Brain, Activity, Database, CheckCircle, Filter, Zap, AlertTriangle } from 'lucide-react';
import EEGWaveform from './EEGWaveform';
import FrequencyBands from './FrequencyBands';

interface LSLStreamInfo {
  name: string;
  channel_count: number;
  sample_rate: number;
  is_connected: boolean;
  metadata: string;
  stream_type?: string;
  source_id?: string;
  channel_names?: string[];
  manufacturer?: string;
  device_model?: string;
}

interface EEGSample {
  timestamp: number;
  channels: number[];
}

interface FilteredEEGSample {
  timestamp: number;
  channels: number[];
}

interface FrequencyBand {
  timestamp: number;
  channel: number;
  alpha: number;
  beta: number;
  theta: number;
  delta: number;
  gamma: number;
}

interface StreamVisualizationProps {
  streamInfo: LSLStreamInfo;
  onBack: () => void;
}

// Enhanced Tauri detection
const isTauri = (() => {
  try {
    return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
  } catch (error) {
    console.log('❌ Tauri detection error in StreamVisualization:', error);
    return false;
  }
})();

// Enhanced mock functions that clearly indicate simulated data
const mockListen = async (event: string, handler: (event: any) => void) => {
  console.log(`🎭 Mock Tauri listen (SIMULATED DATA): ${event}`);
  
  if (event === 'eeg_sample') {
    const interval = setInterval(() => {
      try {
        handler({
          payload: {
            timestamp: Date.now(),
            channels: Array.from({ length: 8 }, (_, i) => {
              const time = Date.now() / 1000;
              const channelOffset = i * 0.5;
              // Enhanced realistic EEG simulation
              return (
                25 * Math.sin(2 * Math.PI * 10 * (time + channelOffset)) + // Alpha
                18 * Math.sin(2 * Math.PI * 6 * (time + channelOffset)) +  // Theta
                12 * Math.sin(2 * Math.PI * 20 * (time + channelOffset)) + // Beta
                8 * Math.sin(2 * Math.PI * 2 * (time + channelOffset)) +   // Delta
                (Math.random() - 0.5) * 15 // Realistic noise
              );
            })
          }
        });
      } catch (error) {
        console.error('❌ Mock EEG sample error:', error);
      }
    }, 16);
    
    return () => {
      console.log('🛑 Cleaning up mock EEG sample listener');
      clearInterval(interval);
    };
  }
  
  if (event === 'filtered_eeg_sample') {
    const interval = setInterval(() => {
      try {
        handler({
          payload: {
            timestamp: Date.now(),
            channels: Array.from({ length: 8 }, (_, i) => {
              const time = Date.now() / 1000;
              const channelOffset = i * 0.5;
              // Filtered data - cleaner, less noise, better signal quality
              return (
                22 * Math.sin(2 * Math.PI * 10 * (time + channelOffset)) + // Alpha (preserved)
                15 * Math.sin(2 * Math.PI * 6 * (time + channelOffset)) +  // Theta (preserved)
                8 * Math.sin(2 * Math.PI * 20 * (time + channelOffset)) +  // Beta (reduced)
                6 * Math.sin(2 * Math.PI * 2 * (time + channelOffset)) +   // Delta (preserved)
                (Math.random() - 0.5) * 3 // Much less noise after filtering
              );
            })
          }
        });
      } catch (error) {
        console.error('❌ Mock filtered EEG sample error:', error);
      }
    }, 16);
    
    return () => {
      console.log('🛑 Cleaning up mock filtered EEG sample listener');
      clearInterval(interval);
    };
  }
  
  if (event === 'frequency_bands') {
    const interval = setInterval(() => {
      try {
        const bands = [];
        for (let channel = 0; channel < 8; channel++) {
          // Simulate realistic meditation-state frequency bands
          const meditationFactor = 0.7 + 0.3 * Math.sin(Date.now() * 0.001);
          bands.push({
            timestamp: Date.now(),
            channel,
            alpha: (25 + Math.random() * 15) * meditationFactor, // Higher alpha in meditation
            beta: (8 + Math.random() * 12) * (1 - meditationFactor * 0.5), // Lower beta in meditation
            theta: (15 + Math.random() * 10) * meditationFactor, // Higher theta in deep meditation
            delta: (5 + Math.random() * 8) * meditationFactor, // Moderate delta
            gamma: (2 + Math.random() * 6) // Low gamma
          });
        }
        handler({ payload: bands });
      } catch (error) {
        console.error('❌ Mock frequency bands error:', error);
      }
    }, 200);
    
    return () => {
      console.log('🛑 Cleaning up mock frequency bands listener');
      clearInterval(interval);
    };
  }
  
  return () => {};
};

// Enhanced listen function that prioritizes REAL Tauri events
const listen = async (event: string, handler: (event: any) => void) => {
  try {
    if (isTauri && window.__TAURI__?.event?.listen) {
      console.log('🦀 Using REAL Tauri listen for REAL LSL data:', event);
      return await window.__TAURI__.event.listen(event, handler);
    } else {
      console.log('🎭 Using mock listen (SIMULATED DATA ONLY):', event);
      return await mockListen(event, handler);
    }
  } catch (error) {
    console.error('💥 Listen error:', error);
    return () => {};
  }
};

const StreamVisualization: React.FC<StreamVisualizationProps> = ({ streamInfo, onBack }) => {
  const [rawEegHistory, setRawEegHistory] = useState<EEGSample[]>([]);
  const [filteredEegHistory, setFilteredEegHistory] = useState<FilteredEEGSample[]>([]);
  const [latestFrequencyBands, setLatestFrequencyBands] = useState<FrequencyBand[]>([]);
  const [selectedChannel, setSelectedChannel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('🎯 StreamVisualization mounted');
    console.log('📊 Stream info:', streamInfo);
    console.log('🔧 Environment:', isTauri ? 'Tauri Desktop (REAL LSL CAPABLE)' : 'Web Browser (SIMULATED DATA ONLY)');
    console.log('🔗 Data source:', streamInfo.is_connected ? 'REAL LSL STREAM' : 'SIMULATED DATA');
  }, []);

  useEffect(() => {
    console.log('🎧 Setting up EEG data listeners...');
    console.log(`📡 Data type: ${streamInfo.is_connected ? 'REAL LSL DATA' : 'SIMULATED DATA'}`);
    
    let unlistenRaw: (() => void) | undefined;
    let unlistenFiltered: (() => void) | undefined;
    let unlistenBands: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        console.log('🔗 Connecting to raw EEG samples...');
        unlistenRaw = await listen('eeg_sample', (event: any) => {
          try {
            const sample: EEGSample = event.payload;
            setRawEegHistory(prev => {
              const newHistory = [...prev, sample];
              return newHistory.slice(-1000); // Keep 4 seconds at 250Hz
            });
          } catch (error) {
            console.error('❌ Raw EEG sample processing error:', error);
          }
        });

        console.log('🔗 Connecting to filtered EEG samples...');
        unlistenFiltered = await listen('filtered_eeg_sample', (event: any) => {
          try {
            const sample: FilteredEEGSample = event.payload;
            setFilteredEegHistory(prev => {
              const newHistory = [...prev, sample];
              return newHistory.slice(-1000); // Keep 4 seconds at 250Hz
            });
          } catch (error) {
            console.error('❌ Filtered EEG sample processing error:', error);
          }
        });

        console.log('🔗 Connecting to frequency band data...');
        unlistenBands = await listen('frequency_bands', (event: any) => {
          try {
            const bands: FrequencyBand[] = event.payload;
            setLatestFrequencyBands(bands);
          } catch (error) {
            console.error('❌ Frequency bands processing error:', error);
          }
        });

        setIsRecording(true);
        console.log(`✅ All EEG data listeners setup successfully - ${streamInfo.is_connected ? 'REAL DATA' : 'SIMULATED DATA'}`);
      } catch (error) {
        console.error('❌ Failed to setup EEG data listeners:', error);
      }
    };

    setupListeners();

    return () => {
      console.log('🧹 Cleaning up EEG data listeners...');
      if (unlistenRaw) {
        try {
          unlistenRaw();
          console.log('✅ Raw EEG listener cleaned up');
        } catch (error) {
          console.error('❌ Error cleaning up raw EEG listener:', error);
        }
      }
      if (unlistenFiltered) {
        try {
          unlistenFiltered();
          console.log('✅ Filtered EEG listener cleaned up');
        } catch (error) {
          console.error('❌ Error cleaning up filtered EEG listener:', error);
        }
      }
      if (unlistenBands) {
        try {
          unlistenBands();
          console.log('✅ Frequency bands listener cleaned up');
        } catch (error) {
          console.error('❌ Error cleaning up frequency bands listener:', error);
        }
      }
    };
  }, []);

  // Debug render
  console.log('🎨 StreamVisualization render:', {
    hasStreamInfo: !!streamInfo,
    isRecording,
    rawSamples: rawEegHistory.length,
    filteredSamples: filteredEegHistory.length,
    frequencyBands: latestFrequencyBands.length,
    dataType: streamInfo.is_connected ? 'REAL' : 'SIMULATED'
  });

  return (
    <div className="app-container zen-gradient gradient-shift min-h-screen">
      {/* Beautiful floating background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-40 h-40 rounded-full bg-gradient-to-r from-[#F4D1AE]/15 to-[#0B3142]/8 floating-animation" style={{ animationDelay: '0s' }}></div>
        <div className="absolute top-60 right-32 w-32 h-32 rounded-full bg-gradient-to-r from-[#0B3142]/8 to-[#F4D1AE]/15 floating-animation" style={{ animationDelay: '3s' }}></div>
        <div className="absolute bottom-40 left-1/3 w-48 h-48 rounded-full bg-gradient-to-r from-[#F4D1AE]/12 to-[#0B3142]/6 floating-animation" style={{ animationDelay: '6s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-6">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBack}
              className="zen-button px-6 py-3 flex items-center text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Configuration
            </button>
            
            <div className="flex items-center gap-4">
              <div className="premium-card px-4 py-2 flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 status-indicator ${
                  streamInfo.is_connected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}></div>
                <span className="text-[#0B3142] font-bold text-sm tracking-wide">
                  {streamInfo.is_connected ? 'REAL LSL DATA ACTIVE' : 'SIMULATED DATA ACTIVE'}
                </span>
              </div>
            </div>
          </div>

          {/* Data Source Warning */}
          {!streamInfo.is_connected && (
            <div className="mb-6">
              <div className="premium-card p-4 border-l-4 border-amber-400">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-[#0B3142] text-sm">
                      ⚠️ Displaying Simulated Neural Data
                    </p>
                    <p className="text-[#0B3142]/70 text-xs mt-1">
                      This is realistic simulation. For real EEG data, connect your device via LSL in Tauri desktop mode.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Stream Information Card */}
          <div className="premium-card p-8">
            <div className="flex items-center mb-6">
              <div className="zen-accent-gradient p-4 rounded-full mr-6 meditation-glow">
                {streamInfo.is_connected ? (
                  <Database className="w-8 h-8 text-[#0B3142]" />
                ) : (
                  <Brain className="w-8 h-8 text-[#0B3142]" />
                )}
              </div>
              <div>
                <h1 className="text-4xl font-bold zen-text-gradient mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {streamInfo.name}
                </h1>
                <p className="text-[#0B3142]/70 text-xl font-medium">
                  {streamInfo.is_connected ? 'Live Neural Data Stream' : 'Simulated Neural Data Stream'}
                </p>
                {streamInfo.device_model && (
                  <p className="text-[#0B3142]/50 text-sm mt-1">
                    {streamInfo.manufacturer} • {streamInfo.device_model}
                  </p>
                )}
              </div>
            </div>

            {/* Premium Stream Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="zen-glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#0B3142] mb-1">{streamInfo.channel_count}</div>
                <div className="text-xs text-[#0B3142]/60 font-semibold">Channels</div>
              </div>
              <div className="zen-glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#0B3142] mb-1">{streamInfo.sample_rate}</div>
                <div className="text-xs text-[#0B3142]/60 font-semibold">Hz Sampling</div>
              </div>
              <div className="zen-glass rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle className={`w-5 h-5 ${streamInfo.is_connected ? 'text-emerald-500' : 'text-amber-500'}`} />
                  <span className="text-lg font-bold text-[#0B3142]">
                    {streamInfo.is_connected ? 'Real Data' : 'Simulated'}
                  </span>
                </div>
                <div className="text-xs text-[#0B3142]/60 font-semibold">Data Source</div>
              </div>
              <div className="zen-glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#0B3142] mb-1">
                  {streamInfo.stream_type || 'EEG'}
                </div>
                <div className="text-xs text-[#0B3142]/60 font-semibold">Signal Type</div>
              </div>
            </div>

            {/* Enhanced Metadata Display */}
            {streamInfo.metadata && (
              <div className="zen-glass rounded-xl p-4">
                <h3 className="text-sm font-bold text-[#0B3142] mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Stream Metadata
                </h3>
                <p className="text-sm text-[#0B3142]/70 font-mono leading-relaxed">{streamInfo.metadata}</p>
              </div>
            )}
          </div>
        </header>

        {/* Premium Channel Selector */}
        <div className="flex justify-center mb-8">
          <div className="premium-card p-4 flex items-center gap-3">
            <span className="text-[#0B3142] font-bold mr-3 text-sm">Neural Focus Channel:</span>
            <div className="flex gap-2">
              {Array.from({ length: streamInfo.channel_count }, (_, i) => {
                const channelName = streamInfo.channel_names?.[i] || `${i + 1}`;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedChannel(i)}
                    className={`px-3 py-2 rounded-xl font-bold text-xs transition-all duration-300 ${
                      selectedChannel === i
                        ? 'zen-button-accent meditation-glow shadow-lg'
                        : 'bg-[#0B3142]/10 text-[#0B3142] hover:bg-[#0B3142]/20 hover:shadow-md'
                    }`}
                    title={`Channel ${i + 1}: ${channelName}`}
                  >
                    {channelName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Premium Visualization Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Neural Waveform Visualizations */}
          <div className="xl:col-span-2 space-y-8">
            {/* Raw Neural Data */}
            <div className="premium-card p-6">
              <div className="flex items-center mb-6">
                <div className="zen-accent-gradient p-3 rounded-full mr-4">
                  <Activity className="w-6 h-6 text-[#0B3142]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#0B3142] mb-1">
                    {streamInfo.is_connected ? 'Raw Neural Signals' : 'Simulated Raw Signals'}
                  </h2>
                  <p className="text-[#0B3142]/60 text-sm">
                    {streamInfo.channel_count} channels • {streamInfo.is_connected ? 'Live EEG data' : 'Realistic simulation'} • Real-time visualization
                  </p>
                </div>
              </div>
              <EEGWaveform 
                data={rawEegHistory} 
                isActive={isRecording}
                channelCount={streamInfo.channel_count}
                channelNames={streamInfo.channel_names}
                title={streamInfo.is_connected ? "Raw Neural Data" : "Simulated Raw Data"}
                isFiltered={false}
              />
            </div>

            {/* Filtered Neural Data */}
            <div className="premium-card p-6">
              <div className="flex items-center mb-6">
                <div className="zen-accent-gradient p-3 rounded-full mr-4">
                  <Filter className="w-6 h-6 text-[#0B3142]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#0B3142] mb-1">
                    {streamInfo.is_connected ? 'Processed Neural Signals' : 'Simulated Filtered Signals'}
                  </h2>
                  <p className="text-[#0B3142]/60 text-sm">
                    1-40 Hz bandpass • 50 Hz notch filter • Artifact removal • Real-time processing
                  </p>
                </div>
              </div>
              <EEGWaveform 
                data={filteredEegHistory} 
                isActive={isRecording}
                channelCount={streamInfo.channel_count}
                channelNames={streamInfo.channel_names}
                title={streamInfo.is_connected ? "Filtered Neural Data" : "Simulated Filtered Data"}
                isFiltered={true}
              />
            </div>
          </div>

          {/* Neural State Analysis */}
          <div className="premium-card p-6">
            <div className="flex items-center mb-6">
              <div className="zen-accent-gradient p-3 rounded-full mr-4">
                <Brain className="w-6 h-6 text-[#0B3142]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#0B3142] mb-1">
                  {streamInfo.is_connected ? 'Neural States' : 'Simulated Neural States'}
                </h2>
                <p className="text-[#0B3142]/60 text-sm">
                  {streamInfo.channel_names?.[selectedChannel] || `Channel ${selectedChannel + 1}`} • Frequency Analysis
                </p>
              </div>
            </div>
            <FrequencyBands 
              data={latestFrequencyBands} 
              selectedChannel={selectedChannel} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamVisualization;