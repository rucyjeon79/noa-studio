# N80 ENGINE — canonical identity and transition

The official name is **N80 ENGINE**, controlled by Chat Assistant within NOA STUDIO 2.0.

The existing NOA ENGINE PHP libraries, deployed paths, Git history, media, member data, queues, and service contracts are preserved. No mass rename or removal is authorized.

## Integration rule
Use `n80_engine_identity()` for branding and canonical engine identity. Existing `noa_engine_*` functions remain supported compatibility interfaces until verified replacements exist.

## Completion gate
N80 ENGINE is **not operationally complete** until authenticated producers, durable storage, leased consumer acknowledgments, actual module adapters, bounded execution, monitoring, rollback, and production end-to-end recovery tests all pass.

Existing `dispatch-gate.php` remains fail-closed. Do not activate workers simply to claim completion.
