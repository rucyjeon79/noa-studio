"""Load explicitly selected DotHome host profiles from a local non-secret registry.

Never accepts passwords, tokens, or implicit host selection.
"""
import json, pathlib
from noa_deploy_hosts import HostProfile, resolve_host

_ALLOWED={'host_id','remote_root','private_root','environment'}
_FORBIDDEN={'password','secret','token','private_key','ssh_password','database_password'}

def load_host_registry(path):
    source=pathlib.Path(path)
    if source.is_symlink() or not source.is_file() or source.stat().st_size>65536:
        raise ValueError('invalid_host_registry')
    data=json.loads(source.read_text(encoding='utf-8'))
    if not isinstance(data,dict) or set(data)!={'schema','hosts'} or data['schema']!=1 or not isinstance(data['hosts'],list):
        raise ValueError('invalid_host_registry')
    profiles={}
    for entry in data['hosts']:
        if not isinstance(entry,dict) or set(entry)-_ALLOWED or set(entry)&_FORBIDDEN:
            raise ValueError('unsafe_host_configuration')
        host=HostProfile(**entry)
        if host.host_id in profiles:
            raise ValueError('duplicate_host_id')
        profiles[host.host_id]=host
    if not profiles:raise ValueError('empty_host_registry')
    return profiles

def selected_host(path,host_id):
    return resolve_host(load_host_registry(path),host_id)
