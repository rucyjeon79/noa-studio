"""Compatibility boundary for the retired consumer Gemini CLI provider.

Google ended personal/AI Pro/AI Ultra Gemini CLI access on 2026-06-18.
Keep the existing commander contract, but never mistake a cached token or a
successful CI job for a connected specialist. A supported replacement requires
its own authenticated real-response verification before being registered.
"""
import json

SPECIALIST = 'gemini_text'
STATE = 'gemini_consumer_cli_retired'

def login_present():
    return False

def complete(prompt, timeout=100):
    raise RuntimeError(STATE)

def verify(model=None):
    return {'connected': False, 'state': STATE, 'capabilities': []}

def review(task, instruction):
    return {'ok': False, 'error': STATE}

if __name__ == '__main__':
    print('N80_GEMINI_STATUS', json.dumps(verify()))
