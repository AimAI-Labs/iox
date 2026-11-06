"""Exercise the production DOM click script against real browser DOM fixtures."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
script = (root / 'src-tauri/src/ai/vendors/new_chat.js').read_text(encoding='utf-8')
icon = '<svg width="16" height="16"><path d="M8 0.599609C3.91309 0.599609 0.599609 3.91309 0.599609 8ZM7.34473 4.93945V7.34961H4.93945V8.65039H7.34473Z"/></svg>'
fixture_style = '<style>button,a,[role=button],[tabindex],.target{display:inline-flex;align-items:center;min-width:44px;min-height:38px;cursor:pointer}svg{width:16px;height:16px}</style>'
cases = [
    ('deepseek-expanded', 'chat.deepseek.com', f'<div id="target" class="_5a8ac7a a084f19e" tabindex="0"><div class="ds-icon">{icon}</div><span>开启新对话</span><div class="ds-focus-ring"></div></div>'),
    ('deepseek-collapsed', 'chat.deepseek.com', f'<div class="ds-icon-button"><div class="ds-button__background"></div><div id="target" class="ds-icon-button" role="button" tabindex="0"><div class="ds-button__background"></div>{icon}</div></div>'),
    ('deepseek-english', 'chat.deepseek.com', '<div id="target" tabindex="0">New chat</div>'),
    ('qwen-expanded', 'www.qianwen.com', '<div id="target" data-session-switch-target="new-chat"><span>新对话</span><span>Ctrl K</span></div>'),
    ('qwen-collapsed', 'www.qianwen.com', '<div id="target" data-session-switch-target="new-chat"><svg width="16" height="16"/></div>'),
    ('doubao', 'www.doubao.com', '<div data-testid="create_conversation_button"><div id="target" role="button" tabindex="0"><span>新对话</span><span>Ctrl Shift K</span></div></div>'),
    ('kimi', 'www.kimi.com', '<a id="target" aria-label="新建会话" href="/?chat_enter_method=new_chat"><svg/></a>'),
    ('kimi-english', 'www.kimi.com', '<a id="target" aria-label="New chat" href="/?chat_enter_method=new_chat"><svg/></a>'),
    ('chatgpt', 'chatgpt.com', '<button id="target" data-testid="create-new-chat-button"><svg/></button>'),
    ('chatgpt-collapsed', 'chatgpt.com', '<a id="target" aria-label="New chat (Ctrl+Shift+O)" href="/"><svg/></a>'),
    ('claude', 'claude.ai', '<a id="target" href="/new"><svg/></a>'),
    ('mimo', 'aistudio.xiaomimimo.com', '<button aria-label="新对话" data-track-id="sidebar_ultra_new_chat_btn">其他模式</button><button id="target" aria-label="新对话" data-track-id="navbar_new_chat_btn"><svg/></button>'),
    ('yuanbao', 'yuanbao.tencent.com', '<div id="target" class="yb-new-chat-entry__item" aria-label="新建对话" role="button" tabindex="0"><svg/></div>'),
    ('baichuan', 'yi.baichuan-ai.com', '<a id="target" aria-label="新建对话" href="/"><svg/></a>'),
    ('custom-aria', 'custom.example', '<button id="target" aria-label="Start a new conversation"><svg/></button>'),
    ('custom-text', 'custom.example', '<aside><div id="target" class="target"><span>新建会话</span></div></aside>'),
    ('custom-title', 'custom.example', '<button id="target" title="New conversation"><svg/></button>'),
    ('hidden-disabled', 'custom.example', '<button style="display:none">New chat</button><button disabled>New chat</button><button aria-disabled="true">New chat</button><button id="target">New chat</button>'),
]

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': 1000, 'height': 700})
    page.route('https://**/*', lambda route: route.fulfill(status=200, content_type='text/html', body='<!doctype html><body></body>'))

    def setup(host, html):
        page.goto(f'https://{host}/conversation/current', wait_until='networkidle')
        page.set_content(fixture_style + html)
        page.evaluate('''() => {
            window.clicked=[];
            for(const node of document.querySelectorAll('button,a,[role=button],[tabindex],.target,#target')) {
                node.addEventListener('click', event => {
                    if(event.currentTarget === event.target.closest('button,a,[role=button],[tabindex],.target,#target')) {
                        window.clicked.push(node.id || 'wrong');
                    }
                    event.preventDefault();
                });
            }
        }''')

    def run(origin=None):
        options = {'origin': origin or page.evaluate('location.origin')}
        return page.evaluate('() => {' + script + ';return clickNewChat(' + json.dumps(options) + ')}')

    for name, host, html in cases:
        setup(host, html)
        before = page.url
        result = run()
        assert result.get('ok') is True, (name, result)
        assert page.evaluate('window.clicked') == ['target'], (name, page.evaluate('window.clicked'))
        assert page.url == before, (name, 'script changed location instead of clicking')
        print(name + ': passed')

    failures = []
    negative_cases = [
        ('bare-background', '<div class="ds-button__background"></div><button>Settings</button>'),
        ('message-copy', '<article><button>New chat</button></article>'),
        ('history-title', '<aside><a href="/c/old-conversation">New chat</a></aside>'),
        ('hash-history-title', '<aside><a href="/#/c/old-conversation">New chat</a></aside>'),
        ('query-history-title', '<aside><a href="/?conversation_id=old-conversation">New chat</a></aside>'),
        ('no-entry', '<button>Create account</button><button>Send</button>'),
        ('disabled-parent', '<div aria-disabled="true"><button>New chat</button></div>'),
        ('hidden-parent', '<div style="opacity:0"><button>New chat</button></div>'),
        ('covered-button', '<button>New chat</button><div style="position:fixed;inset:0;background:white"></div>'),
        ('editable-draft', '<div contenteditable="true" role="textbox" tabindex="0">New chat</div>'),
        ('deepseek-answer-link', '<div class="ds-message"><a href="/">New chat</a></div>'),
    ]
    for name, html in negative_cases:
        setup('chat.deepseek.com', html)
        result = run()
        clicked = page.evaluate('window.clicked')
        if result.get('ok') is not False or clicked or not page.url.endswith('/conversation/current'):
            failures.append((name, result, clicked))
        else:
            print(name + ': passed')

    setup('unrelated.example', '<button>New chat</button>')
    assert run('https://chat.deepseek.com').get('ok') is False
    assert page.evaluate('window.clicked') == []
    print('origin-change: passed')
    browser.close()
assert not failures, failures
print(f'{len(cases) + len(negative_cases) + 1} DOM new chat cases passed')
