<?php
/**
 * Gateway dedicado para presets de Full Meridiano / Full Titulos.
 * Usa a api_cls.php em modo biblioteca para reaproveitar autenticacao,
 * permissoes, protocolo de leitura/escrita e backups.
 */

define('APICLS_LIBRARY_MODE', true);
require_once __DIR__ . '/api_cls.php';

function meridianTitlePresetCatalog()
{
    static $catalog = null;
    if ($catalog !== null) {
        return $catalog;
    }

    $legacySource = 'script_155v2/configs/config.php (compat 1.7.8)';
    $meridianHex = '000000500000000000000000000000050000006400003f920000000100000000000000000000000000000000000000000000000000000000';
    $titleHex = '8405cc0000000e050d058c050f05150516051705180519051a051b051c051d0583051e051f05200521052205230524052505840526052705280529052a052b052c052d052e052f0530053105320533053405350536053705380539053a053b053c053d053e053f054005410542054305850544058705450546054705480549054a0586054b054c054d054e054f058805500551055205530554055505560557055805590589055a055b055c055d055e055f0560056105620563056405650566056705680569056a056b056c056d056e056f05700571057205730574057505760577058b0578058a0579057a057b057c057d057e057f058005810582058d058e058f051106140615061606170618061d0629062b063e06610662066306640666066706680669066a066b066c066d066e066f067006710672067306740675067606770678067a067b067c067d067e067f0680068106820683068406850686068706880689068a068b068c068d068e068f06900691069206930694069b069c069f06a006a106a206a306a406a506a606a706a806a906aa06ab06ac06ad06ae0600000000';

    $catalog = [
        'full_meridian' => [
            'key' => 'full_meridian',
            'label' => 'Full Meridiano',
            'summary' => 'Aplica o blob legado de meridiano completo em status.meridian_data.',
            'applies' => ['meridian'],
            'meridian_data' => $meridianHex,
            'title_data' => '',
            'legacy_source' => $legacySource,
        ],
        'full_titles' => [
            'key' => 'full_titles',
            'label' => 'Full Titulos',
            'summary' => 'Aplica o blob legado de titulos completos em status.title_data.',
            'applies' => ['titles'],
            'meridian_data' => '',
            'title_data' => $titleHex,
            'legacy_source' => $legacySource,
        ],
        'full_meridian_titles' => [
            'key' => 'full_meridian_titles',
            'label' => 'Full Meridiano + Titulos',
            'summary' => 'Aplica os dois blobs legados em status.meridian_data e status.title_data.',
            'applies' => ['meridian', 'titles'],
            'meridian_data' => $meridianHex,
            'title_data' => $titleHex,
            'legacy_source' => $legacySource,
        ],
        'reset_meridian' => [
            'key' => 'reset_meridian',
            'label' => 'Reset Meridiano',
            'summary' => 'Restaura status.meridian_data para o baseline padrao salvo do alvo.',
            'applies' => ['meridian'],
            'restore_baseline' => true,
            'legacy_source' => 'baseline_snapshot',
        ],
        'reset_titles' => [
            'key' => 'reset_titles',
            'label' => 'Reset Titulos',
            'summary' => 'Restaura status.title_data para o baseline padrao salvo do alvo.',
            'applies' => ['titles'],
            'restore_baseline' => true,
            'legacy_source' => 'baseline_snapshot',
        ],
        'reset_meridian_titles' => [
            'key' => 'reset_meridian_titles',
            'label' => 'Reset Meridiano + Titulos',
            'summary' => 'Restaura os dois blobs para o baseline padrao salvo do alvo.',
            'applies' => ['meridian', 'titles'],
            'restore_baseline' => true,
            'legacy_source' => 'baseline_snapshot',
        ],
    ];

    return $catalog;
}

function meridianTitleNormalizeHexValue($value)
{
    return strtolower(preg_replace('/[^a-f0-9]/i', '', trim((string) $value)));
}

function meridianTitleNormalizePresetKey($key)
{
    $key = strtolower(trimOneLineText((string) $key));
    $aliases = [
        'meridian' => 'full_meridian',
        'full_meridiano' => 'full_meridian',
        'meridiano' => 'full_meridian',
        'title' => 'full_titles',
        'titles' => 'full_titles',
        'titulos' => 'full_titles',
        'full_titulos' => 'full_titles',
        'all' => 'full_meridian_titles',
        'full' => 'full_meridian_titles',
        'meridian_titles' => 'full_meridian_titles',
        'full_meridian_and_titles' => 'full_meridian_titles',
        'reset' => 'reset_meridian_titles',
        'default' => 'reset_meridian_titles',
        'reset_default' => 'reset_meridian_titles',
        'reset_meridiano' => 'reset_meridian',
        'reset_titulos' => 'reset_titles',
        'default_meridian' => 'reset_meridian',
        'default_titles' => 'reset_titles',
    ];
    if (isset($aliases[$key])) {
        return $aliases[$key];
    }
    return $key;
}

function meridianTitlePresetDefinition($presetKey)
{
    $catalog = meridianTitlePresetCatalog();
    $presetKey = meridianTitleNormalizePresetKey($presetKey);
    if (!isset($catalog[$presetKey])) {
        throw new InvalidArgumentException('preset_key invalido');
    }
    return $catalog[$presetKey];
}

function meridianTitleAllowedClsRoleIds(array $config)
{
    return array_values(array_unique(array_map('intval', (array) array_value($config, 'clsconfig_template_roleids', []))));
}

function meridianTitleStatusFlags(array $editable)
{
    $status = (array) array_value($editable, 'status', []);
    $catalog = meridianTitlePresetCatalog();
    $currentMeridian = meridianTitleNormalizeHexValue(array_value($status, 'meridian_data', ''));
    $currentTitles = meridianTitleNormalizeHexValue(array_value($status, 'title_data', ''));

    $fullMeridian = meridianTitleNormalizeHexValue(array_value($catalog['full_meridian'], 'meridian_data', ''));
    $fullTitles = meridianTitleNormalizeHexValue(array_value($catalog['full_titles'], 'title_data', ''));

    return [
        'has_full_meridian' => ($currentMeridian !== '' && $currentMeridian === $fullMeridian),
        'has_full_titles' => ($currentTitles !== '' && $currentTitles === $fullTitles),
        'current_meridian_data' => $currentMeridian,
        'current_title_data' => $currentTitles,
    ];
}

function meridianTitleBaselineDir(array $config)
{
    return ensureWritableDirectory(__DIR__ . '/backups/gm-commander-v2/meridian-titles/baselines');
}

function meridianTitleBaselinePath(array $config, $roleid)
{
    return rtrim(meridianTitleBaselineDir($config), '/\\') . DIRECTORY_SEPARATOR . 'roleid-' . intval($roleid) . '.json';
}

function meridianTitleBuildBaselineSnapshot(array $editable, array $meta = [])
{
    $base = (array) array_value($editable, 'base', []);
    $status = (array) array_value($editable, 'status', []);
    return array_merge([
        'roleid' => intval(array_value($editable, 'roleid', 0)),
        'userid' => intval(array_value($base, 'userid', 0)),
        'name' => trim((string) array_value($base, 'name', '')),
        'cls' => intval(array_value($base, 'cls', 0)),
        'gender' => intval(array_value($base, 'gender', 0)),
        'meridian_data' => meridianTitleNormalizeHexValue(array_value($status, 'meridian_data', '')),
        'title_data' => meridianTitleNormalizeHexValue(array_value($status, 'title_data', '')),
        'captured_at' => gmdate('c'),
        'source' => 'current_state',
    ], $meta);
}

function meridianTitleReadBaselineSnapshot(array $config, $roleid)
{
    $path = meridianTitleBaselinePath($config, $roleid);
    if (!is_file($path) || !is_readable($path)) {
        return null;
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return null;
    }

    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
        return null;
    }
    $decoded['meridian_data'] = meridianTitleNormalizeHexValue(array_value($decoded, 'meridian_data', ''));
    $decoded['title_data'] = meridianTitleNormalizeHexValue(array_value($decoded, 'title_data', ''));
    $decoded['baseline_file'] = $path;
    return $decoded;
}

function meridianTitleWriteBaselineSnapshot(array $config, array $editable, array $meta = [])
{
    $snapshot = meridianTitleBuildBaselineSnapshot($editable, $meta);
    $path = meridianTitleBaselinePath($config, array_value($snapshot, 'roleid', 0));
    writeAtomicFile($path, safeJsonEncode($snapshot));
    $snapshot['baseline_file'] = $path;
    return $snapshot;
}

function meridianTitleFindLatestRoleBackupFile(array $config, $roleid)
{
    $roleid = intval($roleid);
    if ($roleid <= 0) {
        return null;
    }

    $dir = trim((string) array_value($config, 'clsconfig_backup_dir', __DIR__ . '/backups/clsconfig'));
    if ($dir === '' || !is_dir($dir)) {
        return null;
    }

    $pattern = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . 'roleid-' . $roleid . '-*.json';
    $files = glob($pattern);
    if (!is_array($files) || empty($files)) {
        return null;
    }

    usort($files, function ($a, $b) {
        return intval(@filemtime($b)) <=> intval(@filemtime($a));
    });

    return $files[0];
}

function meridianTitleReadBaselineFromBackup(array $config, $roleid)
{
    $file = meridianTitleFindLatestRoleBackupFile($config, $roleid);
    if ($file === null || !is_file($file) || !is_readable($file)) {
        return null;
    }

    $raw = @file_get_contents($file);
    if (!is_string($raw) || trim($raw) === '') {
        return null;
    }

    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
        return null;
    }

    $snapshot = meridianTitleBuildBaselineSnapshot($decoded, [
        'source' => 'latest_backup',
        'backup_file' => $file,
    ]);
    return $snapshot;
}

function meridianTitleResolveBaselineSnapshot(array $config, array $editable)
{
    $roleid = intval(array_value($editable, 'roleid', 0));
    if ($roleid <= 0) {
        throw new InvalidArgumentException('roleid invalido para baseline');
    }

    $baseline = meridianTitleReadBaselineSnapshot($config, $roleid);
    if (is_array($baseline)) {
        return $baseline;
    }

    $backupBaseline = meridianTitleReadBaselineFromBackup($config, $roleid);
    if (is_array($backupBaseline)) {
        return meridianTitleWriteBaselineSnapshot($config, $editable, [
            'source' => 'latest_backup',
            'backup_file' => array_value($backupBaseline, 'backup_file', null),
            'meridian_data' => array_value($backupBaseline, 'meridian_data', ''),
            'title_data' => array_value($backupBaseline, 'title_data', ''),
        ]);
    }

    throw new Exception('Nao foi possivel localizar o baseline padrao do alvo para reset');
}

function meridianTitleEnsureBaselineSnapshot(array $config, array $editable)
{
    $roleid = intval(array_value($editable, 'roleid', 0));
    if ($roleid <= 0) {
        throw new InvalidArgumentException('roleid invalido para baseline');
    }

    $existing = meridianTitleReadBaselineSnapshot($config, $roleid);
    if (is_array($existing)) {
        return $existing;
    }

    return meridianTitleWriteBaselineSnapshot($config, $editable, [
        'source' => 'pre_apply',
    ]);
}

function meridianTitleResolveEffectivePreset(array $config, array $editable, array $preset)
{
    if (empty($preset['restore_baseline'])) {
        return [$preset, null];
    }

    $baseline = meridianTitleResolveBaselineSnapshot($config, $editable);
    $effective = $preset;
    if (in_array('meridian', (array) array_value($preset, 'applies', []), true)) {
        $effective['meridian_data'] = meridianTitleNormalizeHexValue(array_value($baseline, 'meridian_data', ''));
    }
    if (in_array('titles', (array) array_value($preset, 'applies', []), true)) {
        $effective['title_data'] = meridianTitleNormalizeHexValue(array_value($baseline, 'title_data', ''));
    }
    $effective['baseline_source'] = array_value($baseline, 'source', '');

    return [$effective, $baseline];
}

function meridianTitleApplyPresetToEditable(array $editable, array $preset)
{
    $patched = $editable;
    if (!isset($patched['status']) || !is_array($patched['status'])) {
        $patched['status'] = [];
    }

    if (in_array('meridian', (array) array_value($preset, 'applies', []), true)) {
        $patched['status']['meridian_data'] = meridianTitleNormalizeHexValue(array_value($preset, 'meridian_data', ''));
    }
    if (in_array('titles', (array) array_value($preset, 'applies', []), true)) {
        $patched['status']['title_data'] = meridianTitleNormalizeHexValue(array_value($preset, 'title_data', ''));
    }

    return $patched;
}

function meridianTitleBuildTargetSummary($targetMode, array $editable, array $profile = [], array $extra = [])
{
    $base = (array) array_value($editable, 'base', []);
    $status = (array) array_value($editable, 'status', []);
    $cls = intval(array_value($base, 'cls', array_value($profile, 'cls', 0)));
    $class = class_info($cls);
    return array_merge([
        'target_mode' => $targetMode,
        'roleid' => intval(array_value($editable, 'roleid', 0)),
        'userid' => intval(array_value($base, 'userid', array_value($profile, 'userid', 0))),
        'name' => trim((string) array_value($base, 'name', array_value($profile, 'name', ''))),
        'cls' => $cls,
        'class_name' => trim((string) array_value($class, 'name', 'Desconhecida')),
        'level' => intval(array_value($status, 'level', array_value($profile, 'level', 0))),
        'level2' => intval(array_value($status, 'level2', array_value($profile, 'level2', 0))),
        'online' => !empty($profile['online']),
        'is_cls_template' => ($targetMode === 'cls_template'),
    ], $extra);
}

function meridianTitleResolveRoleTargetProfile(array $config, array $request)
{
    $profilePayload = gmV2GetPlayerTargetProfilePayload($config, $request);
    $profile = (array) array_value($profilePayload, 'profile', []);
    if (intval(array_value($profile, 'roleid', 0)) <= 0) {
        throw new InvalidArgumentException('Nao foi possivel resolver o personagem alvo');
    }
    return $profile;
}

function meridianTitleResolveTarget(array $config, array $request)
{
    $targetMode = strtolower(trim((string) firstArrayValue($request, ['target_mode', 'targetMode', 'mode'], 'role')));
    if (in_array($targetMode, ['player', 'real'], true)) {
        $targetMode = 'role';
    }
    if (in_array($targetMode, ['cls', 'template'], true)) {
        $targetMode = 'cls_template';
    }
    if (!in_array($targetMode, ['role', 'cls_template'], true)) {
        throw new InvalidArgumentException('target_mode invalido. Use: role ou cls_template');
    }

    $proto = new GamedProtocol();
    $profile = [];
    $roleid = intval(firstArrayValue($request, ['roleid', 'role_id'], 0));
    if ($targetMode === 'role') {
        $profile = meridianTitleResolveRoleTargetProfile($config, $request);
        $roleid = intval(array_value($profile, 'roleid', $roleid));
    }

    if ($roleid <= 0) {
        throw new InvalidArgumentException('roleid obrigatorio');
    }

    if ($targetMode === 'cls_template') {
        $allowed = meridianTitleAllowedClsRoleIds($config);
        if (!in_array($roleid, $allowed, true)) {
            throw new InvalidArgumentException('roleid nao permitido para cls template');
        }
    }

    $editable = $proto->getEditableRole($roleid, $config['gamedbd_ip'], $config['gamedbd_port']);
    if (!$editable || !is_array($editable)) {
        throw new Exception('Nao foi possivel carregar o payload editavel do alvo');
    }

    return [
        'target_mode' => $targetMode,
        'roleid' => $roleid,
        'editable' => $editable,
        'profile' => $profile,
        'proto' => $proto,
    ];
}

function meridianTitleListClsTemplates(array $config)
{
    $proto = new GamedProtocol();
    $items = [];
    foreach (meridianTitleAllowedClsRoleIds($config) as $roleid) {
        try {
            $editable = $proto->getEditableRole($roleid, $config['gamedbd_ip'], $config['gamedbd_port']);
            if (!$editable || !is_array($editable)) {
                $items[] = [
                    'roleid' => $roleid,
                    'available' => false,
                    'error' => 'template nao encontrado',
                ];
                continue;
            }
            $flags = meridianTitleStatusFlags($editable);
            $items[] = array_merge(
                meridianTitleBuildTargetSummary('cls_template', $editable),
                ['available' => true],
                $flags
            );
        } catch (Exception $e) {
            $items[] = [
                'roleid' => $roleid,
                'available' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
    return $items;
}

function meridianTitleCatalogPayload(array $config)
{
    $presets = [];
    foreach (meridianTitlePresetCatalog() as $preset) {
        $presets[] = [
            'key' => array_value($preset, 'key', ''),
            'label' => array_value($preset, 'label', ''),
            'summary' => array_value($preset, 'summary', ''),
            'applies' => array_value($preset, 'applies', []),
            'legacy_source' => array_value($preset, 'legacy_source', ''),
        ];
    }

    return [
        'success' => true,
        'presets' => $presets,
        'target_modes' => ['role', 'cls_template'],
        'cls_templates' => meridianTitleListClsTemplates($config),
        'endpoints' => [
            'preview' => '/apicls/api_cls_meridian_titles.php?action=previewMeridianTitlePreset',
            'apply' => '/apicls/api_cls_meridian_titles.php?action=applyMeridianTitlePreset',
        ],
        'collected_at' => gmdate('c'),
    ];
}

function meridianTitlePreviewPayload(array $config, array $request)
{
    $preset = meridianTitlePresetDefinition(firstArrayValue($request, ['preset_key', 'presetKey', 'preset'], ''));
    $target = meridianTitleResolveTarget($config, $request);
    $editable = (array) array_value($target, 'editable', []);
    list($effectivePreset, $baseline) = meridianTitleResolveEffectivePreset($config, $editable, $preset);
    $patched = meridianTitleApplyPresetToEditable($editable, $effectivePreset);
    $currentFlags = meridianTitleStatusFlags($editable);
    $afterFlags = meridianTitleStatusFlags($patched);
    $wouldChange = meridianTitleWouldChange($editable, $patched, $effectivePreset);

    $warnings = [];
    if (array_value($target, 'target_mode', '') === 'role' && !empty(array_value(array_value($target, 'profile', []), 'online', false))) {
        $warnings[] = 'O personagem aparece online. Para aplicar com seguranca, use kick_online=true ou deixe o alvo offline.';
    }

    return [
        'success' => true,
        'preset' => [
            'key' => array_value($preset, 'key', ''),
            'label' => array_value($preset, 'label', ''),
            'applies' => array_value($preset, 'applies', []),
            'legacy_source' => array_value($preset, 'legacy_source', ''),
            'baseline_source' => array_value($effectivePreset, 'baseline_source', ''),
        ],
        'target' => meridianTitleBuildTargetSummary(
            array_value($target, 'target_mode', 'role'),
            $editable,
            (array) array_value($target, 'profile', [])
        ),
        'baseline' => $baseline,
        'current' => $currentFlags,
        'after' => $afterFlags,
        'would_change' => $wouldChange,
        'warnings' => $warnings,
        'previewed_at' => gmdate('c'),
    ];
}

function meridianTitleVerifyPersistence(array $editable, array $fresh, array $preset)
{
    $mismatches = [];
    if (in_array('meridian', (array) array_value($preset, 'applies', []), true)) {
        $expected = meridianTitleNormalizeHexValue(array_value(array_value($editable, 'status', []), 'meridian_data', ''));
        $actual = meridianTitleNormalizeHexValue(array_value(array_value($fresh, 'status', []), 'meridian_data', ''));
        if ($expected !== $actual) {
            $mismatches['meridian_data'] = [
                'expected' => $expected,
                'actual' => $actual,
            ];
        }
    }
    if (in_array('titles', (array) array_value($preset, 'applies', []), true)) {
        $expected = meridianTitleNormalizeHexValue(array_value(array_value($editable, 'status', []), 'title_data', ''));
        $actual = meridianTitleNormalizeHexValue(array_value(array_value($fresh, 'status', []), 'title_data', ''));
        if ($expected !== $actual) {
            $mismatches['title_data'] = [
                'expected' => $expected,
                'actual' => $actual,
            ];
        }
    }
    return $mismatches;
}

function meridianTitleWouldChange(array $editable, array $patched, array $preset)
{
    $currentStatus = (array) array_value($editable, 'status', []);
    $patchedStatus = (array) array_value($patched, 'status', []);

    if (in_array('meridian', (array) array_value($preset, 'applies', []), true)) {
        if (meridianTitleNormalizeHexValue(array_value($currentStatus, 'meridian_data', '')) !== meridianTitleNormalizeHexValue(array_value($patchedStatus, 'meridian_data', ''))) {
            return true;
        }
    }

    if (in_array('titles', (array) array_value($preset, 'applies', []), true)) {
        if (meridianTitleNormalizeHexValue(array_value($currentStatus, 'title_data', '')) !== meridianTitleNormalizeHexValue(array_value($patchedStatus, 'title_data', ''))) {
            return true;
        }
    }

    return false;
}

function meridianTitleKickRole(array $config, GamedProtocol $proto, $roleid, array $request = [])
{
    $seconds = max(1, intval(firstArrayValue($request, ['kick_seconds', 'kickSeconds'], array_value($config, 'security_kick_default_seconds', 10))));
    $reason = trim((string) firstArrayValue($request, ['kick_reason', 'kickReason', 'reason'], 'Aplicacao de preset de meridiano/titulos'));
    $delivery = $proto->forbidRole(intval($roleid), $seconds, $reason, $config['gdeliveryd_ip'], $config['gdeliveryd_port']);
    return [
        'requested' => true,
        'roleid' => intval($roleid),
        'seconds' => $seconds,
        'reason' => $reason,
        'delivery' => $delivery,
    ];
}

function meridianTitleApplyPayload(array $config, array $request)
{
    $preset = meridianTitlePresetDefinition(firstArrayValue($request, ['preset_key', 'presetKey', 'preset'], ''));
    $target = meridianTitleResolveTarget($config, $request);
    $targetMode = array_value($target, 'target_mode', 'role');
    $editable = (array) array_value($target, 'editable', []);
    $profile = (array) array_value($target, 'profile', []);
    $proto = array_value($target, 'proto', null);
    if (!$proto instanceof GamedProtocol) {
        throw new Exception('Falha interna ao preparar o protocolo');
    }

    $requiredRole = ($targetMode === 'cls_template') ? 'super_admin' : 'gm_admin';
    operatorPermissionEnforceRequiredRole($config, 'applyMeridianTitlePreset', $request, $requiredRole);

    $baseline = null;
    list($effectivePreset, $resolvedBaseline) = meridianTitleResolveEffectivePreset($config, $editable, $preset);
    if ($resolvedBaseline !== null) {
        $baseline = $resolvedBaseline;
    }

    $patched = meridianTitleApplyPresetToEditable($editable, $effectivePreset);
    $currentFlags = meridianTitleStatusFlags($editable);
    $afterFlags = meridianTitleStatusFlags($patched);
    $changed = meridianTitleWouldChange($editable, $patched, $effectivePreset);

    $sessionKick = null;
    if ($targetMode === 'role' && !empty($profile['online'])) {
        if (!truthyValue(firstArrayValue($request, ['kick_online', 'kickOnline'], false))) {
            throw new InvalidArgumentException('O personagem alvo aparece online. Envie kick_online=true ou aplique com o alvo offline.');
        }

        $sessionKick = meridianTitleKickRole($config, $proto, array_value($target, 'roleid', 0), $request);
        $waitSeconds = max(1, min(30, intval(firstArrayValue($request, ['wait_seconds', 'waitSeconds'], 5))));
        sleep($waitSeconds);

        try {
            $recheck = meridianTitleResolveRoleTargetProfile($config, ['roleid' => array_value($target, 'roleid', 0)]);
            $sessionKick['post_wait_profile'] = [
                'online' => !empty($recheck['online']),
                'checked_at' => gmdate('c'),
            ];
            if (!empty($recheck['online'])) {
                throw new Exception('O personagem ainda aparece online apos o kick. Tente novamente em alguns segundos.');
            }
        } catch (InvalidArgumentException $e) {
            throw $e;
        } catch (Exception $e) {
            if (!isset($sessionKick['post_wait_profile'])) {
                $sessionKick['recheck_warning'] = $e->getMessage();
            } else {
                throw $e;
            }
        }
    }

    if (!$changed) {
        return [
            'success' => true,
            'preset' => [
                'key' => array_value($preset, 'key', ''),
                'label' => array_value($preset, 'label', ''),
                'baseline_source' => array_value($effectivePreset, 'baseline_source', ''),
            ],
            'target' => meridianTitleBuildTargetSummary($targetMode, $editable, $profile),
            'changed' => false,
            'message' => 'O preset ja estava aplicado no alvo.',
            'baseline' => $baseline,
            'current' => $currentFlags,
            'after' => $afterFlags,
            'applied_at' => gmdate('c'),
        ];
    }

    if (empty($preset['restore_baseline'])) {
        $baseline = meridianTitleEnsureBaselineSnapshot($config, $editable);
    }

    $exportClsconfig = ($targetMode === 'cls_template');
    $saved = $proto->saveEditableRole(
        intval(array_value($target, 'roleid', 0)),
        $patched,
        $config['gamedbd_ip'],
        $config['gamedbd_port'],
        $config['clsconfig_export_workdir'],
        $config['clsconfig_export_command'],
        $exportClsconfig,
        $config['clsconfig_backup_dir'],
        $config['clsconfig_export_after_save'],
        $config['clsconfig_export_deferred_delay_seconds'],
        $config['clsconfig_export_log_dir'],
        $config['clsconfig_file_path'],
        $config['clsconfig_file_backup_dir']
    );

    $fresh = $proto->getEditableRole(intval(array_value($target, 'roleid', 0)), $config['gamedbd_ip'], $config['gamedbd_port']);
    if (!$fresh || !is_array($fresh)) {
        throw new Exception('Falha ao reler o alvo apos aplicar o preset');
    }

    $mismatches = meridianTitleVerifyPersistence($patched, $fresh, $effectivePreset);
    if (!empty($mismatches)) {
        $rollbackMessage = 'rollback nao executado';
        try {
            $proto->saveEditableRole(
                intval(array_value($target, 'roleid', 0)),
                $editable,
                $config['gamedbd_ip'],
                $config['gamedbd_port'],
                $config['clsconfig_export_workdir'],
                $config['clsconfig_export_command'],
                $exportClsconfig,
                $config['clsconfig_backup_dir'],
                $config['clsconfig_export_after_save'],
                $config['clsconfig_export_deferred_delay_seconds'],
                $config['clsconfig_export_log_dir'],
                $config['clsconfig_file_path'],
                $config['clsconfig_file_backup_dir']
            );
            $rollbackMessage = 'rollback automatico concluido';
        } catch (Exception $rollbackError) {
            $rollbackMessage = 'rollback falhou: ' . $rollbackError->getMessage();
        }

        throw new Exception(
            'Preset salvo, mas a verificacao especifica de meridiano/titulos falhou: '
            . safeJsonEncode($mismatches) . '. ' . $rollbackMessage
        );
    }

    $actor = operatorResolveContext($config, $request);
    gmV2AppendAudit($config, 'meridian_title_preset_applied', [
        'preset_key' => array_value($preset, 'key', ''),
        'target_mode' => $targetMode,
        'roleid' => intval(array_value($target, 'roleid', 0)),
        'actor' => operatorPermissionAuditActor($actor),
        'changed' => true,
        'reset_operation' => !empty($preset['restore_baseline']),
        'baseline_source' => is_array($baseline) ? array_value($baseline, 'source', '') : '',
        'export_clsconfig' => $exportClsconfig,
    ]);

    $gmHistoryWarning = '';
    $gmEntry = gmHistoryEntryBase($config, 'applyMeridianTitlePreset', [
        'status' => 'success',
        'success' => true,
        'dry_run' => false,
        'preset_key' => array_value($preset, 'key', ''),
        'target_mode' => $targetMode,
        'target' => [
            'roleid' => intval(array_value($target, 'roleid', 0)),
            'userid' => intval(array_value(array_value($editable, 'base', []), 'userid', 0)),
            'name' => trim((string) array_value(array_value($editable, 'base', []), 'name', '')),
        ],
        'reset_operation' => !empty($preset['restore_baseline']),
        'baseline_source' => is_array($baseline) ? array_value($baseline, 'source', '') : '',
        'session_kick' => $sessionKick,
        'source' => 'api_cls_meridian_titles',
    ]);
    $gmHistoryFile = null;
    if (gmAppendHistoryBestEffort($config, $gmEntry, $gmHistoryWarning)) {
        $gmHistoryFile = gmActionHistoryFile($config);
    }

    return [
        'success' => true,
        'preset' => [
            'key' => array_value($preset, 'key', ''),
            'label' => array_value($preset, 'label', ''),
            'applies' => array_value($preset, 'applies', []),
            'baseline_source' => array_value($effectivePreset, 'baseline_source', ''),
        ],
        'target' => meridianTitleBuildTargetSummary($targetMode, $fresh, $profile),
        'changed' => true,
        'baseline' => $baseline,
        'current' => $currentFlags,
        'after' => meridianTitleStatusFlags($fresh),
        'save' => $saved,
        'session_kick' => $sessionKick,
        'gm_history_file' => $gmHistoryFile,
        'gm_history_warning' => $gmHistoryWarning,
        'audit_file' => gmV2AuditFile($config),
        'applied_at' => gmdate('c'),
    ];
}

header('Content-Type: application/json; charset=utf-8');

$secret = isset($_SERVER['HTTP_X_SYNC_SECRET']) ? $_SERVER['HTTP_X_SYNC_SECRET'] : (isset($_GET['secret']) ? $_GET['secret'] : '');
if ($secret !== $CONFIG['api_secret']) {
    respondJson(['error' => 'Unauthorized'], 401);
    exit;
}

$action = isset($_GET['action']) ? trim((string) $_GET['action']) : (isset($_POST['action']) ? trim((string) $_POST['action']) : '');
$request = ($_SERVER['REQUEST_METHOD'] === 'POST') ? readRequestPayload() : $_GET;
if (!is_array($request)) {
    $request = [];
}

switch ($action) {
    case 'getMeridianTitlePresetCatalog':
        operatorPermissionEnforceRequiredRole($CONFIG, 'getMeridianTitlePresetCatalog', $request, 'viewer');
        try {
            respondJson(meridianTitleCatalogPayload($CONFIG));
        } catch (Exception $e) {
            respondJson(['error' => $e->getMessage()], 500);
        }
        break;

    case 'previewMeridianTitlePreset':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respondJson(['error' => 'Use POST para previewMeridianTitlePreset'], 405);
            exit;
        }
        if (isset($request['__json_error'])) {
            respondJson(['error' => 'JSON invalido: ' . $request['__json_error']], 400);
            exit;
        }
        operatorPermissionEnforceRequiredRole($CONFIG, 'previewMeridianTitlePreset', $request, 'viewer');
        try {
            respondJson(meridianTitlePreviewPayload($CONFIG, $request));
        } catch (InvalidArgumentException $e) {
            respondJson(['error' => $e->getMessage()], 400);
        } catch (Exception $e) {
            respondJson(['error' => $e->getMessage()], 500);
        }
        break;

    case 'applyMeridianTitlePreset':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respondJson(['error' => 'Use POST para applyMeridianTitlePreset'], 405);
            exit;
        }
        if (isset($request['__json_error'])) {
            respondJson(['error' => 'JSON invalido: ' . $request['__json_error']], 400);
            exit;
        }
        try {
            respondJson(meridianTitleApplyPayload($CONFIG, $request));
        } catch (InvalidArgumentException $e) {
            respondJson(['error' => $e->getMessage()], 400);
        } catch (Exception $e) {
            respondJson(['error' => $e->getMessage()], 500);
        }
        break;

    default:
        respondJson([
            'error' => 'Acao invalida. Use: getMeridianTitlePresetCatalog, previewMeridianTitlePreset, applyMeridianTitlePreset',
        ], 400);
        break;
}
