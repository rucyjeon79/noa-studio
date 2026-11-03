"""Build pinned offline calendar sources; no runtime CDN or birth data requests."""
from pathlib import Path
import subprocess, tempfile, re, json, sys
ROOT=Path(__file__).resolve().parents[1]
PINS={'lunar-php':('6tail/lunar-php','394d9f5afc78d3364456a6bb1369dbbb6f3ba88a'),'korean-calendar':('usingsky/korean_lunar_calendar_py','128a9b482dd34ea6185298d335de2c8d3f378d4c')}
def build():
    with tempfile.TemporaryDirectory() as temp:
        sources={}
        for name,(repo,sha) in PINS.items():
            p=Path(temp)/name;p.mkdir()
            subprocess.run(['git','init','-q',str(p)],check=True)
            subprocess.run(['git','-C',str(p),'fetch','-q','--depth','1','https://github.com/'+repo+'.git',sha],check=True)
            subprocess.run(['git','-C',str(p),'checkout','-q','FETCH_HEAD'],check=True)
            assert subprocess.check_output(['git','-C',str(p),'rev-parse','HEAD'],text=True).strip()==sha
            sources[name]=p
        lunar=sources['lunar-php'];parts=['<?php\n// Pinned 6tail/lunar-php. Full MIT notice follows.\n/*\n'+(lunar/'LICENSE').read_text()+'\n*/\n']
        for path in sorted((lunar/'src').rglob('*.php')):
            code=path.read_text().removeprefix('<?php').strip().removesuffix('?>').strip()
            code=re.sub(r'namespace ([^;]+);',r'namespace \1 {',code,count=1)
            parts.append(code+'\n}\n')
        out=ROOT/'deploy/noa-app/engine';out.mkdir(exist_ok=True,parents=True)
        (out/'personal-calendar-vendor.php').write_text(''.join(parts))
        sys.path.insert(0,str(sources['korean-calendar']))
        from korean_lunar_calendar import KoreanLunarCalendar
        c=KoreanLunarCalendar();months={}
        for y in range(1900,2051):
            for m in range(1,13):
                for leap in (False,True):
                    if c.setLunarDate(y,m,1,leap) and c.isIntercalation==leap:
                        length=30 if c.setLunarDate(y,m,30,leap) else 29
                        c.setLunarDate(y,m,1,leap)
                        months[f'{y}-{m:02d}-{int(leap)}']=[c.SolarIsoFormat(),length]
        (out/'personal-korean-months.json').write_text(json.dumps(months,separators=(',',':')))
        (out/'personal-calendar-LICENSE.txt').write_text('6tail/lunar-php '+PINS['lunar-php'][1]+'\n'+(lunar/'LICENSE').read_text()+'\nKorean lunar calendar '+PINS['korean-calendar'][1]+'\n'+(sources['korean-calendar']/'LICENSE').read_text())
if __name__=='__main__':build()
