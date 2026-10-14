//! Optional Azure pronunciation assessment. The subscription key stays in the user's app data folder.

use base64::Engine;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::VecDeque;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, Runtime};

const CONFIG_FILE: &str = "azure-speech.json";
const USAGE_FILE: &str = "azure-usage.json";
const MAX_PER_MINUTE: usize = 20;
static REQUESTS: OnceLock<Mutex<VecDeque<Instant>>> = OnceLock::new();
static USAGE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

#[derive(Debug, Serialize)]
pub struct AzureError {
    code: &'static str,
    retry_after: Option<u64>,
}

fn error(code: &'static str) -> AzureError {
    AzureError {
        code,
        retry_after: None,
    }
}

#[derive(Default, Serialize, Deserialize)]
struct Config {
    key: String,
    region: String,
    enabled: bool,
}

#[derive(Default, Serialize, Deserialize)]
struct Usage {
    month: String,
    seconds: f64,
}

#[derive(Serialize)]
pub struct AzureStatus {
    region: String,
    enabled: bool,
    has_key: bool,
    month: String,
    month_seconds: f64,
}

#[derive(Serialize)]
pub struct LowWord {
    word: String,
    accuracy: f64,
}

#[derive(Serialize)]
pub struct Assessment {
    accuracy: f64,
    fluency: f64,
    completeness: f64,
    total: f64,
    low_words: Vec<LowWord>,
    month_seconds: f64,
}

fn file<R: Runtime>(app: &AppHandle<R>, name: &str) -> Result<PathBuf, AzureError> {
    app.path()
        .app_data_dir()
        .map(|d| d.join(name))
        .map_err(|_| error("storage"))
}

fn read_config<R: Runtime>(app: &AppHandle<R>) -> Result<Config, AzureError> {
    let path = file(app, CONFIG_FILE)?;
    match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|_| error("storage")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Config::default()),
        Err(_) => Err(error("storage")),
    }
}

fn write_private(path: PathBuf, bytes: &[u8]) -> Result<(), AzureError> {
    fs::create_dir_all(path.parent().ok_or_else(|| error("storage"))?)
        .map_err(|_| error("storage"))?;
    let mut options = OpenOptions::new();
    options.create(true).write(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut output = options.open(path).map_err(|_| error("storage"))?;
    output.write_all(bytes).map_err(|_| error("storage"))
}

fn save_config<R: Runtime>(app: &AppHandle<R>, config: &Config) -> Result<(), AzureError> {
    let bytes = serde_json::to_vec(config).map_err(|_| error("storage"))?;
    write_private(file(app, CONFIG_FILE)?, &bytes)
}

fn current_month() -> String {
    Utc::now().format("%Y-%m").to_string()
}

fn read_usage<R: Runtime>(app: &AppHandle<R>) -> Result<Usage, AzureError> {
    let path = file(app, USAGE_FILE)?;
    let mut usage: Usage = match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|_| error("storage"))?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Usage::default(),
        Err(_) => return Err(error("storage")),
    };
    if usage.month != current_month() {
        usage = Usage {
            month: current_month(),
            seconds: 0.0,
        };
    }
    Ok(usage)
}

fn add_usage<R: Runtime>(app: &AppHandle<R>, seconds: f64) -> Result<f64, AzureError> {
    let _guard = USAGE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| error("storage"))?;
    let mut usage = read_usage(app)?;
    usage.seconds += seconds;
    let bytes = serde_json::to_vec(&usage).map_err(|_| error("storage"))?;
    write_private(file(app, USAGE_FILE)?, &bytes)?;
    Ok(usage.seconds)
}

fn status<R: Runtime>(app: &AppHandle<R>) -> Result<AzureStatus, AzureError> {
    let config = read_config(app)?;
    let usage = read_usage(app)?;
    Ok(AzureStatus {
        region: config.region,
        enabled: config.enabled,
        has_key: !config.key.is_empty(),
        month: usage.month,
        month_seconds: usage.seconds,
    })
}

fn valid_region(region: &str) -> bool {
    (2..=40).contains(&region.len())
        && region
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        && !region.starts_with('-')
        && !region.ends_with('-')
}

#[tauri::command]
pub fn azure_status<R: Runtime>(app: AppHandle<R>) -> Result<AzureStatus, AzureError> {
    status(&app)
}

#[tauri::command]
pub fn save_azure_config<R: Runtime>(
    app: AppHandle<R>,
    region: String,
    key: Option<String>,
    enabled: bool,
) -> Result<AzureStatus, AzureError> {
    let region = region.trim().to_ascii_lowercase();
    if !valid_region(&region) {
        return Err(error("region"));
    }
    let mut config = read_config(&app)?;
    if let Some(key) = key.filter(|k| !k.trim().is_empty()) {
        config.key = key.trim().to_string();
    }
    if enabled && config.key.is_empty() {
        return Err(error("missing_key"));
    }
    config.region = region;
    config.enabled = enabled;
    save_config(&app, &config)?;
    status(&app)
}

#[tauri::command]
pub fn clear_azure_key<R: Runtime>(app: AppHandle<R>) -> Result<AzureStatus, AzureError> {
    let mut config = read_config(&app)?;
    config.key.clear();
    config.enabled = false;
    save_config(&app, &config)?;
    status(&app)
}

#[tauri::command]
pub async fn test_azure_connection<R: Runtime>(app: AppHandle<R>) -> Result<(), AzureError> {
    let config = read_config(&app)?;
    if config.key.is_empty() {
        return Err(error("missing_key"));
    }
    if !valid_region(&config.region) {
        return Err(error("region"));
    }
    let url = format!(
        "https://{}.api.cognitive.microsoft.com/sts/v1.0/issueToken",
        config.region
    );
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| error("network"))?
        .post(url)
        .header("Ocp-Apim-Subscription-Key", config.key)
        .send()
        .await
        .map_err(|_| error("network"))?;
    if response.status().is_success() {
        Ok(())
    } else if response.status().as_u16() == 401 || response.status().as_u16() == 403 {
        Err(error("invalid_key"))
    } else {
        Err(error("service"))
    }
}

fn reserve_request(now: Instant) -> Result<(), AzureError> {
    let mut requests = REQUESTS
        .get_or_init(|| Mutex::new(VecDeque::new()))
        .lock()
        .map_err(|_| error("service"))?;
    while requests
        .front()
        .is_some_and(|at| now.duration_since(*at) >= Duration::from_secs(60))
    {
        requests.pop_front();
    }
    if requests.len() >= MAX_PER_MINUTE {
        let wait = 60u64.saturating_sub(
            now.duration_since(*requests.front().expect("nonempty"))
                .as_secs(),
        );
        return Err(AzureError {
            code: "rate_limited",
            retry_after: Some(wait.max(1)),
        });
    }
    requests.push_back(now);
    Ok(())
}

fn score(value: &Value, key: &str) -> Result<f64, AzureError> {
    value
        .get(key)
        .and_then(Value::as_f64)
        .filter(|n| n.is_finite() && (0.0..=100.0).contains(n))
        .ok_or_else(|| error("response"))
}

fn parse_assessment(body: &Value, month_seconds: f64) -> Result<Assessment, AzureError> {
    if body.get("RecognitionStatus").and_then(Value::as_str) != Some("Success") {
        return Err(error("no_speech"));
    }
    let best = body
        .get("NBest")
        .and_then(Value::as_array)
        .and_then(|v| v.first())
        .ok_or_else(|| error("response"))?;
    let grading = best
        .get("PronunciationAssessment")
        .ok_or_else(|| error("response"))?;
    let low_words = best
        .get("Words")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| {
            let word = item.get("Word")?.as_str()?.to_string();
            let grade = item.get("PronunciationAssessment")?;
            let accuracy = grade
                .get("AccuracyScore")
                .and_then(Value::as_f64)
                .unwrap_or(0.0);
            let error_type = grade
                .get("ErrorType")
                .and_then(Value::as_str)
                .unwrap_or("None");
            (accuracy < 70.0 || error_type != "None").then_some(LowWord { word, accuracy })
        })
        .collect();
    Ok(Assessment {
        accuracy: score(grading, "AccuracyScore")?,
        fluency: score(grading, "FluencyScore")?,
        completeness: score(grading, "CompletenessScore")?,
        total: score(grading, "PronScore")?,
        low_words,
        month_seconds,
    })
}

#[tauri::command]
pub async fn assess_pronunciation<R: Runtime>(
    app: AppHandle<R>,
    audio: Vec<u8>,
    reference_text: String,
    duration: f64,
) -> Result<Assessment, AzureError> {
    let config = read_config(&app)?;
    if !config.enabled || config.key.is_empty() {
        return Err(error("disabled"));
    }
    if !valid_region(&config.region) {
        return Err(error("region"));
    }
    if !(0.1..=60.0).contains(&duration)
        || audio.len() < 44
        || audio.len() > 2_000_000
        || !audio.starts_with(b"RIFF")
    {
        return Err(error("audio"));
    }
    let reference = reference_text.trim();
    if reference.is_empty() || reference.len() > 500 {
        return Err(error("reference"));
    }
    reserve_request(Instant::now())?;
    let settings = json!({
        "ReferenceText": reference,
        "GradingSystem": "HundredMark",
        "Granularity": "Word",
        "Dimension": "Comprehensive",
        "EnableMiscue": true,
    });
    let assessment_header = base64::engine::general_purpose::STANDARD.encode(settings.to_string());
    let url = format!("https://{}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=nl-NL&format=detailed", config.region);
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(35))
        .build()
        .map_err(|_| error("network"))?
        .post(url)
        .header("Ocp-Apim-Subscription-Key", config.key)
        .header(
            "Content-Type",
            "audio/wav; codecs=audio/pcm; samplerate=16000",
        )
        .header("Accept", "application/json")
        .header("Pronunciation-Assessment", assessment_header)
        .body(audio)
        .send()
        .await
        .map_err(|_| error("network"))?;
    if response.status().as_u16() == 401 || response.status().as_u16() == 403 {
        return Err(error("invalid_key"));
    }
    if !response.status().is_success() {
        return Err(error("service"));
    }
    let body: Value = response.json().await.map_err(|_| error("response"))?;
    let used = add_usage(&app, duration)?;
    parse_assessment(&body, used)
}

#[cfg(test)]
mod tests {
    use super::{parse_assessment, reserve_request, valid_region};
    use serde_json::json;
    use std::time::{Duration, Instant};

    #[test]
    fn region_cannot_change_host() {
        assert!(valid_region("westeurope"));
        assert!(valid_region("eastus2"));
        assert!(!valid_region("eastus.example.com"));
        assert!(!valid_region("../eastus"));
    }

    #[test]
    fn parses_words_and_four_scores() {
        let body = json!({"RecognitionStatus":"Success","NBest":[{
            "PronunciationAssessment":{"AccuracyScore":82.0,"FluencyScore":76.0,"CompletenessScore":90.0,"PronScore":81.0},
            "Words":[{"Word":"Hallo","PronunciationAssessment":{"AccuracyScore":95.0,"ErrorType":"None"}},
                     {"Word":"morgen","PronunciationAssessment":{"AccuracyScore":60.0,"ErrorType":"None"}}]
        }]});
        let result = parse_assessment(&body, 12.5).unwrap();
        assert_eq!(result.total, 81.0);
        assert_eq!(result.low_words[0].word, "morgen");
        assert_eq!(result.month_seconds, 12.5);
    }

    #[test]
    fn allows_at_most_twenty_requests_in_a_rolling_minute() {
        let now = Instant::now();
        for _ in 0..20 {
            reserve_request(now).unwrap();
        }
        let limited = reserve_request(now).unwrap_err();
        assert_eq!(limited.code, "rate_limited");
        assert!(reserve_request(now + Duration::from_secs(60)).is_ok());
    }
}
