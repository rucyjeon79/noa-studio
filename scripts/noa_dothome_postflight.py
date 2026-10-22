"""Read-only HTTP postflight checks for a DotHome release.

Never sends credentials or writes application state.
"""
import urllib.request, urllib.error
from urllib.parse import urlparse
import ipaddress

def verify_public_routes(origin,paths,opener=None):
    parsed=urlparse(origin)
    if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ('','/') or parsed.query or parsed.fragment or parsed.port not in (None,443):
        raise ValueError('invalid_origin')
    if not isinstance(paths,list) or not paths or len(paths)!=len(set(paths)):
        raise ValueError('invalid_routes')
    try:
        ipaddress.ip_address(parsed.hostname)
    except ValueError:
        pass
    else:
        raise ValueError('ip_literal_origin_forbidden')
    fetch=opener or urllib.request.urlopen
    results=[]
    for path in paths:
        if not isinstance(path,str) or not path.startswith('/') or path.startswith('//') or '?' in path or '#' in path or '..' in path:
            raise ValueError('unsafe_route')
        url=origin.rstrip('/')+path
        req=urllib.request.Request(url,method='GET',headers={'User-Agent':'NOA-Deploy-Postflight/1'})
        try:
            with fetch(req,timeout=15) as response:
                code=response.status
                final=response.geturl()
        except urllib.error.HTTPError as error:
            code=error.code
            final=url
        if urlparse(final).scheme!='https' or urlparse(final).hostname!=parsed.hostname:
            raise RuntimeError('cross_host_redirect')
        results.append({'path':path,'status':code,'ok':200<=code<400})
    return {'origin':origin,'routes':results,'ok':all(x['ok'] for x in results)}
