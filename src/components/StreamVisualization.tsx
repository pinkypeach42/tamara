import React, { useState, useEffect } from 'react';
import { ArrowLeft, Brain, Activity, Database, CheckCircle, Filter, Zap, AlertTriangle, Heart, Waves } from 'lucide-react';
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

// Mock functions should NEVER be used when real data is expected
const mockListen = async (event: string, handler: (event: any) => void) => {
  console.log(`❌ Mock Tauri listen - NO REAL EEG DATA AVAILABLE: ${event}`);
  
  // Return empty cleanup function - no mock data for meditation app
  return () => {
    console.log('🛑 No mock data cleanup needed');
  };
};

// Enhanced listen function that prioritizes REAL Tauri events
const listen = async (event: string, handler: (event: any) => void) => {
  try {
    if (isTauri && window.__TAURI__?.event?.listen) {
      console.log('🦀 Using REAL Tauri listen for REAL LSL data:', event);
      return await window.__TAURI__.event.listen(event, handler);
    } else {
      console.log('❌ No Tauri environment - cannot listen to real EEG events:', event);
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
  const [connectionLost, setConnectionLost] = useState(false);
  const [lastDataTime, setLastDataTime] = useState<number>(Date.now());

  // Debug logging
  useEffect(() => {
    console.log('🎯 StreamVisualization mounted');
    console.log('📊 Stream info:', streamInfo);
    console.log('🔧 Environment:', isTauri ? 'Tauri Desktop (REAL LSL CAPABLE)' : 'Web Browser (NO REAL LSL ACCESS)');
    console.log('🔗 Data source:', streamInfo.is_connected ? 'REAL LSL STREAM' : 'NO REAL DATA');
  }, []);

  // Monitor data flow and detect connection loss
  useEffect(() => {
    const checkDataFlow = setInterval(() => {
      const timeSinceLastData = Date.now() - lastDataTime;
      if (timeSinceLastData > 5000 && isRecording) { // 5 seconds without data
        console.log('⚠️ No EEG data received for 5 seconds - connection may be lost');
        setConnectionLost(true);
      } else if (timeSinceLastData < 1000) {
        setConnectionLost(false);
      }
    }, 1000);

    return () => clearInterval(checkDataFlow);
  }, [lastDataTime, isRecording]);

  useEffect(() => {
    if (!streamInfo.is_connected) {
      console.log('❌ No real LSL connection - cannot setup data listeners');
      return;
    }

    console.log('🎧 Setting up REAL EEG data listeners...');
    console.log('📡 Data type: REAL LSL DATA');
    
    let unlistenRaw: (() => void) | undefined;
    let unlistenFiltered: (() => void) | undefined;
    let unlistenBands: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        console.log('🔗 Connecting to REAL raw EEG samples...');
        unlistenRaw = await listen('eeg_sample', (event: any) => {
          try {
            const sample: EEGSample = event.payload;
            setLastDataTime(Date.now());
            setRawEegHistory(prev => {
              const newHistory = [...prev, sample];
              return newHistory.slice(-1000); // Keep 4 seconds at 250Hz
            });
          } catch (error) {
            console.error('❌ Raw EEG sample processing error:', error);
          }
        });

        console.log('🔗 Connecting to REAL filtered EEG samples...');
        unlistenFiltered = await listen('filtered_eeg_sample', (event: any) => {
          try {
            const sample: FilteredEEGSample = event.payload;
            setLastDataTime(Date.now());
            setFilteredEegHistory(prev => {
              const newHistory = [...prev, sample];
              return newHistory.slice(-1000); // Keep 4 seconds at 250Hz
            });
          } catch (error) {
            console.error('❌ Filtered EEG sample processing error:', error);
          }
        });

        console.log('🔗 Connecting to REAL frequency band data...');
        unlistenBands = await listen('frequency_bands', (event: any) => {
          try {
            const bands: FrequencyBand[] = event.payload;
            setLastDataTime(Date.now());
            setLatestFrequencyBands(bands);
          } catch (error) {
            console.error('❌ Frequency bands processing error:', error);
          }
        });

        setIsRecording(true);
        console.log('✅ All REAL EEG data listeners setup successfully');
      } catch (error) {
        console.error('❌ Failed to setup REAL EEG data listeners:', error);
        setConnectionLost(true);
      }
    };

    setupListeners();

    return () => {
      console.log('🧹 Cleaning up REAL EEG data listeners...');
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
  }, [streamInfo.is_connected]);

  // Debug render
  console.log('🎨 StreamVisualization render:', {
    hasStreamInfo: !!streamInfo,
    isRecording,
    rawSamples: rawEegHistory.length,
    filteredSamples: filteredEegHistory.length,
    frequencyBands: latestFrequencyBands.length,
    dataType: streamInfo.is_connected ? 'REAL' : 'NO REAL DATA',
    connectionLost
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
              Device Setup
            </button>
            
            <div className="flex items-center gap-4">
              <div className="premium-card px-4 py-2 flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 status-indicator ${
                  streamInfo.is_connected && !connectionLost ? 'bg-emerald-500' : 
                  connectionLost ? 'bg-rose-500' : 'bg-amber-500'
                }`}></div>
                <span className="text-[#0B3142] font-bold text-sm tracking-wide">
                  {streamInfo.is_connected && !connectionLost ? 'REAL EEG DATA FLOWING' : 
                   connectionLost ? 'CONNECTION LOST' : 'NO REAL DATA'}
                </span>
              </div>
            </div>
          </div>

          {/* Connection Status Warnings */}
          {!streamInfo.is_connected && (
            <div className="mb-6">
              <div className="premium-card p-6 border-l-4 border-rose-400">
                <div className="flex items-center gap-4">
                  <div className="bg-rose-100 p-3 rounded-full">
                    <Heart className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#0B3142] text-lg mb-2">
                      🧘‍♀️ EEG Device Required for Meditation
                    </h3>
                    <p className="text-[#0B3142]/70 text-sm leading-relaxed">
                      This meditation app needs a real EEG device to provide personalized neural feedback. 
                      Please connect your EEG device and ensure LSL streaming is active for the complete mindfulness experience.
                    </p>
                    <div className="mt-3 text-xs text-[#0B3142]/60 italic">
                      "The mind is like water. When agitated, it becomes difficult to see. When calm, everything becomes clear."
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {connectionLost && streamInfo.is_connected && (
            <div className="mb-6">
              <div className="premium-card p-4 border-l-4 border-amber-400">
                <div className="flex items-center gap-3">
                  <Waves className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-[#0B3142] text-sm">
                      ⚠️ Neural Connection Interrupted
                    </p>
                    <p className="text-[#0B3142]/70 text-xs mt-1">
                      No EEG data received recently. Please check your device connection and LSL streaming.
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
                  {streamInfo.is_connected ? 'Live Neural Meditation Stream' : 'EEG Device Connection Required'}
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
                <div className="text-xs text-[#0B3142]/60 font-semibold">Neural Channels</div>
              </div>
              <div className="zen-glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#0B3142] mb-1">{streamInfo.sample_rate}</div>
                <div className="text-xs text-[#0B3142]/60 font-semibold">Hz Sampling</div>
              </div>
              <div className="zen-glass rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle className={`w-5 h-5 ${
                    streamInfo.is_connected && !connectionLost ? 'text-emerald-500' : 'text-rose-500'
                  }`} />
                  <span className="text-lg font-bold text-[#0B3142]">
                    {streamInfo.is_connected && !connectionLost ? 'Live Data' : 'No Data'}
                  </span>
                </div>
                <div className="text-xs text-[#0B3142]/60 font-semibold">Connection Status</div>
              </div>
              <div className="zen-glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#0B3142] mb-1">
                  {rawEegHistory.length}
                </div>
                <div className="text-xs text-[#0B3142]/60 font-semibold">Samples Received</div>
              </div>
            </div>

            {/* Enhanced Metadata Display */}
            {streamInfo.metadata && (
              <div className="zen-glass rounded-xl p-4">
                <h3 className="text-sm font-bold text-[#0B3142] mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Device Information
                </h3>
                <p className="text-sm text-[#0B3142]/70 font-mono leading-relaxed">{streamInfo.metadata}</p>
              </div>
            )}
          </div>
        </header>

        {/* Only show visualizations if we have real data */}
        {streamInfo.is_connected ? (
          <>
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
                        Raw Neural Signals
                      </h2>
                      <p className="text-[#0B3142]/60 text-sm">
                        {streamInfo.channel_count} channels • Live EEG data • Real-time visualization
                      </p>
                    </div>
                  </div>
                  <EEGWaveform 
                    data={rawEegHistory} 
                    isActive={isRecording && !connectionLost}
                    channelCount={streamInfo.channel_count}
                    channelNames={streamInfo.channel_names}
                    title="Raw Neural Data"
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
                        Processed Neural Signals
                      </h2>
                      <p className="text-[#0B3142]/60 text-sm">
                        1-40 Hz bandpass • 50 Hz notch filter • Artifact removal • Real-time processing
                      </p>
                    </div>
                  </div>
                  <EEGWaveform 
                    data={filteredEegHistory} 
                    isActive={isRecording && !connectionLost}
                    channelCount={streamInfo.channel_count}
                    channelNames={streamInfo.channel_names}
                    title="Filtered Neural Data"
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
                      Meditation States
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
          </>
        ) : (
          /* Gentle guidance when no real data */
          <div className="flex items-center justify-center min-h-96">
            <div className="premium-card p-12 text-center max-w-2xl">
              <div className="zen-accent-gradient p-6 rounded-full w-fit mx-auto mb-6">
                <Heart className="w-12 h-12 text-[#0B3142]" />
              </div>
              <h2 className="text-3xl font-bold text-[#0B3142] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                Ready for Your Meditation Journey
              </h2>
              <p className="text-[#0B3142]/70 text-lg leading-relaxed mb-6">
                Connect your EEG device to begin receiving personalized neural feedback 
                that will guide you into deeper states of mindfulness and inner peace.
              </p>
              <div className="zen-glass rounded-xl p-6">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Waves className="w-6 h-6 text-[#0B3142]/50" />
                  <span className="text-[#0B3142]/70 italic">
                    "Meditation is not evasion; it is a serene encounter with reality."
                  </span>
                </div>
                <p className="text-[#0B3142]/50 text-sm">
                  - Thich Nhat Hanh
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamVisualization;