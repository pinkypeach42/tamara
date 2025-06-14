import React, { useState, useEffect } from 'react';
import { Brain, Wifi, Search, AlertCircle, CheckCircle } from 'lucide-react';
import StreamVisualization from './components/StreamVisualization';
import './App.css';

// Check if we're running in Tauri environment
const isTauri = typeof window !== 'undefined' && window.__TAURI_IPC__;

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

// Enhanced mock Tauri functions for web environment with realistic metadata
const mockInvoke = async (command: string, args?: any) => {
  console.log(`Mock Tauri invoke: ${command}`, args);
  
  switch (command) {
    case 'connect_to_lsl_stream':
      // Simulate connection attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (args === '123' || args.includes('Unicorn') || args.includes('unicorn')) {
        return {
          name: args,
          channel_count: 17, // Unicorn has 8 EEG + 9 other channels
          sample_rate: 250.0,
          is_connected: true,
          metadata: "Type: EEG | Source: UnicornHybridBlack_12345 | Channels: 17 | Rate: 250.0 Hz | Manufacturer: g.tec medical engineering GmbH | Model: Unicorn Hybrid Black",
          stream_type: "EEG",
          source_id: "UnicornHybridBlack_12345",
          channel_names: ["Fz", "C3", "Cz", "C4", "Pz", "PO7", "Oz", "PO8", "ACC_X", "ACC_Y", "ACC_Z", "GYR_X", "GYR_Y", "GYR_Z", "Battery", "Counter", "Validation"],
          manufacturer: "g.tec medical engineering GmbH",
          device_model: "Unicorn Hybrid Black"
        };
      } else if (args.includes('OpenBCI') || args.includes('openbci')) {
        return {
          name: args,
          channel_count: 16,
          sample_rate: 250.0,
          is_connected: true,
          metadata: "Type: EEG | Source: OpenBCI_Cyton_67890 | Channels: 16 | Rate: 250.0 Hz | Manufacturer: OpenBCI | Model: Cyton Board",
          stream_type: "EEG",
          source_id: "OpenBCI_Cyton_67890",
          channel_names: ["Fp1", "Fp2", "F7", "F3", "F4", "F8", "C3", "Cz", "C4", "T7", "T8", "P7", "P3", "Pz", "P4", "P8"],
          manufacturer: "OpenBCI",
          device_model: "Cyton Board"
        };
      } else {
        throw new Error(`No LSL stream found with name: '${args}'. Please check that your EEG device is connected and streaming data via LSL.`);
      }
    case 'start_eeg_processing':
      return { success: true };
    default:
      return { success: false, message: `Unknown command: ${command}` };
  }
};

const invoke = isTauri ? (window as any).__TAURI__.invoke : mockInvoke;

function App() {
  const [currentView, setCurrentView] = useState<'config' | 'visualization'>('config');
  const [streamName, setStreamName] = useState('123');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [streamInfo, setStreamInfo] = useState<LSLStreamInfo | null>(null);

  const handleConnectToLSL = async () => {
    if (!streamName.trim()) {
      setErrorMessage('Please enter a stream name');
      return;
    }

    setConnectionStatus('connecting');
    setErrorMessage('');

    try {
      console.log(`🔍 Attempting to connect to LSL stream: '${streamName}'`);
      const result = await invoke('connect_to_lsl_stream', streamName.trim());
      
      console.log('✅ LSL Connection successful:', result);
      setStreamInfo(result as LSLStreamInfo);
      setConnectionStatus('connected');
      
      // Start EEG processing
      await invoke('start_eeg_processing');
      
      // Navigate to visualization
      setCurrentView('visualization');
      
    } catch (error) {
      console.error('❌ LSL Connection failed:', error);
      setConnectionStatus('error');
      setErrorMessage(error as string);
    }
  };

  const handleBackToConfig = () => {
    setCurrentView('config');
    setConnectionStatus('idle');
    setStreamInfo(null);
    setErrorMessage('');
  };

  if (currentView === 'visualization' && streamInfo) {
    return (
      <StreamVisualization 
        streamInfo={streamInfo} 
        onBack={handleBackToConfig}
      />
    );
  }

  return (
    <div className="app-container zen-gradient-animated min-h-screen relative overflow-hidden">
      {/* Premium Floating Orbs Background */}
      <div className="floating-orbs">
        <div className="orb"></div>
        <div className="orb"></div>
        <div className="orb"></div>
        <div className="orb"></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Premium Header Section - Fixed Height */}
        <div className="flex-shrink-0 px-6 pt-6">
          <div className="flex items-center justify-center mb-4">
            <div className="premium-card p-3 mr-4 meditation-glow">
              <Brain className="w-10 h-10 text-[#0B3142]" />
            </div>
            <div className="text-center">
              <h1 className="text-4xl font-bold zen-text-gradient mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                Tamara
              </h1>
              <p className="text-[#0B3142]/70 text-base font-semibold">Advanced Neural Interface Suite</p>
            </div>
          </div>
          
          {/* Environment Status */}
          <div className="flex justify-center mb-4">
            <div className="premium-card px-3 py-1.5 flex items-center">
              <div className={`w-2.5 h-2.5 rounded-full mr-2 status-indicator ${isTauri ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
              <span className="text-[#0B3142] font-bold text-xs tracking-wide">
                {isTauri ? 'DESKTOP APPLICATION' : 'WEB DEMO MODE'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content - Perfectly Centered and Contained */}
        <div className="flex-1 flex items-center justify-center px-6 py-4">
          <div className="w-full max-w-2xl">
            <div className="premium-card p-6">
              <div className="text-center mb-6">
                <div className="zen-accent-gradient p-3 rounded-full w-fit mx-auto mb-3 meditation-glow">
                  <Wifi className="w-6 h-6 text-[#0B3142]" />
                </div>
                <h2 className="text-2xl font-bold text-[#0B3142] mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Neural Interface Connection
                </h2>
                <p className="text-base text-[#0B3142]/70 leading-relaxed">
                  Connect to your EEG device via LSL stream for real-time neural monitoring
                </p>
              </div>

              {/* Stream Name Input */}
              <div className="mb-5">
                <label className="block text-sm font-bold text-[#0B3142] mb-2">
                  LSL Stream Name
                </label>
                <input
                  type="text"
                  value={streamName}
                  onChange={(e) => setStreamName(e.target.value)}
                  placeholder="Enter stream name (e.g., '123', 'UnicornHybridBlack')"
                  className="w-full px-4 py-3 text-sm rounded-xl border-2 border-[#0B3142]/20 bg-[#F4EDEA] text-[#0B3142] placeholder-[#0B3142]/50 focus:border-[#F4D1AE] focus:outline-none transition-all duration-300 font-medium"
                  disabled={connectionStatus === 'connecting'}
                />
                <p className="text-xs text-[#0B3142]/60 mt-1.5 font-medium">
                  💡 Common names: "123" (Unicorn default), "UnicornHybridBlack", "OpenBCI"
                </p>
              </div>

              {/* Connection Status */}
              {connectionStatus !== 'idle' && (
                <div className="mb-5">
                  <div className={`zen-glass rounded-xl p-3 border-l-4 ${
                    connectionStatus === 'connecting' ? 'border-amber-400' :
                    connectionStatus === 'connected' ? 'border-emerald-400' :
                    'border-rose-400'
                  }`}>
                    <div className="flex items-center gap-3">
                      {connectionStatus === 'connecting' && (
                        <>
                          <Search className="w-4 h-4 text-amber-500 animate-spin" />
                          <div>
                            <p className="font-bold text-[#0B3142] text-sm">Scanning neural networks...</p>
                            <p className="text-xs text-[#0B3142]/70">Searching for: "{streamName}"</p>
                          </div>
                        </>
                      )}
                      
                      {connectionStatus === 'connected' && (
                        <>
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <div>
                            <p className="font-bold text-[#0B3142] text-sm">Neural interface established!</p>
                            <p className="text-xs text-[#0B3142]/70">Initializing real-time monitoring...</p>
                          </div>
                        </>
                      )}
                      
                      {connectionStatus === 'error' && (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                          <div>
                            <p className="font-bold text-[#0B3142] text-sm">Connection failed</p>
                            <p className="text-xs text-[#0B3142]/70">{errorMessage}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Connect Button */}
              <div className="text-center mb-5">
                <button
                  onClick={handleConnectToLSL}
                  disabled={connectionStatus === 'connecting' || !streamName.trim()}
                  className={`zen-button-accent px-8 py-3 text-base font-bold flex items-center mx-auto transition-all duration-500 ${
                    connectionStatus === 'connecting' ? 'opacity-75 cursor-not-allowed' : 'hover:scale-105'
                  }`}
                >
                  {connectionStatus === 'connecting' ? (
                    <>
                      <Search className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4 mr-2" />
                      Connect Neural Interface
                    </>
                  )}
                </button>
              </div>

              {/* Premium Help Section */}
              <div className="zen-glass rounded-xl p-4">
                <h3 className="font-bold text-[#0B3142] mb-3 text-sm">Neural Interface Setup Guide</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#0B3142]/70">
                  <div>
                    <h4 className="font-bold text-[#0B3142] mb-1.5">Unicorn Hybrid Black:</h4>
                    <ul className="space-y-0.5 leading-relaxed">
                      <li>• Device powered and streaming</li>
                      <li>• Default stream name: "123"</li>
                      <li>• LSL application active</li>
                      <li>• 8 EEG + 9 sensor channels</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-[#0B3142] mb-1.5">Troubleshooting:</h4>
                    <ul className="space-y-0.5 leading-relaxed">
                      <li>• Verify LSL stream is broadcasting</li>
                      <li>• Check network connectivity</li>
                      <li>• Try alternative stream names</li>
                      <li>• Restart EEG software if needed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed Height */}
        <div className="flex-shrink-0 text-center pb-4">
          <p className="text-[#0B3142]/40 text-xs font-medium">Tamara • Professional Neurofeedback Technology</p>
        </div>
      </div>
    </div>
  );
}

export default App;