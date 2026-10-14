<script>
    // Внешность: причёска, брови, борода, кожа, глаза, макияж. Данные и обновления — как в RedAge (updateAppearance).
    import { gender, customization, updateAppearance } from 'store/customization'
    import appearances from '@/views/player/newauthentication/chars/create/elements/appearance/appearances.js'

    const hairColors = [
        "#201c19", "#362f29", "#4c392e", "#462319", "#773923", "#6c2516", "#a95e37", "#a86b45", "#a56f48", "#a8754f",
        "#bd925f", "#d2ad78", "#ddb26a", "#d6aa6a", "#b98557", "#8e4b2f", "#8d3323", "#7d1714", "#8e1a14", "#e14e28",
        "#c25732", "#c74e2d", "#ad917b", "#c7ac92",
    ];
    // id цвета в игре, а не порядковый номер (как в исходных списках RedAge)
    const hairIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27];
    const lipColors = ["#992532", "#c9395d", "#bd516b", "#b8637a", "#a6526a", "#b1434c", "#803136", "#a6625f", "#c18779", "#cc9f99", "#c7918f", "#ab6f64",
        "#af6051", "#a84c33", "#b67078", "#ca7f93", "#ec9cbf", "#e476a5", "#de3d81", "#b44c6f", "#71263a", "#71263a", "#aa2230", "#dd2034"];

    const colors = (arr, ids) => arr.map((hex, i) => ({ id: ids ? ids[i] : i, hex }));

    const COMPONENTS = [
        { key: 'hair',          title: 'Причёска',          only: 'all', colors: colors(hairColors, hairIds) },
        { key: 'eyebrows',      title: 'Брови',             only: 'all', opacity: true, colors: colors(hairColors, hairIds) },
        { key: 'facialhair',    title: 'Борода',            only: true,  opacity: true, colors: colors(hairColors, hairIds), lockZero: true },
        { key: 'blemishes',     title: 'Дефекты кожи',      only: 'all', opacity: true, lockZero: true },
        { key: 'ageing',        title: 'Старение кожи',     only: 'all', opacity: true, lockZero: true },
        { key: 'complexion',    title: 'Тип кожи',          only: 'all', opacity: true, lockZero: true },
        { key: 'molesfreckles', title: 'Родинки и веснушки', only: 'all', opacity: true, lockZero: true },
        { key: 'sundamage',     title: 'Повреждение кожи',  only: 'all', opacity: true, lockZero: true },
        { key: 'eyescolor',     title: 'Цвет глаз',         only: 'all' },
        { key: 'lipstick',      title: 'Помада',            only: false, opacity: true, colors: colors(lipColors), lockZero: true },
    ];

    $: list = COMPONENTS.filter(c => c.only === 'all' || c.only === $gender);
    $: items = (key) => Array.isArray(appearances[key]) ? appearances[key] : appearances[key][$gender];

    const pick = (key, id) => {
        const c = $customization[key];
        updateAppearance($gender, key, id, c.color, c.opacity);
    };
    const setColor = (key, color) => {
        const c = $customization[key];
        updateAppearance($gender, key, c.id, color, c.opacity);
    };
    const setOpacity = (key, value) => {
        const c = $customization[key];
        updateAppearance($gender, key, c.id, c.color, value / 100);
    };
</script>

<div><div class="h2">Внешность</div><p class="p" style="margin-top:6px">Причёска, кожа, глаза и макияж.</p></div>

{#each list as comp (comp.key)}
    {#if $customization[comp.key]}
        <div class="grp">
            <div class="grp__h">{comp.title}<em>{items(comp.key).length}</em></div>
            <div class="grid g3">
                {#each items(comp.key) as it, i}
                    <button class="tile" class:is-active={$customization[comp.key].id === i} title={it.name}
                            on:click={() => pick(comp.key, i)}>{it.name}</button>
                {/each}
            </div>
            {#if comp.colors}
                <div class="row-f" style="flex-wrap:wrap;gap:10px">
                    {#each comp.colors as col, ci}
                        <button class="swatch" class:is-active={$customization[comp.key].color === col.id} style="--c:{col.hex}"
                                aria-label="Цвет {ci + 1}" on:click={() => setColor(comp.key, col.id)}></button>
                    {/each}
                </div>
            {/if}
            {#if comp.opacity}
                <div class="slider">
                    <div class="slider__top"><span>Насыщенность</span><output>{Math.round(($customization[comp.key].opacity ?? 0) * 100)} %</output></div>
                    <input type="range" min="0" max="100" step="10" value={Math.round(($customization[comp.key].opacity ?? 0) * 100)}
                           style="--a:0%;--b:{Math.round(($customization[comp.key].opacity ?? 0) * 100)}%"
                           on:input={(e) => setOpacity(comp.key, Number(e.target.value))} aria-label="Насыщенность" />
                </div>
            {/if}
        </div>
    {/if}
{/each}
