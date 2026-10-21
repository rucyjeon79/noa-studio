<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/common.php';
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');header('X-Frame-Options: DENY');
if(empty($is_member)||($is_admin??'')!=='super'||empty($member['mb_id'])||$member['mb_id']!==($config['cf_admin']??'')){http_response_code(403);exit('최고관리자 권한이 필요합니다.');}
require_once __DIR__.'/core.php';
if(empty($_SESSION['noa_db_csrf']))$_SESSION['noa_db_csrf']=bin2hex(random_bytes(32));
function nd_json(int $code,array $data): never { http_response_code($code);header('Content-Type: application/json; charset=utf-8');echo json_encode($data,JSON_INVALID_UTF8_SUBSTITUTE|JSON_HEX_TAG);exit; }
function nd_csv_cell(mixed $v): string { $s=(string)($v??'');return preg_match('/^[\s]*[=+@\-]/u',$s)?"'".$s:$s; }
$action='';$started=microtime(true);
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
    if((int)($_SERVER['CONTENT_LENGTH']??0)>20000)nd_json(413,['error'=>'요청 크기를 초과했습니다.']);
    $body=$_POST;
    if(str_contains($_SERVER['CONTENT_TYPE']??'','application/json')){$raw=file_get_contents('php://input',false,null,0,20001);$body=json_decode($raw,true);}
    if(!is_array($body))nd_json(400,['error'=>'요청 형식 오류']);
    $token=$body['csrf']??'';
    if(!is_string($token)||!hash_equals($_SESSION['noa_db_csrf'],$token))nd_json(403,['error'=>'보안 토큰을 확인하세요. 페이지를 새로 열어 주세요.']);
    $fetch=$_SERVER['HTTP_SEC_FETCH_SITE']??'';
    if($fetch!==''&&!in_array($fetch,['same-origin','none'],true))nd_json(403,['error'=>'외부 요청은 허용하지 않습니다.']);
    try{
        $action=$body['action']??'';if(!is_string($action))throw new InvalidArgumentException('작업 오류');
        // Fail closed before DB work if durable audit logging is unavailable.
        nd_audit($action,'started');
        $result=[];
        if($action==='history'){
            $files=glob(nd_private().'/audit-*.jsonl');rsort($files);$logs=[];
            foreach(array_slice($files,0,2) as $p){if(is_link($p))continue;$f=fopen($p,'rb');fseek($f,max(0,filesize($p)-262144));if(ftell($f)>0)fgets($f);while(($line=fgets($f))!==false){$v=json_decode($line,true);if(is_array($v))$logs[]=$v;}fclose($f);}
            $result=['history'=>array_slice(array_reverse($logs),0,100)];
        }elseif($action==='backups'){
            $files=glob(nd_private().'/*.json');usort($files,fn($a,$b)=>filemtime($b)<=>filemtime($a));$list=[];
            foreach(array_slice($files,0,100) as $p){$id=basename($p,'.json');if(!preg_match('/^[a-f0-9]{32}$/D',$id))continue;try{$list[]=nd_manifest($id,false);}catch(Throwable $e){}}
            $result=['backups'=>$list];
        }elseif(in_array($action,['verify','download','restore_plan'],true)){
            $id=nd_id((string)($body['id']??''));$m=nd_manifest($id);
            if($action==='download'){
                nd_audit($action,'ok',['id'=>$id,'sha256'=>$m['sha256']]);
                header('Content-Type: application/sql');header('Content-Disposition: attachment; filename="noa-backup-'.$id.'.sql"');header('Content-Length: '.$m['bytes']);readfile(nd_private().'/'.$id.'.sql');exit;
            }
            if($action==='restore_plan'){
                $db=nd_db();$now=nd_names($db);$scope=array_keys($m['tables']);
                $approval=nd_restore_plan($db,$m);$result=['approval'=>$approval,'integrity'=>'SHA-256 일치','backup'=>$m,'affectedTables'=>$scope,'existingAffectedTables'=>array_values(array_intersect($scope,$now)), 'executionEnabled'=>false,'requiredSteps'=>['독립된 검증 DB에서 실제 복원 후 행 수·구조·체크섬 대조','쓰기 작업 중단 및 최신 복구용 백업 생성','영향 테이블·백업 SHA-256·복구 계획을 최고관리자가 별도 승인','승인된 운영 절차로 실행하고 결과 기록'],'notice'=>'무결성 검사는 복원 성공을 보장하지 않습니다. 이 화면에서는 운영 DB 복원을 실행하지 않습니다.'];
            }else $result=['backup'=>$m,'integrity'=>'SHA-256 일치','restoreVerified'=>$m['restoreVerified']];
        }else{
            $db=nd_db();
            switch($action){
                case 'status':
                    $s=nd_rows($db,'SELECT VERSION() AS version,@@session.max_execution_time AS timeoutMs,@@session.transaction_read_only AS readOnly')[0];
                    $tables=nd_tables($db);$s['connected']=true;$s['mysql8']=str_starts_with($s['version'],'8.');$result=['connection'=>$s,'tableCount'=>count($tables),'statistics'=>[]];
                    global $g5;
                    foreach(['음악 통합'=>'noa_catalog_songs','원본 문서'=>'noa_documents','회원'=>$g5['member_table']??'g5_member','설정'=>$g5['config_table']??'g5_config'] as $label=>$t){
                        if(in_array($t,array_column($tables,'TABLE_NAME'),true)&&preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/D',$t))$result['statistics'][$label]=(int)nd_rows($db,'SELECT COUNT(*) AS n FROM `'.$t.'`')[0]['n'];
                        else $result['statistics'][$label]=null;
                    }break;
                case 'tables':$result=['tables'=>nd_tables($db),'rowCountsAreEstimates'=>true];break;
                case 'structure':$result=['columns'=>nd_columns($db,(string)($body['table']??''))];break;
                case 'query':case 'csv':
                    if(!is_string($body['sql']??null))throw new InvalidArgumentException('SQL을 입력하세요.');
                    nd_audit($action,'query',['sqlTemplate'=>preg_replace("/'(?:[^'\\\\]|'')*'/","?",substr($body['sql'],0,12000)),'sqlSha256'=>hash('sha256',$body['sql'])]);
                    $result=nd_query($db,$body['sql']);
                    if($action==='csv'){
                        nd_audit($action,'ok',['rows'=>$result['rowCount'],'durationMs'=>(int)((microtime(true)-$started)*1000)]);
                        header('Content-Type: text/csv; charset=utf-8');header('Content-Disposition: attachment; filename="noa-query.csv"');echo "\xEF\xBB\xBF";$f=fopen('php://output','wb');fputcsv($f,array_map('nd_csv_cell',$result['columns']),',','"','');foreach($result['rows'] as $r)fputcsv($f,array_map('nd_csv_cell',$r),',','"','');fclose($f);exit;
                    }break;
                case 'backup':
                    $table=$body['table']??'';if(!is_string($table))throw new InvalidArgumentException('테이블 오류');
                    $result=['backup'=>nd_backup($db,$table===''?null:$table)];break;
                default:throw new InvalidArgumentException('허용되지 않은 작업입니다.');
            }
        }
        nd_audit($action,'ok',['durationMs'=>(int)((microtime(true)-$started)*1000),'rows'=>$result['rowCount']??null]);nd_json(200,$result);
    }catch(Throwable $e){
        $id=bin2hex(random_bytes(6));$safe=$e instanceof InvalidArgumentException||$e instanceof DomainException;
        try{nd_audit($action,'error',['reference'=>$id,'type'=>get_class($e),'sqlState'=>$e instanceof PDOException?(string)$e->getCode():null,'reason'=>$safe?$e->getMessage():null]);}catch(Throwable $ignored){}
        error_log('[noa-db '.$id.'] '.get_class($e).' code='.$e->getCode());
        $message=$safe?$e->getMessage():($e instanceof PDOException?'DB 작업을 완료하지 못했습니다. 실행 시간·연결 상태·문법을 확인하세요.':'DB 관리 작업을 완료하지 못했습니다. 서버의 백업 조건과 실행 기록을 확인하세요.');
        nd_json($safe?400:503,['error'=>$message,'reference'=>$id]);
    }
}
if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);exit;}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>데이터베이스 관리 | NOA STUDIO ADMIN</title><link rel="stylesheet" href="/noa-app/database/style.css?v=20261021-db1"><script src="/noa-app/database/ui.js?v=20261021-db1" defer></script></head><body><input type="hidden" id="csrf" value="<?=htmlspecialchars($_SESSION['noa_db_csrf'],ENT_QUOTES,'UTF-8')?>"><aside><a class="brand" href="/">NOA STUDIO<small>ADMIN</small></a><nav aria-label="관리자 메뉴"><a href="/adm/">대시보드</a><a href="/noa-library.php">음악 데이터 관리</a><a href="/adm/member_list.php">회원 관리</a><a href="/noa-youtube-admin.php">YouTube 관리</a><a href="/noa-ai-lab.php">AI LAB 관리</a><a href="/noa-app/database/" aria-current="page">데이터베이스 관리</a></nav><p class="muted">승인된 최고관리자 전용</p></aside><main><header><p class="eyebrow">DATA / DATABASE</p><h1>데이터베이스 관리</h1><p class="muted">연결부터 백업까지, 데이터의 현재 상태를 확인합니다.</p><span class="badge">읽기 전용 SQL</span></header><nav class="tabs" aria-label="데이터베이스 관리"><button data-view="status" aria-pressed="true">DB 연결 상태</button><button data-view="tables">테이블 목록</button><button data-view="browse">데이터 조회</button><button data-view="console">SQL 조회 콘솔</button><button data-view="backups">백업 관리</button><button data-view="history">실행 기록</button></nav><p id="status" role="status" aria-live="polite">연결 상태를 확인합니다.</p>
<section id="view-status"><h2>연결 및 데이터 현황</h2><div id="connection" class="cards"></div></section>
<section id="view-tables" hidden><h2>테이블 목록</h2><p class="muted">행 수와 용량은 MySQL 메타데이터의 추정치입니다. 테이블을 선택하면 구조를 확인합니다.</p><div id="tables"></div><h3 id="structure-title"></h3><div id="structure"></div></section>
<section id="view-browse" hidden><h2>데이터 조회</h2><div class="toolbar"><label>테이블<select id="browse-table"></select></label><label>검색 컬럼<select id="browse-column"></select></label><label>포함된 문자열<input id="search" maxlength="200" placeholder="검색어"></label><button id="search-button">조회</button></div><p class="muted">최대 200행을 표시합니다. 다음 페이지로 이동할 수 있습니다.</p><div id="browse-result"></div><div class="toolbar"><button id="previous">이전</button><span id="page-label"></span><button id="next">다음</button></div></section>
<section id="view-console" hidden><h2>SQL 조회 콘솔</h2><p class="muted">단일 테이블 SELECT · WHERE(AND/OR/LIKE/IS NULL) · GROUP BY · ORDER BY · COUNT/SUM/AVG/MIN/MAX. 최대 1,000행, 3초, 결과 4MB. 주석·세미콜론·JOIN·하위 쿼리는 지원하지 않습니다.</p><label for="sql">조회문</label><textarea id="sql" rows="6" spellcheck="false" placeholder="SELECT * FROM g5_member LIMIT 100"></textarea><div class="toolbar"><button id="run">조회 실행</button><button id="csv">CSV 내보내기</button></div><div id="query-result"></div></section>
<section id="view-backups" hidden><h2>백업 관리</h2><p class="muted">InnoDB는 일관된 스냅샷으로 보관합니다. MyISAM이 포함되면 백업 동안 조회 잠금을 사용하여 해당 테이블의 쓰기를 최대 40초 대기시킵니다. 전체 백업은 뷰·트리거·루틴·이벤트가 없는 DB에서 지원합니다. 지원하지 않는 객체가 있으면 불완전한 백업을 만들지 않습니다. 안전 상한: 256MB / 40초.</p><div class="toolbar"><label>백업 범위<select id="backup-table"><option value="">전체 DB</option></select></label><button id="backup">SQL 백업 생성</button><button id="refresh-backups">목록 새로고침</button></div><p class="muted">백업은 공개 경로 밖에 보관하며, 다운로드할 때 무결성을 다시 확인합니다. 실제 복원에는 별도 검증·최신 백업·승인이 필요합니다.</p><div id="backups"></div><pre id="restore-plan" hidden></pre></section>
<section id="view-history" hidden><h2>실행 기록 및 오류</h2><p class="muted">최근 100건을 표시합니다. 오류 참조번호로 서버 기록을 확인할 수 있습니다.</p><button id="refresh-history">기록 새로고침</button><div id="history"></div></section><footer>NOA STUDIO ADMIN · 기존 음악·회원·설정 보존</footer></main></body></html>
