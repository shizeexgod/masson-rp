<script>
    // Элементы HUD блока B (дизайн hud-extra.html): повышение уровня, подсказки действий, награды и события, захваты и войны, сервис.
    // Хуки RedAge сохранены без изменений: window.updateLevel, window.hudEnter, cef.KeyClamp.*, window.hudItem, window.PayDay,
    // window.updateCase, window.missionComplite, window.updateWin, hud.event / hud.bp.info / hud.award / hud.war.* (addListernEvent),
    // window.kill, window.airsoftFunctions, hud.taxi.updateCounter, window.UpdateButtonText, window.voice.
    import { translateText } from 'lang'
    import Icon from '../Icon.svelte'
    import keys from 'store/keys'
    import keysName from 'json/keys.js'
    import { charLVL, charEXP, charFractionID } from 'store/chars'
    import { serverDateTime } from 'store/server'
    import { TimeFormat, GetTime } from 'api/moment'
    import { format } from 'api/formatter'
    import { addListernEvent } from 'api/functions'
    import { executeClientAsync } from 'api/rage'
    import { typeBattle, composition, weaponsCategory } from '@/popups/war/data'

    // ── Повышение уровня ───────────────────────────────────────────────────────
    let lvlVisible = false, level = -1, maxExp = 0, progress = 0, levelUp = false;
    const GetMaxExp = (lvl) => { maxExp = 3 + lvl * 3; };
    const GetProgress = (exp) => {
        progress = exp * 100 / maxExp;
        if (progress > 100) progress = 100;
        else if (level != $charLVL) progress = 100;
    };
    const onInitLevel = () => {
        if (level === -1) { level = $charLVL; GetMaxExp(level); GetProgress($charEXP); }
    };
    window.updateLevel = async () => {
        onInitLevel();
        levelUp = level != $charLVL;
        lvlVisible = true;
        await window.wait(500);
        GetProgress($charEXP);
        await window.wait(5000);
        lvlVisible = false;
        if (level != $charLVL) {
            level = $charLVL;
            progress = 0;
            GetMaxExp(level);
            await window.wait(250);
            if (window.NewLvl) window.NewLvl();
        }
    };
    $: shownLevel = lvlVisible ? Math.max(level, $charLVL) : level;

    // ── Подсказка «Нажмите E» ──────────────────────────────────────────────────
    const InfoData = {
        Warehouse: 'Открыть склад', DriveSchool: 'Открыть меню автошколы', RentCar: 'Открыть меню аренды', Festive: 'Открыть обмен Coin',
        SaluteShop: 'Открыть магазин фейерверков', BlackMarket: 'Открыть чёрный рынок', TankRoyale: 'Регистрация Tank Royale', Casino: 'Двери в казино',
        Atm: 'Открыть меню банкомата', Electrician: 'Переодеться', Repair: 'Ремонтировать транспорт', SeatingArrangements: 'Взаимодействовать',
        BuyPoints: 'Купить алкоголь', EnterGarage: 'Войти в гараж', ExitGarage: 'Выйти из гаража',
        EnterHouse: [{ text: 'Войти в дом', key: 9 }, { text: 'Открыть/закрыть дом', key: 39 }],
        ExitHouse: 'Выйти из дома', HealkitHouse: 'Использовать аптечку', EnterHotel: 'Войти в отель', ExitHotel: 'Выйти из отеля',
        CarRentHotel: 'Арендовать скутер', FractionCityhallBeginWorkDay: 'Раздевалка CityHall', FractionCityhallGunMenu: 'Оружейный склад CityHall',
        JobGoPosta: 'Начать работу почтальона', JobGoPostaCar: 'Взять рабочий транспорт', TakeMoney: 'Взять мешок с деньгами',
        ChangeAutoNumber: 'Открыть меню смены номеров', ElectionPoint: 'Открыть меню выборов', Bear: 'Поднять мишку', BoatFix: 'Починить лодку',
        buyMetro: 'Купить билет', exitMetro: 'Для выхода', Seating: 'Чтобы сесть', SeatingUp: 'Встать',
    };
    let enter = false;
    window.hudEnter = (text) => {
        if (text === -1) enter = false;
        else enter = InfoData[text] ? InfoData[text] : 'Нажмите для взаимодействия';
    };

    // ── Удержание клавиши ──────────────────────────────────────────────────────
    let clampOn = false, clampKey = 0, clampProgress = 0;
    const OpenClamp = (code) => { clampKey = code; clampProgress = 0; clampOn = true; };
    const UpdateClamp = (value) => { clampProgress = Math.max(0, Math.min(100, value)); };
    const CloseClamp = () => { clampOn = false; };
    window.events.addEvent("cef.KeyClamp.open", OpenClamp);
    window.events.addEvent("cef.KeyClamp.updateProgress", (v) => UpdateClamp(v));
    window.events.addEvent("cef.KeyClamp.close", CloseClamp);

    // ── Найденный предмет ──────────────────────────────────────────────────────
    let dropVisible = false, dropName = '', dropCount = 0, dropText = '', dropAdd = false, dropTimer = 0;
    const Bool = (text) => String(text).toLowerCase() === "true";
    window.hudItem = {
        drop: (itemId, amount, Data, _isAdd = false) => {
            if (dropTimer) clearTimeout(dropTimer);
            const info = window.getItem(itemId);
            dropCount = amount;
            dropName = info.Name;
            if (info.functionType == 1 && itemId != -5 && itemId != -9 && itemId != -1 && Data.split("_").length >= 2) dropName += Bool(Data.split("_")[2]) ? " (М)" : " (Ж)";
            else if (info.functionType == 2) dropName += ` (${Data})`;
            else if (itemId == -9) dropName += ` (x${Data})`;
            else if (itemId == 19 && Data.split('_').length > 0) dropName += ` (${Data.split('_')[0]})`;
            dropText = info.Description;
            dropAdd = _isAdd;
            dropVisible = true;
            dropTimer = setTimeout(() => { dropTimer = 0; dropVisible = false; }, 5000);
        },
        dropFocus: () => {
            if (dropTimer) clearTimeout(dropTimer);
            dropTimer = setTimeout(() => { dropTimer = 0; dropVisible = false; }, 500);
        },
    };

    // ── Чек зарплаты ──────────────────────────────────────────────────────────
    let cashValue = 0;
    window.PayDay = async (cash) => {
        cashValue = cash;
        if (cashValue > 0) {
            window.hudStore.HideHelp(true);
            await window.wait(5000);
            window.hudStore.HideHelp(false);
            cashValue = 0;
        } else {
            window.hudStore.HideHelp(false);
        }
    };
    const FractionTypes = { 0: -1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 2, 10: 0, 11: 0, 12: 0, 13: 0, 14: 2, 15: 2, 16: 4, 17: 3, 18: 2 };
    $: isWork = FractionTypes[$charFractionID] === 2 || FractionTypes[$charFractionID] === 3;

    // ── Подарок-кейс ──────────────────────────────────────────────────────────
    const caseData = [{ hour: '3 часа' }, { hour: '5 часов' }, { hour: '8 часов' }];
    let isCase = false, caseId = -1;
    window.updateCase = (_caseId) => {
        if (caseId === _caseId) return;
        isCase = true; caseId = _caseId;
        setTimeout(() => { isCase = false; }, 1000 * 30);
    };

    // ── Задание выполнено / победитель ─────────────────────────────────────────
    let qOpen = false, qTitle = '', qDesc = '', qTimer = 0;
    window.missionComplite = (_title, _desc, _header, _image) => {
        qTitle = _title; qDesc = _desc; qOpen = true;
        if (qTimer != 0) clearTimeout(qTimer);
        qTimer = setTimeout(() => { qOpen = false; qTimer = 0; }, 5000);
    };
    let wOpen = false, wTitle = '', wDesc = '', wTimer = 0;
    window.updateWin = (_title, _name, _image, _desc) => {
        wTitle = _title; wDesc = _desc; wOpen = true;
        if (wTimer != 0) clearTimeout(wTimer);
        wTimer = setTimeout(() => { wOpen = false; wTimer = 0; }, 5000);
    };

    // ── Событие, боевой пропуск, награда недели ───────────────────────────────
    let evVisible = false, evSub = '', evTitle = '', evDesc = '';
    addListernEvent("hud.event", (_visible, _subTitle, _title, _desc, _image) => {
        if (_visible) { evSub = _subTitle; evTitle = _title; evDesc = _desc; }
        evVisible = _visible;
    });
    let bpVisible = false;
    addListernEvent("hud.bp.info", (_visible) => { bpVisible = _visible; });
    let award = {}, awardVisible = false;
    addListernEvent("hud.award", (_visible, _award) => {
        if (_visible) award = JSON.parse(_award);
        awardVisible = _visible;
    });

    // ── Захват и войны ────────────────────────────────────────────────────────
    let capt = { visible: false, warGripType: 0, weaponType: 0, title: '', time: '', attackName: '', protectingName: '', attackingCount: 0, protectingCount: 0, attackingZone: 0, protectingZone: 0 };
    addListernEvent("hud.war.open", (_warType, _warGripType, _weaponType, _title, _attackName, _protectingName) => {
        capt = { ...capt, weaponType: _weaponType, warGripType: _warGripType, title: _title, attackName: _attackName, protectingName: _protectingName, visible: true };
    });
    addListernEvent("hud.war.update", (type, value1, value2) => {
        if (type === "count") capt = { ...capt, attackingCount: value1, protectingCount: value2 };
        if (type === "playersCount") capt = { ...capt, attackingZone: value1, protectingZone: value2 };
        if (type === "time") capt = { ...capt, time: value1 };
    });
    addListernEvent("hud.war.close", () => {
        capt = { ...capt, visible: false, attackingZone: 0, protectingZone: 0, attackingCount: 0, protectingCount: 0 };
    });
    $: captTotal = capt.attackingCount + capt.protectingCount;
    $: captPct = captTotal ? Math.round(100 / captTotal * capt.protectingCount) : 50;

    let warInfo = { visible: false, isAttack: false, mapName: '', type: 0, time: '', comp: 0, weapons: 0 };
    addListernEvent("hud.war.info", (_visible, _isAttack, _mapName, _selectTypeBattle, _time, _selectComposition, _selectWeaponsCategory) => {
        if (_visible) warInfo = { visible: true, isAttack: _isAttack, mapName: _mapName, type: _selectTypeBattle, time: _time, comp: _selectComposition, weapons: _selectWeaponsCategory };
        else warInfo = { ...warInfo, visible: false };
    });

    let biz = { visible: false, timerStatus: false, gameName: 'Командный бой', timer: false, stats: [] };
    window.airsoftFunctions = (state, data) => {
        if (state == 0) biz = { ...biz, visible: false, timerStatus: false, stats: [] };
        else if (state == 1) biz = { ...biz, visible: true, timerStatus: true, gameName: 'Командный бой', stats: JSON.parse(data) };
        else if (state == 2) { const stats = JSON.parse(data); biz = { ...biz, visible: true, timerStatus: true, stats, gameName: `GunGame (${stats[3] ? stats[3].score : 0} lvl)` }; }
        else if (state == 3) biz = { ...biz, visible: true, timerStatus: true, timer: ((Math.floor(data / 60) < 10 ? '0' : '') + Math.floor(data / 60) + ':' + (data % 60 < 10 ? '0' : '') + data % 60) };
        else if (state == 4) biz = { ...biz, visible: true, timerStatus: false, gameName: 'Битва за Airdrop', stats: JSON.parse(data) };
    };

    let kills = [];
    window.kill = {
        show: (killName, Icon, Name, kColor, vColor) => {
            kills.unshift({ killName, Icon, Name, killerColor: kColor, victimColor: vColor });
            if (kills.length > 4) kills.splice(5, 1);
            kills = kills;
        },
        clear: () => { kills = []; },
    };

    // ── Сервис ────────────────────────────────────────────────────────────────
    let isTaxiCounter = false;
    window.hudStore.isTaxiCounter = (value) => isTaxiCounter = value;
    let selectTaxi = {};
    const getCounter = () => {
        executeClientAsync("phone.taxi.getCounter").then((result) => {
            if (result && typeof result === "string") selectTaxi = JSON.parse(result);
        });
    };
    addListernEvent("hud.taxi.updateCounter", getCounter);

    let restartText = '';
    window.UpdateButtonText = (_iconData, _text) => { restartText = _text || ''; };

    let radioPlayers = [];
    window.voice = {
        add: (name, id) => {
            const index = radioPlayers.findIndex(r => r.id == id);
            if (!radioPlayers[index]) radioPlayers = [...radioPlayers, { id, name, toggled: true }];
        },
        dell: async (id) => {
            const index = radioPlayers.findIndex(r => r.id == id);
            if (radioPlayers[index]) {
                radioPlayers[index].toggled = false;
                await window.wait(500);
                radioPlayers.splice(index, 1);
                radioPlayers = radioPlayers;
            }
        },
    };
    const initials = (n) => (n || '?').split(/[\s_]+/).map(s => s[0] || '').join('').slice(0, 2).toUpperCase();
</script>

<!-- Повышение уровня -->
{#if lvlVisible}
    <div class="hx hx-c hx-level" style="--w:560px;top:100px">
        <div class="hx__row">
            <div class="hx-level__lvl"><div><small>УРОВЕНЬ</small>{shownLevel}</div></div>
            <div class="hx__grow">
                <div class="hx__eyebrow">{levelUp ? 'Повышение уровня' : 'Опыт'}</div>
                <div class="hx__t" style="font-size:22px">{levelUp ? `Вы достигли ${$charLVL} уровня!` : 'Вы стали опытнее'}</div>
                <div class="hx__s">До следующего уровня осталось {Math.max(0, maxExp - $charEXP)} опыта</div>
            </div>
        </div>
        <div class="prog" style="--v:{progress}"><i></i></div>
    </div>
{/if}

<!-- Подсказки действий -->
{#if enter}
    {#if typeof enter === 'string'}
        <div class="hx-prompt" style="left:50%;margin-left:-150px;bottom:190px"><div class="hx-keycap">{keysName[$keys[9]]}</div><div><div class="hx-prompt__t">{enter}</div></div></div>
    {:else}
        {#each enter as item, i}
            <div class="hx-prompt" style="left:50%;margin-left:-150px;bottom:{190 + i * 66}px"><div class="hx-keycap">{keysName[$keys[item.key]]}</div><div><div class="hx-prompt__t">{item.text}</div></div></div>
        {/each}
    {/if}
{/if}
{#if clampOn}
    <div class="hx-prompt" style="left:50%;margin-left:-150px;bottom:190px">
        <div class="hx-keycap hx-keycap--ring" style="--p:{clampProgress}"><span class="hx-ring" style="--p:{clampProgress}"></span>{keysName[clampKey]}</div>
        <div><div class="hx-prompt__t">Зажмите кнопку</div><div class="hx-prompt__s">{Math.round(clampProgress)}%</div></div>
    </div>
{/if}
{#if dropVisible}
    <div class="hx hx-c" style="--w:520px;bottom:120px">
        <div class="hx__row">
            <div class="hx__ico"><Icon name="box" /></div>
            <div class="hx__grow"><div class="hx__t">{dropName}{#if dropCount > 1} · {dropCount} шт.{/if}</div><div class="hx__s">{dropText}</div></div>
            {#if !dropAdd}<span class="hx-keycap" style="width:auto;padding:0 12px;font-size:14px">{keysName[$keys[32]]}</span>{/if}
        </div>
        {#if !dropAdd}<div class="hx-hint"><span><b>{keysName[$keys[32]]}</b>Поднять</span></div>{/if}
    </div>
{/if}

<!-- Награды и события -->
{#if cashValue > 0}
    <div class="hx hx-r hx-check" style="top:420px">
        <div class="hx__eyebrow">Чек · #{Math.round(GetTime().unix() / 1000)} · {TimeFormat($serverDateTime, "H:mm")}</div>
        <div class="hx-kv"><span>{isWork ? 'Зарплата' : 'Пособие по безработице'}</span><b>${format("money", cashValue)}</b></div>
    </div>
{/if}
{#if isCase}
    <div class="hx hx-r" style="top:330px"><div class="hx__row"><div class="hx__ico"><Icon name="gift" /></div><div class="hx__grow"><div class="hx__t">Бесплатный кейс</div><div class="hx__s">За {caseData[caseId] ? caseData[caseId].hour : ''}</div></div></div></div>
{/if}
{#if qOpen}
    <div class="hx hx-r" style="top:330px"><div class="hx__row"><div class="hx__ico"><Icon name="check" /></div><div class="hx__grow"><div class="hx__t">{qTitle}</div><div class="hx__s">{qDesc}</div></div></div></div>
{/if}
{#if wOpen}
    <div class="hx hx-c hx-winner" style="--w:460px;top:100px"><div class="hx__ico" style="width:56px;height:56px;border-radius:18px"><Icon name="trophy" /></div><div class="hx__eyebrow">{wDesc}</div><div class="hx-winner__n">{wTitle}</div></div>
{/if}
{#if evVisible}
    <div class="hx hx-c hx-banner" style="--w:640px;top:340px"><div class="hx__row"><div class="hx__ico"><Icon name="megaphone" /></div><div class="hx__grow"><div class="hx__eyebrow">{evSub}</div><div class="hx__t">{evTitle}</div><div class="hx__s">{evDesc}</div></div></div></div>
{/if}
{#if bpVisible}
    <div class="hx hx-l" style="left:var(--edge-x);top:560px;width:340px"><div class="hx__row"><div class="hx__ico"><Icon name="crown" /></div><div class="hx__grow"><div class="hx__eyebrow">Боевой пропуск</div><div class="hx__t">Новый сезон уже в игре</div><div class="hx__s">Откройте меню игрока, чтобы посмотреть награды</div></div></div></div>
{/if}
{#if awardVisible}
    <div class="hx hx-r" style="top:330px"><div class="hx__row"><div class="hx__ico"><Icon name="gift" /></div><div class="hx__grow"><div class="hx__eyebrow">Награда недели</div><div class="hx__t">Отыграйте 70 часов за неделю</div><div class="hx__s">{award.desc}</div></div></div></div>
{/if}

<!-- Захват и войны -->
{#if capt.visible}
    <div class="hx hx-c hx-capt" style="--w:640px;top:100px">
        <div class="hx__row" style="justify-content:space-between"><span class="hx__eyebrow">{capt.title}</span><span class="hx__chip hx-num">{capt.time}</span></div>
        <div class="hx-capt__score">
            <div class="hx-team"><span class="hx__ico" style="width:36px;height:36px;border-radius:12px"><Icon name="flag" /></span>{capt.protectingName}</div>
            <div style="display:flex;gap:14px;align-items:center"><span class="hx-team__n">{capt.protectingCount}</span><span style="color:var(--text-muted)">:</span><span class="hx-team__n">{capt.attackingCount}</span></div>
            <div class="hx-team hx-team--r">{capt.attackName}<span class="hx__ico" style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#c46bf0,#7b86ff)"><Icon name="flag" /></span></div>
        </div>
        <div class="hx-tug" style="--v:{captPct}%"></div>
        <div class="hx__s" style="display:flex;justify-content:space-between"><span>В зоне: {capt.protectingZone}</span><span>{typeBattle[capt.warGripType]}, {weaponsCategory[capt.weaponType]}</span><span>В зоне: {capt.attackingZone}</span></div>
    </div>
{/if}
{#if warInfo.visible}
    <div class="hx hx-l" style="top:300px;width:320px">
        <div class="hx__eyebrow">Война за влияние</div>
        <div class="hx__t">{warInfo.isAttack ? 'Вы забили войну' : 'Вам забили войну'}</div>
        {#if warInfo.mapName && warInfo.mapName.length > 1}<div class="hx-kv"><span>Зона</span><b>{warInfo.mapName}</b></div>{/if}
        <div class="hx-kv"><span>Тип битвы</span><b>{typeBattle[warInfo.type]}</b></div>
        <div class="hx-kv"><span>Время</span><b>{warInfo.time}</b></div>
        <div class="hx-kv"><span>Количество</span><b>{warInfo.comp == -1 ? composition[0] : composition[warInfo.comp]}</b></div>
        <div class="hx-kv"><span>Оружие</span><b>{weaponsCategory[warInfo.weapons]}</b></div>
    </div>
{/if}
{#if biz.visible}
    <div class="hx hx-l" style="top:520px;width:320px">
        <div class="hx__row"><div class="hx__ico"><Icon name="coin" /></div><div class="hx__grow"><div class="hx__eyebrow">{biz.gameName}</div>{#if biz.timer}<div class="hx__t">{biz.timer}</div>{/if}</div></div>
        {#each biz.stats as st}
            {#if st !== undefined}<div class="hx-kv"><span>{st.name}</span><b>{st.score}</b></div>{/if}
        {/each}
    </div>
{/if}
{#if kills.length}
    <div class="hx-kill" style="top:200px">
        {#each kills as k}
            <div class="hx-kill__row">
                {#if k.killName.length > 2}<span style="color:{k.killerColor || 'inherit'}">{k.killName}</span>{/if}
                <Icon name="gun" />
                <span style="color:{k.victimColor || 'inherit'}">{k.Name}</span>
            </div>
        {/each}
    </div>
{/if}

<!-- Сервис -->
{#if isTaxiCounter && selectTaxi}
    <div class="hx hx-r hx-taxi" style="top:420px">
        <div class="hx__row" style="justify-content:flex-end"><span class="hx__eyebrow">Счётчик включён</span><Icon name="taxi" /></div>
        <div class="hx-taxi__p">${format("money", selectTaxi.price || 0)}</div>
    </div>
{/if}
{#if restartText && restartText.length > 1}
    <div class="hx hx-c hx-restart" style="--w:560px;top:100px"><div class="hx__row"><div class="hx__ico"><Icon name="warn" /></div><div class="hx__grow"><div class="hx__t">{restartText}</div></div></div></div>
{/if}
{#if radioPlayers.length}
    <div class="hx hx-l" style="left:var(--edge-x);top:620px;width:300px">
        <div class="hx__row"><div class="hx__ico"><Icon name="radio" /></div><div class="hx__grow"><div class="hx__eyebrow">Рация</div></div></div>
        {#each radioPlayers as p}
            <div class="hx__row"><span class="hx-av" class:hx-av--on={p.toggled}>{initials(p.name)}</span><span class="hx__t" style="font-size:13px">{p.name}</span>
                {#if p.toggled}<span class="hx-eq" style="margin-left:auto"><i></i><i></i><i></i></span>{/if}</div>
        {/each}
    </div>
{/if}
