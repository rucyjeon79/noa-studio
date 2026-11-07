"""Exercise the actual record editor and browser clipboard with distinct fields."""
from pathlib import Path
import shutil
import json
import subprocess
from playwright.sync_api import sync_playwright

ORIGIN = 'http://localhost:8189'
fields = dict(title='새벽의 곡', lyrics='가사 첫 줄\n서로 다른 두 번째 줄', youtubeTitle='영상 제목',
              description='영상 설명\n둘째 줄', communityPost='별무리에게 쓰는 편지')
assets = {'/'+p.name: p for p in Path('deploy').glob('noa-*.js')}
assets['/noa-record-form.css'] = Path('deploy/noa-record-form.css')
assets['/noa-ui.css'] = Path('deploy/noa-ui.css')
document = dict(genreId='kpop-original', ep='01', title='새벽의 곡')
def suno_title():
    code = ('define("_GNUBOARD_",true);require "deploy/noa-app/jukebox/core.php";'
            'require "bridge/music-download-core.php";'
            'echo substr(nmd_filename(json_decode(stream_get_contents(STDIN),true)),0,-4);')
    return subprocess.check_output(['php','-r',code],input=json.dumps(document).encode()).decode()


def serve(route):
    path = route.request.url.removeprefix(ORIGIN).split('?', 1)[0]
    if path in assets:
        route.fulfill(path=str(assets[path]))
    elif path == '/noa-inline-edit.php':
        route.fulfill(json=dict(ok=True, writeKey='test', fields=fields, sunoTitle=suno_title(), context={}, packageType='song'))
    elif path == '/':
        route.fulfill(content_type='text/html', body="""<meta charset=utf-8><link rel="stylesheet" href="/noa-ui.css"><main class=noa-page></main>
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
    naming = page.locator('[data-record-field="sunoTitle"]')
    assert naming.evaluate("(e)=>e.nextElementSibling.dataset.recordField==='sunoPrompt'")
    assert naming.locator('input').get_attribute('readonly') is not None
    assert naming.locator('input').get_attribute('name') is None
    naming.get_by_role('button', name='Suno 음악 제목 복사하기').click()
    assert read() == '[KPOP]1_새벽의 곡'
    # Both editor surfaces copy the exact download title, with only the extension removed.
    for genre, ep, title, expected in [
        ('your-story','32','그 이름 하나','[SM]그 이름 하나'),
        ('groovy-airy-pop','040','Afterglow','[GAP]40_Afterglow'),
        ('pop-original','','My Song','[POP]My Song'),
        ('cover-reborn','20','가/나','가_나'),
    ]:
        document.update(genreId=genre,ep=ep,title=title)
        text = suno_title()
        assert text == expected
        page.evaluate("""text=>{
          const main=document.createElement('main');main.id='owner-naming';main.className='noa-page';
          document.querySelector('#owner-naming')?.remove();document.body.append(main);
          NoaRecordForm.render(main,{fields:{sunoPrompt:'음악 제작 지시문'},keys:['sunoPrompt'],sunoTitle:text});
        }""", text)
        page.locator('#owner-naming [data-record-field=sunoTitle] button').click()
        assert read() == expected
    page.locator('#owner-naming').evaluate('(e)=>e.remove()')
    proof=Path('clipboard-proof');proof.mkdir(exist_ok=True)
    for width in [390,1200]:
        page.set_viewport_size(dict(width=width,height=844))
        naming.scroll_into_view_if_needed()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        page.screenshot(path=str(proof/f'suno-title-{width}.png'))
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
    naming.get_by_role('button', name='Suno 음악 제목 복사하기').click()
    assert read() == '[KPOP]1_새벽의 곡'
    print('Locked fields, native selections, edited text and denied clipboard API passed.')
