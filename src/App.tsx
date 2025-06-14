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

  // Debug logging
  useEffect(() => {
    console.log('🚀 Tamara App initialized');
    console.log('🔧 Environment:', isTauri ? 'Tauri Desktop' : 'Web Browser');
    console.log('📱 Current view:', currentView);
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-[#F4EDEA] via-[#F4EDEA] to-[#F4D1AE]/20 relative overflow-hidden">
      {/* Simplified floating orbs for better performance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-gradient-to-r from-[#F4D1AE]/20 to-[#0B3142]/10 animate-pulse"></div>
        <div className="absolute top-40 right-32 w-24 h-24 rounded-full bg-gradient-to-r from-[#0B3142]/10 to-[#F4D1AE]/20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-32 left-1/3 w-40 h-40 rounded-full bg-gradient-to-r from-[#F4D1AE]/15 to-[#0B3142]/5 animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header Section */}
        <div className="flex-shrink-0 px-6 pt-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl mr-4 shadow-lg border border-[#0B3142]/10">
              <Brain className="w-12 h-12 text-[#0B3142]" />
            </div>
            <div className="text-center">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-[#0B3142] to-[#8B4513] bg-clip-text text-transparent mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                Tamara
              </h1>
              <p className="text-[#0B3142]/70 text-lg font-semibold">Advanced Neural Interface Suite</p>
            </div>
          </div>
          
          {/* Environment Status */}
          <div className="flex justify-center mb-6">
            <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center shadow-md border border-[#0B3142]/10">
              <div className={`w-3 h-3 rounded-full mr-3 ${isTauri ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
              <span className="text-[#0B3142] font-bold text-sm tracking-wide">
                {isTauri ? 'DESKTOP APPLICATION' : 'WEB DEMO MODE'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-2xl">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-[#0B3142]/10">
              <div className="text-center mb-8">
                <div className="bg-gradient-to-r from-[#F4D1AE] to-[#D4A574] p-4 rounded-2xl w-fit mx-auto mb-4 shadow-lg">
                  <Wifi className="w-8 h-8 text-[#0B3142]" />
                </div>
                <h2 className="text-3xl font-bold text-[#0B3142] mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Neural Interface Connection
                </h2>
                <p className="text-lg text-[#0B3142]/70 leading-relaxed">
                  Connect to your EEG device via LSL stream for real-time neural monitoring
                </p>
              </div>

              {/* Stream Name Input */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-[#0B3142] mb-3">
                  LSL Stream Name
                </label>
                <input
                  type="text"
                  value={streamName}
                  onChange={(e) => setStreamName(e.target.value)}
                  placeholder="Enter stream name (e.g., '123', 'UnicornHybridBlack')"
                  className="w-full px-5 py-4 text-base rounded-2xl border-2 border-[#0B3142]/20 bg-white text-[#0B3142] placeholder-[#0B3142]/50 focus:border-[#F4D1AE] focus:outline-none transition-all duration-300 font-medium shadow-sm"
                  disabled={connectionStatus === 'connecting'}
                />
                <p className="text-sm text-[#0B3142]/60 mt-2 font-medium">
                  💡 Common names: "123" (Unicorn default), "UnicornHybridBlack", "OpenBCI"
                </p>
              </div>

              {/* Connection Status */}
              {connectionStatus !== 'idle' && (
                <div className="mb-6">
                  <div className={`bg-white/70 backdrop-blur-sm rounded-2xl p-4 border-l-4 shadow-sm ${
                    connectionStatus === 'connecting' ? 'border-amber-400' :
                    connectionStatus === 'connected' ? 'border-emerald-400' :
                    'border-rose-400'
                  }`}>
                    <div className="flex items-center gap-4">
                      {connectionStatus === 'connecting' && (
                        <>
                          <Search className="w-5 h-5 text-amber-500 animate-spin" />
                          <div>
                            <p className="font-bold text-[#0B3142] text-base">Scanning neural networks...</p>
                            <p className="text-sm text-[#0B3142]/70">Searching for: "{streamName}"</p>
                          </div>
                        </>
                      )}
                      
                      {connectionStatus === 'connected' && (
                        <>
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                          <div>
                            <p className="font-bold text-[#0B3142] text-base">Neural interface established!</p>
                            <p className="text-sm text-[#0B3142]/70">Initializing real-time monitoring...</p>
                          </div>
                        </>
                      )}
                      
                      {connectionStatus === 'error' && (
                        <>
                          <AlertCircle className="w-5 h-5 text-rose-500" />
                          <div>
                            <p className="font-bold text-[#0B3142] text-base">Connection failed</p>
                            <p className="text-sm text-[#0B3142]/70">{errorMessage}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Connect Button */}
              <div className="text-center mb-6">
                <button
                  onClick={handleConnectToLSL}
                  disabled={connectionStatus === 'connecting' || !streamName.trim()}
                  className={`bg-gradient-to-r from-[#F4D1AE] to-[#D4A574] text-[#0B3142] px-10 py-4 text-lg font-bold rounded-2xl flex items-center mx-auto transition-all duration-500 shadow-lg border-2 border-[#0B3142]/10 ${
                    connectionStatus === 'connecting' ? 'opacity-75 cursor-not-allowed' : 'hover:scale-105 hover:shadow-xl'
                  }`}
                >
                  {connectionStatus === 'connecting' ? (
                    <>
                      <Search className="w-5 h-5 mr-3 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-5 h-5 mr-3" />
                      Connect Neural Interface
                    </>
                  )}
                </button>
              </div>

              {/* Help Section */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-[#0B3142]/10">
                <h3 className="font-bold text-[#0B3142] mb-4 text-base">Neural Interface Setup Guide</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-[#0B3142]/70">
                  <div>
                    <h4 className="font-bold text-[#0B3142] mb-2">Unicorn Hybrid Black:</h4>
                    <ul className="space-y-1 leading-relaxed">
                      <li>• Device powered and streaming</li>
                      <li>• Default stream name: "123"</li>
                      <li>• LSL application active</li>
                      <li>• 8 EEG + 9 sensor channels</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-[#0B3142] mb-2">Troubleshooting:</h4>
                    <ul className="space-y-1 leading-relaxed">
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

        {/* Footer */}
        <div className="flex-shrink-0 text-center pb-6">
          <p className="text-[#0B3142]/40 text-sm font-medium">Tamara • Professional Neurofeedback Technology</p>
        </div>
      </div>
    </div>
  );
}

export default App;