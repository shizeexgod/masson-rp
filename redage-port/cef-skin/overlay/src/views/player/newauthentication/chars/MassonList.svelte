<script>
    // Список слотов персонажей (левая колонка) + карточка выбранного: статистика, выбор места входа, «Играть», удаление.
    import { onMount, onDestroy, createEventDispatcher } from 'svelte'
    import { executeClient } from 'api/rage'
    import { accountData } from 'store/account'
    import { selectChar, selectType, selectIndex, settings } from './store.js'
    import { updateIndex, updateGender } from 'store/customization'
    import { format } from 'api/formatter'
    import fraction from 'json/fraction.js'
    import moment from 'moment'
    import { setTime, elapsed } from 'api/moment'
    import Icon from '@/masson/Icon.svelte'

    const dispatch = createEventDispatcher();

    const SLOTS = [0, 1, 2];                 // показываем три слота, как в RedAge
    const AUTO_SPAWN_SECONDS = 10;           // автоматический вход на последнем персонаже

    $: slots = $accountData.charsSlot || [];
    $: chars = $accountData.chars || {};

    const charOf = (i) => {
        const id = slots[i];
        if (id >= 0 && chars[id] && chars[id].Data) return chars[id];
        return null;
    };
    const kindOf = (i) => {
        if (charOf(i)) return 'char';
        if (slots[i] === -1) return 'free';
        if (slots[i] === -2) return 'locked';
        return 'none';
    };

    // ── Выбор слота ──────────────────────────────────────────────────────────────
    let autoLeft = 0;                        // секунды до автовхода (0 — таймер выключен)
    let autoTimer = null;
    let autoUuid = -1;

    const stopAuto = () => {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
        autoLeft = 0;
        autoUuid = -1;
    };
    const startAuto = (uuid) => {
        stopAuto();
        autoUuid = uuid;
        autoLeft = AUTO_SPAWN_SECONDS;
        autoTimer = setInterval(() => {
            autoLeft -= 1;
            if (autoLeft <= 0) {
                const u = autoUuid;
                stopAuto();
                if (u !== -1) executeClient("client:OnSelectCharacterv2", u, 0);
            }
        }, 1000);
    };

    let spawnId = 0;                         // 0 — место выхода, 1 — фракция/организация, 2 — дом
    let delOpen = false, delName = '';
    let buyOpen = false;

    const select = (i, fromAuto = false) => {
        const kind = kindOf(i);
        if (kind === 'none') return;
        if (i !== $selectIndex) { spawnId = 0; delOpen = false; buyOpen = false; }
        if (!fromAuto) stopAuto();
        selectIndex.set(i);
        updateIndex(i);                      // камера игры показывает модель выбранного слота
        if (kind === 'char') { selectType.set(settings.char); selectChar.set(charOf(i)); }
        else if (kind === 'free') selectType.set(settings.create);
        else selectType.set(settings.buy);
        if (kind === 'char' && charOf(i).Data.DeleteData !== '-') setTime(charOf(i).Data.DeleteData);
        else setTime(false);
    };

    // первичный выбор и повторный, если слот пропал (удаление персонажа)
    let initialised = false;
    $: if (slots.length) ensureSelection($accountData);

    function ensureSelection(acc) {
        const cur = $selectIndex;
        const valid = cur >= 0 && kindOf(cur) !== 'none' &&
            ((kindOf(cur) === 'char') === ($selectType === settings.char));
        if (initialised && valid) {
            // данные выбранного персонажа могли обновиться (удаление, бан)
            if (kindOf(cur) === 'char') selectChar.set(charOf(cur));
            return;
        }
        let idx = SLOTS.find(i => { const c = charOf(i); return c && c.Data.UUID === acc.LastSelectCharUUID && c.Data.DeleteData === '-'; });
        let auto = idx !== undefined;
        if (idx === undefined) idx = SLOTS.find(i => charOf(i));
        if (idx === undefined) idx = SLOTS.find(i => kindOf(i) === 'free');
        if (idx === undefined) return;
        initialised = true;
        select(idx, true);
        if (auto) startAuto(charOf(idx).Data.UUID);
    }

    // любое действие игрока отменяет автовход
    const cancelAuto = () => { if (autoTimer) stopAuto(); };

    onMount(() => { /* состояние создаётся реактивно */ });
    onDestroy(stopAuto);

    // ── Данные выбранного персонажа ─────────────────────────────────────────────
    $: sel = $selectIndex >= 0 ? charOf($selectIndex) : null;
    $: data = sel ? sel.Data : null;
    $: ban = sel && sel.ban && sel.ban.Reason ? sel.ban : null;
    $: pendingDelete = data && data.DeleteData && data.DeleteData !== '-';
    $: hasOrg = data && (data.FractionID > 0 || data.OrganizationID > 0);
    $: hasHouse = data && data.houseId !== '-' && data.houseId !== undefined && data.houseId !== null;
    $: if (data && ((spawnId === 1 && !hasOrg) || (spawnId === 2 && !hasHouse))) spawnId = 0;

    const maxExp = (lvl) => 3 + lvl * 3;
    const expPct = (d) => Math.max(0, Math.min(100, d.EXP * 100 / maxExp(d.LVL)));
    const initials = (d) => ((d.FirstName || '?')[0] + (d.LastName || '')[0]).toUpperCase();
    const orgName = (d) => d.FractionID > 0 ? (fraction[d.FractionID] || '—') : '—';

    const canPlay = () => data && !ban && !pendingDelete;
    const play = () => {
        if (!canPlay()) return;
        stopAuto();
        executeClient("client:OnSelectCharacterv2", data.UUID, spawnId);
    };

    // ── Удаление ────────────────────────────────────────────────────────────────
    $: fullName = data ? (data.FirstName + ' ' + data.LastName) : '';
    $: delOk = delName.trim().toLowerCase() === fullName.toLowerCase();

    const askDelete = () => { stopAuto(); delName = ''; delOpen = true; };
    const doDelete = () => {
        if (!delOk || $selectIndex > 2) return;
        if (!window.loaderData.delay("delete", 5)) return;
        delOpen = false;
        executeClient("client.char.delete", $selectIndex);
    };
    const cancelDelete = () => {
        if (!window.loaderData.delay("delete", 5)) return;
        executeClient("client.char.delete", $selectIndex);
    };

    // ── Создание ────────────────────────────────────────────────────────────────
    const openCreate = (i) => {
        select(i);
        updateGender(i, true);
        dispatch('create');
    };

    // ── Слот разблокировки ──────────────────────────────────────────────────────
    const doBuy = () => { buyOpen = false; executeClient('buyNewSlot', $selectIndex); };

    // ── Клавиатура ──────────────────────────────────────────────────────────────
    const spawnOptions = () => [0, hasOrg ? 1 : -1, hasHouse ? 2 : -1].filter(x => x >= 0);
    const onKeyUp = (event) => {
        cancelAuto();
        if (delOpen || buyOpen) { if (event.keyCode === 27) { delOpen = false; buyOpen = false; } return; }
        if (!data || kindOf($selectIndex) !== 'char') return;
        const o = spawnOptions();
        const at = o.indexOf(spawnId);
        if (event.keyCode === 13) play();
        else if (event.keyCode === 37 && o.length) spawnId = o[(at - 1 + o.length) % o.length];
        else if (event.keyCode === 39 && o.length) spawnId = o[(at + 1) % o.length];
    };

    const MouseUse = (toggled) => executeClient("client.camera.toggled", toggled);
</script>

<svelte:window on:keyup={onKeyUp} on:mouseup={cancelAuto} />

<section class="ch__col" aria-label="Персонажи"
         on:mouseenter={() => MouseUse(false)} on:mouseleave={() => MouseUse(true)}>
    <div class="ch__title"><div class="eyebrow">Аккаунт</div><h1 class="h1">Ваши персонажи</h1></div>

    {#each SLOTS as i (i)}
        {#if kindOf(i) === 'char'}
            {@const d = charOf(i).Data}
            {@const picked = $selectIndex === i}
            <div class="card panel slot-c" class:is-selected={picked} tabindex="0" role="button" aria-selected={picked}
                 on:click={() => select(i)} on:keydown={(e) => { if (e.key === ' ') { e.preventDefault(); select(i); } }}>
                <div class="slot-c__head">
                    <span class="ava">{initials(d)}</span>
                    <div class="grow">
                        <div class="slot-c__name">{d.FirstName} {d.LastName}</div>
                        <div class="slot-c__sub">Слот {i + 1}</div>
                    </div>
                    <span class="bdg bdg--accent">Уровень {d.LVL}</span>
                </div>

                {#if picked}
                    <div class="prog" title="Опыт {d.EXP} / {maxExp(d.LVL)}"><i style="--v:{expPct(d)}"></i></div>
                    <div class="stats">
                        <div class="stat"><span class="stat__k">Наличные</span><span class="stat__v">${format("money", d.Money)}</span></div>
                        <div class="stat"><span class="stat__k">Банк</span><span class="stat__v">${format("money", d.BankMoney)}</span></div>
                        <div class="stat"><span class="stat__k">Фракция</span><span class="stat__v">{orgName(d)}</span></div>
                        <div class="stat"><span class="stat__k">Опыт</span><span class="stat__v">{d.EXP} / {maxExp(d.LVL)}</span></div>
                    </div>

                    {#if ban}
                        <div class="alert alert--danger"><Icon name="ban" />
                            <span><b>Персонаж заблокирован.</b> {ban.Reason}<br>
                            <span class="p">Администратор: {ban.Admin} · с {ban.Time} до {ban.Until}</span></span></div>
                    {:else if pendingDelete}
                        <div class="alert alert--warn"><Icon name="trash" />
                            <span>Удалится через {moment.utc($elapsed).format("DD") - 1} дн. {moment.utc($elapsed).format("HH")} ч. {moment.utc($elapsed).format("mm")} мин.</span></div>
                        <button class="btn btn--lg btn--block" on:click|stopPropagation={cancelDelete}>Отменить удаление</button>
                    {:else}
                        <div class="grid g3" role="radiogroup" aria-label="Где войти в игру">
                            <button class="tile" class:is-active={spawnId === 0} on:click|stopPropagation={() => spawnId = 0}><Icon name="pin" />Место выхода</button>
                            <button class="tile" class:is-active={spawnId === 2} disabled={!hasHouse} class:is-disabled={!hasHouse}
                                    title={hasHouse ? '' : 'У персонажа нет дома'} on:click|stopPropagation={() => spawnId = 2}><Icon name="home" />Дома</button>
                            <button class="tile" class:is-active={spawnId === 1} disabled={!hasOrg} class:is-disabled={!hasOrg}
                                    title={hasOrg ? '' : 'Персонаж не состоит во фракции'} on:click|stopPropagation={() => spawnId = 1}><Icon name="flag" />Во фракции</button>
                        </div>
                        {#if spawnId !== 0}
                            <p class="p" style="font-size:12px">При входе здесь вы потеряете нелегальные предметы.</p>
                        {/if}
                        <div class="ch__actions">
                            <button class="btn btn--primary btn--lg" on:click|stopPropagation={play}>
                                <Icon name="play" />Играть{autoLeft > 0 && autoUuid === d.UUID ? ' · ' + autoLeft + ' с' : ''}
                            </button>
                            {#if i <= 2}
                                <button class="btn btn--danger btn--lg btn--icon" aria-label="Удалить персонажа" title="Удалить"
                                        on:click|stopPropagation={askDelete}><Icon name="trash" /></button>
                            {/if}
                        </div>
                    {/if}
                {/if}
            </div>
        {:else if kindOf(i) === 'free'}
            <button class="card card--hover slot-c slot-c--free" on:click={() => openCreate(i)}>
                <span class="ava ava--mute"><Icon name="plus" /></span>
                <span><div class="slot-c__name">Создать персонажа</div><div class="slot-c__sub">Слот {i + 1} свободен</div></span>
            </button>
        {:else if kindOf(i) === 'locked' && i === 2}
            <button class="card slot-c slot-c--free slot-c--locked" class:is-selected={$selectIndex === i}
                    on:click={() => { select(i); buyOpen = true; }}>
                <span class="ava ava--mute"><Icon name="lock" /></span>
                <span><div class="slot-c__name">Слот закрыт</div><div class="slot-c__sub">Слот {i + 1} · можно разблокировать</div></span>
                <span class="bdg bdg--accent" style="margin-left:auto">Открыть</span>
            </button>
        {/if}
    {/each}
</section>

<div class="ch__stage" aria-hidden="true"><div class="ch__spot"></div><div class="ch__ring"></div></div>

{#if delOpen && data}
    <div class="scrim">
        <div class="modal panel" role="alertdialog" aria-modal="true" aria-labelledby="mt">
            <div class="modal__ico"><Icon name="trash" /></div>
            <h2 class="h2" id="mt">Удалить персонажа?</h2>
            <p class="p" style="margin-top:8px">Персонаж <b style="color:var(--text)">{fullName}</b> будет удалён через несколько дней, удаление можно отменить до этого срока.
                Для подтверждения введите имя и фамилию.</p>
            <label class="field" style="margin-top:20px"><span class="field__label">Имя и фамилия</span>
                <span class="input"><input type="text" placeholder={fullName} bind:value={delName} autocomplete="off" spellcheck="false"></span></label>
            <div class="modal__actions">
                <button class="btn" on:click={() => delOpen = false}>Отмена</button>
                <button class="btn btn--danger" class:is-disabled={!delOk} disabled={!delOk} on:click={doDelete}>Удалить</button>
            </div>
        </div>
    </div>
{/if}

{#if buyOpen}
    <div class="scrim">
        <div class="modal panel" role="alertdialog" aria-modal="true">
            <div class="modal__ico"><Icon name="lock" /></div>
            <h2 class="h2">Разблокировать слот?</h2>
            <p class="p" style="margin-top:8px">Откроется ещё один слот для персонажа. Стоимость спишет сервер.</p>
            <div class="modal__actions">
                <button class="btn" on:click={() => buyOpen = false}>Отмена</button>
                <button class="btn btn--primary" on:click={doBuy}>Разблокировать</button>
            </div>
        </div>
    </div>
{/if}
