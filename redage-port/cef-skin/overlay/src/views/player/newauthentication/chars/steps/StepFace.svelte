<script>
    // Черты лица: 11 групп RedAge → 20 осей (9 групп с двумя осями и 2 с одной). Каждая ось — ползунок −100…+100.
    import { gender, customization, updateCharacteristic } from 'store/customization'
    import characteristics from '@/views/player/newauthentication/chars/create/elements/characteristics/characteristics.js'

    const GROUPS = [
        { key: 'brow',        name: 'Лоб',                 x: ['Плоский', 'Выпуклый'],        y: ['Высокий', 'Низкий'] },
        { key: 'eyes',        name: 'Глаза',               x: ['Узкие', 'Широкие'],           y: null },
        { key: 'nose',        name: 'Нос',                 x: ['Узкий', 'Широкий'],           y: ['Кверху', 'Низкий'] },
        { key: 'noseprofile', name: 'Профиль носа',        x: ['Малый', 'Большой'],           y: ['С горбинкой', 'Выгнутый'] },
        { key: 'nosetip',     name: 'Кончик носа',         x: ['Скос влево', 'Скос вправо'],  y: ['Кончик вверх', 'Кончик вниз'] },
        { key: 'cbones',      name: 'Скулы',               x: ['Худые', 'Надутые'],           y: ['Высокие', 'Низкие'] },
        { key: 'cheeks',      name: 'Щёки',                x: ['Худые', 'Надутые'],           y: null },
        { key: 'lips',        name: 'Губы',                x: ['Тонкие', 'Толстые'],          y: null },
        { key: 'jaw',         name: 'Челюсть',             x: ['Узкая', 'Широкая'],           y: ['Круглая', 'Квадратная'] },
        { key: 'chinprofile', name: 'Профиль подбородка',  x: ['Короткий', 'Длинный'],        y: ['Высокий', 'Низкий'] },
        { key: 'chinform',    name: 'Форма подбородка',    x: ['Квадратный', 'Заострённый'],  y: ['Округлый', 'С ямочкой'] },
    ];

    const pct = (v) => Math.round((v || 0) * 100);
    const clamp = (v) => Math.max(-1, Math.min(1, v));

    const setPreset = (key, i) => {
        const p = characteristics[key][i];
        updateCharacteristic($gender, key, i, p.x, p.y);
    };
    const setAxis = (key, axis, value) => {
        const c = $customization[key] || { x: 0, y: 0 };
        const x = axis === 'x' ? clamp(value / 100) : c.x;
        const y = axis === 'y' ? clamp(value / 100) : c.y;
        updateCharacteristic($gender, key, 3, x, y);      // 3 — свои настройки
    };
</script>

<div><div class="h2">Черты лица</div><p class="p" style="margin-top:6px">19 параметров. Выберите заготовку или двигайте ползунки.</p></div>

{#each GROUPS as g}
    {#if $customization[g.key]}
        <div class="grp">
            <div class="grp__h">{g.name}<em>{g.y ? 2 : 1}</em></div>
            <div class="grid g4">
                {#each characteristics[g.key] as p, i}
                    <button class="tile" class:is-active={$customization[g.key].preset === i} on:click={() => setPreset(g.key, i)}>{p.name}</button>
                {/each}
                <button class="tile" class:is-active={$customization[g.key].preset === 3} disabled>Свой</button>
            </div>
            <div class="slider">
                <div class="slider__top"><span>{g.x[0]} — {g.x[1]}</span><output>{pct($customization[g.key].x) > 0 ? '+' : ''}{pct($customization[g.key].x)}</output></div>
                <input type="range" min="-100" max="100" step="1" value={pct($customization[g.key].x)}
                       style="--a:{Math.min(50, (pct($customization[g.key].x) + 100) / 2)}%;--b:{Math.max(50, (pct($customization[g.key].x) + 100) / 2)}%"
                       on:input={(e) => setAxis(g.key, 'x', Number(e.target.value))} aria-label={g.x[0] + ' — ' + g.x[1]} />
            </div>
            {#if g.y}
                <div class="slider">
                    <div class="slider__top"><span>{g.y[0]} — {g.y[1]}</span><output>{pct($customization[g.key].y) > 0 ? '+' : ''}{pct($customization[g.key].y)}</output></div>
                    <input type="range" min="-100" max="100" step="1" value={pct($customization[g.key].y)}
                           style="--a:{Math.min(50, (pct($customization[g.key].y) + 100) / 2)}%;--b:{Math.max(50, (pct($customization[g.key].y) + 100) / 2)}%"
                           on:input={(e) => setAxis(g.key, 'y', Number(e.target.value))} aria-label={g.y[0] + ' — ' + g.y[1]} />
                </div>
            {/if}
        </div>
    {/if}
{/each}
