<script>
    // HUD Masson RP. Данные — те же, что у RedAge: stores (store/chars, store/server, store/hud, store/account)
    // и хуки window.hudStore / window.serverStore / window.vehicleState / window.notification, которые вызывает клиент игры.
    // Все хуки заменённых элементов HUD (playerinfo, placetime, speedometr, notification, buttonsinfo) определены здесь.
    import { onMount } from 'svelte'
    import Stage from '../Stage.svelte'
    import Icon from '../Icon.svelte'
    import Chat from './MassonChat.svelte'
    import Quest from './MassonQuest.svelte'
    import { charMoney, charBankMoney, charLVL, charEXP, charWanted, charFractionID, charOrganizationID, charIsPet } from 'store/chars'
    import { serverDateTime } from 'store/server'
    import { accountVip } from 'store/account'
    import { isHelp, isInputToggled, isPlayer, inVehicle, isPhone } from 'store/hud'
    import { storeSettings } from 'store/settings'
    import keys from 'store/keys'
    import keysName from 'json/keys.js'
    import { itemsInfo } from 'json/itemsInfo.js'
    import { TimeFormat } from 'api/moment'
    import { format } from 'api/formatter'
    import { executeClient } from 'api/rage'
    import markImg from '@/masson/img/masson-mark-256.png'

    export let visible = true;

    // ── Данные от клиента игры (хуки сохранены) ────────────────────────────────
    let serverName = "";
    window.setServerName = (name) => serverName = name;

    let serverPlayerId = 0;
    window.serverStore.serverPlayerId = (value) => serverPlayerId = value;
    let serverOnline = 0;
    window.serverStore.serverOnline = (value) => serverOnline = value;

    let isWorld = true;
    window.hudStore.isWorld = (value) => isWorld = value;
    let direction = "N";
    window.hudStore.direction = (value) => direction = value;
    let street = "";
    window.hudStore.street = (value) => street = value;
    let area = "";
    window.hudStore.area = (value) => area = value;
    let greenZone = false;
    window.hudStore.greenZone = (value) => greenZone = value;

    let microphone = 0;
    window.hudStore.microphone = (value) => microphone = value;
    let isMute = false;
    window.hudStore.isMute = (value) => isMute = value;
    let polygon = 0;
    window.hudStore.polygon = (value) => polygon = value;
    let radio = 0;
    window.hudStore.radio = (value) => radio = value;

    let weaponItemId = 0;
    window.hudStore.weaponItemId = (value) => weaponItemId = value;
    let clipSize = 0;
    window.hudStore.clipSize = (value) => clipSize = value;
    let ammo = 0;
    window.hudStore.ammo = (value) => ammo = value;

    let isHint = false;
    window.hudStore.isHint = (value) => isHint = value;
    let HideHelp = false;
    window.hudStore.HideHelp = (value) => HideHelp = value;

    // транспорт
    let speed = 0, maxSpeed = 100, fuel = 0;
    let belt = false, engine = false, doors = false, cruiseControl = false, autoPilot = false, rightIL = false, leftIL = false;
    let isToggledVehicleHud = true;
    window.vehicleState = {
        speed: (v) => { speed = v; },
        maxSpeed: (v) => { maxSpeed = v * 1.15; },
        fuel: (v) => { fuel = v; },
        autoPilot: (v) => autoPilot = v,
        belt: (v) => belt = v,
        cruiseControl: (v) => cruiseControl = v,
        rightIL: (v) => rightIL = v,
        leftIL: (v) => leftIL = v,
        doors: (v) => doors = v,
        engine: (v) => engine = v,
        isToggledVehicleHud: (v) => isToggledVehicleHud = v,
    };

    // уведомления
    let notifications = [];
    window.notification = (json) => {
        if (json) {
            json = JSON.parse(json);
            for (let i = 0; i < json.length; i++) {
                if (typeof json[i] === "object") json[i].text = format("parse", json[i].text);
            }
        }
        notifications = json || [];
    };
    window.notificationAdd = (type, _, msg, time) => executeClient("notify", type, _, msg, time);
    const dismiss = (index) => executeClient("notifyClear", index);

    // карта: игра рисует нативную миникарту, место под неё выделяем элементом .hudevo__map (ширину задаёт window.hud.updateMapWidth)
    let mapEl;

    // Миникарту рисует игра. Размеры и безопасная зона приходят в пикселях экрана, а сцена HUD масштабируется
    // (1920×1080 → окно), поэтому делим на масштаб. Края HUD следуют безопасной зоне игры, чтобы не расходиться с картой.
    let edgeX = 40, edgeY = 36;
    const stageScale = () => Math.min((window.innerWidth || 1920) / 1920, (window.innerHeight || 1080) / 1080);
    onMount(() => {
        const prevSafe = window.hud && window.hud.updateSafeZone;
        window.hud.updateSafeZone = (screenW, screenH, safeZoneSize, ratio) => {
            if (prevSafe) prevSafe(screenW, screenH, safeZoneSize, ratio);
            const k = ((1.0 - safeZoneSize) * 0.5), s = stageScale();
            edgeX = Math.max(24, Math.round(screenW * k / s));
            edgeY = Math.max(20, Math.round(screenH * k / s));
        };
        window.hud.updateMapWidth = (width) => { if (mapEl) mapEl.style.width = Math.round(width / stageScale()) + "px"; };
        window.hud.updateMapSize = () => {};
    });

    // ── Производные величины ─────────────────────────────────────────────────────
    const maxExp = (lvl) => 3 + lvl * 3;
    $: xpPct = Math.max(0, Math.min(100, ($charEXP * 100) / maxExp($charLVL)));
    $: hasOrg = $charFractionID > 0 || $charOrganizationID > 0;
    $: hour = TimeFormat($serverDateTime, "H:mm");
    $: date = TimeFormat($serverDateTime, "DD.MM.YYYY");
    $: weaponName = (itemsInfo[weaponItemId] && itemsInfo[weaponItemId].Name) || '';
    $: fuelPct = Math.max(0, Math.min(100, Number(fuel) || 0));
    $: speedInt = Math.round(speed);
    $: speedStr = String(Math.max(0, speedInt)).padStart(3, '0');
    $: speedZeros = speedStr.length - String(Math.max(0, speedInt)).length;
    $: arcLen = 2 * Math.PI * 116;
    $: arcFill = arcLen * 0.75 * Math.max(0, Math.min(1, speed / (maxSpeed || 100)));

    // изменение денег — короткая подсказка «+/−»
    let cashDelta = 0, bankDelta = 0, cashT = null, bankT = null, prevCash = null, prevBank = null;
    charMoney.subscribe((v) => {
        if (prevCash !== null && v !== prevCash) { cashDelta = v - prevCash; clearTimeout(cashT); cashT = setTimeout(() => cashDelta = 0, 4000); }
        prevCash = v;
    });
    charBankMoney.subscribe((v) => {
        if (prevBank !== null && v !== prevBank) { bankDelta = v - prevBank; clearTimeout(bankT); bankT = setTimeout(() => bankDelta = 0, 4000); }
        prevBank = v;
    });

    // подсказки клавиш (список взят из прежнего HUD RedAge)
    let hintsOpen = false;
    $: hintList = [
        { icon: 'phone',  label: 'Телефон',            key: keysName[$keys[30]] },
        { icon: 'bag',    label: 'Инвентарь',          key: keysName[$keys[12]] },
        { icon: 'coin',   label: 'Донат',              key: keysName[$keys[21]] },
        { icon: 'mic',    label: 'Говорить',           key: keysName[$keys[36]] },
        ...(hasOrg ? [{ icon: 'radio', label: 'Рация', key: keysName[$keys[50]] }] : []),
        { icon: 'hand',   label: 'Анимации',           key: keysName[$keys[8]] },
        { icon: 'list',   label: 'Биндер',             key: keysName[$keys[43]] },
        { icon: 'eye',    label: 'Указать пальцем',    key: keysName[$keys[45]] },
        { icon: 'eyeoff', label: 'Скрыть HUD',         key: keysName[$keys[27]] },
        { icon: 'bell',   label: 'Скрыть уведомление', key: keysName[$keys[49]] },
    ];

    const toneOf = (type) => type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info';
    const iconOf = (type) => type === 'error' ? 'warn' : type === 'success' ? 'ok' : 'bell';

    $: shown = (notifications && notifications.length) ? notifications.slice(0, Math.max(1, ($storeSettings && $storeSettings.notifCount) || 2)) : [];
</script>

<Stage pointer={false}>
    <div class="hud" class:hud--hidden={!visible} style="--edge-x:{edgeX}px;--edge-y:{edgeY}px">
        <!-- Чат: слева сверху -->
        <Chat />

        <!-- Левый нижний угол: место под миникарту игры, деньги, место и время -->
        <section class="vitals" aria-label="Состояние персонажа">
            <div class="vitals__map"><div class="hudevo__map" bind:this={mapEl}></div></div>
            <div class="vitals__info">
                {#if $isPlayer}
                <div class="card-rows">
                    <div class="row" title="Наличные">
                        <Icon name="cash" /><span>${format("money", $charMoney)}</span>
                        {#if cashDelta !== 0}<span class="delta" class:is-minus={cashDelta < 0}>{cashDelta > 0 ? '+' : '−'}{format("money", Math.abs(cashDelta))}</span>{/if}
                    </div>
                    <div class="row" title="Банк">
                        <Icon name="card" /><span>${format("money", $charBankMoney)}</span>
                        {#if bankDelta !== 0}<span class="delta" class:is-minus={bankDelta < 0}>{bankDelta > 0 ? '+' : '−'}{format("money", Math.abs(bankDelta))}</span>{/if}
                    </div>
                    {#if isWorld}
                        <div class="row"><Icon name="pin" cls="ico--accent" /><span>{street}{street && area ? ' · ' : ''}{area}</span><span class="dir">{direction}</span></div>
                    {/if}
                    <div class="row row--meta"><Icon name="clock" /><span>{hour}</span><i class="sep"></i><Icon name="calendar" /><span>{date}</span></div>
                </div>
                {/if}
                {#if greenZone}
                    <div class="row"><Icon name="shield" cls="ico--accent" /><span><b>Зелёная</b> зона</span></div>
                {/if}
            </div>
        </section>

        <!-- Голос и рация: над миникартой -->
        <div class="voice" aria-label="Голосовой чат">
            <span class="voice__mic" class:is-talking={microphone && !isMute} class:is-muted={isMute} title={isMute ? 'Микрофон отключён' : 'Микрофон'}>
                <Icon name={isMute ? 'eyeoff' : 'mic'} />
            </span>
            {#if polygon}<span class="voice__range" title="Голосовая зона"><Icon name="signal" /></span>{/if}
            {#if radio}<span class="voice__radio"><Icon name="radio" /></span>{/if}
        </div>

        <!-- Правый верхний угол -->
        <section class="topright" aria-label="Сервер и задания">
            <div class="brand"><img class="brand__logo" src={markImg} alt=""><span class="brand__name">Masson RP</span></div>
            <div class="meta">
                <span class="chip" title="Игроков онлайн"><Icon name="users" /><b>{serverOnline}</b></span>
                <span class="chip">ID <b>{serverPlayerId}</b></span>
            </div>
            <div class="level"><span class="level__n">Ур. <b>{$charLVL}</b></span><div class="xp"><i style="--v:{xpPct}"></i></div><span class="level__p">{Math.round(xpPct)}%</span></div>
            <div class="badges">
                {#if $accountVip > 0}<span class="badge badge--vip">VIP</span>{/if}
                {#if $charWanted > 0}<span class="badge badge--wanted">Розыск ★ {$charWanted}</span>{/if}
            </div>
            <Quest />
            <div class="notices" aria-live="polite">
                {#each shown as n, i (n.title + '|' + n.elements + '|' + i)}
                    <div class="notice notice--{toneOf(n.type)} is-in" on:click={() => dismiss(i)}>
                        <span class="notice__icon"><Icon name={iconOf(n.type)} /></span>
                        <div class="notice__body">
                            {#if typeof n.title === 'string' && n.title}<div class="notice__title">{n.title}</div>{/if}
                            <div class="notice__text">{@html n.elements}</div>
                            <span class="notice__timer" style="animation:none;transform:scaleX({(n.percent || 0) / 100});transform-origin:0 50%;transition:transform {n.percent === 0 ? n.timeout : 0}ms linear"></span>
                        </div>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Подсказки клавиш: правый край, по центру -->
        {#if !$charIsPet && $isHelp && !HideHelp}
            <aside class="hints" class:is-collapsed={!hintsOpen} aria-label="Подсказки клавиш">
                <button class="hints__head" aria-expanded={hintsOpen} on:click={() => hintsOpen = !hintsOpen}>
                    <span>{hintsOpen ? 'Скрыть подсказки' : 'Подсказки'}</span><Icon name="chev" cls="hints__chev" />
                </button>
                <div class="hints__list">
                    {#each hintList as h}
                        <div class="hint" title={h.label}><Icon name={h.icon} /><span>{h.label}</span><span class="key">{h.key}</span></div>
                    {/each}
                </div>
            </aside>
        {/if}

        <!-- Оружие: правый низ (пешком) -->
        {#if !$inVehicle && ammo > 0}
            <section class="weapon" aria-label="Оружие">
                <div class="weapon__main">
                    <div class="weapon__info"><div class="weapon__name">{weaponName}</div></div>
                    <div class="weapon__ammo" aria-label="Патроны"><b>{ammo}</b>{#if clipSize > 0 && clipSize < 1000}<span>/<i>{clipSize}</i></span>{/if}</div>
                </div>
            </section>
        {/if}

        <!-- Спидометр: правый низ (в транспорте) -->
        {#if $inVehicle && isToggledVehicleHud}
            <section class="speedo" aria-label="Спидометр">
                <svg class="speedo__arc" viewBox="0 0 264 264" aria-hidden="true">
                    <circle class="speedo__track" cx="132" cy="132" r="116" transform="rotate(135 132 132)"
                            style="stroke-dasharray:{arcLen * 0.75} {arcLen}"/>
                    <circle class="speedo__fill" cx="132" cy="132" r="116" transform="rotate(135 132 132)"
                            style="stroke-dasharray:{arcFill} {arcLen}"/>
                </svg>
                <div class="speedo__body">
                    <div class="speed" aria-live="off"><span class="z">{'0'.repeat(speedZeros)}</span>{String(Math.max(0, speedInt))}</div>
                    <div class="speedo__unit"><span>км/ч</span>
                        {#if cruiseControl || autoPilot}<span class="lim" title="Круиз-контроль">{autoPilot ? 'A' : 'C'}</span>{/if}
                    </div>
                    <div class="signals">
                        <span class="sig" class:is-on={leftIL}><Icon name="back" /></span>
                        <span class="sig" class:is-on={rightIL} style="transform:scaleX(-1)"><Icon name="back" /></span>
                    </div>
                    <div class="status">
                        <span class:is-on={doors} title="Двери закрыты"><Icon name="door" /></span>
                        <span class:is-low={fuelPct <= 20} class:is-on={fuelPct > 20} title="Топливо {fuelPct}"><Icon name="fuel" /></span>
                        <span class:is-on={engine} title="Двигатель"><Icon name="engine" /></span>
                        <span class:is-on={belt} class:is-warn={!belt} title="Ремень безопасности"><Icon name="seatbelt" /></span>
                    </div>
                    <div class="fuelbar" title="Топливо"><i style="width:{fuelPct}%"></i></div>
                </div>
            </section>
        {/if}
    </div>
</Stage>

<style>
    :global(.mp .hud .hudevo__map) { width: var(--minimap-w); height: var(--minimap-h); }
    :global(.mp .hud .vitals__map) { width: auto; }
    :global(.mp .hud.hud--hidden > *:not(.topright)) { display: none !important; }
    :global(.mp .hud.hud--hidden .topright > *:not(.notices)) { display: none !important; }
    :global(.mp .hud .delta) { font-size: 12px; font-weight: 700; color: #ff9ac4; margin-left: 4px; }
    :global(.mp .hud .delta.is-minus) { color: #ff6580; }
    :global(.mp .hud .dir) { margin-left: auto; color: var(--text-muted); font-weight: 700; font-size: 12px; }
    :global(.mp .hud .voice__mic.is-muted .ico) { stroke: #ff6580; }
    :global(.mp .hud .signals) { display: flex; gap: 14px; }
    :global(.mp .hud .sig .ico) { stroke: var(--text-dim); width: 18px; height: 18px; }
    :global(.mp .hud .sig.is-on .ico) { stroke: url(#masson-grad); animation: talk 0.6s ease-in-out infinite; }
    :global(.mp .hud .fuelbar) { width: 160px; height: 4px; border-radius: 2px; background: var(--track-bg); overflow: hidden; margin-top: 2px; }
    :global(.mp .hud .fuelbar i) { display: block; height: 100%; background: var(--accent-gradient); }
    :global(.mp .hud .hint span:nth-child(2)) { flex: 1; margin: 0 10px; }
    :global(.mp .hud .notice) { pointer-events: auto; }
    :global(.mp .hud .hints) { width: 236px; }
</style>
