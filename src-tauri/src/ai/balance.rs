use reqwest::{redirect::Policy, Client, Url};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BalanceError {
    Unsupported,
    MissingKey,
    ProviderMissing,
    Unauthorized,
    RateLimited,
    Timeout,
    Network,
    InvalidResponse,
    Server,
    ConfigChanged,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BalanceInfo {
    pub currency: String,
    #[serde(alias = "total_balance")]
    pub total_balance: String,
    #[serde(alias = "granted_balance")]
    pub granted_balance: String,
    #[serde(alias = "topped_up_balance")]
    pub topped_up_balance: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderBalance {
    #[serde(alias = "is_available")]
    pub is_available: bool,
    #[serde(alias = "balance_infos")]
    pub balance_infos: Vec<BalanceInfo>,
}

/// 按 API 来源选择策略；新增服务商在此扩展，账号密钥只发送到对应官网。
enum BalanceAdapter {
    DeepSeek,
}

impl BalanceAdapter {
    fn for_base_url(base_url: &str) -> Option<Self> {
        let url = Url::parse(base_url.trim()).ok()?;
        (url.scheme() == "https"
            && url.host_str() == Some("api.deepseek.com")
            && url.port().is_none()
            && url.username().is_empty()
            && url.password().is_none())
        .then_some(Self::DeepSeek)
    }

    fn endpoint(&self) -> &'static str {
        match self {
            Self::DeepSeek => "https://api.deepseek.com/user/balance",
        }
    }
}

fn balance_client() -> Result<Client, BalanceError> {
    Client::builder()
        .timeout(Duration::from_secs(15))
        // 余额接口没有重定向需求，不向跳转目标发送请求或凭据。
        .redirect(Policy::none())
        .build()
        .map_err(|_| BalanceError::Network)
}

pub async fn fetch_provider_balance(
    base_url: &str,
    api_key: &str,
) -> Result<ProviderBalance, BalanceError> {
    let adapter = BalanceAdapter::for_base_url(base_url).ok_or(BalanceError::Unsupported)?;
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err(BalanceError::MissingKey);
    }
    request_balance(&balance_client()?, adapter.endpoint(), api_key).await
}

pub fn verify_account(
    base_url: &str,
    api_key: &str,
    expected_base_url: &str,
    expected_api_key: &str,
) -> Result<(), BalanceError> {
    if base_url != expected_base_url || api_key != expected_api_key {
        return Err(BalanceError::ConfigChanged);
    }
    Ok(())
}

async fn request_balance(
    client: &Client,
    endpoint: &str,
    api_key: &str,
) -> Result<ProviderBalance, BalanceError> {
    let response = client
        .get(endpoint)
        .bearer_auth(api_key)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                BalanceError::Timeout
            } else {
                BalanceError::Network
            }
        })?;
    if !response.status().is_success() {
        return Err(match response.status().as_u16() {
            401 | 403 => BalanceError::Unauthorized,
            429 => BalanceError::RateLimited,
            _ => BalanceError::Server,
        });
    }
    // 只向 UI 返回固定错误码，不透传可能包含账号或密钥信息的响应正文。
    let body = response.bytes().await.map_err(|error| {
        if error.is_timeout() {
            BalanceError::Timeout
        } else {
            BalanceError::Network
        }
    })?;
    let balance: ProviderBalance =
        serde_json::from_slice(&body).map_err(|_| BalanceError::InvalidResponse)?;
    validate_balance(&balance)?;
    Ok(balance)
}

fn validate_balance(balance: &ProviderBalance) -> Result<(), BalanceError> {
    if balance.balance_infos.is_empty() || balance.balance_infos.len() > 2 {
        return Err(BalanceError::InvalidResponse);
    }
    let mut currencies = std::collections::HashSet::new();
    for info in &balance.balance_infos {
        if !matches!(info.currency.as_str(), "CNY" | "USD") || !currencies.insert(&info.currency) {
            return Err(BalanceError::InvalidResponse);
        }
        for amount in [
            &info.total_balance,
            &info.granted_balance,
            &info.topped_up_balance,
        ] {
            if amount.len() > 64 || !amount.parse::<f64>().is_ok_and(f64::is_finite) {
                return Err(BalanceError::InvalidResponse);
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    const RESPONSE: &str = r#"{"is_available":true,"balance_infos":[{"currency":"CNY","total_balance":"12.3400","granted_balance":"2.00","topped_up_balance":"10.34"}]}"#;

    #[test]
    fn only_official_https_accounts_support_balance() {
        for url in [
            "https://api.deepseek.com",
            " https://api.deepseek.com/v1/ ",
            "https://api.deepseek.com/beta",
        ] {
            assert!(BalanceAdapter::for_base_url(url).is_some());
        }
        for url in [
            "http://api.deepseek.com",
            "https://api.deepseek.com:444",
            "https://api.deepseek.com.evil.test",
            "https://proxy.test/deepseek",
            "https://user@api.deepseek.com",
            "invalid",
        ] {
            assert!(BalanceAdapter::for_base_url(url).is_none());
        }
    }

    #[test]
    fn normalizes_contract_without_losing_decimal_precision() {
        let balance: ProviderBalance = serde_json::from_str(RESPONSE).unwrap();
        validate_balance(&balance).unwrap();
        assert_eq!(balance.balance_infos[0].total_balance, "12.3400");
        let json = serde_json::to_value(balance).unwrap();
        assert_eq!(json["isAvailable"], true);
        assert_eq!(json["balanceInfos"][0]["totalBalance"], "12.3400");
    }

    #[test]
    fn stale_frontend_credentials_cannot_label_a_new_accounts_balance() {
        assert_eq!(
            verify_account(
                "https://api.deepseek.com",
                "new-fixture-key",
                "https://api.deepseek.com",
                "old-fixture-key"
            ),
            Err(BalanceError::ConfigChanged)
        );
        assert_eq!(
            verify_account(
                "https://api.deepseek.com/v1",
                "fixture-key",
                "https://api.deepseek.com",
                "fixture-key"
            ),
            Err(BalanceError::ConfigChanged)
        );
        assert!(verify_account(
            "https://api.deepseek.com",
            "fixture-key",
            "https://api.deepseek.com",
            "fixture-key"
        )
        .is_ok());
    }

    #[test]
    fn rejects_missing_nonfinite_duplicate_or_unsupported_balances() {
        for replacement in ["NaN", "inf", "bad", ""] {
            let balance: ProviderBalance =
                serde_json::from_str(&RESPONSE.replace("12.3400", replacement)).unwrap();
            assert_eq!(
                validate_balance(&balance),
                Err(BalanceError::InvalidResponse)
            );
        }
        let mut balance: ProviderBalance = serde_json::from_str(RESPONSE).unwrap();
        balance.balance_infos[0].currency = "EUR".into();
        assert_eq!(
            validate_balance(&balance),
            Err(BalanceError::InvalidResponse)
        );
        balance.balance_infos.clear();
        assert_eq!(
            validate_balance(&balance),
            Err(BalanceError::InvalidResponse)
        );
        assert!(serde_json::from_str::<ProviderBalance>(r#"{"is_available":true}"#).is_err());
    }

    fn server(status: &str, body: &str) -> (String, std::thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let endpoint = format!("http://{}/user/balance", listener.local_addr().unwrap());
        let response = format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = [0; 4096];
            let count = stream.read(&mut request).unwrap();
            let request = String::from_utf8_lossy(&request[..count]).to_lowercase();
            assert!(request.starts_with("get /user/balance "));
            assert!(request.contains("authorization: bearer fixture-key"));
            stream.write_all(response.as_bytes()).unwrap();
        });
        (endpoint, handle)
    }

    #[tokio::test]
    async fn http_uses_bearer_auth_and_normalizes_the_response() {
        let (endpoint, handle) = server("200 OK", RESPONSE);
        let balance = request_balance(&balance_client().unwrap(), &endpoint, "fixture-key")
            .await
            .unwrap();
        assert!(balance.is_available);
        assert_eq!(balance.balance_infos[0].total_balance, "12.3400");
        handle.join().unwrap();
    }

    #[tokio::test]
    async fn http_errors_are_fixed_codes_without_response_body() {
        for (status, expected) in [
            ("401 Unauthorized", BalanceError::Unauthorized),
            ("429 Too Many Requests", BalanceError::RateLimited),
            ("500 Internal Server Error", BalanceError::Server),
            ("302 Found", BalanceError::Server),
        ] {
            let (endpoint, handle) = server(status, "private error fixture");
            assert_eq!(
                request_balance(&balance_client().unwrap(), &endpoint, "fixture-key")
                    .await
                    .unwrap_err(),
                expected
            );
            handle.join().unwrap();
        }
        let (endpoint, handle) = server("200 OK", "invalid json");
        assert_eq!(
            request_balance(&balance_client().unwrap(), &endpoint, "fixture-key")
                .await
                .unwrap_err(),
            BalanceError::InvalidResponse
        );
        handle.join().unwrap();
    }

    #[tokio::test]
    async fn unsupported_provider_and_missing_key_fail_before_http() {
        assert_eq!(
            fetch_provider_balance("https://proxy.test", "fixture-key")
                .await
                .unwrap_err(),
            BalanceError::Unsupported
        );
        assert_eq!(
            fetch_provider_balance("https://api.deepseek.com/v1", " ")
                .await
                .unwrap_err(),
            BalanceError::MissingKey
        );
    }

    #[tokio::test]
    async fn body_transport_failures_remain_network_or_timeout_errors() {
        for (delay, expected) in [
            (Duration::ZERO, BalanceError::Network),
            (Duration::from_millis(300), BalanceError::Timeout),
        ] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let endpoint = format!("http://{}/user/balance", listener.local_addr().unwrap());
            let handle = std::thread::spawn(move || {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                stream.read(&mut [0; 4096]).unwrap();
                stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 4096\r\nConnection: close\r\n\r\n{").unwrap();
                std::thread::sleep(delay);
            });
            let client = Client::builder()
                .timeout(Duration::from_millis(100))
                .build()
                .unwrap();
            assert_eq!(
                request_balance(&client, &endpoint, "fixture-key")
                    .await
                    .unwrap_err(),
                expected
            );
            handle.join().unwrap();
        }
    }
}
