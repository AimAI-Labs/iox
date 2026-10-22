use serde::Serialize;
use std::net::IpAddr;
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkMetadata {
    pub url: String,
    pub site_name: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub published_at: Option<String>,
    pub favicon: Option<String>,
}

#[derive(Default)]
struct Extracted {
    site_name: Option<String>,
    title: Option<String>,
    description: Option<String>,
    published_at: Option<String>,
    favicon: Option<String>,
}

/// 抓取网页 Open Graph / description 元数据，用于链接悬浮卡与详情栏。
#[tauri::command]
pub async fn fetch_link_metadata(url: String) -> Result<LinkMetadata, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|_| "无效链接".to_string())?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("仅支持 http/https 链接".into());
    }
    if is_private_host(&parsed) {
        return Err("不支持访问本地或内网地址".into());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .connect_timeout(Duration::from_secs(4))
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        )
        .build()
        .map_err(|err| format!("初始化请求失败: {err}"))?;

    let response = client
        .get(parsed.clone())
        .header(
            reqwest::header::ACCEPT,
            "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        )
        .send()
        .await
        .map_err(|err| format!("请求失败: {err}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status().as_u16()));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !content_type.is_empty()
        && !content_type.contains("text/html")
        && !content_type.contains("application/xhtml")
    {
        return Err("该链接不是网页".into());
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|err| format!("读取内容失败: {err}"))?;
    let limited = if bytes.len() > 512 * 1024 {
        &bytes[..512 * 1024]
    } else {
        &bytes[..]
    };
    let html = String::from_utf8_lossy(limited);
    let extracted = extract_metadata(&html);

    let favicon = extracted
        .favicon
        .and_then(|href| parsed.join(&href).ok())
        .map(|resolved| resolved.to_string());

    let fallback_site = parsed
        .host_str()
        .unwrap_or_default()
        .trim_start_matches("www.")
        .to_string();

    Ok(LinkMetadata {
        url: parsed.to_string(),
        site_name: extracted.site_name.or(if fallback_site.is_empty() {
            None
        } else {
            Some(fallback_site)
        }),
        title: extracted.title,
        description: extracted.description,
        published_at: extracted.published_at,
        favicon,
    })
}

fn is_private_host(url: &reqwest::Url) -> bool {
    let Some(host) = url.host_str() else {
        return true;
    };

    let ip_host = host.trim_start_matches('[').trim_end_matches(']');
    if let Ok(ip) = ip_host.parse::<IpAddr>() {
        return match ip {
            IpAddr::V4(ip) => {
                ip.is_private() || ip.is_loopback() || ip.is_link_local() || ip.is_unspecified()
            }
            IpAddr::V6(ip) => {
                let segments = ip.segments();
                ip.is_loopback()
                    || ip.is_unspecified()
                    || (segments[0] & 0xfe00) == 0xfc00
                    || (segments[0] & 0xffc0) == 0xfe80
            }
        };
    }

    let domain = host.to_ascii_lowercase();
    domain == "localhost"
        || domain.ends_with(".local")
        || domain.ends_with(".internal")
        || domain.ends_with(".lan")
        || !domain.contains('.')
}

fn extract_metadata(html: &str) -> Extracted {
    let lower = html.to_ascii_lowercase();
    let mut extracted = Extracted::default();
    let mut meta_description: Option<String> = None;

    // <meta property="og:*" content="...">
    let mut cursor = 0;
    while let Some(offset) = lower[cursor..].find("<meta") {
        let start = cursor + offset;
        let Some(end) = find_tag_end(html, start + 5) else {
            break;
        };
        let attrs = parse_attrs(&html[start + 5..end]);

        let key = attr(&attrs, "property").or_else(|| attr(&attrs, "name"));
        let content = attr(&attrs, "content");
        if let (Some(key), Some(content)) = (key, content) {
            let content = clean_text(content, 300);
            match key.to_ascii_lowercase().as_str() {
                "og:site_name" => {
                    if extracted.site_name.is_none() {
                        extracted.site_name = clean_text(content.unwrap_or_default(), 80);
                    }
                }
                "og:title" | "twitter:title" => {
                    if extracted.title.is_none() {
                        extracted.title = content;
                    }
                }
                "og:description" | "twitter:description" => {
                    if extracted.description.is_none() {
                        extracted.description = content;
                    }
                }
                "description" => {
                    if meta_description.is_none() {
                        meta_description = content;
                    }
                }
                "article:published_time"
                | "article:modified_time"
                | "og:updated_time"
                | "og:published_time"
                | "datepublished"
                | "date" => {
                    if extracted.published_at.is_none() {
                        extracted.published_at = content;
                    }
                }
                _ => {}
            }
        }

        cursor = end + 1;
    }

    // <title> 兜底
    if extracted.title.is_none() {
        if let Some(start) = lower.find("<title") {
            if let Some(end) = find_tag_end(html, start + 6) {
                if let Some(close) = lower[end + 1..].find("</title>") {
                    extracted.title = clean_text(
                        decode_entities(&html[end + 1..end + 1 + close]),
                        200,
                    );
                }
            }
        }
    }

    if extracted.description.is_none() {
        extracted.description = meta_description;
    }

    // <link rel="icon" href="...">
    let mut cursor = 0;
    while let Some(offset) = lower[cursor..].find("<link") {
        let start = cursor + offset;
        let Some(end) = find_tag_end(html, start + 5) else {
            break;
        };
        let attrs = parse_attrs(&html[start + 5..end]);
        let rel = attr(&attrs, "rel")
            .unwrap_or_default()
            .to_ascii_lowercase();
        let is_icon = rel
            .split_whitespace()
            .any(|part| part == "icon" || part == "shortcut" || part == "apple-touch-icon");

        if is_icon {
            if let Some(href) = attr(&attrs, "href") {
                extracted.favicon = Some(href);
                break;
            }
        }

        cursor = end + 1;
    }

    // JSON-LD datePublished 兜底
    if extracted.published_at.is_none() {
        if let Some(position) = lower.find("\"datepublished\"") {
            let after_key = position + "\"datepublished\"".len();
            if let Some(rest) = html.get(after_key..) {
                if let Some(first_quote) = rest.find('"') {
                    if let Some(second_quote) = rest[first_quote + 1..].find('"') {
                        extracted.published_at = clean_text(
                            rest[first_quote + 1..first_quote + 1 + second_quote].to_string(),
                            40,
                        );
                    }
                }
            }
        }
    }

    extracted
}

fn find_tag_end(html: &str, from: usize) -> Option<usize> {
    let bytes = html.as_bytes();
    let mut quote: Option<u8> = None;
    let mut index = from;

    while index < bytes.len() {
        let byte = bytes[index];
        match quote {
            Some(active) => {
                if byte == active {
                    quote = None;
                }
            }
            None => {
                if byte == b'"' || byte == b'\'' {
                    quote = Some(byte);
                } else if byte == b'>' {
                    return Some(index);
                }
            }
        }
        index += 1;
    }

    None
}

fn parse_attrs(input: &str) -> Vec<(String, String)> {
    let bytes = input.as_bytes();
    let mut attrs = Vec::new();
    let mut index = 0;

    while index < bytes.len() {
        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }

        let name_start = index;
        while index < bytes.len() {
            let byte = bytes[index];
            if byte.is_ascii_whitespace() || byte == b'=' || byte == b'/' || byte == b'>' {
                break;
            }
            index += 1;
        }

        if name_start == index {
            index += 1;
            continue;
        }

        let name = String::from_utf8_lossy(&bytes[name_start..index]).to_ascii_lowercase();

        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }

        if index < bytes.len() && bytes[index] == b'=' {
            index += 1;
            while index < bytes.len() && bytes[index].is_ascii_whitespace() {
                index += 1;
            }

            if index < bytes.len() && (bytes[index] == b'"' || bytes[index] == b'\'') {
                let quote = bytes[index];
                index += 1;
                let value_start = index;
                while index < bytes.len() && bytes[index] != quote {
                    index += 1;
                }
                let value = String::from_utf8_lossy(&bytes[value_start..index]).to_string();
                attrs.push((name, decode_entities(&value)));
                index = (index + 1).min(bytes.len());
            } else {
                let value_start = index;
                while index < bytes.len()
                    && !bytes[index].is_ascii_whitespace()
                    && bytes[index] != b'>'
                {
                    index += 1;
                }
                let value = String::from_utf8_lossy(&bytes[value_start..index]).to_string();
                attrs.push((name, decode_entities(&value)));
            }
        }
    }

    attrs
}

fn attr(attrs: &[(String, String)], name: &str) -> Option<String> {
    attrs
        .iter()
        .find(|(key, _)| key == name)
        .map(|(_, value)| value.clone())
}

fn clean_text(value: String, max_chars: usize) -> Option<String> {
    let collapsed = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = collapsed.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut result: String = trimmed.chars().take(max_chars).collect();
    if trimmed.chars().count() > max_chars {
        result.push('…');
    }
    Some(result)
}

fn decode_entities(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut rest = input;

    while let Some(index) = rest.find('&') {
        result.push_str(&rest[..index]);
        rest = &rest[index..];

        let semi = rest.bytes().take(16).position(|byte| byte == b';');
        let Some(semi) = semi else {
            result.push('&');
            rest = &rest[1..];
            continue;
        };

        let entity = &rest[1..semi];
        let decoded = match entity {
            "amp" => Some('&'),
            "lt" => Some('<'),
            "gt" => Some('>'),
            "quot" => Some('"'),
            "apos" => Some('\''),
            "nbsp" => Some(' '),
            _ => {
                if let Some(hex) = entity
                    .strip_prefix("#x")
                    .or_else(|| entity.strip_prefix("#X"))
                {
                    u32::from_str_radix(hex, 16).ok().and_then(char::from_u32)
                } else if let Some(decimal) = entity.strip_prefix('#') {
                    decimal.parse::<u32>().ok().and_then(char::from_u32)
                } else {
                    None
                }
            }
        };

        if let Some(character) = decoded {
            result.push(character);
            rest = &rest[semi + 1..];
        } else {
            result.push('&');
            rest = &rest[1..];
        }
    }

    result.push_str(rest);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_open_graph_metadata() {
        let html = r#"<html><head>
            <title>Fallback Title</title>
            <meta property="og:site_name" content="Crates.io">
            <meta property="og:title" content="crates.io: Rust Package Registry">
            <meta property="og:description" content="Rust &amp; crates">
            <meta property="article:published_time" content="2025-01-25T10:00:00Z">
            <link rel="icon" href="/favicon.ico">
        </head></html>"#;

        let meta = extract_metadata(html);
        assert_eq!(meta.site_name.as_deref(), Some("Crates.io"));
        assert_eq!(
            meta.title.as_deref(),
            Some("crates.io: Rust Package Registry")
        );
        assert_eq!(meta.description.as_deref(), Some("Rust & crates"));
        assert_eq!(
            meta.published_at.as_deref(),
            Some("2025-01-25T10:00:00Z")
        );
        assert_eq!(meta.favicon.as_deref(), Some("/favicon.ico"));
    }

    #[test]
    fn falls_back_to_title_and_description() {
        let html = r#"<head><title>  Hello &amp; World </title><meta name="description" content="A description"></head>"#;

        let meta = extract_metadata(html);
        assert_eq!(meta.title.as_deref(), Some("Hello & World"));
        assert_eq!(meta.description.as_deref(), Some("A description"));
    }

    #[test]
    fn blocks_private_hosts() {
        for url in [
            "http://127.0.0.1/",
            "http://localhost/",
            "http://192.168.1.2/",
            "http://10.0.0.1/",
            "http://[::1]/",
        ] {
            assert!(
                is_private_host(&reqwest::Url::parse(url).unwrap()),
                "{url} should be blocked"
            );
        }

        assert!(!is_private_host(
            &reqwest::Url::parse("https://example.com/").unwrap()
        ));
    }
}
