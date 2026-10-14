<script>
    import { gender, customization, updateParents, updateShapeMix, updateSkinTone } from 'store/customization'
    import parents from '@/views/player/newauthentication/chars/create/elements/info/parents.js'
    import Icon from '@/masson/Icon.svelte'
    import Slider from '@/masson/ui/Slider.svelte'

    // parents[false] — матери, parents[true] — отцы; в данных персонажа хранятся индексы в этих списках.
    $: mother = $customization.motherId;
    $: father = $customization.fatherId;
    $: mix = Math.round(($customization.shapeMix ?? 0.5) * 100);
    $: skin = Math.round(($customization.skinTone ?? 0.5) * 100);
</script>

<div><div class="h2">Наследственность</div><p class="p" style="margin-top:6px">Внешность — смесь черт мамы и папы.</p></div>

<div class="grp"><div class="grp__h">Мама</div>
    <div class="grid g4">
        {#each parents[false] as p, i}
            <button class="tile" class:is-active={mother === i} title={p.name}
                    on:click={() => updateParents($gender, i, father)}><span class="face"><Icon name="user" /></span>{p.name}</button>
        {/each}
    </div>
</div>
<div class="grp"><div class="grp__h">Папа</div>
    <div class="grid g4">
        {#each parents[true] as p, i}
            <button class="tile" class:is-active={father === i} title={p.name}
                    on:click={() => updateParents($gender, mother, i)}><span class="face"><Icon name="user" /></span>{p.name}</button>
        {/each}
    </div>
</div>
<div class="grp">
    <Slider label="Сходство: мама ← → папа" min={0} max={100} value={mix} unit="%"
            onChange={(v) => updateShapeMix($gender, v / 100)} />
    <Slider label="Оттенок кожи" min={0} max={100} value={skin} unit="%"
            onChange={(v) => updateSkinTone($gender, v / 100)} />
</div>
