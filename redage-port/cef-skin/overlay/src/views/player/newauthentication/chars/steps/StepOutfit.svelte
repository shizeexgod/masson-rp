<script>
    // Стартовая одежда: головной убор, верх, низ, обувь. updateClothes — как в RedAge; камера наводится на часть тела.
    import { gender, customization, updateClothes } from 'store/customization'
    import { executeClient } from 'api/rage'
    import clothes from '@/views/player/newauthentication/chars/create/elements/clothes/clothes.js'
    import Icon from '@/masson/Icon.svelte'

    const PARTS = [
        { key: 'head',  cam: 'hat',   title: 'Головной убор' },
        { key: 'tops',  cam: 'top',   title: 'Верхняя одежда' },
        { key: 'legs',  cam: 'legs',  title: 'Нижняя одежда' },
        { key: 'shoes', cam: 'shoes', title: 'Обувь' },
    ];

    const pick = (part, id) => {
        executeClient("client.characters.customization.updateCam", part.cam);
        updateClothes($gender, part.key, id);
    };
</script>

<div><div class="h2">Стартовая одежда</div><p class="p" style="margin-top:6px">Позже можно купить любую другую в магазинах.</p></div>

{#each PARTS as part (part.key)}
    <div class="grp">
        <div class="grp__h">{part.title}<em>{clothes[$gender][part.key].length}</em></div>
        <div class="grid" style="gap:10px">
            {#each clothes[$gender][part.key] as item, i}
                <button class="card card--hover" class:is-selected={$customization[part.key] === i}
                        style="display:flex;align-items:center;gap:14px;text-align:left;font-family:inherit;color:inherit;cursor:pointer;padding:12px 14px"
                        on:click={() => pick(part, i)}>
                    <span class="face" style="border-radius:var(--radius-btn)"><Icon name="shirt" /></span>
                    <span class="grow"><b style="font-size:15px">{item.name}</b></span>
                    {#if $customization[part.key] === i}<span class="bdg bdg--accent">Выбрано</span>{/if}
                </button>
            {/each}
        </div>
    </div>
{/each}
