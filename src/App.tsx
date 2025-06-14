import React, { useState, useEffect } from 'react';
import { Brain, Wifi, Search, AlertCircle, CheckCircle, Heart, Waves } from 'lucide-react';
import StreamVisualization from './components/StreamVisualization';
import './App.css';

// Enhanced Tauri detection with better debugging
const isTauri = (() => {
  try {
    const hasTauri = typeof window !== 'undefined' && 
                     window.__TAURI__ !== undefined;
    console.log('🔍 Tauri Detection:', {
      windowExists: typeof window !== 'undefined',
      hasTauriObject: window.__TAURI__ !== undefined,
      isTauri: hasTauri,
      userAgent: navigator.userAgent
    });
    return hasTauri;
  } catch (error) {
    console.log('❌ Tauri detection error:', error);
    return false;
  }
})();

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

// CRITICAL: Mock functions should NEVER claim to have real data
const mockInvoke = async (command: string, args?: any) => {
  console.log(`🎭 Mock Tauri invoke (NO REAL LSL AVAILABLE): ${command}`, args);
  
  // Add delay to simulate real network calls
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  switch (command) {
    case 'connect_to_lsl_stream':
      console.log('❌ Mock connection - NO REAL LSL DATA AVAILABLE');
      
      // ALWAYS fail in mock mode - we want real LSL data only
      const error = `❌ No real LSL streams available. This meditation app requires a real EEG device connected via LSL.\n\nTo use this app:\n1. Connect your EEG device (Unicorn, OpenBCI, etc.)\n2. Start LSL streaming software\n3. Ensure stream name matches: "${args}"\n4. Restart this application`;
      throw new Error(error);
      
    case 'start_eeg_processing':
      console.log('❌ Mock EEG processing - NO REAL DATA');
      throw new Error('No real EEG data source available');
      
    case 'get_meditation_quote':
      return "The mind is everything. What you think you become. - Buddha";
      
    default:
      console.log('❓ Unknown mock command:', command);
      throw new Error(`Real EEG device required for ${command}`);
  }
};

// Enhanced invoke function that prioritizes REAL Tauri calls
const invoke = async (command: string, args?: any) => {
  try {
    if (isTauri && window.__TAURI__?.invoke) {
      console.log('🦀 Using REAL Tauri invoke for REAL LSL data:', command, args);
      return await window.__TAURI__.invoke(command, args);
    } else {
      console.log('⚠️ No Tauri environment - cannot access real LSL data:', command, args);
      return await mockInvoke(command, args);
    }
  } catch (error) {
    console.error('💥 Invoke error:', error);
    throw error;
  }
};

function App() {
  const [currentView, setCurrentView] = useState<'config' | 'visualization'>('config');
  const [streamName, setStreamName] = useState('123');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [streamInfo, setStreamInfo] = useState<LSLStreamInfo | null>(null);
  const [meditationQuote, setMeditationQuote] = useState('');

  // Enhanced debug logging
  useEffect(() => {
    console.log('🚀 Tamara App initialized');
    console.log('🔧 Environment:', isTauri ? 'Tauri Desktop (REAL LSL CAPABLE)' : 'Web Browser (NO REAL LSL ACCESS)');
    console.log('📱 Current view:', currentView);
    console.log('🌊 Stream name:', streamName);
    console.log('🔌 Connection status:', connectionStatus);
    console.log('📊 Stream info:', streamInfo);
    
    if (!isTauri) {
      console.log('⚠️ WARNING: Running in web browser - NO ACCESS to real LSL data');
      console.log('💡 To get REAL LSL data, run: npm run tauri:dev');
    }
  }, [currentView, streamName, connectionStatus, streamInfo]);

  // Load meditation quote
  useEffect(() => {
    const loadQuote = async () => {
      try {
        if (isTauri) {
          const quote = await invoke('get_meditation_quote');
          setMeditationQuote(quote);
        } else {
          setMeditationQuote("Peace comes from within. Do not seek it without. - Buddha");
        }
      } catch (error) {
        console.error('Failed to load meditation quote:', error);
        setMeditationQuote("Breathe in peace, breathe out stress.");
      }
    };
    loadQuote();
  }, []);

  const handleConnectToLSL = async () => {
    console.log('🔗 Starting REAL LSL connection process...');
    
    if (!streamName.trim()) {
      console.log('❌ No stream name provided');
      setErrorMessage('Please enter a stream name for your EEG device');
      return;
    }

    if (!isTauri) {
      console.log('❌ Cannot connect to real LSL - not in Tauri environment');
      setConnectionStatus('error');
      setErrorMessage('This meditation app requires the desktop version to connect to real EEG devices. Please run the Tauri application to access live neural data.');
      return;
    }

    setConnectionStatus('connecting');
    setErrorMessage('');

    try {
      console.log(`🔍 Attempting to connect to REAL LSL stream: '${streamName}'`);
      console.log('🧠 Searching for real EEG device...');
      
      const result = await invoke('connect_to_lsl_stream', streamName.trim());
      
      console.log('✅ REAL LSL Connection established:', result);
      setStreamInfo(result as LSLStreamInfo);
      setConnectionStatus('connected');
      
      // Start EEG processing
      console.log('🚀 Starting REAL EEG processing...');
      await invoke('start_eeg_processing');
      
      // Navigate to visualization
      console.log('📱 Switching to visualization view...');
      setCurrentView('visualization');
      
    } catch (error) {
      console.error('❌ REAL LSL Connection failed:', error);
      setConnectionStatus('error');
      setErrorMessage(error as string);
    }
  };

  const handleBackToConfig = () => {
    console.log('🔙 Returning to configuration view...');
    setCurrentView('config');
    setConnectionStatus('idle');
    setStreamInfo(null);
    setErrorMessage('');
  };

  // Debug render decision
  console.log('🎨 Render decision:', {
    currentView,
    hasStreamInfo: !!streamInfo,
    shouldShowVisualization: currentView === 'visualization' && streamInfo
  });

  // Render visualization view
  if (currentView === 'visualization' && streamInfo) {
    console.log('🎯 Rendering StreamVisualization component with REAL data');
    return (
      <StreamVisualization 
        streamInfo={streamInfo} 
        onBack={handleBackToConfig}
      />
    );
  }

  // Render configuration view
  console.log('🎯 Rendering configuration view');
  return (
    <div className="min-h-screen zen-gradient gradient-shift relative overflow-hidden">
      {/* Beautiful floating orbs with subtle movement */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-gradient-to-r from-[#F4D1AE]/20 to-[#0B3142]/10 floating-animation"></div>
        <div className="absolute top-40 right-32 w-24 h-24 rounded-full bg-gradient-to-r from-[#0B3142]/10 to-[#F4D1AE]/20 floating-animation" style={{ animationDelay: '3s' }}></div>
        <div className="absolute bottom-32 left-1/3 w-40 h-40 rounded-full bg-gradient-to-r from-[#F4D1AE]/15 to-[#0B3142]/5 floating-animation" style={{ animationDelay: '6s' }}></div>
        <div className="absolute top-1/2 right-1/4 w-28 h-28 rounded-full bg-gradient-to-r from-[#0B3142]/8 to-[#F4D1AE]/12 floating-animation" style={{ animationDelay: '9s' }}></div>
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
              <p className="text-[#0B3142]/70 text-lg font-semibold">Mindful EEG Meditation</p>
            </div>
          </div>
          
          {/* Environment Status */}
          <div className="flex justify-center mb-6">
            <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center shadow-md border border-[#0B3142]/10">
              <div className={`w-3 h-3 rounded-full mr-3 ${isTauri ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
              <span className="text-[#0B3142] font-bold text-sm tracking-wide">
                {isTauri ? 'REAL EEG DEVICE READY' : 'DESKTOP APP REQUIRED'}
              </span>
            </div>
          </div>

          {/* Gentle Warning for Non-Tauri Environment */}
          {!isTauri && (
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-2xl p-6 max-w-2xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-rose-100 p-3 rounded-full">
                    <Heart className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-rose-800 font-bold text-lg">Mindful Connection Needed</h3>
                    <p className="text-rose-700 text-sm">This meditation app connects to your EEG device for real neural feedback</p>
                  </div>
                </div>
                <div className="bg-white/60 rounded-xl p-4 mb-4">
                  <p className="text-rose-800 text-sm leading-relaxed">
                    🧘‍♀️ <strong>For the complete meditation experience:</strong><br/>
                    • Connect your EEG device (Unicorn, OpenBCI, Muse, etc.)<br/>
                    • Start LSL streaming from your device software<br/>
                    • Run the desktop version: <code className="bg-rose-100 px-2 py-1 rounded text-xs">npm run tauri:dev</code>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-rose-600 text-xs italic">
                    "The mind is like water. When agitated, it becomes difficult to see. When calm, everything becomes clear."
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Meditation Quote */}
          {meditationQuote && (
            <div className="flex justify-center mb-6">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 max-w-2xl border border-[#0B3142]/10">
                <div className="text-center">
                  <Waves className="w-6 h-6 text-[#0B3142]/50 mx-auto mb-2" />
                  <p className="text-[#0B3142]/80 italic text-sm leading-relaxed">
                    {meditationQuote}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-2xl">
            <div className="premium-card p-8">
              <div className="text-center mb-8">
                <div className="zen-accent-gradient p-4 rounded-2xl w-fit mx-auto mb-4 shadow-lg">
                  <Wifi className="w-8 h-8 text-[#0B3142]" />
                </div>
                <h2 className="text-3xl font-bold text-[#0B3142] mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                  EEG Device Connection
                </h2>
                <p className="text-lg text-[#0B3142]/70 leading-relaxed">
                  {isTauri 
                    ? 'Connect to your EEG device for real-time neural meditation guidance'
                    : 'Desktop application required for EEG device connectivity'
                  }
                </p>
              </div>

              {/* Stream Name Input */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-[#0B3142] mb-3">
                  EEG Device Stream Name
                </label>
                <input
                  type="text"
                  value={streamName}
                  onChange={(e) => setStreamName(e.target.value)}
                  placeholder="Enter your EEG device stream name (e.g., '123', 'UnicornHybridBlack')"
                  className="w-full px-5 py-4 text-base rounded-2xl border-2 border-[#0B3142]/20 bg-white text-[#0B3142] placeholder-[#0B3142]/50 focus:border-[#F4D1AE] focus:outline-none transition-all duration-300 font-medium shadow-sm"
                  disabled={connectionStatus === 'connecting' || !isTauri}
                />
                <p className="text-sm text-[#0B3142]/60 mt-2 font-medium">
                  💡 Common names: "123" (Unicorn default), "UnicornHybridBlack", "OpenBCI", "Muse"
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
                            <p className="font-bold text-[#0B3142] text-base">
                              Searching for your EEG device...
                            </p>
                            <p className="text-sm text-[#0B3142]/70">Looking for LSL stream: "{streamName}"</p>
                          </div>
                        </>
                      )}
                      
                      {connectionStatus === 'connected' && (
                        <>
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                          <div>
                            <p className="font-bold text-[#0B3142] text-base">
                              EEG device connected successfully! 🧠
                            </p>
                            <p className="text-sm text-[#0B3142]/70">
                              Receiving live neural data for meditation guidance
                            </p>
                          </div>
                        </>
                      )}
                      
                      {connectionStatus === 'error' && (
                        <>
                          <AlertCircle className="w-5 h-5 text-rose-500" />
                          <div>
                            <p className="font-bold text-[#0B3142] text-base">Unable to connect to EEG device</p>
                            <div className="text-sm text-[#0B3142]/70 mt-2 space-y-1">
                              {errorMessage.split('\n').map((line, index) => (
                                <p key={index}>{line}</p>
                              ))}
                            </div>
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
                  disabled={connectionStatus === 'connecting' || !streamName.trim() || !isTauri}
                  className={`zen-button-accent px-10 py-4 text-lg font-bold rounded-2xl flex items-center mx-auto transition-all duration-500 shadow-lg border-2 border-[#0B3142]/10 ${
                    connectionStatus === 'connecting' || !isTauri ? 'opacity-75 cursor-not-allowed' : 'hover:scale-105 hover:shadow-xl'
                  }`}
                >
                  {connectionStatus === 'connecting' ? (
                    <>
                      <Search className="w-5 h-5 mr-3 animate-spin" />
                      Connecting to EEG Device...
                    </>
                  ) : !isTauri ? (
                    <>
                      <AlertCircle className="w-5 h-5 mr-3" />
                      Desktop App Required
                    </>
                  ) : (
                    <>
                      <Wifi className="w-5 h-5 mr-3" />
                      Connect to EEG Device
                    </>
                  )}
                </button>
              </div>

              {/* Help Section */}
              <div className="zen-glass rounded-2xl p-6 shadow-sm border border-[#0B3142]/10">
                <h3 className="font-bold text-[#0B3142] mb-4 text-base">EEG Device Setup Guide</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-[#0B3142]/70">
                  <div>
                    <h4 className="font-bold text-[#0B3142] mb-2">
                      {isTauri ? 'Device Connection Steps:' : 'To Use Real EEG Data:'}
                    </h4>
                    <ul className="space-y-1 leading-relaxed">
                      {isTauri ? (
                        <>
                          <li>• Power on your EEG device</li>
                          <li>• Start LSL streaming software</li>
                          <li>• Verify stream name matches input</li>
                          <li>• Ensure stable connection</li>
                        </>
                      ) : (
                        <>
                          <li>• Install Tauri desktop application</li>
                          <li>• Connect EEG device to computer</li>
                          <li>• Run: npm run tauri:dev</li>
                          <li>• Configure LSL streaming</li>
                        </>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-[#0B3142] mb-2">
                      {isTauri ? 'Troubleshooting:' : 'Supported Devices:'}
                    </h4>
                    <ul className="space-y-1 leading-relaxed">
                      {isTauri ? (
                        <>
                          <li>• Check device power and connection</li>
                          <li>• Verify LSL stream is active</li>
                          <li>• Try different stream names</li>
                          <li>• Restart device software if needed</li>
                        </>
                      ) : (
                        <>
                          <li>• Unicorn Hybrid Black</li>
                          <li>• OpenBCI boards</li>
                          <li>• Emotiv headsets</li>
                          <li>• Muse headbands</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 text-center pb-6">
          <p className="text-[#0B3142]/40 text-sm font-medium">
            Tamara • Mindful Technology for Inner Peace
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;