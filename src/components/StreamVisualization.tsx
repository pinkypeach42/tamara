import React, { useState, useEffect } from 'react';
import { ArrowLeft, Brain, Activity, Database, CheckCircle, Filter } from 'lucide-react';
import EEGWaveform from './EEGWaveform';
import FrequencyBands from './FrequencyBands';

interface LSLStreamInfo {
  name: string;
  channel_count: number;
  sample_rate: number;
  is_connected: boolean;
  metadata: string;
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

// Check if we're running in Tauri environment
const isTauri = typeof window !== 'undefined' && window.__TAURI_IPC__;

// Mock functions for web environment
const mockListen = async (event: string, handler: (event: any) => void) => {
  console.log(`Mock Tauri listen: ${event}`);
  
  if (event === 'eeg_sample') {
    const interval = setInterval(() => {
      handler({
        payload: {
          timestamp: Date.now(),
          channels: Array.from({ length: 8 }, (_, i) => {
            const time = Date.now() / 1000;
            const channelOffset = i * 0.5;
            return (
              20 * Math.sin(2 * Math.PI * 10 * (time + channelOffset)) + // Alpha
              15 * Math.sin(2 * Math.PI * 6 * (time + channelOffset)) +  // Theta
              8 * Math.sin(2 * Math.PI * 20 * (time + channelOffset)) +  // Beta
              (Math.random() - 0.5) * 10 // Noise
            );
          })
        }
      });
    }, 16);
    
    return () => clearInterval(interval);
  }
  
  if (event === 'filtered_eeg_sample') {
    const interval = setInterval(() => {
      handler({
        payload: {
          timestamp: Date.now(),
          channels: Array.from({ length: 8 }, (_, i) => {
            const time = Date.now() / 1000;
            const channelOffset = i * 0.5;
            // Filtered data - smoother, less noise
            return (
              18 * Math.sin(2 * Math.PI * 10 * (time + channelOffset)) + // Alpha
              12 * Math.sin(2 * Math.PI * 6 * (time + channelOffset)) +  // Theta
              6 * Math.sin(2 * Math.PI * 20 * (time + channelOffset))    // Beta (reduced)
            );
          })
        }
      });
    }, 16);
    
    return () => clearInterval(interval);
  }
  
  if (event === 'frequency_bands') {
    const interval = setInterval(() => {
      const bands = [];
      for (let channel = 0; channel < 8; channel++) {
        bands.push({
          timestamp: Date.now(),
          channel,
          alpha: Math.random() * 30 + 10,
          beta: Math.random() * 25 + 5,
          theta: Math.random() * 20 + 5,
          delta: Math.random() * 15 + 2,
          gamma: Math.random() * 10 + 1
        });
      }
      handler({ payload: bands });
    }, 200);
    
    return () => clearInterval(interval);
  }
  
  return () => {};
};

const listen = isTauri ? (window as any).__TAURI__.event.listen : mockListen;

const StreamVisualization: React.FC<StreamVisualizationProps> = ({ streamInfo, onBack }) => {
  const [rawEegHistory, setRawEegHistory] = useState<EEGSample[]>([]);
  const [filteredEegHistory, setFilteredEegHistory] = useState<FilteredEEGSample[]>([]);
  const [latestFrequencyBands, setLatestFrequencyBands] = useState<FrequencyBand[]>([]);
  const [selectedChannel, setSelectedChannel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    let unlistenRaw: (() => void) | undefined;
    let unlistenFiltered: (() => void) | undefined;
    let unlistenBands: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        // Listen for raw EEG sample data
        unlistenRaw = await listen('eeg_sample', (event: any) => {
          const sample: EEGSample = event.payload;
          setRawEegHistory(prev => {
            const newHistory = [...prev, sample];
            return newHistory.slice(-1000); // Keep 4 seconds at 250Hz
          });
        });

        // Listen for filtered EEG sample data
        unlistenFiltered = await listen('filtered_eeg_sample', (event: any) => {
          const sample: FilteredEEGSample = event.payload;
          setFilteredEegHistory(prev => {
            const newHistory = [...prev, sample];
            return newHistory.slice(-1000); // Keep 4 seconds at 250Hz
          });
        });

        // Listen for frequency band data
        unlistenBands = await listen('frequency_bands', (event: any) => {
          const bands: FrequencyBand[] = event.payload;
          setLatestFrequencyBands(bands);
        });

        setIsRecording(true);
      } catch (error) {
        console.error('Failed to setup EEG data listeners:', error);
      }
    };

    setupListeners();

    return () => {
      if (unlistenRaw) unlistenRaw();
      if (unlistenFiltered) unlistenFiltered();
      if (unlistenBands) unlistenBands();
    };
  }, []);

  return (
    <div className="app-container zen-gradient min-h-screen">
      {/* Floating Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-gradient-to-r from-[#F4D1AE]/20 to-[#0B3142]/10 floating-animation" style={{ animationDelay: '0s' }}></div>
        <div className="absolute top-40 right-32 w-24 h-24 rounded-full bg-gradient-to-r from-[#0B3142]/10 to-[#F4D1AE]/20 floating-animation" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-32 left-1/3 w-40 h-40 rounded-full bg-gradient-to-r from-[#F4D1AE]/15 to-[#0B3142]/5 floating-animation" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="zen-button px-4 py-2 flex items-center text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Configuration
            </button>
            
            <div className="flex items-center gap-3">
              <div className="premium-card px-3 py-1.5 flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 status-indicator"></div>
                <span className="text-[#0B3142] font-medium text-xs">Live Stream Active</span>
              </div>
            </div>
          </div>

          {/* Stream Information */}
          <div className="premium-card p-6">
            <div className="flex items-center mb-4">
              <div className="zen-accent-gradient p-3 rounded-full mr-4">
                {streamInfo.is_connected ? (
                  <Database className="w-6 h-6 text-[#0B3142]" />
                ) : (
                  <Brain className="w-6 h-6 text-[#0B3142]" />
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold zen-text-gradient mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {streamInfo.name}
                </h1>
                <p className="text-[#0B3142]/70 text-lg">
                  {streamInfo.is_connected ? 'Real-time EEG Data Stream' : 'Simulated EEG Data'}
                </p>
              </div>
            </div>

            {/* Stream Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="zen-glass rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-[#0B3142] mb-1">{streamInfo.channel_count}</div>
                <div className="text-xs text-[#0B3142]/60">Channels</div>
              </div>
              <div className="zen-glass rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-[#0B3142] mb-1">{streamInfo.sample_rate}</div>
                <div className="text-xs text-[#0B3142]/60">Hz Sampling Rate</div>
              </div>
              <div className="zen-glass rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="text-base font-bold text-[#0B3142]">Connected</span>
                </div>
                <div className="text-xs text-[#0B3142]/60">Status</div>
              </div>
            </div>

            {streamInfo.metadata && (
              <div className="mt-4 zen-glass rounded-xl p-3">
                <h3 className="text-xs font-semibold text-[#0B3142] mb-1">Stream Metadata</h3>
                <p className="text-xs text-[#0B3142]/70 font-mono">{streamInfo.metadata}</p>
              </div>
            )}
          </div>
        </header>

        {/* Channel Selector */}
        <div className="flex justify-center mb-6">
          <div className="premium-card p-2 flex items-center gap-2">
            <span className="text-[#0B3142] font-medium mr-2 text-sm">Focus Channel:</span>
            {Array.from({ length: streamInfo.channel_count }, (_, i) => (
              <button
                key={i}
                onClick={() => setSelectedChannel(i)}
                className={`w-8 h-8 rounded-full font-semibold text-xs transition-all duration-300 ${
                  selectedChannel === i
                    ? 'zen-button-accent meditation-glow'
                    : 'bg-[#0B3142]/10 text-[#0B3142] hover:bg-[#0B3142]/20'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Visualization Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Raw EEG Waveform */}
          <div className="xl:col-span-2 space-y-6">
            {/* Raw Data */}
            <div className="premium-card p-6">
              <div className="flex items-center mb-4">
                <div className="zen-accent-gradient p-2 rounded-full mr-3">
                  <Activity className="w-5 h-5 text-[#0B3142]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#0B3142] mb-1">Raw Brainwaves</h2>
                  <p className="text-[#0B3142]/60 text-sm">{streamInfo.channel_count} channels • Unfiltered data</p>
                </div>
              </div>
              <EEGWaveform 
                data={rawEegHistory} 
                isActive={isRecording}
                channelCount={streamInfo.channel_count}
              />
            </div>

            {/* Filtered Data */}
            <div className="premium-card p-6">
              <div className="flex items-center mb-4">
                <div className="zen-accent-gradient p-2 rounded-full mr-3">
                  <Filter className="w-5 h-5 text-[#0B3142]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#0B3142] mb-1">Filtered Brainwaves</h2>
                  <p className="text-[#0B3142]/60 text-sm">1-40 Hz bandpass • 50 Hz notch • Artifact removal</p>
                </div>
              </div>
              <EEGWaveform 
                data={filteredEegHistory} 
                isActive={isRecording}
                channelCount={streamInfo.channel_count}
              />
            </div>
          </div>

          {/* Frequency Analysis */}
          <div className="premium-card p-6">
            <div className="flex items-center mb-4">
              <div className="zen-accent-gradient p-2 rounded-full mr-3">
                <Brain className="w-5 h-5 text-[#0B3142]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[#0B3142] mb-1">Mind States</h2>
                <p className="text-[#0B3142]/60 text-sm">Channel {selectedChannel + 1} Analysis</p>
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