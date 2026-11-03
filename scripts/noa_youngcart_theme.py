"""Fill only missing shop dependencies from the installed native basic theme."""
import stat
import paramiko
from noa_full_inventory import connect,ROOT
def main():
 t=connect();added=[]
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   def ensure(p):
    try:s.stat(ROOT+'/'+p)
    except FileNotFoundError:
     ensure(p.rsplit('/',1)[0]);s.mkdir(ROOT+'/'+p,0o755)
   def cp(a,b):
    st=s.stat(ROOT+'/'+a)
    if stat.S_ISDIR(st.st_mode):
     ensure(b)
     for n in s.listdir(ROOT+'/'+a):cp(a+'/'+n,b+'/'+n)
    elif stat.S_ISREG(st.st_mode):
     try:s.stat(ROOT+'/'+b);return
     except FileNotFoundError:pass
     ensure(b.rsplit('/',1)[0])
     with s.open(ROOT+'/'+a,'rb') as f:data=f.read()
     with s.open(ROOT+'/'+b,'wx') as f:f.write(data)
     added.append(b)
   for p in ['head.sub.php','tail.sub.php','css','js','img','mobile/head.sub.php','mobile/tail.sub.php','mobile/css','mobile/js','mobile/img','skin/outlogin/shop_side','skin/outlogin/shop_basic','skin/latest/notice','skin/visit/shop_basic','mobile/skin/outlogin/shop_basic','mobile/skin/latest/notice','mobile/skin/visit/shop_basic']:
    try:s.stat(ROOT+'/theme/basic/'+p)
    except FileNotFoundError:continue
    cp('theme/basic/'+p,'theme/noa_studio/'+p)
   print('YOUNGCART_MISSING_THEME_DEPENDENCIES_ADDED',len(added))
 finally:t.close()
if __name__=='__main__':main()
