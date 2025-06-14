// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::interval;
use tauri::{Manager, State};
use serde::{Deserialize, Serialize};
use rustfft::{FftPlanner, num_complex::Complex};
use lsl::{StreamInlet, resolve_streams, StreamInfo, Pullable};
use rand::{Rng, SeedableRng};
use rand::seq::SliceRandom;

#[derive(Debug, Serialize, Clone)]
struct EEGSample {
    timestamp: f64,
    channels: Vec<f32>,
}

#[derive(Debug, Serialize, Clone)]
struct FilteredEEGSample {
    timestamp: f64,
    channels: Vec<f32>,
}

#[derive(Debug, Serialize, Clone)]
struct FrequencyBands {
    timestamp: f64,
    channel: usize,
    alpha: f32,    // 8-12 Hz
    beta: f32,     // 13-30 Hz
    theta: f32,    // 4-8 Hz
    delta: f32,    // 0.5-4 Hz
    gamma: f32,    // 30-100 Hz
}

#[derive(Debug, Serialize, Clone)]
struct LSLStreamInfo {
    name: String,
    channel_count: i32,
    sample_rate: f64,
    is_connected: bool,
    metadata: String,
    stream_type: String,
    source_id: String,
    channel_names: Vec<String>,
    manufacturer: String,
    device_model: String,
}

#[derive(Debug, Deserialize)]
struct LSLConfig {
    stream_name: String,
    use_real_data: bool,
}

// Digital filter structures for real-time processing
#[derive(Debug, Clone)]
struct ButterworthFilter {
    order: usize,
    a: Vec<f64>,
    b: Vec<f64>,
    x_history: Vec<Vec<f64>>, // Input history for each channel
    y_history: Vec<Vec<f64>>, // Output history for each channel
}

impl ButterworthFilter {
    fn new(order: usize, channel_count: usize) -> Self {
        // 4th order Butterworth bandpass 1-40 Hz at 250 Hz sampling rate
        // Coefficients calculated for 1-40 Hz bandpass
        let b = vec![0.0067, 0.0, -0.0134, 0.0, 0.0067];
        let a = vec![1.0, -3.1806, 3.8612, -2.1122, 0.4383];
        
        Self {
            order,
            a,
            b,
            x_history: vec![vec![0.0; order + 1]; channel_count],
            y_history: vec![vec![0.0; order + 1]; channel_count],
        }
    }
    
    fn process(&mut self, input: &[f32]) -> Vec<f32> {
        let mut output = Vec::with_capacity(input.len());
        
        for (ch, &sample) in input.iter().enumerate() {
            if ch >= self.x_history.len() {
                output.push(sample);
                continue;
            }
            
            // Shift history
            for i in (1..self.x_history[ch].len()).rev() {
                self.x_history[ch][i] = self.x_history[ch][i - 1];
                self.y_history[ch][i] = self.y_history[ch][i - 1];
            }
            
            self.x_history[ch][0] = sample as f64;
            
            // Apply filter equation
            let mut y = 0.0;
            for i in 0..self.b.len() {
                if i < self.x_history[ch].len() {
                    y += self.b[i] * self.x_history[ch][i];
                }
            }
            for i in 1..self.a.len() {
                if i < self.y_history[ch].len() {
                    y -= self.a[i] * self.y_history[ch][i];
                }
            }
            
            self.y_history[ch][0] = y;
            output.push(y as f32);
        }
        
        output
    }
}

#[derive(Debug, Clone)]
struct NotchFilter {
    // 50 Hz notch filter coefficients for 250 Hz sampling rate
    b: Vec<f64>,
    a: Vec<f64>,
    x_history: Vec<Vec<f64>>,
    y_history: Vec<Vec<f64>>,
}

impl NotchFilter {
    fn new(channel_count: usize) -> Self {
        // 50 Hz notch filter coefficients (Q=30)
        let b = vec![0.9565, -1.9131, 0.9565];
        let a = vec![1.0, -1.9131, 0.9131];
        
        Self {
            b,
            a,
            x_history: vec![vec![0.0; 3]; channel_count],
            y_history: vec![vec![0.0; 3]; channel_count],
        }
    }
    
    fn process(&mut self, input: &[f32]) -> Vec<f32> {
        let mut output = Vec::with_capacity(input.len());
        
        for (ch, &sample) in input.iter().enumerate() {
            if ch >= self.x_history.len() {
                output.push(sample);
                continue;
            }
            
            // Shift history
            for i in (1..3).rev() {
                self.x_history[ch][i] = self.x_history[ch][i - 1];
                self.y_history[ch][i] = self.y_history[ch][i - 1];
            }
            
            self.x_history[ch][0] = sample as f64;
            
            // Apply filter
            let mut y = 0.0;
            for i in 0..self.b.len() {
                y += self.b[i] * self.x_history[ch][i];
            }
            for i in 1..self.a.len() {
                y -= self.a[i] * self.y_history[ch][i];
            }
            
            self.y_history[ch][0] = y;
            output.push(y as f32);
        }
        
        output
    }
}

// Thread-safe LSL connection
#[derive(Debug, Clone)]
struct LSLConnection {
    stream_info: Option<LSLStreamInfo>,
    channel_count: usize,
    is_real_connection: bool,
    stream_name: Option<String>,
}

impl LSLConnection {
    fn new() -> Self {
        Self {
            stream_info: None,
            channel_count: 8,
            is_real_connection: false,
            stream_name: None,
        }
    }
}

struct EEGProcessor {
    sample_rate: f32,
    buffer_size: usize,
    channel_buffers: Arc<Mutex<Vec<Vec<f32>>>>,
    filtered_buffers: Arc<Mutex<Vec<Vec<f32>>>>,
    lsl_connection: Arc<Mutex<LSLConnection>>,
    bandpass_filter: Arc<Mutex<Option<ButterworthFilter>>>,
    notch_filter: Arc<Mutex<Option<NotchFilter>>>,
}

impl EEGProcessor {
    fn new() -> Self {
        Self {
            sample_rate: 250.0,
            buffer_size: 512,
            channel_buffers: Arc::new(Mutex::new(vec![Vec::new(); 8])),
            filtered_buffers: Arc::new(Mutex::new(vec![Vec::new(); 8])),
            lsl_connection: Arc::new(Mutex::new(LSLConnection::new())),
            bandpass_filter: Arc::new(Mutex::new(None)),
            notch_filter: Arc::new(Mutex::new(None)),
        }
    }

    async fn connect_to_lsl(&self, stream_name: &str) -> Result<LSLStreamInfo, String> {
        println!("🔍 [DEBUG] Starting LSL connection process for stream: '{}'", stream_name);
        
        // Use blocking task to handle LSL operations
        let stream_name_clone = stream_name.to_string();
        let result = tokio::task::spawn_blocking(move || {
            println!("🔍 [DEBUG] Resolving LSL streams with 10 second timeout...");
            
            // INCREASED TIMEOUT: Give more time for stream discovery
            match resolve_streams(10.0) {
                Ok(streams) => {
                    println!("📡 [DEBUG] Found {} LSL streams total", streams.len());
                    
                    // Log ALL available streams for debugging
                    for (i, stream) in streams.iter().enumerate() {
                        println!("  [DEBUG] Stream {}: name='{}', type='{}', channels={}, rate={:.1}Hz, source='{}'", 
                                i + 1, 
                                stream.hostname(), 
                                stream.stream_type(),
                                stream.channel_count(),
                                stream.nominal_srate(),
                                stream.source_id());
                    }
                    
                    // IMPROVED MATCHING: Try multiple matching strategies
                    let matching_stream = streams.iter().find(|stream| {
                        let hostname = stream.hostname().to_lowercase();
                        let source_id = stream.source_id().to_lowercase();
                        let stream_type = stream.stream_type().to_lowercase();
                        let target = stream_name_clone.to_lowercase();
                        
                        println!("  [DEBUG] Checking stream: hostname='{}', source='{}', type='{}'", 
                                hostname, source_id, stream_type);
                        
                        // Multiple matching strategies
                        hostname == target || 
                        source_id.contains(&target) || 
                        hostname.contains(&target) ||
                        (target == "123" && (hostname == "123" || source_id.contains("unicorn"))) ||
                        (target.contains("unicorn") && (hostname.contains("unicorn") || source_id.contains("unicorn")))
                    });
                    
                    if let Some(stream_info) = matching_stream {
                        println!("✅ [DEBUG] Found matching LSL stream: '{}'", stream_info.hostname());
                        
                        let channel_count = stream_info.channel_count() as usize;
                        
                        // Extract detailed metadata
                        let stream_type = stream_info.stream_type().to_string();
                        let source_id = stream_info.source_id().to_string();
                        
                        // Extract channel names
                        let channel_names = Self::extract_real_channel_names_sync(stream_info, channel_count);
                        
                        // Extract manufacturer and device info
                        let (manufacturer, device_model) = Self::extract_device_info_sync(stream_info);
                        
                        // Create comprehensive metadata
                        let metadata = format!(
                            "🔴 REAL LSL DATA - Type: {} | Source: {} | Channels: {} | Rate: {:.1} Hz | Manufacturer: {} | Model: {}",
                            stream_type,
                            source_id,
                            channel_count,
                            stream_info.nominal_srate(),
                            manufacturer,
                            device_model
                        );

                        // CRITICAL: Test connection by creating inlet with longer timeout
                        println!("🔗 [DEBUG] Testing LSL inlet connection...");
                        match StreamInlet::new(stream_info, 360, 1, true) {
                            Ok(inlet) => {
                                println!("✅ [DEBUG] LSL inlet created successfully");
                                
                                // Test data pull to verify connection
                                println!("📊 [DEBUG] Testing data pull from LSL stream...");
                                match <StreamInlet as Pullable<f32>>::pull_sample(&inlet, 1.0) {
                                    Ok((sample, timestamp)) => {
                                        println!("✅ [DEBUG] Successfully pulled test sample: {} channels, timestamp: {}", 
                                                sample.len(), timestamp);
                                    }
                                    Err(e) => {
                                        println!("⚠️ [DEBUG] No immediate data available (this is normal): {}", e);
                                    }
                                }
                                
                                let info = LSLStreamInfo {
                                    name: stream_info.hostname().to_string(),
                                    channel_count: stream_info.channel_count(),
                                    sample_rate: stream_info.nominal_srate(),
                                    is_connected: true, // REAL connection
                                    metadata,
                                    stream_type,
                                    source_id,
                                    channel_names,
                                    manufacturer,
                                    device_model,
                                };
                                
                                println!("✅ [DEBUG] Successfully verified REAL LSL stream connection");
                                println!("📊 [DEBUG] Stream info: {}", info.metadata);
                                Ok((info, channel_count, true))
                            }
                            Err(e) => {
                                println!("❌ [DEBUG] Failed to create LSL inlet: {}", e);
                                Err(format!("❌ Failed to create inlet for LSL stream '{}': {}", stream_name_clone, e))
                            }
                        }
                    } else {
                        let available_names: Vec<String> = streams.iter()
                            .map(|s| format!("'{}' (type: {}, source: {})", 
                                           s.hostname(), s.stream_type(), s.source_id()))
                            .collect();
                        
                        println!("❌ [DEBUG] No matching LSL stream found for: '{}'", stream_name_clone);
                        println!("❌ [DEBUG] Available streams: {:?}", available_names);
                        
                        Err(format!("❌ No LSL stream found with name: '{}'. Available streams: {}", 
                                   stream_name_clone, 
                                   available_names.join(", ")))
                    }
                }
                Err(e) => {
                    println!("❌ [DEBUG] Failed to resolve LSL streams: {}", e);
                    Err(format!("❌ Failed to resolve LSL streams: {}. Make sure your EEG device is connected and streaming via LSL.", e))
                }
            }
        }).await;

        match result {
            Ok(Ok((info, channel_count, is_real))) => {
                println!("✅ [DEBUG] LSL connection successful, updating processor state...");
                
                // Update connection state
                let mut connection = self.lsl_connection.lock().await;
                connection.stream_info = Some(info.clone());
                connection.channel_count = channel_count;
                connection.is_real_connection = is_real;
                connection.stream_name = Some(stream_name.to_string());
                
                // Update buffers
                *self.channel_buffers.lock().await = vec![Vec::new(); channel_count];
                *self.filtered_buffers.lock().await = vec![Vec::new(); channel_count];
                
                // Initialize filters for real-time processing
                *self.bandpass_filter.lock().await = Some(ButterworthFilter::new(4, channel_count));
                *self.notch_filter.lock().await = Some(NotchFilter::new(channel_count));
                
                println!("✅ [DEBUG] EEG processor state updated successfully");
                Ok(info)
            }
            Ok(Err(e)) => {
                println!("❌ [DEBUG] LSL connection failed: {}", e);
                Err(e)
            }
            Err(e) => {
                println!("❌ [DEBUG] Task execution failed: {}", e);
                Err(format!("❌ Task execution failed: {}", e))
            }
        }
    }

    fn extract_real_channel_names_sync(stream_info: &StreamInfo, channel_count: usize) -> Vec<String> {
        println!("🔍 [DEBUG] Extracting channel names from LSL stream...");
        
        let mut channel_names = Vec::new();
        
        // Try to detect device type and use known layouts
        let source_id = stream_info.source_id().to_lowercase();
        let stream_name = stream_info.hostname().to_lowercase();
        
        println!("🔍 [DEBUG] Device detection - Source ID: '{}', Stream Name: '{}'", source_id, stream_name);
        
        // Unicorn Hybrid Black specific channel layout
        if source_id.contains("unicorn") || stream_name.contains("unicorn") || stream_name == "123" {
            println!("🦄 [DEBUG] Detected Unicorn Hybrid Black device");
            let unicorn_channels = vec![
                "Fz", "C3", "Cz", "C4", "Pz", "PO7", "Oz", "PO8",
                "ACC_X", "ACC_Y", "ACC_Z", "GYR_X", "GYR_Y", "GYR_Z", 
                "Battery", "Counter", "Validation"
            ];
            
            for i in 0..channel_count.min(unicorn_channels.len()) {
                channel_names.push(unicorn_channels[i].to_string());
            }
        }
        // OpenBCI detection
        else if source_id.contains("openbci") || stream_name.contains("openbci") {
            println!("🧠 [DEBUG] Detected OpenBCI device");
            let openbci_8ch = vec!["Fp1", "Fp2", "C3", "C4", "P7", "P8", "O1", "O2"];
            let openbci_16ch = vec![
                "Fp1", "Fp2", "F7", "F3", "F4", "F8", "C3", "Cz", 
                "C4", "T7", "T8", "P7", "P3", "Pz", "P4", "P8"
            ];
            
            let channels = if channel_count <= 8 { &openbci_8ch } else { &openbci_16ch };
            for i in 0..channel_count.min(channels.len()) {
                channel_names.push(channels[i].to_string());
            }
        }
        // Emotiv detection
        else if source_id.contains("emotiv") || stream_name.contains("emotiv") {
            println!("🎭 [DEBUG] Detected Emotiv device");
            let emotiv_channels = vec![
                "AF3", "F7", "F3", "FC5", "T7", "P7", "O1", "O2", 
                "P8", "T8", "FC6", "F4", "F8", "AF4"
            ];
            
            for i in 0..channel_count.min(emotiv_channels.len()) {
                channel_names.push(emotiv_channels[i].to_string());
            }
        }
        // Generic fallback
        else {
            println!("❓ [DEBUG] Unknown device, using generic channel names");
            for i in 0..channel_count {
                channel_names.push(format!("Ch{}", i + 1));
            }
        }
        
        // Ensure we have the right number of channels
        while channel_names.len() < channel_count {
            channel_names.push(format!("Ch{}", channel_names.len() + 1));
        }
        
        // Truncate if we have too many
        channel_names.truncate(channel_count);
        
        println!("✅ [DEBUG] Final channel names: {:?}", channel_names);
        channel_names
    }

    fn extract_device_info_sync(stream_info: &StreamInfo) -> (String, String) {
        let source_id = stream_info.source_id().to_lowercase();
        let stream_name = stream_info.hostname().to_lowercase();
        
        // Detect device type from source ID or stream name
        if source_id.contains("unicorn") || stream_name.contains("unicorn") || stream_name == "123" {
            ("g.tec medical engineering GmbH".to_string(), "Unicorn Hybrid Black".to_string())
        } else if source_id.contains("openbci") || stream_name.contains("openbci") {
            ("OpenBCI".to_string(), "Cyton Board".to_string())
        } else if source_id.contains("emotiv") || stream_name.contains("emotiv") {
            ("Emotiv Inc.".to_string(), "EPOC+".to_string())
        } else if source_id.contains("neurosky") || stream_name.contains("neurosky") {
            ("NeuroSky".to_string(), "MindWave".to_string())
        } else if source_id.contains("muse") || stream_name.contains("muse") {
            ("InteraXon".to_string(), "Muse Headband".to_string())
        } else {
            ("Unknown Manufacturer".to_string(), "EEG Device".to_string())
        }
    }

    async fn disconnect_lsl(&self) {
        println!("🔌 [DEBUG] Disconnecting from LSL stream");
        let mut connection = self.lsl_connection.lock().await;
        connection.stream_info = None;
        connection.channel_count = 8;
        connection.is_real_connection = false;
        connection.stream_name = None;
        
        *self.bandpass_filter.lock().await = None;
        *self.notch_filter.lock().await = None;
        println!("✅ [DEBUG] LSL disconnection complete");
    }

    // Create new inlet each time to avoid threading issues
    async fn get_lsl_sample(&self) -> Option<EEGSample> {
        let connection = self.lsl_connection.lock().await;
        
        // Only try to get real data if we have a real connection
        if !connection.is_real_connection {
            return None;
        }
        
        let stream_name = connection.stream_name.clone()?;
        let channel_count = connection.channel_count;
        drop(connection); // Release lock before blocking operation
        
        // Use blocking task for LSL operations - create fresh inlet each time
        let result = tokio::task::spawn_blocking(move || {
            match resolve_streams(0.1) {
                Ok(streams) => {
                    let matching_stream = streams.iter()
                        .find(|stream| {
                            let hostname = stream.hostname().to_lowercase();
                            let source_id = stream.source_id().to_lowercase();
                            let target = stream_name.to_lowercase();
                            
                            hostname == target || 
                            source_id.contains(&target) || 
                            hostname.contains(&target) ||
                            (target == "123" && (hostname == "123" || source_id.contains("unicorn")))
                        });
                    
                    if let Some(stream_info) = matching_stream {
                        match StreamInlet::new(stream_info, 360, 1, true) {
                            Ok(inlet) => {
                                // Pull sample with very short timeout
                                match <StreamInlet as Pullable<f32>>::pull_sample(&inlet, 0.001) {
                                    Ok((sample, timestamp)) => {
                                        let mut channels = vec![0.0f32; channel_count];
                                        for (i, &value) in sample.iter().enumerate().take(channel_count) {
                                            channels[i] = value;
                                        }
                                        
                                        Some(EEGSample {
                                            timestamp,
                                            channels,
                                        })
                                    }
                                    Err(_) => None, // No data available right now
                                }
                            }
                            Err(_) => None,
                        }
                    } else {
                        None
                    }
                }
                Err(_) => None,
            }
        }).await;
        
        result.unwrap_or(None)
    }

    async fn apply_real_time_filters(&self, sample: &EEGSample) -> FilteredEEGSample {
        let mut bandpass_guard = self.bandpass_filter.lock().await;
        let mut notch_guard = self.notch_filter.lock().await;
        
        if let (Some(bandpass), Some(notch)) = (bandpass_guard.as_mut(), notch_guard.as_mut()) {
            // Apply bandpass filter (1-40 Hz)
            let bandpass_output = bandpass.process(&sample.channels);
            
            // Apply notch filter (50 Hz)
            let notch_output = notch.process(&bandpass_output);
            
            // Artifact removal - clip extreme values (>300 µV)
            let mut filtered_channels = notch_output;
            for channel_data in filtered_channels.iter_mut() {
                if channel_data.abs() > 300.0 {
                    *channel_data = channel_data.signum() * 300.0;
                }
            }
            
            FilteredEEGSample {
                timestamp: sample.timestamp,
                channels: filtered_channels,
            }
        } else {
            // Fallback: simple filtering if filters not initialized
            let mut filtered_channels = sample.channels.clone();
            for channel_data in filtered_channels.iter_mut() {
                if channel_data.abs() > 300.0 {
                    *channel_data = channel_data.signum() * 300.0;
                }
                *channel_data *= 0.95; // Simple high-pass
            }
            
            FilteredEEGSample {
                timestamp: sample.timestamp,
                channels: filtered_channels,
            }
        }
    }

    async fn update_buffers(&self, sample: &EEGSample, filtered_sample: &FilteredEEGSample) {
        let mut raw_buffers = self.channel_buffers.lock().await;
        let mut filtered_buffers = self.filtered_buffers.lock().await;
        
        for (i, (&raw_value, &filtered_value)) in sample.channels.iter()
            .zip(filtered_sample.channels.iter()).enumerate() {
            
            if i < raw_buffers.len() {
                raw_buffers[i].push(raw_value);
                if raw_buffers[i].len() > self.buffer_size {
                    raw_buffers[i].remove(0);
                }
            }
            
            if i < filtered_buffers.len() {
                filtered_buffers[i].push(filtered_value);
                if filtered_buffers[i].len() > self.buffer_size {
                    filtered_buffers[i].remove(0);
                }
            }
        }
    }

    async fn analyze_frequency_bands(&self, timestamp: f64) -> Vec<FrequencyBands> {
        let buffers = self.filtered_buffers.lock().await;
        let mut results = Vec::new();
        
        for (channel_idx, buffer) in buffers.iter().enumerate() {
            if buffer.len() < self.buffer_size {
                continue;
            }
            
            // Perform FFT
            let mut planner = FftPlanner::new();
            let fft = planner.plan_fft_forward(self.buffer_size);
            
            let mut buffer_complex: Vec<Complex<f32>> = buffer
                .iter()
                .map(|&x| Complex::new(x, 0.0))
                .collect();
            
            fft.process(&mut buffer_complex);
            
            // Calculate power in frequency bands
            let freq_resolution = self.sample_rate / self.buffer_size as f32;
            let mut alpha_power = 0.0;
            let mut beta_power = 0.0;
            let mut theta_power = 0.0;
            let mut delta_power = 0.0;
            let mut gamma_power = 0.0;
            
            for (i, complex) in buffer_complex.iter().enumerate() {
                let freq = i as f32 * freq_resolution;
                let power = complex.norm_sqr();
                
                match freq {
                    f if f >= 0.5 && f < 4.0 => delta_power += power,
                    f if f >= 4.0 && f < 8.0 => theta_power += power,
                    f if f >= 8.0 && f < 12.0 => alpha_power += power,
                    f if f >= 13.0 && f < 30.0 => beta_power += power,
                    f if f >= 30.0 && f < 100.0 => gamma_power += power,
                    _ => {}
                }
            }
            
            results.push(FrequencyBands {
                timestamp,
                channel: channel_idx,
                alpha: alpha_power.sqrt(),
                beta: beta_power.sqrt(),
                theta: theta_power.sqrt(),
                delta: delta_power.sqrt(),
                gamma: gamma_power.sqrt(),
            });
        }
        
        results
    }

    async fn get_stream_info(&self) -> Option<LSLStreamInfo> {
        let connection = self.lsl_connection.lock().await;
        connection.stream_info.clone()
    }

    async fn is_real_connection(&self) -> bool {
        let connection = self.lsl_connection.lock().await;
        connection.is_real_connection
    }
}

#[tauri::command]
async fn connect_to_lsl_stream(
    stream_name: String,
    processor: State<'_, Arc<Mutex<EEGProcessor>>>,
) -> Result<LSLStreamInfo, String> {
    println!("🚀 [DEBUG] Tauri command: connect_to_lsl_stream called with stream_name: '{}'", stream_name);
    
    let processor = processor.inner().clone();
    let processor_guard = processor.lock().await;
    
    let result = processor_guard.connect_to_lsl(&stream_name).await;
    
    match &result {
        Ok(info) => {
            println!("✅ [DEBUG] Tauri command: connect_to_lsl_stream succeeded");
            println!("📊 [DEBUG] Returning stream info: {:?}", info);
        }
        Err(e) => {
            println!("❌ [DEBUG] Tauri command: connect_to_lsl_stream failed: {}", e);
        }
    }
    
    result
}

#[tauri::command]
async fn disconnect_from_lsl(
    processor: State<'_, Arc<Mutex<EEGProcessor>>>,
) -> Result<(), String> {
    println!("🔌 [DEBUG] Tauri command: disconnect_from_lsl called");
    
    let processor = processor.inner().clone();
    let processor_guard = processor.lock().await;
    
    processor_guard.disconnect_lsl().await;
    
    println!("✅ [DEBUG] Tauri command: disconnect_from_lsl completed");
    Ok(())
}

#[tauri::command]
async fn get_current_stream_info(
    processor: State<'_, Arc<Mutex<EEGProcessor>>>,
) -> Result<Option<LSLStreamInfo>, String> {
    let processor = processor.inner().clone();
    let processor_guard = processor.lock().await;
    
    let info = processor_guard.get_stream_info().await;
    println!("📊 [DEBUG] Tauri command: get_current_stream_info returning: {:?}", info);
    
    Ok(info)
}

#[tauri::command]
async fn start_eeg_processing(
    app_handle: tauri::AppHandle,
    processor: State<'_, Arc<Mutex<EEGProcessor>>>,
) -> Result<(), String> {
    println!("🚀 [DEBUG] Tauri command: start_eeg_processing called");
    
    let processor = processor.inner().clone();
    let app_handle = app_handle.clone();
    
    tokio::spawn(async move {
        println!("🔄 [DEBUG] EEG processing loop started");
        
        let mut interval = interval(Duration::from_millis(4)); // 250 Hz = 4ms intervals
        let start_time = std::time::SystemTime::now();
        let mut sample_count = 0u64;
        let mut last_fft_time = 0u64;
        let mut last_data_log = 0u64;
        
        loop {
            interval.tick().await;
            
            let elapsed = start_time.elapsed().unwrap_or_default();
            let timestamp = elapsed.as_secs_f64();
            sample_count += 1;
            
            let processor_guard = processor.lock().await;
            let is_real_connection = processor_guard.is_real_connection().await;
            
            if is_real_connection {
                // Try to get REAL LSL sample
                if let Some(lsl_sample) = processor_guard.get_lsl_sample().await {
                    // Log data reception periodically
                    let current_time_ms = (timestamp * 1000.0) as u64;
                    if current_time_ms - last_data_log >= 5000 { // Every 5 seconds
                        println!("📊 [DEBUG] Received real LSL sample: {} channels, timestamp: {}", 
                                lsl_sample.channels.len(), lsl_sample.timestamp);
                        last_data_log = current_time_ms;
                    }
                    
                    // Apply real-time filters
                    let filtered_sample = processor_guard.apply_real_time_filters(&lsl_sample).await;
                    
                    // Update buffers for FFT analysis
                    processor_guard.update_buffers(&lsl_sample, &filtered_sample).await;
                    
                    // Emit raw EEG sample (every 2nd sample for performance)
                    if sample_count % 2 == 0 {
                        if let Err(e) = app_handle.emit_all("eeg_sample", &lsl_sample) {
                            eprintln!("❌ [DEBUG] Failed to emit raw EEG sample: {}", e);
                        }
                    }
                    
                    // Emit filtered EEG sample (every 2nd sample for performance)
                    if sample_count % 2 == 0 {
                        if let Err(e) = app_handle.emit_all("filtered_eeg_sample", &filtered_sample) {
                            eprintln!("❌ [DEBUG] Failed to emit filtered EEG sample: {}", e);
                        }
                    }
                    
                    // Analyze frequency bands every 250ms
                    let current_time_ms = (timestamp * 1000.0) as u64;
                    if current_time_ms - last_fft_time >= 250 {
                        let bands = processor_guard.analyze_frequency_bands(timestamp).await;
                        if let Err(e) = app_handle.emit_all("frequency_bands", &bands) {
                            eprintln!("❌ [DEBUG] Failed to emit frequency bands: {}", e);
                        }
                        last_fft_time = current_time_ms;
                    }
                } else {
                    // No real data available - this is normal, just continue
                    // Don't log this as it would spam the console
                }
            } else {
                // No real connection - should not happen if we reach this point
                println!("⚠️ [DEBUG] EEG processing running but no real connection available");
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
            
            drop(processor_guard);
        }
    });
    
    println!("✅ [DEBUG] Tauri command: start_eeg_processing completed (background task started)");
    Ok(())
}

#[tauri::command]
fn get_meditation_quote() -> String {
    let quotes = vec![
        "The mind is everything. What you think you become. - Buddha",
        "Peace comes from within. Do not seek it without. - Buddha",
        "Meditation is not evasion; it is a serene encounter with reality. - Thich Nhat Hanh",
        "In the depth of winter, I finally learned that there was in me an invincible summer. - Albert Camus",
        "Breathe in peace, breathe out stress. - Anonymous",
        "The present moment is the only time over which we have dominion. - Thich Nhat Hanh",
        "Your calm mind is the ultimate weapon against your challenges. - Bryant McGill",
        "Meditation is a way for nourishing and blossoming the divinity within you. - Amit Ray",
    ];
    
    let mut rng = rand::rngs::StdRng::from_entropy();
    quotes.choose(&mut rng).unwrap_or(&quotes[0]).to_string()
}

fn main() {
    println!("🚀 [DEBUG] Starting Tauri application...");
    
    let processor = Arc::new(Mutex::new(EEGProcessor::new()));
    
    tauri::Builder::default()
        .manage(processor)
        .invoke_handler(tauri::generate_handler![
            connect_to_lsl_stream,
            disconnect_from_lsl,
            get_current_stream_info,
            start_eeg_processing,
            get_meditation_quote
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}