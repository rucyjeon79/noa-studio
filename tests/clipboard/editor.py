"""Exercise the actual record editor and browser clipboard with distinct fields."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ORIGIN = 'http://localhost:8189'
fields = dict(title='새벽의 곡', lyrics='가사 첫 줄\n서로 다른 두 번째 줄', youtubeTitle='영상 제목',
              description='영상 설명\n둘째 줄', communityPost='별무리에게 쓰는 편지')
assets = {'/'+p.name: p for p in Path('deploy').glob('noa-*.js')}
assets['/noa-record-form.css'] = Path('deploy/noa-record-form.css')

def serve(route):
    path = route.request.url.removeprefix(ORIGIN).split('?', 1)[0]
    if path in assets:
        route.fulfill(path=str(assets[path]))
    elif path == '/noa-inline-edit.php':
        route.fulfill(json=dict(ok=True, writeKey='test', fields=fields, context={}, packageType='song'))
    elif path == '/':
        route.fulfill(content_type='text/html', body="""<meta charset=utf-8><main class=noa-page></main>
          <script src="/noa-browse.js"></script><script src="/noa-record-form.js"></script>
          <script src="/noa-browse-edit.js"></script>""")
    else:
        route.fulfill(json={'ok': True, 'workerConfigured': True})

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'))
    page = browser.new_page(viewport=dict(width=390, height=844))
    page.context.grant_permissions(['clipboard-read', 'clipboard-write'], origin=ORIGIN)
    page.route('**/*', serve)
    page.goto(ORIGIN)
    page.evaluate("""() => NoaBrowseEdit.mount({host:document.querySelector('main'),standalone:true})
                       .openRecord({type:'song',source:'music',key:'test'})""")
    read = lambda: page.evaluate('navigator.clipboard.readText()')
    for key, expected in fields.items():
        row = page.locator(f'[data-record-field="{key}"]')
        row.locator('.noa-edit-copy').click()
        assert read() == expected, key
    row = page.locator('[data-record-field="description"]')
    preview = row.locator('.noa-locked-preview')
    preview.dblclick(position={'x': 18, 'y': 19})
    selected = page.evaluate('getSelection().toString()')
    assert selected.strip() and selected in fields['description'], selected
    page.keyboard.press('Control+c')
    assert read() == selected
    row.locator('.noa-edit-edit').click()
    edit = row.locator('textarea[name="description"]')
    edit.fill('바꾼 설명의 일부')
    edit.evaluate('(e)=>e.setSelectionRange(3,5)')
    page.keyboard.press('Control+c')
    assert read() == '설명'
    page.evaluate("""Object.defineProperty(navigator.clipboard,'writeText',{
        value:()=>Promise.reject(new Error('WebView denied'))})""")
    row.locator('.noa-edit-copy').click()
    assert read() == '바꾼 설명의 일부'
    print('Locked fields, native selections, edited text and denied clipboard API passed.')
