(async()=>{
 const css=getComputedStyle(document.documentElement);
 const urls=['coast','music','journey'].flatMap(role=>[...css.getPropertyValue('--noa-image-'+role).matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>new URL(m[1],location.href).href));
 await Promise.all([...new Set(urls)].map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.decode().then(resolve,reject);img.onerror=()=>reject(new Error('Theme image failed: '+src));img.src=src;})));
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 return true;
})()
