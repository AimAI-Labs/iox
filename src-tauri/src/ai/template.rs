/// 渲染 URL 模板，将 `{text}` / `{query}` 替换为 URL 编码后的字符串，将 `{raw_text}` 替换为原始内容
pub fn render_url_template(template: &str, text: &str) -> String {
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
    fn test_render_prompt_template() {
        let tmpl = "翻译：{text}";
        let text = "Hello";
        assert_eq!(render_prompt_template(tmpl, text), "翻译：Hello");
    }
}
