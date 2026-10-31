"""Inspect the public storefront; no account, cart or order operations."""
import urllib.request,json
from pathlib import Path
from bs4 import BeautifulSoup
out=Path('marpple-proof');out.mkdir(exist_ok=True)
url='https://marpple.shop/kr/jr_lifestyle/products?cate_root_id=1'
with urllib.request.urlopen(url,timeout=30) as r: html=r.read()
(out/'listing.html').write_bytes(html)
soup=BeautifulSoup(html,'html.parser')
cards=soup.select('[data-rune="CardProductView"]')
print(json.dumps({'bytes':len(html),'cards':len(cards),'title':soup.title.get_text() if soup.title else ''},ensure_ascii=False))
if cards:print(str(cards[0])[:6000])
else:print(str(soup.select('a[href*="/products/"]')[:4])[:6000])
