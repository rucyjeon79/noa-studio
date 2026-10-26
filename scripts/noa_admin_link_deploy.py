"""Existing scoped transport and preimage guards; only the two admin-link assets."""
import noa_ainoa_deploy as release
release.FILES={'noa-app/database/admin-link.js':'deploy/noa-app/database/admin-link.js','extend/noa.database.php':'deploy/noa-database.extend.php'}
release.NEW=set()
if __name__=='__main__':release.main()
