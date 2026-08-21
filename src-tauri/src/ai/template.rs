/// 净化针对空文本的 URL 模板，剥离与占位符关联的无用查询参数
pub fn sanitize_empty_url_template(template: &str) -> String {
    let mut url = template.to_string();
    for placeholder in ["{text}", "{query}", "{raw_text}"] {
        while let Some(pos) = url.find(placeholder) {
            let before = &url[..pos];
            if let Some(sep_pos) = before.rfind(|c| c == '?' || c == '&') {
                let sep = url.as_bytes()[sep_pos] as char;
                let after = &url[pos + placeholder.len()..];
                if after.starts_with('&') {
                    if sep == '?' {
                        url = format!("{}{}", &url[..sep_pos + 1], &after[1..]);
                    } else {
                        url = format!("{}{}", &url[..sep_pos], after);
                    }
                } else {
                    url = format!("{}{}", &url[..sep_pos], after);
                }
            } else {
                url = url.replace(placeholder, "");
                break;
            }
        }
    }
    let trimmed = url.trim_end_matches(['?', '&']).to_string();
    if trimmed.is_empty() {
        template
            .replace("{text}", "")
            .replace("{query}", "")
            .replace("{raw_text}", "")
    } else {
        trimmed
    }
}

/// 渲染 URL 模板，将 `{text}` / `{query}` 替换为 URL 编码后的字符串，将 `{raw_text}` 替换为原始内容
pub fn render_url_template(template: &str, text: &str) -> String {
    if text.trim().is_empty() {
        return sanitize_empty_url_template(template);
    }
    let encoded_text = urlencoding::encode(text);
    template
        .replace("{text}", &encoded_text)
        .replace("{query}", &encoded_text)
        .replace("{raw_text}", text)
}

/// 渲染提示词模板，将 `{text}` 替换为实际选中的文本
pub fn render_prompt_template(template: &str, text: &str) -> String {
    template.replace("{text}", text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_url_template() {
        let tmpl = "https://tongyi.aliyun.com/qianwen/?q={text}";
        let text = "你好 世界";
        let rendered = render_url_template(tmpl, text);
        assert_eq!(
            rendered,
            "https://tongyi.aliyun.com/qianwen/?q=%E4%BD%A0%E5%A5%BD%20%E4%B8%96%E7%95%8C"
        );
    }

    #[test]
    fn test_render_url_template_empty_text_sanitization() {
        // 1. 唯一查询参数净化
        assert_eq!(
            render_url_template("https://tongyi.aliyun.com/qianwen/?q={text}", ""),
            "https://tongyi.aliyun.com/qianwen/"
        );
        // 2. 复合查询参数首位净化
        assert_eq!(
            render_url_template("https://example.com/search?q={text}&lang=zh", ""),
            "https://example.com/search?lang=zh"
        );
        // 3. 复合查询参数末尾净化
        assert_eq!(
            render_url_template("https://example.com/search?lang=zh&q={text}", ""),
            "https://example.com/search?lang=zh"
        );
        // 4. 非查询参数直接替换
        assert_eq!(
            render_url_template("https://example.com/ai/{text}", "  "),
            "https://example.com/ai/"
        );
    }

    #[test]
    fn test_render_prompt_template() {
        let tmpl = "翻译：{text}";
        let text = "Hello";
        assert_eq!(render_prompt_template(tmpl, text), "翻译：Hello");
    }
}
