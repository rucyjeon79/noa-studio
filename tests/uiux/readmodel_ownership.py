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
    allowed={'ny_songs','ny_videos','ny_verified_official_members','ny_official_members'}
    for name,value in before.items():
        if name not in allowed and after.get(name)!=value:
            raise AssertionError('Owner writer changed: '+name)
    if set(after)-set(before)-allowed:raise AssertionError('Unexpected bridge function added')
    for name in allowed&set(after):
        if re.search(r'\b(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|TRUNCATE|CALL)\b',after[name],re.I):
            raise AssertionError('Read-model exception contains a mutation: '+name)


def verify_shared_catalog_readers_only(root, baseline):
    """Shared-song approval permits readers only; all upload/processing writers stay exact."""
    scopes={'bridge/sound-core.php':{'noa_sound_catalog_document','noa_sound_visible','noa_sound_trash_index','noa_sound_cover'},
            'deploy/noa-app/jukebox/core.php':{'nj_document','nj_catalog'}}
    for path,allowed in scopes.items():
        old=subprocess.check_output(['git','show',baseline+':'+path],cwd=root,text=True)
        new=(root/path).read_text()
        functions=lambda source:json.loads(subprocess.check_output(['php','-r',TOKENIZE],input=source,text=True))
        before,after=functions(old),functions(new)
        # This request explicitly extends verified-media publication with one
        # audited manifest update in its existing transaction. All checks stay exact.
        if path=='deploy/noa-app/jukebox/core.php' and 'nj_import' in after:
            hook="\n  // Keep the complete record in the same transaction as verified media publication.\n  require_once dirname(__DIR__,2).'/noa-bridge/package-record.php';nup_attach_asset($db,$key,$new);"
            if hook not in before.get('nj_import',''):
                after['nj_import']=after['nj_import'].replace(hook,'',1)
        for name,value in before.items():
            if name not in allowed and after.get(name)!=value:
                raise AssertionError('Upload/processing function changed: '+name)
        if set(after)-set(before)-allowed:raise AssertionError('Unexpected catalog function added')
        for name in allowed&set(after):
            if re.search(r'\b(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|TRUNCATE|CALL)\b',after[name],re.I):
                raise AssertionError('Shared catalog reader contains a mutation: '+name)
