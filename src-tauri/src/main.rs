// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::interval;
use tauri::{Manager, State};
use serde::{Deserialize, Serialize};
use rustfft::{FftPlanner, num_complex::Complex};
use rand::Rng;
use lsl::{StreamInlet, resolve_streams};

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
}

#[derive(Debug, Deserialize)]
struct LSLConfig {
    stream_name: String,
    use_real_data: bool,
}

struct EEGProcessor {
    sample_rate: f32,
    buffer_size: usize,
    channel_buffers: Arc<Mutex<Vec<Vec<f32>>>>,
    filtered_buffers: Arc<Mutex<Vec<Vec<f32>>>>,
    lsl_inlet: Arc<Mutex<Option<StreamInlet>>>,
    is_using_lsl: Arc<Mutex<bool>>,
    stream_info: Arc<Mutex<Option<LSLStreamInfo>>>,
    channel_count: Arc<Mutex<usize>>,
}

impl EEGProcessor {
    fn new() -> Self {
        Self {
            sample_rate: 250.0,
            buffer_size: 512,
            channel_buffers: Arc::new(Mutex::new(vec![Vec::new(); 8])),
            filtered_buffers: Arc::new(Mutex::new(vec![Vec::new(); 8])),
            lsl_inlet: Arc::new(Mutex::new(None)),
            is_using_lsl: Arc::new(Mutex::new(false)),
            stream_info: Arc::new(Mutex::new(None)),
            channel_count: Arc::new(Mutex::new(8)),
        }
    }

    async fn connect_to_lsl(&self, stream_name: &str) -> Result<LSLStreamInfo, String> {
        println!("🔍 Searching for LSL stream: '{}'", stream_name);
        
        match resolve_streams(Some(5.0)) {
            Ok(streams) => {
                let matching_stream = streams.iter()
                    .find(|stream| stream.name() == stream_name);
                
                if let Some(stream_info) = matching_stream {
                    match StreamInlet::new(stream_info, 360, true) {
                        Ok(inlet) => {
                            let channel_count = stream_info.channel_count() as usize;
                            
                            // Update channel count and resize buffers
                            *self.channel_count.lock().await = channel_count;
                            *self.channel_buffers.lock().await = vec![Vec::new(); channel_count];
                            *self.filtered_buffers.lock().await = vec![Vec::new(); channel_count];

                            // Extract metadata
                            let metadata = format!(
                                "Type: {} | Source: {} | Channels: {} | Rate: {:.1} Hz",
                                stream_info.stream_type(),
                                stream_info.source_id(),
                                stream_info.channel_count(),
                                stream_info.nominal_srate()
                            );

                            let info = LSLStreamInfo {
                                name: stream_info.name().to_string(),
                                channel_count: stream_info.channel_count(),
                                sample_rate: stream_info.nominal_srate(),
                                is_connected: true,
                                metadata,
                            };
                            
                            *self.lsl_inlet.lock().await = Some(inlet);
                            *self.is_using_lsl.lock().await = true;
                            *self.stream_info.lock().await = Some(info.clone());
                            
                            println!("✅ Successfully connected to LSL stream: '{}'", stream_name);
                            println!("📊 Stream info: {}", info.metadata);
                            Ok(info)
                        }
                        Err(e) => {
                            Err(format!("❌ Failed to create LSL inlet: {}", e))
                        }
                    }
                } else {
                    Err(format!("❌ No LSL stream found with name: '{}'", stream_name))
                }
            }
            Err(e) => {
                Err(format!("❌ Failed to resolve LSL streams: {}", e))
            }
        }
    }

    async fn disconnect_lsl(&self) {
        *self.lsl_inlet.lock().await = None;
        *self.is_using_lsl.lock().await = false;
        *self.stream_info.lock().await = None;
        println!("🔌 Disconnected from LSL stream");
    }

    async fn get_lsl_sample(&self) -> Option<EEGSample> {
        let inlet_guard = self.lsl_inlet.lock().await;
        if let Some(inlet) = inlet_guard.as_ref() {
            match inlet.pull_sample(Some(0.01)) {
                Ok((sample, timestamp)) => {
                    let channel_count = *self.channel_count.lock().await;
                    let mut channels = vec![0.0f32; channel_count];
                    for (i, &value) in sample.iter().enumerate().take(channel_count) {
                        channels[i] = value as f32;
                    }
                    
                    Some(EEGSample {
                        timestamp,
                        channels,
                    })
                }
                Err(_) => None,
            }
        } else {
            None
        }
    }

    async fn generate_simulated_sample(&self, timestamp: f64) -> EEGSample {
        let mut rng = rand::thread_rng();
        let channel_count = *self.channel_count.lock().await;
        let mut channels = vec![0.0f32; channel_count];
        
        for (i, channel) in channels.iter_mut().enumerate() {
            // Create unique patterns for each channel (simulating different brain regions)
            let channel_offset = i as f32 * 0.3;
            let time_factor = timestamp as f32 + channel_offset;
            
            // Simulate realistic EEG patterns for meditation
            let alpha_component = (15.0 + i as f32 * 2.0) * (2.0 * std::f32::consts::PI * 10.0 * time_factor).sin();
            let theta_component = (12.0 + i as f32 * 1.5) * (2.0 * std::f32::consts::PI * 6.0 * time_factor).sin();
            let beta_component = (6.0 + i as f32) * (2.0 * std::f32::consts::PI * 20.0 * time_factor).sin();
            let delta_component = (8.0 + i as f32 * 0.5) * (2.0 * std::f32::consts::PI * 2.0 * time_factor).sin();
            let noise = rng.gen_range(-2.0..2.0);
            
            *channel = alpha_component + theta_component + beta_component + delta_component + noise;
        }
        
        EEGSample { timestamp, channels }
    }

    async fn apply_filters(&self, sample: &EEGSample) -> FilteredEEGSample {
        // Simple filtering implementation
        // In a real application, you would implement proper digital filters
        let mut filtered_channels = sample.channels.clone();
        
        // Apply basic smoothing and artifact removal
        for channel_data in filtered_channels.iter_mut() {
            // Artifact removal - clip extreme values
            if channel_data.abs() > 300.0 {
                *channel_data = channel_data.signum() * 300.0;
            }
            
            // Simple high-pass filter simulation (remove DC offset)
            *channel_data *= 0.95;
        }
        
        FilteredEEGSample {
            timestamp: sample.timestamp,
            channels: filtered_channels,
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
        self.stream_info.lock().await.clone()
    }
}

#[tauri::command]
async fn connect_to_lsl_stream(
    stream_name: String,
    processor: State<'_, Arc<Mutex<EEGProcessor>>>,
) -> Result<LSLStreamInfo, String> {
    let processor = processor.inner().clone();
    let processor_guard = processor.lock().await;
    
    processor_guard.connect_to_lsl(&stream_name).await
}

#[tauri::command]
async fn disconnect_from_lsl(
    processor: State<'_, Arc<Mutex<EEGProcessor>>>,
) -> Result<(), String> {
    let processor = processor.inner().clone();
    let processor_guard = processor.lock().await;
    
    processor_guard.disconnect_lsl().await;
    Ok(())
}

#[tauri::command]
async fn get_current_stream_info(
    processor: State<'_, Arc<Mutex<EEGProcessor>>>,
) -> Result<Option<LSLStreamInfo>, String> {
    let processor = processor.inner().clone();
    let processor_guard = processor.lock().await;
    
    Ok(processor_guard.get_stream_info().await)
}

#[tauri::command]
async fn start_eeg_processing(
    app_handle: tauri::AppHandle,
    processor: State<'_, Arc<Mutex<EEGProcessor>>>,
) -> Result<(), String> {
    let processor = processor.inner().clone();
    let app_handle = app_handle.clone();
    
    tokio::spawn(async move {
        let mut interval = interval(Duration::from_millis(4)); // 250 Hz = 4ms intervals
        let start_time = std::time::SystemTime::now();
        
        loop {
            interval.tick().await;
            
            let elapsed = start_time.elapsed().unwrap_or_default();
            let timestamp = elapsed.as_secs_f64();
            
            let processor_guard = processor.lock().await;
            let is_using_lsl = *processor_guard.is_using_lsl.lock().await;
            
            let raw_sample = if is_using_lsl {
                if let Some(lsl_sample) = processor_guard.get_lsl_sample().await {
                    lsl_sample
                } else {
                    // Fallback to simulated data if LSL fails
                    processor_guard.generate_simulated_sample(timestamp).await
                }
            } else {
                processor_guard.generate_simulated_sample(timestamp).await
            };
            
            // Apply filters to get filtered sample
            let filtered_sample = processor_guard.apply_filters(&raw_sample).await;
            
            // Update buffers for FFT analysis
            processor_guard.update_buffers(&raw_sample, &filtered_sample).await;
            
            // Emit raw EEG sample
            if let Err(e) = app_handle.emit_all("eeg_sample", &raw_sample) {
                eprintln!("Failed to emit raw EEG sample: {}", e);
            }
            
            // Emit filtered EEG sample
            if let Err(e) = app_handle.emit_all("filtered_eeg_sample", &filtered_sample) {
                eprintln!("Failed to emit filtered EEG sample: {}", e);
            }
            
            // Analyze frequency bands every 100ms
            if (timestamp * 1000.0) as u64 % 100 == 0 {
                let bands = processor_guard.analyze_frequency_bands(timestamp).await;
                if let Err(e) = app_handle.emit_all("frequency_bands", &bands) {
                    eprintln!("Failed to emit frequency bands: {}", e);
                }
            }
            
            drop(processor_guard);
        }
    });
    
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
    
    let mut rng = rand::thread_rng();
    quotes[rng.gen_range(0..quotes.len())].to_string()
}

fn main() {
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