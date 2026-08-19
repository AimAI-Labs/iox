use serde_json::Value;
use std::collections::HashSet;
use std::time::Duration;

/// 根据用户输入的 base_url 生成尝试请求的 models 端点列表
pub fn build_models_endpoints(base_url: &str) -> Vec<String> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return vec![];
    }

    if trimmed.ends_with("/models") {
        return vec![trimmed.to_string()];
    }

    if trimmed.ends_with("/v1") {
        return vec![format!("{}/models", trimmed)];
    }

    // 默认优先尝试 /v1/models，备选 /models
    vec![
        format!("{}/v1/models", trimmed),
        format!("{}/models", trimmed),
    ]
}

/// 解析各种兼容 OpenAI 或 Ollama 的 JSON 响应，提取模型名称列表并保序去重
pub fn parse_models_response(json: &Value) -> Vec<String> {
    let mut results = Vec::new();
    let mut seen = HashSet::new();

    let mut add_model = |name: &str| {
        let trimmed = name.trim();
        if !trimmed.is_empty() && !seen.contains(trimmed) {
            seen.insert(trimmed.to_string());
            results.push(trimmed.to_string());
        }
    };

    // 1. 标准 OpenAI 格式: { "data": [ { "id": "model-1" }, ... ] }
    if let Some(data_array) = json.get("data").and_then(|d| d.as_array()) {
        for item in data_array {
            if let Some(id_str) = item.get("id").and_then(|id| id.as_str()) {
                add_model(id_str);
            } else if let Some(name_str) = item.get("name").and_then(|n| n.as_str()) {
                add_model(name_str);
            } else if let Some(str_val) = item.as_str() {
                add_model(str_val);
            }
        }
    }

    // 2. Ollama 或衍生格式: { "models": [ { "name": "model-1" }, ... ] }
    if let Some(models_array) = json.get("models").and_then(|m| m.as_array()) {
        for item in models_array {
            if let Some(name_str) = item.get("name").and_then(|n| n.as_str()) {
                add_model(name_str);
            } else if let Some(id_str) = item.get("id").and_then(|id| id.as_str()) {
                add_model(id_str);
            } else if let Some(str_val) = item.as_str() {
                add_model(str_val);
            }
        }
    }

    // 3. 根节点直接是数组: [ { "id": "..." } ] 或 [ "model-1", "model-2" ]
    if let Some(root_array) = json.as_array() {
        for item in root_array {
            if let Some(id_str) = item.get("id").and_then(|id| id.as_str()) {
                add_model(id_str);
            } else if let Some(name_str) = item.get("name").and_then(|n| n.as_str()) {
                add_model(name_str);
            } else if let Some(str_val) = item.as_str() {
                add_model(str_val);
            }
        }
    }

    results
}

/// 异步从服务商 API 获取可用模型列表
pub async fn fetch_provider_models(base_url: String, api_key: String) -> Result<Vec<String>, String> {
    let endpoints = build_models_endpoints(&base_url);
    if endpoints.is_empty() {
        return Err("API Base URL 不能为空".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建网络请求客户端失败: {}", e))?;

    let mut last_error = String::new();

    for (index, endpoint) in endpoints.iter().enumerate() {
        let mut req = client.get(endpoint);
        let trimmed_key = api_key.trim();
        if !trimmed_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", trimmed_key));
        }

        match req.send().await {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    let json_val: Value = resp
                        .json()
                        .await
                        .map_err(|e| format!("解析模型列表 JSON 响应失败: {}", e))?;

                    let models = parse_models_response(&json_val);
                    if models.is_empty() {
                        return Err("服务商返回的模型列表为空".to_string());
                    }
                    return Ok(models);
                } else if status.as_u16() == 404 && index + 1 < endpoints.len() {
                    // 如果 404 且还有备用端点，继续尝试下一个端点
                    last_error = format!("HTTP 404: 端点不存在 ({})", endpoint);
                    continue;
                } else {
                    let err_text = resp.text().await.unwrap_or_default();
                    let tip = match status.as_u16() {
                        401 => " (API Key 无效或未授权)",
                        403 => " (访问被拒绝)",
                        404 => " (端点未找到，请检查 Base URL)",
                        429 => " (请求过多或配额不足)",
                        _ => "",
                    };
                    return Err(format!("HTTP {}{}: {}", status.as_u16(), tip, err_text));
                }
            }
            Err(e) => {
                last_error = if e.is_timeout() {
                    "请求超时，请检查服务商地址是否可连通".to_string()
                } else if e.is_connect() {
                    format!("无法连接到服务商服务器: {}", e)
                } else {
                    format!("网络请求失败: {}", e)
                };
            }
        }
    }

    Err(if last_error.is_empty() {
        "获取模型列表失败".to_string()
    } else {
        last_error
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_build_models_endpoints() {
        assert_eq!(
            build_models_endpoints("https://api.deepseek.com/v1"),
            vec!["https://api.deepseek.com/v1/models"]
        );
        assert_eq!(
            build_models_endpoints("https://api.deepseek.com/v1/"),
            vec!["https://api.deepseek.com/v1/models"]
        );
        assert_eq!(
            build_models_endpoints("https://api.openai.com/v1/models"),
            vec!["https://api.openai.com/v1/models"]
        );
        assert_eq!(
            build_models_endpoints("https://api.openai.com"),
            vec![
                "https://api.openai.com/v1/models",
                "https://api.openai.com/models"
            ]
        );
        assert_eq!(build_models_endpoints(""), Vec::<String>::new());
    }

    #[test]
    fn test_parse_openai_standard_models() {
        let val = json!({
            "object": "list",
            "data": [
                { "id": "deepseek-chat", "object": "model", "created": 1700000000 },
                { "id": "deepseek-reasoner", "object": "model", "created": 1700000001 },
                { "id": "deepseek-chat", "object": "model", "created": 1700000002 } // 重复项
            ]
        });
        let parsed = parse_models_response(&val);
        assert_eq!(parsed, vec!["deepseek-chat", "deepseek-reasoner"]);
    }

    #[test]
    fn test_parse_ollama_models() {
        let val = json!({
            "models": [
                { "name": "deepseek-r1:latest", "modified_at": "2024-01-01" },
                { "name": "llama3:latest", "modified_at": "2024-01-02" }
            ]
        });
        let parsed = parse_models_response(&val);
        assert_eq!(parsed, vec!["deepseek-r1:latest", "llama3:latest"]);
    }

    #[test]
    fn test_parse_flat_array_models() {
        let val = json!(["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet"]);
        let parsed = parse_models_response(&val);
        assert_eq!(parsed, vec!["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet"]);
    }
}
