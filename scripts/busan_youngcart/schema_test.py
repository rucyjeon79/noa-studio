import pathlib,re
p=pathlib.Path('deploy/busan/youngcart/schema/youngcart-v5.6.4-create-only.sql')
sql=p.read_text()
body='\n'.join(l for l in sql.splitlines() if not l.startswith('--'))
stmts=[s.strip() for s in body.split(';') if s.strip()]
expected={'banner','cart','category','coupon','coupon_log','coupon_zone','default','event','event_item','item','item_option','item_use','item_qa','item_relation','order','order_address','order_data','order_delete','personalpay','sendcost','wish','item_stocksms','order_post_log','inicis_log'}
seen=set()
for s in stmts:
    m=re.fullmatch(r'CREATE TABLE IF NOT EXISTS `g5_shop_([a-z_]+)` \([\s\S]+\) ENGINE=InnoDB DEFAULT CHARSET=utf8',s)
    assert m,s[:120]
    assert m[1] not in seen
    seen.add(m[1])
assert seen==expected
print('BUSAN_YOUNGCART_EMPTY_SCHEMA_OK tables='+str(len(seen))+' destructive_statements=0 product_rows=0')
