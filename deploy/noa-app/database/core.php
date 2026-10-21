<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }

/** A deliberately small SELECT grammar: it never forwards unparsed SQL. */
final class NoaSelect {
    private array $tokens = []; private int $i = 0; private array $params = [];
    public function __construct(string $sql) {
        if (strlen($sql)>12000) throw new InvalidArgumentException('SQL은 12KB 이하로 입력하세요.');
        $offset=0;
        while ($offset<strlen($sql)) {
            if (preg_match('/\G\s+/A',$sql,$m,0,$offset)) { $offset+=strlen($m[0]); continue; }
            if (!preg_match('/\G(?:`[A-Za-z_][A-Za-z0-9_]*`|\x27(?:[^\x27\\\\]|\x27\x27)*\x27|[A-Za-z_][A-Za-z0-9_]*|[0-9]+(?:\.[0-9]+)?|<>|!=|<=|>=|[(),*=<>-])/A',$sql,$m,0,$offset)) throw new InvalidArgumentException('주석·다중 명령·스키마 지정·지원하지 않는 SQL 문법입니다.');
            $this->tokens[]=$m[0]; $offset+=strlen($m[0]);
            if(count($this->tokens)>2000) throw new InvalidArgumentException('SQL이 너무 복잡합니다.');
        }
    }
    private function peek(): string { return strtoupper($this->tokens[$this->i]??''); }
    private function accept(string $v): bool { if($this->peek()===$v){$this->i++;return true;}return false; }
    private function expect(string $v): void { if(!$this->accept($v))throw new InvalidArgumentException($v.' 구문을 확인하세요.'); }
    private function identifier(): string {
        $t=$this->tokens[$this->i++]??'';
        if(!preg_match('/^(?:`[A-Za-z_][A-Za-z0-9_]*`|[A-Za-z_][A-Za-z0-9_]*)$/D',$t))throw new InvalidArgumentException('컬럼 또는 테이블 이름이 필요합니다.');
        return trim($t,'`');
    }
    private function col(array $columns): string { $c=$this->identifier();if(!in_array($c,$columns,true))throw new InvalidArgumentException('해당 테이블에 없는 컬럼입니다.');return '`'.$c.'`'; }
    private function value(): string {
        $negative=$this->accept('-'); $t=$this->tokens[$this->i++]??'';
        if(preg_match('/^[0-9]+(?:\.[0-9]+)?$/D',$t))$v=($negative?'-':'').$t;
        elseif(!$negative&&str_starts_with($t,"'"))$v=str_replace("''","'",substr($t,1,-1));
        elseif(!$negative&&strtoupper($t)==='NULL')$v=null;
        else throw new InvalidArgumentException('조건 값은 숫자, 작은따옴표 문자열 또는 NULL만 허용합니다.');
        $this->params[]=$v;return '?';
    }
    private function condition(array $cols,int $depth=0): string {
        if($depth>8)throw new InvalidArgumentException('조건 괄호가 너무 깊습니다.');
        $parts=[];
        do {
            if($this->accept('(')){$part='('.$this->condition($cols,$depth+1).')';$this->expect(')');}
            else {
                $part=$this->col($cols);
                if($this->accept('IS')){$part.=' IS '.($this->accept('NOT')?'NOT ':'');$this->expect('NULL');$part.='NULL';}
                else {
                    $op=$this->peek();if(!in_array($op,['=','<>','!=','<','>','<=','>=','LIKE'],true))throw new InvalidArgumentException('허용되지 않은 비교 연산입니다.');
                    $this->i++;$part.=' '.$op.' '.$this->value();
                }
            }
            $parts[]=$part;
            if(!in_array($this->peek(),['AND','OR'],true))break;
            $parts[]=$this->peek();$this->i++;
        }while(true);
        return implode(' ',$parts);
    }
    public function compile(array $tables, callable $getColumns): array {
        $this->expect('SELECT');$distinct=$this->accept('DISTINCT');
        // Resolve FROM before compiling identifiers; quoted strings cannot supply FROM.
        $from=null;
        foreach($this->tokens as $n=>$t)if(strtoupper($t)==='FROM'){$from=$n;break;}
        if($from===null)throw new InvalidArgumentException('SELECT ... FROM 테이블 형식으로 입력하세요.');
        $saved=$this->i;$this->i=$from+1;$table=$this->identifier();$this->i=$saved;
        if(!in_array($table,$tables,true))throw new InvalidArgumentException('현재 DB의 기본 테이블만 조회할 수 있습니다.');
        $cols=$getColumns($table);$fields=[];
        do {
            if($this->accept('*'))$field='*';
            elseif(in_array($this->peek(),['COUNT','SUM','AVG','MIN','MAX'],true)){
                $fn=$this->peek();$this->i++;$this->expect('(');$d=$this->accept('DISTINCT');
                if($fn==='COUNT'&&!$d&&$this->accept('*'))$arg='*';else $arg=$this->col($cols);
                $this->expect(')');$field=$fn.'('.($d?'DISTINCT ':'').$arg.')';
            }else $field=$this->col($cols);
            if($this->accept('AS'))$field.=' AS `'.$this->identifier().'`';
            $fields[]=$field;
        }while($this->accept(','));
        $this->expect('FROM');if($this->identifier()!==$table)throw new InvalidArgumentException('테이블 구문 오류입니다.');
        $sql='SELECT '.($distinct?'DISTINCT ':'').implode(',',$fields).' FROM `'.$table.'`';
        if($this->accept('WHERE'))$sql.=' WHERE '.$this->condition($cols);
        foreach(['GROUP','ORDER'] as $clause)if($this->accept($clause)){
            $this->expect('BY');$items=[];
            do{$v=$this->col($cols);if($clause==='ORDER'){if($this->accept('DESC'))$v.=' DESC';elseif($this->accept('ASC'))$v.=' ASC';}$items[]=$v;}while($this->accept(','));
            $sql.=' '.$clause.' BY '.implode(',',$items);
        }
        $limit=200;$offset=0;
        if($this->accept('LIMIT')){
            $v=$this->tokens[$this->i++]??'';if(!preg_match('/^[0-9]{1,7}$/D',$v))throw new InvalidArgumentException('LIMIT은 양의 정수입니다.');$limit=min(1000,(int)$v);
            if($this->accept('OFFSET')){$v=$this->tokens[$this->i++]??'';if(!preg_match('/^[0-9]{1,7}$/D',$v))throw new InvalidArgumentException('OFFSET 오류입니다.');$offset=min(100000,(int)$v);}
        }
        if($this->i!==count($this->tokens)||$limit<1)throw new InvalidArgumentException('단일 테이블 SELECT 조회만 지원합니다.');
        return ['sql'=>$sql.' LIMIT '.$limit.' OFFSET '.$offset,'params'=>$this->params,'limit'=>$limit,'table'=>$table];
    }
}
function nd_db(): PDO {
    foreach(['G5_MYSQL_HOST','G5_MYSQL_DB','G5_MYSQL_USER','G5_MYSQL_PASSWORD'] as $k)if(!defined($k))throw new RuntimeException('db_config_missing');
    $db=new PDO('mysql:host='.G5_MYSQL_HOST.';dbname='.G5_MYSQL_DB.';charset=utf8mb4',G5_MYSQL_USER,G5_MYSQL_PASSWORD,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false,PDO::MYSQL_ATTR_MULTI_STATEMENTS=>false,PDO::MYSQL_ATTR_USE_BUFFERED_QUERY=>false]);
    $db->exec("SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_BACKSLASH_ESCAPES'");$db->exec("SET SESSION time_zone='+00:00'");
    $db->exec('SET SESSION max_execution_time=3000');$db->exec('SET SESSION lock_wait_timeout=3');
    $db->exec('SET SESSION innodb_lock_wait_timeout=3');
    $db->exec('SET SESSION TRANSACTION READ ONLY');return $db;
}
function nd_rows(PDO $db,string $sql,array $params=[]): array { $q=$db->prepare($sql);$q->execute($params);$r=$q->fetchAll(PDO::FETCH_ASSOC);$q->closeCursor();return $r; }
function nd_tables(PDO $db): array { return nd_rows($db,"SELECT TABLE_NAME,ENGINE,TABLE_ROWS,DATA_LENGTH,INDEX_LENGTH FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"); }
function nd_names(PDO $db): array { return array_column(nd_tables($db),'TABLE_NAME'); }
function nd_columns(PDO $db,string $table): array {
    if(!in_array($table,nd_names($db),true))throw new InvalidArgumentException('테이블을 찾을 수 없습니다.');
    return nd_rows($db,'SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,COLUMN_KEY,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION',[$table]);
}
function nd_query(PDO $db,string $sql): array {
    $plan=(new NoaSelect($sql))->compile(nd_names($db),fn($t)=>array_column(nd_columns($db,$t),'COLUMN_NAME'));
    $db->exec('START TRANSACTION READ ONLY');
    try {
        $q=$db->prepare($plan['sql']);$q->execute($plan['params']);$cols=[];for($i=0;$i<$q->columnCount();$i++)$cols[]=$q->getColumnMeta($i)['name'];
        $rows=[];$bytes=0;$clipped=false;
        while($r=$q->fetch(PDO::FETCH_NUM)){
            $cost=strlen(json_encode($r,JSON_INVALID_UTF8_SUBSTITUTE));
            if($cost>2097152||$bytes+$cost>4194304){$clipped=true;break;}$bytes+=$cost;$rows[]=$r;
        }
        $q->closeCursor();return ['columns'=>$cols,'rows'=>$rows,'rowCount'=>count($rows),'limit'=>$plan['limit'],'byteLimitReached'=>$clipped];
    }finally{$db->rollBack();}
}
function nd_private(): string {
    $root=realpath(G5_PATH);if(!$root)throw new RuntimeException('web_root_missing');
    $dir=dirname($root).'/noa-db-private';
    if(is_link($dir))throw new RuntimeException('private_symlink');
    if(!is_dir($dir)&&!mkdir($dir,0700))throw new RuntimeException('private_unavailable');
    $real=realpath($dir);if(!$real||str_starts_with($real.'/',rtrim($root,'/').'/'))throw new RuntimeException('private_inside_webroot');
    if((fileperms($dir)&0077)!==0&&!chmod($dir,0700))throw new RuntimeException('private_permissions');return $real;
}
function nd_audit(string $action,string $status,array $details=[]): void {
    global $member;
    $path=nd_private().'/audit-'.gmdate('Y-m').'.jsonl';
    if(is_link($path))throw new RuntimeException('audit_symlink');
    $line=json_encode(['at'=>gmdate('c'),'actor'=>$member['mb_id']??'','action'=>$action,'status'=>$status,'details'=>$details],JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE)."\n";
    if(file_put_contents($path,$line,FILE_APPEND|LOCK_EX)!==strlen($line))throw new RuntimeException('audit_unavailable');chmod($path,0600);
}
function nd_lock() { $p=nd_private().'/operation.lock';if(is_link($p))throw new RuntimeException('lock_symlink');$f=fopen($p,'c');chmod($p,0600);if(!$f||!flock($f,LOCK_EX|LOCK_NB))throw new RuntimeException('다른 DB 관리 작업이 실행 중입니다.');return $f; }
function nd_id(string $id): string { if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new InvalidArgumentException('백업 ID 오류입니다.');return $id; }
function nd_manifest(string $id,bool $verify=true): array {
    $base=nd_private().'/'.nd_id($id);if(is_link($base.'.json')||is_link($base.'.sql'))throw new RuntimeException('backup_symlink');
    $m=json_decode((string)file_get_contents($base.'.json'),true,512,JSON_THROW_ON_ERROR);
    if($verify&&(!is_file($base.'.sql')||filesize($base.'.sql')!==$m['bytes']||!hash_equals($m['sha256'],hash_file('sha256',$base.'.sql'))))throw new RuntimeException('백업 무결성 검사 실패');return $m;
}
function nd_backup(PDO $db,?string $table): array {
    $lock=nd_lock();$id=bin2hex(random_bytes(16));$dir=nd_private();$tmp=$dir.'/'.$id.'.partial';
    try {
        $tables=nd_tables($db);$names=array_column($tables,'TABLE_NAME');
        if($table!==null&&!in_array($table,$names,true))throw new InvalidArgumentException('백업 테이블 오류입니다.');
        // PHP logical snapshot: refuse engines and DB objects we cannot preserve faithfully.
        $selected=array_values(array_filter($tables,fn($t)=>$table===null||$t['TABLE_NAME']===$table));
        $needsLock=false;foreach($selected as $t){if(!in_array($t['ENGINE'],['InnoDB','MyISAM'],true))throw new DomainException('지원하지 않는 테이블 엔진입니다.');if($t['ENGINE']!=='InnoDB')$needsLock=true;}
        if(!$selected)throw new InvalidArgumentException('백업할 테이블이 없습니다.');
        $extras=[];
        foreach(['VIEWS'=>'TABLE_SCHEMA','TRIGGERS'=>'TRIGGER_SCHEMA','ROUTINES'=>'ROUTINE_SCHEMA','EVENTS'=>'EVENT_SCHEMA'] as $object=>$schema){
            $r=nd_rows($db,'SELECT COUNT(*) AS n FROM information_schema.'.$object.' WHERE '.$schema.'=DATABASE()');$extras[$object]=(int)$r[0]['n'];
        }
        if(array_sum($extras)>0)throw new DomainException('뷰·트리거·루틴·이벤트가 있어 전문 전체 덤프 절차가 필요합니다. 불완전한 백업은 생성하지 않습니다.');
        $f=fopen($tmp,'xb');if(!$f)throw new RuntimeException('backup_open_failed');chmod($tmp,0600);$bytes=0;$started=microtime(true);$counts=[];
        $write=function(string $s)use($f,&$bytes,$started){$bytes+=strlen($s);if($bytes>268435456||microtime(true)-$started>40)throw new DomainException('백업 안전 상한(256MB/40초)을 초과했습니다.');if(fwrite($f,$s)!==strlen($s))throw new RuntimeException('backup_write_failed');};
        if($needsLock){$locks=implode(',',array_map(fn($t)=>'`'.str_replace('`','``',$t['TABLE_NAME']).'` READ',$selected));$db->exec('LOCK TABLES '.$locks);}
        else{$db->exec('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');$db->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');}
        try {
            $write("-- NOA STUDIO verified logical backup v1\nSET NAMES utf8mb4;\nSET time_zone='+00:00';\nSET SESSION sql_mode='NO_BACKSLASH_ESCAPES';\nSET FOREIGN_KEY_CHECKS=0;\n");
            foreach($selected as $t){
                $name=$t['TABLE_NAME'];if(!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/D',$name))throw new RuntimeException('unsupported_identifier');
                // Hold a metadata lock before reading DDL to avoid a schema/data race.
                nd_rows($db,'SELECT * FROM `'.$name.'` LIMIT 0');
                $ddl=nd_rows($db,'SHOW CREATE TABLE `'.$name.'`')[0]['Create Table'];
                $cols=nd_rows($db,'SELECT COLUMN_NAME,DATA_TYPE,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION',[$name]);
                $cols=array_values(array_filter($cols,fn($c)=>!str_contains($c['EXTRA'],'VIRTUAL GENERATED')&&!str_contains($c['EXTRA'],'STORED GENERATED')));
                $types=array_column($cols,'DATA_TYPE');$cols=array_column($cols,'COLUMN_NAME');
                $ident=implode(',',array_map(fn($c)=>'`'.str_replace('`','``',$c).'`',$cols));
                $write('DROP TABLE IF EXISTS `'.$name."`;\n".$ddl.";\n");
                $q=$db->query('SELECT '.$ident.' FROM `'.$name.'`');$count=0;
                while($row=$q->fetch(PDO::FETCH_NUM)){$values=[];foreach($row as $i=>$v){if($v===null)$values[]='NULL';else{$hex="X'".bin2hex((string)$v)."'";$values[]=in_array($types[$i],['binary','varbinary','tinyblob','blob','mediumblob','longblob','bit'],true)?$hex:'CONVERT('.$hex.' USING utf8mb4)';}}$write('INSERT INTO `'.$name.'` ('.$ident.') VALUES ('.implode(',',$values).");\n");$count++;}
                $q->closeCursor();$counts[$name]=$count;
            }
            $write("SET FOREIGN_KEY_CHECKS=1;\n-- NOA BACKUP COMPLETE\n");
            if($table===null&&nd_names($db)!==$names)throw new RuntimeException('백업 도중 테이블 구성이 변경되었습니다. 다시 실행하세요.');
        }finally{if($needsLock)$db->exec('UNLOCK TABLES');else $db->rollBack();fclose($f);}
        $m=['id'=>$id,'createdAt'=>gmdate('c'),'scope'=>$table??'전체 DB','tables'=>$counts,'bytes'=>filesize($tmp),'sha256'=>hash_file('sha256',$tmp),'consistency'=>$needsLock?'READ LOCK':'REPEATABLE READ SNAPSHOT','format'=>'noa-logical-v1','objects'=>$extras,'restoreVerified'=>false];
        if(!rename($tmp,$dir.'/'.$id.'.sql'))throw new RuntimeException('backup_publish_failed');
        if(file_put_contents($dir.'/'.$id.'.json',json_encode($m,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),LOCK_EX)===false)throw new RuntimeException('manifest_write_failed');chmod($dir.'/'.$id.'.json',0600);
        return nd_manifest($id);
    }finally{if(isset($f)&&is_resource($f))fclose($f);if(is_file($tmp))unlink($tmp);flock($lock,LOCK_UN);fclose($lock);}
}
function nd_restore_plan(PDO $db,array $backup): array {
    $current=[];$names=nd_names($db);
    foreach(array_keys($backup['tables']) as $t){
        if(!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/D',$t))throw new RuntimeException('backup_identifier');
        $current[$t]=in_array($t,$names,true)?['ddlSha256'=>hash('sha256',nd_rows($db,'SHOW CREATE TABLE `'.$t.'`')[0]['Create Table']),'rows'=>(int)nd_rows($db,'SELECT COUNT(*) AS n FROM `'.$t.'`')[0]['n']]:null;
    }
    $plan=['id'=>bin2hex(random_bytes(16)),'createdAt'=>time(),'expiresAt'=>time()+3600,'backupId'=>$backup['id'],'backupSha256'=>$backup['sha256'],'affectedTables'=>array_keys($backup['tables']),'current'=>$current];
    $json=json_encode($plan,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);$hash=hash('sha256',$json);
    $path=nd_private().'/restore-plan-'.$plan['id'].'.json';if(file_put_contents($path,$json,LOCK_EX)!==strlen($json))throw new RuntimeException('plan_write_failed');chmod($path,0600);
    return ['plan'=>$plan,'approvalSha256'=>$hash];
}
