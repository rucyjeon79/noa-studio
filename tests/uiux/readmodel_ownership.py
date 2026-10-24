"""Permit only the authorized YouTube reader; keep every owner writer byte-identical."""
import json
import re
import subprocess

TOKENIZE = r'''
$t=token_get_all(stream_get_contents(STDIN));$out=[];$n=count($t);
for($i=0;$i<$n;$i++){
 if(!is_array($t[$i])||$t[$i][0]!==T_FUNCTION)continue;
 $name=null;$text='';$depth=0;$body=false;
 for(;$i<$n;$i++){$v=$t[$i];$text.=is_array($v)?$v[1]:$v;
  if(!$name&&is_array($v)&&$v[0]===T_STRING)$name=$v[1];
  if($v==='{'){$depth++;$body=true;}
  if(is_array($v)&&in_array($v[0],[T_CURLY_OPEN,T_DOLLAR_OPEN_CURLY_BRACES],true))$depth++;
  if($v==='}'&&--$depth===0&&$body){if($name)$out[$name]=$text;break;}
 }
}echo json_encode($out,JSON_THROW_ON_ERROR);
'''

def verify_youtube_reader_only(root, baseline):
    old=subprocess.check_output(['git','show',baseline+':bridge/youtube-store.php'],cwd=root,text=True)
    new=(root/'bridge/youtube-store.php').read_text()
    functions=lambda source:json.loads(subprocess.check_output(['php','-r',TOKENIZE],input=source,text=True))
    before,after=functions(old),functions(new)
    allowed={'ny_videos','ny_verified_official_members','ny_official_members'}
    for name,value in before.items():
        if name not in allowed and after.get(name)!=value:
            raise AssertionError('Owner writer changed: '+name)
    if set(after)-set(before)-allowed:raise AssertionError('Unexpected bridge function added')
    for name in allowed&set(after):
        if re.search(r'\b(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|TRUNCATE|CALL)\b',after[name],re.I):
            raise AssertionError('Read-model exception contains a mutation: '+name)
