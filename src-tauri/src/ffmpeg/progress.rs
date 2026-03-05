use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ProgressEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        task_id: String,
    },
    #[serde(rename_all = "camelCase")]
    Progress {
        task_id: String,
        percent: f64,
        fps: f64,
        speed: f64,
        time_elapsed: f64,
        eta: f64,
        current_size: u64,
    },
    #[serde(rename_all = "camelCase")]
    Completed {
        task_id: String,
        output_path: String,
        output_size: u64,
    },
    #[serde(rename_all = "camelCase")]
    Failed {
        task_id: String,
        error: String,
    },
    #[serde(rename_all = "camelCase")]
    Cancelled {
        task_id: String,
    },
}

/// Parse a single line from FFmpeg's `-progress pipe:1` output
/// Returns key-value pair if the line is valid
pub fn parse_progress_line(line: &str) -> Option<(&str, &str)> {
    let trimmed = line.trim();
    let (key, value) = trimmed.split_once('=')?;
    Some((key.trim(), value.trim()))
}

/// Accumulate progress lines and compute percent when a full frame is received
#[derive(Debug, Default)]
pub struct ProgressAccumulator {
    pub out_time_us: Option<u64>,
    pub fps: Option<f64>,
    pub speed: Option<f64>,
    pub total_size: Option<u64>,
    pub progress: Option<String>,
}

impl ProgressAccumulator {
    pub fn feed(&mut self, key: &str, value: &str) {
        match key {
            "out_time_us" => {
                self.out_time_us = value.parse::<u64>().ok();
            }
            "fps" => {
                self.fps = value.parse::<f64>().ok();
            }
            "speed" => {
                // speed is like "1.5x" or "N/A"
                self.speed = value.trim_end_matches('x').parse::<f64>().ok();
            }
            "total_size" => {
                self.total_size = value.parse::<u64>().ok();
            }
            "progress" => {
                self.progress = Some(value.to_string());
            }
            _ => {}
        }
    }

    /// Check if a full progress frame has been received
    pub fn is_frame_complete(&self) -> bool {
        self.progress.is_some()
    }

    /// Calculate completion percent based on total duration
    pub fn calc_percent(&self, total_duration_us: u64) -> f64 {
        if total_duration_us == 0 {
            return 0.0;
        }
        let current = self.out_time_us.unwrap_or(0) as f64;
        let total = total_duration_us as f64;
        (current / total * 100.0).clamp(0.0, 100.0)
    }

    /// Calculate ETA in seconds based on speed
    pub fn calc_eta(&self, total_duration_secs: f64) -> f64 {
        let speed = self.speed.unwrap_or(0.0);
        if speed <= 0.0 {
            return 0.0;
        }
        let current_secs = self.out_time_us.unwrap_or(0) as f64 / 1_000_000.0;
        let remaining_secs = total_duration_secs - current_secs;
        if remaining_secs <= 0.0 {
            return 0.0;
        }
        remaining_secs / speed
    }

    /// Reset for next frame
    pub fn reset(&mut self) {
        self.out_time_us = None;
        self.fps = None;
        self.speed = None;
        self.total_size = None;
        self.progress = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_progress_line() {
        assert_eq!(
            parse_progress_line("fps=30.0"),
            Some(("fps", "30.0"))
        );
        assert_eq!(
            parse_progress_line("out_time_us=5000000"),
            Some(("out_time_us", "5000000"))
        );
        assert_eq!(
            parse_progress_line("speed=1.5x"),
            Some(("speed", "1.5x"))
        );
        assert_eq!(
            parse_progress_line("progress=continue"),
            Some(("progress", "continue"))
        );
        assert_eq!(parse_progress_line("invalid line"), None);
    }

    #[test]
    fn test_accumulator_calc_percent() {
        let mut acc = ProgressAccumulator::default();
        acc.out_time_us = Some(5_000_000); // 5 seconds
        let total_us = 10_000_000; // 10 seconds total
        assert!((acc.calc_percent(total_us) - 50.0).abs() < 0.1);
    }

    #[test]
    fn test_accumulator_calc_percent_zero_duration() {
        let acc = ProgressAccumulator::default();
        assert_eq!(acc.calc_percent(0), 0.0);
    }

    #[test]
    fn test_accumulator_calc_eta() {
        let mut acc = ProgressAccumulator::default();
        acc.out_time_us = Some(5_000_000); // 5 seconds processed
        acc.speed = Some(2.0); // 2x speed
        let eta = acc.calc_eta(10.0); // 10 seconds total
        assert!((eta - 2.5).abs() < 0.1); // (10-5)/2 = 2.5
    }

    #[test]
    fn test_accumulator_feed_and_frame() {
        let mut acc = ProgressAccumulator::default();
        assert!(!acc.is_frame_complete());

        acc.feed("fps", "30.0");
        acc.feed("speed", "1.5x");
        acc.feed("out_time_us", "5000000");
        acc.feed("total_size", "1234567");
        assert!(!acc.is_frame_complete());

        acc.feed("progress", "continue");
        assert!(acc.is_frame_complete());
    }

    #[test]
    fn test_accumulator_speed_parsing() {
        let mut acc = ProgressAccumulator::default();
        acc.feed("speed", "2.5x");
        assert!((acc.speed.unwrap() - 2.5).abs() < 0.01);
    }

    #[test]
    fn test_accumulator_reset() {
        let mut acc = ProgressAccumulator::default();
        acc.feed("fps", "30.0");
        acc.feed("speed", "2.0x");
        acc.feed("out_time_us", "5000000");
        acc.feed("total_size", "1234567");
        acc.feed("progress", "continue");

        assert!(acc.is_frame_complete());

        acc.reset();

        assert!(acc.out_time_us.is_none());
        assert!(acc.fps.is_none());
        assert!(acc.speed.is_none());
        assert!(acc.total_size.is_none());
        assert!(acc.progress.is_none());
        assert!(!acc.is_frame_complete());
    }

    #[test]
    fn test_accumulator_calc_percent_clamped() {
        let mut acc = ProgressAccumulator::default();
        // out_time exceeds total duration
        acc.out_time_us = Some(20_000_000);
        let total_us = 10_000_000;
        assert_eq!(acc.calc_percent(total_us), 100.0);
    }

    #[test]
    fn test_accumulator_calc_eta_zero_speed() {
        let mut acc = ProgressAccumulator::default();
        acc.out_time_us = Some(5_000_000);
        acc.speed = Some(0.0);
        assert_eq!(acc.calc_eta(10.0), 0.0);
    }

    #[test]
    fn test_accumulator_calc_eta_no_speed() {
        let acc = ProgressAccumulator::default();
        assert_eq!(acc.calc_eta(10.0), 0.0);
    }

    #[test]
    fn test_accumulator_calc_eta_past_end() {
        let mut acc = ProgressAccumulator::default();
        acc.out_time_us = Some(15_000_000); // past end
        acc.speed = Some(2.0);
        assert_eq!(acc.calc_eta(10.0), 0.0);
    }

    #[test]
    fn test_feed_unknown_key_ignored() {
        let mut acc = ProgressAccumulator::default();
        acc.feed("unknown_key", "some_value");
        assert!(acc.out_time_us.is_none());
        assert!(acc.fps.is_none());
        assert!(acc.speed.is_none());
    }

    #[test]
    fn test_feed_invalid_values() {
        let mut acc = ProgressAccumulator::default();
        acc.feed("fps", "not_a_number");
        assert!(acc.fps.is_none());
        acc.feed("out_time_us", "abc");
        assert!(acc.out_time_us.is_none());
    }

    #[test]
    fn test_speed_na_parsing() {
        let mut acc = ProgressAccumulator::default();
        acc.feed("speed", "N/A");
        assert!(acc.speed.is_none());
    }

    #[test]
    fn test_progress_event_serialization() {
        let event = ProgressEvent::Progress {
            task_id: "task_1".into(),
            percent: 50.0,
            fps: 30.0,
            speed: 2.0,
            time_elapsed: 5.0,
            eta: 5.0,
            current_size: 1024,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"progress\""));
        assert!(json.contains("\"taskId\""));
    }

    #[test]
    fn test_progress_event_completed_serialization() {
        let event = ProgressEvent::Completed {
            task_id: "task_1".into(),
            output_path: "/out.mp4".into(),
            output_size: 1024,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"completed\""));
        assert!(json.contains("\"outputPath\""));
        assert!(json.contains("\"outputSize\""));
    }
}
